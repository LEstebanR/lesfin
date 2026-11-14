import { describe, expect, it } from 'bun:test'

import { transactionSchema } from './schemas'

const ACCOUNT = '11111111-1111-4111-8111-111111111111'
const DEBT = '22222222-2222-4222-8222-222222222222'
const CATEGORY = '33333333-3333-4333-8333-333333333333'

const base = {
  accountId: null,
  debtId: null,
  amount: 100,
  type: 'expense' as const,
  categoryId: CATEGORY,
  subcategoryId: null,
  description: 'Mercado',
  date: new Date('2026-11-01T00:00:00.000Z'),
}

describe('transactionSchema money source', () => {
  it('accepts an account as the only source', () => {
    expect(
      transactionSchema.safeParse({ ...base, accountId: ACCOUNT }).success
    ).toBe(true)
  })

  it('accepts a debt as the only source for an expense', () => {
    expect(transactionSchema.safeParse({ ...base, debtId: DEBT }).success).toBe(
      true
    )
  })

  it('rejects a transaction without a source', () => {
    expect(transactionSchema.safeParse(base).success).toBe(false)
  })

  it('rejects a transaction with both an account and a debt', () => {
    expect(
      transactionSchema.safeParse({ ...base, accountId: ACCOUNT, debtId: DEBT })
        .success
    ).toBe(false)
  })

  it('rejects income charged to a debt', () => {
    expect(
      transactionSchema.safeParse({ ...base, type: 'income', debtId: DEBT })
        .success
    ).toBe(false)
  })
})
