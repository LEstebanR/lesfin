// Domain logic for this feature, parameterised by userId. Lives outside the
// 'use server' actions file on purpose: every export of a 'use server'
// module is a potential Server Action endpoint, and these functions trust
// the userId they receive. Callers (Server Actions, /api/v1, MCP) must pass
// the userId of an authenticated session.
import {
  transactionSchema,
  transferSchema,
} from '@/app/dashboard/transactions/schemas'
import type {
  TransactionInput,
  TransferInput,
} from '@/app/dashboard/transactions/schemas'
import { BusinessRuleError } from '@/lib/errors'
import {
  DEBT_CATEGORY_BLOCKED_MESSAGE,
  isDebtCategoryBlocked,
} from '@/lib/expenses'
import { FREE_LIMITS, currentMonthRange, getUserPlan } from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

export const LOCKED_SOURCE_MESSAGE =
  'This account is locked on the Free plan. Upgrade to Pro or archive another account to use it.'

// The money source of a write must belong to the user and not be locked by
// the plan (accounts/cards over the Free limit are read-only; the UI hides
// them, this enforces it for the API and MCP too).
async function assertUsableAccount(tx: Tx, userId: string, id: string) {
  const account = await tx.account.findFirstOrThrow({ where: { id, userId } })
  if (account.lockedByPlan) throw new BusinessRuleError(LOCKED_SOURCE_MESSAGE)
  return account
}

async function assertUsableCreditCard(tx: Tx, userId: string, id: string) {
  const debt = await tx.debt.findFirstOrThrow({
    where: { id, userId, type: 'credit_card' },
  })
  if (debt.lockedByPlan) throw new BusinessRuleError(LOCKED_SOURCE_MESSAGE)
  return debt
}

// A subcategory must be the user's and belong to the chosen category;
// otherwise P2025 → "not found or not yours".
async function assertSubcategory(
  tx: Tx,
  userId: string,
  categoryId: string,
  subcategoryId: string | null
) {
  if (!subcategoryId) return
  await tx.subcategory.findFirstOrThrow({
    where: { id: subcategoryId, userId, categoryId },
  })
}

export type TransactionListFilters = {
  year?: number
  month?: number
  accountId?: string
}

