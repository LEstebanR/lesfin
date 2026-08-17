'use client'

import { useLanguage } from '@/components/language-provider'

const formatAmount = (amount: number) =>
  amount.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

export function SpendingTrendsPreview() {
  const { t } = useLanguage()

  const categories = [
    {
      key: 'rent',
      label: t('dashboardPreview.rent'),
      amount: 1200,
      color: '#3b82f6',
    },
    {
      key: 'groceries',
      label: t('dashboardPreview.groceries'),
      amount: 640,
      color: '#10b981',
    },
    {
      key: 'subscriptions',
      label: t('dashboardPreview.subscriptions'),
      amount: 185,
      color: '#a855f7',
    },
    {
      key: 'transport',
      label: t('dashboardPreview.transport'),
      amount: 140,
      color: '#f59e0b',
    },
    {
      key: 'entertainment',
      label: t('dashboardPreview.entertainment'),
      amount: 95,
      color: '#ef4444',
    },
  ] as const

  const max = Math.max(...categories.map((c) => c.amount))
  const months = [420, 610, 540, 780, 690, 860]
  const maxMonth = Math.max(...months)

  return (
    <div className="bg-card -rotate-2 rounded-2xl shadow-2xl transition-transform duration-500 hover:rotate-0">
      <div className="border-border flex items-center gap-1.5 border-b px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <span className="text-muted-foreground ml-2 text-xs">
          {t('dashboardPreview.trends')}
        </span>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <p className="text-muted-foreground mb-3 text-xs">
            {t('dashboardPreview.lastSixMonths')}
          </p>
          <div className="flex h-24 items-end gap-2">
            {months.map((value, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-md ${
                  i === months.length - 1 ? 'bg-primary' : 'bg-primary/20'
                }`}
                style={{ height: `${(value / maxMonth) * 100}%` }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {categories.map((category) => (
            <div key={category.key} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-sm font-medium">
                {category.label}
              </span>
              <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(category.amount / max) * 100}%`,
                    backgroundColor: category.color,
                  }}
                />
              </div>
              <span className="text-muted-foreground w-14 shrink-0 text-right text-xs font-semibold">
                ${formatAmount(category.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
