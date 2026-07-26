import type { SupabaseClient } from '@supabase/supabase-js'
import {
  findSimilarCustomersInList,
  isIgnoredSimilarCustomerEmail,
  shouldIncludeInSimilarCustomerResults,
  type SimilarCustomerMatchRow,
} from '@/lib/customerSimilarity'
import { mapDbReservationRowsToReservations } from '@/lib/mapDbReservationRowsToReservations'
import { RESERVATION_LIST_SELECT } from '@/lib/reservationListSelect'
import { withOperatorId } from '@/lib/operators/scopeQuery'
import type { Customer, Reservation } from '@/types/reservation'

const CUSTOMER_ID_CHUNK = 50
const PAGE_SIZE = 1000

export type SimilarCustomerMatchReason = 'self' | 'name_exact' | 'name_similar' | 'email' | 'phone'

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&')
}

/** DB에서 이름·이메일·전화 후보를 조회한 뒤 JS 유사도 규칙으로 필터 */
export async function fetchSimilarCustomersFromDb(
  supabase: SupabaseClient,
  anchor: SimilarCustomerMatchRow,
  operatorId?: string | null,
  /** 이미 로드된 고객 목록 — 있으면 DB 조회 전에 먼저 사용 */
  seedCustomers?: Customer[]
): Promise<Customer[]> {
  const name = anchor.name?.trim() ?? ''
  const email = anchor.email?.trim() ?? ''
  const phoneDigits = anchor.phone ? digitsOnly(anchor.phone) : ''
  const candidates = new Map<string, Customer>()

  const addRows = (rows: Customer[] | null | undefined) => {
    for (const row of rows || []) {
      if (row?.id) candidates.set(row.id, row)
    }
  }

  if (seedCustomers?.length) {
    addRows(findSimilarCustomersForAnchor(seedCustomers, anchor as Customer))
  }

  const hasOtherCandidates = [...candidates.values()].some((c) => c.id !== anchor.id)

  const runQuery = async <T>(label: string, query: PromiseLike<{ data: T | null; error: unknown }>) => {
    try {
      const { data, error } = await query
      if (error) {
        console.warn(`fetchSimilarCustomersFromDb ${label}:`, error)
        return null
      }
      return data
    } catch (e) {
      console.warn(`fetchSimilarCustomersFromDb ${label}:`, e)
      return null
    }
  }

  if (name && !hasOtherCandidates) {
    const exactRows = await runQuery(
      'name exact',
      withOperatorId(
        supabase
          .from('customers')
          .select('id,name,email,phone,archive')
          .ilike('name', escapeIlikePattern(name))
          .limit(25),
        operatorId
      )
    )
    addRows(exactRows as Customer[] | null)

    if (name.length >= 2 && candidates.size === 0) {
      const pattern = `%${escapeIlikePattern(name)}%`
      const partialRows = await runQuery(
        'name partial',
        withOperatorId(
          supabase
            .from('customers')
            .select('id,name,email,phone,archive')
            .ilike('name', pattern)
            .limit(50),
          operatorId
        )
      )
      addRows(partialRows as Customer[] | null)
    }
  }

  if (email && !isIgnoredSimilarCustomerEmail(email)) {
    const emailRows = await runQuery(
      'email',
      withOperatorId(
        supabase
          .from('customers')
          .select('id,name,email,phone,archive')
          .ilike('email', escapeIlikePattern(email))
          .limit(25),
        operatorId
      )
    )
    addRows(emailRows as Customer[] | null)
  }

  if (phoneDigits.length >= 8) {
    const tail = phoneDigits.slice(-8)
    const phoneRows = await runQuery(
      'phone',
      withOperatorId(
        supabase
          .from('customers')
          .select('id,name,email,phone,archive')
          .ilike('phone', `%${tail}%`)
          .limit(50),
        operatorId
      )
    )
    addRows(phoneRows as Customer[] | null)
  }

  const merged = [...candidates.values()].filter((c) => shouldIncludeInSimilarCustomerResults(c, anchor.id))
  if (!name) {
    return anchor.id ? merged.filter((c) => c.id === anchor.id) : merged
  }

  return findSimilarCustomersInList(merged, name, email || undefined, anchor.phone ?? undefined).filter((c) =>
    shouldIncludeInSimilarCustomerResults(c, anchor.id)
  )
}

