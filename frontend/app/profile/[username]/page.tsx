'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { api } from '@/lib/api'
import type { PredictionHistoryItem } from '@/types/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { formatMatchDate } from '@/lib/date'
import { setLocaleCookie, type SupportedLocale } from '@/lib/locale'
import { useLocale, useTranslations } from 'next-intl'
import { translateTeamName } from '@/lib/flags'

function Avatar({ name }: { name: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div
      className="flex items-center justify-center rounded-full font-[family-name:var(--font-oswald)] font-bold text-3xl uppercase select-none"
      style={{
        width: 72,
        height: 72,
        background: 'linear-gradient(135deg, rgba(240,180,41,0.25) 0%, rgba(240,180,41,0.08) 100%)',
        border: '2px solid rgba(240,180,41,0.4)',
        color: '#f0b429',
      }}
    >
      {letter}
    </div>
  )
}

function PredictionRow({ item, timezone }: { item: PredictionHistoryItem; timezone?: string | null }) {
  const t = useTranslations('profile')
  const locale = useLocale()
  const hasResult = item.actual_home !== null && item.actual_away !== null
  const pts = item.points_awarded

  let statusColor = 'rgba(255,255,255,0.15)'
  let statusLabel = hasResult ? t('zero_pts') : t('pending')
  if (pts !== null && pts !== undefined) {
    statusLabel = `+${pts} ${t('pts_short')}`
    statusColor = pts > 0 ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.1)'
  }

  const kickoff = formatMatchDate(item.kickoff_at, timezone, locale)
  const homeTeam = translateTeamName(item.home_team, locale)
  const awayTeam = translateTeamName(item.away_team, locale)

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-medium truncate">
          {homeTeam} {t('vs')} {awayTeam}
        </p>
        <p className="text-[#4a5c70] text-xs mt-0.5">
          {kickoff} · {t('predicted')}: {item.predicted_home ?? '—'}–{item.predicted_away ?? '—'}
          {hasResult && ` · ${t('result')}: ${item.actual_home}–${item.actual_away}`}
        </p>
      </div>
      <span
        className="ml-4 shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold"
        style={{ background: statusColor, color: pts && pts > 0 ? '#34d399' : '#94a3b8' }}
      >
        {statusLabel}
      </span>
    </div>
  )
}

function EditProfileForm({
  currentUsername,
  currentDisplayName,
  onClose,
}: {
  currentUsername: string
  currentDisplayName: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [username, setUsername] = useState(currentUsername)
  const [displayName, setDisplayName] = useState(currentDisplayName ?? '')
  const [error, setError] = useState('')

  const t = useTranslations('profile')

  const mutation = useMutation({
    mutationFn: () => api.updateMe({ username, display_name: displayName || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['profile', currentUsername] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <div
      className="rounded-2xl p-6 mb-6"
      style={{ background: '#0d1520', border: '1px solid rgba(240,180,41,0.2)' }}
    >
      <h3 className="font-[family-name:var(--font-oswald)] text-lg font-bold uppercase tracking-wider text-white mb-4">
        {t('edit_profile')}
      </h3>
      <div className="space-y-3">
        <div>
          <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: '#5a6a82' }}>
            {t('username')}
          </label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-white text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', outline: 'none' }}
          />
        </div>
        <div>
          <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: '#5a6a82' }}>
            {t('display_name')}
          </label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={t('display_name_optional')}
            className="w-full rounded-xl px-4 py-2.5 text-white text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', outline: 'none' }}
          />
        </div>
        {error && (
          <p className="text-red-400 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(244,63,94,0.08)' }}>
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50"
            style={{ background: '#f0b429', color: '#080c14' }}
          >
            {mutation.isPending ? t('saving') : t('save')}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7f96' }}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Brazilian timezones shown first in the preferences dropdown
const BRAZIL_TZ = ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Recife', 'America/Bahia', 'America/Cuiaba', 'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco', 'America/Noronha']
const OTHER_TZ = ['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Lisbon', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto', 'America/Mexico_City', 'America/Buenos_Aires', 'America/Lima', 'America/Bogota', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland']
const ALL_TZ = [...BRAZIL_TZ, ...OTHER_TZ]

function PreferencesSection({ me, qc, t, router }: {
  me: import('@/types/api').User
  qc: ReturnType<typeof useQueryClient>
  t: ReturnType<typeof useTranslations>
  router: ReturnType<typeof useRouter>
}) {
  const [savingLang, setSavingLang] = useState(false)
  const [savingTz, setSavingTz] = useState(false)

  async function handleLanguageChange(lang: SupportedLocale) {
    setSavingLang(true)
    try {
      await api.updateMe({ language: lang })
      setLocaleCookie(lang)
      qc.invalidateQueries({ queryKey: ['me'] })
      router.refresh()
    } finally {
      setSavingLang(false)
    }
  }

  async function handleTimezoneChange(tz: string) {
    setSavingTz(true)
    try {
      await api.updateMe({ timezone: tz })
      qc.invalidateQueries({ queryKey: ['me'] })
      router.refresh()
    } finally {
      setSavingTz(false)
    }
  }

  return (
    <div className="rounded-2xl p-5 mb-6" style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}>
      <h3 className="font-[family-name:var(--font-oswald)] text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: '#5a6a82' }}>
        {t('preferences')}
      </h3>
      <div className="space-y-4">
        {/* Language */}
        <div>
          <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#5a6a82' }}>
            {t('language')}
          </label>
          <div className="flex gap-2">
            {(['en', 'pt'] as SupportedLocale[]).map(lang => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                disabled={savingLang}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                style={me.language === lang
                  ? { background: '#f0b429', color: '#080c14' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#7a8fa8' }
                }
              >
                {lang === 'en' ? t('language_en') : t('language_pt')}
              </button>
            ))}
          </div>
        </div>
        {/* Timezone */}
        <div>
          <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#5a6a82' }}>
            {t('timezone')}
          </label>
          <select
            value={me.timezone ?? ''}
            onChange={e => handleTimezoneChange(e.target.value)}
            disabled={savingTz}
            className="w-full rounded-xl px-3 py-2 text-white text-xs disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', outline: 'none' }}
          >
            {ALL_TZ.map(tz => (
              <option key={tz} value={tz} style={{ background: '#0d1520' }}>{tz}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const t = useTranslations('profile')
  const locale = useLocale()
  const qc = useQueryClient()
  const router = useRouter()
  const { username } = useParams<{ username: string }>()
  const [editing, setEditing] = useState(false)
  const hasToken = typeof window !== 'undefined' && !!Cookies.get('is_authenticated')

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    enabled: hasToken,
    retry: false,
  })
  useOnboardingGuard(me, meLoading)

  const { data: profile, isLoading: profileLoading, isError: profileError } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.getUserProfile(username),
    retry: false,
  })

  const { data: predictions, isLoading: predsLoading } = useQuery({
    queryKey: ['profile-predictions', username],
    queryFn: () => api.getUserPredictions(username),
    retry: false,
    enabled: !!profile,
  })

  const isOwnProfile = me?.username === username

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[88vh]">
        <p className="text-[#64748b] text-sm animate-pulse">{t('loading')}</p>
      </div>
    )
  }

  if (profileError || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[88vh] px-4">
        <div className="text-center max-w-sm">
          <span className="text-5xl">👤</span>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white mt-4">
            {t('not_found_title')}
          </h1>
          <p className="text-[#64748b] text-sm mt-2">
            {t('not_found_desc')}
          </p>
        </div>
      </div>
    )
  }

  const displayName = profile.display_name ?? profile.username
  const memberSince = new Date(profile.created_at).toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <Avatar name={displayName} />
        <div className="flex-1 min-w-0">
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white leading-tight">
            {displayName}
          </h1>
          {profile.display_name && (
            <p className="text-[#4a5c70] text-sm mt-0.5">@{profile.username}</p>
          )}
          <p className="text-[#3f5068] text-xs mt-1">{t('member_since')} {memberSince}</p>
        </div>
        {isOwnProfile && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7f96' }}
          >
            {t('edit')}
          </button>
        )}
      </div>

      {/* Edit form */}
      {isOwnProfile && editing && (
        <EditProfileForm
          currentUsername={profile.username}
          currentDisplayName={profile.display_name}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Stats */}
      <div
        className="grid grid-cols-2 gap-3 mb-8"
      >
        {[
          { label: t('tournaments_played'), value: profile.tournaments_count },
          { label: t('total_points'), value: profile.total_points },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-xl px-4 py-4 text-center"
            style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p
              className="font-[family-name:var(--font-oswald)] text-3xl font-bold"
              style={{ color: '#f0b429' }}
            >
              {stat.value}
            </p>
            <p className="text-[#4a5c70] text-xs uppercase tracking-widest mt-1 font-semibold">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Preferences — own profile only */}
      {isOwnProfile && me && (
        <PreferencesSection me={me} qc={qc} t={t} router={router} />
      )}

      {/* Divider */}
      <div className="h-px mb-6" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Prediction history */}
      <h2 className="font-[family-name:var(--font-oswald)] text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: '#5a6a82' }}>
        {t('prediction_history')}
      </h2>

      {predsLoading ? (
        <p className="text-[#3f5068] text-sm animate-pulse">{t('loading_predictions')}</p>
      ) : predictions && predictions.length > 0 ? (
        <div className="space-y-2">
          {predictions.map(item => (
            <PredictionRow key={item.match_id} item={item} timezone={me?.timezone} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl px-4 py-8 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="text-[#3f5068] text-sm">{t('no_predictions')}</p>
        </div>
      )}
    </div>
  )
}
