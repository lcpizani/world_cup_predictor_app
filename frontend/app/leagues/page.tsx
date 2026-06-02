'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Tournament } from '@/types/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { encodeInviteCode } from '@/lib/invite'
import { useTranslations } from 'next-intl'

// ── Scoring rules ─────────────────────────────────────────────────────────────

const RULE_KEYS: Array<keyof typeof DEFAULT_RULES> = [
  'correct_result_pts',
  'correct_winner_pts',
  'correct_goal_diff_pts',
  'correct_goals_one_team_pts',
]

const DEFAULT_RULES = {
  correct_result_pts: 5,
  correct_winner_pts: 3,
  correct_goal_diff_pts: 2,
  correct_goals_one_team_pts: 1,
}

// ── Late-join warning modal ───────────────────────────────────────────────────

function LateJoinWarningModal({ onConfirm, onCancel }: {
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useTranslations('leagues')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-7"
        style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <div className="h-px w-full mb-6 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(240,180,41,0.6), transparent)' }} />

        <div className="flex justify-center mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.2)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f0b429" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2.5" />
              <path d="M9.5 2.5h5" />
              <path d="M12 2.5v2" />
            </svg>
          </div>
        </div>

        <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold uppercase tracking-wider text-white text-center leading-snug mb-4">
          {t('late_join_title')}
        </h2>

        <p className="text-[#7a8fa8] text-sm text-center leading-relaxed mb-2">
          {t('late_join_desc')}
        </p>
        <p className="text-[#3f5068] text-xs text-center leading-relaxed mb-7">
          {t('late_join_note')}
        </p>

        <div className="space-y-2.5">
          <button
            onClick={onConfirm}
            className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200"
            style={{ background: '#f0b429', color: '#080c14' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fcd86e' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f0b429' }}
          >
            {t('join_anyway')}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#94a3b8' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Join panel ────────────────────────────────────────────────────────────────

function JoinPanel({ onJoined }: { onJoined: () => void }) {
  const t = useTranslations('leagues')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [pendingCode, setPendingCode] = useState('')

  const mutation = useMutation({
    mutationFn: (c: string) => api.joinTournament(c),
    onSuccess: () => { setCode(''); setError(''); setShowWarning(false); onJoined() },
    onError: (err: Error) => { setError(err.message); setShowWarning(false) },
  })

  async function handleJoinClick() {
    if (!code) return
    setError('')
    setChecking(true)
    try {
      const res = await fetch('/api/proxy/matches?match_status=finished')
      const matches = res.ok ? await res.json() as unknown[] : []
      if (matches.length > 0) {
        setPendingCode(code)
        setShowWarning(true)
      } else {
        mutation.mutate(code)
      }
    } catch {
      mutation.mutate(code)
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      {showWarning && (
        <LateJoinWarningModal
          onConfirm={() => mutation.mutate(pendingCode)}
          onCancel={() => setShowWarning(false)}
        />
      )}
      <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] mb-3" style={{ color: '#5a6a82' }}>
          {t('join_by_code')}
        </p>
        <div className="flex gap-2.5">
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && code && handleJoinClick()}
            placeholder={t('code_placeholder')}
            className="flex-1 min-w-0 rounded-xl px-4 py-2.5 text-white text-sm font-mono tracking-wider transition-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.09)',
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(240,180,41,0.08)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none' }}
          />
          <button
            onClick={handleJoinClick}
            disabled={!code || mutation.isPending || checking}
            className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all duration-200 disabled:opacity-40"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)' }}
          >
            {mutation.isPending || checking ? '…' : t('join')}
          </button>
        </div>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </div>
    </>
  )
}

// ── Create panel ──────────────────────────────────────────────────────────────

function CreatePanel({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('leagues')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState(DEFAULT_RULES)
  const qc = useQueryClient()

  const ruleLabels: Record<string, string> = {
    correct_result_pts: t('exact_score'),
    correct_winner_pts: t('correct_winner'),
    correct_goal_diff_pts: t('correct_goal_diff'),
    correct_goals_one_team_pts: t('one_team_score'),
  }

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
      setError(err instanceof Error ? err.message : t('failed_to_create'))
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2"
        style={{ background: '#f0b429', color: '#080c14' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fcd86e' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f0b429' }}
      >
        {t('new_league')}
      </button>
    )
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: '#0d1520', border: '1px solid rgba(240,180,41,0.22)' }}>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#f0b429]">{t('new_league_label')}</p>
        <button onClick={() => setOpen(false)} className="text-[#3f5068] hover:text-white text-sm transition-colors">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          required
          placeholder={t('league_name_placeholder')}
          className="w-full rounded-xl px-4 py-3 text-white text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.09)',
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(240,180,41,0.08)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none' }}
        />

        <div className="space-y-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em]" style={{ color: '#5a6a82' }}>
            {t('scoring_rules')}
          </p>
          {RULE_KEYS.map(key => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: '#8496af' }}>{ruleLabels[key]}</span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setRules(r => ({ ...r, [key]: Math.max(0, r[key] - 1) }))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                >
                  −
                </button>
                <span className="w-8 text-center font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-lg tabular-nums">{rules[key]}</span>
                <button
                  type="button"
                  onClick={() => setRules(r => ({ ...r, [key]: Math.min(99, r[key] + 1) }))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-400 rounded-xl px-4 py-2.5" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200 disabled:opacity-50"
          style={{ background: '#f0b429', color: '#080c14' }}
          onMouseEnter={e => !loading && ((e.currentTarget as HTMLElement).style.background = '#fcd86e')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#f0b429')}
        >
          {loading ? t('creating') : t('create_league')}
        </button>
      </form>
    </div>
  )
}

