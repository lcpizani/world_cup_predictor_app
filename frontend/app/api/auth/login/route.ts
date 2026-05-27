import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080'

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

  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth_token', (data as { access_token: string }).access_token, {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
