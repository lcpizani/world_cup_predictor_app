'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { setLocaleCookie, type SupportedLocale } from '@/lib/locale'

function safeNext(next: string | null): string {
  if (!next) return '/dashboard'
  if (next.startsWith('//') || next.includes('://')) return '/dashboard'
  return next
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: '#5a6a82' }}>
      {children}
    </label>
  )
}

function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl px-4 py-3 text-white text-sm transition-all"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.09)',
        outline: 'none',
        ...(props.style ?? {}),
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)'
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(240,180,41,0.08)'
        props.onFocus?.(e)
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'
        e.currentTarget.style.boxShadow = 'none'
        props.onBlur?.(e)
      }}
    />
  )
}

function LoginForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  // If next points at a join link, that page handles unauthenticated users with a proper invite landing
  const registerHref = next !== '/dashboard' ? `/auth/register?next=${encodeURIComponent(next)}` : '/auth/register'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.getMe().then(() => router.replace(next)).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    let data: { error?: string } = {}
    try {
      data = await res.json()
    } catch {
      setLoading(false)
      setError(t('login_failed'))
      return
    }
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? t('login_failed'))
      return
    }
    const me = await api.getMe().catch(() => null)
    if (me?.language) setLocaleCookie(me.language as SupportedLocale)
    router.push(next)
    router.refresh()
  }

  return (
    <div className="relative flex items-center justify-center min-h-[88vh] px-4 overflow-hidden">
      {/* Atmospheric background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(240,180,41,0.07) 0%, transparent 65%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 mb-5">
            <span className="font-[family-name:var(--font-oswald)] font-bold text-lg tracking-widest uppercase">
              <span className="text-[#f0b429]">WC</span>
              <span className="text-white">26</span>
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-oswald)] text-[2rem] font-bold uppercase tracking-wider text-white leading-none">
            {t('login_title')}
          </h1>
          <p className="text-[#3f5068] text-sm mt-2 font-medium">{t('login_subtitle')}</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7"
          style={{
            background: '#0d1520',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}
        >
          {/* Gold top accent */}
          <div className="h-px w-full mb-6 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(240,180,41,0.6), transparent)' }} />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <FieldLabel>{t('email')}</FieldLabel>
              <AuthInput
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={t('email_placeholder')}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel>{t('password')}</FieldLabel>
                <Link href="/auth/forgot-password" className="text-[0.65rem] font-medium transition-colors" style={{ color: '#5a6a82' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f0b429')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#5a6a82')}
                >
                  {t('forgot_password_link')}
                </Link>
              </div>
              <AuthInput
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder={t('password_placeholder')}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 rounded-xl px-4 py-2.5" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200 disabled:opacity-50 mt-1"
              style={{ background: '#f0b429', color: '#080c14' }}
              onMouseEnter={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#fcd86e')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#f0b429')}
            >
              {loading ? t('login_button_loading') : t('login_button')}
            </button>
          </form>
        </div>

        <p className="text-sm text-center mt-6" style={{ color: '#3f5068' }}>
          {t('no_account')}{' '}
          <Link
            href={registerHref}
            className="text-[#f0b429] hover:text-white transition-colors font-medium"
          >
            {t('register_free')}
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
