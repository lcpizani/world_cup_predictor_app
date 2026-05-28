'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { api } from '@/lib/api'

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'text-white bg-white/10'
          : 'text-[#6b7f96] hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      {children}
      {active && (
        <span
          className="absolute -bottom-px left-1/2 -translate-x-1/2 h-px bg-[#f0b429] rounded-full"
          style={{ width: '55%' }}
        />
      )}
    </Link>
  )
}

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const qc = useQueryClient()

  const [hasToken, setHasToken] = useState(false)
  useEffect(() => {
    setHasToken(!!Cookies.get('auth_token'))
  }, [])

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

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <nav className="glass sticky top-0 z-50 border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-[60px]">

        {/* Logo */}
        <Link
          href={hasToken ? '/dashboard' : '/'}
          className="group flex items-center gap-2.5"
        >
          <div className="font-[family-name:var(--font-oswald)] font-bold text-[1.15rem] tracking-widest uppercase leading-none">
            <span className="text-[#f0b429]">WC</span>
            <span className="text-white">26</span>
          </div>
          <span className="h-4 w-px bg-white/15" />
          <span className="text-[0.7rem] font-semibold text-[#4a5c70] group-hover:text-[#8496b0] transition-colors uppercase tracking-[0.22em]">
            Predictor
          </span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <NavLink href="/dashboard" active={isActive('/dashboard')}>Dashboard</NavLink>
              <NavLink href="/leagues" active={isActive('/leagues')}>Leagues</NavLink>
              <NavLink href="/predictions" active={isActive('/predictions')}>My Picks</NavLink>
              {user.is_admin && (
                <NavLink href="/admin" active={isActive('/admin')}>Admin</NavLink>
              )}
              <span className="h-4 w-px bg-white/[0.08] mx-1.5" />
              <Link
                href="/profile"
                className="text-[#3f5068] hover:text-white transition-colors text-sm px-2 py-1.5 font-medium rounded-lg hover:bg-white/[0.06]"
              >
                {user.display_name ?? user.username}
              </Link>
              <button
                onClick={logout}
                className="text-[#3f5068] hover:text-red-400/80 transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-red-500/[0.07] cursor-pointer"
              >
                Logout
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="text-[#6b7f96] hover:text-white transition-colors font-medium px-4 py-1.5 rounded-lg hover:bg-white/[0.06] text-sm"
              >
                Log in
              </Link>
              <Link
                href="/auth/register"
                className="bg-[#f0b429] text-[#080c14] px-5 py-1.5 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-[#fcd86e] transition-all duration-200"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
