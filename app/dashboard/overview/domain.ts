// Domain logic for this feature, parameterised by userId. Lives outside the
// 'use server' actions file on purpose: every export of a 'use server'
// module is a potential Server Action endpoint, and these functions trust
// the userId they receive. Callers (Server Actions, /api/v1, MCP) must pass
// the userId of an authenticated session.
import { prisma } from '@/lib/prisma'

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
    transfers: transfers.map((transfer) => ({
      ...transfer,
      amount: Number(transfer.amount),
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
