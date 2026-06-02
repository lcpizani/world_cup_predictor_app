'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Match, User } from '@/types/api'

export function useOnboardingGuard(user: User | undefined, isLoading: boolean) {
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !user) return
    if (!user.language || !user.timezone) {
      router.push('/onboarding')
    }
  }, [user, isLoading, router])
}

/** Returns 30 s when any match is live, 5 min otherwise. */
export function useLiveInterval(matches: Match[]): number {
  return matches.some(m => m.status === 'live') ? 30_000 : 300_000
}
