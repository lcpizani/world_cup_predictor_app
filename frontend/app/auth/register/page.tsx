'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    const regRes = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: fd.get('email'),
        username: fd.get('username'),
        password: fd.get('password'),
      }),
    })
    const regData = await regRes.json()

    if (!regRes.ok) {
      setError((regData as { error?: string }).error ?? 'Registration failed')
      setLoading(false)
      return
    }

    // Auto-login
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    })

    setLoading(false)
    if (loginRes.ok) {
      router.push('/dashboard')
      router.refresh()
    } else {
      router.push('/auth/login')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[88vh] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🏆</span>
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white mt-3">
            Join the League
          </h1>
          <p className="text-[#64748b] text-sm mt-1">Create your free account</p>
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
                placeholder="you@example.com"
                className="w-full bg-[#080c14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-2">
                Username
              </label>
              <input
                name="username"
                type="text"
                required
                autoComplete="username"
                placeholder="ronaldo10"
                className="w-full bg-[#080c14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
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
                minLength={6}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full bg-[#080c14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
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
              {loading ? 'Creating account…' : '⚡ Create Account'}
            </button>
          </form>
        </div>

        <p className="text-sm text-center text-[#64748b] mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#f0b429] hover:text-white transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
