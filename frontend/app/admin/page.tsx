'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import type { Match, Tournament } from '@/types/api'
import { encodeInviteCode } from '@/lib/invite'

const STAGES = [
  'group_stage',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'third_place',
  'final',
]

// ── Reset all matches ────────────────────────────────────────────────────────

function ResetMatchesButton({ matchCount }: { matchCount: number }) {
  const t = useTranslations('admin')
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState('')

  const mutation = useMutation({
    // Echo the current match count so a stale/blind call is rejected server-side.
    mutationFn: () => api.resetAllMatches(matchCount),
    onSuccess: () => {
      setConfirm(false)
      setMsg(t('reset_success'))
      qc.invalidateQueries({ queryKey: ['matches'] })
      qc.invalidateQueries({ queryKey: ['tournaments'] })
    },
    onError: (e: Error) => {
      // In production ALLOW_ADMIN_MATCH_UPDATES is false → backend returns 403.
      setConfirm(false)
      setMsg(
        /disabled in this environment/i.test(e.message)
          ? t('reset_disabled')
          : e.message,
      )
    },
  })

  return (
    <div>
      <p className="text-sm text-[#64748b] mb-4">
        {t('reset_desc')}
      </p>
      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-red-500/20 transition"
        >
          {t('reset_button')}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm text-red-400 font-semibold">{t('reset_confirm')}</span>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-red-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-red-600 disabled:opacity-50 transition"
          >
            {mutation.isPending ? t('resetting') : t('yes_reset')}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-[#64748b] hover:text-white text-xs font-bold uppercase tracking-wide transition"
          >
            {t('cancel')}
          </button>
        </div>
      )}
      {msg && <p className="text-xs text-[#64748b] mt-3">{msg}</p>}
    </div>
  )
}

// ── Create match form ────────────────────────────────────────────────────────

