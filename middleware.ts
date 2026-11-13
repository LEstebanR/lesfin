import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

function htmlLang(pathname: string) {
  return /^\/blog\/es(?:\/|$)/.test(pathname) ? 'es' : 'en'
}

function isDashboard(pathname: string) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = getSessionCookie(request)

  // Only the app is private. Unknown URLs must fall through so Next can
  // return a real 404, and metadata routes (robots, sitemap, manifest,
  // social images) must be served without a session.
  if (!sessionCookie && isDashboard(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (
    sessionCookie &&
    (pathname === '/' || pathname === '/login' || pathname === '/signup')
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-html-lang', htmlLang(pathname))

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt)$).*)',
  ],
}
