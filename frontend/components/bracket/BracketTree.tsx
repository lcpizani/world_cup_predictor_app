'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { BracketMatch, BRACKET_CARD_H } from './BracketMatch'
import {
  BRACKET_STRUCTURE,
  getSeededTeams,
  getDownstreamKeys,
  type R32Matchup,
} from '@/lib/simulation'
import { exportBracketCanvas } from '@/lib/exportBracket'
import { getTeamFlagCode, getFlagUrl, translateTeamName } from '@/lib/flags'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

// ── Layout constants ───────────────────────────────────────────────────────────

const CARD_H  = BRACKET_CARD_H   // 80px
const COL_W   = 140              // px
const COL_GAP = 10               // px
const R32_GAP = 4                // px — gap between adjacent R32 cards

const HALF_ROUNDS = ['R32', 'R16', 'QF', 'SF'] as const
type HalfRoundKey = typeof HALF_ROUNDS[number]

// Binary-tree recurrence for 8 R32 matches per half:
//   gap[n+1]  = CARD_H + 2·gap[n]
//   pt[n+1]   = pt[n]  + (CARD_H + gap[n]) / 2
const HALF_LAYOUTS = (() => {
  const out: Record<string, { gap: number; paddingTop: number }> = {}
  let gap = R32_GAP
  let pt  = 0
  for (const r of HALF_ROUNDS) {
    out[r] = { gap, paddingTop: Math.round(pt) }
    const g0 = gap
    gap = CARD_H + 2 * g0
    pt  = pt + (CARD_H + g0) / 2
  }
  return out
})()

// Total half height: 8 R32 cards + 7 gaps
const HALF_H   = 8 * CARD_H + 7 * R32_GAP  // 668px
// Final card centered vertically — equals HALF_LAYOUTS.SF.paddingTop (both = 294)
const FINAL_PT = Math.round(HALF_H / 2 - CARD_H / 2)  // 294px
// Full mirrored bracket width: 4 left cols + 1 Final col + 4 right cols
const TOTAL_W  = 9 * COL_W + 8 * COL_GAP   // 1340px

const ROUND_LABELS: Record<string, string> = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF:  'Quarter Finals',
  SF:  'Semi Finals',
  F:   'Final',
}

// Column header colors — progressively brighter toward center
const ROUND_HEADER_COLORS: Record<string, string> = {
  R32: '#384d64',
  R16: '#425870',
  QF:  '#516780',
  SF:  '#607a96',
  F:   '#f0b429',
}

// Left half: first 8 R32, first 4 R16, first 2 QF, first SF
const LEFT_MATCHES: Record<HalfRoundKey, string[]> = {
  R32: BRACKET_STRUCTURE.R32.slice(0, 8),
  R16: BRACKET_STRUCTURE.R16.slice(0, 4),
  QF:  BRACKET_STRUCTURE.QF.slice(0, 2),
  SF:  BRACKET_STRUCTURE.SF.slice(0, 1),
}

// Right half: last 8 R32, last 4 R16, last 2 QF, last SF
const RIGHT_MATCHES: Record<HalfRoundKey, string[]> = {
  R32: BRACKET_STRUCTURE.R32.slice(8),
  R16: BRACKET_STRUCTURE.R16.slice(4),
  QF:  BRACKET_STRUCTURE.QF.slice(2),
  SF:  BRACKET_STRUCTURE.SF.slice(1),
}

// Champion banner constants
const CHAMP_BANNER_W    = COL_W
const CHAMP_BANNER_LEFT = 4 * (COL_W + COL_GAP)   // flush with Final column
const CHAMP_BANNER_TOP  = FINAL_PT + CARD_H + 20

// ── SVG connector lines ───────────────────────────────────────────────────────

