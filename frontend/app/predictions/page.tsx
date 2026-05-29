'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getTeamFlagCode, getFlagUrl, translateTeamName } from '@/lib/flags'
import type { Match, Prediction } from '@/types/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { useLocale, useTranslations } from 'next-intl'
import { formatMatchDateTime } from '@/lib/date'

function TeamFlag({ name }: { name: string }) {
  const code = getTeamFlagCode(name)
  if (!code) return null
  return (
    <div className="w-9 h-6 rounded overflow-hidden shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
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
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      {t('exact')}
    </span>
  )
  if (winner) return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-[#f0b429]" style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.2)' }}>
      {t('winner')}
    </span>
  )
  return (
    <span className="text-[10px] font-medium text-[#2d3e52]">{t('miss')}</span>
  )
}

function StatusBadge({ status, kickoff_at, timezone }: { status: string; kickoff_at: string; timezone?: string | null }) {
  const t = useTranslations('predictions')
  if (status === 'live') return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      {t('live')}
    </span>
  )
  if (status === 'finished') return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider" style={{ color: '#3f5068', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {t('ft')}
    </span>
  )
  const label = formatMatchDateTime(kickoff_at, timezone)
  return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider text-[#f0b429]" style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)' }}>
      {label}
    </span>
  )
}

