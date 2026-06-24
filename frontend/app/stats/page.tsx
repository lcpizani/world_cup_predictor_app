'use client'

import Image from 'next/image'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { api } from '@/lib/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { getTeamFlagCode, getFlagUrl, translateTeamName } from '@/lib/flags'
import type { Match } from '@/types/api'

// ── Stage config ──────────────────────────────────────────────────────────────

const STAGE_ORDER = ['group_stage', 'round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'final']

// ── Data aggregation ──────────────────────────────────────────────────────────

interface TeamStat {
  team: string
  gf: number
  ga: number
  wins: number
  draws: number
  losses: number
  cleanSheets: number
  played: number
}

interface AggregatedStats {
  played: number
  totalGoals: number
  goalsPerGame: number
  draws: number
  goalsByStage: Record<string, number>
  goalsByGroup: Record<string, number>
  teamsByGroup: Record<string, string[]>
  teamStats: TeamStat[]
  scorelines: { label: string; count: number }[]
  highestScoringGame: { home: string; away: string; homeScore: number; awayScore: number; total: number } | null
  mostCleanSheets: { team: string; count: number } | null
  aetGames: number
}

function aggregateStats(matches: Match[]): AggregatedStats {
  const finished = matches.filter(m => m.status === 'finished' && m.home_score != null && m.away_score != null)

  let totalGoals = 0
  let draws = 0
  const goalsByStage: Record<string, number> = {}
  const goalsByGroup: Record<string, number> = {}
  const teamsByGroup: Record<string, Set<string>> = {}
  const teamMap = new Map<string, TeamStat>()
  const scorelineMap = new Map<string, number>()
  let highestTotal = 0
  let highestScoringGame: AggregatedStats['highestScoringGame'] = null
  let aetGames = 0

  function getTeam(name: string): TeamStat {
    if (!teamMap.has(name)) {
      teamMap.set(name, { team: name, gf: 0, ga: 0, wins: 0, draws: 0, losses: 0, cleanSheets: 0, played: 0 })
    }
    return teamMap.get(name)!
  }

  for (const m of finished) {
    const hs = m.home_score!
    const as_ = m.away_score!
    const total = hs + as_

    totalGoals += total
    if (hs === as_) draws++

    const stage = m.stage ?? 'group_stage'
    goalsByStage[stage] = (goalsByStage[stage] ?? 0) + total
    if (m.group) {
      goalsByGroup[m.group] = (goalsByGroup[m.group] ?? 0) + total
      if (!teamsByGroup[m.group]) teamsByGroup[m.group] = new Set()
      teamsByGroup[m.group].add(m.home_team)
      teamsByGroup[m.group].add(m.away_team)
    }

    const home = getTeam(m.home_team)
    const away = getTeam(m.away_team)
    home.played++; away.played++
    home.gf += hs; home.ga += as_
    away.gf += as_; away.ga += hs
    if (hs > as_) { home.wins++; away.losses++ }
    else if (hs < as_) { away.wins++; home.losses++ }
    else { home.draws++; away.draws++ }
    if (as_ === 0) home.cleanSheets++
    if (hs === 0) away.cleanSheets++

    const key = `${Math.max(hs, as_)}-${Math.min(hs, as_)}`
    scorelineMap.set(key, (scorelineMap.get(key) ?? 0) + 1)

    if (total > highestTotal) {
      highestTotal = total
      highestScoringGame = { home: m.home_team, away: m.away_team, homeScore: hs, awayScore: as_, total }
    }

    if (m.duration === 'EXTRA_TIME' || m.duration === 'PENALTY_SHOOTOUT') aetGames++
  }

  const teamStats = Array.from(teamMap.values()).sort(
    (a, b) => b.gf - a.gf || a.team.localeCompare(b.team)
  )

  const scorelines = Array.from(scorelineMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  const bestCS = teamStats.length
    ? teamStats.slice().sort((a, b) => b.cleanSheets - a.cleanSheets || a.team.localeCompare(b.team))[0]
    : null

  return {
    played: finished.length,
    totalGoals,
    goalsPerGame: finished.length > 0 ? totalGoals / finished.length : 0,
    draws,
    goalsByStage,
    goalsByGroup,
    teamsByGroup: Object.fromEntries(
      Object.entries(teamsByGroup).map(([g, s]) => [g, Array.from(s).slice(0, 4)])
    ),
    teamStats,
    scorelines,
    highestScoringGame,
    mostCleanSheets: bestCS && bestCS.cleanSheets > 0 ? { team: bestCS.team, count: bestCS.cleanSheets } : null,
    aetGames,
  }
}

// ── TeamFlag ──────────────────────────────────────────────────────────────────

function TeamFlag({ name, size = 20 }: { name: string; size?: number }) {
  const locale = useLocale()
  const code = getTeamFlagCode(name)
  return (
    <div style={{ width: size, height: Math.round(size * 0.7), flexShrink: 0, borderRadius: 2, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
      {code && (
        <Image
          src={getFlagUrl(code, 40)}
          alt={translateTeamName(name, locale)}
          width={size}
          height={Math.round(size * 0.7)}
          className="w-full h-full object-contain"
          unoptimized
        />
      )}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center py-5 px-4 rounded-xl text-center"
      style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.07)', minWidth: 0 }}
    >
      <span
        className="font-[family-name:var(--font-oswald)] leading-none"
        style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, color: '#f0b429', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#4a6080', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-[family-name:var(--font-oswald)]"
      style={{
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: '#cdd6e8',
        marginTop: 40,
        paddingTop: 28,
        borderTop: '1px solid rgba(255,255,255,0.07)',
        marginBottom: 20,
      }}
    >
      {children}
    </h2>
  )
}

// ── Card label (internal panel label) ────────────────────────────────────────

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13, color: '#7a90aa', fontWeight: 500, letterSpacing: '0.01em', marginBottom: 16 }}>
      {children}
    </p>
  )
}

