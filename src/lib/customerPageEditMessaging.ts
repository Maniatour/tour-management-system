import type { CustomerPageZone } from '@/lib/customerPageZones'
import type { ListingCardSlotId } from '@/lib/customerPageListingCardLayoutCatalog'
import type { ZoneLayoutPageId } from '@/lib/customerPageZoneLayoutCatalog'

export const CUSTOMER_PAGE_EDIT_MESSAGE = 'CUSTOMER_PAGE_ZONE_EDIT' as const
export const CUSTOMER_PAGE_HOME_LAYOUT_EDIT_MESSAGE = 'CUSTOMER_PAGE_HOME_LAYOUT_EDIT' as const
export const CUSTOMER_PAGE_ZONE_LAYOUT_EDIT_MESSAGE = 'CUSTOMER_PAGE_ZONE_LAYOUT_EDIT' as const
export const CUSTOMER_PAGE_LISTING_CARD_LAYOUT_EDIT_MESSAGE =
  'CUSTOMER_PAGE_LISTING_CARD_LAYOUT_EDIT' as const
export const CUSTOMER_PAGE_GLOBAL_THEME_EDIT_MESSAGE = 'CUSTOMER_PAGE_GLOBAL_THEME_EDIT' as const
export const CUSTOMER_PAGE_TEMPLATE_EDIT_MESSAGE = 'CUSTOMER_PAGE_TEMPLATE_EDIT' as const
export const CUSTOMER_PAGE_RELOAD_MESSAGE = 'CUSTOMER_PAGE_RELOAD' as const
export const CUSTOMER_PAGE_EDIT_MODE_ENABLE_MESSAGE =
  'CUSTOMER_PAGE_EDIT_MODE_ENABLE' as const
export const CUSTOMER_PAGE_PREVIEW_HEIGHT_MESSAGE =
  'CUSTOMER_PAGE_PREVIEW_HEIGHT' as const

export type CustomerPageEditModeEnableMessage = {
  type: typeof CUSTOMER_PAGE_EDIT_MODE_ENABLE_MESSAGE
  preview?: boolean
  editMode?: boolean
}

export type CustomerPageZoneEditMessage = {
  type: typeof CUSTOMER_PAGE_EDIT_MESSAGE
  zone: CustomerPageZone
  /** iframe 내 현재 상품 (상품 상세·목록 카드 등) */
  productId?: string | null
}

export type CustomerPageReloadMessage = {
  type: typeof CUSTOMER_PAGE_RELOAD_MESSAGE
}

export type CustomerPagePreviewHeightMessage = {
  type: typeof CUSTOMER_PAGE_PREVIEW_HEIGHT_MESSAGE
  height: number
}

export type CustomerPageHomeLayoutEditMessage = {
  type: typeof CUSTOMER_PAGE_HOME_LAYOUT_EDIT_MESSAGE
  /** 열 때 바로 편집할 섹션 instanceId */
  instanceId?: string
}

export type CustomerPageZoneLayoutEditMessage = {
  type: typeof CUSTOMER_PAGE_ZONE_LAYOUT_EDIT_MESSAGE
  pageId: ZoneLayoutPageId
  zoneId?: CustomerPageZone
}

export type CustomerPageListingCardLayoutEditMessage = {
  type: typeof CUSTOMER_PAGE_LISTING_CARD_LAYOUT_EDIT_MESSAGE
  slotId?: ListingCardSlotId
}

export type CustomerPageGlobalThemeEditMessage = {
  type: typeof CUSTOMER_PAGE_GLOBAL_THEME_EDIT_MESSAGE
}

export type CustomerPageTemplateEditMessage = {
  type: typeof CUSTOMER_PAGE_TEMPLATE_EDIT_MESSAGE
}

export function postCustomerPageEditModeEnable() {
  if (typeof window === 'undefined') return
  const message: CustomerPageEditModeEnableMessage = {
    type: CUSTOMER_PAGE_EDIT_MODE_ENABLE_MESSAGE,
    preview: true,
    editMode: true,
  }
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin)
  }
}

/** iframe 미리보기 높이를 부모(고객 페이지 작업)에 전달 */
export function postCustomerPagePreviewHeight(height: number) {
  if (typeof window === 'undefined' || !Number.isFinite(height)) return
  const message: CustomerPagePreviewHeightMessage = {
    type: CUSTOMER_PAGE_PREVIEW_HEIGHT_MESSAGE,
    height: Math.ceil(height),
  }
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin)
  }
}

export function notifyIframeCustomerPageEditMode(iframe: HTMLIFrameElement | null) {
  if (!iframe?.contentWindow) return
  iframe.contentWindow.postMessage(
    {
      type: CUSTOMER_PAGE_EDIT_MODE_ENABLE_MESSAGE,
      preview: true,
      editMode: true,
    } satisfies CustomerPageEditModeEnableMessage,
    window.location.origin
  )
}

