'use server'

import {
  createTransactionForUser,
  createTransferForUser,
  deleteTransactionForUser,
  deleteTransferForUser,
  getTransactionsForUser,
  getTransfersForUser,
  updateTransactionForUser,
  updateTransferForUser,
} from '@/app/dashboard/transactions/domain'
import {
  transactionSchema,
  transferSchema,
} from '@/app/dashboard/transactions/schemas'
import { parseCurrencyInput } from '@/lib/currency'
import { getServerSession } from '@/lib/session'

export async function getTransactions() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getTransactionsForUser(session.user.id)
}

export async function getTransfers() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getTransfersForUser(session.user.id)
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

export async function deleteTransaction(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return deleteTransactionForUser(session.user.id, id)
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

export async function deleteTransfer(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return deleteTransferForUser(session.user.id, id)
}
