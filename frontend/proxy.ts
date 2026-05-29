import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/tournaments',
  '/leagues',
  '/predictions',
  '/profile',
  '/onboarding',
  '/admin',
]

export function proxy(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value ?? req.cookies.get('is_authenticated')?.value
  const { pathname } = req.nextUrl

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !token) {
    return NextResponse.redirect(new URL('/', req.url))
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
  ],
}
