'use client'

import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { getAccountIcon } from '@/lib/account-icons'
import { formatMoney } from '@/lib/currency'
import {
  useBudgetItems,
  useBudgetOverview,
  useOverviewData,
} from '@/lib/queries'
import { cn } from '@/lib/utils'
import {
  ArrowUpRight,
  DollarSign,
  Landmark,
  Lock,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../ui/chart'
import { Skeleton } from '../ui/skeleton'

const CATEGORY_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

interface Transaction {
  id: string
  accountId: string | null
  debtId: string | null
  amount: number
  type: string
  description: string
  date: Date
  categoryName: string
  sourceName: string | null
  createdAt: Date
}

interface Transfer {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
  date: Date
  note: string | null
  createdAt: Date
}

type CombinedItem =
  | (Transaction & { itemType: 'transaction' })
  | (Transfer & {
      itemType: 'transfer'
      fromAccountName?: string
      toAccountName?: string
    })

const EMPTY_ARRAY: never[] = []

export function Overview() {
  const currency = useCurrency()
  const { t } = useLanguage()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const { data: overviewData, isLoading: loadingOverview } = useOverviewData()
  const { data: budgetItems = EMPTY_ARRAY, isLoading: loadingBudget } =
    useBudgetOverview(currentMonth, currentYear)
  const { data: monthBudgetItems = EMPTY_ARRAY, isLoading: loadingCashFlow } =
    useBudgetItems(currentMonth, currentYear)
  const accounts = overviewData?.accounts ?? EMPTY_ARRAY
  const transactions = overviewData?.transactions ?? EMPTY_ARRAY
  const transfers = overviewData?.transfers ?? EMPTY_ARRAY
  const totalDebt = overviewData?.totalDebt ?? 0
  const totalMinimumPayment = overviewData?.totalMinimumPayment ?? 0
  const loading = loadingOverview || loadingBudget || loadingCashFlow
  const recentItems = useMemo(() => {
    const accountMap = new Map<string, string>()
    for (const account of accounts) {
      accountMap.set(account.id, account.name)
    }

    const transactionItems: CombinedItem[] = transactions
      .slice(0, 5)
      .map((t) => ({
        ...t,
        itemType: 'transaction' as const,
      }))

    const transferItems: CombinedItem[] = transfers.slice(0, 5).map((t) => ({
      ...t,
      itemType: 'transfer' as const,
      fromAccountName: accountMap.get(t.fromAccountId),
      toAccountName: accountMap.get(t.toAccountId),
    }))

    return [...transactionItems, ...transferItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [accounts, transactions, transfers])

  const getTotalBalance = () => {
    return accounts.reduce(
      (total, account) => total + (account.currentBalance || 0),
      0
    )
  }

  // Only cash/savings accounts count as money on hand for the month-end
  // projection below — debt-type accounts aren't liquid funds.
  const availableBalance = accounts
    .filter((account) => account.type === 'cash' || account.type === 'savings')
    .reduce((total, account) => total + (account.currentBalance || 0), 0)

  // Per-day planned vs. already-spent totals for the current month. A
  // planned item that's already been paid (a real expense Transaction
  // recorded against that same day) shouldn't also count as "still
  // needed" below — that money already left the account balance we're
  // comparing against, so counting the plan on top of it double-charges
  // the same expense. Keyed with UTC getters, matching how these dates
  // are stored (date-only, UTC midnight).
  const plannedByDayThisMonth = useMemo(() => {
    const map = new Map<number, number>()
    for (const item of monthBudgetItems) {
      const day = new Date(item.date).getUTCDate()
      map.set(day, (map.get(day) ?? 0) + item.amount)
    }
    return map
  }, [monthBudgetItems])

  const actualByDayThisMonth = useMemo(() => {
    const map = new Map<number, number>()
    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue
      const date = new Date(transaction.date)
      if (
        date.getUTCFullYear() !== currentYear ||
        date.getUTCMonth() + 1 !== currentMonth
      )
        continue
      const day = date.getUTCDate()
      map.set(day, (map.get(day) ?? 0) + transaction.amount)
    }
    return map
  }, [transactions, currentYear, currentMonth])

  // Sum of this month's planned expenses still ahead (today included) that
  // haven't already been paid, vs. what's currently sitting in cash/savings.
  // Positive means the remaining plan outruns what's on hand; negative
  // means there's a surplus for the rest of the month.
  const getRemainingPlannedExpenses = () => {
    const today = new Date()
    const daysInMonth = new Date(
      Date.UTC(currentYear, currentMonth, 0)
    ).getUTCDate()
    let total = 0
    for (let day = today.getDate(); day <= daysInMonth; day++) {
      const planned = plannedByDayThisMonth.get(day) ?? 0
      const actual = actualByDayThisMonth.get(day) ?? 0
      total += Math.max(0, planned - actual)
    }
    return total
  }

  const monthEndShortfall = getRemainingPlannedExpenses() - availableBalance

  // Broken out separately so the projection card can show it: it's the one
  // piece of "remaining" spend that isn't visible anywhere else, since the
  // Budget view's own "remaining this month" total deliberately starts
  // tomorrow (not today) — without this, the two numbers don't reconcile.
  const getTodayPlannedExpenses = () => {
    const today = new Date()
    const planned = plannedByDayThisMonth.get(today.getDate()) ?? 0
    const actual = actualByDayThisMonth.get(today.getDate()) ?? 0
    return Math.max(0, planned - actual)
  }

  const todayPlannedExpenses = getTodayPlannedExpenses()

  // Transaction dates are stored as UTC-midnight date-only values, so
  // filtering by the local getMonth()/getFullYear() can shift a date near
  // the start of the month into the previous local month for timezones
  // behind UTC. Compare in UTC instead, matching cashFlowData below.
  const getMonthlyStats = () => {
    const monthlyTransactions = transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date)
      return (
        transactionDate.getUTCFullYear() === currentYear &&
        transactionDate.getUTCMonth() + 1 === currentMonth
      )
    })

    const income = monthlyTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = monthlyTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    return { income, expenses }
  }

  const monthlyStats = getMonthlyStats()

  const getCategoryBreakdown = () => {
    const monthlyExpenses = transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date)
      return (
        transaction.type === 'expense' &&
        transactionDate.getUTCFullYear() === currentYear &&
        transactionDate.getUTCMonth() + 1 === currentMonth
      )
    })

    const totals = new Map<string, number>()
    for (const transaction of monthlyExpenses) {
      const key = transaction.categoryName || t('overview.uncategorized')
      totals.set(key, (totals.get(key) ?? 0) + Number(transaction.amount))
    }

    return Array.from(totals.entries())
      .map(([category, amount], index) => ({
        category,
        amount,
        fill: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount)
  }

  const cashFlowData = useMemo(() => {
    const daysInMonth = new Date(
      Date.UTC(currentYear, currentMonth, 0)
    ).getUTCDate()

    const plannedByDay = new Map<number, number>()
    for (const item of monthBudgetItems) {
      const day = new Date(item.date).getUTCDate()
      plannedByDay.set(day, (plannedByDay.get(day) ?? 0) + item.amount)
    }

    const actualByDay = new Map<number, number>()
    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue
      const date = new Date(transaction.date)
      if (
        date.getUTCFullYear() !== currentYear ||
        date.getUTCMonth() + 1 !== currentMonth
      )
        continue
      const day = date.getUTCDate()
      actualByDay.set(day, (actualByDay.get(day) ?? 0) + transaction.amount)
    }

    let cumulativePlanned = 0
    let cumulativeActual = 0
    const data = []
    for (let day = 1; day <= daysInMonth; day++) {
      cumulativePlanned += plannedByDay.get(day) ?? 0
      cumulativeActual += actualByDay.get(day) ?? 0
      data.push({
        day,
        planned: cumulativePlanned,
        actual: cumulativeActual,
      })
    }
    return data
  }, [monthBudgetItems, transactions, currentMonth, currentYear])

  const cashFlowChartConfig = {
    planned: {
      label: t('overview.cashFlowPlanned'),
      color: 'var(--chart-1)',
    },
    actual: {
      label: t('overview.cashFlowActual'),
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig

  const categoryBreakdown = getCategoryBreakdown()
  const categoryChartConfig = categoryBreakdown.reduce<ChartConfig>(
    (config, item, index) => {
      config[item.category] = {
        label: item.category,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }
      return config
    },
    { amount: { label: t('overview.amount') } }
  )

  const budgetedItems = budgetItems.filter(
    (item) =>
      item.amount !== null || item.suggestedAmount !== null || item.spent > 0
  )
  const totalBudgeted = budgetedItems.reduce(
    (sum, item) => sum + (item.amount ?? item.suggestedAmount ?? 0),
    0
  )
  const totalBudgetSpent = budgetedItems.reduce(
    (sum, item) => sum + item.spent,
    0
  )
  const budgetPercent =
    totalBudgeted > 0
      ? Math.min(100, (totalBudgetSpent / totalBudgeted) * 100)
      : 0
  const overBudgetCategories = budgetedItems.filter(
    (item) => item.spent > (item.amount ?? item.suggestedAmount ?? 0)
  )

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center justify-center rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
        <div className="w-full space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div className="w-full space-y-6">
        <div className="border-foreground/10 flex flex-col gap-2 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-muted-foreground text-[10px] font-black tracking-[0.24em] uppercase">
              {t('overview.thisMonth')}
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-tighter sm:text-5xl">
              {t('overview.title')}
            </h1>
          </div>
          <p className="text-muted-foreground max-w-xs text-sm sm:text-right">
            {t('overview.recentActivityDesc')}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Card className="bg-primary text-primary-foreground border-primary shadow-lift">
            <CardHeader className="flex min-h-10 flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('overview.totalBalance')}
              </CardTitle>
              <DollarSign className="text-primary-foreground/60 h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold tracking-tight tabular-nums ${
                  getTotalBalance() < 0 ? 'text-red-600' : ''
                }`}
              >
                ${formatMoney(getTotalBalance(), currency)}
              </div>
              <p className="text-primary-foreground/60 text-xs">
                {t('overview.across')} {accounts.length}{' '}
                {accounts.length === 1
                  ? t('overview.account')
                  : t('overview.accountsPlural')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex min-h-10 flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('overview.totalDebt')}
              </CardTitle>
              <Landmark className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums">
                ${formatMoney(totalDebt, currency)}
              </div>
              <p className="text-muted-foreground text-xs">
                {t('overview.outstanding')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex min-h-10 flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('overview.totalMinimumPayments')}
              </CardTitle>
              <Landmark className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums">
                ${formatMoney(totalMinimumPayment, currency)}
              </div>
              <p className="text-muted-foreground text-xs">
                {t('overview.perMonth')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex min-h-10 flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('overview.monthEndProjection')}
              </CardTitle>
              <Wallet
                className={`h-4 w-4 ${
                  monthEndShortfall > 0
                    ? 'text-red-600'
                    : 'text-muted-foreground'
                }`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold tracking-tight tabular-nums ${
                  monthEndShortfall > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                ${formatMoney(Math.abs(monthEndShortfall), currency)}
              </div>
              <p className="text-muted-foreground text-xs">
                {monthEndShortfall > 0
                  ? t('overview.monthEndShortfall')
                  : t('overview.monthEndSurplus')}
              </p>
              {todayPlannedExpenses > 0 && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {t('overview.monthEndIncludesToday', {
                    amount: formatMoney(todayPlannedExpenses, currency),
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-black tracking-tight">
              {t('overview.accountSummary')}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t('overview.accountSummaryDesc')}
            </p>
          </div>
          <div>
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-2 text-4xl">🏦</span>
                <p className="text-muted-foreground">
                  {t('overview.noAccounts')}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...accounts]
                  .sort((a, b) => b.currentBalance - a.currentBalance)
                  .map((account) => {
                    const TypeIcon =
                      account.type === 'cash'
                        ? Wallet
                        : account.type === 'caja'
                          ? Lock
                          : PiggyBank
                    const Icon = getAccountIcon(account.icon) ?? TypeIcon
                    const typeLabel =
                      account.type === 'cash'
                        ? t('accounts.cash')
                        : account.type === 'caja'
                          ? t('accounts.caja')
                          : t('accounts.savings')
                    const accountColor = account.color ?? 'var(--primary)'
                    return (
                      <Link
                        key={account.id}
                        href={`?account&id=${account.id}`}
                        className="block"
                      >
                        <Card
                          className="group border-foreground/10 hover:shadow-lift relative overflow-hidden shadow-none transition-all hover:-translate-y-1"
                          style={{
                            borderColor: account.color
                              ? `${account.color}55`
                              : undefined,
                            background: `linear-gradient(145deg, ${accountColor}14 0%, transparent 52%), var(--card)`,
                          }}
                        >
                          <div
                            className="absolute inset-x-0 top-0 h-1"
                            style={{ backgroundColor: accountColor }}
                          />
                          <CardHeader className="flex min-h-10 flex-row items-start justify-between space-y-0 pt-5 pb-2">
                            {account.logoUrl ? (
                              <div className="bg-card h-10 w-10 shrink-0 overflow-hidden rounded-xl border p-1 shadow-sm">
                                {/* eslint-disable-next-line @next/next/no-img-element -- external/dynamic logo domains, not worth remotePatterns config */}
                                <img
                                  src={account.logoUrl}
                                  alt=""
                                  className="h-full w-full object-contain"
                                />
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                  !account.color &&
                                    'bg-primary text-primary-foreground'
                                )}
                                style={
                                  account.color
                                    ? { backgroundColor: account.color }
                                    : undefined
                                }
                              >
                                <Icon
                                  className="h-5 w-5"
                                  style={
                                    account.color
                                      ? { color: 'white' }
                                      : undefined
                                  }
                                />
                              </div>
                            )}
                            <div className="ml-3 min-w-0 flex-1">
                              <CardTitle className="truncate text-sm font-bold">
                                {account.name}
                              </CardTitle>
                              <p className="text-muted-foreground mt-1 text-[10px] font-black tracking-[0.16em] uppercase">
                                {typeLabel}
                              </p>
                            </div>
                            <ArrowUpRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </CardHeader>
                          <CardContent className="pt-2 pb-5">
                            <p className="text-muted-foreground mb-1 text-[10px] font-black tracking-[0.16em] uppercase">
                              {t('accounts.currentBalance')}
                            </p>
                            <div
                              className={`text-3xl font-black tracking-tighter tabular-nums ${
                                Number(account.currentBalance) < 0
                                  ? 'text-red-600'
                                  : ''
                              }`}
                            >
                              $
                              {formatMoney(
                                Number(account.currentBalance),
                                currency
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
              </div>
            )}
          </div>
        </section>

        <Link href="?budget" className="block">
          <Card className="hover:shadow-lift transition-shadow">
            <CardHeader>
              <CardTitle>{t('overview.budgetProgress')}</CardTitle>
              <CardDescription>
                {t('overview.budgetProgressDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {budgetedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="mb-2 text-4xl">🎯</span>
                  <p className="text-muted-foreground">
                    {t('overview.noBudgetYet')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">
                        ${formatMoney(totalBudgetSpent, currency)} / $
                        {formatMoney(totalBudgeted, currency)}
                      </span>
                      <span className="text-muted-foreground">
                        {Math.round(budgetPercent)}%
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${
                          totalBudgetSpent > totalBudgeted
                            ? 'bg-red-500'
                            : budgetPercent >= 80
                              ? 'bg-yellow-500'
                              : 'bg-primary'
                        }`}
                        style={{ width: `${budgetPercent}%` }}
                      />
                    </div>
                  </div>
                  {overBudgetCategories.length > 0 && (
                    <p className="text-xs text-red-600">
                      {t('overview.overBudgetIn', {
                        categories: overBudgetCategories
                          .map((c) => c.categoryName)
                          .join(', '),
                      })}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{t('overview.cashFlowTitle')}</CardTitle>
            <CardDescription>{t('overview.cashFlowDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {monthBudgetItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-2 text-4xl">📈</span>
                <p className="text-muted-foreground">
                  {t('overview.noBudgetYet')}
                </p>
              </div>
            ) : (
              <ChartContainer
                config={cashFlowChartConfig}
                className="aspect-auto h-64 w-full"
              >
                <LineChart data={cashFlowData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) =>
                      formatMoney(Number(value), currency)
                    }
                    width={70}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(day) =>
                          t('overview.cashFlowDayThrough', { day: String(day) })
                        }
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              {name === 'planned'
                                ? t('overview.cashFlowPlannedCumulative')
                                : t('overview.cashFlowActualCumulative')}
                            </span>
                            <span className="font-medium">
                              ${formatMoney(Number(value), currency)}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line
                    dataKey="planned"
                    type="monotone"
                    stroke="var(--color-planned)"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    dataKey="actual"
                    type="monotone"
                    stroke="var(--color-actual)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('overview.categoryBreakdown')}</CardTitle>
            <CardDescription>
              {t('overview.categoryBreakdownDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-2 text-4xl">🥧</span>
                <p className="text-muted-foreground">
                  {t('overview.noExpensesThisMonth')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <ChartContainer
                  config={categoryChartConfig}
                  className="mx-auto aspect-square max-h-64 w-full sm:w-1/2"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          nameKey="category"
                          labelKey="category"
                          formatter={(value) =>
                            `$${formatMoney(Number(value), currency)}`
                          }
                        />
                      }
                    />
                    <Pie
                      data={categoryBreakdown}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius={55}
                      strokeWidth={2}
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.category} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="w-full space-y-2 sm:w-1/2">
                  {categoryBreakdown.map((entry) => (
                    <div
                      key={entry.category}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.fill }}
                        />
                        <span className="truncate">{entry.category}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0 pl-2">
                        ${formatMoney(entry.amount, currency)} (
                        {Math.round(
                          (entry.amount / monthlyStats.expenses) * 100
                        )}
                        %)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('overview.recentActivity')}</CardTitle>
            <CardDescription>
              {t('overview.recentActivityDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-2 text-4xl">📭</span>
                <p className="text-muted-foreground">
                  {t('overview.noActivity')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentItems.map((item) => (
                  <div
                    key={item.id}
                    className="border-border flex items-center justify-between border-b pb-4 last:border-b-0"
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          item.itemType === 'transaction'
                            ? item.type === 'income'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-red-100 text-red-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}
                      >
                        {item.itemType === 'transaction' ? (
                          item.type === 'income' ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )
                        ) : (
                          <Wallet className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {item.itemType === 'transaction'
                            ? item.description || item.categoryName
                            : item.note || t('overview.transfer')}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {item.itemType === 'transaction' ? (
                            <>
                              {item.sourceName}
                              {item.categoryName && ` • ${item.categoryName}`}
                            </>
                          ) : (
                            <>
                              {item.fromAccountName} → {item.toAccountName}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          item.itemType === 'transaction'
                            ? item.type === 'income'
                              ? 'text-green-600'
                              : 'text-red-600'
                            : 'text-blue-600'
                        }`}
                      >
                        {item.itemType === 'transaction' &&
                        item.type === 'income'
                          ? '+'
                          : ''}
                        ${formatMoney(Number(item.amount), currency)}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {new Date(item.date).toLocaleDateString(undefined, {
                          timeZone: 'UTC',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
