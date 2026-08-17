'use client'

import { useLanguage } from '@/components/language-provider'
import { Reveal } from '@/components/marketing/reveal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/ui/footer'
import { Header } from '@/components/ui/header'
import { Check, Sparkles } from 'lucide-react'
import Link from 'next/link'

const PRO_MONTHLY_PRICE = '$2.99'

export function PricingPage() {
  const { t } = useLanguage()

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
    { q: t('pricing.faqQ1'), a: t('pricing.faqA1') },
    { q: t('pricing.faqQ2'), a: t('pricing.faqA2') },
    { q: t('pricing.faqQ3'), a: t('pricing.faqA3') },
  ]

  return (
    <div className="bg-background text-foreground flex flex-col items-center">
      <Header path="/" />

      <section className="w-full px-4 pt-24 pb-16 md:pt-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-muted-foreground mb-4 text-sm font-semibold tracking-[0.2em] uppercase">
            {t('pricing.eyebrow')}
          </p>
          <h1 className="text-5xl leading-none font-black tracking-tighter sm:text-6xl">
            {t('pricing.title')}
            <br />
            <span className="text-muted-foreground">
              {t('pricing.titleMuted')}
            </span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-lg text-lg text-balance">
            {t('pricing.subtitle')}
          </p>
        </div>
      </section>

      <section className="w-full px-4 pb-24">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <Reveal>
            <div className="bg-card border-border shadow-soft flex h-full flex-col rounded-2xl border p-8">
              <h2 className="text-2xl font-black tracking-tight">
                {t('pricing.freeName')}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {t('pricing.freeDescription')}
              </p>
              <div className="mt-6 flex items-end gap-1">
                <span className="text-5xl font-black tracking-tighter">
                  {t('pricing.freePrice')}
                </span>
              </div>
              <Link href="/signup" className="mt-6">
                <Button variant="outline" className="w-full">
                  {t('pricing.startFree')}
                </Button>
              </Link>
              <ul className="mt-8 space-y-3">
                {freeFeatures.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm font-medium"
                  >
                    <span className="bg-muted mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="bg-primary text-primary-foreground shadow-lift relative flex h-full flex-col rounded-2xl border-2 border-transparent p-8">
              <Badge className="absolute -top-3 left-8 gap-1">
                <Sparkles className="h-3 w-3" />
                {t('pricing.mostPopular')}
              </Badge>
              <h2 className="text-2xl font-black tracking-tight">
                {t('pricing.proName')}
              </h2>
              <p className="text-primary-foreground/70 mt-2 text-sm">
                {t('pricing.proDescription')}
              </p>
              <div className="mt-6 flex items-end gap-1">
                <span className="text-5xl font-black tracking-tighter">
                  {PRO_MONTHLY_PRICE}
                </span>
                <span className="text-primary-foreground/70 mb-1 text-sm">
                  {t('pricing.perMonth')}
                </span>
              </div>
              <Button className="mt-6 w-full" disabled variant="secondary">
                {t('pricing.comingSoon')}
              </Button>
              <ul className="mt-8 space-y-3">
                {proFeatures.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm font-medium"
                  >
                    <span className="bg-accent text-accent-foreground mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="w-full px-4 pb-24">
        <div className="mx-auto max-w-2xl">
          <Reveal className="mb-12 text-center">
            <h2 className="text-3xl font-black tracking-tighter sm:text-4xl">
              {t('pricing.faqTitle')}
            </h2>
          </Reveal>

          <div className="divide-border divide-y">
            {faqs.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 40}>
                <details className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <span className="text-base leading-snug font-bold sm:text-lg">
                      {faq.q}
                    </span>
                    <span className="border-border flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-transform group-open:rotate-45">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M6 1v10M1 6h10"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </summary>
                  <p className="text-muted-foreground mt-4 pr-10 leading-relaxed">
                    {faq.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
