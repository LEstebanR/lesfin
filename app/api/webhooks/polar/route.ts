import {
  billingLog,
  createCorrelationId,
  safeErrorName,
} from '@/lib/billing-observability'
import {
  type BillingEventResult,
  type PolarCustomerStateData,
  type PolarSubscriptionData,
  applyBillingEvent,
} from '@/lib/polar-webhook'
import { prisma } from '@/lib/prisma'
import { WebhookVerificationError, validateEvent } from '@polar-sh/sdk/webhooks'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  correlationId: string
) {
  return NextResponse.json(body, {
    status,
    headers: { 'x-correlation-id': correlationId },
  })
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

async function processWebhookEvent({
  eventId,
  eventType,
  correlationId,
  handler,
}: {
  eventId: string
  eventType: string
  correlationId: string
  handler: (tx: Prisma.TransactionClient) => Promise<void>
}) {
  const existing = await prisma.billingWebhookEvent.findUnique({
    where: { eventId },
    select: { id: true },
  })
  if (existing) return 'duplicate' as const

  try {
    await prisma.$transaction(async (tx) => {
      await tx.billingWebhookEvent.create({
        data: {
          eventId,
          eventType,
          status: 'processing',
          correlationId,
        },
      })
      await handler(tx)
      await tx.billingWebhookEvent.update({
        where: { eventId },
        data: { status: 'processed', processedAt: new Date() },
      })
    })
    return 'processed' as const
  } catch (error) {
    // A concurrent retry may win the unique insert. It is safe to acknowledge
    // it because the winning transaction owns the event effect.
    if (isUniqueConstraintError(error)) return 'duplicate' as const
    throw error
  }
}

export async function POST(request: Request) {
  const correlationId = createCorrelationId()
  const secret = process.env.POLAR_WEBHOOK_SECRET
  if (!secret) {
    billingLog('error', 'webhook.configuration_missing', {
      correlationId,
      provider: 'polar',
    })
    return jsonResponse({ error: 'Webhook not configured' }, 500, correlationId)
  }

  const body = await request.text()
  let event
  try {
    event = validateEvent(
      body,
      Object.fromEntries(request.headers.entries()),
      secret
    )
  } catch (error) {
    billingLog('warn', 'webhook.signature_rejected', {
      correlationId,
      provider: 'polar',
      errorName: safeErrorName(error),
    })
    if (error instanceof WebhookVerificationError) {
      return jsonResponse({ error: 'Invalid signature' }, 403, correlationId)
    }
    return jsonResponse({ error: 'Invalid webhook' }, 400, correlationId)
  }

  const isSubscriptionEvent = event.type.startsWith('subscription.')
  const isCustomerStateEvent = event.type === 'customer.state_changed'
  if (!isSubscriptionEvent && !isCustomerStateEvent) {
    billingLog('info', 'webhook.ignored', {
      correlationId,
      provider: 'polar',
      eventType: event.type,
    })
    return jsonResponse({ ok: true }, 200, correlationId)
  }

  const eventId = request.headers.get('webhook-id')
  if (!eventId) {
    billingLog('warn', 'webhook.id_missing', {
      correlationId,
      provider: 'polar',
      eventType: event.type,
    })
    return jsonResponse({ error: 'Missing webhook id' }, 400, correlationId)
  }

  let outcome: BillingEventResult | undefined
  try {
    const result = await processWebhookEvent({
      eventId,
      eventType: event.type,
      correlationId,
      handler: async (tx) => {
        outcome = await applyBillingEvent(tx, {
          eventType: event.type,
          data: event.data as unknown as
            | PolarSubscriptionData
            | PolarCustomerStateData,
          productId: process.env.POLAR_PRO_PRODUCT_ID,
        })
      },
    })

    if (outcome === 'ignored_unknown_user') {
      billingLog('warn', 'webhook.unknown_user', {
        correlationId,
        eventId,
        eventType: event.type,
        provider: 'polar',
      })
    }
    billingLog('info', `webhook.${result}`, {
      correlationId,
      eventId,
      eventType: event.type,
      provider: 'polar',
    })
    return jsonResponse(
      { ok: true, duplicate: result === 'duplicate' },
      200,
      correlationId
    )
  } catch (error) {
    billingLog('error', 'webhook.processing_failed', {
      correlationId,
      eventId,
      eventType: event.type,
      provider: 'polar',
      errorName: safeErrorName(error),
    })
    return jsonResponse(
      { error: 'Webhook processing failed', correlationId },
      500,
      correlationId
    )
  }
}
