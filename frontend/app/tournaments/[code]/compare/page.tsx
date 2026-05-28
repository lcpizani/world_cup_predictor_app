'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { api } from '@/lib/api'
import { getTeamFlagCode, getFlagUrl } from '@/lib/flags'
import type { Match, TournamentComparePrediction, TournamentCompareMatch } from '@/types/api'

// ── Helpers ──────────────────────────────────────────────────────────────────

function TeamFlag({ name }: { name: string }) {
  const flagCode = getTeamFlagCode(name)
  if (!flagCode) return null
  return (
    <div className="w-7 h-5 rounded overflow-hidden border border-white/10 flex-shrink-0">
      <Image
        src={getFlagUrl(flagCode, 20)}
        alt={name}
        width={20}
        height={14}
        className="w-full h-full object-cover"
        unoptimized
      />
    </div>
  )
}

function StatusBadge({ status, kickoff_at }: { status: string; kickoff_at: string }) {
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wider">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Live
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/5 text-[#475569] border border-white/10 uppercase tracking-wider">
        FT
      </span>
    )
  }
  const d = new Date(kickoff_at)
  const label = d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f0b429]/10 text-[#f0b429] border border-[#f0b429]/20 tracking-wider">
      {label}
    </span>
  )
}

// ── Score colour coding ──────────────────────────────────────────────────────

type ScoreColor = 'green' | 'yellow' | ''

function getScoreColors(
  match: Match,
  pred: TournamentComparePrediction,
): { home: ScoreColor; away: ScoreColor } {
  if (
    match.status !== 'finished' ||
    pred.predicted_home === null ||
    pred.predicted_away === null ||
    match.home_score === null ||
    match.away_score === null
  ) {
    return { home: '', away: '' }
  }
  const ph = pred.predicted_home
  const pa = pred.predicted_away
  const ah = match.home_score
  const aa = match.away_score
  if (ph === ah && pa === aa) return { home: 'green', away: 'green' }
  const outcome = (h: number, a: number) => (h > a ? 1 : h < a ? -1 : 0)
  const correctDiff = ph - pa === ah - aa
  const homeColor: ScoreColor = ph === ah ? 'green' : correctDiff ? 'yellow' : ''
  const awayColor: ScoreColor = pa === aa ? 'green' : correctDiff ? 'yellow' : ''
  return { home: homeColor, away: awayColor }
}

// ── Participant row ──────────────────────────────────────────────────────────

function ParticipantRow({
  match,
  pred,
  isMe,
}: {
  match: Match
  pred: TournamentComparePrediction
  isMe: boolean
}) {
  const hidden = pred.predicted_home === null && pred.predicted_away === null
  const colors = hidden ? { home: '' as ScoreColor, away: '' as ScoreColor } : getScoreColors(match, pred)
  const isExact = colors.home === 'green' && colors.away === 'green'
  const isWinner = !isExact && match.status === 'finished' &&
    pred.predicted_home !== null && pred.predicted_away !== null &&
    match.home_score !== null && match.away_score !== null &&
    (pred.predicted_home - pred.predicted_away > 0) === (match.home_score - match.away_score > 0) &&
    (pred.predicted_home - pred.predicted_away < 0) === (match.home_score - match.away_score < 0)

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
      isMe ? 'bg-white/5 border border-white/10' : 'border border-transparent'
    }`}>
      {/* Username */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={`font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide truncate ${
          isMe ? 'text-white' : 'text-[#94a3b8]'
        }`}>
          {pred.username}
        </span>
        {isMe && (
          <span className="text-[10px] text-[#475569] border border-white/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
            you
          </span>
        )}
      </div>

      {/* Predicted score */}
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg flex-shrink-0 ${
        isExact ? 'bg-green-500/10 border border-green-500/20' :
        isWinner ? 'bg-[#f0b429]/10 border border-[#f0b429]/20' :
        'border border-transparent'
      }`}>
        {hidden ? (
          <span className="font-[family-name:var(--font-oswald)] text-sm text-[#334155] w-10 text-center">?–?</span>
        ) : pred.predicted_home === null ? (
          <span className="text-xs italic text-[#334155] w-10 text-center">no pick</span>
        ) : (
          <>
            <span className={`font-[family-name:var(--font-oswald)] font-bold text-sm w-4 text-center ${
              colors.home === 'green' ? 'text-green-400' :
              colors.home === 'yellow' ? 'text-yellow-400' : 'text-white'
            }`}>{pred.predicted_home}</span>
            <span className="text-[#475569] text-xs">–</span>
            <span className={`font-[family-name:var(--font-oswald)] font-bold text-sm w-4 text-center ${
              colors.away === 'green' ? 'text-green-400' :
              colors.away === 'yellow' ? 'text-yellow-400' : 'text-white'
            }`}>{pred.predicted_away}</span>
          </>
        )}
      </div>

      {/* Points badge */}
      {pred.points_awarded !== null ? (
        <span className="font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-sm flex-shrink-0 w-12 text-right">
          +{pred.points_awarded} <span className="text-[10px] text-[#64748b] font-sans font-normal">pts</span>
        </span>
      ) : (
        <span className="w-12 flex-shrink-0" />
      )}
    </div>
  )
}

