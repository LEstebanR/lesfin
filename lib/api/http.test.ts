import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'bun:test'
import { z } from 'zod'

import { BusinessRuleError } from '../errors'
import { ApiError, readJson, toErrorResponse, withApiUser } from './http'

const signedIn = async () => 'user-1'
const signedOut = async () => null
// What Next passes to a route without dynamic segments.
const noParams = { params: Promise.resolve({}) }

function jsonRequest(body: unknown, contentType = 'application/json') {
  return new Request('http://localhost/api/v1/x', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('withApiUser', () => {
  it('returns 401 without a session and never runs the handler', async () => {
    let ran = false
    const handler = withApiUser(async () => {
      ran = true
      return {}
    }, signedOut)

    const res = await handler(
      new Request('http://localhost/api/v1/x'),
      noParams
    )

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' },
    })
    expect(ran).toBe(false)
  })

  it('passes the session userId and serializes the result as JSON', async () => {
    const handler = withApiUser(
      async ({ userId }) => ({ userId, at: new Date('2026-01-02T00:00:00Z') }),
      signedIn
    )

    const res = await handler(
      new Request('http://localhost/api/v1/x'),
      noParams
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      userId: 'user-1',
      at: '2026-01-02T00:00:00.000Z',
    })
  })

  it('resolves dynamic route params', async () => {
    const handler = withApiUser<{ id: string }>(
      async ({ params }) => ({ id: params.id }),
      signedIn
    )

    const res = await handler(new Request('http://localhost/api/v1/x/abc'), {
      params: Promise.resolve({ id: 'abc' }),
    })

    expect(await res.json()).toEqual({ id: 'abc' })
  })

  it('returns a handler Response untouched', async () => {
    const handler = withApiUser(
      async () => new Response(null, { status: 204 }),
      signedIn
    )

    const res = await handler(
      new Request('http://localhost/api/v1/x'),
      noParams
    )

    expect(res.status).toBe(204)
  })
})

describe('toErrorResponse', () => {
  it('maps Zod errors to 400 with per-field details', async () => {
    const result = z
      .object({ amount: z.number().positive(), date: z.string() })
      .safeParse({ amount: -1 })
    const res = toErrorResponse(result.error)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(Object.keys(body.error.details).sort()).toEqual(['amount', 'date'])
  })

  it('maps a missing/foreign record (P2025) to 404', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('No record', {
      code: 'P2025',
      clientVersion: 'test',
    })
    const res = toErrorResponse(error)

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NOT_FOUND')
  })

  it('passes domain rule messages through as 422', async () => {
    const res = toErrorResponse(
      new BusinessRuleError('Free plan is limited to 3 accounts.')
    )

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: {
        code: 'BUSINESS_RULE',
        message: 'Free plan is limited to 3 accounts.',
      },
    })
  })

  it('hides Prisma, library and runtime errors behind a generic 500', async () => {
    const original = console.error
    console.error = () => {}
    try {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on secret_column',
        { code: 'P2002', clientVersion: 'test' }
      )
      for (const error of [
        prismaError,
        new TypeError('x is undefined'),
        // A plain Error from a library/driver is not a business rule.
        new Error('connection terminated unexpectedly'),
      ]) {
        const res = toErrorResponse(error)
        expect(res.status).toBe(500)
        expect(await res.json()).toEqual({
          error: { code: 'INTERNAL', message: 'An unexpected error occurred.' },
        })
      }
    } finally {
      console.error = original
    }
  })

  it('keeps an explicit ApiError code', async () => {
    const res = toErrorResponse(new ApiError('NOT_FOUND', 'Nope'))

    expect(res.status).toBe(404)
  })
})

describe('readJson', () => {
  it('rejects non-JSON content types with 415', async () => {
    const error = await readJson(
      jsonRequest('a=1', 'application/x-www-form-urlencoded')
    ).catch((e) => e)

    expect(toErrorResponse(error).status).toBe(415)
  })

  it('rejects malformed JSON with 400', async () => {
    const error = await readJson(jsonRequest('{oops')).catch((e) => e)

    expect(toErrorResponse(error).status).toBe(400)
  })

  it('parses a JSON body', async () => {
    expect(
      await readJson(jsonRequest({ a: 1 }, 'application/json; charset=utf-8'))
    ).toEqual({ a: 1 })
  })
})
