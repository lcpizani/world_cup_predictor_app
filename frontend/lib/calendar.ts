import { formatInTimeZone } from 'date-fns-tz'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, addWeeks, subMonths, subWeeks,
  isSameMonth,
} from 'date-fns'
import type { Match } from '@/types/api'

const DEFAULT_TZ = 'UTC'

export function groupMatchesByDate(matches: Match[], timezone?: string | null): Map<string, Match[]> {
  const tz = timezone || DEFAULT_TZ
  const map = new Map<string, Match[]>()
  for (const m of matches) {
    const key = formatInTimeZone(new Date(m.kickoff_at), tz, 'yyyy-MM-dd')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  map.forEach(g => g.sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()))
  return map
}

// Returns 6 week arrays (each 7 Date slots) anchored to the month of `date`
export function getCalendarWeeks(date: Date): Date[][] {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const weeks: Date[][] = []
  let current = gridStart
  while (current <= gridEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(current)
      current = addDays(current, 1)
    }
    weeks.push(week)
  }
  return weeks
}

// Returns the 7 days of the week containing `date` (Mon–Sun)
export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isCurrentMonth(date: Date, anchor: Date): boolean {
  return isSameMonth(date, anchor)
}

export function navigateMonth(anchor: Date, direction: 1 | -1): Date {
  return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1)
}

export function navigateWeek(anchor: Date, direction: 1 | -1): Date {
  return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1)
}
