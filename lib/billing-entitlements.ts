export type EntitlementPlan = 'FREE' | 'PRO'

export type BillingEntitlement = {
  status: string
  endsAt: Date | null
}

// Payment failures keep Pro access while Polar reports `past_due`, giving the
// customer time to recover payment. Access is removed when Polar reports a
// terminal status or when a canceled subscription reaches its end date.
export function hasProAccess(
  billing: BillingEntitlement,
  now = new Date()
): boolean {
  if (['active', 'trialing', 'past_due'].includes(billing.status)) return true

  return (
    billing.status === 'canceled' &&
    billing.endsAt !== null &&
    billing.endsAt > now
  )
}

export function resolveEntitlementPlan(
  role: 'ADMIN' | 'USER',
  billing: BillingEntitlement | null,
  now = new Date()
): EntitlementPlan {
  if (role === 'ADMIN') return 'PRO'
  return billing && hasProAccess(billing, now) ? 'PRO' : 'FREE'
}
