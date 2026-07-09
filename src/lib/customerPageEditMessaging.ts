import type { CustomerPageZone } from '@/lib/customerPageZones'

export const CUSTOMER_PAGE_EDIT_MESSAGE = 'CUSTOMER_PAGE_ZONE_EDIT' as const
export const CUSTOMER_PAGE_HOME_LAYOUT_EDIT_MESSAGE = 'CUSTOMER_PAGE_HOME_LAYOUT_EDIT' as const
export const CUSTOMER_PAGE_GLOBAL_THEME_EDIT_MESSAGE = 'CUSTOMER_PAGE_GLOBAL_THEME_EDIT' as const
export const CUSTOMER_PAGE_TEMPLATE_EDIT_MESSAGE = 'CUSTOMER_PAGE_TEMPLATE_EDIT' as const
export const CUSTOMER_PAGE_RELOAD_MESSAGE = 'CUSTOMER_PAGE_RELOAD' as const
export const CUSTOMER_PAGE_EDIT_MODE_ENABLE_MESSAGE =
  'CUSTOMER_PAGE_EDIT_MODE_ENABLE' as const

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

export type CustomerPageHomeLayoutEditMessage = {
  type: typeof CUSTOMER_PAGE_HOME_LAYOUT_EDIT_MESSAGE
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

export function postCustomerPageHomeLayoutEdit() {
  if (typeof window === 'undefined') return
  const message: CustomerPageHomeLayoutEditMessage = {
    type: CUSTOMER_PAGE_HOME_LAYOUT_EDIT_MESSAGE,
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
