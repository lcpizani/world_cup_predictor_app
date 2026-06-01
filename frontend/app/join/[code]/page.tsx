'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Cookies from 'js-cookie'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { decodeInviteCode } from '@/lib/invite'

type Phase = 'loading' | 'invite-landing' | 'register' | 'confirm-late-join' | 'joining' | 'already_member' | 'error'

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

interface InviteLandingProps {
  leagueName: string
  code: string
  onSignUp: () => void
}

function InviteLanding({ leagueName, code, onSignUp }: InviteLandingProps) {
  const t = useTranslations('join')
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
          <div className="text-5xl mb-4">🏆</div>
          <h1 className="font-[family-name:var(--font-oswald)] text-[2rem] font-bold uppercase tracking-wider text-white leading-none">
            {t('you_are_invited')}
          </h1>
          <p className="text-[#64748b] text-sm mt-2">
            {t('invited_to_join')}
          </p>
          <p className="text-[#f0b429] font-bold text-lg mt-1">{leagueName}</p>
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
              onClick={onSignUp}
              className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200"
              style={{ background: '#f0b429', color: '#080c14' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#fcd86e')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#f0b429')}
            >
              {t('create_account_join')}
            </button>
            <Link
              href={`/auth/login?next=${encodeURIComponent(`/join/${code}`)}`}
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

        <p className="text-center text-xs mt-5 px-4 leading-relaxed" style={{ color: '#5a6a82' }}>
          {t('invite_landing_note')}
        </p>
      </div>
    </div>
  )
}

interface InlineRegisterProps {
  code: string
  leagueName: string
  onBack: () => void
  onSuccess: () => void
}

function InlineRegisterForm({ code, leagueName, onBack, onSuccess }: InlineRegisterProps) {
  const t = useTranslations('join')
  const tAuth = useTranslations('auth')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    const regRes = await fetch(`/api/auth/register?invite_code=${encodeURIComponent(decodeInviteCode(code))}`, {
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
      setError((regData as { error?: string }).error ?? tAuth('register_failed'))
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
      onSuccess()
    } else {
      setError(t('register_login_failed'))
    }
  }

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
          <h1 className="font-[family-name:var(--font-oswald)] text-[2rem] font-bold uppercase tracking-wider text-white leading-none">
            {tAuth('join_the_league')}
          </h1>
          <p className="text-[#f0b429] text-sm mt-2 font-medium">{leagueName}</p>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <FieldLabel>{tAuth('email')}</FieldLabel>
              <AuthInput name="email" type="email" required autoComplete="email" placeholder={tAuth('email_placeholder')} />
            </div>
            <div>
              <FieldLabel>{tAuth('username')}</FieldLabel>
              <AuthInput name="username" type="text" required autoComplete="username" placeholder={tAuth('username_placeholder')} />
            </div>
            <div>
              <FieldLabel>{tAuth('password')}</FieldLabel>
              <AuthInput name="password" type="password" required minLength={8} autoComplete="new-password" placeholder={tAuth('password_placeholder')} />
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
              {loading ? tAuth('register_button_loading') : t('create_account_join')}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-2">
          <p className="text-sm" style={{ color: '#3f5068' }}>
            {tAuth('already_have_account')}{' '}
            <Link
              href={`/auth/login?next=${encodeURIComponent(`/join/${code}`)}`}
              className="text-[#f0b429] hover:text-white transition-colors font-medium"
            >
              {tAuth('sign_in')}
            </Link>
          </p>
          <button
            onClick={onBack}
            className="text-xs transition-colors"
            style={{ color: '#3f5068' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#3f5068')}
          >
            {t('back')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmLateJoin({ leagueName, onConfirm, onCancel }: {
  leagueName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useTranslations('join')
  return (
    <div className="relative flex items-center justify-center min-h-[88vh] px-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(240,180,41,0.07) 0%, transparent 65%)' }}
      />
      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div
          className="rounded-2xl p-7"
          style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
        >
          <div className="h-px w-full mb-6 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(240,180,41,0.6), transparent)' }} />

          <div className="flex justify-center mb-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.2)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f0b429" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2.5" />
                <path d="M9.5 2.5h5" />
                <path d="M12 2.5v2" />
              </svg>
            </div>
          </div>

          <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold uppercase tracking-wider text-white text-center leading-snug mb-2">
            {t('confirm_underway_title')}
          </h2>
          {leagueName && (
            <p className="text-[#f0b429] text-sm font-semibold text-center mb-4">{leagueName}</p>
          )}

          <p className="text-[#7a8fa8] text-sm text-center leading-relaxed mb-2">
            {t('confirm_underway_desc')}
          </p>
          <p className="text-[#3f5068] text-xs text-center leading-relaxed mb-7">
            {t('confirm_underway_note')}
          </p>

          <div className="space-y-2.5">
            <button
              onClick={onConfirm}
              className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200"
              style={{ background: '#f0b429', color: '#080c14' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fcd86e' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f0b429' }}
            >
              {t('join_anyway')}
            </button>
            <button
              onClick={onCancel}
              className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#94a3b8' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function JoinPage() {
  const t = useTranslations('join')
  const { code: encodedCode } = useParams<{ code: string }>()
  const code = decodeInviteCode(encodedCode)
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [leagueName, setLeagueName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe, retry: false })
  useOnboardingGuard(me, meLoading)

  async function performJoin() {
    setPhase('joining')
    const res = await fetch('/api/proxy/tournaments/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code }),
    })
    if (res.ok || res.status === 409) {
      router.replace(`/tournaments/${code}`)
      return
    }
    const err = await res.json().catch(() => ({}))
    setErrorMsg((err as { detail?: string }).detail ?? t('error_generic'))
    setPhase('error')
  }

  async function checkLateJoin(): Promise<boolean> {
    try {
      const res = await fetch('/api/proxy/matches?match_status=finished')
      const matches = res.ok ? await res.json() as unknown[] : []
      return matches.length > 0
    } catch {
      return false
    }
  }

  useEffect(() => {
    async function init() {
      const signedIn = !!Cookies.get('is_authenticated')

      if (!signedIn) {
        const res = await fetch(`/api/proxy/tournaments/${encodeURIComponent(code)}/preview`)
        if (res.ok) {
          const data = await res.json() as { name: string }
          setLeagueName(data.name)
        } else {
          setLeagueName(t('this_league'))
        }
        setPhase('invite-landing')
        return
      }

      // Authenticated — fetch league name and check if matches have started
      const [previewRes, isLate] = await Promise.all([
        fetch(`/api/proxy/tournaments/${encodeURIComponent(code)}/preview`),
        checkLateJoin(),
      ])
      if (previewRes.ok) {
        const data = await previewRes.json() as { name: string }
        setLeagueName(data.name)
      } else {
        setLeagueName('this league')
      }

      if (isLate) {
        setPhase('confirm-late-join')
        return
      }

      await performJoin()
    }

    init()
  }, [code, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRegistered() {
    const isLate = await checkLateJoin()
    if (isLate) {
      setPhase('confirm-late-join')
    } else {
      await performJoin()
    }
  }

  if (phase === 'confirm-late-join') {
    return (
      <ConfirmLateJoin
        leagueName={leagueName}
        onConfirm={performJoin}
        onCancel={() => router.replace('/')}
      />
    )
  }

  if (phase === 'loading' || phase === 'joining') {
    return (
      <div className="flex items-center justify-center min-h-[88vh]">
        <p className="text-[#64748b] text-sm animate-pulse">
          {phase === 'joining' ? t('joining_competition') : t('loading')}
        </p>
      </div>
    )
  }

  if (phase === 'invite-landing') {
    return (
      <InviteLanding
        leagueName={leagueName}
        code={encodedCode}
        onSignUp={() => setPhase('register')}
      />
    )
  }

  if (phase === 'register') {
    return (
      <InlineRegisterForm
        code={encodedCode}
        leagueName={leagueName}
        onBack={() => setPhase('invite-landing')}
        onSuccess={handleRegistered}
      />
    )
  }

  if (phase === 'already_member') {
    return (
      <div className="flex items-center justify-center min-h-[88vh] px-4">
        <div className="text-center max-w-sm">
          <span className="text-5xl">🏆</span>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white mt-4">
            {t('already_in_title')}
          </h1>
          <p className="text-[#64748b] text-sm mt-2 mb-6">
            {t('already_in_desc')}
          </p>
          <Link
            href={`/tournaments/${code}`}
            className="inline-block bg-[#f0b429] text-[#080c14] px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white transition-all"
          >
            {t('go_to_competition')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[88vh] px-4">
      <div className="text-center max-w-sm">
        <span className="text-5xl">❌</span>
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white mt-4">
          {t('invalid_link_title')}
        </h1>
        <p className="text-[#64748b] text-sm mt-2 mb-6">
          {errorMsg || t('invalid_link_desc')}
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-[#f0b429] text-[#080c14] px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white transition-all"
        >
          {t('go_to_dashboard')}
        </Link>
      </div>
    </div>
  )
}
