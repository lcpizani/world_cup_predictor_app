'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Match } from '@/types/api'

const STAGES = [
  'group_stage',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'third_place',
  'final',
]

// ── Reset all matches ────────────────────────────────────────────────────────

function ResetMatchesButton() {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.resetAllMatches(),
    onSuccess: () => {
      setConfirm(false)
      setMsg('All matches, predictions and points have been reset.')
      qc.invalidateQueries({ queryKey: ['matches'] })
      qc.invalidateQueries({ queryKey: ['tournaments'] })
    },
    onError: (e: Error) => setMsg(e.message),
  })

  return (
    <div>
      <p className="text-sm text-[#64748b] mb-4">
        Deletes all matches, predictions and point events. Resets all leaderboard scores to zero.
      </p>
      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-red-500/20 transition"
        >
          Reset All Matches
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm text-red-400 font-semibold">Are you sure? This cannot be undone.</span>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-red-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-red-600 disabled:opacity-50 transition"
          >
            {mutation.isPending ? 'Resetting…' : 'Yes, Reset'}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-[#64748b] hover:text-white text-xs font-bold uppercase tracking-wide transition"
          >
            Cancel
          </button>
        </div>
      )}
      {msg && <p className="text-xs text-[#64748b] mt-3">{msg}</p>}
    </div>
  )
}

// ── Create match form ────────────────────────────────────────────────────────

