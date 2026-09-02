'use client'

import {
  createProCheckout,
  openBillingPortal,
} from '@/app/dashboard/plan/billing-actions'
import { useLanguage } from '@/components/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { FREE_LIMITS } from '@/lib/plan-limits-shared'
import { usePlanUsage } from '@/lib/queries'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const PRO_MONTHLY_PRICE = '$2.99'

export function Plan() {
  const { t } = useLanguage()
  const { data, isLoading } = usePlanUsage()
  const [isRedirecting, setIsRedirecting] = useState(false)

  async function goToCheckout() {
    setIsRedirecting(true)
    try {
      const { url } = await createProCheckout()
      window.location.assign(url)
    } catch (error) {
      console.error(error)
      toast.error(t('plan.checkoutError'))
      setIsRedirecting(false)
    }
  }

  async function goToPortal() {
    setIsRedirecting(true)
    try {
      const { url } = await openBillingPortal()
      window.location.assign(url)
    } catch (error) {
      console.error(error)
      toast.error(t('plan.billingError'))
      setIsRedirecting(false)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex w-full flex-col gap-4 rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const isPro = data.plan === 'PRO'

  const usageItems = [
    {
      label: t('nav.accounts'),
      used: data.accounts,
      limit: FREE_LIMITS.accounts,
    },
    { label: t('nav.debts'), used: data.debts, limit: FREE_LIMITS.debts },
    {
      label: t('nav.subscriptions'),
      used: data.subscriptions,
      limit: FREE_LIMITS.subscriptions,
    },
    {
      label: t('plan.transactionsThisMonth'),
      used: data.transactionsThisMonth,
      limit: FREE_LIMITS.transactionsPerMonth,
    },
  ]

  const proFeatures = [
    t('pricing.proFeature1'),
    t('pricing.proFeature2'),
    t('pricing.proFeature3'),
    t('pricing.proFeature4'),
    t('pricing.proFeature5'),
    t('pricing.proFeature6'),
  ]

  return (
    <div className="flex w-full flex-col gap-4 rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{t('plan.currentTitle')}</CardTitle>
            <Badge variant={isPro ? 'default' : 'secondary'}>
              {isPro ? t('pricing.proName') : t('pricing.freeName')}
            </Badge>
          </div>
          <CardDescription>
            {isPro ? t('plan.proDesc') : t('plan.freeDesc')}
          </CardDescription>
        </CardHeader>
      </Card>

      {isPro ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('plan.unlimitedTitle')}</CardTitle>
            <CardDescription>{t('plan.unlimitedDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={goToPortal}
              disabled={isRedirecting}
              variant="outline"
            >
              {isRedirecting
                ? t('plan.openingBilling')
                : t('plan.manageBilling')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('plan.usageTitle')}</CardTitle>
              <CardDescription>{t('plan.usageDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {usageItems.map((item) => {
                const percent =
                  item.limit > 0
                    ? Math.min(100, (item.used / item.limit) * 100)
                    : 0
                const barColor =
                  item.used > item.limit
                    ? 'bg-red-500'
                    : percent >= 80
                      ? 'bg-yellow-500'
                      : 'bg-primary'
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {t('plan.usedOf', {
                          used: String(item.used),
                          limit: String(item.limit),
                        })}
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="border-primary border-2">
            <CardHeader>
              <CardTitle>{t('plan.upgradeTitle')}</CardTitle>
              <CardDescription>{t('plan.upgradeDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold tracking-tight tabular-nums">
                  {PRO_MONTHLY_PRICE}
                </span>
                <span className="text-muted-foreground mb-1 text-sm">
                  {t('pricing.perMonth')}
                </span>
              </div>
              <ul className="mt-6 space-y-3">
                {proFeatures.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm font-medium"
                  >
                    <span className="bg-primary/10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="text-primary h-3 w-3" strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                onClick={goToCheckout}
                disabled={isRedirecting}
                variant="secondary"
              >
                {isRedirecting
                  ? t('plan.openingCheckout')
                  : t('plan.upgradeNow')}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