export async function getTransactionsForUser(
  userId: string,
  filters?: TransactionListFilters
) {
  const date =
    filters?.year !== undefined
      ? {
          gte: new Date(Date.UTC(filters.year, (filters.month ?? 1) - 1, 1)),
          lt:
            filters.month !== undefined
              ? new Date(Date.UTC(filters.year, filters.month, 1))
              : new Date(Date.UTC(filters.year + 1, 0, 1)),
        }
      : undefined

  const transactions = await prisma.transaction.findMany({
    where: { userId, date, accountId: filters?.accountId },
    include: {
      category: true,
      subcategory: true,
      account: true,
      debt: true,
      debtPayment: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return transactions.map(
    ({
      category,
      subcategory,
      account,
      debt,
      debtPayment,
      ...transaction
    }) => ({
      ...transaction,
      amount: Number(transaction.amount),
      categoryName: category.name,
      subcategoryName: subcategory?.name ?? null,
      sourceName: account?.name ?? debt?.name ?? null,
      isDebtSource: !!debt,
      isDebtPayment: !!debtPayment,
    })
  )
}

export async function getTransfersForUser(
  userId: string,
  filters?: { year?: number; month?: number }
) {
  const date =
    filters?.year !== undefined
      ? {
          gte: new Date(Date.UTC(filters.year, (filters.month ?? 1) - 1, 1)),
          lt:
            filters.month !== undefined
              ? new Date(Date.UTC(filters.year, filters.month, 1))
              : new Date(Date.UTC(filters.year + 1, 0, 1)),
        }
      : undefined

  const transfers = await prisma.transfer.findMany({
    where: { userId, date },
    orderBy: { createdAt: 'desc' },
  })

  return transfers.map((transfer) => ({
    ...transfer,
    amount: Number(transfer.amount),
  }))
}

export async function createTransactionForUser(
  userId: string,
  input: TransactionInput
) {
  const {
    accountId,
    debtId,
    amount,
    type,
    categoryId,
    subcategoryId,
    description,
    date,
  } = input

  const plan = await getUserPlan(userId)
  if (plan !== 'PRO') {
    const monthlyCount = await prisma.transaction.count({
      where: { userId, date: currentMonthRange() },
    })
    if (monthlyCount >= FREE_LIMITS.transactionsPerMonth) {
      throw new BusinessRuleError(
        `Free plan is limited to ${FREE_LIMITS.transactionsPerMonth} transactions per month. Upgrade to Pro for unlimited transactions.`
      )
    }
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const category = await tx.category.findFirstOrThrow({
      where: { id: categoryId, userId },
    })
    if (isDebtCategoryBlocked(category)) {
      throw new BusinessRuleError(DEBT_CATEGORY_BLOCKED_MESSAGE)
    }
    await assertSubcategory(tx, userId, categoryId, subcategoryId)

    if (accountId) {
      await assertUsableAccount(tx, userId, accountId)
      const balanceChange = type === 'income' ? amount : -amount
      await tx.account.update({
        where: { id: accountId },
        data: { currentBalance: { increment: balanceChange } },
      })
    } else if (debtId) {
      await assertUsableCreditCard(tx, userId, debtId)
      await tx.debt.update({
        where: { id: debtId },
        data: { remainingBalance: { increment: amount } },
      })
    }

    return tx.transaction.create({
      data: {
        userId,
        accountId,
        debtId,
        amount,
        type,
        description,
        date,
        categoryId,
        subcategoryId,
      },
    })
  })

  return { ...transaction, amount: Number(transaction.amount) }
}

export type TransactionPatch = {
  accountId?: string | null
  debtId?: string | null
  amount?: number
  type?: 'income' | 'expense'
  categoryId?: string
  subcategoryId?: string | null
  description?: string
  date?: Date
}

// Partial update: any field left out of `patch` keeps its current value.
// accountId/debtId are the exception — since exactly one of them names the
// money source, providing either one (even to switch from an account to a
// debt or vice versa) replaces the whole source pair; the one you didn't
// name is cleared. This is what lets `update_transaction` fix "I recorded
// this from Bancolombia but it was actually Nequi" by passing only the
// corrected accountId.
export async function updateTransactionForUser(
  userId: string,
  id: string,
  patch: TransactionPatch
) {
  const transaction = await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirstOrThrow({
      where: { id, userId },
      include: { debtPayment: true },
    })
    if (existing.debtPayment) {
      throw new BusinessRuleError(
        'This transaction mirrors a debt payment; edit or delete it from the debt instead'
      )
    }

    const changingSource = 'accountId' in patch || 'debtId' in patch
    const merged = transactionSchema.parse({
      accountId: changingSource
        ? (patch.accountId ?? null)
        : existing.accountId,
      debtId: changingSource ? (patch.debtId ?? null) : existing.debtId,
      amount: patch.amount ?? Number(existing.amount),
      type: patch.type ?? existing.type,
      categoryId: patch.categoryId ?? existing.categoryId,
      subcategoryId:
        'subcategoryId' in patch
          ? (patch.subcategoryId ?? null)
          : existing.subcategoryId,
      description: patch.description ?? existing.description,
      date: patch.date ?? existing.date,
    })

    const category = await tx.category.findFirstOrThrow({
      where: { id: merged.categoryId, userId },
    })
    if (isDebtCategoryBlocked(category, existing.categoryId)) {
      throw new BusinessRuleError(DEBT_CATEGORY_BLOCKED_MESSAGE)
    }
    await assertSubcategory(tx, userId, merged.categoryId, merged.subcategoryId)

    if (existing.accountId) {
      const oldChange =
        existing.type === 'income'
          ? -Number(existing.amount)
          : Number(existing.amount)
      await tx.account.update({
        where: { id: existing.accountId },
        data: { currentBalance: { increment: oldChange } },
      })
    } else if (existing.debtId) {
      await tx.debt.update({
        where: { id: existing.debtId },
        data: { remainingBalance: { decrement: Number(existing.amount) } },
      })
    }

    if (merged.accountId) {
      await assertUsableAccount(tx, userId, merged.accountId)
      const newChange =
        merged.type === 'income' ? merged.amount : -merged.amount
      await tx.account.update({
        where: { id: merged.accountId },
        data: { currentBalance: { increment: newChange } },
      })
    } else if (merged.debtId) {
      await assertUsableCreditCard(tx, userId, merged.debtId)
      await tx.debt.update({
        where: { id: merged.debtId },
        data: { remainingBalance: { increment: merged.amount } },
      })
    }

    return tx.transaction.update({
      where: { id },
      data: merged,
    })
  })

  return { ...transaction, amount: Number(transaction.amount) }
}

