import { resolveEntitlementPlan } from '@/lib/billing-entitlements'
import { FREE_LIMITS } from '@/lib/plan-limits-shared'
import { prisma } from '@/lib/prisma'
import type { Plan } from '@prisma/client'

export {
  FREE_LIMITS,
  currentMonthRange,
  monthsBack,
} from './plan-limits-shared'

// Admins always get Pro-level access regardless of their billing plan.
export async function getUserPlan(userId: string): Promise<Plan> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      role: true,
      billingSubscription: {
        select: { status: true, endsAt: true },
      },
    },
  })
  return resolveEntitlementPlan(user.role, user.billingSubscription)
}

// Locks the lowest-value items beyond the plan's limit and unlocks
// everything when there's no limit (Pro) or the count is back at/under it —
// run lazily on read so a plan downgrade (or upgrade) takes effect the next
// time the list is fetched, without a dedicated migration/webhook step.
// Nothing is ever deleted; locked rows just get excluded from active totals
// and from selection in other actions until unlocked.
async function reconcileLocks<T extends { id: string }>(
  items: T[],
  limit: number,
  updateMany: (ids: string[], locked: boolean) => Promise<unknown>
) {
  const keep = items.slice(0, limit).map((item) => item.id)
  const lock = items.slice(limit).map((item) => item.id)
  await Promise.all([
    updateMany(keep, false),
    lock.length > 0 ? updateMany(lock, true) : Promise.resolve(),
  ])
}

export async function reconcileAccountLocks(userId: string, plan: Plan) {
  const accounts = await prisma.account.findMany({
    where: { userId, isArchived: false },
    orderBy: { currentBalance: 'desc' },
    select: { id: true },
  })
  await reconcileLocks(
    accounts,
    plan === 'PRO' ? accounts.length : FREE_LIMITS.accounts,
    (ids, lockedByPlan) =>
      ids.length
        ? prisma.account.updateMany({
            where: { id: { in: ids } },
            data: { lockedByPlan },
          })
        : Promise.resolve()
  )
}

export async function reconcileDebtLocks(userId: string, plan: Plan) {
  const debts = await prisma.debt.findMany({
    where: { userId },
    orderBy: { remainingBalance: 'desc' },
    select: { id: true },
  })
  await reconcileLocks(
    debts,
    plan === 'PRO' ? debts.length : FREE_LIMITS.debts,
    (ids, lockedByPlan) =>
      ids.length
        ? prisma.debt.updateMany({
            where: { id: { in: ids } },
            data: { lockedByPlan },
          })
        : Promise.resolve()
  )
}

export async function reconcileSubscriptionLocks(userId: string, plan: Plan) {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId, isActive: true },
    orderBy: { amount: 'desc' },
    select: { id: true },
  })
  await reconcileLocks(
    subscriptions,
    plan === 'PRO' ? subscriptions.length : FREE_LIMITS.subscriptions,
    (ids, lockedByPlan) =>
      ids.length
        ? prisma.subscription.updateMany({
            where: { id: { in: ids } },
            data: { lockedByPlan },
          })
        : Promise.resolve()
  )
}
