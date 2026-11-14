import { describe, expect, it } from 'bun:test'

import {
  countsAsExpense,
  isDebtCategoryBlocked,
  sumByUtcMonth,
} from './expenses'

describe('countsAsExpense', () => {
  it('counts expenses paid from an account', () => {
    expect(countsAsExpense({ type: 'expense', debtId: null })).toBe(true)
  })

  it('does not count purchases charged to a credit card', () => {
    expect(countsAsExpense({ type: 'expense', debtId: 'debt-1' })).toBe(false)
  })

  it('does not count income', () => {
    expect(countsAsExpense({ type: 'income', debtId: null })).toBe(false)
  })

  it('counts a card purchase once in total: only through its payment', () => {
    // Buy 100 on the card, then pay the card 100 from an account: the
    // payment's mirrored "Deuda" expense is the only one that adds up.
    const movements = [
      { type: 'expense', debtId: 'card', amount: 100 },
      { type: 'expense', debtId: null, amount: 100 },
    ]
    const total = movements
      .filter(countsAsExpense)
      .reduce((sum, movement) => sum + movement.amount, 0)
    expect(total).toBe(100)
  })
})

describe('sumByUtcMonth', () => {
  it('buckets amounts by UTC month and accepts Decimal-like values', () => {
    const totals = sumByUtcMonth([
      { date: new Date('2026-01-31T23:59:59.000Z'), amount: 100 },
      { date: new Date('2026-01-05T00:00:00.000Z'), amount: '50.5' },
      { date: new Date('2026-11-01T00:00:00.000Z'), amount: 200 },
    ])

    expect(totals).toHaveLength(12)
    expect(totals[0]).toBe(150.5)
    expect(totals[10]).toBe(200)
    expect(totals.reduce((a, b) => a + b, 0)).toBe(350.5)
  })
})

describe('isDebtCategoryBlocked', () => {
  const deuda = { id: 'cat-debt', name: 'Deuda', defaultKey: 'debt' }
  const food = { id: 'cat-food', name: 'Alimentación', defaultKey: 'food' }

  it('blocks recording a new transaction in the debt category', () => {
    expect(isDebtCategoryBlocked(deuda)).toBe(true)
  })

  it('blocks moving a transaction into the debt category', () => {
    expect(isDebtCategoryBlocked(deuda, food.id)).toBe(true)
  })

  it('allows editing a transaction that is already in it', () => {
    expect(isDebtCategoryBlocked(deuda, deuda.id)).toBe(false)
  })

  it('allows any other category', () => {
    expect(isDebtCategoryBlocked(food)).toBe(false)
  })

  it('recognizes the debt category by name when it has no default key', () => {
    expect(
      isDebtCategoryBlocked({ id: 'x', name: ' debt ', defaultKey: null })
    ).toBe(true)
  })
})
