import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, Home, Monitor, Route, ShoppingBag, Tags } from 'lucide-react'

export type CustomerPageId =
  | 'home'
  | 'products-listing'
  | 'products-tags'
  | 'custom-tour'
  | 'reservation-check'
  | 'product-detail'
  | 'product-booking'

export type CustomerPageDef = {
  id: CustomerPageId
  label: string
  icon: LucideIcon
  /** 상품 선택이 필요한 페이지 */
  requiresProduct?: boolean
  group: 'main' | 'products' | 'utility'
}

export const CUSTOMER_PAGE_REGISTRY: readonly CustomerPageDef[] = [
  { id: 'home', label: '홈', icon: Home, group: 'main' },
  { id: 'products-listing', label: '상품 목록', icon: ShoppingBag, group: 'products' },
  { id: 'products-tags', label: '태그별 투어', icon: Tags, group: 'products' },
  { id: 'custom-tour', label: '맞춤 투어', icon: Route, group: 'products' },
  { id: 'reservation-check', label: '예약 조회', icon: CalendarCheck, group: 'utility' },
  { id: 'product-detail', label: '상품 상세', icon: Monitor, group: 'products', requiresProduct: true },
  { id: 'product-booking', label: '예약하기', icon: CalendarCheck, group: 'products', requiresProduct: true },
]

/** iframe·고객 페이지 URL에서 상품 ID 추출 (경로 `/products/{id}` 또는 `?productId=`) */
export function extractProductIdFromCustomerPageUrl(href: string): string | null {
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    const fromQuery = url.searchParams.get('productId')?.trim()
    if (fromQuery) return fromQuery

    const match = url.pathname.match(/\/products\/([^/?#]+)/)
    return match?.[1]?.trim() || null
  } catch {
    return null
  }
}

/** pathname만으로 pageId 추론 (iframe 미리보기 퀵바 등) */
export function inferCustomerPageIdFromPathname(pathname: string | null): CustomerPageId | null {
  if (!pathname) return null
  if (/^\/(ko|en)\/?$/.test(pathname)) return 'home'
  if (pathname.includes('/products/tags')) return 'products-tags'
  if (pathname.includes('/products/custom-tour')) return 'custom-tour'
  if (pathname.includes('/reservation-check')) return 'reservation-check'
  const productMatch = pathname.match(/\/products\/([^/?#]+)/)
  if (productMatch?.[1] && productMatch[1] !== 'tags' && productMatch[1] !== 'custom-tour') {
    return 'product-detail'
  }
  if (pathname.includes('/products')) return 'products-listing'
  return null
}

/** 고객 페이지 URL → 워크bench pageId (상품 상세·예약하기) */
export function inferCustomerPageIdFromUrl(href: string): CustomerPageId | null {
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    const pathMatch = url.pathname.match(/\/products\/([^/?#]+)/)
    if (pathMatch?.[1]) {
      return url.searchParams.get('openBooking') === '1' ? 'product-booking' : 'product-detail'
    }
    if (url.pathname.includes('/products/tags')) return 'products-tags'
    if (url.pathname.includes('/products/custom-tour')) return 'custom-tour'
    if (url.pathname.includes('/products')) return 'products-listing'
    if (url.pathname.includes('/reservation-check')) return 'reservation-check'
    if (url.pathname.match(/\/[^/]+\/?$/)) return 'home'
    return null
  } catch {
    return null
  }
}

export function buildCustomerPageEditUrl(
  locale: string,
  pageId: CustomerPageId,
  options?: { productId?: string | null; previewLocale?: string | null }
): string {
  const params = new URLSearchParams({ preview: '1', editMode: '1' })
  const productId = options?.productId?.trim() || null
  const previewLocale = options?.previewLocale?.trim() || locale

  switch (pageId) {
    case 'home':
      return `/${previewLocale}?${params.toString()}`
    case 'products-listing':
      if (productId) params.set('productId', productId)
      return `/${previewLocale}/products?${params.toString()}`
    case 'products-tags':
      return `/${previewLocale}/products/tags?${params.toString()}`
    case 'custom-tour':
      return `/${previewLocale}/products/custom-tour?${params.toString()}`
    case 'reservation-check':
      return `/${previewLocale}/reservation-check?${params.toString()}`
    case 'product-booking':
      if (!productId) return `/${previewLocale}/products?${params.toString()}`
      params.set('openBooking', '1')
      return `/${previewLocale}/products/${productId}?${params.toString()}`
    case 'product-detail':
    default:
      if (!productId) return `/${previewLocale}/products?${params.toString()}`
      return `/${previewLocale}/products/${productId}?${params.toString()}`
  }
}

/** 편집 탭 → 관리자 경로 */
export function buildAdminPathForEditTab(
  locale: string,
  tabId: string,
  productId?: string | null
): string {
  const productTabs = new Set([
    'basic',
    'details',
    'media',
    'schedule',
    'tour-courses',
    'faq',
    'choices',
    'options',
    'dynamic-pricing',
  ])

  if (productTabs.has(tabId) && productId) {
    return `/${locale}/admin/products/${productId}`
  }

  const tabPaths: Record<string, string> = {
    basic: 'products',
    details: 'products',
    media: 'products',
    schedule: 'products',
    'tour-courses': 'tour-courses',
    faq: 'products',
    choices: 'products',
    options: 'options',
    'dynamic-pricing': 'products',
    'tag-translations': 'tag-translations',
    products: 'products',
    reservations: 'reservations',
  }

  const path = tabPaths[tabId] ?? tabId
  return `/${locale}/admin/${path}`
}
