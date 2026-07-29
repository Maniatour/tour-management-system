/**
 * 통계 모달 코어 구간 soft prefetch — 주/월/년 전환·모달 오픈 시 캐시 hit.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeStatisticsCoreActivityIsoRange } from '@/lib/adminReservationStatsRange'
import {
  buildAdminReservationStatsCoreCacheKey,
  readAdminReservationStatsCoreCache,
  writeAdminReservationStatsCoreCache,
} from '@/lib/adminReservationStatsCoreCache'
import {
  fetchAdminReservationListCardWeekProgressive,
  type AdminReservationListSort,
} from '@/lib/adminReservationListFetch'
import { RESERVATION_STATS_SELECT } from '@/lib/reservationListSelect'

type StatsWarmArgs = {
  operatorId?: string | null
  statisticsWeekOffset: number
  regCancelGranularity: 'week' | 'month' | 'year'
  regCancelMonthOffset: number
  regCancelYearOffset: number
  selectedStatus: string
  selectedChannel: string
  dateRange: { start: string; end: string }
  customerIdFromUrl: string | null
  debouncedSearchTerm: string
  sortBy: AdminReservationListSort
  sortOrder: 'asc' | 'desc'
}

async function fillStatsCoreCacheIfMissing(
  supabase: SupabaseClient,
  args: StatsWarmArgs
): Promise<void> {
  const coreRange = computeStatisticsCoreActivityIsoRange({
    statisticsWeekOffset: args.statisticsWeekOffset,
    regCancelGranularity: args.regCancelGranularity,
    regCancelMonthOffset: args.regCancelMonthOffset,
    regCancelYearOffset: args.regCancelYearOffset,
  })
  const cacheKey = buildAdminReservationStatsCoreCacheKey({
    operatorId: args.operatorId,
    rangeStartIso: coreRange.rangeStartIso,
    rangeEndIso: coreRange.rangeEndIso,
    selectedStatus: args.selectedStatus,
    selectedChannel: args.selectedChannel,
    dateRange: args.dateRange,
    customerIdFromUrl: args.customerIdFromUrl,
    debouncedSearchTerm: args.debouncedSearchTerm,
  })
  if (readAdminReservationStatsCoreCache(cacheKey)) return

  const accumulated: Record<string, unknown>[] = []
  await fetchAdminReservationListCardWeekProgressive(
    supabase,
    {
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
      activityRangeStartIso: coreRange.rangeStartIso,
      activityRangeEndIso: coreRange.rangeEndIso,
      selectFieldsOverride: RESERVATION_STATS_SELECT,
      includeExactCount: false,
    },
    {
      onFirstChunk: ({ rows }) => {
        accumulated.push(...rows)
        return true
      },
      onAdditionalChunk: ({ rows }) => {
        accumulated.push(...rows)
        return true
      },
    }
  )
  writeAdminReservationStatsCoreCache(cacheKey, accumulated)
}

/**
 * 통계 모달 코어 구간 인접(±1) soft prefetch — 주/월/년 전환 시 캐시 hit.
 */
export async function prefetchAdminReservationStatsCoreAdjacent(
  supabase: SupabaseClient,
  args: StatsWarmArgs
): Promise<void> {
  const neighbors: Array<{
    statisticsWeekOffset: number
    regCancelMonthOffset: number
    regCancelYearOffset: number
  }> = []

  if (args.regCancelGranularity === 'week') {
    neighbors.push(
      {
        statisticsWeekOffset: args.statisticsWeekOffset - 1,
        regCancelMonthOffset: args.regCancelMonthOffset,
        regCancelYearOffset: args.regCancelYearOffset,
      },
      {
        statisticsWeekOffset: args.statisticsWeekOffset + 1,
        regCancelMonthOffset: args.regCancelMonthOffset,
        regCancelYearOffset: args.regCancelYearOffset,
      }
    )
  } else if (args.regCancelGranularity === 'month') {
    neighbors.push(
      {
        statisticsWeekOffset: args.statisticsWeekOffset,
        regCancelMonthOffset: args.regCancelMonthOffset - 1,
        regCancelYearOffset: args.regCancelYearOffset,
      },
      {
        statisticsWeekOffset: args.statisticsWeekOffset,
        regCancelMonthOffset: args.regCancelMonthOffset + 1,
        regCancelYearOffset: args.regCancelYearOffset,
      }
    )
  } else {
    neighbors.push(
      {
        statisticsWeekOffset: args.statisticsWeekOffset,
        regCancelMonthOffset: args.regCancelMonthOffset,
        regCancelYearOffset: args.regCancelYearOffset - 1,
      },
      {
        statisticsWeekOffset: args.statisticsWeekOffset,
        regCancelMonthOffset: args.regCancelMonthOffset,
        regCancelYearOffset: args.regCancelYearOffset + 1,
      }
    )
  }

  for (const n of neighbors) {
    await fillStatsCoreCacheIfMissing(supabase, { ...args, ...n })
  }
}

/** 카드 주간뷰 idle: 현재 통계 코어 + 인접 구간을 미리 채움 */
export async function warmAdminReservationStatsCoreCaches(
  supabase: SupabaseClient,
  args: StatsWarmArgs
): Promise<void> {
  await fillStatsCoreCacheIfMissing(supabase, args)
  await prefetchAdminReservationStatsCoreAdjacent(supabase, args)
}
