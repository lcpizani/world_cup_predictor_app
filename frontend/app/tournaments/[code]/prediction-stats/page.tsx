'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { api } from '@/lib/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { translateTeamName, getTeamAbbr } from '@/lib/flags'
import { STAGE_LABELS, pct } from '@/lib/stats-utils'
import { TeamFlag } from '@/components/TeamFlag'
import type { GameStatEntry, PlayerStatEntry } from '@/types/api'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0b1220',
  surface: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  borderSubtle: 'rgba(255,255,255,0.05)',
  text: '#e2ecff',
  textMuted: '#8496af',
  textFaint: '#4a6080',
  gold: '#f0b429',
  red: '#f87171',
  green: '#4ade80',
  blue: '#60a5fa',
  redBg: 'rgba(239,68,68,0.06)',
  greenBg: 'rgba(34,197,94,0.06)',
  blueBg: 'rgba(96,165,250,0.06)',
  redBorder: 'rgba(239,68,68,0.22)',
  greenBorder: 'rgba(34,197,94,0.22)',
  blueBorder: 'rgba(96,165,250,0.22)',
}

// ── SectionTitle ──────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-[family-name:var(--font-oswald)]"
      style={{
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: C.textFaint,
        marginTop: 36,
        paddingTop: 24,
        borderTop: `1px solid ${C.borderSubtle}`,
        marginBottom: 16,
      }}
    >
      {children}
    </h2>
  )
}

// ── GameRow — horizontal, works on any width ───────────────────────────────────

