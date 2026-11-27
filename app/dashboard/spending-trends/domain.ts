// Domain logic for this feature, parameterised by userId. Lives outside the
// 'use server' actions file on purpose: every export of a 'use server'
// module is a potential Server Action endpoint, and these functions trust
// the userId they receive. Callers (Server Actions, /api/v1, MCP) must pass
// the userId of an authenticated session.
import { BusinessRuleError } from '@/lib/errors'
import { countsAsExpense } from '@/lib/expenses'
import { FREE_LIMITS, getUserPlan, monthsBack } from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import type { Plan } from '@prisma/client'

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

export function isReportMonthAllowed(year: number, month: number, plan: Plan) {
  if (plan === 'PRO') return true
  const back = monthsBack(month, year)
  return back >= 0 && back < FREE_LIMITS.trendsMonths
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
    throw new BusinessRuleError('Invalid report period')
  }
  const plan = await getUserPlan(userId)
  if (!isReportMonthAllowed(year, month, plan)) {
    throw new BusinessRuleError(
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
