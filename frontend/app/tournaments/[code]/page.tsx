'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { api } from '@/lib/api'
import { getTeamFlagCode, getFlagUrl } from '@/lib/flags'
import type { Match, Prediction } from '@/types/api'

// ── Countdown hook ───────────────────────────────────────────────────────────

function useMinutesUntil(dt: string): number {
  const calc = () => Math.floor((new Date(dt).getTime() - Date.now()) / 60000)
  const [minutes, setMinutes] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setMinutes(calc), 30000) // refresh every 30s
    return () => clearInterval(id)
  }, [dt])
  return minutes
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatKickoff(dt: string) {
  return new Date(dt).toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function TeamFlag({ name }: { name: string }) {
  const flagCode = getTeamFlagCode(name)
  if (!flagCode) return null
  return (
    <div className="w-10 h-7 rounded overflow-hidden border border-white/10 flex-shrink-0">
      <Image
        src={getFlagUrl(flagCode, 40)}
        alt={name}
        width={40}
        height={28}
        className="w-full h-full object-cover"
        unoptimized
      />
    </div>
  )
}

function StatusBadge({ status, kickoff_at }: { status: string; kickoff_at: string }) {
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wider">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Live
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/5 text-[#475569] border border-white/10 uppercase tracking-wider">
        FT
      </span>
    )
  }
  const d = new Date(kickoff_at)
  const label = d.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return (
    <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#f0b429]/10 text-[#f0b429] border border-[#f0b429]/20 tracking-wider">
      {label}
    </span>
  )
}

// ── Match card ────────────────────────────────────────────────────────────────

