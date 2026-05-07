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

  const q = ilikeQuoted(t)
  const parts: string[] = [
    `channel_rn.ilike.${q}`,
    `pickup_hotel.ilike.${q}`,
    `added_by.ilike.${q}`,
    `event_note.ilike.${q}`,
    `sub_channel.ilike.${q}`,
    `variant_key.ilike.${q}`,
  ]

  // DATE/TIME/UUID 컬럼은 PostgREST에서 ilike(~~*) 불가 — 정확 일치만 or에 추가
  if (isProbableUuid(t)) {
    parts.push(`id.eq.${eqQuoted(t.trim())}`)
  }
  if (isIsoDateOnly(t)) {
    parts.push(`tour_date.eq.${eqQuoted(t.trim())}`)
  }
  const timeEq = normalizeTimeForEq(t)
  if (timeEq) {
    parts.push(`tour_time.eq.${eqQuoted(timeEq)}`)
  }

  const lookupLimit = 500
  const likePat = `%${t.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`

  const [cids, pids, chids] = await Promise.all([
    safeSelectIds('customers', () =>
      supabase
        .from('customers')
        .select('id')
        .or(
          `name.ilike.${q},special_requests.ilike.${q},email.ilike.${q},phone.ilike.${q},emergency_contact.ilike.${q}`
        )
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

  if (cids.length) parts.push(`customer_id.in.(${cids.join(',')})`)
  if (pids.length) parts.push(`product_id.in.(${pids.join(',')})`)
  if (chids.length) parts.push(`channel_id.in.(${chids.join(',')})`)

  return parts.join(',')
}

type BuildQueryOpts = { includeExactCount?: boolean }

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
  const includeExactCount = opts?.includeExactCount !== false

  let selectFields = '*, choices, channels(name)'
  if (args.sortBy === 'customer_name') {
    selectFields = '*, choices, channels(name), customers(name)'
  } else if (args.sortBy === 'product_name') {
    selectFields = '*, choices, channels(name), products(name, name_ko, name_en)'
  }

  let q = includeExactCount
    ? supabase.from('reservations').select(selectFields, { count: 'exact' })
    : supabase.from('reservations').select(selectFields)

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
