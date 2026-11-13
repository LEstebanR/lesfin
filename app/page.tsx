import { LandingPage } from '@/components/marketing/landing-page'
import { socialImage } from '@/lib/site'
import type { Metadata } from 'next'

const title =
  'LESFin — Personal finance tracker for accounts, debts, subscriptions & budget'
const description =
  'Track every account, transaction, debt, subscription, and budget in one clear view. No spreadsheets, no bank access required. Free, sign in with Google.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/' },
  openGraph: {
    title,
    description,
    url: '/',
    type: 'website',
    images: [socialImage],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [socialImage.url],
  },
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'LESFin',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            description,
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
          }),
        }}
      />
      <LandingPage />
    </>
  )
}
