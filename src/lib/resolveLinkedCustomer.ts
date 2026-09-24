import { isAbortLikeError } from '@/lib/isAbortLikeError'
import {
  findLinkedCustomerInList,
  linkedCustomerContactIsUsable,
  linkedCustomerRowHasContactColumns,
  type LinkedCustomerContact,
} from '@/lib/linkedCustomerLookup'
import { supabase } from '@/lib/supabase'

export {
  findLinkedCustomerInList,
  readReservationCustomerId,
  type LinkedCustomerContact,
} from '@/lib/linkedCustomerLookup'

/**
 * 목록 캐시에 없는 연결 고객도 예약의 customer_id로 한 건 조회한다.
 * 예약 폼은 고객을 따로 읽어서 이름을 보여 주는데, 발송 버튼은 페이지 목록만 보면
 * 연결되어 있어도 "연결된 고객 정보를 찾을 수 없습니다"가 난다.
 */
export async function resolveLinkedCustomer(
  customers: readonly LinkedCustomerContact[],
  customerId: string | null | undefined,
  fallback?: LinkedCustomerContact | null
): Promise<LinkedCustomerContact | null> {
  const id = String(customerId ?? '').trim()
  if (!id) return null

  const local = findLinkedCustomerInList(customers, id)
  if (local && linkedCustomerRowHasContactColumns(local)) return local

  const fb = fallback && String(fallback.id).trim() === id ? fallback : null
  if (fb && linkedCustomerContactIsUsable(fb)) return fb

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, phone, language, emergency_contact')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    if (isAbortLikeError(error)) {
      const abortErr = new Error('aborted')
      abortErr.name = 'AbortError'
      throw abortErr
    }
    throw new Error(error.message || 'customer lookup failed')
  }

  if (data?.id) return data
  return local
}
