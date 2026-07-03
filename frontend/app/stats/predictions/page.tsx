'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { api } from '@/lib/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { translateTeamName, getTeamAbbr } from '@/lib/flags'
import { STAGE_LABELS, pct } from '@/lib/stats-utils'
import { TeamFlag } from '@/components/TeamFlag'
import type { GlobalGameStatEntry } from '@/types/api'

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
  amber: '#f59e0b',
  purple: '#a78bfa',
  cyan: '#22d3ee',
  indigo: '#818cf8',
  redBg: 'rgba(239,68,68,0.06)',
  greenBg: 'rgba(34,197,94,0.06)',
  blueBg: 'rgba(96,165,250,0.06)',
  amberBg: 'rgba(245,158,11,0.06)',
  purpleBg: 'rgba(167,139,250,0.06)',
  cyanBg: 'rgba(34,211,238,0.06)',
  indigoBg: 'rgba(129,140,248,0.06)',
  redBorder: 'rgba(239,68,68,0.22)',
  greenBorder: 'rgba(34,197,94,0.22)',
  blueBorder: 'rgba(96,165,250,0.22)',
  amberBorder: 'rgba(245,158,11,0.22)',
  purpleBorder: 'rgba(167,139,250,0.22)',
  cyanBorder: 'rgba(34,211,238,0.22)',
  indigoBorder: 'rgba(129,140,248,0.22)',
}

// ── SectionTitle ──────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-[family-name:var(--font-oswald)]"
      style={{
        fontSize: 16, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: C.textFaint,
        marginTop: 36, paddingTop: 24,
        borderTop: `1px solid ${C.borderSubtle}`,
        marginBottom: 16,
      }}
    >
      {children}
    </h2>
  )
}

// ── GameRow ───────────────────────────────────────────────────────────────────

