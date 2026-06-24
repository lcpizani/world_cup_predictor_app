'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { navigateMonth, navigateWeek, getWeekDays } from '@/lib/calendar'
import { translateTeamName } from '@/lib/flags'
import { useLocale } from 'next-intl'
import CalendarView, { CalendarLegend, STAGE_CONFIG } from '@/components/CalendarView'

type ViewMode = 'month' | 'week'

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export default function CalendarPage() {
  const t = useTranslations('calendar')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Derive view and anchor date from URL params
  const viewParam = searchParams.get('view')
  const view: ViewMode = viewParam === 'week' ? 'week' : 'month'

  const dateParam = searchParams.get('date')
  const anchorDate = useMemo(() => {
    if (dateParam) {
      const d = new Date(dateParam)
      if (!isNaN(d.getTime())) return d
    }
    return new Date()
  }, [dateParam])

  const [filterTeam, setFilterTeam] = useState<string | null>(null)

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.listMatches(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.getMe })

  const allTeams = useMemo(() => {
    const set = new Set<string>()
    for (const m of matches) {
      if (m.home_team) set.add(m.home_team)
      if (m.away_team) set.add(m.away_team)
    }
    return Array.from(set).sort((a, b) =>
      translateTeamName(a, locale).localeCompare(translateTeamName(b, locale))
    )
  }, [matches, locale])

  const presentStages = useMemo(() => {
    const seen = new Set<string>()
    for (const m of matches) if (m.stage) seen.add(m.stage)
    return Object.keys(STAGE_CONFIG).filter(s => seen.has(s))
  }, [matches])

  function setView(v: ViewMode) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', v)
    router.replace(`/calendar?${params.toString()}`)
  }

  function navigate(direction: 1 | -1) {
    const next = view === 'month'
      ? navigateMonth(anchorDate, direction)
      : navigateWeek(anchorDate, direction)
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', next.toISOString().slice(0, 10))
    router.replace(`/calendar?${params.toString()}`)
  }

  const monthLabel = new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(anchorDate)

  const weekLabel = useMemo(() => {
    const days = getWeekDays(anchorDate)
    const fmt = new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', day: 'numeric' })
    return `${fmt.format(days[0])} – ${fmt.format(days[6])}`
  }, [anchorDate, locale])

  const headingLabel = view === 'week' ? weekLabel : monthLabel

  return (
    <div className="min-h-screen" style={{ background: '#05080f' }}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Title */}
          <h1
            className="font-[family-name:var(--font-oswald)] font-bold text-xl uppercase tracking-widest"
            style={{ color: 'white' }}
          >
            {t('title')}
          </h1>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: '#5a6a82', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#5a6a82' }}
            >
              <ChevronLeft />
            </button>
            <span
              className="font-[family-name:var(--font-oswald)] font-semibold text-sm uppercase tracking-wider px-2 min-w-[160px] text-center"
              style={{ color: '#c8d4e0' }}
            >
              {headingLabel}
            </span>
            <button
              onClick={() => navigate(1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: '#5a6a82', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#5a6a82' }}
            >
              <ChevronRight />
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Team filter */}
          <div className="relative">
            <select
              value={filterTeam ?? ''}
              onChange={e => setFilterTeam(e.target.value || null)}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: filterTeam ? 'rgba(90,140,220,0.1)' : '#0d1520',
                border: filterTeam ? '1px solid rgba(90,140,220,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filterTeam ? '#8aabdf' : '#5a6a82',
                outline: 'none',
              }}
            >
              <option value="">{t('all_teams')}</option>
              {allTeams.map(team => (
                <option key={team} value={team}>
                  {translateTeamName(team, locale)}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: filterTeam ? '#5a8fdf' : '#3f5068' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Month / Week toggle */}
          <div
            className="flex items-center rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#0d1520' }}
          >
            {(['month', 'week'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all"
                style={view === v
                  ? { background: 'rgba(90,140,220,0.15)', color: '#5a8fdf' }
                  : { background: 'transparent', color: '#3f5068' }
                }
              >
                {v === 'month' ? t('view_month') : t('view_week')}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        {!isLoading && presentStages.length > 0 && (
          <div className="mb-4">
            <CalendarLegend stages={presentStages} locale={locale} />
          </div>
        )}

        {/* Calendar */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 border-[#5a8fdf] border-t-transparent animate-spin" />
          </div>
        ) : (
          <CalendarView
            matches={matches}
            timezone={me?.timezone}
            view={view}
            anchorDate={anchorDate}
            filterTeam={filterTeam}
          />
        )}
      </div>
    </div>
  )
}
