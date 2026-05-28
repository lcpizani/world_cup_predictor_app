'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getTeamFlagCode, getFlagUrl } from '@/lib/flags'
import type { Match, Prediction } from '@/types/api'

function TeamFlag({ name }: { name: string }) {
  const code = getTeamFlagCode(name)
  if (!code) return null
  return (
    <div className="w-9 h-6 rounded overflow-hidden border border-white/10 flex-shrink-0">
      <Image src={getFlagUrl(code, 40)} alt={name} width={36} height={24} className="w-full h-full object-cover" unoptimized />
    </div>
  )
}

function scoreColor(pred: number | undefined, actual: number | null): string {
  if (pred === undefined || actual === null) return 'text-white'
  if (pred === actual) return 'text-green-400'
  return 'text-[#475569]'
}

function outcomeOf(h: number, a: number): number {
  return h > a ? 1 : h < a ? -1 : 0
}

function predResultBg(pred: Prediction, match: Match): string {
  if (match.status !== 'finished' || match.home_score === null || match.away_score === null) return ''
  const ph = pred.predicted_home, pa = pred.predicted_away
  const ah = match.home_score, aa = match.away_score
  if (ph === ah && pa === aa) return 'bg-green-500/10 border-green-500/20'
  if (outcomeOf(ph, pa) === outcomeOf(ah, aa)) return 'bg-[#f0b429]/10 border-[#f0b429]/20'
  return 'bg-white/5 border-white/10'
}

function StatusPill({ status }: { status: string }) {
  if (status === 'live') return (
    <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" /> Live
    </span>
  )
  if (status === 'finished') return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/5 text-[#475569] border border-white/10 uppercase tracking-wide">FT</span>
  )
  return null
}

