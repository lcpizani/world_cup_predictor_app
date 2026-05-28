'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'

const MEDALS: Record<number, { emoji: string; color: string }> = {
  1: { emoji: '🥇', color: 'text-[#f0b429]' },
  2: { emoji: '🥈', color: 'text-[#94a3b8]' },
  3: { emoji: '🥉', color: 'text-[#cd7c2f]' },
}

export default function LeaderboardPage() {
  const { code } = useParams<{ code: string }>()

  const { data: tournament } = useQuery({
    queryKey: ['tournament', code],
    queryFn: () => api.getTournament(code),
  })

  const { data: lb, isLoading } = useQuery({
    queryKey: ['leaderboard', code],
    queryFn: () => api.getLeaderboard(code),
    refetchInterval: 30_000,
  })

  const entries = lb?.entries ?? []

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/tournaments/${code}`}
          className="inline-flex items-center gap-1 text-[#64748b] hover:text-white text-sm mb-3 transition-colors"
        >
          ← Matches
        </Link>
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
          {tournament?.name ?? '…'}
        </h1>
        <p className="text-[#64748b] text-sm mt-1 uppercase tracking-widest font-bold">Leaderboard</p>
      </div>

      {isLoading && (
        <p className="text-center text-[#64748b] py-16">Loading…</p>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-20 text-[#64748b]">
          <div className="text-4xl mb-4">🏟️</div>
          <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#475569] mb-2">
            No entries yet
          </p>
          <p className="text-sm">Start submitting predictions to appear here.</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, idx) => {
            const medal = MEDALS[entry.rank]
            const isTop3 = entry.rank <= 3
            return (
              <div
                key={entry.user.id}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all ${
                  entry.rank === 1
                    ? 'bg-[#f0b429]/5 border-[#f0b429]/20'
                    : 'bg-[#0f1620] border-white/10'
                }`}
              >
                {/* Rank */}
                <div className="w-10 text-center flex-shrink-0">
                  {medal ? (
                    <span className="text-xl">{medal.emoji}</span>
                  ) : (
                    <span className="font-[family-name:var(--font-oswald)] font-bold text-[#475569] text-lg">
                      {entry.rank}
                    </span>
                  )}
                </div>

                {/* User */}
                <div className="flex-1 min-w-0">
                  <p className={`font-[family-name:var(--font-oswald)] font-semibold uppercase tracking-wide truncate ${
                    entry.rank === 1 ? 'text-[#f0b429]' : 'text-white'
                  }`}>
                    {entry.user.username}
                  </p>
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0">
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-2xl ${
                    entry.rank === 1 ? 'text-[#f0b429]' : isTop3 ? 'text-white' : 'text-[#94a3b8]'
                  }`}>
                    {entry.total_points}
                  </span>
                  <span className="text-xs text-[#475569] ml-1">pts</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-[#334155] mt-8">Refreshes every 30 seconds</p>
    </div>
  )
}
