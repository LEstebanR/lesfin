'use server'

import {
  type AccountImpact,
  type AccountLifecycleError,
  getArchiveError,
  getDeleteError,
  getRestoreError,
} from '@/lib/account-lifecycle'
import { parseCurrencyInput } from '@/lib/currency'
import {
  FREE_LIMITS,
  getUserPlan,
  reconcileAccountLocks,
} from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import { finiteAmount, optionalString, requiredString } from '@/lib/validation'
import { put } from '@vercel/blob'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const MAX_ACCOUNT_LOGO_SIZE = 1024 * 1024

const accountTypeSchema = z.enum(['cash', 'savings', 'caja'])

const createAccountSchema = z.object({
  accountName: requiredString,
  accountType: accountTypeSchema,
  initialBalance: finiteAmount,
  description: optionalString,
  color: optionalString,
  logoUrl: optionalString,
  icon: optionalString,
})

const updateAccountSchema = z.object({
  name: requiredString,
  type: accountTypeSchema,
  description: z.string().nullable(),
  color: z.string().nullable(),
  logoUrl: z.string().nullable(),
  icon: z.string().nullable(),
})

export async function getAccountsForUser(userId: string) {
  const plan = await getUserPlan(userId)
  await reconcileAccountLocks(userId, plan)

  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return accounts.map((account) => ({
    ...account,
    initialBalance: Number(account.initialBalance),
    currentBalance: Number(account.currentBalance),
  }))
}

export async function getAccounts() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getAccountsForUser(session.user.id)
}

export async function createAccount(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const plan = await getUserPlan(session.user.id)
  if (plan !== 'PRO') {
    const activeCount = await prisma.account.count({
      where: { userId: session.user.id, isArchived: false },
    })
    if (activeCount >= FREE_LIMITS.accounts) {
      throw new Error(
        `Free plan is limited to ${FREE_LIMITS.accounts} accounts. Upgrade to Pro for unlimited accounts.`
      )
    }
  }

  const {
    accountName,
    accountType,
    initialBalance,
    description,
    color,
    logoUrl,
    icon,
  } = createAccountSchema.parse({
    accountName: formData.get('accountName'),
    accountType: formData.get('accountType'),
    initialBalance: parseCurrencyInput(formData.get('initialBalance')),
    description: formData.get('description'),
    color: formData.get('color'),
    logoUrl: formData.get('logoUrl'),
    icon: formData.get('icon'),
  })

  const account = await prisma.account.create({
    data: {
      userId: session.user.id,
      name: accountName,
      type: accountType,
      initialBalance,
      currentBalance: initialBalance,
      description,
      color,
      logoUrl,
      icon,
    },
  })

  return {
    ...account,
    initialBalance: Number(account.initialBalance),
    currentBalance: Number(account.currentBalance),
  }
}

// Uploaded logos are stored publicly and referenced directly by the account.
export async function uploadAccountLogo(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) throw new Error('No file provided')
  if (!file.type.startsWith('image/')) throw new Error('Invalid image file')
  if (file.size > MAX_ACCOUNT_LOGO_SIZE) throw new Error('Image is too large')

  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120)

  const blob = await put(`account-logos/${randomUUID()}-${filename}`, file, {
    access: 'public',
    addRandomSuffix: false,
  })

  return blob.url
}

export async function updateAccount(
  id: string,
  data: {
    name: string
    type: string
    description: string | null
    color: string | null
    logoUrl: string | null
    icon: string | null
  }
) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const validated = updateAccountSchema.parse(data)

  await prisma.account.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  const account = await prisma.account.update({
    where: { id },
    data: validated,
  })

  return {
    ...account,
    initialBalance: Number(account.initialBalance),
    currentBalance: Number(account.currentBalance),
  }
}

export type AccountActionResult =
  | { ok: true }
  | { ok: false; error: AccountLifecycleError }

// Errors are returned rather than thrown: Next.js masks thrown Server Action
// messages in production, and the UI needs the code to show the right copy.
async function getOwnedAccount(id: string, userId: string) {
  return prisma.account.findFirstOrThrow({
    where: { id, userId },
    select: { id: true, isArchived: true, currentBalance: true },
  })
}

async function loadAccountImpact(id: string): Promise<AccountImpact> {
  const [account, transactions, transfers, debtPayments, subscriptions] =
    await Promise.all([
      prisma.account.findUniqueOrThrow({
        where: { id },
        select: { currentBalance: true },
      }),
      prisma.transaction.count({ where: { accountId: id } }),
      prisma.transfer.count({
        where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
      }),
      prisma.debtPayment.count({ where: { accountId: id } }),
      prisma.subscription.count({ where: { accountId: id } }),
    ])

  return {
    balance: Number(account.currentBalance),
    transactions,
    transfers,
    debtPayments,
    subscriptions,
  }
}

export async function getAccountImpactForUser(userId: string, id: string) {
  await getOwnedAccount(id, userId)
  return loadAccountImpact(id)
}

export async function archiveAccountForUser(
  userId: string,
  id: string
): Promise<AccountActionResult> {
  const account = await getOwnedAccount(id, userId)
  const activeCount = await prisma.account.count({
    where: { userId, isArchived: false },
  })
  const error = getArchiveError({
    isArchived: account.isArchived,
    activeCount,
  })
  if (error) return { ok: false, error }

  await prisma.account.update({
    where: { id },
    data: { isArchived: true, lockedByPlan: false },
  })
  return { ok: true }
}

export async function restoreAccountForUser(
  userId: string,
  id: string
): Promise<AccountActionResult> {
  const account = await getOwnedAccount(id, userId)
  const [plan, activeCount] = await Promise.all([
    getUserPlan(userId),
    prisma.account.count({ where: { userId, isArchived: false } }),
  ])
  const error = getRestoreError({
    isArchived: account.isArchived,
    activeCount,
    limit: plan === 'PRO' ? null : FREE_LIMITS.accounts,
  })
  if (error) return { ok: false, error }

  await prisma.account.update({
    where: { id },
    data: { isArchived: false },
  })
  return { ok: true }
}

export async function deleteAccountForUser(
  userId: string,
  id: string
): Promise<AccountActionResult> {
  await getOwnedAccount(id, userId)

  // Re-check history inside the transaction so a movement created between
  // the confirmation dialog and this call can't be cascaded away.
  return prisma.$transaction(async (tx) => {
    const [transactions, transfers, debtPayments] = await Promise.all([
      tx.transaction.count({ where: { accountId: id } }),
      tx.transfer.count({
        where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
      }),
      tx.debtPayment.count({ where: { accountId: id } }),
    ])
    const error = getDeleteError({
      balance: 0,
      transactions,
      transfers,
      debtPayments,
      subscriptions: 0,
    })
    if (error) return { ok: false, error } as const

    await tx.account.delete({ where: { id } })
    return { ok: true } as const
  })
}

async function requireUserId() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')
  return session.user.id
}

export async function getAccountImpact(id: string) {
  return getAccountImpactForUser(await requireUserId(), id)
}

export async function archiveAccount(id: string) {
  return archiveAccountForUser(await requireUserId(), id)
}

export async function restoreAccount(id: string) {
  return restoreAccountForUser(await requireUserId(), id)
}

export async function deleteAccount(id: string) {
  return deleteAccountForUser(await requireUserId(), id)
}
