import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080'

export async function POST(req: NextRequest) {
  const body = await req.json()

  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return NextResponse.json({ error: 'Cannot reach backend server' }, { status: 503 })
  }

  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = null }

  if (!res.ok) {
    const msg = (data as { detail?: string } | null)?.detail ?? text ?? 'Registration failed'
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  return NextResponse.json(data, { status: 201 })
}
