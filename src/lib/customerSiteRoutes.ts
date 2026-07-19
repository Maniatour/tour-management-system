import { siteLocalePathTest } from '@/lib/siteLocales'

export const LEGAL_PAGE_SLUGS = [
  'terms',
  'privacy-policy',
  'sms-terms',
  'cancellation-refund-policy',
  'cookie-policy',
] as const

export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number]

const CUSTOMER_SITE_EXCLUDED = [
  /\/admin(\/|$)/,
  /\/guide(\/|$)/,
  /\/dashboard(\/|$)/,
  /\/auth(\/|$)/,
  /\/off-schedule(\/|$)/,
  /\/photos\//,
  /\/embed(\/|$)/,
  /\/sop(\/|$)/,
] as const

/** 고객-facing 공개 페이지(홈·상품·예약조회·legal 등) 여부 */
export function isCustomerFacingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false

  if (CUSTOMER_SITE_EXCLUDED.some((pattern) => pattern.test(pathname))) {
    return false
  }

  if (siteLocalePathTest(pathname, '/?$')) return true
  if (/\/products(\/|$)/.test(pathname)) return true
  if (/\/travel-guide(\/|$)/.test(pathname)) return true
  if (/\/reservation-check(\/|$)/.test(pathname)) return true
  if (LEGAL_PAGE_SLUGS.some((slug) => pathname.includes(`/${slug}`))) return true

  return false
}

export function isLegalPagePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return LEGAL_PAGE_SLUGS.some((slug) => pathname.includes(`/${slug}`))
}

export function buildLegalPageHref(locale: string, slug: LegalPageSlug): string {
  return `/${locale}/${slug}`
}
