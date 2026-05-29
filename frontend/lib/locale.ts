'use client'

import Cookies from 'js-cookie'

export type SupportedLocale = 'en' | 'pt'

export function getLocaleCookie(): SupportedLocale {
  const val = Cookies.get('NEXT_LOCALE')
  if (val === 'pt') return 'pt'
  return 'en'
}

export function setLocaleCookie(locale: SupportedLocale) {
  Cookies.set('NEXT_LOCALE', locale, { expires: 365, sameSite: 'lax' })
}

export function clearLocaleCookie() {
  Cookies.set('NEXT_LOCALE', 'en', { expires: 365, sameSite: 'lax' })
}
