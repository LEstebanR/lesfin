'use server'

import { generateMcpToken, hashMcpToken } from '@/lib/mcp-auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import { requiredString } from '@/lib/validation'
import { z } from 'zod'

const MAX_ACTIVE_KEYS = 10

const createKeySchema = z.object({
  name: requiredString.max(60),
})

export async function getMcpApiKeys() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const keys = await prisma.mcpApiKey.findMany({
    where: { userId: session.user.id, revokedAt: null },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return { keys, maxKeys: MAX_ACTIVE_KEYS }
}

export async function createMcpApiKey(name: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const { name: parsedName } = createKeySchema.parse({ name })

  const activeKeys = await prisma.mcpApiKey.count({
    where: { userId: session.user.id, revokedAt: null },
  })
  if (activeKeys >= MAX_ACTIVE_KEYS) throw new Error('MAX_KEYS_REACHED')

  const token = generateMcpToken()

  const key = await prisma.mcpApiKey.create({
    data: {
      userId: session.user.id,
      name: parsedName,
      keyHash: hashMcpToken(token),
    },
    select: { id: true, name: true, createdAt: true },
  })

  return { ...key, token }
}

export async function revokeMcpApiKey(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const key = await prisma.mcpApiKey.findFirst({
    where: { id, userId: session.user.id, revokedAt: null },
    select: { id: true },
  })
  if (!key) throw new Error('KEY_NOT_FOUND')

  await prisma.mcpApiKey.update({
    where: { id: key.id },
    data: { revokedAt: new Date() },
  })

  return { id: key.id }
}
