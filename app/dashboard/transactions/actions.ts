'use server'

import {
  transactionSchema,
  transferSchema,
} from '@/app/dashboard/transactions/schemas'
import type {
  TransactionInput,
  TransferInput,
} from '@/app/dashboard/transactions/schemas'
import { parseCurrencyInput } from '@/lib/currency'
import { FREE_LIMITS, currentMonthRange, getUserPlan } from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'

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

export async function getTransactions() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getTransactionsForUser(session.user.id)
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

export async function getTransfers() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getTransfersForUser(session.user.id)
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
      throw new Error(
        `Free plan is limited to ${FREE_LIMITS.transactionsPerMonth} transactions per month. Upgrade to Pro for unlimited transactions.`
      )
    }
  }

  const transaction = await prisma.$transaction(async (tx) => {
    await tx.category.findFirstOrThrow({
      where: { id: categoryId, userId },
    })

    if (accountId) {
      await tx.account.findFirstOrThrow({
        where: { id: accountId, userId },
      })
      const balanceChange = type === 'income' ? amount : -amount
      await tx.account.update({
        where: { id: accountId },
        data: { currentBalance: { increment: balanceChange } },
      })
    } else if (debtId) {
      await tx.debt.findFirstOrThrow({
        where: { id: debtId, userId, type: 'credit_card' },
      })
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

export async function createTransaction(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const parsed = transactionSchema.parse({
    accountId: (formData.get('accountId') as string) || null,
    debtId: (formData.get('debtId') as string) || null,
    amount: parseCurrencyInput(formData.get('amount')),
    type: formData.get('type'),
    categoryId: formData.get('categoryId'),
    subcategoryId: (formData.get('subcategoryId') as string) || null,
    description: formData.get('description'),
    date: new Date(formData.get('date') as string),
  })

  return createTransactionForUser(session.user.id, parsed)
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
      throw new Error(
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

    await tx.category.findFirstOrThrow({
      where: { id: merged.categoryId, userId },
    })

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
      await tx.account.findFirstOrThrow({
        where: { id: merged.accountId, userId },
      })
      const newChange =
        merged.type === 'income' ? merged.amount : -merged.amount
      await tx.account.update({
        where: { id: merged.accountId },
        data: { currentBalance: { increment: newChange } },
      })
    } else if (merged.debtId) {
      await tx.debt.findFirstOrThrow({
        where: { id: merged.debtId, userId, type: 'credit_card' },
      })
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

export async function updateTransaction(id: string, formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const patch = transactionSchema.parse({
    accountId: (formData.get('accountId') as string) || null,
    debtId: (formData.get('debtId') as string) || null,
    amount: parseCurrencyInput(formData.get('amount')),
    type: formData.get('type'),
    categoryId: formData.get('categoryId'),
    subcategoryId: (formData.get('subcategoryId') as string) || null,
    description: formData.get('description'),
    date: new Date(formData.get('date') as string),
  })

  return updateTransactionForUser(session.user.id, id, patch)
}

export async function deleteTransactionForUser(userId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirstOrThrow({
      where: { id, userId },
      include: { debtPayment: true },
    })
    if (existing.debtPayment) {
      throw new Error(
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

export async function deleteTransaction(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return deleteTransactionForUser(session.user.id, id)
}

export async function createTransferForUser(
  userId: string,
  input: TransferInput
) {
  const { fromAccountId, toAccountId, amount, date, note } = input

  const transfer = await prisma.$transaction(async (tx) => {
    const [fromAccount, toAccount] = await Promise.all([
      tx.account.findFirstOrThrow({
        where: { id: fromAccountId, userId },
      }),
      tx.account.findFirstOrThrow({
        where: { id: toAccountId, userId },
      }),
    ])
    if (fromAccount.userId !== userId || toAccount.userId !== userId) {
      throw new Error('Not authorized')
    }

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

export async function createTransfer(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const parsed = transferSchema.parse({
    fromAccountId: formData.get('fromAccountId'),
    toAccountId: formData.get('toAccountId'),
    amount: parseCurrencyInput(formData.get('amount')),
    date: new Date(formData.get('date') as string),
    note: formData.get('description'),
  })

  return createTransferForUser(session.user.id, parsed)
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

    await tx.account.findFirstOrThrow({
      where: { id: merged.fromAccountId, userId },
    })
    await tx.account.findFirstOrThrow({
      where: { id: merged.toAccountId, userId },
    })

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

export async function updateTransfer(id: string, formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const patch = transferSchema.parse({
    fromAccountId: formData.get('fromAccountId'),
    toAccountId: formData.get('toAccountId'),
    amount: parseCurrencyInput(formData.get('amount')),
    date: new Date(formData.get('date') as string),
    note: formData.get('description'),
  })

  return updateTransferForUser(session.user.id, id, patch)
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

export async function deleteTransfer(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return deleteTransferForUser(session.user.id, id)
}
