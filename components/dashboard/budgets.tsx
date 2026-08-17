'use client'

import {
  cancelRecurringExpense,
  deleteBudgetItem,
} from '@/app/dashboard/budgets/actions'
import { cancelSubscription } from '@/app/dashboard/subscriptions/actions'
import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { formatMoney } from '@/lib/currency'
import { FREE_LIMITS, monthsBack } from '@/lib/plan-limits-shared'
import {
  useBudgetDailyActuals,
  useBudgetItems,
  useBudgetOverview,
  useProfile,
} from '@/lib/queries'
import { cn } from '@/lib/utils'
import { es } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  PlusIcon,
  Repeat,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import type { DayButton } from 'react-day-picker'
import { toast } from 'sonner'

import { Button } from '../ui/button'
import { Calendar } from '../ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card'
import { Loader } from '../ui/loader'
import {
  AddBudgetItemDialog,
  type EditableBudgetItem,
} from './add-budget-item-dialog'
import { useDashboardRefresh } from './refresh-provider'

// Budget item dates are stored as date-only values (UTC midnight). Reading
// them back with local getters (toDateString, toLocaleDateString without a
// timeZone) can shift the displayed day by one for negative UTC-offset
// timezones. These helpers keep the "intended" calendar day consistent:
// extract with UTC getters from a stored date, local getters from a
// calendar-grid date (which is already local midnight for that visible day).
function dbDateKey(date: Date | string) {
  const d = new Date(date)
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

interface CategoryAmount {
  category: string
  amount: number
}

function aggregateByDayAndCategory(
  entries: { date: Date | string; categoryName: string; amount: number }[]
) {
  const byDay = new Map<string, Map<string, number>>()
  for (const entry of entries) {
    const key = dbDateKey(entry.date)
    const dayTotals = byDay.get(key) ?? new Map<string, number>()
    dayTotals.set(
      entry.categoryName,
      (dayTotals.get(entry.categoryName) ?? 0) + entry.amount
    )
    byDay.set(key, dayTotals)
  }

  const result = new Map<string, CategoryAmount[]>()
  for (const [key, dayTotals] of byDay) {
    result.set(
      key,
      Array.from(dayTotals.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
    )
  }
  return result
}

const ITEMS_PER_PAGE = 10

const MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const

interface DayBudgetDetailProps {
  date: Date
  locale: string
  currency: string
  labels: { planned: string; actual: string }
  plannedTotal?: number
  actualTotal?: number
  plannedCategories: CategoryAmount[]
  actualCategories: CategoryAmount[]
}

function DayBudgetDetail({
  date,
  locale,
  currency,
  labels,
  plannedTotal,
  actualTotal,
  plannedCategories,
  actualCategories,
}: DayBudgetDetailProps) {
  const hasCategoryDetail =
    plannedCategories.length > 0 || actualCategories.length > 0

  const plannedByCategory = new Map(
    plannedCategories.map((entry) => [entry.category, entry.amount])
  )
  const actualByCategory = new Map(
    actualCategories.map((entry) => [entry.category, entry.amount])
  )
  const categoryOrder = [
    ...plannedCategories.map((entry) => entry.category),
    ...actualCategories
      .map((entry) => entry.category)
      .filter((category) => !plannedByCategory.has(category)),
  ]

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {date.toLocaleDateString(locale, {
          day: '2-digit',
          month: 'long',
        })}
      </p>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{labels.planned}</span>
        <span className="text-primary font-semibold">
          ${formatMoney(plannedTotal ?? 0, currency)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{labels.actual}</span>
        <span className="font-semibold text-amber-600 dark:text-amber-500">
          ${formatMoney(actualTotal ?? 0, currency)}
        </span>
      </div>
      {hasCategoryDetail && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px]">
          <span />
          <span className="text-muted-foreground text-right font-medium">
            {labels.planned}
          </span>
          <span className="text-muted-foreground text-right font-medium">
            {labels.actual}
          </span>
          {categoryOrder.map((category) => (
            <Fragment key={category}>
              <span className="truncate">{category}</span>
              <span className="text-right font-medium">
                {plannedByCategory.has(category) ? (
                  `$${formatMoney(plannedByCategory.get(category)!, currency)}`
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
              <span className="text-right font-medium">
                {actualByCategory.has(category) ? (
                  `$${formatMoney(actualByCategory.get(category)!, currency)}`
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

function BudgetDayButton({
  totals,
  actuals,
  plannedCategories,
  actualCategories,
  currency,
  locale,
  labels,
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton> & {
  totals: Map<string, number>
  actuals: Map<string, number>
  plannedCategories: Map<string, CategoryAmount[]>
  actualCategories: Map<string, CategoryAmount[]>
  currency: string
  locale: string
  labels: { planned: string; actual: string }
}) {
  const key = localDateKey(day.date)
  const total = totals.get(key)
  const actual = actuals.get(key)
  const plannedCats = plannedCategories.get(key) ?? []
  const actualCats = actualCategories.get(key) ?? []

  const button = (
    <Button
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale)}
      className={cn(
        'flex aspect-square h-full w-full min-w-(--cell-size) flex-col gap-0.5 leading-none font-normal',
        modifiers.today && 'bg-accent',
        modifiers.outside && 'text-muted-foreground',
        className
      )}
      {...props}
    >
      <span className="text-xs">{day.date.getDate()}</span>
      {total ? (
        <span className="text-primary text-[9px] leading-none font-semibold">
          {formatMoney(total, currency)}
        </span>
      ) : null}
      {actual ? (
        <span className="text-[9px] leading-none font-semibold text-amber-600 dark:text-amber-500">
          {formatMoney(actual, currency)}
        </span>
      ) : null}
    </Button>
  )

  const hasCategoryDetail = plannedCats.length > 0 || actualCats.length > 0
  if (!hasCategoryDetail && !actual) return button

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>{button}</HoverCardTrigger>
      <HoverCardContent className="w-auto min-w-64">
        <DayBudgetDetail
          date={day.date}
          locale={locale}
          currency={currency}
          labels={labels}
          plannedTotal={total}
          actualTotal={actual}
          plannedCategories={plannedCats}
          actualCategories={actualCats}
        />
      </HoverCardContent>
    </HoverCard>
  )
}

export function Budgets() {
  const currency = useCurrency()
  const { t, language } = useLanguage()
  const locale = language === 'es' ? 'es-ES' : 'en-US'
  const { triggerRefresh } = useDashboardRefresh()
  const { data: profile } = useProfile()
  const isFreePlan = profile?.plan !== 'PRO'
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const atOldestAllowedMonth =
    isFreePlan && monthsBack(month, year) >= FREE_LIMITS.budgetMonthsBack
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [editingItem, setEditingItem] = useState<EditableBudgetItem | null>(
    null
  )
  // Force a full remount of the dialog every time it opens, otherwise
  // reopening it for the same item reuses stale internal state (e.g. the
  // DatePicker keeps whatever date it last held instead of the fresh value).
  const [dialogKey, setDialogKey] = useState(0)
  const [occasionalPage, setOccasionalPage] = useState(1)
  const [recurringPage, setRecurringPage] = useState(1)

  const { data: items = [], isLoading: loadingItems } = useBudgetItems(
    month,
    year
  )
  const { data: categoryTotals = [], isLoading: loadingOverview } =
    useBudgetOverview(month, year)
  const { data: dailyActuals = [], isLoading: loadingActuals } =
    useBudgetDailyActuals(month, year)
  const loading = loadingItems || loadingOverview || loadingActuals

  const actualByDay = useMemo(() => {
    const actuals = new Map<string, number>()
    for (const expense of dailyActuals) {
      const key = dbDateKey(expense.date)
      actuals.set(key, (actuals.get(key) ?? 0) + expense.amount)
    }
    return actuals
  }, [dailyActuals])

  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear()
  // `now` is a real local instant (not a UTC-midnight storage date like the
  // ones dbDateKey expects), so it must be keyed the same way calendar cells
  // are — with local getters — or the "today" card can point at the wrong
  // day for negative UTC-offset timezones.
  const todayKey = localDateKey(now)

  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const item of items) {
      const key = dbDateKey(item.date)
      totals.set(key, (totals.get(key) ?? 0) + item.amount)
    }
    return totals
  }, [items])

  const plannedCategoriesByDay = useMemo(
    () => aggregateByDayAndCategory(items),
    [items]
  )
  const actualCategoriesByDay = useMemo(
    () => aggregateByDayAndCategory(dailyActuals),
    [dailyActuals]
  )

  const todayPlannedTotal = isCurrentMonth
    ? (dailyTotals.get(todayKey) ?? 0)
    : 0
  const todayActualTotal = isCurrentMonth ? (actualByDay.get(todayKey) ?? 0) : 0

  // Sum of planned expenses strictly after today (tomorrow through the end
  // of the viewed month). Built from local calendar getters on `now`, same
  // as todayKey above, so it lines up with the "intended" calendar day
  // rather than shifting with the server/browser's UTC offset.
  const tomorrowUtcMidnight = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  )
  const remainingMonthPlannedTotal = isCurrentMonth
    ? items
        .filter((item) => new Date(item.date) >= tomorrowUtcMidnight)
        .reduce((sum, item) => sum + item.amount, 0)
    : 0

  const goToPreviousMonth = () => {
    setOccasionalPage(1)
    setRecurringPage(1)
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const goToNextMonth = () => {
    setOccasionalPage(1)
    setRecurringPage(1)
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const occasionalItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.subscriptionId && !item.recurringExpenseId && !item.debtId
      ),
    [items]
  )
  const recurringItems = useMemo(
    () =>
      items.filter(
        (item) => item.subscriptionId || item.recurringExpenseId || item.debtId
      ),
    [items]
  )

  const occasionalTotalPages = Math.max(
    1,
    Math.ceil(occasionalItems.length / ITEMS_PER_PAGE)
  )
  const occasionalPageClamped = Math.min(occasionalPage, occasionalTotalPages)
  const paginatedOccasionalItems = occasionalItems.slice(
    (occasionalPageClamped - 1) * ITEMS_PER_PAGE,
    occasionalPageClamped * ITEMS_PER_PAGE
  )

  const recurringTotalPages = Math.max(
    1,
    Math.ceil(recurringItems.length / ITEMS_PER_PAGE)
  )
  const recurringPageClamped = Math.min(recurringPage, recurringTotalPages)
  const paginatedRecurringItems = recurringItems.slice(
    (recurringPageClamped - 1) * ITEMS_PER_PAGE,
    recurringPageClamped * ITEMS_PER_PAGE
  )

  const handleDelete = async (item: (typeof items)[number]) => {
    try {
      if (item.recurringExpenseId) {
        await cancelRecurringExpense(item.recurringExpenseId)
        toast.success(t('budgets.recurringCancelled'))
      } else if (item.subscriptionId) {
        await cancelSubscription(item.subscriptionId)
        toast.success(t('subscriptions.cancelSuccess'))
      } else {
        await deleteBudgetItem(item.id)
        toast.success(t('budgets.itemDeleted'))
      }
      triggerRefresh()
    } catch (error) {
      console.error('Error deleting budget item:', error)
      toast.error(t('budgets.itemDeleteFailed'))
    }
  }

  const totalBudgeted = categoryTotals.reduce(
    (sum, item) => sum + (item.amount ?? 0),
    0
  )
  const totalSpent = categoryTotals.reduce((sum, item) => sum + item.spent, 0)

  const openEdit = (item: (typeof items)[number]) => {
    setEditingItem({
      id: item.id,
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      date: item.date,
      amount: item.amount,
      description: item.description,
      subscriptionId: item.subscriptionId,
      recurringExpenseId: item.recurringExpenseId,
      debtId: item.debtId,
    })
    setDialogKey((k) => k + 1)
    setIsAddOpen(true)
  }

  const BudgetItemRow = ({
    item,
    isRecurring,
  }: {
    item: (typeof items)[number]
    isRecurring: boolean
  }) => (
    <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-muted-foreground w-14 shrink-0 text-xs">
          {new Date(item.date).toLocaleDateString(locale, {
            day: '2-digit',
            month: 'short',
            timeZone: 'UTC',
          })}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-medium">
            {isRecurring && (
              <Repeat className="text-muted-foreground h-3 w-3 shrink-0" />
            )}
            <span className="truncate">
              {item.description || item.categoryName}
            </span>
          </p>
          <p className="text-muted-foreground text-xs">
            {item.categoryName}
            {item.subcategoryName && ` • ${item.subcategoryName}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-medium">
          ${formatMoney(item.amount, currency)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => openEdit(item)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive hover:text-destructive h-7 w-7"
          onClick={() => handleDelete(item)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )

  const PaginationBar = ({
    page,
    totalPages,
    totalItems,
    onPrevious,
    onNext,
  }: {
    page: number
    totalPages: number
    totalItems: number
    onPrevious: () => void
    onNext: () => void
  }) => (
    <div className="mt-4 flex items-center justify-between gap-2">
      <div className="text-muted-foreground text-sm">
        {(page - 1) * ITEMS_PER_PAGE + 1}–
        {Math.min(page * ITEMS_PER_PAGE, totalItems)} {t('transactions.of')}{' '}
        {totalItems}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevious}
          disabled={page === 1}
          aria-label={t('transactions.previous')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onNext}
          disabled={page === totalPages}
          aria-label={t('transactions.next')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex w-full flex-col gap-6 rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div className="flex w-full items-center justify-end">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={goToPreviousMonth}
            disabled={atOldestAllowedMonth}
            title={
              atOldestAllowedMonth ? t('budgets.upgradeForHistory') : undefined
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center font-medium">
            {t(`budgets.months.${MONTH_KEYS[month - 1]}`)} {year}
          </span>
          <Button size="icon" variant="outline" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Loader className="m-auto" />
      ) : (
        <>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{t('budgets.cashFlow')}</h2>
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null)
                  setSelectedDate(
                    new Date(year, month - 1, Math.min(now.getDate(), 28))
                  )
                  setDialogKey((k) => k + 1)
                  setIsAddOpen(true)
                }}
              >
                <PlusIcon className="h-4 w-4" />
                {t('budgets.addItem')}
              </Button>
            </div>

            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="w-full md:max-w-2xl">
                <Calendar
                  mode="single"
                  month={new Date(year, month - 1, 1)}
                  selected={undefined}
                  showOutsideDays={false}
                  locale={language === 'es' ? es : undefined}
                  onSelect={(date) => {
                    if (!date) return
                    setEditingItem(null)
                    setSelectedDate(date)
                    setDialogKey((k) => k + 1)
                    setIsAddOpen(true)
                  }}
                  className="w-full"
                  classNames={{
                    nav: 'hidden',
                    month_caption: 'hidden',
                    month: 'w-full',
                    month_grid: 'w-full',
                  }}
                  components={{
                    DayButton: (props) => (
                      <BudgetDayButton
                        {...props}
                        totals={dailyTotals}
                        actuals={actualByDay}
                        plannedCategories={plannedCategoriesByDay}
                        actualCategories={actualCategoriesByDay}
                        currency={currency}
                        locale={locale}
                        labels={{
                          planned: t('overview.cashFlowPlanned'),
                          actual: t('overview.cashFlowActual'),
                        }}
                      />
                    ),
                  }}
                />
              </div>

              {isCurrentMonth && (
                <div className="flex flex-col gap-4 md:flex-1">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium capitalize">
                        {now.toLocaleDateString(locale, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DayBudgetDetail
                        date={now}
                        locale={locale}
                        currency={currency}
                        labels={{
                          planned: t('overview.cashFlowPlanned'),
                          actual: t('overview.cashFlowActual'),
                        }}
                        plannedTotal={todayPlannedTotal}
                        actualTotal={todayActualTotal}
                        plannedCategories={
                          plannedCategoriesByDay.get(todayKey) ?? []
                        }
                        actualCategories={
                          actualCategoriesByDay.get(todayKey) ?? []
                        }
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        {t('budgets.remainingMonthTitle')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-primary text-2xl font-bold">
                        ${formatMoney(remainingMonthPlannedTotal, currency)}
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t('budgets.remainingMonthDesc')}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            <AddBudgetItemDialog
              key={dialogKey}
              open={isAddOpen}
              onOpenChange={setIsAddOpen}
              defaultDate={selectedDate}
              item={editingItem}
              onSaved={triggerRefresh}
            />

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Wallet className="text-muted-foreground/40 mb-3 h-12 w-12" />
                <p className="text-muted-foreground text-sm">
                  {t('budgets.noItemsYet')}
                </p>
              </div>
            ) : (
              <>
                {occasionalItems.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                      {t('budgets.occasionalExpenses')}
                    </h3>
                    <div className="space-y-1">
                      {paginatedOccasionalItems.map((item) => (
                        <BudgetItemRow
                          key={item.id}
                          item={item}
                          isRecurring={false}
                        />
                      ))}
                    </div>
                    {occasionalTotalPages > 1 && (
                      <PaginationBar
                        page={occasionalPageClamped}
                        totalPages={occasionalTotalPages}
                        totalItems={occasionalItems.length}
                        onPrevious={() =>
                          setOccasionalPage(occasionalPageClamped - 1)
                        }
                        onNext={() =>
                          setOccasionalPage(occasionalPageClamped + 1)
                        }
                      />
                    )}
                  </div>
                )}

                {recurringItems.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                      {t('budgets.recurringExpenses')}
                    </h3>
                    <div className="space-y-1">
                      {paginatedRecurringItems.map((item) => (
                        <BudgetItemRow
                          key={item.id}
                          item={item}
                          isRecurring={true}
                        />
                      ))}
                    </div>
                    {recurringTotalPages > 1 && (
                      <PaginationBar
                        page={recurringPageClamped}
                        totalPages={recurringTotalPages}
                        totalItems={recurringItems.length}
                        onPrevious={() =>
                          setRecurringPage(recurringPageClamped - 1)
                        }
                        onNext={() =>
                          setRecurringPage(recurringPageClamped + 1)
                        }
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {categoryTotals.length > 0 && (
            <div>
              <h2 className="mb-3 font-semibold">{t('budgets.byCategory')}</h2>
              {totalBudgeted > 0 && (
                <p className="text-muted-foreground mb-3 text-sm">
                  {t('budgets.totalSpentOfBudget', {
                    spent: formatMoney(totalSpent, currency),
                    budget: formatMoney(totalBudgeted, currency),
                  })}
                </p>
              )}
              <div className="space-y-3">
                {categoryTotals.map((item) => {
                  const displayAmount = item.amount ?? 0
                  const isZeroBudgetWithSpend =
                    displayAmount === 0 && item.spent > 0
                  const percentSpent = isZeroBudgetWithSpend
                    ? 100
                    : displayAmount > 0
                      ? Math.min(100, (item.spent / displayAmount) * 100)
                      : 0
                  const isOverBudget =
                    isZeroBudgetWithSpend ||
                    (displayAmount > 0 && item.spent > displayAmount)
                  const barColor = isOverBudget
                    ? 'bg-red-500'
                    : percentSpent >= 80
                      ? 'bg-yellow-500'
                      : 'bg-primary'

                  return (
                    <div
                      key={item.categoryId}
                      className="bg-muted/50 rounded-lg p-3"
                    >
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{item.categoryName}</span>
                        <span className="text-muted-foreground">
                          ${formatMoney(item.spent, currency)} / $
                          {formatMoney(displayAmount, currency)}
                        </span>
                      </div>
                      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${percentSpent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
