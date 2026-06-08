'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { api } from '@/lib/api'
import { getTeamFlagCode, getFlagUrl, translateTeamName, translateGroupName, getTeamAbbr } from '@/lib/flags'
import { formatMatchDateTime } from '@/lib/date'
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

function StatusBadge({ status, kickoff_at, timezone, minute, duration }: { status: string; kickoff_at: string; timezone?: string | null; minute?: number | null; duration?: string | null }) {
  const t = useTranslations('tournament')
  const locale = useLocale()
  if (status === 'live') return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      {minute != null ? `${minute}'` : t('live')}
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

function MatchCard({ match, prediction, timezone, scoring }: { match: Match; prediction?: Prediction; timezone?: string | null; scoring?: ScoringRules }) {
  const t = useTranslations('tournament')
  const locale = useLocale()
  const minutesLeft = useMinutesUntil(match.kickoff_at)
  const isScheduled = match.status === 'scheduled'
  const noPredictionYet = isScheduled && !prediction

  const hasScores = (match.status === 'finished' || match.status === 'live') && match.home_score !== null && match.away_score !== null

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
        <StatusBadge status={match.status} kickoff_at={match.kickoff_at} timezone={timezone} minute={match.minute} duration={match.duration} />
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
        {noPredictionYet && minutesLeft > 0 ? (
          <Link href="/predictions" className="text-xs text-[#f0b429] hover:text-white transition-colors font-semibold">
            {t('add_pick_my_picks')}
          </Link>
        ) : (
          <span />
        )}
        {(match.status === 'finished' || match.status === 'live') && scoring && prediction &&
          match.home_score !== null && match.away_score !== null && (() => {
            const pts = computeProvisionalPoints(
              prediction.predicted_home, prediction.predicted_away,
              match.home_score, match.away_score, scoring, match.stage,
            )
            const isLive = match.status === 'live'
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TournamentPage() {
  const t = useTranslations('tournament')
  const { code } = useParams<{ code: string }>()
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showScoringHelp, setShowScoringHelp] = useState(false)
  const qc = useQueryClient()

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
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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

  const predByMatch = Object.fromEntries(predictions.map((p) => [p.match_id, p]))

  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  )

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

          {/* Utility icons — reload + edit (creator) */}
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

        {/* Action buttons — primary leaderboard, secondary compare/invite */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {/* Leaderboard — primary, full-width on mobile */}
          <Link
            href={`/tournaments/${code}/leaderboard`}
            className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 text-sm sm:text-xs font-bold uppercase tracking-wide px-4 py-3 sm:py-2.5 rounded-xl transition-all duration-200"
            style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.3)', color: '#f0b429' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(240,180,41,0.18)', borderColor: 'rgba(240,180,41,0.5)', color: '#fcd86e' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(240,180,41,0.1)', borderColor: 'rgba(240,180,41,0.3)', color: '#f0b429' })}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
            {t('leaderboard')}
          </Link>

          {/* Compare — secondary */}
          <Link
            href={`/tournaments/${code}/compare`}
            className="inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-xl transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8496af' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.18)', color: 'white' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#8496af' })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {t('compare')}
          </Link>

          {/* Invite — secondary */}
          <button
            onClick={copyInviteLink}
            disabled={!tournament}
            className="inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8496af' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.18)', color: 'white' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#8496af' })}
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
            {copied ? t('copied') : t('invite')}
          </button>
        </div>
      </div>

      {/* Scoring bar */}
      {tournament?.scoring_rules && (
        <div
          className="rounded-2xl px-4 py-3.5 mb-6"
          style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em]" style={{ color: '#3f5068' }}>
              {t('scoring_rules_label')}
            </span>
            <button
              onClick={() => setShowScoringHelp(true)}
              className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all duration-200"
              style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.25)', color: '#f0b429' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(240,180,41,0.2)', borderColor: 'rgba(240,180,41,0.5)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(240,180,41,0.1)', borderColor: 'rgba(240,180,41,0.25)' })}
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
              <span
                key={label}
                className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                title={label}
              >
                <span className="text-xs leading-none">{icon}</span>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-sm tabular-nums leading-none" style={{ color: '#f0b429' }}>+{pts}</span>
              </span>
            ))}
          </div>

          {/* Double points rule — visible to all members when active */}
          {tournament.scoring_rules.double_points_from_stage && (
            <div
              className="mt-3 pt-3 flex items-center gap-2.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span
                className="inline-flex items-center justify-center px-2 py-1 rounded-lg font-[family-name:var(--font-oswald)] font-bold text-sm leading-none shrink-0"
                style={{ background: 'rgba(240,180,41,0.14)', border: '1px solid rgba(240,180,41,0.4)', color: '#f0b429', letterSpacing: '0.05em' }}
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

      {/* Matches */}
      {matchesLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse h-28 rounded-2xl" style={{ background: '#0d1520' }} />
          ))}
        </div>
      )}

      {!matchesLoading && sorted.length === 0 && (
        <div className="text-center py-20">
          <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide mb-2" style={{ color: '#2d3e52' }}>
            {t('no_matches')}
          </p>
          <p className="text-sm" style={{ color: '#3f5068' }}>{t('no_matches_desc')}</p>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((match) => (
          <MatchCard key={match.id} match={match} prediction={predByMatch[match.id]} timezone={me?.timezone} scoring={tournament?.scoring_rules} />
        ))}
      </div>

      <ScoringExplanationModal open={showScoringHelp} onClose={() => setShowScoringHelp(false)} />
    </div>
  )
}