// ── League card ───────────────────────────────────────────────────────────────

function LeagueCard({ tournament, currentUserId }: { tournament: Tournament; currentUserId: string | undefined }) {
  const tl = useTranslations('leagues')
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTournament(tournament.invite_code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tournaments'] }),
  })

  function copyInvite() {
    const url = `${window.location.origin}/join/${encodeInviteCode(tournament.invite_code)}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isOwner = tournament.created_by === currentUserId

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200"
      style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-[family-name:var(--font-oswald)] font-bold text-white uppercase tracking-wide text-lg leading-tight truncate">
              {tournament.name}
            </h3>
            <span
              className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={tournament.is_active
                ? { color: '#f0b429', background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.2)' }
                : { color: '#3f5068', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >
              {tournament.is_active ? tl('active') : tl('inactive')}
            </span>
          </div>
          <p className="text-xs" style={{ color: '#3f5068' }}>
            {tl('created_by')} <span style={{ color: '#5a6a82' }}>{tournament.creator?.username}</span>
          </p>
        </div>

        <Link
          href={`/tournaments/${tournament.invite_code}`}
          className="shrink-0 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-xl transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'white',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(240,180,41,0.1)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,180,41,0.25)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'
          }}
        >
          {tl('view')}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={copyInvite}
          className="flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all duration-200"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,180,41,0.2)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
        >
          <span className="text-xs font-medium" style={{ color: '#5a6a82' }}>
            {copied ? tl('copied') : tl('copy_invite')}
          </span>
        </button>

        {isOwner && (
          confirmDelete ? (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs" style={{ color: '#5a6a82' }}>{tl('delete_confirm')}</span>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? '…' : tl('delete')}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs transition-colors" style={{ color: '#3f5068' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3f5068' }}
              >
                {tl('cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="ml-auto text-xs transition-colors"
              style={{ color: '#2d3e52' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#2d3e52' }}
            >
              {tl('delete')}
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeaguesPage() {
  const t = useTranslations('leagues')
  const qc = useQueryClient()
  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useOnboardingGuard(me, meLoading)
  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: api.listTournaments,
  })

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-7">
        <Link href="/dashboard" className="text-xs font-medium transition-colors block mb-1.5" style={{ color: '#3f5068' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f0b429' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3f5068' }}
        >
          {t('back_dashboard')}
        </Link>
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white leading-none">
          {t('title')}
        </h1>
      </div>

      {/* Actions */}
      <div className="space-y-3 mb-8">
        <CreatePanel onCreated={() => qc.invalidateQueries({ queryKey: ['tournaments'] })} />
        <JoinPanel onJoined={() => qc.invalidateQueries({ queryKey: ['tournaments'] })} />
      </div>

      {/* League list */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="block w-0.5 h-3.5 rounded-full" style={{ background: 'rgba(240,180,41,0.7)' }} />
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em]" style={{ color: '#5a6a82' }}>
            {tournaments.length > 0 ? `${tournaments.length} ${tournaments.length > 1 ? t('league_plural') : t('league_singular')}` : t('your_leagues')}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2].map(i => (
              <div key={i} className="animate-pulse rounded-2xl p-5 h-24" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }} />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-white mb-1">{t('no_leagues_title')}</p>
            <p className="text-sm" style={{ color: '#3f5068' }}>{t('no_leagues_desc')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map(tour => (
              <LeagueCard key={tour.id} tournament={tour} currentUserId={me?.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
