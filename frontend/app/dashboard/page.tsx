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
  if (!code) return <span className="inline-block rounded-sm bg-white/5 border border-white/10 shrink-0" style={{ width: size, height: Math.round(size * 0.7) }} />
  const srcSize = size >= 40 ? 80 : 40
  return (
    <Image
      src={getFlagUrl(code, srcSize)}
      alt={name}
      width={size}
      height={Math.round(size * 0.7)}
      className="rounded object-cover border border-white/10 shrink-0"
      unoptimized
    />
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-xl ${className ?? ''}`} />
}

function SectionLabel({ icon, title }: { icon: string; title: string }) {
  return (
    <p className="flex items-center gap-1.5 font-[family-name:var(--font-oswald)] text-xs font-bold uppercase tracking-widest text-[#64748b] mb-3">
      <span>{icon}</span> {title}
    </p>
  )
}

// ── Match row shared between blocks ───────────────────────────────────────────

function MatchRow({ home, away, center, sub }: {
  home: string
  away: string
  center: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div className="bg-[#080c14] rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1">
        <Flag name={home} size={24} />
        <div className="flex-1 flex flex-col items-center">
          {center}
        </div>
        <Flag name={away} size={24} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#475569] truncate max-w-[80px]">{home}</span>
        {sub}
        <span className="text-[11px] text-[#475569] truncate max-w-[80px] text-right">{away}</span>
      </div>
    </div>
  )
}

// ── Match card (large) ────────────────────────────────────────────────────────

function MatchCard({ home, away, center, meta }: {
  home: string
  away: string
  center: React.ReactNode
  meta: React.ReactNode
}) {
  return (
    <div className="bg-[#080c14] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {/* Home */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <Flag name={home} size={48} />
          <span className="font-[family-name:var(--font-oswald)] font-bold text-white text-sm uppercase tracking-wide text-center leading-tight line-clamp-2">
            {home}
          </span>
        </div>

        {/* Centre */}
        <div className="shrink-0 flex flex-col items-center px-1">
          {center}
        </div>

        {/* Away */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <Flag name={away} size={48} />
          <span className="font-[family-name:var(--font-oswald)] font-bold text-white text-sm uppercase tracking-wide text-center leading-tight line-clamp-2">
            {away}
          </span>
        </div>
      </div>

      <div className="border-t border-white/5 pt-2.5 flex items-center justify-between">
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
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel icon="🎯" title="My Picks" />
        <Link href="/predictions" className="text-[11px] text-[#475569] hover:text-[#f0b429] transition-colors mb-3">
          All picks →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 flex-1">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
      ) : picks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center gap-2">
          <p className="text-[#475569] text-sm">No upcoming picks yet</p>
          <Link href="/predictions" className="text-xs text-[#f0b429] hover:text-white transition-colors">
            Add your picks →
          </Link>
        </div>
      ) : (
        <div className="space-y-3 flex-1">
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
                    <span className="text-xs text-[#475569]">{formatCountdown(m.kickoff_at)}</span>
                    <span className="text-xs text-[#475569]">{m.stage}</span>
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
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5 flex flex-col">
      <SectionLabel icon="📅" title="Next Games" />

      {loading ? (
        <div className="space-y-2 flex-1">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
      ) : upcoming.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-6">
          <p className="text-[#475569] text-sm">No upcoming games</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1">
          {upcoming.map(m => {
            const hasPick = predMatchIds.has(m.id)
            return (
              <MatchCard
                key={m.id}
                home={m.home_team}
                away={m.away_team}
                center={
                  <span className="font-[family-name:var(--font-oswald)] font-bold text-[#2d3748] text-lg tracking-[0.2em]">
                    VS
                  </span>
                }
                meta={
                  <>
                    <span className="text-xs text-[#f0b429]/80 font-medium">{formatCountdown(m.kickoff_at)}</span>
                    {hasPick
                      ? <span className="flex items-center gap-1 text-xs text-green-500/70"><span>✓</span> picked</span>
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
  if (m.home_score === null || m.away_score === null) return { text: '—', color: 'text-[#475569]' }
  const exact = p.predicted_home === m.home_score && p.predicted_away === m.away_score
  if (exact) return { text: `${p.predicted_home}–${p.predicted_away} ✓`, color: 'text-green-400' }
  const win = Math.sign(p.predicted_home - p.predicted_away) === Math.sign(m.home_score - m.away_score)
  if (win) return { text: `${p.predicted_home}–${p.predicted_away} ~`, color: 'text-[#f0b429]' }
  return { text: `${p.predicted_home}–${p.predicted_away} ✗`, color: 'text-[#64748b]' }
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
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5">
      <SectionLabel icon="🏁" title="Recent Results" />

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-[68px]" />)}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-[#475569] text-sm py-6 text-center">No results yet</p>
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
                    ? <span className={`text-[10px] font-mono ${meta.color}`}>{meta.text}</span>
                    : <span className="text-[10px] text-[#2d3748]">no pick</span>
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
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel icon="🏆" title="My Leagues" />
        <Link href="/leagues" className="text-[11px] text-[#475569] hover:text-[#f0b429] transition-colors mb-3">
          Manage leagues →
        </Link>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {[1,2].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-3 text-center">
          <span className="text-4xl">🏟️</span>
          <p className="text-[#475569] text-sm">You haven't joined any leagues yet</p>
          <Link
            href="/leagues"
            className="bg-[#f0b429] text-[#080c14] px-5 py-2 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-white transition-all"
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
                <div className="bg-[#080c14] rounded-xl px-4 py-3 hover:bg-[#0d1420] transition-colors group cursor-pointer h-full">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-[family-name:var(--font-oswald)] font-semibold text-white text-sm uppercase tracking-wide group-hover:text-[#f0b429] transition-colors truncate max-w-[160px]">
                      {t.name}
                    </span>
                    <span className="text-[#475569] group-hover:text-[#f0b429] transition-colors text-sm shrink-0 ml-2">→</span>
                  </div>
                  {lb?.isLoading ? (
                    <Skeleton className="h-3 w-28 mt-2" />
                  ) : leader ? (
                    <div className="space-y-0.5 mt-1">
                      <p className="text-xs text-[#475569]">
                        🥇 <span className="text-[#f0b429]">{leader.user.username}</span>
                        <span className="text-[#334155]"> · {leader.total_points}pts</span>
                      </p>
                      {userEntry && userEntry.rank > 1 && (
                        <p className="text-[11px] text-[#475569]">
                          You: #{userEntry.rank} · {userEntry.total_points}pts
                        </p>
                      )}
                      {userEntry?.rank === 1 && (
                        <p className="text-[11px] text-[#f0b429]/70">You're leading! 🎉</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#334155] mt-1">No scores yet</p>
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
  return (
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl px-5 py-3 mb-4 flex flex-wrap items-center gap-x-5 gap-y-1">
      <span className="text-xs text-[#64748b] uppercase tracking-widest font-bold">Accuracy</span>
      <div className="flex items-center gap-2 flex-1 min-w-[160px]">
        <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-[#f0b429] rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-bold text-white tabular-nums">{pct}%</span>
      </div>
      <span className="text-xs text-[#64748b]">
        <span className="text-white">{correctOutcomes}/{total}</span> correct
        <span className="text-white/20 mx-1.5">·</span>
        <span className="text-white">{exactScores}</span> exact
      </span>
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
      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
          Dashboard
        </h1>
        <p className="text-[#64748b] text-sm mt-0.5">
          {me ? `Welcome back, ${me.username}` : 'Your World Cup at a glance'}
        </p>
      </div>

      {/* Accuracy bar — only shown when data exists */}
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
