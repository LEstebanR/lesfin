import { prisma } from '@/lib/prisma'
import { WebhookVerificationError, validateEvent } from '@polar-sh/sdk/webhooks'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function hasProAccess(status: string, endsAt: Date | null) {
  return (
    ['active', 'trialing', 'past_due'].includes(status) ||
    (status === 'canceled' && !!endsAt && endsAt > new Date())
  )
}

export async function POST(request: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  if (!secret)
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    )

  const body = await request.text()
  let event
  try {
    event = validateEvent(
      body,
      Object.fromEntries(request.headers.entries()),
      secret
    )
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
  }

  const isSubscriptionEvent = event.type.startsWith('subscription.')
  const isCustomerStateEvent = event.type === 'customer.state_changed'
  if (!isSubscriptionEvent && !isCustomerStateEvent)
    return NextResponse.json({ ok: true })

  const rawData = event.data as unknown as {
    id: string
    externalId?: string | null
    activeSubscriptions?: Array<{
      id: string
      productId: string
      status: string
      currentPeriodEnd?: Date | null
      endsAt?: Date | null
      cancelAtPeriodEnd?: boolean
      metadata?: { userId?: string | null }
    }>
    customerId?: string
    metadata?: { userId?: string | null }
    customer?: { externalId?: string | null }
  }
  const stateSubscription = rawData.activeSubscriptions?.find(
    (subscription) =>
      subscription.productId === process.env.POLAR_PRO_PRODUCT_ID
  )
  const data = (
    isCustomerStateEvent
      ? stateSubscription && {
          ...stateSubscription,
          customerId: rawData.id,
          customer: { externalId: rawData.externalId },
        }
      : rawData
  ) as {
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

  if (!data || data.productId !== process.env.POLAR_PRO_PRODUCT_ID)
    return NextResponse.json({ ok: true })

  // Polar normally includes the customer's external ID in subscription
  // events. Metadata is kept as a fallback because some event payloads can
  // omit the expanded customer object.
  const userId = data.customer?.externalId ?? data.metadata?.userId
  if (!userId) return NextResponse.json({ ok: true })

  const endsAt = data.endsAt ?? null
  const pro =
    event.type !== 'subscription.revoked' && hasProAccess(data.status, endsAt)

  await prisma.$transaction([
    prisma.billingSubscription.upsert({
      where: { polarSubscriptionId: data.id },
      create: {
        userId,
        polarCustomerId: data.customerId,
        polarSubscriptionId: data.id,
        productId: data.productId,
        status: data.status,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        endsAt,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      },
      update: {
        polarCustomerId: data.customerId,
        productId: data.productId,
        status: data.status,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        endsAt,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { plan: pro ? 'PRO' : 'FREE' },
    }),
  ])

  return NextResponse.json({ ok: true })
}
