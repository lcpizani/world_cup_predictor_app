'use client'

import React, { useMemo } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { isSameMonth } from 'date-fns'
import type { Match } from '@/types/api'
import { getTeamFlagCode, getFlagUrl, getTeamAbbr } from '@/lib/flags'
import { formatMatchTime } from '@/lib/date'
import {
  groupMatchesByDate,
  getCalendarWeeks,
  getWeekDays,
  formatDateKey,
} from '@/lib/calendar'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_HEADERS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// Stage color system — one color per knockout round, blue for group stage
export const STAGE_CONFIG: Record<string, { label: string; labelPt: string; bg: string; border: string; accent: string }> = {
  group_stage:   { label: 'Group Stage',    labelPt: 'Fase de Grupos', bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.18)',  accent: '#3b82f6' },
  round_of_16:   { label: 'Round of 16',    labelPt: 'Oitavas',        bg: 'rgba(20,184,166,0.09)',  border: 'rgba(20,184,166,0.22)',  accent: '#14b8a6' },
  quarter_final: { label: 'Quarter-final',  labelPt: 'Quartas',        bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.22)',  accent: '#f97316' },
  semi_final:    { label: 'Semi-final',     labelPt: 'Semifinal',      bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.22)',  accent: '#a855f7' },
  third_place:   { label: '3rd Place',      labelPt: '3º Lugar',       bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.18)', accent: '#94a3b8' },
  final:         { label: 'Final',          labelPt: 'Final',          bg: 'rgba(234,179,8,0.10)',   border: 'rgba(234,179,8,0.28)',   accent: '#eab308' },
}
const LIVE_STYLE = { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.22)', accent: '#4ade80' }
const DEFAULT_STAGE = { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', accent: '#5a6a82' }

export function CalendarLegend({ stages, locale }: { stages: string[]; locale: string }) {
  const present = Object.entries(STAGE_CONFIG).filter(([key]) => stages.includes(key))
  if (present.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {present.map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: cfg.accent, opacity: 0.75 }}
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: '#4a6070' }}
          >
            {locale === 'pt' ? cfg.labelPt : cfg.label}
          </span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  matches: Match[]
  timezone?: string | null
  view: 'month' | 'week'
  anchorDate: Date
  filterTeam: string | null
}

// Pill flag — fluid inside a flex-1 wrapper; scales proportionally with cell width,
// capped at 28px so it never overwhelms a compact pill.
function FlagSm({ name }: { name: string }) {
  const code = getTeamFlagCode(name)
  if (!code) return (
    <div className="w-full rounded-sm" style={{ maxWidth: 28, aspectRatio: '3/2', background: 'rgba(255,255,255,0.05)' }} />
  )
  return (
    <div className="relative w-full rounded-sm overflow-hidden" style={{ maxWidth: 28, aspectRatio: '3/2', border: '1px solid rgba(255,255,255,0.10)' }}>
      <Image src={getFlagUrl(code, 40)} alt={name} fill className="object-cover" unoptimized />
    </div>
  )
}

// Card flag — fluid column flag for expanded filter cards; scales with cell width,
// capped at 56px. Uses Next.js fill so height follows aspect-ratio automatically.
function FlagCard({ name }: { name: string }) {
  const code = getTeamFlagCode(name)
  if (!code) return (
    <div className="w-full rounded-md" style={{ maxWidth: 56, aspectRatio: '3/2', background: 'rgba(255,255,255,0.05)' }} />
  )
  return (
    <div className="relative w-full rounded-md overflow-hidden" style={{ maxWidth: 56, aspectRatio: '3/2', border: '1px solid rgba(255,255,255,0.12)' }}>
      <Image src={getFlagUrl(code, 80)} alt={name} fill className="object-cover" unoptimized />
    </div>
  )
}