/** 이름·이메일·전화 기준으로 앵커 고객과의 매칭 사유 */
export function resolveSimilarCustomerMatchReason(
  candidate: SimilarCustomerMatchRow,
  anchor: SimilarCustomerMatchRow
): SimilarCustomerMatchReason | null {
  if (candidate.id === anchor.id) return 'self'

  const nameLower = (anchor.name ?? '').toLowerCase().trim()
  const customerNameLower = (candidate.name ?? '').toLowerCase().trim()
  if (!nameLower) return null

  if (customerNameLower && customerNameLower === nameLower) return 'name_exact'

  const MIN_NAME_SUBSTR_LEN = 2
  if (
    customerNameLower.length >= MIN_NAME_SUBSTR_LEN &&
    nameLower.length >= MIN_NAME_SUBSTR_LEN &&
    (customerNameLower.includes(nameLower) || nameLower.includes(customerNameLower))
  ) {
    return 'name_similar'
  }

  const emailLower = anchor.email?.trim().toLowerCase()
  if (
    emailLower &&
    !isIgnoredSimilarCustomerEmail(anchor.email) &&
    candidate.email?.trim() &&
    !isIgnoredSimilarCustomerEmail(candidate.email) &&
    candidate.email.toLowerCase() === emailLower
  ) {
    return 'email'
  }

  const inputPhoneDigits = anchor.phone ? digitsOnly(anchor.phone) : ''
  const MIN_PHONE_DIGITS_MATCH = 8
  if (inputPhoneDigits.length >= MIN_PHONE_DIGITS_MATCH && candidate.phone) {
    const cd = digitsOnly(candidate.phone)
    if (cd.length >= MIN_PHONE_DIGITS_MATCH && cd === inputPhoneDigits) return 'phone'
  }

  return null
}

export function mergeCustomerLists<T extends SimilarCustomerMatchRow>(...lists: T[][]): T[] {
  const byId = new Map<string, T>()
  for (const list of lists) {
    for (const c of list) {
      if (c?.id) byId.set(c.id, c)
    }
  }
  return [...byId.values()]
}

export function findSimilarCustomersForAnchor<T extends SimilarCustomerMatchRow>(
  allCustomers: T[],
  anchor: T
): T[] {
  const name = anchor.name?.trim() ?? ''
  const pool = mergeCustomerLists(allCustomers, [anchor])
  if (!name) return pool.filter((c) => c.id === anchor.id)

  const similar = findSimilarCustomersInList(pool, name, anchor.email ?? undefined, anchor.phone ?? undefined)
  const byId = new Map<string, T>()
  byId.set(anchor.id, anchor)
  for (const c of similar) {
    if (shouldIncludeInSimilarCustomerResults(c, anchor.id)) byId.set(c.id, c)
  }
  return [...byId.values()]
}

async function buildTourExistenceMap(
  supabase: SupabaseClient,
  productSubMap: Map<string, string>,
  rows: Record<string, unknown>[]
): Promise<Map<string, boolean>> {
  const productIds = [...new Set(rows.map((r) => String(r.product_id ?? '')).filter(Boolean))]
  const tourDates = [...new Set(rows.map((r) => String(r.tour_date ?? '')).filter(Boolean))]
  const maniaIds = productIds.filter((id) => {
    const sc = productSubMap.get(id)
    return sc === 'Mania Tour' || sc === 'Mania Service'
  })
  const tourExistence = new Map<string, boolean>()
  if (maniaIds.length === 0 || tourDates.length === 0) return tourExistence

  const { data: tex } = await supabase
    .from('tours')
    .select('product_id, tour_date')
    .in('product_id', maniaIds)
    .in('tour_date', tourDates)

  for (const t of tex || []) {
    const row = t as { product_id: string; tour_date: string }
    tourExistence.set(`${row.product_id}-${row.tour_date}`, true)
  }
  return tourExistence
}

