import { describe, expect, it } from 'bun:test'

import {
  type AccountImpact,
  getArchiveError,
  getDeleteError,
  getRestoreError,
} from './account-lifecycle'

const emptyImpact: AccountImpact = {
  balance: 0,
  transactions: 0,
  transfers: 0,
  debtPayments: 0,
  subscriptions: 0,
}

describe('getArchiveError', () => {
  it('allows archiving when other active accounts remain', () => {
    expect(getArchiveError({ isArchived: false, activeCount: 2 })).toBeNull()
  })

  it('blocks archiving the only active account', () => {
    expect(getArchiveError({ isArchived: false, activeCount: 1 })).toBe(
      'last_active_account'
    )
  })

  it('rejects an already archived account', () => {
    expect(getArchiveError({ isArchived: true, activeCount: 3 })).toBe(
      'already_archived'
    )
  })
})

describe('getRestoreError', () => {
  it('allows restoring on Free when under the limit', () => {
    expect(
      getRestoreError({ isArchived: true, activeCount: 1, limit: 2 })
    ).toBeNull()
  })

  it('blocks restoring on Free when the limit is reached', () => {
    expect(
      getRestoreError({ isArchived: true, activeCount: 2, limit: 2 })
    ).toBe('plan_limit')
  })

  it('ignores the limit on Pro', () => {
    expect(
      getRestoreError({ isArchived: true, activeCount: 10, limit: null })
    ).toBeNull()
  })

  it('rejects an account that is not archived', () => {
    expect(
      getRestoreError({ isArchived: false, activeCount: 1, limit: 2 })
    ).toBe('not_archived')
  })
})

describe('getDeleteError', () => {
  it('allows deleting an empty account', () => {
    expect(getDeleteError(emptyImpact)).toBeNull()
  })

  it('allows deleting with balance or linked subscriptions only', () => {
    expect(
      getDeleteError({ ...emptyImpact, balance: 500, subscriptions: 2 })
    ).toBeNull()
  })

  it.each([
    ['transactions', { transactions: 1 }],
    ['transfers', { transfers: 1 }],
    ['debt payments', { debtPayments: 1 }],
  ])('blocks deleting an account with %s', (_, extra) => {
    expect(getDeleteError({ ...emptyImpact, ...extra })).toBe('has_history')
  })
})