// ── HorizontalBarChart ────────────────────────────────────────────────────────

const RANK_COLORS: Record<number, string> = {
  0: '#f0b429',
  1: '#a8b8c8',
  2: '#cd7f32',
}

function HorizontalBarChart({
  rows,
  maxValue,
  isDefense = false,
}: {
  rows: { team: string; value: number }[]
  maxValue: number
  isDefense?: boolean
}) {
  const locale = useLocale()

  if (rows.length === 0) return (
    <div style={{ color: '#3d5070', fontSize: 13, padding: '16px 0' }}>—</div>
  )

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const rankColor = RANK_COLORS[i] ?? '#3a5070'
        const barWidthPct = maxValue > 0 ? (row.value / maxValue) * 100 : 100
        return (
          <div key={row.team} className="flex items-center gap-3" style={{ fontSize: 13 }}>
            {/* Rank */}
            <span style={{
              width: 20,
              textAlign: 'right',
              color: rankColor,
              fontWeight: 700,
              fontSize: i < 3 ? 13 : 11,
              flexShrink: 0,
              fontFamily: 'var(--font-oswald)',
              lineHeight: 1,
            }}>
              {i + 1}
            </span>
            {/* Flag */}
            <TeamFlag name={row.team} size={22} />
            {/* Name */}
            <span style={{
              width: 100,
              flexShrink: 0,
              color: i === 0 ? '#f0e6c8' : '#cdd6e8',
              fontWeight: i === 0 ? 600 : 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 12,
            }}>
              {translateTeamName(row.team, locale)}
            </span>
            {/* Bar */}
            <div className="flex-1" style={{ overflow: 'hidden', minWidth: 0, height: 6 }}>
              {(row.value > 0 || maxValue === 0) && (
                <div style={{
                  height: 6,
                  borderRadius: 3,
                  background: isDefense
                    ? 'linear-gradient(90deg, rgba(96,165,250,0.75), rgba(96,165,250,0.2))'
                    : 'linear-gradient(90deg, #f0b429, rgba(240,180,41,0.25))',
                  width: `${barWidthPct}%`,
                  minWidth: 3,
                }} />
              )}
            </div>
            {/* Value */}
            <span style={{
              width: 24,
              textAlign: 'right',
              color: i === 0 ? '#f0b429' : '#e2ecff',
              fontWeight: 700,
              fontFamily: 'var(--font-oswald)',
              fontSize: 14,
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}>
              {row.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── BallRow — shared building block ──────────────────────────────────────────

function BallRow({ label, goals, balls }: { label: string; goals: number; balls: number }) {
  return (
    <div className="flex items-start gap-3">
      <span style={{
        width: 64, flexShrink: 0, fontSize: 11, color: '#4a6080',
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 1, lineHeight: 1.4,
      }}>
        {label}
      </span>
      <div className="flex flex-wrap flex-1" style={{ gap: '2px 1px' }}>
        {Array.from({ length: balls }).map((_, i) => (
          <span key={i} style={{ fontSize: 13, lineHeight: 1.35 }}>⚽</span>
        ))}
      </div>
      <span style={{
        flexShrink: 0, minWidth: 28, textAlign: 'right',
        fontSize: 14, fontWeight: 700, color: '#f0b429',
        fontFamily: 'var(--font-oswald)', fontVariantNumeric: 'tabular-nums',
      }}>
        {goals}
      </span>
    </div>
  )
}

// ── GoalsByStageChart ─────────────────────────────────────────────────────────

function GoalsByStageChart({ goalsByStage }: { goalsByStage: Record<string, number> }) {
  const t = useTranslations('stats')

  const stages = STAGE_ORDER
    .map(s => ({ key: s, label: t(`stage_${s}`), goals: goalsByStage[s] ?? 0 }))
    .filter(s => s.goals > 0)

  if (stages.length === 0) return (
    <div style={{ color: '#3d5070', fontSize: 13, padding: '16px 0' }}>—</div>
  )

  return (
    <div className="flex flex-col gap-3">
      {stages.map(({ key, label, goals }) => (
        <BallRow key={key} label={label} goals={goals} balls={goals} />
      ))}
    </div>
  )
}

// ── GoalsByGroupChart ─────────────────────────────────────────────────────────

function GoalsByGroupChart({
  goalsByGroup,
  teamsByGroup,
}: {
  goalsByGroup: Record<string, number>
  teamsByGroup: Record<string, string[]>
}) {
  const t = useTranslations('stats')

  const groups = Object.entries(goalsByGroup)
    .map(([group, goals]) => ({
      group,
      letter: group.split(' ').pop() ?? group,
      goals,
      teams: teamsByGroup[group] ?? [],
    }))
    .sort((a, b) => a.group.localeCompare(b.group))

  if (groups.length === 0) return (
    <div style={{ color: '#3d5070', fontSize: 13, padding: '16px 0' }}>—</div>
  )

  const maxGoals = Math.max(...groups.map(g => g.goals))
  const MAX_BALLS = 20
  const scale = Math.max(1, Math.ceil(maxGoals / MAX_BALLS))

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ group, letter, goals, teams }) => (
        <div key={group} className="flex items-center gap-3">
          {/* 2×2 flag grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, flexShrink: 0, width: 44, height: 44 }}>
            {teams.slice(0, 4).map(team => (
              <TeamFlag key={team} name={team} size={20} />
            ))}
          </div>
          {/* Group letter */}
          <span className="font-[family-name:var(--font-oswald)]" style={{
            width: 28, flexShrink: 0, fontSize: 26, fontWeight: 700,
            color: '#cdd6e8', lineHeight: 1, textAlign: 'center',
          }}>
            {letter}
          </span>
          {/* Balls */}
          <div className="flex flex-wrap flex-1" style={{ gap: '2px 1px' }}>
            {Array.from({ length: goals === 0 ? 0 : Math.max(1, Math.round(goals / scale)) }).map((_, i) => (
              <span key={i} style={{ fontSize: 13, lineHeight: 1.35 }}>⚽</span>
            ))}
          </div>
          {/* Count */}
          <span style={{
            flexShrink: 0, minWidth: 28, textAlign: 'right',
            fontSize: 14, fontWeight: 700, color: '#f0b429',
            fontFamily: 'var(--font-oswald)', fontVariantNumeric: 'tabular-nums',
          }}>
            {goals}
          </span>
        </div>
      ))}
      {scale > 1 && (
        <p style={{ fontSize: 11, color: '#3a5070', marginTop: 2 }}>⚽ = {scale} {t('goals').toLowerCase()}</p>
      )}
    </div>
  )
}