function GameRow({ entry, rank, mode }: { entry: GlobalGameStatEntry; rank: number; mode: 'hardest' | 'easiest' }) {
  const { match } = entry
  const isEasiest = mode === 'easiest'
  const accentColor = isEasiest ? C.green : C.red
  const displayHome = getTeamAbbr(match.home_team)
  const displayAway = getTeamAbbr(match.away_team)

  return (
    <div style={{ padding: '13px 0', borderBottom: `1px solid ${C.borderSubtle}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 16, flexShrink: 0, textAlign: 'center',
          fontFamily: 'var(--font-oswald)', fontWeight: 700,
          fontSize: 11, color: rank === 1 ? C.gold : C.textFaint,
        }}>
          {rank}
        </span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayHome}
          </span>
          <TeamFlag name={match.home_team} size={22} />
        </div>
        <span style={{
          flexShrink: 0, width: 52, textAlign: 'center',
          fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 19,
          color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
        }}>
          {match.home_score}–{match.away_score}
        </span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <TeamFlag name={match.away_team} size={22} />
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayAway}
          </span>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 38 }}>
          <p style={{ fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 17, color: accentColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {pct(entry.hit_rate)}
          </p>
          <p style={{ fontSize: 8, color: C.textFaint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>correct</p>
        </div>
      </div>
    </div>
  )
}

// ── SpotlightCard ─────────────────────────────────────────────────────────────

type SpotlightVariant = 'upset' | 'certainty' | 'exact' | 'fewest_exact' | 'divisive' | 'crowd_favorite' | 'hive_mind'

const SPOTLIGHT_THEMES: Record<SpotlightVariant, { color: string; bg: string; border: string }> = {
  upset:          { color: C.red,    bg: C.redBg,    border: C.redBorder    },
  certainty:      { color: C.green,  bg: C.greenBg,  border: C.greenBorder  },
  exact:          { color: C.blue,   bg: C.blueBg,   border: C.blueBorder   },
  fewest_exact:   { color: C.amber,  bg: C.amberBg,  border: C.amberBorder  },
  divisive:       { color: C.purple, bg: C.purpleBg, border: C.purpleBorder },
  crowd_favorite: { color: C.cyan,   bg: C.cyanBg,   border: C.cyanBorder   },
  hive_mind:      { color: C.indigo, bg: C.indigoBg, border: C.indigoBorder },
}

function SpotlightCard({
  variant, label, entry, icon,
}: {
  variant: SpotlightVariant
  label: string
  entry: GlobalGameStatEntry
  icon: React.ReactNode
}) {
  const t = useTranslations('globalPredictionStats')
  const locale = useLocale()
  const { match } = entry
  const theme = SPOTLIGHT_THEMES[variant]

  const total = entry.prediction_count
  const hitCount = Math.round(entry.hit_rate * total)
  const exactCount = Math.round(entry.exact_rate * total)

  let stat: string
  let description: string

  if (variant === 'exact') {
    stat = pct(entry.exact_rate)
    description = t('exact_desc', { count: exactCount, total })
  } else if (variant === 'fewest_exact') {
    stat = pct(entry.exact_rate)
    description = t('fewest_exact_desc', { count: exactCount, total })
  } else if (variant === 'certainty') {
    stat = pct(entry.hit_rate)
    description = t('certainty_desc', { count: hitCount, total })
  } else if (variant === 'upset') {
    stat = pct(entry.hit_rate)
    description = t('upset_desc', { count: hitCount, total })
  } else if (variant === 'divisive') {
    stat = pct(entry.hit_rate)
    description = t('divisive_desc', { count: hitCount, total })
  } else if (variant === 'crowd_favorite') {
    stat = entry.max_consensus_count.toString()
    const teamName = entry.consensus_pick === 'home'
      ? translateTeamName(match.home_team, locale)
      : entry.consensus_pick === 'away'
        ? translateTeamName(match.away_team, locale)
        : null
    description = teamName
      ? t('crowd_favorite_win_desc', { count: entry.max_consensus_count, total, team: teamName })
      : t('crowd_favorite_draw_desc', { count: entry.max_consensus_count, total })
  } else {
    // hive_mind
    stat = entry.max_same_score_count.toString()
    description = t('hive_mind_desc', {
      count: entry.max_same_score_count,
      total,
      home: entry.most_common_score.home,
      away: entry.most_common_score.away,
    })
  }

  const isCrowdBehavior = variant === 'crowd_favorite' || variant === 'hive_mind'

  return (
    <div style={{
      background: theme.bg,
      border: `1px solid ${theme.border}`,
      borderTop: `3px solid ${theme.color}`,
      borderRadius: 12,
      padding: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <div style={{ color: theme.color, flexShrink: 0, opacity: 0.9 }}>{icon}</div>
        <p style={{ fontSize: 10, color: theme.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.85, lineHeight: 1.3 }}>
          {label}
        </p>
      </div>

      <div style={{
        background: 'rgba(0,0,0,0.25)',
        border: `1px solid rgba(255,255,255,0.06)`,
        borderRadius: 8,
        padding: '12px',
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <TeamFlag name={match.home_team} size={18} />
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
            {translateTeamName(match.home_team, locale)}
          </span>
        </div>
        <div style={{ textAlign: 'center', padding: '4px 0' }}>
          <span style={{
            fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 26,
            color: theme.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em',
          }}>
            {match.home_score} – {match.away_score}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <TeamFlag name={match.away_team} size={18} />
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
            {translateTeamName(match.away_team, locale)}
          </span>
        </div>
        <p style={{ fontSize: 10, color: C.textFaint, marginTop: 10, fontWeight: 500 }}>
          {STAGE_LABELS[match.stage] ?? match.stage} · {total} predictions
        </p>
      </div>

      <p style={{
        fontFamily: 'var(--font-oswald)', fontWeight: 700,
        fontSize: isCrowdBehavior ? 36 : 30,
        color: theme.color, lineHeight: 1,
      }}>
        {stat}
      </p>
      <p style={{ fontSize: 12, color: C.textMuted, marginTop: 5, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-12">
      <div className="h-8 w-52 rounded animate-pulse mb-2" style={{ background: 'rgba(255,255,255,0.07)' }} />
      <div className="h-4 w-40 rounded animate-pulse mb-7" style={{ background: 'rgba(255,255,255,0.04)' }} />
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
      <div className="h-px mb-6" style={{ background: C.borderSubtle }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="h-44 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="h-44 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
      <div className="h-px mb-6" style={{ background: C.borderSubtle }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        {[0, 1, 2].map(i => <div key={i} className="h-44 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-44 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const Icons = {
  lightning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  shield: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  target: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
    </svg>
  ),
  xCircle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  shuffle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  hash: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GlobalPredictionStatsPage() {
  const t = useTranslations('globalPredictionStats')

  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useOnboardingGuard(me, meLoading)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['global-prediction-stats'],
    queryFn: api.getGlobalPredictionStats,
    enabled: !!me,
  })

  if (isLoading || meLoading) return <Skeleton />

  if (isError) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p style={{ color: C.textFaint, fontSize: 14 }}>{t('error')}</p>
    </div>
  )

  const gameStats = data?.game_stats ?? []
  const summary = data?.summary

  const isEmpty = gameStats.length === 0

  // Hardest / Easiest by hit_rate
  const sortedByHitRate = [...gameStats].sort((a, b) => a.hit_rate - b.hit_rate)
  const hardest = sortedByHitRate.slice(0, 3)
  const hardestIds = new Set(hardest.map(e => e.match.id))
  const easiest = sortedByHitRate.slice(-3).reverse().filter(e => !hardestIds.has(e.match.id))

  // Spotlight entries
  const biggestUpset = sortedByHitRate[0] ?? null
  const biggestCertainty = sortedByHitRate[sortedByHitRate.length - 1] ?? null
  const sortedByExactRate = [...gameStats].sort((a, b) => a.exact_rate - b.exact_rate)
  const fewestExact = sortedByExactRate[0] ?? null
  const mostExact = sortedByExactRate[sortedByExactRate.length - 1] ?? null
  const mostDivisive = [...gameStats].sort((a, b) =>
    Math.abs(a.hit_rate - 0.5) - Math.abs(b.hit_rate - 0.5)
  )[0] ?? null
  const crowdFavorite = gameStats.reduce<GlobalGameStatEntry | null>(
    (best, e) => !best || e.max_consensus_count > best.max_consensus_count ? e : best, null
  )
  const hiveMind = gameStats.reduce<GlobalGameStatEntry | null>(
    (best, e) => !best || e.max_same_score_count > best.max_same_score_count ? e : best, null
  )

  const cardStyle: React.CSSProperties = {
    background: 'rgba(12,20,36,0.85)',
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: '16px',
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-16">

      {/* ── Page header ── */}
      <h1
        className="font-[family-name:var(--font-oswald)] leading-none uppercase"
        style={{ fontSize: 'clamp(26px, 6vw, 36px)', fontWeight: 700, color: C.text, letterSpacing: '0.03em' }}
      >
        {t('title')}
        <span style={{ color: C.gold }}> 2026</span>
      </h1>
      <p style={{ color: C.textFaint, fontSize: 13, marginTop: 6, fontWeight: 400 }}>
        {t('subtitle')}
      </p>

      {isEmpty ? (
        <div style={{ borderTop: `1px solid ${C.borderSubtle}`, marginTop: 28, paddingTop: 56, textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: C.surface, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <p style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>{t('empty_title')}</p>
          <p style={{ fontSize: 13, color: C.textFaint, marginTop: 6, lineHeight: 1.5 }}>{t('empty_desc')}</p>
        </div>
      ) : (
        <>
          {/* ── Summary strip ── */}
          {summary && (
            <div className="grid grid-cols-4 gap-3 mt-7">
              {[
                { label: t('summary_users'), value: summary.total_users.toLocaleString() },
                { label: t('summary_predictions'), value: summary.total_predictions.toLocaleString() },
                { label: t('summary_hit_rate'), value: pct(summary.overall_hit_rate) },
                { label: t('summary_exact_rate'), value: pct(summary.overall_exact_rate) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 10px' }}>
                  <p style={{ fontSize: 9, color: C.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
                  <p style={{ fontFamily: 'var(--font-oswald)', fontWeight: 700, fontSize: 20, color: C.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Hardest & Easiest ── */}
          <SectionTitle>{t('hardest_easiest')}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div style={cardStyle}>
              <p style={{ fontSize: 10, color: C.red, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                {Icons.lightning}
                {t('hardest')}
              </p>
              {hardest.map((e, i) => <GameRow key={e.match.id} entry={e} rank={i + 1} mode="hardest" />)}
            </div>
            <div style={cardStyle}>
              <p style={{ fontSize: 10, color: C.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                </svg>
                {t('easiest')}
              </p>
              {easiest.length === 0
                ? <p style={{ color: C.textFaint, fontSize: 12, lineHeight: 1.6 }}>{t('easiest_empty')}</p>
                : easiest.map((e, i) => <GameRow key={e.match.id} entry={e} rank={i + 1} mode="easiest" />)
              }
            </div>
          </div>

          {/* ── Accuracy Spotlights ── */}
          <SectionTitle>{t('spotlight_accuracy')}</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {biggestUpset && (
              <SpotlightCard variant="upset" label={t('biggest_upset')} entry={biggestUpset} icon={Icons.lightning} />
            )}
            {biggestCertainty && (
              <SpotlightCard variant="certainty" label={t('biggest_certainty')} entry={biggestCertainty} icon={Icons.shield} />
            )}
            {mostExact && (
              <SpotlightCard variant="exact" label={t('most_exact')} entry={mostExact} icon={Icons.target} />
            )}
          </div>

          {/* ── Crowd Behavior Spotlights ── */}
          <SectionTitle>{t('spotlight_crowd')}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fewestExact && (
              <SpotlightCard variant="fewest_exact" label={t('fewest_exact')} entry={fewestExact} icon={Icons.xCircle} />
            )}
            {mostDivisive && (
              <SpotlightCard variant="divisive" label={t('most_divisive')} entry={mostDivisive} icon={Icons.shuffle} />
            )}
            {crowdFavorite && (
              <SpotlightCard variant="crowd_favorite" label={t('crowd_favorite')} entry={crowdFavorite} icon={Icons.users} />
            )}
            {hiveMind && (
              <SpotlightCard variant="hive_mind" label={t('hive_mind')} entry={hiveMind} icon={Icons.hash} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
