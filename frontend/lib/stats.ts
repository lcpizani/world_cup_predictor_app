import type { Match, Prediction } from '@/types/api'

export function computeAccuracy(
  predictions: Prediction[],
  matches: Match[]
): { correctOutcomes: number; exactScores: number; total: number } {
  const finishedById = new Map(
    matches.filter((m) => m.status === 'finished').map((m) => [m.id, m])
  )

  let correctOutcomes = 0
  let exactScores = 0
  let total = 0

  for (const p of predictions) {
    const m = finishedById.get(p.match_id)
    if (!m || m.home_score === null || m.away_score === null) continue
    total++
    const predSign = Math.sign(p.predicted_home - p.predicted_away)
    const actualSign = Math.sign(m.home_score - m.away_score)
    if (predSign === actualSign) correctOutcomes++
    if (p.predicted_home === m.home_score && p.predicted_away === m.away_score) exactScores++
  }

  return { correctOutcomes, exactScores, total }
}

export function formatCountdown(kickoffAt: string): string {
  const now = Date.now()
  const diff = new Date(kickoffAt).getTime() - now

  if (diff <= 0) return 'Now'

  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)

  if (days >= 2) return `in ${days} days`
  if (days === 1) return 'Tomorrow'
  if (hours >= 1) return `in ${hours}h ${mins % 60}m`
  return `in ${mins}m`
}
