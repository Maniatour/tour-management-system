import { restoreExpenseBySourceKey as restoreExpenseBySourceKeyWithClient, softDeleteExpenseBySourceKey as softDeleteExpenseBySourceKeyWithClient } from '@/lib/expense-soft-delete'
import { supabase } from '@/lib/supabase'
import {
  BULK_COMPANY_DUP_AMOUNT_EPS,
  BULK_COMPANY_DUP_DAY_WINDOW,
  type LedgerDuplicateExpenseRow
} from '@/lib/statement-bulk-company-duplicate-check'
import {
  canonicalReservationIdKey,
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  normalizeReservationIds,
  normalizeTourDateKey
} from '@/utils/tourUtils'

const FETCH_PAGE = 1000
const MATCH_IN_CHUNK = 200

export type UnifiedExpenseSourceTable =
  | 'company_expenses'
  | 'tour_expenses'
  | 'reservation_expenses'
  | 'ticket_bookings'

export const UNIFIED_EXPENSE_SOURCE_LABEL: Record<UnifiedExpenseSourceTable, string> = {
  company_expenses: '회사 지출',
  tour_expenses: '투어 지출',
  reservation_expenses: '예약 지출',
  ticket_bookings: '입장권 부킹'
}

/** 중복 점검 참고란 — 투어 일자·상품명·상태·배정 인원 요약 */
export type TourReferenceSnapshot = {
  tourDate: string | null
  /** products.name */
  tourName: string | null
  tourStatus: string | null
  assignedPeople: number
  guideName: string
  assistantName: string
  vehicleName: string
}

type TourReservationHeadcountRow = {
  total_people?: number | null
  status?: string | null
  product_id?: string | null
  tour_date?: string | null
}

function lookupReservationRow(
  map: Map<string, TourReservationHeadcountRow>,
  reservationId: string
): TourReservationHeadcountRow | undefined {
  const trimmed = reservationId.trim()
  return map.get(trimmed) ?? map.get(canonicalReservationIdKey(trimmed))
}

function computeAssignedPeopleForTour(
  tour: { product_id?: string | null; tour_date?: string | null; reservation_ids?: unknown },
  reservationById: Map<string, TourReservationHeadcountRow>
): number {
  const productId = String(tour.product_id ?? '').trim()
  const tourDate = normalizeTourDateKey(tour.tour_date)
  if (!productId || !tourDate) return 0

  const counted = new Set<string>()
  let sum = 0
  for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
    const rid = String(rawId).trim()
    const key = canonicalReservationIdKey(rid)
    if (counted.has(key)) continue
    counted.add(key)

    const row = lookupReservationRow(reservationById, rid)
    if (!row) continue
    if (isReservationCancelledStatus(row.status) || isReservationDeletedStatus(row.status)) continue
    if (String(row.product_id ?? '').trim() !== productId) continue
    if (normalizeTourDateKey(row.tour_date) !== tourDate) continue
    sum += row.total_people || 0
  }
  return sum
}

export type UnifiedLedgerDuplicateExpenseRow = LedgerDuplicateExpenseRow & {
  source_table: UnifiedExpenseSourceTable
  source_key: string
  source_context: string | null
  /** 투어 연결 시 참고란 구조화 데이터 */
  tour_reference: TourReferenceSnapshot | null
  /** admin 투어 상세 `/[locale]/admin/tours/[id]` */
  detail_tour_id: string | null
  /** admin 예약 상세 `/[locale]/admin/reservations/[id]` */
  detail_reservation_id: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export function expenseSourceKey(table: UnifiedExpenseSourceTable, id: string): string {
  return `${table}:${id}`
}

export function parseExpenseSourceKey(key: string): { table: UnifiedExpenseSourceTable; id: string } | null {
  const idx = key.indexOf(':')
  if (idx <= 0) return null
  const table = key.slice(0, idx) as UnifiedExpenseSourceTable
  const id = key.slice(idx + 1)
  if (
    table !== 'company_expenses' &&
    table !== 'tour_expenses' &&
    table !== 'reservation_expenses' &&
    table !== 'ticket_bookings'
  ) {
    return null
  }
  if (!id) return null
  return { table, id }
}

/** DB `fingerprint`와 동일한 규칙 */
export function canonPairFingerprint(ka: string, kb: string): string {
  const [a, b] = [ka, kb].sort((x, y) => x.localeCompare(y))
  return `pair:${a}|${b}`
}

export function canonGroupFingerprint(keys: string[]): string {
  const u = [...new Set(keys)].sort((x, y) => x.localeCompare(y))
  return `group:${u.join('|')}`
}

function comparableYmd(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return ''
}

function calendarDayDiffAbs(ymdA: string, ymdB: string): number {
  if (ymdA.length !== 10 || ymdB.length !== 10) return 999
  const [ya, ma, da] = ymdA.split('-').map(Number)
  const [yb, mb, db] = ymdB.split('-').map(Number)
  const ta = Date.UTC(ya, ma - 1, da)
  const tb = Date.UTC(yb, mb - 1, db)
  return Math.round(Math.abs(ta - tb) / 86400000)
}

function isIncludedStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  if (!s) return true
  if (s === 'approved' || s === 'pending') return true
  return false
}

function isLikelyUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim())
}

