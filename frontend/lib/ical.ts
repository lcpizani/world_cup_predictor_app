import type { Match } from '@/types/api'
import { translateTeamName } from '@/lib/flags'

const UID_DOMAIN = 'wcfootballpredictions.com'

function icalDate(iso: string): string {
  // "2026-06-24T15:00:00+00:00" → "20260624T150000Z"
  const d = new Date(iso)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function addHours(iso: string, hours: number): string {
  const d = new Date(iso)
  d.setHours(d.getHours() + hours)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function stageLabel(stage: string, group: string | null): string {
  const base = stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return group ? `${base} - ${group}` : base
}

export function buildIcs(matches: Match[], locale = 'en'): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const events = matches.map(m => {
    const home = translateTeamName(m.home_team, locale)
    const away = translateTeamName(m.away_team, locale)
    return [
      'BEGIN:VEVENT',
      `UID:match-${m.id}@${UID_DOMAIN}`,
      `SUMMARY:${home} vs ${away}`,
      `DTSTART:${icalDate(m.kickoff_at)}`,
      `DTEND:${addHours(m.kickoff_at, 2)}`,
      `DESCRIPTION:${stageLabel(m.stage, m.group)}`,
      `DTSTAMP:${now}`,
      'END:VEVENT',
    ].join('\r\n')
  }).join('\r\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//WC Football Predictions//${UID_DOMAIN}//EN`,
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:WC 2026 Fixtures',
    events,
    'END:VCALENDAR',
  ].join('\r\n')
}

export function triggerIcsDownload(matches: Match[], locale = 'en'): void {
  const content = buildIcs(matches, locale)
  const blob = new Blob([content], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'wc2026-fixtures.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
