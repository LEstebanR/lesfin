// Domain logic for this feature, parameterised by userId. Lives outside the
// 'use server' actions file on purpose: every export of a 'use server'
// module is a potential Server Action endpoint, and these functions trust
// the userId they receive. Callers (Server Actions, /api/v1, MCP) must pass
// the userId of an authenticated session.
import { BusinessRuleError } from '@/lib/errors'
import {
  FREE_LIMITS,
  getUserPlan,
  reconcileAccountLocks,
} from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import { finiteAmount, optionalString, requiredString } from '@/lib/validation'
import { z } from 'zod'

export const accountTypeSchema = z.enum(['cash', 'savings', 'caja'])

const createAccountSchema = z.object({
  accountName: requiredString,
  accountType: accountTypeSchema,
  initialBalance: finiteAmount,
  description: optionalString,
  color: optionalString,
  logoUrl: optionalString,
  icon: optionalString,
})

export const updateAccountSchema = z.object({
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
      throw new BusinessRuleError(
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
