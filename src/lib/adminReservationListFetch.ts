import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { RESERVATION_LIST_SELECT } from '@/lib/reservationListSelect'
import {
  buildAdminReservationListPageCacheKey,
  hasAdminReservationListNextPage,
  readAdminReservationListPageCache,
  writeAdminReservationListPageCache,
} from '@/lib/adminReservationListPageCache'
import {
  buildAdminReservationCardWeekCacheKey,
  readAdminReservationCardWeekCache,
  writeAdminReservationCardWeekCache,
} from '@/lib/adminReservationCardWeekCache'
import {
  buildAdminReservationCalendarCacheKey,
  readAdminReservationCalendarCache,
  writeAdminReservationCalendarCache,
} from '@/lib/adminReservationCalendarCache'
import {
  browserLocalCalendarViewWindow,
  browserLocalCreatedAtGteIsoForRecentCalendarDays,
} from '@/lib/browserLocalWeek'
import { writeAdminReservationPricingMemory } from '@/lib/adminReservationPricingMemoryCache'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'

function qIdent(s: string): string {
  return String(s).replace(/"/g, '""')
}

/** PostgREST or() / filter용 ilike 값 (따옴표 포함) */
function ilikeQuoted(term: string): string {
  const p = `%${term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
  return `"${qIdent(p)}"`
}

function eqQuoted(val: string): string {
  return `"${qIdent(val)}"`
}

/**
 * 주간 카드(`card-week`): 한 번에 가져오는 행 수. PostgREST 기본 1000을 한 요청에 쓰지 않고
 * 여러 번 `.range`로 이어 받아 병합한다.
 */
export const ADMIN_RESERVATION_CARD_WEEK_CHUNK_SIZE = 500

/** 달력 뷰(`calendar`): 한 번에 가져오는 행 수 — PostgREST 1000 상한을 피하기 위해 청크 병합 */
export const ADMIN_RESERVATION_CALENDAR_CHUNK_SIZE = 500

/** 투어일이 이 값 이하(포함)인 예약은 주간 카드 전량 로드 시 나중 단계에서 조회 */
export const ADMIN_RESERVATION_LEGACY_TOUR_DATE_CUTOFF_YMD = '2024-12-31'

/** 주간 카드 단계 로드: “최근 등록” 구간(브라우저 로컬 달력, 오늘 포함 N일) */
export const ADMIN_RESERVATION_CARD_WEEK_RECENT_REGISTERED_DAYS = 7

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 마이그레이션 미적용 시 RPC 재시도 폭주 방지 */
let searchLookupRpcMissing = false
let cardWeekActivityRpcMissing = false
let cardWeekActivityCountRpcMissing = false

function isProbableUuid(s: string): boolean {
  return UUID_RE.test(s.trim())
}

function isIsoDateOnly(s: string): boolean {
  const t = s.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false
  const [y, m, d] = t.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/** TIME 컬럼 eq용 (PostgREST는 ilike 불가) */
function normalizeTimeForEq(s: string): string | null {
  const t = s.trim()
  const m = t.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/)
  if (!m) return null
  const hh = m[1].padStart(2, '0')
  const mm = m[2]
  const ss = m[3] ?? '00'
  return `${hh}:${mm}:${ss}`
}

export type AdminReservationListSort = 'created_at' | 'tour_date' | 'customer_name' | 'product_name'

export type FetchAdminReservationListArgs = {
  mode: 'card-flat' | 'card-week' | 'calendar'
  activityRangeStartIso?: string
  activityRangeEndIso?: string
  page: number
  pageSize: number
  selectedStatus: string
  selectedChannel: string
  dateRange: { start: string; end: string }
  customerIdFromUrl: string | null
  debouncedSearchTerm: string
  sortBy: AdminReservationListSort
  sortOrder: 'asc' | 'desc'
  calendarTourDateStart?: string
  calendarTourDateEnd?: string
  calendarCreatedStartIso?: string
  calendarCreatedEndIso?: string
  /** `card-week` 다청크 로드 시 진행률(예: 로딩 문구). */
  onCardWeekFetchProgress?: (info: { loaded: number; total: number | null }) => void
  /** `calendar` 다청크 로드 시 진행률 */
  onCalendarFetchProgress?: (info: { loaded: number; total: number | null }) => void
  /**
   * `card-week` 전용: 활동 구간 내 목록을 단계별로 나눔(검색어 없을 때 예약 관리 페이지에서 사용).
   * - tier1: 최근 등록일(로컬 달력 N일) + 투어일 null 또는 cutoff 초과
   * - tier2: tier1 제외 + 투어일 null 또는 cutoff 초과(등록이 더 오래됨)
   * - tier3: 투어일 ≤ cutoff
   */
  cardWeekLoadTier?: 'tier1_recent_modern' | 'tier2_older_modern' | 'tier3_legacy_tour'
  /** tier1·tier2: `created_at` 분할 기준(포함 하한). ISO 문자열 */
  cardWeekRecentCreatedGteIso?: string
  /** 기본 `*, choices, channels(name)` 대신 지정 select (운영 큐 등 전송량 절감) */
  selectFieldsOverride?: string
  /** false면 count 생략(운영 큐 2페이지 이후 등) */
  includeExactCount?: boolean
  /** Active SaaS tenant — defaults to Kovegas when omitted */
  operatorId?: string | null | undefined
}

function collectIds(rows: unknown): string[] {
  if (!Array.isArray(rows)) return []
  const out: string[] = []
  for (const r of rows) {
    if (r && typeof r === 'object' && 'id' in r) {
      const id = (r as { id: string }).id
      if (id) out.push(id)
    }
  }
  return [...new Set(out)]
}

/** Supabase 단일 요청: 네트워크/RLS 등으로 실패해도 검색 나머지 조건은 유지 */
async function safeSelectIds(
  label: string,
  run: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>
): Promise<string[]> {
  try {
    const { data, error } = await run()
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[admin reservation search] ${label} lookup skipped:`, error.message || error)
      }
      return []
    }
    return collectIds(data)
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[admin reservation search] ${label} lookup failed:`, e)
    }
    return []
  }
}

function isSearchLookupRpcUnavailable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const msg = (err.message ?? '').toLowerCase()
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    (msg.includes('function') && msg.includes('does not exist')) ||
    msg.includes('admin_reservation_search_lookup_ids')
  )
}

function parseSearchLookupRpcPayload(data: unknown): {
  customerIds: string[]
  productIds: string[]
  channelIds: string[]
} | null {
  if (!data || typeof data !== 'object') return null
  const row = data as {
    customer_ids?: unknown
    product_ids?: unknown
    channel_ids?: unknown
  }
  const asIds = (v: unknown): string[] => {
    if (!Array.isArray(v)) return []
    return [...new Set(v.map((x) => String(x ?? '').trim()).filter(Boolean))]
  }
  return {
    customerIds: asIds(row.customer_ids),
    productIds: asIds(row.product_ids),
    channelIds: asIds(row.channel_ids),
  }
}

async function fetchSearchLookupIdsViaRpc(
  supabase: SupabaseClient,
  term: string,
  operatorId?: string | null | undefined
): Promise<{
  customerIds: string[]
  productIds: string[]
  channelIds: string[]
} | null> {
  if (searchLookupRpcMissing) return null
  const opId = resolveOperatorId(operatorId)
  const { data, error } = await supabase.rpc('admin_reservation_search_lookup_ids', {
    p_operator_id: opId,
    p_term: term,
    p_limit: 500,
  })
  if (error) {
    if (isSearchLookupRpcUnavailable(error)) {
      searchLookupRpcMissing = true
      return null
    }
    if (process.env.NODE_ENV === 'development') {
      console.warn('[admin reservation search] lookup RPC failed:', error.message || error)
    }
    return null
  }
  return parseSearchLookupRpcPayload(data)
}

async function fetchSearchLookupIdsViaTables(
  supabase: SupabaseClient,
  term: string,
  operatorId: string
): Promise<{ customerIds: string[]; productIds: string[]; channelIds: string[] }> {
  const q = ilikeQuoted(term)
  const lookupLimit = 500
  const likePat = `%${term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
  const customerOr = `name.ilike.${q},special_requests.ilike.${q},email.ilike.${q},phone.ilike.${q},emergency_contact.ilike.${q}`

  const [cidsActive, productIds, channelIds] = await Promise.all([
    safeSelectIds('customers(active)', () =>
      supabase
        .from('customers')
        .select('id')
        .eq('operator_id', operatorId)
        .or(customerOr)
        .eq('archive', false)
        .limit(lookupLimit)
    ),
    safeSelectIds('products', () =>
      supabase
        .from('products')
        .select('id')
        .eq('operator_id', operatorId)
        .or(
          `name.ilike.${q},name_ko.ilike.${q},name_en.ilike.${q},product_code.ilike.${q},customer_name_ko.ilike.${q},customer_name_en.ilike.${q}`
        )
        .limit(lookupLimit)
    ),
    safeSelectIds('channels', () =>
      supabase
        .from('channels')
        .select('id')
        .eq('operator_id', operatorId)
        .ilike('name', likePat)
        .limit(lookupLimit)
    ),
  ])

  /** 보관 고객: 활성 매칭이 없을 때만 id 조회(보관 행 스캔·IN 크기 절약). */
  const customerIds =
    cidsActive.length > 0
      ? cidsActive
      : await safeSelectIds('customers(archive)', () =>
          supabase
            .from('customers')
            .select('id')
            .eq('operator_id', operatorId)
            .or(customerOr)
            .eq('archive', true)
            .limit(lookupLimit)
        )

  return { customerIds, productIds, channelIds }
}

