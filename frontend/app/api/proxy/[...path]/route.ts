import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080'

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const url = new URL(`${BACKEND_URL}/${path.join('/')}`)
  url.search = req.nextUrl.search

  const headers = new Headers(req.headers)
  headers.delete('host')

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

  const resBody = await res.arrayBuffer()
  return new NextResponse(resBody, {
    status: res.status,
    headers: res.headers,
  })
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH }
