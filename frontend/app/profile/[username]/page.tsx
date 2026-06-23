'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { setLocaleCookie, type SupportedLocale } from '@/lib/locale'
import { useLocale, useTranslations } from 'next-intl'

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


function EditProfileForm({
  currentUsername,
  currentDisplayName,
  me,
  onClose,
}: {
  currentUsername: string
  currentDisplayName: string | null
  me: import('@/types/api').User
  onClose: () => void
}) {
  const qc = useQueryClient()
  const router = useRouter()
  const [username, setUsername] = useState(currentUsername)
  const [displayName, setDisplayName] = useState(currentDisplayName ?? '')
  const [language, setLanguage] = useState<SupportedLocale>((me.language as SupportedLocale) ?? 'en')
  const [timezone, setTimezone] = useState(me.timezone ?? 'UTC')
  const [error, setError] = useState('')

  const t = useTranslations('profile')

  const mutation = useMutation({
    mutationFn: () => api.updateMe({ username, display_name: displayName || null, language, timezone }),
    onSuccess: () => {
      const languageChanged = language !== me.language
      const usernameChanged = username !== currentUsername
      if (languageChanged) setLocaleCookie(language)
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['profile', currentUsername] })
      onClose()
      if (usernameChanged) {
        router.replace(`/profile/${username}`)
      } else if (languageChanged) {
        router.refresh()
      }
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
        <div>
          <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: '#5a6a82' }}>
            {t('language')}
          </label>
          <div className="flex gap-2">
            {(['en', 'pt'] as SupportedLocale[]).map(lang => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                style={language === lang
                  ? { background: '#f0b429', color: '#080c14' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#7a8fa8' }
                }
              >
                {lang === 'en' ? t('language_en') : t('language_pt')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: '#5a6a82' }}>
            {t('timezone')}
          </label>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-white text-xs"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', outline: 'none' }}
          >
            {ALL_TZ.map(tz => (
              <option key={tz} value={tz} style={{ background: '#0d1520' }}>{tz}</option>
            ))}
          </select>
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

const BRAZIL_TZ = ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Recife', 'America/Bahia', 'America/Cuiaba', 'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco', 'America/Noronha']
const OTHER_TZ = ['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Lisbon', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto', 'America/Mexico_City', 'America/Buenos_Aires', 'America/Lima', 'America/Bogota', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland']
const ALL_TZ = [...BRAZIL_TZ, ...OTHER_TZ]

export default function ProfilePage() {
  const t = useTranslations('profile')
  const locale = useLocale()
  const { username: rawUsername } = useParams<{ username: string }>()
  const username = decodeURIComponent(rawUsername)
  const [editing, setEditing] = useState(false)

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
  })
  useOnboardingGuard(me, meLoading)

  const { data: profile, isLoading: profileLoading, isError: profileError } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.getUserProfile(username),
    retry: false,
  })

  const { data: predictions } = useQuery({
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

  const finishedPredictions = (predictions ?? []).filter(
    p => p.actual_home !== null && p.actual_away !== null && p.predicted_home !== null && p.predicted_away !== null
  )
  const winnerAccuracy = finishedPredictions.length > 0
    ? Math.round(finishedPredictions.filter(p => {
        const predictedWinner = p.predicted_home! > p.predicted_away! ? 'home' : p.predicted_home! < p.predicted_away! ? 'away' : 'draw'
        const actualWinner = p.actual_home! > p.actual_away! ? 'home' : p.actual_home! < p.actual_away! ? 'away' : 'draw'
        return predictedWinner === actualWinner
      }).length / finishedPredictions.length * 100)
    : null
  const exactScore = finishedPredictions.length > 0
    ? Math.round(finishedPredictions.filter(p => p.predicted_home === p.actual_home && p.predicted_away === p.actual_away).length / finishedPredictions.length * 100)
    : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <Avatar name={displayName} />
        <div className="flex-1 min-w-0">
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white leading-tight truncate">
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
      {isOwnProfile && editing && me && (
        <EditProfileForm
          currentUsername={profile.username}
          currentDisplayName={profile.display_name}
          me={me}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { key: 'tournaments_played', label: t('tournaments_played'), value: profile.tournaments_count, suffix: '' },
          { key: 'total_points', label: t('total_points'), value: profile.total_points, suffix: '' },
          { key: 'winner_accuracy', label: t('winner_accuracy'), value: winnerAccuracy, suffix: '%' },
          { key: 'exact_score', label: t('exact_score'), value: exactScore, suffix: '%' },
        ].map(stat => (
          <div
            key={stat.key}
            className="rounded-xl px-4 py-4 text-center"
            style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p
              className="font-[family-name:var(--font-oswald)] text-3xl font-bold"
              style={{ color: stat.value !== null ? '#f0b429' : '#2a3a4a' }}
            >
              {stat.value !== null ? `${stat.value}${stat.suffix}` : '—'}
            </p>
            <p className="text-[#4a5c70] text-xs uppercase tracking-widest mt-1 font-semibold">{stat.label}</p>
          </div>
        ))}
      </div>

      {isOwnProfile && (
        <div className="flex justify-end">
          <Link href="/predictions" className="text-xs font-semibold" style={{ color: '#4a5c70' }}>
            {t('view_predictions')}
          </Link>
        </div>
      )}
    </div>
  )
}
