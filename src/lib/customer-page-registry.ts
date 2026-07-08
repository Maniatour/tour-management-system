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

export function buildCustomerPageEditUrl(
  locale: string,
  pageId: CustomerPageId,
  options?: { productId?: string | null }
): string {
  const params = new URLSearchParams({ preview: '1', editMode: '1' })
  const productId = options?.productId?.trim() || null

  switch (pageId) {
    case 'home':
      return `/${locale}?${params.toString()}`
    case 'products-listing':
      if (productId) params.set('productId', productId)
      return `/${locale}/products?${params.toString()}`
    case 'products-tags':
      return `/${locale}/products/tags?${params.toString()}`
    case 'custom-tour':
      return `/${locale}/products/custom-tour?${params.toString()}`
    case 'reservation-check':
      return `/${locale}/reservation-check?${params.toString()}`
    case 'product-booking':
      if (!productId) return `/${locale}/products?${params.toString()}`
      params.set('openBooking', '1')
      return `/${locale}/products/${productId}?${params.toString()}`
    case 'product-detail':
    default:
      if (!productId) return `/${locale}/products?${params.toString()}`
      return `/${locale}/products/${productId}?${params.toString()}`
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
