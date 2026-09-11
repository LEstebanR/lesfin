import { randomUUID } from 'node:crypto'

export type BillingLogLevel = 'info' | 'warn' | 'error'

export function createCorrelationId() {
  return randomUUID()
}

export function billingLog(
  level: BillingLogLevel,
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {}
) {
  const entry = JSON.stringify({
    scope: 'billing',
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  })

  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.info(entry)
}

export function safeErrorName(error: unknown) {
  return error instanceof Error ? error.name : 'UnknownError'
}
