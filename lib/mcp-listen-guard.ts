/**
 * The MCP SDK (2026-07-28 protocol) answers `subscriptions/listen` with an
 * SSE stream that stays open, sending a keep-alive every 15 s, until the
 * client disconnects. On Vercel that holds a function invocation until the
 * 300 s timeout, so every open Claude session burns ~5 min of compute in a
 * loop.
 *
 * The stream is also useless here: each invocation has its own in-memory
 * event bus and our tool list never changes at runtime, so no notification
 * would ever be delivered. We answer "method not found" right away instead,
 * so the client knows the server doesn't offer subscriptions.
 */
export const LISTEN_METHOD = 'subscriptions/listen'

type Handler = (req: Request) => Promise<Response>

function isJsonContentType(value: string | null) {
  return (value ?? '').toLowerCase().includes('application/json')
}

export function withoutListenStreams(handler: Handler): Handler {
  return async (req) => {
    if (
      req.method.toUpperCase() === 'POST' &&
      isJsonContentType(req.headers.get('content-type'))
    ) {
      const body: unknown = await req
        .clone()
        .json()
        .catch(() => undefined)

      if (
        typeof body === 'object' &&
        body !== null &&
        !Array.isArray(body) &&
        (body as { method?: unknown }).method === LISTEN_METHOD
      ) {
        const id = (body as { id?: unknown }).id
        return Response.json(
          {
            jsonrpc: '2.0',
            id: typeof id === 'string' || typeof id === 'number' ? id : null,
            error: {
              code: -32601,
              message: `Method not found: ${LISTEN_METHOD} is not supported by this server`,
            },
          },
          { status: 200 }
        )
      }
    }

    return handler(req)
  }
}
