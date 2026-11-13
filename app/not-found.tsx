import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground text-sm font-semibold tracking-[0.2em] uppercase">
        404
      </p>
      <h1 className="text-4xl font-black tracking-tight">Page not found</h1>
      <Link href="/" className="font-medium underline">
        Go home
      </Link>
    </div>
  )
}
