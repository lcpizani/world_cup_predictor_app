'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { useTranslations, useLocale } from 'next-intl'

import { RANKING_PALETTE as PALETTE } from '@/lib/ranking-colors'

// Nivo requires browser APIs — never SSR
const RankingBumpChart = dynamic(() => import('@/components/RankingBumpChart'), { ssr: false })

function RankDelta({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-[family-name:var(--font-oswald)] text-[10px] font-bold tabular-nums shrink-0 leading-none"
        style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
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
        style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}
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
      style={{ background: 'rgba(45,62,82,0.35)', border: '1px solid rgba(45,62,82,0.5)' }}
    >
      <svg width="8" height="2" viewBox="0 0 8 2" fill="none" aria-hidden="true">
        <rect x="0" y="0.5" width="8" height="1" rx="0.5" fill="#3f5068" />
      </svg>
    </span>
  )
}

export default function LeaderboardPage() {
  const t = useTranslations('leaderboard')
  const locale = useLocale()
  const { code } = useParams<{ code: string }>()
  const [activeTab, setActiveTab] = useState<'table' | 'graph'>('table')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string> | null>(null)

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

  const { data: history } = useQuery({
    queryKey: ['ranking-history', code],
    queryFn: () => api.getRankingHistory(code),
    enabled: activeTab === 'graph',
  })

  const entries = lb?.entries ?? []
  const hasLive = lb?.has_live_matches ?? false
  const showRankChange = lb?.show_rank_change ?? false

  // Default selection: top min(users, 10) by current leaderboard rank
  const effectiveSelection = useMemo(() => {
    if (selectedUserIds !== null) return selectedUserIds
    if (!history) return new Set<string>()
    const defaultIds = history.series
      .slice()
      .sort((a, b) => {
        const rankA = entries.find(e => e.user.id === a.user.id)?.rank ?? 999
        const rankB = entries.find(e => e.user.id === b.user.id)?.rank ?? 999
        return rankA - rankB
      })
      .slice(0, 10)
      .map(s => s.user.id)
    return new Set(defaultIds)
  }, [selectedUserIds, history, entries])

  function toggleUser(userId: string) {
    const current = effectiveSelection
    if (current.has(userId)) {
      const next = new Set(current)
      next.delete(userId)
      setSelectedUserIds(next)
    } else {
      if (current.size >= 10) return
      const next = new Set(current)
      next.add(userId)
      setSelectedUserIds(next)
    }
  }

  function rankDisplay(rank: number): string {
    if (rank === 1) return t('rank_1st')
    if (rank === 2) return t('rank_2nd')
    if (rank === 3) return t('rank_3rd')
    return t('rank_nth', { n: rank })
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-6">
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

      {/* Tab strip */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl"
        style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {(['table', 'graph'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150"
            style={activeTab === tab
              ? { background: 'rgba(240,180,41,0.12)', color: '#f0b429', border: '1px solid rgba(240,180,41,0.25)' }
              : { background: 'transparent', color: '#3f5068', border: '1px solid transparent' }
            }
          >
            {tab === 'table' ? t('tab_table') : t('tab_graph')}
          </button>
        ))}
      </div>

      {/* TABLE TAB */}
      {activeTab === 'table' && (
        <>
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="font-[family-name:var(--font-oswald)] font-bold text-sm tabular-nums w-10 text-center"
                        style={{ color: isFirst ? '#f0b429' : isTop3 ? '#8496af' : '#3f5068' }}
                      >
                        {rankDisplay(entry.rank)}
                      </span>
                      {showRankChange && <RankDelta delta={entry.rank_delta} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-[family-name:var(--font-oswald)] font-semibold uppercase tracking-wide truncate"
                        style={{ color: isFirst ? '#f0b429' : 'white' }}
                      >
                        {entry.user.username}
                      </p>
                      <p className="font-[family-name:var(--font-oswald)] text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#3f5068' }}>
                        🎯 {entry.exact_scores}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex items-baseline gap-1.5">
                      <span
                        className="font-[family-name:var(--font-oswald)] font-bold text-2xl tabular-nums"
                        style={{ color: isFirst ? '#f0b429' : isTop3 ? 'white' : '#5a6a82' }}
                      >
                        {entry.live_total}
                      </span>
                      {hasProvisional && (
                        <span className="font-[family-name:var(--font-oswald)] text-xs font-bold tabular-nums" style={{ color: '#22c55e' }}>
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
        </>
      )}

      {/* GRAPH TAB */}
      {activeTab === 'graph' && (
        <>
          {/* Your position summary card */}
          {me && entries.length > 0 && (() => {
            const myEntry = entries.find(e => e.user.id === me.id)
            if (!myEntry) return null
            const leader = entries[0]
            const gap = leader.live_total - myEntry.live_total
            const isLeading = myEntry.rank === 1
            return (
              <div
                className="mb-5 flex items-center gap-4 px-4 py-3 rounded-xl"
                style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-0.5" style={{ color: '#3f5068' }}>
                    {t('graph_your_rank')}
                  </p>
                  <p
                    className="font-[family-name:var(--font-oswald)] font-bold text-2xl leading-none tabular-nums"
                    style={{ color: isLeading ? '#f0b429' : 'white' }}
                  >
                    {rankDisplay(myEntry.rank)}
                  </p>
                </div>
                <div className="w-px self-stretch" style={{ background: 'rgba(45,62,82,0.5)' }} />
                <div className="flex-1 min-w-0">
                  {isLeading ? (
                    <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>
                      {t('graph_leading')} 🏆
                    </p>
                  ) : (
                    <p className="text-xs font-medium" style={{ color: '#f87171' }}>
                      {t('graph_pts_behind', { pts: gap, name: leader.user.username })}
                    </p>
                  )}
                  <p className="font-[family-name:var(--font-oswald)] text-sm font-bold tabular-nums mt-0.5" style={{ color: '#3f5068' }}>
                    {myEntry.live_total} {t('pts')}
                  </p>
                </div>
              </div>
            )
          })()}

          {/* User selection pills */}
          {history && history.series.length > 0 && (
            <div className="mb-5">
              <div className="flex flex-wrap gap-2">
                {history.series.map((s, i) => {
                  const isSelected = effectiveSelection.has(s.user.id)
                  const isAtMax = effectiveSelection.size >= 10
                  const isCurrentUser = s.user.id === me?.id
                  const color = PALETTE[i % PALETTE.length]
                  const entryRank = entries.find(e => e.user.id === s.user.id)?.rank
                  return (
                    <button
                      key={s.user.id}
                      onClick={() => toggleUser(s.user.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all duration-150"
                      style={isSelected
                        ? { background: `${color}20`, color, border: `1px solid ${color}60` }
                        : { background: '#0d1520', color: '#3f5068', border: '1px solid rgba(255,255,255,0.07)', opacity: isAtMax ? 0.4 : 1 }
                      }
                      disabled={!isSelected && isAtMax}
                      title={!isSelected && isAtMax ? t('graph_max_users') : undefined}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: isSelected ? color : '#3f5068' }}
                      />
                      {entryRank && (
                        <span
                          className="font-[family-name:var(--font-oswald)] text-[10px] tabular-nums"
                          style={{ color: isSelected ? color : '#2d3e52', opacity: 0.8 }}
                        >
                          {entryRank}.
                        </span>
                      )}
                      {s.user.username}
                      {isCurrentUser && (
                        <span style={{ color: isSelected ? color : '#3f5068', opacity: 0.7 }}>★</span>
                      )}
                    </button>
                  )
                })}
              </div>
              {effectiveSelection.size >= 10 && (
                <p className="text-[10px] mt-2 font-medium" style={{ color: '#3f5068' }}>
                  {t('graph_max_users')}
                </p>
              )}
            </div>
          )}

          {/* Chart */}
          {!history && (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse rounded-2xl" style={{ background: '#0d1520', height: i === 2 ? 300 : 20 }} />
              ))}
            </div>
          )}

          {history && (
            <RankingBumpChart
              matchDays={history.match_days}
              series={history.series}
              currentUserId={me?.id ?? ''}
              selectedUserIds={effectiveSelection}
              locale={locale === 'pt' ? 'pt-BR' : 'en-US'}
            />
          )}
        </>
      )}
    </div>
  )
}
