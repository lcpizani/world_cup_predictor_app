'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { api } from '@/lib/api'
import { getTeamFlagCode, getFlagUrl, translateTeamName, translateGroupName, getTeamAbbr } from '@/lib/flags'
import { formatMatchDateTime } from '@/lib/date'
import { formatMinute } from '@/lib/formatMinute'
import type { Match, Prediction, ScoringRules } from '@/types/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { encodeInviteCode } from '@/lib/invite'
import { useLocale, useTranslations } from 'next-intl'
import ScoringExplanationModal from '@/components/ScoringExplanationModal'

const STAGE_ORDER = ['group_stage', 'round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final']

function getPointsMultiplier(matchStage: string, doubleFromStage: string | null): number {
  if (!doubleFromStage) return 1
  const matchIdx = STAGE_ORDER.indexOf(matchStage)
  const threshIdx = STAGE_ORDER.indexOf(doubleFromStage)
  if (matchIdx === -1 || threshIdx === -1) return 1
  return matchIdx >= threshIdx ? 2 : 1
}

function computeProvisionalPoints(
  predictedHome: number, predictedAway: number,
  actualHome: number, actualAway: number,
  s: ScoringRules,
  matchStage: string,
): number {
  const multiplier = getPointsMultiplier(matchStage, s.double_points_from_stage ?? null)
  const outcome = (h: number, a: number) => h > a ? 1 : h < a ? -1 : 0
  if (predictedHome === actualHome && predictedAway === actualAway) return s.correct_result_pts * multiplier
  let total = 0
  if (outcome(predictedHome, predictedAway) === outcome(actualHome, actualAway)) total += s.correct_winner_pts * multiplier
  if ((predictedHome - predictedAway) === (actualHome - actualAway)) total += s.correct_goal_diff_pts * multiplier
  if (predictedHome === actualHome || predictedAway === actualAway) total += s.correct_goals_one_team_pts * multiplier
  return total
}

function useMinutesUntil(dt: string): number {
  const calc = () => Math.floor((new Date(dt).getTime() - Date.now()) / 60000)
  const [minutes, setMinutes] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setMinutes(calc), 30000)
    return () => clearInterval(id)
  }, [dt])
  return minutes
}

function TeamFlag({ name }: { name: string }) {
  const flagCode = getTeamFlagCode(name)
  if (!flagCode) return null
  return (
    <div className="w-10 h-7 rounded overflow-hidden shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      <Image src={getFlagUrl(flagCode, 40)} alt={name} width={40} height={28} className="w-full h-full object-cover" unoptimized />
    </div>
  )
}

function StatusBadge({ status, kickoff_at, timezone, minute, injuryTime, duration }: { status: string; kickoff_at: string; timezone?: string | null; minute?: number | null; injuryTime?: number | null; duration?: string | null }) {
  const t = useTranslations('tournament')
  const locale = useLocale()
  if (status === 'live' || status === 'halftime') return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      {status === 'halftime' ? t('ht') : minute != null ? formatMinute(minute, injuryTime ?? null) : t('live')}
    </span>
  )
  if (status === 'finished') {
    const isAet = duration === 'EXTRA_TIME' || duration === 'PENALTY_SHOOTOUT'
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider" style={{ color: '#3f5068', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {isAet ? t('aet') : t('ft')}
      </span>
    )
  }
  const label = formatMatchDateTime(kickoff_at, timezone, locale)
  return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider text-[#f0b429]" style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)' }}>
      {label}
    </span>
  )
}

