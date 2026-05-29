'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function LeaderboardPage() {
  const { code } = useParams<{ code: string }>()

  const { data: tournament } = useQuery({
    queryKey: ['tournament', code],
    queryFn: () => api.getTournament(code),
  })

  const { data: lb, isLoading } = useQuery({
    queryKey: ['leaderboard-live', code],
    queryFn: () => api.getLiveLeaderboard(code),
    refetchInterval: 20_000,
  })

  const entries = lb?.entries ?? []
  const hasLive = lb?.has_live_matches ?? false

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/tournaments/${code}`}
          className="inline-flex items-center gap-1 text-sm mb-3 transition-colors font-medium"
          style={{ color: '#3f5068' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3f5068' }}
        >
          ← Matches
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white leading-none">
            {tournament?.name ?? '…'}
          </h1>
          {hasLive && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 mt-2">
          <span className="block w-0.5 h-3.5 rounded-full" style={{ background: 'rgba(240,180,41,0.7)' }} />
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em]" style={{ color: '#5a6a82' }}>Leaderboard</p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="animate-pulse h-16 rounded-2xl" style={{ background: '#0d1520' }} />
          ))}
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-20 rounded-2xl" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide mb-2" style={{ color: '#2d3e52' }}>
            No entries yet
          </p>
          <p className="text-sm" style={{ color: '#3f5068' }}>Submit predictions to appear on the board.</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isFirst = entry.rank === 1
            const isTop3 = entry.rank <= 3
            const hasProvisional = entry.provisional_points > 0

            const rankDisplay = entry.rank === 1 ? '1st'
              : entry.rank === 2 ? '2nd'
              : entry.rank === 3 ? '3rd'
              : `${entry.rank}th`

            return (
              <div
                key={entry.user.id}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200"
                style={isFirst
                  ? { background: 'rgba(240,180,41,0.06)', border: '1px solid rgba(240,180,41,0.2)' }
                  : { background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }
                }
              >
                {/* Rank */}
                <div className="w-10 shrink-0 text-center">
                  <span
                    className="font-[family-name:var(--font-oswald)] font-bold text-sm tabular-nums"
                    style={{ color: isFirst ? '#f0b429' : isTop3 ? '#8496af' : '#3f5068' }}
                  >
                    {rankDisplay}
                  </span>
                </div>

                {/* Username */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-[family-name:var(--font-oswald)] font-semibold uppercase tracking-wide truncate"
                    style={{ color: isFirst ? '#f0b429' : 'white' }}
                  >
                    {entry.user.username}
                  </p>
                </div>

                {/* Points */}
                <div className="text-right shrink-0 flex items-baseline gap-1.5">
                  <span
                    className="font-[family-name:var(--font-oswald)] font-bold text-2xl tabular-nums"
                    style={{ color: isFirst ? '#f0b429' : isTop3 ? 'white' : '#5a6a82' }}
                  >
                    {entry.live_total}
                  </span>
                  {hasProvisional && (
                    <span
                      className="font-[family-name:var(--font-oswald)] text-xs font-bold tabular-nums"
                      style={{ color: '#22c55e' }}
                    >
                      +{entry.provisional_points}
                    </span>
                  )}
                  <span className="text-xs font-medium" style={{ color: '#3f5068' }}>pts</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-[10px] mt-8 font-medium" style={{ color: '#1e2d40' }}>
        {hasLive ? 'Near-live · refreshes every 20 seconds' : 'Refreshes every 20 seconds'}
      </p>
    </div>
  )
}
