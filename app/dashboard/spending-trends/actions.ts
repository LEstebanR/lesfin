'use server'

import {
  cardPurchaseWhere,
  cashExpenseWhere,
  countsAsExpense,
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

function escapeMarkdown(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function formatReportAmount(amount: number, currency: string) {
  const decimals = currency.toLowerCase() === 'cop' ? 0 : 2
  const formatted =
    Math.abs(amount).toLocaleString('es-CO', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + ` ${currency.toUpperCase()}`
  return `${amount < 0 ? '-' : ''}${formatted}`
}

function isReportMonthAllowed(year: number, month: number, plan: Plan) {
  if (plan === 'PRO') return true
  const back = monthsBack(month, year)
  return back >= 0 && back < FREE_LIMITS.trendsMonths
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

export async function getMonthlyFinancialReportForUser(
  userId: string,
  year: number,
  month: number
) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error('Invalid report period')
  }
  const plan = await getUserPlan(userId)
  if (!isReportMonthAllowed(year, month, plan)) {
    throw new Error(
      `Free plan is limited to the last ${FREE_LIMITS.trendsMonths} months of spending reports. Upgrade to Pro for full history.`
    )
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currency: true, language: true },
  })
  const range = {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  }

  const [accounts, debts, transactions, transfers] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      select: {
        name: true,
        type: true,
        currentBalance: true,
        isArchived: true,
      },
    }),
    prisma.debt.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      select: {
        name: true,
        type: true,
        remainingBalance: true,
        creditLimit: true,
      },
    }),
    prisma.transaction.findMany({
      where: { userId, date: range },
      orderBy: { date: 'asc' },
      include: { category: true, subcategory: true, account: true, debt: true },
    }),
    prisma.transfer.findMany({
      where: { userId, date: range },
      orderBy: { date: 'asc' },
      include: { fromAccount: true, toAccount: true },
    }),
  ])

  const isSpanish = user.language === 'es'
  const labels = isSpanish
    ? {
        title: 'Informe financiero',
        period: 'Período',
        generated: 'Generado',
        accounts: 'Estado de cuentas',
        account: 'Cuenta',
        type: 'Tipo',
        balance: 'Saldo actual',
        archived: 'Archivada',
        debts: 'Estado de deudas',
        debt: 'Deuda',
        remaining: 'Saldo pendiente',
        limit: 'Límite',
        movements: 'Movimientos del mes',
        date: 'Fecha',
        description: 'Descripción',
        category: 'Categoría',
        source: 'Origen',
        amount: 'Monto',
        income: 'Ingresos',
        expenses: 'Gastos',
        transfers: 'Transferencias',
        cardPurchases: 'Compras con tarjeta',
        cardPurchasesNote:
          'no suman a los gastos: se cuentan al pagar la tarjeta, como gasto en Deuda',
        from: 'Desde',
        to: 'Hacia',
        noMovements: 'No hubo movimientos en este período.',
        total: 'Total',
      }
    : {
        title: 'Financial report',
        period: 'Period',
        generated: 'Generated',
        accounts: 'Account balances',
        account: 'Account',
        type: 'Type',
        balance: 'Current balance',
        archived: 'Archived',
        debts: 'Debt balances',
        debt: 'Debt',
        remaining: 'Remaining balance',
        limit: 'Limit',
        movements: 'Monthly movements',
        date: 'Date',
        description: 'Description',
        category: 'Category',
        source: 'Source',
        amount: 'Amount',
        income: 'Income',
        expenses: 'Expenses',
        transfers: 'Transfers',
        cardPurchases: 'Credit card purchases',
        cardPurchasesNote:
          'not added to expenses: counted when the card is paid, as a Debt expense',
        from: 'From',
        to: 'To',
        noMovements: 'There were no movements in this period.',
        total: 'Total',
      }
  const monthName = new Intl.DateTimeFormat(isSpanish ? 'es-CO' : 'en-US', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  const amount = (value: number) => formatReportAmount(value, user.currency)
  const income = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0)
  const expenses = transactions
    .filter(countsAsExpense)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0)
  const cardPurchases = transactions
    .filter(
      (transaction) => transaction.type === 'expense' && transaction.debtId
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0)

  const lines = [
    `# ${labels.title} — ${monthName} ${year}`,
    '',
    `- **${labels.period}:** ${monthName} ${year}`,
    `- **${labels.generated}:** ${new Date().toLocaleDateString(isSpanish ? 'es-CO' : 'en-US')}`,
    '',
    `## ${labels.accounts}`,
    '',
    `| ${labels.account} | ${labels.type} | ${labels.balance} |`,
    '| --- | --- | ---: |',
    ...accounts.map(
      (account) =>
        `| ${escapeMarkdown(account.name)} | ${escapeMarkdown(account.type)}${account.isArchived ? ` (${labels.archived})` : ''} | ${amount(Number(account.currentBalance))} |`
    ),
    accounts.length === 0 ? `| — | — | ${amount(0)} |` : '',
    '',
    `## ${labels.debts}`,
    '',
    `| ${labels.debt} | ${labels.type} | ${labels.remaining} | ${labels.limit} |`,
    '| --- | --- | ---: | ---: |',
    ...debts.map(
      (debt) =>
        `| ${escapeMarkdown(debt.name)} | ${escapeMarkdown(debt.type)} | ${amount(Number(debt.remainingBalance))} | ${debt.creditLimit === null ? '—' : amount(Number(debt.creditLimit))} |`
    ),
    debts.length === 0 ? '| — | — | — | — |' : '',
    '',
    `## ${labels.movements}`,
    '',
    `- **${labels.income}:** ${amount(income)}`,
    `- **${labels.expenses}:** ${amount(expenses)}`,
    ...(cardPurchases > 0
      ? [
          `- **${labels.cardPurchases}:** ${amount(cardPurchases)} (${labels.cardPurchasesNote})`,
        ]
      : []),
    `- **${labels.total}:** ${amount(income - expenses)}`,
    '',
    `| ${labels.date} | ${labels.description} | ${labels.category} | ${labels.source} | ${labels.amount} |`,
    '| --- | --- | --- | --- | ---: |',
    ...transactions.map((transaction) => {
      const source = transaction.account?.name ?? transaction.debt?.name ?? '—'
      const category = transaction.subcategory
        ? `${transaction.category.name} / ${transaction.subcategory.name}`
        : transaction.category.name
      const sign = transaction.type === 'income' ? '+' : '-'
      return `| ${transaction.date.toISOString().slice(0, 10)} | ${escapeMarkdown(transaction.description || '—')} | ${escapeMarkdown(category)} | ${escapeMarkdown(source)} | ${sign}${amount(Number(transaction.amount))} |`
    }),
    transactions.length === 0
      ? `| — | ${labels.noMovements} | — | — | — |`
      : '',
  ]

  if (transfers.length > 0) {
    lines.push(
      '',
      `### ${labels.transfers}`,
      '',
      `| ${labels.date} | ${labels.from} | ${labels.to} | ${labels.amount} |`,
      '| --- | --- | --- | ---: |'
    )
    lines.push(
      ...transfers.map(
        (transfer) =>
          `| ${transfer.date.toISOString().slice(0, 10)} | ${escapeMarkdown(transfer.fromAccount.name)} | ${escapeMarkdown(transfer.toAccount.name)} | ${amount(Number(transfer.amount))} |`
      )
    )
  }

  return lines.join('\n') + '\n'
}

export async function getMonthlyFinancialReport(year: number, month: number) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getMonthlyFinancialReportForUser(session.user.id, year, month)
}
