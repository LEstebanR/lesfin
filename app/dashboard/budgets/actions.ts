'use server'

import {
  assertBudgetMonthAllowed,
  ensureDebtBudgetItems,
  ensureRecurringExpenseBudgetItems,
  ensureSubscriptionBudgetItems,
  getBudgetOverviewForUser,
  monthRange,
} from '@/app/dashboard/budgets/domain'
import { parseCurrencyInput } from '@/lib/currency'
import { cashExpenseWhere } from '@/lib/expenses'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import {
  positiveAmount,
  requiredString,
  uuidField,
  validDate,
} from '@/lib/validation'
import { z } from 'zod'

const budgetItemSchema = z.object({
  categoryId: uuidField,
  subcategoryId: uuidField.nullable(),
  amount: positiveAmount,
  description: z.string(),
  date: validDate,
})

const recurringExpenseSchema = z
  .object({
    categoryId: uuidField,
    subcategoryId: uuidField.nullable(),
    amount: positiveAmount,
    name: requiredString,
    frequency: z.enum(['weekly', 'monthly', 'custom']),
    intervalWeeks: z.coerce.number().int().min(2).max(52).optional(),
    date: validDate,
  })
  .refine(
    (data) => data.frequency !== 'custom' || data.intervalWeeks !== undefined,
    {
      message: 'intervalWeeks is required for custom frequency',
      path: ['intervalWeeks'],
    }
  )

function parseRecurringFrequency(
  value: FormDataEntryValue | null
): 'weekly' | 'monthly' | 'custom' {
  return value === 'weekly' || value === 'custom' ? value : 'monthly'
}

export async function getBudgetOverview(month: number, year: number) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getBudgetOverviewForUser(session.user.id, month, year)
}

export async function getBudgetDailyActuals(month: number, year: number) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')
  await assertBudgetMonthAllowed(session.user.id, month, year)

  const expenses = await prisma.transaction.findMany({
    where: {
      userId: session.user.id,
      ...cashExpenseWhere,
      date: monthRange(month, year),
    },
    select: { date: true, amount: true, category: { select: { name: true } } },
  })

  return expenses.map((expense) => ({
    date: expense.date,
    amount: Number(expense.amount),
    categoryName: expense.category.name,
  }))
}

export async function getBudgetItems(month: number, year: number) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')
  await assertBudgetMonthAllowed(session.user.id, month, year)

  await Promise.all([
    ensureSubscriptionBudgetItems(session.user.id, month, year),
    ensureRecurringExpenseBudgetItems(session.user.id, month, year),
    ensureDebtBudgetItems(session.user.id, month, year),
  ])

  const items = await prisma.budgetItem.findMany({
    where: { userId: session.user.id, date: monthRange(month, year) },
    include: { category: true, subcategory: true },
    orderBy: { date: 'asc' },
  })

  return items.map(({ category, subcategory, ...item }) => ({
    ...item,
    amount: Number(item.amount),
    categoryName: category.name,
    subcategoryName: subcategory?.name ?? null,
  }))
}

export async function createBudgetItem(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const { categoryId, subcategoryId, amount, description, date } =
    budgetItemSchema.parse({
      categoryId: formData.get('categoryId'),
      subcategoryId: (formData.get('subcategoryId') as string) || null,
      amount: parseCurrencyInput(formData.get('amount')),
      description: formData.get('description'),
      date: new Date(formData.get('date') as string),
    })

  await prisma.category.findFirstOrThrow({
    where: { id: categoryId, userId: session.user.id },
  })

  const item = await prisma.budgetItem.create({
    data: {
      userId: session.user.id,
      categoryId,
      subcategoryId,
      date,
      amount,
      description,
    },
  })

  return { ...item, amount: Number(item.amount) }
}

export async function updateBudgetItem(id: string, formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const { categoryId, subcategoryId, amount, description, date } =
    budgetItemSchema.parse({
      categoryId: formData.get('categoryId'),
      subcategoryId: (formData.get('subcategoryId') as string) || null,
      amount: parseCurrencyInput(formData.get('amount')),
      description: formData.get('description'),
      date: new Date(formData.get('date') as string),
    })

  await prisma.budgetItem.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })
  await prisma.category.findFirstOrThrow({
    where: { id: categoryId, userId: session.user.id },
  })

  const item = await prisma.budgetItem.update({
    where: { id },
    data: { categoryId, subcategoryId, date, amount, description },
  })

  return { ...item, amount: Number(item.amount) }
}

export async function deleteBudgetItem(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  await prisma.budgetItem.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  await prisma.budgetItem.delete({ where: { id } })
}

// Creates the recurring expense and its first occurrence (dated exactly on
// the day the user picked) in one go, instead of relying on the next
// ensureRecurringExpenseBudgetItems pass to backfill it.
export async function createRecurringExpense(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const {
    categoryId,
    subcategoryId,
    amount,
    name,
    frequency,
    intervalWeeks,
    date,
  } = recurringExpenseSchema.parse({
    categoryId: formData.get('categoryId'),
    subcategoryId: (formData.get('subcategoryId') as string) || null,
    amount: parseCurrencyInput(formData.get('amount')),
    name: formData.get('description'),
    frequency: parseRecurringFrequency(formData.get('frequency')),
    intervalWeeks: formData.get('intervalWeeks') || undefined,
    date: new Date(formData.get('date') as string),
  })

  await prisma.category.findFirstOrThrow({
    where: { id: categoryId, userId: session.user.id },
  })

  const dueDay = frequency === 'monthly' ? date.getUTCDate() : null
  const weekday =
    frequency === 'weekly' || frequency === 'custom' ? date.getUTCDay() : null

  const item = await prisma.$transaction(async (tx) => {
    const recurringExpense = await tx.recurringExpense.create({
      data: {
        userId: session.user.id,
        name,
        categoryId,
        subcategoryId,
        amount,
        frequency,
        dueDay,
        weekday,
        intervalWeeks: frequency === 'custom' ? intervalWeeks : null,
        startDate: date,
      },
    })

    return tx.budgetItem.create({
      data: {
        userId: session.user.id,
        categoryId,
        subcategoryId,
        recurringExpenseId: recurringExpense.id,
        date,
        amount,
        description: name,
      },
    })
  })

  return { ...item, amount: Number(item.amount) }
}

// Converts a plain (occasional) budget item into a recurring expense: the
// submitted fields become the RecurringExpense's baseline, and this same
// BudgetItem is linked to it as its first occurrence instead of a fresh one
// being created, so ensureRecurringExpenseBudgetItems just picks up from here
// going forward.
export async function convertBudgetItemToRecurring(
  id: string,
  formData: FormData
) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const {
    categoryId,
    subcategoryId,
    amount,
    name,
    frequency,
    intervalWeeks,
    date,
  } = recurringExpenseSchema.parse({
    categoryId: formData.get('categoryId'),
    subcategoryId: (formData.get('subcategoryId') as string) || null,
    amount: parseCurrencyInput(formData.get('amount')),
    name: formData.get('description'),
    frequency: parseRecurringFrequency(formData.get('frequency')),
    intervalWeeks: formData.get('intervalWeeks') || undefined,
    date: new Date(formData.get('date') as string),
  })

  const existing = await prisma.budgetItem.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })
  if (
    existing.subscriptionId ||
    existing.recurringExpenseId ||
    existing.debtId
  ) {
    throw new Error('This item is already recurring')
  }
  await prisma.category.findFirstOrThrow({
    where: { id: categoryId, userId: session.user.id },
  })

  const dueDay = frequency === 'monthly' ? date.getUTCDate() : null
  const weekday =
    frequency === 'weekly' || frequency === 'custom' ? date.getUTCDay() : null

  const item = await prisma.$transaction(async (tx) => {
    const recurringExpense = await tx.recurringExpense.create({
      data: {
        userId: session.user.id,
        name,
        categoryId,
        subcategoryId,
        amount,
        frequency,
        dueDay,
        weekday,
        intervalWeeks: frequency === 'custom' ? intervalWeeks : null,
        startDate: date,
      },
    })

    return tx.budgetItem.update({
      where: { id },
      data: {
        categoryId,
        subcategoryId,
        amount,
        description: name,
        date,
        recurringExpenseId: recurringExpense.id,
      },
    })
  })

  return { ...item, amount: Number(item.amount) }
}

// Spins off a RecurringExpense (+ its first BudgetItem occurrence) from an
// already-recorded Transaction, using the submitted fields as the template.
// The Transaction itself is left untouched — it stays the accurate record of
// what already happened — this only starts a forward-looking planned stream.
export async function convertTransactionToRecurring(
  id: string,
  formData: FormData
) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const {
    categoryId,
    subcategoryId,
    amount,
    name,
    frequency,
    intervalWeeks,
    date,
  } = recurringExpenseSchema.parse({
    categoryId: formData.get('categoryId'),
    subcategoryId: (formData.get('subcategoryId') as string) || null,
    amount: parseCurrencyInput(formData.get('amount')),
    name: formData.get('description'),
    frequency: parseRecurringFrequency(formData.get('frequency')),
    intervalWeeks: formData.get('intervalWeeks') || undefined,
    date: new Date(formData.get('date') as string),
  })

  await prisma.transaction.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })
  await prisma.category.findFirstOrThrow({
    where: { id: categoryId, userId: session.user.id },
  })

  const dueDay = frequency === 'monthly' ? date.getUTCDate() : null
  const weekday =
    frequency === 'weekly' || frequency === 'custom' ? date.getUTCDay() : null

  const recurringExpense = await prisma.$transaction(async (tx) => {
    const created = await tx.recurringExpense.create({
      data: {
        userId: session.user.id,
        name,
        categoryId,
        subcategoryId,
        amount,
        frequency,
        dueDay,
        weekday,
        intervalWeeks: frequency === 'custom' ? intervalWeeks : null,
        startDate: date,
      },
    })

    await tx.budgetItem.create({
      data: {
        userId: session.user.id,
        categoryId,
        subcategoryId,
        recurringExpenseId: created.id,
        date,
        amount,
        description: name,
      },
    })

    return created
  })

  return recurringExpense
}

// Stops future occurrences (not-yet-arrived planned items) but keeps past
// and current entries as history, mirroring how cancelling a Subscription
// behaves.
export async function cancelRecurringExpense(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  await prisma.recurringExpense.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  await prisma.$transaction(async (tx) => {
    await tx.recurringExpense.update({
      where: { id },
      data: { isActive: false },
    })
    await tx.budgetItem.deleteMany({
      where: { recurringExpenseId: id, date: { gt: new Date() } },
    })
  })
}
