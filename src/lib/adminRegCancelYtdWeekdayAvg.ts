import type { SupabaseClient } from '@supabase/supabase-js'
import { browserLocalTodayYmd, browserLocalYesterdayYmd } from '@/lib/browserLocalWeek'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import {
  readRegCancelRollupSessionCache,
  regCancelRollupCacheScopeKey,
  writeRegCancelRollupSessionCache,
} from '@/lib/adminRegCancelRollupFastPath'

export type YtdWeekdayAvgBuckets = {
  people: number[]
  bookings: number[]
}

const EMPTY_BUCKETS = (): YtdWeekdayAvgBuckets => ({
  people: Array.from({ length: 7 }, () => 0),
  bookings: Array.from({ length: 7 }, () => 0),
})

function browserLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
  } catch {
    return 'America/Los_Angeles'
  }
}

function isRpcUnavailable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const msg = (err.message ?? '').toLowerCase()
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    code === '25006' ||
    code === 'PGRST101' ||
    code === 'PGRST117' ||
    msg.includes('read-only transaction') ||
    msg.includes('admin_reg_cancel_ytd_weekday_avg') ||
    (msg.includes('function') && msg.includes('does not exist'))
  )
}

function rowsToBuckets(
  rows: Array<{
    weekday_index: number
    avg_net_people?: number | string | null
    avg_net_count?: number | string | null
    avg_registered_people?: number | string | null
    avg_registered_count?: number | string | null
  }>
): YtdWeekdayAvgBuckets {
  const out = EMPTY_BUCKETS()
  for (const row of rows) {
    const wd = Number(row.weekday_index)
    if (!Number.isFinite(wd) || wd < 0 || wd > 6) continue
    const people = Number(row.avg_net_people ?? row.avg_registered_people ?? 0)
    const bookings = Number(row.avg_net_count ?? row.avg_registered_count ?? 0)
    out.people[wd] = Number.isFinite(people) ? people : 0
    out.bookings[wd] = Number.isFinite(bookings) ? bookings : 0
  }
  return out
}

export type FetchAdminRegCancelYtdWeekdayAvgArgs = {
  selectedStatus: string
  selectedChannel: string
  dateRange: { start: string; end: string }
  customerIdFromUrl: string | null
  debouncedSearchTerm: string
  operatorId?: string | null
  year?: number
  throughYmd?: string
  timeZone?: string
}

/** 7일 차트 YTD 요일별 순예약 일평균 — 서버 RPC(롤업 fast path + 세션 캐시) */
export async function fetchAdminRegCancelYtdWeekdayAvg(
  supabase: SupabaseClient,
  args: FetchAdminRegCancelYtdWeekdayAvgArgs
): Promise<{ data: YtdWeekdayAvgBuckets; error: Error | null; usedRpc: boolean }> {
  const todayYmd = browserLocalTodayYmd()
  const year = args.year ?? parseInt(todayYmd.slice(0, 4), 10)
  const throughYmd = args.throughYmd ?? browserLocalYesterdayYmd()
  const operatorId = resolveOperatorId(args.operatorId)

  const cacheKey = regCancelRollupCacheScopeKey(
    'ytd-weekday-avg',
    operatorId,
    [
      year,
      throughYmd,
      args.selectedStatus,
      args.selectedChannel,
      `${args.dateRange.start}\u0001${args.dateRange.end}`,
      args.debouncedSearchTerm,
      args.customerIdFromUrl ?? '',
      args.timeZone ?? browserLocalTimeZone(),
    ].join('\u001f')
  )

  const cached = readRegCancelRollupSessionCache<YtdWeekdayAvgBuckets>(cacheKey)
  if (cached) {
    return { data: cached, error: null, usedRpc: true }
  }

  const { data, error } = await supabase.rpc('admin_reg_cancel_ytd_weekday_avg', {
    p_operator_id: resolveOperatorId(args.operatorId),
    p_customer_id: args.customerIdFromUrl,
    p_status: args.selectedStatus || 'all',
    p_channel_id: args.selectedChannel === 'all' ? null : args.selectedChannel,
    p_tour_date_start: args.dateRange.start || null,
    p_tour_date_end: args.dateRange.end || null,
    p_year: year,
    p_through_ymd: throughYmd,
    p_tz: args.timeZone ?? browserLocalTimeZone(),
    p_search_term: args.debouncedSearchTerm.trim() || null,
  })

  if (error) {
    if (isRpcUnavailable(error)) {
      return { data: EMPTY_BUCKETS(), error: null, usedRpc: false }
    }
    return {
      data: EMPTY_BUCKETS(),
      error: new Error(typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error)),
      usedRpc: false,
    }
  }

  const rows = (data ?? []) as Array<{
    weekday_index: number
    avg_net_people?: number | string | null
    avg_net_count?: number | string | null
    avg_registered_people?: number | string | null
    avg_registered_count?: number | string | null
  }>

  const buckets = rowsToBuckets(rows)
  writeRegCancelRollupSessionCache(cacheKey, buckets)

  return { data: buckets, error: null, usedRpc: true }
}
