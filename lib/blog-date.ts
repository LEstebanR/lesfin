import type { BlogLocale } from '@/lib/blog'

// Post dates are calendar dates (`YYYY-MM-DD`), which `new Date()` parses as
// midnight UTC. Formatting them in UTC keeps the day stable regardless of the
// runtime's time zone, so the server (UTC) and a browser behind UTC render the
// same string and hydration doesn't mismatch.
export function formatPostDate(date: string, locale: BlogLocale): string {
  return new Date(date).toLocaleDateString(
    locale === 'es' ? 'es-ES' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }
  )
}
