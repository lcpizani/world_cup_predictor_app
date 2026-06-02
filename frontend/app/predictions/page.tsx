'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getTeamFlagCode, getFlagUrl, translateTeamName, translateGroupName, getTeamAbbr } from '@/lib/flags'
import type { Match, Prediction } from '@/types/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { useLocale, useTranslations } from 'next-intl'
import { formatMatchDateTime } from '@/lib/date'
import ScoringExplanationModal from '@/components/ScoringExplanationModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function TeamFlag({ name }: { name: string }) {
  const code = getTeamFlagCode(name)
  if (!code) return null
  return (
    <div className="w-9 h-6 sm:w-11 sm:h-7 rounded overflow-hidden shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      <Image src={getFlagUrl(code, 40)} alt={name} width={36} height={24} className="w-full h-full object-cover" unoptimized />
    </div>
  )
}

function outcomeOf(h: number, a: number): number {
  return h > a ? 1 : h < a ? -1 : 0
}

function ResultBadge({ exact, winner, hasPred }: { exact: boolean; winner: boolean; hasPred: boolean }) {
  const t = useTranslations('predictions')
  if (!hasPred) return null
  if (exact) return (
    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      {t('exact')}
    </span>
  )
  if (winner) return (
    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-[#f0b429]" style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.2)' }}>
      {t('winner')}
    </span>
  )
  return (
    <span className="text-[10px] sm:text-xs font-medium text-[#2d3e52]">{t('miss')}</span>
  )
}

function StatusBadge({ status, kickoff_at, timezone, minute }: { status: string; kickoff_at: string; timezone?: string | null; minute?: number | null }) {
  const t = useTranslations('predictions')
  const locale = useLocale()
  if (status === 'live') return (
    <span className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      {minute != null ? `${minute}'` : t('live')}
    </span>
  )
  if (status === 'finished') return (
    <span className="text-[9px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider" style={{ color: '#3f5068', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {t('ft')}
    </span>
  )
  const label = formatMatchDateTime(kickoff_at, timezone, locale)
  return (
    <span className="text-[9px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wider text-[#f0b429]" style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)' }}>
      {label}
    </span>
  )
}

function isValidScore(v: string): boolean {
  if (v === '') return false
  const n = Number(v)
  return Number.isInteger(n) && n >= 0
}

function PredictionRow({ match, prediction, timezone }: { match: Match; prediction?: Prediction; timezone?: string | null }) {
  const t = useTranslations('predictions')
  const locale = useLocale()
  const qc = useQueryClient()
  const [home, setHome] = useState(prediction?.predicted_home?.toString() ?? '')
  const [away, setAway] = useState(prediction?.predicted_away?.toString() ?? '')
  const [showSaved, setShowSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const showSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isLocked = !!prediction?.is_locked || match.status !== 'scheduled'

  const save = useMutation({
    mutationFn: () => {
      const h = parseInt(home), a = parseInt(away)
      if (isNaN(h) || isNaN(a) || h < 0 || a < 0) throw new Error('Enter valid scores')
      if (prediction) return api.updatePrediction(prediction.id, { predicted_home: h, predicted_away: a })
      return api.submitPrediction({ match_id: match.id, predicted_home: h, predicted_away: a })
    },
    onSuccess: () => {
      setSaveError(null)
      qc.invalidateQueries({ queryKey: ['predictions-global'] })
      if (showSavedTimer.current) clearTimeout(showSavedTimer.current)
      setShowSaved(true)
      showSavedTimer.current = setTimeout(() => setShowSaved(false), 2000)
    },
    onError: (e: Error) => setSaveError(e.message || t('error_saving')),
  })

  // Debounced auto-save: fires 700 ms after last change if both scores are valid
  useEffect(() => {
    const timer = setTimeout(() => {
      // Re-check isLocked at fire time so a match transitioning to live during the
      // 700 ms window doesn't submit a prediction on a now-locked match
      if (isLocked) return
      if (!isValidScore(home) || !isValidScore(away)) return
      // Skip if nothing has changed from what's already persisted
      const savedHome = prediction?.predicted_home?.toString() ?? ''
      const savedAway = prediction?.predicted_away?.toString() ?? ''
      if (home === savedHome && away === savedAway) return
      save.mutate()
    }, 700)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away])

  // ── Finished or live-with-scores match ───────────────────────────────────
  if (match.status === 'finished' || (match.status === 'live' && match.home_score !== null)) {
    const hasPred = !!prediction
    const ah = match.home_score, aa = match.away_score
    const ph = prediction?.predicted_home, pa = prediction?.predicted_away

    const scoreColors = (() => {
      if (!hasPred || ah === null || aa === null) return { home: '', away: '', winner: false }
      const correctWinner = outcomeOf(ph!, pa!) === outcomeOf(ah!, aa!)
      const correctDiff = (ph! - pa!) === (ah! - aa!)
      if (ph === ah && pa === aa) return { home: 'green', away: 'green', winner: true }
      return {
        home: ph === ah ? 'green' : correctDiff ? 'yellow' : '',
        away: pa === aa ? 'green' : correctDiff ? 'yellow' : '',
        winner: correctWinner,
      }
    })()

    const exact = scoreColors.home === 'green' && scoreColors.away === 'green'

    const accentColor = !hasPred ? 'transparent'
      : exact ? 'rgba(34,197,94,0.7)'
      : scoreColors.winner ? 'rgba(240,180,41,0.7)'
      : 'rgba(255,255,255,0.1)'

    const pillStyle = exact
      ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }
      : scoreColors.winner
        ? { background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.18)' }
        : { border: '1px solid transparent' }

    return (
      <div className="rounded-2xl p-3 sm:p-4 transition-all duration-200 overflow-hidden relative" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
        {hasPred && (
          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: accentColor }} />
        )}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[9px] sm:text-[11px] font-mono tracking-wide uppercase truncate" style={{ color: '#3f5068' }}>
              {STAGE_ORDER.includes(match.stage) ? t(`stage_${match.stage}`) : match.stage.replace(/_/g, ' ')}
            </span>
            {match.group && (
              <span className="text-[9px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0" style={{ color: '#5a6a82', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {translateGroupName(match.group, locale)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ResultBadge exact={exact} winner={scoreColors.winner} hasPred={hasPred} />
            <StatusBadge status={match.status} kickoff_at={match.kickoff_at} timezone={timezone} minute={match.minute} />
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex-1 flex items-center justify-end gap-2 sm:gap-2.5 min-w-0">
            <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-sm sm:text-lg">
              <span className="sm:hidden">{getTeamAbbr(match.home_team)}</span><span className="hidden sm:inline">{translateTeamName(match.home_team, locale)}</span>
            </span>
            <TeamFlag name={match.home_team} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasPred ? (
              <div className="flex flex-col items-center gap-1 w-20 sm:w-28">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg" style={pillStyle}>
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-xl sm:text-2xl w-5 sm:w-7 text-center ${scoreColors.home === 'green' ? 'text-green-400' : scoreColors.home === 'yellow' ? 'text-[#f0b429]' : 'text-white'}`}>
                    {ph}
                  </span>
                  <span className="font-bold text-sm sm:text-base" style={{ color: '#2d3e52' }}>–</span>
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-xl sm:text-2xl w-5 sm:w-7 text-center ${scoreColors.away === 'green' ? 'text-green-400' : scoreColors.away === 'yellow' ? 'text-[#f0b429]' : 'text-white'}`}>
                    {pa}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-[family-name:var(--font-oswald)] text-sm sm:text-base w-4 sm:w-5 text-center" style={{ color: '#3f5068' }}>{ah}</span>
                  <span className="text-xs sm:text-sm" style={{ color: '#1e2d40' }}>–</span>
                  <span className="font-[family-name:var(--font-oswald)] text-sm sm:text-base w-4 sm:w-5 text-center" style={{ color: '#3f5068' }}>{aa}</span>
                </div>
              </div>
            ) : (
              <span className="font-[family-name:var(--font-oswald)] font-bold text-xl sm:text-3xl w-20 sm:w-28 text-center" style={{ color: '#3f5068' }}>
                {ah} – {aa}
              </span>
            )}
          </div>
          <div className="flex-1 flex items-center gap-2 sm:gap-2.5 min-w-0">
            <TeamFlag name={match.away_team} />
            <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-sm sm:text-lg">
              <span className="sm:hidden">{getTeamAbbr(match.away_team)}</span><span className="hidden sm:inline">{translateTeamName(match.away_team, locale)}</span>
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ── Upcoming / live ───────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl p-3 sm:p-4 transition-all duration-200" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] sm:text-[11px] font-mono tracking-wide uppercase truncate" style={{ color: '#3f5068' }}>
            {STAGE_ORDER.includes(match.stage) ? t(`stage_${match.stage}`) : match.stage.replace(/_/g, ' ')}
          </span>
          {match.group && (
            <span className="text-[9px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0" style={{ color: '#5a6a82', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {translateGroupName(match.group, locale)}
            </span>
          )}
        </div>
        <StatusBadge status={match.status} kickoff_at={match.kickoff_at} timezone={timezone} minute={match.minute} />
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-xs sm:text-base">
            <span className="sm:hidden">{getTeamAbbr(match.home_team)}</span><span className="hidden sm:inline">{translateTeamName(match.home_team, locale)}</span>
          </span>
          <TeamFlag name={match.home_team} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0 justify-center w-24 sm:w-32">
          {isLocked ? (
            prediction ? (
              <span className="font-[family-name:var(--font-oswald)] font-bold text-lg sm:text-xl text-white tabular-nums">
                {prediction.predicted_home} – {prediction.predicted_away}
              </span>
            ) : (
              <span className="text-xs sm:text-sm text-[#1e2d40]">{t('locked')}</span>
            )
          ) : (
            <>
              <input
                type="number" min={0} value={home}
                onChange={(e) => setHome(e.target.value)}
                placeholder=""
                inputMode="numeric"
                aria-label={`${match.home_team} score`}
                className="w-11 sm:w-14 text-white text-center font-[family-name:var(--font-oswald)] font-bold text-base sm:text-lg rounded-lg px-1 py-1.5 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(240,180,41,0.08)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
              />
              <span className="text-[#4a6080] font-bold text-sm sm:text-base">–</span>
              <input
                type="number" min={0} value={away}
                onChange={(e) => setAway(e.target.value)}
                placeholder=""
                inputMode="numeric"
                aria-label={`${match.away_team} score`}
                className="w-11 sm:w-14 text-white text-center font-[family-name:var(--font-oswald)] font-bold text-base sm:text-lg rounded-lg px-1 py-1.5 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(240,180,41,0.08)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </>
          )}
        </div>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamFlag name={match.away_team} />
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-xs sm:text-base">
            <span className="sm:hidden">{getTeamAbbr(match.away_team)}</span><span className="hidden sm:inline">{translateTeamName(match.away_team, locale)}</span>
          </span>
        </div>
        {/* Save-status indicator — fixed-width slot on the far right */}
        <div className="w-5 shrink-0 flex items-center justify-center">
          {!isLocked && save.isPending && (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#5a6a82' }}>
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          )}
          {!isLocked && !save.isPending && showSaved && (
            <span className="text-green-400 text-xs font-bold">✓</span>
          )}
          {!isLocked && !save.isPending && !!saveError && (
            <span className="text-red-400 text-xs font-bold">!</span>
          )}
        </div>
      </div>
      {saveError && (
        <p className="text-xs text-red-400 mt-2">{saveError}</p>
      )}
    </div>
  )
}

// ── Stage constants ────────────────────────────────────────────────────────────

const STAGE_ORDER = ['group_stage', 'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final']

// ── Accordion helpers ──────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
      style={{ color: '#3f5068' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function AccordionSection({
  sectionKey, header, isOpen, onToggle, children,
}: {
  sectionKey: string
  header: ReactNode
  isOpen: boolean
  onToggle: (key: string) => void
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between gap-3 p-3 sm:p-4 text-left transition-colors duration-150"
        style={{ background: '#0d1520' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#111e2e')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#0d1520')}
      >
        {header}
        <Chevron open={isOpen} />
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-2 space-y-3" style={{ background: '#080c14', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── GroupStageView ─────────────────────────────────────────────────────────────

function GroupStageView({
  matches, predByMatch, openSections, onToggle, timezone,
}: {
  matches: Match[]
  predByMatch: Record<string, Prediction>
  openSections: Set<string>
  onToggle: (key: string) => void
  timezone?: string | null
}) {
  const t = useTranslations('predictions')
  const locale = useLocale()

  const groups = useMemo(() => {
    const groupSet = new Set<string>()
    matches
      .filter(m => m.stage === 'group_stage' && m.group)
      .forEach(m => groupSet.add(m.group!))
    return Array.from(groupSet).sort()
  }, [matches])

  const groupMatches = useMemo(() => {
    const map: Record<string, Match[]> = {}
    for (const g of groups) {
      map[g] = matches
        .filter(m => m.group === g)
        .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
    }
    return map
  }, [matches, groups])

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52]">
          {t('stage_not_yet_seeded')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {groups.map(group => {
        const gMatches = groupMatches[group] ?? []
        const missingCount = gMatches.filter(
          m => m.status === 'scheduled' && !predByMatch[m.id]
        ).length
        const isOpen = openSections.has(group)

        const header = (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="font-[family-name:var(--font-oswald)] font-bold text-sm sm:text-base uppercase tracking-wider text-white truncate">
              {translateGroupName(group, locale)}
            </span>
            {missingCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500 text-white shrink-0">
                {t('missing_picks', { count: missingCount })}
              </span>
            )}
          </div>
        )

        return (
          <AccordionSection
            key={group}
            sectionKey={group}
            header={header}
            isOpen={isOpen}
            onToggle={onToggle}
          >
            {gMatches.map(m => (
              <PredictionRow key={m.id} match={m} prediction={predByMatch[m.id]} timezone={timezone} />
            ))}
          </AccordionSection>
        )
      })}
    </div>
  )
}

// ── KnockoutStageView ──────────────────────────────────────────────────────────

function KnockoutStageView({
  matches, predByMatch, openSections, onToggle, timezone,
}: {
  matches: Match[]
  predByMatch: Record<string, Prediction>
  openSections: Set<string>
  onToggle: (key: string) => void
  timezone?: string | null
}) {
  const t = useTranslations('predictions')
  const locale = useLocale()

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [matches]
  )

  if (sortedMatches.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52] mb-1">
          {t('stage_not_yet_seeded')}
        </p>
        <p className="text-sm text-[#3f5068]">{t('stage_seeded_later')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sortedMatches.map(m => {
        const isOpen = openSections.has(m.id)
        const home = translateTeamName(m.home_team, locale)
        const away = translateTeamName(m.away_team, locale)

        const header = (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <span className="font-[family-name:var(--font-oswald)] font-semibold text-sm sm:text-base text-white uppercase tracking-wide truncate">
                {home}
              </span>
              <span className="text-[#3f5068] text-xs font-bold shrink-0 mx-1">vs</span>
              <span className="font-[family-name:var(--font-oswald)] font-semibold text-sm sm:text-base text-white uppercase tracking-wide truncate">
                {away}
              </span>
            </div>
            <StatusBadge status={m.status} kickoff_at={m.kickoff_at} timezone={timezone} minute={m.minute} />
          </div>
        )

        return (
          <AccordionSection
            key={m.id}
            sectionKey={m.id}
            header={header}
            isOpen={isOpen}
            onToggle={onToggle}
          >
            <PredictionRow match={m} prediction={predByMatch[m.id]} timezone={timezone} />
          </AccordionSection>
        )
      })}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PredictionsPage() {
  const t = useTranslations('predictions')
  const tScoring = useTranslations('scoringHelp')
  const locale = useLocale()
  const [tab, setTab] = useState<'upcoming' | 'finished'>('upcoming')
  const [refreshing, setRefreshing] = useState(false)
  const [showScoringHelp, setShowScoringHelp] = useState(false)

  // view mode state (tasks 1.1–1.4)
  const [viewMode, setViewMode] = useState<'chronological' | 'stage-group'>('chronological')
  const [teamSearch, setTeamSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [activeStage, setActiveStage] = useState('')
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  const qc = useQueryClient()
  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useOnboardingGuard(me, meLoading)

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['matches'] }),
      qc.invalidateQueries({ queryKey: ['predictions-global'] }),
    ])
    setRefreshing(false)
  }

  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.listMatches(),
    refetchInterval: 60_000,
  })

  const { data: predictions = [], isLoading: predsLoading } = useQuery({
    queryKey: ['predictions-global'],
    queryFn: () => api.listPredictions(),
    refetchInterval: 60_000,
  })

  const predByMatch = Object.fromEntries(predictions.map(p => [p.match_id, p]))

  // task 1.5 — available stages in fixed priority order
  const availableStages = useMemo(() => {
    const stageSet = new Set(matches.map(m => m.stage))
    return STAGE_ORDER.filter(s => stageSet.has(s))
  }, [matches])

  // task 1.6 — available groups sorted alphabetically
  const availableGroups = useMemo(() => {
    const groupSet = new Set<string>()
    matches.forEach(m => { if (m.group) groupSet.add(m.group) })
    return Array.from(groupSet).sort()
  }, [matches])

  const sorted = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [matches]
  )

  // task 1.7 — filtered matches for chronological mode
  // checks both the raw (English) team name and the translated name so filters work in any language
  const filteredMatches = useMemo(() => {
    return sorted.filter(m => {
      if (teamSearch) {
        const s = teamSearch.toLowerCase()
        const homeRaw = m.home_team.toLowerCase()
        const awayRaw = m.away_team.toLowerCase()
        const homeTranslated = translateTeamName(m.home_team, locale).toLowerCase()
        const awayTranslated = translateTeamName(m.away_team, locale).toLowerCase()
        if (
          !homeRaw.includes(s) && !awayRaw.includes(s) &&
          !homeTranslated.includes(s) && !awayTranslated.includes(s)
        ) return false
      }
      if (groupFilter && m.group !== groupFilter) return false
      return true
    })
  }, [sorted, teamSearch, groupFilter, locale])

  const upcoming = filteredMatches.filter(m => m.status === 'scheduled' || m.status === 'live')
  const finished = filteredMatches.filter(m => m.status === 'finished').reverse()

  const upcomingMissing = upcoming.filter(m => !predByMatch[m.id]).length
  const finishedWithPred = finished.filter(m => !!predByMatch[m.id]).length

  const hasActiveFilters = teamSearch !== '' || groupFilter !== ''

  const isLoading = matchesLoading || predsLoading

  // task 4.3 — stage display name lookup (type-safe, uses t())
  const stageLabels: Record<string, string> = {
    group_stage: t('stage_group_stage'),
    round_of_16: t('stage_round_of_16'),
    quarter_finals: t('stage_quarter_finals'),
    semi_finals: t('stage_semi_finals'),
    third_place: t('stage_third_place'),
    final: t('stage_final'),
  }

  // matches for the currently active knockout stage
  const stageMatches = useMemo(
    () => matches.filter(m => m.stage === activeStage),
    [matches, activeStage]
  )

  function toggleSection(key: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // task 4.5 — entering stage-group mode sets active stage and resets open sections
  function enterStageGroupMode() {
    setViewMode('stage-group')
    setActiveStage(availableStages[0] ?? '')
    setOpenSections(new Set())
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[#3f5068] hover:text-white text-sm mb-3 transition-colors font-medium"
        >
          {t('back_dashboard')}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-oswald)] text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white leading-none">
              {t('title')}
            </h1>
            <p className="text-[#3f5068] text-sm mt-1.5 font-medium">{t('subtitle')}</p>

            {/* Info chips */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {/* Auto-save chip */}
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)', color: '#4a8a5a' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                {t('auto_save_short')}
              </span>

              {/* How scored chip */}
              <button
                onClick={() => setShowScoringHelp(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all duration-200"
                style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)', color: '#9a7030' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(240,180,41,0.15)', borderColor: 'rgba(240,180,41,0.4)', color: '#f0b429' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(240,180,41,0.08)', borderColor: 'rgba(240,180,41,0.2)', color: '#9a7030' })}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                {tScoring('how_scored')}
              </button>
            </div>
          </div>

          {/* Reload button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-all duration-200 disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8496af' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.18)', color: 'white' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#8496af' })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'animate-spin' : ''}>
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            {refreshing ? t('reloading') : t('reload')}
          </button>
        </div>
      </div>

      {/* tasks 2.1–2.2 — View mode toggle */}
      <div className="flex gap-1 rounded-xl p-1 mb-5 w-fit" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={() => setViewMode('chronological')}
          className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
            viewMode === 'chronological' ? 'bg-[#f0b429] text-[#080c14]' : 'text-[#5a6a82] hover:text-white'
          }`}
        >
          {t('view_chronological')}
        </button>
        <button
          onClick={enterStageGroupMode}
          className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
            viewMode === 'stage-group' ? 'bg-[#f0b429] text-[#080c14]' : 'text-[#5a6a82] hover:text-white'
          }`}
        >
          {t('view_by_stage')}
        </button>
      </div>

      {/* ── CHRONOLOGICAL MODE ──────────────────────────────────────────────── */}
      {viewMode === 'chronological' && (
        <>
          {/* tasks 3.1–3.3 — Filter bar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-5">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#3f5068' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <input
                type="text"
                value={teamSearch}
                onChange={e => setTeamSearch(e.target.value)}
                placeholder={t('filter_team_placeholder')}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white transition-all"
                style={{
                  background: '#0d1520',
                  border: '1px solid rgba(255,255,255,0.07)',
                  outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(240,180,41,0.08)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
            <select
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm font-bold transition-all sm:w-44"
              style={{
                background: '#0d1520',
                border: '1px solid rgba(255,255,255,0.07)',
                color: groupFilter ? 'white' : '#5a6a82',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
            >
              <option value="">{t('filter_group_all')}</option>
              {availableGroups.map(g => (
                <option key={g} value={g}>{translateGroupName(g, locale)}</option>
              ))}
            </select>
          </div>

          {/* Upcoming / Finished tabs */}
          <div className="flex gap-1 rounded-xl p-1 mb-6 w-fit" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              onClick={() => setTab('upcoming')}
              className={`px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-200 flex items-center gap-2 ${
                tab === 'upcoming' ? 'bg-[#f0b429] text-[#080c14]' : 'text-[#5a6a82] hover:text-white'
              }`}
            >
              {t('tab_upcoming')}
              {upcomingMissing > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'upcoming' ? 'bg-[#080c14]/20 text-[#080c14]' : 'bg-red-500 text-white'}`}>
                  {upcomingMissing}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('finished')}
              className={`px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-200 flex items-center gap-2 ${
                tab === 'finished' ? 'bg-[#f0b429] text-[#080c14]' : 'text-[#5a6a82] hover:text-white'
              }`}
            >
              {t('tab_finished')}
              {finishedWithPred > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'finished' ? 'bg-[#080c14]/20 text-[#080c14]' : 'bg-white/10 text-[#5a6a82]'}`}>
                  {finishedWithPred}
                </span>
              )}
            </button>
          </div>

          {isLoading && <p className="text-center text-[#3f5068] py-16">…</p>}

          {/* task 3.4 — upcoming list from filteredMatches; task 3.5 — filter-aware empty state */}
          {!isLoading && tab === 'upcoming' && (
            <div className="space-y-3">
              {upcoming.length === 0 && (
                <div className="text-center py-16">
                  <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52] mb-2">
                    {hasActiveFilters ? t('filter_no_results') : t('no_upcoming_title')}
                  </p>
                  {!hasActiveFilters && <p className="text-sm text-[#3f5068]">{t('no_upcoming_desc')}</p>}
                </div>
              )}
              {upcoming.map(m => (
                <PredictionRow key={m.id} match={m} prediction={predByMatch[m.id]} timezone={me?.timezone} />
              ))}
            </div>
          )}

          {!isLoading && tab === 'finished' && (
            <div className="space-y-3">
              {finished.length === 0 && (
                <div className="text-center py-16">
                  <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52] mb-2">
                    {hasActiveFilters ? t('filter_no_results') : t('no_finished_title')}
                  </p>
                  {!hasActiveFilters && <p className="text-sm text-[#3f5068]">{t('no_finished_desc')}</p>}
                </div>
              )}
              {finished.map(m => (
                <PredictionRow key={m.id} match={m} prediction={predByMatch[m.id]} timezone={me?.timezone} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── BY STAGE/GROUP MODE ─────────────────────────────────────────────── */}
      {viewMode === 'stage-group' && (
        <>
          {isLoading && <p className="text-center text-[#3f5068] py-16">…</p>}

          {!isLoading && availableStages.length === 0 && (
            <div className="text-center py-16">
              <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52]">
                {t('no_upcoming_title')}
              </p>
              <p className="text-sm text-[#3f5068] mt-2">{t('no_upcoming_desc')}</p>
            </div>
          )}

          {!isLoading && availableStages.length > 0 && (
            <>
              {/* tasks 4.1–4.2 — stage selector, horizontally scrollable */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6" style={{ scrollbarWidth: 'none' }}>
                {availableStages.map(stage => (
                  <button
                    key={stage}
                    onClick={() => { setActiveStage(stage); setOpenSections(new Set()) }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 shrink-0 ${
                      activeStage === stage
                        ? 'bg-[#f0b429] text-[#080c14]'
                        : 'text-[#5a6a82] hover:text-white'
                    }`}
                    style={activeStage === stage
                      ? {}
                      : { background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }
                    }
                  >
                    {stageLabels[stage] ?? stage}
                  </button>
                ))}
              </div>

              {/* tasks 5.1–5.7 — group stage accordion */}
              {activeStage === 'group_stage' && (
                <GroupStageView
                  matches={matches}
                  predByMatch={predByMatch}
                  openSections={openSections}
                  onToggle={toggleSection}
                  timezone={me?.timezone}
                />
              )}

              {/* tasks 6.1–6.5 — knockout stage accordion */}
              {activeStage !== 'group_stage' && activeStage !== '' && (
                <KnockoutStageView
                  matches={stageMatches}
                  predByMatch={predByMatch}
                  openSections={openSections}
                  onToggle={toggleSection}
                  timezone={me?.timezone}
                />
              )}
            </>
          )}
        </>
      )}

      <ScoringExplanationModal open={showScoringHelp} onClose={() => setShowScoringHelp(false)} />
    </div>
  )
}
