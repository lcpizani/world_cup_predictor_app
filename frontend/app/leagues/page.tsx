'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Tournament } from '@/types/api'

// ── Scoring rules shared config ───────────────────────────────────────────────

const RULE_LABELS: Record<string, { label: string; icon: string }> = {
  correct_result_pts:         { label: 'Exact score',             icon: '🎯' },
  correct_winner_pts:         { label: 'Correct winner / draw',   icon: '🏆' },
  correct_goal_diff_pts:      { label: 'Correct goal difference', icon: '⚖️' },
  correct_goals_one_team_pts: { label: "One team's score right",  icon: '⚽' },
}

const DEFAULT_RULES = {
  correct_result_pts: 5,
  correct_winner_pts: 3,
  correct_goal_diff_pts: 2,
  correct_goals_one_team_pts: 1,
}

// ── Join panel ────────────────────────────────────────────────────────────────

function JoinPanel({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (c: string) => api.joinTournament(c),
    onSuccess: () => { setCode(''); setError(''); onJoined() },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-3">Join by invite code</p>
      <div className="flex gap-3">
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && code && mutation.mutate(code)}
          placeholder="e.g. ABC12345"
          className="flex-1 bg-[#080c14] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition font-mono tracking-wider"
        />
        <button
          onClick={() => { setError(''); mutation.mutate(code) }}
          disabled={!code || mutation.isPending}
          className="bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-white/20 disabled:opacity-40 transition border border-white/10"
        >
          {mutation.isPending ? '…' : 'Join'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  )
}

// ── Create panel ──────────────────────────────────────────────────────────────

function CreatePanel({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState(DEFAULT_RULES)
  const qc = useQueryClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      await api.createTournament({ name: fd.get('name') as string, scoring_rules: rules })
      await qc.invalidateQueries({ queryKey: ['tournaments'] })
      setOpen(false)
      setRules(DEFAULT_RULES)
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create')
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-[#f0b429] text-[#080c14] py-3 rounded-2xl font-bold text-sm uppercase tracking-wider hover:bg-white transition-all flex items-center justify-center gap-2"
      >
        + New League
      </button>
    )
  }

  return (
    <div className="bg-[#0f1620] border border-[#f0b429]/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#f0b429]">New League</p>
        <button onClick={() => setOpen(false)} className="text-[#475569] hover:text-white text-sm transition-colors">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          required
          placeholder="League name (e.g. Office Cup 2026)"
          className="w-full bg-[#080c14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
        />

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#64748b]">Scoring Rules (pts)</p>
          {(Object.keys(RULE_LABELS) as Array<keyof typeof rules>).map(key => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{RULE_LABELS[key].icon}</span>
                <span className="text-sm text-[#94a3b8]">{RULE_LABELS[key].label}</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setRules(r => ({ ...r, [key]: Math.max(0, r[key] - 1) }))}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition flex items-center justify-center text-sm">−</button>
                <span className="w-8 text-center font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-lg tabular-nums">{rules[key]}</span>
                <button type="button" onClick={() => setRules(r => ({ ...r, [key]: Math.min(99, r[key] + 1) }))}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition flex items-center justify-center text-sm">+</button>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full bg-[#f0b429] text-[#080c14] py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white disabled:opacity-50 transition-all">
          {loading ? 'Creating…' : '🏆 Create League'}
        </button>
      </form>
    </div>
  )
}

// ── League card ───────────────────────────────────────────────────────────────

function LeagueCard({ t, currentUserId }: { t: Tournament; currentUserId: string | undefined }) {
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTournament(t.invite_code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tournaments'] }),
  })

  function copyInvite() {
    navigator.clipboard.writeText(t.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isOwner = t.created_by === currentUserId

  return (
    <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-[family-name:var(--font-oswald)] font-bold text-white uppercase tracking-wide text-lg leading-tight truncate">
              {t.name}
            </h3>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              t.is_active ? 'bg-[#f0b429]/10 text-[#f0b429] border border-[#f0b429]/20' : 'bg-white/5 text-[#475569] border border-white/10'
            }`}>
              {t.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs text-[#475569]">
            Created by <span className="text-[#64748b]">{t.creator?.username}</span>
          </p>
        </div>

        <Link
          href={`/tournaments/${t.invite_code}`}
          className="shrink-0 bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-xl hover:bg-white/10 hover:border-[#f0b429]/30 transition-all"
        >
          View →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Invite code */}
        <button
          onClick={copyInvite}
          className="flex items-center gap-2 bg-[#080c14] border border-white/10 rounded-xl px-3 py-1.5 hover:border-[#f0b429]/30 transition-colors group"
        >
          <span className="font-mono text-xs text-[#64748b] tracking-wider">{t.invite_code}</span>
          <span className={`text-[10px] transition-colors ${copied ? 'text-green-400' : 'text-[#475569] group-hover:text-[#f0b429]'}`}>
            {copied ? '✓ copied' : 'copy'}
          </span>
        </button>

        {/* Delete (owner only) */}
        {isOwner && (
          confirmDelete ? (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-[#64748b]">Delete?</span>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? '…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-[#475569] hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="ml-auto text-xs text-[#334155] hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeaguesPage() {
  const qc = useQueryClient()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: api.listTournaments,
  })

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-xs text-[#475569] hover:text-[#f0b429] transition-colors block mb-1">
            ← Dashboard
          </Link>
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
            My Leagues
          </h1>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 mb-8">
        <CreatePanel onCreated={() => qc.invalidateQueries({ queryKey: ['tournaments'] })} />
        <JoinPanel onJoined={() => qc.invalidateQueries({ queryKey: ['tournaments'] })} />
      </div>

      {/* League list */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-3">
          {tournaments.length > 0 ? `${tournaments.length} League${tournaments.length > 1 ? 's' : ''}` : 'Your Leagues'}
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2].map(i => (
              <div key={i} className="animate-pulse bg-[#0f1620] border border-white/10 rounded-2xl p-5 h-24" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-10 text-center">
            <p className="text-4xl mb-3">🏟️</p>
            <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-white mb-1">No leagues yet</p>
            <p className="text-sm text-[#64748b]">Create one above or join with an invite code.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map(t => (
              <LeagueCard key={t.id} t={t} currentUserId={me?.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
