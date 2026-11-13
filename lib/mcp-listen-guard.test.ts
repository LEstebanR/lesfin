import { describe, expect, it } from 'bun:test'

import { LISTEN_METHOD, withoutListenStreams } from './mcp-listen-guard'

function post(body: unknown) {
  return new Request('https://www.lesfin.app/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('withoutListenStreams', () => {
  it('answers subscriptions/listen immediately without calling the handler', async () => {
    let called = false
    const guarded = withoutListenStreams(async () => {
      called = true
      return new Response('should not run')
    })

    const res = await guarded(
      post({
        jsonrpc: '2.0',
        id: 7,
        method: LISTEN_METHOD,
        params: { notifications: { toolsListChanged: true } },
      })
    )

    expect(called).toBe(false)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 7,
      error: { code: -32601 },
    })
  })

  it('passes other requests through with the body intact', async () => {
    const guarded = withoutListenStreams(async (req) =>
      Response.json(await req.json())
    )
    const body = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} }

    const res = await guarded(post(body))

    expect(await res.json()).toEqual(body)
  })

  it('passes GET and non-JSON requests through', async () => {
    const guarded = withoutListenStreams(
      async () => new Response(null, { status: 405 })
    )

    const get = await guarded(
      new Request('https://www.lesfin.app/api/mcp', { method: 'GET' })
    )
    const text = await guarded(
      new Request('https://www.lesfin.app/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'hi',
      })
    )

    expect(get.status).toBe(405)
    expect(text.status).toBe(405)
  })
})
