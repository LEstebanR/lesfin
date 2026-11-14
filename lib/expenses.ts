import { type Prisma } from '@prisma/client'

// Expenses are counted on a cash basis: when money leaves an account.
// Purchases charged to a credit card (debtId set) are shown for visibility,
// but only the card payment adds to expense totals — counting both would
// count the same money twice.
export function countsAsExpense(transaction: {
  type: string
  debtId: string | null
}) {
  return transaction.type === 'expense' && transaction.debtId === null
}

// Prisma filter equivalent of countsAsExpense.
export const cashExpenseWhere = {
  type: 'expense',
  debtId: null,
} satisfies Prisma.TransactionWhereInput

// Prisma filter for purchases charged to a credit card.
export const cardPurchaseWhere = {
  type: 'expense',
  debtId: { not: null },
} satisfies Prisma.TransactionWhereInput

// Buckets amounts into the 12 months of a year by their UTC month.
export function sumByUtcMonth(items: { date: Date; amount: unknown }[]) {
  const totals: number[] = Array(12).fill(0)
  for (const item of items) {
    totals[item.date.getUTCMonth()] += Number(item.amount)
  }
  return totals
}
