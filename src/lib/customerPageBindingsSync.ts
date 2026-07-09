import type { CustomerPageZone } from '@/lib/customerPageZones'

export const CUSTOMER_PAGE_BINDINGS_UPDATE_EVENT = 'customer-page-bindings-update' as const

export const CUSTOMER_PAGE_BINDINGS_UPDATE_MESSAGE = 'CUSTOMER_PAGE_BINDINGS_UPDATE' as const

export type CustomerPageBindingsUpdateMessage = {
  type: typeof CUSTOMER_PAGE_BINDINGS_UPDATE_MESSAGE
  zone?: CustomerPageZone
}

/** 편집 패널·워크bench — 바인딩 변경 알림 */
export function emitCustomerPageBindingsUpdate(zone?: CustomerPageZone) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(CUSTOMER_PAGE_BINDINGS_UPDATE_EVENT, { detail: { zone } })
  )
}

export function notifyIframeCustomerPageBindingsUpdate(
  iframe: HTMLIFrameElement | null,
  zone?: CustomerPageZone
) {
  if (!iframe?.contentWindow || typeof window === 'undefined') return
  iframe.contentWindow.postMessage(
    {
      type: CUSTOMER_PAGE_BINDINGS_UPDATE_MESSAGE,
      ...(zone ? { zone } : {}),
    } satisfies CustomerPageBindingsUpdateMessage,
    window.location.origin
  )
}