function paymentMethodLabelFromRow(row: {
  display_name?: string | null
  method?: string | null
  card_number_last4?: string | null
}): string {
  const dn = String(row.display_name ?? '').trim()
  if (dn) return dn
  const m = String(row.method ?? '').trim()
  const last4 = String(row.card_number_last4 ?? '').trim()
  if (m && last4) return `${m} ·${last4}`
  if (m) return m
  return '—'
}

async function fetchPaymentMethodLabelMap(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const uuidIds = [...new Set(ids.map((x) => x.trim()).filter((x) => x && isLikelyUuid(x)))]
  for (let i = 0; i < uuidIds.length; i += MATCH_IN_CHUNK) {
    const chunk = uuidIds.slice(i, i + MATCH_IN_CHUNK)
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, display_name, method, card_number_last4')
      .in('id', chunk)
    if (error) throw error
    for (const row of data || []) {
      const o = row as {
        id?: string
        display_name?: string | null
        method?: string | null
        card_number_last4?: string | null
      }
      const id = String(o.id ?? '')
      if (!id) continue
      out.set(id, paymentMethodLabelFromRow(o))
    }
  }
  return out
}

async function fetchStatementLineFinancialAccountNames(lineIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(lineIds.map((x) => x.trim()).filter(Boolean))]
  if (unique.length === 0) return out

  const sb = supabase as any
  const lineToImport = new Map<string, string>()

  for (let i = 0; i < unique.length; i += MATCH_IN_CHUNK) {
    const chunk = unique.slice(i, i + MATCH_IN_CHUNK)
    const { data: linesRaw, error: lineErr } = await sb
      .from('statement_lines')
      .select('id, statement_import_id')
      .in('id', chunk)
    if (lineErr) throw lineErr
    const lines = (linesRaw as { id?: string; statement_import_id?: string }[]) || []
    for (const l of lines) {
      const lid = String(l.id ?? '')
      const iid = String(l.statement_import_id ?? '').trim()
      if (lid && iid) lineToImport.set(lid, iid)
    }
  }

  const importIds = [...new Set([...lineToImport.values()])]
  const importToFa = new Map<string, string>()
  for (let j = 0; j < importIds.length; j += MATCH_IN_CHUNK) {
    const ichunk = importIds.slice(j, j + MATCH_IN_CHUNK)
    const { data: impsRaw, error: impErr } = await sb
      .from('statement_imports')
      .select('id, financial_account_id')
      .in('id', ichunk)
    if (impErr) throw impErr
    const imps = (impsRaw as { id?: string; financial_account_id?: string }[]) || []
    for (const im of imps) {
      const id = String(im.id ?? '')
      const fa = String(im.financial_account_id ?? '').trim()
      if (id && fa) importToFa.set(id, fa)
    }
  }

  const faIds = [...new Set([...importToFa.values()])]
  const faName = new Map<string, string>()
  for (let j = 0; j < faIds.length; j += MATCH_IN_CHUNK) {
    const fchunk = faIds.slice(j, j + MATCH_IN_CHUNK)
    const { data: facsRaw, error: faErr } = await sb.from('financial_accounts').select('id, name').in('id', fchunk)
    if (faErr) throw faErr
    const facs = (facsRaw as { id?: string; name?: string }[]) || []
    for (const f of facs) {
      const id = String(f.id ?? '')
      const name = String(f.name ?? '').trim()
      if (id) faName.set(id, name || id)
    }
  }

  for (const [lid, impId] of lineToImport) {
    const faId = importToFa.get(impId)
    const name = faId ? faName.get(faId) : undefined
    if (name) out.set(lid, name)
  }
  return out
}

function normalizeReconSourceId(id: string): string {
  const t = id.trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    return t.toLowerCase()
  }
  return t
}

function effectiveStatementLineId(row: {
  statement_line_id: string | null
  reconciled_statement_line_id: string | null
}): string | null {
  const a = (row.reconciled_statement_line_id ?? '').trim()
  if (a) return a
  const b = (row.statement_line_id ?? '').trim()
  return b || null
}

/** 교차 중복 모달·보관함 — reconciliation_matches 우선, 행의 statement_line_id 보조 */
export function formatExpenseStatementLinkDisplay(row: {
  reconciled_statement_line_id?: string | null
  statement_line_id?: string | null
}): string {
  const recon = (row.reconciled_statement_line_id ?? '').trim()
  if (recon) return `대조:${recon.slice(0, 8)}…`
  const direct = (row.statement_line_id ?? '').trim()
  if (direct) return `행:${direct.slice(0, 8)}…`
  return '미연결'
}

function clusterKeysFromPairs(pairs: [string, string][]): string[][] {
  const nodes = new Set<string>()
  for (const [a, b] of pairs) {
    nodes.add(a)
    nodes.add(b)
  }
  const parent = new Map<string, string>()
  for (const id of nodes) parent.set(id, id)
  function find(x: string): string {
    let p = parent.get(x)!
    if (p !== x) {
      p = find(p)
      parent.set(x, p)
    }
    return p
  }
  function union(a: string, b: string) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const [a, b] of pairs) union(a, b)
  const buckets = new Map<string, string[]>()
  for (const id of nodes) {
    const r = find(id)
    if (!buckets.has(r)) buckets.set(r, [])
    buckets.get(r)!.push(id)
  }
  return [...buckets.values()].filter((g) => g.length >= 2)
}