function CreateMatchForm() {
  const t = useTranslations('admin')
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
          <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5">{t('home_team')}</label>
          <input
            value={home}
            onChange={(e) => setHome(e.target.value)}
            placeholder="Brazil"
            className="w-full bg-[#080c14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5">{t('away_team')}</label>
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
          <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5">{t('kickoff')}</label>
          <input
            type="datetime-local"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            className="w-full bg-[#080c14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5">{t('stage')}</label>
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
          {mutation.isPending ? t('creating') : t('add_match')}
        </button>
        {mutation.isSuccess && <span className="text-xs text-green-400">{t('match_created')}</span>}
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
  const t = useTranslations('admin')
  const qc = useQueryClient()
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [err, setErr] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const h = parseInt(home, 10)
      const a = parseInt(away, 10)
      if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) {
        throw new Error(t('scores_non_negative'))
      }
      return api.applyResult(match.id, h, a)
    },
    onSuccess: () => {
      setErr('')
      qc.invalidateQueries({ queryKey: ['matches'] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  if (mutation.isSuccess) {
    return <span className="text-sm text-green-400">{t('result_applied')}</span>
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
        {mutation.isPending ? '…' : t('apply')}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  )
}

// ── Recompute button ─────────────────────────────────────────────────────────

function RecomputeButton({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations('admin')
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
        {mutation.isPending ? t('recomputing') : t('recompute')}
      </button>
    </div>
  )
}

// ── Registration invite card ─────────────────────────────────────────────────

function RegistrationInviteCard() {
  const t = useTranslations('admin')
  const [copied, setCopied] = useState(false)
  const { data } = useQuery({
    queryKey: ['registration-invite'],
    queryFn: api.getRegistrationInvite,
  })

  const inviteCode = data?.invite_code ?? ''
  const regUrl = inviteCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/register?invite=${encodeInviteCode(inviteCode)}`
    : ''

  function copyLink() {
    if (!regUrl) return
    navigator.clipboard.writeText(regUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (!inviteCode) {
    return (
      <p className="text-sm text-[#475569]">
        {t('no_invite_env_pre')} <code className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded">INVITE_CODE</code> {t('no_invite_env_post')}
      </p>
    )
  }

  return (
    <div>
      <p className="text-sm text-[#64748b] mb-3">
        {t('registration_share_desc')}
      </p>
      <div className="flex items-center gap-2">
        <span
          className="flex-1 font-mono text-xs truncate rounded-lg px-3 py-2"
          style={{ background: '#080c14', border: '1px solid rgba(255,255,255,0.06)', color: '#475569' }}
        >
          {regUrl}
        </span>
        <button
          onClick={copyLink}
          className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all"
          style={{
            background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(240,180,41,0.1)',
            border: copied ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(240,180,41,0.25)',
            color: copied ? '#34d399' : '#f0b429',
          }}
        >
          {copied ? t('copied') : t('copy_link')}
        </button>
      </div>
    </div>
  )
}

// ── Tournament invite link row ───────────────────────────────────────────────

function TournamentInviteRow({ tournament }: { tournament: Tournament }) {
  const t = useTranslations('admin')
  const [copied, setCopied] = useState(false)

  function copyLink() {
    const url = `${window.location.origin}/join/${encodeInviteCode(tournament.invite_code)}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${encodeInviteCode(tournament.invite_code)}`
    : `/join/${encodeInviteCode(tournament.invite_code)}`

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <p className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-sm mb-2">
        {tournament.name}
      </p>
      <div className="flex items-center gap-2">
        <span
          className="flex-1 font-mono text-xs truncate rounded-lg px-3 py-2"
          style={{ background: '#080c14', border: '1px solid rgba(255,255,255,0.06)', color: '#475569' }}
        >
          {joinUrl}
        </span>
        <button
          onClick={copyLink}
          className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all"
          style={{
            background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(240,180,41,0.1)',
            border: copied ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(240,180,41,0.25)',
            color: copied ? '#34d399' : '#f0b429',
          }}
        >
          {copied ? t('copied') : t('copy_link')}
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const RESULTS_PAGE_SIZE = 5

export default function AdminPage() {
  const t = useTranslations('admin')
  const qc = useQueryClient()
  const [competitionCode, setCompetitionCode] = useState('WC')
  const [syncMsg, setSyncMsg] = useState('')
  const [resultsPage, setResultsPage] = useState(0)

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.listMatches(),
  })

  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: api.listTournaments,
  })

  const unfinished = matches.filter((m) => m.status !== 'finished')
  const totalResultPages = Math.ceil(unfinished.length / RESULTS_PAGE_SIZE)
  const pagedMatches = unfinished.slice(
    resultsPage * RESULTS_PAGE_SIZE,
    (resultsPage + 1) * RESULTS_PAGE_SIZE,
  )

  async function sync(type: 'matches' | 'results' | 'standings') {
    setSyncMsg(t('syncing'))
    try {
      const result =
        type === 'matches'
          ? await api.syncMatches(competitionCode)
          : type === 'results'
          ? await api.syncResults(competitionCode)
          : await api.syncStandings()
      setSyncMsg(JSON.stringify(result))
      qc.invalidateQueries({ queryKey: ['matches'] })
      if (type === 'standings') qc.invalidateQueries({ queryKey: ['standings'] })
    } catch (e: unknown) {
      setSyncMsg(`${t('error_label')}: ${e instanceof Error ? e.message : t('unknown_error')}`)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">

      {/* Title */}
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
          {t('panel_title')}
        </h1>
        <p className="text-[#64748b] text-sm mt-1">{t('panel_subtitle')}</p>
      </div>

      {/* Registration invite */}
      <AdminCard title={t('card_registration')} icon="🔑">
        <RegistrationInviteCard />
      </AdminCard>

      {/* Danger zone */}
      <AdminCard title={t('card_danger')} icon="⚠️">
        <ResetMatchesButton matchCount={matches.length} />
      </AdminCard>

      {/* Create match */}
      <AdminCard title={t('card_create_match')} icon="➕">
        <CreateMatchForm />
      </AdminCard>

      {/* Sync */}
      <AdminCard title={t('card_sync')} icon="🔄">
        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs font-bold uppercase tracking-widest text-[#64748b]">
            {t('competition_code')}
          </label>
          <input
            value={competitionCode}
            onChange={(e) => setCompetitionCode(e.target.value.toUpperCase())}
            className="w-20 bg-[#080c14] border border-white/10 rounded-xl px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition font-mono tracking-widest"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => sync('matches')}
            className="bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white/10 transition"
          >
            {t('sync_fixtures')}
          </button>
          <button
            onClick={() => sync('results')}
            className="bg-[#f0b429] text-[#080c14] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white transition"
          >
            {t('sync_results')}
          </button>
          <button
            onClick={() => sync('standings')}
            className="bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white/10 transition"
          >
            {t('sync_standings')}
          </button>
        </div>
        {syncMsg && (
          <p className="mt-4 text-xs text-[#94a3b8] font-mono bg-[#080c14] rounded-xl p-3 border border-white/5 break-all">
            {syncMsg}
          </p>
        )}
      </AdminCard>

      {/* Apply results manually */}
      <AdminCard title={t('card_apply_result')} icon="⚽">
        {unfinished.length === 0 ? (
          <p className="text-sm text-[#475569]">{t('all_finished')}</p>
        ) : (
          <>
            <div className="divide-y divide-white/5">
              {pagedMatches.map((m) => (
                <div key={m.id} className="py-4 first:pt-0 last:pb-0">
                  <p className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide">
                    {m.home_team} <span className="text-[#475569]">{t('vs')}</span> {m.away_team}
                  </p>
                  <p className="text-xs text-[#475569] font-mono mt-0.5 mb-2">
                    {new Date(m.kickoff_at).toLocaleString()} · {m.status}
                  </p>
                  <ApplyResultForm match={m} />
                </div>
              ))}
            </div>
            {totalResultPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                <button
                  onClick={() => setResultsPage((p) => Math.max(0, p - 1))}
                  disabled={resultsPage === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border border-white/10 text-[#64748b] hover:text-white hover:border-white/20 disabled:opacity-30 transition"
                >
                  {t('prev')}
                </button>
                <span className="text-xs text-[#475569] font-mono">
                  {resultsPage + 1} / {totalResultPages}
                  <span className="ml-2 text-[#334155]">{t('matches_count', { count: unfinished.length })}</span>
                </span>
                <button
                  onClick={() => setResultsPage((p) => Math.min(totalResultPages - 1, p + 1))}
                  disabled={resultsPage === totalResultPages - 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border border-white/10 text-[#64748b] hover:text-white hover:border-white/20 disabled:opacity-30 transition"
                >
                  {t('next')}
                </button>
              </div>
            )}
          </>
        )}
      </AdminCard>

      {/* Invite links */}
      <AdminCard title={t('card_invite_links')} icon="🔗">
        {tournaments.length === 0 ? (
          <p className="text-sm text-[#475569]">{t('no_tournaments')}</p>
        ) : (
          <div className="divide-y divide-white/5">
            {tournaments.map((tournament) => (
              <TournamentInviteRow key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}
      </AdminCard>

      {/* Recompute */}
      <AdminCard title={t('card_recompute')} icon="🧮">
        {tournaments.length === 0 ? (
          <p className="text-sm text-[#475569]">{t('no_tournaments')}</p>
        ) : (
          <div className="divide-y divide-white/5">
            {tournaments.map((tournament) => (
              <div key={tournament.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <span className="font-[family-name:var(--font-oswald)] font-semibold text-white uppercase tracking-wide text-sm">
                  {tournament.name}
                </span>
                <RecomputeButton tournamentId={tournament.id} />
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