function GameRow({
  entry, rank, mode,
}: {
  entry: GameStatEntry
  rank: number
  mode: 'hardest' | 'easiest'
}) {
  const { match } = entry
  const isEasiest = mode === 'easiest'
  const accentColor = isEasiest ? C.green : C.red

  const displayHome = getTeamAbbr(match.home_team)
  const displayAway = getTeamAbbr(match.away_team)

  return (
    <div style={{ padding: '13px 0', borderBottom: `1px solid ${C.borderSubtle}` }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Rank */}
        <span style={{
          width: 16, flexShrink: 0, textAlign: 'center',
          fontFamily: 'var(--font-oswald)', fontWeight: 700,
          fontSize: 11, color: rank === 1 ? C.gold : C.textFaint,
        }}>
          {rank}
        </span>

        {/* Home — flag right, name right-aligned */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, justifyContent: 'flex-end' }}>
          <span style={{
            fontSize: 12, color: C.textMuted, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayHome}
          </span>
          <TeamFlag name={match.home_team} size={22} />
        </div>

        {/* Score */}
        <span style={{
          flexShrink: 0, width: 52, textAlign: 'center',
          fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 19,
          color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
        }}>
          {match.home_score}–{match.away_score}
        </span>

        {/* Away — flag left, name left-aligned */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <TeamFlag name={match.away_team} size={22} />
          <span style={{
            fontSize: 12, color: C.textMuted, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayAway}
          </span>
        </div>

        {/* Avg pts */}
        <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 34 }}>
          <p style={{
            fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 17,
            color: accentColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {entry.avg_points.toFixed(1)}
          </p>
          <p style={{ fontSize: 8, color: C.textFaint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>pts</p>
        </div>
      </div>

    </div>
  )
}

// ── SpotlightCard ─────────────────────────────────────────────────────────────

type SpotlightVariant = 'upset' | 'certainty' | 'exact'

const SPOTLIGHT_THEMES = {
  upset:     { color: C.red,   bg: C.redBg,   border: C.redBorder,   topBorder: 'rgba(239,68,68,0.55)' },
  certainty: { color: C.green, bg: C.greenBg, border: C.greenBorder, topBorder: 'rgba(34,197,94,0.55)' },
  exact:     { color: C.blue,  bg: C.blueBg,  border: C.blueBorder,  topBorder: 'rgba(96,165,250,0.55)' },
} as const

function SpotlightCard({
  variant, label, entry, icon,
}: {
  variant: SpotlightVariant
  label: string
  entry: GameStatEntry
  icon: React.ReactNode
}) {
  const t = useTranslations('predictionStats')
  const locale = useLocale()
  const { match } = entry
  const theme = SPOTLIGHT_THEMES[variant]

  const total = entry.prediction_count
  const hitCount = Math.round(entry.hit_rate * total)
  const exactCount = Math.round(entry.exact_rate * total)

  const stat = variant === 'exact' ? pct(entry.exact_rate) : pct(entry.hit_rate)
  const description =
    variant === 'upset'
      ? t('upset_desc', { count: hitCount, total })
      : variant === 'certainty'
        ? t('certainty_desc', { count: hitCount, total })
        : t('exact_desc', { count: exactCount, total })

  return (
    <div style={{
      background: theme.bg,
      border: `1px solid ${theme.border}`,
      borderTop: `3px solid ${theme.color}`,
      borderRadius: 12,
      padding: '16px',
    }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <div style={{ color: theme.color, flexShrink: 0, opacity: 0.9 }}>{icon}</div>
        <p style={{ fontSize: 10, color: theme.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.85, lineHeight: 1.3 }}>
          {label}
        </p>
      </div>

      {/* Match inset — the focal point */}
      <div style={{
        background: 'rgba(0,0,0,0.25)',
        border: `1px solid rgba(255,255,255,0.06)`,
        borderRadius: 8,
        padding: '12px',
        marginBottom: 14,
      }}>
        {/* Home */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <TeamFlag name={match.home_team} size={18} />
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
            {translateTeamName(match.home_team, locale)}
          </span>
        </div>

        {/* Score */}
        <div style={{ textAlign: 'center', padding: '4px 0' }}>
          <span style={{
            fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 26,
            color: theme.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em',
          }}>
            {match.home_score} – {match.away_score}
          </span>
        </div>

        {/* Away */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <TeamFlag name={match.away_team} size={18} />
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
            {translateTeamName(match.away_team, locale)}
          </span>
        </div>

        {/* Stage meta */}
        <p style={{ fontSize: 10, color: C.textFaint, marginTop: 10, fontWeight: 500 }}>
          {STAGE_LABELS[match.stage] ?? match.stage} · {entry.prediction_count} predictions
        </p>
      </div>

      {/* Stat + description */}
      <p style={{ fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 30, color: theme.color, lineHeight: 1 }}>
        {stat}
      </p>
      <p style={{ fontSize: 12, color: C.textMuted, marginTop: 5, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  )
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────

function PlayerRow({ entry, rank, maxAvg }: { entry: PlayerStatEntry; rank: number; maxAvg: number }) {
  const rankColors: Record<number, string> = { 1: C.gold, 2: '#a8b8c8', 3: '#cd7f32' }
  const rankColor = rankColors[rank] ?? C.textFaint
  const barPct = maxAvg > 0 ? Math.round((entry.avg_points_per_game / maxAvg) * 100) : 0

  return (
    <div style={{ padding: '11px 0', borderBottom: `1px solid ${C.borderSubtle}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Rank */}
        <span style={{
          width: 20, textAlign: 'right', flexShrink: 0,
          fontFamily: 'var(--font-oswald)', fontWeight: 700,
          fontSize: rank <= 3 ? 13 : 11, color: rankColor,
        }}>
          {rank}
        </span>
        {/* Name */}
        <span style={{
          flex: 1, minWidth: 0,
          color: rank === 1 ? '#f0e6c8' : C.text,
          fontWeight: rank === 1 ? 600 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 14,
        }}>
          {entry.user.display_name ?? entry.user.username}
        </span>
        {/* Games */}
        <span style={{ flexShrink: 0, color: C.textFaint, fontSize: 11, minWidth: 22, textAlign: 'right' }}>
          {entry.games_predicted}g
        </span>
        {/* Total */}
        <span style={{ flexShrink: 0, color: C.textMuted, fontSize: 12, minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {entry.total_points}pt
        </span>
        {/* Avg */}
        <span style={{
          flexShrink: 0,
          fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 17,
          color: rank === 1 ? C.gold : C.text,
          minWidth: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        }}>
          {entry.avg_points_per_game.toFixed(2)}
        </span>
      </div>
      {/* Relative performance bar */}
      <div style={{ marginLeft: 30, marginTop: 6, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 1,
          background: rank === 1 ? C.gold : 'rgba(224,236,255,0.2)',
          transform: `scaleX(${barPct / 100})`,
          transformOrigin: 'left',
          transition: 'transform 0.4s ease',
        }} />
      </div>
    </div>
  )
}

// ── RankingView ───────────────────────────────────────────────────────────────

function RankingView({
  playerStats,
  t,
}: {
  playerStats: PlayerStatEntry[]
  t: ReturnType<typeof useTranslations<'predictionStats'>>
}) {
  const rankColors: Record<number, string> = { 1: C.gold, 2: '#a8b8c8', 3: '#cd7f32' }

  // Sort by avg_daily_rank ascending (null = never active, goes last)
  const sorted = [...playerStats].sort((a, b) => {
    if (a.avg_daily_rank === null && b.avg_daily_rank === null) return 0
    if (a.avg_daily_rank === null) return 1
    if (b.avg_daily_rank === null) return -1
    return a.avg_daily_rank - b.avg_daily_rank
  })

  return (
    <>
      {/* Column headers */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 9, color: C.textFaint, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        paddingBottom: 10, borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ width: 20, flexShrink: 0 }}>#</span>
        <span style={{ flex: 1 }}>{t('col_player')}</span>
        <span style={{ flexShrink: 0, minWidth: 52, textAlign: 'right' }}>{t('col_avg_rank')}</span>
      </div>

      {sorted.map((entry, i) => {
        const pos = i + 1
        const rankColor = rankColors[pos] ?? C.textFaint

        return (
          <div key={entry.user.id.toString()} style={{ padding: '11px 0', borderBottom: `1px solid ${C.borderSubtle}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 20, textAlign: 'right', flexShrink: 0,
                fontFamily: 'var(--font-oswald)', fontWeight: 700,
                fontSize: pos <= 3 ? 13 : 11, color: rankColor,
              }}>
                {pos}
              </span>
              <span style={{
                flex: 1, minWidth: 0,
                color: pos === 1 ? '#f0e6c8' : C.text,
                fontWeight: pos === 1 ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontSize: 14,
              }}>
                {entry.user.display_name ?? entry.user.username}
              </span>
              <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 52 }}>
                <p style={{
                  fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 17,
                  color: pos === 1 ? C.gold : C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                }}>
                  {entry.avg_daily_rank !== null ? entry.avg_daily_rank.toFixed(2) : '—'}
                </p>
                <p style={{ fontSize: 8, color: C.textFaint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                  {t('col_avg_rank_label')}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-12">
      <div className="h-4 w-20 rounded animate-pulse mb-4" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="h-8 w-48 rounded animate-pulse mb-2" style={{ background: 'rgba(255,255,255,0.07)' }} />
      <div className="h-4 w-32 rounded animate-pulse mb-8" style={{ background: 'rgba(255,255,255,0.04)' }} />
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
      <div className="h-px mb-6" style={{ background: C.borderSubtle }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="h-52 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="h-52 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
      <div className="h-px mb-6" style={{ background: C.borderSubtle }} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map(i => <div key={i} className="h-44 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PredictionStatsPage() {
  const t = useTranslations('predictionStats')
  const { code } = useParams<{ code: string }>()
  const [playerView, setPlayerView] = useState<'avg' | 'rank'>('avg')

  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useOnboardingGuard(me, meLoading)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['prediction-stats', code],
    queryFn: () => api.getTournamentPredictionStats(code),
    enabled: !!me,
  })

  const { data: preview } = useQuery({
    queryKey: ['tournament-preview', code],
    queryFn: () => api.getTournamentPreview(code),
    enabled: !!me,
  })


  if (isLoading || meLoading) return <Skeleton />

  if (isError) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p style={{ color: C.textFaint, fontSize: 14 }}>{t('error')}</p>
    </div>
  )

  const gameStats = data?.game_stats ?? []
  const playerStats = data?.player_stats ?? []

  // Hardest / easiest (no overlap)
  const sorted = [...gameStats].sort((a, b) => a.avg_points - b.avg_points)
  const hardest = sorted.slice(0, 3)
  const hardestIds = new Set(hardest.map(e => e.match.id))
  const easiest = sorted.slice(-3).reverse().filter(e => !hardestIds.has(e.match.id))

  // Spotlight entries
  const byHitRate = [...gameStats].sort((a, b) => a.hit_rate - b.hit_rate)
  const biggestUpset = byHitRate[0] ?? null
  const biggestCertainty = byHitRate[byHitRate.length - 1] ?? null
  const mostExact = [...gameStats].sort((a, b) => b.exact_rate - a.exact_rate)[0] ?? null

  // Player averages
  const playerSorted = [...playerStats].sort((a, b) => b.avg_points_per_game - a.avg_points_per_game)
  const maxPlayerAvg = playerSorted[0]?.avg_points_per_game ?? 1

  // Summary KPIs
  const allAvg = gameStats.map(e => e.avg_points)
  const maxAvgPoints = allAvg.length > 0 ? Math.max(...allAvg) : 1
  const leagueAvgPts = gameStats.length > 0
    ? gameStats.reduce((s, e) => s + e.avg_points, 0) / gameStats.length
    : 0
  const topHitRate = gameStats.length > 0 ? Math.max(...gameStats.map(e => e.hit_rate)) : 0

  const isEmpty = gameStats.length === 0

  const cardStyle: React.CSSProperties = {
    background: 'rgba(12,20,36,0.85)',
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: '16px',
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-16">

      {/* ── Back link ── */}
      <Link
        href={`/tournaments/${code}`}
        style={{ fontSize: 12, color: C.textFaint, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 14 }}
      >
        {t('back')}
      </Link>

      {/* ── Page header ── */}
      <h1
        className="font-[family-name:var(--font-oswald)] leading-none uppercase"
        style={{ fontSize: 'clamp(26px, 6vw, 36px)', fontWeight: 700, color: C.text, letterSpacing: '0.03em' }}
      >
        {preview?.name ?? t('title')}
      </h1>
      <p style={{ color: C.textFaint, fontSize: 13, marginTop: 6, fontWeight: 400 }}>
        {t('subtitle')}
      </p>

      {isEmpty ? (
        /* ── Empty state ── */
        <div style={{ borderTop: `1px solid ${C.borderSubtle}`, marginTop: 28, paddingTop: 56, textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: C.surface, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <p style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>{t('empty_title')}</p>
          <p style={{ fontSize: 13, color: C.textFaint, marginTop: 6, lineHeight: 1.5 }}>{t('empty_desc')}</p>
        </div>
      ) : (
        <>
          {/* ── Summary strip ── */}
          <div className="grid grid-cols-3 gap-3 mt-7">
            {[
              { label: t('summary_games'), value: gameStats.length.toString() },
              { label: t('summary_participants'), value: playerStats.length.toString() },
              { label: t('summary_avg_ppg'), value: leagueAvgPts.toFixed(1) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 10px' }}>
                <p style={{ fontSize: 9, color: C.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
                <p style={{ fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 22, color: C.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Hardest & Easiest ── */}
          <SectionTitle>{t('hardest_easiest')}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hardest */}
            <div style={cardStyle}>
              <p style={{ fontSize: 10, color: C.red, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                {t('hardest')}
              </p>
              {hardest.length === 0 ? (
                <p style={{ color: C.textFaint, fontSize: 13 }}>—</p>
              ) : (
                hardest.map((e, i) => (
                  <GameRow key={e.match.id} entry={e} rank={i + 1} mode="hardest" />
                ))
              )}
            </div>

            {/* Easiest */}
            <div style={cardStyle}>
              <p style={{ fontSize: 10, color: C.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                {t('easiest')}
              </p>
              {easiest.length === 0 ? (
                <p style={{ color: C.textFaint, fontSize: 12, lineHeight: 1.6 }}>{t('easiest_empty')}</p>
              ) : (
                easiest.map((e, i) => (
                  <GameRow key={e.match.id} entry={e} rank={i + 1} mode="easiest" />
                ))
              )}
            </div>
          </div>

          {/* ── Spotlight Cards ── */}
          <SectionTitle>{t('spotlight')}</SectionTitle>
          {/*
            Mobile  → 1 column
            ≥768px  → 3 columns  (md breakpoint)
          */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {biggestUpset && (
              <SpotlightCard
                variant="upset"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                }
                label={t('biggest_upset')}
                entry={biggestUpset}
              />
            )}
            {biggestCertainty && (
              <SpotlightCard
                variant="certainty"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                }
                label={t('biggest_certainty')}
                entry={biggestCertainty}
              />
            )}
            {mostExact && (
              <SpotlightCard
                variant="exact"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                    <line x1="12" y1="2" x2="12" y2="4" />
                    <line x1="12" y1="20" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="4" y2="12" />
                    <line x1="20" y1="12" x2="22" y2="12" />
                  </svg>
                }
                label={t('most_exact')}
                entry={mostExact}
              />
            )}
          </div>

          {/* ── Player Averages ── */}
          <SectionTitle>{t('player_averages')}</SectionTitle>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, border: `1px solid ${C.border}` }}>
            {(['avg', 'rank'] as const).map(view => (
              <button
                key={view}
                onClick={() => setPlayerView(view)}
                style={{
                  flex: 1, padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
                  background: playerView === view ? 'rgba(255,255,255,0.09)' : 'transparent',
                  color: playerView === view ? C.text : C.textFaint,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {view === 'avg' ? t('view_avg') : t('view_rank')}
              </button>
            ))}
          </div>

          <div style={cardStyle}>
            {playerView === 'avg' ? (
              <>
                {/* Column headers — avg view */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 9, color: C.textFaint, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  paddingBottom: 10, borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={{ width: 20, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{t('col_player')}</span>
                  <span style={{ flexShrink: 0, minWidth: 22, textAlign: 'right' }}>{t('col_games')}</span>
                  <span style={{ flexShrink: 0, minWidth: 38, textAlign: 'right' }}>{t('col_total')}</span>
                  <span style={{ flexShrink: 0, minWidth: 42, textAlign: 'right' }}>{t('col_avg')}</span>
                </div>
                {playerSorted.map((entry, i) => (
                  <PlayerRow key={entry.user.id.toString()} entry={entry} rank={i + 1} maxAvg={maxPlayerAvg} />
                ))}
              </>
            ) : (
              <RankingView playerStats={playerStats} t={t} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