function MatchCard({ match, prediction, timezone, scoring, code, joinedAt }: { match: Match; prediction?: Prediction; timezone?: string | null; scoring?: ScoringRules; code: string; joinedAt?: string }) {
  const t = useTranslations('tournament')
  const locale = useLocale()
  const minutesLeft = useMinutesUntil(match.kickoff_at)
  const isScheduled = match.status === 'scheduled'
  const noPredictionYet = isScheduled && !prediction

  const hasScores = (match.status === 'finished' || match.status === 'live' || match.status === 'halftime') && match.home_score !== null && match.away_score !== null

  const scoreColors = (() => {
    if (!hasScores || !prediction || match.home_score === null || match.away_score === null) {
      return { home: '', away: '', winner: false }
    }
    const ph = prediction.predicted_home, pa = prediction.predicted_away
    const ah = match.home_score, aa = match.away_score
    const outcome = (h: number, a: number) => h > a ? 1 : h < a ? -1 : 0
    const correctWinner = outcome(ph, pa) === outcome(ah, aa)
    const correctDiff = (ph - pa) === (ah - aa)
    if (ph === ah && pa === aa) return { home: 'green', away: 'green', winner: true }
    const homeColor = ph === ah ? 'green' : correctDiff ? 'yellow' : ''
    const awayColor = pa === aa ? 'green' : correctDiff ? 'yellow' : ''
    return { home: homeColor, away: awayColor, winner: correctWinner }
  })()

  const accentColor = (() => {
    if (!hasScores || !prediction) return 'transparent'
    if (scoreColors.home === 'green' && scoreColors.away === 'green') return 'rgba(34,197,94,0.7)'
    if (scoreColors.winner) return 'rgba(240,180,41,0.7)'
    return 'rgba(255,255,255,0.1)'
  })()

  const homeTeam = translateTeamName(match.home_team, locale)
  const awayTeam = translateTeamName(match.away_team, locale)

  return (
    <div
      id={`match-${match.id}`}
      className="rounded-2xl p-3.5 sm:p-5 transition-all duration-200 overflow-hidden relative"
      style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      {hasScores && prediction && (
        <div
          className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
          style={{ background: accentColor }}
        />
      )}

      {/* Stage + group + status */}
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono tracking-widest uppercase truncate" style={{ color: '#3f5068' }}>
            {STAGE_ORDER.includes(match.stage) ? t(`stage_${match.stage}`) : match.stage.replace(/_/g, ' ')}
          </span>
          {match.group && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0" style={{ color: '#5a6a82', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {translateGroupName(match.group, locale)}
            </span>
          )}
        </div>
        <StatusBadge status={match.status} kickoff_at={match.kickoff_at} timezone={timezone} minute={match.minute} injuryTime={match.injury_time} duration={match.duration} />
      </div>

      {/* Teams + scores */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-2.5 min-w-0">
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right text-sm sm:text-base">
            <span className="sm:hidden">{getTeamAbbr(match.home_team)}</span>
            <span className="hidden sm:inline">{homeTeam}</span>
          </span>
          <TeamFlag name={match.home_team} />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasScores ? (
            prediction ? (
              <div className="flex flex-col items-center gap-1 w-20 sm:w-24">
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg"
                  style={scoreColors.winner && scoreColors.home === 'green' && scoreColors.away === 'green'
                    ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }
                    : scoreColors.winner
                      ? { background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.18)' }
                      : { border: '1px solid transparent' }
                  }
                >
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-xl w-5 text-center ${scoreColors.home === 'green' ? 'text-green-400' : scoreColors.home === 'yellow' ? 'text-[#f0b429]' : 'text-white'}`}>
                    {prediction.predicted_home}
                  </span>
                  <span className="text-[#2d3e52] font-bold text-sm">–</span>
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-xl w-5 text-center ${scoreColors.away === 'green' ? 'text-green-400' : scoreColors.away === 'yellow' ? 'text-[#f0b429]' : 'text-white'}`}>
                    {prediction.predicted_away}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {match.home_score_penalties != null && (
                    <span className="font-[family-name:var(--font-oswald)] text-xs" style={{ color: '#2d3e52' }}>({match.home_score_penalties})</span>
                  )}
                  <span className="font-[family-name:var(--font-oswald)] text-sm w-4 text-center" style={{ color: '#3f5068' }}>{match.home_score}</span>
                  <span className="text-xs" style={{ color: '#1e2d40' }}>–</span>
                  <span className="font-[family-name:var(--font-oswald)] text-sm w-4 text-center" style={{ color: '#3f5068' }}>{match.away_score}</span>
                  {match.away_score_penalties != null && (
                    <span className="font-[family-name:var(--font-oswald)] text-xs" style={{ color: '#2d3e52' }}>({match.away_score_penalties})</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-0.5 w-20 sm:w-24 justify-center">
                {match.home_score_penalties != null && (
                  <span className="font-[family-name:var(--font-oswald)] text-sm" style={{ color: '#2d3e52' }}>({match.home_score_penalties})</span>
                )}
                <span className="font-[family-name:var(--font-oswald)] font-bold text-xl sm:text-2xl text-center" style={{ color: '#3f5068' }}>
                  {match.home_score} – {match.away_score}
                </span>
                {match.away_score_penalties != null && (
                  <span className="font-[family-name:var(--font-oswald)] text-sm" style={{ color: '#2d3e52' }}>({match.away_score_penalties})</span>
                )}
              </div>
            )
          ) : prediction ? (
            <span className="font-[family-name:var(--font-oswald)] font-bold text-lg sm:text-xl text-white w-20 sm:w-24 text-center">
              {prediction.predicted_home} – {prediction.predicted_away}
            </span>
          ) : (
            <span className="text-[11px] sm:text-xs w-20 sm:w-24 text-center" style={{ color: '#1e2d40' }}>
              {match.status === 'scheduled' ? t('no_pick') : t('locked')}
            </span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-2 sm:gap-2.5 min-w-0">
          <TeamFlag name={match.away_team} />
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-sm sm:text-base">
            <span className="sm:hidden">{getTeamAbbr(match.away_team)}</span>
            <span className="hidden sm:inline">{awayTeam}</span>
          </span>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          {noPredictionYet && minutesLeft > 0 ? (
            <Link href="/predictions" className="text-xs text-[#f0b429] hover:text-white transition-colors font-semibold">
              {t('add_pick_my_picks')}
            </Link>
          ) : (
            <span />
          )}
          <Link
            href={`/tournaments/${code}/compare?match=${match.id}`}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide transition-colors"
            style={{ color: '#2d3e52' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8496af' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#2d3e52' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {t('compare')}
          </Link>
        </div>
        {(match.status === 'finished' || match.status === 'live' || match.status === 'halftime') && scoring && prediction &&
          match.home_score !== null && match.away_score !== null && (() => {
            const notCounted = joinedAt != null && new Date(match.kickoff_at) < new Date(joinedAt)
            if (notCounted) {
              return (
                <span
                  className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ color: '#3f5068', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {t('not_counted')}
                </span>
              )
            }
            const pts = computeProvisionalPoints(
              prediction.predicted_home, prediction.predicted_away,
              match.home_score, match.away_score, scoring, match.stage,
            )
            const isLive = match.status === 'live' || match.status === 'halftime'
            return pts > 0 ? (
              <div className="ml-auto flex items-baseline gap-1">
                <span
                  className="font-[family-name:var(--font-oswald)] font-bold text-lg"
                  style={{ color: isLive ? '#22c55e' : '#f0b429' }}
                >
                  +{pts}
                </span>
                <span className="text-xs font-medium" style={{ color: '#5a6a82' }}>{t('pts')}</span>
              </div>
            ) : null
          })()
        }
      </div>
    </div>
  )
}

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

// ── TournamentGroupStageView ───────────────────────────────────────────────────

function TournamentGroupStageView({
  matches, predByMatch, openSections, onToggle, timezone, scoring, code, joinedAt,
}: {
  matches: Match[]
  predByMatch: Record<string, Prediction>
  openSections: Set<string>
  onToggle: (key: string) => void
  timezone?: string | null
  scoring?: ScoringRules
  code: string
  joinedAt?: string
}) {
  const tP = useTranslations('predictions')
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
          {tP('stage_not_yet_seeded')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {groups.map(group => {
        const gMatches = groupMatches[group] ?? []
        const isOpen = openSections.has(group)

        const header = (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="font-[family-name:var(--font-oswald)] font-bold text-sm sm:text-base uppercase tracking-wider text-white truncate">
              {translateGroupName(group, locale)}
            </span>
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
              <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} timezone={timezone} scoring={scoring} code={code} joinedAt={joinedAt} />
            ))}
          </AccordionSection>
        )
      })}
    </div>
  )
}

