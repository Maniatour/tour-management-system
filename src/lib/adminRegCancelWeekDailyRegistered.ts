import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import {
  readRegCancelRollupSessionCache,
  regCancelRollupCacheScopeKey,
  writeRegCancelRollupSessionCache,
} from '@/lib/adminRegCancelRollupFastPath'
import { browserLocalWeekRangeFromOffset } from '@/lib/browserLocalWeek'

export type WeekDailyRegisteredRollup = Map<
  string,
  { registeredPeople: number; registeredCount: number }
>

export type FetchWeekDailyRegisteredArgs = {
  operatorId?: string | null | undefined
  startYmd: string
  endYmd: string
  selectedStatus?: string | undefined
  selectedChannel?: string | undefined
  dateRange?: { start: string; end: string } | undefined
  customerIdFromUrl?: string | null | undefined
  debouncedSearchTerm?: string | undefined
}

type WeekDailyRegisteredCachePayload = Record<
  string,
  { registeredPeople: number; registeredCount: number }
>

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
    msg.includes('admin_reg_cancel_week_daily_registered') ||
    (msg.includes('function') && msg.includes('does not exist'))
  )
}

function mapToCachePayload(map: WeekDailyRegisteredRollup): WeekDailyRegisteredCachePayload {
  const out: WeekDailyRegisteredCachePayload = {}
  map.forEach((v, k) => {
    out[k] = v
  })
  return out
}

function cachePayloadToMap(payload: WeekDailyRegisteredCachePayload): WeekDailyRegisteredRollup {
  return new Map(Object.entries(payload || {}))
}

function weekDailyRegisteredCacheKey(args: FetchWeekDailyRegisteredArgs): string {
  const operatorId = resolveOperatorId(args.operatorId)
  return regCancelRollupCacheScopeKey(
    'week-daily-reg',
    operatorId,
    [
      args.startYmd,
      args.endYmd,
      args.selectedStatus || 'all',
      args.selectedChannel || 'all',
      args.dateRange?.start || '',
      args.dateRange?.end || '',
      args.customerIdFromUrl || '',
      (args.debouncedSearchTerm || '').trim(),
    ].join('\u001f')
  )
}

/** 7일 차트 등록 막대 — 롤업(무필터) 또는 필터 스캔 RPC (+ 세션 캐시) */
export async function fetchAdminRegCancelWeekDailyRegistered(
  supabase: SupabaseClient,
  args: FetchWeekDailyRegisteredArgs
): Promise<{ data: WeekDailyRegisteredRollup; error: Error | null; usedRpc: boolean }> {
  const operatorId = resolveOperatorId(args.operatorId)
  const empty: WeekDailyRegisteredRollup = new Map()
  const cacheKey = weekDailyRegisteredCacheKey(args)
  const cached = readRegCancelRollupSessionCache<WeekDailyRegisteredCachePayload>(cacheKey)
  if (cached) {
    return { data: cachePayloadToMap(cached), error: null, usedRpc: true }
  }

  const { data, error } = await supabase.rpc('admin_reg_cancel_week_daily_registered', {
    p_operator_id: operatorId,
    p_start_ymd: args.startYmd,
    p_end_ymd: args.endYmd,
    p_customer_id: args.customerIdFromUrl || null,
    p_status: args.selectedStatus || 'all',
    p_channel_id: args.selectedChannel === 'all' ? null : args.selectedChannel || null,
    p_tour_date_start: args.dateRange?.start || null,
    p_tour_date_end: args.dateRange?.end || null,
    p_search_term: args.debouncedSearchTerm?.trim() || null,
  })

  if (error) {
    if (isRpcUnavailable(error)) {
      // 구서명(필터 없음) 폴백 — 마이그레이션 전 환경
      const legacy = await supabase.rpc('admin_reg_cancel_week_daily_registered', {
        p_operator_id: operatorId,
        p_start_ymd: args.startYmd,
        p_end_ymd: args.endYmd,
      })
      if (!legacy.error && legacy.data) {
        const map = rowsToMap(legacy.data)
        writeRegCancelRollupSessionCache(cacheKey, mapToCachePayload(map))
        return { data: map, error: null, usedRpc: true }
      }
      return { data: empty, error: null, usedRpc: false }
    }
    return {
      data: empty,
      error: new Error(
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error)
      ),
      usedRpc: false,
    }
  }

  const map = rowsToMap(data)
  writeRegCancelRollupSessionCache(cacheKey, mapToCachePayload(map))
  return { data: map, error: null, usedRpc: true }
}

function rowsToMap(data: unknown): WeekDailyRegisteredRollup {
  const map: WeekDailyRegisteredRollup = new Map()
  for (const row of (data ?? []) as Array<{
    local_date: string
    registered_people: number | string | null
    registered_count: number | string | null
  }>) {
    const ymd = String(row.local_date ?? '').slice(0, 10)
    if (!ymd) continue
    map.set(ymd, {
      registeredPeople: Number(row.registered_people ?? 0) || 0,
      registeredCount: Number(row.registered_count ?? 0) || 0,
    })
  }
  return map
}

/**
 * 인접 주(±1) 등록 롤업을 백그라운드로 채워 주 전환 시 차트 즉시 표시.
 */
export async function prefetchAdminRegCancelWeekDailyRegisteredAdjacent(
  supabase: SupabaseClient,
  args: Omit<FetchWeekDailyRegisteredArgs, 'startYmd' | 'endYmd'> & {
    currentWeekOffset: number
  }
): Promise<void> {
  const offsets = [args.currentWeekOffset - 1, args.currentWeekOffset + 1]
  await Promise.all(
    offsets.map(async (weekOffset) => {
      const wr = browserLocalWeekRangeFromOffset(weekOffset)
      const fetchArgs: FetchWeekDailyRegisteredArgs = {
        operatorId: args.operatorId,
        startYmd: wr.startYmd,
        endYmd: wr.endYmd,
        selectedStatus: args.selectedStatus,
        selectedChannel: args.selectedChannel,
        dateRange: args.dateRange,
        customerIdFromUrl: args.customerIdFromUrl,
        debouncedSearchTerm: args.debouncedSearchTerm,
      }
      if (readRegCancelRollupSessionCache(weekDailyRegisteredCacheKey(fetchArgs))) return
      await fetchAdminRegCancelWeekDailyRegistered(supabase, fetchArgs)
    })
  )
}