async function buildSearchOrClause(
  supabase: SupabaseClient,
  term: string,
  operatorId?: string | null | undefined
): Promise<string | null> {
  const t = term.trim()
  if (!t) return null
  const opId = resolveOperatorId(operatorId)

  // 전체 UUID: 예약·고객·상품·채널 PK 등 btree eq만 사용 — customers/products/channels
  // 전부 ilike 조회(최대 3왕복)는 매우 느리므로 건너뜀.
  if (isProbableUuid(t)) {
    const id = t.trim()
    return [
      `id.eq.${eqQuoted(id)}`,
      `customer_id.eq.${eqQuoted(id)}`,
      `product_id.eq.${eqQuoted(id)}`,
      `channel_id.eq.${eqQuoted(id)}`,
    ].join(',')
  }

  const q = ilikeQuoted(t)
  const parts: string[] = [
    `channel_rn.ilike.${q}`,
    `pickup_hotel.ilike.${q}`,
    `added_by.ilike.${q}`,
    `event_note.ilike.${q}`,
    `sub_channel.ilike.${q}`,
    `variant_key.ilike.${q}`,
  ]

  if (isIsoDateOnly(t)) {
    parts.push(`tour_date.eq.${eqQuoted(t.trim())}`)
  }
  const timeEq = normalizeTimeForEq(t)
  if (timeEq) {
    parts.push(`tour_time.eq.${eqQuoted(timeEq)}`)
  }

  // ASCII 한 글자(a, 1 등): 보조 테이블 ilike + 대량 in(...)이 비용 대비 이득이 적음
  const skipAuxLookups = t.length === 1 && /^[\x00-\x7F]$/.test(t)

  if (!skipAuxLookups) {
    const viaRpc = await fetchSearchLookupIdsViaRpc(supabase, t, operatorId)
    const { customerIds, productIds, channelIds } =
      viaRpc ?? (await fetchSearchLookupIdsViaTables(supabase, t, opId))

    if (customerIds.length) parts.push(`customer_id.in.(${customerIds.join(',')})`)
    if (productIds.length) parts.push(`product_id.in.(${productIds.join(',')})`)
    if (channelIds.length) parts.push(`channel_id.in.(${channelIds.join(',')})`)
  }

  return parts.join(',')
}

type BuildQueryOpts = { includeExactCount?: boolean }

