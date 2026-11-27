// Account lifecycle (archive / restore / delete) for a given user.
//
// Deliberately NOT a 'use server' module: these take the userId from the
// caller, so exporting them from a Server Actions file would expose them as
// endpoints a client could call with someone else's userId. Callers (Server
// Actions, the mobile API) resolve the user from the session/token first.
import {
  type AccountImpact,
  type AccountLifecycleError,
  getArchiveError,
  getDeleteError,
  getRestoreError,
} from '@/lib/account-lifecycle'
import { FREE_LIMITS, getUserPlan } from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import { type Prisma } from '@prisma/client'

export type AccountActionResult =
  | { ok: true }
  | { ok: false; error: AccountLifecycleError }

export const ARCHIVED_ACCOUNT_MESSAGE =
  'This account is archived. Restore it or pick another account.'

// Looks up an account the user owns that money can move in or out of.
// Archived accounts are rejected unless listed in `allowArchivedIds` — used
// when editing an existing movement so it can keep pointing at the archived
// account it already belongs to.
export async function findWritableAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
  allowArchivedIds: (string | null | undefined)[] = []
) {
  const account = await tx.account.findFirstOrThrow({
    where: { id, userId },
  })
  if (account.isArchived && !allowArchivedIds.includes(id)) {
    throw new Error(ARCHIVED_ACCOUNT_MESSAGE)
  }
  return account
}

// Serializes lifecycle changes per user: locks every account row of the user
// for the rest of the transaction, so concurrent archive/restore/delete calls
// see each other's effects, and a concurrent movement (which updates the
// account balance row) can't slip in between the history check and a delete.
async function lockUserAccounts(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "Account" WHERE "userId" = ${userId} FOR UPDATE`
}

function getOwnedAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string
) {
  return tx.account.findFirstOrThrow({
    where: { id, userId },
    select: { id: true, isArchived: true, currentBalance: true },
  })
}

function countActiveAccounts(tx: Prisma.TransactionClient, userId: string) {
  return tx.account.count({ where: { userId, isArchived: false } })
}

async function loadAccountImpact(
  tx: Prisma.TransactionClient,
  id: string,
  balance: number
): Promise<AccountImpact> {
  const [transactions, transfers, debtPayments, subscriptions] =
    await Promise.all([
      tx.transaction.count({ where: { accountId: id } }),
      tx.transfer.count({
        where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
      }),
      tx.debtPayment.count({ where: { accountId: id } }),
      tx.subscription.count({ where: { accountId: id } }),
    ])
  return { balance, transactions, transfers, debtPayments, subscriptions }
}

export async function getAccountImpactForUser(userId: string, id: string) {
  const account = await getOwnedAccount(prisma, userId, id)
  return loadAccountImpact(prisma, id, Number(account.currentBalance))
}

export async function archiveAccountForUser(
  userId: string,
  id: string
): Promise<AccountActionResult> {
  return prisma.$transaction(async (tx) => {
    await lockUserAccounts(tx, userId)
    const account = await getOwnedAccount(tx, userId, id)
    const error = getArchiveError({
      isArchived: account.isArchived,
      activeCount: await countActiveAccounts(tx, userId),
    })
    if (error) return { ok: false, error } as const

    await tx.account.update({
      where: { id },
      data: { isArchived: true, lockedByPlan: false },
    })
    return { ok: true } as const
  })
}

export async function restoreAccountForUser(
  userId: string,
  id: string
): Promise<AccountActionResult> {
  const plan = await getUserPlan(userId)
  return prisma.$transaction(async (tx) => {
    await lockUserAccounts(tx, userId)
    const account = await getOwnedAccount(tx, userId, id)
    const error = getRestoreError({
      isArchived: account.isArchived,
      activeCount: await countActiveAccounts(tx, userId),
      limit: plan === 'PRO' ? null : FREE_LIMITS.accounts,
    })
    if (error) return { ok: false, error } as const

    await tx.account.update({
      where: { id },
      data: { isArchived: false },
    })
    return { ok: true } as const
  })
}

export async function deleteAccountForUser(
  userId: string,
  id: string
): Promise<AccountActionResult> {
  return prisma.$transaction(async (tx) => {
    await lockUserAccounts(tx, userId)
    const account = await getOwnedAccount(tx, userId, id)

    // Deleting an active account removes it from the active set just like
    // archiving does, so the same "keep one active account" rule applies.
    if (!account.isArchived) {
      const archiveError = getArchiveError({
        isArchived: false,
        activeCount: await countActiveAccounts(tx, userId),
      })
      if (archiveError) return { ok: false, error: archiveError } as const
    }

    const impact = await loadAccountImpact(
      tx,
      id,
      Number(account.currentBalance)
    )
    const error = getDeleteError(impact)
    if (error) return { ok: false, error } as const

    await tx.account.delete({ where: { id } })
    return { ok: true } as const
  })
}
