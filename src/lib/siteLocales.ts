/**
 * Customer-site + admin content locales (English is content fallback default).
 * Keep in sync with LanguageSwitcher / admin edit / pickup hotel content locales.
 */
export const SITE_LOCALES = [
  { code: 'en', countryCode: 'US', label: 'English', nativeLabel: 'English' },
  { code: 'ko', countryCode: 'KR', label: '한국어', nativeLabel: '한국어' },
  { code: 'ja', countryCode: 'JP', label: '日本語', nativeLabel: '日本語' },
  { code: 'zh-CN', countryCode: 'CN', label: '简体中文', nativeLabel: '简体中文' },
  { code: 'zh-TW', countryCode: 'TW', label: '繁體中文', nativeLabel: '繁體中文' },
  { code: 'es', countryCode: 'ES', label: 'Español', nativeLabel: 'Español' },
  { code: 'fr', countryCode: 'FR', label: 'Français', nativeLabel: 'Français' },
  { code: 'de', countryCode: 'DE', label: 'Deutsch', nativeLabel: 'Deutsch' },
] as const

export type SiteLocale = (typeof SITE_LOCALES)[number]['code']

/** URL / next-intl routing locales (same set as content locales). */
export const ROUTING_LOCALES: readonly SiteLocale[] = SITE_LOCALES.map((item) => item.code)

/** Default URL locale (existing Korean bookmarks / SEO). */
export const DEFAULT_ROUTING_LOCALE: SiteLocale = 'ko'

/** Content fallback when a translation is missing. */
export const DEFAULT_CONTENT_LOCALE: SiteLocale = 'en'

/** Locales that still use legacy `*_ko` / `*_en` product columns. */
export const LEGACY_COLUMN_LOCALES = ['ko', 'en'] as const
export type LegacyColumnLocale = (typeof LEGACY_COLUMN_LOCALES)[number]

/** Alternation for pathname regex: `/ko/...`, `/zh-CN/...` */
export const SITE_LOCALE_PATH_ALT = ROUTING_LOCALES.join('|')

export const SITE_LOCALE_PATH_PREFIX_RE = new RegExp(`^/(${SITE_LOCALE_PATH_ALT})(?=/|$)`)

const FALLBACK_ORDER: SiteLocale[] = [
  'en',
  'ko',
  'ja',
  'zh-CN',
  'zh-TW',
  'es',
  'fr',
  'de',
]

export function isSiteLocale(value: string | null | undefined): value is SiteLocale {
  return !!value && ROUTING_LOCALES.includes(value as SiteLocale)
}

export function normalizeSiteLocale(
  value: string | null | undefined,
  fallback: SiteLocale = DEFAULT_ROUTING_LOCALE
): SiteLocale {
  return isSiteLocale(value) ? value : fallback
}

export function getSiteLocaleMeta(code: SiteLocale) {
  return SITE_LOCALES.find((item) => item.code === code) ?? SITE_LOCALES[0]
}

/** Strip leading `/{locale}` from a pathname. */
export function stripLocalePrefix(pathname: string, locale?: string): string {
  if (locale && pathname === `/${locale}`) return '/'
  if (locale && pathname.startsWith(`/${locale}/`)) {
    return pathname.slice(locale.length + 1) || '/'
  }
  const match = pathname.match(SITE_LOCALE_PATH_PREFIX_RE)
  if (!match) return pathname || '/'
  const rest = pathname.slice(match[0].length)
  return rest || '/'
}

/** Replace or prepend locale segment in a pathname. */
export function replacePathLocale(pathname: string, nextLocale: SiteLocale): string {
  const without = stripLocalePrefix(pathname)
  if (without === '/') return `/${nextLocale}`
  return `/${nextLocale}${without.startsWith('/') ? without : `/${without}`}`
}

export function siteLocalePathTest(pathname: string, suffixPattern: string): boolean {
  return new RegExp(`^/(${SITE_LOCALE_PATH_ALT})${suffixPattern}`).test(pathname)
}

export function contentFallbackOrder(preferred: SiteLocale): SiteLocale[] {
  return [preferred, ...FALLBACK_ORDER.filter((code) => code !== preferred)]
}

export function isLegacyColumnLocale(value: string): value is LegacyColumnLocale {
  return value === 'ko' || value === 'en'
}

/** UI message JSON files that exist on disk (others fall back to English). */
export const FILE_MESSAGE_LOCALES = ['ko', 'en'] as const

export function resolveFileMessageLocale(locale: string): 'ko' | 'en' {
  if (locale === 'ko') return 'ko'
  return 'en'
}
