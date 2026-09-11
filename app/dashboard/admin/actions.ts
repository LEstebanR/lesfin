'use server'

import { requireAdmin } from '@/lib/admin'
import { resolveEntitlementPlan } from '@/lib/billing-entitlements'
import { prisma } from '@/lib/prisma'

const PAGE_SIZE = 20

export async function getAdminStats() {
  await requireAdmin()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const now = new Date()
  const [totalUsers, proUsers, newUsers30d, totalAccounts, totalTransactions] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          OR: [
            { role: 'ADMIN' },
            {
              billingSubscription: {
                is: {
                  OR: [
                    { status: { in: ['active', 'trialing', 'past_due'] } },
                    { status: 'canceled', endsAt: { gt: now } },
                  ],
                },
              },
            },
          ],
        },
      }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.account.count(),
      prisma.transaction.count(),
    ])

  return {
    totalUsers,
    proUsers,
    freeUsers: totalUsers - proUsers,
    newUsers30d,
    totalAccounts,
    totalTransactions,
  }
}

export async function getAdminUsers(page: number, search: string) {
  await requireAdmin()

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { accounts: true } },
        billingSubscription: {
          select: { status: true, endsAt: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  return {
    users: users.map(({ billingSubscription, ...user }) => ({
      ...user,
      plan: resolveEntitlementPlan(user.role, billingSubscription),
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

export async function getAdminFeedback() {
  await requireAdmin()

  const feedback = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  })

  return feedback
}