async function fetchReconciliationLinesForSourceTable(
  sourceTable: UnifiedExpenseSourceTable,
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (ids.length === 0) return map
  for (let i = 0; i < ids.length; i += MATCH_IN_CHUNK) {
    const chunk = ids.slice(i, i + MATCH_IN_CHUNK)
    const { data, error } = await (supabase as any)
      .from('reconciliation_matches')
      .select('source_id, statement_line_id')
      .eq('source_table', sourceTable)
      .in('source_id', chunk)
    if (error) throw error
    for (const row of data || []) {
      const sid = normalizeReconSourceId(String((row as { source_id?: string }).source_id ?? ''))
      const lid = String((row as { statement_line_id?: string }).statement_line_id ?? '').trim()
      if (!sid || !lid) continue
      if (!map.has(sid)) map.set(sid, lid)
    }
  }
  return map
}

type RawTagged = { _source_table: UnifiedExpenseSourceTable; _raw: Record<string, unknown> }

function readDeletedMeta(r: Record<string, unknown>): { deleted_at: string | null; deleted_by: string | null } {
  return {
    deleted_at: r.deleted_at == null ? null : String(r.deleted_at),
    deleted_by: r.deleted_by == null ? null : String(r.deleted_by)
  }
}

async function fetchExpenseTableWindow(
  table: UnifiedExpenseSourceTable,
  selectList: string,
  options?: { deletedOnly?: boolean }
): Promise<Record<string, unknown>[]> {
  const sb = table === 'reservation_expenses' ? (supabase as any) : supabase
  const deletedOnly = options?.deletedOnly === true
  const selectWithDeleted = selectList.includes('deleted_at')
    ? selectList
    : `${selectList}, deleted_at, deleted_by`
  const out: Record<string, unknown>[] = []
  let from = 0
  for (;;) {
    let q = sb.from(table).select(selectWithDeleted)
    if (deletedOnly) {
      q = q.not('deleted_at', 'is', null)
    } else {
      q = q.is('deleted_at', null)
    }
    if (table === 'ticket_bookings' && !deletedOnly) {
      q = q.or('status.eq.confirmed,status.eq.Confirmed')
    }
    const orderCol = deletedOnly ? 'deleted_at' : 'submit_on'
    const { data, error } = await q
      .order(orderCol, { ascending: !deletedOnly })
      .order('id', { ascending: true })
      .range(from, from + FETCH_PAGE - 1)
    if (error) throw error
    const batch = (data as Record<string, unknown>[]) || []
    out.push(...batch)
    if (batch.length < FETCH_PAGE) break
    from += FETCH_PAGE
  }
  return out
}

async function fetchExpenseDuplicateSuppressionFingerprints(): Promise<{
  pairFp: Set<string>
  groupFp: Set<string>
}> {
  const pairFp = new Set<string>()
  const groupFp = new Set<string>()
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('expense_duplicate_suppressions')
      .select('fingerprint, kind')
      .order('created_at', { ascending: false })
      .range(from, from + FETCH_PAGE - 1)
    if (error) throw error
    const batch = (data as { fingerprint?: string; kind?: string }[]) || []
    for (const r of batch) {
      const fp = String(r.fingerprint ?? '')
      const k = String(r.kind ?? '')
      if (!fp) continue
      if (k === 'pair') pairFp.add(fp)
      else if (k === 'group') groupFp.add(fp)
    }
    if (batch.length < FETCH_PAGE) break
    from += FETCH_PAGE
  }
  return { pairFp, groupFp }
}

function sortUnifiedGroupRows(rows: UnifiedLedgerDuplicateExpenseRow[]): UnifiedLedgerDuplicateExpenseRow[] {
  return [...rows].sort((a, b) => {
    const ay = comparableYmd(a.submit_on)
    const by = comparableYmd(b.submit_on)
    if (ay !== by) return ay.localeCompare(by)
    return a.source_key.localeCompare(b.source_key)
  })
}

type DuplicatePairTourLink = Pick<UnifiedLedgerDuplicateExpenseRow, 'source_table' | 'detail_tour_id'>

/** 연결 tour_id가 둘 다 있고 서로 다르면 금액·등록일이 비슷해도 중복 쌍에서 제외 */
export function expenseDuplicatePairHasDifferentLinkedTours(
  a: { tour_id?: string | null; detail_tour_id?: string | null },
  b: { tour_id?: string | null; detail_tour_id?: string | null }
): boolean {
  const tourA = (a.tour_id ?? a.detail_tour_id)?.trim() || ''
  const tourB = (b.tour_id ?? b.detail_tour_id)?.trim() || ''
  if (!tourA || !tourB) return false
  return tourA !== tourB
}

/**
 * 투어 지출끼리 연결 투어 ID가 둘 다 있고 서로 다르면 금액·등록일이 비슷해도 중복 쌍에서 제외합니다.
 */
export function tourExpenseDuplicatePairHasDifferentLinkedTours(a: DuplicatePairTourLink, b: DuplicatePairTourLink): boolean {
  if (a.source_table !== 'tour_expenses' || b.source_table !== 'tour_expenses') return false
  return expenseDuplicatePairHasDifferentLinkedTours(a, b)
}

