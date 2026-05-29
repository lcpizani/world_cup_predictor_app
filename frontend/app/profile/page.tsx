'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { api } from '@/lib/api'

export default function ProfileRedirect() {
  const router = useRouter()
  const hasToken = typeof window !== 'undefined' && !!Cookies.get('is_authenticated')

  const { data: user, isError } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    enabled: hasToken,
    retry: false,
  })

  useEffect(() => {
    if (!hasToken) {
      router.replace('/auth/login')
      return
    }
    if (user) {
      router.replace(`/profile/${user.username}`)
    }
    if (isError) {
      router.replace('/auth/login')
    }
  }, [user, isError, hasToken, router])

  return (
    <div className="flex items-center justify-center min-h-[88vh]">
      <p className="text-[#64748b] text-sm animate-pulse">Loading profile…</p>
    </div>
  )
}
