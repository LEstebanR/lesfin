'use client'

import {
  cancelSubscription,
  deleteSubscription,
  reactivateSubscription,
} from '@/app/dashboard/subscriptions/actions'
import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { formatMoney } from '@/lib/currency'
import { useSubscriptions } from '@/lib/queries'
import { CreditCard, Landmark, PlusIcon, Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
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
import { Loader } from '../ui/loader'
import {
  AddSubscriptionDialog,
  EditableSubscription,
} from './add-subscription-dialog'
import { PaySubscriptionDialog } from './pay-subscription-dialog'
import { useDashboardRefresh } from './refresh-provider'

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

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

interface Subscription {
  id: string
  name: string
  categoryId: string
  subcategoryId: string | null
  categoryName: string
  subcategoryName: string | null
  amount: number
  frequency: string
  dueDay: number | null
  dueMonth: number | null
  startDate: Date
  isActive: boolean
  accountId: string | null
  debtId: string | null
  sourceName: string | null
}

// Next occurrence of dueDay/dueMonth on or after today, used to sort cards
// by urgency. Mirrors the clamp-to-month-length behavior the budget/actions
// server logic uses, so a due day of 31 in a shorter month still resolves
// to that month's last day instead of overflowing.
function getNextRenewalDate(subscription: Subscription): Date {
  const now = new Date()
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  )
  const day = subscription.dueDay ?? 1

  if (subscription.frequency === 'yearly') {
    const month = (subscription.dueMonth ?? 1) - 1
    for (const year of [today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
      const candidate = new Date(
        Date.UTC(year, month, Math.min(day, daysInMonth))
      )
      if (candidate >= today) return candidate
    }
  }

  for (const offset of [0, 1]) {
    const year = today.getUTCFullYear()
    const month = today.getUTCMonth() + offset
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const candidate = new Date(
      Date.UTC(year, month, Math.min(day, daysInMonth))
    )
    if (candidate >= today) return candidate
  }

  return today
}

export function Subscriptions() {
  const currency = useCurrency()
  const { t } = useLanguage()
  const { triggerRefresh } = useDashboardRefresh()
  const { data: subscriptions = [], isLoading: loading } = useSubscriptions()
  const [editingSubscription, setEditingSubscription] =
    useState<EditableSubscription | null>(null)

  const totalMonthly = subscriptions
    .filter((s) => s.isActive)
    .reduce(
      (total, s) =>
        total + (s.frequency === 'yearly' ? s.amount / 12 : s.amount),
      0
    )

  const monthlyDistribution = subscriptions
    .filter((s) => s.isActive)
    .map((s) => ({
      name: s.name,
      amount: s.frequency === 'yearly' ? s.amount / 12 : s.amount,
    }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((entry, index) => ({
      ...entry,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }))

  const monthlyDistributionConfig = monthlyDistribution.reduce<ChartConfig>(
    (config, entry, index) => {
      config[entry.name] = {
        label: entry.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }
      return config
    },
    {}
  )

  const handleCancel = async (id: string) => {
    try {
      await cancelSubscription(id)
      toast.success(t('subscriptions.cancelSuccess'))
      triggerRefresh()
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      toast.error(t('subscriptions.cancelFailed'))
    }
  }

  const handleReactivate = async (id: string) => {
    try {
      await reactivateSubscription(id)
      toast.success(t('subscriptions.reactivateSuccess'))
      triggerRefresh()
    } catch (error) {
      console.error('Error reactivating subscription:', error)
      toast.error(t('subscriptions.reactivateFailed'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteSubscription(id)
      toast.success(t('subscriptions.deleteSuccess'))
      triggerRefresh()
    } catch (error) {
      console.error('Error deleting subscription:', error)
      toast.error(t('subscriptions.deleteFailed'))
    }
  }

  const SubscriptionCard = ({
    subscription,
  }: {
    subscription: Subscription
  }) => (
    <div
      className={`bg-card text-card-foreground shadow-soft hover:shadow-lift rounded-xl p-6 transition-shadow ${!subscription.isActive ? 'opacity-60' : ''}`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-foreground truncate text-xl font-bold">
            {subscription.name}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="secondary">{subscription.categoryName}</Badge>
            {subscription.subcategoryName && (
              <Badge variant="secondary">{subscription.subcategoryName}</Badge>
            )}
            <Badge variant={subscription.isActive ? 'default' : 'outline'}>
              {subscription.isActive
                ? t('subscriptions.active')
                : t('subscriptions.cancelled')}
            </Badge>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setEditingSubscription({
              id: subscription.id,
              name: subscription.name,
              categoryId: subscription.categoryId,
              subcategoryId: subscription.subcategoryId,
              amount: subscription.amount,
              frequency: subscription.frequency,
              dueDay: subscription.dueDay,
              dueMonth: subscription.dueMonth,
              startDate: subscription.startDate,
              accountId: subscription.accountId,
              debtId: subscription.debtId,
            })
          }
        >
          {t('debts.edit')}
        </Button>
      </div>

      <div className="mb-4">
        <p className="text-foreground text-3xl font-bold">
          ${formatMoney(subscription.amount, currency)}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {subscription.frequency === 'yearly'
            ? t('subscriptions.dueOnDayOfMonth', {
                day: String(subscription.dueDay),
                month: t(
                  `budgets.months.${MONTH_KEYS[(subscription.dueMonth ?? 1) - 1]}`
                ),
              })
            : t('debts.dueOnDay', { day: String(subscription.dueDay) })}
        </p>
        {subscription.sourceName && (
          <p className="text-muted-foreground mt-1 text-xs">
            {t('subscriptions.paidWith', { name: subscription.sourceName })}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {subscription.isActive && (
          <PaySubscriptionDialog
            subscription={subscription}
            trigger={
              <Button className="min-w-0 flex-1" size="sm">
                <CreditCard className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('subscriptions.pay')}</span>
              </Button>
            }
          />
        )}
        {subscription.isActive ? (
          <Button
            className="min-w-0 flex-1"
            size="sm"
            variant="outline"
            onClick={() => handleCancel(subscription.id)}
          >
            <span className="truncate">
              {t('subscriptions.cancelSubscription')}
            </span>
          </Button>
        ) : (
          <Button
            className="min-w-0 flex-1"
            size="sm"
            variant="outline"
            onClick={() => handleReactivate(subscription.id)}
          >
            <span className="truncate">
              {t('subscriptions.reactivateSubscription')}
            </span>
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('subscriptions.deleteConfirmTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('subscriptions.deleteConfirmDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('debts.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(subscription.id)}>
                {t('debts.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div className="flex w-full justify-end">
        <AddSubscriptionDialog
          trigger={
            <Button>
              <PlusIcon className="size-4" />
              {t('subscriptions.addSubscription')}
            </Button>
          }
        />
      </div>

      {!loading && subscriptions.length > 0 && (
        <div className="mt-6 grid w-full gap-4 lg:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader className="flex min-h-10 flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('subscriptions.totalMonthly')}
              </CardTitle>
              <Landmark className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${formatMoney(totalMonthly, currency)}
              </div>
              <p className="text-muted-foreground text-xs">
                {t('overview.perMonth')}
              </p>
              {monthlyDistribution.length > 0 && (
                <div className="mt-4 space-y-2 border-t pt-3">
                  {monthlyDistribution.map((entry) => (
                    <div
                      key={entry.name}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.fill }}
                        />
                        <span className="truncate">{entry.name}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        ${formatMoney(entry.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {monthlyDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('subscriptions.monthlyDistribution')}</CardTitle>
                <CardDescription>
                  {t('subscriptions.monthlyDistributionDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <ChartContainer
                    config={monthlyDistributionConfig}
                    className="mx-auto aspect-square max-h-64 w-full sm:w-1/2"
                  >
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            nameKey="name"
                            labelKey="name"
                            formatter={(value) =>
                              `$${formatMoney(Number(value), currency)}`
                            }
                          />
                        }
                      />
                      <Pie
                        data={monthlyDistribution}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={55}
                        strokeWidth={2}
                      >
                        {monthlyDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="w-full space-y-2 sm:w-1/2">
                    {monthlyDistribution.map((entry) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.fill }}
                          />
                          <span className="truncate">{entry.name}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0 pl-2">
                          ${formatMoney(entry.amount, currency)} (
                          {Math.round((entry.amount / totalMonthly) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="mt-6 w-full">
        {loading ? (
          <Loader className="m-auto" />
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Repeat className="text-muted-foreground/40 mb-4 h-16 w-16" />
            <h3 className="text-foreground mb-2 text-lg font-semibold">
              {t('subscriptions.noSubscriptionsYet')}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {t('subscriptions.noSubscriptionsYetDesc')}
            </p>
            <AddSubscriptionDialog
              trigger={
                <Button>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  {t('subscriptions.addSubscription')}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {[...subscriptions]
              .sort((a, b) =>
                a.isActive === b.isActive
                  ? getNextRenewalDate(a).getTime() -
                    getNextRenewalDate(b).getTime()
                  : Number(b.isActive) - Number(a.isActive)
              )
              .map((subscription) => (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                />
              ))}
          </div>
        )}
      </div>

      <AddSubscriptionDialog
        subscription={editingSubscription}
        open={!!editingSubscription}
        onOpenChange={(open) => !open && setEditingSubscription(null)}
      />
    </div>
  )
}