type LedgerRowBeforeDisplay = Omit<
  UnifiedLedgerDuplicateExpenseRow,
  'display_payment_method' | 'display_statement_status' | 'display_financial_account' | 'tour_reference'
>

function applyLedgerDisplayFields(
  row: LedgerRowBeforeDisplay,
  pmLabels: Map<string, string>,
  lineAccountNames: Map<string, string>
): UnifiedLedgerDuplicateExpenseRow {
  const pmRaw = (row.payment_method ?? '').trim()
  let displayPm = '—'
  if (pmRaw) {
    displayPm = pmLabels.get(pmRaw) ?? pmRaw
  }
  const lineId = effectiveStatementLineId(row)
  const displayStmt = formatExpenseStatementLinkDisplay(row)
  let displayFa: string | null = '—'
  if (lineId) {
    displayFa = lineAccountNames.get(lineId) ?? '—'
  }
  return {
    ...row,
    tour_reference: null,
    display_payment_method: displayPm,
    display_statement_status: displayStmt,
    display_financial_account: displayFa,
  }
}

function mapCompanyRaw(
  r: Record<string, unknown>,
  recon: Map<string, string>,
  source_table: 'company_expenses'
): Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'> {
  const id = String(r.id ?? '')
  return {
    id,
    amount: r.amount == null ? null : Number(r.amount),
    submit_on: r.submit_on == null ? null : String(r.submit_on),
    paid_to: r.paid_to == null ? null : String(r.paid_to),
    paid_for: r.paid_for == null ? null : String(r.paid_for),
    description: r.description == null ? null : String(r.description),
    category: r.category == null ? null : String(r.category),
    status: r.status == null ? null : String(r.status),
    statement_line_id: r.statement_line_id == null ? null : String(r.statement_line_id),
    ledger_expense_origin: r.ledger_expense_origin == null ? null : String(r.ledger_expense_origin),
    reconciled_statement_line_id: recon.get(normalizeReconSourceId(id)) ?? null,
    standard_paid_for: r.standard_paid_for == null ? null : String(r.standard_paid_for),
    payment_method: r.payment_method == null ? null : String(r.payment_method),
    source_table,
    source_key: expenseSourceKey(source_table, id),
    source_context: null,
    tour_reference: null,
    detail_tour_id: null,
    detail_reservation_id: null,
    ...readDeletedMeta(r)
  }
}

function teamShortName(
  row: { nick_name?: string | null; name_ko?: string | null } | undefined,
  email: string
): string {
  if (!email) return '—'
  const nick = String(row?.nick_name ?? '').trim()
  const name = String(row?.name_ko ?? '').trim()
  if (nick) return nick
  if (name) return name
  const local = email.split('@')[0]?.trim()
  return local || '—'
}

function vehicleShortName(
  row: { vehicle_number?: string | null; nick?: string | null } | undefined
): string {
  if (!row) return '—'
  const nick = String(row.nick ?? '').trim()
  const num = String(row.vehicle_number ?? '').trim()
  return nick || num || '—'
}

