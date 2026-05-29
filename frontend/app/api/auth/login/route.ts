import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: email, password }),
    })
  } catch {
    return NextResponse.json({ error: 'Cannot reach backend server' }, { status: 503 })
  }

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json(
      { error: (data as { detail?: string }).detail ?? 'Login failed' },
      { status: res.status }
    )
  }

  const isProd = process.env.NODE_ENV === 'production'
  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth_token', (data as { access_token: string }).access_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  // Non-sensitive flag the client can read to drive UI state without exposing the JWT.
  response.cookies.set('is_authenticated', '1', {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return response
}
