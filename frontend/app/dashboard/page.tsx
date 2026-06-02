'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { computeAccuracy, formatCountdown } from '@/lib/stats'
import { getTeamFlagCode, getFlagUrl, getTeamAbbr, translateTeamName } from '@/lib/flags'
import type { Match, Prediction, LeaderboardEntry, Tournament } from '@/types/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { useLocale, useTranslations } from 'next-intl'
import { formatMatchDate, formatMatchTime } from '@/lib/date'

// ── Primitives ────────────────────────────────────────────────────────────────


function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className ?? ''}`}
      style={{ background: 'rgba(255,255,255,0.04)' }}
    />
  )
}

function SectionLabel({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <span className="block w-[3px] h-5 rounded-full bg-[#f0b429]" />
        <p className="font-[family-name:var(--font-oswald)] text-[1.05rem] font-bold uppercase tracking-[0.2em] text-[#90a0b8]">
          {title}
        </p>
      </div>
      {action}
    </div>
  )
}

// ── usePageSize ───────────────────────────────────────────────────────────────

function usePageSize(): number {
  const [size, setSize] = useState(2) // SSR-safe default
  useEffect(() => {
    function update() {
      const w = window.innerWidth
      if (w >= 1280) setSize(5)
      else if (w >= 1024) setSize(4)
      else if (w >= 768) setSize(3)
      else if (w >= 640) setSize(2)
      else setSize(1)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

// formatGameDate and formatGameTime are replaced by formatMatchDate/formatMatchTime from lib/date

// ── Accuracy Ring ─────────────────────────────────────────────────────────────

function AccuracyRing({ pct, exactPct }: { pct: number; exactPct: number }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const ri = r - 13
  const circi = 2 * Math.PI * ri
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke="rgba(240,180,41,0.25)" strokeWidth="8"
        strokeDasharray={`${(pct / 100) * circ} ${circ}`}
        strokeLinecap="round"
      />
      <circle cx="48" cy="48" r={ri} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
      <circle
        cx="48" cy="48" r={ri} fill="none"
        stroke="#f0b429" strokeWidth="5"
        strokeDasharray={`${(exactPct / 100) * circi} ${circi}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Form Strip ────────────────────────────────────────────────────────────────

