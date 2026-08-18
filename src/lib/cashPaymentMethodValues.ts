import { supabase } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 현금 관리·현금 리포트에서 공통으로 쓰는 결제수단 DB 값.
 * 회사/예약 지출은 결제수단 선택 시 payment_methods.id(예: PAYM032)로 저장되는 경우가 많아
 * 리터럴 `Cash`/`cash`만 조회하면 누락된다.
 */
export const CASH_PAYMENT_METHOD_DB_VALUES = ['PAYM032', 'PAYM001', 'cash', 'Cash'] as const

/** 마스터에서 삭제된 예전 현금 ID — 표시·저장 시 현재 Cash(PAYM001)로 바꿉니다. */
export const ORPHAN_CASH_PAYMENT_METHOD_IDS = ['PAYM032'] as const

export function needsResolvedCashPaymentMethodId(
  value: string | null | undefined,
  fromCashLedger: boolean
): boolean {
  if (fromCashLedger) return true
  const v = (value ?? '').trim()
  if (!v) return false
  if ((ORPHAN_CASH_PAYMENT_METHOD_IDS as readonly string[]).includes(v)) return true
  return v.toLowerCase() === 'cash'
}

export async function lookupActiveCashPaymentMethodId(sb: Pick<SupabaseClient, 'from'>): Promise<string> {
  const { data, error } = await sb
    .from('payment_methods')
    .select('id, method, method_type, status')
    .or('method_type.eq.cash,method.ilike.cash')

  if (error) {
    console.warn('현금 결제수단 조회 실패:', error)
    return 'PAYM001'
  }

  const rows = (data ?? []).filter((row) => row.id?.trim())
  const active = rows.filter((row) => (row.status ?? 'active') === 'active')
  const pool = active.length > 0 ? active : rows
  const namedCash = pool.find((row) => (row.method ?? '').trim().toLowerCase() === 'cash')
  if (namedCash?.id) return namedCash.id
  const paym001 = pool.find((row) => row.id === 'PAYM001')
  if (paym001?.id) return paym001.id
  return pool[0]?.id || 'PAYM001'
}

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
