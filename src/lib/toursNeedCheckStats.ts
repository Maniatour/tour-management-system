import type { SupabaseClient } from '@supabase/supabase-js'
import { isAbortLikeError } from '@/lib/isAbortLikeError'
import {
  isTourDeletedStatus,
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  normalizeReservationIds,
  countReservationOccurrencesAcrossTours,
} from '@/utils/tourUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'

export type TourNeedCheckRow = {
  id: string
  tour_date: string | null
  tour_status: string | null
  product_name: string | null
  product_id: string | null
  guide_name: string | null
  /** Need to check — 투어 지출 없음 탭에서 가이드 미배정 제외용 */
  tour_guide_id?: string | null
}

/** 투어 지출 없음 탭에서 제외할 상품(이름·다국어 필드 부분 일치) */
function productExcludedFromNoReceiptExpenseTab(p: {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
}): boolean {
  const blob = [p.name, p.name_ko, p.name_en]
    .map((s) => String(s ?? '').toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!blob) return false
  if (blob.includes('야경투어')) return true
  if (blob.includes('골프장 예약 대행')) return true
  if (blob.includes('red rock canyon trail')) return true
  if (blob.includes('레드락') && blob.includes('승마')) return true
  return false
}

/** 중복 배정 탭: 예약 한 줄당 배정된 투어 한 건 */
export type DuplicateAssignmentPlacement = {
  tourId: string
  tourDate: string | null
  productName: string | null
  guideName: string | null
  tourStatus: string | null
  /** 투어 reservation_ids 중, 투어와 동일 상품·투어일인 예약만 합산(취소·삭제 제외) */
  assignedPeopleCount: number
  /** 이 투어의 reservation_ids 배열에 이 예약 ID가 몇 번 들어가 있는지(2 이상이면 동일 투어 ID 행을 합친 경우) */
  slotsInTourList: number
}

export type ReservationPeopleMeta = {
  total_people: number
  status: string | null
  product_id: string | null
  tour_date: string | null
}

function ymdKey(value: string | null | undefined): string {
  const s = (value ?? '').trim()
  return s.length >= 10 ? s.slice(0, 10) : s
}

/** 관리자 투어 목록과 동일: 예약이 투어의 product_id·투어일(일 단위)과 일치할 때만 인원 합산 */
function sumTourAssignedPeopleMatchingSlot(
  tour: TourNeedCheckRow,
  reservationIdsRaw: unknown,
  metaById: Map<string, ReservationPeopleMeta>
): number {
  const tp = String(tour.product_id ?? '').trim()
  const td = ymdKey(tour.tour_date)
  let sum = 0
  const seen = new Set<string>()
  for (const rid of normalizeReservationIds(reservationIdsRaw)) {
    const id = String(rid).trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const m = metaById.get(id)
    if (!m) continue
    if (isReservationCancelledStatus(m.status) || isReservationDeletedStatus(m.status)) continue
    const rp = String(m.product_id ?? '').trim()
    const rd = ymdKey(m.tour_date)
    if (rp !== tp || rd !== td) continue
    sum += m.total_people || 0
  }
  return sum
}

export type DuplicateAssignmentReservationRow = {
  reservationId: string
  /** 고객명 또는 채널 RN 등 */
  displayLabel: string | null
  /** reservations.tour_date (ymd) */
  reservationTourDate: string | null
  /** reservations.product_id 기준 상품명(맵에 없으면 id 문자열) */
  reservationProductLabel: string | null
  /** tours.reservation_ids 전역에서 이 예약 ID가 등장한 총 횟수 */
  occurrenceCount: number
  placements: DuplicateAssignmentPlacement[]
  /** 이 예약이 나타나는 서로 다른 투어 수 */
  uniqueTourCount: number
  /** 2개 이상의 서로 다른 투어에 동시에 배정됨 */
  isCrossTourDuplicate: boolean
  /** 여러 투어 문제는 없고, 한 투어의 배정 목록에만 같은 ID가 반복됨 */
  isListOnlyInTourDuplicate: boolean
}

