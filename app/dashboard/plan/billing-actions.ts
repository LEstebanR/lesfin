'use server'

import {
  billingLog,
  createCorrelationId,
  safeErrorName,
} from '@/lib/billing-observability'
import { getAppUrl, getPolarClient } from '@/lib/polar'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'

export async function createProCheckout() {
  const correlationId = createCorrelationId()
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const productId = process.env.POLAR_PRO_PRODUCT_ID
  if (!productId) throw new Error('Polar Pro product is not configured')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true },
  })
  if (!user) throw new Error('User not found')

  try {
    const checkout = await getPolarClient().checkouts.create({
      products: [productId],
      externalCustomerId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      metadata: { userId: user.id },
      successUrl: `${getAppUrl()}/dashboard?plan=success&checkout_id={CHECKOUT_ID}`,
      returnUrl: `${getAppUrl()}/dashboard?plan`,
    })

    billingLog('info', 'checkout.created', {
      correlationId,
      userId: user.id,
      provider: 'polar',
    })
    return { url: checkout.url }
  } catch (error) {
    billingLog('error', 'checkout.failed', {
      correlationId,
      userId: user.id,
      provider: 'polar',
      errorName: safeErrorName(error),
    })
    throw error
  }
}

export async function openBillingPortal() {
  const correlationId = createCorrelationId()
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const billing = await prisma.billingSubscription.findUnique({
    where: { userId: session.user.id },
    select: { polarCustomerId: true },
  })
  if (!billing?.polarCustomerId) throw new Error('No Polar customer found')

  try {
    const portal = await getPolarClient().customerSessions.create({
      customerId: billing.polarCustomerId,
      returnUrl: `${getAppUrl()}/dashboard?plan`,
    })
    billingLog('info', 'portal.created', {
      correlationId,
      userId: session.user.id,
      provider: 'polar',
    })
    return { url: portal.customerPortalUrl }
  } catch (error) {
    billingLog('error', 'portal.failed', {
      correlationId,
      userId: session.user.id,
      provider: 'polar',
      errorName: safeErrorName(error),
    })
    throw error
  }
}

export async function cancelProSubscription() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const billing = await prisma.billingSubscription.findUnique({
    where: { userId: session.user.id },
    select: {
      polarCustomerId: true,
      polarSubscriptionId: true,
      cancelAtPeriodEnd: true,
    },
  })
  if (!billing?.polarCustomerId || !billing.polarSubscriptionId) {
    throw new Error('No active Polar subscription found')
  }
  if (billing.cancelAtPeriodEnd) {
    return { cancelAtPeriodEnd: true }
  }

  const customerSession = await getPolarClient().customerSessions.create({
    customerId: billing.polarCustomerId,
    returnUrl: `${getAppUrl()}/dashboard?plan`,
  })
  const subscription =
    await getPolarClient().customerPortal.subscriptions.cancel(
      { customerSession: customerSession.token },
      { id: billing.polarSubscriptionId }
    )

  await prisma.billingSubscription.update({
    where: { userId: session.user.id },
    data: {
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      endsAt: subscription.endsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
  })

  return {
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    endsAt: subscription.endsAt,
  }
}
