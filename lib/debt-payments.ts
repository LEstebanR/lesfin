import { type Prisma } from '@prisma/client'

export type DebtPaymentInput = {
  debtId: string
  accountId: string
  amount: number
  date: Date
  note?: string | null
}

// Debt payments are categorized under the same "Deuda" default category the
// budget's minimum-payment planning uses, so the mirrored Transaction lines
// up with what's already budgeted for the debt.
async function getOrCreateDebtCategory(
  tx: Prisma.TransactionClient,
  userId: string
) {
  const existing = await tx.category.findFirst({
    where: {
      userId,
      type: 'expense',
      name: { equals: 'Deuda', mode: 'insensitive' },
    },
  })
  if (existing) return existing

  return tx.category.create({
    data: { userId, name: 'Deuda', type: 'expense', isDefault: true },
  })
}

// Moves money from an account to a debt: lowers both balances and records the
// DebtPayment. Must run inside a prisma.$transaction.
export async function applyDebtPayment(
  tx: Prisma.TransactionClient,
  userId: string,
  { debtId, accountId, amount, date, note }: DebtPaymentInput
) {
  const [debt] = await Promise.all([
    tx.debt.findFirstOrThrow({ where: { id: debtId, userId } }),
    tx.account.findFirstOrThrow({ where: { id: accountId, userId } }),
  ])

  await tx.account.update({
    where: { id: accountId },
    data: { currentBalance: { decrement: amount } },
  })
  const updatedDebt = await tx.debt.update({
    where: { id: debtId },
    data: { remainingBalance: { decrement: amount } },
  })

  // Fully paid off: drop this debt's not-yet-arrived planned budget items
  // (the recurring minimum-payment line) so it stops showing up as a
  // recurring expense. Past/current entries stay as the historical record
  // of what was actually planned, same as when editing a debt's terms.
  if (Number(updatedDebt.remainingBalance) <= 0) {
    await tx.budgetItem.deleteMany({
      where: { debtId, date: { gt: new Date() } },
    })
  }

  // Every debt payment (loan or credit card) is mirrored as a "Deuda"
  // expense: it's the cash actually leaving the account. That's also why
  // purchases charged to a credit card don't add to expense totals (see
  // countsAsExpense in lib/expenses.ts) — they're counted when the card is paid.
  const category = await getOrCreateDebtCategory(tx, userId)
  const transaction = await tx.transaction.create({
    data: {
      userId,
      accountId,
      amount,
      type: 'expense',
      description: note?.trim() || `Pago: ${debt.name}`,
      date,
      categoryId: category.id,
    },
  })

  return tx.debtPayment.create({
    data: {
      debtId,
      accountId,
      userId,
      amount,
      date,
      note,
      transactionId: transaction.id,
    },
  })
}

// Undoes applyDebtPayment: restores both balances and removes the payment
// plus its mirrored expense, if it has one. Must run inside a
// prisma.$transaction.
export async function revertDebtPayment(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string
) {
  const existing = await tx.debtPayment.findFirstOrThrow({
    where: { id, userId },
  })

  await tx.account.update({
    where: { id: existing.accountId },
    data: { currentBalance: { increment: Number(existing.amount) } },
  })
  await tx.debt.update({
    where: { id: existing.debtId },
    data: { remainingBalance: { increment: Number(existing.amount) } },
  })

  await tx.debtPayment.delete({ where: { id } })
  if (existing.transactionId) {
    await tx.transaction.delete({ where: { id: existing.transactionId } })
  }
}