function FormStrip({ predictions, matches }: { predictions: Prediction[]; matches: Match[] }) {
  const t = useTranslations('dashboard')
  const finishedById = new Map(
    matches.filter(m => m.status === 'finished').map(m => [m.id, m])
  )
  const graded = predictions
    .filter(p => {
      const m = finishedById.get(p.match_id)
      return m && m.home_score !== null && m.away_score !== null
    })
    .sort((a, b) => {
      const ma = finishedById.get(a.match_id)
      const mb = finishedById.get(b.match_id)
      if (!ma || !mb) return 0
      return new Date(mb.kickoff_at).getTime() - new Date(ma.kickoff_at).getTime()
    })
    .slice(0, 8)

  if (graded.length === 0) return null

  const displayed = [...graded].reverse()

  return (
    <div className="flex items-center gap-1.5 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <span className="text-[10px] text-[#5a7090] font-medium uppercase tracking-widest mr-1">{t('form_label')}</span>
      {displayed.map((p, i) => {
        const m = finishedById.get(p.match_id)!
        const exact = p.predicted_home === m.home_score && p.predicted_away === m.away_score
        const correct = Math.sign(p.predicted_home - p.predicted_away) === Math.sign((m.home_score ?? 0) - (m.away_score ?? 0))
        const bg = exact ? '#4ade80' : correct ? '#f0b429' : '#2a3d55'
        return (
          <span
            key={i}
            title={`${m.home_team} vs ${m.away_team}: ${exact ? 'Exact' : correct ? 'Correct outcome' : 'Wrong'}`}
            style={{ width: 9, height: 9, borderRadius: '50%', background: bg, display: 'inline-block', flexShrink: 0 }}
          />
        )
      })}
    </div>
  )
}

// ── Accuracy Card ─────────────────────────────────────────────────────────────

function AccuracyCard({ predictions, matches }: { predictions: Prediction[]; matches: Match[] }) {
  const t = useTranslations('dashboard')
  const { correctOutcomes, exactScores, total } = computeAccuracy(predictions, matches)

  if (total === 0) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
        <SectionLabel title={t('accuracy_title')} />
        <div className="py-6 flex flex-col items-center gap-2 text-center">
          <p className="text-[#5a7090] text-sm">{t('no_graded_yet')}</p>
          <Link href="/predictions" className="text-xs text-[#f0b429] hover:text-white transition-colors font-medium">
            {t('add_picks')}
          </Link>
        </div>
      </div>
    )
  }

  const pct = Math.round((correctOutcomes / total) * 100)
  const exactPct = correctOutcomes > 0 ? Math.round((exactScores / correctOutcomes) * 100) : 0

  return (
    <Link href="/predictions" className="block group">
      <div
        className="rounded-2xl p-5 transition-colors"
        style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <SectionLabel title={t('accuracy_title')} />

        <div className="flex items-center gap-5">
          <div className="relative w-24 h-24 shrink-0">
            <AccuracyRing pct={pct} exactPct={exactPct} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-[family-name:var(--font-oswald)] font-bold text-white group-hover:text-[#f0b429] transition-colors leading-none tabular-nums"
                style={{ fontSize: '1.5rem' }}
              >
                {pct}%
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f0b429] shrink-0" />
              <div>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-xl leading-none">{exactScores}</span>
                <span className="text-[#5a7090] text-xs ml-1.5">{t('exact')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'rgba(240,180,41,0.25)' }} />
              <div>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-white text-xl leading-none">{correctOutcomes}</span>
                <span className="text-[#5a7090] text-xs ml-1.5">{t('correct')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-[#7080a0] text-xl leading-none">{total}</span>
                <span className="text-[#5a7090] text-xs ml-1.5">{t('graded')}</span>
              </div>
            </div>
          </div>
        </div>

        <FormStrip predictions={predictions} matches={matches} />
      </div>
    </Link>
  )
}

// ── My Leagues Scroll ─────────────────────────────────────────────────────────