// ── CompareMatchCard ─────────────────────────────────────────────────────────

function CompareMatchCard({
  entry,
  myUserId,
}: {
  entry: TournamentCompareMatch
  myUserId: string
}) {
  const { match, predictions } = entry

  return (
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">
      {/* Match header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#475569] font-mono tracking-widest uppercase">
            {match.stage.replace(/_/g, ' ')}
          </span>
          {match.group && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#94a3b8] uppercase tracking-wider">
              {match.group}
            </span>
          )}
        </div>
        <StatusBadge status={match.status} kickoff_at={match.kickoff_at} />
      </div>

      {/* Teams + actual score */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-sm">
            {match.home_team}
          </span>
          <TeamFlag name={match.home_team} />
        </div>

        <div className="flex-shrink-0 w-20 text-center">
          {match.status === 'finished' ? (
            <span className="font-[family-name:var(--font-oswald)] font-bold text-xl text-[#94a3b8]">
              {match.home_score}–{match.away_score}
            </span>
          ) : (
            <span className="text-[#334155] text-xs uppercase tracking-widest">vs</span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamFlag name={match.away_team} />
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-sm">
            {match.away_team}
          </span>
        </div>
      </div>

      {/* Participant rows */}
      <div className="space-y-1 border-t border-white/5 pt-3">
        {predictions.map((pred) => (
          <ParticipantRow
            key={pred.user_id}
            match={match}
            pred={pred}
            isMe={pred.user_id === myUserId}
          />
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { code } = useParams<{ code: string }>()

  const { data: tournament } = useQuery({
    queryKey: ['tournament', code],
    queryFn: () => api.getTournament(code),
  })

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
  })

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
          className="inline-flex items-center gap-1 text-[#64748b] hover:text-white text-sm mb-3 transition-colors"
        >
          ← Matches
        </Link>
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
          {tournament?.name ?? '…'}
        </h1>
        <p className="text-[#64748b] text-sm mt-1 uppercase tracking-widest font-bold">Compare Predictions</p>
      </div>

      {isLoading && (
        <p className="text-center text-[#64748b] py-16">Loading…</p>
      )}

      {!isLoading && compareData.length > 0 && !hasAnyPredictions && (
        <div className="text-center py-20 text-[#64748b]">
          <div className="text-4xl mb-4">🔮</div>
          <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#475569] mb-2">
            No predictions yet
          </p>
          <p className="text-sm">
            Members haven&apos;t submitted picks yet.{' '}
            <Link href="/predictions" className="text-[#f0b429] hover:text-white transition-colors">
              Add yours →
            </Link>
          </p>
        </div>
      )}

      {!isLoading && compareData.length === 0 && (
        <div className="text-center py-20 text-[#64748b]">
          <div className="text-4xl mb-4">📅</div>
          <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#475569] mb-2">
            No matches yet
          </p>
          <p className="text-sm">An admin needs to sync fixtures first.</p>
        </div>
      )}

      {compareData.length > 0 && hasAnyPredictions && (
        <div className="space-y-4">
          {compareData.map((entry) => (
            <CompareMatchCard
              key={entry.match.id}
              entry={entry}
              myUserId={myUserId}
            />
          ))}
        </div>
      )}

      {compareData.length > 0 && (
        <p className="text-center text-xs text-[#334155] mt-8">Refreshes every 30 seconds</p>
      )}
    </div>
  )
}
