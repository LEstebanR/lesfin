'use server'

import { getAppUrl, getPolarClient } from '@/lib/polar'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'

export async function createProCheckout() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const productId = process.env.POLAR_PRO_PRODUCT_ID
  if (!productId) throw new Error('Polar Pro product is not configured')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true },
  })
  if (!user) throw new Error('User not found')

  const checkout = await getPolarClient().checkouts.create({
    products: [productId],
    externalCustomerId: user.id,
    customerName: user.name,
    customerEmail: user.email,
    metadata: { userId: user.id },
    successUrl: `${getAppUrl()}/dashboard?plan=success&checkout_id={CHECKOUT_ID}`,
    returnUrl: `${getAppUrl()}/dashboard?plan`,
  })

  return { url: checkout.url }
}

export async function openBillingPortal() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const billing = await prisma.billingSubscription.findUnique({
    where: { userId: session.user.id },
    select: { polarCustomerId: true },
  })
  if (!billing?.polarCustomerId) throw new Error('No Polar customer found')

  const portal = await getPolarClient().customerSessions.create({
    customerId: billing.polarCustomerId,
    returnUrl: `${getAppUrl()}/dashboard?plan`,
  })
  return { url: portal.customerPortalUrl }
}