/** 미배정 탭: 후보 투어 (같은 상품·투어일) */
export type UnassignedNeedCheckCandidateTour = {
  tourId: string
  tourDate: string | null
  productName: string | null
  guideName: string | null
  tourStatus: string | null
}

export type UnassignedReservationNeedCheckRow = {
  reservationId: string
  displayLabel: string | null
  productId: string
  productName: string | null
  tourDate: string
  status: string | null
  totalPeople: number
  candidateTours: UnassignedNeedCheckCandidateTour[]
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function numBalance(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'string') return parseFloat(v) || 0
  return Number(v) || 0
}

function logToursNeedCheckError(label: string, err: unknown): void {
  if (isAbortLikeError(err)) return
  console.error(label, err)
}

async function fetchTourRowsWithMeta(supabase: SupabaseClient): Promise<{
  rows: TourNeedCheckRow[]
  reservationIdsByTourId: Map<string, unknown>
  productIdsExcludedNoReceipt: Set<string>
  /** 삭제가 아닌 모든 투어의 reservation_ids에 등장한 예약 ID (미배정 판정용) */
  assignedReservationIdSet: Set<string>
}> {
  const { data: tourRows, error: toursErr } = await supabase
    .from('tours')
    .select('id, tour_date, tour_status, product_id, tour_guide_id, reservation_ids')
    .order('tour_date', { ascending: false })

  if (toursErr) {
    logToursNeedCheckError('toursNeedCheckStats: tours', toursErr)
    return {
      rows: [],
      reservationIdsByTourId: new Map(),
      productIdsExcludedNoReceipt: new Set(),
      assignedReservationIdSet: new Set(),
    }
  }

  const nonDeleted = (tourRows || []).filter((t) => !isTourDeletedStatus(t.tour_status))
  const assignedReservationIdSet = new Set<string>()
  for (const t of nonDeleted) {
    for (const rid of normalizeReservationIds((t as { reservation_ids?: unknown }).reservation_ids)) {
      const id = String(rid).trim()
      if (id) assignedReservationIdSet.add(id)
    }
  }

  const productIds = [...new Set(nonDeleted.map((t) => t.product_id).filter((id): id is string => id != null))]
  const activeProductIds = new Set<string>()
  const productLabel = new Map<string, string>()
  const productIdsExcludedNoReceipt = new Set<string>()

  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, name_ko, name_en, status')
      .in('id', productIds)

    for (const p of products || []) {
      const pid = String((p as { id: string }).id)
      const st = String((p as { status?: string | null }).status || '').toLowerCase()
      if (st === 'inactive') continue
      activeProductIds.add(pid)
      const name =
        (p as { name?: string | null }).name ||
        (p as { name_ko?: string | null }).name_ko ||
        (p as { name_en?: string | null }).name_en ||
        pid
      productLabel.set(pid, name)
      if (productExcludedFromNoReceiptExpenseTab(p as { name?: string | null; name_ko?: string | null; name_en?: string | null })) {
        productIdsExcludedNoReceipt.add(pid)
      }
    }
  }

  const visible = nonDeleted.filter((t) => {
    const pid = t.product_id as string | null | undefined
    return pid ? activeProductIds.has(pid) : true
  })

  const guideEmails = [...new Set(visible.map((t) => t.tour_guide_id).filter((e): e is string => e != null && e !== ''))]
  const teamMap = new Map<string, string>()
  if (guideEmails.length > 0) {
    const { data: team } = await supabase.from('team').select('email, name_ko, nick_name').in('email', guideEmails)
    for (const m of team || []) {
      const row = m as { email: string; name_ko?: string | null; nick_name?: string | null }
      teamMap.set(row.email, (row.nick_name && row.nick_name.trim()) || row.name_ko || row.email)
    }
  }

  const reservationIdsByTourId = new Map<string, unknown>()
  const rows: TourNeedCheckRow[] = []

  for (const t of visible) {
    const id = String(t.id)
    reservationIdsByTourId.set(id, t.reservation_ids)
    const pid = t.product_id != null ? String(t.product_id) : null
    const guide = t.tour_guide_id ? teamMap.get(t.tour_guide_id) : null
    rows.push({
      id,
      tour_date: t.tour_date ?? null,
      tour_status: t.tour_status ?? null,
      product_id: pid,
      product_name: pid ? productLabel.get(pid) ?? null : null,
      guide_name: guide ?? null,
      tour_guide_id: (t as { tour_guide_id?: string | null }).tour_guide_id ?? null,
    })
  }

  return { rows, reservationIdsByTourId, productIdsExcludedNoReceipt, assignedReservationIdSet }
}

