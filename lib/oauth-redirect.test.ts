import { describe, expect, it } from 'bun:test'

import { isValidRedirectUri } from './oauth-redirect'

describe('isValidRedirectUri', () => {
  it('accepts https redirect URIs', () => {
    expect(isValidRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(
      true
    )
    expect(
      isValidRedirectUri(
        'https://chatgpt.com/connector_platform_oauth_redirect'
      )
    ).toBe(true)
  })

  it('accepts http loopback redirect URIs used by desktop MCP clients', () => {
    expect(isValidRedirectUri('http://127.0.0.1:28417/mcp-auth')).toBe(true)
    expect(isValidRedirectUri('http://localhost:3000/callback')).toBe(true)
    expect(isValidRedirectUri('http://[::1]:8080/callback')).toBe(true)
  })

  it('rejects http on non-loopback hosts', () => {
    expect(isValidRedirectUri('http://evil.com/callback')).toBe(false)
    expect(isValidRedirectUri('http://127.0.0.1.evil.com/callback')).toBe(false)
    expect(isValidRedirectUri('http://localhost.evil.com/callback')).toBe(false)
    expect(isValidRedirectUri('http://127.0.0.1@evil.com/callback')).toBe(false)
  })

  it('rejects other schemes and non-URLs', () => {
    expect(isValidRedirectUri('javascript:alert(1)')).toBe(false)
    expect(isValidRedirectUri('ftp://127.0.0.1/callback')).toBe(false)
    expect(isValidRedirectUri('not a url')).toBe(false)
    expect(isValidRedirectUri(42)).toBe(false)
    expect(isValidRedirectUri(undefined)).toBe(false)
  })
})