/**
 * 행 필터만 적용( select 이후 ). 정렬·card-week 단계(tier)는 호출부에서 이어서 적용.
 * eslint-disable: PostgREST 체인 타입이 버전마다 달라 any로 통일
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAdminReservationListRowFilters(q: any, args: FetchAdminReservationListArgs, searchOr: string | null): any {
  q = q.eq('operator_id', resolveOperatorId(args.operatorId))

  if (args.customerIdFromUrl) {
    q = q.eq('customer_id', args.customerIdFromUrl)
  }

  if (args.selectedStatus === 'all') {
    q = q.neq('status', 'deleted')
  } else {
    q = q.eq('status', args.selectedStatus)
  }

  if (args.selectedChannel !== 'all') {
    q = q.eq('channel_id', args.selectedChannel)
  }

  if (args.dateRange.start && args.dateRange.end) {
    q = q.gte('tour_date', args.dateRange.start).lte('tour_date', args.dateRange.end)
  }

  if (args.mode === 'card-week' && args.activityRangeStartIso && args.activityRangeEndIso) {
    const a = qIdent(args.activityRangeStartIso)
    const b = qIdent(args.activityRangeEndIso)
    q = q.or(
      `and(created_at.gte."${a}",created_at.lte."${b}"),and(updated_at.gte."${a}",updated_at.lte."${b}")`
    )
  }

  if (args.mode === 'calendar') {
    const td0 = args.calendarTourDateStart
    const td1 = args.calendarTourDateEnd
    const c0 = args.calendarCreatedStartIso
    const c1 = args.calendarCreatedEndIso
    if (td0 && td1 && c0 && c1) {
      const tds = qIdent(td0)
      const tde = qIdent(td1)
      const cs = qIdent(c0)
      const ce = qIdent(c1)
      q = q.or(
        `and(tour_date.gte."${tds}",tour_date.lte."${tde}"),and(created_at.gte."${cs}",created_at.lte."${ce}")`
      )
    }
  }

  if (searchOr) {
    q = q.or(searchOr)
  }

  return q
}

/**
 * 필터·정렬까지 적용한 빌더(`.range` / 실행 전). **동기**여야 함 —
 * Postgrest 쿼리 빌더는 `PromiseLike`라 `async` 함수에서 `return q`하면
 * `Promise.resolve(q)`가 쿼리를 즉시 실행해 `{ data, error }`만 남는다.
 */
function buildAdminReservationListQuery(
  supabase: SupabaseClient,
  args: FetchAdminReservationListArgs,
  searchOr: string | null,
  opts?: BuildQueryOpts
) {
  const includeExactCount =
    args.includeExactCount !== false && opts?.includeExactCount !== false
  const searchActive = args.debouncedSearchTerm.trim().length > 0
  /** 검색 시 OR·in(...)이 무거워 `exact` 카운트가 첫 응답을 크게 지연시킴 → 계획 행수로 대체 */
  const reservationCountMode = searchActive ? ('planned' as const) : ('exact' as const)

  let selectFields = args.selectFieldsOverride ?? RESERVATION_LIST_SELECT
  // remote DB에 reservations→customers FK 없음 — customers embed/정렬 참조 불가
  if (args.sortBy === 'product_name') {
    selectFields = `${RESERVATION_LIST_SELECT}, products(name, name_ko, name_en)`
  } else if (args.sortBy === 'customer_name') {
    selectFields = RESERVATION_LIST_SELECT
  }

  let q = includeExactCount
    ? supabase.from('reservations').select(selectFields, { count: reservationCountMode })
    : supabase.from('reservations').select(selectFields)

  q = applyAdminReservationListRowFilters(q, args, searchOr)

  if (args.mode === 'card-week' && args.cardWeekLoadTier && args.cardWeekRecentCreatedGteIso) {
    const cutoff = qIdent(ADMIN_RESERVATION_LEGACY_TOUR_DATE_CUTOFF_YMD)
    const tourModernOr = `tour_date.is.null,tour_date.gt."${cutoff}"`
    if (args.cardWeekLoadTier === 'tier1_recent_modern') {
      q = q.gte('created_at', args.cardWeekRecentCreatedGteIso)
      q = q.or(tourModernOr)
    } else if (args.cardWeekLoadTier === 'tier2_older_modern') {
      q = q.lt('created_at', args.cardWeekRecentCreatedGteIso)
      q = q.or(tourModernOr)
    }
  } else if (args.mode === 'card-week' && args.cardWeekLoadTier === 'tier3_legacy_tour') {
    q = q.lte('tour_date', ADMIN_RESERVATION_LEGACY_TOUR_DATE_CUTOFF_YMD)
  }

  const asc = args.sortOrder === 'asc'
  switch (args.sortBy) {
    case 'tour_date':
      q = q.order('tour_date', { ascending: asc, nullsFirst: false }).order('id', { ascending: asc })
      break
    case 'customer_name':
      // reservations→customers FK 없음 — referencedTable 정렬 불가, created_at으로 대체
      q = q
        .order('created_at', { ascending: asc, nullsFirst: false })
        .order('id', { ascending: asc })
      break
    case 'product_name':
      q = q
        .order('name', { ascending: asc, referencedTable: 'products' })
        .order('id', { ascending: asc })
      break
    case 'created_at':
    default:
      q = q
        .order('created_at', { ascending: asc, nullsFirst: false })
        .order('id', { ascending: asc })
      break
  }

  return q
}

/**
 * `card-week` 활동 구간(및 동일 필터)에 해당하는 예약 행 수. 단계 로드 진행률 total에 사용.
 * 검색어 없을 때는 UNION count RPC를 우선 사용(OR head count보다 planner 친화적).
 */
