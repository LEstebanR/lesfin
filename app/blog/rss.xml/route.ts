import { getAllPostsMeta } from '@/lib/blog'
import { siteUrl } from '@/lib/site'
import { NextResponse } from 'next/server'

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function GET() {
  const posts = [...getAllPostsMeta('en'), ...getAllPostsMeta('es')].sort(
    (a, b) => (a.date < b.date ? 1 : -1)
  )

  const items = posts
    .map((post) => {
      const url = `${siteUrl}/blog/${post.locale}/${post.slug}`
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <language>${post.locale}</language>
    </item>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>LESFin Blog</title>
    <link>${siteUrl}/blog</link>
    <description>Practical, general-purpose guides on budgeting, debt, subscriptions, and everyday money habits.</description>
    ${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
