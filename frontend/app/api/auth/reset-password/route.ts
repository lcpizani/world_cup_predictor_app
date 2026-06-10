import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080'

export async function POST(req: NextRequest) {
  const body = await req.json()

  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return NextResponse.json({ error: 'Cannot reach backend server' }, { status: 503 })
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: res.status >= 400 ? res.status : 500 })
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: (data as { detail?: string }).detail ?? 'Request failed' },
      { status: res.status }
    )
  }

  return NextResponse.json(data)
}
