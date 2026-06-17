'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { useSimulatedBracket, type SimulateMode } from '@/lib/hooks/useSimulatedBracket'
import { KNOCKOUT_SCHEDULE } from '@/lib/simulation'
import { BracketTree } from '@/components/bracket/BracketTree'
import { getTeamFlagCode, getFlagUrl, translateTeamName, translateGroupName } from '@/lib/flags'
import { rankThirdPlaceTeams } from '@/lib/simulation'
import type { SimulatedGroup } from '@/lib/simulation'

type Step = 'entry' | 'standings' | 'bracket'

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className ?? ''}`}
      style={{ background: 'rgba(255,255,255,0.04)' }}
    />
  )
}

function TeamFlag({ name }: { name: string }) {
  const code = getTeamFlagCode(name)
  if (!code) return <div className="w-5 h-3.5 rounded shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
  return (
    <div className="w-5 h-3.5 rounded overflow-hidden shrink-0" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <Image src={getFlagUrl(code, 20)} alt={name} width={20} height={14} className="w-full h-full object-cover" unoptimized />
    </div>
  )
}

function ModeBadge({ mode }: { mode: SimulateMode }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
      style={{
        background: mode === 'real' ? 'rgba(74,200,120,0.08)' : 'rgba(240,180,41,0.08)',
        border: `1px solid ${mode === 'real' ? 'rgba(74,200,120,0.25)' : 'rgba(240,180,41,0.2)'}`,
        color: mode === 'real' ? '#4ac878' : '#f0b429',
      }}
    >
      <span>{mode === 'real' ? '⚡' : '🔮'}</span>
      {mode === 'real' ? 'Real Results' : 'My Predictions'}
    </div>
  )
}

function GroupStandingsPreview({ groups, qualifiedThirdLetters, predictedCount, totalGroupMatches, isError, mode, onContinue, onBack }: {
  groups: SimulatedGroup[]
  qualifiedThirdLetters: Set<string>
  predictedCount: number
  totalGroupMatches: number
  isError: boolean
  mode: SimulateMode
  onContinue: () => void
  onBack: () => void
}) {
  const t = useTranslations('simulate')
  const locale = useLocale()

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <button onClick={onBack} className="text-[#4a5c70] hover:text-white text-sm transition-colors mb-4 block">
          {t('standings_preview_back')}
        </button>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
            style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)', color: '#f0b429' }}
          >
            {t('standings_preview_badge')}
          </div>
          <ModeBadge mode={mode} />
        </div>
        <h1 className="font-[family-name:var(--font-oswald)] font-bold text-2xl sm:text-3xl uppercase tracking-widest text-white leading-none mb-1">
          {t('standings_preview_title')}
        </h1>
        <p className="text-[#4a5c70] text-sm">{t('standings_preview_subtitle')}</p>
        {totalGroupMatches > 0 && predictedCount < totalGroupMatches && (
          <p className="text-[#5a6a80] text-xs mt-1.5">
            {predictedCount} of {totalGroupMatches} matches predicted — unpredicted games count as 0-0
          </p>
        )}
        {isError && (
          <p className="text-red-400 text-xs mt-2">{t('load_error')}</p>
        )}
      </div>

      {/* Groups grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {groups.map(group => (
          <div
            key={group.group}
            className="rounded-2xl overflow-hidden"
            style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {/* Group header */}
            <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="font-[family-name:var(--font-oswald)] font-bold text-sm uppercase tracking-widest text-white">
                {translateGroupName(group.group, locale)}
              </span>
            </div>

            {/* Column headers */}
            <div className="grid px-3 py-1.5" style={{ gridTemplateColumns: '1fr repeat(6, auto)', gap: '0 10px' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#2d3e52' }}></span>
              {(['col_p','col_w','col_d','col_l','col_gd','col_pts'] as const).map(k => (
                <span key={k} className="text-[10px] font-bold uppercase tracking-wider text-center w-5" style={{ color: '#2d3e52' }}>{t(k)}</span>
              ))}
            </div>

            {/* Rows */}
            {group.standings.map((team, idx) => {
              const isTop2 = idx < 2
              const is3rdQualified = idx === 2 && qualifiedThirdLetters.has(group.letter)
              const accentColor = isTop2
                ? 'rgba(240,180,41,0.6)'
                : is3rdQualified
                  ? 'rgba(100,140,200,0.5)'
                  : 'transparent'

              return (
                <div
                  key={team.team}
                  className="grid items-center px-3 py-1.5 relative"
                  style={{
                    gridTemplateColumns: '1fr repeat(6, auto)',
                    gap: '0 10px',
                    background: isTop2 ? 'rgba(240,180,41,0.03)' : is3rdQualified ? 'rgba(100,140,200,0.03)' : 'transparent',
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                  }}
                >
                  {/* Left accent */}
                  {(isTop2 || is3rdQualified) && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full" style={{ background: accentColor }} />
                  )}
                  {/* Team */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold w-3 shrink-0" style={{ color: '#2d3e52' }}>{idx + 1}</span>
                    <TeamFlag name={team.team} />
                    <span className="font-[family-name:var(--font-oswald)] font-semibold text-xs uppercase tracking-wide truncate" style={{ color: isTop2 ? 'rgba(255,255,255,0.9)' : is3rdQualified ? 'rgba(255,255,255,0.7)' : '#4a5c70' }}>
                      {translateTeamName(team.team, locale)}
                    </span>
                  </div>
                  {/* Stats */}
                  {[team.played, team.won, team.drawn, team.lost, team.gd, team.pts].map((val, i) => (
                    <span
                      key={i}
                      className="text-xs font-bold text-center w-5 tabular-nums"
                      style={{ color: i === 5 ? (isTop2 ? '#f0b429' : is3rdQualified ? '#7090c0' : '#3a4a5c') : '#3a4a5c' }}
                    >
                      {i === 4 && val > 0 ? `+${val}` : val}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex justify-end">
        <button
          onClick={onContinue}
          className="px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-200 bg-[#f0b429] text-[#080c14] hover:bg-[#fcd86e] cursor-pointer"
        >
          {t('standings_preview_cta')}
        </button>
      </div>
    </main>
  )
}

export default function SimulatePage() {
  const { data: user, isLoading: userLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useOnboardingGuard(user, userLoading)
  const t = useTranslations('simulate')
  const [step, setStep] = useState<Step>('entry')
  const [mode, setMode] = useState<SimulateMode>('real')

  const { r32Matchups, groups, hasPredictions, slotAssignmentValid, predictedCount, totalGroupMatches, isLoading, isError } = useSimulatedBracket(mode)

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    )
  }

  // ── Standings preview ──────────────────────────────────────────────────────
  if (step === 'standings') {
    const qualifiedThirdLetters = new Set(rankThirdPlaceTeams(groups).map(t => t.letter))
    return (
      <GroupStandingsPreview
        groups={groups}
        qualifiedThirdLetters={qualifiedThirdLetters}
        predictedCount={predictedCount}
        totalGroupMatches={totalGroupMatches}
        isError={isError}
        mode={mode}
        onContinue={() => setStep('bracket')}
        onBack={() => setStep('entry')}
      />
    )
  }

  // ── Entry screen ───────────────────────────────────────────────────────────
  if (step === 'entry') {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-[11px] font-bold uppercase tracking-widest"
            style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)', color: '#f0b429' }}
          >
            {t('badge')}
          </div>
          <h1
            className="font-[family-name:var(--font-oswald)] font-bold text-3xl sm:text-4xl uppercase tracking-widest text-white mb-3"
          >
            {t('title')}
          </h1>
          <p className="text-[#6b7f96] text-sm leading-relaxed max-w-sm mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Mode toggle */}
        <div
          className="w-full flex rounded-xl overflow-hidden mb-6"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
        >
          {(['real', 'predictions'] as SimulateMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
              style={{
                background: mode === m ? '#f0b429' : 'transparent',
                color: mode === m ? '#080c14' : '#4a5c70',
              }}
            >
              {m === 'real' ? `⚡ ${t('mode_real')}` : `🔮 ${t('mode_predictions')}`}
            </button>
          ))}
        </div>

        {/* Info card */}
        <div
          className="w-full rounded-2xl p-5 mb-6 space-y-3"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-3"
            style={{ color: '#4a5c70' }}
          >
            {t('info_title')}
          </p>
          {([
            { icon: '🔄', key: 'info_seeded' },
            { icon: '🖱️', key: 'info_interactive' },
            { icon: '🗑️', key: 'info_ephemeral' },
            { icon: '📸', key: 'info_share' },
          ] as const).map(({ icon, key }) => (
            <div key={key} className="flex items-start gap-3">
              <span className="text-sm mt-0.5 shrink-0">{icon}</span>
              <p className="text-[#7a8fa8] text-[13px] leading-relaxed">
                {t(key)}
              </p>
            </div>
          ))}
        </div>

        {/* No predictions warning */}
        {!hasPredictions && (
          <div
            className="w-full rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
            style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}
          >
            <span className="text-orange-400 text-sm shrink-0 mt-0.5">⚠</span>
            <div>
              <p className="text-orange-300 text-[13px] font-semibold mb-0.5">
                {t('no_predictions_title')}
              </p>
              <p className="text-[#9a8070] text-[12px] leading-relaxed">
                {t('no_predictions_desc')}{' '}
                <Link
                  href="/predictions"
                  className="text-orange-400 underline underline-offset-2 hover:text-orange-300 transition-colors"
                >
                  {t('go_to_picks')}
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => setStep('standings')}
          disabled={!hasPredictions}
          className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-200
            ${hasPredictions
              ? 'bg-[#f0b429] text-[#080c14] hover:bg-[#fcd86e] cursor-pointer'
              : 'bg-white/[0.05] text-[#3a4a5c] cursor-not-allowed border border-white/[0.06]'
            }`}
        >
          {t('start_cta')}
        </button>

        {isError && (
          <p className="text-red-400 text-xs mt-3">{t('load_error')}</p>
        )}
      </main>
    )
  }

  // ── Bracket view ───────────────────────────────────────────────────────────
  return (
    <main className="px-4 sm:px-6 py-8" style={{ maxWidth: '100%' }}>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] font-bold text-2xl uppercase tracking-widest text-white">
            {t('title')}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[#4a5c70] text-xs">{t('bracket_subtitle')}</p>
            <ModeBadge mode={mode} />
          </div>
          {!slotAssignmentValid && (
            <p className="text-[#7a6030] text-xs mt-2">
              ⚠ Third-place seeding is approximate — complete all 12 groups for correct FIFA bracket placement.
            </p>
          )}
          {isError && (
            <p className="text-red-400 text-xs mt-2">{t('load_error')}</p>
          )}
        </div>
        <button
          onClick={() => setStep('standings')}
          className="text-[#4a5c70] hover:text-white text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.05] shrink-0 ml-4"
        >
          ← {t('back')}
        </button>
      </div>

      <BracketTree key={mode} r32={r32Matchups} username={user?.display_name ?? user?.username ?? 'My'} schedule={KNOCKOUT_SCHEDULE} />
    </main>
  )
}
