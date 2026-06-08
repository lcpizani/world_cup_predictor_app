'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { api } from '@/lib/api'
import { useOnboardingGuard } from '@/lib/hooks'
import { getTeamFlagCode, getFlagUrl, translateTeamName, translateBracketLabel } from '@/lib/flags'
import type { GroupData, GroupStandingRow, BracketSlot, LiveMatchBadge } from '@/types/api'
import { formatMatchDate, formatMatchTime } from '@/lib/date'

// ── Group accent palette ──────────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  A: '#38bdf8', B: '#818cf8', C: '#f472b6', D: '#fb923c',
  E: '#34d399', F: '#c084fc', G: '#fbbf24', H: '#f87171',
  I: '#22d3ee', J: '#4ade80', K: '#e879f9', L: '#60a5fa',
}

function groupLetter(g: string) { return g.replace('GROUP_', '') }
function groupColor(g: string)  { return GROUP_COLORS[groupLetter(g)] ?? '#f0b429' }

// ── TeamFlag ──────────────────────────────────────────────────────────────────

const FLAG_W = 26
const FLAG_H = 18

function TeamFlag({ name }: { name: string }) {
  const locale = useLocale()
  const code = getTeamFlagCode(name)
  return (
    <div
      style={{ width: FLAG_W, height: FLAG_H, flexShrink: 0, borderRadius: 2, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}
    >
      {code && (
        <Image
          src={getFlagUrl(code, 40)}
          alt={translateTeamName(name, locale)}
          width={FLAG_W}
          height={FLAG_H}
          className="w-full h-full object-contain"
          unoptimized
        />
      )}
    </div>
  )
}


function LiveBadge({ live_match }: { live_match: LiveMatchBadge }) {
  const [bg, border, color] =
    live_match.result === 'W' ? ['rgba(34,197,94,0.12)',  'rgba(34,197,94,0.35)',  '#4ade80'] :
    live_match.result === 'L' ? ['rgba(239,68,68,0.12)',  'rgba(239,68,68,0.35)',  '#f87171'] :
                                ['rgba(240,180,41,0.12)', 'rgba(240,180,41,0.35)', '#f0b429']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
      padding: '1px 6px', borderRadius: 6,
      background: bg, border: `1px solid ${border}`,
      fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-oswald)',
      fontVariantNumeric: 'tabular-nums', color,
      letterSpacing: '0.04em',
    }}>
      <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
      {live_match.team_score}-{live_match.opp_score}
    </span>
  )
}

const WC_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// ── PosBadge ──────────────────────────────────────────────────────────────────

function PosBadge({ pos }: { pos: number }) {
  const [bg, border, color] =
    pos <= 2  ? ['rgba(34,197,94,0.1)',  'rgba(34,197,94,0.25)',  '#4ade80'] :
    pos === 3 ? ['rgba(240,180,41,0.1)', 'rgba(240,180,41,0.25)', '#f0b429'] :
                ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.08)', '#3d5070']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
      background: bg, border: `1px solid ${border}`, color,
      fontSize: 10, fontWeight: 800,
    }}>
      {pos}
    </span>
  )
}

// ── Shared table head ─────────────────────────────────────────────────────────

function TableHead({ t }: { t: (k: string) => string }) {
  const th: React.CSSProperties = { padding: '6px 4px', textAlign: 'center', fontWeight: 500, fontSize: 11, color: '#4a6080' }
  return (
    <thead>
      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <th style={{ ...th, width: 28, paddingLeft: 10 }}>#</th>
        <th style={{ ...th, textAlign: 'left', paddingLeft: 8, paddingRight: 8, width: '100%' }}>{t('col_team')}</th>
        <th style={{ ...th, width: 24 }}>{t('col_p')}</th>
        <th style={{ ...th, width: 24 }}>{t('col_w')}</th>
        <th style={{ ...th, width: 24 }}>{t('col_d')}</th>
        <th style={{ ...th, width: 24 }}>{t('col_l')}</th>
        <th className="hidden sm:table-cell" style={{ ...th, width: 24 }}>{t('col_gf')}</th>
        <th className="hidden sm:table-cell" style={{ ...th, width: 24 }}>{t('col_ga')}</th>
        <th style={{ ...th, width: 30 }}>{t('col_gd')}</th>
        <th style={{ ...th, width: 34, paddingRight: 10, color: 'rgba(240,180,41,0.7)', fontWeight: 700 }}>{t('col_pts')}</th>
      </tr>
    </thead>
  )
}

