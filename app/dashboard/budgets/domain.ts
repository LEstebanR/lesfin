// Domain logic for this feature, parameterised by userId. Lives outside the
// 'use server' actions file on purpose: every export of a 'use server'
// module is a potential Server Action endpoint, and these functions trust
// the userId they receive. Callers (Server Actions, /api/v1, MCP) must pass
// the userId of an authenticated session.
import { BusinessRuleError } from '@/lib/errors'
import { cashExpenseWhere } from '@/lib/expenses'
import { FREE_LIMITS, getUserPlan, monthsBack } from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import { getTodayInTimezone } from '@/lib/user-date'

// Free plan only sees the current month and this many months back — Pro has
// full history. Only the past is restricted; planning ahead stays open.
export async function assertBudgetMonthAllowed(
  userId: string,
  month: number,
  year: number
) {
  const plan = await getUserPlan(userId)
  if (plan === 'PRO') return
  if (monthsBack(month, year) > FREE_LIMITS.budgetMonthsBack) {
    throw new BusinessRuleError(
      `Free plan is limited to the last ${FREE_LIMITS.budgetMonthsBack + 1} months of budget history. Upgrade to Pro for full history.`
    )
  }
}

// Budget item dates are stored as UTC midnight (date-only values). Building
// these bounds with the local Date constructor uses the server process's
// timezone, which can shift the boundary by several hours and misfile
// items dated on the 1st of the month into the previous month. Date.UTC
// keeps the range anchored the same way the stored dates are.
export function monthRange(month: number, year: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(
      Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)
    ),
  }
}

interface RecurringSchedule {
  frequency: string
  dueDay: number | null
  dueMonth?: number | null
  weekday?: number | null
  intervalWeeks?: number | null
  startDate: Date
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Supports the recurrence shapes used across Subscriptions (monthly, yearly)
// and Budget recurring expenses (weekly, monthly, custom): weekly recurs on a
// matching weekday every calendar week, custom recurs on a matching weekday
// every N weeks counted from startDate, yearly recurs once a year on
// dueMonth, and monthly recurs once a month on dueDay (clamped to the
// month's length). Occurrences before the schedule's startDate are skipped
// so something started mid-period doesn't backfill earlier weeks/months/years.
function occurrenceDatesInMonth(
  schedule: RecurringSchedule,
  year: number,
  month: number,
  daysInMonth: number
): Date[] {
  if (schedule.frequency === 'weekly' || schedule.frequency === 'custom') {
    const intervalWeeks =
      schedule.frequency === 'custom' ? (schedule.intervalWeeks ?? 1) : 1
    const dates: Date[] = []
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day))
      if (date.getUTCDay() !== schedule.weekday || date < schedule.startDate) {
        continue
      }
      const weeksSinceStart = Math.round(
        (date.getTime() - schedule.startDate.getTime()) / WEEK_MS
      )
      if (weeksSinceStart % intervalWeeks === 0) {
        dates.push(date)
      }
    }
    return dates
  }

  if (schedule.frequency === 'yearly' && schedule.dueMonth !== month) {
    return []
  }

  const day = Math.min(schedule.dueDay ?? 1, daysInMonth)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date >= schedule.startDate ? [date] : []
}

// Lazily backfills this month's planned expenses for every active
// subscription that had already started by then. Safe to call from multiple
// places concurrently: the unique (subscriptionId, date) constraint plus
// skipDuplicates means a race just results in one insert winning, not
// duplicate rows.
export async function ensureSubscriptionBudgetItems(
  userId: string,
  month: number,
  year: number
) {
  const range = monthRange(month, year)

  const subscriptions = await prisma.subscription.findMany({
    where: { userId, isActive: true, startDate: { lt: range.lt } },
  })
  if (subscriptions.length === 0) return

  const existing = await prisma.budgetItem.findMany({
    where: {
      userId,
      subscriptionId: { in: subscriptions.map((s) => s.id) },
      date: range,
    },
    select: { subscriptionId: true, date: true },
  })
  const existingKeys = new Set(
    existing.map((e) => `${e.subscriptionId}:${e.date.getTime()}`)
  )

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const toCreate = subscriptions.flatMap((subscription) =>
    occurrenceDatesInMonth(subscription, year, month, daysInMonth)
      .filter(
        (date) => !existingKeys.has(`${subscription.id}:${date.getTime()}`)
      )
      .map((date) => ({
        userId,
        categoryId: subscription.categoryId,
        subcategoryId: subscription.subcategoryId,
        subscriptionId: subscription.id,
        date,
        amount: subscription.amount,
        description: subscription.name,
      }))
  )
  if (toCreate.length === 0) return

  await prisma.budgetItem.createMany({ data: toCreate, skipDuplicates: true })
}

