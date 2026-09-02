'use client'

import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { formatMoney } from '@/lib/currency'
import { useDebts } from '@/lib/queries'
import { Check, CreditCard, Landmark, PlusIcon, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Cell, Pie, PieChart } from 'recharts'

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
import { AddDebtDialog } from './add-debt-dialog'
import { AddDebtPaymentDialog } from './add-debt-payment-dialog'
import { EditDebtDialog } from './edit-debt-dialog'

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

interface Debt {
  id: string
  name: string
  type: string
  originalAmount: number
  remainingBalance: number
  minimumPayment: number | null
  paymentDueDay: number | null
  creditLimit: number | null
  totalPaid: number
  createdAt: Date
}

export function Debts() {
  const currency = useCurrency()
  const { t } = useLanguage()
  const { data: debts = [], isLoading: loading } = useDebts()
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)

  const totalRemaining = debts.reduce(
    (total, debt) => total + debt.remainingBalance,
    0
  )
  const totalMinimumPayment = debts
    .filter((debt) => debt.remainingBalance > 0)
    .reduce((total, debt) => total + (debt.minimumPayment ?? 0), 0)

  const monthlyDistribution = debts
    .filter(
      (debt) => debt.remainingBalance > 0 && (debt.minimumPayment ?? 0) > 0
    )
    .sort((a, b) => (b.minimumPayment ?? 0) - (a.minimumPayment ?? 0))
    .map((debt, index) => ({
      name: debt.name,
      amount: debt.minimumPayment ?? 0,
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

  const DebtCard = ({ debt }: { debt: Debt }) => {
    const isCreditCard = debt.type === 'credit_card'
    // Real cumulative payments, not originalAmount - remainingBalance —
    // interest charges and credit-card purchases also move remainingBalance,
    // so that difference isn't the same as what's actually been paid.
    const paid = debt.totalPaid
    const percentPaid =
      isCreditCard && typeof debt.creditLimit === 'number'
        ? debt.creditLimit > 0
          ? Math.min(
              100,
              Math.max(0, (debt.remainingBalance / debt.creditLimit) * 100)
            )
          : 0
        : debt.originalAmount > 0
          ? Math.min(100, Math.max(0, (paid / debt.originalAmount) * 100))
          : 0
    const isPaidOff = debt.remainingBalance <= 0

    return (
      <div
        className={`bg-card text-card-foreground shadow-soft flex flex-col rounded-xl p-4 transition-shadow ${
          isPaidOff ? 'opacity-60' : 'hover:shadow-lift'
        }`}
      >
        <div className="mb-3 flex min-h-14 items-start justify-between gap-2">
          <Link href={`?debt&id=${debt.id}`} className="block min-w-0">
            <h3 className="text-foreground truncate text-base font-bold">
              {debt.name}
            </h3>
            {(debt.type === 'credit_card' || isPaidOff) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {debt.type === 'credit_card' && (
                  <Badge variant="secondary" className="gap-1">
                    <CreditCard className="h-3 w-3" />
                    {t('debts.creditCard')}
                  </Badge>
                )}
                {isPaidOff && (
                  <Badge variant="outline" className="gap-1">
                    <Check className="h-3 w-3" />
                    {t('debts.paidOff')}
                  </Badge>
                )}
              </div>
            )}
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditingDebt(debt)}
          >
            {t('debts.edit')}
          </Button>
        </div>

        <Link href={`?debt&id=${debt.id}`} className="block">
          <div className="mb-3">
            <p className="text-muted-foreground mb-0.5 text-xs">
              {t('debts.remainingBalance')}
            </p>
            <p
              className={`text-xl font-bold ${isPaidOff ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              ${formatMoney(debt.remainingBalance, currency)}
            </p>
          </div>

          <div className="mb-3">
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${isPaidOff ? 'bg-muted-foreground/50' : 'bg-primary'}`}
                style={{ width: `${percentPaid}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {isCreditCard && typeof debt.creditLimit === 'number'
                ? t('debts.usedOfLimit', {
                    used: formatMoney(debt.remainingBalance, currency),
                    limit: formatMoney(debt.creditLimit, currency),
                  })
                : t('debts.paidOfTotal', {
                    paid: formatMoney(paid, currency),
                    total: formatMoney(debt.originalAmount, currency),
                  })}
            </p>
          </div>

          {typeof debt.creditLimit === 'number' && (
            <p className="text-muted-foreground mb-2 text-xs">
              {t('debts.availableCredit')}: $
              {formatMoney(
                Math.max(0, debt.creditLimit - debt.remainingBalance),
                currency
              )}{' '}
              {t('debts.ofLimit', {
                limit: formatMoney(debt.creditLimit, currency),
              })}
            </p>
          )}

          {(typeof debt.minimumPayment === 'number' ||
            typeof debt.paymentDueDay === 'number') && (
            <div className="text-muted-foreground mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {typeof debt.minimumPayment === 'number' && (
                <span>
                  {t('debts.minimumPayment')}: $
                  {formatMoney(debt.minimumPayment, currency)}
                </span>
              )}
              {typeof debt.paymentDueDay === 'number' && (
                <span>
                  {t('debts.dueOnDay', { day: String(debt.paymentDueDay) })}
                </span>
              )}
            </div>
          )}
        </Link>

        {!isPaidOff && (
          <div className="mt-auto pt-1">
            <AddDebtPaymentDialog
              debt={debt}
              trigger={
                <Button className="w-full" size="sm">
                  {t('debts.recordPayment')}
                </Button>
              }
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div className="flex w-full justify-end">
        <AddDebtDialog
          trigger={
            <Button>
              <PlusIcon className="size-4" />
              {t('debts.addDebt')}
            </Button>
          }
        />
      </div>

      {!loading && debts.length > 0 && (
        <div className="mt-6 grid w-full gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex min-h-10 flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('debts.totalOwed')}
              </CardTitle>
              <Landmark className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${formatMoney(totalRemaining, currency)}
              </div>
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
              <div className="text-2xl font-bold">
                ${formatMoney(totalMinimumPayment, currency)}
              </div>
              <p className="text-muted-foreground text-xs">
                {t('overview.perMonth')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && monthlyDistribution.length > 0 && (
        <Card className="mt-6 w-full">
          <CardHeader>
            <CardTitle>{t('debts.monthlyDistribution')}</CardTitle>
            <CardDescription>
              {t('debts.monthlyDistributionDesc')}
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
                      {Math.round((entry.amount / totalMinimumPayment) * 100)}
                      %)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 w-full">
        {loading ? (
          <Loader className="m-auto" />
        ) : debts.length === 0 ? (
          <div className="bg-card text-card-foreground border-border shadow-soft flex flex-col items-center justify-center rounded-2xl border py-12 text-center">
            <Wallet className="text-muted-foreground/40 mb-4 h-16 w-16" />
            <h3 className="text-foreground mb-2 text-lg font-semibold">
              {t('debts.noDebtsYet')}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {t('debts.noDebtsYetDesc')}
            </p>
            <AddDebtDialog
              trigger={
                <Button>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  {t('debts.addDebt')}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...debts]
              .sort((a, b) => b.remainingBalance - a.remainingBalance)
              .map((debt) => (
                <DebtCard key={debt.id} debt={debt} />
              ))}
          </div>
        )}
      </div>

      <EditDebtDialog
        debt={editingDebt}
        open={!!editingDebt}
        onOpenChange={(open) => !open && setEditingDebt(null)}
      />
    </div>
  )
}
