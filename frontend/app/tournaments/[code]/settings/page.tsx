'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useTranslations } from 'next-intl'
import { useOnboardingGuard } from '@/lib/hooks'

const STAGE_ORDER = ['group_stage', 'round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final']
const KNOCKOUT_STAGES = new Set(STAGE_ORDER.slice(1))

const RULE_META: Record<string, { key: string; icon: string }> = {
  correct_result_pts:         { key: 'exact_score',       icon: '🎯' },
  correct_winner_pts:         { key: 'correct_winner',    icon: '🏆' },
  correct_goal_diff_pts:      { key: 'correct_goal_diff', icon: '⚖️' },
  correct_goals_one_team_pts: { key: 'one_team_score',    icon: '⚽' },
}

const DOUBLE_STAGE_OPTIONS: { value: string | null; labelKey: string }[] = [
  { value: null,             labelKey: 'double_stage_off' },
  { value: 'round_of_32',    labelKey: 'double_stage_round_of_32' },
  { value: 'round_of_16',    labelKey: 'double_stage_round_of_16' },
  { value: 'quarter_finals', labelKey: 'double_stage_quarter_finals' },
  { value: 'semi_finals',    labelKey: 'double_stage_semi_finals' },
  { value: 'final',          labelKey: 'double_stage_final' },
]

type Rules = {
  correct_result_pts: number
  correct_winner_pts: number
  correct_goal_diff_pts: number
  correct_goals_one_team_pts: number
}

