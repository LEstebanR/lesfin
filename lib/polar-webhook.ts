import { hasProAccess } from '@/lib/billing-entitlements'
import type { Prisma } from '@prisma/client'

export type BillingTx = Pick<
  Prisma.TransactionClient,
  'user' | 'billingSubscription'
>

export type PolarSubscriptionData = {
  id: string
  customerId: string
  productId: string
  status: string
  currentPeriodEnd?: Date | null
  endsAt?: Date | null
  cancelAtPeriodEnd?: boolean
  createdAt?: Date | null
  modifiedAt?: Date | null
  customer?: { externalId?: string | null }
  metadata?: { userId?: string | null }
}

export type PolarCustomerStateData = {
  id: string
  externalId?: string | null
  activeSubscriptions?: Array<
    Omit<PolarSubscriptionData, 'customerId' | 'customer'>
  >
}

export type PolarOrderData = {
  id: string
  status: string
  productId?: string | null
  subscriptionId?: string | null
  createdAt?: Date | null
  modifiedAt?: Date | null
}

export type BillingEventResult =
  | 'applied'
  | 'ignored_product'
  | 'ignored_unknown_user'
  | 'ignored_unknown_subscription'
  | 'ignored_stale'
  | 'ignored_refunded'
  | 'ignored_partial_refund'
  | 'ignored_superseded'

// Local status for a subscription whose order was fully refunded. It is
// terminal: later subscription events for the same Polar subscription cannot
// restore access. A new purchase creates a new Polar subscription.
export const REFUNDED_STATUS = 'refunded'

// lesfin always sends metadata.userId when it creates a checkout. The customer
// externalId may belong to another app that shared the Polar organization, so
// it is only a fallback.
export function resolveBillingUserId(
  data: Pick<PolarSubscriptionData, 'metadata' | 'customer'>
) {
  return data.metadata?.userId ?? data.customer?.externalId ?? null
}

function providerTimestamp(data: {
  createdAt?: Date | null
  modifiedAt?: Date | null
}) {
  return data.modifiedAt ?? data.createdAt ?? null
}

// An event is stale when Polar already reported a newer state for the same
// subscription. Events without a timestamp cannot be compared and are applied.
export function isStaleEvent(
  incoming: Date | null,
  stored: Date | null | undefined
) {
  return incoming !== null && stored != null && incoming < stored
}

async function userExists(tx: BillingTx, id: string) {
  const user = await tx.user.findUnique({ where: { id }, select: { id: true } })
  return user !== null
}

async function applyRefund(
  tx: BillingTx,
  order: PolarOrderData,
  productId: string | undefined
): Promise<BillingEventResult> {
  if (order.productId !== productId) return 'ignored_product'
  // Policy: only a full refund removes access. A partial refund is a goodwill
  // adjustment and the subscription keeps its current entitlement.
  if (order.status !== 'refunded') return 'ignored_partial_refund'
  if (!order.subscriptionId) return 'ignored_unknown_subscription'

  const existing = await tx.billingSubscription.findUnique({
    where: { polarSubscriptionId: order.subscriptionId },
    select: { userId: true, providerModifiedAt: true },
  })
  if (!existing) return 'ignored_unknown_subscription'

  const refundedAt = providerTimestamp(order)
  const stored = existing.providerModifiedAt
  await tx.billingSubscription.update({
    where: { polarSubscriptionId: order.subscriptionId },
    data: {
      status: REFUNDED_STATUS,
      providerModifiedAt:
        refundedAt && (!stored || refundedAt > stored) ? refundedAt : stored,
    },
  })
  await tx.user.update({
    where: { id: existing.userId },
    data: { plan: 'FREE' },
  })
  return 'applied'
}

export async function applyBillingEvent(
  tx: BillingTx,
  {
    eventType,
    data,
    productId,
  }: {
    eventType: string
    data: PolarSubscriptionData | PolarCustomerStateData | PolarOrderData
    productId: string | undefined
  }
): Promise<BillingEventResult> {
  if (eventType === 'order.refunded') {
    return applyRefund(tx, data as PolarOrderData, productId)
  }

  let subscription: PolarSubscriptionData

  if (eventType === 'customer.state_changed') {
    const state = data as PolarCustomerStateData
    const active = state.activeSubscriptions?.find(
      (item) => item.productId === productId
    )
    if (!active) {
      if (!state.externalId || !(await userExists(tx, state.externalId))) {
        return 'ignored_unknown_user'
      }
      // Customer state has no timestamp to compare. If the local subscription
      // still grants access, a newer subscription event already won; the
      // terminal subscription.* event is what removes access.
      const local = await tx.billingSubscription.findUnique({
        where: { userId: state.externalId },
        select: { status: true, endsAt: true },
      })
      if (local && hasProAccess(local)) return 'ignored_stale'
      await tx.user.update({
        where: { id: state.externalId },
        data: { plan: 'FREE' },
      })
      return 'applied'
    }
    subscription = {
      ...active,
      customerId: state.id,
      customer: { externalId: state.externalId },
    }
  } else {
    subscription = data as PolarSubscriptionData
  }

  if (subscription.productId !== productId) return 'ignored_product'

  const userId = resolveBillingUserId(subscription)
  if (!userId || !(await userExists(tx, userId))) return 'ignored_unknown_user'

  // A user has a single BillingSubscription row: the subscription that
  // currently defines their access. A different Polar subscription (e.g. a
  // purchase after a refund) replaces it unless it is older or would remove
  // access that the current one still grants.
  const existing = await tx.billingSubscription.findUnique({
    where: { userId },
    select: {
      polarSubscriptionId: true,
      status: true,
      endsAt: true,
      providerModifiedAt: true,
    },
  })
  const sameSubscription = existing?.polarSubscriptionId === subscription.id
  if (sameSubscription && existing.status === REFUNDED_STATUS) {
    return 'ignored_refunded'
  }
  const modifiedAt = providerTimestamp(subscription)
  if (isStaleEvent(modifiedAt, existing?.providerModifiedAt)) {
    return 'ignored_stale'
  }

  const endsAt = subscription.endsAt ?? null
  const pro =
    eventType !== 'subscription.revoked' &&
    hasProAccess({ status: subscription.status, endsAt })
  if (existing && !sameSubscription && !pro && hasProAccess(existing)) {
    return 'ignored_superseded'
  }
  const fields = {
    polarSubscriptionId: subscription.id,
    polarCustomerId: subscription.customerId,
    productId: subscription.productId,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd ?? null,
    endsAt,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
    // Replacing the row must not keep the previous subscription's timestamp.
    providerModifiedAt: modifiedAt ?? (sameSubscription ? undefined : null),
  }

  await tx.billingSubscription.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  })
  await tx.user.update({
    where: { id: userId },
    data: { plan: pro ? 'PRO' : 'FREE' },
  })
  return 'applied'
}
