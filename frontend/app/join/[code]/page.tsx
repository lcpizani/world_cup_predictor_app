'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Cookies from 'js-cookie'

type Phase = 'loading' | 'invite-landing' | 'register' | 'joining' | 'already_member' | 'error'

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
            You&apos;re Invited
          </h1>
          <p className="text-[#64748b] text-sm mt-2">
            You&apos;ve been invited to join
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
              Create Account &amp; Join
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
              Sign In
            </Link>
          </div>
        </div>
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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    const regRes = await fetch(`/api/auth/register?invite_code=${encodeURIComponent(code)}`, {
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

    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    })

    setLoading(false)
    if (loginRes.ok) {
      onSuccess()
    } else {
      setError('Registered but login failed — try signing in.')
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
            Join the League
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
              <FieldLabel>Email</FieldLabel>
              <AuthInput name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
            </div>
            <div>
              <FieldLabel>Username</FieldLabel>
              <AuthInput name="username" type="text" required autoComplete="username" placeholder="ronaldo10" />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <AuthInput name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="••••••••" />
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
              {loading ? 'Creating account…' : 'Create Account & Join'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-2">
          <p className="text-sm" style={{ color: '#3f5068' }}>
            Already have an account?{' '}
            <Link
              href={`/auth/login?next=${encodeURIComponent(`/join/${code}`)}`}
              className="text-[#f0b429] hover:text-white transition-colors font-medium"
            >
              Sign in
            </Link>
          </p>
          <button
            onClick={onBack}
            className="text-xs transition-colors"
            style={{ color: '#3f5068' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#3f5068')}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [leagueName, setLeagueName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function init() {
      const signedIn = !!Cookies.get('is_authenticated')

      if (!signedIn) {
        // Fetch league name for the invite landing page
        const res = await fetch(`/api/proxy/tournaments/${encodeURIComponent(code)}/preview`)
        if (res.ok) {
          const data = await res.json() as { name: string }
          setLeagueName(data.name)
        } else {
          setLeagueName('this league')
        }
        setPhase('invite-landing')
        return
      }

      // Authenticated — attempt join (proxy injects the Authorization header)
      setPhase('joining')
      const res = await fetch('/api/proxy/tournaments/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code }),
      })

      if (res.ok) {
        router.replace(`/tournaments/${code}`)
        return
      }

      if (res.status === 409) {
        setPhase('already_member')
        return
      }

      const err = await res.json().catch(() => ({}))
      setErrorMsg((err as { detail?: string }).detail ?? 'Something went wrong.')
      setPhase('error')
    }

    init()
  }, [code, router])

  function handleRegistered() {
    // Token now set — retry the join (proxy injects the Authorization header)
    setPhase('joining')
    fetch('/api/proxy/tournaments/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code }),
    }).then(res => {
      if (res.ok || res.status === 409) {
        router.replace(`/tournaments/${code}`)
      } else {
        res.json().catch(() => ({})).then(err => {
          setErrorMsg((err as { detail?: string }).detail ?? 'Something went wrong.')
          setPhase('error')
        })
      }
    })
  }

  if (phase === 'loading' || phase === 'joining') {
    return (
      <div className="flex items-center justify-center min-h-[88vh]">
        <p className="text-[#64748b] text-sm animate-pulse">
          {phase === 'joining' ? 'Joining competition…' : 'Loading…'}
        </p>
      </div>
    )
  }

  if (phase === 'invite-landing') {
    return (
      <InviteLanding
        leagueName={leagueName}
        code={code}
        onSignUp={() => setPhase('register')}
      />
    )
  }

  if (phase === 'register') {
    return (
      <InlineRegisterForm
        code={code}
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
            You&apos;re already in!
          </h1>
          <p className="text-[#64748b] text-sm mt-2 mb-6">
            You&apos;re already a member of this competition.
          </p>
          <Link
            href={`/tournaments/${code}`}
            className="inline-block bg-[#f0b429] text-[#080c14] px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white transition-all"
          >
            Go to Competition
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
          Invalid Link
        </h1>
        <p className="text-[#64748b] text-sm mt-2 mb-6">
          {errorMsg || 'This invite link is not valid. Ask for a new one.'}
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-[#f0b429] text-[#080c14] px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white transition-all"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
