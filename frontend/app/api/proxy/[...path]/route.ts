import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080'

// Headers we must NOT forward to the backend (managed by fetch / per-hop).
const REQUEST_HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
])

// Headers we must NOT forward back from the backend to the browser.
const RESPONSE_HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
  'server',
])

async function proxy(req: NextRequest) {
  const backendPath = req.nextUrl.pathname.replace('/api/proxy', '')
  const url = new URL(`${BACKEND_URL}${backendPath}`)
  url.search = req.nextUrl.search

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    if (!REQUEST_HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value)
  })
  // Don't leak the auth cookie to the backend — we forward it as a Bearer header instead.
  headers.delete('cookie')

  const token = req.cookies.get('auth_token')?.value
  if (token) headers.set('authorization', `Bearer ${token}`)

  let body: BodyInit | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.arrayBuffer()
  }

  let res: Response
  try {
    res = await fetch(url.toString(), {
      method: req.method,
      headers,
      body,
    })
  } catch {
    return NextResponse.json({ error: 'Cannot reach backend server' }, { status: 503 })
  }

  const resBody = res.status === 204 ? null : await res.arrayBuffer()
  const outHeaders = new Headers()
  res.headers.forEach((value, key) => {
    if (!RESPONSE_HOP_BY_HOP.has(key.toLowerCase())) outHeaders.set(key, value)
  })
  return new NextResponse(resBody, {
    status: res.status,
    headers: outHeaders,
  })
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH }
