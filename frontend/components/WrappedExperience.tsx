'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { WrappedStats } from '@/types/api'
import { getTeamFlagCode, getFlagUrl } from '@/lib/flags'

// ── Slide backgrounds (Spotify Wrapped palette) ───────────────────────────────

const SLIDE_THEMES = [
  { bg: 'linear-gradient(135deg, #0d1b2a 0%, #1a0a2e 100%)', accent: '#c084fc' },   // 1 – deep purple
  { bg: 'linear-gradient(135deg, #0a1f0f 0%, #052e16 100%)', accent: '#4ade80' },   // 2 – forest green
  { bg: 'linear-gradient(135deg, #1a0e00 0%, #431407 100%)', accent: '#fb923c' },   // 3 – burnt orange
  { bg: 'linear-gradient(135deg, #0c0f1e 0%, #0f172a 100%)', accent: '#38bdf8' },   // 4 – midnight blue
  { bg: 'linear-gradient(135deg, #1a0a1e 0%, #3b0764 100%)', accent: '#e879f9' },   // 5 – magenta purple
  { bg: 'linear-gradient(135deg, #001a12 0%, #064e3b 100%)', accent: '#34d399' },   // 6 – emerald
  { bg: 'linear-gradient(135deg, #1a0000 0%, #7f1d1d 100%)', accent: '#f87171' },   // 7 – crimson
  { bg: 'linear-gradient(135deg, #0a0a00 0%, #422006 100%)', accent: '#fbbf24' },   // 8 – gold
]

// ── Animated counter ──────────────────────────────────────────────────────────

function useCounter(target: number, active: boolean, duration = 1000) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) { setValue(0); return }
    const start = performance.now()
    let raf: number
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])
  return value
}

// ── Slide components ──────────────────────────────────────────────────────────

function SlideIntro({ leagueName, accent }: { leagueName: string; accent: string }) {
  const t = useTranslations('wrapped')
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-6">
      <div className="text-6xl animate-bounce-in">⚽</div>
      <div
        className="font-[family-name:var(--font-oswald)] text-4xl sm:text-6xl font-bold uppercase tracking-wider leading-tight animate-fade-up w-full break-words"
        style={{ color: accent }}
      >
        {leagueName}
      </div>
      <div className="font-[family-name:var(--font-oswald)] text-2xl sm:text-3xl font-bold uppercase tracking-widest text-white animate-fade-up-delay">
        {t('intro.itsAWrap')}
      </div>
      <div className="text-sm text-white/40 animate-fade-up-delay-2 tracking-widest uppercase">
        {t('intro.season')}
      </div>
    </div>
  )
}

function SlideVolume({ stats, accent }: { stats: WrappedStats; accent: string }) {
  const t = useTranslations('wrapped')
  const count = useCounter(stats.total_predictions, true, 1200)
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4">
      <p className="text-white/50 uppercase tracking-widest text-sm font-bold animate-fade-in">{t('volume.youPredicted')}</p>
      <div
        className="font-[family-name:var(--font-oswald)] font-bold leading-none animate-scale-in"
        style={{ fontSize: 'clamp(5rem, 20vw, 9rem)', color: accent }}
      >
        {count}
      </div>
      <p className="font-[family-name:var(--font-oswald)] text-2xl text-white uppercase tracking-wide animate-fade-up">
        {t('volume.ofMatches')}
      </p>
      <p className="text-white/30 text-xs tracking-widest uppercase animate-fade-in-delay">
        {t('volume.totalGames')}
      </p>
    </div>
  )
}

