import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/tournaments',
  '/leagues',
  '/predictions',
  '/profile',
  '/onboarding',
  '/admin',
  '/standings',
]

export function proxy(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value
  const { pathname } = req.nextUrl

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !token) {
    const url = new URL('/', req.url)
    url.searchParams.set('auth_required', '1')
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tournaments/:path*',
    '/leagues/:path*',
    '/predictions/:path*',
    '/profile/:path*',
    '/onboarding/:path*',
    '/admin/:path*',
    '/standings/:path*',
  ],
}