function MatchPill({ match, timezone }: { match: Match; timezone?: string | null }) {
  const locale = useLocale()
  const time = formatMatchTime(match.kickoff_at, timezone, locale)
  const homeAbbr = getTeamAbbr(match.home_team)
  const awayAbbr = getTeamAbbr(match.away_team)

  const isLive = match.status === 'live' || match.status === 'halftime'
  const isFinished = match.status === 'finished'
  const hasScore = isFinished && match.home_score !== null && match.away_score !== null
  const hasPenalties = hasScore && match.home_score_penalties !== null && match.away_score_penalties !== null

  const style = isLive ? LIVE_STYLE : (STAGE_CONFIG[match.stage] ?? DEFAULT_STAGE)

  return (
    <div
      className="flex flex-col px-1.5 py-1 rounded-lg w-full min-w-0 gap-[3px]"
      style={{ background: style.bg, border: `1px solid ${style.border}` }}
    >
      {/* Time / score */}
      <div className="flex items-center justify-center">
        {hasScore ? (
          <div className="flex items-center gap-1">
            <span className="font-[family-name:var(--font-oswald)] font-bold tabular-nums leading-none" style={{ fontSize: 10, color: '#7a90a8' }}>
              {match.home_score}
            </span>
            <span style={{ fontSize: 8, color: '#2d3e52', lineHeight: 1 }}>–</span>
            <span className="font-[family-name:var(--font-oswald)] font-bold tabular-nums leading-none" style={{ fontSize: 10, color: '#7a90a8' }}>
              {match.away_score}
            </span>
            {hasPenalties && (
              <span className="text-[7px] font-medium leading-none" style={{ color: '#3a4d61' }}>
                ({match.home_score_penalties}–{match.away_score_penalties})
              </span>
            )}
          </div>
        ) : (
          <span className="font-medium tabular-nums leading-none" style={{ fontSize: 9, color: isLive ? '#4ade80' : '#4a6070' }}>
            {isLive ? '● LIVE' : time}
          </span>
        )}
      </div>

      {/* Flags + abbreviations below — each side gets equal flex space */}
      <div className="flex items-start gap-1">
        <div className="flex-1 flex flex-col items-center gap-[2px]">
          <FlagSm name={match.home_team} />
          <span className="font-[family-name:var(--font-oswald)] font-bold uppercase leading-none truncate" style={{ fontSize: 8, color: '#5a7088' }}>
            {homeAbbr}
          </span>
        </div>
        <span className="shrink-0 mt-[3px]" style={{ fontSize: 7, color: '#1e2d3a', lineHeight: 1 }}>vs</span>
        <div className="flex-1 flex flex-col items-center gap-[2px]">
          <FlagSm name={match.away_team} />
          <span className="font-[family-name:var(--font-oswald)] font-bold uppercase leading-none truncate" style={{ fontSize: 8, color: '#5a7088' }}>
            {awayAbbr}
          </span>
        </div>
      </div>
    </div>
  )
}

