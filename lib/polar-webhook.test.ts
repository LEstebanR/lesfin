import { describe, expect, it } from 'bun:test'

import {
  type BillingTx,
  type PolarOrderData,
  type PolarSubscriptionData,
  applyBillingEvent,
  isStaleEvent,
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
      findUnique: async ({
        where,
      }: {
        where: { polarSubscriptionId?: string; userId?: string }
      }) => {
        if (where.polarSubscriptionId) {
          return subscriptions.get(where.polarSubscriptionId) ?? null
        }
        return (
          [...subscriptions.values()].find(
            (item) => item.userId === where.userId
          ) ?? null
        )
      },
      update: async ({
        where,
        data,
      }: {
        where: { polarSubscriptionId: string }
        data: Record<string, unknown>
      }) => {
        const existing = subscriptions.get(where.polarSubscriptionId)
        if (!existing) throw new Error('Record not found')
        subscriptions.set(where.polarSubscriptionId, { ...existing, ...data })
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId: string }
        create: Record<string, unknown>
        update: Record<string, unknown>
      }) => {
        const entry = [...subscriptions.entries()].find(
          ([, item]) => item.userId === where.userId
        )
        if (entry) subscriptions.delete(entry[0])
        const definedUpdate = Object.fromEntries(
          Object.entries(update).filter(([, value]) => value !== undefined)
        )
        const next = entry ? { ...entry[1], ...definedUpdate } : create
        subscriptions.set(next.polarSubscriptionId as string, next)
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

const OLDER = new Date('2026-10-01T00:00:00.000Z')
const NEWER = new Date('2026-10-02T00:00:00.000Z')

function order(overrides: Partial<PolarOrderData> = {}): PolarOrderData {
  return {
    id: 'ord_1',
    status: 'refunded',
    productId: PRODUCT_ID,
    subscriptionId: 'sub_1',
    createdAt: OLDER,
    modifiedAt: NEWER,
    ...overrides,
  }
}

describe('isStaleEvent', () => {
  it('only treats strictly older timestamps as stale', () => {
    expect(isStaleEvent(OLDER, NEWER)).toBe(true)
    expect(isStaleEvent(NEWER, NEWER)).toBe(false)
    expect(isStaleEvent(NEWER, OLDER)).toBe(false)
    expect(isStaleEvent(null, NEWER)).toBe(false)
    expect(isStaleEvent(OLDER, null)).toBe(false)
  })
})

describe('out-of-order events', () => {
  it('does not let an older event overwrite a newer state', async () => {
    const { tx, plans, subscriptions } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'subscription.revoked',
      data: subscription({ status: 'canceled', modifiedAt: NEWER }),
      productId: PRODUCT_ID,
    })
    const result = await applyBillingEvent(tx, {
      eventType: 'subscription.active',
      data: subscription({ status: 'active', modifiedAt: OLDER }),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_stale')
    expect(plans.get('user_1')).toBe('FREE')
    expect(subscriptions.get('sub_1')).toMatchObject({
      status: 'canceled',
      providerModifiedAt: NEWER,
    })
  })

  it('applies a newer event and stores its timestamp', async () => {
    const { tx, plans, subscriptions } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'subscription.created',
      data: subscription({ status: 'incomplete', modifiedAt: OLDER }),
      productId: PRODUCT_ID,
    })
    const result = await applyBillingEvent(tx, {
      eventType: 'subscription.active',
      data: subscription({ status: 'active', modifiedAt: NEWER }),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('applied')
    expect(plans.get('user_1')).toBe('PRO')
    expect(subscriptions.get('sub_1')).toMatchObject({
      status: 'active',
      providerModifiedAt: NEWER,
    })
  })

  it('falls back to createdAt when modifiedAt is missing', async () => {
    const { tx, subscriptions } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'subscription.created',
      data: subscription({ createdAt: OLDER, modifiedAt: null }),
      productId: PRODUCT_ID,
    })
    expect(subscriptions.get('sub_1')).toMatchObject({
      providerModifiedAt: OLDER,
    })
  })

  it('ignores an empty customer state while the local subscription grants Pro', async () => {
    const { tx, plans } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'subscription.active',
      data: subscription({ modifiedAt: NEWER }),
      productId: PRODUCT_ID,
    })
    const result = await applyBillingEvent(tx, {
      eventType: 'customer.state_changed',
      data: { id: 'cus_1', externalId: 'user_1', activeSubscriptions: [] },
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_stale')
    expect(plans.get('user_1')).toBe('PRO')
  })
})