// ── GroupCardHeader ───────────────────────────────────────────────────────────

function GroupCardHeader({ letter }: { letter: string }) {
  const t = useTranslations('standings')
  return (
    <div
      className="px-4 py-3 flex items-center"
      style={{
        background: 'linear-gradient(90deg, #1c1100 0%, #0d0d0d 55%, #080808 100%)',
        borderBottom: '2px solid rgba(240,180,41,0.45)',
        borderLeft: '3px solid #f0b429',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-oswald)', fontSize: 15, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.18em', color: '#ffffff',
      }}>
        {t('group_label', { letter })}
      </span>
    </div>
  )
}

// ── EmptyGroupTable ───────────────────────────────────────────────────────────

function EmptyGroupTable({ letter }: { letter: string }) {
  const t = useTranslations('standings')
  const color = GROUP_COLORS[letter] ?? '#f0b429'
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.07)' }}>
      <GroupCardHeader letter={letter} />
      <table className="w-full" style={{ fontSize: 13 }}>
        <TableHead t={t} />
        <tbody>
          {[1, 2, 3, 4].map((pos) => {
            const bl = pos <= 2 ? 'rgba(34,197,94,0.5)' : pos === 3 ? 'rgba(240,180,41,0.4)' : 'transparent'
            return (
              <tr key={pos} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: `3px solid ${bl}` }}>
                <td style={{ paddingLeft: 10, paddingTop: 9, paddingBottom: 9, textAlign: 'center' }}>
                  <PosBadge pos={pos} />
                </td>
                <td style={{ padding: '9px' }}>
                  <div className="h-3 w-20 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
                </td>
                {[0, 1, 2, 3].map((i) => <td key={i} style={{ padding: '9px 4px', textAlign: 'center', color: '#2a3a50' }}>—</td>)}
                <td className="hidden sm:table-cell" style={{ padding: '9px 4px', textAlign: 'center', color: '#2a3a50' }}>—</td>
                <td className="hidden sm:table-cell" style={{ padding: '9px 4px', textAlign: 'center', color: '#2a3a50' }}>—</td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#2a3a50' }}>—</td>
                <td style={{ padding: '9px 10px 9px 4px', textAlign: 'center', color: '#2a3a50' }}>—</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── GroupTable ────────────────────────────────────────────────────────────────

function GroupTable({ group }: { group: GroupData }) {
  const t = useTranslations('standings')
  const locale = useLocale()
  const letter = groupLetter(group.group)
  const color  = groupColor(group.group)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.07)' }}>
      <GroupCardHeader letter={letter} />
      <table className="w-full" style={{ fontSize: 13 }}>
        <TableHead t={t} />
        <tbody>
          {group.standings.map((row) => {
            const bl =
              row.position <= 2 ? 'rgba(34,197,94,0.55)' :
              row.position === 3 ? 'rgba(240,180,41,0.45)' : 'transparent'
            return (
              <tr key={row.position} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: `3px solid ${bl}` }}>
                <td style={{ paddingLeft: 10, paddingTop: 9, paddingBottom: 9, textAlign: 'center' }}>
                  <PosBadge pos={row.position} />
                </td>
                <td style={{ padding: '9px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <TeamFlag name={row.team_name} />
                    <span style={{ color: '#cdd6e8', fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {translateTeamName(row.team_name, locale)}
                    </span>
                    {row.live_match && <LiveBadge live_match={row.live_match} />}
                  </div>
                </td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>{row.played}</td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>{row.won}</td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>{row.drawn}</td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>{row.lost}</td>
                <td className="hidden sm:table-cell" style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>{row.goals_for}</td>
                <td className="hidden sm:table-cell" style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>{row.goals_against}</td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>
                  {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                </td>
                <td style={{
                  padding: '9px 10px 9px 4px', textAlign: 'center',
                  fontFamily: 'var(--font-oswald)', fontSize: 15, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: row.position <= 2 ? '#e2ecff' : '#6a7f9a',
                }}>
                  {row.points}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── QualificationLegend ───────────────────────────────────────────────────────

function QualificationLegend() {
  const t = useTranslations('standings')
  const items = [
    { color: 'rgba(34,197,94,0.65)',   label: t('legend_advances') },
    { color: 'rgba(240,180,41,0.65)',  label: t('legend_best_third') },
    { color: 'rgba(255,255,255,0.12)', label: t('legend_eliminated') },
  ]
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 py-2.5 rounded-xl mt-4"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ fontSize: 10.5, color: '#6a8099', letterSpacing: '0.01em' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── BestThirdSection ──────────────────────────────────────────────────────────

function BestThirdSection({ groups }: { groups: GroupData[] }) {
  const t = useTranslations('standings')
  const locale = useLocale()

  const thirds: GroupStandingRow[] = groups
    .flatMap(g => g.standings.filter(r => r.position === 3))
    .sort((a, b) =>
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for
    )

  if (thirds.length === 0) return null

  return (
    <div className="rounded-xl overflow-hidden mt-4" style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div
        className="px-3 py-2.5 flex items-center gap-2.5"
        style={{
          background: 'linear-gradient(90deg, rgba(240,180,41,0.12) 0%, transparent 65%)',
          borderBottom: '1px solid rgba(240,180,41,0.14)',
        }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: 'rgba(240,180,41,0.15)', border: '1px solid rgba(240,180,41,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#f0b429" />
          </svg>
        </span>
        <span style={{ fontFamily: 'var(--font-oswald)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8a9ab8' }}>
          {t('best_third')}
        </span>
      </div>

      <table className="w-full" style={{ fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <th style={{ width: 28, paddingLeft: 10, paddingTop: 6, paddingBottom: 6, textAlign: 'center', color: '#334155', fontWeight: 500, fontSize: 11 }}>#</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', color: '#4a6080', fontWeight: 500, fontSize: 11, width: '100%' }}>{t('col_team')}</th>
            <th style={{ width: 24, padding: '6px 4px', textAlign: 'center', color: '#4a6080', fontWeight: 500, fontSize: 11 }}>{t('col_p')}</th>
            <th style={{ width: 24, padding: '6px 4px', textAlign: 'center', color: '#4a6080', fontWeight: 500, fontSize: 11 }}>{t('col_w')}</th>
            <th style={{ width: 24, padding: '6px 4px', textAlign: 'center', color: '#4a6080', fontWeight: 500, fontSize: 11 }}>{t('col_d')}</th>
            <th style={{ width: 24, padding: '6px 4px', textAlign: 'center', color: '#4a6080', fontWeight: 500, fontSize: 11 }}>{t('col_l')}</th>
            <th style={{ width: 30, padding: '6px 4px', textAlign: 'center', color: '#4a6080', fontWeight: 500, fontSize: 11 }}>{t('col_gd')}</th>
            <th style={{ width: 34, padding: '6px 10px 6px 4px', textAlign: 'center', color: 'rgba(240,180,41,0.7)', fontWeight: 700, fontSize: 11 }}>{t('col_pts')}</th>
            <th className="hidden sm:table-cell" style={{ width: 80, padding: '6px 4px', textAlign: 'center', fontSize: 11 }} />
          </tr>
        </thead>
        <tbody>
          {thirds.map((row, idx) => {
            const advances = idx < 8
            return (
              <tr
                key={row.group}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  borderLeft: advances ? '3px solid rgba(34,197,94,0.5)' : '3px solid transparent',
                }}
              >
                <td style={{ paddingLeft: 10, paddingTop: 9, paddingBottom: 9, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#3d5070',
                    fontSize: 10, fontWeight: 800,
                  }}>
                    {idx + 1}
                  </span>
                </td>
                <td style={{ padding: '9px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <TeamFlag name={row.team_name} />
                    <span style={{ color: '#cdd6e8', fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {translateTeamName(row.team_name, locale)}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                      padding: '1px 5px', borderRadius: 4,
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.16)',
                      color: '#a0b4cc',
                      fontFamily: 'var(--font-oswald)',
                    }}>
                      {groupLetter(row.group)}
                    </span>
                    {row.live_match && <LiveBadge live_match={row.live_match} />}
                  </div>
                </td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>{row.played}</td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>{row.won}</td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>{row.drawn}</td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>{row.lost}</td>
                <td style={{ padding: '9px 4px', textAlign: 'center', color: '#5a7090', fontVariantNumeric: 'tabular-nums' }}>
                  {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                </td>
                <td style={{
                  padding: '9px 10px 9px 4px', textAlign: 'center',
                  fontFamily: 'var(--font-oswald)', fontSize: 15, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: '#cdd6e8',
                }}>
                  {row.points}
                </td>
                <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center' }}>
                  {advances && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                      color: 'rgba(74,222,128,0.9)', whiteSpace: 'nowrap',
                    }}>
                      {t('advances')}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Bracket geometry ──────────────────────────────────────────────────────────
//
// Every bracket card has a fixed pixel height (CARD_H).  For proper vertical
// alignment each round column gets a top-padding offset (pt) and an inter-card
// gap (g) derived from the recurrence:
//
//   g_{n+1}  = CARD_H + 2 · g_n          (gap doubles plus one card height)
//   pt_{n+1} = pt_n   + (CARD_H + g_n)/2  (each round is offset by half a slot)
//
// This guarantees that every card in round n+1 is vertically centred between
// its two feeder cards in round n.

const CARD_H  = 80   // px — enforced on every BracketSlotCard
const COL_W   = 160  // px — width of every round column
const COL_GAP = 20   // px — horizontal space between columns
const R32_GAP = 4    // px — gap between adjacent cards in the R32 column

const MAIN_ROUNDS = ['round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'final'] as const

// Top-to-bottom display order of each round's slots (FIFA match numbers).
//
// The 2026 bracket tree is interleaved — e.g. M89 = Winner M74 vs Winner M77 —
// so slots do NOT advance by consecutive match number. The connector geometry
// below assumes card k in round N+1 sits between cards 2k and 2k+1 of round N,
// which only holds if each round is laid out in this canonical bracket order
// (a pre-order walk of the advancement tree in app/routers/standings.py), not by
// raw slot_id. Keep this in sync with that backend _ADVANCEMENT map.
const BRACKET_SLOT_ORDER: Record<string, number[]> = {
  round_of_32:    [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  round_of_16:    [89, 90, 93, 94, 91, 92, 95, 96],
  quarter_finals: [97, 98, 99, 100],
  semi_finals:    [101, 102],
  final:          [104],
}

function bracketOrderIndex(round: string, slotId: number): number {
  const order = BRACKET_SLOT_ORDER[round]
  if (!order) return slotId
  const idx = order.indexOf(slotId)
  return idx === -1 ? slotId : idx
}

const BRACKET_LAYOUTS: Record<string, { gap: number; paddingTop: number }> = (() => {
  const out: Record<string, { gap: number; paddingTop: number }> = {}
  let gap = R32_GAP
  let pt  = 0
  for (const r of MAIN_ROUNDS) {
    out[r] = { gap, paddingTop: Math.round(pt) }
    const g0 = gap
    gap = CARD_H + 2 * gap
    pt  = pt + (CARD_H + g0) / 2
  }
  return out
})()

// Height of the tallest column (R32 with 16 cards)
const BRACKET_H = 16 * CARD_H + 15 * R32_GAP  // 1340 px
// Total width of the 5-column bracket
const TOTAL_W   = MAIN_ROUNDS.length * COL_W + (MAIN_ROUNDS.length - 1) * COL_GAP  // 880 px

// ── BracketSlotCard ───────────────────────────────────────────────────────────

function BracketSlotCard({ slot }: { slot: BracketSlot }) {
  const locale     = useLocale()
  const t          = useTranslations('standings')
  const match      = slot.match
  const isLive     = match?.status === 'live'
  const isFinished = match?.status === 'finished'
  const hasBoth    = !!match
  const homeWins   = isFinished && match && (match.home_score ?? 0) > (match.away_score ?? 0)
  const awayWins   = isFinished && match && (match.away_score ?? 0) > (match.home_score ?? 0)

  function Team({ name, score, winner }: { name: string; score?: number | null; winner?: boolean }) {
    const code = getTeamFlagCode(name)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 22, overflow: 'hidden' }}>
        <div style={{ width: 20, height: 14, flexShrink: 0, borderRadius: 2, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
          {hasBoth && code && (
            <Image src={getFlagUrl(code, 40)} alt={name} width={20} height={14}
              className="w-full h-full object-contain"
              unoptimized />
          )}
        </div>
        <span style={{
          flex: 1, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: hasBoth ? (winner ? 700 : 500) : 400,
          color: hasBoth ? (winner ? '#e2ecff' : '#6a7f9a') : '#3d5070',
          opacity: hasBoth ? 1 : 0.55,
        }}>
          {hasBoth ? translateTeamName(name, locale) : translateBracketLabel(name, locale)}
        </span>
        {(isFinished || isLive) && score != null && (
          <span style={{
            fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-oswald)',
            fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 14, textAlign: 'right',
            color: winner ? '#f0b429' : '#4a6080',
          }}>
            {score}
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{
      // Fixed height is the cornerstone of bracket alignment — do not remove
      height: CARD_H, boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column',
      background: '#0d1826',
      border: isLive ? '1px solid rgba(240,180,41,0.3)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      {/* Status bar — always rendered (keeps CARD_H consistent even for pending slots) */}
      <div style={{
        flexShrink: 0, height: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 8px',
        background: isLive
          ? 'linear-gradient(90deg,rgba(200,144,10,.25),rgba(240,180,41,.12))'
          : 'rgba(255,255,255,.025)',
        borderBottom: '1px solid rgba(255,255,255,.05)',
      }}>
        <span style={{ fontSize: 9, color: '#3a5070', textTransform: 'uppercase', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {match ? formatMatchDate(match.kickoff_at, null, locale) : ''}
        </span>
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          {isLive && (
            <>
              <span className="animate-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: '#f0b429', letterSpacing: '.06em' }}>
                {match?.minute != null ? `${match.minute}'` : 'LIVE'}
              </span>
            </>
          )}
          {isFinished && <span style={{ fontSize: 9, fontWeight: 700, color: '#3a5070' }}>{t('ft')}</span>}
          {match && !isLive && !isFinished && <span style={{ fontSize: 9, color: '#2a4060' }}>{formatMatchTime(match.kickoff_at, null, locale)}</span>}
        </span>
      </div>

      {/* Teams — flex:1 fills the remaining CARD_H - 22px - 1px(border) = 57px */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '4px 8px' }}>
        <Team name={match ? match.home_team : slot.home_label} score={match?.home_score} winner={!!homeWins} />
        <Team name={match ? match.away_team : slot.away_label} score={match?.away_score} winner={!!awayWins} />
      </div>
    </div>
  )
}

// ── BracketConnectors (SVG) ───────────────────────────────────────────────────
//
// Draws the "H-beam" connectors between each pair of feeder cards (round N)
// and the single destination card (round N+1).  All y-coordinates are derived
// from the same BRACKET_LAYOUTS constants used to position the cards, so the
// lines land precisely at the horizontal mid-point of every card.

function BracketConnectors({ slotsByRound }: { slotsByRound: Record<string, BracketSlot[]> }) {
  const segs: string[] = []

  for (let ri = 0; ri < MAIN_ROUNDS.length - 1; ri++) {
    const rA = MAIN_ROUNDS[ri]
    const rB = MAIN_ROUNDS[ri + 1]
    const la = BRACKET_LAYOUTS[rA]
    const lb = BRACKET_LAYOUTS[rB]
    const sB = slotsByRound[rB] ?? []
    if (!sB.length) continue

    const xAR = ri       * (COL_W + COL_GAP) + COL_W  // right edge of column A
    const xBL = (ri + 1) * (COL_W + COL_GAP)           // left  edge of column B
    const mx  = (xAR + xBL) / 2                         // midpoint in the gap

    for (let k = 0; k < sB.length; k++) {
      const y1 = la.paddingTop + (2 * k)     * (CARD_H + la.gap) + CARD_H / 2
      const y2 = la.paddingTop + (2 * k + 1) * (CARD_H + la.gap) + CARD_H / 2
      const ym = lb.paddingTop + k           * (CARD_H + lb.gap) + CARD_H / 2

      segs.push(
        `M ${xAR} ${y1} H ${mx}`,   // horizontal right from feeder 1
        `M ${xAR} ${y2} H ${mx}`,   // horizontal right from feeder 2
        `M ${mx}  ${y1} V ${y2}`,   // vertical spine connecting feeders
        `M ${mx}  ${ym} H ${xBL}`,  // horizontal right into destination
      )
    }
  }

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: TOTAL_W, height: BRACKET_H, pointerEvents: 'none' }}
      overflow="visible"
    >
      <path
        d={segs.join(' ')}
        stroke="rgba(255,255,255,0.11)"
        strokeWidth={1}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── BracketView ───────────────────────────────────────────────────────────────

function BracketView({ slots }: { slots: BracketSlot[] }) {
  const t = useTranslations('standings')
  const hasR32Pending = slots.filter(s => s.round === 'round_of_32').some(s => s.match === null)

  // Build per-round arrays in canonical bracket display order (see
  // BRACKET_SLOT_ORDER) so that adjacent pairs in round N feed the corresponding
  // card in round N+1 — the assumption the connector geometry relies on.
  const slotsByRound: Record<string, BracketSlot[]> = {}
  for (const slot of slots) {
    if (!slotsByRound[slot.round]) slotsByRound[slot.round] = []
    slotsByRound[slot.round].push(slot)
  }
  for (const key of Object.keys(slotsByRound)) {
    slotsByRound[key].sort(
      (a, b) => bracketOrderIndex(key, a.slot_id) - bracketOrderIndex(key, b.slot_id),
    )
  }

  const thirdPlace = slotsByRound['third_place'] ?? []

  return (
    <div>
      {hasR32Pending && (
        <div className="mb-4 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', color: '#6a8099', fontSize: 12 }}
        >
          {t('bracket_paths_pending')}
        </div>
      )}

      <div style={{ overflowX: 'auto', paddingBottom: 16, WebkitOverflowScrolling: 'touch' }}>
        {/* Round header labels */}
        <div style={{ display: 'flex', gap: COL_GAP, marginBottom: 12, width: TOTAL_W }}>
          {MAIN_ROUNDS.map((round) => (
            <div
              key={round}
              style={{
                width: COL_W, flexShrink: 0, textAlign: 'center',
                paddingBottom: 7, borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-oswald)', fontSize: 10.5, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4a6080',
              }}>
                {t(`rounds.${round}`)}
              </span>
            </div>
          ))}
        </div>

        {/* Bracket grid — position:relative anchors the SVG overlay */}
        <div style={{ position: 'relative', height: BRACKET_H, width: TOTAL_W }}>
          <BracketConnectors slotsByRound={slotsByRound} />

          <div style={{ position: 'relative', display: 'flex', gap: COL_GAP, zIndex: 1 }}>
            {MAIN_ROUNDS.map((round) => {
              const roundSlots = slotsByRound[round] ?? []
              if (!roundSlots.length) return null
              const { paddingTop, gap } = BRACKET_LAYOUTS[round]
              return (
                <div key={round} style={{ width: COL_W, flexShrink: 0, paddingTop }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap }}>
                    {roundSlots.map(slot => (
                      <BracketSlotCard key={slot.slot_id} slot={slot} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Third-place playoff — separate, below the main bracket */}
      {thirdPlace.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{
            display: 'block', marginBottom: 8,
            fontFamily: 'var(--font-oswald)', fontSize: 10.5, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4a6080',
          }}>
            {t('rounds.third_place')}
          </span>
          <div style={{ width: COL_W }}>
            {thirdPlace.map(slot => <BracketSlotCard key={slot.slot_id} slot={slot} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StandingsPage() {
  const t  = useTranslations('standings')
  const qc = useQueryClient()
  const [tab, setTab]           = useState<'groups' | 'bracket'>('groups')
  const [reloading, setReloading] = useState(false)

  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  useOnboardingGuard(me, meLoading)

  const { data: standingsData = [], isLoading: standingsLoading } = useQuery({
    queryKey: ['standings'],
    queryFn: api.getStandings,
    refetchInterval: 30_000,
  })

  const { data: bracketData = [], isLoading: bracketLoading } = useQuery({
    queryKey: ['bracket'],
    queryFn: api.getBracket,
    enabled: tab === 'bracket',
  })

  async function handleReload() {
    setReloading(true)
    await qc.invalidateQueries({ queryKey: ['standings'] })
    await qc.invalidateQueries({ queryKey: ['bracket'] })
    setReloading(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <div className="flex items-baseline gap-2">
            <h1
              className="font-[family-name:var(--font-oswald)] leading-none uppercase tracking-wide"
              style={{ fontSize: 'clamp(26px, 5vw, 38px)', fontWeight: 700, color: '#e2ecff' }}
            >
              World Cup
            </h1>
            <span
              className="font-[family-name:var(--font-oswald)] leading-none text-gold-gradient"
              style={{ fontSize: 'clamp(26px, 5vw, 38px)', fontWeight: 700 }}
            >
              2026
            </span>
          </div>
          <p style={{ color: '#4a6080', fontSize: 13, marginTop: 6, fontWeight: 500, letterSpacing: '0.02em' }}>
            {t('subtitle')}
          </p>
        </div>

        <button
          onClick={handleReload}
          disabled={reloading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          style={{ color: '#4a6080' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8a9ab8'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4a6080'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={reloading ? 'animate-spin' : ''}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          {reloading ? t('reloading') : t('reload')}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex gap-0.5 mb-7 p-1 rounded-xl w-fit"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {(['groups', 'bracket'] as const).map(tabKey => {
          const active = tab === tabKey
          return (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
              style={{
                color: active ? '#e2ecff' : '#4a6080',
                background: active
                  ? 'linear-gradient(135deg, rgba(240,180,41,0.15), rgba(255,255,255,0.08))'
                  : 'transparent',
                border: active ? '1px solid rgba(240,180,41,0.2)' : '1px solid transparent',
                boxShadow: active ? '0 1px 8px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              {tabKey === 'groups' ? t('tab_groups') : t('tab_bracket')}
            </button>
          )
        })}
      </div>

      {/* ── Groups Tab ── */}
      {tab === 'groups' && (
        <div>
          {standingsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : standingsData.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WC_GROUPS.map(letter => <EmptyGroupTable key={letter} letter={letter} />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                {standingsData.map(group => <GroupTable key={group.group} group={group} />)}
              </div>
              <QualificationLegend />
              <BestThirdSection groups={standingsData} />
            </>
          )}
        </div>
      )}

      {/* ── Bracket Tab ── */}
      {tab === 'bracket' && (
        <div>
          {bracketLoading ? (
            <div className="h-44 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ) : (
            <BracketView slots={bracketData} />
          )}
        </div>
      )}
    </div>
  )
}
