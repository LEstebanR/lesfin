'use client'

import { createProCheckout } from '@/app/dashboard/plan/billing-actions'
import { useLanguage } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const PRO_MONTHLY_PRICE = '$2.99'

export function Pricing() {
  const { t } = useLanguage()
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

  const freeFeatures = [
    t('pricing.freeFeature1'),
    t('pricing.freeFeature2'),
    t('pricing.freeFeature3'),
    t('pricing.freeFeature4'),
    t('pricing.freeFeature5'),
    t('pricing.freeFeature6'),
  ]

  const proFeatures = [
    t('pricing.proFeature1'),
    t('pricing.proFeature2'),
    t('pricing.proFeature3'),
    t('pricing.proFeature4'),
    t('pricing.proFeature5'),
    t('pricing.proFeature6'),
  ]

  const faqs = [
    { question: t('pricing.faqQ1'), answer: t('pricing.faqA1') },
    { question: t('pricing.faqQ2'), answer: t('pricing.faqA2') },
    { question: t('pricing.faqQ3'), answer: t('pricing.faqA3') },
  ]

  return (
    <div className="flex w-full flex-col gap-8 rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div className="max-w-2xl">
        <p className="text-muted-foreground text-sm font-semibold tracking-[0.2em] uppercase">
          {t('pricing.eyebrow')}
        </p>
        <h1 className="mt-3 text-4xl leading-none font-black tracking-tighter sm:text-5xl">
          {t('pricing.title')}
          <br />
          <span className="text-muted-foreground">
            {t('pricing.titleMuted')}
          </span>
        </h1>
        <p className="text-muted-foreground mt-5 max-w-lg text-lg text-balance">
          {t('pricing.subtitle')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle className="text-2xl">{t('pricing.freeName')}</CardTitle>
            <CardDescription>{t('pricing.freeDescription')}</CardDescription>
            <div className="pt-4 text-5xl font-black tracking-tighter">
              {t('pricing.freePrice')}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <Button variant="outline" className="w-full" disabled>
              {t('pricing.currentPlan')}
            </Button>
            <FeatureList features={freeFeatures} muted />
          </CardContent>
        </Card>

        <Card className="border-primary relative flex h-full flex-col border-2">
          <CardHeader>
            <CardTitle className="text-2xl">{t('pricing.proName')}</CardTitle>
            <CardDescription>{t('pricing.proDescription')}</CardDescription>
            <div className="flex items-end gap-1 pt-4">
              <span className="text-5xl font-black tracking-tighter">
                {PRO_MONTHLY_PRICE}
              </span>
              <span className="text-muted-foreground mb-1 text-sm">
                {t('pricing.perMonth')}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <Button
              className="w-full"
              onClick={goToCheckout}
              disabled={isRedirecting}
              variant="secondary"
            >
              {isRedirecting ? t('plan.openingCheckout') : t('plan.upgradeNow')}
            </Button>
            <FeatureList features={proFeatures} />
          </CardContent>
        </Card>
      </div>

      <div className="max-w-2xl pt-4">
        <h2 className="text-3xl font-black tracking-tighter">
          {t('pricing.faqTitle')}
        </h2>
        <div className="divide-border mt-4 divide-y">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                {faq.question}
                <span className="border-border flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-lg leading-none transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-3 pr-10 leading-relaxed">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeatureList({
  features,
  muted = false,
}: {
  features: string[]
  muted?: boolean
}) {
  return (
    <ul className="mt-8 space-y-3">
      {features.map((feature) => (
        <li
          key={feature}
          className="flex items-start gap-3 text-sm font-medium"
        >
          <span
            className={`${muted ? 'bg-muted' : 'bg-primary'} mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full`}
          >
            <Check
              className={`h-3 w-3 ${muted ? '' : 'text-white'}`}
              strokeWidth={3}
            />
          </span>
          {feature}
        </li>
      ))}
    </ul>
  )
}
