import type { SupabaseClient } from '@supabase/supabase-js'

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

/** 투어일이 이 값 이하(포함)인 예약은 주간 카드 전량 로드 시 나중 단계에서 조회 */
export const ADMIN_RESERVATION_LEGACY_TOUR_DATE_CUTOFF_YMD = '2024-12-31'

/** 주간 카드 단계 로드: “최근 등록” 구간(브라우저 로컬 달력, 오늘 포함 N일) */
export const ADMIN_RESERVATION_CARD_WEEK_RECENT_REGISTERED_DAYS = 7

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  run: () => Promise<{ data: unknown; error: { message?: string } | null }>
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

async function buildSearchOrClause(
  supabase: SupabaseClient,
  term: string
): Promise<string | null> {
  const t = term.trim()
  if (!t) return null

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
    const lookupLimit = 500
    const likePat = `%${t.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`

    const customerOr = `name.ilike.${q},special_requests.ilike.${q},email.ilike.${q},phone.ilike.${q},emergency_contact.ilike.${q}`

    const [cidsActive, pids, chids] = await Promise.all([
      safeSelectIds('customers(active)', () =>
        supabase
          .from('customers')
          .select('id')
          .or(customerOr)
          .eq('archive', false)
          .limit(lookupLimit)
      ),
      safeSelectIds('products', () =>
        supabase
          .from('products')
          .select('id')
          .or(
            `name.ilike.${q},name_ko.ilike.${q},name_en.ilike.${q},product_code.ilike.${q},customer_name_ko.ilike.${q},customer_name_en.ilike.${q}`
          )
          .limit(lookupLimit)
      ),
      safeSelectIds('channels', () =>
        supabase.from('channels').select('id').ilike('name', likePat).limit(lookupLimit)
      ),
    ])

    /** 보관 고객: 활성 매칭이 없을 때만 id 조회(보관 행 스캔·IN 크기 절약). 동일 문자열에 활성+보관이 같이 맞으면 보관 쪽 예약은 이 경로로는 안 잡힐 수 있음. */
    const cids =
      cidsActive.length > 0
        ? cidsActive
        : await safeSelectIds('customers(archive)', () =>
            supabase
              .from('customers')
              .select('id')
              .or(customerOr)
              .eq('archive', true)
              .limit(lookupLimit)
          )

    if (cids.length) parts.push(`customer_id.in.(${cids.join(',')})`)
    if (pids.length) parts.push(`product_id.in.(${pids.join(',')})`)
    if (chids.length) parts.push(`channel_id.in.(${chids.join(',')})`)
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

  let selectFields = args.selectFieldsOverride ?? '*, choices, channels(name)'
  if (args.sortBy === 'customer_name') {
    selectFields = '*, choices, channels(name), customers(name)'
  } else if (args.sortBy === 'product_name') {
    selectFields = '*, choices, channels(name), products(name, name_ko, name_en)'
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
      q = q
        .order('name', { ascending: asc, referencedTable: 'customers' })
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
 */
export async function fetchAdminReservationListActivityWindowRowCount(
  supabase: SupabaseClient,
  args: Omit<FetchAdminReservationListArgs, 'onCardWeekFetchProgress' | 'cardWeekLoadTier' | 'cardWeekRecentCreatedGteIso'>
): Promise<{ count: number | null; error: Error | null }> {
  try {
    if (args.mode !== 'card-week' || !args.activityRangeStartIso || !args.activityRangeEndIso) {
      return { count: null, error: null }
    }
    const searchOr = await buildSearchOrClause(supabase, args.debouncedSearchTerm)
    const searchActive = args.debouncedSearchTerm.trim().length > 0
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
    const searchOr = await buildSearchOrClause(supabase, args.debouncedSearchTerm)

    if (args.mode === 'card-week') {
      const chunk = ADMIN_RESERVATION_CARD_WEEK_CHUNK_SIZE
      const merged: Record<string, unknown>[] = []
      let totalCount: number | null = null
      let offset = 0
      let chunkIndex = 0
      const maxChunks = 400

      for (;;) {
        if (chunkIndex >= maxChunks) {
          return {
            data: null,
            count: null,
            error: new Error(`[admin reservations] card-week chunk limit exceeded (${maxChunks * chunk} rows)`),
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
        const batch = (data || []) as Record<string, unknown>[]
        if (offset === 0) {
          totalCount = count ?? null
        }
        merged.push(...batch)
        args.onCardWeekFetchProgress?.({ loaded: merged.length, total: totalCount })

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
    return { data: (data || []) as Record<string, unknown>[], count: count ?? null, error: null }
  } catch (e) {
    return { data: null, count: null, error: e instanceof Error ? e : new Error(String(e)) }
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
        includeExactCount: page === 1 ? args.includeExactCount : false,
      })
      if (error) {
        return { data: null, error }
      }
      const batch = (data || []) as Record<string, unknown>[]
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
        includeExactCount: page === 1 ? args.includeExactCount : false,
      })
      if (error) {
        return { error, loadedRowCount: mergedLoaded }
      }
      const batch = (data || []) as Record<string, unknown>[]
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

/**
 * `card-week`: 첫 청크만 먼저 콜백으로 넘긴 뒤, 동일 쿼리로 나머지 청크를 이어 받는다.
 * (날짜 그룹 뷰에서 초기 표시 지연을 줄이기 위함)
 */
export async function fetchAdminReservationListCardWeekProgressive(
  supabase: SupabaseClient,
  args: Omit<FetchAdminReservationListArgs, 'onCardWeekFetchProgress'>,
  handlers: CardWeekProgressiveHandlers
): Promise<{ error: Error | null; loadedRowCount: number }> {
  try {
    const searchOr = await buildSearchOrClause(supabase, args.debouncedSearchTerm)
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
      const batch = (data || []) as Record<string, unknown>[]

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
