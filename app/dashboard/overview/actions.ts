'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'

export async function getOverviewDataForUser(userId: string) {
  const [accounts, transactions, transfers, debts] = await Promise.all([
    prisma.account.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true, account: true, debt: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.transfer.findMany({
      where: { userId },
      include: {
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.debt.findMany({
      where: { userId },
    }),
  ])

  return {
    accounts: accounts.map((account) => ({
      ...account,
      initialBalance: Number(account.initialBalance),
      currentBalance: Number(account.currentBalance),
    })),
    transactions: transactions.map(
      ({ category, account, debt, ...transaction }) => ({
        ...transaction,
        amount: Number(transaction.amount),
        categoryName: category.name,
        sourceName: account?.name ?? debt?.name ?? null,
      })
    ),
    // Names come from the relation so transfers involving an archived
    // account (excluded from `accounts` above) still show both ends.
    transfers: transfers.map(({ fromAccount, toAccount, ...transfer }) => ({
      ...transfer,
      amount: Number(transfer.amount),
      fromAccountName: fromAccount.name,
      toAccountName: toAccount.name,
    })),
    totalDebt: debts.reduce(
      (total, debt) => total + Number(debt.remainingBalance),
      0
    ),
    totalMinimumPayment: debts
      .filter((debt) => Number(debt.remainingBalance) > 0)
      .reduce((total, debt) => total + Number(debt.minimumPayment ?? 0), 0),
  }
}

export async function getOverviewData() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getOverviewDataForUser(session.user.id)
}
