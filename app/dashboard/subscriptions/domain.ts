// Domain logic for this feature, parameterised by userId. Lives outside the
// 'use server' actions file on purpose: every export of a 'use server'
// module is a potential Server Action endpoint, and these functions trust
// the userId they receive. Callers (Server Actions, /api/v1, MCP) must pass
// the userId of an authenticated session.
import {
  type CreateSubscriptionInput,
  updateSubscriptionSchema,
} from '@/app/dashboard/subscriptions/schemas'
import { BusinessRuleError } from '@/lib/errors'
import {
  FREE_LIMITS,
  getUserPlan,
  reconcileSubscriptionLocks,
} from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'

export async function getSubscriptionsForUser(userId: string) {
  const plan = await getUserPlan(userId)
  await reconcileSubscriptionLocks(userId, plan)

  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    include: { category: true, subcategory: true, account: true, debt: true },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })

  return subscriptions.map(
    ({ category, subcategory, account, debt, ...sub }) => ({
      ...sub,
      amount: Number(sub.amount),
      categoryName: category.name,
      subcategoryName: subcategory?.name ?? null,
      sourceName: account?.name ?? debt?.name ?? null,
      isDebtSource: !!debt,
    })
  )
}

export async function createSubscriptionForUser(
  userId: string,
  input: CreateSubscriptionInput
) {
  const plan = await getUserPlan(userId)
  if (plan !== 'PRO') {
    const activeCount = await prisma.subscription.count({
      where: { userId, isActive: true },
    })
    if (activeCount >= FREE_LIMITS.subscriptions) {
      throw new BusinessRuleError(
        `Free plan is limited to ${FREE_LIMITS.subscriptions} subscriptions. Upgrade to Pro for unlimited subscriptions.`
      )
    }
  }

  const {
    name,
    categoryId,
    subcategoryId,
    amount,
    frequency,
    dueDay,
    dueMonth,
    accountId,
    debtId,
    startDate,
    isActive,
  } = input

  await prisma.category.findFirstOrThrow({
    where: { id: categoryId, userId },
  })
  if (accountId) {
    await prisma.account.findFirstOrThrow({
      where: { id: accountId, userId },
    })
  } else if (debtId) {
    await prisma.debt.findFirstOrThrow({
      where: { id: debtId, userId, type: 'credit_card' },
    })
  }

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      name,
      categoryId,
      subcategoryId,
      amount,
      frequency,
      dueDay,
      dueMonth,
      accountId,
      debtId,
      startDate,
      isActive: isActive ?? true,
    },
  })

  return { ...subscription, amount: Number(subscription.amount) }
}

export type SubscriptionPatch = {
  name?: string
  categoryId?: string
  subcategoryId?: string | null
  amount?: number
  frequency?: 'monthly' | 'yearly'
  dueDay?: number
  dueMonth?: number | null
  accountId?: string | null
  debtId?: string | null
  isActive?: boolean
}

// Partial update, same "naming either accountId or debtId replaces the
// whole source pair" rule as updateTransactionForUser — see the comment
// there. startDate is intentionally not patchable, same as the dashboard's
// edit form: a subscription's start date is fixed at creation.
export async function updateSubscriptionForUser(
  userId: string,
  id: string,
  patch: SubscriptionPatch
) {
  const existing = await prisma.subscription.findFirstOrThrow({
    where: { id, userId },
  })

  const changingSource = 'accountId' in patch || 'debtId' in patch
  const frequency =
    patch.frequency ?? (existing.frequency as 'monthly' | 'yearly')
  const merged = updateSubscriptionSchema.parse({
    name: patch.name ?? existing.name,
    categoryId: patch.categoryId ?? existing.categoryId,
    subcategoryId:
      'subcategoryId' in patch
        ? (patch.subcategoryId ?? null)
        : existing.subcategoryId,
    amount: patch.amount ?? Number(existing.amount),
    frequency,
    dueDay: patch.dueDay ?? existing.dueDay ?? 1,
    dueMonth:
      frequency === 'yearly'
        ? (patch.dueMonth ?? existing.dueMonth ?? 1)
        : null,
    accountId: changingSource ? (patch.accountId ?? null) : existing.accountId,
    debtId: changingSource ? (patch.debtId ?? null) : existing.debtId,
  })

  await prisma.category.findFirstOrThrow({
    where: { id: merged.categoryId, userId },
  })
  if (merged.accountId) {
    await prisma.account.findFirstOrThrow({
      where: { id: merged.accountId, userId },
    })
  } else if (merged.debtId) {
    await prisma.debt.findFirstOrThrow({
      where: { id: merged.debtId, userId, type: 'credit_card' },
    })
  }

  const isActive = patch.isActive ?? existing.isActive

  const subscription = await prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id },
      data: { ...merged, isActive },
    })

    // Not-yet-arrived planned items were generated from the old details;
    // drop them so they regenerate with the updated category/amount next
    // time that month is viewed. Items already at or before today stay as
    // the historical record of what was actually planned.
    await tx.budgetItem.deleteMany({
      where: { subscriptionId: id, date: { gt: new Date() } },
    })

    return updated
  })

  return { ...subscription, amount: Number(subscription.amount) }
}

export async function deleteSubscriptionForUser(userId: string, id: string) {
  await prisma.subscription.findFirstOrThrow({
    where: { id, userId },
  })

  // BudgetItem.subscriptionId is onDelete: Cascade, so this also removes
  // every planned budget item (past and future) tied to the subscription —
  // no separate cleanup needed here, unlike cancelSubscription (which only
  // deactivates and has to delete the future items itself).
  await prisma.subscription.delete({ where: { id } })
}
