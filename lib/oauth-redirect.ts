// Loopback hosts that native/desktop OAuth clients (e.g. MCP clients) listen on
// for the authorization callback. RFC 8252 §7.3 allows plain http for these,
// since the redirect never leaves the user's machine.
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost'])

export function isValidRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') return true
    return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}
