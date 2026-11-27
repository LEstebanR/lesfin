// Domain logic for this feature, parameterised by userId. Lives outside the
// 'use server' actions file on purpose: every export of a 'use server'
// module is a potential Server Action endpoint, and these functions trust
// the userId they receive. Callers (Server Actions, /api/v1, MCP) must pass
// the userId of an authenticated session.
import {
  INTEREST_SOURCES,
  type InterestRateType,
  buildDebtLedger,
  monthlyRate,
  projectPayoff,
  suggestInterest,
} from '@/lib/debt-interest'
import {
  type InterestChargePatch,
  applyInterestCharge,
  revertInterestCharge,
  updateInterestCharge,
} from '@/lib/debt-interest-charges'
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

const debtInterestChargeSchema = z.object({
  debtId: uuidField,
  amount: positiveAmount,
  date: validDate,
  source: z.enum(INTEREST_SOURCES).default('manual'),
  note: optionalString,
})

const debtInterestChargePatchSchema = z.object({
  amount: positiveAmount.optional(),
  date: validDate.optional(),
  source: z.enum(INTEREST_SOURCES).optional(),
  note: optionalString,
})

type DebtRow = Awaited<ReturnType<typeof prisma.debt.findFirstOrThrow>>

// Decimal fields don't survive RSC serialization.
export function serializeDebt(debt: DebtRow) {
  return {
    ...debt,
    originalAmount: Number(debt.originalAmount),
    remainingBalance: Number(debt.remainingBalance),
    minimumPayment:
      debt.minimumPayment === null ? null : Number(debt.minimumPayment),
    creditLimit: debt.creditLimit === null ? null : Number(debt.creditLimit),
    interestRate: debt.interestRate === null ? null : Number(debt.interestRate),
    interestRateType: debt.interestRateType as InterestRateType | null,
  }
}

export async function getDebtsForUser(userId: string) {
  const plan = await getUserPlan(userId)
  await reconcileDebtLocks(userId, plan)

  const [debts, paidByDebt, interestByDebt, lastCharges] = await Promise.all([
    prisma.debt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.debtPayment.groupBy({
      by: ['debtId'],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.debtInterestCharge.groupBy({
      by: ['debtId'],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.debtInterestCharge.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      distinct: ['debtId'],
    }),
  ])
  const totalPaidByDebtId = new Map(
    paidByDebt.map((row) => [row.debtId, Number(row._sum.amount ?? 0)])
  )
  const totalInterestByDebtId = new Map(
    interestByDebt.map((row) => [row.debtId, Number(row._sum.amount ?? 0)])
  )
  const lastChargeByDebtId = new Map(
    lastCharges.map((charge) => [charge.debtId, charge])
  )

  return debts.map((debt) => {
    const serialized = serializeDebt(debt)
    const { remainingBalance, interestRate, interestRateType } = serialized
    const hasRate = interestRate !== null && interestRateType !== null
    const lastCharge = lastChargeByDebtId.get(debt.id)

    return {
      ...serialized,
      // Real cumulative principal payments, distinct from remainingBalance
      // (which also moves with interest charges and credit-card purchases) —
      // used for the "amount paid" progress display so interest can't make it
      // look like it was paid off.
      totalPaid: totalPaidByDebtId.get(debt.id) ?? 0,
      totalInterest: totalInterestByDebtId.get(debt.id) ?? 0,
      lastInterestCharge: lastCharge
        ? {
            id: lastCharge.id,
            amount: Number(lastCharge.amount),
            date: lastCharge.date,
            period: lastCharge.period,
            source: lastCharge.source,
          }
        : null,
      monthlyInterestRate: hasRate
        ? monthlyRate(interestRate, interestRateType)
        : null,
      suggestedInterest: hasRate
        ? suggestInterest(remainingBalance, interestRate, interestRateType)
        : null,
      projection: projectPayoff({
        balance: remainingBalance,
        rate: interestRate,
        rateType: interestRateType,
        monthlyPayment: serialized.minimumPayment,
      }),
    }
  })
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

export async function getDebtInterestChargesForUser(
  userId: string,
  debtId: string
) {
  const charges = await prisma.debtInterestCharge.findMany({
    where: { debtId, userId },
    orderBy: { date: 'desc' },
  })

  return charges.map((charge) => ({
    ...charge,
    amount: Number(charge.amount),
  }))
}

// The debt's history rebuilt chronologically from its opening balance,
// purchases, interest charges and payments. remainingBalance stays the stored
// source of truth; `drift` flags when the two disagree.
export async function getDebtLedgerForUser(userId: string, debtId: string) {
  const debt = await prisma.debt.findFirstOrThrow({
    where: { id: debtId, userId },
  })
  const [payments, charges, purchases] = await Promise.all([
    prisma.debtPayment.findMany({ where: { debtId, userId } }),
    prisma.debtInterestCharge.findMany({ where: { debtId, userId } }),
    prisma.transaction.findMany({ where: { debtId, userId } }),
  ])

  const ledger = buildDebtLedger(Number(debt.originalAmount), [
    ...purchases.map((p) => ({
      id: p.id,
      kind: 'purchase' as const,
      amount: Number(p.amount),
      date: p.date,
      description: p.description,
    })),
    ...charges.map((c) => ({
      id: c.id,
      kind: 'interest' as const,
      amount: Number(c.amount),
      date: c.date,
      description: c.note,
    })),
    ...payments.map((p) => ({
      id: p.id,
      kind: 'payment' as const,
      amount: Number(p.amount),
      date: p.date,
      description: p.note,
    })),
  ])
  const storedBalance = Number(debt.remainingBalance)

  return {
    ...ledger,
    storedBalance,
    drift: Math.round((storedBalance - ledger.balance) * 100) / 100,
  }
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

// Shared by the dashboard and the MCP server. An accrual raises the balance
// but never counts toward totalPaid nor as an expense.
export async function createDebtInterestChargeForUser(
  userId: string,
  input: z.input<typeof debtInterestChargeSchema>
) {
  const parsed = debtInterestChargeSchema.parse(input)
  const charge = await prisma.$transaction((tx) =>
    applyInterestCharge(tx, userId, parsed)
  )

  return { ...charge, amount: Number(charge.amount) }
}

// Only the fields present in the patch change; for note, sending null (or an
// empty string) clears it while leaving it out keeps the current one.
export async function updateDebtInterestChargeForUser(
  userId: string,
  id: string,
  patch: z.input<typeof debtInterestChargePatchSchema>
) {
  const parsed = debtInterestChargePatchSchema.parse(patch)
  const cleanPatch: InterestChargePatch = {
    ...(parsed.amount !== undefined && { amount: parsed.amount }),
    ...(parsed.date !== undefined && { date: parsed.date }),
    ...(parsed.source !== undefined && { source: parsed.source }),
    ...('note' in patch && { note: parsed.note }),
  }
  const charge = await prisma.$transaction((tx) =>
    updateInterestCharge(tx, userId, id, cleanPatch)
  )

  return { ...charge, amount: Number(charge.amount) }
}

export async function deleteDebtInterestChargeForUser(
  userId: string,
  id: string
) {
  await prisma.$transaction((tx) => revertInterestCharge(tx, userId, id))
}
