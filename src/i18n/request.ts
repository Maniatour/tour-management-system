import { getRequestConfig } from 'next-intl/server'
import { headers } from 'next/headers'
import { loadLocaleMessages, loadLocaleMessagesForRoute } from './loadLocaleMessages'
import { shouldLoadFullLocaleMessages } from './messageNamespaces'

const SUPPORTED_LOCALES = ['ko', 'en'] as const

function resolveLocale(locale: string | undefined): string {
  if (locale && SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    return locale
  }

  return 'ko'
}

async function resolveLocaleWithCookie(locale: string | undefined): Promise<string> {
  if (locale && SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    return locale
  }

  const headersList = await headers()
  const cookieHeader = headersList.get('cookie')
  const cookieLocale = cookieHeader?.match(/NEXT_LOCALE=([^;]+)/)?.[1]

  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as (typeof SUPPORTED_LOCALES)[number])) {
    return cookieLocale
  }

  return 'ko'
}

async function resolveRequestPathname(): Promise<string> {
  const headersList = await headers()
  return headersList.get('x-pathname') ?? ''
}

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = await resolveLocaleWithCookie(locale)
  const pathname = await resolveRequestPathname()
  const loadMessages = shouldLoadFullLocaleMessages()
    ? loadLocaleMessages
    : (loc: string) => loadLocaleMessagesForRoute(loc, pathname)

  try {
    const messages = await loadMessages(resolvedLocale)
    return { locale: resolvedLocale, messages }
  } catch (error) {
    console.error(`Failed to load messages for locale: ${resolvedLocale}`, error)
    const fallbackLocale = resolveLocale('ko')
    const fallbackMessages = await loadMessages(fallbackLocale)
    return {
      locale: fallbackLocale,
      messages: fallbackMessages,
    }
  }
})
