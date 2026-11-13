import { describe, expect, it } from 'bun:test'

import { resolveSiteUrl } from './site'

describe('resolveSiteUrl', () => {
  it('uses the www host by default', () => {
    expect(resolveSiteUrl(undefined)).toBe('https://www.lesfin.app')
    expect(resolveSiteUrl('')).toBe('https://www.lesfin.app')
  })

  it('rewrites the apex host that redirects to www', () => {
    expect(resolveSiteUrl('https://lesfin.app')).toBe('https://www.lesfin.app')
    expect(resolveSiteUrl('https://lesfin.app/')).toBe('https://www.lesfin.app')
  })

  it('leaves other hosts alone', () => {
    expect(resolveSiteUrl('https://www.lesfin.app')).toBe(
      'https://www.lesfin.app'
    )
    expect(resolveSiteUrl('https://personal-finances-preview.vercel.app')).toBe(
      'https://personal-finances-preview.vercel.app'
    )
  })
})
