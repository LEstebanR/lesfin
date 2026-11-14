import { LegalPage } from '@/components/marketing/legal-page'
import { socialImage } from '@/lib/site'
import type { Metadata } from 'next'

const title = 'Terms of Service'
const description =
  'The terms for using LESFin: Free and Pro plans, cancellation, your data, liability, and governing law.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/terms' },
  openGraph: {
    title: `${title} · LESFin`,
    description,
    url: '/terms',
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
  return <LegalPage kind="terms" />
}