function CreateMatchForm() {
  const qc = useQueryClient()
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [kickoff, setKickoff] = useState('')
  const [stage, setStage] = useState('group_stage')
  const [err, setErr] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.createMatch({
        home_team: home,
        away_team: away,
        kickoff_at: new Date(kickoff).toISOString(),
        stage,
      }),
    onSuccess: () => {
      setHome('')
      setAway('')
      setKickoff('')
      setStage('group_stage')
      setErr('')
      qc.invalidateQueries({ queryKey: ['matches'] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5">Home Team</label>
          <input
            value={home}
            onChange={(e) => setHome(e.target.value)}
            placeholder="Brazil"
            className="w-full bg-[#080c14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5">Away Team</label>
          <input
            value={away}
            onChange={(e) => setAway(e.target.value)}
            placeholder="Argentina"
            className="w-full bg-[#080c14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5">Kickoff</label>
          <input
            type="datetime-local"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            className="w-full bg-[#080c14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5">Stage</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full bg-[#080c14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !home || !away || !kickoff}
          className="bg-[#f0b429] text-[#080c14] px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white disabled:opacity-40 transition"
        >
          {mutation.isPending ? 'Creating…' : '+ Add Match'}
        </button>
        {mutation.isSuccess && <span className="text-xs text-green-400">✓ Match created</span>}
        {err && <span className="text-xs text-red-400">{err}</span>}
      </div>
    </div>
  )
}

// ── Reusable card wrapper ────────────────────────────────────────────────────

function AdminCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5 mb-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-xl">{icon}</span>
        <h2 className="font-[family-name:var(--font-oswald)] font-semibold text-lg uppercase tracking-wide text-white">
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

// ── Apply result form ────────────────────────────────────────────────────────

function ApplyResultForm({ match }: { match: Match }) {
  const qc = useQueryClient()
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [err, setErr] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.applyResult(match.id, parseInt(home), parseInt(away)),
    onSuccess: () => {
      setErr('')
      qc.invalidateQueries({ queryKey: ['matches'] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  if (mutation.isSuccess) {
    return <span className="text-sm text-green-400">✓ Result applied</span>
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="number" min={0} value={home}
        onChange={(e) => setHome(e.target.value)}
        placeholder="H"
        className="w-14 bg-[#080c14] border border-white/10 rounded-xl px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition font-[family-name:var(--font-oswald)] font-bold"
      />
      <span className="text-[#475569] font-bold">–</span>
      <input
        type="number" min={0} value={away}
        onChange={(e) => setAway(e.target.value)}
        placeholder="A"
        className="w-14 bg-[#080c14] border border-white/10 rounded-xl px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition font-[family-name:var(--font-oswald)] font-bold"
      />
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || home === '' || away === ''}
        className="bg-[#f0b429] text-[#080c14] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white disabled:opacity-40 transition"
      >
        {mutation.isPending ? '…' : 'Apply'}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  )
}

// ── Recompute button ─────────────────────────────────────────────────────────

function RecomputeButton({ tournamentId }: { tournamentId: string }) {
  const [msg, setMsg] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.recompute(tournamentId),
    onSuccess: (data) =>
      setMsg(`✓ ${data.recomputed_matches} matches / ${data.recomputed_predictions} predictions`),
    onError: (e: Error) => setMsg(`✗ ${e.message}`),
  })

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-[#64748b] font-mono">{msg}</span>}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="bg-white/5 border border-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white/10 disabled:opacity-40 transition"
      >
        {mutation.isPending ? 'Recomputing…' : 'Recompute'}
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const qc = useQueryClient()
  const [competitionCode, setCompetitionCode] = useState('WC')
  const [syncMsg, setSyncMsg] = useState('')

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.listMatches(),
  })

  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: api.listTournaments,
  })

  const unfinished = matches.filter((m) => m.status !== 'finished')

  async function sync(type: 'matches' | 'results') {
    setSyncMsg('Syncing…')
    try {
      const result =
        type === 'matches'
          ? await api.syncMatches(competitionCode)
          : await api.syncResults(competitionCode)
      setSyncMsg(JSON.stringify(result))
      qc.invalidateQueries({ queryKey: ['matches'] })
    } catch (e: unknown) {
      setSyncMsg(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">

      {/* Title */}
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
          Admin Panel
        </h1>
        <p className="text-[#64748b] text-sm mt-1">Sync, apply results, recompute scores</p>
      </div>

      {/* Danger zone */}
      <AdminCard title="Danger Zone" icon="⚠️">
        <ResetMatchesButton />
      </AdminCard>

      {/* Create match */}
      <AdminCard title="Create Match" icon="➕">
        <CreateMatchForm />
      </AdminCard>

      {/* Sync */}
      <AdminCard title="Sync from football-data.org" icon="🔄">
        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs font-bold uppercase tracking-widest text-[#64748b]">
            Competition code
          </label>
          <input
            value={competitionCode}
            onChange={(e) => setCompetitionCode(e.target.value.toUpperCase())}
            className="w-20 bg-[#080c14] border border-white/10 rounded-xl px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition font-mono tracking-widest"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => sync('matches')}
            className="bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white/10 transition"
          >
            Sync Fixtures
          </button>
          <button
            onClick={() => sync('results')}
            className="bg-[#f0b429] text-[#080c14] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white transition"
          >
            Sync Results
          </button>
        </div>
        {syncMsg && (
          <p className="mt-4 text-xs text-[#94a3b8] font-mono bg-[#080c14] rounded-xl p-3 border border-white/5 break-all">
            {syncMsg}
          </p>
        )}
      </AdminCard>

      {/* Apply results manually */}
      <AdminCard title="Apply Match Result" icon="⚽">
        {unfinished.length === 0 ? (
          <p className="text-sm text-[#475569]">All matches are finished.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {unfinished.map((m) => (
              <div key={m.id} className="py-4 first:pt-0 last:pb-0">
                <p className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide">
                  {m.home_team} <span className="text-[#475569]">vs</span> {m.away_team}
                </p>
                <p className="text-xs text-[#475569] font-mono mt-0.5 mb-2">
                  {new Date(m.kickoff_at).toLocaleString()} · {m.status}
                </p>
                <ApplyResultForm match={m} />
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* Recompute */}
      <AdminCard title="Recompute Scores" icon="🧮">
        {tournaments.length === 0 ? (
          <p className="text-sm text-[#475569]">No tournaments found.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {tournaments.map((t) => (
              <div key={t.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-sm">
                  {t.name}
                </span>
                <RecomputeButton tournamentId={t.id} />
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
