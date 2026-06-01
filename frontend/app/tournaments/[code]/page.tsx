'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { api } from '@/lib/api'
import { getTeamFlagCode, getFlagUrl, translateTeamName, translateGroupName, getTeamAbbr } from '@/lib/flags'
import { formatMatchDateTime } from '@/lib/date'
import type { Match, Prediction, ScoringRules } from '@/types/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { encodeInviteCode } from '@/lib/invite'
import { useLocale, useTranslations } from 'next-intl'

const STAGE_ORDER = ['group_stage', 'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final']

function computeProvisionalPoints(
  predictedHome: number, predictedAway: number,
  actualHome: number, actualAway: number,
  s: ScoringRules,
): number {
  const outcome = (h: number, a: number) => h > a ? 1 : h < a ? -1 : 0
  if (predictedHome === actualHome && predictedAway === actualAway) return s.correct_result_pts
  let total = 0
  if (outcome(predictedHome, predictedAway) === outcome(actualHome, actualAway)) total += s.correct_winner_pts
  if ((predictedHome - predictedAway) === (actualHome - actualAway)) total += s.correct_goal_diff_pts
  if (predictedHome === actualHome || predictedAway === actualAway) total += s.correct_goals_one_team_pts
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

function StatusBadge({ status, kickoff_at, timezone, minute }: { status: string; kickoff_at: string; timezone?: string | null; minute?: number | null }) {
  const t = useTranslations('tournament')
  const locale = useLocale()
  if (status === 'live') return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      {minute != null ? `${minute}'` : t('live')}
    </span>
  )
  if (status === 'finished') return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider" style={{ color: '#3f5068', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {t('ft')}
    </span>
  )
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
        <StatusBadge status={match.status} kickoff_at={match.kickoff_at} timezone={timezone} minute={match.minute} />
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
                <div className="flex items-center gap-1">
                  <span className="font-[family-name:var(--font-oswald)] text-sm w-4 text-center" style={{ color: '#3f5068' }}>{match.home_score}</span>
                  <span className="text-xs" style={{ color: '#1e2d40' }}>–</span>
                  <span className="font-[family-name:var(--font-oswald)] text-sm w-4 text-center" style={{ color: '#3f5068' }}>{match.away_score}</span>
                </div>
              </div>
            ) : (
              <span className="font-[family-name:var(--font-oswald)] font-bold text-xl sm:text-2xl w-20 sm:w-24 text-center" style={{ color: '#3f5068' }}>
                {match.home_score} – {match.away_score}
              </span>
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
        {prediction?.points_awarded !== null && prediction?.points_awarded !== undefined && (
          <div className="ml-auto flex items-baseline gap-1">
            <span className="font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-lg">
              +{prediction.points_awarded}
            </span>
            <span className="text-xs font-medium" style={{ color: '#5a6a82' }}>{t('pts')}</span>
          </div>
        )}
        {match.status === 'live' && scoring && prediction &&
          match.home_score !== null && match.away_score !== null && (() => {
            const pts = computeProvisionalPoints(
              prediction.predicted_home, prediction.predicted_away,
              match.home_score, match.away_score, scoring,
            )
            return pts > 0 ? (
              <div className="ml-auto flex items-baseline gap-1">
                <span className="font-[family-name:var(--font-oswald)] font-bold text-lg" style={{ color: '#22c55e' }}>
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
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
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

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTournament(code),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tournaments'] })
      qc.removeQueries({ queryKey: ['tournament', code] })
      router.push('/dashboard')
    },
    onError: (err: Error) => {
      setConfirmDelete(false)
      alert(err.message || 'Failed to delete competition. Try again.')
    },
  })

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
    setRefreshing(true)
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['matches'] }),
      qc.invalidateQueries({ queryKey: ['predictions', tournamentId] }),
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

        <div className="flex items-end justify-between gap-4">
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
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-all duration-200 disabled:opacity-40"
            style={{
              background: 'rgba(20,184,166,0.12)',
              border: '1px solid rgba(20,184,166,0.3)',
              color: '#2dd4bf',
            }}
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
            {refreshing ? t('reloading') : t('reload')}
          </button>
        </div>

        {/* Action buttons */}
        <div className="mt-4 grid grid-cols-3 sm:flex sm:items-center gap-2 sm:flex-wrap">
          <button
            onClick={copyInviteLink}
            disabled={!tournament}
            className="text-[10px] sm:text-xs font-bold uppercase tracking-wide px-3 sm:px-4 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-40 truncate"
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#c084fc' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(168,85,247,0.18)', borderColor: 'rgba(168,85,247,0.45)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.25)' })}
          >
            {copied ? t('copied') : t('invite')}
          </button>
          <Link
            href={`/tournaments/${code}/compare`}
            className="text-[10px] sm:text-xs font-bold uppercase tracking-wide px-3 sm:px-4 py-2.5 rounded-xl transition-all duration-200 text-center"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(59,130,246,0.18)', borderColor: 'rgba(59,130,246,0.45)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.25)' })}
          >
            {t('compare')}
          </Link>
          <Link
            href={`/tournaments/${code}/leaderboard`}
            className="text-[10px] sm:text-xs font-bold uppercase tracking-wide px-3 sm:px-4 py-2.5 rounded-xl transition-all duration-200 text-center"
            style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.25)', color: '#f0b429' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(240,180,41,0.18)', borderColor: 'rgba(240,180,41,0.45)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(240,180,41,0.1)', borderColor: 'rgba(240,180,41,0.25)' })}
          >
            {t('leaderboard')}
          </Link>
        </div>
      </div>

      {/* Delete — creator only */}
      {isCreator && (
        <div className="mb-8">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide px-4 py-2.5 rounded-xl transition-all duration-200"
              style={{ color: '#f87171', background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.18)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.07)' }}
            >
              {t('delete_competition')}
            </button>
          ) : (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)' }}>
              <p className="text-sm text-red-300 font-semibold mb-1">{t('delete_confirm_title')}</p>
              <p className="text-xs mb-4" style={{ color: 'rgba(244,63,94,0.6)' }}>
                {t('delete_confirm_desc')}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                  style={{ background: '#ef4444', color: 'white' }}
                >
                  {deleteMutation.isPending ? t('deleting') : t('yes_delete')}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#8496af' }}
                >
                  {t('cancel')}
                </button>
              </div>
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
    </div>
  )
}
