'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { useTranslations } from 'next-intl'

function RankDelta({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-[family-name:var(--font-oswald)] text-[10px] font-bold tabular-nums shrink-0 leading-none"
        style={{
          background: 'rgba(34,197,94,0.12)',
          color: '#22c55e',
          border: '1px solid rgba(34,197,94,0.25)',
        }}
      >
        <svg width="6" height="6" viewBox="0 0 6 6" fill="none" aria-hidden="true">
          <path d="M3 0.5L5.5 4.5H0.5L3 0.5Z" fill="#22c55e" />
        </svg>
        {delta}
      </span>
    )
  }
  if (delta < 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-[family-name:var(--font-oswald)] text-[10px] font-bold tabular-nums shrink-0 leading-none"
        style={{
          background: 'rgba(248,113,113,0.12)',
          color: '#f87171',
          border: '1px solid rgba(248,113,113,0.25)',
        }}
      >
        <svg width="6" height="6" viewBox="0 0 6 6" fill="none" aria-hidden="true">
          <path d="M3 5.5L0.5 1.5H5.5L3 5.5Z" fill="#f87171" />
        </svg>
        {Math.abs(delta)}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0"
      style={{
        background: 'rgba(45,62,82,0.35)',
        border: '1px solid rgba(45,62,82,0.5)',
      }}
    >
      <svg width="8" height="2" viewBox="0 0 8 2" fill="none" aria-hidden="true">
        <rect x="0" y="0.5" width="8" height="1" rx="0.5" fill="#3f5068" />
      </svg>
    </span>
  )
}

export default function LeaderboardPage() {
  const t = useTranslations('leaderboard')
  const { code } = useParams<{ code: string }>()

  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useOnboardingGuard(me, meLoading)

  const { data: tournament } = useQuery({
    queryKey: ['tournament', code],
    queryFn: () => api.getTournament(code),
  })

  const { data: lb, isLoading } = useQuery({
    queryKey: ['leaderboard-live', code],
    queryFn: () => api.getLiveLeaderboard(code),
    refetchInterval: 60_000,
  })

  const entries = lb?.entries ?? []
  const hasLive = lb?.has_live_matches ?? false
  const showRankChange = lb?.show_rank_change ?? false

  function rankDisplay(rank: number): string {
    if (rank === 1) return t('rank_1st')
    if (rank === 2) return t('rank_2nd')
    if (rank === 3) return t('rank_3rd')
    return t('rank_nth', { n: rank })
  }

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
          {t('back_matches')}
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
              {t('live')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 mt-2">
          <span className="block w-0.5 h-3.5 rounded-full" style={{ background: 'rgba(240,180,41,0.7)' }} />
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em]" style={{ color: '#5a6a82' }}>{t('leaderboard')}</p>
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
            {t('no_entries_title')}
          </p>
          <p className="text-sm" style={{ color: '#3f5068' }}>{t('no_entries_desc')}</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isFirst = entry.rank === 1
            const isTop3 = entry.rank <= 3
            const hasProvisional = entry.provisional_points > 0

            return (
              <div
                key={entry.user.id}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200"
                style={isFirst
                  ? { background: 'rgba(240,180,41,0.06)', border: '1px solid rgba(240,180,41,0.2)' }
                  : { background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }
                }
              >
                {/* Rank + delta */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="font-[family-name:var(--font-oswald)] font-bold text-sm tabular-nums w-10 text-center"
                    style={{ color: isFirst ? '#f0b429' : isTop3 ? '#8496af' : '#3f5068' }}
                  >
                    {rankDisplay(entry.rank)}
                  </span>
                  {showRankChange && <RankDelta delta={entry.rank_delta} />}
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
                  <span className="text-xs font-medium" style={{ color: '#3f5068' }}>{t('pts')}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-[10px] mt-8 font-medium" style={{ color: '#1e2d40' }}>
        {hasLive ? t('live_refresh') : t('refresh')}
      </p>
    </div>
  )
}
