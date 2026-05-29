'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { api } from '@/lib/api'
import { setLocaleCookie, getLocaleCookie, type SupportedLocale } from '@/lib/locale'
import { useTranslations } from 'next-intl'

// Brazilian timezones shown first
const BRAZIL_TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Noronha',
]

// Curated list of common timezones worldwide
const OTHER_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Lisbon',
  'Europe/Amsterdam',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Mexico_City',
  'America/Buenos_Aires',
  'America/Lima',
  'America/Bogota',
  'America/Santiago',
  'America/Caracas',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
  'Pacific/Honolulu',
]

type OptionGroup = { label: string; options: string[] }

function buildTimezoneGroups(brazil: string, other: string): OptionGroup[] {
  return [
    { label: brazil, options: BRAZIL_TIMEZONES },
    { label: other, options: OTHER_TIMEZONES },
  ]
}

function filterGroups(groups: OptionGroup[], query: string): OptionGroup[] {
  if (!query) return groups
  const q = query.toLowerCase()
  return groups
    .map(g => ({
      label: g.label,
      options: g.options.filter(tz => tz.toLowerCase().includes(q)),
    }))
    .filter(g => g.options.length > 0)
}

export default function OnboardingPage() {
  const t = useTranslations('onboarding')
  const router = useRouter()

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
  })

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login')
    }
  }, [isLoading, user, router])

  // Redirect users who already completed onboarding
  useEffect(() => {
    if (user?.language && user?.timezone) {
      router.replace('/dashboard')
    }
  }, [user, router])

  // Pre-fill from cookie (landing page selection) or default to 'pt'
  const cookieLocale = getLocaleCookie()
  const [language, setLanguage] = useState<SupportedLocale>(cookieLocale === 'pt' ? 'pt' : 'pt')

  // Auto-detect timezone from browser
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
    } catch {
      return 'America/Sao_Paulo'
    }
  })

  const [tzSearch, setTzSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const groups = buildTimezoneGroups(t('brazil_timezones'), t('other_timezones'))
  const filteredGroups = filterGroups(groups, tzSearch)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.updateMe({ language, timezone })
      setLocaleCookie(language)
      Cookies.set('is_authenticated', '1', { expires: 7, sameSite: 'lax' })
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError(t('error'))
      setSaving(false)
    }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-[88vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#f0b429] border-t-transparent animate-spin" />
      </div>
    )
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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 mb-5">
            <span className="font-[family-name:var(--font-oswald)] font-bold text-lg tracking-widest uppercase">
              <span className="text-[#f0b429]">WC</span>
              <span className="text-white">26</span>
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-oswald)] text-[2rem] font-bold uppercase tracking-wider text-white leading-none">
            {t('title')}
          </h1>
          <p className="text-[#3f5068] text-sm mt-2 font-medium">{t('subtitle')}</p>
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

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Language selector */}
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#5a6a82' }}>
                {t('language_label')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['en', 'pt'] as SupportedLocale[]).map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className="py-3 rounded-xl font-bold text-sm transition-all duration-200"
                    style={language === lang
                      ? { background: '#f0b429', color: '#080c14' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#7a8fa8' }
                    }
                  >
                    {lang === 'en' ? t('language_en') : t('language_pt')}
                  </button>
                ))}
              </div>
              <p className="text-[0.6rem] text-[#3f5068] mt-2">{t('language_hint')}</p>
            </div>

            {/* Timezone selector */}
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#5a6a82' }}>
                {t('timezone_label')}
              </label>
              <p className="text-[0.6rem] text-[#3f5068] mb-2">{t('timezone_hint')}</p>

              {/* Search */}
              <input
                type="text"
                value={tzSearch}
                onChange={e => setTzSearch(e.target.value)}
                placeholder={t('timezone_search')}
                className="w-full rounded-xl px-3 py-2 text-white text-xs transition-all mb-2"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  outline: 'none',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(240,180,41,0.08)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />

              {/* Dropdown */}
              <div
                className="rounded-xl overflow-y-auto"
                style={{
                  maxHeight: 200,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {filteredGroups.map(group => (
                  <div key={group.label}>
                    <div className="px-3 py-1.5 text-[0.55rem] font-bold uppercase tracking-[0.2em]" style={{ color: '#3f5068', background: 'rgba(0,0,0,0.2)' }}>
                      {group.label}
                    </div>
                    {group.options.map(tz => (
                      <button
                        key={tz}
                        type="button"
                        onClick={() => setTimezone(tz)}
                        className="w-full text-left px-3 py-2 text-xs transition-colors"
                        style={timezone === tz
                          ? { background: 'rgba(240,180,41,0.12)', color: '#f0b429' }
                          : { color: '#7a8fa8' }
                        }
                        onMouseEnter={e => {
                          if (tz !== timezone) (e.currentTarget as HTMLElement).style.color = 'white'
                        }}
                        onMouseLeave={e => {
                          if (tz !== timezone) (e.currentTarget as HTMLElement).style.color = '#7a8fa8'
                        }}
                      >
                        {tz}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* Selected display */}
              <p className="text-[0.65rem] mt-2 font-medium" style={{ color: '#f0b429' }}>
                {timezone}
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 rounded-xl px-4 py-2.5" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200 disabled:opacity-50"
              style={{ background: '#f0b429', color: '#080c14' }}
              onMouseEnter={e => !saving && ((e.currentTarget as HTMLElement).style.background = '#fcd86e')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#f0b429')}
            >
              {saving ? t('saving') : t('continue')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
