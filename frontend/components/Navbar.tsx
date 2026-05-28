'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { api } from '@/lib/api'

export function Navbar() {
  const router = useRouter()
  const qc = useQueryClient()

  const hasToken = typeof window !== 'undefined' && !!Cookies.get('auth_token')

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    enabled: hasToken,
    retry: false,
  })

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    Cookies.remove('auth_token')
    qc.clear()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-[#0a0f1a] border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link
          href={hasToken ? '/dashboard' : '/'}
          className="font-[family-name:var(--font-oswald)] font-bold text-xl uppercase tracking-wider text-white hover:text-[#f0b429] transition-colors"
        >
          ⚽ WC Predictor
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-6 text-sm">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-[#94a3b8] hover:text-white transition-colors font-medium"
              >
                Dashboard
              </Link>
              {user.is_admin && (
                <Link
                  href="/admin"
                  className="text-[#94a3b8] hover:text-[#f0b429] transition-colors font-medium"
                >
                  Admin
                </Link>
              )}
              <span className="text-white/10">|</span>
              <span className="text-[#64748b] text-sm">{user.username}</span>
              <button
                onClick={logout}
                className="text-[#94a3b8] hover:text-red-400 transition-colors text-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-[#94a3b8] hover:text-white transition-colors font-medium"
              >
                Log in
              </Link>
              <Link
                href="/auth/register"
                className="bg-[#f0b429] text-[#080c14] px-4 py-1.5 rounded-lg font-bold text-sm uppercase tracking-wide hover:bg-white transition-all"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