/** 투어 ID별 참고란 — 상태·가이드·어시·차량(이름만) */
export async function fetchTourReferenceMap(tourIds: string[]): Promise<Map<string, TourReferenceSnapshot>> {
  const out = new Map<string, TourReferenceSnapshot>()
  const ids = [...new Set(tourIds.map((x) => x.trim()).filter(Boolean))]
  if (ids.length === 0) return out

  type TourRefRow = {
    id?: string
    tour_date?: string | null
    product_id?: string | null
    reservation_ids?: unknown
    tour_guide_id?: string | null
    assistant_id?: string | null
    tour_car_id?: string | null
    tour_status?: string | null
  }

  const tours: TourRefRow[] = []
  for (let i = 0; i < ids.length; i += MATCH_IN_CHUNK) {
    const chunk = ids.slice(i, i + MATCH_IN_CHUNK)
    const { data, error } = await supabase
      .from('tours')
      .select(
        'id, tour_date, product_id, reservation_ids, tour_guide_id, assistant_id, tour_car_id, tour_status'
      )
      .in('id', chunk)
    if (error) throw error
    tours.push(...((data as TourRefRow[]) || []))
  }

  const emails = new Set<string>()
  const vehicleIds = new Set<string>()
  const productIds = new Set<string>()
  for (const t of tours) {
    const g = String(t.tour_guide_id ?? '').trim()
    const a = String(t.assistant_id ?? '').trim()
    if (g) emails.add(g)
    if (a) emails.add(a)
    const vid = String(t.tour_car_id ?? '').trim()
    if (vid) vehicleIds.add(vid)
    const pid = String(t.product_id ?? '').trim()
    if (pid) productIds.add(pid)
  }

  const teamByEmail = new Map<string, { nick_name?: string | null; name_ko?: string | null }>()
  const emailList = [...emails]
  for (let i = 0; i < emailList.length; i += MATCH_IN_CHUNK) {
    const chunk = emailList.slice(i, i + MATCH_IN_CHUNK)
    const { data, error } = await supabase.from('team').select('email, nick_name, name_ko').in('email', chunk)
    if (error) throw error
    for (const row of data || []) {
      const o = row as { email?: string; nick_name?: string | null; name_ko?: string | null }
      const e = String(o.email ?? '').trim()
      if (e) teamByEmail.set(e, o)
    }
  }

  const vehicleById = new Map<string, { vehicle_number?: string | null; nick?: string | null }>()
  const vidList = [...vehicleIds]
  for (let i = 0; i < vidList.length; i += MATCH_IN_CHUNK) {
    const chunk = vidList.slice(i, i + MATCH_IN_CHUNK)
    const { data, error } = await supabase.from('vehicles').select('id, vehicle_number, nick').in('id', chunk)
    if (error) throw error
    for (const row of data || []) {
      const o = row as { id?: string; vehicle_number?: string | null; nick?: string | null }
      const id = String(o.id ?? '').trim()
      if (id) vehicleById.set(id, o)
    }
  }

  const productById = new Map<string, { name?: string | null }>()
  const pidList = [...productIds]
  for (let i = 0; i < pidList.length; i += MATCH_IN_CHUNK) {
    const chunk = pidList.slice(i, i + MATCH_IN_CHUNK)
    const { data, error } = await supabase.from('products').select('id, name').in('id', chunk)
    if (error) throw error
    for (const row of data || []) {
      const o = row as { id?: string; name?: string | null }
      const id = String(o.id ?? '').trim()
      if (id) productById.set(id, o)
    }
  }

  const reservationIdSet = new Set<string>()
  for (const t of tours) {
    for (const rid of normalizeReservationIds(t.reservation_ids)) {
      const trimmed = String(rid).trim()
      if (trimmed) reservationIdSet.add(trimmed)
    }
  }

  const reservationById = new Map<string, TourReservationHeadcountRow>()
  const reservationIdList = [...reservationIdSet]
  for (let i = 0; i < reservationIdList.length; i += MATCH_IN_CHUNK) {
    const chunk = reservationIdList.slice(i, i + MATCH_IN_CHUNK)
    const { data, error } = await supabase
      .from('reservations')
      .select('id, total_people, status, product_id, tour_date')
      .in('id', chunk)
    if (error) throw error
    for (const row of data || []) {
      const o = row as TourReservationHeadcountRow & { id?: string }
      const id = String(o.id ?? '').trim()
      if (!id) continue
      reservationById.set(id, o)
      reservationById.set(canonicalReservationIdKey(id), o)
    }
  }

  for (const t of tours) {
    const tid = String(t.id ?? '').trim()
    if (!tid) continue
    const guideEmail = String(t.tour_guide_id ?? '').trim()
    const assistantEmail = String(t.assistant_id ?? '').trim()
    const carId = String(t.tour_car_id ?? '').trim()
    const productId = String(t.product_id ?? '').trim()
    const product = productId ? productById.get(productId) : undefined
    const tourDateRaw = t.tour_date == null ? '' : String(t.tour_date).trim()
    const tourDate =
      tourDateRaw.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(tourDateRaw) ? tourDateRaw.slice(0, 10) : null
    out.set(tid, {
      tourDate,
      tourName: product?.name?.trim() || null,
      tourStatus: t.tour_status == null ? null : String(t.tour_status),
      assignedPeople: computeAssignedPeopleForTour(t, reservationById),
      guideName: teamShortName(teamByEmail.get(guideEmail), guideEmail),
      assistantName: teamShortName(teamByEmail.get(assistantEmail), assistantEmail),
      vehicleName: carId ? vehicleShortName(vehicleById.get(carId)) : '—'
    })
  }

  return out
}

function enrichRowsWithTourReference(
  rows: UnifiedLedgerDuplicateExpenseRow[],
  tourRefs: Map<string, TourReferenceSnapshot>
): UnifiedLedgerDuplicateExpenseRow[] {
  return rows.map((row) => {
    const tid = row.detail_tour_id?.trim()
    if (!tid) return { ...row, tour_reference: null }
    const ref = tourRefs.get(tid)
    if (!ref) return { ...row, tour_reference: null }
    return { ...row, tour_reference: ref }
  })
}

function mapTourRaw(
  r: Record<string, unknown>,
  recon: Map<string, string>,
  source_table: 'tour_expenses'
): Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'> {
  const id = String(r.id ?? '')
  const tourDate = r.tour_date == null ? '' : String(r.tour_date).slice(0, 10)
  const tid = r.tour_id == null ? '' : String(r.tour_id)
  const ctx = tourDate ? `투어일 ${tourDate}` : null
  return {
    id,
    amount: r.amount == null ? null : Number(r.amount),
    submit_on: r.submit_on == null ? null : String(r.submit_on),
    paid_to: r.paid_to == null ? null : String(r.paid_to),
    paid_for: r.paid_for == null ? null : String(r.paid_for),
    description: r.note == null ? null : String(r.note),
    category: null,
    status: r.status == null ? null : String(r.status),
    statement_line_id: r.statement_line_id == null ? null : String(r.statement_line_id),
    ledger_expense_origin: null,
    reconciled_statement_line_id: recon.get(normalizeReconSourceId(id)) ?? null,
    standard_paid_for: null,
    payment_method: r.payment_method == null ? null : String(r.payment_method),
    source_table,
    source_key: expenseSourceKey(source_table, id),
    source_context: ctx,
    tour_reference: null,
    detail_tour_id: tid.trim() ? tid : null,
    detail_reservation_id: null,
    ...readDeletedMeta(r)
  }
}

