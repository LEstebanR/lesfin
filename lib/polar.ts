import { Polar } from '@polar-sh/sdk'

import { resolveSiteUrl } from './site'

// Never let a local checkout accidentally hit live Polar.
const server = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'

export function getPolarClient() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) throw new Error('Polar is not configured')
  return new Polar({ accessToken, server })
}

export function getAppUrl() {
  return process.env.NODE_ENV === 'production'
    ? resolveSiteUrl(process.env.NEXT_PUBLIC_APP_URL)
    : 'http://localhost:3000'
}
