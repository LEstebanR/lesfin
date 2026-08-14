'use server'

import {
  type CreateSubscriptionInput,
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from '@/app/dashboard/subscriptions/schemas'
import { createTransaction } from '@/app/dashboard/transactions/actions'
import { parseCurrencyInput } from '@/lib/currency'
import {
  FREE_LIMITS,
  getUserPlan,
  reconcileSubscriptionLocks,
} from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import { positiveAmount, uuidField, validDate } from '@/lib/validation'
import { z } from 'zod'

function parseDueDay(value: FormDataEntryValue | null): number {
  const parsed = parseInt(String(value ?? ''), 10)
  if (Number.isNaN(parsed)) throw new Error('Invalid due day')
  return Math.min(31, Math.max(1, parsed))
}

function parseDueMonth(value: FormDataEntryValue | null): number {
  const parsed = parseInt(String(value ?? ''), 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) {
    throw new Error('Invalid due month')
  }
  return parsed
}

function parseFrequency(
  value: FormDataEntryValue | null
): 'yearly' | 'monthly' {
  return value === 'yearly' ? 'yearly' : 'monthly'
}

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

export async function getSubscriptions() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getSubscriptionsForUser(session.user.id)
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
      throw new Error(
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

export async function createSubscription(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const frequency = parseFrequency(formData.get('frequency'))
  const parsed = createSubscriptionSchema.parse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    subcategoryId: (formData.get('subcategoryId') as string) || null,
    amount: parseCurrencyInput(formData.get('amount')),
    frequency,
    dueDay: parseDueDay(formData.get('dueDay')),
    dueMonth:
      frequency === 'yearly' ? parseDueMonth(formData.get('dueMonth')) : null,
    accountId: (formData.get('accountId') as string) || null,
    debtId: (formData.get('debtId') as string) || null,
    startDate: new Date(formData.get('startDate') as string),
  })

  return createSubscriptionForUser(session.user.id, parsed)
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

export async function updateSubscription(id: string, formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const frequency = parseFrequency(formData.get('frequency'))
  const patch = updateSubscriptionSchema.parse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    subcategoryId: (formData.get('subcategoryId') as string) || null,
    amount: parseCurrencyInput(formData.get('amount')),
    frequency,
    dueDay: parseDueDay(formData.get('dueDay')),
    dueMonth:
      frequency === 'yearly' ? parseDueMonth(formData.get('dueMonth')) : null,
    accountId: (formData.get('accountId') as string) || null,
    debtId: (formData.get('debtId') as string) || null,
  })

  return updateSubscriptionForUser(session.user.id, id, patch)
}

const paySubscriptionSchema = z
  .object({
    accountId: uuidField.nullable(),
    debtId: uuidField.nullable(),
    amount: positiveAmount,
    date: validDate,
  })
  .refine((data) => !!data.accountId || !!data.debtId, {
    message: 'An account or credit card is required',
    path: ['accountId'],
  })

// Paying a subscription is just a regular expense transaction, categorized
// like the subscription and charged to the chosen account/credit card —
// createTransaction already handles the account/debt balance mutation.
export async function paySubscription(id: string, formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const subscription = await prisma.subscription.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  const { accountId, debtId, amount, date } = paySubscriptionSchema.parse({
    accountId: (formData.get('accountId') as string) || null,
    debtId: (formData.get('debtId') as string) || null,
    amount: parseCurrencyInput(formData.get('amount')),
    date: new Date(formData.get('date') as string),
  })

  const transactionFormData = new FormData()
  transactionFormData.set('accountId', accountId ?? '')
  transactionFormData.set('debtId', debtId ?? '')
  // parseCurrencyInput expects comma-decimal input (as CurrencyField produces);
  // String(amount) is always period-decimal with no thousands separators, so a
  // straight swap round-trips it exactly.
  transactionFormData.set('amount', String(amount).replace('.', ','))
  transactionFormData.set('type', 'expense')
  transactionFormData.set('categoryId', subscription.categoryId)
  transactionFormData.set('subcategoryId', subscription.subcategoryId ?? '')
  transactionFormData.set('description', subscription.name)
  transactionFormData.set('date', date.toISOString())

  return createTransaction(transactionFormData)
}

export async function cancelSubscription(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  await prisma.subscription.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id },
      data: { isActive: false },
    })
    await tx.budgetItem.deleteMany({
      where: { subscriptionId: id, date: { gt: new Date() } },
    })
  })
}

export async function reactivateSubscription(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  await prisma.subscription.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  await prisma.subscription.update({
    where: { id },
    data: { isActive: true },
  })
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

export async function deleteSubscription(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return deleteSubscriptionForUser(session.user.id, id)
}
