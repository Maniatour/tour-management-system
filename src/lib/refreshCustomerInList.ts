import { supabase } from './supabase'

/** 예약 폼 저장 후 customers 목록에서 해당 고객 행만 DB 최신값으로 갱신 */
export async function refreshCustomerInList<T extends { id: string }>(
  customerId: string | null | undefined,
  setCustomers: (updater: (prev: T[]) => T[]) => void
): Promise<void> {
  const id = String(customerId ?? '').trim()
  if (!id) return

  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
  if (error || !data) return

  const row = data as T
  setCustomers((prev) => {
    const index = prev.findIndex((c) => c.id === row.id)
    if (index >= 0) {
      const next = [...prev]
      next[index] = row
      return next
    }
    return [...prev, row]
  })
}
