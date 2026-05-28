'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Cookies from 'js-cookie'

type State = 'joining' | 'already_member' | 'error'

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [state, setState] = useState<State>('joining')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function join() {
      const token = Cookies.get('auth_token') ?? ''
      const res = await fetch('/api/proxy/tournaments/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ invite_code: code }),
      })

      if (res.ok) {
        router.replace(`/tournaments/${code}`)
        return
      }

      if (res.status === 409) {
        setState('already_member')
        return
      }

      const err = await res.json().catch(() => ({}))
      setErrorMsg((err as { detail?: string }).detail ?? 'Something went wrong.')
      setState('error')
    }

    join()
  }, [code, router])

  if (state === 'joining') {
    return (
      <div className="flex items-center justify-center min-h-[88vh]">
        <p className="text-[#64748b] text-sm animate-pulse">Joining competition…</p>
      </div>
    )
  }

  if (state === 'already_member') {
    return (
      <div className="flex items-center justify-center min-h-[88vh] px-4">
        <div className="text-center max-w-sm">
          <span className="text-5xl">🏆</span>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white mt-4">
            You&apos;re already in!
          </h1>
          <p className="text-[#64748b] text-sm mt-2 mb-6">
            You&apos;re already a member of this competition.
          </p>
          <Link
            href={`/tournaments/${code}`}
            className="inline-block bg-[#f0b429] text-[#080c14] px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white transition-all"
          >
            Go to Competition
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[88vh] px-4">
      <div className="text-center max-w-sm">
        <span className="text-5xl">❌</span>
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white mt-4">
          Invalid Link
        </h1>
        <p className="text-[#64748b] text-sm mt-2 mb-6">
          {errorMsg || 'This invite link is not valid. Ask for a new one.'}
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-[#f0b429] text-[#080c14] px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white transition-all"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
