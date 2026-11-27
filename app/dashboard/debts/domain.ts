// Domain logic for this feature, parameterised by userId. Lives outside the
// 'use server' actions file on purpose: every export of a 'use server'
// module is a potential Server Action endpoint, and these functions trust
// the userId they receive. Callers (Server Actions, /api/v1, MCP) must pass
// the userId of an authenticated session.
import {
  type DebtPaymentPatch,
  applyDebtPayment,
  revertDebtPayment,
  updateDebtPayment,
} from '@/lib/debt-payments'
import { getUserPlan, reconcileDebtLocks } from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import {
  optionalString,
  positiveAmount,
  uuidField,
  validDate,
} from '@/lib/validation'
import { z } from 'zod'

export const debtPaymentSchema = z.object({
  debtId: uuidField,
  accountId: uuidField,
  amount: positiveAmount,
  date: validDate,
  note: optionalString,
})

export async function getDebtsForUser(userId: string) {
  const plan = await getUserPlan(userId)
  await reconcileDebtLocks(userId, plan)

  const [debts, paidByDebt] = await Promise.all([
    prisma.debt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.debtPayment.groupBy({
      by: ['debtId'],
      where: { userId },
      _sum: { amount: true },
    }),
  ])
  const totalPaidByDebtId = new Map(
    paidByDebt.map((row) => [row.debtId, Number(row._sum.amount ?? 0)])
  )

  return debts.map((debt) => ({
    ...debt,
    originalAmount: Number(debt.originalAmount),
    remainingBalance: Number(debt.remainingBalance),
    minimumPayment:
      debt.minimumPayment === null ? null : Number(debt.minimumPayment),
    creditLimit: debt.creditLimit === null ? null : Number(debt.creditLimit),
    // Real cumulative principal payments, distinct from remainingBalance
    // (which also moves with interest charges and credit-card purchases) —
    // used for the "amount paid" progress display so interest can't make it
    // look like it was paid off.
    totalPaid: totalPaidByDebtId.get(debt.id) ?? 0,
  }))
}

export async function getDebtPaymentsForUser(userId: string, debtId: string) {
  const payments = await prisma.debtPayment.findMany({
    where: { debtId, userId },
    orderBy: { date: 'desc' },
  })

  return payments.map((payment) => ({
    ...payment,
    amount: Number(payment.amount),
  }))
}

// Shared by the dashboard and the MCP server, so a payment recorded from
// either place updates the debt and counts toward totalPaid the same way.
export async function createDebtPaymentForUser(
  userId: string,
  input: z.input<typeof debtPaymentSchema>
) {
  const parsed = debtPaymentSchema.parse(input)
  const payment = await prisma.$transaction((tx) =>
    applyDebtPayment(tx, userId, parsed)
  )

  return { ...payment, amount: Number(payment.amount) }
}

export async function deleteDebtPaymentForUser(userId: string, id: string) {
  await prisma.$transaction((tx) => revertDebtPayment(tx, userId, id))
}

const debtPaymentPatchSchema = z.object({
  accountId: uuidField.optional(),
  amount: positiveAmount.optional(),
  date: validDate.optional(),
  note: optionalString,
})

// Only the fields present in the patch change; for note, sending null (or an
// empty string) clears it while leaving it out keeps the current one.
export async function updateDebtPaymentForUser(
  userId: string,
  id: string,
  patch: DebtPaymentPatch
) {
  const parsed = debtPaymentPatchSchema.parse(patch)
  const cleanPatch: DebtPaymentPatch = {
    ...(parsed.accountId !== undefined && { accountId: parsed.accountId }),
    ...(parsed.amount !== undefined && { amount: parsed.amount }),
    ...(parsed.date !== undefined && { date: parsed.date }),
    ...('note' in patch && { note: parsed.note }),
  }
  const payment = await prisma.$transaction((tx) =>
    updateDebtPayment(tx, userId, id, cleanPatch)
  )

  return { ...payment, amount: Number(payment.amount) }
}
