import { PricingPage } from '@/components/marketing/pricing-page'
import { socialImage } from '@/lib/site'
import type { Metadata } from 'next'

const title = 'Pricing — Free and Pro plans'
const description =
  'LESFin is free to use with generous limits on accounts, transactions, debts, and subscriptions. Upgrade to Pro to remove every limit.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: `${title} · LESFin`,
    description,
    url: '/pricing',
    type: 'website',
    images: [socialImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${title} · LESFin`,
    description,
    images: [socialImage.url],
  },
}

export default function Page() {
  return <PricingPage />
}
