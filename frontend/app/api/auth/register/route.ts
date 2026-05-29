import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { searchParams } = new URL(req.url)
  const inviteCode = searchParams.get('invite_code') ?? ''

  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}/auth/register?invite_code=${encodeURIComponent(inviteCode)}`, {
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
    const detail = (data as { detail?: unknown } | null)?.detail
    let msg: string
    if (Array.isArray(detail)) {
      msg = (detail as Array<{ msg?: string }>).map(e => e.msg ?? '').filter(Boolean).join(', ') || 'Registration failed'
    } else if (typeof detail === 'string') {
      msg = detail
    } else {
      msg = text || 'Registration failed'
    }
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  return NextResponse.json(data, { status: 201 })
}