function ymdAddYears(ymd: string, years: number): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd
  const dt = new Date(y, m - 1, d)
  dt.setFullYear(dt.getFullYear() + years)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** 취소·삭제·미확인 문자열이 아닌, 배정 대상이 될 수 있는 예약 상태 */
function isUnassignedTabAssignableStatus(status: string | null | undefined): boolean {
  if (isReservationCancelledStatus(status) || isReservationDeletedStatus(status)) return false
  const s = (status || '').toLowerCase().trim()
  if (s === 'cancelled' || s === 'canceled' || s === 'deleted') return false
  return true
}

/** 미배정 탭: `tourAutoCreation`과 동일하게 Mania Tour / Mania Service만 대상 */
const UNASSIGNED_TAB_PRODUCT_SUB_CATEGORIES = new Set<string>(['Mania Tour', 'Mania Service'])

function isUnassignedTabProductSubCategory(subCategory: string | null | undefined): boolean {
  return UNASSIGNED_TAB_PRODUCT_SUB_CATEGORIES.has(String(subCategory ?? '').trim())
}

type RawUnassignedRes = {
  id: string
  product_id: string | null
  tour_date: string | null
  status: string | null
  total_people: number | null
  tour_id: string | null
}

async function fetchUnassignedReservationsForNeedCheck(
  supabase: SupabaseClient,
  assignedReservationIdSet: Set<string>
): Promise<UnassignedReservationNeedCheckRow[]> {
  const today = todayYmd()
  const startD = ymdAddYears(today, -1)
  const endD = ymdAddYears(today, 2)
  const pageSize = 1000
  const raw: RawUnassignedRes[] = []
  for (let from = 0, iter = 0; iter < 200; iter++) {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, product_id, tour_date, status, total_people, tour_id')
      .not('product_id', 'is', null)
      .gte('tour_date', startD)
      .lte('tour_date', endD)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      logToursNeedCheckError('toursNeedCheckStats: unassigned reservations page', error)
      break
    }
    const batch = (data || []) as RawUnassignedRes[]
    if (batch.length === 0) break
    for (const r of batch) {
      const id = String(r.id ?? '').trim()
      if (!id) continue
      const assignedTourId = String((r as { tour_id?: string | null }).tour_id ?? '').trim()
      if (assignedTourId) continue
      if (assignedReservationIdSet.has(id)) continue
      const pid = r.product_id != null ? String(r.product_id).trim() : ''
      if (!pid) continue
      if (!isUnassignedTabAssignableStatus(r.status)) continue
      const td = (r.tour_date ?? '').toString()
      const dk = ymdKey(td)
      if (dk < startD || dk > endD) continue
      raw.push({ ...r, id, product_id: pid, tour_date: td })
    }
    if (batch.length < pageSize) break
    from += pageSize
  }

  if (raw.length === 0) return []

  const productIdsUnfiltered = [...new Set(raw.map((r) => r.product_id as string).filter(Boolean))]
  const productNameById = new Map<string, string>()
  const chunkSize = 200
  for (let i = 0; i < productIdsUnfiltered.length; i += chunkSize) {
    const chunk = productIdsUnfiltered.slice(i, i + chunkSize)
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, name, name_ko, name_en, sub_category')
      .in('id', chunk)
    if (pErr) {
      logToursNeedCheckError('toursNeedCheckStats: unassigned products', pErr)
      if (isAbortLikeError(pErr)) return []
      continue
    }
    for (const p of products || []) {
      const row = p as {
        id: string
        name?: string | null
        name_ko?: string | null
        name_en?: string | null
        sub_category?: string | null
      }
      if (!isUnassignedTabProductSubCategory(row.sub_category)) continue
      const name = row.name || row.name_ko || row.name_en || row.id
      productNameById.set(String(row.id), String(name))
    }
  }

  const rawForMania = raw.filter((r) => {
    const pid = String(r.product_id ?? '').trim()
    if (!pid) return false
    return productNameById.has(pid)
  })
  if (rawForMania.length === 0) return []

  const productIds = [...new Set(rawForMania.map((r) => r.product_id as string).filter(Boolean))]

  const tourPool: Array<{
    id: string
    tour_date: string | null
    tour_status: string | null
    product_id: string | null
    tour_guide_id: string | null
  }> = []
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize)
    const { data, error: tErr } = await supabase
      .from('tours')
      .select('id, tour_date, tour_status, product_id, tour_guide_id')
      .in('product_id', chunk)
      .gte('tour_date', startD)
      .lte('tour_date', endD)
    if (tErr) {
      logToursNeedCheckError('toursNeedCheckStats: unassigned candidate tours', tErr)
      if (isAbortLikeError(tErr)) return []
      continue
    }
    for (const t of data || []) {
      const tr = t as {
        id: string
        tour_date: string | null
        tour_status: string | null
        product_id: string | null
        tour_guide_id: string | null
      }
      if (isTourDeletedStatus(tr.tour_status)) continue
      if (isTourCancelled((tr.tour_status || '').toString())) continue
      tourPool.push(tr)
    }
  }

  const guideEmails = [
    ...new Set(tourPool.map((t) => t.tour_guide_id).filter((e): e is string => e != null && String(e).trim() !== '')),
  ]
  const teamMap = new Map<string, string>()
  if (guideEmails.length > 0) {
    const { data: team } = await supabase.from('team').select('email, name_ko, nick_name').in('email', guideEmails)
    for (const m of team || []) {
      const row = m as { email: string; name_ko?: string | null; nick_name?: string | null }
      teamMap.set(row.email, (row.nick_name && row.nick_name.trim()) || row.name_ko || row.email)
    }
  }

  const candidateByKey = new Map<string, typeof tourPool>()
  for (const t of tourPool) {
    const pid = String(t.product_id ?? '').trim()
    if (!pid) continue
    const k = `${pid}|${ymdKey(t.tour_date)}`
    if (!candidateByKey.has(k)) candidateByKey.set(k, [])
    candidateByKey.get(k)!.push(t)
  }
  for (const [, list] of candidateByKey) {
    list.sort((a, b) => String(a.id).localeCompare(String(b.id)))
  }

  const labelMap = await fetchReservationDisplayLabels(
    supabase,
    rawForMania.map((r) => r.id)
  )

  const out: UnassignedReservationNeedCheckRow[] = []
  for (const r of rawForMania) {
    const pid = r.product_id as string
    const dKey = ymdKey(r.tour_date)
    const ckey = `${pid}|${dKey}`
    const list = candidateByKey.get(ckey) || []
    const candidateTours: UnassignedNeedCheckCandidateTour[] = list.map((t) => {
      const tid = String(t.id)
      const pnm = productNameById.get(pid) ?? null
      const g = t.tour_guide_id ? teamMap.get(t.tour_guide_id) ?? null : null
      return {
        tourId: tid,
        tourDate: t.tour_date,
        productName: pnm,
        guideName: g,
        tourStatus: t.tour_status,
      }
    })
    out.push({
      reservationId: r.id,
      displayLabel: labelMap.get(r.id) ?? null,
      productId: pid,
      productName: productNameById.get(pid) ?? null,
      tourDate: dKey,
      status: r.status,
      totalPeople: r.total_people || 0,
      candidateTours,
    })
  }

  out.sort((a, b) => b.tourDate.localeCompare(a.tourDate) || a.reservationId.localeCompare(b.reservationId))
  return out
}

