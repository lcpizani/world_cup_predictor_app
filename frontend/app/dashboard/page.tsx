'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useQuery, useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { computeAccuracy, formatCountdown, toMatchdayCDT, isLockingNow } from '@/lib/stats'
import { getTeamFlagCode, getFlagUrl, getTeamAbbr } from '@/lib/flags'
import type { Match, Prediction, LeaderboardEntry, Tournament } from '@/types/api'

// ── Primitives ────────────────────────────────────────────────────────────────

function Flag({ name, size = 28 }: { name: string; size?: number }) {
  const code = getTeamFlagCode(name)
  if (!code) return (
    <span
      className="inline-block rounded shrink-0"
      style={{
        width: size,
        height: Math.round(size * 0.7),
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    />
  )
  const srcSize = size >= 40 ? 80 : 40
  return (
    <Image
      src={getFlagUrl(code, srcSize)}
      alt={name}
      width={size}
      height={Math.round(size * 0.7)}
      className="rounded object-cover shrink-0"
      style={{ border: '1px solid rgba(255,255,255,0.15)' }}
      unoptimized
    />
  )
}

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
      <span className="text-[10px] text-[#5a7090] font-medium uppercase tracking-widest mr-1">Form</span>
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

// ── Recent Results card ───────────────────────────────────────────────────────

type ResultMeta = { outcome: 'exact' | 'correct' | 'wrong' | 'pending'; borderColor: string }

function getResultMeta(p: Prediction, m: Match): ResultMeta {
  if (m.home_score === null || m.away_score === null) {
    return { outcome: 'pending', borderColor: 'rgba(255,255,255,0.06)' }
  }
  const exact = p.predicted_home === m.home_score && p.predicted_away === m.away_score
  if (exact) return { outcome: 'exact', borderColor: 'rgba(74,222,128,0.6)' }
  const correct = Math.sign(p.predicted_home - p.predicted_away) === Math.sign(m.home_score - m.away_score)
  if (correct) return { outcome: 'correct', borderColor: 'rgba(240,180,41,0.6)' }
  return { outcome: 'wrong', borderColor: 'rgba(255,255,255,0.08)' }
}

const OUTCOME_CHIP = {
  exact:   { label: '✓ exact',  bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',   color: '#4ade80' },
  correct: { label: '✓ result', bg: 'rgba(240,180,41,0.10)',  border: 'rgba(240,180,41,0.25)',  color: '#f0b429' },
  wrong:   { label: '✗ wrong',  bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', color: '#4a6080' },
} as const

function MatchCard({ home, away, homeScore, awayScore, meta, predictedHome, predictedAway }: {
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  meta: ResultMeta | null
  predictedHome?: number
  predictedAway?: number
}) {
  const hasPred = predictedHome !== undefined && predictedAway !== undefined
  const chip = meta && meta.outcome !== 'pending' ? OUTCOME_CHIP[meta.outcome] : null

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2.5"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${meta?.borderColor ?? 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {/* Abbreviations + actual score */}
      <div className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-oswald)] text-[11px] font-bold text-[#6080a0] uppercase tracking-wider w-8">
          {getTeamAbbr(home)}
        </span>
        <span className="font-[family-name:var(--font-oswald)] font-bold text-white text-2xl tabular-nums leading-none">
          {homeScore ?? '—'}–{awayScore ?? '—'}
        </span>
        <span className="font-[family-name:var(--font-oswald)] text-[11px] font-bold text-[#6080a0] uppercase tracking-wider w-8 text-right">
          {getTeamAbbr(away)}
        </span>
      </div>

      {/* Flags + predicted score */}
      <div className="flex items-center justify-between">
        <Flag name={home} size={28} />
        {hasPred ? (
          <span className="font-[family-name:var(--font-oswald)] font-bold text-[#f0b429]/50 text-sm tabular-nums leading-none">
            {predictedHome}–{predictedAway}
          </span>
        ) : (
          <span className="text-[10px] text-[#3a4d64] font-medium tracking-wide">no pick</span>
        )}
        <Flag name={away} size={28} />
      </div>

      {/* Outcome chip */}
      <div
        className="flex justify-center pt-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {chip ? (
          <span
            className="text-[10px] font-bold px-2.5 py-[3px] rounded-full tracking-wide"
            style={{ background: chip.bg, border: `1px solid ${chip.border}`, color: chip.color }}
          >
            {chip.label}
          </span>
        ) : (
          <span className="text-[10px] text-[#3a4d64] font-medium">
            {homeScore === null ? 'pending' : 'no pick'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Upcoming Matches ──────────────────────────────────────────────────────────

type PickState = 'picked-safe' | 'picked-locking' | 'no-pick' | 'no-pick-locking'

function getPickState(match: Match, prediction: Prediction | undefined): PickState {
  const locking = isLockingNow(match.kickoff_at)
  if (prediction) return locking ? 'picked-locking' : 'picked-safe'
  return locking ? 'no-pick-locking' : 'no-pick'
}

function formatMatchdayLabel(dateStr: string): string {
  const todayCDT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowCDT = tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  if (dateStr === todayCDT) return 'Today'
  if (dateStr === tomorrowCDT) return 'Tomorrow'
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function UpcomingMatchRow({ match, prediction }: { match: Match; prediction?: Prediction }) {
  const state = getPickState(match, prediction)

  const borderColor =
    state === 'no-pick-locking' ? 'rgba(239,68,68,0.35)' :
    state === 'picked-locking'  ? 'rgba(240,180,41,0.22)' :
    'rgba(255,255,255,0.05)'

  const bgColor = state === 'no-pick-locking' ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.025)'

  const inner = (
    <div
      className="rounded-xl px-3 sm:px-4 py-3.5 flex items-center gap-2 sm:gap-3"
      style={{ background: bgColor, border: `1px solid ${borderColor}` }}
    >
      {/* Home team */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Flag name={match.home_team} size={42} />
        <span className="font-[family-name:var(--font-oswald)] font-semibold text-white text-xs sm:text-sm uppercase tracking-wide truncate">
          {match.home_team}
        </span>
      </div>

      {/* Center */}
      <div className="shrink-0 flex items-center justify-center" style={{ minWidth: 64 }}>
        {prediction ? (
          <span className="font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-xl sm:text-2xl tabular-nums tracking-widest leading-none">
            {prediction.predicted_home}–{prediction.predicted_away}
          </span>
        ) : (
          <span className="font-[family-name:var(--font-oswald)] font-bold text-[#2a3d55] text-xs tracking-[0.3em]">
            VS
          </span>
        )}
      </div>

      {/* Away team */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end">
        <span className="font-[family-name:var(--font-oswald)] font-semibold text-white text-xs sm:text-sm uppercase tracking-wide truncate text-right">
          {match.away_team}
        </span>
        <Flag name={match.away_team} size={42} />
      </div>

      {/* Status + countdown */}
      <div
        className="shrink-0 flex flex-col items-end gap-0.5 pl-2.5"
        style={{ minWidth: 80, borderLeft: '1px solid rgba(255,255,255,0.05)' }}
      >
        {state === 'picked-safe' && (
          <span className="text-xs text-green-400/80 font-semibold leading-tight">✓ picked</span>
        )}
        {state === 'picked-locking' && (
          <span className="text-xs text-[#f0b429] font-semibold leading-tight">locking</span>
        )}
        {state === 'no-pick' && (
          <span className="text-sm text-[#f0b429] font-bold leading-tight">Pick →</span>
        )}
        {state === 'no-pick-locking' && (
          <span className="text-xs text-red-400 font-bold uppercase tracking-wide leading-tight">PICK NOW</span>
        )}
        <span className="text-[11px] text-[#4a6080] font-medium leading-tight">
          {formatCountdown(match.kickoff_at)}
        </span>
      </div>
    </div>
  )

  if (state === 'no-pick' || state === 'no-pick-locking') {
    return (
      <Link href="/predictions" className="block hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    )
  }
  return inner
}

function UpcomingMatchesBlock({ matches, predictions, loading }: {
  matches: Match[]
  predictions: Prediction[]
  loading: boolean
}) {
  const predByMatch = new Map(predictions.map(p => [p.match_id, p]))

  const scheduled = matches.filter(m => m.status === 'scheduled')
  const matchdays = [...new Set(scheduled.map(m => toMatchdayCDT(m.kickoff_at)))].sort()
  const todayCDT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const nearestMatchday = matchdays.includes(todayCDT) ? todayCDT : (matchdays[0] ?? null)

  const matchdayMatches = nearestMatchday
    ? scheduled
        .filter(m => toMatchdayCDT(m.kickoff_at) === nearestMatchday)
        .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
    : []

  const allPicked = matchdayMatches.length > 0 && matchdayMatches.every(m => predByMatch.has(m.id))
  const nextMatchday = matchdays.find(d => d > (nearestMatchday ?? ''))

  return (
    <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="block w-[3px] h-5 rounded-full bg-[#f0b429]" />
          <div className="flex items-center gap-2">
            <p className="font-[family-name:var(--font-oswald)] text-[1.05rem] font-bold uppercase tracking-[0.2em] text-[#90a0b8]">
              Upcoming
            </p>
            {nearestMatchday && (
              <>
                <span className="text-[#2a3d55] text-[0.8rem]">·</span>
                <p className="font-[family-name:var(--font-oswald)] text-[0.9rem] font-bold uppercase tracking-[0.18em] text-[#f0b429]/70">
                  {formatMatchdayLabel(nearestMatchday)}
                </p>
              </>
            )}
          </div>
        </div>
        <Link href="/predictions" className="text-[11px] text-[#5a7090] hover:text-[#f0b429] transition-colors font-medium">
          All picks →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : matchdayMatches.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[#5a7090] text-sm">No upcoming matches</p>
        </div>
      ) : allPicked ? (
        <div className="flex flex-col items-center py-8 gap-2.5 text-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            ✓
          </div>
          <p className="text-white font-semibold text-sm">You&apos;re all set for today</p>
          {nextMatchday ? (
            <p className="text-[#5a7090] text-xs">
              Next matches: <span className="text-white/50">{formatMatchdayLabel(nextMatchday)}</span>
            </p>
          ) : (
            <p className="text-[#5a7090] text-xs">No more upcoming matches</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {matchdayMatches.map(m => (
            <UpcomingMatchRow key={m.id} match={m} prediction={predByMatch.get(m.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Accuracy Card ─────────────────────────────────────────────────────────────

function AccuracyCard({ predictions, matches }: { predictions: Prediction[]; matches: Match[] }) {
  const { correctOutcomes, exactScores, total } = computeAccuracy(predictions, matches)

  if (total === 0) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
        <SectionLabel title="Accuracy" />
        <div className="py-6 flex flex-col items-center gap-2 text-center">
          <p className="text-[#5a7090] text-sm">No graded predictions yet</p>
          <Link href="/predictions" className="text-xs text-[#f0b429] hover:text-white transition-colors font-medium">
            Add picks →
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
        <SectionLabel title="Accuracy" />

        <div className="flex items-center gap-5">
          {/* Donut ring */}
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

          {/* Legend */}
          <div className="flex flex-col gap-3 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f0b429] shrink-0" />
              <div>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-xl leading-none">{exactScores}</span>
                <span className="text-[#5a7090] text-xs ml-1.5">exact</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'rgba(240,180,41,0.25)' }} />
              <div>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-white text-xl leading-none">{correctOutcomes}</span>
                <span className="text-[#5a7090] text-xs ml-1.5">correct</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-[#7080a0] text-xl leading-none">{total}</span>
                <span className="text-[#5a7090] text-xs ml-1.5">graded</span>
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
  if (isLoading) {
    return (
      <div className="space-y-1.5 mt-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-5" />)}
      </div>
    )
  }

  const hasScores = entries.some(e => e.total_points > 0)
  if (!hasScores) {
    return <p className="text-xs text-[#3f5068] mt-3 font-medium">No scores yet</p>
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
              {entry.user.username}{isMe ? ' (you)' : ''}
            </span>
            <span className={`text-xs font-bold tabular-nums shrink-0 font-[family-name:var(--font-oswald)] ${isMe ? 'text-[#f0b429]' : 'text-white'}`}>
              {entry.total_points}
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
              {userEntry.user.username} (you)
            </span>
            <span className="text-xs font-bold tabular-nums shrink-0 font-[family-name:var(--font-oswald)] text-[#f0b429]">
              {userEntry.total_points}
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
  return (
    <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <SectionLabel
        title="My Leagues"
        action={
          <Link href="/leagues" className="text-[11px] text-[#5a7090] hover:text-[#f0b429] transition-colors font-medium">
            Manage →
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
            <p className="text-white text-sm font-semibold mb-1">No leagues yet</p>
            <p className="text-[#5a7090] text-xs">Join a league or create one to get started</p>
          </div>
          <Link
            href="/leagues"
            className="bg-[#f0b429] text-[#080c14] px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#fcd86e] transition-all"
          >
            Join or Create
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

// ── Recent Results ────────────────────────────────────────────────────────────

function RecentResultsBlock({ matches, predictions, loading }: {
  matches: Match[]
  predictions: Prediction[]
  loading: boolean
}) {
  const predByMatch = new Map(predictions.map(p => [p.match_id, p]))
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000

  const sorted = [...matches]
    .filter(m => m.status === 'finished')
    .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())

  const lastDay = sorted.filter(m => new Date(m.kickoff_at).getTime() >= oneDayAgo)
  const recent = lastDay.length > 0 ? lastDay : sorted.slice(0, 8)

  return (
    <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <SectionLabel
        title="Recent Results"
        action={
          <Link href="/predictions" className="text-[11px] text-[#5a7090] hover:text-[#f0b429] transition-colors font-medium">
            All results →
          </Link>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[118px]" />)}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-[#5a7090] text-sm py-6 text-center">No results yet</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {recent.map(m => {
            const p = predByMatch.get(m.id)
            const meta = p ? getResultMeta(p, m) : null
            return (
              <MatchCard
                key={m.id}
                home={m.home_team}
                away={m.away_team}
                homeScore={m.home_score}
                awayScore={m.away_score}
                meta={meta}
                predictedHome={p?.predicted_home}
                predictedAway={p?.predicted_away}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.getMe })

  const { data: tournaments = [], isLoading: tournamentsLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: api.listTournaments,
  })

  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.listMatches(),
  })

  const { data: predictions = [], isLoading: predictionsLoading } = useQuery({
    queryKey: ['predictions'],
    queryFn: () => api.listPredictions(),
  })

  const leaderboards = useQueries({
    queries: tournaments.map(t => ({
      queryKey: ['leaderboard', t.invite_code],
      queryFn: () => api.getLeaderboard(t.invite_code),
      staleTime: 60_000,
    })),
  })

  const dataLoading = matchesLoading || predictionsLoading

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white leading-none">
          Dashboard
        </h1>
        <p className="text-[#5a7090] text-sm mt-1.5 font-medium">
          {me ? `Welcome back, ${me.username}` : 'Your World Cup at a glance'}
        </p>
      </div>

      {/* Tier 1 — Upcoming Matches */}
      <div className="mb-4">
        <UpcomingMatchesBlock matches={matches} predictions={predictions} loading={dataLoading} />
      </div>

      {/* Tier 2 — Accuracy + My Leagues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">
        <AccuracyCard predictions={predictions} matches={matches} />
        <MyLeaguesScroll
          tournaments={tournaments}
          leaderboards={leaderboards as Array<{ data: { entries: LeaderboardEntry[] } | undefined; isLoading: boolean }>}
          currentUserId={me?.id}
          loading={tournamentsLoading}
        />
      </div>

      {/* Tier 3 — Recent Results */}
      <RecentResultsBlock matches={matches} predictions={predictions} loading={dataLoading} />

    </div>
  )
}
