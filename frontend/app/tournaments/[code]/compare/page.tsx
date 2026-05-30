'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { api } from '@/lib/api'
import { getTeamFlagCode, getFlagUrl, translateTeamName } from '@/lib/flags'
import { formatMatchDateTime } from '@/lib/date'
import type { Match, TournamentComparePrediction, TournamentCompareMatch, ScoringRules } from '@/types/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { useLocale, useTranslations } from 'next-intl'

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

function TeamFlag({ name }: { name: string }) {
  const flagCode = getTeamFlagCode(name)
  if (!flagCode) return null
  return (
    <div className="w-7 h-5 rounded overflow-hidden shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      <Image src={getFlagUrl(flagCode, 20)} alt={name} width={20} height={14} className="w-full h-full object-cover" unoptimized />
    </div>
  )
}

function StatusBadge({ status, kickoff_at, timezone, minute }: { status: string; kickoff_at: string; timezone?: string | null; minute?: number | null }) {
  const t = useTranslations('compare')
  if (status === 'live') return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      {minute != null ? `${minute}'` : t('live')}
    </span>
  )
  if (status === 'finished') return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ color: '#3f5068', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {t('ft')}
    </span>
  )
  const label = formatMatchDateTime(kickoff_at, timezone)
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider text-[#f0b429]" style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)' }}>
      {label}
    </span>
  )
}

type ScoreColor = 'green' | 'yellow' | ''

function getScoreColors(match: Match, pred: TournamentComparePrediction): { home: ScoreColor; away: ScoreColor } {
  if ((match.status !== 'finished' && match.status !== 'live') || pred.predicted_home === null || pred.predicted_away === null || match.home_score === null || match.away_score === null) {
    return { home: '', away: '' }
  }
  const ph = pred.predicted_home, pa = pred.predicted_away
  const ah = match.home_score, aa = match.away_score
  if (ph === ah && pa === aa) return { home: 'green', away: 'green' }
  const correctDiff = ph - pa === ah - aa
  return {
    home: ph === ah ? 'green' : correctDiff ? 'yellow' : '',
    away: pa === aa ? 'green' : correctDiff ? 'yellow' : '',
  }
}

function ParticipantRow({ match, pred, isMe, scoring }: { match: Match; pred: TournamentComparePrediction; isMe: boolean; scoring?: ScoringRules }) {
  const t = useTranslations('compare')
  const hidden = pred.predicted_home === null && pred.predicted_away === null
  const colors = hidden ? { home: '' as ScoreColor, away: '' as ScoreColor } : getScoreColors(match, pred)
  const isExact = colors.home === 'green' && colors.away === 'green'
  const isWinner = !isExact && (match.status === 'finished' || match.status === 'live') &&
    pred.predicted_home !== null && pred.predicted_away !== null &&
    match.home_score !== null && match.away_score !== null &&
    (pred.predicted_home - pred.predicted_away > 0) === (match.home_score - match.away_score > 0) &&
    (pred.predicted_home - pred.predicted_away < 0) === (match.home_score - match.away_score < 0)

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-xl"
      style={isMe
        ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }
        : { border: '1px solid transparent' }
      }
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className="font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide truncate"
          style={{ color: isMe ? 'white' : '#5a6a82' }}
        >
          {pred.username}
        </span>
        {isMe && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 font-bold" style={{ color: '#3f5068', border: '1px solid rgba(255,255,255,0.08)' }}>
            {t('you')}
          </span>
        )}
      </div>

      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-lg shrink-0"
        style={isExact
          ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }
          : isWinner
            ? { background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.18)' }
            : { border: '1px solid transparent' }
        }
      >
        {hidden ? (
          (match.status === 'live' || match.status === 'finished')
            ? <span className="text-xs w-10 text-center" style={{ color: '#1e2d40' }}>{t('no_pick')}</span>
            : <span className="font-[family-name:var(--font-oswald)] text-sm w-10 text-center" style={{ color: '#1e2d40' }}>?–?</span>
        ) : pred.predicted_home === null ? (
          <span className="text-xs w-10 text-center" style={{ color: '#1e2d40' }}>{t('no_pick')}</span>
        ) : (
          <>
            <span className={`font-[family-name:var(--font-oswald)] font-bold text-sm w-4 text-center ${colors.home === 'green' ? 'text-green-400' : colors.home === 'yellow' ? 'text-[#f0b429]' : 'text-white'}`}>
              {pred.predicted_home}
            </span>
            <span className="text-xs" style={{ color: '#2d3e52' }}>–</span>
            <span className={`font-[family-name:var(--font-oswald)] font-bold text-sm w-4 text-center ${colors.away === 'green' ? 'text-green-400' : colors.away === 'yellow' ? 'text-[#f0b429]' : 'text-white'}`}>
              {pred.predicted_away}
            </span>
          </>
        )}
      </div>

      {pred.points_awarded !== null ? (
        <div className="shrink-0 w-14 text-right flex items-baseline justify-end gap-0.5">
          <span className="font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-sm">+{pred.points_awarded}</span>
          <span className="text-[10px] font-medium" style={{ color: '#3f5068' }}>pts</span>
        </div>
      ) : match.status === 'live' && scoring && pred.predicted_home !== null && pred.predicted_away !== null && match.home_score !== null && match.away_score !== null ? (() => {
        const pts = computeProvisionalPoints(pred.predicted_home, pred.predicted_away, match.home_score, match.away_score, scoring)
        return pts > 0 ? (
          <div className="shrink-0 w-14 text-right flex items-baseline justify-end gap-0.5">
            <span className="font-[family-name:var(--font-oswald)] font-bold text-sm" style={{ color: '#22c55e' }}>+{pts}</span>
            <span className="text-[10px] font-medium" style={{ color: '#3f5068' }}>pts</span>
          </div>
        ) : <span className="w-14 shrink-0" />
      })() : (
        <span className="w-14 shrink-0" />
      )}
    </div>
  )
}

