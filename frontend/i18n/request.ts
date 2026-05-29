import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const SUPPORTED_LOCALES = ['en', 'pt'] as const
type Locale = (typeof SUPPORTED_LOCALES)[number]

function normalizeLocale(value: string | undefined): Locale {
  if (value && (SUPPORTED_LOCALES as readonly string[]).includes(value)) {
    return value as Locale
  }
  return 'en'
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  let locale: Locale

  if (requested) {
    locale = normalizeLocale(requested)
  } else {
    const cookieStore = await cookies()
    locale = normalizeLocale(cookieStore.get('NEXT_LOCALE')?.value)
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
