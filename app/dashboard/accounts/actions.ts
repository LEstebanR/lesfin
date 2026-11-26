'use server'

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

export type CreateAccountInput = z.input<typeof createAccountSchema>

export async function createAccountForUser(
  userId: string,
  input: CreateAccountInput
) {
  const plan = await getUserPlan(userId)
  if (plan !== 'PRO') {
    const activeCount = await prisma.account.count({
      where: { userId, isArchived: false },
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
  } = createAccountSchema.parse(input)

  const account = await prisma.account.create({
    data: {
      userId,
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

export async function createAccount(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return createAccountForUser(session.user.id, {
    accountName: formData.get('accountName') as string,
    accountType: formData.get('accountType') as z.infer<
      typeof accountTypeSchema
    >,
    initialBalance: parseCurrencyInput(formData.get('initialBalance')),
    description: formData.get('description') as string | null,
    color: formData.get('color') as string | null,
    logoUrl: formData.get('logoUrl') as string | null,
    icon: formData.get('icon') as string | null,
  })
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

export type AccountPatch = Partial<z.input<typeof updateAccountSchema>>

// Partial update: any field left out of `patch` keeps its current value.
export async function updateAccountForUser(
  userId: string,
  id: string,
  patch: AccountPatch
) {
  const existing = await prisma.account.findFirstOrThrow({
    where: { id, userId },
  })

  const validated = updateAccountSchema.parse({
    name: patch.name ?? existing.name,
    type: patch.type ?? existing.type,
    description:
      'description' in patch ? patch.description : existing.description,
    color: 'color' in patch ? patch.color : existing.color,
    logoUrl: 'logoUrl' in patch ? patch.logoUrl : existing.logoUrl,
    icon: 'icon' in patch ? patch.icon : existing.icon,
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

  return updateAccountForUser(
    session.user.id,
    id,
    updateAccountSchema.parse(data)
  )
}
