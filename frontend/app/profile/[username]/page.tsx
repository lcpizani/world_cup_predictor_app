'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { api } from '@/lib/api'
import type { PredictionHistoryItem } from '@/types/api'

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

function PredictionRow({ item }: { item: PredictionHistoryItem }) {
  const hasResult = item.actual_home !== null && item.actual_away !== null
  const pts = item.points_awarded

  let statusColor = 'rgba(255,255,255,0.15)'
  let statusLabel = hasResult ? '0 pts' : 'Pending'
  if (pts !== null && pts !== undefined) {
    statusLabel = `+${pts} pts`
    statusColor = pts > 0 ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.1)'
  }

  const kickoff = new Date(item.kickoff_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-medium truncate">
          {item.home_team} vs {item.away_team}
        </p>
        <p className="text-[#4a5c70] text-xs mt-0.5">
          {kickoff} · Predicted: {item.predicted_home ?? '—'}–{item.predicted_away ?? '—'}
          {hasResult && ` · Result: ${item.actual_home}–${item.actual_away}`}
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
        Edit Profile
      </h3>
      <div className="space-y-3">
        <div>
          <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: '#5a6a82' }}>
            Username
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
            Display Name
          </label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your full name (optional)"
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
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7f96' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const [editing, setEditing] = useState(false)
  const hasToken = typeof window !== 'undefined' && !!Cookies.get('is_authenticated')

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    enabled: hasToken,
    retry: false,
  })

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
        <p className="text-[#64748b] text-sm animate-pulse">Loading profile…</p>
      </div>
    )
  }

  if (profileError || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[88vh] px-4">
        <div className="text-center max-w-sm">
          <span className="text-5xl">👤</span>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white mt-4">
            User Not Found
          </h1>
          <p className="text-[#64748b] text-sm mt-2">
            No player with that username exists.
          </p>
        </div>
      </div>
    )
  }

  const displayName = profile.display_name ?? profile.username
  const memberSince = new Date(profile.created_at).toLocaleDateString(undefined, {
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
          <p className="text-[#3f5068] text-xs mt-1">Member since {memberSince}</p>
        </div>
        {isOwnProfile && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7f96' }}
          >
            Edit
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
          { label: 'Tournaments', value: profile.tournaments_count },
          { label: 'Total Points', value: profile.total_points },
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

      {/* Divider */}
      <div className="h-px mb-6" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Prediction history */}
      <h2 className="font-[family-name:var(--font-oswald)] text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: '#5a6a82' }}>
        Predictions
      </h2>

      {predsLoading ? (
        <p className="text-[#3f5068] text-sm animate-pulse">Loading predictions…</p>
      ) : predictions && predictions.length > 0 ? (
        <div className="space-y-2">
          {predictions.map(item => (
            <PredictionRow key={item.match_id} item={item} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl px-4 py-8 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="text-[#3f5068] text-sm">No predictions yet.</p>
        </div>
      )}
    </div>
  )
}
