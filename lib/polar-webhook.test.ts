import { describe, expect, it } from 'bun:test'

import {
  type BillingTx,
  type PolarSubscriptionData,
  applyBillingEvent,
  resolveBillingUserId,
} from './polar-webhook'

const PRODUCT_ID = 'prod_lesfin_pro'

function createTx(userIds: string[]) {
  const plans = new Map<string, string>()
  const subscriptions = new Map<string, Record<string, unknown>>()
  const tx = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        userIds.includes(where.id) ? { id: where.id } : null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: { plan: string }
      }) => {
        if (!userIds.includes(where.id)) throw new Error('Record not found')
        plans.set(where.id, data.plan)
      },
    },
    billingSubscription: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { polarSubscriptionId: string }
        create: Record<string, unknown>
        update: Record<string, unknown>
      }) => {
        const existing = subscriptions.get(where.polarSubscriptionId)
        subscriptions.set(
          where.polarSubscriptionId,
          existing ? { ...existing, ...update } : create
        )
      },
    },
  } as unknown as BillingTx
  return { tx, plans, subscriptions }
}

function subscription(
  overrides: Partial<PolarSubscriptionData> = {}
): PolarSubscriptionData {
  return {
    id: 'sub_1',
    customerId: 'cus_1',
    productId: PRODUCT_ID,
    status: 'active',
    currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
    endsAt: null,
    cancelAtPeriodEnd: false,
    customer: { externalId: 'user_1' },
    metadata: { userId: 'user_1' },
    ...overrides,
  }
}

describe('resolveBillingUserId', () => {
  it('prefers checkout metadata over the customer externalId', () => {
    expect(
      resolveBillingUserId({
        metadata: { userId: 'user_1' },
        customer: { externalId: 'other_app_workspace' },
      })
    ).toBe('user_1')
  })

  it('falls back to the customer externalId', () => {
    expect(resolveBillingUserId({ customer: { externalId: 'user_1' } })).toBe(
      'user_1'
    )
  })
})

describe('applyBillingEvent', () => {
  it('upgrades the user when a subscription is created', async () => {
    const { tx, plans, subscriptions } = createTx(['user_1'])
    const result = await applyBillingEvent(tx, {
      eventType: 'subscription.created',
      data: subscription(),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('applied')
    expect(plans.get('user_1')).toBe('PRO')
    expect(subscriptions.get('sub_1')).toMatchObject({
      userId: 'user_1',
      polarCustomerId: 'cus_1',
      status: 'active',
    })
  })

  it('keeps Pro until the end of a canceled period', async () => {
    const { tx, plans, subscriptions } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'subscription.canceled',
      data: subscription({
        status: 'canceled',
        cancelAtPeriodEnd: true,
        endsAt: new Date('2099-01-01T00:00:00.000Z'),
      }),
      productId: PRODUCT_ID,
    })
    expect(plans.get('user_1')).toBe('PRO')
    expect(subscriptions.get('sub_1')).toMatchObject({
      cancelAtPeriodEnd: true,
    })
  })

  it('downgrades the user when a subscription is revoked', async () => {
    const { tx, plans } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'subscription.revoked',
      data: subscription({ status: 'canceled' }),
      productId: PRODUCT_ID,
    })
    expect(plans.get('user_1')).toBe('FREE')
  })

  it('maps a customer with another app externalId through metadata', async () => {
    const { tx, plans, subscriptions } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'subscription.active',
      data: subscription({ customer: { externalId: 'other_app_workspace' } }),
      productId: PRODUCT_ID,
    })
    expect(plans.get('user_1')).toBe('PRO')
    expect(subscriptions.get('sub_1')).toMatchObject({ userId: 'user_1' })
  })

  it('ignores subscriptions of other products', async () => {
    const { tx, plans, subscriptions } = createTx(['user_1'])
    const result = await applyBillingEvent(tx, {
      eventType: 'subscription.created',
      data: subscription({ productId: 'prod_other' }),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_product')
    expect(plans.size).toBe(0)
    expect(subscriptions.size).toBe(0)
  })

  it('ignores subscriptions whose user does not exist', async () => {
    const { tx, plans, subscriptions } = createTx([])
    const result = await applyBillingEvent(tx, {
      eventType: 'subscription.created',
      data: subscription(),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_unknown_user')
    expect(plans.size).toBe(0)
    expect(subscriptions.size).toBe(0)
  })

  it('ignores customer state of a customer that is not a lesfin user', async () => {
    const { tx, plans } = createTx(['user_1'])
    const result = await applyBillingEvent(tx, {
      eventType: 'customer.state_changed',
      data: {
        id: 'cus_2',
        externalId: 'other_app_workspace',
        activeSubscriptions: [],
      },
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_unknown_user')
    expect(plans.size).toBe(0)
  })

  it('downgrades a lesfin customer without an active Pro subscription', async () => {
    const { tx, plans } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'customer.state_changed',
      data: { id: 'cus_1', externalId: 'user_1', activeSubscriptions: [] },
      productId: PRODUCT_ID,
    })
    expect(plans.get('user_1')).toBe('FREE')
  })

  it('syncs the active Pro subscription from customer state', async () => {
    const { tx, plans, subscriptions } = createTx(['user_1'])
    const { id, productId, status, currentPeriodEnd, metadata } = subscription()
    const active = { id, productId, status, currentPeriodEnd, metadata }
    await applyBillingEvent(tx, {
      eventType: 'customer.state_changed',
      data: {
        id: 'cus_1',
        externalId: 'user_1',
        activeSubscriptions: [active],
      },
      productId: PRODUCT_ID,
    })
    expect(plans.get('user_1')).toBe('PRO')
    expect(subscriptions.get('sub_1')).toMatchObject({
      polarCustomerId: 'cus_1',
    })
  })
})