function BracketConnectors() {
  const segs: string[] = []

  // Left side: R32(col0)→R16(col1)→QF(col2)→SF(col3)
  for (let i = 0; i < HALF_ROUNDS.length - 1; i++) {
    const la = HALF_LAYOUTS[HALF_ROUNDS[i]]
    const lb = HALF_LAYOUTS[HALF_ROUNDS[i + 1]]
    const matchesB = LEFT_MATCHES[HALF_ROUNDS[i + 1]]

    const xAR = i       * (COL_W + COL_GAP) + COL_W
    const xBL = (i + 1) * (COL_W + COL_GAP)
    const mx  = (xAR + xBL) / 2

    for (let k = 0; k < matchesB.length; k++) {
      const y1 = la.paddingTop + (2 * k)     * (CARD_H + la.gap) + CARD_H / 2
      const y2 = la.paddingTop + (2 * k + 1) * (CARD_H + la.gap) + CARD_H / 2
      const ym = lb.paddingTop + k           * (CARD_H + lb.gap) + CARD_H / 2
      segs.push(`M ${xAR} ${y1} H ${mx}`, `M ${xAR} ${y2} H ${mx}`, `M ${mx} ${y1} V ${y2}`, `M ${mx} ${ym} H ${xBL}`)
    }
  }

  // Left SF (col3) → Final (col4) — straight horizontal line, same vertical center
  {
    const y  = HALF_LAYOUTS.SF.paddingTop + CARD_H / 2
    const x0 = 3 * (COL_W + COL_GAP) + COL_W
    const x1 = 4 * (COL_W + COL_GAP)
    segs.push(`M ${x0} ${y} H ${x1}`)
  }

  // Right SF (col5) → Final (col4) — straight horizontal line (mirrored)
  {
    const y  = HALF_LAYOUTS.SF.paddingTop + CARD_H / 2
    const x0 = 5 * (COL_W + COL_GAP)
    const x1 = 4 * (COL_W + COL_GAP) + COL_W
    segs.push(`M ${x0} ${y} H ${x1}`)
  }

  // Right side: R32(col8)→R16(col7)→QF(col6)→SF(col5) — mirrored
  for (let i = 0; i < HALF_ROUNDS.length - 1; i++) {
    const la = HALF_LAYOUTS[HALF_ROUNDS[i]]
    const lb = HALF_LAYOUTS[HALF_ROUNDS[i + 1]]
    const matchesB = RIGHT_MATCHES[HALF_ROUNDS[i + 1]]

    // Right R32 at col8, R16 at col7, QF at col6, SF at col5
    const colA = 8 - i
    const colB = 7 - i
    const xAL  = colA * (COL_W + COL_GAP)
    const xBR  = colB * (COL_W + COL_GAP) + COL_W
    const mx   = (xAL + xBR) / 2

    for (let k = 0; k < matchesB.length; k++) {
      const y1 = la.paddingTop + (2 * k)     * (CARD_H + la.gap) + CARD_H / 2
      const y2 = la.paddingTop + (2 * k + 1) * (CARD_H + la.gap) + CARD_H / 2
      const ym = lb.paddingTop + k           * (CARD_H + lb.gap) + CARD_H / 2
      segs.push(`M ${xAL} ${y1} H ${mx}`, `M ${xAL} ${y2} H ${mx}`, `M ${mx} ${y1} V ${y2}`, `M ${mx} ${ym} H ${xBR}`)
    }
  }

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: TOTAL_W, height: HALF_H, pointerEvents: 'none' }}
      overflow="visible"
    >
      <path d={segs.join(' ')} stroke="rgba(255,255,255,0.07)" strokeWidth={1} fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ── Champion banner ───────────────────────────────────────────────────────────

