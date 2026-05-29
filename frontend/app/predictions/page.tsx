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
    <div className="w-9 h-6 rounded overflow-hidden shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      <Image src={getFlagUrl(code, 40)} alt={name} width={36} height={24} className="w-full h-full object-cover" unoptimized />
    </div>
  )
}

function scoreColor(pred: number | undefined, actual: number | null): string {
  if (pred === undefined || actual === null) return 'text-white'
  if (pred === actual) return 'text-green-400'
  return 'text-[#3f5068]'
}

function outcomeOf(h: number, a: number): number {
  return h > a ? 1 : h < a ? -1 : 0
}

function ResultBadge({ exact, winner, hasPred }: { exact: boolean; winner: boolean; hasPred: boolean }) {
  if (!hasPred) return null
  if (exact) return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      Exact
    </span>
  )
  if (winner) return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-[#f0b429]" style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.2)' }}>
      Winner
    </span>
  )
  return (
    <span className="text-[10px] font-medium text-[#2d3e52]">Miss</span>
  )
}

function StatusPill({ status }: { status: string }) {
  if (status === 'live') return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" /> Live
    </span>
  )
  if (status === 'finished') return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-[#3f5068]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      FT
    </span>
  )
  return null
}

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

  // ── Finished match ───────────────────────────────────────────────────────────
  if (match.status === 'finished') {
    const hasPred = !!prediction
    const ah = match.home_score, aa = match.away_score
    const ph = prediction?.predicted_home, pa = prediction?.predicted_away
    const exact = hasPred && ph === ah && pa === aa
    const correctWinner = hasPred && !exact && ah !== null && aa !== null &&
      outcomeOf(ph!, pa!) === outcomeOf(ah!, aa!)

    const borderColor = exact
      ? 'rgba(34,197,94,0.2)'
      : correctWinner
        ? 'rgba(240,180,41,0.2)'
        : 'rgba(255,255,255,0.07)'

    const bgColor = exact
      ? 'rgba(34,197,94,0.04)'
      : correctWinner
        ? 'rgba(240,180,41,0.04)'
        : '#0d1520'

    return (
      <div className="rounded-2xl p-3 sm:p-4 transition-colors" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
        {/* Top meta row (mobile only) */}
        <div className="flex items-center gap-2 mb-2.5 sm:hidden">
          <span className="text-[10px] text-[#2d3e52] font-mono uppercase tracking-wider">{match.stage.replace(/_/g, ' ')}</span>
          {match.group && <span className="text-[10px] text-[#2d3e52]">· {match.group}</span>}
          <div className="ml-auto"><ResultBadge exact={exact} winner={correctWinner} hasPred={hasPred} /></div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
            <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-xs sm:text-sm">
              {match.home_team}
            </span>
            <TeamFlag name={match.home_team} />
          </div>

          <div className="flex flex-col items-center gap-0.5 w-20 sm:w-28 shrink-0">
            {hasPred ? (
              <>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-base sm:text-lg w-5 text-center ${scoreColor(ph, ah)}`}>{ph}</span>
                  <span className="text-[#1e2d40] text-sm">–</span>
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-base sm:text-lg w-5 text-center ${scoreColor(pa, aa)}`}>{pa}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-[family-name:var(--font-oswald)] text-xs text-[#3f5068] w-4 text-center">{ah}</span>
                  <span className="text-[#1e2d40] text-xs">–</span>
                  <span className="font-[family-name:var(--font-oswald)] text-xs text-[#3f5068] w-4 text-center">{aa}</span>
                </div>
              </>
            ) : (
              <>
                <span className="font-[family-name:var(--font-oswald)] font-bold text-base sm:text-lg text-[#1e2d40]">{ah} – {aa}</span>
                <span className="text-xs text-[#1e2d40]">no pick</span>
              </>
            )}
          </div>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <TeamFlag name={match.away_team} />
            <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-xs sm:text-sm">
              {match.away_team}
            </span>
          </div>

          {/* Desktop result badge */}
          <div className="shrink-0 w-14 text-right hidden sm:block">
            <ResultBadge exact={exact} winner={correctWinner} hasPred={hasPred} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Desktop: stage/group inline; mobile: hidden (shown in top meta) */}
          <span className="hidden sm:inline text-[10px] text-[#2d3e52] font-mono uppercase tracking-wider">{match.stage.replace(/_/g, ' ')}</span>
          {match.group && <span className="hidden sm:inline text-[10px] text-[#2d3e52]">· {match.group}</span>}
          <span className="text-[10px] text-[#2d3e52] sm:ml-auto truncate">{kickoff}</span>
          <div className="ml-auto sm:ml-0"><StatusPill status={match.status} /></div>
        </div>
      </div>
    )
  }

  // ── Upcoming / live ──────────────────────────────────────────────────────────
  const scoreInputs = (
    <>
      <input
        type="number" min={0} value={home}
        onChange={(e) => setHome(e.target.value)}
        placeholder="0"
        inputMode="numeric"
        aria-label={`${match.home_team} score`}
        className="w-12 sm:w-11 text-white text-center font-[family-name:var(--font-oswald)] font-bold text-base rounded-lg px-1 py-1.5 transition-all"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          outline: 'none',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(240,180,41,0.08)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
      />
      <span className="text-[#2d3e52] font-bold text-sm">–</span>
      <input
        type="number" min={0} value={away}
        onChange={(e) => setAway(e.target.value)}
        placeholder="0"
        inputMode="numeric"
        aria-label={`${match.away_team} score`}
        className="w-12 sm:w-11 text-white text-center font-[family-name:var(--font-oswald)] font-bold text-base rounded-lg px-1 py-1.5 transition-all"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          outline: 'none',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(240,180,41,0.08)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
      />
    </>
  )

  return (
    <div
      className="rounded-2xl p-3 sm:p-4 transition-all duration-200"
      style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Top meta row (mobile only) */}
      <div className="flex items-center gap-2 mb-2.5 sm:hidden">
        <span className="text-[10px] text-[#2d3e52] font-mono uppercase tracking-wider">{match.stage.replace(/_/g, ' ')}</span>
        {match.group && <span className="text-[10px] text-[#2d3e52]">· {match.group}</span>}
        <div className="ml-auto"><StatusPill status={match.status} /></div>
      </div>

      {/* Teams row */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-xs sm:text-sm">
            {match.home_team}
          </span>
          <TeamFlag name={match.home_team} />
        </div>

        {/* Desktop centered inputs */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 w-28 justify-center">
          {isLocked ? (
            prediction ? (
              <span className="font-[family-name:var(--font-oswald)] font-bold text-lg text-white">
                {prediction.predicted_home} – {prediction.predicted_away}
              </span>
            ) : (
              <span className="text-xs text-[#1e2d40]">locked</span>
            )
          ) : scoreInputs}
        </div>

        {/* Mobile center placeholder — VS or locked status */}
        <div className="sm:hidden shrink-0 px-1">
          {isLocked ? (
            prediction ? (
              <span className="font-[family-name:var(--font-oswald)] font-bold text-base text-white">
                {prediction.predicted_home} – {prediction.predicted_away}
              </span>
            ) : (
              <span className="text-[10px] text-[#1e2d40] font-bold tracking-widest uppercase">locked</span>
            )
          ) : (
            <span className="font-[family-name:var(--font-oswald)] font-bold text-[#1e2d40] text-xs tracking-[0.25em]">VS</span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamFlag name={match.away_team} />
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-xs sm:text-sm">
            {match.away_team}
          </span>
        </div>

        {/* Desktop save button */}
        {!isLocked && (
          <div className="shrink-0 hidden sm:block">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-40"
              style={{
                background: '#f0b429',
                color: '#080c14',
              }}
              onMouseEnter={e => !save.isPending && ((e.currentTarget as HTMLElement).style.background = '#fcd86e')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#f0b429')}
            >
              {save.isPending ? '…' : prediction ? 'Update' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Mobile-only: inputs + save below */}
      {!isLocked && (
        <div className="sm:hidden flex items-center justify-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-1.5">
            {scoreInputs}
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-40"
            style={{ background: '#f0b429', color: '#080c14' }}
          >
            {save.isPending ? '…' : prediction ? 'Update' : 'Save'}
          </button>
        </div>
      )}

      {/* Footer meta (desktop) + kickoff (both) */}
      <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="hidden sm:inline text-[10px] text-[#2d3e52] font-mono uppercase tracking-wider">{match.stage.replace(/_/g, ' ')}</span>
        {match.group && <span className="hidden sm:inline text-[10px] text-[#2d3e52]">· {match.group}</span>}
        <span className="text-[10px] text-[#2d3e52] sm:ml-auto truncate">{kickoff}</span>
        <div className="ml-auto sm:ml-0 hidden sm:block"><StatusPill status={match.status} /></div>
      </div>

      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
      {save.isSuccess && <p className="text-xs text-green-400 mt-2 font-medium">✓ Saved</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PredictionsPage() {
  const [tab, setTab] = useState<'upcoming' | 'finished'>('upcoming')
  const [refreshing, setRefreshing] = useState(false)
  const qc = useQueryClient()

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
  const finished = sorted.filter((m) => m.status === 'finished').reverse()

  const upcomingMissing = upcoming.filter((m) => !predByMatch[m.id]).length
  const finishedWithPred = finished.filter((m) => !!predByMatch[m.id]).length

  const isLoading = matchesLoading || predsLoading

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Fixed reload button */}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="fixed top-[76px] right-4 z-30 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-all duration-200 disabled:opacity-40"
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
        {refreshing ? 'Reloading…' : 'Reload'}
      </button>

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[#3f5068] hover:text-white text-sm mb-3 transition-colors font-medium"
        >
          ← Dashboard
        </Link>
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white leading-none">
          My Predictions
        </h1>
        <p className="text-[#3f5068] text-sm mt-1.5 font-medium">
          Your picks across all competitions
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 mb-6 w-fit" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={() => setTab('upcoming')}
          className={`px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-200 flex items-center gap-2 ${
            tab === 'upcoming'
              ? 'bg-[#f0b429] text-[#080c14]'
              : 'text-[#5a6a82] hover:text-white'
          }`}
        >
          Upcoming
          {upcomingMissing > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'upcoming' ? 'bg-[#080c14]/20 text-[#080c14]' : 'bg-red-500 text-white'}`}>
              {upcomingMissing}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('finished')}
          className={`px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-200 flex items-center gap-2 ${
            tab === 'finished'
              ? 'bg-[#f0b429] text-[#080c14]'
              : 'text-[#5a6a82] hover:text-white'
          }`}
        >
          Finished
          {finishedWithPred > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'finished' ? 'bg-[#080c14]/20 text-[#080c14]' : 'bg-white/10 text-[#5a6a82]'}`}>
              {finishedWithPred}
            </span>
          )}
        </button>
      </div>

      {isLoading && (
        <p className="text-center text-[#3f5068] py-16">Loading…</p>
      )}

      {!isLoading && tab === 'upcoming' && (
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <div className="text-center py-16">
              <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52] mb-2">No upcoming matches</p>
              <p className="text-sm text-[#3f5068]">Check back when fixtures are announced.</p>
            </div>
          )}
          {upcoming.map((m) => (
            <PredictionRow key={m.id} match={m} prediction={predByMatch[m.id]} />
          ))}
        </div>
      )}

      {!isLoading && tab === 'finished' && (
        <div className="space-y-3">
          {finished.length === 0 && (
            <div className="text-center py-16">
              <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52] mb-2">No finished matches</p>
              <p className="text-sm text-[#3f5068]">Results will appear here once games are played.</p>
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
