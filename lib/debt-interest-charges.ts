import { type InterestSource, interestPeriod } from '@/lib/debt-interest'
import { type Prisma } from '@prisma/client'

export type InterestChargeInput = {
  debtId: string
  amount: number
  date: Date
  source?: InterestSource
  note?: string | null
}

export type InterestChargePatch = {
  amount?: number
  date?: Date
  source?: InterestSource
  note?: string | null
}

const startOfUtcDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )

// A charge can't predate the debt (its originalAmount already includes
// everything up to that day, so the ledger would count it twice) nor be in
// the future (it hasn't accrued yet).
function assertChargeDate(date: Date, debtCreatedAt: Date, now: Date) {
  if (date < startOfUtcDay(debtCreatedAt)) {
    throw new Error(
      'Interest charge date is before the debt was created; its original amount already includes it.'
    )
  }
  const tomorrow = new Date(startOfUtcDay(now).getTime() + 24 * 60 * 60 * 1000)
  if (date >= tomorrow) {
    throw new Error('Interest charge date cannot be in the future.')
  }
}

async function assertPeriodFree(
  tx: Prisma.TransactionClient,
  debtId: string,
  period: string,
  exceptId?: string
) {
  const clash = await tx.debtInterestCharge.findFirst({
    where: { debtId, period },
  })
  if (clash && clash.id !== exceptId) {
    throw new Error(
      `Interest for ${period} is already recorded on this debt; edit that charge instead.`
    )
  }
}

// Records an accrual: raises the debt balance and stores the charge. Never
// touches totalPaid nor creates an expense Transaction. Must run inside a
// prisma.$transaction.
export async function applyInterestCharge(
  tx: Prisma.TransactionClient,
  userId: string,
  { debtId, amount, date, source = 'manual', note }: InterestChargeInput,
  now = new Date()
) {
  const debt = await tx.debt.findFirstOrThrow({
    where: { id: debtId, userId },
  })
  if (Number(debt.remainingBalance) <= 0) {
    throw new Error('This debt is paid off; it no longer accrues interest.')
  }
  assertChargeDate(date, debt.createdAt, now)
  const period = interestPeriod(date)
  await assertPeriodFree(tx, debtId, period)

  await tx.debt.update({
    where: { id: debtId },
    data: { remainingBalance: { increment: amount } },
  })

  return tx.debtInterestCharge.create({
    data: {
      debtId,
      userId,
      amount,
      date,
      period,
      source,
      note: note ?? null,
    },
  })
}

// Corrects a charge in place (same id), moving the balance by the difference
// only. The debt can't change. Must run inside a prisma.$transaction.
export async function updateInterestCharge(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
  patch: InterestChargePatch,
  now = new Date()
) {
  const existing = await tx.debtInterestCharge.findFirstOrThrow({
    where: { id, userId },
  })
  const debt = await tx.debt.findFirstOrThrow({
    where: { id: existing.debtId, userId },
  })
  const merged = {
    amount: patch.amount ?? Number(existing.amount),
    date: patch.date ?? existing.date,
    source: patch.source ?? (existing.source as InterestSource),
    note: 'note' in patch ? (patch.note ?? null) : existing.note,
  }
  assertChargeDate(merged.date, debt.createdAt, now)
  const period = interestPeriod(merged.date)
  if (period !== existing.period) {
    await assertPeriodFree(tx, existing.debtId, period, id)
  }

  const delta = merged.amount - Number(existing.amount)
  if (delta !== 0) {
    await tx.debt.update({
      where: { id: existing.debtId },
      data: { remainingBalance: { increment: delta } },
    })
  }

  return tx.debtInterestCharge.update({
    where: { id },
    data: { ...merged, period },
  })
}

// Undoes applyInterestCharge. Must run inside a prisma.$transaction.
export async function revertInterestCharge(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string
) {
  const existing = await tx.debtInterestCharge.findFirstOrThrow({
    where: { id, userId },
  })

  await tx.debt.update({
    where: { id: existing.debtId },
    data: { remainingBalance: { decrement: Number(existing.amount) } },
  })
  await tx.debtInterestCharge.delete({ where: { id } })
}
