import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { formatPostDate } from './blog-date'

// Regression for #50: `/blog` hydration mismatch. The server renders in UTC
// while a browser behind UTC (e.g. America/Bogota) rendered the previous day.
describe('formatPostDate', () => {
  const originalTZ = process.env.TZ

  beforeEach(() => {
    process.env.TZ = 'America/Bogota'
  })

  afterEach(() => {
    process.env.TZ = originalTZ
  })

  it('keeps the calendar day in a time zone behind UTC', () => {
    expect(formatPostDate('2026-08-01', 'en')).toBe('August 1, 2026')
    expect(formatPostDate('2026-08-01', 'es')).toBe('1 de agosto de 2026')
  })

  it('renders the same string as a UTC server', () => {
    const client = formatPostDate('2026-06-16', 'en')
    process.env.TZ = 'UTC'
    expect(formatPostDate('2026-06-16', 'en')).toBe(client)
  })
})
