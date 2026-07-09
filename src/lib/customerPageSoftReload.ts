/** iframe soft reload — 전체 iframe 리마운트 없이 고객 페이지 데이터만 갱신 */
export const CUSTOMER_PAGE_SOFT_RELOAD_EVENT = 'customer-page-soft-reload'

export function dispatchCustomerPageSoftReload() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CUSTOMER_PAGE_SOFT_RELOAD_EVENT))
}

export function confirmDiscardUnsavedChanges(message?: string): boolean {
  if (typeof window === 'undefined') return true
  return window.confirm(
    message ?? '저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?'
  )
}
