import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)

  if (
    !sessionCookie &&
    request.nextUrl.pathname !== '/' &&
    request.nextUrl.pathname !== '/pricing' &&
    !request.nextUrl.pathname.startsWith('/blog') &&
    request.nextUrl.pathname !== '/login' &&
    request.nextUrl.pathname !== '/signup' &&
    !request.nextUrl.pathname.startsWith('/api/auth') &&
    !request.nextUrl.pathname.startsWith('/api/mcp') &&
    !request.nextUrl.pathname.startsWith('/oauth') &&
    !request.nextUrl.pathname.startsWith(
      '/.well-known/oauth-authorization-server'
    ) &&
    !request.nextUrl.pathname.startsWith(
      '/.well-known/oauth-protected-resource'
    )
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (
    sessionCookie &&
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup')
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