function ChampionBanner({ team, locale }: { team: string; locale: string }) {
  const code = getTeamFlagCode(team)
  const name = translateTeamName(team, locale)
  const nameFontSize = Math.max(14, 24 - Math.max(0, name.length - 7))

  return (
    <>
      <style>{`
        @keyframes champ-enter {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes champ-glow {
          0%,100% { box-shadow: 0 0 18px rgba(240,180,41,0.09), 0 0 0 1px rgba(240,180,41,0.26); }
          50%     { box-shadow: 0 0 36px rgba(240,180,41,0.22), 0 0 0 1px rgba(240,180,41,0.46); }
        }
        @keyframes champ-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes champ-float {
          0%,100% { transform: translateY(0px)  rotate(-1deg); }
          50%     { transform: translateY(-5px) rotate( 1deg); }
        }
        @keyframes champ-name-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes champ-line-grow {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        @keyframes champ-badge-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* Connector from Final card down to banner */}
      <div style={{
        position: 'absolute',
        left: CHAMP_BANNER_LEFT + COL_W / 2 - 0.5,
        top:  FINAL_PT + CARD_H,
        width: 1,
        height: 20,
        background: 'linear-gradient(to bottom, rgba(240,180,41,0.45), rgba(240,180,41,0.05))',
      }} />

      <div style={{
        position: 'absolute',
        left: CHAMP_BANNER_LEFT,
        top:  CHAMP_BANNER_TOP,
        width: CHAMP_BANNER_W,
        textAlign: 'center',
        animation: 'champ-enter 0.6s cubic-bezier(0.34,1.46,0.64,1) both',
        zIndex: 10,
      }}>
        <div style={{
          position: 'relative',
          borderRadius: 12,
          padding: '11px 12px 13px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'linear-gradient(170deg, rgba(240,180,41,0.07) 0%, rgba(8,12,20,0.98) 50%)',
          animation: 'champ-glow 3.5s ease-in-out infinite',
        }}>
          <div style={{
            fontSize: 7,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.13em',
            color: 'rgba(240,180,41,0.35)',
            marginBottom: 7,
          }}>
            2026 FIFA World Cup
          </div>
          <div style={{ marginBottom: 10, lineHeight: 0 }}>
            <div style={{ animation: 'champ-float 3s ease-in-out infinite' }}>
              <Image src="/trophy.png" alt="Trophy" width={44} height={54}
                style={{ width: 44, height: 'auto', display: 'block' }} unoptimized />
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-oswald)',
            fontSize: nameFontSize,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: nameFontSize >= 20 ? '0.04em' : '0.07em',
            background: 'linear-gradient(135deg, #c07010 0%, #f0b429 30%, #fde68a 52%, #f0b429 72%, #c07010 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'champ-shimmer 4s linear infinite',
            lineHeight: 1.05,
            marginBottom: 9,
            whiteSpace: 'nowrap',
          }}>
            {name}
          </div>
          <div style={{
            height: 1,
            width: 'calc(100% - 20px)',
            marginBottom: 9,
            background: 'linear-gradient(90deg, transparent, rgba(240,180,41,0.5), transparent)',
            animation: 'champ-line-grow 0.45s 0.35s both',
            transformOrigin: 'center',
          }} />
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            animation: 'champ-badge-in 0.4s 0.5s both',
          }}>
            {code && (
              <div style={{
                width: 18, height: 13, borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.15)',
                flexShrink: 0,
              }}>
                <Image src={getFlagUrl(code, 40)} alt={name} width={18} height={13}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
              </div>
            )}
            <span style={{
              fontSize: 8.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'rgba(240,180,41,0.6)',
              lineHeight: 1,
            }}>
              Champion
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

// ── BracketTree ───────────────────────────────────────────────────────────────

interface BracketTreeProps {
  r32:      R32Matchup[]
  username: string
}

export function BracketTree({ r32, username }: BracketTreeProps) {
  const t      = useTranslations('simulate')
  const locale = useLocale()
  const [picks, setPicks] = useState<Record<string, string>>({})
  const bracketRef = useRef<HTMLDivElement>(null)

  const handlePick = useCallback((matchKey: string, team: string) => {
    setPicks(prev => {
      const next = { ...prev }
      if (next[matchKey] === team) {
        delete next[matchKey]
        for (const dk of getDownstreamKeys(matchKey)) delete next[dk]
        return next
      }
      const prev_ = next[matchKey]
      next[matchKey] = team
      if (prev_ && prev_ !== team) {
        for (const dk of getDownstreamKeys(matchKey)) delete next[dk]
      }
      return next
    })
  }, [])

  const autoSimulate = useCallback(() => {
    setPicks(() => {
      const next: Record<string, string> = {}
      const allKeys = [
        ...BRACKET_STRUCTURE.R32,
        ...BRACKET_STRUCTURE.R16,
        ...BRACKET_STRUCTURE.QF,
        ...BRACKET_STRUCTURE.SF,
        ...BRACKET_STRUCTURE.F,
      ]
      for (const matchKey of allKeys) {
        const [home, away] = getSeededTeams(matchKey, r32, next)
        if (home && away) next[matchKey] = Math.random() < 0.5 ? home : away
      }
      return next
    })
  }, [r32])

  const reset = useCallback(() => setPicks({}), [])

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleShare = useCallback(async () => {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      await exportBracketCanvas(r32, picks, locale, username)
    } catch {
      setExportError(t('export_error'))
    } finally {
      setExporting(false)
    }
  }, [r32, picks, locale, exporting, username, t])

  const renderMatch = (matchKey: string) => {
    const [home, away] = getSeededTeams(matchKey, r32, picks)
    return (
      <BracketMatch
        key={matchKey}
        matchKey={matchKey}
        home={home}
        away={away}
        pick={picks[matchKey] ?? null}
        onPick={handlePick}
        isFinal={matchKey === 'F_1'}
      />
    )
  }

  const btnBase = 'px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200'

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={autoSimulate}
            className={`${btnBase} text-[#f0b429] border border-[rgba(240,180,41,0.25)] hover:bg-[rgba(240,180,41,0.1)]`}
          >
            {t('auto_simulate')}
          </button>
          <button
            onClick={reset}
            className={`${btnBase} text-[#5a6a82] border border-white/[0.08] hover:bg-white/[0.05] hover:text-white`}
          >
            {t('reset')}
          </button>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleShare}
            disabled={exporting}
            className={`${btnBase} border border-white/[0.08] flex items-center gap-1.5 transition-all
              ${exporting
                ? 'text-[#f0b429] border-[rgba(240,180,41,0.25)] cursor-wait'
                : 'text-[#6b7f96] hover:bg-white/[0.05] hover:text-white cursor-pointer'
              }`}
          >
            <span>{exporting ? '…' : '↓'}</span>
            {exporting ? t('share_image_loading') : t('share_image')}
          </button>
          {exportError && (
            <span className="text-[10px] text-red-400/80">{exportError}</span>
          )}
        </div>
      </div>

      {/* Bracket scroll container — scrolls on small screens, fits on ≥1360px */}
      <div
        ref={bracketRef}
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          paddingBottom: 24,
          background: '#0a1018',
        }}
      >
        {/* Round header labels */}
        <div style={{ display: 'flex', gap: COL_GAP, marginBottom: 12, width: TOTAL_W, flexShrink: 0 }}>
          {/* Left headers: R32 → SF */}
          {HALF_ROUNDS.map(r => (
            <div
              key={`lh-${r}`}
              style={{
                width: COL_W,
                flexShrink: 0,
                textAlign: 'center',
                paddingBottom: 7,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-oswald)',
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: ROUND_HEADER_COLORS[r],
              }}>
                {ROUND_LABELS[r]}
              </span>
            </div>
          ))}
          {/* Center Final header */}
          <div
            style={{
              width: COL_W,
              flexShrink: 0,
              textAlign: 'center',
              paddingBottom: 7,
              borderBottom: '1px solid rgba(240,180,41,0.3)',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-oswald)',
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: ROUND_HEADER_COLORS['F'],
            }}>
              {ROUND_LABELS['F']}
            </span>
          </div>
          {/* Right headers: SF → R32 (mirror of left) */}
          {([...HALF_ROUNDS].reverse() as HalfRoundKey[]).map(r => (
            <div
              key={`rh-${r}`}
              style={{
                width: COL_W,
                flexShrink: 0,
                textAlign: 'center',
                paddingBottom: 7,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-oswald)',
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: ROUND_HEADER_COLORS[r],
              }}>
                {ROUND_LABELS[r]}
              </span>
            </div>
          ))}
        </div>

        {/* Bracket grid — position:relative anchors SVG and champion banner */}
        <div style={{ position: 'relative', height: HALF_H, width: TOTAL_W, flexShrink: 0 }}>

          {/* Subtle Final column highlight */}
          <div style={{
            position: 'absolute',
            left: 4 * (COL_W + COL_GAP) - 6,
            top: 0,
            width: COL_W + 12,
            height: HALF_H,
            background: 'linear-gradient(to bottom, rgba(240,180,41,0.015), rgba(240,180,41,0.04), rgba(240,180,41,0.015))',
            borderLeft:  '1px solid rgba(240,180,41,0.08)',
            borderRight: '1px solid rgba(240,180,41,0.08)',
            pointerEvents: 'none',
          }} />

          <BracketConnectors />

          {picks['F_1'] && (
            <ChampionBanner key={picks['F_1']} team={picks['F_1']} locale={locale} />
          )}

          {/* Columns */}
          <div style={{ position: 'relative', display: 'flex', gap: COL_GAP, zIndex: 1 }}>

            {/* Left half: R32 | R16 | QF | SF */}
            {HALF_ROUNDS.map(r => {
              const { paddingTop, gap } = HALF_LAYOUTS[r]
              return (
                <div key={`lc-${r}`} style={{ width: COL_W, flexShrink: 0, paddingTop }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap }}>
                    {LEFT_MATCHES[r].map(renderMatch)}
                  </div>
                </div>
              )
            })}

            {/* Center: Final */}
            <div style={{ width: COL_W, flexShrink: 0, paddingTop: FINAL_PT }}>
              {renderMatch('F_1')}
            </div>

            {/* Right half: SF | QF | R16 | R32 (center outward) */}
            {([...HALF_ROUNDS].reverse() as HalfRoundKey[]).map(r => {
              const { paddingTop, gap } = HALF_LAYOUTS[r]
              return (
                <div key={`rc-${r}`} style={{ width: COL_W, flexShrink: 0, paddingTop }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap }}>
                    {RIGHT_MATCHES[r].map(renderMatch)}
                  </div>
                </div>
              )
            })}

          </div>
        </div>
      </div>
    </div>
  )
}
