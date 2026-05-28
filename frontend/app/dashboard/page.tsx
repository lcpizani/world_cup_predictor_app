'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useQuery, useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { computeAccuracy, formatCountdown } from '@/lib/stats'
import { getTeamFlagCode, getFlagUrl } from '@/lib/flags'
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
        border: '1px solid rgba(255,255,255,0.08)',
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
      style={{ border: '1px solid rgba(255,255,255,0.1)' }}
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

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="block w-0.5 h-3.5 rounded-full bg-[#f0b429]/70" />
      <p className="font-[family-name:var(--font-oswald)] text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#5a6a82]">
        {title}
      </p>
    </div>
  )
}

// ── Match row (compact, used in Recent Results) ───────────────────────────────

function MatchRow({ home, away, center, sub }: {
  home: string
  away: string
  center: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Flag name={home} size={22} />
        <div className="flex-1 flex flex-col items-center">
          {center}
        </div>
        <Flag name={away} size={22} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#3f5068] truncate max-w-[80px] font-medium">{home}</span>
        {sub}
        <span className="text-[10px] text-[#3f5068] truncate max-w-[80px] text-right font-medium">{away}</span>
      </div>
    </div>
  )
}

// ── Match card (larger, used in My Picks + Next Games) ────────────────────────

function MatchCard({ home, away, center, meta }: {
  home: string
  away: string
  center: React.ReactNode
  meta: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex flex-col items-center gap-2">
          <Flag name={home} size={44} />
          <span className="font-[family-name:var(--font-oswald)] font-bold text-white text-xs uppercase tracking-wide text-center leading-tight line-clamp-2">
            {home}
          </span>
        </div>

        <div className="shrink-0 flex flex-col items-center px-2">
          {center}
        </div>

        <div className="flex-1 flex flex-col items-center gap-2">
          <Flag name={away} size={44} />
          <span className="font-[family-name:var(--font-oswald)] font-bold text-white text-xs uppercase tracking-wide text-center leading-tight line-clamp-2">
            {away}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {meta}
      </div>
    </div>
  )
}

// ── My Picks ──────────────────────────────────────────────────────────────────

