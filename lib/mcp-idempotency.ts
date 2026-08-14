import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: unknown
}

// Lets create_transaction/create_transfer/create_subscription be retried
// safely by an agent (e.g. after a network timeout) without creating a
// duplicate record: the same (userId, toolName, idempotencyKey) always
// returns the result of the first successful call. A race between two
// concurrent retries is resolved by the unique constraint on
// McpIdempotencyKey — the loser just re-reads what the winner stored.
export async function withIdempotency(
  userId: string,
  toolName: string,
  idempotencyKey: string | undefined,
  fn: () => Promise<ToolResult>
): Promise<ToolResult> {
  if (!idempotencyKey) return fn()

  const existing = await prisma.mcpIdempotencyKey.findUnique({
    where: {
      userId_toolName_idempotencyKey: { userId, toolName, idempotencyKey },
    },
  })
  if (existing) return existing.result as ToolResult

  const result = await fn()

  try {
    await prisma.mcpIdempotencyKey.create({
      data: {
        userId,
        toolName,
        idempotencyKey,
        result: result as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const stored = await prisma.mcpIdempotencyKey.findUnique({
        where: {
          userId_toolName_idempotencyKey: { userId, toolName, idempotencyKey },
        },
      })
      if (stored) return stored.result as ToolResult
    }
    throw error
  }

  return result
}
