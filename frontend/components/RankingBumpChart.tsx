'use client'

import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { RankingHistorySeries } from '@/types/api'
import { RANKING_PALETTE } from '@/lib/ranking-colors'

interface Props {
  matchDays: string[]
  series: RankingHistorySeries[]
  currentUserId: string
  selectedUserIds: Set<string>
  locale?: string
}

function fmtDay(iso: string, locale = 'en-US') {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function avoidCollisions(items: { id: string; y: number }[], gap = 20): Map<string, number> {
  const arr = [...items].sort((a, b) => a.y - b.y)
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].y < arr[i - 1].y + gap) arr[i] = { ...arr[i], y: arr[i - 1].y + gap }
  }
  return new Map(arr.map(it => [it.id, it.y]))
}

const VW = 900, VH = 440
const MT = 28, MR = 200, MB = 64, ML = 62
const CW = VW - ML - MR, CH = VH - MT - MB

export default function RankingBumpChart({ matchDays, series, currentUserId, selectedUserIds, locale = 'en-US' }: Props) {
  const t = useTranslations('leaderboard')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [hoverPct, setHoverPct] = useState(0)
  const [clipW, setClipW] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const n = matchDays.length

  useEffect(() => {
    setClipW(0)
    const start = performance.now()
    const total = CW + MR
    let raf: number
    function tick(now: number) {
      const t = Math.min(1, (now - start) / 1400)
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      setClipW(ease * total)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [matchDays, series])

  const sel = useMemo(
    () => series.filter(s => selectedUserIds.has(s.user.id)),
    [series, selectedUserIds]
  )

  const colorOf = useMemo(
    () => new Map(series.map((s, i) => [s.user.id, RANKING_PALETTE[i % RANKING_PALETTE.length]])),
    [series]
  )

  const maxPts = useMemo(
    () => (sel.length === 0 ? 10 : Math.max(...sel.flatMap(s => s.points), 1)),
    [sel]
  )
  const yMax = useMemo(() => Math.max(Math.ceil(maxPts * 1.2 / 10) * 10, 10), [maxPts])
  const gridVals = useMemo(() => [1, 2, 3, 4, 5].map(i => (yMax / 5) * i), [yMax])

  const xPx = useCallback((i: number) => (n <= 1 ? ML + CW / 2 : ML + (i / (n - 1)) * CW), [n])
  const yPx = useCallback((pts: number) => MT + CH - Math.min(1, Math.max(0, pts / yMax)) * CH, [yMax])

  const buildLine = useCallback((pts: number[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xPx(i).toFixed(1)},${yPx(p).toFixed(1)}`).join(''),
    [xPx, yPx]
  )
  const buildArea = useCallback((pts: number[]) =>
    `${buildLine(pts)}L${xPx(n - 1).toFixed(1)},${(MT + CH).toFixed(1)}L${xPx(0).toFixed(1)},${(MT + CH).toFixed(1)}Z`,
    [buildLine, xPx, n]
  )

  // Current user drawn last (on top)
  const drawn = useMemo(
    () => [...sel].sort((a, b) =>
      a.user.id === currentUserId ? 1 : b.user.id === currentUserId ? -1 : 0
    ),
    [sel, currentUserId]
  )

  const labelY = useMemo(() => {
    if (!n) return new Map<string, number>()
    return avoidCollisions(drawn.map(s => ({ id: s.user.id, y: yPx(s.points[n - 1] ?? 0) })))
  }, [drawn, yPx, n])

  const xStep = Math.max(1, Math.ceil(n / 8))

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - r.left) / r.width) * VW
    setHoverPct((e.clientX - r.left) / r.width)
    if (n <= 1) { setHoverIdx(0); return }
    setHoverIdx(Math.max(0, Math.min(n - 1, Math.round((svgX - ML) / (CW / (n - 1))))))
  }

  if (!n) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl py-20"
        style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="text-center">
          <p className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide mb-2" style={{ color: '#2d3e52' }}>
            {t('graph_no_days')}
          </p>
          <p className="text-sm" style={{ color: '#3f5068' }}>{t('graph_no_days_desc')}</p>
        </div>
      </div>
    )
  }

  const tip = hoverIdx !== null
    ? drawn
        .map(s => ({
          user: s.user,
          color: colorOf.get(s.user.id) ?? RANKING_PALETTE[0],
          pts: s.points[hoverIdx] ?? 0,
          isCurrent: s.user.id === currentUserId,
        }))
        .sort((a, b) => b.pts - a.pts)
    : []

  const tipOnRight = hoverPct < 0.6

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        background: '#0a1220',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '16px' }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          {/* Gradient area fill — only for current user */}
          {drawn
            .filter(s => s.user.id === currentUserId)
            .map(s => {
              const c = colorOf.get(s.user.id) ?? RANKING_PALETTE[0]
              return (
                <linearGradient key={s.user.id} id={`ag-${s.user.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={c} stopOpacity="0" />
                </linearGradient>
              )
            })}

          {/* Animated clip — reveals lines left-to-right via React RAF */}
          <clipPath id="rc">
            <rect x={ML} y={0} width={clipW} height={VH} />
          </clipPath>
        </defs>

        {/* Horizontal grid lines */}
        {gridVals.map(v => (
          <g key={v}>
            <line
              x1={ML} y1={yPx(v)} x2={ML + CW} y2={yPx(v)}
              stroke="rgba(45,62,82,0.28)" strokeWidth="0.5" strokeDasharray="3 6"
            />
            <text
              x={ML - 10} y={yPx(v) + 5}
              textAnchor="end" fill="rgba(90,106,130,0.6)"
              fontSize="15" fontFamily="inherit"
            >
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/* Y-axis title */}
        <text
          x={14}
          y={MT + CH / 2}
          textAnchor="middle"
          fill="rgba(90,106,130,0.45)"
          fontSize="12"
          letterSpacing="2"
          fontFamily="inherit"
          transform={`rotate(-90, 14, ${MT + CH / 2})`}
        >
          {t('graph_axis_points')}
        </text>

        {/* Baseline */}
        <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="rgba(45,62,82,0.45)" strokeWidth="1" />

        {/* X-axis date labels */}
        {matchDays.map((d, i) => {
          if (i % xStep !== 0 && i !== n - 1) return null
          return (
            <text
              key={d}
              x={xPx(i)} y={MT + CH + 22}
              textAnchor="middle"
              fill="rgba(90,106,130,0.65)"
              fontSize="15" fontFamily="inherit"
            >
              {fmtDay(d, locale)}
            </text>
          )
        })}

        <text
          x={ML + CW / 2} y={VH - 2}
          textAnchor="middle" fill="rgba(90,106,130,0.45)"
          fontSize="11" letterSpacing="2" fontFamily="inherit"
        >
          {t('graph_axis_match_day')}
        </text>

        {/* --- Animated chart content --- */}
        <g clipPath="url(#rc)">
          {/* Area fills */}
          {drawn
            .filter(s => s.user.id === currentUserId)
            .map(s => (
              <path key={s.user.id} d={buildArea(s.points)} fill={`url(#ag-${s.user.id})`} />
            ))}

          {/* Lines */}
          {drawn.map(s => {
            const ic = s.user.id === currentUserId
            const c = colorOf.get(s.user.id) ?? RANKING_PALETTE[0]
            return (
              <path
                key={s.user.id}
                d={buildLine(s.points)}
                fill="none"
                stroke={c}
                strokeWidth={ic ? 2.5 : 1.5}
                strokeOpacity={ic ? 1 : 0.38}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={ic ? { filter: `drop-shadow(0 0 5px ${c}99)` } : undefined}
              />
            )
          })}

          {/* Data-point dots */}
          {drawn.map(s => {
            const ic = s.user.id === currentUserId
            const c = colorOf.get(s.user.id) ?? RANKING_PALETTE[0]
            return s.points.map((pts, i) => (
              <circle
                key={`${s.user.id}-${i}`}
                cx={xPx(i)} cy={yPx(pts)}
                r={ic ? 3.5 : 2}
                fill={c}
                fillOpacity={ic ? 1 : 0.4}
                stroke={ic ? '#0a1220' : 'none'}
                strokeWidth="1.5"
              />
            ))
          })}
        </g>

        {/* End-of-line labels (outside clip — always visible) */}
        {drawn.map(s => {
          const ic = s.user.id === currentUserId
          const c = colorOf.get(s.user.id) ?? RANKING_PALETTE[0]
          const lastPts = s.points[n - 1] ?? 0
          const lastRank = s.ranks[n - 1] ?? 0
          const lineY = yPx(lastPts)
          const ly = labelY.get(s.user.id) ?? lineY
          const ex = xPx(n - 1)

          return (
            <g key={`el-${s.user.id}`}>
              {/* Terminal dot */}
              <circle
                cx={ex} cy={lineY}
                r={ic ? 4.5 : 3}
                fill={c}
                fillOpacity={ic ? 1 : 0.55}
                stroke={ic ? '#0a1220' : 'none'}
                strokeWidth="1.5"
              />
              {/* Connector when label is offset from line end */}
              {Math.abs(ly - lineY) > 5 && (
                <line
                  x1={ex + 6} y1={lineY} x2={ex + 10} y2={ly}
                  stroke={c} strokeWidth="0.5" strokeOpacity="0.3"
                />
              )}
              {/* Rank badge */}
              {lastRank > 0 && (
                <>
                  <rect
                    x={ex + 10} y={ly - 10} width={24} height={18} rx="4"
                    fill={ic ? c : 'rgba(30,45,65,0.9)'}
                    fillOpacity={ic ? 0.2 : 1}
                    stroke={ic ? c : 'rgba(45,62,82,0.5)'}
                    strokeWidth="0.5"
                    strokeOpacity={ic ? 0.55 : 0.9}
                  />
                  <text
                    x={ex + 22} y={ly + 4}
                    textAnchor="middle"
                    fill={ic ? c : 'rgba(90,106,130,0.9)'}
                    fontSize="13" fontWeight="bold" fontFamily="inherit"
                  >
                    {lastRank}
                  </text>
                </>
              )}
              {/* Username */}
              <text
                x={ex + 38} y={ly + 4}
                fill={ic ? c : 'rgba(255,255,255,0.45)'}
                fontSize={ic ? 17 : 14}
                fontWeight={ic ? 'bold' : 'normal'}
                fontFamily="inherit"
              >
                {s.user.username}{ic ? ' ★' : ''}
              </text>
            </g>
          )
        })}

        {/* Hover crosshair + enlarged dots */}
        {hoverIdx !== null && (
          <g pointerEvents="none">
            <line
              x1={xPx(hoverIdx)} y1={MT}
              x2={xPx(hoverIdx)} y2={MT + CH}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1"
            />
            <line
              x1={xPx(hoverIdx)} y1={MT + CH}
              x2={xPx(hoverIdx)} y2={MT + CH + 6}
              stroke="rgba(255,255,255,0.2)" strokeWidth="1"
            />
            {drawn.map(s => {
              const ic = s.user.id === currentUserId
              const c = colorOf.get(s.user.id) ?? RANKING_PALETTE[0]
              return (
                <circle
                  key={s.user.id}
                  cx={xPx(hoverIdx)} cy={yPx(s.points[hoverIdx] ?? 0)}
                  r={ic ? 6 : 4}
                  fill={c}
                  fillOpacity={ic ? 1 : 0.55}
                  stroke={ic ? 'rgba(255,255,255,0.25)' : '#0a1220'}
                  strokeWidth={ic ? 2 : 1.5}
                />
              )
            })}
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      {hoverIdx !== null && tip.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '6%',
            ...(tipOnRight
              ? { left: `${hoverPct * 100 + 3}%` }
              : { right: `${(1 - hoverPct) * 100 + 3}%` }),
            pointerEvents: 'none',
            zIndex: 30,
          }}
        >
          <div
            style={{
              background: 'rgba(5, 10, 22, 0.97)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '10px',
              padding: '9px 12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
              minWidth: '152px',
            }}
          >
            <p
              style={{
                color: 'rgba(90,106,130,0.75)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}
            >
              {fmtDay(matchDays[hoverIdx], locale)}
            </p>
            {tip.map(({ user, color, pts, isCurrent }) => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: isCurrent ? '4px 6px' : '2px 0',
                  marginBottom: '2px',
                  borderRadius: '5px',
                  background: isCurrent ? `${color}18` : 'transparent',
                }}
              >
                <span
                  style={{
                    width: '8px', height: '8px',
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                    opacity: isCurrent ? 1 : 0.55,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    color: isCurrent ? color : 'rgba(255,255,255,0.5)',
                    fontSize: '13px',
                    fontWeight: isCurrent ? 700 : 400,
                  }}
                >
                  {user.username}
                </span>
                <span
                  style={{
                    color: isCurrent ? '#f0b429' : 'rgba(255,255,255,0.45)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {pts}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