function MyPicksBlock({ matches, predictions, loading }: {
  matches: Match[]
  predictions: Prediction[]
  loading: boolean
}) {
  const predByMatch = new Map(predictions.map(p => [p.match_id, p]))
  const picks = [...matches]
    .filter(m => m.status === 'scheduled' && predByMatch.has(m.id))
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
    .slice(0, 3)

  return (
    <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between">
        <SectionLabel title="My Picks" />
        <Link href="/predictions" className="text-[11px] text-[#3f5068] hover:text-[#f0b429] transition-colors mb-4 font-medium">
          All picks →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 flex-1">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
      ) : picks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-2">
          <p className="text-[#3f5068] text-sm">No upcoming picks yet</p>
          <Link href="/predictions" className="text-xs text-[#f0b429] hover:text-white transition-colors font-medium">
            Add your picks →
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {picks.map(m => {
            const p = predByMatch.get(m.id)!
            return (
              <MatchCard
                key={m.id}
                home={m.home_team}
                away={m.away_team}
                center={
                  <span className="font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-2xl tracking-widest tabular-nums">
                    {p.predicted_home} – {p.predicted_away}
                  </span>
                }
                meta={
                  <>
                    <span className="text-xs text-[#3f5068] font-medium">{formatCountdown(m.kickoff_at)}</span>
                    <span className="text-xs text-[#3f5068]">{m.stage}</span>
                  </>
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Next Games ────────────────────────────────────────────────────────────────

function NextGamesBlock({ matches, predictions, loading }: {
  matches: Match[]
  predictions: Prediction[]
  loading: boolean
}) {
  const predMatchIds = new Set(predictions.map(p => p.match_id))
  const upcoming = [...matches]
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
    .slice(0, 3)

  return (
    <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <SectionLabel title="Next Games" />

      {loading ? (
        <div className="space-y-2 flex-1">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
      ) : upcoming.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-[#3f5068] text-sm">No upcoming games</p>
        </div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {upcoming.map(m => {
            const hasPick = predMatchIds.has(m.id)
            return (
              <MatchCard
                key={m.id}
                home={m.home_team}
                away={m.away_team}
                center={
                  <span className="font-[family-name:var(--font-oswald)] font-bold text-[#1e2d40] text-base tracking-[0.25em]">
                    VS
                  </span>
                }
                meta={
                  <>
                    <span className="text-xs text-[#f0b429]/70 font-medium">{formatCountdown(m.kickoff_at)}</span>
                    {hasPick
                      ? <span className="flex items-center gap-1 text-xs text-green-500/60 font-medium"><span>✓</span> picked</span>
                      : <Link href="/predictions" className="text-xs text-[#f0b429] hover:text-white transition-colors font-medium">Add pick →</Link>
                    }
                  </>
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Recent Results ────────────────────────────────────────────────────────────

type ResultMeta = { text: string; color: string }
function getResultMeta(p: Prediction, m: Match): ResultMeta {
  if (m.home_score === null || m.away_score === null) return { text: '—', color: 'text-[#3f5068]' }
  const exact = p.predicted_home === m.home_score && p.predicted_away === m.away_score
  if (exact) return { text: `${p.predicted_home}–${p.predicted_away} ✓`, color: 'text-green-400' }
  const win = Math.sign(p.predicted_home - p.predicted_away) === Math.sign(m.home_score - m.away_score)
  if (win) return { text: `${p.predicted_home}–${p.predicted_away} ~`, color: 'text-[#f0b429]' }
  return { text: `${p.predicted_home}–${p.predicted_away} ✗`, color: 'text-[#3f5068]' }
}

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
  const recent = lastDay.length > 0 ? lastDay : sorted.slice(0, 5)

  return (
    <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <SectionLabel title="Recent Results" />

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-[68px]" />)}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-[#3f5068] text-sm py-6 text-center">No results yet</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {recent.map(m => {
            const p = predByMatch.get(m.id)
            const meta = p ? getResultMeta(p, m) : null
            return (
              <MatchRow
                key={m.id}
                home={m.home_team}
                away={m.away_team}
                center={
                  <span className="font-[family-name:var(--font-oswald)] font-bold text-white text-xl tracking-wide">
                    {m.home_score} – {m.away_score}
                  </span>
                }
                sub={
                  meta
                    ? <span className={`text-[10px] font-mono font-bold ${meta.color}`}>{meta.text}</span>
                    : <span className="text-[10px] text-[#1e2d40]">no pick</span>
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── My Leagues ────────────────────────────────────────────────────────────────

function MyLeaguesBlock({ tournaments, leaderboards, currentUserId, loading }: {
  tournaments: Tournament[]
  leaderboards: Array<{ data: { entries: LeaderboardEntry[] } | undefined; isLoading: boolean }>
  currentUserId: string | undefined
  loading: boolean
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between">
        <SectionLabel title="My Leagues" />
        <Link href="/leagues" className="text-[11px] text-[#3f5068] hover:text-[#f0b429] transition-colors mb-4 font-medium">
          Manage leagues →
        </Link>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {[1,2].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-4 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'rgba(240,180,41,0.07)', border: '1px solid rgba(240,180,41,0.15)' }}
          >
            🏟️
          </div>
          <div>
            <p className="text-white text-sm font-semibold mb-1">No leagues yet</p>
            <p className="text-[#3f5068] text-xs">Join a league or create one to get started</p>
          </div>
          <Link
            href="/leagues"
            className="bg-[#f0b429] text-[#080c14] px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#fcd86e] transition-all"
          >
            Join or Create a League
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {tournaments.map((t, i) => {
            const lb = leaderboards[i]
            const entries = lb?.data?.entries ?? []
            const leader = entries[0]
            const userEntry = entries.find(e => e.user.id === currentUserId)
            return (
              <Link key={t.id} href={`/tournaments/${t.invite_code}`}>
                <div
                  className="rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer h-full group"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,180,41,0.18)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-[family-name:var(--font-oswald)] font-semibold text-white text-sm uppercase tracking-wide truncate max-w-[160px] group-hover:text-[#f0b429] transition-colors">
                      {t.name}
                    </span>
                    <span className="text-[#3f5068] group-hover:text-[#f0b429] transition-colors text-sm shrink-0 ml-2">→</span>
                  </div>
                  {lb?.isLoading ? (
                    <Skeleton className="h-3 w-28 mt-1" />
                  ) : leader ? (
                    <div className="space-y-0.5">
                      <p className="text-xs text-[#3f5068]">
                        <span className="text-[#f0b429]/80 font-semibold">{leader.user.username}</span>
                        <span className="text-[#1e2d40]"> · {leader.total_points} pts</span>
                      </p>
                      {userEntry && userEntry.rank > 1 && (
                        <p className="text-[10px] text-[#2d3e52]">
                          You: #{userEntry.rank} · {userEntry.total_points} pts
                        </p>
                      )}
                      {userEntry?.rank === 1 && (
                        <p className="text-[11px] text-[#f0b429]/60 font-medium">Leading</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#1e2d40]">No scores yet</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Accuracy Bar ──────────────────────────────────────────────────────────────

function AccuracyBar({ predictions, matches }: { predictions: Prediction[]; matches: Match[] }) {
  const { correctOutcomes, exactScores, total } = computeAccuracy(predictions, matches)
  if (total === 0) return null
  const pct = Math.round((correctOutcomes / total) * 100)
  const exactPct = Math.round((exactScores / total) * 100)
  return (
    <div className="rounded-2xl px-5 py-4 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="font-[family-name:var(--font-oswald)] text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#5a6a82]">
        Accuracy
      </span>
      <div className="flex items-center gap-3 flex-1 min-w-[180px]">
        <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {/* Full correct-outcome bar */}
          <div className="h-full rounded-full relative" style={{ width: `${pct}%`, background: 'rgba(240,180,41,0.35)' }}>
            {/* Exact-score overlay on top */}
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ width: `${total > 0 ? Math.round((exactScores / correctOutcomes) * 100) : 0}%`, background: '#f0b429' }}
            />
          </div>
        </div>
        <span className="text-sm font-bold text-white tabular-nums font-[family-name:var(--font-oswald)]">{pct}%</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-[#3f5068]">
        <span>
          <span className="text-white font-semibold">{correctOutcomes}</span>/{total} correct
        </span>
        <span className="text-[#1e2d40]">·</span>
        <span>
          <span className="text-[#f0b429] font-semibold">{exactScores}</span> exact
        </span>
      </div>
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
        <p className="text-[#3f5068] text-sm mt-1.5 font-medium">
          {me ? `Welcome back, ${me.username}` : 'Your World Cup at a glance'}
        </p>
      </div>

      {/* Accuracy bar */}
      {!dataLoading && <AccuracyBar predictions={predictions} matches={matches} />}

      {/* Row 1: My Picks + Next Games */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <MyPicksBlock matches={matches} predictions={predictions} loading={dataLoading} />
        <NextGamesBlock matches={matches} predictions={predictions} loading={dataLoading} />
      </div>

      {/* Row 2: Recent Results */}
      <div className="mb-4">
        <RecentResultsBlock matches={matches} predictions={predictions} loading={dataLoading} />
      </div>

      {/* Row 3: My Leagues */}
      <MyLeaguesBlock
        tournaments={tournaments}
        leaderboards={leaderboards as Array<{ data: { entries: LeaderboardEntry[] } | undefined; isLoading: boolean }>}
        currentUserId={me?.id}
        loading={tournamentsLoading}
      />
    </div>
  )
}