describe('order.refunded', () => {
  async function withActiveSubscription() {
    const ctx = createTx(['user_1'])
    await applyBillingEvent(ctx.tx, {
      eventType: 'subscription.active',
      data: subscription({ modifiedAt: OLDER }),
      productId: PRODUCT_ID,
    })
    return ctx
  }

  it('removes Pro on a full refund', async () => {
    const { tx, plans, subscriptions } = await withActiveSubscription()
    const result = await applyBillingEvent(tx, {
      eventType: 'order.refunded',
      data: order(),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('applied')
    expect(plans.get('user_1')).toBe('FREE')
    expect(subscriptions.get('sub_1')).toMatchObject({
      status: 'refunded',
      providerModifiedAt: NEWER,
    })
  })

  it('keeps Pro on a partial refund', async () => {
    const { tx, plans, subscriptions } = await withActiveSubscription()
    const result = await applyBillingEvent(tx, {
      eventType: 'order.refunded',
      data: order({ status: 'partially_refunded' }),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_partial_refund')
    expect(plans.get('user_1')).toBe('PRO')
    expect(subscriptions.get('sub_1')).toMatchObject({ status: 'active' })
  })

  it('does not let a later subscription event restore a refunded subscription', async () => {
    const { tx, plans } = await withActiveSubscription()
    await applyBillingEvent(tx, {
      eventType: 'order.refunded',
      data: order(),
      productId: PRODUCT_ID,
    })
    const result = await applyBillingEvent(tx, {
      eventType: 'subscription.updated',
      data: subscription({
        modifiedAt: new Date('2026-10-03T00:00:00.000Z'),
      }),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_refunded')
    expect(plans.get('user_1')).toBe('FREE')
  })

  it('ignores refunds of other products', async () => {
    const { tx, plans } = await withActiveSubscription()
    const result = await applyBillingEvent(tx, {
      eventType: 'order.refunded',
      data: order({ productId: 'prod_other' }),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_product')
    expect(plans.get('user_1')).toBe('PRO')
  })

  it('ignores refunds of an unknown subscription', async () => {
    const { tx, plans } = await withActiveSubscription()
    const result = await applyBillingEvent(tx, {
      eventType: 'order.refunded',
      data: order({ subscriptionId: 'sub_unknown' }),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_unknown_subscription')
    expect(plans.get('user_1')).toBe('PRO')
  })
})

describe('replacing a user subscription', () => {
  it('lets a user buy again after a full refund', async () => {
    const { tx, plans, subscriptions } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'subscription.active',
      data: subscription({ modifiedAt: OLDER }),
      productId: PRODUCT_ID,
    })
    await applyBillingEvent(tx, {
      eventType: 'order.refunded',
      data: order(),
      productId: PRODUCT_ID,
    })
    const result = await applyBillingEvent(tx, {
      eventType: 'subscription.active',
      data: subscription({
        id: 'sub_2',
        modifiedAt: new Date('2026-10-05T00:00:00.000Z'),
      }),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('applied')
    expect(plans.get('user_1')).toBe('PRO')
    expect(subscriptions.size).toBe(1)
    expect(subscriptions.get('sub_2')).toMatchObject({
      userId: 'user_1',
      status: 'active',
    })
  })

  it('ignores a late event of the previous subscription', async () => {
    const { tx, plans, subscriptions } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'subscription.active',
      data: subscription({ id: 'sub_2', modifiedAt: NEWER }),
      productId: PRODUCT_ID,
    })
    const result = await applyBillingEvent(tx, {
      eventType: 'subscription.active',
      data: subscription({ id: 'sub_1', modifiedAt: OLDER }),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_stale')
    expect(plans.get('user_1')).toBe('PRO')
    expect(subscriptions.has('sub_2')).toBe(true)
    expect(subscriptions.has('sub_1')).toBe(false)
  })

  it('does not let another subscription without access replace an active one', async () => {
    const { tx, plans, subscriptions } = createTx(['user_1'])
    await applyBillingEvent(tx, {
      eventType: 'subscription.active',
      data: subscription({ id: 'sub_2', modifiedAt: OLDER }),
      productId: PRODUCT_ID,
    })
    const result = await applyBillingEvent(tx, {
      eventType: 'subscription.revoked',
      data: subscription({
        id: 'sub_1',
        status: 'canceled',
        modifiedAt: NEWER,
      }),
      productId: PRODUCT_ID,
    })
    expect(result).toBe('ignored_superseded')
    expect(plans.get('user_1')).toBe('PRO')
    expect(subscriptions.get('sub_2')).toMatchObject({ status: 'active' })
  })
})
