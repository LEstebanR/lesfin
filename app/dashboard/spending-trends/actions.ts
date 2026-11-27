'use server'

import {
  getMonthlyFinancialReportForUser,
  isReportMonthAllowed,
} from '@/app/dashboard/spending-trends/domain'
import {
  cardPurchaseWhere,
  cashExpenseWhere,
  sumByUtcMonth,
} from '@/lib/expenses'
import { FREE_LIMITS, getUserPlan, monthsBack } from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import type { Plan } from '@prisma/client'

// Whether at least one month of `year` falls inside the Free plan's trends
// window (the current month and this many back). Pro always passes.
function isTrendsYearAllowed(year: number, plan: Plan): boolean {
  if (plan === 'PRO') return true
  for (let month = 1; month <= 12; month++) {
    const back = monthsBack(month, year)
    if (back >= 0 && back < FREE_LIMITS.trendsMonths) return true
  }
  return false
}

export async function getCategoryMonthlyTotals(year: number) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const plan = await getUserPlan(session.user.id)
  if (!isTrendsYearAllowed(year, plan)) {
    throw new Error(
      `Free plan is limited to the last ${FREE_LIMITS.trendsMonths} months of spending trends. Upgrade to Pro for full history.`
    )
  }

  const range = {
    gte: new Date(Date.UTC(year, 0, 1)),
    lt: new Date(Date.UTC(year + 1, 0, 1)),
  }

  const [categories, expenses, cardPurchases] = await Promise.all([
    prisma.category.findMany({
      where: { userId: session.user.id, type: 'expense' },
      orderBy: { name: 'asc' },
    }),
    prisma.transaction.findMany({
      where: { userId: session.user.id, ...cashExpenseWhere, date: range },
      select: { categoryId: true, amount: true, date: true },
    }),
    prisma.transaction.findMany({
      where: { userId: session.user.id, ...cardPurchaseWhere, date: range },
      select: { amount: true, date: true },
    }),
  ])

  const monthlyTotalsByCategory = new Map<string, number[]>()
  for (const category of categories) {
    monthlyTotalsByCategory.set(category.id, Array(12).fill(0))
  }
  for (const expense of expenses) {
    const monthlyTotals = monthlyTotalsByCategory.get(expense.categoryId)
    if (!monthlyTotals) continue
    monthlyTotals[expense.date.getUTCMonth()] += Number(expense.amount)
  }

  // Card purchases are counted when the card is paid (as a "Deuda" expense),
  // so they're returned apart and the UI shows them without summing them.
  const cardPurchaseTotals = sumByUtcMonth(cardPurchases)

  if (plan !== 'PRO') {
    for (const monthlyTotals of [
      ...monthlyTotalsByCategory.values(),
      cardPurchaseTotals,
    ]) {
      for (let i = 0; i < 12; i++) {
        const back = monthsBack(i + 1, year)
        if (back < 0 || back >= FREE_LIMITS.trendsMonths) monthlyTotals[i] = 0
      }
    }
  }

  return {
    rows: categories
      .map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        monthlyTotals: monthlyTotalsByCategory.get(category.id)!,
      }))
      .filter((item) => item.monthlyTotals.some((amount) => amount > 0)),
    cardPurchaseTotals,
  }
}

export async function getAvailableReportMonths(year: number) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')
  if (!Number.isInteger(year)) throw new Error('Invalid report year')
  const plan = await getUserPlan(session.user.id)

  const range = {
    gte: new Date(Date.UTC(year, 0, 1)),
    lt: new Date(Date.UTC(year + 1, 0, 1)),
  }
  const [transactions, transfers] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session.user.id, date: range },
      select: { date: true },
    }),
    prisma.transfer.findMany({
      where: { userId: session.user.id, date: range },
      select: { date: true },
    }),
  ])

  return Array.from(
    new Set(
      [...transactions, ...transfers].map(
        (movement) => movement.date.getUTCMonth() + 1
      )
    )
  )
    .filter((month) => isReportMonthAllowed(year, month, plan))
    .sort((a, b) => a - b)
}

export async function getAvailableSpendingYears() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')
  const plan = await getUserPlan(session.user.id)

  const expenses = await prisma.transaction.findMany({
    where: { userId: session.user.id, type: 'expense' },
    select: { date: true },
  })
  return Array.from(
    new Set(expenses.map((expense) => expense.date.getUTCFullYear()))
  )
    .filter((year) => isTrendsYearAllowed(year, plan))
    .sort((a, b) => b - a)
}

export async function getMonthlyFinancialReport(year: number, month: number) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getMonthlyFinancialReportForUser(session.user.id, year, month)
}
