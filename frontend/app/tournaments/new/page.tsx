'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useOnboardingGuard } from '@/lib/hooks'

const RULE_META: Record<string, { key: string; icon: string }> = {
  correct_result_pts:          { key: 'exact_score',       icon: '🎯' },
  correct_winner_pts:          { key: 'correct_winner',    icon: '🏆' },
  correct_goal_diff_pts:       { key: 'correct_goal_diff', icon: '⚖️' },
  correct_goals_one_team_pts:  { key: 'one_team_score',    icon: '⚽' },
}

const DEFAULT_RULES = {
  correct_result_pts: 5,
  correct_winner_pts: 3,
  correct_goal_diff_pts: 2,
  correct_goals_one_team_pts: 1,
}

export default function NewTournamentPage() {
  const t = useTranslations('newLeague')
  const router = useRouter()
  const qc = useQueryClient()
  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useOnboardingGuard(me, meLoading)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState(DEFAULT_RULES)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    try {
      await api.createTournament({
        name: fd.get('name') as string,
        scoring_rules: rules,
      })
      await qc.invalidateQueries({ queryKey: ['tournaments'] })
      router.push('/leagues')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failed'))
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-10">

      {/* Back */}
      <Link
        href="/leagues"
        className="inline-flex items-center gap-2 text-[#64748b] hover:text-white text-sm mb-8 transition-colors"
      >
        {t('back')}
      </Link>

      {/* Title */}
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
          {t('title')}
        </h1>
        <p className="text-[#64748b] text-sm mt-1">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* League name */}
        <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5">
          <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-3">
            {t('league_name')}
          </label>
          <input
            name="name"
            required
            placeholder={t('name_placeholder')}
            className="w-full bg-[#080c14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition"
          />
        </div>

        {/* Scoring rules */}
        <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-4">
            {t('scoring_rules')}
          </p>
          <div className="space-y-3">
            {(Object.keys(RULE_META) as Array<keyof typeof rules>).map((key) => (
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
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#f0b429] text-[#080c14] py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white disabled:opacity-50 transition-all"
        >
          {loading ? t('creating') : t('create')}
        </button>
      </form>
    </div>
  )
}
