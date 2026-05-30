'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

export function AuthRequiredBanner() {
  const params = useSearchParams()
  const t = useTranslations('auth_required')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (params.get('auth_required') === '1') {
      setVisible(true)
      // Clean up the param so refreshing doesn't re-show the banner
      const url = new URL(window.location.href)
      url.searchParams.delete('auth_required')
      window.history.replaceState({}, '', url.toString())
    }
  }, [params])

  if (!visible) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '11px 20px',
        background: 'rgba(30, 6, 6, 0.97)',
        borderBottom: '1px solid rgba(239,68,68,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* Icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" />
        <path d="M12 8v4" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill="#ef4444" />
      </svg>

      {/* Message */}
      <p style={{ color: '#fca5a5', fontSize: 13.5, fontWeight: 500, margin: 0 }}>
        {t('message')}{' '}
        <Link
          href="/auth/login"
          style={{
            color: '#f87171',
            fontWeight: 700,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          {t('cta')}
        </Link>
      </p>

      {/* Dismiss */}
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        style={{
          marginLeft: 'auto',
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#7f3030',
          padding: 4,
          lineHeight: 1,
          fontSize: 16,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fca5a5' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#7f3030' }}
      >
        ✕
      </button>
    </div>
  )
}
