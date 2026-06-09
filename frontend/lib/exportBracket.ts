import { getTeamFlagCode, getFlagUrl, translateTeamName } from '@/lib/flags'
import { getSeededTeams, BRACKET_STRUCTURE } from '@/lib/simulation'
import type { R32Matchup } from '@/lib/simulation'

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_H = 68
const CARD_W = 155
const COL_GAP = 16
const R32_GAP = 4
const TITLE_H = 48
const HDR_H = 28
const PAD = 20
const SCALE = 2

// ── Bracket halves ────────────────────────────────────────────────────────────
// Left:  R32[0..7] → R16[0..3] → QF[0..1] → SF[0] → Final
// Right: R32[8..15] → R16[4..7] → QF[2..3] → SF[1] → Final
const LEFT_R32 = BRACKET_STRUCTURE.R32.slice(0, 8)
const RIGHT_R32 = BRACKET_STRUCTURE.R32.slice(8)
const LEFT_R16 = BRACKET_STRUCTURE.R16.slice(0, 4)
const RIGHT_R16 = BRACKET_STRUCTURE.R16.slice(4)
const LEFT_QF = BRACKET_STRUCTURE.QF.slice(0, 2)
const RIGHT_QF = BRACKET_STRUCTURE.QF.slice(2)
const LEFT_SF = [BRACKET_STRUCTURE.SF[0]]
const RIGHT_SF = [BRACKET_STRUCTURE.SF[1]]
const FINAL_KEY = BRACKET_STRUCTURE.F[0]

// ── Color palette (mirrors app theme) ────────────────────────────────────────
const C = {
  bg: '#080c14',
  card: '#0d1826',
  border: 'rgba(255,255,255,0.09)',
  borderF: 'rgba(240,180,41,0.45)',
  divider: 'rgba(255,255,255,0.05)',
  conn: 'rgba(255,255,255,0.11)',
  hdrNorm: '#3a5070',
  hdrFinal: '#f0b429',
  title: '#f0b429',
  titleSub: '#4a6080',
  teamNorm: '#7a9ab8',
  teamWin: '#f0b429',
  teamElim: 'rgba(122,154,184,0.28)',
  teamTbd: '#253545',
  winBg: 'rgba(240,180,41,0.07)',
  flagBrd: 'rgba(255,255,255,0.09)',
}

// ── Compute y-positions via binary-tree recurrence (8-match R32 per side) ────
function computeLayouts(): Record<string, { gap: number; pt: number }> {
  const rounds = ['R32', 'R16', 'QF', 'SF', 'F']
  const out: Record<string, { gap: number; pt: number }> = {}
  let gap = R32_GAP
  let pt = 0
  for (const r of rounds) {
    out[r] = { gap, pt: Math.round(pt) }
    const g0 = gap
    gap = CARD_H + 2 * g0
    pt = pt + (CARD_H + g0) / 2
  }
  return out
}