// Inline editable row for upcoming predictions
function PredictionRow({ match, prediction }: { match: Match; prediction?: Prediction }) {
  const qc = useQueryClient()
  const [home, setHome] = useState(prediction?.predicted_home?.toString() ?? '')
  const [away, setAway] = useState(prediction?.predicted_away?.toString() ?? '')
  const [err, setErr] = useState('')

  const isLocked = !!prediction?.is_locked || match.status !== 'scheduled'

  const save = useMutation({
    mutationFn: () => {
      const h = parseInt(home), a = parseInt(away)
      if (isNaN(h) || isNaN(a) || h < 0 || a < 0) throw new Error('Enter valid scores')
      if (prediction) return api.updatePrediction(prediction.id, { predicted_home: h, predicted_away: a })
      return api.submitPrediction({ match_id: match.id, predicted_home: h, predicted_away: a })
    },
    onSuccess: () => { setErr(''); qc.invalidateQueries({ queryKey: ['predictions-global'] }) },
    onError: (e: Error) => setErr(e.message),
  })

  const kickoff = new Date(match.kickoff_at).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

  // ── Finished match row ───────────────────────────────────────────────────────
  if (match.status === 'finished') {
    const hasPred = !!prediction
    const ah = match.home_score, aa = match.away_score
    const ph = prediction?.predicted_home, pa = prediction?.predicted_away
    const exact = hasPred && ph === ah && pa === aa
    const correctWinner = hasPred && !exact && ah !== null && aa !== null &&
      outcomeOf(ph!, pa!) === outcomeOf(ah!, aa!)

    return (
      <div className={`bg-[#0f1620] border rounded-2xl p-4 transition-colors ${hasPred ? predResultBg(prediction!, match) : 'border-white/10'}`}>
        <div className="flex items-center gap-3">
          {/* Teams */}
          <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
            <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-sm">
              {match.home_team}
            </span>
            <TeamFlag name={match.home_team} />
          </div>

          {/* Scores */}
          <div className="flex flex-col items-center gap-0.5 w-28 flex-shrink-0">
            {hasPred ? (
              <>
                {/* User prediction */}
                <div className="flex items-center gap-1.5">
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-lg w-5 text-center ${scoreColor(ph, ah)}`}>{ph}</span>
                  <span className="text-[#334155] text-sm">–</span>
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-lg w-5 text-center ${scoreColor(pa, aa)}`}>{pa}</span>
                </div>
                {/* Actual score */}
                <div className="flex items-center gap-1">
                  <span className="font-[family-name:var(--font-oswald)] text-xs text-[#475569] w-4 text-center">{ah}</span>
                  <span className="text-[#334155] text-xs">–</span>
                  <span className="font-[family-name:var(--font-oswald)] text-xs text-[#475569] w-4 text-center">{aa}</span>
                </div>
              </>
            ) : (
              <>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-lg text-[#334155]">{ah} – {aa}</span>
                <span className="text-xs text-[#334155] italic">no pick</span>
              </>
            )}
          </div>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <TeamFlag name={match.away_team} />
            <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-sm">
              {match.away_team}
            </span>
          </div>

          {/* Result badge */}
          <div className="flex-shrink-0 w-14 text-right">
            {exact && <span className="text-xs font-bold text-green-400">Exact</span>}
            {correctWinner && <span className="text-xs font-bold text-[#f0b429]">Winner</span>}
            {hasPred && !exact && !correctWinner && <span className="text-xs text-[#334155]">Miss</span>}
          </div>
        </div>

        {/* Stage + group + date */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
          <span className="text-xs text-[#334155] font-mono uppercase tracking-wider">{match.stage.replace(/_/g, ' ')}</span>
          {match.group && <span className="text-xs text-[#334155]">· {match.group}</span>}
          <span className="text-xs text-[#334155] ml-auto">{kickoff}</span>
          <StatusPill status={match.status} />
        </div>
      </div>
    )
  }

  // ── Upcoming / live row ──────────────────────────────────────────────────────
  return (
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-colors">
      <div className="flex items-center gap-3">
        {/* Home */}
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-sm">
            {match.home_team}
          </span>
          <TeamFlag name={match.home_team} />
        </div>

        {/* Input or locked prediction */}
        <div className="flex items-center gap-1.5 flex-shrink-0 w-28 justify-center">
          {isLocked ? (
            prediction ? (
              <span className="font-[family-name:var(--font-oswald)] font-bold text-lg text-white">
                {prediction.predicted_home} – {prediction.predicted_away}
              </span>
            ) : (
              <span className="text-xs text-[#334155] italic">locked</span>
            )
          ) : (
            <>
              <input
                type="number" min={0} value={home}
                onChange={(e) => setHome(e.target.value)}
                placeholder="0"
                className="w-11 bg-[#080c14] border border-white/10 rounded-lg px-1 py-1.5 text-white text-center focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition font-[family-name:var(--font-oswald)] font-bold text-base"
              />
              <span className="text-[#475569] font-bold text-sm">–</span>
              <input
                type="number" min={0} value={away}
                onChange={(e) => setAway(e.target.value)}
                placeholder="0"
                className="w-11 bg-[#080c14] border border-white/10 rounded-lg px-1 py-1.5 text-white text-center focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition font-[family-name:var(--font-oswald)] font-bold text-base"
              />
            </>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamFlag name={match.away_team} />
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-sm">
            {match.away_team}
          </span>
        </div>

        {/* Save button */}
        {!isLocked && (
          <div className="flex-shrink-0">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="bg-[#f0b429] text-[#080c14] px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-white disabled:opacity-40 transition"
            >
              {save.isPending ? '…' : prediction ? 'Update' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Stage + date + status */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
        <span className="text-xs text-[#334155] font-mono uppercase tracking-wider">{match.stage.replace(/_/g, ' ')}</span>
        {match.group && <span className="text-xs text-[#334155]">· {match.group}</span>}
        <span className="text-xs text-[#334155] ml-auto">{kickoff}</span>
        <StatusPill status={match.status} />
      </div>

      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
      {save.isSuccess && <p className="text-xs text-green-400 mt-2">✓ Saved</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PredictionsPage() {
  const [tab, setTab] = useState<'upcoming' | 'finished'>('upcoming')

  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.listMatches(),
  })

  const { data: predictions = [], isLoading: predsLoading } = useQuery({
    queryKey: ['predictions-global'],
    queryFn: () => api.listPredictions(),
  })

  const predByMatch = Object.fromEntries(predictions.map((p) => [p.match_id, p]))

  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  )

  const upcoming = sorted.filter((m) => m.status === 'scheduled' || m.status === 'live')
  const finished = sorted.filter((m) => m.status === 'finished').reverse() // most recent first

  const upcomingMissing = upcoming.filter((m) => !predByMatch[m.id]).length
  const finishedWithPred = finished.filter((m) => !!predByMatch[m.id]).length

  const isLoading = matchesLoading || predsLoading

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[#64748b] hover:text-white text-sm mb-3 transition-colors"
        >
          ← My Leagues
        </Link>
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
          My Predictions
        </h1>
        <p className="text-[#64748b] text-sm mt-1">
          Your picks across all competitions · points are shown in each league
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f1620] border border-white/10 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('upcoming')}
          className={`px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
            tab === 'upcoming'
              ? 'bg-[#f0b429] text-[#080c14]'
              : 'text-[#64748b] hover:text-white'
          }`}
        >
          Upcoming
          {upcomingMissing > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-sans">
              {upcomingMissing}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('finished')}
          className={`px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
            tab === 'finished'
              ? 'bg-[#f0b429] text-[#080c14]'
              : 'text-[#64748b] hover:text-white'
          }`}
        >
          Finished
          {finishedWithPred > 0 && (
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-sans ${tab === 'finished' ? 'bg-[#080c14]/30 text-[#080c14]' : 'bg-white/10 text-[#64748b]'}`}>
              {finishedWithPred}
            </span>
          )}
        </button>
      </div>

      {isLoading && (
        <p className="text-center text-[#64748b] py-16">Loading…</p>
      )}

      {/* Upcoming tab */}
      {!isLoading && tab === 'upcoming' && (
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <div className="text-center py-16 text-[#64748b]">
              <div className="text-4xl mb-4">📅</div>
              <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#475569] mb-2">No upcoming matches</p>
              <p className="text-sm">Check back when fixtures are announced.</p>
            </div>
          )}
          {upcoming.map((m) => (
            <PredictionRow key={m.id} match={m} prediction={predByMatch[m.id]} />
          ))}
        </div>
      )}

      {/* Finished tab */}
      {!isLoading && tab === 'finished' && (
        <div className="space-y-3">
          {finished.length === 0 && (
            <div className="text-center py-16 text-[#64748b]">
              <div className="text-4xl mb-4">🏁</div>
              <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#475569] mb-2">No finished matches</p>
              <p className="text-sm">Results will appear here once games are played.</p>
            </div>
          )}
          {finished.map((m) => (
            <PredictionRow key={m.id} match={m} prediction={predByMatch[m.id]} />
          ))}
        </div>
      )}
    </div>
  )
}
