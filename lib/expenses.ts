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

// The default "Deuda"/"Debt" category, where debt payments are mirrored.
export function isDebtCategory(category: {
  name: string
  defaultKey?: string | null
}) {
  return (
    category.defaultKey === 'debt' ||
    /^(deuda|debt)$/i.test(category.name.trim())
  )
}

export const DEBT_CATEGORY_BLOCKED_MESSAGE =
  'Debt payments must be recorded as a debt payment (create_debt_payment, or "Record payment" on the debt), not as a transaction in the "Deuda" category — otherwise the debt balance and totalPaid are not updated.'

// A plain transaction can't be created in, or moved into, the debt category:
// that's how payments ended up as expenses that never lowered the debt.
// Transactions already there (recorded before this rule) can still be edited
// or moved out. `previousCategoryId` is the current category when editing.
export function isDebtCategoryBlocked(
  category: { id: string; name: string; defaultKey?: string | null },
  previousCategoryId?: string | null
) {
  return isDebtCategory(category) && category.id !== previousCategoryId
}
