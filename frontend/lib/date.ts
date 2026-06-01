import { formatInTimeZone } from 'date-fns-tz'
import { ptBR, enUS } from 'date-fns/locale'
import type { Locale } from 'date-fns'

const DEFAULT_TZ = 'UTC'

function dfLocale(locale?: string | null): Locale {
  return locale === 'pt' ? ptBR : enUS
}

export function formatInUserTz(
  date: string | Date,
  formatStr: string,
  timezone?: string | null,
  locale?: string | null
): string {
  const tz = timezone || DEFAULT_TZ
  const d = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(d, tz, formatStr, { locale: dfLocale(locale) })
}

export function formatMatchDate(date: string | Date, timezone?: string | null, locale?: string | null): string {
  return formatInUserTz(date, 'MMM d', timezone, locale)
}

export function formatMatchTime(date: string | Date, timezone?: string | null, locale?: string | null): string {
  return formatInUserTz(date, 'h:mm a', timezone, locale)
}

export function formatMatchDateTime(date: string | Date, timezone?: string | null, locale?: string | null): string {
  return formatInUserTz(date, 'EEE, MMM d · h:mm a', timezone, locale)
}

export function formatShortDateTime(date: string | Date, timezone?: string | null, locale?: string | null): string {
  return formatInUserTz(date, 'EEE MMM d, h:mm aa', timezone, locale)
}