function mapReservationRaw(
  r: Record<string, unknown>,
  recon: Map<string, string>,
  source_table: 'reservation_expenses'
): Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'> {
  const id = String(r.id ?? '')
  const rid = r.reservation_id == null ? '' : String(r.reservation_id)
  const tourLinkId = r.tour_id == null ? '' : String(r.tour_id)
  const ctx = rid ? `예약 ${rid.slice(0, 8)}…` : null
  return {
    id,
    amount: r.amount == null ? null : Number(r.amount),
    submit_on: r.submit_on == null ? null : String(r.submit_on),
    paid_to: r.paid_to == null ? null : String(r.paid_to),
    paid_for: r.paid_for == null ? null : String(r.paid_for),
    description: r.note == null ? null : String(r.note),
    category: null,
    status: r.status == null ? null : String(r.status),
    statement_line_id: r.statement_line_id == null ? null : String(r.statement_line_id),
    ledger_expense_origin: null,
    reconciled_statement_line_id: recon.get(normalizeReconSourceId(id)) ?? null,
    standard_paid_for: null,
    payment_method: r.payment_method == null ? null : String(r.payment_method),
    source_table,
    source_key: expenseSourceKey(source_table, id),
    source_context: ctx,
    tour_reference: null,
    detail_tour_id: tourLinkId.trim() ? tourLinkId : null,
    detail_reservation_id: rid.trim() ? rid : null,
    ...readDeletedMeta(r)
  }
}

function mapTicketRaw(
  r: Record<string, unknown>,
  recon: Map<string, string>,
  source_table: 'ticket_bookings'
): Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'> {
  const id = String(r.id ?? '')
  const cat = r.category == null ? '' : String(r.category)
  const co = r.company == null ? '' : String(r.company)
  const tidTb = r.tour_id == null ? '' : String(r.tour_id)
  const ridTb = r.reservation_id == null ? '' : String(r.reservation_id)
  return {
    id,
    amount: r.expense == null ? null : Number(r.expense),
    submit_on: r.submit_on == null ? null : String(r.submit_on),
    paid_to: co || null,
    paid_for: cat || null,
    description: r.note == null ? null : String(r.note),
    category: cat || null,
    status: r.booking_status == null ? null : String(r.booking_status),
    statement_line_id: r.statement_line_id == null ? null : String(r.statement_line_id),
    ledger_expense_origin: null,
    reconciled_statement_line_id: recon.get(normalizeReconSourceId(id)) ?? null,
    standard_paid_for: null,
    payment_method: r.payment_method == null ? null : String(r.payment_method),
    source_table,
    source_key: expenseSourceKey(source_table, id),
    source_context: r.check_in_date == null ? null : `체크인 ${String(r.check_in_date).slice(0, 10)}`,
    tour_reference: null,
    detail_tour_id: tidTb.trim() ? tidTb : null,
    detail_reservation_id: ridTb.trim() ? ridTb : null,
    ...readDeletedMeta(r)
  }
}

/**
 * 회사·투어·예약·입장권 지출을 한 풀에서 금액·등록일(±) 기준으로 묶은 중복 의심 그룹.
 * `expense_duplicate_suppressions`에 기록된 쌍·그룹은 제외합니다.
 */
