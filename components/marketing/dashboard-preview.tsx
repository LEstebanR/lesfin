'use client'

import { useLanguage } from '@/components/language-provider'
import { ArrowLeftRight, TrendingDown, TrendingUp } from 'lucide-react'

const formatAmount = (amount: number) =>
  amount.toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function DashboardPreview() {
  const { t } = useLanguage()

  const activity = [
    {
      key: 'salary',
      label: t('dashboardPreview.salary'),
      account: t('dashboardPreview.checking'),
      amount: 3200,
      kind: 'income',
    },
    {
      key: 'groceries',
      label: t('dashboardPreview.groceries'),
      account: t('dashboardPreview.checking'),
      amount: -85.4,
      kind: 'expense',
    },
    {
      key: 'rent',
      label: t('dashboardPreview.rent'),
      account: t('dashboardPreview.checking'),
      amount: -1200,
      kind: 'expense',
    },
    {
      key: 'toSavings',
      label: t('dashboardPreview.toSavings'),
      account: t('dashboardPreview.checkingToSavings'),
      amount: 500,
      kind: 'transfer',
    },
  ] as const

  return (
    <div className="bg-card rotate-2 rounded-2xl shadow-2xl transition-transform duration-500 hover:rotate-0">
      <div className="border-border flex items-center gap-1.5 border-b px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <span className="text-muted-foreground ml-2 text-xs">
          {t('dashboardPreview.overview')}
        </span>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <p className="text-muted-foreground text-xs">
            {t('dashboardPreview.totalBalance')}
          </p>
          <p className="text-4xl font-bold">$12,480.60</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">
              {t('dashboardPreview.income')}
            </p>
            <p className="text-lg font-semibold text-green-500">+$3,200.00</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">
              {t('dashboardPreview.expenses')}
            </p>
            <p className="text-lg font-semibold text-red-500">-$1,285.40</p>
          </div>
        </div>

        <div className="space-y-3">
          {activity.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    item.kind === 'income'
                      ? 'bg-green-500/10 text-green-500'
                      : item.kind === 'expense'
                        ? 'bg-red-500/10 text-red-500'
                        : 'text-primary bg-primary/10'
                  }`}
                >
                  {item.kind === 'income' ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : item.kind === 'expense' ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <ArrowLeftRight className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.account}
                  </p>
                </div>
              </div>
              <p
                className={
                  item.kind === 'income'
                    ? 'font-semibold text-green-500'
                    : item.kind === 'expense'
                      ? 'font-semibold text-red-500'
                      : 'text-primary font-semibold'
                }
              >
                {item.amount > 0 ? '+' : '-'}$
                {formatAmount(Math.abs(item.amount))}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
