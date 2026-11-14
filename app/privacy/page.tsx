import { LegalPage } from '@/components/marketing/legal-page'
import { socialImage } from '@/lib/site'
import type { Metadata } from 'next'

const title = 'Privacy Policy'
const description =
  'What data LESFin stores, why, who processes it, how long it is kept, and how to export or delete it.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: `${title} · LESFin`,
    description,
    url: '/privacy',
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
  return <LegalPage kind="privacy" />
}