// ── Image pre-loading ─────────────────────────────────────────────────────────
async function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function preloadFlags(teams: (string | null)[]): Promise<Map<string, HTMLImageElement>> {
  const codes = new Set<string>()
  for (const t of teams) {
    if (t) { const c = getTeamFlagCode(t); if (c) codes.add(c) }
  }
  const pairs = await Promise.all(
    Array.from(codes).map(async code => {
      const img = await loadImg(getFlagUrl(code, 40))
      return [code, img] as const
    })
  )
  const map = new Map<string, HTMLImageElement>()
  for (const [code, img] of pairs) { if (img) map.set(code, img) }
  return map
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  home: string | null,
  away: string | null,
  pick: string | null,
  isFinal: boolean,
  flags: Map<string, HTMLImageElement>,
  locale: string,
) {
  const s = SCALE
  const cx = x * s, cy = y * s, cw = CARD_W * s, ch = CARD_H * s
  const r = 6 * s

  // Card fill
  roundRect(ctx, cx, cy, cw, ch, r)
  ctx.fillStyle = C.card
  ctx.fill()

  // Card border
  roundRect(ctx, cx, cy, cw, ch, r)
  ctx.strokeStyle = isFinal ? C.borderF : C.border
  ctx.lineWidth = (isFinal ? 1.5 : 1) * s
  ctx.stroke()

  // Divider
  const mid = cy + ch / 2
  ctx.fillStyle = C.divider
  ctx.fillRect(cx + 8 * s, mid - 0.5 * s, cw - 16 * s, s)

  // Rows
  const rows = [
    { team: home, isTop: true },
    { team: away, isTop: false },
  ]

  for (const { team, isTop } of rows) {
    const rowY = isTop ? cy : mid + 0.5 * s
    const rowH = ch / 2 - 0.5 * s
    const centerY = rowY + rowH / 2

    const isPicked = !!pick && pick === team && !!team
    const isElim = !!pick && pick !== team && !!team

    // Winner row highlight
    if (isPicked) {
      ctx.save()
      roundRect(ctx, cx, cy, cw, ch, r)
      ctx.clip()
      ctx.fillStyle = C.winBg
      ctx.fillRect(cx, rowY, cw, rowH)
      ctx.restore()
    }

    if (!team) {
      // Flag placeholder
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(cx + 8 * s, centerY - 7 * s, 20 * s, 14 * s)
      ctx.fillStyle = C.teamTbd
      ctx.font = `400 ${9 * s}px system-ui, Arial, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('TBD', cx + 33 * s, centerY)
    } else {
      // Flag
      const code = getTeamFlagCode(team)
      const flagImg = code ? flags.get(code) : undefined
      const fx = cx + 8 * s, fy = centerY - 7 * s
      const fw = 20 * s, fh = 14 * s

      ctx.save()
      ctx.beginPath()
      ctx.rect(fx, fy, fw, fh)
      ctx.clip()
      if (flagImg) {
        ctx.drawImage(flagImg, fx, fy, fw, fh)
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(fx, fy, fw, fh)
      }
      ctx.restore()

      ctx.strokeStyle = C.flagBrd
      ctx.lineWidth = 0.5 * s
      ctx.strokeRect(fx + 0.25 * s, fy + 0.25 * s, fw - 0.5 * s, fh - 0.5 * s)

      // Name
      const name = translateTeamName(team, locale)
      const maxW = cw - (8 + 20 + 6 + 8) * s  // left-pad + flag + gap + right-pad
      ctx.fillStyle = isElim ? C.teamElim : isPicked ? C.teamWin : C.teamNorm
      ctx.font = `${isPicked ? 700 : 500} ${10 * s}px system-ui, Arial, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'

      // Truncate if needed, accounting for ellipsis width
      let label = name
      if (ctx.measureText(label).width > maxW) {
        while (ctx.measureText(label + '…').width > maxW && label.length > 3) {
          label = label.slice(0, -1)
        }
        label = label + '…'
      }

      ctx.fillText(label, cx + 33 * s, centerY)

      // Winner badge
      if (isPicked) {
        ctx.fillStyle = C.teamWin
        ctx.font = `700 ${8 * s}px system-ui, Arial, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText('✓', cx + cw - 7 * s, centerY)
      }
    }
  }
}

// ── Draw connector lines ──────────────────────────────────────────────────────
function drawLeftConnectors(
  ctx: CanvasRenderingContext2D,
  layouts: Record<string, { gap: number; pt: number }>,
  contentTop: number,
  colX: (i: number) => number,
) {
  const s = SCALE
  ctx.strokeStyle = C.conn
  ctx.lineWidth = 1 * s
  ctx.lineCap = 'round'

  const transitions = [
    { from: 'R32', to: 'R16', toN: 4, fromCol: 0, toCol: 1 },
    { from: 'R16', to: 'QF', toN: 2, fromCol: 1, toCol: 2 },
    { from: 'QF', to: 'SF', toN: 1, fromCol: 2, toCol: 3 },
  ]

  for (const { from, to, toN, fromCol, toCol } of transitions) {
    const la = layouts[from]
    const lb = layouts[to]
    const xAR = (colX(fromCol) + CARD_W) * s
    const xBL = colX(toCol) * s
    const mx = (xAR + xBL) / 2

    ctx.beginPath()
    for (let k = 0; k < toN; k++) {
      const y1 = (contentTop + la.pt + (2 * k) * (CARD_H + la.gap) + CARD_H / 2) * s
      const y2 = (contentTop + la.pt + (2 * k + 1) * (CARD_H + la.gap) + CARD_H / 2) * s
      const ym = (contentTop + lb.pt + k * (CARD_H + lb.gap) + CARD_H / 2) * s
      ctx.moveTo(xAR, y1); ctx.lineTo(mx, y1)
      ctx.moveTo(xAR, y2); ctx.lineTo(mx, y2)
      ctx.moveTo(mx, y1); ctx.lineTo(mx, y2)
      ctx.moveTo(mx, ym); ctx.lineTo(xBL, ym)
    }
    ctx.stroke()
  }
}

function drawRightConnectors(
  ctx: CanvasRenderingContext2D,
  layouts: Record<string, { gap: number; pt: number }>,
  contentTop: number,
  colX: (i: number) => number,
) {
  const s = SCALE
  ctx.strokeStyle = C.conn
  ctx.lineWidth = 1 * s
  ctx.lineCap = 'round'

  // Mirror of left: from is the outer (R32_R=col8) col, to is the inner col
  const transitions = [
    { from: 'R32', to: 'R16', toN: 4, fromCol: 8, toCol: 7 },
    { from: 'R16', to: 'QF', toN: 2, fromCol: 7, toCol: 6 },
    { from: 'QF', to: 'SF', toN: 1, fromCol: 6, toCol: 5 },
  ]

  for (const { from, to, toN, fromCol, toCol } of transitions) {
    const la = layouts[from]
    const lb = layouts[to]
    const xAL = colX(fromCol) * s           // LEFT edge of outer col (exit toward center)
    const xBR = (colX(toCol) + CARD_W) * s  // RIGHT edge of inner col (entry)
    const mx = (xAL + xBR) / 2

    ctx.beginPath()
    for (let k = 0; k < toN; k++) {
      const y1 = (contentTop + la.pt + (2 * k) * (CARD_H + la.gap) + CARD_H / 2) * s
      const y2 = (contentTop + la.pt + (2 * k + 1) * (CARD_H + la.gap) + CARD_H / 2) * s
      const ym = (contentTop + lb.pt + k * (CARD_H + lb.gap) + CARD_H / 2) * s
      ctx.moveTo(xAL, y1); ctx.lineTo(mx, y1)
      ctx.moveTo(xAL, y2); ctx.lineTo(mx, y2)
      ctx.moveTo(mx, y1); ctx.lineTo(mx, y2)
      ctx.moveTo(mx, ym); ctx.lineTo(xBR, ym)
    }
    ctx.stroke()
  }
}

function drawSFToFinal(
  ctx: CanvasRenderingContext2D,
  layouts: Record<string, { gap: number; pt: number }>,
  contentTop: number,
  colX: (i: number) => number,
) {
  // Both SFs and the Final sit at the same vertical centre.
  // Just draw a straight H-line on each side.
  const s = SCALE
  const cy = (contentTop + layouts.SF.pt + CARD_H / 2) * s

  ctx.strokeStyle = C.conn
  ctx.lineWidth = 1 * s
  ctx.lineCap = 'round'
  ctx.beginPath()
  // Left SF → Final
  ctx.moveTo((colX(3) + CARD_W) * s, cy)
  ctx.lineTo(colX(4) * s, cy)
  // Right SF → Final
  ctx.moveTo(colX(5) * s, cy)
  ctx.lineTo((colX(4) + CARD_W) * s, cy)
  ctx.stroke()
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function exportBracketCanvas(
  r32: R32Matchup[],
  picks: Record<string, string>,
  locale: string,
  username: string,
): Promise<void> {
  const layouts = computeLayouts()
  const s = SCALE
  const champion = picks[BRACKET_STRUCTURE.F[0]] ?? null

  // Collect all teams for flag pre-loading
  const allKeys = [
    ...BRACKET_STRUCTURE.R32,
    ...BRACKET_STRUCTURE.R16,
    ...BRACKET_STRUCTURE.QF,
    ...BRACKET_STRUCTURE.SF,
    ...BRACKET_STRUCTURE.F,
  ]
  const allTeams = allKeys.flatMap(k => {
    const [h, a] = getSeededTeams(k, r32, picks)
    return [h, a]
  })

  // Load flags + trophy in parallel
  const [flags, trophyImg] = await Promise.all([
    preloadFlags(allTeams),
    loadImg(window.location.origin + '/trophy.png'),
  ])

  // Canvas dimensions — champion banner fits in the center-column space, no extra height
  const contentH = 8 * CARD_H + 7 * R32_GAP
  const totalW = 9 * CARD_W + 8 * COL_GAP + 2 * PAD
  const totalH = TITLE_H + HDR_H + contentH + 2 * PAD

  const canvas = document.createElement('canvas')
  canvas.width = totalW * s
  canvas.height = totalH * s
  const ctx = canvas.getContext('2d')!

  // ── Background ───────────────────────────────────────────────────────────
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Subtle vertical center glow behind the Final column
  const grad = ctx.createRadialGradient(
    (totalW / 2) * s, (totalH / 2) * s, 0,
    (totalW / 2) * s, (totalH / 2) * s, 260 * s,
  )
  grad.addColorStop(0, 'rgba(240,180,41,0.05)')
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // ── Title bar ────────────────────────────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = C.title
  ctx.font = `700 ${16 * s}px system-ui, Arial, sans-serif`
  ctx.fillText('FIFA WORLD CUP 2026', (totalW / 2) * s, (TITLE_H * 0.38) * s)

  ctx.fillStyle = C.titleSub
  ctx.font = `400 ${9.5 * s}px system-ui, Arial, sans-serif`
  ctx.fillText(`${username}'s bracket`, (totalW / 2) * s, (TITLE_H * 0.72) * s)

  // ── Column x helper ──────────────────────────────────────────────────────
  const colX = (i: number) => PAD + i * (CARD_W + COL_GAP)

  // ── Round headers ────────────────────────────────────────────────────────
  const headers = [
    { col: 0, label: 'ROUND OF 32' },
    { col: 1, label: 'ROUND OF 16' },
    { col: 2, label: 'QTR FINALS' },
    { col: 3, label: 'SEMI FINALS' },
    { col: 4, label: 'FINAL' },
    { col: 5, label: 'SEMI FINALS' },
    { col: 6, label: 'QTR FINALS' },
    { col: 7, label: 'ROUND OF 16' },
    { col: 8, label: 'ROUND OF 32' },
  ]

  for (const { col, label } of headers) {
    const hx = (colX(col) + CARD_W / 2) * s
    const hy = (TITLE_H + HDR_H / 2) * s
    const isFinalCol = col === 4

    ctx.fillStyle = isFinalCol ? C.hdrFinal : C.hdrNorm
    ctx.font = `700 ${8.5 * s}px system-ui, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, hx, hy)

    // Header underline
    ctx.fillStyle = isFinalCol ? 'rgba(240,180,41,0.18)' : 'rgba(255,255,255,0.04)'
    ctx.fillRect(colX(col) * s, (TITLE_H + HDR_H - 1.5) * s, CARD_W * s, 1.5 * s)
  }

  // ── Content top offset ───────────────────────────────────────────────────
  const contentTop = TITLE_H + HDR_H + PAD

  const cardY = (round: string, idx: number) =>
    contentTop + layouts[round].pt + idx * (CARD_H + layouts[round].gap)

  // ── Connectors ───────────────────────────────────────────────────────────
  drawLeftConnectors(ctx, layouts, contentTop, colX)
  drawRightConnectors(ctx, layouts, contentTop, colX)
  drawSFToFinal(ctx, layouts, contentTop, colX)

  // ── Match cards ──────────────────────────────────────────────────────────
  const drawColumn = (
    matchKeys: string[],
    round: string,
    col: number,
    isFinal: boolean,
  ) => {
    matchKeys.forEach((key, idx) => {
      const [home, away] = getSeededTeams(key, r32, picks)
      drawCard(
        ctx,
        colX(col), cardY(round, idx),
        home, away,
        picks[key] ?? null,
        isFinal,
        flags,
        locale,
      )
    })
  }

  // Left half
  drawColumn(LEFT_R32, 'R32', 0, false)
  drawColumn(LEFT_R16, 'R16', 1, false)
  drawColumn(LEFT_QF, 'QF', 2, false)
  drawColumn(LEFT_SF, 'SF', 3, false)

  // Final — placed at the same vertical position as the SF matches
  const [finalHome, finalAway] = getSeededTeams(FINAL_KEY, r32, picks)
  drawCard(
    ctx,
    colX(4), cardY('SF', 0),
    finalHome, finalAway,
    picks[FINAL_KEY] ?? null,
    true,
    flags,
    locale,
  )

  // Right half
  drawColumn(RIGHT_SF, 'SF', 5, false)
  drawColumn(RIGHT_QF, 'QF', 6, false)
  drawColumn(RIGHT_R16, 'R16', 7, false)
  drawColumn(RIGHT_R32, 'R32', 8, false)

  // ── Champion banner (below the Final card, in the center-column space) ──────
  if (champion) {
    const champName = translateTeamName(champion, locale)
    const champCode = getTeamFlagCode(champion)
    const champFlag = champCode ? flags.get(champCode) : undefined

    // Final card bottom edge
    const finalColCx = colX(4) + CARD_W / 2
    const finalBottom = contentTop + layouts.SF.pt + CARD_H
    const CONN_H = 12

    // Banner width = Final column width — mirrors web UI exactly
    const BW    = CARD_W
    const PAD_X = 12   // matches web padding: 11px 12px 13px
    const PAD_TOP = 11
    const PAD_BOT = 13

    // Trophy: 44px wide (same as web), preserve aspect ratio
    const TROPHY_W = 44
    let   TROPHY_H = Math.round(TROPHY_W * (60 / 48))
    if (trophyImg && trophyImg.naturalWidth > 0 && trophyImg.naturalHeight > 0) {
      TROPHY_H = Math.round(TROPHY_W * (trophyImg.naturalHeight / trophyImg.naturalWidth))
    }

    // Web UI font sizes / gaps (all in CSS px, multiplied by s when drawn)
    const FS_LABEL  = 7    // web: fontSize 7, marginBottom 7
    const GAP_LABEL = 7
    const GAP_TROPHY = 10  // web: marginBottom 10
    const GAP_NAME  = 9    // web: marginBottom 9
    const GAP_DIV   = 9    // web: margin '0 10px 9px'
    const FH_BADGE  = 13   // flag height (web: 13)
    const FW_FLAG   = 18   // flag width  (web: 18)
    const FS_BADGE  = 8.5  // badge text  (web: 8.5)
    const BADGE_GAP = 5

    // Name font — measure and scale to fit inner width (mirrors web nameFontSize logic)
    let nameFontSize = 24
    const nameUpper = champName.toUpperCase()
    ctx.font = `800 ${nameFontSize * s}px system-ui, Arial, sans-serif`
    while (ctx.measureText(nameUpper).width > (BW - PAD_X * 2) * s && nameFontSize > 14) {
      nameFontSize--
      ctx.font = `800 ${nameFontSize * s}px system-ui, Arial, sans-serif`
    }
    const NAME_LH = Math.round(nameFontSize * 1.05)  // web: lineHeight 1.05

    // Total banner height — sum of all layers, matching web structure
    const BH =
      PAD_TOP +
      FS_LABEL + GAP_LABEL +
      TROPHY_H + GAP_TROPHY +
      NAME_LH  + GAP_NAME  +
      1 + GAP_DIV +
      FH_BADGE +
      PAD_BOT

    const bannerX = finalColCx - BW / 2
    const bannerY = finalBottom + CONN_H

    // Connector
    const connGrad = ctx.createLinearGradient(0, finalBottom * s, 0, bannerY * s)
    connGrad.addColorStop(0, 'rgba(240,180,41,0.45)')
    connGrad.addColorStop(1, 'rgba(240,180,41,0.05)')
    ctx.fillStyle = connGrad
    ctx.fillRect((finalColCx - 0.5) * s, finalBottom * s, 1 * s, CONN_H * s)

    // Banner background
    roundRect(ctx, bannerX * s, bannerY * s, BW * s, BH * s, 10 * s)
    ctx.fillStyle = 'rgba(240,180,41,0.04)'
    ctx.fill()
    roundRect(ctx, bannerX * s, bannerY * s, BW * s, BH * s, 10 * s)
    ctx.strokeStyle = 'rgba(240,180,41,0.32)'
    ctx.lineWidth = 1 * s
    ctx.stroke()

    // Radial glow
    const bannerGlow = ctx.createRadialGradient(
      finalColCx * s, (bannerY + BH / 2) * s, 0,
      finalColCx * s, (bannerY + BH / 2) * s, (BW * 0.7) * s,
    )
    bannerGlow.addColorStop(0, 'rgba(240,180,41,0.09)')
    bannerGlow.addColorStop(1, 'transparent')
    ctx.save()
    roundRect(ctx, bannerX * s, bannerY * s, BW * s, BH * s, 10 * s)
    ctx.clip()
    ctx.fillStyle = bannerGlow
    ctx.fillRect(bannerX * s, bannerY * s, BW * s, BH * s)
    ctx.restore()

    // Use top-anchored baseline so ty tracks the TOP of each element, matching CSS block flow
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'top'
    let ty = bannerY + PAD_TOP

    // Pre-label
    ctx.fillStyle = 'rgba(240,180,41,0.35)'
    ctx.font = `600 ${FS_LABEL * s}px system-ui, Arial, sans-serif`
    ctx.fillText('2026 FIFA WORLD CUP', finalColCx * s, ty * s)
    ty += FS_LABEL + GAP_LABEL

    // Trophy
    if (trophyImg) {
      ctx.drawImage(trophyImg, (finalColCx - TROPHY_W / 2) * s, ty * s, TROPHY_W * s, TROPHY_H * s)
    }
    ty += TROPHY_H + GAP_TROPHY

    // Team name — gold gradient, hero element
    ctx.font = `800 ${nameFontSize * s}px system-ui, Arial, sans-serif`
    const measuredNameW = ctx.measureText(nameUpper).width / s
    const nameGrad = ctx.createLinearGradient(
      (finalColCx - measuredNameW / 2) * s, 0,
      (finalColCx + measuredNameW / 2) * s, 0,
    )
    nameGrad.addColorStop(0,    '#b06810')
    nameGrad.addColorStop(0.28, '#f0b429')
    nameGrad.addColorStop(0.52, '#fde68a')
    nameGrad.addColorStop(0.76, '#f0b429')
    nameGrad.addColorStop(1,    '#b06810')
    ctx.fillStyle = nameGrad
    ctx.fillText(nameUpper, finalColCx * s, ty * s)
    ty += NAME_LH + GAP_NAME

    // Thin gold divider
    const divGrad = ctx.createLinearGradient(
      (finalColCx - (BW - PAD_X * 2) / 2) * s, 0,
      (finalColCx + (BW - PAD_X * 2) / 2) * s, 0,
    )
    divGrad.addColorStop(0,   'transparent')
    divGrad.addColorStop(0.5, 'rgba(240,180,41,0.5)')
    divGrad.addColorStop(1,   'transparent')
    ctx.fillStyle = divGrad
    ctx.fillRect((finalColCx - (BW - PAD_X * 2) / 2) * s, ty * s, (BW - PAD_X * 2) * s, 1 * s)
    ty += 1 + GAP_DIV

    // Flag + "CHAMPION" badge — centered as a unit (web: inline-flex, gap 5)
    ctx.font = `700 ${FS_BADGE * s}px system-ui, Arial, sans-serif`
    const badgeText  = 'CHAMPION'
    const badgeTextW = ctx.measureText(badgeText).width / s
    const rowW   = (champFlag ? FW_FLAG + BADGE_GAP : 0) + badgeTextW
    const rowLeft = finalColCx - rowW / 2
    const rowMidY = ty + FH_BADGE / 2

    if (champFlag) {
      const flagTop = ty  // vertically centered in row (FH_BADGE === row height)
      ctx.save()
      ctx.beginPath()
      ctx.rect(rowLeft * s, flagTop * s, FW_FLAG * s, FH_BADGE * s)
      ctx.clip()
      ctx.drawImage(champFlag, rowLeft * s, flagTop * s, FW_FLAG * s, FH_BADGE * s)
      ctx.restore()
      ctx.strokeStyle = C.flagBrd
      ctx.lineWidth = 0.5 * s
      ctx.strokeRect(rowLeft * s, flagTop * s, FW_FLAG * s, FH_BADGE * s)
      ctx.fillStyle = 'rgba(240,180,41,0.6)'
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(badgeText, (rowLeft + FW_FLAG + BADGE_GAP) * s, rowMidY * s)
    } else {
      ctx.fillStyle    = 'rgba(240,180,41,0.6)'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(badgeText, finalColCx * s, rowMidY * s)
    }
    ty += FH_BADGE + PAD_BOT
  }

  // ── Download ─────────────────────────────────────────────────────────────
  const link = document.createElement('a')
  link.download = 'wc2026-bracket.png'
  link.href = canvas.toDataURL('image/png')
  link.click()
}