function PredictionRow({ match, prediction, timezone }: { match: Match; prediction?: Prediction; timezone?: string | null }) {
  const t = useTranslations('predictions')
  const locale = useLocale()
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

  // ── Finished match ───────────────────────────────────────────────────────────
  if (match.status === 'finished') {
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
        {/* Left-edge accent bar */}
        {hasPred && (
          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: accentColor }} />
        )}

        {/* Stage + group + result + FT badge */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono tracking-widest uppercase truncate" style={{ color: '#3f5068' }}>
              {match.stage.replace(/_/g, ' ')}
            </span>
            {match.group && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0" style={{ color: '#5a6a82', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {match.group}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ResultBadge exact={exact} winner={scoreColors.winner} hasPred={hasPred} />
            <StatusBadge status={match.status} kickoff_at={match.kickoff_at} timezone={timezone} />
          </div>
        </div>

        {/* Teams + scores */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex-1 flex items-center justify-end gap-2 sm:gap-2.5 min-w-0">
            <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-sm sm:text-base">
              {translateTeamName(match.home_team, locale)}
            </span>
            <TeamFlag name={match.home_team} />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasPred ? (
              <div className="flex flex-col items-center gap-1 w-20 sm:w-24">
                {/* Prediction — big, per-digit colored, in a pill */}
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg" style={pillStyle}>
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-xl w-5 text-center ${scoreColors.home === 'green' ? 'text-green-400' : scoreColors.home === 'yellow' ? 'text-[#f0b429]' : 'text-white'}`}>
                    {ph}
                  </span>
                  <span className="font-bold text-sm" style={{ color: '#2d3e52' }}>–</span>
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-xl w-5 text-center ${scoreColors.away === 'green' ? 'text-green-400' : scoreColors.away === 'yellow' ? 'text-[#f0b429]' : 'text-white'}`}>
                    {pa}
                  </span>
                </div>
                {/* Actual result — small, dim */}
                <div className="flex items-center gap-1">
                  <span className="font-[family-name:var(--font-oswald)] text-sm w-4 text-center" style={{ color: '#3f5068' }}>{ah}</span>
                  <span className="text-xs" style={{ color: '#1e2d40' }}>–</span>
                  <span className="font-[family-name:var(--font-oswald)] text-sm w-4 text-center" style={{ color: '#3f5068' }}>{aa}</span>
                </div>
              </div>
            ) : (
              <span className="font-[family-name:var(--font-oswald)] font-bold text-xl sm:text-2xl w-20 sm:w-24 text-center" style={{ color: '#3f5068' }}>
                {ah} – {aa}
              </span>
            )}
          </div>

          <div className="flex-1 flex items-center gap-2 sm:gap-2.5 min-w-0">
            <TeamFlag name={match.away_team} />
            <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-sm sm:text-base">
              {translateTeamName(match.away_team, locale)}
            </span>
          </div>
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
      <span className="text-[#4a6080] font-bold text-sm">–</span>
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
      {/* Stage + group + status badge */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono tracking-widest uppercase truncate" style={{ color: '#3f5068' }}>
            {match.stage.replace(/_/g, ' ')}
          </span>
          {match.group && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0" style={{ color: '#5a6a82', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {match.group}
            </span>
          )}
        </div>
        <StatusBadge status={match.status} kickoff_at={match.kickoff_at} timezone={timezone} />
      </div>

      {/* Teams row */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-xs sm:text-sm">
            {translateTeamName(match.home_team, locale)}
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
              <span className="text-xs text-[#1e2d40]">{t('locked')}</span>
            )
          ) : scoreInputs}
        </div>

        {/* Mobile center */}
        <div className="sm:hidden shrink-0 flex items-center gap-1">
          {isLocked ? (
            prediction ? (
              <span className="font-[family-name:var(--font-oswald)] font-bold text-base text-white tabular-nums">
                {prediction.predicted_home}–{prediction.predicted_away}
              </span>
            ) : (
              <span className="text-[10px] text-[#1e2d40] font-bold tracking-widest uppercase">{t('locked')}</span>
            )
          ) : (
            <>
              <div className="flex items-center gap-1">{scoreInputs}</div>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="ml-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 disabled:opacity-40"
                style={{ background: '#f0b429', color: '#080c14' }}
              >
                {save.isPending ? '…' : '✓'}
              </button>
            </>
          )}
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamFlag name={match.away_team} />
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-xs sm:text-sm">
            {translateTeamName(match.away_team, locale)}
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
              {save.isPending ? '…' : prediction ? t('update') : t('save')}
            </button>
          </div>
        )}
      </div>

      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
      {save.isSuccess && <p className="text-xs text-green-400 mt-2 font-medium">{t('saved')}</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PredictionsPage() {
  const t = useTranslations('predictions')
  const [tab, setTab] = useState<'upcoming' | 'finished'>('upcoming')
  const [refreshing, setRefreshing] = useState(false)
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
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[#3f5068] hover:text-white text-sm mb-3 transition-colors font-medium"
        >
          {t('back_dashboard')}
        </Link>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-oswald)] text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white leading-none">
              {t('title')}
            </h1>
            <p className="text-[#3f5068] text-sm mt-1.5 font-medium">
              {t('subtitle')}
            </p>
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
            tab === 'finished'
              ? 'bg-[#f0b429] text-[#080c14]'
              : 'text-[#5a6a82] hover:text-white'
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

      {isLoading && (
        <p className="text-center text-[#3f5068] py-16">…</p>
      )}

      {!isLoading && tab === 'upcoming' && (
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <div className="text-center py-16">
              <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52] mb-2">{t('no_upcoming_title')}</p>
              <p className="text-sm text-[#3f5068]">{t('no_upcoming_desc')}</p>
            </div>
          )}
          {upcoming.map((m) => (
            <PredictionRow key={m.id} match={m} prediction={predByMatch[m.id]} timezone={me?.timezone} />
          ))}
        </div>
      )}

      {!isLoading && tab === 'finished' && (
        <div className="space-y-3">
          {finished.length === 0 && (
            <div className="text-center py-16">
              <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#2d3e52] mb-2">{t('no_finished_title')}</p>
              <p className="text-sm text-[#3f5068]">{t('no_finished_desc')}</p>
            </div>
          )}
          {finished.map((m) => (
            <PredictionRow key={m.id} match={m} prediction={predByMatch[m.id]} timezone={me?.timezone} />
          ))}
        </div>
      )}
    </div>
  )
}
