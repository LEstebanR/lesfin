'use server'

import {
  createSubscriptionForUser,
  deleteSubscriptionForUser,
  getSubscriptionsForUser,
  updateSubscriptionForUser,
} from '@/app/dashboard/subscriptions/domain'
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from '@/app/dashboard/subscriptions/schemas'
import { createTransaction } from '@/app/dashboard/transactions/actions'
import { parseCurrencyInput } from '@/lib/currency'
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

export async function getSubscriptions() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getSubscriptionsForUser(session.user.id)
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

export async function deleteSubscription(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return deleteSubscriptionForUser(session.user.id, id)
}