/**
 * 목록에 나오는 투어 ID들에 대해 tour_expenses에 행이 하나라도 있으면 해당 tour_id를 반환.
 * (기존: tour_id + tour_date 복합키만 보면 지출 행의 tour_date가 투어일과 다를 때 영수증이 있어도 누락됨)
 */
async function fetchTourIdsHavingExpenses(
  supabase: SupabaseClient,
  tourIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>()
  const unique = [...new Set(tourIds.map((id) => String(id).trim()).filter(Boolean))]
  const chunkSize = 200
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase.from('tour_expenses').select('tour_id').in('tour_id', chunk)

    if (error) {
      logToursNeedCheckError('toursNeedCheckStats: tour_expenses by tour_id', error)
      if (isAbortLikeError(error)) return out
      continue
    }
    for (const row of data || []) {
      const tid = String((row as { tour_id?: string | null }).tour_id ?? '').trim()
      if (tid) out.add(tid)
    }
  }
  return out
}

async function fetchReservationDisplayLabels(
  supabase: SupabaseClient,
  reservationIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  const unique = [...new Set(reservationIds.map((id) => String(id).trim()).filter(Boolean))]
  const chunkSize = 200
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('reservations')
      .select('id, customer_id, channel_rn')
      .in('id', chunk)

    if (error) {
      logToursNeedCheckError('toursNeedCheckStats: reservations labels', error)
      if (isAbortLikeError(error)) return map
      continue
    }
    const customerIds = [
      ...new Set(
        (data || [])
          .map((r) => (r as { customer_id?: string | null }).customer_id)
          .filter((cid): cid is string => cid != null && String(cid).trim() !== '')
          .map((cid) => String(cid).trim())
      ),
    ]
    const customerNameById = new Map<string, string>()
    if (customerIds.length > 0) {
      const { data: customers, error: cErr } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds)
      if (cErr) {
        logToursNeedCheckError('toursNeedCheckStats: customers labels', cErr)
        if (isAbortLikeError(cErr)) return map
      } else {
        for (const c of customers || []) {
          const row = c as { id: string; name?: string | null }
          customerNameById.set(String(row.id), String(row.name || '').trim())
        }
      }
    }
    for (const r of data || []) {
      const row = r as { id: string; customer_id?: string | null; channel_rn?: string | null }
      const rid = String(row.id).trim()
      const custId = row.customer_id != null ? String(row.customer_id).trim() : ''
      const custName = custId ? customerNameById.get(custId) : undefined
      const rn = row.channel_rn != null ? String(row.channel_rn).trim() : ''
      const label =
        (custName && custName.length > 0 ? custName : null) ||
        (rn.length > 0 ? rn : null) ||
        null
      map.set(rid, label)
    }
  }
  return map
}

