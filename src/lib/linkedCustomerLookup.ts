/** 이메일·SMS 미리보기에 필요한 고객 연락 필드 */
export type LinkedCustomerContact = {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  language?: string | null
  emergency_contact?: string | null
}

export function readReservationCustomerId(
  reservation: { customerId?: string | null; customer_id?: string | null } | null | undefined
): string {
  return String(reservation?.customerId || reservation?.customer_id || '').trim()
}

export function findLinkedCustomerInList<T extends { id: string }>(
  customers: readonly T[],
  customerId: string | null | undefined
): T | null {
  const id = String(customerId ?? '').trim()
  if (!id) return null
  return customers.find((c) => String(c.id).trim() === id) ?? null
}

export function linkedCustomerRowHasContactColumns(customer: LinkedCustomerContact): boolean {
  return 'email' in customer || 'phone' in customer || 'emergency_contact' in customer
}

export function linkedCustomerContactIsUsable(customer: LinkedCustomerContact | null | undefined): boolean {
  if (!customer) return false
  return Boolean(
    String(customer.name ?? '').trim() ||
      String(customer.email ?? '').trim() ||
      String(customer.phone ?? '').trim() ||
      String(customer.emergency_contact ?? '').trim()
  )
}
