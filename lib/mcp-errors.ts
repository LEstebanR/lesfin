import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

export type StructuredToolError = {
  code: string
  message: string
  retryable: boolean
}

function formatZodError(error: ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
}

// Turns any exception thrown inside a tool handler into a structured,
// actionable error instead of the raw `UNKNOWN` an agent gets from an
// unhandled/unformatted failure. Always logs the original error server-side
// (with stack trace) before returning the sanitized version to the client.
export function structureToolError(
  toolName: string,
  error: unknown
): StructuredToolError {
  console.error(`[mcp:${toolName}] tool call failed`, error)

  if (error instanceof ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      message: formatZodError(error),
      retryable: false,
    }
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return {
      code: 'NOT_FOUND',
      message: 'The requested record does not exist or is not yours.',
      retryable: false,
    }
  }

  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred.'

  return {
    code: `${toolName.toUpperCase()}_FAILED`,
    message,
    retryable: true,
  }
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: unknown
  isError?: boolean
}

// Wraps every registerTool handler so a thrown exception (including one
// coming out of a Promise.all in the domain layer) always turns into a
// well-formed { code, message, retryable } tool error result instead of
// propagating unformatted.
export function withToolHandler<Args extends unknown[]>(
  toolName: string,
  fn: (...args: Args) => Promise<ToolResult>
) {
  return async (...args: Args): Promise<ToolResult> => {
    try {
      return await fn(...args)
    } catch (error) {
      const structured = structureToolError(toolName, error)
      return {
        content: [{ type: 'text', text: JSON.stringify(structured) }],
        structuredContent: structured,
        isError: true,
      }
    }
  }
}
