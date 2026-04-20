import type { SupabaseClient } from '@supabase/supabase-js'
import { isTourDeletedStatus, normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'

export type TourNeedCheckRow = {
  id: string
  tour_date: string | null
  tour_status: string | null
  product_name: string | null
  product_id: string | null
  guide_name: string | null
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** DB/문자열 혼용 대비 YYYY-MM-DD */
function normalizeYmd(value: string | null | undefined): string {
  const s = (value || '').trim()
  if (!s) return ''
  return s.length >= 10 ? s.slice(0, 10) : s
}

function numBalance(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'string') return parseFloat(v) || 0
  return Number(v) || 0
}

async function fetchTourRowsWithMeta(supabase: SupabaseClient): Promise<{
  rows: TourNeedCheckRow[]
  reservationIdsByTourId: Map<string, unknown>
}> {
  const { data: tourRows, error: toursErr } = await supabase
    .from('tours')
    .select('id, tour_date, tour_status, product_id, tour_guide_id, reservation_ids')
    .order('tour_date', { ascending: false })

  if (toursErr) {
    console.error('toursNeedCheckStats: tours', toursErr)
    return { rows: [], reservationIdsByTourId: new Map() }
  }

  const nonDeleted = (tourRows || []).filter((t) => !isTourDeletedStatus(t.tour_status))

  const productIds = [...new Set(nonDeleted.map((t) => t.product_id).filter((id): id is string => id != null))]
  const activeProductIds = new Set<string>()
  const productLabel = new Map<string, string>()

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
    })
  }

  return { rows, reservationIdsByTourId }
}

/**
 * tour_expenses에 (tour_id + 해당 투어일 tour_date)로 입력된 행이 하나라도 있으면 키에 포함.
 * 영수증 이미지 여부와 무관하게 지출 행 존재만 본다.
 */
async function fetchTourExpenseKeys(supabase: SupabaseClient, today: string): Promise<Set<string>> {
  const keys = new Set<string>()
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('tour_expenses')
      .select('tour_id, tour_date')
      .lte('tour_date', today)
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('toursNeedCheckStats: tour_expenses', error)
      break
    }
    const chunk = data || []
    for (const row of chunk) {
      const tid = (row as { tour_id?: string }).tour_id
      const d = normalizeYmd(String((row as { tour_date?: string | null }).tour_date ?? ''))
      if (tid && d) {
        keys.add(`${tid}|${d}`)
      }
    }
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return keys
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
      console.error('toursNeedCheckStats: reservation_pricing', error)
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
  unionCount: number
  noReceiptCount: number
  balanceCount: number
}> {
  const today = todayYmd()
  const { rows: enriched, reservationIdsByTourId } = await fetchTourRowsWithMeta(supabase)
  const tourExpenseKeys = await fetchTourExpenseKeys(supabase, today)

  const allReservationIds = new Set<string>()
  for (const id of reservationIdsByTourId.keys()) {
    const raw = reservationIdsByTourId.get(id)
    for (const rid of normalizeReservationIds(raw)) {
      allReservationIds.add(String(rid).trim())
    }
  }
  const balanceByReservation = await fetchBalanceByReservationId(supabase, [...allReservationIds])

  const noReceipt: TourNeedCheckRow[] = []
  const balanceRemaining: TourNeedCheckRow[] = []

  for (const row of enriched) {
    if (!isPastOrTodayTour(row.tour_date, today)) continue
    const st = (row.tour_status || '').toString()
    if (isTourCancelled(st)) continue

    const dateKey = normalizeYmd(row.tour_date)
    const hasTourExpense =
      dateKey.length > 0 && tourExpenseKeys.has(`${row.id}|${dateKey}`)

    if (!hasTourExpense) {
      noReceipt.push(row)
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

  const unionIds = new Set<string>([...noReceipt.map((r) => r.id), ...balanceRemaining.map((r) => r.id)])

  return {
    noReceipt,
    balanceRemaining,
    unionCount: unionIds.size,
    noReceiptCount: noReceipt.length,
    balanceCount: balanceRemaining.length,
  }
}