function ExpandedMatchCard({ match, timezone }: { match: Match; timezone?: string | null }) {
  const locale = useLocale()
  const homeAbbr = getTeamAbbr(match.home_team)
  const awayAbbr = getTeamAbbr(match.away_team)
  const time = formatMatchTime(match.kickoff_at, timezone, locale)

  const isLive = match.status === 'live' || match.status === 'halftime'
  const isFinished = match.status === 'finished'
  const hasScore = (isFinished || isLive) && match.home_score !== null && match.away_score !== null
  const hasPenalties = hasScore && match.home_score_penalties !== null && match.away_score_penalties !== null

  const style = isLive ? LIVE_STYLE : (STAGE_CONFIG[match.stage] ?? DEFAULT_STAGE)
  const textColor = isFinished ? '#4a5c70' : 'white'

  return (
    <div
      className="flex flex-col items-center gap-1.5 px-1.5 py-2 rounded-xl w-full overflow-hidden"
      style={{ background: style.bg, border: `1px solid ${style.border}` }}
    >
      {/* Home name */}
      <span
        className="font-[family-name:var(--font-oswald)] font-bold uppercase tracking-wide leading-none"
        style={{ fontSize: 12, color: textColor }}
      >
        {homeAbbr}
      </span>

      {/* Home flag — fluid, max 44px, shrinks in narrow cells */}
      <FlagCard name={match.home_team} />

      {/* Score or time */}
      {hasScore ? (
        <div className="flex flex-col items-center gap-0">
          <span
            className="font-[family-name:var(--font-oswald)] font-bold tabular-nums leading-none"
            style={{ fontSize: 18, color: isFinished ? '#7a90a8' : '#c8d4e0' }}
          >
            {match.home_score}
          </span>
          <div style={{ width: 12, height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
          <span
            className="font-[family-name:var(--font-oswald)] font-bold tabular-nums leading-none"
            style={{ fontSize: 18, color: isFinished ? '#7a90a8' : '#c8d4e0' }}
          >
            {match.away_score}
          </span>
          {hasPenalties && (
            <span className="text-[8px] font-medium leading-none mt-0.5" style={{ color: '#3a4d61' }}>
              p. {match.home_score_penalties}–{match.away_score_penalties}
            </span>
          )}
        </div>
      ) : (
        <span
          className="font-bold tabular-nums leading-none"
          style={{ fontSize: 11, color: isLive ? '#4ade80' : '#f0b429' }}
        >
          {isLive ? '● LIVE' : time}
        </span>
      )}

      {/* Away flag */}
      <FlagCard name={match.away_team} />

      {/* Away name */}
      <span
        className="font-[family-name:var(--font-oswald)] font-bold uppercase tracking-wide leading-none"
        style={{ fontSize: 12, color: textColor }}
      >
        {awayAbbr}
      </span>
    </div>
  )
}

const MAX_PILLS = 6

function DayCell({
  date,
  matches,
  isCurrentMonth,
  filterTeam,
  timezone,
  view,
}: {
  date: Date
  matches: Match[]
  isCurrentMonth: boolean
  filterTeam: string | null
  timezone?: string | null
  view: 'month' | 'week'
}) {
  const t = useTranslations('calendar')
  const today = new Date()
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()

  const filteredMatches = filterTeam
    ? matches.filter(m => m.home_team === filterTeam || m.away_team === filterTeam)
    : matches

  const hasMatches = filteredMatches.length > 0
  const overflowCount = !filterTeam && filteredMatches.length > MAX_PILLS ? filteredMatches.length - MAX_PILLS : 0
  const visibleMatches = !filterTeam && filteredMatches.length > MAX_PILLS
    ? filteredMatches.slice(0, MAX_PILLS)
    : filteredMatches

  return (
    <div
      className="flex flex-col p-1 sm:p-1.5 overflow-hidden"
      style={{
        borderRight: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        opacity: isCurrentMonth ? 1 : 0.2,
        background: isToday ? 'rgba(90,140,220,0.05)' : 'transparent',
        minHeight: view === 'week' ? 200 : 100,
      }}
    >
      <div className="mb-1 shrink-0">
        <span
          className="inline-flex items-center justify-center text-[10px] sm:text-[11px] font-bold leading-none rounded-md"
          style={{
            minWidth: 20,
            height: 20,
            paddingLeft: 4,
            paddingRight: 4,
            color: isToday ? 'white' : hasMatches ? '#7a90a8' : '#2d3e52',
            background: isToday ? '#5a8fdf' : 'transparent',
          }}
        >
          {date.getDate()}
        </span>
      </div>

      <div className="flex flex-col gap-1 flex-1">
        {visibleMatches.map(m =>
          filterTeam ? (
            <ExpandedMatchCard key={m.id} match={m} timezone={timezone} />
          ) : (
            <MatchPill key={m.id} match={m} timezone={timezone} />
          )
        )}
        {overflowCount > 0 && (
          <span className="text-[9px] font-medium px-0.5 mt-0.5" style={{ color: '#3a4d61' }}>
            {t('more', { count: overflowCount })}
          </span>
        )}
      </div>
    </div>
  )
}

export default function CalendarView({ matches, timezone, view, anchorDate, filterTeam }: Props) {
  const locale = useLocale()
  const dayHeaders = locale === 'pt' ? DAY_HEADERS_PT : DAY_HEADERS

  const matchesByDate = useMemo(
    () => groupMatchesByDate(matches, timezone),
    [matches, timezone]
  )

  const weeks = useMemo(
    () => view === 'month' ? getCalendarWeeks(anchorDate) : [getWeekDays(anchorDate)],
    [view, anchorDate]
  )

  return (
    <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#080c14', minWidth: 630 }}
    >
      <div className="grid grid-cols-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {dayHeaders.map((d, i) => (
          <div
            key={d}
            className="px-1.5 py-2 text-center"
            style={{ borderRight: i < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#2d3e52' }}>
              {d}
            </span>
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((date, di) => {
            const key = formatDateKey(date)
            const dayMatches = matchesByDate.get(key) ?? []
            const inMonth = view === 'week' || isSameMonth(date, anchorDate)
            return (
              <DayCell
                key={di}
                date={date}
                matches={dayMatches}
                isCurrentMonth={inMonth}
                filterTeam={filterTeam}
                timezone={timezone}
                view={view}
              />
            )
          })}
        </div>
      ))}
    </div>
    </div>
  )
}
