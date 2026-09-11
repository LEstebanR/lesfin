'use server'

import { getUserPlan } from '@/lib/plan-limits'
import { currentMonthRange } from '@/lib/plan-limits-shared'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'

// Usage numbers for the Plan view. Counts include plan-locked rows so a user
// over the Free limit sees e.g. "3 of 2 accounts" instead of a misleading 2/2.
export async function getPlanUsage() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const userId = session.user.id
  const [plan, accounts, debts, subscriptions, transactionsThisMonth] =
    await Promise.all([
      getUserPlan(userId),
      prisma.account.count({ where: { userId, isArchived: false } }),
      prisma.debt.count({ where: { userId } }),
      prisma.subscription.count({ where: { userId, isActive: true } }),
      prisma.transaction.count({
        where: { userId, date: currentMonthRange() },
      }),
    ])

  const billing = await prisma.billingSubscription.findUnique({
    where: { userId },
    select: {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      endsAt: true,
    },
  })

  return {
    plan,
    accounts,
    debts,
    subscriptions,
    transactionsThisMonth,
    billing,
  }
}