function CompareMatchCard({ entry, myUserId, timezone, scoring }: { entry: TournamentCompareMatch; myUserId: string; timezone?: string | null; scoring?: ScoringRules }) {
  const locale = useLocale()
  const { match, predictions } = entry
  const homeTeam = translateTeamName(match.home_team, locale)
  const awayTeam = translateTeamName(match.away_team, locale)

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200"
      style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      {/* Stage + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#3f5068' }}>
            {match.stage.replace(/_/g, ' ')}
          </span>
          {match.group && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ color: '#5a6a82', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {match.group}
            </span>
          )}
        </div>
        <StatusBadge status={match.status} kickoff_at={match.kickoff_at} timezone={timezone} minute={match.minute} />
      </div>

      {/* Teams + actual score */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-sm">
            {homeTeam}
          </span>
          <TeamFlag name={match.home_team} />
        </div>

        <div className="shrink-0 w-20 text-center">
          {match.status === 'finished' ? (
            <span className="font-[family-name:var(--font-oswald)] font-bold text-xl" style={{ color: '#5a6a82' }}>
              {match.home_score}–{match.away_score}
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: '#1e2d40' }}>vs</span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamFlag name={match.away_team} />
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-sm">
            {awayTeam}
          </span>
        </div>
      </div>

      {/* Participant rows */}
      <div className="space-y-0.5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {predictions.map((pred) => (
          <ParticipantRow key={pred.user_id} match={match} pred={pred} isMe={pred.user_id === myUserId} scoring={scoring} />
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const t = useTranslations('compare')
  const { code } = useParams<{ code: string }>()

  const { data: tournament } = useQuery({
    queryKey: ['tournament', code],
    queryFn: () => api.getTournament(code),
  })

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
  })
  useOnboardingGuard(me, meLoading)

  const { data: compareData = [], isLoading } = useQuery({
    queryKey: ['compare', code],
    queryFn: () => api.listCompare(code),
    refetchInterval: 30_000,
  })

  const myUserId = me?.id ?? ''
  const hasAnyPredictions = compareData.some((e) =>
    e.predictions.some((p) => p.predicted_home !== null || p.predicted_away !== null)
  )

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/tournaments/${code}`}
          className="inline-flex items-center gap-1 text-sm mb-3 transition-colors font-medium"
          style={{ color: '#3f5068' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3f5068' }}
        >
          {t('back_matches')}
        </Link>
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white leading-none">
          {tournament?.name ?? '…'}
        </h1>
        <div className="flex items-center gap-2.5 mt-2">
          <span className="block w-0.5 h-3.5 rounded-full" style={{ background: 'rgba(240,180,41,0.7)' }} />
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em]" style={{ color: '#5a6a82' }}>{t('compare_predictions')}</p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse h-32 rounded-2xl" style={{ background: '#0d1520' }} />
          ))}
        </div>
      )}

      {!isLoading && compareData.length > 0 && !hasAnyPredictions && (
        <div className="text-center py-20 rounded-2xl" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide mb-2" style={{ color: '#2d3e52' }}>
            {t('no_predictions_title')}
          </p>
          <p className="text-sm" style={{ color: '#3f5068' }}>
            {t('no_predictions_desc')}{' '}
            <Link href="/predictions" className="text-[#f0b429] hover:text-white transition-colors font-medium">
              {t('add_yours')}
            </Link>
          </p>
        </div>
      )}

      {!isLoading && compareData.length === 0 && (
        <div className="text-center py-20 rounded-2xl" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide mb-2" style={{ color: '#2d3e52' }}>
            {t('no_matches_title')}
          </p>
          <p className="text-sm" style={{ color: '#3f5068' }}>{t('no_matches_desc')}</p>
        </div>
      )}

      {compareData.length > 0 && hasAnyPredictions && (
        <div className="space-y-3">
          {compareData.map((entry) => (
            <CompareMatchCard key={entry.match.id} entry={entry} myUserId={myUserId} timezone={me?.timezone} scoring={tournament?.scoring_rules} />
          ))}
        </div>
      )}

      {compareData.length > 0 && (
        <p className="text-center text-[10px] mt-8 font-medium" style={{ color: '#1e2d40' }}>
          {t('refresh')}
        </p>
      )}
    </div>
  )
}
