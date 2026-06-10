'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

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

function ResetPasswordForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="text-center py-4 space-y-3">
        <p className="text-red-400 text-sm">{t('reset_no_token')}</p>
        <Link href="/auth/forgot-password" className="text-[#f0b429] hover:text-white transition-colors text-sm font-medium">
          {t('reset_request_new')}
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    const newPassword = fd.get('new_password') as string
    const confirmPassword = fd.get('confirm_password') as string

    if (newPassword.length < 8) {
      setError(t('reset_password_too_short'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('reset_passwords_mismatch'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      })

      if (!res.ok) {
        let data: { error?: string } = {}
        try { data = await res.json() } catch { /* ignore */ }
        setError(data.error ?? t('reset_failed'))
        return
      }

      setSuccess(true)
    } catch {
      setError(t('reset_failed'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="text-[#f0b429] text-4xl">✓</div>
        <p className="text-white font-semibold">{t('reset_success_title')}</p>
        <p className="text-[#5a6a82] text-sm">{t('reset_success_desc')}</p>
        <button
          onClick={() => router.push('/auth/login')}
          className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200 mt-2"
          style={{ background: '#f0b429', color: '#080c14' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#fcd86e')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#f0b429')}
        >
          {t('reset_success_button')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <FieldLabel>{t('reset_new_password')}</FieldLabel>
        <AuthInput
          name="new_password"
          type="password"
          required
          autoComplete="new-password"
          placeholder={t('password_placeholder')}
        />
      </div>
      <div>
        <FieldLabel>{t('reset_confirm_password')}</FieldLabel>
        <AuthInput
          name="confirm_password"
          type="password"
          required
          autoComplete="new-password"
          placeholder={t('password_placeholder')}
        />
      </div>

      {error && (
        <div className="text-sm text-red-400 rounded-xl px-4 py-2.5 space-y-1" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
          <p>{error}</p>
          <Link href="/auth/forgot-password" className="text-[#f0b429] hover:text-white transition-colors underline text-xs">
            {t('reset_request_new')}
          </Link>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200 disabled:opacity-50 mt-1"
        style={{ background: '#f0b429', color: '#080c14' }}
        onMouseEnter={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#fcd86e')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#f0b429')}
      >
        {loading ? t('reset_button_loading') : t('reset_button')}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
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
          <h1 className="font-[family-name:var(--font-oswald)] text-[2rem] font-bold uppercase tracking-wider text-white leading-none">
            {t('reset_title')}
          </h1>
          <p className="text-[#3f5068] text-sm mt-2 font-medium">{t('reset_subtitle')}</p>
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

          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <p className="text-sm text-center mt-6" style={{ color: '#3f5068' }}>
          <Link href="/auth/login" className="text-[#f0b429] hover:text-white transition-colors font-medium">
            {t('back_to_login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
