export const PENDING_CUSTOMER_MANAGEMENT_REFRESH_EVENT = 'pending-customer-management-refresh'

export function dispatchPendingCustomerManagementRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PENDING_CUSTOMER_MANAGEMENT_REFRESH_EVENT))
}