export async function fetchAdminReservationListActivityWindowRowCount(
  supabase: SupabaseClient,
  args: Omit<FetchAdminReservationListArgs, 'onCardWeekFetchProgress' | 'cardWeekLoadTier' | 'cardWeekRecentCreatedGteIso'>
): Promise<{ count: number | null; error: Error | null }> {
  try {
    if (args.mode !== 'card-week' || !args.activityRangeStartIso || !args.activityRangeEndIso) {
      return { count: null, error: null }
    }

    const searchActive = args.debouncedSearchTerm.trim().length > 0
    if (!searchActive && !cardWeekActivityCountRpcMissing) {
      const opId = resolveOperatorId(args.operatorId)
      const { data, error } = await supabase.rpc('admin_reservation_card_week_activity_count', {
        p_operator_id: opId,
        p_range_start: args.activityRangeStartIso,
        p_range_end: args.activityRangeEndIso,
        p_status: args.selectedStatus || 'all',
        p_channel_id:
          args.selectedChannel && args.selectedChannel !== 'all' ? args.selectedChannel : null,
        p_tour_date_start: args.dateRange.start || null,
        p_tour_date_end: args.dateRange.end || null,
        p_customer_id: args.customerIdFromUrl,
      })
      if (!error) {
        const n = typeof data === 'number' ? data : Number(data)
        if (Number.isFinite(n)) {
          return { count: Math.max(0, Math.trunc(n)), error: null }
        }
      } else {
        const code = String(error.code ?? '')
        const msg = (error.message ?? '').toLowerCase()
        if (
          code === 'PGRST202' ||
          code === '42883' ||
          (msg.includes('function') && msg.includes('does not exist')) ||
          msg.includes('admin_reservation_card_week_activity_count')
        ) {
          cardWeekActivityCountRpcMissing = true
        } else {
          return { count: null, error: error as Error }
        }
      }
    }

    const searchOr = await buildSearchOrClause(supabase, args.debouncedSearchTerm, args.operatorId)
    const countMode = searchActive ? ('planned' as const) : ('exact' as const)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from('reservations').select('id', { count: countMode, head: true })
    q = applyAdminReservationListRowFilters(q, args, searchOr)
    const { count, error } = await q
    if (error) {
      return { count: null, error: error as Error }
    }
    return { count: count ?? null, error: null }
  } catch (e) {
    return { count: null, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

/**
 * 예약 관리: 서버 필터·검색·정렬·페이지네이션(플랫 카드) 또는 주간 전량(날짜 그룹 카드).
 */
export async function fetchAdminReservationList(
  supabase: SupabaseClient,
  args: FetchAdminReservationListArgs
): Promise<{ data: Record<string, unknown>[] | null; count: number | null; error: Error | null }> {
  try {
    const searchOr = await buildSearchOrClause(supabase, args.debouncedSearchTerm, args.operatorId)

    if (args.mode === 'card-week' || args.mode === 'calendar') {
      const chunk =
        args.mode === 'calendar'
          ? ADMIN_RESERVATION_CALENDAR_CHUNK_SIZE
          : ADMIN_RESERVATION_CARD_WEEK_CHUNK_SIZE
      const merged: Record<string, unknown>[] = []
      let totalCount: number | null = null
      let offset = 0
      let chunkIndex = 0
      const maxChunks = 400
      const modeLabel = args.mode

      for (;;) {
        if (chunkIndex >= maxChunks) {
          return {
            data: null,
            count: null,
            error: new Error(
              `[admin reservations] ${modeLabel} chunk limit exceeded (${maxChunks * chunk} rows)`
            ),
          }
        }
        chunkIndex += 1

        const q = buildAdminReservationListQuery(supabase, args, searchOr, {
          includeExactCount: offset === 0,
        })
        const { data, error, count } = await q.range(offset, offset + chunk - 1)
        if (error) {
          return { data: null, count: null, error: error as Error }
        }
        const batch = (data || []) as unknown as Record<string, unknown>[]
        if (offset === 0) {
          totalCount = count ?? null
        }
        merged.push(...batch)
        if (args.mode === 'calendar') {
          args.onCalendarFetchProgress?.({ loaded: merged.length, total: totalCount })
        } else {
          args.onCardWeekFetchProgress?.({ loaded: merged.length, total: totalCount })
        }

        if (batch.length < chunk) {
          break
        }
        if (totalCount != null && merged.length >= totalCount) {
          break
        }
        offset += chunk
      }

      return { data: merged, count: totalCount, error: null }
    }

    let q = buildAdminReservationListQuery(supabase, args, searchOr)

    if (args.mode === 'card-flat') {
      const from = (args.page - 1) * args.pageSize
      const to = from + args.pageSize - 1
      q = q.range(from, to)
    }

    const { data, error, count } = await q
    if (error) {
      return { data: null, count: null, error: error as Error }
    }
    return { data: (data || []) as unknown as Record<string, unknown>[], count: count ?? null, error: null }
  } catch (e) {
    return { data: null, count: null, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

/**
 * 목록/카드 플랫: 이전·다음 페이지를 백그라운드로 받아 sessionStorage에 채운다.
 * 페이지 전환 시 캐시 hit로 즉시 paint + pricing 메모리 warm.
 */
export async function prefetchAdminReservationListAdjacentPage(
  supabase: SupabaseClient,
  args: {
    operatorId?: string | null | undefined
    page: number
    pageSize: number
    selectedStatus: string
    selectedChannel: string
    dateRange: { start: string; end: string }
    customerIdFromUrl: string | null
    debouncedSearchTerm: string
    sortBy?: AdminReservationListSort
    sortOrder?: 'asc' | 'desc'
    count: number | null
    loadedRowCount: number
  }
): Promise<void> {
  const sortBy = args.sortBy ?? 'created_at'
  const sortOrder = args.sortOrder ?? 'desc'
  const targets: number[] = []

  if (args.page > 1) targets.push(args.page - 1)
  if (
    hasAdminReservationListNextPage({
      page: args.page,
      pageSize: args.pageSize,
      count: args.count,
      loadedRowCount: args.loadedRowCount,
    })
  ) {
    targets.push(args.page + 1)
  }

  await Promise.all(
    targets.map(async (page) => {
      const cacheKey = buildAdminReservationListPageCacheKey({
        operatorId: args.operatorId,
        page,
        pageSize: args.pageSize,
        selectedStatus: args.selectedStatus,
        selectedChannel: args.selectedChannel,
        dateRange: args.dateRange,
        customerIdFromUrl: args.customerIdFromUrl,
        debouncedSearchTerm: args.debouncedSearchTerm,
        sortBy,
        sortOrder,
      })
      if (readAdminReservationListPageCache(cacheKey)) return

      const { data, count, error } = await fetchAdminReservationList(supabase, {
        mode: 'card-flat',
        page,
        pageSize: args.pageSize,
        selectedStatus: args.selectedStatus,
        selectedChannel: args.selectedChannel,
        dateRange: args.dateRange,
        customerIdFromUrl: args.customerIdFromUrl,
        debouncedSearchTerm: args.debouncedSearchTerm,
        sortBy,
        sortOrder,
        operatorId: args.operatorId,
      })
      if (error || !data) return
      writeAdminReservationListPageCache(cacheKey, {
        data,
        count: count ?? args.count,
      })
      void warmAdjacentPagePricingMemory(supabase, data as Record<string, unknown>[])
    })
  )
}

async function warmAdjacentPagePricingMemory(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[]
): Promise<void> {
  const ids = [
    ...new Set(
      rows
        .map((r) => (r && typeof r === 'object' && 'id' in r ? String((r as { id: unknown }).id ?? '').trim() : ''))
        .filter(Boolean)
    ),
  ].slice(0, 80)
  if (ids.length === 0) return
  try {
    const { data, error } = await supabase
      .from('reservation_pricing')
      .select(
        'reservation_id, id, total_price, balance_amount, deposit_amount, adult_product_price, child_product_price, infant_product_price, product_price_total, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, option_total, choices_total, not_included_price, private_tour_additional_cost, refund_amount, commission_percent, commission_amount, commission_base_price, channel_settlement_amount'
      )
      .in('reservation_id', ids)
    if (error || !data) return
    const map = new Map<string, ReservationPricingMapValue>()
    for (const p of data as Record<string, unknown>[]) {
      const rid = String(p.reservation_id ?? '').trim()
      if (!rid) continue
      map.set(rid, {
        ...(p.id != null ? { id: String(p.id) } : {}),
        total_price: Number(p.total_price ?? 0) || 0,
        balance_amount: Number(p.balance_amount ?? 0) || 0,
        adult_product_price: Number(p.adult_product_price ?? 0) || 0,
        child_product_price: Number(p.child_product_price ?? 0) || 0,
        infant_product_price: Number(p.infant_product_price ?? 0) || 0,
        product_price_total: Number(p.product_price_total ?? 0) || 0,
        required_option_total: Number(p.required_option_total ?? 0) || 0,
        subtotal: Number(p.subtotal ?? 0) || 0,
        coupon_code: p.coupon_code != null ? String(p.coupon_code) : null,
        coupon_discount: Number(p.coupon_discount ?? 0) || 0,
        additional_discount: Number(p.additional_discount ?? 0) || 0,
        additional_cost: Number(p.additional_cost ?? 0) || 0,
        card_fee: Number(p.card_fee ?? 0) || 0,
        tax: Number(p.tax ?? 0) || 0,
        prepayment_cost: Number(p.prepayment_cost ?? 0) || 0,
        prepayment_tip: Number(p.prepayment_tip ?? 0) || 0,
        option_total: Number(p.option_total ?? 0) || 0,
        choices_total: Number(p.choices_total ?? 0) || 0,
        not_included_price: Number(p.not_included_price ?? 0) || 0,
        private_tour_additional_cost: Number(p.private_tour_additional_cost ?? 0) || 0,
        refund_amount: Number(p.refund_amount ?? 0) || 0,
        commission_amount: Number(p.commission_amount ?? 0) || 0,
        commission_base_price: Number(p.commission_base_price ?? 0) || 0,
        channel_settlement_amount: Number(p.channel_settlement_amount ?? 0) || 0,
        deposit_amount: Number(p.deposit_amount ?? 0) || 0,
        currency: 'USD',
      })
    }
    if (map.size > 0) writeAdminReservationPricingMemory(map)
  } catch {
    /* ignore warm failures */
  }
}

/** `card-flat` 한 페이지 크기 — 운영 큐(전량) 로드 시 페이지 루프에 사용 */
export const ADMIN_RESERVATION_CARD_FLAT_PAGE_SIZE = 500

/**
 * 활동 구간 없이 `card-flat` 조건으로 예약 전량을 페이지 단위로 이어 받는다.
 * (예약 처리 필요 / Follow up 큐 — 주간 뷰와 별도)
 */
export type FetchAdminReservationListAllFlatArgs = Omit<
  FetchAdminReservationListArgs,
  | 'mode'
  | 'page'
  | 'pageSize'
  | 'activityRangeStartIso'
  | 'activityRangeEndIso'
  | 'onCardWeekFetchProgress'
  | 'cardWeekLoadTier'
  | 'cardWeekRecentCreatedGteIso'
> & { pageSize?: number }

export async function fetchAdminReservationListAllFlat(
  supabase: SupabaseClient,
  args: FetchAdminReservationListAllFlatArgs
): Promise<{ data: Record<string, unknown>[] | null; error: Error | null }> {
  const pageSize = args.pageSize ?? ADMIN_RESERVATION_CARD_FLAT_PAGE_SIZE
  const merged: Record<string, unknown>[] = []
  let page = 1
  const maxPages = 500

  try {
    for (;;) {
      if (page > maxPages) {
        return {
          data: null,
          error: new Error(
            `[admin reservations] card-flat all-pages limit exceeded (${maxPages} pages × ${pageSize} rows)`
          ),
        }
      }
      const { data, count, error } = await fetchAdminReservationList(supabase, {
        ...args,
        mode: 'card-flat',
        page,
        pageSize,
        includeExactCount: page === 1 ? (args.includeExactCount ?? false) : false,
      })
      if (error) {
        return { data: null, error }
      }
      const batch = (data || []) as unknown as Record<string, unknown>[]
      merged.push(...batch)
      if (batch.length < pageSize) {
        break
      }
      if (count != null && merged.length >= count) {
        break
      }
      page += 1
    }
    return { data: merged, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

export type AdminReservationListAllFlatChunkHandlers = {
  /** 각 페이지 raw 행. `false` 반환 시 이어 받기 중단 */
  onChunk: (p: {
    rows: Record<string, unknown>[]
    page: number
    mergedLoaded: number
    totalCount: number | null
  }) => boolean | void | Promise<boolean | void>
}

/**
 * `card-flat` 전량을 페이지 단위로 받으며 청크마다 콜백(운영 큐 점진 hydrate용).
 */
export async function fetchAdminReservationListAllFlatProgressive(
  supabase: SupabaseClient,
  args: FetchAdminReservationListAllFlatArgs,
  handlers: AdminReservationListAllFlatChunkHandlers
): Promise<{ error: Error | null; loadedRowCount: number }> {
  const pageSize = args.pageSize ?? ADMIN_RESERVATION_CARD_FLAT_PAGE_SIZE
  let page = 1
  let mergedLoaded = 0
  let totalCount: number | null = null
  const maxPages = 500

  try {
    for (;;) {
      if (page > maxPages) {
        return {
          error: new Error(
            `[admin reservations] card-flat all-pages limit exceeded (${maxPages} pages × ${pageSize} rows)`
          ),
          loadedRowCount: mergedLoaded,
        }
      }
      const { data, count, error } = await fetchAdminReservationList(supabase, {
        ...args,
        mode: 'card-flat',
        page,
        pageSize,
        includeExactCount: page === 1 ? (args.includeExactCount ?? false) : false,
      })
      if (error) {
        return { error, loadedRowCount: mergedLoaded }
      }
      const batch = (data || []) as unknown as Record<string, unknown>[]
      if (page === 1) {
        totalCount = count ?? null
      }
      if (batch.length === 0) {
        break
      }
      mergedLoaded += batch.length
      const keepGoing = await handlers.onChunk({
        rows: batch,
        page,
        mergedLoaded,
        totalCount,
      })
      if (keepGoing === false) {
        break
      }
      if (batch.length < pageSize) {
        break
      }
      if (totalCount != null && mergedLoaded >= totalCount) {
        break
      }
      page += 1
    }
    return { error: null, loadedRowCount: mergedLoaded }
  } catch (e) {
    return {
      error: e instanceof Error ? e : new Error(String(e)),
      loadedRowCount: mergedLoaded,
    }
  }
}

export type CardWeekProgressiveHandlers = {
  /** 정렬·필터 기준 첫 청크(기본 500행) — UI에 먼저 반영. `false` 반환 시 이어 받기 중단(필터 전환 등) */
  onFirstChunk: (p: {
    rows: Record<string, unknown>[]
    totalCount: number | null
  }) => boolean | void | Promise<boolean | void>
  /** 이후 청크(백그라운드) */
  onAdditionalChunk?: (p: {
    rows: Record<string, unknown>[]
    mergedLoaded: number
    totalCount: number | null
  }) => boolean | void | Promise<boolean | void>
  onProgress?: (info: { loaded: number; total: number | null }) => void
}

function isCardWeekActivityRpcUnavailable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const msg = (err.message ?? '').toLowerCase()
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    (msg.includes('function') && msg.includes('does not exist')) ||
    msg.includes('admin_reservation_card_week_activity_ids')
  )
}

function parseCardWeekActivityIdRows(data: unknown): string[] {
  if (!Array.isArray(data)) return []
  const out: string[] = []
  for (const row of data) {
    if (!row || typeof row !== 'object') continue
    const id = 'id' in row ? String((row as { id: unknown }).id ?? '').trim() : ''
    if (id) out.push(id)
  }
  return out
}

async function fetchCardWeekRowsByOrderedIds(
  supabase: SupabaseClient,
  args: Omit<FetchAdminReservationListArgs, 'onCardWeekFetchProgress'>,
  ids: string[]
): Promise<{ rows: Record<string, unknown>[]; error: Error | null }> {
  if (ids.length === 0) return { rows: [], error: null }
  const opId = resolveOperatorId(args.operatorId)
  const selectFields = args.selectFieldsOverride ?? RESERVATION_LIST_SELECT
  const { data, error } = await supabase
    .from('reservations')
    .select(selectFields)
    .eq('operator_id', opId)
    .in('id', ids)
  if (error) return { rows: [], error: error as Error }
  const byId = new Map<string, Record<string, unknown>>()
  for (const row of (data || []) as unknown as Record<string, unknown>[]) {
    const id = String(row.id ?? '')
    if (id) byId.set(id, row)
  }
  const rows: Record<string, unknown>[] = []
  for (const id of ids) {
    const row = byId.get(id)
    if (row) rows.push(row)
  }
  return { rows, error: null }
}

/**
 * 검색어 없을 때: UNION RPC로 활동 구간 id를 받은 뒤 상세 행을 `.in(id)`로 로드.
 * RPC 미적용·오류 시 null → 호출부가 PostgREST OR 경로로 폴백.
 */
async function fetchAdminReservationListCardWeekProgressiveViaActivityRpc(
  supabase: SupabaseClient,
  args: Omit<FetchAdminReservationListArgs, 'onCardWeekFetchProgress'>,
  handlers: CardWeekProgressiveHandlers
): Promise<{ error: Error | null; loadedRowCount: number } | null> {
  if (cardWeekActivityRpcMissing) return null
  if (args.debouncedSearchTerm.trim()) return null
  if (!args.activityRangeStartIso || !args.activityRangeEndIso) return null

  const opId = resolveOperatorId(args.operatorId)
  const chunk = ADMIN_RESERVATION_CARD_WEEK_CHUNK_SIZE
  const merged: Record<string, unknown>[] = []
  let offset = 0
  let chunkIndex = 0
  const maxChunks = 400
  let firstChunkDone = false

  for (;;) {
    if (chunkIndex >= maxChunks) {
      return {
        error: new Error(`[admin reservations] card-week activity rpc chunk limit exceeded`),
        loadedRowCount: merged.length,
      }
    }
    chunkIndex += 1

    const { data, error } = await supabase.rpc('admin_reservation_card_week_activity_ids', {
      p_operator_id: opId,
      p_range_start: args.activityRangeStartIso,
      p_range_end: args.activityRangeEndIso,
      p_status: args.selectedStatus || 'all',
      p_channel_id:
        args.selectedChannel && args.selectedChannel !== 'all' ? args.selectedChannel : null,
      p_tour_date_start: args.dateRange.start || null,
      p_tour_date_end: args.dateRange.end || null,
      p_customer_id: args.customerIdFromUrl,
      p_tier: args.cardWeekLoadTier ?? null,
      p_recent_created_gte: args.cardWeekRecentCreatedGteIso ?? null,
      p_legacy_tour_date_cutoff: ADMIN_RESERVATION_LEGACY_TOUR_DATE_CUTOFF_YMD,
      p_limit: chunk,
      p_offset: offset,
    })

    if (error) {
      if (isCardWeekActivityRpcUnavailable(error)) {
        cardWeekActivityRpcMissing = true
        return null
      }
      return { error: error as Error, loadedRowCount: merged.length }
    }

    const ids = parseCardWeekActivityIdRows(data)
    if (ids.length === 0) {
      if (!firstChunkDone) {
        try {
          const keep = await handlers.onFirstChunk({ rows: [], totalCount: 0 })
          if (keep === false) return { error: null, loadedRowCount: 0 }
        } catch (e) {
          return { error: e instanceof Error ? e : new Error(String(e)), loadedRowCount: 0 }
        }
      }
      break
    }

    const { rows: batch, error: rowsError } = await fetchCardWeekRowsByOrderedIds(supabase, args, ids)
    if (rowsError) return { error: rowsError, loadedRowCount: merged.length }

    merged.push(...batch)
    // exact total은 별도 count RPC 없이 null — 진행률은 loaded만 갱신
    handlers.onProgress?.({ loaded: merged.length, total: null })

    try {
      if (!firstChunkDone) {
        firstChunkDone = true
        const keep = await handlers.onFirstChunk({ rows: batch, totalCount: null })
        if (keep === false) return { error: null, loadedRowCount: merged.length }
      } else {
        const keep = await handlers.onAdditionalChunk?.({
          rows: batch,
          mergedLoaded: merged.length,
          totalCount: null,
        })
        if (keep === false) break
      }
    } catch (e) {
      if (!firstChunkDone) {
        return { error: e instanceof Error ? e : new Error(String(e)), loadedRowCount: merged.length }
      }
      if (process.env.NODE_ENV === 'development') {
        console.warn('[admin reservations] card-week activity rpc merge failed:', e)
      }
      break
    }

    if (ids.length < chunk) break
    offset += chunk
  }

  return { error: null, loadedRowCount: merged.length }
}

/**
 * `card-week`: 첫 청크만 먼저 콜백으로 넘긴 뒤, 동일 쿼리로 나머지 청크를 이어 받는다.
 * 검색어 없을 때는 UNION activity RPC를 우선 시도하고, 미적용 시 PostgREST OR로 폴백한다.
 */
export async function fetchAdminReservationListCardWeekProgressive(
  supabase: SupabaseClient,
  args: Omit<FetchAdminReservationListArgs, 'onCardWeekFetchProgress'>,
  handlers: CardWeekProgressiveHandlers
): Promise<{ error: Error | null; loadedRowCount: number }> {
  try {
    const viaRpc = await fetchAdminReservationListCardWeekProgressiveViaActivityRpc(
      supabase,
      args,
      handlers
    )
    if (viaRpc) return viaRpc

    const searchOr = await buildSearchOrClause(supabase, args.debouncedSearchTerm, args.operatorId)
    const chunk = ADMIN_RESERVATION_CARD_WEEK_CHUNK_SIZE
    const merged: Record<string, unknown>[] = []
    let totalCount: number | null = null
    let offset = 0
    let chunkIndex = 0
    const maxChunks = 400

    for (;;) {
      if (chunkIndex >= maxChunks) {
        return {
          error: new Error(`[admin reservations] card-week chunk limit exceeded (${maxChunks * chunk} rows)`),
          loadedRowCount: merged.length,
        }
      }
      chunkIndex += 1

      const q = buildAdminReservationListQuery(supabase, args, searchOr, {
        includeExactCount: offset === 0,
      })
      const { data, error, count } = await q.range(offset, offset + chunk - 1)
      if (error) {
        return { error: error as Error, loadedRowCount: merged.length }
      }
      const batch = (data || []) as unknown as Record<string, unknown>[]

      if (offset === 0) {
        totalCount = count ?? null
        merged.push(...batch)
        handlers.onProgress?.({ loaded: merged.length, total: totalCount })
        try {
          const keep = await handlers.onFirstChunk({ rows: batch, totalCount })
          if (keep === false) {
            return { error: null, loadedRowCount: merged.length }
          }
        } catch (e) {
          return { error: e instanceof Error ? e : new Error(String(e)), loadedRowCount: merged.length }
        }
      } else {
        merged.push(...batch)
        handlers.onProgress?.({ loaded: merged.length, total: totalCount })
        try {
          const keep = await handlers.onAdditionalChunk?.({
            rows: batch,
            mergedLoaded: merged.length,
            totalCount,
          })
          if (keep === false) {
            break
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[admin reservations] card-week incremental merge failed:', e)
          }
          break
        }
      }

      if (batch.length < chunk) {
        break
      }
      if (totalCount != null && merged.length >= totalCount) {
        break
      }
      offset += chunk
    }

    return { error: null, loadedRowCount: merged.length }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)), loadedRowCount: 0 }
  }
}

export type CalendarProgressiveHandlers = {
  onFirstChunk: (p: {
    rows: Record<string, unknown>[]
    totalCount: number | null
  }) => boolean | void | Promise<boolean | void>
  onAdditionalChunk?: (p: {
    rows: Record<string, unknown>[]
    mergedLoaded: number
    totalCount: number | null
  }) => boolean | void | Promise<boolean | void>
  onProgress?: (info: { loaded: number; total: number | null }) => void
}

/**
 * `calendar`: 첫 청크 paint 후 나머지를 이어 받는다 (월 전량 대기 제거).
 */
export async function fetchAdminReservationListCalendarProgressive(
  supabase: SupabaseClient,
  args: Omit<FetchAdminReservationListArgs, 'onCalendarFetchProgress' | 'mode'> & {
    mode?: 'calendar'
  },
  handlers: CalendarProgressiveHandlers
): Promise<{ error: Error | null; loadedRowCount: number }> {
  try {
    const searchOr = await buildSearchOrClause(supabase, args.debouncedSearchTerm, args.operatorId)
    const chunk = ADMIN_RESERVATION_CALENDAR_CHUNK_SIZE
    const calArgs: FetchAdminReservationListArgs = { ...args, mode: 'calendar' }
    const merged: Record<string, unknown>[] = []
    let totalCount: number | null = null
    let offset = 0
    let chunkIndex = 0
    const maxChunks = 400

    for (;;) {
      if (chunkIndex >= maxChunks) {
        return {
          error: new Error(
            `[admin reservations] calendar chunk limit exceeded (${maxChunks * chunk} rows)`
          ),
          loadedRowCount: merged.length,
        }
      }
      chunkIndex += 1

      const q = buildAdminReservationListQuery(supabase, calArgs, searchOr, {
        includeExactCount: offset === 0,
      })
      const { data, error, count } = await q.range(offset, offset + chunk - 1)
      if (error) {
        return { error: error as Error, loadedRowCount: merged.length }
      }
      const batch = (data || []) as unknown as Record<string, unknown>[]

      if (offset === 0) {
        totalCount = count ?? null
        merged.push(...batch)
        handlers.onProgress?.({ loaded: merged.length, total: totalCount })
        try {
          const keep = await handlers.onFirstChunk({ rows: batch, totalCount })
          if (keep === false) {
            return { error: null, loadedRowCount: merged.length }
          }
        } catch (e) {
          return { error: e instanceof Error ? e : new Error(String(e)), loadedRowCount: merged.length }
        }
      } else {
        merged.push(...batch)
        handlers.onProgress?.({ loaded: merged.length, total: totalCount })
        try {
          const keep = await handlers.onAdditionalChunk?.({
            rows: batch,
            mergedLoaded: merged.length,
            totalCount,
          })
          if (keep === false) {
            break
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[admin reservations] calendar incremental merge failed:', e)
          }
          break
        }
      }

      if (batch.length < chunk) {
        break
      }
      if (totalCount != null && merged.length >= totalCount) {
        break
      }
      offset += chunk
    }

    return { error: null, loadedRowCount: merged.length }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)), loadedRowCount: 0 }
  }
}

/**
 * 인접 주(±1)의 첫 청크만 받아 sessionStorage에 채워 주 전환 시 즉시 paint.
 */
export async function prefetchAdminReservationCardWeekAdjacentSnapshots(
  supabase: SupabaseClient,
  args: {
    operatorId?: string | null | undefined
    currentWeekOffset: number
    selectedStatus: string
    selectedChannel: string
    dateRange: { start: string; end: string }
    customerIdFromUrl: string | null
    debouncedSearchTerm: string
    sortBy: AdminReservationListSort
    sortOrder: 'asc' | 'desc'
    weekRangeForOffset: (weekOffset: number) => {
      rangeStartIso: string
      rangeEndIso: string
    }
  }
): Promise<void> {
  const offsets = [args.currentWeekOffset - 1, args.currentWeekOffset + 1]
  const recentGteIso = browserLocalCreatedAtGteIsoForRecentCalendarDays(
    ADMIN_RESERVATION_CARD_WEEK_RECENT_REGISTERED_DAYS
  )

  for (const weekOffset of offsets) {
    const cacheKey = buildAdminReservationCardWeekCacheKey({
      operatorId: args.operatorId,
      weekOffset,
      selectedStatus: args.selectedStatus,
      selectedChannel: args.selectedChannel,
      dateRange: args.dateRange,
      customerIdFromUrl: args.customerIdFromUrl,
      debouncedSearchTerm: args.debouncedSearchTerm,
    })
    if (readAdminReservationCardWeekCache(cacheKey)) continue

    const wr = args.weekRangeForOffset(weekOffset)
    const cardArgs: Omit<FetchAdminReservationListArgs, 'onCardWeekFetchProgress'> = {
      mode: 'card-week',
      page: 1,
      pageSize: 20,
      selectedStatus: args.selectedStatus,
      selectedChannel: args.selectedChannel,
      dateRange: args.dateRange,
      customerIdFromUrl: args.customerIdFromUrl,
      debouncedSearchTerm: args.debouncedSearchTerm,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
      operatorId: args.operatorId,
      activityRangeStartIso: wr.rangeStartIso,
      activityRangeEndIso: wr.rangeEndIso,
      cardWeekLoadTier: 'tier1_recent_modern',
      cardWeekRecentCreatedGteIso: recentGteIso,
      includeExactCount: false,
    }

    const { count } = await fetchAdminReservationListActivityWindowRowCount(supabase, cardArgs)
    const holder = { snapshot: null as Record<string, unknown>[] | null }
    await fetchAdminReservationListCardWeekProgressive(supabase, cardArgs, {
      onFirstChunk: ({ rows }) => {
        holder.snapshot = rows as Record<string, unknown>[]
        return false
      },
    })
    if (holder.snapshot !== null) {
      writeAdminReservationCardWeekCache(cacheKey, {
        data: holder.snapshot,
        count: count ?? holder.snapshot.length,
      })
      void warmAdjacentPagePricingMemory(supabase, holder.snapshot)
    }
  }
}

/**
 * 인접 월(±1)의 첫 청크만 받아 sessionStorage에 채워 월 전환 시 즉시 paint.
 */
export async function prefetchAdminReservationCalendarAdjacentSnapshots(
  supabase: SupabaseClient,
  args: {
    operatorId?: string | null | undefined
    currentMonthOffset: number
    selectedStatus: string
    selectedChannel: string
    dateRange: { start: string; end: string }
    customerIdFromUrl: string | null
    debouncedSearchTerm: string
    sortBy: AdminReservationListSort
    sortOrder: 'asc' | 'desc'
  }
): Promise<void> {
  const offsets = [args.currentMonthOffset - 1, args.currentMonthOffset + 1]

  for (const monthOffset of offsets) {
    const cacheKey = buildAdminReservationCalendarCacheKey({
      operatorId: args.operatorId,
      monthOffset,
      selectedStatus: args.selectedStatus,
      selectedChannel: args.selectedChannel,
      dateRange: args.dateRange,
      customerIdFromUrl: args.customerIdFromUrl,
      debouncedSearchTerm: args.debouncedSearchTerm,
    })
    if (readAdminReservationCalendarCache(cacheKey)) continue

    const calWindow = browserLocalCalendarViewWindow(monthOffset)
    const calArgs = {
      mode: 'calendar' as const,
      page: 1,
      pageSize: 20,
      selectedStatus: args.selectedStatus,
      selectedChannel: args.selectedChannel,
      dateRange: args.dateRange,
      customerIdFromUrl: args.customerIdFromUrl,
      debouncedSearchTerm: args.debouncedSearchTerm,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
      operatorId: args.operatorId,
      calendarTourDateStart: calWindow.startYmd,
      calendarTourDateEnd: calWindow.endYmd,
      calendarCreatedStartIso: calWindow.rangeStartIso,
      calendarCreatedEndIso: calWindow.rangeEndIso,
      includeExactCount: false,
    }

    const holder = { snapshot: null as Record<string, unknown>[] | null, totalCount: null as number | null }
    await fetchAdminReservationListCalendarProgressive(supabase, calArgs, {
      onFirstChunk: ({ rows, totalCount: tc }) => {
        holder.snapshot = rows as Record<string, unknown>[]
        holder.totalCount = tc
        return false
      },
    })
    if (holder.snapshot !== null) {
      writeAdminReservationCalendarCache(cacheKey, {
        data: holder.snapshot,
        count: holder.totalCount ?? holder.snapshot.length,
      })
      void warmAdjacentPagePricingMemory(supabase, holder.snapshot)
    }
  }
}
