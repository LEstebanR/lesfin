const DEFAULT_SITE_URL = 'https://www.lesfin.app'

// Apex https://lesfin.app 308s to www. Absolute metadata must use the www
// host or canonicals, sitemaps, and social images point at a redirect.
export function resolveSiteUrl(raw = process.env.NEXT_PUBLIC_SITE_URL): string {
  if (!raw?.trim()) return DEFAULT_SITE_URL

  try {
    const url = new URL(raw.trim())
    if (url.hostname === 'lesfin.app') url.hostname = 'www.lesfin.app'
    return url.origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

export const siteUrl = resolveSiteUrl()

export const socialImage = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'LESFin — Personal finance tracker',
}
