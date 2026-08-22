'use server'

import { syncDefaultCategoriesForUser } from '@/app/dashboard/categories/actions'
import { getUserPlan } from '@/lib/plan-limits'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import { requiredString } from '@/lib/validation'
import { z } from 'zod'

const updateProfileSchema = z.object({
  name: requiredString,
  currency: z.enum(['usd', 'eur', 'gbp', 'cad', 'cop']),
  timezone: requiredString,
  budgetPeriod: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
})

const languageSchema = z.enum(['en', 'es'])

export async function getProfile() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const [user, totalTransactions, totalAccounts, plan] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.transaction.count({ where: { userId: session.user.id } }),
    prisma.account.count({ where: { userId: session.user.id } }),
    getUserPlan(session.user.id),
  ])

  return {
    name: user.name,
    email: user.email,
    image: user.image,
    currency: user.currency,
    timezone: user.timezone,
    budgetPeriod: user.budgetPeriod,
    // Effective plan — admins always resolve to PRO here (see getUserPlan).
    plan,
    role: user.role,
    memberSince: user.createdAt,
    totalTransactions,
    totalAccounts,
  }
}

export async function updateProfile(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const data = updateProfileSchema.parse({
    name: formData.get('name'),
    currency: formData.get('currency'),
    timezone: formData.get('timezone'),
    budgetPeriod: formData.get('budgetPeriod'),
  })

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
  })

  return { name: user.name }
}

export async function updateLanguage(language: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const parsed = languageSchema.parse(language)

  await syncDefaultCategoriesForUser(session.user.id, parsed)

  await prisma.user.update({
    where: { id: session.user.id },
    data: { language: parsed },
  })
}