export async function fetchUnifiedExpenseLedgerDuplicateGroups(): Promise<{ groups: UnifiedLedgerDuplicateExpenseRow[][] }> {
  const [ce, te, re, tb, { pairFp, groupFp }] = await Promise.all([
    fetchExpenseTableWindow(
      'company_expenses',
      'id, amount, submit_on, paid_to, paid_for, description, category, status, statement_line_id, ledger_expense_origin, standard_paid_for, payment_method'
    ),
    fetchExpenseTableWindow(
      'tour_expenses',
      'id, amount, submit_on, paid_to, paid_for, note, status, payment_method, statement_line_id, tour_date, tour_id'
    ),
    fetchExpenseTableWindow(
      'reservation_expenses',
      'id, amount, submit_on, paid_to, paid_for, note, status, payment_method, statement_line_id, reservation_id, tour_id'
    ),
    fetchExpenseTableWindow(
      'ticket_bookings',
      'id, expense, submit_on, category, company, note, booking_status, payment_method, statement_line_id, check_in_date, tour_id, reservation_id'
    ),
    fetchExpenseDuplicateSuppressionFingerprints()
  ])

  const tagged: RawTagged[] = [
    ...ce.map((r) => ({ _source_table: 'company_expenses' as const, _raw: r })),
    ...te.map((r) => ({ _source_table: 'tour_expenses' as const, _raw: r })),
    ...re.map((r) => ({ _source_table: 'reservation_expenses' as const, _raw: r })),
    ...tb.map((r) => ({ _source_table: 'ticket_bookings' as const, _raw: r }))
  ]

  tagged.sort((a, b) => {
    const ta = String(a._raw.submit_on ?? '')
    const tb = String(b._raw.submit_on ?? '')
    if (ta !== tb) return ta.localeCompare(tb)
    return expenseSourceKey(a._source_table, String(a._raw.id ?? '')).localeCompare(
      expenseSourceKey(b._source_table, String(b._raw.id ?? ''))
    )
  })

  const idsByTable: Record<UnifiedExpenseSourceTable, string[]> = {
    company_expenses: [],
    tour_expenses: [],
    reservation_expenses: [],
    ticket_bookings: []
  }
  for (const t of tagged) {
    const id = String(t._raw.id ?? '')
    if (id) idsByTable[t._source_table].push(id)
  }

  const [rCompany, rTour, rRes, rTicket] = await Promise.all([
    fetchReconciliationLinesForSourceTable('company_expenses', idsByTable.company_expenses),
    fetchReconciliationLinesForSourceTable('tour_expenses', idsByTable.tour_expenses),
    fetchReconciliationLinesForSourceTable('reservation_expenses', idsByTable.reservation_expenses),
    fetchReconciliationLinesForSourceTable('ticket_bookings', idsByTable.ticket_bookings)
  ])

  const byKey = new Map<
    string,
    Omit<UnifiedLedgerDuplicateExpenseRow, 'display_payment_method' | 'display_statement_status' | 'display_financial_account'>
  >()
  const eligibleBase: Omit<
    UnifiedLedgerDuplicateExpenseRow,
    'display_payment_method' | 'display_statement_status' | 'display_financial_account'
  >[] = []

  for (const { _source_table, _raw } of tagged) {
    let row: Omit<
      UnifiedLedgerDuplicateExpenseRow,
      'display_payment_method' | 'display_statement_status' | 'display_financial_account'
    >
    if (_source_table === 'company_expenses') {
      row = mapCompanyRaw(_raw, rCompany, _source_table)
    } else if (_source_table === 'tour_expenses') {
      row = mapTourRaw(_raw, rTour, _source_table)
    } else if (_source_table === 'reservation_expenses') {
      row = mapReservationRaw(_raw, rRes, _source_table)
    } else {
      row = mapTicketRaw(_raw, rTicket, _source_table)
    }
    const amt = row.amount
    if (amt == null || !Number.isFinite(amt) || amt === 0) continue
    if (!isIncludedStatus(row.status)) continue
    eligibleBase.push(row)
    byKey.set(row.source_key, row)
  }

  /** 출처 테이블 무관 — 회사↔투어, 회사↔예약 등 교차 쌍도 동일 규칙으로 포함 */
  const pairKeys: [string, string][] = []
  for (let i = 0; i < eligibleBase.length; i++) {
    const a = eligibleBase[i]!
    const ay = comparableYmd(a.submit_on)
    if (ay.length !== 10) continue
    const aAmt = a.amount
    if (aAmt == null || !Number.isFinite(aAmt)) continue
    for (let j = i + 1; j < eligibleBase.length; j++) {
      const b = eligibleBase[j]!
      const by = comparableYmd(b.submit_on)
      if (by.length !== 10) continue
      if (calendarDayDiffAbs(ay, by) > BULK_COMPANY_DUP_DAY_WINDOW) {
        if (by > ay) break
        continue
      }
      const bAmt = b.amount
      if (bAmt == null || !Number.isFinite(bAmt)) continue
      if (Math.abs(aAmt - bAmt) > BULK_COMPANY_DUP_AMOUNT_EPS) continue
      if (tourExpenseDuplicatePairHasDifferentLinkedTours(a, b)) continue
      const fp = canonPairFingerprint(a.source_key, b.source_key)
      if (pairFp.has(fp)) continue
      pairKeys.push([a.source_key, b.source_key])
    }
  }

  let clusters = clusterKeysFromPairs(pairKeys)
  clusters = clusters.filter((g) => {
    const gfp = canonGroupFingerprint(g)
    return !groupFp.has(gfp)
  })

  const allInClusters = new Set<string>()
  for (const g of clusters) for (const k of g) allInClusters.add(k)

  const pmIds: string[] = []
  const lineIds: string[] = []
  for (const k of allInClusters) {
    const row = byKey.get(k)
    if (!row) continue
    const pm = (row.payment_method ?? '').trim()
    if (pm) pmIds.push(pm)
    const lid = effectiveStatementLineId(row)
    if (lid) lineIds.push(lid)
  }
  const [pmLabels, lineAccounts] = await Promise.all([
    fetchPaymentMethodLabelMap(pmIds),
    fetchStatementLineFinancialAccountNames(lineIds)
  ])

  const groups: UnifiedLedgerDuplicateExpenseRow[][] = clusters.map((keyList) => {
    const rows = keyList
      .map((k) => byKey.get(k))
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .map((row) => applyLedgerDisplayFields(row, pmLabels, lineAccounts))
    return sortUnifiedGroupRows(rows)
  })

  const tourIdsForRef = new Set<string>()
  for (const group of groups) {
    for (const row of group) {
      const tid = row.detail_tour_id?.trim()
      if (tid) tourIdsForRef.add(tid)
    }
  }
  const tourRefs = await fetchTourReferenceMap([...tourIdsForRef])
  const enrichedGroups = groups.map((group) => enrichRowsWithTourReference(group, tourRefs))

  return { groups: enrichedGroups }
}

