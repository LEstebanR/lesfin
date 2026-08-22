import { LanguageProvider } from '@/components/language-provider'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// No production domain yet — override with NEXT_PUBLIC_SITE_URL once one
// exists. Needed for metadataBase (resolves OG/Twitter image URLs and
// canonical links) and reused by app/sitemap.ts and app/robots.ts.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lesfin.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'LESFin — Personal finance tracker',
    template: '%s · LESFin',
  },
  description:
    'Track accounts, transactions, debts, subscriptions, and budget in one clear view. Free, sign in with Google — no bank access required.',
  keywords: [
    'personal finance app',
    'budget tracker',
    'expense tracker',
    'debt tracker',
    'subscription tracker',
    'money management app',
    'finanzas personales',
  ],
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    types: {
      'application/rss+xml': '/blog/rss.xml',
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LESFin',
  },
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex w-full flex-col antialiased`}
      >
        <LanguageProvider>
          <main className="flex-1">{children}</main>
          <Toaster richColors position="top-right" />
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