function LeagueMiniLeaderboard({ entries, currentUserId, isLoading }: {
  entries: LeaderboardEntry[]
  currentUserId: string | undefined
  isLoading: boolean
}) {
  const t = useTranslations('dashboard')
  if (isLoading) {
    return (
      <div className="space-y-1.5 mt-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-5" />)}
      </div>
    )
  }

  const hasScores = entries.some(e => e.live_total > 0)
  if (!hasScores) {
    return <p className="text-xs text-[#3f5068] mt-3 font-medium">{t('no_scores_yet')}</p>
  }

  const top3 = entries.slice(0, 3)
  const userInTop3 = top3.some(e => e.user.id === currentUserId)
  const userEntry = !userInTop3 ? entries.find(e => e.user.id === currentUserId) : undefined
  const displayEntries = userEntry ? top3.slice(0, 2) : top3

  const rankColor = (rank: number) => {
    if (rank === 1) return '#f0b429'
    if (rank === 2) return '#94a3b8'
    if (rank === 3) return '#cd7c41'
    return '#5a7090'
  }

  return (
    <div className="mt-3 space-y-0.5">
      {displayEntries.map(entry => {
        const isMe = entry.user.id === currentUserId
        return (
          <div
            key={entry.user.id}
            className="flex items-center gap-2 py-1 px-1.5 rounded-md"
            style={isMe ? { background: 'rgba(240,180,41,0.07)' } : undefined}
          >
            <span
              className="text-[11px] font-bold shrink-0 w-4 text-center"
              style={{ color: rankColor(entry.rank) }}
            >
              {entry.rank}
            </span>
            <span className={`flex-1 text-xs truncate font-medium ${isMe ? 'text-[#f0b429]' : 'text-[#7888a0]'}`}>
              {entry.user.username}{isMe ? ` (${t('you')})` : ''}
            </span>
            <span className={`text-xs font-bold tabular-nums shrink-0 font-[family-name:var(--font-oswald)] ${isMe ? 'text-[#f0b429]' : 'text-white'}`}>
              {entry.live_total}
            </span>
          </div>
        )
      })}

      {userEntry && (
        <>
          <div className="px-1.5 py-0.5">
            <span className="text-[10px] text-[#3f5068] tracking-widest font-bold">···</span>
          </div>
          <div
            className="flex items-center gap-2 py-1 px-1.5 rounded-md"
            style={{ background: 'rgba(240,180,41,0.07)' }}
          >
            <span className="text-[11px] font-bold shrink-0 w-4 text-center" style={{ color: rankColor(userEntry.rank) }}>
              {userEntry.rank}
            </span>
            <span className="flex-1 text-xs truncate font-medium text-[#f0b429]">
              {userEntry.user.username} ({t('you')})
            </span>
            <span className="text-xs font-bold tabular-nums shrink-0 font-[family-name:var(--font-oswald)] text-[#f0b429]">
              {userEntry.live_total}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function MyLeaguesScroll({ tournaments, leaderboards, currentUserId, loading }: {
  tournaments: Tournament[]
  leaderboards: Array<{ data: { entries: LeaderboardEntry[] } | undefined; isLoading: boolean }>
  currentUserId: string | undefined
  loading: boolean
}) {
  const t = useTranslations('dashboard')
  return (
    <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <SectionLabel
        title={t('my_leagues')}
        action={
          <Link href="/leagues" className="text-[11px] text-[#5a7090] hover:text-[#f0b429] transition-colors font-medium">
            {t('manage')}
          </Link>
        }
      />

      {loading ? (
        <div className="flex gap-3">
          {[1, 2].map(i => (
            <div key={i} style={{ minWidth: 200 }}>
              <Skeleton className="h-[116px] w-full" />
            </div>
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center py-6 gap-3 text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
            style={{ background: 'rgba(240,180,41,0.07)', border: '1px solid rgba(240,180,41,0.15)' }}
          >
            🏟️
          </div>
          <div>
            <p className="text-white text-sm font-semibold mb-1">{t('no_leagues_title')}</p>
            <p className="text-[#5a7090] text-xs">{t('no_leagues_desc')}</p>
          </div>
          <Link
            href="/leagues"
            className="bg-[#f0b429] text-[#080c14] px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#fcd86e] transition-all"
          >
            {t('join_or_create')}
          </Link>
        </div>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
        >
          {tournaments.map((t, i) => {
            const lb = leaderboards[i]
            const entries = lb?.data?.entries ?? []
            return (
              <Link
                key={t.id}
                href={`/tournaments/${t.invite_code}`}
                className="block shrink-0 group"
                style={{ minWidth: 200, maxWidth: 248 }}
              >
                <div
                  className="rounded-xl p-3.5 transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,180,41,0.2)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-[family-name:var(--font-oswald)] font-semibold text-white text-sm uppercase tracking-wide truncate group-hover:text-[#f0b429] transition-colors">
                      {t.name}
                    </span>
                    <span className="text-[#5a7090] text-xs shrink-0 ml-1.5 group-hover:text-[#f0b429] transition-colors">→</span>
                  </div>
                  <LeagueMiniLeaderboard
                    entries={entries}
                    currentUserId={currentUserId}
                    isLoading={lb?.isLoading ?? false}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Match Rail helpers ────────────────────────────────────────────────────────

// ── Match Rail ────────────────────────────────────────────────────────────────


function MatchRailCard({ match, prediction, timezone }: { match: Match; prediction?: Prediction; timezone?: string | null }) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'
  const isUpcoming = !isLive && !isFinished

  // ── Header — semantic colour per state ──────────────────────────────────────
  const headerStyle = isLive
    ? { background: 'linear-gradient(135deg, #c8900a 0%, #f0b429 55%, #f5c842 100%)' }
    : isUpcoming
    ? { background: 'linear-gradient(135deg, #0c1e3c 0%, #0f2848 60%, #0c1e3c 100%)', borderBottom: '1px solid rgba(80,140,220,0.12)' }
    : { background: 'rgba(255,255,255,0.04)' }

  const headerDateColor = isLive ? '#3a2200' : isUpcoming ? '#5a8fbe' : '#4a6080'

  const statusEl = isLive ? (
    <span className="flex items-center gap-1.5" style={{ color: '#3a2200' }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-700 animate-pulse-live" />
      <span className="text-[0.65rem] sm:text-xs font-bold uppercase tracking-wider">
        {match.minute != null ? `${match.minute}'` : 'LIVE'}
      </span>
    </span>
  ) : isFinished ? (
    <span className="text-[0.65rem] sm:text-xs font-bold uppercase tracking-wider" style={{ color: '#4a6080' }}>{t('ft')}</span>
  ) : (
    // upcoming — time only; countdown moves to bottom zone
    <span className="text-[0.65rem] sm:text-xs font-bold" style={{ color: '#5a8fbe' }}>
      {formatMatchTime(match.kickoff_at, timezone, locale)}
    </span>
  )

  // ── Bottom zone — fixed two-row structure on every card ───────────────────
  // Row 1: pick / action link  |  Row 2: countdown (upcoming) or invisible spacer
  const mainRow: React.ReactNode = (isFinished || isLive) ? (
    prediction ? (
      <Link href="/predictions" className="text-[0.68rem] sm:text-xs font-semibold text-[#f0b429] hover:text-white transition-colors">
        {t('see_your_pick')}
      </Link>
    ) : (
      <Link href="/predictions" className="text-[0.68rem] sm:text-xs font-medium text-[#3a4d64] hover:text-[#5a7090] transition-colors">
        {t('no_pick')}
      </Link>
    )
  ) : (
    prediction ? (
      <span className="text-[0.65rem] sm:text-xs font-semibold" style={{ color: '#4ade80' }}>
        ✓ <span className="font-[family-name:var(--font-oswald)] font-bold">{prediction.predicted_home}–{prediction.predicted_away}</span> {t('picked')}
      </span>
    ) : (
      <Link href="/predictions" className="text-[0.7rem] sm:text-xs font-bold text-[#f0b429] hover:text-white transition-colors">
        {t('pick')}
      </Link>
    )
  )

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      {/* Header strip */}
      <div className="px-3.5 py-2.5 flex items-center justify-between" style={headerStyle}>
        <span className="text-[0.65rem] sm:text-xs font-bold uppercase tracking-[0.15em]" style={{ color: headerDateColor }}>
          {formatMatchDate(match.kickoff_at, timezone, locale)}
        </span>
        {statusEl}
      </div>

      {/* Team rows — each row is fixed height; flag uses object-contain so no cropping */}
      <div className="px-3 py-4 space-y-2.5">
        {[
          { name: match.home_team, score: match.home_score },
          { name: match.away_team, score: match.away_score },
        ].map((team) => {
          const flagCode = getTeamFlagCode(team.name)
          const displayName = translateTeamName(team.name, locale)
          return (
            <div key={team.name} className="flex items-center gap-2 h-[36px]">
              {/* Flag container — object-contain so square/wide flags never clip */}
              <div
                className="shrink-0 rounded flex items-center justify-center"
                style={{ width: 44, height: 36 }}
              >
                {flagCode ? (
                  <Image
                    src={getFlagUrl(flagCode, 80)}
                    alt={displayName}
                    width={44}
                    height={36}
                    className="rounded object-contain w-full h-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-[8px] text-white/20">?</span>
                )}
              </div>
              {/* Name: full on mobile, abbreviation on desktop (lg+) */}
              <span className="flex-1 lg:hidden font-[family-name:var(--font-oswald)] font-semibold text-[0.8rem] sm:text-[0.9rem] uppercase tracking-wider text-white truncate">
                {displayName}
              </span>
              <span className="flex-1 hidden lg:block font-[family-name:var(--font-oswald)] font-bold text-[0.9rem] sm:text-[1rem] uppercase tracking-widest text-white text-center">
                {getTeamAbbr(team.name)}
              </span>
              {/* Score — always rendered; invisible for upcoming to lock card height */}
              <span
                className="font-[family-name:var(--font-oswald)] font-bold text-[1.75rem] text-[#f0b429] leading-none tabular-nums shrink-0 w-8 text-right"
                style={{ visibility: (isFinished || isLive) ? 'visible' : 'hidden' }}
              >
                {team.score ?? '—'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

      {/* Bottom zone — fixed height, two-row layout, same structure on every card */}
      <div className="px-3.5 flex flex-col items-center justify-center h-[48px] gap-0.5">
        {mainRow}
        {/* Countdown for upcoming; invisible spacer for past/live keeps height identical */}
        <span
          className="text-[0.58rem] sm:text-[0.65rem] font-medium text-[#2e4a66]"
          style={{ visibility: isUpcoming ? 'visible' : 'hidden' }}
        >
          {formatCountdown(match.kickoff_at)}
        </span>
      </div>
    </div>
  )
}

function MatchRailCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      <div className="px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="h-2.5 w-14 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.07)' }} />
      </div>
      <div className="px-3.5 py-4 space-y-3.5">
        {[1, 2].map(i => (
          <div key={i} className="flex items-center gap-2.5">
            <div
              className="rounded shrink-0 animate-pulse"
              style={{ width: 38, height: 27, background: 'rgba(255,255,255,0.06)' }}
            />
            <div className="flex-1 h-3 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
      <div className="min-h-[44px]" />
    </div>
  )
}

function MatchRail({ matches, predictions, loading, timezone }: {
  matches: Match[]
  predictions: Prediction[]
  loading: boolean
  timezone?: string | null
}) {
  const t = useTranslations('dashboard')
  const N = usePageSize()
  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  )
  const predByMatch = new Map(predictions.map(p => [p.match_id, p]))
  const total = sorted.length

  const [startIndex, setStartIndex] = useState(0)
  const anchoredRef = useRef(false)

  // Anchor to first live → first scheduled → 0, once data arrives
  useEffect(() => {
    if (!loading && total > 0 && !anchoredRef.current) {
      anchoredRef.current = true
      const liveIdx = sorted.findIndex(m => m.status === 'live')
      const scheduledIdx = sorted.findIndex(m => m.status === 'scheduled')
      const anchor = liveIdx !== -1 ? liveIdx : scheduledIdx !== -1 ? scheduledIdx : 0
      setStartIndex(Math.min(anchor, Math.max(0, total - N)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, total])

  // Clamp when N changes (e.g. window resize)
  useEffect(() => {
    setStartIndex(prev => Math.min(prev, Math.max(0, total - N)))
  }, [N, total])

  const maxStart = Math.max(0, total - N)
  const canGoBack = startIndex > 0
  const canGoForward = startIndex < maxStart
  const visibleMatches = sorted.slice(startIndex, startIndex + N)

  // Anchor index — first live, else first scheduled, else 0 (clamped to last page)
  const liveIdx = sorted.findIndex(m => m.status === 'live')
  const scheduledIdx = sorted.findIndex(m => m.status === 'scheduled')
  const anchorRaw = liveIdx !== -1 ? liveIdx : scheduledIdx !== -1 ? scheduledIdx : 0
  const anchorIndex = Math.min(anchorRaw, Math.max(0, total - N))
  const isAtAnchor = startIndex === anchorIndex

  const navBtnClass =
    'w-8 h-8 rounded-full flex items-center justify-center text-[#5a7090] hover:text-white hover:bg-white/10 transition-all text-2xl leading-none select-none'

  return (
    <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <SectionLabel
        title={t('matches')}
        action={
          <div className="flex items-center gap-3">
            {!isAtAnchor && (
              <button
                onClick={() => setStartIndex(anchorIndex)}
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full transition-all hover:brightness-125"
                style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.25)', color: '#f0b429' }}
              >
                {t('now')}
              </button>
            )}
            <Link href="/predictions" className="text-[11px] text-[#5a7090] hover:text-[#f0b429] transition-colors font-medium">
              {t('all_picks')}
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="flex gap-3">
          {Array.from({ length: N }).map((_, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0 }}>
              <MatchRailCardSkeleton />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <p className="text-[#5a7090] text-sm py-6 text-center">{t('no_matches')}</p>
      ) : (
        <div className="flex items-center gap-2">
          {/* Back button — always reserve space */}
          <div style={{ width: 32, flexShrink: 0 }}>
            {canGoBack && (
              <button
                onClick={() => setStartIndex(i => Math.max(0, i - N))}
                className={navBtnClass}
                aria-label="Previous matches"
              >
                ‹
              </button>
            )}
          </div>

          {/* Cards */}
          <div
            className="flex-1 grid gap-3"
            style={{ gridTemplateColumns: `repeat(${visibleMatches.length}, minmax(0, 1fr))` }}
          >
            {visibleMatches.map(m => (
              <MatchRailCard key={m.id} match={m} prediction={predByMatch.get(m.id)} timezone={timezone} />
            ))}
          </div>

          {/* Forward button — always reserve space */}
          <div style={{ width: 32, flexShrink: 0 }}>
            {canGoForward && (
              <button
                onClick={() => setStartIndex(i => Math.min(maxStart, i + N))}
                className={navBtnClass}
                aria-label="Next matches"
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const qc = useQueryClient()
  const [reloading, setReloading] = useState(false)

  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useOnboardingGuard(me, meLoading)

  async function handleReload() {
    setReloading(true)
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['matches'] }),
      qc.invalidateQueries({ queryKey: ['predictions'] }),
      qc.invalidateQueries({ queryKey: ['leaderboard'] }),
      qc.invalidateQueries({ queryKey: ['tournaments'] }),
    ])
    setReloading(false)
  }

  const { data: tournaments = [], isLoading: tournamentsLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: api.listTournaments,
  })

  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.listMatches(),
    refetchInterval: 60_000,
  })

  const { data: predictions = [], isLoading: predictionsLoading } = useQuery({
    queryKey: ['predictions'],
    queryFn: () => api.listPredictions(),
    refetchInterval: 60_000,
  })

  const leaderboards = useQueries({
    queries: tournaments.map(t => ({
      queryKey: ['leaderboard', t.invite_code],
      queryFn: () => api.getLeaderboard(t.invite_code),
      refetchInterval: 60_000,
    })),
  })

  const dataLoading = matchesLoading || predictionsLoading

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white leading-none">
            {t('title')}
          </h1>
          <p className="text-[#5a7090] text-sm mt-1.5 font-medium">
            {me ? t('welcome_back', { name: me.username }) : t('subtitle')}
          </p>
        </div>
        <button
          onClick={handleReload}
          disabled={reloading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          style={{ color: '#4a6080' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8a9ab8'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4a6080'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={reloading ? 'animate-spin' : ''}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          {reloading ? t('reloading') : t('reload')}
        </button>
      </div>

      {/* Tier 1 — Match Rail */}
      <div className="mb-4">
        <MatchRail matches={matches} predictions={predictions} loading={dataLoading} timezone={me?.timezone} />
      </div>

      {/* Tier 2 — Accuracy + My Leagues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <AccuracyCard predictions={predictions} matches={matches} />
        <MyLeaguesScroll
          tournaments={tournaments}
          leaderboards={leaderboards as Array<{ data: { entries: LeaderboardEntry[] } | undefined; isLoading: boolean }>}
          currentUserId={me?.id}
          loading={tournamentsLoading}
        />
      </div>

      {/* Tier 3 — Standings shortcut */}
      <div className="mt-4">
        <Link
          href="/standings"
          className="flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-200 group"
          style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,180,41,0.2)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <span className="block w-[3px] h-5 rounded-full bg-[#f0b429]" />
            <div>
              <p className="font-[family-name:var(--font-oswald)] text-[1.05rem] font-bold uppercase tracking-[0.2em] text-[#90a0b8] group-hover:text-white transition-colors">
                {t('standings_title')}
              </p>
              <p className="text-[#3a5070] text-xs mt-0.5">{t('standings_desc')}</p>
            </div>
          </div>
          <span className="text-[#3f5068] group-hover:text-[#f0b429] transition-colors text-sm font-medium">→</span>
        </Link>
      </div>

    </div>
  )
}
