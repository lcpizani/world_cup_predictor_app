import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/tournaments', '/admin']

export function proxy(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value ?? req.cookies.get('is_authenticated')?.value
  const { pathname } = req.nextUrl

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !token) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/tournaments/:path*', '/admin/:path*'],
}