async function fetchReservationPeopleMeta(
  supabase: SupabaseClient,
  reservationIds: string[]
): Promise<Map<string, ReservationPeopleMeta>> {
  const map = new Map<string, ReservationPeopleMeta>()
  const unique = [...new Set(reservationIds.map((id) => String(id).trim()).filter(Boolean))]
  const chunkSize = 200
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('reservations')
      .select('id, total_people, status, product_id, tour_date')
      .in('id', chunk)

    if (error) {
      logToursNeedCheckError('toursNeedCheckStats: reservations people meta', error)
      if (isAbortLikeError(error)) return map
      continue
    }
    for (const r of data || []) {
      const row = r as {
        id: string
        total_people?: number | null
        status?: string | null
        product_id?: string | null
        tour_date?: string | null
      }
      const id = String(row.id).trim()
      map.set(id, {
        total_people: Number(row.total_people) || 0,
        status: row.status ?? null,
        product_id: row.product_id != null ? String(row.product_id) : null,
        tour_date: row.tour_date != null ? String(row.tour_date) : null,
      })
    }
  }
  return map
}

function buildDuplicateAssignmentByReservation(
  enriched: TourNeedCheckRow[],
  reservationIdsByTourId: Map<string, unknown>,
  globalCounts: Map<string, number>,
  reservationPeopleMeta: Map<string, ReservationPeopleMeta>
): DuplicateAssignmentReservationRow[] {
  const dupReservationIds = [...globalCounts.entries()]
    .filter(([, c]) => c >= 2)
    .map(([id]) => String(id).trim())
    .filter(Boolean)
    .sort()

  const productNameById = new Map<string, string>()
  for (const row of enriched) {
    if (row.product_id && row.product_name) {
      productNameById.set(String(row.product_id), row.product_name)
    }
  }

  const rows: DuplicateAssignmentReservationRow[] = []

  for (const resId of dupReservationIds) {
    const meta = reservationPeopleMeta.get(resId)
    const pid = meta?.product_id != null ? String(meta.product_id).trim() : ''
    const reservationTourDate = meta?.tour_date != null && String(meta.tour_date).length > 0 ? ymdKey(String(meta.tour_date)) : null
    const reservationProductLabel = pid
      ? (productNameById.get(pid) || pid)
      : null
    const placements: DuplicateAssignmentPlacement[] = []
    for (const tourRow of enriched) {
      const raw = reservationIdsByTourId.get(tourRow.id)
      const ids = normalizeReservationIds(raw)
      let slotsInTourList = 0
      for (const id of ids) {
        if (String(id).trim() === resId) slotsInTourList++
      }
      if (slotsInTourList === 0) continue
      placements.push({
        tourId: tourRow.id,
        tourDate: tourRow.tour_date,
        productName: tourRow.product_name,
        guideName: tourRow.guide_name,
        tourStatus: tourRow.tour_status,
        assignedPeopleCount: sumTourAssignedPeopleMatchingSlot(tourRow, raw, reservationPeopleMeta),
        slotsInTourList,
      })
    }
    placements.sort((a, b) => (b.tourDate || '').localeCompare(a.tourDate || ''))
    const uniqueTourCount = placements.length
    const isCrossTourDuplicate = uniqueTourCount >= 2
    const isListOnlyInTourDuplicate =
      uniqueTourCount === 1 && placements.some((p) => p.slotsInTourList > 1)
    rows.push({
      reservationId: resId,
      displayLabel: null,
      reservationTourDate,
      reservationProductLabel,
      occurrenceCount: globalCounts.get(resId) ?? placements.length,
      placements,
      uniqueTourCount,
      isCrossTourDuplicate,
      isListOnlyInTourDuplicate,
    })
  }

  rows.sort((a, b) => {
    const da = a.placements[0]?.tourDate || ''
    const db = b.placements[0]?.tourDate || ''
    if (da !== db) return db.localeCompare(da)
    return a.reservationId.localeCompare(b.reservationId)
  })

  return rows
}

