'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { api } from '@/lib/api'
import { getTeamFlagCode, getFlagUrl } from '@/lib/flags'
import type { Match, Prediction } from '@/types/api'

function useMinutesUntil(dt: string): number {
  const calc = () => Math.floor((new Date(dt).getTime() - Date.now()) / 60000)
  const [minutes, setMinutes] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setMinutes(calc), 30000)
    return () => clearInterval(id)
  }, [dt])
  return minutes
}

function formatKickoff(dt: string) {
  return new Date(dt).toLocaleString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
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

function StatusBadge({ status, kickoff_at }: { status: string; kickoff_at: string }) {
  if (status === 'live') return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      Live
    </span>
  )
  if (status === 'finished') return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider" style={{ color: '#3f5068', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      FT
    </span>
  )
  const label = new Date(kickoff_at).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
  return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider text-[#f0b429]" style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)' }}>
      {label}
    </span>
  )
}

function MatchCard({ match, prediction }: { match: Match; prediction?: Prediction }) {
  const minutesLeft = useMinutesUntil(match.kickoff_at)
  const isScheduled = match.status === 'scheduled'
  const noPredictionYet = isScheduled && !prediction

  const scoreColors = (() => {
    if (match.status !== 'finished' || !prediction || match.home_score === null || match.away_score === null) {
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

  // Left-edge accent based on result
  const accentColor = (() => {
    if (match.status !== 'finished' || !prediction) return 'transparent'
    if (scoreColors.home === 'green' && scoreColors.away === 'green') return 'rgba(34,197,94,0.7)'
    if (scoreColors.winner) return 'rgba(240,180,41,0.7)'
    return 'rgba(255,255,255,0.1)'
  })()

  return (
    <div
      className="rounded-2xl p-3.5 sm:p-5 transition-all duration-200 overflow-hidden relative"
      style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      {/* Left-edge result indicator */}
      {match.status === 'finished' && prediction && (
        <div
          className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
          style={{ background: accentColor }}
        />
      )}

      {/* Stage + group + status */}
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 flex-wrap">
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
        <StatusBadge status={match.status} kickoff_at={match.kickoff_at} />
      </div>

      {/* Teams + scores */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Home */}
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-2.5 min-w-0">
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate text-sm sm:text-base">
            {match.home_team}
          </span>
          <TeamFlag name={match.home_team} />
        </div>

        {/* Centre */}
        <div className="flex items-center gap-1.5 shrink-0">
          {match.status === 'finished' ? (
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
              {match.status === 'scheduled' ? 'no pick' : 'locked'}
            </span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 flex items-center gap-2 sm:gap-2.5 min-w-0">
          <TeamFlag name={match.away_team} />
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate text-sm sm:text-base">
            {match.away_team}
          </span>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {noPredictionYet && minutesLeft > 0 ? (
          <Link href="/predictions" className="text-xs text-[#f0b429] hover:text-white transition-colors font-semibold">
            Add your pick in My Picks →
          </Link>
        ) : (
          <span />
        )}
        {prediction?.points_awarded !== null && prediction?.points_awarded !== undefined && (
          <div className="ml-auto flex items-baseline gap-1">
            <span className="font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-lg">
              +{prediction.points_awarded}
            </span>
            <span className="text-xs font-medium" style={{ color: '#5a6a82' }}>pts</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TournamentPage() {
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

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
  })

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
    const link = `${window.location.origin}/join/${tournament.invite_code}`
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

  const actionBtnStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'white',
  }
  const actionBtnHover = {
    background: 'rgba(240,180,41,0.08)',
    borderColor: 'rgba(240,180,41,0.22)',
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm mb-3 transition-colors font-medium"
          style={{ color: '#3f5068' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3f5068' }}
        >
          ← My Leagues
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
            {refreshing ? 'Reloading…' : 'Reload'}
          </button>
        </div>

        {/* Action buttons */}
        <div className="mt-4 grid grid-cols-3 sm:flex sm:items-center gap-2 sm:flex-wrap">
            <button
              onClick={copyInviteLink}
              disabled={!tournament}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-wide px-3 sm:px-4 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-40 truncate"
              style={actionBtnStyle}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, actionBtnHover)}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, actionBtnStyle)}
            >
              {copied ? '✓ Copied' : 'Invite'}
            </button>
            <Link
              href={`/tournaments/${code}/compare`}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-wide px-3 sm:px-4 py-2.5 rounded-xl transition-all duration-200 text-center"
              style={actionBtnStyle}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, actionBtnHover)}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, actionBtnStyle)}
            >
              Compare →
            </Link>
            <Link
              href={`/tournaments/${code}/leaderboard`}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-wide px-3 sm:px-4 py-2.5 rounded-xl transition-all duration-200 text-center"
              style={actionBtnStyle}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, actionBtnHover)}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, actionBtnStyle)}
            >
              Leaderboard →
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
              Delete Competition
            </button>
          ) : (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)' }}>
              <p className="text-sm text-red-300 font-semibold mb-1">Delete this competition?</p>
              <p className="text-xs mb-4" style={{ color: 'rgba(244,63,94,0.6)' }}>
                This will permanently remove the competition and all predictions. This cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                  style={{ background: '#ef4444', color: 'white' }}
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete it'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#8496af' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Matches */}
      {matchesLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse h-28 rounded-2xl" style={{ background: '#0d1520' }} />
          ))}
        </div>
      )}

      {!matchesLoading && sorted.length === 0 && (
        <div className="text-center py-20">
          <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide mb-2" style={{ color: '#2d3e52' }}>
            No matches yet
          </p>
          <p className="text-sm" style={{ color: '#3f5068' }}>An admin needs to sync fixtures first.</p>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((match) => (
          <MatchCard key={match.id} match={match} prediction={predByMatch[match.id]} />
        ))}
      </div>
    </div>
  )
}
