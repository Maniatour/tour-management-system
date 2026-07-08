import type { CustomerPageZone } from '@/lib/customerPageZones'

export const CUSTOMER_PAGE_EDIT_MESSAGE = 'CUSTOMER_PAGE_ZONE_EDIT' as const
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
}

export type CustomerPageReloadMessage = {
  type: typeof CUSTOMER_PAGE_RELOAD_MESSAGE
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

export function postCustomerPageZoneEdit(zone: CustomerPageZone) {
  if (typeof window === 'undefined') return
  const message: CustomerPageZoneEditMessage = {
    type: CUSTOMER_PAGE_EDIT_MESSAGE,
    zone,
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
