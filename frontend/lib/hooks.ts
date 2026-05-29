'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/types/api'

export function useOnboardingGuard(user: User | undefined, isLoading: boolean) {
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !user) return
    if (!user.language || !user.timezone) {
      router.push('/onboarding')
    }
  }, [user, isLoading, router])
}
