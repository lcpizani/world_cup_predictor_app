'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function DashboardPage() {
  const qc = useQueryClient()
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: api.listTournaments,
  })

  const joinMutation = useMutation({
    mutationFn: (code: string) => api.joinTournament(code),
    onSuccess: () => {
      setJoinCode('')
      setJoinError('')
      qc.invalidateQueries({ queryKey: ['tournaments'] })
    },
    onError: (err: Error) => setJoinError(err.message),
  })

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white">
            My Leagues
          </h1>
          <p className="text-[#64748b] text-sm mt-0.5">Compete, predict, dominate</p>
        </div>
        <Link
          href="/tournaments/new"
          className="bg-[#f0b429] text-[#080c14] px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-white transition-all"
        >
          + New League
        </Link>
      </div>

      {/* Join by invite code */}
      <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5 mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-3">
          Join with invite code
        </p>
        <div className="flex gap-3">
          <input
            placeholder="e.g. ABC12345"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinCode && joinMutation.mutate(joinCode)}
            className="flex-1 bg-[#080c14] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#334155] focus:outline-none focus:border-[#f0b429]/50 focus:ring-1 focus:ring-[#f0b429]/30 transition font-mono tracking-wider"
          />
          <button
            onClick={() => { setJoinError(''); joinMutation.mutate(joinCode) }}
            disabled={!joinCode || joinMutation.isPending}
            className="bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-white/20 disabled:opacity-40 transition border border-white/10"
          >
            {joinMutation.isPending ? '…' : 'Join'}
          </button>
        </div>
        {joinError && (
          <p className="text-sm text-red-400 mt-2">{joinError}</p>
        )}
      </div>

      {/* Tournaments list */}
      {isLoading && (
        <p className="text-center text-[#64748b] py-16">Loading…</p>
      )}

      <div className="grid gap-3">
        {tournaments.map((t) => (
          <Link key={t.id} href={`/tournaments/${t.invite_code}`}>
            <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-5 hover:border-[#f0b429]/30 hover:bg-[#131a27] transition-all cursor-pointer group">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-[family-name:var(--font-oswald)] font-semibold text-lg uppercase tracking-wide text-white group-hover:text-[#f0b429] transition-colors">
                    {t.name}
                  </h2>
                  <p className="text-xs text-[#475569] mt-1 font-mono tracking-widest">
                    {t.invite_code}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                      t.is_active
                        ? 'bg-[#f0b429]/10 text-[#f0b429] border border-[#f0b429]/20'
                        : 'bg-white/5 text-[#475569] border border-white/10'
                    }`}
                  >
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[#475569] group-hover:text-[#f0b429] transition-colors text-lg">→</span>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {!isLoading && tournaments.length === 0 && (
          <div className="text-center py-20 text-[#64748b]">
            <div className="text-4xl mb-4">🏟️</div>
            <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-[#475569] mb-2">
              No leagues yet
            </p>
            <p className="text-sm">
              <Link href="/tournaments/new" className="text-[#f0b429] hover:text-white transition-colors">
                Create one
              </Link>
              {' '}or join with an invite code above.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