export function notifyIframeCustomerPageReload(iframe: HTMLIFrameElement | null) {
  if (!iframe?.contentWindow) return
  iframe.contentWindow.postMessage(
    { type: CUSTOMER_PAGE_RELOAD_MESSAGE } satisfies CustomerPageReloadMessage,
    window.location.origin
  )
}

export function postCustomerPageZoneEdit(
  zone: CustomerPageZone,
  productId?: string | null
) {
  if (typeof window === 'undefined') return
  const message: CustomerPageZoneEditMessage = {
    type: CUSTOMER_PAGE_EDIT_MESSAGE,
    zone,
    ...(productId ? { productId } : {}),
  }
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin)
  }
}

export function postCustomerPageHomeLayoutEdit(instanceId?: string) {
  if (typeof window === 'undefined') return
  const message: CustomerPageHomeLayoutEditMessage = {
    type: CUSTOMER_PAGE_HOME_LAYOUT_EDIT_MESSAGE,
    ...(instanceId ? { instanceId } : {}),
  }
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin)
  }
}

export function postCustomerPageHomeSectionSettingsEdit(instanceId: string) {
  postCustomerPageHomeLayoutEdit(instanceId)
}

export function postCustomerPageZoneLayoutEdit(
  pageId: ZoneLayoutPageId,
  zoneId?: CustomerPageZone
) {
  if (typeof window === 'undefined') return
  const message: CustomerPageZoneLayoutEditMessage = {
    type: CUSTOMER_PAGE_ZONE_LAYOUT_EDIT_MESSAGE,
    pageId,
    ...(zoneId ? { zoneId } : {}),
  }
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin)
  }
}

export function postCustomerPageListingCardLayoutEdit(slotId?: ListingCardSlotId) {
  if (typeof window === 'undefined') return
  const message: CustomerPageListingCardLayoutEditMessage = {
    type: CUSTOMER_PAGE_LISTING_CARD_LAYOUT_EDIT_MESSAGE,
    ...(slotId ? { slotId } : {}),
  }
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin)
  }
}

export function postCustomerPageGlobalThemeEdit() {
  if (typeof window === 'undefined') return
  const message: CustomerPageGlobalThemeEditMessage = {
    type: CUSTOMER_PAGE_GLOBAL_THEME_EDIT_MESSAGE,
  }
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin)
  }
}

export function postCustomerPageTemplateEdit() {
  if (typeof window === 'undefined') return
  const message: CustomerPageTemplateEditMessage = {
    type: CUSTOMER_PAGE_TEMPLATE_EDIT_MESSAGE,
  }
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin)
  }
}

export function postCustomerPageReload() {
  if (typeof window === 'undefined') return
  const message: CustomerPageReloadMessage = { type: CUSTOMER_PAGE_RELOAD_MESSAGE }
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin)
  } else {
    window.location.reload()
  }
}

export function isCustomerPageZoneEditMessage(
  data: unknown
): data is CustomerPageZoneEditMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as CustomerPageZoneEditMessage).type === CUSTOMER_PAGE_EDIT_MESSAGE &&
    typeof (data as CustomerPageZoneEditMessage).zone === 'string'
  )
}

export function isCustomerPageHomeLayoutEditMessage(
  data: unknown
): data is CustomerPageHomeLayoutEditMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as CustomerPageHomeLayoutEditMessage).type === CUSTOMER_PAGE_HOME_LAYOUT_EDIT_MESSAGE
  )
}

export function isCustomerPageZoneLayoutEditMessage(
  data: unknown
): data is CustomerPageZoneLayoutEditMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as CustomerPageZoneLayoutEditMessage).type ===
      CUSTOMER_PAGE_ZONE_LAYOUT_EDIT_MESSAGE &&
    typeof (data as CustomerPageZoneLayoutEditMessage).pageId === 'string'
  )
}

export function isCustomerPageListingCardLayoutEditMessage(
  data: unknown
): data is CustomerPageListingCardLayoutEditMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as CustomerPageListingCardLayoutEditMessage).type ===
      CUSTOMER_PAGE_LISTING_CARD_LAYOUT_EDIT_MESSAGE
  )
}

export function isCustomerPageGlobalThemeEditMessage(
  data: unknown
): data is CustomerPageGlobalThemeEditMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as CustomerPageGlobalThemeEditMessage).type === CUSTOMER_PAGE_GLOBAL_THEME_EDIT_MESSAGE
  )
}

export function isCustomerPageTemplateEditMessage(
  data: unknown
): data is CustomerPageTemplateEditMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as CustomerPageTemplateEditMessage).type === CUSTOMER_PAGE_TEMPLATE_EDIT_MESSAGE
  )
}

export function isCustomerPagePreviewHeightMessage(
  data: unknown
): data is CustomerPagePreviewHeightMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as CustomerPagePreviewHeightMessage).type === CUSTOMER_PAGE_PREVIEW_HEIGHT_MESSAGE &&
    typeof (data as CustomerPagePreviewHeightMessage).height === 'number'
  )
}
