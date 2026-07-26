import type { SupabaseClient } from '@supabase/supabase-js'
import {
  findSimilarCustomersInList,
  isIgnoredSimilarCustomerEmail,
  shouldIncludeInSimilarCustomerResults,
  type SimilarCustomerMatchRow,
} from '@/lib/customerSimilarity'
import { mapDbReservationRowsToReservations } from '@/lib/mapDbReservationRowsToReservations'
import { RESERVATION_LIST_SELECT } from '@/lib/reservationListSelect'
import { resolveOperatorId, withOperatorId } from '@/lib/operators/scopeQuery'
import type { Customer, Reservation } from '@/types/reservation'

const CUSTOMER_ID_CHUNK = 50
const PAGE_SIZE = 1000

export type SimilarCustomerMatchReason = 'self' | 'name_exact' | 'name_similar' | 'email' | 'phone'

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

type SimilarCustomerRpcRow = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  archive: boolean | null
}

async function searchCustomersForSimilarMatch(
  supabase: SupabaseClient,
  operatorId: string | null | undefined,
  params: {
    name?: string
    namePartial?: boolean
    email?: string
    phoneTail?: string
    limit?: number
  }
): Promise<Customer[] | null> {
  const { data, error } = await supabase.rpc('search_customers_for_similar_match', {
    p_operator_id: resolveOperatorId(operatorId),
    p_name: params.name ?? null,
    p_name_partial: params.namePartial ?? false,
    p_email: params.email ?? null,
    p_phone_tail: params.phoneTail ?? null,
    p_limit: params.limit ?? 25,
  })
  if (error) {
    return null
  }
  return (data || []) as Customer[]
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

  const runRpcSearch = async (
    label: string,
    params: {
      name?: string
      namePartial?: boolean
      email?: string
      phoneTail?: string
      limit?: number
    }
  ) => {
    try {
      const rows = await searchCustomersForSimilarMatch(supabase, operatorId, params)
      if (rows === null) {
        console.warn(`fetchSimilarCustomersFromDb ${label}: rpc error`)
        return null
      }
      return rows as SimilarCustomerRpcRow[]
    } catch (e) {
      console.warn(`fetchSimilarCustomersFromDb ${label}:`, e)
      return null
    }
  }

  if (name && !hasOtherCandidates) {
    const exactRows = await runRpcSearch('name exact', { name, limit: 25 })
    addRows(exactRows as Customer[] | null)

    if (name.length >= 2 && candidates.size === 0) {
      const partialRows = await runRpcSearch('name partial', { name, namePartial: true, limit: 50 })
      addRows(partialRows as Customer[] | null)
    }
  }

  if (email && !isIgnoredSimilarCustomerEmail(email)) {
    const emailRows = await runRpcSearch('email', { email, limit: 25 })
    addRows(emailRows as Customer[] | null)
  }

  if (phoneDigits.length >= 8) {
    const tail = phoneDigits.slice(-8)
    const phoneRows = await runRpcSearch('phone', { phoneTail: tail, limit: 50 })
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

/** 다른 유사 고객에게 예약이 1건 이상 있는지 (카드 배지용 — 이미 로드된 고객 목록만 사용) */
export async function checkHasSimilarCustomerReservations(
  supabase: SupabaseClient,
  anchor: SimilarCustomerMatchRow,
  allCustomers: Customer[],
  _productMap: Map<string, string>,
  operatorId?: string | null
): Promise<boolean> {
  const fromList = findSimilarCustomersForAnchor(allCustomers, anchor as Customer)
  const otherFromList = fromList.filter((c) => c.id !== anchor.id).map((c) => c.id)
  if (otherFromList.length === 0) return false

  return hasReservationsForAnyCustomerIds(supabase, otherFromList, operatorId)
}
