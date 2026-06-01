import { formatInTimeZone } from 'date-fns-tz'

const DEFAULT_TZ = 'UTC'

export function formatInUserTz(
  date: string | Date,
  formatStr: string,
  timezone?: string | null
): string {
  const tz = timezone || DEFAULT_TZ
  const d = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(d, tz, formatStr)
}

export function formatMatchDate(date: string | Date, timezone?: string | null): string {
  return formatInUserTz(date, 'MMM d', timezone)
}

export function formatMatchTime(date: string | Date, timezone?: string | null): string {
  return formatInUserTz(date, 'h:mm a', timezone)
}

export function formatMatchDateTime(date: string | Date, timezone?: string | null): string {
  return formatInUserTz(date, 'EEE, MMM d · h:mm a', timezone)
}

export function formatShortDateTime(date: string | Date, timezone?: string | null): string {
  return formatInUserTz(date, 'EEE MMM d, h:mm aa', timezone)
}
