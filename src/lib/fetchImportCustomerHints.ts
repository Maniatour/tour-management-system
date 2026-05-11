import { supabase } from '@/lib/supabase'
import type { Customer } from '@/types/reservation'
import type { ExtractedReservationData } from '@/types/reservationImport'
import { normalizeCustomerNameFromImport } from '@/utils/reservationUtils'

/** PostgREST ilike 패턴에서 %, _, \ 이스케이프 */
function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * 예약 가져오기 상세용: 전 고객 테이블 스캔 대신 이메일·전화·이름으로 소량만 조회해
 * 기존 고객 매칭·중복 경고에 쓸 후보 목록을 만든다.
 */
export async function fetchCustomerHintsForImportExtracted(
  ext: ExtractedReservationData | null | undefined
): Promise<Customer[]> {
  const e = ext || {}
  const email = String(e.customer_email || '').trim()
  const phone = String(e.customer_phone || '').trim()
  const name =
    normalizeCustomerNameFromImport(e.customer_name) || String(e.customer_name || '').trim()

  const seen = new Set<string>()
  const out: Customer[] = []
  const push = (rows: Customer[] | null | undefined) => {
    for (const r of rows || []) {
      if (r?.id && !seen.has(r.id)) {
        seen.add(r.id)
        out.push(r)
      }
    }
  }

  const queries: Promise<{ data: Customer[] | null }>[] = []

  if (email.includes('@')) {
    queries.push(
      supabase.from('customers').select('*').ilike('email', escapeIlikePattern(email)).limit(25).then((r) => ({
        data: (r.data as Customer[]) ?? null,
      }))
    )
  }

  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 8) {
    const tail = escapeIlikePattern(digits.slice(-10))
    queries.push(
      supabase
        .from('customers')
        .select('*')
        .ilike('phone', `%${tail}%`)
        .limit(20)
        .then((r) => ({ data: (r.data as Customer[]) ?? null }))
    )
  }

  if (name.length >= 2) {
    const n = escapeIlikePattern(name)
    queries.push(
      supabase
        .from('customers')
        .select('*')
        .ilike('name', `%${n}%`)
        .limit(25)
        .then((r) => ({ data: (r.data as Customer[]) ?? null }))
    )
  }

  if (queries.length === 0) return []

  const results = await Promise.all(queries)
  for (const { data } of results) push(data)
  return out.slice(0, 60)
}