export default function LeagueSettingsPage() {
  const t = useTranslations('leagueSettings')
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: () => api.getMe() })
  useOnboardingGuard(me, meLoading)

  const { data: tournament } = useQuery({
    queryKey: ['tournament', code],
    queryFn: () => api.getTournament(code),
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', code],
    queryFn: () => api.getMembers(code),
  })

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.listMatches(),
  })

  const isCreator = !!me && !!tournament && me.id === tournament.created_by
  const scoringLocked = matches.some((m) => KNOCKOUT_STAGES.has(m.stage) && m.status === 'finished')

  const [name, setName] = useState('')
  const [rules, setRules] = useState<Rules>({
    correct_result_pts: 0,
    correct_winner_pts: 0,
    correct_goal_diff_pts: 0,
    correct_goals_one_team_pts: 0,
  })
  const [doubleFromStage, setDoubleFromStage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved] = useState(false)

  // Hydrate the form once the tournament loads
  useEffect(() => {
    if (!tournament) return
    setName(tournament.name)
    const s = tournament.scoring_rules
    setRules({
      correct_result_pts: s.correct_result_pts,
      correct_winner_pts: s.correct_winner_pts,
      correct_goal_diff_pts: s.correct_goal_diff_pts,
      correct_goals_one_team_pts: s.correct_goals_one_team_pts,
    })
    setDoubleFromStage(s.double_points_from_stage ?? null)
  }, [tournament])

  // Redirect non-creators away
  useEffect(() => {
    if (me && tournament && me.id !== tournament.created_by) {
      router.replace(`/tournaments/${code}`)
    }
  }, [me, tournament, code, router])

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateTournament(code, {
        name,
        ...(scoringLocked
          ? {}
          : { scoring_rules: { ...rules, double_points_from_stage: doubleFromStage } }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tournament', code] })
      await qc.invalidateQueries({ queryKey: ['tournaments'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.removeMember(code, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', code] }),
    onError: (err: Error) => alert(err.message),
  })

  const transferMutation = useMutation({
    mutationFn: (userId: string) => api.transferOwnership(code, userId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tournament', code] })
      await qc.invalidateQueries({ queryKey: ['members', code] })
      router.push(`/tournaments/${code}`)
    },
    onError: (err: Error) => alert(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTournament(code),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tournaments'] })
      qc.removeQueries({ queryKey: ['tournament', code] })
      router.push('/dashboard')
    },
    onError: (err: Error) => {
      setConfirmDelete(false)
      alert(err.message)
    },
  })

  if (!isCreator) {
    return <div className="max-w-lg mx-auto px-6 py-10" />
  }

  const sectionLabel = "block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-3"
  const card = "bg-[#0f1620] border border-white/10 rounded-2xl p-5"

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <Link
        href={`/tournaments/${code}`}
        className="inline-flex items-center gap-2 text-[#64748b] hover:text-white text-sm mb-8 transition-colors"
      >
        {t('back')}
      </Link>

      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
          {t('title')}
        </h1>
        <p className="text-[#64748b] text-sm mt-1">{t('subtitle')}</p>
      </div>

      <div className="space-y-6">
        {/* League name */}
        <div className={card}>
          <label className={sectionLabel}>{t('name_section')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('name_placeholder')}
            className="w-full bg-[#080c14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
          />
        </div>

        {/* Scoring rules */}
        <div className={card}>
          <p className={sectionLabel}>{t('scoring_section')}</p>

          {scoringLocked && (
            <div className="flex items-center gap-2 py-2 px-3 mb-4 rounded-xl text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#3f5068' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {t('scoring_locked')}
            </div>
          )}

          <div className={`space-y-3 ${scoringLocked ? 'opacity-50 pointer-events-none' : ''}`}>
            {(Object.keys(RULE_META) as Array<keyof Rules>).map((key) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 flex-1">
                  <span className="text-base">{RULE_META[key].icon}</span>
                  <span className="text-sm text-[#94a3b8]">{t(RULE_META[key].key)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRules((r) => ({ ...r, [key]: Math.max(0, r[key] - 1) }))}
                    className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-lg tabular-nums">
                    {rules[key]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRules((r) => ({ ...r, [key]: Math.min(99, r[key] + 1) }))}
                    className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <div className="pt-3 mt-1 border-t border-white/5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 flex-1">
                  <span className="text-base">2×</span>
                  <span className="text-sm text-[#94a3b8]">{t('double_points_from')}</span>
                </div>
                <select
                  value={doubleFromStage ?? ''}
                  onChange={(e) => setDoubleFromStage(e.target.value || null)}
                  className="bg-[#080c14] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#f0b429]/50 transition"
                >
                  {DOUBLE_STAGE_OPTIONS.map((opt) => (
                    <option key={opt.value ?? 'off'} value={opt.value ?? ''}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div>
          {saveMutation.isError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-3">
              {t('save_failed')}
            </p>
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim()}
            className="w-full bg-[#f0b429] text-[#080c14] py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white disabled:opacity-50 transition-all"
          >
            {saveMutation.isPending ? t('saving') : saved ? t('saved') : t('save')}
          </button>
        </div>

        {/* Members */}
        <div className={card}>
          <p className={sectionLabel}>{t('members_section')}</p>
          <div className="space-y-2">
            {members.map((m) => {
              const isOwner = tournament && m.user_id === tournament.created_by
              const isSelf = me && m.user_id === me.id
              const displayName = m.user.display_name || m.user.username
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-white truncate">{displayName}</span>
                    {isOwner && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ color: '#f0b429', background: 'rgba(240,180,41,0.1)' }}>
                        {t('creator_badge')}
                      </span>
                    )}
                    {isSelf && !isOwner && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ color: '#5a6a82', background: 'rgba(255,255,255,0.05)' }}>
                        {t('you_badge')}
                      </span>
                    )}
                  </div>
                  {!isOwner && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          if (confirm(t('make_owner_confirm', { name: displayName }))) transferMutation.mutate(m.user_id)
                        }}
                        disabled={transferMutation.isPending}
                        className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
                        style={{ color: '#f0b429', background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)' }}
                      >
                        {t('make_owner')}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(t('remove_confirm', { name: displayName }))) removeMutation.mutate(m.user_id)
                        }}
                        disabled={removeMutation.isPending}
                        className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
                        style={{ color: '#f87171', background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.18)' }}
                      >
                        {t('remove')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.18)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#f87171' }}>
            {t('danger_section')}
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide px-4 py-2.5 rounded-xl transition-all duration-200"
              style={{ color: '#f87171', background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.18)' }}
            >
              {t('delete_competition')}
            </button>
          ) : (
            <div>
              <p className="text-sm text-red-300 font-semibold mb-1">{t('delete_confirm_title')}</p>
              <p className="text-xs mb-4" style={{ color: 'rgba(244,63,94,0.6)' }}>{t('delete_confirm_desc')}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                  style={{ background: '#ef4444', color: 'white' }}
                >
                  {deleteMutation.isPending ? t('deleting') : t('yes_delete')}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#8496af' }}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
