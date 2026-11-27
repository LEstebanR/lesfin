import { auth } from '@/lib/auth'
import { BusinessRuleError } from '@/lib/errors'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

import type { ApiErrorBody, ApiErrorCode } from './contracts'

// Error status per code. Kept next to the mapper so the contract in
// docs/mobile-api.md and the HTTP behaviour can't drift apart silently.
const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNSUPPORTED_MEDIA_TYPE: 415,
  BUSINESS_RULE: 422,
  INTERNAL: 500,
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, string[]>
  ) {
    super(message)
  }
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, string[]>
) {
  const body: ApiErrorBody = {
    error: details ? { code, message, details } : { code, message },
  }
  return Response.json(body, { status: STATUS[code] })
}

function zodDetails(error: ZodError) {
  const details: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '(root)'
    ;(details[key] ??= []).push(issue.message)
  }
  return details
}

// Maps anything thrown by a handler (or the domain `*ForUser` functions it
// calls) to the public error contract. Only `BusinessRuleError` (plan
// limits, blocked "Deuda" category, debt-payment mirrors) carries a
// user-facing message; everything else — Prisma, driver, library errors,
// internal guards — is logged and replaced by a generic 500.
export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return errorResponse(error.code, error.message, error.details)
  }

  if (error instanceof ZodError) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid request.',
      zodDetails(error)
    )
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return errorResponse(
      'NOT_FOUND',
      'The requested record does not exist or is not yours.'
    )
  }

  if (error instanceof BusinessRuleError) {
    return errorResponse('BUSINESS_RULE', error.message)
  }

  console.error('[api] unhandled error', error)
  return errorResponse('INTERNAL', 'An unexpected error occurred.')
}

// Reads a JSON body. Requiring the JSON content type on mutations means a
// cross-site HTML form can't reach these endpoints with the session cookie
// (forms can only send urlencoded/multipart/text), on top of SameSite=Lax.
export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new ApiError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Content-Type must be application/json.'
    )
  }
  try {
    return await request.json()
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Request body is not valid JSON.')
  }
}

type RouteContext<P> = { params: Promise<P> }

type ApiHandler<P> = (args: {
  request: Request
  userId: string
  params: P
}) => Promise<Response | unknown>

export type SessionResolver = (headers: Headers) => Promise<string | null>

export const resolveSessionUserId: SessionResolver = async (headers) => {
  const session = await auth.api.getSession({ headers })
  return session?.user.id ?? null
}

// Wraps a Route Handler: resolves the better-auth session from the request's
// cookie (same session as the web app; the Expo client sends it explicitly),
// passes the session userId to the handler — never one from the request —
// and turns whatever the handler returns/throws into the API contract.
// A handler returning a Response is sent as-is; anything else becomes JSON.
export function withApiUser<P = Record<string, never>>(
  handler: ApiHandler<P>,
  resolveUserId: SessionResolver = resolveSessionUserId
) {
  return async (request: Request, context: RouteContext<P>) => {
    try {
      const userId = await resolveUserId(request.headers)
      if (!userId) {
        return errorResponse('UNAUTHENTICATED', 'Sign in to continue.')
      }
      const params = await context.params
      const result = await handler({ request, userId, params })
      if (result instanceof Response) return result
      return Response.json(result ?? null)
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}

export function noContent() {
  return new Response(null, { status: 204 })
}