// Same idea as ensureSubscriptionBudgetItems, but for recurring expenses
// added directly from the Budget view. Kept as a separate model from
// Subscription on purpose: these shouldn't show up in the Subscriptions view
// or be manageable from there, even though the recurrence math is identical.
export async function ensureRecurringExpenseBudgetItems(
  userId: string,
  month: number,
  year: number
) {
  const range = monthRange(month, year)

  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: { userId, isActive: true, startDate: { lt: range.lt } },
  })
  if (recurringExpenses.length === 0) return

  const existing = await prisma.budgetItem.findMany({
    where: {
      userId,
      recurringExpenseId: { in: recurringExpenses.map((r) => r.id) },
      date: range,
    },
    select: { recurringExpenseId: true, date: true },
  })
  const existingKeys = new Set(
    existing.map((e) => `${e.recurringExpenseId}:${e.date.getTime()}`)
  )

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const toCreate = recurringExpenses.flatMap((recurringExpense) =>
    occurrenceDatesInMonth(recurringExpense, year, month, daysInMonth)
      .filter(
        (date) => !existingKeys.has(`${recurringExpense.id}:${date.getTime()}`)
      )
      .map((date) => ({
        userId,
        categoryId: recurringExpense.categoryId,
        subcategoryId: recurringExpense.subcategoryId,
        recurringExpenseId: recurringExpense.id,
        date,
        amount: recurringExpense.amount,
        description: recurringExpense.name,
      }))
  )
  if (toCreate.length === 0) return

  await prisma.budgetItem.createMany({ data: toCreate, skipDuplicates: true })
}

// Debts with both a minimum payment and a due day behave like a monthly
// recurring expense: one occurrence a month, on paymentDueDay, categorized
// under the "Deuda" default category (debts don't have their own category).
// Uses the debt's createdAt as the schedule's startDate so a debt added
// mid-month doesn't backfill a payment for a month before it existed.
export async function ensureDebtBudgetItems(
  userId: string,
  month: number,
  year: number
) {
  const range = monthRange(month, year)

  const debts = await prisma.debt.findMany({
    where: {
      userId,
      minimumPayment: { not: null },
      paymentDueDay: { not: null },
      remainingBalance: { gt: 0 },
    },
  })
  if (debts.length === 0) return

  const debtCategory = await prisma.category.findFirst({
    where: {
      userId,
      type: 'expense',
      name: { equals: 'Deuda', mode: 'insensitive' },
    },
  })
  if (!debtCategory) return

  const existing = await prisma.budgetItem.findMany({
    where: { userId, debtId: { in: debts.map((d) => d.id) }, date: range },
    select: { debtId: true, date: true },
  })
  const existingKeys = new Set(
    existing.map((e) => `${e.debtId}:${e.date.getTime()}`)
  )

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const toCreate = debts.flatMap((debt) => {
    const { minimumPayment, paymentDueDay } = debt
    if (minimumPayment === null || paymentDueDay === null) return []

    return occurrenceDatesInMonth(
      {
        frequency: 'monthly',
        dueDay: paymentDueDay,
        startDate: debt.createdAt,
      },
      year,
      month,
      daysInMonth
    )
      .filter((date) => !existingKeys.has(`${debt.id}:${date.getTime()}`))
      .map((date) => ({
        userId,
        categoryId: debtCategory.id,
        subcategoryId: null,
        debtId: debt.id,
        date,
        amount: minimumPayment,
        description: debt.name,
      }))
  })
  if (toCreate.length === 0) return

  await prisma.budgetItem.createMany({ data: toCreate, skipDuplicates: true })
}

