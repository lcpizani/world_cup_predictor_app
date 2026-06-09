'use client'

import Image from 'next/image'
import { getTeamFlagCode, getFlagUrl, translateTeamName } from '@/lib/flags'
import { useLocale } from 'next-intl'

export const BRACKET_CARD_H = 80  // px — must match BracketTree's CARD_H

interface BracketMatchProps {
  matchKey: string
  home: string | null
  away: string | null
  pick: string | null
  onPick: (matchKey: string, team: string) => void
  isFinal?: boolean
}

function TeamRow({
  team,
  isPicked,
  isEliminated,
  onClick,
}: {
  team: string | null
  isPicked: boolean
  isEliminated: boolean
  onClick: () => void
}) {
  const locale = useLocale()
  const code = team ? getTeamFlagCode(team) : null
  const displayName = team ? translateTeamName(team, locale) : null

  if (!team) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
        <div style={{ width: 20, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, color: '#2a3d54', fontWeight: 400 }}>TBD</span>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={isEliminated}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: 6,
        width: '100%',
        textAlign: 'left',
        background: isPicked ? 'rgba(240,180,41,0.1)' : 'transparent',
        opacity: isEliminated ? 0.35 : 1,
        cursor: isEliminated ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
        border: 'none',
      }}
      className={!isEliminated && !isPicked ? 'hover:bg-white/[0.04]' : ''}
    >
      <div style={{
        width: 20, height: 14, borderRadius: 2,
        overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
        background: 'rgba(255,255,255,0.04)',
      }}>
        {code && (
          <Image
            src={getFlagUrl(code, 40)}
            alt={displayName ?? team}
            width={20}
            height={14}
            className="w-full h-full object-cover"
            unoptimized
          />
        )}
      </div>
      <span style={{
        flex: 1,
        fontSize: 10.5,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: isPicked ? 700 : 500,
        color: isPicked ? '#f0b429' : '#7a9ab8',
      }}>
        {displayName}
      </span>
      {isPicked && (
        <span style={{ fontSize: 9, color: '#f0b429', flexShrink: 0 }}>✓</span>
      )}
    </button>
  )
}

export function BracketMatch({
  matchKey,
  home,
  away,
  pick,
  onPick,
  isFinal = false,
}: BracketMatchProps) {
  const bothAbsent = !home && !away

  return (
    <div style={{
      height: BRACKET_CARD_H,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      background: '#0d1826',
      border: `1px solid ${isFinal ? 'rgba(240,180,41,0.35)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 8,
      overflow: 'hidden',
      opacity: bothAbsent ? 0.35 : 1,
    }}>
      <TeamRow
        team={home}
        isPicked={pick === home && !!home}
        isEliminated={!!pick && pick !== home && !!home}
        onClick={() => home && onPick(matchKey, home)}
      />
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
      <TeamRow
        team={away}
        isPicked={pick === away && !!away}
        isEliminated={!!pick && pick !== away && !!away}
        onClick={() => away && onPick(matchKey, away)}
      />
    </div>
  )
}
