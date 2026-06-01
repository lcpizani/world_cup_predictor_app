'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Cookies from 'js-cookie'
import { useTranslations } from 'next-intl'
import { decodeInviteCode } from '@/lib/invite'

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

function InviteWall() {
  const t = useTranslations('auth')
  return (
    <div className="relative flex items-center justify-center min-h-[88vh] px-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(240,180,41,0.07) 0%, transparent 65%)',
        }}
      />
      <div className="relative z-10 w-full max-w-sm text-center animate-fade-up">
        <div className="inline-flex items-center gap-1.5 mb-6">
          <span className="font-[family-name:var(--font-oswald)] font-bold text-lg tracking-widest uppercase">
            <span className="text-[#f0b429]">WC</span>
            <span className="text-white">26</span>
          </span>
        </div>
        <div
          className="rounded-2xl p-8"
          style={{
            background: '#0d1520',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}
        >
          <div className="h-px w-full mb-6 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(240,180,41,0.6), transparent)' }} />
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white mb-2">
            {t('invite_only_title')}
          </h1>
          <p className="text-sm mb-6" style={{ color: '#5a6a82' }}>
            {t('invite_only_desc')}
          </p>
          <Link
            href="/auth/login"
            className="inline-block py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200"
            style={{ background: '#f0b429', color: '#080c14' }}
          >
            {t('log_in_instead')}
          </Link>
        </div>
      </div>
    </div>
  )
}

interface PlatformInviteLandingProps {
  loginHref: string
  onCreateAccount: () => void
}

function PlatformInviteLanding({ loginHref, onCreateAccount }: PlatformInviteLandingProps) {
  const t = useTranslations('auth')
  return (
    <div className="relative flex items-center justify-center min-h-[88vh] px-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(240,180,41,0.07) 0%, transparent 65%)',
        }}
      />
      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 mb-5">
            <span className="font-[family-name:var(--font-oswald)] font-bold text-lg tracking-widest uppercase">
              <span className="text-[#f0b429]">WC</span>
              <span className="text-white">26</span>
            </span>
          </div>
          <div className="text-5xl mb-4">⚽</div>
          <h1 className="font-[family-name:var(--font-oswald)] text-[2rem] font-bold uppercase tracking-wider text-white leading-none">
            {t('invite_landing_title')}
          </h1>
          <p className="text-[#64748b] text-sm mt-3 leading-relaxed">
            {t('invite_landing_intro')}
            <br />
            <span className="text-[#f0b429] font-bold">{t('invite_landing_brand')}</span>
            <br />
            <span className="text-[#94a3b8]">{t('invite_landing_tagline')}</span>
          </p>
        </div>

        <div
          className="rounded-2xl p-7"
          style={{
            background: '#0d1520',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}
        >
          <div className="h-px w-full mb-6 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(240,180,41,0.6), transparent)' }} />

          <div className="space-y-3">
            <button
              onClick={onCreateAccount}
              className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200"
              style={{ background: '#f0b429', color: '#080c14' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#fcd86e')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#f0b429')}
            >
              {t('register_button')}
            </button>
            <Link
              href={loginHref}
              className="block w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider text-center transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: '#94a3b8',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#94a3b8')}
            >
              {t('sign_in')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function RegisterForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const invite = searchParams.get('invite') ?? ''
  const showFormImmediately = searchParams.get('start') === 'form'
  const [showLanding, setShowLanding] = useState(invite !== '' && !showFormImmediately)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (Cookies.get('is_authenticated')) {
      setRedirecting(true)
      router.replace(next)
      return
    }
    setShowLanding(invite !== '' && !showFormImmediately)
  }, [invite, showFormImmediately, next, router])

  if (redirecting) {
    return (
      <div className="flex items-center justify-center min-h-[88vh]">
        <p className="text-[#64748b] text-sm animate-pulse">{t('signing_in')}</p>
      </div>
    )
  }

  if (!invite) {
    return <InviteWall />
  }

  if (showLanding) {
    const loginNext = next !== '/dashboard' ? next : '/dashboard'
    const loginHref = `/auth/login?next=${encodeURIComponent(loginNext)}`
    return (
      <PlatformInviteLanding
        loginHref={loginHref}
        onCreateAccount={() => setShowLanding(false)}
      />
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    const regRes = await fetch(`/api/auth/register?invite_code=${encodeURIComponent(decodeInviteCode(invite))}`, {
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
      setError((regData as { error?: string }).error ?? t('register_failed'))
      setLoading(false)
      return
    }

    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    })

    setLoading(false)
    if (loginRes.ok) {
      router.push('/onboarding')
      router.refresh()
    } else {
      router.push('/auth/login')
    }
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
            {t('join_the_league')}
          </h1>
          <p className="text-[#3f5068] text-sm mt-2 font-medium">{t('create_free_account')}</p>
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
              <FieldLabel>{t('username')}</FieldLabel>
              <AuthInput
                name="username"
                type="text"
                required
                autoComplete="username"
                placeholder={t('username_placeholder')}
              />
            </div>
            <div>
              <FieldLabel>{t('password')}</FieldLabel>
              <AuthInput
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
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
              {loading ? t('register_button_loading') : t('register_button')}
            </button>
          </form>
        </div>

        <p className="text-sm text-center mt-6" style={{ color: '#3f5068' }}>
          {t('already_have_account')}{' '}
          <Link
            href={next !== '/dashboard' ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login'}
            className="text-[#f0b429] hover:text-white transition-colors font-medium"
          >
            {t('log_in_link')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