async function fetchBalanceByReservationId(
  supabase: SupabaseClient,
  reservationIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const chunkSize = 500
  for (let i = 0; i < reservationIds.length; i += chunkSize) {
    const chunk = reservationIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('reservation_pricing')
      .select('reservation_id, balance_amount')
      .in('reservation_id', chunk)

    if (error) {
      logToursNeedCheckError('toursNeedCheckStats: reservation_pricing', error)
      if (isAbortLikeError(error)) return map
      continue
    }
    for (const row of data || []) {
      const r = row as { reservation_id: string; balance_amount?: unknown }
      map.set(String(r.reservation_id), numBalance(r.balance_amount))
    }
  }
  return map
}

function tourHasPositiveBalance(
  reservationIdsRaw: unknown,
  balanceByReservation: Map<string, number>
): boolean {
  const ids = normalizeReservationIds(reservationIdsRaw)
  for (const id of ids) {
    const b = balanceByReservation.get(String(id).trim()) ?? 0
    if (b > 0.009) return true
  }
  return false
}

function isPastOrTodayTour(tourDate: string | null | undefined, today: string): boolean {
  const td = (tourDate || '').trim()
  return td.length > 0 && td <= today
}

/**
 * 지난·오늘 투어 중 영수증 없음 / 예약 밸런스 잔액 있음 집계 (투어 관리 Need to check)
 */
