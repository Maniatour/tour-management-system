import { supabase } from '@/lib/supabase'

/**
 * 현금 관리·현금 리포트에서 공통으로 쓰는 결제수단 DB 값.
 * 회사/예약 지출은 결제수단 선택 시 payment_methods.id(예: PAYM032)로 저장되는 경우가 많아
 * 리터럴 `Cash`/`cash`만 조회하면 누락된다.
 */
export const CASH_PAYMENT_METHOD_DB_VALUES = ['PAYM032', 'PAYM001', 'cash', 'Cash'] as const

let cachedCashFilterValues: string[] | null = null

/** Supabase `.in('payment_method', values)` 용 — 등록된 현금 수단 ID + 레거시 리터럴 */
export async function getCashPaymentMethodFilterValues(): Promise<string[]> {
  if (cachedCashFilterValues) {
    return cachedCashFilterValues
  }

  const values = new Set<string>(CASH_PAYMENT_METHOD_DB_VALUES)

  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, method')
    .eq('method_type', 'cash')

  if (error) {
    console.warn('payment_methods(현금) 조회 실패, 기본값만 사용:', error)
  } else {
    for (const row of data ?? []) {
      if (row.id?.trim()) values.add(row.id.trim())
      if (row.method?.trim()) values.add(row.method.trim())
    }
  }

  cachedCashFilterValues = [...values]
  return cachedCashFilterValues
}

/** 결제수단 마스터 변경 후 캐시 무효화 (필요 시) */
export function invalidateCashPaymentMethodFilterCache(): void {
  cachedCashFilterValues = null
}
