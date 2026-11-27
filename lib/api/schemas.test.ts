import { describe, expect, it } from 'bun:test'

import { createTransferBody, transactionListQuery } from './schemas'

const base = {
  fromAccountId: 'a',
  toAccountId: 'b',
  amount: 1,
}

describe('date inputs', () => {
  it('accepts YYYY-MM-DD as UTC midnight', () => {
    const { date } = createTransferBody.parse({ ...base, date: '2026-11-20' })
    expect(date.toISOString()).toBe('2026-11-20T00:00:00.000Z')
  })

  it('accepts a full ISO datetime with offset', () => {
    const { date } = createTransferBody.parse({
      ...base,
      date: '2026-11-20T15:30:00-05:00',
    })
    expect(date.toISOString()).toBe('2026-11-20T20:30:00.000Z')
  })

  it.each(['5', '2026', 'Nov 5', '2026-13-01', '2026-11-20T10:00:00', ''])(
    'rejects %p',
    (value) => {
      expect(
        createTransferBody.safeParse({ ...base, date: value }).success
      ).toBe(false)
    }
  )
})

describe('transactionListQuery', () => {
  it('coerces query strings', () => {
    expect(transactionListQuery.parse({ year: '2026', month: '11' })).toEqual({
      year: 2026,
      month: 11,
    })
  })

  it('requires year when month is given', () => {
    expect(transactionListQuery.safeParse({ month: '11' }).success).toBe(false)
  })
})