export async function fetchToursNeedCheckData(supabase: SupabaseClient): Promise<{
  noReceipt: TourNeedCheckRow[]
  balanceRemaining: TourNeedCheckRow[]
  duplicateByReservation: DuplicateAssignmentReservationRow[]
  unassignedReservations: UnassignedReservationNeedCheckRow[]
  unionCount: number
  noReceiptCount: number
  balanceCount: number
  duplicateCount: number
  unassignedCount: number
}> {
  const today = todayYmd()
  const { rows: enriched, reservationIdsByTourId, productIdsExcludedNoReceipt, assignedReservationIdSet } =
    await fetchTourRowsWithMeta(supabase)
  const toursForOccurrence = Array.from(reservationIdsByTourId.entries()).map(([, raw]) => ({
    reservation_ids: raw,
  }))
  const globalReservationCounts = countReservationOccurrencesAcrossTours(toursForOccurrence)
  const tourIdsWithExpense = await fetchTourIdsHavingExpenses(
    supabase,
    enriched.map((r) => r.id)
  )

  const allReservationIds = new Set<string>()
  for (const id of reservationIdsByTourId.keys()) {
    const raw = reservationIdsByTourId.get(id)
    for (const rid of normalizeReservationIds(raw)) {
      allReservationIds.add(String(rid).trim())
    }
  }
  const balanceByReservation = await fetchBalanceByReservationId(supabase, [...allReservationIds])
  const reservationPeopleMeta = await fetchReservationPeopleMeta(supabase, [...allReservationIds])

  let duplicateByReservation = buildDuplicateAssignmentByReservation(
    enriched,
    reservationIdsByTourId,
    globalReservationCounts,
    reservationPeopleMeta
  )
  if (duplicateByReservation.length > 0) {
    const labelMap = await fetchReservationDisplayLabels(
      supabase,
      duplicateByReservation.map((r) => r.reservationId)
    )
    duplicateByReservation = duplicateByReservation.map((r) => ({
      ...r,
      displayLabel: labelMap.get(r.reservationId) ?? null,
    }))
  }

  const unassignedReservations = await fetchUnassignedReservationsForNeedCheck(
    supabase,
    assignedReservationIdSet
  )

  const noReceipt: TourNeedCheckRow[] = []
  const balanceRemaining: TourNeedCheckRow[] = []

  for (const row of enriched) {
    if (!isPastOrTodayTour(row.tour_date, today)) continue
    const st = (row.tour_status || '').toString()
    if (isTourCancelled(st)) continue

    const tid = String(row.id).trim()
    const hasTourExpense = tourIdsWithExpense.has(tid)

    if (!hasTourExpense) {
      const guideAssigned = String(row.tour_guide_id ?? '').trim().length > 0
      const productId = row.product_id != null ? String(row.product_id).trim() : ''
      const excludedProduct = productId !== '' && productIdsExcludedNoReceipt.has(productId)
      if (guideAssigned && !excludedProduct) {
        noReceipt.push(row)
      }
    }
    const resRaw = reservationIdsByTourId.get(row.id)
    if (tourHasPositiveBalance(resRaw, balanceByReservation)) {
      balanceRemaining.push(row)
    }
  }

  const sortDesc = (a: TourNeedCheckRow, b: TourNeedCheckRow) =>
    (b.tour_date || '').localeCompare(a.tour_date || '')
  noReceipt.sort(sortDesc)
  balanceRemaining.sort(sortDesc)

  const duplicateTourIds = new Set<string>()
  for (const dr of duplicateByReservation) {
    for (const p of dr.placements) {
      duplicateTourIds.add(p.tourId)
    }
  }

  const unionIds = new Set<string>([
    ...noReceipt.map((r) => r.id),
    ...balanceRemaining.map((r) => r.id),
    ...duplicateTourIds,
  ])

  return {
    noReceipt,
    balanceRemaining,
    duplicateByReservation,
    unassignedReservations,
    unionCount: unionIds.size + unassignedReservations.length,
    noReceiptCount: noReceipt.length,
    balanceCount: balanceRemaining.length,
    duplicateCount: duplicateByReservation.length,
    unassignedCount: unassignedReservations.length,
  }
}