/** 소프트 삭제된 회사·투어·예약·입장권 지출 목록 (삭제일 최신순) */
export async function fetchSoftDeletedUnifiedExpenseRows(): Promise<UnifiedLedgerDuplicateExpenseRow[]> {
  const [ce, te, re, tb] = await Promise.all([
    fetchExpenseTableWindow(
      'company_expenses',
      'id, amount, submit_on, paid_to, paid_for, description, category, status, statement_line_id, ledger_expense_origin, standard_paid_for, payment_method',
      { deletedOnly: true }
    ),
    fetchExpenseTableWindow(
      'tour_expenses',
      'id, amount, submit_on, paid_to, paid_for, note, status, payment_method, statement_line_id, tour_date, tour_id',
      { deletedOnly: true }
    ),
    fetchExpenseTableWindow(
      'reservation_expenses',
      'id, amount, submit_on, paid_to, paid_for, note, status, payment_method, statement_line_id, reservation_id, tour_id',
      { deletedOnly: true }
    ),
    fetchExpenseTableWindow(
      'ticket_bookings',
      'id, expense, submit_on, category, company, note, booking_status, payment_method, statement_line_id, check_in_date, tour_id, reservation_id',
      { deletedOnly: true }
    )
  ])

  const tagged: RawTagged[] = [
    ...ce.map((r) => ({ _source_table: 'company_expenses' as const, _raw: r })),
    ...te.map((r) => ({ _source_table: 'tour_expenses' as const, _raw: r })),
    ...re.map((r) => ({ _source_table: 'reservation_expenses' as const, _raw: r })),
    ...tb.map((r) => ({ _source_table: 'ticket_bookings' as const, _raw: r }))
  ]

  const idsByTable: Record<UnifiedExpenseSourceTable, string[]> = {
    company_expenses: [],
    tour_expenses: [],
    reservation_expenses: [],
    ticket_bookings: []
  }
  for (const t of tagged) {
    const id = String(t._raw.id ?? '')
    if (id) idsByTable[t._source_table].push(id)
  }

  const [rCompany, rTour, rRes, rTicket] = await Promise.all([
    fetchReconciliationLinesForSourceTable('company_expenses', idsByTable.company_expenses),
    fetchReconciliationLinesForSourceTable('tour_expenses', idsByTable.tour_expenses),
    fetchReconciliationLinesForSourceTable('reservation_expenses', idsByTable.reservation_expenses),
    fetchReconciliationLinesForSourceTable('ticket_bookings', idsByTable.ticket_bookings)
  ])

  const baseRows: Omit<
    UnifiedLedgerDuplicateExpenseRow,
    'display_payment_method' | 'display_statement_status' | 'display_financial_account' | 'tour_reference'
  >[] = []

  for (const { _source_table, _raw } of tagged) {
    let row: Omit<
      UnifiedLedgerDuplicateExpenseRow,
      'display_payment_method' | 'display_statement_status' | 'display_financial_account' | 'tour_reference'
    >
    if (_source_table === 'company_expenses') {
      row = mapCompanyRaw(_raw, rCompany, _source_table)
    } else if (_source_table === 'tour_expenses') {
      row = mapTourRaw(_raw, rTour, _source_table)
    } else if (_source_table === 'reservation_expenses') {
      row = mapReservationRaw(_raw, rRes, _source_table)
    } else {
      row = mapTicketRaw(_raw, rTicket, _source_table)
    }
    baseRows.push(row)
  }

  baseRows.sort((a, b) => {
    const ad = a.deleted_at ?? ''
    const bd = b.deleted_at ?? ''
    if (ad !== bd) return bd.localeCompare(ad)
    return a.source_key.localeCompare(b.source_key)
  })

  const pmIds: string[] = []
  const lineIds: string[] = []
  for (const row of baseRows) {
    const pm = (row.payment_method ?? '').trim()
    if (pm) pmIds.push(pm)
    const lid = effectiveStatementLineId(row)
    if (lid) lineIds.push(lid)
  }
  const [pmLabels, lineAccounts] = await Promise.all([
    fetchPaymentMethodLabelMap(pmIds),
    fetchStatementLineFinancialAccountNames(lineIds)
  ])

  const withDisplay = baseRows.map((row) => applyLedgerDisplayFields(row, pmLabels, lineAccounts))

  const tourIdsForRef = new Set<string>()
  for (const row of withDisplay) {
    const tid = row.detail_tour_id?.trim()
    if (tid) tourIdsForRef.add(tid)
  }
  const tourRefs = await fetchTourReferenceMap([...tourIdsForRef])
  return enrichRowsWithTourReference(withDisplay, tourRefs)
}

export async function insertExpenseDuplicateSuppression(input: {
  fingerprint: string
  kind: 'pair' | 'group'
  member_keys: string[]
  created_by?: string | null
}): Promise<void> {
  const { error } = await supabase.from('expense_duplicate_suppressions').insert({
    fingerprint: input.fingerprint,
    kind: input.kind,
    member_keys: input.member_keys,
    created_by: input.created_by ?? null
  })
  if (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') return
    throw error
  }
}

/** 명세 매칭 해제 후 해당 출처 지출을 소프트 삭제합니다. */
export async function deleteExpenseBySourceKey(sourceKey: string, deletedBy?: string | null): Promise<void> {
  await softDeleteExpenseBySourceKeyWithClient(supabase, sourceKey, deletedBy)
}

/** 소프트 삭제된 지출을 복구합니다. */
export async function restoreExpenseBySourceKey(sourceKey: string): Promise<void> {
  await restoreExpenseBySourceKeyWithClient(supabase, sourceKey)
}
