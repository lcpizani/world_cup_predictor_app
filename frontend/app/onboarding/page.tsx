'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { api } from '@/lib/api'
import { setLocaleCookie, getLocaleCookie, type SupportedLocale } from '@/lib/locale'
import { useTranslations } from 'next-intl'

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

function buildTimezoneGroups(brazil: string, other: string, detectedTz: string): OptionGroup[] {
  const allKnown = [...BRAZIL_TIMEZONES, ...OTHER_TIMEZONES]
  const otherList = allKnown.includes(detectedTz)
    ? OTHER_TIMEZONES
    : [detectedTz, ...OTHER_TIMEZONES]
  return [
    { label: brazil, options: BRAZIL_TIMEZONES },
    { label: other, options: otherList },
  ]
}

function filterGroups(groups: OptionGroup[], query: string): OptionGroup[] {
  if (!query) return groups
  const q = query.toLowerCase()
  return groups
    .map(g => ({ label: g.label, options: g.options.filter(tz => tz.toLowerCase().includes(q)) }))
    .filter(g => g.options.length > 0)
}

function TimezoneSelect({ value, onChange, groups, searchPlaceholder }: {
  value: string
  onChange: (tz: string) => void
  groups: OptionGroup[]
  searchPlaceholder: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const filtered = filterGroups(groups, search)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(prev => !prev); setSearch('') }}
        className="w-full text-left rounded-xl px-3 py-2.5 text-sm transition-all flex items-center justify-between gap-2"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: open ? '1px solid rgba(240,180,41,0.5)' : '1px solid rgba(255,255,255,0.09)',
          color: 'white',
          boxShadow: open ? '0 0 0 3px rgba(240,180,41,0.08)' : 'none',
        }}
      >
        <span className="truncate">{value}</span>
        <span className="shrink-0 text-[0.6rem]" style={{ color: '#3f5068' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden"
          style={{
            background: '#0d1520',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 16px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="p-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg px-3 py-1.5 text-white text-xs"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.09)',
                outline: 'none',
              }}
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            {filtered.map(group => (
              <div key={group.label}>
                <div
                  className="px-3 py-1.5 text-[0.55rem] font-bold uppercase tracking-[0.2em] sticky top-0"
                  style={{ color: '#3f5068', background: 'rgba(8,12,20,0.95)' }}
                >
                  {group.label}
                </div>
                {group.options.map(tz => (
                  <button
                    key={tz}
                    type="button"
                    onClick={() => { onChange(tz); setOpen(false); setSearch('') }}
                    className="w-full text-left px-3 py-2 text-xs transition-colors"
                    style={tz === value
                      ? { background: 'rgba(240,180,41,0.12)', color: '#f0b429' }
                      : { color: '#7a8fa8' }
                    }
                    onMouseEnter={e => { if (tz !== value) (e.currentTarget as HTMLElement).style.color = 'white' }}
                    onMouseLeave={e => { if (tz !== value) (e.currentTarget as HTMLElement).style.color = '#7a8fa8' }}
                  >
                    {tz}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function OnboardingPage() {
  const t = useTranslations('onboarding')
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
  })

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login')
    }
  }, [isLoading, user, router])

  useEffect(() => {
    if (user?.language && user?.timezone) {
      router.replace('/dashboard')
    }
  }, [user, router])

  const [language, setLanguage] = useState<SupportedLocale>(() => {
    const cookieLocale = getLocaleCookie()
    return cookieLocale === 'en' ? 'en' : 'pt'
  })

  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
    } catch {
      return 'America/Sao_Paulo'
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const groups = buildTimezoneGroups(t('brazil_timezones'), t('other_timezones'), timezone)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.updateMe({ language, timezone })
      setLocaleCookie(language)
      Cookies.set('is_authenticated', '1', { expires: 7, sameSite: 'lax' })
      // Update cache so useOnboardingGuard on the next page sees the new values
      queryClient.setQueryData(['me'], (old: Record<string, unknown> | undefined) =>
        old ? { ...old, language, timezone } : old
      )
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
              <TimezoneSelect
                value={timezone}
                onChange={setTimezone}
                groups={groups}
                searchPlaceholder={t('timezone_search')}
              />
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
