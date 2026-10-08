import { BlogIndex } from '@/components/blog/blog-index'
import { getAllPostsMeta } from '@/lib/blog'
import { socialImage } from '@/lib/site'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Practical, general-purpose guides on budgeting, debt, subscriptions, and everyday money habits.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Blog · LESFin',
    description:
      'Practical, general-purpose guides on budgeting, debt, subscriptions, and everyday money habits.',
    url: '/blog',
    type: 'website',
    images: [socialImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog · LESFin',
    description:
      'Practical, general-purpose guides on budgeting, debt, subscriptions, and everyday money habits.',
    images: [socialImage.url],
  },
}

export default function Page() {
  const postsByLocale = {
    en: getAllPostsMeta('en'),
    es: getAllPostsMeta('es'),
  }

  return <BlogIndex postsByLocale={postsByLocale} />
}
