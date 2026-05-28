'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function safeNext(next: string | null): string {
  if (!next) return '/dashboard'
  if (next.startsWith('//') || next.includes('://')) return '/dashboard'
  return next
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError((data as { error?: string }).error ?? 'Login failed')
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <div className="flex items-center justify-center min-h-[88vh] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">⚽</span>
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white mt-3">
            Welcome Back
          </h1>
          <p className="text-[#64748b] text-sm mt-1">Log in to your league</p>
        </div>

        <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-2">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full bg-[#080c14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-2">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full bg-[#080c14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#f0b429] text-[#080c14] py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white disabled:opacity-50 transition-all mt-2"
            >
              {loading ? 'Logging in…' : 'Log In'}
            </button>
          </form>
        </div>

        <p className="text-sm text-center text-[#64748b] mt-6">
          No account?{' '}
          <Link
            href={next !== '/dashboard' ? `/auth/register?next=${encodeURIComponent(next)}` : '/auth/register'}
            className="text-[#f0b429] hover:text-white transition-colors"
          >
            Register free
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