export async function getBudgetOverviewForUser(
  userId: string,
  month: number,
  year: number
) {
  await assertBudgetMonthAllowed(userId, month, year)

  await Promise.all([
    ensureSubscriptionBudgetItems(userId, month, year),
    ensureRecurringExpenseBudgetItems(userId, month, year),
    ensureDebtBudgetItems(userId, month, year),
  ])

  const range = monthRange(month, year)

  const [categories, budgetItems, expenses] = await Promise.all([
    prisma.category.findMany({
      where: { userId, type: 'expense' },
      orderBy: { name: 'asc' },
    }),
    prisma.budgetItem.findMany({
      where: { userId, date: range },
      select: { categoryId: true, amount: true },
    }),
    prisma.transaction.findMany({
      where: { userId, ...cashExpenseWhere, date: range },
      select: { categoryId: true, amount: true },
    }),
  ])

  const budgetedByCategory = new Map<string, number>()
  for (const item of budgetItems) {
    budgetedByCategory.set(
      item.categoryId,
      (budgetedByCategory.get(item.categoryId) ?? 0) + Number(item.amount)
    )
  }

  const spentByCategory = new Map<string, number>()
  for (const expense of expenses) {
    spentByCategory.set(
      expense.categoryId,
      (spentByCategory.get(expense.categoryId) ?? 0) + Number(expense.amount)
    )
  }

  return categories
    .map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      amount: budgetedByCategory.get(category.id) ?? null,
      suggestedAmount: null as number | null,
      spent: spentByCategory.get(category.id) ?? 0,
    }))
    .filter((item) => item.amount !== null || item.spent > 0)
}

function monthsBetween(
  start: Date,
  end: Date
): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = []
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth() + 1
  const endYear = end.getUTCFullYear()
  const endMonth = end.getUTCMonth() + 1
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ month, year })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return months
}

async function ensureBudgetItemsForRange(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  for (const { month, year } of monthsBetween(startDate, endDate)) {
    await Promise.all([
      ensureSubscriptionBudgetItems(userId, month, year),
      ensureRecurringExpenseBudgetItems(userId, month, year),
      ensureDebtBudgetItems(userId, month, year),
    ])
  }
}

export type DuePayment = {
  id: string
  type: string
  name: string
  amount: number
  dueDate: string
  sourceType: 'debt' | 'subscription' | 'recurring_expense' | 'manual'
}

// Reuses the same BudgetItem projection the Budget view runs off of
// (ensure*BudgetItems above). Includes every BudgetItem in range, not just
// ones tied to a debt/subscription/recurring expense — a BudgetItem with no
// such link is a one-off expense the user planned for a specific date (e.g.
// "Metro" or "Almuerzo" added by hand from the Budget view), which is just
// as much a planned payment as a recurring one. Already-paid-off debts never
// appear here: ensureDebtBudgetItems only projects debts with
// remainingBalance > 0, and paying one off deletes its future BudgetItems.
export async function getDuePaymentsForUser(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{ payments: DuePayment[]; total: number }> {
  if (startDate > endDate) {
    throw new BusinessRuleError('startDate must be on or before endDate')
  }

  await ensureBudgetItemsForRange(userId, startDate, endDate)

  const items = await prisma.budgetItem.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    include: { subscription: true, recurringExpense: true, debt: true },
    orderBy: { date: 'asc' },
  })

  const payments: DuePayment[] = items.map((item) => {
    const dueDate = item.date.toISOString().slice(0, 10)
    const amount = Number(item.amount)
    if (item.debt) {
      return {
        id: item.id,
        type: item.debt.type,
        name: item.debt.name,
        amount,
        dueDate,
        sourceType: 'debt',
      }
    }
    if (item.subscription) {
      return {
        id: item.id,
        type: 'subscription',
        name: item.subscription.name,
        amount,
        dueDate,
        sourceType: 'subscription',
      }
    }
    if (item.recurringExpense) {
      return {
        id: item.id,
        type: 'recurring_expense',
        name: item.recurringExpense.name,
        amount,
        dueDate,
        sourceType: 'recurring_expense',
      }
    }
    return {
      id: item.id,
      type: 'planned_expense',
      name: item.description,
      amount,
      dueDate,
      sourceType: 'manual',
    }
  })

  return {
    payments,
    total: payments.reduce((sum, payment) => sum + payment.amount, 0),
  }
}

type AgendaItem = {
  id: string
  name: string
  amount: number
  dueDate: string
}

// Same underlying projection as getDuePaymentsForUser, split into the
// separate arrays a "what's due today/this week" question needs. No
// scheduled-income model exists yet (Subscription/RecurringExpense only
// ever represent expenses), so scheduledIncome always comes back empty —
// the shape is here so it can be filled in later without another schema
// change on the MCP side.
export async function getDailyFinancialAgendaForUser(
  userId: string,
  date: Date
) {
  const dayStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  await ensureBudgetItemsForRange(userId, dayStart, dayStart)

  const items = await prisma.budgetItem.findMany({
    where: { userId, date: { gte: dayStart, lt: dayEnd } },
    include: { subscription: true, recurringExpense: true, debt: true },
  })

  const duePayments: AgendaItem[] = items
    .filter((item) => item.debt)
    .map((item) => ({
      id: item.id,
      name: item.debt!.name,
      amount: Number(item.amount),
      dueDate: dayStart.toISOString().slice(0, 10),
    }))

  const subscriptions: AgendaItem[] = items
    .filter((item) => item.subscription)
    .map((item) => ({
      id: item.id,
      name: item.subscription!.name,
      amount: Number(item.amount),
      dueDate: dayStart.toISOString().slice(0, 10),
    }))

  const scheduledExpenses: AgendaItem[] = items
    .filter((item) => !item.debtId && !item.subscriptionId)
    .map((item) => ({
      id: item.id,
      name: item.recurringExpense?.name ?? item.description,
      amount: Number(item.amount),
      dueDate: dayStart.toISOString().slice(0, 10),
    }))

  const scheduledIncome: AgendaItem[] = []

  const totalExpectedExpenses = [
    ...duePayments,
    ...subscriptions,
    ...scheduledExpenses,
  ].reduce((sum, item) => sum + item.amount, 0)

  return {
    date: dayStart.toISOString().slice(0, 10),
    duePayments,
    subscriptions,
    scheduledExpenses,
    scheduledIncome,
    totalExpectedExpenses,
    totalExpectedIncome: 0,
  }
}

// projectedRemaining = availableBalance - remainingBudget - scheduledPayments
//   - availableBalance: current cash across non-archived accounts, minus any
//     the caller excluded (e.g. an emergency fund that shouldn't count as
//     spendable).
//   - remainingBudget: what's left of this month's category budgets
//     (budgeted - spent, floored at 0, only for categories that have a
//     budgeted amount) — money that's still "earmarked" even though it
//     hasn't been spent yet, so it's subtracted rather than added.
//   - scheduledPayments: getDuePaymentsForUser's total between today and
//     untilDate (debts/subscriptions/recurring expenses coming due).
// status: 'insufficient' if projectedRemaining < 0; 'tight' if it's positive
// but under 10% of availableBalance (an adjustable cushion threshold);
// 'comfortable' otherwise.
export async function getCashRunwayForUser(
  userId: string,
  untilDate: Date,
  excludeAccounts?: string[]
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true },
  })
  const today = new Date(`${getTodayInTimezone(user.timezone)}T00:00:00.000Z`)

  const exclude = new Set(
    (excludeAccounts ?? []).map((value) => value.toLowerCase())
  )
  const accounts = await prisma.account.findMany({
    where: { userId, isArchived: false },
  })
  const availableBalance = accounts
    .filter(
      (account) =>
        !exclude.has(account.id.toLowerCase()) &&
        !exclude.has(account.name.toLowerCase())
    )
    .reduce((sum, account) => sum + Number(account.currentBalance), 0)

  const budget = await getBudgetOverviewForUser(
    userId,
    today.getUTCMonth() + 1,
    today.getUTCFullYear()
  )
  const remainingBudget = budget.reduce((sum, item) => {
    if (item.amount === null) return sum
    return sum + Math.max(item.amount - item.spent, 0)
  }, 0)

  const { total: scheduledPayments } = await getDuePaymentsForUser(
    userId,
    today,
    untilDate
  )

  const projectedRemaining =
    availableBalance - remainingBudget - scheduledPayments
  const daysRemaining = Math.max(
    0,
    Math.round((untilDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  )

  const tightThreshold = availableBalance * 0.1
  const status: 'comfortable' | 'tight' | 'insufficient' =
    projectedRemaining < 0
      ? 'insufficient'
      : projectedRemaining < tightThreshold
        ? 'tight'
        : 'comfortable'

  return {
    availableBalance,
    remainingBudget,
    scheduledPayments,
    projectedRemaining,
    daysRemaining,
    status,
  }
}
