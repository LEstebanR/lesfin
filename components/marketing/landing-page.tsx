'use client'

import { useLanguage } from '@/components/language-provider'
import { DashboardPreview } from '@/components/marketing/dashboard-preview'
import {
  AccountsMock,
  AssistantMock,
  BudgetMock,
  TransactionMock,
} from '@/components/marketing/feature-mocks'
import { Reveal } from '@/components/marketing/reveal'
import { SpendingTrendsPreview } from '@/components/marketing/spending-trends-preview'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/ui/footer'
import { Header } from '@/components/ui/header'
import {
  ArrowRight,
  Bot,
  Check,
  CreditCard,
  KeyRound,
  Landmark,
  PiggyBank,
  Repeat,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function LandingPage() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const strip = [
    t('landing.stripAccounts'),
    t('landing.stripTransactions'),
    t('landing.stripDebts'),
    t('landing.stripBudget'),
    t('landing.stripSubscriptions'),
    t('landing.stripTrends'),
  ]
  const stripItems = [...strip, ...strip]

  const features = [
    {
      icon: Wallet,
      eyebrow: t('landing.feature1Eyebrow'),
      title: t('landing.feature1Title'),
      description: t('landing.feature1Description'),
      points: [
        t('landing.feature1Point1'),
        t('landing.feature1Point2'),
        t('landing.feature1Point3'),
      ],
      mock: <AccountsMock />,
    },
    {
      icon: CreditCard,
      eyebrow: t('landing.feature2Eyebrow'),
      title: t('landing.feature2Title'),
      description: t('landing.feature2Description'),
      points: [
        t('landing.feature2Point1'),
        t('landing.feature2Point2'),
        t('landing.feature2Point3'),
      ],
      mock: <TransactionMock />,
    },
    {
      icon: PiggyBank,
      eyebrow: t('landing.feature3Eyebrow'),
      title: t('landing.feature3Title'),
      description: t('landing.feature3Description'),
      points: [
        t('landing.feature3Point1'),
        t('landing.feature3Point2'),
        t('landing.feature3Point3'),
      ],
      mock: <BudgetMock />,
    },
    {
      icon: Bot,
      eyebrow: t('landing.feature4Eyebrow'),
      title: t('landing.feature4Title'),
      description: t('landing.feature4Description'),
      points: [
        t('landing.feature4Point1'),
        t('landing.feature4Point2'),
        t('landing.feature4Point3'),
      ],
      mock: <AssistantMock />,
    },
  ]

  const capabilities = [
    {
      icon: Landmark,
      title: t('landing.capability1Title'),
      description: t('landing.capability1Description'),
    },
    {
      icon: Repeat,
      title: t('landing.capability2Title'),
      description: t('landing.capability2Description'),
    },
    {
      icon: TrendingUp,
      title: t('landing.capability3Title'),
      description: t('landing.capability3Description'),
    },
  ]

  const trustPoints = [
    {
      icon: ShieldCheck,
      title: t('landing.trustPoint1Title'),
      description: t('landing.trustPoint1Description'),
    },
    {
      icon: KeyRound,
      title: t('landing.trustPoint2Title'),
      description: t('landing.trustPoint2Description'),
    },
    {
      icon: Check,
      title: t('landing.trustPoint3Title'),
      description: t('landing.trustPoint3Description'),
    },
  ]

  const steps = [
    {
      number: '01',
      title: t('landing.step1Title'),
      description: t('landing.step1Description'),
    },
    {
      number: '02',
      title: t('landing.step2Title'),
      description: t('landing.step2Description'),
    },
    {
      number: '03',
      title: t('landing.step3Title'),
      description: t('landing.step3Description'),
    },
  ]

  const faqs = [
    { q: t('landing.faqQ1'), a: t('landing.faqA1') },
    { q: t('landing.faqQ2'), a: t('landing.faqA2') },
    { q: t('landing.faqQ3'), a: t('landing.faqA3') },
    { q: t('landing.faqQ4'), a: t('landing.faqA4') },
    { q: t('landing.faqQ5'), a: t('landing.faqA5') },
    { q: t('landing.faqQ6'), a: t('landing.faqA6') },
  ]

  return (
    <div className="landing-surface text-foreground flex flex-col items-center">
      <Header path={pathname} />

      {/* Hero */}
      <section className="relative w-full overflow-hidden px-4 pt-32 pb-24 md:pt-44 md:pb-32">
        <div className="landing-hero-grid absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_78%)] opacity-80" />

        <div className="mx-auto max-w-4xl text-center">
          <p
            className="text-muted-foreground animate-fade-up mb-8 text-sm font-semibold tracking-widest uppercase"
            style={{ animationDelay: '0ms' }}
          >
            {t('landing.eyebrow')}
          </p>

          <h1
            className="animate-fade-up text-5xl leading-[1.05] font-bold tracking-tight text-balance md:text-7xl"
            style={{ animationDelay: '80ms' }}
          >
            {t('landing.heroTitlePrefix')}
            <span className="relative inline-block whitespace-nowrap">
              <span
                aria-hidden="true"
                className="bg-primary/25 absolute -inset-x-1 top-[10%] bottom-[5%] -rotate-1 rounded-[4px]"
              />
              <span className="relative">
                {t('landing.heroTitleHighlight')}
              </span>
              <svg
                aria-hidden="true"
                className="text-foreground absolute -bottom-2 left-0 w-full md:-bottom-3"
                height="14"
                viewBox="0 0 200 14"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M3 8.5C44 3.2 92 2.4 132 4.1c25 1 47 2.6 65 5.3"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p
            className="text-muted-foreground animate-fade-up mx-auto mt-8 max-w-2xl text-xl text-balance"
            style={{ animationDelay: '160ms' }}
          >
            {t('landing.heroSubtitle')}
          </p>

          <div
            className="animate-fade-up mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '240ms' }}
          >
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="h-12 w-full px-8 sm:w-auto">
                {t('landing.getStarted')} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full px-8 sm:w-auto"
              >
                {t('landing.seeHowItWorks')}
              </Button>
            </Link>
          </div>
          <p
            className="text-muted-foreground animate-fade-up mt-6 text-sm"
            style={{ animationDelay: '300ms' }}
          >
            {t('landing.heroTrust')}
          </p>
        </div>

        <div
          className="animate-fade-up relative mx-auto mt-20 max-w-4xl md:mt-28"
          style={{ animationDelay: '360ms' }}
        >
          <div className="grid items-center gap-8 sm:grid-cols-2 sm:gap-6">
            <div className="animate-float-slow">
              <DashboardPreview />
            </div>
            <div className="animate-float-slower sm:mt-8">
              <SpendingTrendsPreview />
            </div>
          </div>
          <div
            className="animate-fade-up bg-card shadow-lift absolute -top-5 -left-6 z-10 hidden items-center gap-2 rounded-full px-4 py-2.5 sm:flex"
            style={{ animationDelay: '620ms' }}
          >
            <div className="bg-primary flex h-5 w-5 items-center justify-center rounded-full">
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </div>
            <span className="text-foreground text-xs font-bold">
              {t('landing.stripAccounts')}
            </span>
          </div>
          <div
            className="animate-fade-up bg-card shadow-lift absolute -right-6 -bottom-5 z-10 hidden items-center gap-2 rounded-full px-4 py-2.5 sm:flex"
            style={{ animationDelay: '760ms' }}
          >
            <PiggyBank className="text-primary h-4 w-4" />
            <span className="text-foreground text-xs font-bold">
              {t('landing.stripBudget')}
            </span>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="bg-background border-border w-full border-y py-12">
        <p className="text-muted-foreground mb-8 text-center text-xs font-semibold tracking-[0.2em] uppercase">
          {t('landing.stripLabel')}
        </p>
        <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <div className="animate-marquee flex w-max gap-12 pr-12">
            {stripItems.map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="text-muted-foreground/70 text-2xl font-black tracking-tighter whitespace-nowrap sm:text-3xl"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="w-full px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-20 max-w-2xl">
            <p className="text-muted-foreground mb-4 text-sm font-semibold tracking-[0.2em] uppercase">
              {t('landing.featuresTitle')}
            </p>
            <h2 className="text-4xl leading-none font-black tracking-tighter sm:text-5xl">
              {t('landing.featuresTitle')}
              <br />
              <span className="text-muted-foreground">
                {t('landing.featuresTitleMuted')}
              </span>
            </h2>
          </Reveal>

          <div className="space-y-24">
            {features.map((feature, i) => {
              const reversed = i % 2 === 1
              return (
                <Reveal key={feature.title}>
                  <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className={reversed ? 'lg:order-2' : ''}>
                      <div className="bg-primary mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl">
                        <feature.icon
                          className="h-6 w-6 text-white"
                          strokeWidth={1.75}
                        />
                      </div>
                      <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
                        {feature.eyebrow}
                      </p>
                      <h3 className="mb-4 text-3xl leading-tight font-black tracking-tight sm:text-4xl">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground mb-6 max-w-md leading-relaxed">
                        {feature.description}
                      </p>
                      <ul className="space-y-3">
                        {feature.points.map((point) => (
                          <li
                            key={point}
                            className="flex items-center gap-3 text-sm font-medium"
                          >
                            <span className="bg-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                              <Check
                                className="h-3 w-3 text-white"
                                strokeWidth={3}
                              />
                            </span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={reversed ? 'lg:order-1' : ''}>
                      {feature.mock}
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* Capabilities (debts, subscriptions, trends) */}
      <section className="bg-muted/40 w-full px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 max-w-2xl">
            <p className="text-muted-foreground mb-4 text-sm font-semibold tracking-[0.2em] uppercase">
              {t('landing.capabilitiesTitle')}
            </p>
            <h2 className="text-4xl leading-none font-black tracking-tighter sm:text-5xl">
              {t('landing.capabilitiesTitle')}
              <br />
              <span className="text-muted-foreground">
                {t('landing.capabilitiesTitleMuted')}
              </span>
            </h2>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-3">
            {capabilities.map((capability, i) => (
              <Reveal key={capability.title} delay={i * 100}>
                <div className="bg-card shadow-soft hover:shadow-lift flex h-full flex-col gap-4 rounded-3xl p-7 transition-transform duration-500 ease-out hover:-translate-y-1">
                  <div className="bg-primary/10 flex h-11 w-11 items-center justify-center rounded-xl">
                    <capability.icon
                      className="text-primary h-5 w-5"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h3 className="text-xl font-black tracking-tight">
                    {capability.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {capability.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="w-full px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 max-w-2xl">
            <p className="text-muted-foreground mb-4 text-sm font-semibold tracking-[0.2em] uppercase">
              {t('landing.howItWorksTitle')}
            </p>
            <h2 className="text-4xl leading-none font-black tracking-tighter sm:text-5xl">
              {t('landing.howItWorksTitle')}
              <br />
              <span className="text-muted-foreground">
                {t('landing.howItWorksTitleMuted')}
              </span>
            </h2>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <Reveal key={step.number} delay={i * 100}>
                <div className="bg-card shadow-soft hover:shadow-lift flex h-full flex-col gap-5 rounded-3xl p-6 transition-transform duration-500 ease-out hover:-translate-y-1">
                  <span className="text-primary/15 block text-5xl leading-none font-black tracking-tighter tabular-nums">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="mb-2 text-lg font-black tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / privacy */}
      <section className="bg-muted/40 w-full px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 max-w-2xl">
            <p className="text-muted-foreground mb-4 text-sm font-semibold tracking-[0.2em] uppercase">
              {t('landing.trustTitle')}
            </p>
            <h2 className="text-4xl leading-none font-black tracking-tighter sm:text-5xl">
              {t('landing.trustTitle')}
              <br />
              <span className="text-muted-foreground">
                {t('landing.trustTitleMuted')}
              </span>
            </h2>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-3">
            {trustPoints.map((point, i) => (
              <Reveal key={point.title} delay={i * 100}>
                <div className="flex h-full flex-col gap-4">
                  <div className="bg-primary flex h-11 w-11 items-center justify-center rounded-xl">
                    <point.icon
                      className="h-5 w-5 text-white"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h3 className="text-xl font-black tracking-tight">
                    {point.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {point.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="w-full px-4 py-24">
        <div className="mx-auto max-w-3xl">
          <Reveal className="mb-16">
            <p className="text-muted-foreground mb-4 text-sm font-semibold tracking-[0.2em] uppercase">
              {t('landing.faqTitle')}
            </p>
            <h2 className="text-4xl leading-none font-black tracking-tighter sm:text-5xl">
              {t('landing.faqTitle')}
              <br />
              <span className="text-muted-foreground">
                {t('landing.faqTitleMuted')}
              </span>
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

      {/* CTA */}
      <section className="bg-foreground relative w-full overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle, white 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-28 text-center">
          <h2 className="text-background mb-6 text-4xl leading-none font-black tracking-tighter sm:text-6xl">
            {t('landing.ctaTitle')}
            <br />
            <span className="text-background/50">
              {t('landing.ctaTitleMuted')}
            </span>
          </h2>
          <p className="text-background/60 mx-auto mb-12 max-w-xl text-xl leading-relaxed">
            {t('landing.ctaSubtitle')}
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="h-12 px-10">
              {t('landing.getStarted')} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="text-background/50 mt-6 text-sm">
            {t('landing.ctaTrust')}
          </p>
        </div>
      </section>

      <Footer showBlog />
    </div>
  )
}