export async function deleteTransactionForUser(userId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirstOrThrow({
      where: { id, userId },
      include: { debtPayment: true },
    })
    if (existing.debtPayment) {
      throw new BusinessRuleError(
        'This transaction mirrors a debt payment; edit or delete it from the debt instead'
      )
    }

    if (existing.accountId) {
      const reversal =
        existing.type === 'income'
          ? -Number(existing.amount)
          : Number(existing.amount)
      await tx.account.update({
        where: { id: existing.accountId },
        data: { currentBalance: { increment: reversal } },
      })
    } else if (existing.debtId) {
      await tx.debt.update({
        where: { id: existing.debtId },
        data: { remainingBalance: { decrement: Number(existing.amount) } },
      })
    }

    await tx.transaction.delete({ where: { id } })
  })
}

export async function createTransferForUser(
  userId: string,
  input: TransferInput
) {
  const { fromAccountId, toAccountId, amount, date, note } = input

  const transfer = await prisma.$transaction(async (tx) => {
    await Promise.all([
      assertUsableAccount(tx, userId, fromAccountId),
      assertUsableAccount(tx, userId, toAccountId),
    ])

    await tx.account.update({
      where: { id: fromAccountId },
      data: { currentBalance: { decrement: amount } },
    })
    await tx.account.update({
      where: { id: toAccountId },
      data: { currentBalance: { increment: amount } },
    })

    return tx.transfer.create({
      data: {
        userId,
        fromAccountId,
        toAccountId,
        amount,
        date,
        note,
      },
    })
  })

  return { ...transfer, amount: Number(transfer.amount) }
}

export type TransferPatch = {
  fromAccountId?: string
  toAccountId?: string
  amount?: number
  date?: Date
  note?: string | null
}

export async function updateTransferForUser(
  userId: string,
  id: string,
  patch: TransferPatch
) {
  const transfer = await prisma.$transaction(async (tx) => {
    const existing = await tx.transfer.findFirstOrThrow({
      where: { id, userId },
    })

    const merged = transferSchema.parse({
      fromAccountId: patch.fromAccountId ?? existing.fromAccountId,
      toAccountId: patch.toAccountId ?? existing.toAccountId,
      amount: patch.amount ?? Number(existing.amount),
      date: patch.date ?? existing.date,
      note: 'note' in patch ? patch.note : existing.note,
    })

    // Reverse the original transfer
    await tx.account.update({
      where: { id: existing.fromAccountId },
      data: { currentBalance: { increment: Number(existing.amount) } },
    })
    await tx.account.update({
      where: { id: existing.toAccountId },
      data: { currentBalance: { decrement: Number(existing.amount) } },
    })

    await assertUsableAccount(tx, userId, merged.fromAccountId)
    await assertUsableAccount(tx, userId, merged.toAccountId)

    // Apply the updated transfer
    await tx.account.update({
      where: { id: merged.fromAccountId },
      data: { currentBalance: { decrement: merged.amount } },
    })
    await tx.account.update({
      where: { id: merged.toAccountId },
      data: { currentBalance: { increment: merged.amount } },
    })

    return tx.transfer.update({
      where: { id },
      data: merged,
    })
  })

  return { ...transfer, amount: Number(transfer.amount) }
}

export async function deleteTransferForUser(userId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.transfer.findFirstOrThrow({
      where: { id, userId },
    })

    await tx.account.update({
      where: { id: existing.fromAccountId },
      data: { currentBalance: { increment: Number(existing.amount) } },
    })
    await tx.account.update({
      where: { id: existing.toAccountId },
      data: { currentBalance: { decrement: Number(existing.amount) } },
    })

    await tx.transfer.delete({ where: { id } })
  })
}