export async function fetchReservationsForCustomerIds(
  supabase: SupabaseClient,
  customerIds: string[],
  productMap: Map<string, string>,
  operatorId?: string | null
): Promise<Reservation[]> {
  if (customerIds.length === 0) return []

  const rawRows: Record<string, unknown>[] = []

  for (let i = 0; i < customerIds.length; i += CUSTOMER_ID_CHUNK) {
    const idChunk = customerIds.slice(i, i + CUSTOMER_ID_CHUNK)
    let offset = 0

    for (;;) {
      let q = supabase
        .from('reservations')
        .select(RESERVATION_LIST_SELECT)
        .in('customer_id', idChunk)
        .neq('status', 'deleted')
        .order('tour_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      q = withOperatorId(q, operatorId)
      const { data, error } = await q

      if (error) {
        console.error('fetchReservationsForCustomerIds:', error)
        break
      }

      const batch = (data || []) as unknown as Record<string, unknown>[]
      rawRows.push(...batch)
      if (batch.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
  }

  const productSubMap = new Map(productMap)
  const missingProdIds = [
    ...new Set(
      rawRows.map((r) => String(r.product_id ?? '')).filter((id) => id && !productSubMap.has(id))
    ),
  ]
  if (missingProdIds.length > 0) {
    const { data: prows } = await supabase.from('products').select('id, sub_category').in('id', missingProdIds)
    for (const p of prows || []) {
      const row = p as { id: string; sub_category?: string | null }
      productSubMap.set(row.id, row.sub_category || '')
    }
  }

  const tourExistence = await buildTourExistenceMap(supabase, productSubMap, rawRows)
  return mapDbReservationRowsToReservations(rawRows, productSubMap, tourExistence)
}

async function hasReservationsForAnyCustomerIds(
  supabase: SupabaseClient,
  customerIds: string[],
  operatorId?: string | null
): Promise<boolean> {
  if (customerIds.length === 0) return false
  for (let i = 0; i < customerIds.length; i += CUSTOMER_ID_CHUNK) {
    const chunk = customerIds.slice(i, i + CUSTOMER_ID_CHUNK)
    let q = supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .in('customer_id', chunk)
      .neq('status', 'deleted')
      .limit(1)
    q = withOperatorId(q, operatorId)
    const { count, error } = await q
    if (error) {
      console.error('hasReservationsForAnyCustomerIds:', error)
      return false
    }
    if ((count ?? 0) > 0) return true
  }
  return false
}

/** 다른 유사 고객에게 예약이 1건 이상 있는지 (카드 배지용) */
export async function checkHasSimilarCustomerReservations(
  supabase: SupabaseClient,
  anchor: SimilarCustomerMatchRow,
  allCustomers: Customer[],
  _productMap: Map<string, string>,
  operatorId?: string | null
): Promise<boolean> {
  const fromList = findSimilarCustomersForAnchor(allCustomers, anchor as Customer)
  const otherFromList = fromList.filter((c) => c.id !== anchor.id).map((c) => c.id)
  if (otherFromList.length > 0) {
    if (await hasReservationsForAnyCustomerIds(supabase, otherFromList, operatorId)) {
      return true
    }
  }

  const fromDb = await fetchSimilarCustomersFromDb(supabase, anchor, operatorId, allCustomers)
  const merged = findSimilarCustomersForAnchor(mergeCustomerLists(allCustomers, fromDb), anchor as Customer)
  const otherIds = merged.filter((c) => c.id !== anchor.id).map((c) => c.id)
  if (otherIds.length === 0) return false

  return hasReservationsForAnyCustomerIds(supabase, otherIds, operatorId)
}
