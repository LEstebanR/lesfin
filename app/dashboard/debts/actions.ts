'use server'

import { parseCurrencyInput, parseOptionalCurrencyInput } from '@/lib/currency'
import {
  type DebtPaymentPatch,
  applyDebtPayment,
  revertDebtPayment,
  updateDebtPayment,
} from '@/lib/debt-payments'
import { FREE_LIMITS, getUserPlan, reconcileDebtLocks } from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import {
  optionalString,
  positiveAmount,
  requiredString,
  uuidField,
  validDate,
} from '@/lib/validation'
import { z } from 'zod'

const debtTypeSchema = z.enum(['loan', 'credit_card'])

const createDebtSchema = z.object({
  name: requiredString,
  type: debtTypeSchema,
  originalAmount: positiveAmount,
  minimumPayment: positiveAmount.nullable(),
  paymentDueDay: z.number().int().min(1).max(31).nullable(),
  creditLimit: positiveAmount.nullable(),
})

const updateDebtSchema = z.object({
  name: requiredString,
  minimumPayment: positiveAmount.nullable(),
  paymentDueDay: z.number().int().min(1).max(31).nullable(),
  creditLimit: positiveAmount.nullable(),
})

const debtPaymentSchema = z.object({
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

export async function getDebts() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getDebtsForUser(session.user.id)
}

export async function getDebtPayments(debtId: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getDebtPaymentsForUser(session.user.id, debtId)
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

export async function getDebtInterestCharges(debtId: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const charges = await prisma.debtInterestCharge.findMany({
    where: { debtId, userId: session.user.id },
    orderBy: { date: 'desc' },
  })

  return charges.map((charge) => ({
    ...charge,
    amount: Number(charge.amount),
  }))
}

function parsePaymentDueDay(value: FormDataEntryValue | null): number | null {
  if (!String(value ?? '').trim()) return null
  const parsed = parseInt(String(value), 10)
  return Number.isNaN(parsed) ? null : Math.min(31, Math.max(1, parsed))
}

export async function createDebt(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const plan = await getUserPlan(session.user.id)
  if (plan !== 'PRO') {
    const debtCount = await prisma.debt.count({
      where: { userId: session.user.id },
    })
    if (debtCount >= FREE_LIMITS.debts) {
      throw new Error(
        `Free plan is limited to ${FREE_LIMITS.debts} debts. Upgrade to Pro for unlimited debts.`
      )
    }
  }

  const rawType = (formData.get('type') as string) || 'loan'
  const {
    name,
    type,
    originalAmount,
    minimumPayment,
    paymentDueDay,
    creditLimit,
  } = createDebtSchema.parse({
    name: formData.get('name'),
    type: rawType,
    originalAmount: parseCurrencyInput(formData.get('originalAmount')),
    minimumPayment: parseOptionalCurrencyInput(formData.get('minimumPayment')),
    paymentDueDay: parsePaymentDueDay(formData.get('paymentDueDay')),
    creditLimit:
      rawType === 'credit_card'
        ? parseOptionalCurrencyInput(formData.get('creditLimit'))
        : null,
  })

  const debt = await prisma.debt.create({
    data: {
      userId: session.user.id,
      name,
      type,
      originalAmount,
      remainingBalance: originalAmount,
      minimumPayment,
      paymentDueDay,
      creditLimit,
    },
  })

  return {
    ...debt,
    originalAmount: Number(debt.originalAmount),
    remainingBalance: Number(debt.remainingBalance),
    minimumPayment:
      debt.minimumPayment === null ? null : Number(debt.minimumPayment),
    creditLimit: debt.creditLimit === null ? null : Number(debt.creditLimit),
  }
}

export async function updateDebt(id: string, formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const existing = await prisma.debt.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  const { name, minimumPayment, paymentDueDay, creditLimit } =
    updateDebtSchema.parse({
      name: formData.get('name'),
      minimumPayment: parseOptionalCurrencyInput(
        formData.get('minimumPayment')
      ),
      paymentDueDay: parsePaymentDueDay(formData.get('paymentDueDay')),
      creditLimit:
        existing.type === 'credit_card'
          ? parseOptionalCurrencyInput(formData.get('creditLimit'))
          : null,
    })

  const debt = await prisma.$transaction(async (tx) => {
    const updated = await tx.debt.update({
      where: { id, userId: session.user.id },
      data: {
        name,
        minimumPayment,
        paymentDueDay,
        creditLimit,
      },
    })

    // Not-yet-arrived planned items were generated from the old minimum
    // payment/due day; drop them so they regenerate with the updated
    // details next time that month is viewed. Past/current entries stay as
    // the historical record of what was actually planned.
    await tx.budgetItem.deleteMany({
      where: { debtId: id, date: { gt: new Date() } },
    })

    return updated
  })

  return {
    ...debt,
    originalAmount: Number(debt.originalAmount),
    remainingBalance: Number(debt.remainingBalance),
    minimumPayment:
      debt.minimumPayment === null ? null : Number(debt.minimumPayment),
    creditLimit: debt.creditLimit === null ? null : Number(debt.creditLimit),
  }
}

export async function deleteDebt(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  await prisma.$transaction(async (tx) => {
    await tx.debt.findFirstOrThrow({
      where: { id, userId: session.user.id },
    })
    await tx.debt.delete({ where: { id } })
  })
}

export async function createDebtPayment(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const input = debtPaymentSchema.parse({
    debtId: formData.get('debtId'),
    accountId: formData.get('accountId'),
    amount: parseCurrencyInput(formData.get('amount')),
    date: new Date(formData.get('date') as string),
    note: formData.get('note'),
  })

  return createDebtPaymentForUser(session.user.id, input)
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

export async function deleteDebtPayment(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  await deleteDebtPaymentForUser(session.user.id, id)
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

export async function editDebtPayment(id: string, formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return updateDebtPaymentForUser(session.user.id, id, {
    accountId: formData.get('accountId') as string,
    amount: parseCurrencyInput(formData.get('amount')),
    date: new Date(formData.get('date') as string),
    note: (formData.get('note') as string | null) ?? null,
  })
}

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

export async function createDebtInterestCharge(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const { debtId, amount, date, note } = debtInterestChargeSchema.parse({
    debtId: formData.get('debtId'),
    amount: parseCurrencyInput(formData.get('amount')),
    date: new Date(formData.get('date') as string),
    note: formData.get('note'),
  })

  const charge = await prisma.$transaction(async (tx) => {
    await tx.debt.findFirstOrThrow({
      where: { id: debtId, userId: session.user.id },
    })

    await tx.debt.update({
      where: { id: debtId },
      data: { remainingBalance: { increment: amount } },
    })

    return tx.debtInterestCharge.create({
      data: {
        debtId,
        userId: session.user.id,
        amount,
        date,
        note,
      },
    })
  })

  return { ...charge, amount: Number(charge.amount) }
}