function MatchCard({
  match,
  prediction,
  tournamentId,
}: {
  match: Match
  prediction?: Prediction
  tournamentId: string
}) {
  const qc = useQueryClient()
  const [home, setHome] = useState(prediction?.predicted_home?.toString() ?? '')
  const [away, setAway] = useState(prediction?.predicted_away?.toString() ?? '')
  const [err, setErr] = useState('')

  const isLocked = !!prediction?.is_locked || match.status !== 'scheduled'
  const minutesLeft = useMinutesUntil(match.kickoff_at)
  const isUrgent = !isLocked && minutesLeft <= 60 && minutesLeft > 0

  // Colour coding for finished matches with a prediction
  const scoreColors = (() => {
    if (match.status !== 'finished' || !prediction || match.home_score === null || match.away_score === null) {
      return { home: '', away: '', winner: false }
    }
    const ph = prediction.predicted_home
    const pa = prediction.predicted_away
    const ah = match.home_score
    const aa = match.away_score
    const outcome = (h: number, a: number) => h > a ? 1 : h < a ? -1 : 0
    const correctWinner = outcome(ph, pa) === outcome(ah, aa)
    const correctDiff = (ph - pa) === (ah - aa)
    if (ph === ah && pa === aa) return { home: 'green', away: 'green', winner: true }
    const homeColor = ph === ah ? 'green' : correctDiff ? 'yellow' : ''
    const awayColor = pa === aa ? 'green' : correctDiff ? 'yellow' : ''
    return { home: homeColor, away: awayColor, winner: correctWinner }
  })()

  const saveMutation = useMutation({
    mutationFn: () => {
      const h = parseInt(home)
      const a = parseInt(away)
      if (isNaN(h) || isNaN(a) || h < 0 || a < 0) throw new Error('Enter valid scores')
      if (prediction) {
        return api.updatePrediction(prediction.id, { predicted_home: h, predicted_away: a })
      }
      return api.submitPrediction({
        match_id: match.id,
        tournament_id: tournamentId,
        predicted_home: h,
        predicted_away: a,
      })
    },
    onSuccess: () => {
      setErr('')
      qc.invalidateQueries({ queryKey: ['predictions', tournamentId] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  return (
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">

      {/* Urgency warning */}
      {isUrgent && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-4">
          <span className="text-red-400 text-sm">⚠️</span>
          <p className="text-xs text-red-400 font-semibold">
            {minutesLeft === 1
              ? 'Locks in 1 minute — submit your prediction now!'
              : `Locks in ${minutesLeft} minutes — lock in your prediction!`}
          </p>
        </div>
      )}

      {/* Top: stage + group + date */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Teams + score inputs inline */}
      <div className="flex items-center gap-2">

        {/* Home team */}
        <div className="flex-1 flex items-center justify-end gap-2.5 min-w-0">
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-right truncate">
            {match.home_team}
          </span>
          <TeamFlag name={match.home_team} />
        </div>

        {/* Centre: actual score or prediction inputs */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {match.status === 'finished' ? (
            prediction ? (
              <div className="flex flex-col items-center gap-1 w-24">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${scoreColors.winner && scoreColors.home === 'green' && scoreColors.away === 'green' ? 'bg-green-500/10 border border-green-500/20' : scoreColors.winner ? 'bg-[#f0b429]/10 border border-[#f0b429]/20' : 'border border-transparent'}`}>
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-xl w-5 text-center ${scoreColors.home === 'green' ? 'text-green-400' : scoreColors.home === 'yellow' ? 'text-yellow-400' : 'text-white'}`}>
                    {prediction.predicted_home}
                  </span>
                  <span className="text-[#475569] font-bold text-sm">–</span>
                  <span className={`font-[family-name:var(--font-oswald)] font-bold text-xl w-5 text-center ${scoreColors.away === 'green' ? 'text-green-400' : scoreColors.away === 'yellow' ? 'text-yellow-400' : 'text-white'}`}>
                    {prediction.predicted_away}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-[family-name:var(--font-oswald)] text-sm text-[#475569] w-4 text-center">{match.home_score}</span>
                  <span className="text-[#334155] text-xs">–</span>
                  <span className="font-[family-name:var(--font-oswald)] text-sm text-[#475569] w-4 text-center">{match.away_score}</span>
                </div>
              </div>
            ) : (
              <span className="font-[family-name:var(--font-oswald)] font-bold text-2xl text-[#475569] w-24 text-center">
                {match.home_score} – {match.away_score}
              </span>
            )
          ) : isLocked ? (
            prediction ? (
              <span className="font-[family-name:var(--font-oswald)] font-bold text-xl text-white w-24 text-center">
                {prediction.predicted_home} – {prediction.predicted_away}
              </span>
            ) : (
              <span className="text-[#334155] text-xs italic w-24 text-center">locked</span>
            )
          ) : (
            <>
              <input
                type="number"
                min={0}
                value={home}
                onChange={(e) => setHome(e.target.value)}
                placeholder="0"
                className="w-12 bg-[#080c14] border border-white/10 rounded-xl px-1 py-2 text-white text-center focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition font-[family-name:var(--font-oswald)] font-bold text-lg"
              />
              <span className="text-[#475569] font-bold">–</span>
              <input
                type="number"
                min={0}
                value={away}
                onChange={(e) => setAway(e.target.value)}
                placeholder="0"
                className="w-12 bg-[#080c14] border border-white/10 rounded-xl px-1 py-2 text-white text-center focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition font-[family-name:var(--font-oswald)] font-bold text-lg"
              />
            </>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <TeamFlag name={match.away_team} />
          <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide truncate">
            {match.away_team}
          </span>
        </div>
      </div>

      {/* Bottom row: points earned + save button */}
      {!isLocked && (
        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-white/5">
          {err && <span className="text-xs text-red-400">{err}</span>}
          {saveMutation.isSuccess && <span className="text-xs text-green-400">✓ Saved</span>}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-[#f0b429] text-[#080c14] px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white disabled:opacity-40 transition"
          >
            {saveMutation.isPending ? '…' : prediction ? 'Update' : 'Save'}
          </button>
        </div>
      )}
      {isLocked && prediction?.points_awarded !== null && prediction?.points_awarded !== undefined && (
        <div className="flex justify-end mt-3 pt-3 border-t border-white/5">
          <span className="font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-lg">
            +{prediction.points_awarded} <span className="text-xs text-[#64748b] font-sans font-normal">pts</span>
          </span>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TournamentPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  // predictions are keyed by tournament UUID (internal), not invite code
  const tournamentId = tournament?.id ?? ''

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
    <div className="max-w-3xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-[#64748b] hover:text-white text-sm mb-3 transition-colors"
          >
            ← My Leagues
          </Link>
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
            {tournament?.name ?? '…'}
          </h1>
          {tournament && (
            <p className="text-xs text-[#475569] font-mono tracking-widest mt-1">
              {tournament.invite_code}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyInviteLink}
            disabled={!tournament}
            className="bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-white/10 hover:border-[#f0b429]/30 transition-all whitespace-nowrap disabled:opacity-40"
          >
            {copied ? '✓ Copied!' : 'Invite Friends'}
          </button>
          <Link
            href={`/tournaments/${code}/leaderboard`}
            className="bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-white/10 hover:border-[#f0b429]/30 transition-all whitespace-nowrap"
          >
            Leaderboard →
          </Link>
        </div>
      </div>

      {/* Delete competition — creator only */}
      {isCreator && (
        <div className="mb-8">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-red-500/20 hover:border-red-500/40 transition-all"
            >
              <span>🗑</span> Delete Competition
            </button>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
              <p className="text-sm text-red-300 font-semibold mb-1">Delete this competition?</p>
              <p className="text-xs text-red-400/70 mb-4">
                This will permanently remove the competition and all predictions. This cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-red-600 disabled:opacity-50 transition"
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete it'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="bg-white/5 border border-white/10 text-[#94a3b8] px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-white/10 hover:text-white transition-all"
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
        <p className="text-center text-[#64748b] py-16">Loading matches…</p>
      )}

      <div className="space-y-4">
        {!matchesLoading && sorted.length === 0 && (
          <div className="text-center py-20 text-[#64748b]">
            <div className="text-4xl mb-4">📅</div>
            <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#475569] mb-2">
              No matches yet
            </p>
            <p className="text-sm">An admin needs to sync fixtures first.</p>
          </div>
        )}
        {sorted.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            prediction={predByMatch[match.id]}
            tournamentId={tournamentId}
          />
        ))}
      </div>
    </div>
  )
}
