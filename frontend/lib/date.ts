import { formatInTimeZone } from 'date-fns-tz'
import { ptBR, enUS } from 'date-fns/locale'
import type { Locale } from 'date-fns'

const DEFAULT_TZ = 'UTC'

function dfLocale(locale?: string | null): Locale {
  return locale === 'pt' ? ptBR : enUS
}

// date-fns v3 ptBR EEE outputs full forms ("segunda", "terça"…); v2 used dots ("seg.", "ter."…)
const PT_DAY_MAP: Record<string, string> = {
  'segunda': 'Seg', 'terça': 'Ter', 'quarta': 'Qua',
  'quinta': 'Qui', 'sexta': 'Sex', 'sábado': 'Sáb', 'domingo': 'Dom',
  'seg.': 'Seg', 'ter.': 'Ter', 'qua.': 'Qua',
  'qui.': 'Qui', 'sex.': 'Sex', 'sáb.': 'Sáb', 'dom.': 'Dom',
}

function applyPtDayAbbr(s: string): string {
  return s.replace(/segunda|terça|quarta|quinta|sexta|sábado|domingo|seg\.|ter\.|qua\.|qui\.|sex\.|sáb\.|dom\./gi,
    m => PT_DAY_MAP[m.toLowerCase()] ?? m)
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
  return formatInUserTz(date, locale === 'pt' ? 'HH:mm' : 'h:mm a', timezone, locale)
}

function capitalizePtMonth(s: string): string {
  // ptBR MMM outputs lowercase ("jun", "jan"…) — capitalize after the slash
  return s.replace(/\/([a-záàãâéêíóôõúç]+)/i, (_, m) => '/' + m.charAt(0).toUpperCase() + m.slice(1))
}

export function formatMatchDateTime(date: string | Date, timezone?: string | null, locale?: string | null): string {
  if (locale === 'pt') {
    const s = formatInUserTz(date, 'EEE, d/MMM · HH:mm', timezone, locale)
    return capitalizePtMonth(applyPtDayAbbr(s))
  }
  return formatInUserTz(date, 'EEE, MMM d · h:mm a', timezone, locale)
}

export function formatShortDateTime(date: string | Date, timezone?: string | null, locale?: string | null): string {
  const s = formatInUserTz(date, 'EEE MMM d, h:mm aa', timezone, locale)
  return locale === 'pt' ? applyPtDayAbbr(s) : s
}
