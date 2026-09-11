import { describe, expect, it } from 'bun:test'

import { hasProAccess, resolveEntitlementPlan } from './billing-entitlements'

const now = new Date('2026-09-10T12:00:00.000Z')

describe('billing entitlements', () => {
  it.each(['active', 'trialing', 'past_due'])(
    'keeps Pro access for %s subscriptions',
    (status) => {
      expect(hasProAccess({ status, endsAt: null }, now)).toBe(true)
    }
  )

  it('keeps Pro access until the end of a canceled period', () => {
    expect(
      hasProAccess(
        { status: 'canceled', endsAt: new Date('2026-09-11T00:00:00.000Z') },
        now
      )
    ).toBe(true)
  })

  it.each([
    { status: 'canceled', endsAt: new Date('2026-09-10T12:00:00.000Z') },
    { status: 'canceled', endsAt: new Date('2026-09-09T00:00:00.000Z') },
    { status: 'revoked', endsAt: null },
    { status: 'unpaid', endsAt: null },
  ])('downgrades terminal billing states: $status', (billing) => {
    expect(hasProAccess(billing, now)).toBe(false)
  })

  it('reactivates a user when the provider reports active again', () => {
    expect(
      resolveEntitlementPlan('USER', { status: 'active', endsAt: null }, now)
    ).toBe('PRO')
  })

  it('downgrades users without a valid billing subscription', () => {
    expect(resolveEntitlementPlan('USER', null, now)).toBe('FREE')
    expect(
      resolveEntitlementPlan(
        'USER',
        { status: 'canceled', endsAt: new Date('2026-09-09T00:00:00.000Z') },
        now
      )
    ).toBe('FREE')
  })

  it('keeps admins on Pro without a billing subscription', () => {
    expect(resolveEntitlementPlan('ADMIN', null, now)).toBe('PRO')
  })
})