function SlideAccuracy({ stats, accent }: { stats: WrappedStats; accent: string }) {
  const t = useTranslations('wrapped')
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-8">
      <p className="text-white/50 uppercase tracking-widest text-sm font-bold">{t('accuracy.title')}</p>
      <div className="flex flex-col gap-5 w-full max-w-xs">
        {[
          { label: t('accuracy.exactScores'), value: stats.exact_scores, icon: '🎯', delay: 0 },
          { label: t('accuracy.correctWinners'), value: stats.correct_winners, icon: '✅', delay: 150 },
          { label: t('accuracy.hitRate'), value: `${stats.hit_rate_pct}%`, icon: '📊', delay: 300 },
        ].map(({ label, value, icon, delay }) => (
          <div
            key={label}
            className="flex items-center justify-between px-5 py-4 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${accent}33`,
              animation: `popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both`,
            }}
          >
            <span className="flex items-center gap-3 text-white/70 text-sm font-semibold">
              <span className="text-xl">{icon}</span>
              {label}
            </span>
            <span
              className="font-[family-name:var(--font-oswald)] font-bold text-2xl"
              style={{ color: accent }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Badge computation ─────────────────────────────────────────────────────────

interface BadgeData {
  emoji: string
  nameKey: string
  descKey: string
  descParams?: Record<string, string | number>
}

function computeBadges(stats: WrappedStats): BadgeData[] {
  const badges: BadgeData[] = []

  if (stats.user_rank === 1) badges.push({ emoji: '🏆', nameKey: 'champion', descKey: 'championDesc' })
  else if (stats.user_rank === 2) badges.push({ emoji: '🥈', nameKey: 'runnerUp', descKey: 'runnerUpDesc' })
  else if (stats.user_rank === 3) badges.push({ emoji: '🥉', nameKey: 'bronze', descKey: 'bronzeDesc' })

  if (stats.exact_scores >= 15) badges.push({ emoji: '🧙', nameKey: 'wizard', descKey: 'exactScoresDesc', descParams: { count: stats.exact_scores } })
  else if (stats.exact_scores >= 8) badges.push({ emoji: '🎯', nameKey: 'sniper', descKey: 'exactScoresDesc', descParams: { count: stats.exact_scores } })
  else if (stats.exact_scores >= 3) badges.push({ emoji: '⚡', nameKey: 'sharpEye', descKey: 'exactScoresDesc', descParams: { count: stats.exact_scores } })

  if (stats.hit_rate_pct >= 70) badges.push({ emoji: '🔮', nameKey: 'oracle', descKey: 'hitRateDesc', descParams: { rate: stats.hit_rate_pct } })
  else if (stats.hit_rate_pct >= 55) badges.push({ emoji: '📊', nameKey: 'analyst', descKey: 'hitRateDesc', descParams: { rate: stats.hit_rate_pct } })

  if (stats.total_predictions >= 100) badges.push({ emoji: '💪', nameKey: 'allIn', descKey: 'allInDesc' })
  else if (stats.total_predictions >= 70) badges.push({ emoji: '⚽', nameKey: 'fanatic', descKey: 'fanaticDesc', descParams: { count: stats.total_predictions } })

  return badges.slice(0, 3)
}

function SlideBadges({ stats, accent }: { stats: WrappedStats; accent: string }) {
  const t = useTranslations('wrapped')
  const badges = computeBadges(stats)

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-6">
      <p className="text-white/50 uppercase tracking-widest text-sm font-bold animate-fade-in">{t('badges.title')}</p>
      {badges.length === 0 ? (
        <p className="text-white/30 text-lg">{t('badges.empty')}</p>
      ) : (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {badges.map(({ emoji, nameKey, descKey, descParams }, i) => (
            <div
              key={nameKey}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${accent}33`,
                animation: `popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) ${i * 130}ms both`,
              }}
            >
              <span className="text-3xl">{emoji}</span>
              <div className="text-left">
                <p className="font-[family-name:var(--font-oswald)] font-bold text-lg uppercase tracking-wide" style={{ color: accent }}>
                  {t(`badges.${nameKey}` as Parameters<typeof t>[0])}
                </p>
                <p className="text-white/45 text-xs">
                  {t(`badges.${descKey}` as Parameters<typeof t>[0], descParams as Record<string, string | number>)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SlideStageJourney({ stats, accent }: { stats: WrappedStats; accent: string }) {
  const t = useTranslations('wrapped')
  const entries = Object.entries(stats.points_by_stage)
  const maxPts = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-5 w-full">
      <div className="text-center">
        <p className="text-white/50 uppercase tracking-widest text-sm font-bold">{t('journey.title')}</p>
        <p className="text-white/25 text-xs mt-1">{t('journey.subtitle')}</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {entries.map(([stage, pts], i) => (
          <div key={stage} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-white/40 text-[11px] sm:text-xs leading-tight w-full sm:w-24 text-left sm:text-right shrink-0">
              {t(`journey.stage_${stage}` as Parameters<typeof t>[0])}
            </span>
            <div className="flex-1 h-7 sm:h-8 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-lg flex items-center justify-end pr-2 sm:pr-3"
                style={{
                  width: `${(pts / maxPts) * 100}%`,
                  background: accent,
                  animation: `growBar 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 200}ms both`,
                  minWidth: pts > 0 ? '2.75rem' : '0',
                }}
              >
                {pts > 0 && (
                  <span className="font-[family-name:var(--font-oswald)] font-bold text-xs sm:text-sm text-black/80 whitespace-nowrap">
                    {pts} pts
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SlideYourTeam({ stats, accent }: { stats: WrappedStats; accent: string }) {
  const t = useTranslations('wrapped')
  const team = stats.favorite_team
  const flagCode = team ? getTeamFlagCode(team) : null

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-5 overflow-y-auto py-4">
      <p className="text-white/50 uppercase tracking-widest text-sm font-bold">{t('team.title')}</p>

      {/* Favourite team block */}
      {team ? (
        <div className="flex flex-col items-center gap-3">
          {flagCode && (
            <div
              className="w-24 h-16 rounded-xl overflow-hidden shadow-2xl"
              style={{
                border: `2px solid ${accent}66`,
                animation: 'sweepFromLeft 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.2s both',
              }}
            >
              <Image src={getFlagUrl(flagCode, 160)} alt={team} width={96} height={64} className="w-full h-full object-cover" unoptimized />
            </div>
          )}
          <div
            className="font-[family-name:var(--font-oswald)] font-bold text-3xl sm:text-4xl uppercase tracking-wider"
            style={{
              color: accent,
              animation: 'sweepFromLeft 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.4s both',
            }}
          >
            {team}
          </div>
          <p className="text-white/40 text-xs uppercase tracking-widest animate-fade-in-delay">
            {t('team.predictedToWin', { count: stats.favorite_team_count })}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="text-5xl" style={{ animation: 'sweepFromLeft 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' }}>🤝</div>
          <div
            className="font-[family-name:var(--font-oswald)] font-bold text-3xl text-white"
            style={{ animation: 'sweepFromLeft 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.4s both' }}
          >
            {t('team.youLikedDraws')}
          </div>
        </div>
      )}

      {/* Best score teams */}
      {(stats.best_score_teams?.length ?? 0) > 0 && (
        <div
          className="w-full max-w-xs flex flex-col gap-2 pt-3"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            animation: 'fadeUp 0.5s ease 0.8s both',
          }}
        >
          <p className="text-white/35 text-xs uppercase tracking-widest mb-1">{t('team.bestAtCalling')}</p>
          {stats.best_score_teams?.map(({ team: teamName, count }, i) => {
            const fc = getTeamFlagCode(teamName)
            return (
              <div
                key={teamName}
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${accent}22`,
                  animation: `popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${0.9 + i * 0.13}s both`,
                }}
              >
                <div className="flex items-center gap-3">
                  {fc && (
                    <div className="w-8 h-6 rounded overflow-hidden shrink-0">
                      <Image src={getFlagUrl(fc, 40)} alt={teamName} width={32} height={24} className="w-full h-full object-cover" unoptimized />
                    </div>
                  )}
                  <span className="text-white text-sm font-semibold">{teamName}</span>
                </div>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-base" style={{ color: accent }}>
                  {t('team.exactTimes', { count })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SlideRank({ stats, accent }: { stats: WrappedStats; accent: string }) {
  const t = useTranslations('wrapped')
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4">
      <p className="text-white/50 uppercase tracking-widest text-sm font-bold">{t('rank.title')}</p>
      <div
        className="font-[family-name:var(--font-oswald)] font-bold leading-none"
        style={{
          fontSize: 'clamp(5rem, 25vw, 10rem)',
          color: accent,
          animation: 'dropBounce 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s both',
        }}
      >
        #{stats.user_rank}
      </div>
      <p className="font-[family-name:var(--font-oswald)] text-xl text-white uppercase tracking-wide animate-fade-up">
        {t('rank.ofPlayers', { count: stats.total_members })}
      </p>
    </div>
  )
}

function SlidePodium({ stats, accent, onClose }: { stats: WrappedStats; accent: string; onClose: () => void }) {
  const t = useTranslations('wrapped')
  const podium = stats.top_three
  const [visible, setVisible] = useState<number[]>([])

  useEffect(() => {
    const timers = [
      setTimeout(() => setVisible(v => [...v, 2]), 300),  // 3rd
      setTimeout(() => setVisible(v => [...v, 1]), 800),  // 2nd
      setTimeout(() => setVisible(v => [...v, 0]), 1400), // 1st
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const podiumOrder = [
    podium[1] ?? null, // 2nd (left)
    podium[0] ?? null, // 1st (center)
    podium[2] ?? null, // 3rd (right)
  ]
  const podiumHeights = ['h-20 sm:h-28', 'h-28 sm:h-40', 'h-14 sm:h-20']
  const podiumVisibleIdx = [1, 0, 2] // which podium.index matches

  return (
    <div
      className="flex flex-col items-center justify-between h-full px-6 gap-4"
      style={{
        paddingTop: '1.5rem',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="text-center">
        <p className="text-white/50 uppercase tracking-widest text-xs font-bold mb-1">{t('podium.title')}</p>
        <p className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">{t('podium.subtitle')}</p>
      </div>

      {/* Player avatars above bars */}
      <div className="flex items-end justify-center gap-4 flex-1 w-full max-w-xs">
        {podiumOrder.map((entry, i) => {
          if (!entry) return <div key={i} className="w-24" />
          const dataIdx = podiumVisibleIdx[i]
          const isVisible = visible.includes(dataIdx)
          const is1st = entry.rank === 1

          return (
            <div
              key={i}
              className="flex flex-col items-center gap-2"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible
                  ? 'translateY(0)'
                  : is1st ? 'translateY(-60px)' : 'translateY(40px)',
                transition: 'opacity 0.5s ease, transform 0.6s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              {is1st && <span className="text-2xl">🏆</span>}
              {/* Avatar */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-[family-name:var(--font-oswald)] font-bold text-lg"
                style={{
                  background: entry.is_current_user ? accent : 'rgba(255,255,255,0.12)',
                  color: entry.is_current_user ? '#000' : '#fff',
                  border: entry.is_current_user ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.15)',
                  boxShadow: entry.is_current_user ? `0 0 20px ${accent}66` : 'none',
                }}
              >
                {(entry.display_name ?? entry.username).charAt(0).toUpperCase()}
              </div>
              <span className="text-white text-xs font-semibold text-center max-w-[5rem] truncate">
                {entry.display_name ?? entry.username}
              </span>
              <span className="text-white/50 text-xs font-bold">{entry.total_points} pts</span>

              {/* Podium bar */}
              <div
                className={`w-20 ${podiumHeights[i]} rounded-t-xl flex items-center justify-center`}
                style={{
                  background: is1st ? accent : 'rgba(255,255,255,0.12)',
                  border: `1px solid ${is1st ? accent : 'rgba(255,255,255,0.15)'}`,
                }}
              >
                <span
                  className="font-[family-name:var(--font-oswald)] font-bold text-2xl"
                  style={{ color: is1st ? '#000' : '#fff' }}
                >
                  {entry.rank}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={onClose}
        className="w-full max-w-xs py-4 rounded-2xl font-[family-name:var(--font-oswald)] font-bold text-lg uppercase tracking-widest transition-all duration-200"
        style={{
          background: accent,
          color: '#000',
          border: 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
      >
        {t('podium.done')}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface WrappedExperienceProps {
  stats: WrappedStats
  leagueName: string
  onClose: () => void
}

export default function WrappedExperience({ stats, leagueName, onClose }: WrappedExperienceProps) {
  const [slide, setSlide] = useState(0)
  const totalSlides = 8
  const theme = SLIDE_THEMES[slide] ?? SLIDE_THEMES[0]
  const touchStartX = useRef<number | null>(null)

  // Escape key handler
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 50) return
    if (dx < 0) setSlide(s => Math.min(totalSlides - 1, s + 1))
    else setSlide(s => Math.max(0, s - 1))
  }

  const slides = [
    <SlideIntro key={0} leagueName={leagueName} accent={theme.accent} />,
    <SlideVolume key={1} stats={stats} accent={theme.accent} />,
    <SlideAccuracy key={2} stats={stats} accent={theme.accent} />,
    <SlideBadges key={3} stats={stats} accent={theme.accent} />,
    <SlideStageJourney key={4} stats={stats} accent={theme.accent} />,
    <SlideYourTeam key={5} stats={stats} accent={theme.accent} />,
    <SlideRank key={6} stats={stats} accent={theme.accent} />,
    <SlidePodium key={7} stats={stats} accent={theme.accent} onClose={onClose} />,
  ]

  return (
    <>
      {/* Keyframe styles */}
      <style>{`
        @keyframes bounceIn {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.8) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes growBar {
          from { width: 0; }
        }
        @keyframes sweepFromLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes dropBounce {
          0% { opacity: 0; transform: translateY(-80px); }
          60% { transform: translateY(10px); }
          80% { transform: translateY(-4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-bounce-in { animation: bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both; }
        .animate-bounce-in-delay { animation: bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.8s both; }
        .animate-fade-up { animation: fadeUp 0.5s ease 0.3s both; }
        .animate-fade-up-delay { animation: fadeUp 0.5s ease 0.6s both; }
        .animate-fade-up-delay-2 { animation: fadeUp 0.5s ease 0.9s both; }
        .animate-scale-in { animation: scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both; }
        .animate-fade-in { animation: fadeIn 0.4s ease 0.2s both; }
        .animate-fade-in-delay { animation: fadeIn 0.4s ease 0.6s both; }
      `}</style>

      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{
          background: theme.bg,
          transition: 'background 0.5s ease',
        }}
      >
        {/* Top bar — progress dots + controls (safe-area aware) */}
        <div
          className="flex items-center justify-between px-5 pb-2 shrink-0"
          style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
        >
          <div className="flex gap-1.5">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i === slide ? 24 : 8,
                  background: i <= slide ? theme.accent : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Slide content — swipeable */}
        <div
          className="flex-1 min-h-0 overflow-hidden"
          key={slide}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {slides[slide]}
        </div>

        {/* Bottom nav — only show on slides 0–6; slide 7 has its own Done button */}
        {slide < totalSlides - 1 && (
          <div
            className="flex items-center justify-between px-6 pt-4 shrink-0"
            style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={() => setSlide(s => Math.max(0, s - 1))}
              className="px-4 py-3 text-sm font-bold uppercase tracking-widest transition-opacity"
              style={{ color: 'rgba(255,255,255,0.35)', opacity: slide === 0 ? 0 : 1, pointerEvents: slide === 0 ? 'none' : 'auto' }}
            >
              Back
            </button>
            <button
              onClick={() => setSlide(s => Math.min(totalSlides - 1, s + 1))}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-[family-name:var(--font-oswald)] font-bold text-base uppercase tracking-wide transition-all duration-200"
              style={{ background: theme.accent, color: '#000' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  )
}
