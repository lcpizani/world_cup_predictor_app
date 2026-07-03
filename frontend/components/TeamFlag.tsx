'use client'

import Image from 'next/image'
import { useLocale } from 'next-intl'
import { getTeamFlagCode, getFlagUrl, translateTeamName } from '@/lib/flags'

export function TeamFlag({ name, size = 20 }: { name: string; size?: number }) {
  const locale = useLocale()
  const code = getTeamFlagCode(name)
  return (
    <div style={{
      width: size, height: Math.round(size * 0.7),
      flexShrink: 0, borderRadius: 2, overflow: 'hidden',
      background: 'rgba(255,255,255,0.04)',
    }}>
      {code && (
        <Image
          src={getFlagUrl(code, 40)}
          alt={translateTeamName(name, locale)}
          width={size}
          height={Math.round(size * 0.7)}
          className="w-full h-full object-contain"
          unoptimized
        />
      )}
    </div>
  )
}
