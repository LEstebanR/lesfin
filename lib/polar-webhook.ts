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

export type BillingEventResult =
  | 'applied'
  | 'ignored_product'
  | 'ignored_unknown_user'

// lesfin always sends metadata.userId when it creates a checkout. The customer
// externalId may belong to another app that shared the Polar organization, so
// it is only a fallback.
export function resolveBillingUserId(
  data: Pick<PolarSubscriptionData, 'metadata' | 'customer'>
) {
  return data.metadata?.userId ?? data.customer?.externalId ?? null
}

async function userExists(tx: BillingTx, id: string) {
  const user = await tx.user.findUnique({ where: { id }, select: { id: true } })
  return user !== null
}

export async function applyBillingEvent(
  tx: BillingTx,
  {
    eventType,
    data,
    productId,
  }: {
    eventType: string
    data: PolarSubscriptionData | PolarCustomerStateData
    productId: string | undefined
  }
): Promise<BillingEventResult> {
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

  const endsAt = subscription.endsAt ?? null
  const pro =
    eventType !== 'subscription.revoked' &&
    hasProAccess({ status: subscription.status, endsAt })
  const fields = {
    polarCustomerId: subscription.customerId,
    productId: subscription.productId,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd ?? null,
    endsAt,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
  }

  await tx.billingSubscription.upsert({
    where: { polarSubscriptionId: subscription.id },
    create: { userId, polarSubscriptionId: subscription.id, ...fields },
    update: fields,
  })
  await tx.user.update({
    where: { id: userId },
    data: { plan: pro ? 'PRO' : 'FREE' },
  })
  return 'applied'
}
