import { getRequestConfig } from 'next-intl/server'
import { headers } from 'next/headers'
import { loadLocaleMessages, loadLocaleMessagesForRoute } from './loadLocaleMessages'
import { shouldLoadFullLocaleMessages } from './messageNamespaces'
import {
  DEFAULT_ROUTING_LOCALE,
  ROUTING_LOCALES,
  isSiteLocale,
  type SiteLocale,
} from '@/lib/siteLocales'

const SUPPORTED_LOCALES = ROUTING_LOCALES

function resolveLocale(locale: string | undefined): SiteLocale {
  if (locale && isSiteLocale(locale)) {
    return locale
  }

  return DEFAULT_ROUTING_LOCALE
}

async function resolveLocaleWithCookie(locale: string | undefined): Promise<SiteLocale> {
  if (locale && isSiteLocale(locale)) {
    return locale
  }

  const headersList = await headers()
  const cookieHeader = headersList.get('cookie')
  const cookieLocale = cookieHeader?.match(/NEXT_LOCALE=([^;]+)/)?.[1]

  if (cookieLocale && isSiteLocale(cookieLocale)) {
    return cookieLocale
  }

  return DEFAULT_ROUTING_LOCALE
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
    const fallbackLocale = resolveLocale(DEFAULT_ROUTING_LOCALE)
    const fallbackMessages = await loadMessages(fallbackLocale)
    return {
      locale: fallbackLocale,
      messages: fallbackMessages,
    }
  }
})

export { SUPPORTED_LOCALES }