// ── ScoreDistributionChart ────────────────────────────────────────────────────

function ScoreDistributionChart({ scorelines }: { scorelines: { label: string; count: number }[] }) {
  if (scorelines.length === 0) return (
    <div style={{ color: '#3d5070', fontSize: 13, padding: '16px 0' }}>—</div>
  )

  const maxCount = Math.max(...scorelines.map(s => s.count))

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200 }}>
        {scorelines.map(({ label, count }, i) => {
          const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0
          const opacity = 0.55 + (count / maxCount) * 0.45
          return (
            <div key={label} className="flex flex-col items-center justify-end" style={{ flex: 1, minWidth: 0, height: '100%' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#e2ecff', marginBottom: 4, fontFamily: 'var(--font-oswald)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {count}×
              </span>
              <div
                style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  minHeight: 4,
                  borderRadius: '4px 4px 0 0',
                  background: `linear-gradient(180deg, rgba(240,180,41,${opacity}) 0%, rgba(240,180,41,${opacity * 0.5}) 100%)`,
                  boxShadow: i === 0 ? '0 0 12px rgba(240,180,41,0.25)' : 'none',
                }}
              />
              <span style={{ fontSize: 10, color: '#5a7090', marginTop: 6, fontWeight: 600, fontFamily: 'var(--font-oswald)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
      {/* baseline */}
      <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-12">
      <div className="h-10 w-56 rounded-xl animate-pulse mb-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="h-4 w-40 rounded animate-pulse mb-6" style={{ background: 'rgba(255,255,255,0.03)' }} />
      <div className="flex gap-3 mb-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex-1 h-24 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
      <div className="h-px mt-10 mb-7 animate-pulse" style={{ background: 'rgba(255,255,255,0.07)' }} />
      <div className="h-4 w-32 rounded animate-pulse mb-5" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="h-40 rounded-xl animate-pulse mb-0" style={{ background: 'rgba(255,255,255,0.04)' }} />
      <div className="h-px mt-10 mb-7 animate-pulse" style={{ background: 'rgba(255,255,255,0.07)' }} />
      <div className="h-4 w-28 rounded animate-pulse mb-5" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-72 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="h-72 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const t = useTranslations('stats')
  const locale = useLocale()

  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useOnboardingGuard(me, meLoading)

  const { data: matches = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['matches', 'finished'],
    queryFn: () => api.listMatches({ match_status: 'finished' }),
    enabled: !!me,
  })

  const stats = useMemo(() => aggregateStats(matches), [matches])

  if (isLoading || meLoading) return <Skeleton />

  if (isError) return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center">
      <p style={{ color: '#4a6080', fontSize: 14 }}>{t('error')}</p>
    </div>
  )

  const topAttack = stats.teamStats.slice(0, 10).map(s => ({ team: s.team, value: s.gf }))
  const topDefense = stats.teamStats
    .filter(s => s.played > 0)
    .sort((a, b) => a.ga - b.ga || a.team.localeCompare(b.team))
    .slice(0, 10)
    .map(s => ({ team: s.team, value: s.ga }))

  const maxAttack = topAttack[0]?.value ?? 0
  const maxDefense = topDefense.length > 0 ? Math.max(...topDefense.map(s => s.value)) : 0

  const cardStyle: React.CSSProperties = {
    background: '#0b1220',
    border: '1px solid rgba(255,255,255,0.08)',
    borderTop: '2px solid rgba(240,180,41,0.28)',
    borderRadius: 14,
    padding: '20px 20px',
    boxShadow: '0 4px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
  }

  const funFacts = [
    stats.highestScoringGame && {
      icon: '🔥',
      label: t('highest_scoring'),
      value: `${translateTeamName(stats.highestScoringGame.home, locale)} ${stats.highestScoringGame.homeScore}–${stats.highestScoringGame.awayScore} ${translateTeamName(stats.highestScoringGame.away, locale)}`,
    },
    stats.mostCleanSheets && {
      icon: '🧤',
      label: t('most_clean_sheets'),
      value: `${translateTeamName(stats.mostCleanSheets.team, locale)} (${stats.mostCleanSheets.count})`,
    },
    stats.aetGames > 0 && {
      icon: '⏱️',
      label: t('aet_games'),
      value: String(stats.aetGames),
    },
  ].filter(Boolean) as { icon: string; label: string; value: string }[]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-12">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h1
              className="font-[family-name:var(--font-oswald)] leading-none uppercase tracking-wide"
              style={{ fontSize: 'clamp(26px, 5vw, 38px)', fontWeight: 700, color: '#e2ecff' }}
            >
              {t('title')}
            </h1>
            <span
              className="font-[family-name:var(--font-oswald)] leading-none"
              style={{ fontSize: 'clamp(26px, 5vw, 38px)', fontWeight: 700, color: '#f0b429' }}
            >
              2026
            </span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #1e3a5f',
              background: 'transparent',
              color: isFetching ? '#4a6080' : '#93b4d8',
              fontSize: 13,
              fontWeight: 500,
              cursor: isFetching ? 'default' : 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.6s',
                transform: isFetching ? 'rotate(360deg)' : 'none',
              }}
            >
              ↻
            </span>
            {isFetching ? t('refreshing') : t('refresh')}
          </button>
        </div>
        <p style={{ color: '#4a6080', fontSize: 13, marginTop: 6, fontWeight: 500, letterSpacing: '0.02em' }}>
          {t('subtitle')}
        </p>
      </div>

      {/* ── Headline numbers ── */}
      <div className="flex gap-3 mb-2 flex-wrap sm:flex-nowrap">
        <StatCard value={String(stats.played)} label={t('played')} />
        <StatCard value={String(stats.totalGoals)} label={t('goals')} />
        <StatCard value={stats.goalsPerGame.toFixed(1)} label={t('goals_per_game')} />
        <StatCard value={String(stats.draws)} label={t('draws')} />
      </div>

      {/* ── Goals by stage — open, no card ── */}
      <SectionTitle>{t('goals_by_stage')}</SectionTitle>
      <GoalsByStageChart goalsByStage={stats.goalsByStage} />

      {/* ── Goals by group ── */}
      {Object.keys(stats.goalsByGroup).length > 0 && (
        <>
          <SectionTitle>{t('goals_by_group')}</SectionTitle>
          <GoalsByGroupChart goalsByGroup={stats.goalsByGroup} teamsByGroup={stats.teamsByGroup} />
        </>
      )}

      {/* ── Top attack + defence ── */}
      <SectionTitle>{t('team_rankings')}</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div style={cardStyle}>
          <CardLabel>{t('top_attack')}</CardLabel>
          <HorizontalBarChart rows={topAttack} maxValue={maxAttack} />
        </div>
        <div style={cardStyle}>
          <CardLabel>{t('top_defense')}</CardLabel>
          <HorizontalBarChart rows={topDefense} maxValue={maxDefense} isDefense />
        </div>
      </div>

      {/* ── Score distribution — open, no card ── */}
      <SectionTitle>{t('score_dist')}</SectionTitle>
      <ScoreDistributionChart scorelines={stats.scorelines} />

      {/* ── Fun facts — single unified card ── */}
      {funFacts.length > 0 && (
        <>
          <SectionTitle>{t('fun_facts')}</SectionTitle>
          <div style={cardStyle}>
            {funFacts.map((fact, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0, lineHeight: 1 }}>{fact.icon}</span>
                <span style={{ fontSize: 12, color: '#5a7490', fontWeight: 500, flexShrink: 0, minWidth: 140 }}>{fact.label}</span>
                <span style={{ fontSize: 14, color: '#cdd6e8', fontWeight: 600 }}>{fact.value}</span>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  )
}
