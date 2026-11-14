import { afterEach, describe, expect, it } from 'bun:test'

import { getAppUrl } from './polar'

const env = process.env as Record<string, string | undefined>
const original = {
  NODE_ENV: env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
}

afterEach(() => {
  env.NODE_ENV = original.NODE_ENV
  env.NEXT_PUBLIC_APP_URL = original.NEXT_PUBLIC_APP_URL
})

describe('getAppUrl', () => {
  it('uses www in production when NEXT_PUBLIC_APP_URL is unset', () => {
    env.NODE_ENV = 'production'
    delete env.NEXT_PUBLIC_APP_URL
    expect(getAppUrl()).toBe('https://www.lesfin.app')
  })

  it('normalizes the apex host to www in production', () => {
    env.NODE_ENV = 'production'
    env.NEXT_PUBLIC_APP_URL = 'https://lesfin.app'
    expect(getAppUrl()).toBe('https://www.lesfin.app')
  })

  it('uses localhost outside production', () => {
    env.NODE_ENV = 'development'
    env.NEXT_PUBLIC_APP_URL = 'https://lesfin.app'
    expect(getAppUrl()).toBe('http://localhost:3000')
  })
})