// ── TournamentKnockoutStageView ────────────────────────────────────────────────

function TournamentKnockoutStageView({
  matches, predByMatch, openSections, onToggle, timezone, scoring, code, joinedAt,
}: {
  matches: Match[]
  predByMatch: Record<string, Prediction>
  openSections: Set<string>
  onToggle: (key: string) => void
  timezone?: string | null
  scoring?: ScoringRules
  code: string
  joinedAt?: string
}) {
  const tP = useTranslations('predictions')
  const locale = useLocale()

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [matches]
  )

  if (sortedMatches.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52] mb-1">
          {tP('stage_not_yet_seeded')}
        </p>
        <p className="text-sm text-[#3f5068]">{tP('stage_seeded_later')}</p>
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
            <StatusBadge status={m.status} kickoff_at={m.kickoff_at} timezone={timezone} minute={m.minute} injuryTime={m.injury_time} />
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
            <MatchCard match={m} prediction={predByMatch[m.id]} timezone={timezone} scoring={scoring} code={code} joinedAt={joinedAt} />
          </AccordionSection>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TournamentPage() {
  const t = useTranslations('tournament')
  const tP = useTranslations('predictions')
  const { code } = useParams<{ code: string }>()
  const locale = useLocale()
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showScoringHelp, setShowScoringHelp] = useState(false)
  const qc = useQueryClient()

  // View mode state
  const [viewMode, setViewMode] = useState<'chronological' | 'stage-group'>('chronological')
  const [tab, setTab] = useState<'upcoming' | 'finished'>('upcoming')
  const [teamSearch, setTeamSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [activeStage, setActiveStage] = useState('')
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  const { data: tournament } = useQuery({
    queryKey: ['tournament', code],
    queryFn: () => api.getTournament(code),
  })

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
  })
  useOnboardingGuard(me, meLoading)

  const isCreator = !!me && !!tournament && me.id === tournament.created_by

  function copyInviteLink() {
    if (!tournament) return
    const link = `${window.location.origin}/join/${encodeInviteCode(tournament.invite_code)}`
    const confirm = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    navigator.clipboard.writeText(link).then(confirm).catch(() => {
      // Fallback for browsers that block clipboard API
      const el = document.createElement('textarea')
      el.value = link
      el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
      document.body.appendChild(el)
      el.select()
      try { document.execCommand('copy'); confirm() } finally { document.body.removeChild(el) }
    })
  }

  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.listMatches(),
  })

  const tournamentId = tournament?.id ?? ''

  async function handleRefresh() {
    if (!tournamentId) return
    setRefreshing(true)
    try {
      await api.recompute(tournamentId)
    } catch {
      // recompute is best-effort; still refresh the UI
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['matches'] }),
      qc.invalidateQueries({ queryKey: ['predictions', tournamentId] }),
      qc.invalidateQueries({ queryKey: ['leaderboard', code] }),
      qc.invalidateQueries({ queryKey: ['leaderboard-live', code] }),
      qc.invalidateQueries({ queryKey: ['tournament', code] }),
    ])
    setRefreshing(false)
  }

  const { data: predictions = [] } = useQuery({
    queryKey: ['predictions', tournamentId],
    queryFn: () => api.listPredictions(tournamentId),
    enabled: !!tournamentId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', code],
    queryFn: () => api.getMembers(code),
    enabled: !!code,
  })

  const myMembership = me ? members.find(m => m.user_id === me.id) : undefined
  const myJoinedAt = myMembership?.joined_at

  const predByMatch = Object.fromEntries(predictions.map((p) => [p.match_id, p]))

  const sorted = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [matches]
  )

  // Available stages in fixed priority order
  const availableStages = useMemo(() => {
    const stageSet = new Set(matches.map(m => m.stage))
    return STAGE_ORDER.filter(s => stageSet.has(s))
  }, [matches])

  // If the user switched to stage-group view before matches loaded, set a valid stage once they arrive
  useEffect(() => {
    if (viewMode === 'stage-group' && activeStage === '' && availableStages.length > 0) {
      setActiveStage(availableStages[0])
    }
  }, [availableStages, viewMode, activeStage])

  // Available groups sorted alphabetically
  const availableGroups = useMemo(() => {
    const groupSet = new Set<string>()
    matches.forEach(m => { if (m.group) groupSet.add(m.group) })
    return Array.from(groupSet).sort()
  }, [matches])

  // Filtered matches for chronological mode (team search + group filter)
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

  const upcoming = filteredMatches.filter(m => m.status === 'scheduled' || m.status === 'live' || m.status === 'halftime')
  const leagueCreatedAt = tournament?.created_at
  const finished = filteredMatches.filter(m =>
    m.status === 'finished' &&
    (leagueCreatedAt == null || new Date(m.kickoff_at) >= new Date(leagueCreatedAt))
  ).reverse()

  const upcomingMissing = upcoming.filter(m => !predByMatch[m.id]).length
  const finishedWithPred = finished.filter(m => !!predByMatch[m.id]).length

  const hasActiveFilters = teamSearch !== '' || groupFilter !== ''

  // Stage label lookup
  const stageLabels: Record<string, string> = {
    group_stage: tP('stage_group_stage'),
    round_of_32: tP('stage_round_of_32'),
    round_of_16: tP('stage_round_of_16'),
    quarter_finals: tP('stage_quarter_finals'),
    semi_finals: tP('stage_semi_finals'),
    third_place: tP('stage_third_place'),
    final: tP('stage_final'),
  }

  // Matches for the active knockout stage
  const stageMatches = useMemo(
    () => matches.filter(m => m.stage === activeStage),
    [matches, activeStage]
  )

  const liveMatch = sorted.find((m) => m.status === 'live' || m.status === 'halftime')

  function scrollToLive() {
    if (!liveMatch) return
    document.getElementById(`match-${liveMatch.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function toggleSection(key: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
          href="/leagues"
          className="inline-flex items-center gap-1 text-sm mb-3 transition-colors font-medium"
          style={{ color: '#3f5068' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3f5068' }}
        >
          {t('back_leagues')}
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-oswald)] text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white leading-none break-words">
              {tournament?.name ?? '…'}
            </h1>
            {tournament && (
              <p className="text-xs font-mono tracking-widest mt-1.5" style={{ color: '#2d3e52' }}>
                {tournament.invite_code}
              </p>
            )}
          </div>

          {/* Utility icons — reload + invite + edit (creator) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label={refreshing ? t('reloading') : t('reload')}
              title={refreshing ? t('reloading') : t('reload')}
              className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 disabled:opacity-40"
              style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)', color: '#2dd4bf' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(20,184,166,0.2)', borderColor: 'rgba(20,184,166,0.5)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(20,184,166,0.12)', borderColor: 'rgba(20,184,166,0.3)' })}
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={refreshing ? 'animate-spin' : ''}
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <button
              onClick={copyInviteLink}
              disabled={!tournament}
              aria-label={copied ? t('copied') : t('invite')}
              title={copied ? t('copied') : t('invite')}
              className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 disabled:opacity-40"
              style={{
                background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                border: copied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)',
                color: copied ? '#22c55e' : '#8496af',
              }}
              onMouseEnter={e => !copied && Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.18)', color: 'white' })}
              onMouseLeave={e => !copied && Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#8496af' })}
            >
              {copied ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              )}
            </button>

            {isCreator && (
              <Link
                href={`/tournaments/${code}/settings`}
                aria-label={t('edit')}
                title={t('edit')}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8496af' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.18)', color: 'white' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#8496af' })}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Action buttons — primary leaderboard + secondary nav row */}
        <div className="mt-5 flex flex-col gap-2">
          {/* Leaderboard — single dominant primary action */}
          <Link
            href={`/tournaments/${code}/leaderboard`}
            className="w-full inline-flex items-center justify-center gap-2.5 font-bold uppercase tracking-wide px-4 py-3.5 rounded-xl transition-all duration-200"
            style={{
              fontSize: 14,
              background: 'rgba(240,180,41,0.12)',
              border: '1px solid rgba(240,180,41,0.35)',
              color: '#f0b429',
              boxShadow: '0 0 20px rgba(240,180,41,0.08)',
            }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(240,180,41,0.2)', borderColor: 'rgba(240,180,41,0.55)', color: '#fcd86e', boxShadow: '0 0 28px rgba(240,180,41,0.15)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(240,180,41,0.12)', borderColor: 'rgba(240,180,41,0.35)', color: '#f0b429', boxShadow: '0 0 20px rgba(240,180,41,0.08)' })}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
            {t('leaderboard')}
          </Link>

          {/* Secondary nav — Compare + Stats side by side */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/tournaments/${code}/compare`}
              className="inline-flex items-center justify-center gap-2 font-semibold uppercase tracking-wide px-4 py-2.5 rounded-xl transition-all duration-200"
              style={{ fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#6a7f98' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.16)', color: '#cdd6e8' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)', color: '#6a7f98' })}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {t('compare')}
            </Link>
            <Link
              href={`/tournaments/${code}/prediction-stats`}
              className="inline-flex items-center justify-center gap-2 font-semibold uppercase tracking-wide px-4 py-2.5 rounded-xl transition-all duration-200"
              style={{ fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#6a7f98' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.16)', color: '#cdd6e8' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)', color: '#6a7f98' })}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              {t('stats')}
            </Link>
          </div>
        </div>
      </div>

      {/* Scoring bar */}
      {tournament?.scoring_rules && (
        <div
          className="rounded-2xl px-4 pt-3 pb-4 mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(170,255,0,0.09) 0%, rgba(5,16,24,0.98) 55%)',
            border: '1px solid rgba(170,255,0,0.38)',
            boxShadow: '0 0 28px rgba(170,255,0,0.09), inset 0 1px 0 rgba(170,255,0,0.15)',
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.22em]" style={{ color: '#aaff00' }}>
              {t('scoring_rules_label')}
            </span>
            <button
              onClick={() => setShowScoringHelp(true)}
              className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all duration-200"
              style={{ background: 'rgba(170,255,0,0.14)', border: '1px solid rgba(170,255,0,0.45)', color: '#aaff00' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(170,255,0,0.28)', borderColor: 'rgba(170,255,0,0.7)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(170,255,0,0.14)', borderColor: 'rgba(170,255,0,0.45)' })}
              title={t('how_it_works_link')}
            >
              ?
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {[
              { icon: '🎯', pts: tournament.scoring_rules.correct_result_pts, label: t('score_exact') },
              { icon: '🏆', pts: tournament.scoring_rules.correct_winner_pts, label: t('score_winner') },
              { icon: '⚖️', pts: tournament.scoring_rules.correct_goal_diff_pts, label: t('score_diff') },
              { icon: '⚽', pts: tournament.scoring_rules.correct_goals_one_team_pts, label: t('score_one_team') },
            ].map(({ icon, pts, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 rounded-xl px-2 py-2.5"
                style={{ background: 'rgba(170,255,0,0.08)', border: '1px solid rgba(170,255,0,0.22)' }}
                title={label}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-base tabular-nums leading-none" style={{ color: '#aaff00' }}>+{pts}</span>
              </div>
            ))}
          </div>

          {tournament.scoring_rules.double_points_from_stage && (
            <div
              className="mt-3 pt-3 flex items-center gap-2.5"
              style={{ borderTop: '1px solid rgba(170,255,0,0.15)' }}
            >
              <span
                className="inline-flex items-center justify-center px-2 py-1 rounded-lg font-[family-name:var(--font-oswald)] font-bold text-sm leading-none shrink-0"
                style={{ background: 'rgba(170,255,0,0.14)', border: '1px solid rgba(170,255,0,0.45)', color: '#aaff00', letterSpacing: '0.05em' }}
              >
                2×
              </span>
              <span className="text-xs font-semibold" style={{ color: '#8496af' }}>
                {t('double_active', { stage: t(`double_stage_${tournament.scoring_rules.double_points_from_stage}`) })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* View mode toggle */}
      <div className="flex gap-1 rounded-xl p-1 mb-5 w-fit" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={() => setViewMode('chronological')}
          className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
            viewMode === 'chronological' ? 'bg-[#f0b429] text-[#080c14]' : 'text-[#5a6a82] hover:text-white'
          }`}
        >
          {tP('view_chronological')}
        </button>
        <button
          onClick={enterStageGroupMode}
          className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
            viewMode === 'stage-group' ? 'bg-[#f0b429] text-[#080c14]' : 'text-[#5a6a82] hover:text-white'
          }`}
        >
          {tP('view_by_stage')}
        </button>
      </div>

      {/* ── CHRONOLOGICAL MODE ──────────────────────────────────────────────── */}
      {viewMode === 'chronological' && (
        <>
          {/* Live game banner — only in chronological mode */}
          {liveMatch && (
            <button
              onClick={scrollToLive}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl mb-4 transition-all duration-200"
              style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(34,197,94,0.13)', borderColor: 'rgba(34,197,94,0.4)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(34,197,94,0.07)', borderColor: 'rgba(34,197,94,0.25)' })}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                <span className="font-[family-name:var(--font-oswald)] font-bold text-sm uppercase tracking-wide truncate">
                  {t('live_now')} · {liveMatch.home_team} {liveMatch.home_score ?? '?'}–{liveMatch.away_score ?? '?'} {liveMatch.away_team}
                  {liveMatch.status === 'halftime'
                    ? <span className="ml-2 text-xs font-normal opacity-70">{t('ht')}</span>
                    : liveMatch.minute != null && <span className="ml-2 text-xs font-normal opacity-70">{formatMinute(liveMatch.minute, liveMatch.injury_time)}</span>}
                </span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </button>
          )}

          {/* Filter bar */}
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
                placeholder={tP('filter_team_placeholder')}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white transition-all"
                style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)', outline: 'none' }}
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
              <option value="">{tP('filter_group_all')}</option>
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
              {tP('tab_upcoming')}
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
              {tP('tab_finished')}
              {finishedWithPred > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'finished' ? 'bg-[#080c14]/20 text-[#080c14]' : 'bg-white/10 text-[#5a6a82]'}`}>
                  {finishedWithPred}
                </span>
              )}
            </button>
          </div>

          {matchesLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-28 rounded-2xl" style={{ background: '#0d1520' }} />
              ))}
            </div>
          )}

          {!matchesLoading && tab === 'upcoming' && (
            <div className="space-y-3">
              {upcoming.length === 0 && (
                <div className="text-center py-16">
                  <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52] mb-2">
                    {hasActiveFilters ? tP('filter_no_results') : tP('no_upcoming_title')}
                  </p>
                  {!hasActiveFilters && <p className="text-sm text-[#3f5068]">{tP('no_upcoming_desc')}</p>}
                </div>
              )}
              {upcoming.map(m => (
                <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} timezone={me?.timezone} scoring={tournament?.scoring_rules} code={code} joinedAt={myJoinedAt} />
              ))}
            </div>
          )}

          {!matchesLoading && tab === 'finished' && (
            <div className="space-y-3">
              {finished.length === 0 && (
                <div className="text-center py-16">
                  <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52] mb-2">
                    {hasActiveFilters ? tP('filter_no_results') : tP('no_finished_title')}
                  </p>
                  {!hasActiveFilters && <p className="text-sm text-[#3f5068]">{tP('no_finished_desc')}</p>}
                </div>
              )}
              {finished.map(m => (
                <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} timezone={me?.timezone} scoring={tournament?.scoring_rules} code={code} joinedAt={myJoinedAt} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── BY STAGE/GROUP MODE ─────────────────────────────────────────────── */}
      {viewMode === 'stage-group' && (
        <>
          {matchesLoading && <p className="text-center text-[#3f5068] py-16">…</p>}

          {!matchesLoading && availableStages.length === 0 && (
            <div className="text-center py-16">
              <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52]">
                {tP('no_upcoming_title')}
              </p>
              <p className="text-sm text-[#3f5068] mt-2">{tP('no_upcoming_desc')}</p>
            </div>
          )}

          {!matchesLoading && availableStages.length > 0 && (
            <>
              {/* Stage selector pills */}
              <div className="flex flex-wrap gap-2 mb-6">
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

              {/* Group stage accordion */}
              {activeStage === 'group_stage' && (
                <TournamentGroupStageView
                  matches={matches}
                  predByMatch={predByMatch}
                  openSections={openSections}
                  onToggle={toggleSection}
                  timezone={me?.timezone}
                  scoring={tournament?.scoring_rules}
                  code={code}
                  joinedAt={myJoinedAt}
                />
              )}

              {/* Knockout stage accordion */}
              {activeStage !== 'group_stage' && activeStage !== '' && (
                <TournamentKnockoutStageView
                  matches={stageMatches}
                  predByMatch={predByMatch}
                  openSections={openSections}
                  onToggle={toggleSection}
                  timezone={me?.timezone}
                  scoring={tournament?.scoring_rules}
                  code={code}
                  joinedAt={myJoinedAt}
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
