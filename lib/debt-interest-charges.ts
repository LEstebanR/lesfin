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

const DAY_MS = 24 * 60 * 60 * 1000

// A charge can't predate the debt (its originalAmount already includes
// everything up to that day, so the ledger would count it twice) nor be in
// the future (it hasn't accrued yet). Charge dates are calendar days stored
// as midnight UTC while createdAt/now are real instants, so both bounds allow
// one extra day: the user's local day can be a day behind or ahead of UTC.
function assertChargeDate(date: Date, debtCreatedAt: Date, now: Date) {
  const earliest = new Date(startOfUtcDay(debtCreatedAt).getTime() - DAY_MS)
  if (date < earliest) {
    throw new Error(
      'Interest charge date is before the debt was created; its original amount already includes it.'
    )
  }
  const latestExclusive = new Date(startOfUtcDay(now).getTime() + 2 * DAY_MS)
  if (date >= latestExclusive) {
    throw new Error('Interest charge date cannot be in the future.')
  }
}

const periodTakenError = (period: string) =>
  new Error(
    `Interest for ${period} is already recorded on this debt; edit that charge instead.`
  )

// The findFirst check in assertPeriodFree can race with a concurrent insert;
// the unique index then rejects it (P2002) — surface the same message.
async function withPeriodGuard<T>(period: string, fn: () => Promise<T>) {
  try {
    return await fn()
  } catch (error) {
    if ((error as { code?: string } | null)?.code === 'P2002') {
      throw periodTakenError(period)
    }
    throw error
  }
}

// Lowers the balance after removing or shrinking interest. Interest can only
// be taken back out of what's still owed: a result below zero means it was
// already paid, so it's rejected (the transaction rolls back). Reaching zero
// gets the same paid-off cleanup as a payment.
async function lowerBalanceForInterest(
  tx: Prisma.TransactionClient,
  debtId: string,
  amount: number
) {
  const updated = await tx.debt.update({
    where: { id: debtId },
    data: { remainingBalance: { decrement: amount } },
  })
  const balance = Number(updated.remainingBalance)
  if (balance < -0.005) {
    throw new Error(
      'Removing this interest would leave the debt with a negative balance; it was already paid.'
    )
  }
  if (balance <= 0) {
    await tx.budgetItem.deleteMany({
      where: { debtId, date: { gt: new Date() } },
    })
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
  if (clash && clash.id !== exceptId) throw periodTakenError(period)
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

  return withPeriodGuard(period, () =>
    tx.debtInterestCharge.create({
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
  )
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
  // Only a changed date is validated, so older charges can still have their
  // amount, source or note corrected.
  if (merged.date.getTime() !== existing.date.getTime()) {
    assertChargeDate(merged.date, debt.createdAt, now)
  }
  const period = interestPeriod(merged.date)
  if (period !== existing.period) {
    await assertPeriodFree(tx, existing.debtId, period, id)
  }

  const delta = merged.amount - Number(existing.amount)
  if (delta > 0) {
    await tx.debt.update({
      where: { id: existing.debtId },
      data: { remainingBalance: { increment: delta } },
    })
  } else if (delta < 0) {
    await lowerBalanceForInterest(tx, existing.debtId, -delta)
  }

  return withPeriodGuard(period, () =>
    tx.debtInterestCharge.update({
      where: { id },
      data: { ...merged, period },
    })
  )
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

  await lowerBalanceForInterest(tx, existing.debtId, Number(existing.amount))
  await tx.debtInterestCharge.delete({ where: { id } })
}
