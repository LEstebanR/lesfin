'use server'

import {
  createDebtInterestChargeForUser,
  createDebtPaymentForUser,
  debtPaymentSchema,
  deleteDebtInterestChargeForUser,
  deleteDebtPaymentForUser,
  getDebtInterestChargesForUser,
  getDebtLedgerForUser,
  getDebtPaymentsForUser,
  getDebtsForUser,
  serializeDebt,
  updateDebtInterestChargeForUser,
  updateDebtPaymentForUser,
} from '@/app/dashboard/debts/domain'
import { parseCurrencyInput, parseOptionalCurrencyInput } from '@/lib/currency'
import {
  INTEREST_RATE_TYPES,
  type InterestSource,
  MAX_INTEREST_RATE,
  parsePercentInput,
} from '@/lib/debt-interest'
import { FREE_LIMITS, getUserPlan } from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import { positiveAmount, requiredString } from '@/lib/validation'
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

// The rate is a fraction (0.245 = 24.5%); it and its type go together.
const interestTermsSchema = z
  .object({
    interestRate: z.number().finite().min(0).max(MAX_INTEREST_RATE).nullable(),
    interestRateType: z.enum(INTEREST_RATE_TYPES).nullable(),
  })
  .refine(
    ({ interestRate, interestRateType }) =>
      (interestRate === null) === (interestRateType === null),
    {
      message: 'An interest rate needs its type, and vice versa',
      path: ['interestRateType'],
    }
  )

// The form sends the rate as a percentage ("24,5" or "24.5" → 0.245); an
// empty field means no rate. NaN is left for zod to reject.
function parseInterestTerms(formData: FormData) {
  const rawRate = String(formData.get('interestRate') ?? '').trim()
  const rawType = String(formData.get('interestRateType') ?? '').trim()
  const interestRate = rawRate ? parsePercentInput(rawRate) : null
  const terms = interestTermsSchema.parse({
    interestRate,
    interestRateType: interestRate === null ? null : rawType || null,
  })
  return {
    ...terms,
    accrualFrequency: terms.interestRate === null ? null : ('monthly' as const),
  }
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

export async function getDebtInterestCharges(debtId: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getDebtInterestChargesForUser(session.user.id, debtId)
}

export async function getDebtLedger(debtId: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getDebtLedgerForUser(session.user.id, debtId)
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
  const interestTerms = parseInterestTerms(formData)

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
      ...interestTerms,
    },
  })

  return serializeDebt(debt)
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
  const interestTerms = parseInterestTerms(formData)

  const debt = await prisma.$transaction(async (tx) => {
    const updated = await tx.debt.update({
      where: { id, userId: session.user.id },
      data: {
        name,
        minimumPayment,
        paymentDueDay,
        creditLimit,
        ...interestTerms,
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

  return serializeDebt(debt)
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

export async function deleteDebtPayment(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  await deleteDebtPaymentForUser(session.user.id, id)
}

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

export async function createDebtInterestCharge(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return createDebtInterestChargeForUser(session.user.id, {
    debtId: formData.get('debtId') as string,
    amount: parseCurrencyInput(formData.get('amount')),
    date: new Date(formData.get('date') as string),
    source: ((formData.get('source') as string | null) || undefined) as
      | InterestSource
      | undefined,
    note: formData.get('note') as string | null,
  })
}

export async function editDebtInterestCharge(id: string, formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return updateDebtInterestChargeForUser(session.user.id, id, {
    amount: parseCurrencyInput(formData.get('amount')),
    date: new Date(formData.get('date') as string),
    source: ((formData.get('source') as string | null) || undefined) as
      | InterestSource
      | undefined,
    note: (formData.get('note') as string | null) ?? null,
  })
}

export async function deleteDebtInterestCharge(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  await deleteDebtInterestChargeForUser(session.user.id, id)
}
