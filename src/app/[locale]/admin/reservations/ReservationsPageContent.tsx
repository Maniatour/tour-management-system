'use client'

import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { X, Search, SlidersHorizontal, Printer, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { insertCustomerViaAdminApi } from '@/lib/adminCustomerInsert'
import { generateReservationId } from '@/lib/entityIds'
import { toReservationUpdatePayload, updateReservation, type ReservationUpdatePayload } from '@/lib/reservationUpdate'
import type { Database } from '@/lib/supabase'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import { computeCustomerPaymentTotalLineFormula } from '@/utils/reservationPricingBalance'
import { mapDbReservationRowsToReservations } from '@/lib/mapDbReservationRowsToReservations'
import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'
import { createTourPhotosBucket } from '@/lib/tourPhotoBucket'
import {
  useReservationData,
  type AdminListHydratedSnapshot,
  mergeAdminListHydratedSnapshots,
} from '@/hooks/useReservationData'
import { useReservationFollowUpSnapshots } from '@/hooks/useReservationFollowUpSnapshots'
import { useOperationalQueueBadgeSnapshot } from '@/hooks/useOperationalQueueBadgeSnapshot'
import { useCancellationReasonByReservationId } from '@/hooks/useCancellationReasonByReservationId'
import { useImagePrefetch } from '@/hooks/useImagePrefetch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ReservationsHeader from '@/components/reservation/ReservationsHeader'
import ReservationsFilters from '@/components/reservation/ReservationsFilters'
import { DateGroupHeader } from '@/components/reservation/DateGroupHeader'
import ReservationsEmptyState from '@/components/reservation/ReservationsEmptyState'
import ReservationsPagination from '@/components/reservation/ReservationsPagination'
import type { CancelFollowUpManualKind } from '@/components/reservation/ReservationFollowUpQueueModal'
import type { CustomerCommunicationChannel } from '@/lib/customerCommunicationChannel'
import { useAuth } from '@/contexts/AuthContext'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { operatorIdInsert } from '@/lib/operators/scopeQuery'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { upsertReservationCancellationReason, isRebookingReservationByReasonMap } from '@/lib/reservationCancellationReason'
import {
  fetchCancelledMissingReasonQueueMeta,
  isCancelledMissingReasonAutoOpenDismissedToday,
} from '@/lib/cancelledMissingReasonQueue'
import { dispatchCancelRebookingFollowUpRefresh } from '@/lib/cancelRebookingFollowUpRefresh'
import { applyNoShowReservationSideEffects } from '@/lib/reservationNoShowEffects'
import {
  resolveReservationEmailIsEnglish,
  resolveReservationEmailLocale,
} from '@/lib/reservationEmailLocale'
import { 
  getPickupHotelDisplay, 
  getCustomerName, 
  getProductName, 
  getChannelName, 
  calculateTotalPrice,
  getReservationPartySize,
  normalizeTourDateKey,
  isoToLocalCalendarDateKey,
  getStatusLabel,
  isReservationTourDatePastLocal,
} from '@/utils/reservationUtils'
import { timeToHHmm } from '@/lib/utils'
import {
  isTourDeletedStatus,
  isReservationCancelledStatus,
  isReservationDeletedStatus,
} from '@/utils/tourUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import type { 
  Customer, 
  Reservation,
  Channel,
  PickupHotel,
  Option
} from '@/types/reservation'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'
import { useAwayOtherUserChangesNotifier } from '@/hooks/useAwayOtherUserChangesNotifier'
import {
  fetchAdminReservationList,
  fetchAdminReservationListCardWeekProgressive,
  fetchAdminReservationListCalendarProgressive,
  fetchAdminReservationListAllFlatProgressive,
  fetchAdminReservationListActivityWindowRowCount,
  prefetchAdminReservationListAdjacentPage,
  prefetchAdminReservationCardWeekAdjacentSnapshots,
  prefetchAdminReservationCalendarAdjacentSnapshots,
  ADMIN_RESERVATION_CARD_WEEK_RECENT_REGISTERED_DAYS,
} from '@/lib/adminReservationListFetch'
import { createAdminListHydrationBatch } from '@/lib/adminReservationListHydrationBatch'
import {
  buildAdminReservationListPageCacheKey,
  readAdminReservationListPageCache,
  writeAdminReservationListPageCache,
} from '@/lib/adminReservationListPageCache'
import {
  createChoicesBatchFetcher,
  createChoicesCoalescingGetter,
  prefetchAdminReservationCardSideData,
} from '@/lib/adminReservationCardPrefetch'
import { seedChoicesCacheRefFromMemory } from '@/lib/adminReservationChoicesMemoryCache'
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
import { RESERVATION_LIST_SELECT } from '@/lib/reservationListSelect'
import {
  fetchOperationalQueueCandidateIds,
  fetchReservationsByIdsProgressive,
  operationalQueueHasReservations,
  pickReservationsForOperationalQueue,
} from '@/lib/operationalQueueFetch'
import { computeStatisticsCoreActivityIsoRange } from '@/lib/adminReservationStatsRange'
import {
  buildAdminReservationStatsCoreCacheKey,
  readAdminReservationStatsCoreCache,
  writeAdminReservationStatsCoreCache,
} from '@/lib/adminReservationStatsCoreCache'
import { prefetchAdminReservationStatsCoreAdjacent, warmAdminReservationStatsCoreCaches } from '@/lib/adminReservationStatsCorePrefetch'
import { invalidateAdminReservationViewCaches } from '@/lib/adminReservationViewCacheInvalidate'
import {
  buildAdminOperationalQueueCacheKey,
  readAdminOperationalQueueCache,
  writeAdminOperationalQueueCache,
} from '@/lib/adminOperationalQueueCache'
import { fetchAdminRegCancelYtdWeekdayAvg, type YtdWeekdayAvgBuckets } from '@/lib/adminRegCancelYtdWeekdayAvg'
import {
  computeAvgDailyNetByMonthForCalendarYear,
  computeAvgDailyNetByWeekdayForYears,
} from '@/lib/regCancelNetWeekdayAvg'
import {
  fetchAdminRegCancelWeekDailyRegistered,
  prefetchAdminRegCancelWeekDailyRegisteredAdjacent,
  type WeekDailyRegisteredRollup,
} from '@/lib/adminRegCancelWeekDailyRegistered'
import { RESERVATION_STATS_SELECT } from '@/lib/reservationListSelect'
import {
  browserLocalInclusiveDateKeys,
  browserLocalTodayYmd,
  browserLocalYesterdayYmd,
  browserLocalWeekRangeFromOffset,
  formatBrowserLocalYmdRangeDisplay,
  browserLocalCalendarMonthWindow,
  browserLocalCalendarViewWindow,
  browserLocalCalendarYearWindow,
  browserLocalCalendarYearMonthKeys,
  browserLocalCreatedAtGteIsoForRecentCalendarDays,
} from '@/lib/browserLocalWeek'
import {
  type ReservationStatusAuditRow,
  buildSimpleCardStatusChangeAuditRequestFromFiltered,
  buildSimpleCardStatusTransitionMapFromCachedAuditRows,
  collectReservationActivityDateKeys,
  localYmdSetWhereBecameCancelledFromAuditRows,
  isIntoCancelledLikeTransition,
  statusTransitionSortIndex,
} from '@/lib/reservationStatusAudit'
import {
  fetchReservationStatusTransitionsChunked,
  fetchReservationStatusTransitionsByTimeRange,
  fetchReservationStatusAuditLogsTransitionsByTimeRange,
  mergeIndexedStatusAuditRows,
} from '@/lib/reservationStatusEventsFetch'
import { aggregateStatusTransitionBucketsForReservationWindow } from '@/lib/reservationStatusTargetBuckets'
import { describeError, serializeError } from '@/lib/errorSerialization'
import {
  reservationMatchesExtendedPricingMismatchCriteria,
  type BalanceChannelRowInput,
} from '@/utils/balanceChannelRevenue'
import type { PaymentRecordLike } from '@/utils/reservationPricingBalance'
import { reservationNeedsCancelFinancialCleanup } from '@/lib/reservationActionRequiredCancelTab'
import {
  isManiaTourOrServiceReservation,
  reservationExemptFromDepositRequirement,
} from '@/lib/reservationActionRequiredDepositTab'
import {
  reservationNeedsAnyFollowUpAttention,
  reservationNeedsCancelFollowUpQueueAttention,
  type FollowUpPipelineStepKey,
} from '@/lib/reservationFollowUpPipeline'

const CustomerForm = dynamic(() => import('@/components/CustomerForm'), { ssr: false, loading: () => null })
const CustomerEditSimilarReservationsModal = dynamic(
  () => import('@/components/reservation/CustomerEditSimilarReservationsModal'),
  { ssr: false, loading: () => null }
)
const ReservationForm = dynamic(() => import('@/components/reservation/ReservationForm'), { ssr: false, loading: () => null })
const PricingInfoModal = dynamic(() => import('@/components/reservation/PricingInfoModal'), { ssr: false, loading: () => null })
const ReservationCalendar = dynamic(() => import('@/components/ReservationCalendar'), { ssr: false, loading: () => null })
const PaymentRecordsList = dynamic(() => import('@/components/PaymentRecordsList'), { ssr: false, loading: () => null })
const PickupTimeModal = dynamic(() => import('@/components/tour/modals/PickupTimeModal'), { ssr: false, loading: () => null })
const PickupHotelModal = dynamic(() => import('@/components/tour/modals/PickupHotelModal'), { ssr: false, loading: () => null })
const EmailPreviewModal = dynamic(() => import('@/components/reservation/EmailPreviewModal'), { ssr: false, loading: () => null })
const ResidentInquiryEmailPreviewModal = dynamic(
  () => import('@/components/reservation/ResidentInquiryEmailPreviewModal'),
  { ssr: false, loading: () => null }
)
const EmailLogsModal = dynamic(() => import('@/components/reservation/EmailLogsModal'), { ssr: false, loading: () => null })
const SmsLogsModal = dynamic(() => import('@/components/reservation/SmsLogsModal'), { ssr: false, loading: () => null })
const ReviewManagementSection = dynamic(
  () => import('@/components/reservation/ReviewManagementSection'),
  { ssr: false, loading: () => null }
)
const ResizableModal = dynamic(() => import('@/components/reservation/ResizableModal'), { ssr: false, loading: () => null })
const WeeklyStatsPanel = dynamic(() => import('@/components/reservation/WeeklyStatsPanel'), { ssr: false, loading: () => null })
const ReservationCardItem = dynamic(
  () => import('@/components/reservation/ReservationCardItem').then((mod) => mod.ReservationCardItem),
  { ssr: false, loading: () => null }
)
const AdminReservationCardVirtualGrid = dynamic(
  () =>
    import('@/components/reservation/AdminReservationCardVirtualGrid').then(
      (mod) => mod.AdminReservationCardVirtualGrid
    ),
  { ssr: false, loading: () => null }
)
const ReservationFollowUpQueueModal = dynamic(
  () => import('@/components/reservation/ReservationFollowUpQueueModal'),
  { ssr: false, loading: () => null }
)
const CancelledMissingReasonModal = dynamic(
  () => import('@/components/reservation/CancelledMissingReasonModal'),
  { ssr: false, loading: () => null }
)
const ReservationActionRequiredModal = dynamic(
  () => import('@/components/reservation/ReservationActionRequiredModal'),
  { ssr: false, loading: () => null }
)
const CustomerReceiptModal = dynamic(() => import('@/components/receipt/CustomerReceiptModal'), { ssr: false, loading: () => null })
const ReservationFormEmailSendButtons = dynamic(
  () => import('@/components/reservation/ReservationFormEmailSendButtons').then((mod) => mod.ReservationFormEmailSendButtons),
  { ssr: false, loading: () => null }
)
const ReservationFormSmsSendButton = dynamic(
  () => import('@/components/reservation/ReservationFormSmsSendButton').then((mod) => mod.ReservationFormSmsSendButton),
  { ssr: false, loading: () => null }
)
const DeletedReservationsTableModal = dynamic(
  () => import('@/components/shared/DeletedReservationsTableModal').then((mod) => mod.DeletedReservationsTableModal),
  { ssr: false, loading: () => null }
)
import { TourDetailResizableDialog } from '@/components/tour/TourDetailResizableDialog'
const AwayOtherUserChangesModal = dynamic(
  () => import('@/components/shared/AwayOtherUserChangesModal'),
  { ssr: false, loading: () => null }
)

const RESERVATIONS_LIST_UI_DEFAULT = {
  searchTerm: '',
  viewMode: 'card' as 'card' | 'calendar' | 'list',
  selectedStatus: 'all',
  currentPage: 1,
  itemsPerPage: 20,
  /** 통계 패널(차트·상단 요약) 전용 주간 오프셋 — 예약 카드 목록과 독립 */
  statisticsWeekOffset: 0,
  /** 날짜별 카드 목록이 보여 줄 7일 구간(페이지) */
  cardsWeekPage: 0,
  selectedChannel: 'all',
  dateRange: { start: '', end: '' } as { start: string; end: string },
  sortBy: 'created_at' as 'created_at' | 'tour_date' | 'customer_name' | 'product_name',
  sortOrder: 'desc' as 'asc' | 'desc',
  groupByDate: true,
  /** 일별 등록·취소 차트: 7일 / 월간(한 달) / 연간(1~12월) */
  regCancelGranularity: 'week' as 'week' | 'month' | 'year',
  regCancelMonthOffset: 0,
  regCancelYearOffset: 0,
  /** 예약 달력 뷰: 오늘 기준 달 오프셋(0=이번 달) */
  calendarMonthOffset: 0,
}

function localWeekdayIndexFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay()
}

/** 그룹 날짜 기준: 해당일 등록(addedTime) vs 해당일 수정(updated_at) — 당일 등록 건은 등록에만 포함하고 상태변경에선 제외(중복 방지) */
function splitReservationsByActivityForDate(date: string, reservations: Reservation[]) {
  const registration: Reservation[] = []
  const statusChange: Reservation[] = []
  const seenReg = new Set<string>()
  const seenStatus = new Set<string>()
  for (const r of reservations) {
    const createdKey = isoToLocalCalendarDateKey(r.addedTime)
    const updatedKey = isoToLocalCalendarDateKey(r.updated_at ?? null)
    if (createdKey === date && !seenReg.has(r.id)) {
      seenReg.add(r.id)
      registration.push(r)
    }
    if (updatedKey === date && !seenStatus.has(r.id) && createdKey !== date) {
      seenStatus.add(r.id)
      statusChange.push(r)
    }
  }
  return { registration, statusChange }
}

/** 심플 카드 상태 감사: effect 의존 키 + 네트워크 조회 필요 여부(첫 프레임부터 로딩 UI로 맞춤) */
function computeSimpleCardStatusAuditPlan(
  groupByDate: boolean,
  filteredReservations: Reservation[],
  cardsWeekPage: number,
  auditRowsByRecordId?: Record<string, ReservationStatusAuditRow[]>
): null | { contentKey: string; needsNetworkFetch: boolean } {
  if (!groupByDate) return null
  const req = buildSimpleCardStatusChangeAuditRequestFromFiltered(
    filteredReservations,
    cardsWeekPage,
    auditRowsByRecordId
  )
  const { startYmd, endYmd } = browserLocalWeekRangeFromOffset(cardsWeekPage)
  const keys = req.targets.map((t) => t.key).sort().join(',')
  /** ISO 대신 달력 주간 키 — 목록 폴링 시각이 바뀌어도 동일 주·동일 대상이면 키가 안정적 */
  const contentKey = `${startYmd}\u0001${endYmd}\u0001${keys}`
  const needsNetworkFetch = req.targets.length > 0 && req.uniqueIds.length > 0
  return { contentKey, needsNetworkFetch }
}

function reservationTouchesActivityIsoRange(
  r: Reservation,
  rangeStartIso: string,
  rangeEndIso: string
): boolean {
  const created = String(r.addedTime ?? '').trim()
  if (created && created >= rangeStartIso && created <= rangeEndIso) return true
  const updated = String(r.updated_at ?? '').trim()
  if (updated && updated >= rangeStartIso && updated <= rangeEndIso) return true
  return false
}

export default function AdminReservations() {
  const t = useTranslations('reservations')
  const { user, userPosition, hasPermission } = useAuth()
  const isSuper = userPosition === 'super'
  
  // 초이스 뱃지 색상 (앤텔롭 L/X/U 고정색 + 기타 해시 색상)
  const getGroupColorClasses = useCallback((groupId: string, groupName?: string, optionName?: string) => {
    const opt = (optionName || '').trim()
    // 🏜️ 이모지 유무와 무관하게 L/X/U 축약 라벨 매칭
    if (/(?:^|[\s])L$/.test(opt) || opt === '🏜️ L' || opt.endsWith(' L')) {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300'
    }
    if (/(?:^|[\s])X$/.test(opt) || opt === '🏜️ X' || opt.endsWith(' X')) {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800 border border-violet-300'
    }
    if (/(?:^|[\s])U$/.test(opt) || opt === '🏜️ U' || opt.endsWith(' U')) {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200'
    }

    const colorPalette = [
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-border",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800 border border-violet-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 border border-cyan-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 border border-pink-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-lime-100 text-lime-800 border border-lime-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200",
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
    ]
    
    const hashSource = optionName || groupName || groupId
    let hash = 0
    for (let i = 0; i < hashSource.length; i++) {
      hash = hashSource.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    return colorPalette[Math.abs(hash) % colorPalette.length]
  }, [])

  const fetchChoicesBatch = useMemo(
    () => createChoicesBatchFetcher(fetchApiWithAuth),
    []
  )

  // 카드별 초이스 캐시 (목록 prefetch 가 paint 전에 채움 — N+1 GET /choices 방지)
  const choicesCacheRef = useRef<Map<string, Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: {
      option_key: string
      option_name: string
      option_name_ko: string
      internal_name?: string
      badge_icon_url?: string
      product_choices: {
        choice_group_ko: string
      }
    }
  }>>>(new Map())

  const getChoicesCoalesced = useMemo(
    () => createChoicesCoalescingGetter(fetchChoicesBatch, choicesCacheRef),
    [fetchChoicesBatch]
  )

  // 목록 prefetch 캐시 우선 — 미스 시 debounce 배치 (개별 GET /choices 금지)
  const getSelectedChoicesFromNewSystem = useCallback(
    async (reservationId: string) => {
      if (!reservationId?.trim()) return []
      try {
        return await getChoicesCoalesced(reservationId)
      } catch (error) {
        const msg =
          typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : error instanceof Error
              ? error.message
              : ''
        const isAbortError =
          (error instanceof Error &&
            (error.name === 'AbortError' ||
              error.message.includes('aborted') ||
              error.message.includes('signal is aborted'))) ||
          (msg &&
            (msg.includes('AbortError') ||
              msg.includes('aborted') ||
              msg.includes('signal is aborted')))
        if (isAbortError) return []
        console.error('Error fetching reservation choices:', {
          reservationId,
          message: msg || undefined,
          raw: error,
        })
        return []
      }
    },
    [getChoicesCoalesced]
  )

  // ReservationCardItem?? null?????????????? choices ??
  const getSelectedChoicesNormalized = useCallback(async (reservationId: string) => {
    const rows = await getSelectedChoicesFromNewSystem(reservationId)
    return rows.map((r) => {
      const row = r as {
        choice_id?: string | null
        option_id?: string | null
        quantity?: number | null
        option_key?: string | null
        choice_options?: {
          option_key?: string | null
          option_name?: string | null
          option_name_ko?: string | null
          internal_name?: string | null
          badge_icon_url?: string | null
        } | null
        product_choices?: { choice_group_ko?: string | null } | null
      }
      const co = row.choice_options as {
        option_key?: string | null
        option_name?: string | null
        option_name_ko?: string | null
        internal_name?: string | null
        badge_icon_url?: string | null
        product_choices?: { choice_group_ko?: string | null } | null
      } | null
      const pc = row.product_choices
      const optionKey = co?.option_key || row.option_key || ''
      return {
        choice_id: row.choice_id ?? '',
        option_id: row.option_id ?? '',
        quantity: row.quantity ?? 0,
        choice_options: {
          option_key: optionKey,
          option_name: co?.option_name ?? '',
          option_name_ko: co?.option_name_ko ?? '',
          internal_name: co?.internal_name ?? '',
          badge_icon_url: co?.badge_icon_url ?? '',
          product_choices: {
            choice_group_ko:
              pc?.choice_group_ko ?? co?.product_choices?.choice_group_ko ?? '',
          },
        },
      }
    })
  }, [getSelectedChoicesFromNewSystem])

  const [residentCustomerBatchMap, setResidentCustomerBatchMap] = useState<
    Map<string, { resident_status: string | null }[]>
  >(() => new Map())

  const router = useRouter()
  const routeParams = useParams() as { locale?: string }
  const locale = routeParams?.locale || 'ko'
  const searchParams = useSearchParams()
  const { operatorId } = useOperatorOptional()

  const awayNotifier = useAwayOtherUserChangesNotifier({
    supabase,
    storageNamespace: 'admin-reservations',
    scope: { reservations: true },
    canQueryAuditLogs: hasPermission('canViewAuditLogs'),
    locale,
    enabled: Boolean(user?.email),
  })
  
  // URL??? ?? ID ????? ??????
  const customerIdFromUrl = searchParams.get('customer')
  
  // ???? ?????????????
  const {
    reservations,
    customers,
    products,
    channels,
    productOptions,
    optionChoices,
    options: catalogOptions,
    pickupHotels,
    coupons,
    reservationPricingMap: hookReservationPricingMap,
    reservationOptionsPresenceByReservationId: hookReservationOptionsPresenceByReservationId,
    toursMap: hookToursMap,
    loadingProgress,
    reservationsAggregateReady,
    replaceReservationsFromQueryResult,
    mergeMoreReservationsFromQueryResult,
    patchReservationInList,
    refreshReservationPricingForIds,
    refreshReservationOptionsPresenceForIds,
    refreshToursMapForReservationIds,
    refreshCustomers,
    mergeCustomers,
    hydrateAdminListRawRows,
  } = useReservationData({
    disableReservationsAutoLoad: true,
    customersByReservationIds: true,
    deferFormCatalogs: true,
    productsSelectLite: true,
    customersSelectLite: true,
  })

  /** 목록 재조회 시 stale-while-revalidate — 기존 카드가 있으면 전체 로딩 스피너 생략 */
  const reservationsListRef = useRef<Reservation[]>([])
  reservationsListRef.current = reservations

  // 채널 favicon 워밍업 — 카드/배지 첫 페인트 시 깜빡임 제거
  const channelFaviconUrls = useMemo(
    () =>
      ((channels ?? []) as Array<{ favicon_url?: string | null }>).map((c) => c?.favicon_url ?? null),
    [channels]
  )
  useImagePrefetch(channelFaviconUrls)

  /** 예약 처리 필요 / Follow up — 주간 뷰와 무관하게 전역 스냅샷(삭제 제외 전 예약) */
  const [operationalQueueSnapshot, setOperationalQueueSnapshot] = useState<AdminListHydratedSnapshot | null>(null)
  const [operationalQueueLoading, setOperationalQueueLoading] = useState(false)
  const operationalQueueFetchGenRef = useRef(0)
  const operationalQueueInFlightRef = useRef(false)

  /** true: 첫 목록 요청 전·진행 중에 본문 스피너 유지(빈 목록 한 프레임 방지) */
  const [serverListLoading, setServerListLoading] = useState(true)
  const [serverListTotal, setServerListTotal] = useState(0)
  /** 주간 뷰: 500건 단위 이어 받기 진행률(카탈로그 `loadingProgress`와 별도) */
  const [adminListChunkProgress, setAdminListChunkProgress] = useState<{
    loaded: number
    total: number | null
  } | null>(null)
  const reservationFilterLayoutResetSkipRef = useRef(true)
  const replaceReservationsFromQueryResultRef = useRef(replaceReservationsFromQueryResult)
  replaceReservationsFromQueryResultRef.current = replaceReservationsFromQueryResult
  const mergeMoreReservationsFromQueryResultRef = useRef(mergeMoreReservationsFromQueryResult)
  mergeMoreReservationsFromQueryResultRef.current = mergeMoreReservationsFromQueryResult
  /** 주간 카드 점진 로드: 필터 바꾸면 이전 백그라운드 병합 무시 */
  const adminCardWeekFetchGenRef = useRef(0)
  /** 통계 패널 전용 예약(확장 활동 구간) — 카드 주간 7일 목록과 분리 로드 */
  const [weeklyStatsModalOpen, setWeeklyStatsModalOpen] = useState(false)
  const [statisticsReservations, setStatisticsReservations] = useState<Reservation[]>([])
  const [statisticsReservationsLoading, setStatisticsReservationsLoading] = useState(false)
  /** YTD 요일 평균선 — 서버 RPC 집계(7일 탭) */
  const [ytdWeekdayAvgRpc, setYtdWeekdayAvgRpc] = useState<YtdWeekdayAvgBuckets | null>(null)
  const [statisticsYtdExtensionLoading, setStatisticsYtdExtensionLoading] = useState(false)
  const ytdWeekdayAvgFetchGenRef = useRef(0)
  const [weekRegRollupByYmd, setWeekRegRollupByYmd] = useState<WeekDailyRegisteredRollup | null>(null)
  const weekRegRollupFetchGenRef = useRef(0)
  const statisticsFetchGenRef = useRef(0)
  /** 차트·평균선: 통계·감사 확정 전 중간 집계(예: YTD 평균 -135) 깜빡임 방지 */
  const regCancelChartStableRowsRef = useRef<
    Array<{
      dateKey: string
      registeredPeople: number
      registeredCount: number
      cancelledPeople: number
      cancelledCount: number
      avgLineRegistered: number
      avgLineRegisteredCount: number
    }>
  >([])
  const regCancelChartStableScopeRef = useRef<string | null>(null)

  const refreshReservationPricingForIdsRef = useRef(refreshReservationPricingForIds)
  const refreshReservationOptionsPresenceForIdsRef = useRef(refreshReservationOptionsPresenceForIds)
  refreshReservationPricingForIdsRef.current = refreshReservationPricingForIds
  refreshReservationOptionsPresenceForIdsRef.current = refreshReservationOptionsPresenceForIds

  const refreshReservationPricingForActionRequired = useCallback(
    async (reservationIds: string[]) => {
      const map = await refreshReservationPricingForIds(reservationIds)
      if (map.size === 0) return
      setOperationalQueueSnapshot((prev) => {
        if (!prev) return prev
        const pricingMap = new Map(prev.pricingMap)
        map.forEach((v, k) => pricingMap.set(k, v))
        return { ...prev, pricingMap }
      })
    },
    [refreshReservationPricingForIds]
  )

  const handleReservationOptionsMutated = useCallback(
    (reservationId: string) => {
      void refreshReservationOptionsPresenceForIds([reservationId])
      void refreshReservationPricingForActionRequired([reservationId])
    },
    [refreshReservationOptionsPresenceForIds, refreshReservationPricingForActionRequired]
  )

  // ??? ???(?? ??? ??????? ????)
  const [reservationListUi, setReservationListUi, reservationListUiHydrated] = useRoutePersistedState(
    'reservations-list',
    RESERVATIONS_LIST_UI_DEFAULT
  )
  const {
    searchTerm,
    viewMode,
    selectedStatus,
    currentPage,
    itemsPerPage,
    statisticsWeekOffset: statisticsWeekOffsetStored,
    cardsWeekPage: cardsWeekPageStored,
    selectedChannel,
    dateRange,
    sortBy,
    sortOrder,
    groupByDate,
    regCancelGranularity: regCancelGranularityStored,
    regCancelMonthOffset: regCancelMonthOffsetStored,
    regCancelYearOffset: regCancelYearOffsetStored,
    calendarMonthOffset: calendarMonthOffsetStored,
  } = reservationListUi as typeof RESERVATIONS_LIST_UI_DEFAULT & { currentWeek?: number }
  const statisticsWeekOffset =
    statisticsWeekOffsetStored ?? (reservationListUi as { currentWeek?: number }).currentWeek ?? 0
  const cardsWeekPage =
    cardsWeekPageStored ?? (reservationListUi as { currentWeek?: number }).currentWeek ?? 0
  const regCancelGranularity = regCancelGranularityStored ?? 'week'
  const regCancelMonthOffset = regCancelMonthOffsetStored ?? 0
  const regCancelYearOffset = regCancelYearOffsetStored ?? 0
  const calendarMonthOffset = calendarMonthOffsetStored ?? 0

  // setReservationListUi 는 useState setter라 안정 참조 — 모든 setter를 useCallback 으로 감싸
  // memoized 자식 컴포넌트(ReservationsHeader/ReservationsFilters/...)의 props 안정성을 보장한다.
  const setSearchTerm = useCallback(
    (v: React.SetStateAction<string>) =>
      setReservationListUi((u) => ({
        ...u,
        searchTerm: typeof v === 'function' ? (v as (s: string) => string)(u.searchTerm) : v,
      })),
    [setReservationListUi]
  )
  const setViewMode = useCallback(
    (m: 'card' | 'calendar' | 'list') => setReservationListUi((u) => ({ ...u, viewMode: m })),
    [setReservationListUi]
  )
  const setCalendarMonthOffset = useCallback(
    (offset: number) => setReservationListUi((u) => ({ ...u, calendarMonthOffset: offset })),
    [setReservationListUi]
  )
  const setSelectedStatus = useCallback(
    (s: string) => setReservationListUi((u) => ({ ...u, selectedStatus: s })),
    [setReservationListUi]
  )
  const setCurrentPage = useCallback(
    (v: React.SetStateAction<number>) =>
      setReservationListUi((u) => ({
        ...u,
        currentPage: typeof v === 'function' ? (v as (n: number) => number)(u.currentPage) : v,
      })),
    [setReservationListUi]
  )
  const setItemsPerPage = useCallback(
    (v: React.SetStateAction<number>) =>
      setReservationListUi((u) => ({
        ...u,
        itemsPerPage: typeof v === 'function' ? (v as (n: number) => number)(u.itemsPerPage) : v,
      })),
    [setReservationListUi]
  )
  const setStatisticsWeekOffset = useCallback(
    (v: React.SetStateAction<number>) =>
      setReservationListUi((u) => {
        const prev =
          (u as { statisticsWeekOffset?: number; currentWeek?: number }).statisticsWeekOffset ??
          (u as { currentWeek?: number }).currentWeek ??
          0
        const next = typeof v === 'function' ? (v as (n: number) => number)(prev) : v
        return { ...u, statisticsWeekOffset: next }
      }),
    [setReservationListUi]
  )
  const setCardsWeekPage = useCallback(
    (v: React.SetStateAction<number>) =>
      setReservationListUi((u) => {
        const prev =
          (u as { cardsWeekPage?: number; currentWeek?: number }).cardsWeekPage ??
          (u as { currentWeek?: number }).currentWeek ??
          0
        const next = typeof v === 'function' ? (v as (n: number) => number)(prev) : v
        return { ...u, cardsWeekPage: next }
      }),
    [setReservationListUi]
  )
  const setSelectedChannel = useCallback(
    (c: string) => setReservationListUi((u) => ({ ...u, selectedChannel: c })),
    [setReservationListUi]
  )
  const setDateRange = useCallback(
    (v: React.SetStateAction<{ start: string; end: string }>) =>
      setReservationListUi((u) => ({
        ...u,
        dateRange: typeof v === 'function' ? (v as (r: { start: string; end: string }) => { start: string; end: string })(u.dateRange) : v,
      })),
    [setReservationListUi]
  )
  const setSortBy = useCallback(
    (v: React.SetStateAction<'created_at' | 'tour_date' | 'customer_name' | 'product_name'>) =>
      setReservationListUi((u) => ({
        ...u,
        sortBy: typeof v === 'function' ? (v as (s: typeof u.sortBy) => typeof u.sortBy)(u.sortBy) : v,
      })),
    [setReservationListUi]
  )
  const setSortOrder = useCallback(
    (v: React.SetStateAction<'asc' | 'desc'>) =>
      setReservationListUi((u) => ({
        ...u,
        sortOrder: typeof v === 'function' ? (v as (s: 'asc' | 'desc') => 'asc' | 'desc')(u.sortOrder) : v,
      })),
    [setReservationListUi]
  )
  const setGroupByDate = useCallback(
    (v: React.SetStateAction<boolean>) =>
      setReservationListUi((u) => ({
        ...u,
        groupByDate: typeof v === 'function' ? (v as (g: boolean) => boolean)(u.groupByDate) : v,
      })),
    [setReservationListUi]
  )
  const setRegCancelGranularity = useCallback(
    (g: 'week' | 'month' | 'year') => setReservationListUi((u) => ({ ...u, regCancelGranularity: g })),
    [setReservationListUi]
  )
  const setRegCancelMonthOffset = useCallback(
    (v: React.SetStateAction<number>) =>
      setReservationListUi((u) => ({
        ...u,
        regCancelMonthOffset: typeof v === 'function' ? (v as (n: number) => number)(u.regCancelMonthOffset ?? 0) : v,
      })),
    [setReservationListUi]
  )
  const setRegCancelYearOffset = useCallback(
    (v: React.SetStateAction<number>) =>
      setReservationListUi((u) => ({
        ...u,
        regCancelYearOffset: typeof v === 'function' ? (v as (n: number) => number)(u.regCancelYearOffset ?? 0) : v,
      })),
    [setReservationListUi]
  )

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  /**
   * 상태·채널·투어일 필터: UI는 즉시 반영, 목록 fetch만 debounce.
   * 연속 클릭 시 중간 요청을 줄인다.
   */
  const [listQueryFilters, setListQueryFilters] = useState({
    selectedStatus,
    selectedChannel,
    dateRange: { start: dateRange.start, end: dateRange.end },
  })
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setListQueryFilters((prev) => {
        if (
          prev.selectedStatus === selectedStatus &&
          prev.selectedChannel === selectedChannel &&
          prev.dateRange.start === dateRange.start &&
          prev.dateRange.end === dateRange.end
        ) {
          return prev
        }
        return {
          selectedStatus,
          selectedChannel,
          dateRange: { start: dateRange.start, end: dateRange.end },
        }
      })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [selectedStatus, selectedChannel, dateRange.start, dateRange.end])

  /** 라우트·스토리지 복원 직후 한 번만: 저장된 검색어 → 실제 목록 쿼리에 반영 (이후에는 검색 버튼으로만 적용) */
  const reservationSearchHydratedRef = useRef(false)
  useLayoutEffect(() => {
    if (!reservationListUiHydrated) {
      reservationSearchHydratedRef.current = false
      return
    }
    if (reservationSearchHydratedRef.current) return
    reservationSearchHydratedRef.current = true
    setDebouncedSearchTerm(searchTerm)
  }, [reservationListUiHydrated, searchTerm])

  const operationalListReadyForBadge =
    reservationListUiHydrated && !serverListLoading && !adminListChunkProgress

  const productMapForCancelReasonQueue = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of (products as Array<{ id: string; sub_category?: string }>) || []) {
      if (p.id) m.set(p.id, p.sub_category ?? '')
    }
    return m
  }, [products])
  const tourMapForCancelReasonQueue = useMemo(() => new Map<string, boolean>(), [])

  const refreshCancelReasonQueueStats = useCallback(async () => {
    const meta = await fetchCancelledMissingReasonQueueMeta(supabase)
    setCancelReasonQueueStats({
      union: meta.unionCount,
      needsFollowUp: meta.needsFollowUpCount,
      awaitingReason: meta.awaitingReasonCount,
    })
    return meta
  }, [])

  const {
    badgeSnapshot: operationalBadgeSnapshot,
    badgeLoading: operationalBadgeLoading,
    clearBadgeSnapshot: clearOperationalBadgeSnapshot,
  } = useOperationalQueueBadgeSnapshot({
    enabled: true,
    customerIdFromUrl,
    operatorId,
    hydrateAdminListRawRows,
    listReady: operationalListReadyForBadge,
  })

  const operationalMetricsSnapshot = useMemo(
    () => operationalQueueSnapshot ?? operationalBadgeSnapshot,
    [operationalQueueSnapshot, operationalBadgeSnapshot]
  )

  const [showAddForm, setShowAddForm] = useState(false)
  
  // URL ????? add=true?????? ??? ???
  useEffect(() => {
    const addParam = searchParams.get('add')
    if (addParam === 'true' && !showAddForm) {
      const newId = generateReservationId()
      setNewReservationId(newId)
      setShowAddForm(true)
      // URL??? add ????? ??? (??????????????? ???? ?????
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('add')
      const newUrl = `${window.location.pathname}${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''}`
      window.history.replaceState({}, '', newUrl)
    }
  }, [searchParams, showAddForm])
  const [newReservationId, setNewReservationId] = useState<string | null>(null)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [pricingModalReservation, setPricingModalReservation] = useState<Reservation | null>(null)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedReservationForReview, setSelectedReservationForReview] = useState<Reservation | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)

  const [isInitialLoad, setIsInitialLoad] = useState(true) // ?? ?? ???? ??

  const [cancelReasonQueueOpen, setCancelReasonQueueOpen] = useState(false)
  const [cancelReasonQueueStats, setCancelReasonQueueStats] = useState({
    union: 0,
    needsFollowUp: 0,
    awaitingReason: 0,
  })
  /** 세션당 자동 오픈 1회 — listReady 깜빡임·메타 이중 fetch로 모달이 두 번 뜨는 것 방지 */
  const cancelReasonAutoOpenAttemptedRef = useRef(false)
  /** 날짜 그룹 헤더(하루 통계·상품/채널/상태 breakdown): 키 없음 = 접힘 — 로드 시 펼쳤다 접히는 깜빡임 방지 */
  const [expandedDateGroups, setExpandedDateGroups] = useState<Set<string>>(new Set())
  const [simpleCardStatusTransitionMap, setSimpleCardStatusTransitionMap] = useState<
    Record<string, { from: string; to: string }>
  >({})
  /** 집계 결과가 화면에 반영된 주간 스코프 — 점진 로드로 contentKey만 바뀔 때 «집계 중» 깜빡임 방지 */
  const [simpleCardStatusTransitionDisplayScopeKey, setSimpleCardStatusTransitionDisplayScopeKey] = useState<
    string | null
  >(null)
  /**
   * 심플 카드 status 전환(`reservation_status_events`): `simpleCardAuditContentKey`(주간+대상 목록)마다 한 번만 조회.
   * 주(`cardsWeekPage`)가 바뀌면 키가 달라지므로 다시 fetch한다. 세션 전역 `done` ref는 키 변경 시 재조회를 막아 0건으로 보이는 버그가 난다.
   */
  const lastSimpleCardStatusAuditFetchedKeyRef = useRef<string | null>(null)
  /** 동일 contentKey로 이미 디바운스·fetch가 진행 중이면 재스케줄하지 않음(맵·집계 문구 깜빡임 방지) */
  const simpleCardStatusTransitionInFlightKeyRef = useRef<string | null>(null)
  /** 마지막으로 맵을 비운 대상 contentKey — 키가 같으면 맵을 다시 비우지 않음 */
  /** 맵 초기화는 «주간 스코프»당 1회 — 점진 로드로 contentKey만 바뀔 때 맵을 비우지 않음 */
  const simpleCardStatusTransitionMapClearedForScopeRef = useRef<string | null>(null)

  /** 일별 등록·취소 차트: 취소 = 그날 `reservation_status_events` 기준 취소/삭제 전환일만 (DateGroupHeader 심플 카드와 동일 기준) */
  const [regCancelChartAuditRowsByRecordId, setRegCancelChartAuditRowsByRecordId] = useState<
    Record<string, ReservationStatusAuditRow[]>
  >({})
  const [regCancelChartAuditLoaded, setRegCancelChartAuditLoaded] = useState(false)
  /** `regCancelChartAuditRowsByRecordId`가 반영된 목록 id 집합 — 필터 변경 직후 stale 캐시 방지 */
  const [regCancelChartAuditLoadedSignature, setRegCancelChartAuditLoadedSignature] = useState<
    string | null
  >(null)
  /** 등록·취소 차트 감사 조회 스코프(구간·필터) — id 시그니처와 분리해 점진 로드 중 깜빡임 방지 */
  const regCancelChartAuditInFlightSignatureRef = useRef<string | null>(null)
  const lastRegCancelChartAuditFetchedSignatureRef = useRef<string | null>(null)
  /**
   * 심플 카드 아코디언: 맵에만 사용자 오버라이드 저장.
   * 키 없음 → defaultOpen (등록 상위 그룹 기본 펼침, 상태변경·소그룹 기본 접힘).
   */
  const [simpleCardAccordionOverride, setSimpleCardAccordionOverride] = useState<Map<string, boolean>>(
    () => new Map()
  )
  const resolveSimpleCardAccordionOpen = useCallback(
    (key: string, defaultOpen: boolean) => {
      const v = simpleCardAccordionOverride.get(key)
      if (v !== undefined) return v
      return defaultOpen
    },
    [simpleCardAccordionOverride]
  )
  const toggleSimpleCardAccordion = useCallback((key: string, defaultOpen: boolean) => {
    setSimpleCardAccordionOverride((prev) => {
      const next = new Map(prev)
      const current = prev.has(key) ? prev.get(key)! : defaultOpen
      const newVal = !current
      if (newVal === defaultOpen) next.delete(key)
      else next.set(key, newVal)
      return next
    })
  }, [])
  const [filterModalOpen, setFilterModalOpen] = useState(false) // ??? ?? ??? ???
  const [showDeletedReservationsModal, setShowDeletedReservationsModal] = useState(false)
  const [deletedModalReservations, setDeletedModalReservations] = useState<Reservation[]>([])
  const [deletedReservationsModalLoading, setDeletedReservationsModalLoading] = useState(false)

  // ?? ???/???????? - useCallback??? ????????
  const toggleGroupCollapse = useCallback((date: string) => {
    setExpandedDateGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(date)) {
        newSet.delete(date)
      } else {
        newSet.add(date)
      }
      return newSet
    })
  }, [])

  // ??? ??? ??????
  const [showPaymentRecords, setShowPaymentRecords] = useState(false)
  const [selectedReservationForPayment, setSelectedReservationForPayment] = useState<Reservation | null>(null)

  // ??? ??? ?? ??????
  const [showReservationDetailModal, setShowReservationDetailModal] = useState(false)
  const [selectedReservationForDetail, setSelectedReservationForDetail] = useState<Reservation | null>(null)
  const [receiptModalReservationId, setReceiptModalReservationId] = useState<string | null>(null)

  // ??? ?? ??? ?? ????? ???????? ?????)
  const [showActionRequiredModal, setShowActionRequiredModal] = useState(false)
  const [followUpQueueModalOpen, setFollowUpQueueModalOpen] = useState(false)
  const showActionRequiredModalRef = useRef(false)
  const followUpQueueModalOpenRef = useRef(false)
  useEffect(() => {
    showActionRequiredModalRef.current = showActionRequiredModal
  }, [showActionRequiredModal])
  useEffect(() => {
    followUpQueueModalOpenRef.current = followUpQueueModalOpen
  }, [followUpQueueModalOpen])

  useEffect(() => {
    if (!operationalListReadyForBadge) return
    void refreshCancelReasonQueueStats().then((meta) => {
      if (cancelReasonAutoOpenAttemptedRef.current) return
      cancelReasonAutoOpenAttemptedRef.current = true
      if (isCancelledMissingReasonAutoOpenDismissedToday()) return
      // Follow-up 필요 건만 자동 오픈 — 사유 입력 대기만 있을 때는 열지 않음
      if (meta.needsFollowUpCount > 0) {
        setCancelReasonQueueOpen(true)
      }
    })
  }, [operationalListReadyForBadge, refreshCancelReasonQueueStats])

  const handleOpenCancelReasonQueue = useCallback(() => {
    if (cancelReasonQueueStats.union <= 0) return
    setCancelReasonQueueOpen(true)
  }, [cancelReasonQueueStats.union])

  /** 운영 큐 모달이 열려 있고 전역 스냅샷이 있으면 투어 요약 맵을 전 예약 기준으로 계산 */
  const reservationsForTourInfo = useMemo(() => {
    if (
      operationalQueueSnapshot?.reservations.length &&
      (showActionRequiredModal || followUpQueueModalOpen)
    ) {
      return operationalQueueSnapshot.reservations
    }
    return reservations
  }, [operationalQueueSnapshot, showActionRequiredModal, followUpQueueModalOpen, reservations])

  const toursMapForTourInfo = useMemo(() => {
    if (!operationalQueueSnapshot?.toursMap.size) return hookToursMap
    const m = new Map(hookToursMap)
    operationalQueueSnapshot.toursMap.forEach((v, k) => m.set(k, v))
    return m
  }, [hookToursMap, operationalQueueSnapshot])

  const [followUpPipelineManualRefresh, setFollowUpPipelineManualRefresh] = useState(0)
  const [followUpFormPipelineRefresh, setFollowUpFormPipelineRefresh] = useState(0)
  const [tourDetailModal, setTourDetailModal] = useState<{ tourId: string; title: string } | null>(null)
  const [tourDetailRefreshNonce, setTourDetailRefreshNonce] = useState(0)
  const [reservationIdsWithPayments, setReservationIdsWithPayments] = useState<Set<string>>(new Set())
  const [paymentRecordsByReservationIdForActionBadge, setPaymentRecordsByReservationIdForActionBadge] =
    useState<Map<string, PaymentRecordLike[]>>(() => new Map())
  /** 운영 큐 배지용 payment_records 조회가 끝난 id 집합 시그니처 */
  const [operationalPaymentsReadyKey, setOperationalPaymentsReadyKey] = useState<string | null>(null)

  // ??????? ??????
  const [emailDropdownOpen, setEmailDropdownOpen] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [emailPreviewData, setEmailPreviewData] = useState<{
    reservationId: string
    emailType: 'confirmation' | 'departure' | 'pickup' | 'resident_inquiry'
    customerEmail: string
    pickupTime?: string | null
    tourDate?: string | null
    customerName?: string | null
    productName?: string | null
    channelRN?: string | null
    customerLanguage?: string | null
    productCode?: string | null
    productTags?: string[] | null
  } | null>(null)
  const [showEmailLogs, setShowEmailLogs] = useState(false)
  const [selectedReservationForEmailLogs, setSelectedReservationForEmailLogs] = useState<string | null>(null)
  const [showSmsLogs, setShowSmsLogs] = useState(false)
  const [selectedReservationForSmsLogs, setSelectedReservationForSmsLogs] = useState<string | null>(null)

  // ??????????? ???? ??? ?????
  useEffect(() => {
    if (!emailDropdownOpen) {
      return undefined
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.relative')) {
        setEmailDropdownOpen(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [emailDropdownOpen])

  useEffect(() => {
    if (!showDeletedReservationsModal) {
      setDeletedReservationsModalLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setDeletedReservationsModalLoading(true)
      try {
        const { data, error } = await supabase
          .from('reservations')
          .select('*, choices')
          .eq('status', 'deleted')
          .order('updated_at', { ascending: false })
          .limit(500)
        if (error || cancelled) {
          if (error) console.error('deleted reservations load:', error)
          if (!cancelled) setDeletedModalReservations([])
          return
        }
        const rows = (data || []) as Record<string, unknown>[]
        const productIds = [...new Set(rows.map((r) => r.product_id as string).filter(Boolean))]
        const tourDates = [...new Set(rows.map((r) => r.tour_date).filter(Boolean) as string[])]

        const productSubMap = new Map<string, string>(
          ((products as Array<{ id: string; sub_category?: string }>) || []).map((p) => [
            p.id,
            p.sub_category || '',
          ])
        )
        const missingProdIds = productIds.filter((id) => !productSubMap.has(id))
        if (missingProdIds.length > 0) {
          const { data: prows } = await supabase
            .from('products')
            .select('id, sub_category')
            .in('id', missingProdIds)
          for (const p of prows || []) {
            const row = p as { id: string; sub_category?: string | null }
            productSubMap.set(row.id, row.sub_category || '')
          }
        }

        const maniaIds = productIds.filter((id) => {
          const sc = productSubMap.get(id)
          return sc === 'Mania Tour' || sc === 'Mania Service'
        })
        const tourExistence = new Map<string, boolean>()
        if (maniaIds.length > 0 && tourDates.length > 0) {
          const { data: tex } = await supabase
            .from('tours')
            .select('product_id, tour_date')
            .in('product_id', maniaIds)
            .in('tour_date', tourDates)
          for (const t of tex || []) {
            const row = t as { product_id: string; tour_date: string }
            tourExistence.set(`${row.product_id}-${row.tour_date}`, true)
          }
        }

        if (cancelled) return
        const mapped = mapDbReservationRowsToReservations(rows, productSubMap, tourExistence)
        setDeletedModalReservations(mapped)
        const ids = mapped.map((r) => r.id)
        if (ids.length > 0) {
          await Promise.all([
            refreshReservationPricingForIdsRef.current(ids),
            refreshReservationOptionsPresenceForIdsRef.current(ids),
          ])
        }
      } finally {
        if (!cancelled) setDeletedReservationsModalLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showDeletedReservationsModal, products])

  // ??? ??? ???
  const [tourInfoMap, setTourInfoMap] = useState<Map<string, {
    totalPeople: number
    otherReservationsTotalPeople: number
    allDateTotalPeople: number
    allDateOtherStatusPeople: number
    status: string
    guideName: string
    assistantName: string
    vehicleName: string
    tourDate: string
    tourStartDatetime: string | null
    isAssigned: boolean
    reservationIds: string[]
    productId: string | null
    maxParticipants: number
  }>>(new Map())

  // reservation_pricing ?????? useReservationData ?????????
  // hookReservationPricingMap????????, ?? ????????? (??????????????????
  const [reservationPricingMap, setReservationPricingMap] = useState<Map<string, ReservationPricingMapValue>>(new Map())

  // hookReservationPricingMap??????????? ?? ???????????
  useEffect(() => {
    if (hookReservationPricingMap.size > 0) {
      setReservationPricingMap(hookReservationPricingMap)
    }
  }, [hookReservationPricingMap])

  // ?????????? ??reservationPricingBalance.computeCustomerPaymentTotalLineFormula ?? ???
  // (?????? + ?????????? ??? ??? = required_option_total + option_total, choices_total ???)
  const generatePriceCalculation = useCallback((reservation: any, pricing: any): string => {
    if (!pricing) return ''
    const toN = (v: number | undefined): number => (v == null || v === undefined ? 0 : Number(v) || 0)
    const productPriceTotal = toN(pricing.product_price_total)
    const couponDiscount = toN(pricing.coupon_discount)
    const additionalDiscount = toN(pricing.additional_discount)
    const additionalCost = toN(pricing.additional_cost)
    const commissionAmount = toN(pricing.commission_amount)
    const optionTotal = toN(pricing.option_total)
    const requiredOptionTotal = toN(pricing.required_option_total)
    const optionsSubtotal = requiredOptionTotal + optionTotal
    const notIncludedPrice = toN(pricing.not_included_price)
    const totalPeople = Math.max(1, (reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0))
    const party = { adults: reservation.adults ?? 0, child: reservation.child ?? 0, infant: reservation.infant ?? 0 }
    const tax = toN(pricing.tax)
    const cardFee = toN(pricing.card_fee)
    const prepaymentCost = toN(pricing.prepayment_cost)
    const prepaymentTip = toN(pricing.prepayment_tip)
    const privateTourAdditional = toN(pricing.private_tour_additional_cost)
    const extrasSum =
      additionalCost + tax + cardFee + prepaymentCost + prepaymentTip + privateTourAdditional
    // product_price_total(??? ??????)??? ???? (????+??????????????????????? ??????
    const adultPrice = toN(pricing.adult_product_price)
    const childPrice = toN(pricing.child_product_price)
    const infantPrice = toN(pricing.infant_product_price)
    let subtotal = productPriceTotal
    if (subtotal <= 0 && adultPrice > 0) {
      subtotal = adultPrice * (reservation.adults || 0) + childPrice * (reservation.child || 0) + infantPrice * (reservation.infant || 0)
    }
    if (subtotal <= 0) return ''
    const gross = computeCustomerPaymentTotalLineFormula(pricing, party)
    const totalRevenue = Math.max(0, gross - commissionAmount)
    const currency = pricing.currency || 'USD'
    const sym = currency === 'KRW' ? '?' : '$'
    // ???: (????+????=???? ? ??? = ??????????? $945 ? 3 = $945
    const unitPrice = adultPrice + notIncludedPrice
    let s: string
    if (notIncludedPrice > 0 && adultPrice > 0 && totalPeople > 0) {
      s = `(${sym}${adultPrice.toFixed(0)} + ${sym}${notIncludedPrice.toFixed(0)}) = ${sym}${unitPrice.toFixed(2)} ? ${totalPeople} = ${sym}${subtotal.toFixed(2)}`
    } else {
      s = `${sym}${subtotal.toFixed(2)} ? ${totalPeople} = ${sym}${subtotal.toFixed(2)}`
    }
    const disc = couponDiscount + additionalDiscount
    const hasAdjustmentsAfterProduct =
      disc > 0.005 || optionsSubtotal > 0.005 || extrasSum > 0.005
    if (hasAdjustmentsAfterProduct) {
      if (disc > 0.005) {
        s += ` - ${sym}${disc.toFixed(2)}`
      }
      if (optionsSubtotal > 0.005) {
        s += ` + ${sym}${optionsSubtotal.toFixed(2)}`
      }
      if (extrasSum > 0.005) {
        s += ` + ${sym}${extrasSum.toFixed(2)}`
      }
      s += ` = ${sym}${gross.toFixed(2)}`
    }
    if (commissionAmount > 0) {
      s += ` - ${sym}${commissionAmount.toFixed(2)} = ${sym}${totalRevenue.toFixed(2)}`
    }
    return s
  }, [])

  // ??? ??? ??? ?? ???
  const [showPickupTimeModal, setShowPickupTimeModal] = useState(false)
  const [selectedReservationForPickupTime, setSelectedReservationForPickupTime] = useState<Reservation | null>(null)
  const [pickupTimeValue, setPickupTimeValue] = useState('')
  const pendingReturnToPickupSummaryRef = useRef<string | null>(null)
  const [pickupSummaryReshowRequest, setPickupSummaryReshowRequest] = useState<{
    reservationId: string
    nonce: number
  } | null>(null)

  // ??? ??? ??? ?? ???
  const [showPickupHotelModal, setShowPickupHotelModal] = useState(false)
  const [selectedReservationForPickupHotel, setSelectedReservationForPickupHotel] = useState<Reservation | null>(null)
  const [hotelSearchTerm, setHotelSearchTerm] = useState('')

  // ????????? ??????? ??
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      setGroupByDate(false)
    } else {
      setGroupByDate(true)
    }
  }, [debouncedSearchTerm, setGroupByDate])

  // ??? ??? ??????(hookToursMap ???) ????? ??? ?? ??? ?????? ??
  useEffect(() => {
    if (!reservationsAggregateReady) {
      setTourInfoMap(new Map())
      return
    }

    const buildTourInfoMap = async () => {
      if (!reservationsForTourInfo.length || toursMapForTourInfo.size === 0) {
        setTourInfoMap(new Map())
        return
      }

      try {
        const newTourInfoMap = new Map<string, {
          totalPeople: number
          otherReservationsTotalPeople: number
          allDateTotalPeople: number
          allDateOtherStatusPeople: number
          status: string
          guideName: string
          assistantName: string
          vehicleName: string
          tourDate: string
          tourStartDatetime: string | null
          isAssigned: boolean
          reservationIds: string[]
          productId: string | null
          maxParticipants: number
        }>()

        const DEFAULT_TOUR_MAX = 12
        const productDatePairKeys = new Set<string>()
        reservationsForTourInfo.forEach((r) => {
          const productId = String(r.productId ?? '').trim()
          const tourDate = normalizeTourDateKey(r.tourDate)
          if (productId && tourDate) productDatePairKeys.add(`${productId}__${tourDate}`)
        })

        const toursForInfoBuild = new Map(toursMapForTourInfo)
        if (productDatePairKeys.size > 0) {
          const productIds = [...new Set([...productDatePairKeys].map((k) => k.split('__')[0]!))]
          const tourDates = [...new Set([...productDatePairKeys].map((k) => k.split('__')[1]!))]
          const { data: toursByProductDate } = await supabase
            .from('tours')
            .select(
              'id, tour_status, tour_guide_id, assistant_id, reservation_ids, tour_car_id, tour_date, tour_start_datetime, product_id, max_participants'
            )
            .in('product_id', productIds)
            .in('tour_date', tourDates)

          for (const tour of toursByProductDate || []) {
            const row = tour as Record<string, unknown>
            const productId = String(row.product_id ?? '').trim()
            const tourDate = normalizeTourDateKey(String(row.tour_date ?? ''))
            const pairKey = productId && tourDate ? `${productId}__${tourDate}` : ''
            if (!pairKey || !productDatePairKeys.has(pairKey)) continue
            const tourId = String(row.id ?? '').trim()
            if (!tourId || toursForInfoBuild.has(tourId)) continue
            const resIds = Array.isArray(row.reservation_ids)
              ? (row.reservation_ids as string[])
              : row.reservation_ids
                ? String(row.reservation_ids)
                    .split(',')
                    .map((id: string) => id.trim())
                    .filter(Boolean)
                : []
            toursForInfoBuild.set(tourId, {
              id: tourId,
              tour_status: (row.tour_status as string | null) ?? null,
              tour_guide_id: (row.tour_guide_id as string | null) ?? null,
              assistant_id: (row.assistant_id as string | null) ?? null,
              reservation_ids: resIds,
              tour_car_id: (row.tour_car_id as string | null) ?? null,
              tour_date: (row.tour_date as string | null) ?? null,
              tour_start_datetime: (row.tour_start_datetime as string | null) ?? null,
              product_id: productId || null,
              max_participants: (row.max_participants as number | null | undefined) ?? null,
            })
          }
        }

        // ?? ???? ?????? ????????????????
        const guideEmails = new Set<string>()
        const assistantEmails = new Set<string>()
        const vehicleIds = new Set<string>()
        
        toursForInfoBuild.forEach(tour => {
          if (tour.tour_guide_id) guideEmails.add(tour.tour_guide_id)
          if (tour.assistant_id) assistantEmails.add(tour.assistant_id)
          if (tour.tour_car_id) vehicleIds.add(tour.tour_car_id)
        })

        const chunkSize = 1000

        // ???? ??? ??? ??
        const guideMap = new Map<string, string>()
        if (guideEmails.size > 0) {
          const guideEmailsArray = Array.from(guideEmails)
          for (let i = 0; i < guideEmailsArray.length; i += chunkSize) {
            const chunk = guideEmailsArray.slice(i, i + chunkSize)
            const { data: guides } = await supabase
              .from('team')
              .select('email, name_ko, nick_name')
              .in('email', chunk)
            
            if (guides) {
              guides.forEach((guide: { email: string; name_ko: string | null; nick_name?: string | null }) => {
                if (guide.email) {
                  guideMap.set(guide.email, guide.nick_name || guide.name_ko || '-')
                }
              })
            }
          }
        }

        // ??????????? ??? ??
        const assistantMap = new Map<string, string>()
        if (assistantEmails.size > 0) {
          const assistantEmailsArray = Array.from(assistantEmails)
          for (let i = 0; i < assistantEmailsArray.length; i += chunkSize) {
            const chunk = assistantEmailsArray.slice(i, i + chunkSize)
            const { data: assistants } = await supabase
              .from('team')
              .select('email, name_ko, nick_name')
              .in('email', chunk)
            
            if (assistants) {
              assistants.forEach((assistant: { email: string; name_ko: string | null; nick_name?: string | null }) => {
                if (assistant.email) {
                  assistantMap.set(assistant.email, assistant.nick_name || assistant.name_ko || '-')
                }
              })
            }
          }
        }

        // ?? ??? ??? ??
        const vehicleMap = new Map<string, string>()
        if (vehicleIds.size > 0) {
          try {
            const vehicleIdsArray = Array.from(vehicleIds)
            for (let i = 0; i < vehicleIdsArray.length; i += chunkSize) {
              const chunk = vehicleIdsArray.slice(i, i + chunkSize)
              const { data: vehicles } = await supabase
                .from('vehicles')
                .select('id, nick, vehicle_number, vehicle_type')
                .in('id', chunk)
              
              if (vehicles) {
                const rows = vehicles as {
                  id: string
                  nick?: string | null
                  vehicle_number?: string | null
                  vehicle_type?: string | null
                }[]
                rows.forEach((vehicle) => {
                  if (vehicle.id) {
                    const label =
                      (vehicle.nick && vehicle.nick.trim()) ||
                      vehicle.vehicle_number ||
                      vehicle.vehicle_type ||
                      '-'
                    vehicleMap.set(vehicle.id, label)
                  }
                })
              }
            }
          } catch (error) {
            console.error('?? ??? ?? ???:', error)
          }
        }

        // ??? ??????? ID ?? Map??? ?? ?????(O(1) ????
        const reservationById = new Map<string, Reservation>()
        const reservationByTourId = new Map<string, Reservation>()
        reservationsForTourInfo.forEach(r => {
          reservationById.set(r.id, r)
          if (r.tourId) {
            reservationByTourId.set(r.tourId, r)
          }
        })

        // 투어 배정 인원은 tours.reservation_ids 안의 실제 활성 예약만 집계
        const isActiveAssignedReservation = (reservation: Reservation) => {
          const status = String(reservation.status || '').toLowerCase().trim()
          return (
            !isReservationCancelledStatus(status) &&
            !isReservationDeletedStatus(status)
          )
        }

        // ??? ??? TourHeader?? ???: ??= ??????(confirmed/recruiting) ???, ?? = ??? ????(?????????????
        const isConfirmedOrRecruiting = (status: string | undefined) => {
          const s = (status || '').toString().toLowerCase().trim()
          return s === 'confirmed' || s === 'recruiting'
        }
        const dateProductAllPeopleMap = new Map<string, number>()
        const dateProductConfirmedRecruitingMap = new Map<string, number>()
        reservationsForTourInfo.forEach(r => {
          const productId = String(r.productId ?? '').trim()
          const tourDate = normalizeTourDateKey(r.tourDate)
          if (!productId || !tourDate) return
          const key = `${productId}__${tourDate}`
          const p = getReservationPartySize(r as unknown as Record<string, unknown>)
          const curAll = dateProductAllPeopleMap.get(key) || 0
          dateProductAllPeopleMap.set(key, curAll + p)
          if (isConfirmedOrRecruiting(r.status as string)) {
            const cur = dateProductConfirmedRecruitingMap.get(key) || 0
            dateProductConfirmedRecruitingMap.set(key, cur + p)
          }
        })

        // ?????????????? ?? (????? O(1) ?? ???)
        toursForInfoBuild.forEach((tour, tourId) => {
          let guideName = '-'
          let assistantName = '-'
          let vehicleName = '-'
          let totalPeople = 0

          // ???? ???
          if (tour.tour_guide_id) {
            guideName = guideMap.get(tour.tour_guide_id) || '-'
          }

          // ???????????
          if (tour.assistant_id) {
            assistantName = assistantMap.get(tour.assistant_id) || '-'
          }

          // ?? ???
          if (tour.tour_car_id) {
            vehicleName = vehicleMap.get(tour.tour_car_id) || '-'
          }

          // 해당 투어에 실제 배정된 활성 예약 인원만 합산 (취소/삭제 예약 제외)
          if (tour.reservation_ids && tour.reservation_ids.length > 0) {
            const uniqueReservationIds = [...new Set(tour.reservation_ids)]
            totalPeople = uniqueReservationIds.reduce((sum: number, id: string) => {
              const reservation = reservationById.get(id)
              if (!reservation) return sum
              if (!isActiveAssignedReservation(reservation)) return sum
              return sum + getReservationPartySize(reservation as unknown as Record<string, unknown>)
            }, 0)
          }

          // ?? ?? ??? ??? product_id?tour_date ??? (??? ??? useTourDetailData?? ???)
          const reservation = reservationByTourId.get(tourId)
          const productIdForKey = String(tour.product_id ?? reservation?.productId ?? '').trim()
          const tourDateForKey =
            normalizeTourDateKey(tour.tour_date) || normalizeTourDateKey(reservation?.tourDate)
          const aggregateKey =
            productIdForKey && tourDateForKey ? `${productIdForKey}__${tourDateForKey}` : ''

          const sumAll = aggregateKey ? (dateProductAllPeopleMap.get(aggregateKey) ?? 0) : 0
          const sumFiltered = aggregateKey ? (dateProductConfirmedRecruitingMap.get(aggregateKey) ?? 0) : 0
          const allDateTotalPeople = aggregateKey ? sumFiltered : totalPeople
          const allDateOtherStatusPeople = aggregateKey ? Math.max(0, sumAll - sumFiltered) : 0
          const rawMax = tour.max_participants
          const maxParticipants =
            typeof rawMax === 'number' && Number.isFinite(rawMax) ? rawMax : DEFAULT_TOUR_MAX

          newTourInfoMap.set(tourId, {
            totalPeople,
            otherReservationsTotalPeople: 0, // ?????0??? ???
            allDateTotalPeople,
            allDateOtherStatusPeople,
            status: tour.tour_status || '-',
            guideName,
            assistantName,
            vehicleName,
            tourDate: tour.tour_date || '',
            tourStartDatetime: tour.tour_start_datetime || null,
            isAssigned: true,
            reservationIds: tour.reservation_ids,
            productId: productIdForKey || null,
            maxParticipants,
          })
        })

        setTourInfoMap(newTourInfoMap)
      } catch (error) {
        console.error('??? ??? ????? ?????:', error)
      }
    }

    buildTourInfoMap()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationsForTourInfo, toursMapForTourInfo, reservationsAggregateReady])

  const operationalPaymentScopeKey = useMemo(() => {
    const idSet = new Set<string>()
    if (operationalMetricsSnapshot) {
      for (const r of operationalMetricsSnapshot.reservations) idSet.add(r.id)
    }
    return [...idSet].sort().join(',')
  }, [operationalMetricsSnapshot])

  // 운영 큐 배지(처리 필요) — payment_records는 스냅샷 id만 대상으로 조회
  useEffect(() => {
    if (!operationalPaymentScopeKey) {
      setReservationIdsWithPayments(new Set())
      setPaymentRecordsByReservationIdForActionBadge(new Map())
      setOperationalPaymentsReadyKey('')
      return
    }
    let cancelled = false
    setOperationalPaymentsReadyKey(null)
    const ids = operationalPaymentScopeKey.split(',').filter(Boolean)
    const load = async () => {
      const set = new Set<string>()
      const byRes = new Map<string, PaymentRecordLike[]>()
      const chunkSize = 200
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        const { data } = await supabase
          .from('payment_records')
          .select('reservation_id, payment_status, amount')
          .in('reservation_id', chunk)
        if (cancelled) return
        if (data) {
          data.forEach((row) => {
            const rid = (row as { reservation_id: string }).reservation_id
            set.add(rid)
            const rec: PaymentRecordLike = {
              payment_status: String((row as { payment_status?: string | null }).payment_status ?? ''),
              amount: Number((row as { amount?: unknown }).amount) || 0,
            }
            const arr = byRes.get(rid) ?? []
            arr.push(rec)
            byRes.set(rid, arr)
          })
        }
      }
      if (cancelled) return
      setReservationIdsWithPayments(set)
      setPaymentRecordsByReservationIdForActionBadge(byRes)
      setOperationalPaymentsReadyKey(operationalPaymentScopeKey)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [operationalPaymentScopeKey])

  /**
   * 예약 ID → 투어 ID: tours.reservation_ids에 실제로 포함된 투어만 반영.
   */
  const tourIdByReservationId = useMemo(() => {
    const mergedTours = new Map(hookToursMap)
    operationalMetricsSnapshot?.toursMap.forEach((v, k) => mergedTours.set(k, v))
    const byRes = new Map<string, { tourId: string; deletedRank: number }[]>()
    mergedTours.forEach((tour, tourId) => {
      const deletedRank = isTourDeletedStatus(tour.tour_status) ? 1 : 0
      for (const rid of tour.reservation_ids || []) {
        const id = String(rid ?? '').trim()
        if (!id) continue
        const arr = byRes.get(id) ?? []
        arr.push({ tourId, deletedRank })
        byRes.set(id, arr)
      }
    })
    const m = new Map<string, string>()
    byRes.forEach((candidates, reservationId) => {
      const sorted = [...candidates].sort((a, b) => {
        if (a.deletedRank !== b.deletedRank) return a.deletedRank - b.deletedRank
        return a.tourId.localeCompare(b.tourId)
      })
      if (sorted[0]) m.set(reservationId, sorted[0].tourId)
    })
    return m
  }, [hookToursMap, operationalMetricsSnapshot])

  /** 헤더 배지 — 운영 큐 스냅샷만 사용(주간 목록 폴백 없음 → 숫자 깜빡임 방지) */
  const reservationsForHeaderBadges = useMemo(
    () => operationalMetricsSnapshot?.reservations ?? [],
    [operationalMetricsSnapshot]
  )

  /** 운영 큐·배지 스냅샷 pricing + 훅 맵 최신 갱신 병합 */
  const pricingForOperationalMetrics = useMemo(() => {
    const m = new Map(operationalMetricsSnapshot?.pricingMap ?? [])
    reservationPricingMap.forEach((v, k) => m.set(k, v))
    return m
  }, [reservationPricingMap, operationalMetricsSnapshot])

  const actionRequiredCount = useMemo(() => {
    const isDeleted = (r: Reservation) => {
      const s = (r.status as string)?.trim?.() ?? ''
      return s.toLowerCase() === 'deleted'
    }
    const arReservations = reservationsForHeaderBadges.filter((r) => !isDeleted(r))
    const todayStr = new Date().toISOString().split('T')[0]
    const d = new Date()
    d.setDate(d.getDate() + 7)
    const sevenDaysLaterStr = d.toISOString().split('T')[0]
    const statusPending = (r: Reservation) => (r.status === 'pending' || (r.status as string)?.toLowerCase?.() === 'pending')
    const statusConfirmed = (r: Reservation) => (r.status === 'confirmed' || (r.status as string)?.toLowerCase?.() === 'confirmed')
    const hasPayment = (r: Reservation) => reservationIdsWithPayments.has(r.id)
    const hasTourAssigned = (r: Reservation) => {
      const id = r.tourId?.trim?.()
      if (id && id !== '' && id !== 'null' && id !== 'undefined') return true
      return tourIdByReservationId.has(r.id)
    }
    const hasPricing = (r: Reservation) => {
      const p = pricingForOperationalMetrics.get(r.id)
      return !!(p && (p.total_price != null && p.total_price > 0))
    }
    const isNotCancelledPricing = (r: Reservation) => {
      const s = (r.status as string)?.trim?.() ?? ''
      return !s.toLowerCase().startsWith('cancelled')
    }
    const getBalance = (r: Reservation) => {
      const p = pricingForOperationalMetrics.get(r.id)
      const b = p?.balance_amount
      if (b == null) return 0
      return typeof b === 'number' ? b : parseFloat(String(b)) || 0
    }
    const tourDateBeforeToday = (r: Reservation) => (r.tourDate || '') < todayStr
    const tourDateWithin7Days = (r: Reservation) => {
      const d = r.tourDate
      if (!d) return false
      return d >= todayStr && d <= sevenDaysLaterStr
    }
    const productRefs = (products as Array<{ id: string; name?: string; name_ko?: string; name_en?: string; sub_category?: string; product_code?: string }>) || []
    const isManiaTourOrService = (r: Reservation) => isManiaTourOrServiceReservation(r, productRefs)
    const isCancelled = (r: Reservation) => {
      const s = (r.status as string)?.trim?.() ?? ''
      const low = s.toLowerCase()
      return low === 'cancelled' || low === 'canceled'
    }
    const statusList = arReservations.filter(r => tourDateWithin7Days(r) && statusPending(r))
    const tourList = arReservations.filter(
      (r) => statusConfirmed(r) && !hasTourAssigned(r) && isManiaTourOrService(r)
    )
    const noPricing = arReservations.filter(r => !hasPricing(r))
    const pricingMismatch = arReservations.filter(
      (r) =>
        isNotCancelledPricing(r) &&
        reservationMatchesExtendedPricingMismatchCriteria(
          r,
          pricingForOperationalMetrics,
          (channels || []) as BalanceChannelRowInput[],
          new Map(),
          undefined
        )
    )
    const depositNoTour = arReservations.filter(
      (r) =>
        !isCancelled(r) &&
        isManiaTourOrService(r) &&
        hasPayment(r) &&
        !hasTourAssigned(r)
    )
    const confirmedNoDeposit = arReservations.filter(
      (r) =>
        !isCancelled(r) &&
        statusConfirmed(r) &&
        !hasPayment(r) &&
        !reservationExemptFromDepositRequirement(r, productRefs)
    )
    const balanceList = arReservations.filter(r => tourDateBeforeToday(r) && getBalance(r) > 0)
    const cancelFinancialList = arReservations.filter((r) =>
      reservationNeedsCancelFinancialCleanup(
        r,
        pricingForOperationalMetrics,
        paymentRecordsByReservationIdForActionBadge,
        (channels || []) as BalanceChannelRowInput[],
        undefined
      )
    )
    const allIds = new Set<string>()
    statusList.forEach(r => allIds.add(r.id))
    tourList.forEach(r => allIds.add(r.id))
    noPricing.forEach(r => allIds.add(r.id))
    pricingMismatch.forEach(r => allIds.add(r.id))
    depositNoTour.forEach(r => allIds.add(r.id))
    confirmedNoDeposit.forEach(r => allIds.add(r.id))
    cancelFinancialList.forEach(r => allIds.add(r.id))
    balanceList.forEach(r => allIds.add(r.id))
    return allIds.size
  }, [
    reservationsForHeaderBadges,
    pricingForOperationalMetrics,
    reservationIdsWithPayments,
    paymentRecordsByReservationIdForActionBadge,
    tourIdByReservationId,
    channels,
    products,
  ])

  /** 서버에서 필터·검색·정렬·페이지 반영된 목록 */
  const filteredAndSortedReservations = useMemo(
    () => [...new Map(reservations.map((r) => [r.id, r])).values()],
    [reservations]
  )
  
  const filteredReservations = filteredAndSortedReservations

  /** 날짜 그룹 카드뷰: 통계·차트는 확장 구간 데이터, 카드 목록은 `filteredReservations`(7일) */
  const reservationsForStatistics = useMemo(() => {
    if (!groupByDate || viewMode === 'list') return filteredReservations
    return statisticsReservations
  }, [groupByDate, viewMode, filteredReservations, statisticsReservations])

  const cancelledReservationIdsForReasons = useMemo(() => {
    const byId = new Map<string, Reservation>()
    for (const r of filteredReservations) byId.set(r.id, r)
    if (operationalMetricsSnapshot) {
      for (const r of operationalMetricsSnapshot.reservations) byId.set(r.id, r)
    }
    if (groupByDate && viewMode !== 'list' && weeklyStatsModalOpen) {
      const coreRange = computeStatisticsCoreActivityIsoRange({
        statisticsWeekOffset,
        regCancelGranularity,
        regCancelMonthOffset,
        regCancelYearOffset,
      })
      for (const r of statisticsReservations) {
        if (reservationTouchesActivityIsoRange(r, coreRange.rangeStartIso, coreRange.rangeEndIso)) {
          byId.set(r.id, r)
        }
      }
    }
    return [...byId.values()]
      .filter(
        (r) => isReservationCancelledStatus(r.status) || isReservationDeletedStatus(r.status)
      )
      .map((r) => String(r.id ?? '').trim())
      .filter(Boolean)
  }, [
    filteredReservations,
    operationalMetricsSnapshot,
    statisticsReservations,
    groupByDate,
    viewMode,
    weeklyStatsModalOpen,
    statisticsWeekOffset,
    regCancelGranularity,
    regCancelMonthOffset,
    regCancelYearOffset,
  ])

  const { reasonById: cancellationReasonByReservationId, loading: cancellationReasonsLoading } =
    useCancellationReasonByReservationId(cancelledReservationIdsForReasons)

  /** 차트·감사 조회용 활동 ISO 구간 — 연초 YTD 제외(코어 구간만, 감사 스캔 최소화) */
  const regCancelChartAuditIsoRange = useMemo(() => {
    if (!groupByDate) return null
    return computeStatisticsCoreActivityIsoRange({
      statisticsWeekOffset,
      regCancelGranularity,
      regCancelMonthOffset,
      regCancelYearOffset,
    })
  }, [
    groupByDate,
    statisticsWeekOffset,
    regCancelGranularity,
    regCancelMonthOffset,
    regCancelYearOffset,
  ])

  /** 통계·차트 감사 조회 스코프 — 예약 id 청크와 무관, 스코프가 바뀔 때만 캐시 초기화 */
  const regCancelChartAuditScopeKey = useMemo(() => {
    if (!groupByDate || !weeklyStatsModalOpen || viewMode === 'list' || viewMode === 'calendar') {
      return null
    }
    const range = regCancelChartAuditIsoRange
    if (!range) return null
    return [
      range.rangeStartIso,
      range.rangeEndIso,
      selectedStatus,
      selectedChannel,
      `${dateRange.start}\u0001${dateRange.end}`,
      debouncedSearchTerm,
      operatorId ?? '',
    ].join('\u001f')
  }, [
    groupByDate,
    weeklyStatsModalOpen,
    viewMode,
    regCancelChartAuditIsoRange,
    selectedStatus,
    selectedChannel,
    dateRange.start,
    dateRange.end,
    debouncedSearchTerm,
    operatorId,
  ])

  const regCancelChartAuditScopeSignature = regCancelChartAuditScopeKey ?? ''
  const regCancelChartAuditPendingRefetch =
    groupByDate &&
    regCancelChartAuditLoaded &&
    regCancelChartAuditLoadedSignature !== regCancelChartAuditScopeSignature &&
    !statisticsReservationsLoading
  const regCancelChartAuditReady =
    groupByDate &&
    regCancelChartAuditLoaded &&
    (regCancelChartAuditLoadedSignature === regCancelChartAuditScopeSignature ||
      regCancelChartAuditPendingRefetch)

  const simpleCardStatusAuditRowsForRequest = regCancelChartAuditReady
    ? regCancelChartAuditRowsByRecordId
    : undefined

  const regCancelChartDisplayScopeKey = useMemo(() => {
    if (!groupByDate || viewMode === 'list') return null
    return [
      statisticsWeekOffset,
      regCancelGranularity,
      regCancelMonthOffset,
      regCancelYearOffset,
      selectedStatus,
      selectedChannel,
      `${dateRange.start}\u0001${dateRange.end}`,
      debouncedSearchTerm,
    ].join('\u001f')
  }, [
    groupByDate,
    viewMode,
    statisticsWeekOffset,
    regCancelGranularity,
    regCancelMonthOffset,
    regCancelYearOffset,
    selectedStatus,
    selectedChannel,
    dateRange.start,
    dateRange.end,
    debouncedSearchTerm,
  ])

  /** 코어 예약 1차 청크 이후 차트 표시(감사·YTD는 백그라운드 정밀화) */
  const regCancelChartDataReady = useMemo(() => {
    if (!groupByDate || viewMode === 'list') return true
    if (!weeklyStatsModalOpen) return true
    if (!statisticsReservationsLoading) return true
    return statisticsReservations.length > 0
  }, [
    groupByDate,
    viewMode,
    weeklyStatsModalOpen,
    statisticsReservationsLoading,
    statisticsReservations.length,
  ])

  const regCancelChartLoading =
    groupByDate &&
    viewMode !== 'list' &&
    weeklyStatsModalOpen &&
    !regCancelChartDataReady

  const regCancelChartYtdRefining =
    groupByDate &&
    viewMode !== 'list' &&
    weeklyStatsModalOpen &&
    regCancelGranularity === 'week' &&
    statisticsYtdExtensionLoading

  /** Follow-up 큐 모달·배지: 운영 큐/배지 스냅샷이 있으면 그 범위, 없으면 필터된 목록 */
  const reservationsForFollowUpPipeline = useMemo(
    () => pickReservationsForOperationalQueue(operationalMetricsSnapshot, filteredReservations),
    [operationalMetricsSnapshot, filteredReservations]
  )

  /**
   * Follow-up 스냅샷 로드 대상.
   * - 항상 현재 화면(필터·페이지) 예약 포함 → 카드 아이콘 안정
   * - 모달·운영 큐 로드 완료 후 운영 큐 id 추가 병합(로딩 중 id 폭주·취소 방지)
   */
  const reservationsLiteForFollowUp = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; productId: string; status?: string | null; tourStatus?: string | null }
    >()
    const addLite = (r: { id: string; productId: string; status?: string | null }) => {
      const linkedTourId = tourIdByReservationId.get(r.id)
      const tourStatus = linkedTourId ? (tourInfoMap.get(linkedTourId)?.status ?? null) : null
      byId.set(r.id, {
        id: r.id,
        productId: r.productId,
        status: r.status ?? null,
        tourStatus,
      })
    }
    for (const r of filteredReservations) {
      addLite(r)
    }
    const modalOpen = showActionRequiredModal || followUpQueueModalOpen
    if (
      !modalOpen &&
      operationalMetricsSnapshot?.reservations.length
    ) {
      for (const r of operationalMetricsSnapshot.reservations) {
        addLite(r)
      }
    } else if (
      modalOpen &&
      !operationalQueueLoading &&
      operationalQueueHasReservations(operationalQueueSnapshot)
    ) {
      for (const r of operationalQueueSnapshot!.reservations) {
        addLite(r)
      }
    }
    return [...byId.values()]
  }, [
    filteredReservations,
    showActionRequiredModal,
    followUpQueueModalOpen,
    operationalQueueLoading,
    operationalQueueSnapshot,
    operationalMetricsSnapshot,
    tourIdByReservationId,
    tourInfoMap,
  ])

  const followUpRenderedIdsRef = useRef<string[]>([])
  const [followUpPriorityReservationIds, setFollowUpPriorityReservationIds] = useState<string[]>([])
  const followUpVisibleBucketsRef = useRef<Map<string, string[]>>(new Map())
  const handleFollowUpRenderedReservationIds = useCallback((bucketKey: string, ids: string[]) => {
    followUpVisibleBucketsRef.current.set(bucketKey, ids)
    const merged = [...new Set([...followUpVisibleBucketsRef.current.values()].flat())]
    const prev = followUpRenderedIdsRef.current
    if (prev.length === merged.length && prev.every((id, i) => id === merged[i])) return
    followUpRenderedIdsRef.current = merged
    setFollowUpPriorityReservationIds(merged)
  }, [])

  useEffect(() => {
    followUpVisibleBucketsRef.current.clear()
    followUpRenderedIdsRef.current = []
    setFollowUpPriorityReservationIds([])
    toursHydrateAttemptedRef.current.clear()
  }, [
    cardsWeekPage,
    viewMode,
    groupByDate,
    debouncedSearchTerm,
    currentPage,
    itemsPerPage,
    selectedStatus,
    selectedChannel,
    dateRange.start,
    dateRange.end,
  ])

  const {
    snapshotsByReservationId: followUpSnapshotsByReservationId,
    loading: followUpSnapshotsLoading,
    patchCancelManualFlags,
    refreshReservationIds: refreshFollowUpReservationIds,
  } = useReservationFollowUpSnapshots(
    reservationsLiteForFollowUp,
    (products as Array<{ id: string; product_code?: string | null }>) || [],
    followUpPipelineManualRefresh,
    {
      priorityReservationIds: followUpPriorityReservationIds,
      /** 운영 큐 배지 정확도: 스냅샷 로드 후 나머지 id도 idle 배치 조회 */
      loadDeferred: Boolean(operationalMetricsSnapshot?.reservations.length),
    }
  )

  const handleFollowUpPipelineManualChange = useCallback(
    async (reservationId: string, step: FollowUpPipelineStepKey, action: 'mark' | 'clear') => {
      const col =
        step === 'confirmation'
          ? 'confirmation_manual'
          : step === 'resident'
            ? 'resident_manual'
            : step === 'departure'
              ? 'departure_manual'
              : 'pickup_manual'

      const { data: existing, error: selErr } = await supabase
        .from('reservation_follow_up_pipeline_manual')
        .select(
          'confirmation_manual, resident_manual, departure_manual, pickup_manual, cancel_follow_up_manual, cancel_rebooking_outreach_manual'
        )
        .eq('reservation_id', reservationId)
        .maybeSingle()

      if (selErr) {
        console.error(selErr)
        alert(locale === 'ko' ? `저장 실패: ${selErr.message}` : `Save failed: ${selErr.message}`)
        return
      }

      const base = {
        confirmation_manual: !!(existing as { confirmation_manual?: boolean } | null)?.confirmation_manual,
        resident_manual: !!(existing as { resident_manual?: boolean } | null)?.resident_manual,
        departure_manual: !!(existing as { departure_manual?: boolean } | null)?.departure_manual,
        pickup_manual: !!(existing as { pickup_manual?: boolean } | null)?.pickup_manual,
        cancel_follow_up_manual: !!(existing as { cancel_follow_up_manual?: boolean } | null)?.cancel_follow_up_manual,
        cancel_rebooking_outreach_manual: !!(existing as { cancel_rebooking_outreach_manual?: boolean } | null)
          ?.cancel_rebooking_outreach_manual,
      }
      base[col as keyof typeof base] = action === 'mark'

      const anyTrue = Object.values(base).some(Boolean)

      if (!anyTrue) {
        if (existing) {
          const { error } = await supabase
            .from('reservation_follow_up_pipeline_manual')
            .delete()
            .eq('reservation_id', reservationId)
          if (error) {
            console.error(error)
            alert(locale === 'ko' ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`)
            return
          }
        }
      } else {
        const { error } = await supabase.from('reservation_follow_up_pipeline_manual').upsert(
          {
            reservation_id: reservationId,
            ...base,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'reservation_id' }
        )
        if (error) {
          console.error(error)
          alert(locale === 'ko' ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`)
          return
        }
      }

      setFollowUpPipelineManualRefresh((n) => n + 1)
    },
    [locale]
  )

  const handleCancelFollowUpManualChange = useCallback(
    async (reservationId: string, kind: CancelFollowUpManualKind, action: 'mark' | 'clear') => {
      const col =
        kind === 'cancel_follow_up' ? 'cancel_follow_up_manual' : 'cancel_rebooking_outreach_manual'

      const { data: existing, error: selErr } = await supabase
        .from('reservation_follow_up_pipeline_manual')
        .select(
          'confirmation_manual, resident_manual, departure_manual, pickup_manual, cancel_follow_up_manual, cancel_rebooking_outreach_manual'
        )
        .eq('reservation_id', reservationId)
        .maybeSingle()

      if (selErr) {
        console.error(selErr)
        alert(locale === 'ko' ? `저장 실패: ${selErr.message}` : `Save failed: ${selErr.message}`)
        return
      }

      const base = {
        confirmation_manual: !!(existing as { confirmation_manual?: boolean } | null)?.confirmation_manual,
        resident_manual: !!(existing as { resident_manual?: boolean } | null)?.resident_manual,
        departure_manual: !!(existing as { departure_manual?: boolean } | null)?.departure_manual,
        pickup_manual: !!(existing as { pickup_manual?: boolean } | null)?.pickup_manual,
        cancel_follow_up_manual: !!(existing as { cancel_follow_up_manual?: boolean } | null)?.cancel_follow_up_manual,
        cancel_rebooking_outreach_manual: !!(existing as { cancel_rebooking_outreach_manual?: boolean } | null)
          ?.cancel_rebooking_outreach_manual,
      }
      base[col as keyof typeof base] = action === 'mark'

      const anyTrue = Object.values(base).some(Boolean)

      if (!anyTrue) {
        if (existing) {
          const { error } = await supabase
            .from('reservation_follow_up_pipeline_manual')
            .delete()
            .eq('reservation_id', reservationId)
          if (error) {
            console.error(error)
            alert(locale === 'ko' ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`)
            return
          }
        }
      } else {
        const { error } = await supabase.from('reservation_follow_up_pipeline_manual').upsert(
          {
            reservation_id: reservationId,
            ...base,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'reservation_id' }
        )
        if (error) {
          console.error(error)
          alert(locale === 'ko' ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`)
          return
        }
      }

      patchCancelManualFlags(
        reservationId,
        base.cancel_follow_up_manual,
        base.cancel_rebooking_outreach_manual
      )
      setFollowUpPipelineManualRefresh((n) => n + 1)
      void refreshCancelReasonQueueStats()
      dispatchCancelRebookingFollowUpRefresh()
    },
    [locale, patchCancelManualFlags, refreshCancelReasonQueueStats]
  )

  const followUpQueueUnionCount = useMemo(() => {
    let n = 0
    for (const r of reservationsForHeaderBadges) {
      if (isReservationTourDatePastLocal(r.tourDate)) continue
      const snap = followUpSnapshotsByReservationId.get(r.id)
      if (!snap) continue
      const cancelReason = cancellationReasonByReservationId.get(String(r.id)) ?? null
      if (
        reservationNeedsCancelFollowUpQueueAttention(
          r.status as string | undefined,
          r.tourDate,
          snap,
          cancelReason
        )
      ) {
        n += 1
        continue
      }
      if (reservationNeedsAnyFollowUpAttention(r.status as string | undefined, snap)) n += 1
    }
    return n
  }, [
    reservationsForHeaderBadges,
    followUpSnapshotsByReservationId,
    cancellationReasonByReservationId,
  ])

  /** 운영 큐 배지 스냅샷·결제·Follow-up 스냅샷이 모두 준비된 뒤에만 헤더 숫자 표시 */
  const operationalBadgeFetchSettled = operationalListReadyForBadge && !operationalBadgeLoading
  const operationalHeaderCountsReady =
    operationalBadgeFetchSettled &&
    operationalPaymentsReadyKey === operationalPaymentScopeKey &&
    !followUpSnapshotsLoading &&
    !cancellationReasonsLoading
  const headerActionRequiredCount = operationalHeaderCountsReady ? actionRequiredCount : 0
  const headerFollowUpQueueCount = operationalHeaderCountsReady ? followUpQueueUnionCount : 0
  
  // 최근 7일: 브라우저 로컬 달력 기준 오늘을 말일로 한 7일 — 등록일 그룹 키·조회 구간과 동일.
  const formatWeekRange = useCallback(
    (weekOffset: number) => {
      const { startYmd, endYmd } = browserLocalWeekRangeFromOffset(weekOffset)
      const localeTag = locale === 'en' ? 'en-US' : 'ko-KR'
      return {
        start: startYmd,
        end: endYmd,
        display: formatBrowserLocalYmdRangeDisplay(startYmd, endYmd, localeTag),
      }
    },
    [locale]
  )

  const mergeReservationListSideDataPrefetch = useCallback(async (rows: Record<string, unknown>[] | null) => {
    const ids = (rows || [])
      .map((r) =>
        r && typeof r === 'object' && 'id' in r ? String((r as { id: unknown }).id ?? '').trim() : ''
      )
      .filter(Boolean)
    if (ids.length === 0) return
    try {
      const m = await prefetchAdminReservationCardSideData(
        supabase,
        ids,
        choicesCacheRef,
        fetchChoicesBatch
      )
      setResidentCustomerBatchMap((prev) => new Map([...prev, ...m]))
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[admin reservations] card side merge prefetch failed:', e)
      }
    }
  }, [fetchChoicesBatch])

  /** skipHeavySideMaps 이후에도 pricing 재조회 폭주를 막기 위한 시도 집합 */
  const pricingHydrateAttemptedRef = useRef(new Set<string>())
  /** skipHeavySideMaps 이후 tours 맵 보완 시도 집합 */
  const toursHydrateAttemptedRef = useRef(new Set<string>())

  /** 첫 paint 직후: 가상화 onRendered 전에 pricing/choices hydrate를 시드하고 side prefetch는 비차단 */
  const seedFirstPaintSideHydrate = useCallback(
    (rows: Record<string, unknown>[]) => {
      const ids = rows
        .map((r) =>
          r && typeof r === 'object' && 'id' in r ? String((r as { id: unknown }).id ?? '').trim() : ''
        )
        .filter(Boolean)
        .slice(0, 48)
      if (ids.length === 0) return
      seedChoicesCacheRefFromMemory(ids, choicesCacheRef)
      handleFollowUpRenderedReservationIds('first-paint-seed', ids)
      void mergeReservationListSideDataPrefetch(rows.slice(0, 80))
    },
    [handleFollowUpRenderedReservationIds, mergeReservationListSideDataPrefetch]
  )

  useEffect(() => {
    hookReservationPricingMap.forEach((_, id) => {
      pricingHydrateAttemptedRef.current.add(id)
    })
  }, [hookReservationPricingMap])

  /**
   * 가상화로 화면에 올라온 카드: 초이스 + pricing + options presence 누락분만 배치 보완
   * (백그라운드 청크는 skipHeavySideMaps로 행만 먼저 붙임)
   */
  useEffect(() => {
    if (followUpPriorityReservationIds.length === 0) return
    if (serverListLoading || adminListChunkProgress) return
    const missingChoices = followUpPriorityReservationIds.filter(
      (id) => !choicesCacheRef.current.has(id)
    )
    const missingPricing = followUpPriorityReservationIds.filter(
      (id) => !pricingHydrateAttemptedRef.current.has(id)
    )
    const missingOptions = followUpPriorityReservationIds.filter(
      (id) => !hookReservationOptionsPresenceByReservationId.has(id)
    )
    const missingTours = followUpPriorityReservationIds.filter(
      (id) => !toursHydrateAttemptedRef.current.has(id)
    )
    if (
      missingChoices.length === 0 &&
      missingPricing.length === 0 &&
      missingOptions.length === 0 &&
      missingTours.length === 0
    ) {
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const tasks: Promise<unknown>[] = []
          if (missingChoices.length > 0) {
            tasks.push(
              prefetchAdminReservationCardSideData(
                supabase,
                missingChoices,
                choicesCacheRef,
                fetchChoicesBatch
              ).then((m) => {
                if (!cancelled) {
                  setResidentCustomerBatchMap((prev) => new Map([...prev, ...m]))
                }
              })
            )
          }
          if (missingPricing.length > 0) {
            for (const id of missingPricing) {
              pricingHydrateAttemptedRef.current.add(id)
            }
            tasks.push(refreshReservationPricingForIds(missingPricing))
          }
          if (missingOptions.length > 0) {
            tasks.push(refreshReservationOptionsPresenceForIds(missingOptions))
          }
          if (missingTours.length > 0) {
            for (const id of missingTours) {
              toursHydrateAttemptedRef.current.add(id)
            }
            tasks.push(refreshToursMapForReservationIds(missingTours))
          }
          await Promise.all(tasks)
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[admin reservations] visible card side hydrate failed:', e)
          }
        }
      })()
    }, 80)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    followUpPriorityReservationIds,
    serverListLoading,
    adminListChunkProgress,
    fetchChoicesBatch,
    hookReservationOptionsPresenceByReservationId,
    refreshReservationPricingForIds,
    refreshReservationOptionsPresenceForIds,
    refreshToursMapForReservationIds,
  ])

  /**
   * card-week/calendar: 가시 카드 외 행도 idle에 pricing/options를 채워
   * 스크롤 시 가격 깜빡임을 줄인다.
   */
  useEffect(() => {
    const usesDeferredSideMaps =
      viewMode === 'calendar' || (viewMode !== 'list' && groupByDate)
    if (!usesDeferredSideMaps || serverListLoading) return

    let cancelled = false
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null

    const schedule = (fn: () => void) => {
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        cancelIdleCallback?: (id: number) => void
      }
      if (typeof w.requestIdleCallback === 'function') {
        idleHandle = w.requestIdleCallback(fn, { timeout: 1200 })
      } else {
        timeoutHandle = window.setTimeout(fn, 250)
      }
    }

    const tick = () => {
      if (cancelled) return
      if (serverListLoading || adminListChunkProgress) {
        schedule(tick)
        return
      }
      const missingPricing = reservations
        .map((r) => r.id)
        .filter((id) => id && !pricingHydrateAttemptedRef.current.has(id))
        .slice(0, 80)
      const missingOptions = reservations
        .map((r) => r.id)
        .filter((id) => id && !hookReservationOptionsPresenceByReservationId.has(id))
        .slice(0, 80)
      const missingTours = reservations
        .map((r) => r.id)
        .filter((id) => id && !toursHydrateAttemptedRef.current.has(id))
        .slice(0, 80)
      if (
        missingPricing.length === 0 &&
        missingOptions.length === 0 &&
        missingTours.length === 0
      ) {
        return
      }

      void (async () => {
        try {
          const tasks: Promise<unknown>[] = []
          if (missingPricing.length > 0) {
            for (const id of missingPricing) {
              pricingHydrateAttemptedRef.current.add(id)
            }
            tasks.push(refreshReservationPricingForIds(missingPricing))
          }
          if (missingOptions.length > 0) {
            tasks.push(refreshReservationOptionsPresenceForIds(missingOptions))
          }
          if (missingTours.length > 0) {
            for (const id of missingTours) {
              toursHydrateAttemptedRef.current.add(id)
            }
            tasks.push(refreshToursMapForReservationIds(missingTours))
          }
          await Promise.all(tasks)
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[admin reservations] idle side hydrate failed:', e)
          }
        }
        if (!cancelled) schedule(tick)
      })()
    }

    schedule(tick)

    return () => {
      cancelled = true
      const w = window as Window & { cancelIdleCallback?: (id: number) => void }
      if (idleHandle != null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle != null) window.clearTimeout(timeoutHandle)
    }
  }, [
    reservations,
    serverListLoading,
    adminListChunkProgress,
    viewMode,
    groupByDate,
    hookReservationOptionsPresenceByReservationId,
    refreshReservationPricingForIds,
    refreshReservationOptionsPresenceForIds,
    refreshToursMapForReservationIds,
  ])

  const reservationsPageLoadingProgress = useMemo(() => {
    if (adminListChunkProgress) {
      const t = adminListChunkProgress.total ?? adminListChunkProgress.loaded
      return {
        current: adminListChunkProgress.loaded,
        total: Math.max(t, 1),
      }
    }
    return loadingProgress
  }, [adminListChunkProgress, loadingProgress])

  const loadAdminReservationList = useCallback(async () => {
    adminCardWeekFetchGenRef.current += 1
    const fetchGen = adminCardWeekFetchGenRef.current
    pricingHydrateAttemptedRef.current.clear()
    toursHydrateAttemptedRef.current.clear()
    if (reservationsListRef.current.length === 0) {
      setServerListLoading(true)
    }
    setAdminListChunkProgress(null)
    const selectedStatus = listQueryFilters.selectedStatus
    const selectedChannel = listQueryFilters.selectedChannel
    const dateRange = listQueryFilters.dateRange
    try {
      const cardsWR = browserLocalWeekRangeFromOffset(cardsWeekPage)
      /** 카드 주간(7일)만 — 통계 코어 구간은 `loadStatisticsReservations`, YTD 평균선은 RPC */
      const rangeStartIso = cardsWR.rangeStartIso
      const rangeEndIso = cardsWR.rangeEndIso

      if (viewMode === 'calendar') {
        const calWindow = browserLocalCalendarViewWindow(calendarMonthOffset)
        const calCacheKey = buildAdminReservationCalendarCacheKey({
          operatorId,
          monthOffset: calendarMonthOffset,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
        })
        const cachedCal = readAdminReservationCalendarCache(calCacheKey)
        if (cachedCal) {
          seedFirstPaintSideHydrate(cachedCal.data)
          if (fetchGen !== adminCardWeekFetchGenRef.current) return
          await replaceReservationsFromQueryResultRef.current(cachedCal.data, {
            skipLoadingFlags: true,
            skipHeavySideMaps: true,
            listProgress: {
              current: cachedCal.data.length,
              total: cachedCal.count,
            },
          })
          setServerListTotal(cachedCal.count ?? cachedCal.data.length)
          setServerListLoading(false)
        }

        const calArgs = {
          mode: 'calendar' as const,
          page: 1,
          pageSize: 20,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
          sortBy,
          sortOrder,
          operatorId,
          calendarTourDateStart: calWindow.startYmd,
          calendarTourDateEnd: calWindow.endYmd,
          calendarCreatedStartIso: calWindow.rangeStartIso,
          calendarCreatedEndIso: calWindow.rangeEndIso,
        }
        let firstPaintDone = !!cachedCal
        const hydrationBatch = createAdminListHydrationBatch({
          isCurrent: () => fetchGen === adminCardWeekFetchGenRef.current,
          mergePrefetch: async (rows) => {
            void mergeReservationListSideDataPrefetch(rows)
          },
          mergeHydrate: async (rows, listProgress) => {
            await mergeMoreReservationsFromQueryResultRef.current(rows, {
              skipLoadingFlags: true,
              skipHeavySideMaps: true,
              listProgress,
            })
            setServerListTotal(listProgress.total ?? listProgress.current)
          },
        })
        try {
          const { error: progError, loadedRowCount } = await fetchAdminReservationListCalendarProgressive(
            supabase,
            calArgs,
            {
              onProgress: ({ loaded, total }) => {
                if (fetchGen !== adminCardWeekFetchGenRef.current) return
                setAdminListChunkProgress({ loaded, total })
              },
              onFirstChunk: async ({ rows, totalCount }) => {
                if (fetchGen !== adminCardWeekFetchGenRef.current) return false
                if (rows.length === 0) {
                  if (!firstPaintDone) {
                    await replaceReservationsFromQueryResultRef.current([], { skipLoadingFlags: true })
                    setResidentCustomerBatchMap(new Map())
                    setServerListTotal(totalCount ?? 0)
                    setServerListLoading(false)
                    firstPaintDone = true
                  }
                  return true
                }
                seedFirstPaintSideHydrate(rows)
                await replaceReservationsFromQueryResultRef.current(rows, {
                  skipLoadingFlags: true,
                  skipHeavySideMaps: true,
                  listProgress: { current: rows.length, total: totalCount },
                })
                setServerListTotal(totalCount ?? rows.length)
                setServerListLoading(false)
                firstPaintDone = true
                writeAdminReservationCalendarCache(calCacheKey, {
                  data: rows,
                  count: totalCount ?? rows.length,
                })
                return true
              },
              onAdditionalChunk: async ({ rows, mergedLoaded, totalCount }) => {
                if (fetchGen !== adminCardWeekFetchGenRef.current) return false
                if (rows.length === 0) return true
                await hydrationBatch.enqueue(rows, {
                  current: mergedLoaded,
                  total: totalCount,
                })
                return true
              },
            }
          )
          await hydrationBatch.flush()
          if (progError) throw progError
          if (!firstPaintDone) {
            setServerListTotal(loadedRowCount)
            setServerListLoading(false)
          }
        } finally {
          await hydrationBatch.flush()
          hydrationBatch.dispose()
        }

        void prefetchAdminReservationCalendarAdjacentSnapshots(supabase, {
          operatorId,
          currentMonthOffset: calendarMonthOffset,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
          sortBy,
          sortOrder,
        })
        return
      }

      if (viewMode === 'list') {
        const listCacheKey = buildAdminReservationListPageCacheKey({
          operatorId,
          page: currentPage,
          pageSize: itemsPerPage,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
          sortBy: 'created_at',
          sortOrder: 'desc',
        })
        const cachedPage = readAdminReservationListPageCache(listCacheKey)
        if (cachedPage) {
          seedFirstPaintSideHydrate(cachedPage.data)
          if (fetchGen !== adminCardWeekFetchGenRef.current) return
          await replaceReservationsFromQueryResultRef.current(cachedPage.data, {
            skipLoadingFlags: true,
            skipHeavySideMaps: true,
          })
          setServerListTotal(cachedPage.count ?? cachedPage.data.length)
          setServerListLoading(false)
        }

        const { data, count, error } = await fetchAdminReservationList(supabase, {
          mode: 'card-flat',
          page: currentPage,
          pageSize: itemsPerPage,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
          sortBy: 'created_at',
          sortOrder: 'desc',
          operatorId,
        })
        if (error) throw error
        if (fetchGen !== adminCardWeekFetchGenRef.current) return
        const rows = (data || []) as Record<string, unknown>[]
        writeAdminReservationListPageCache(listCacheKey, {
          data: rows,
          count: count ?? null,
        })
        seedFirstPaintSideHydrate(rows)
        await replaceReservationsFromQueryResultRef.current(rows, {
          skipLoadingFlags: true,
          skipHeavySideMaps: true,
        })
        setServerListTotal(count ?? 0)
        void prefetchAdminReservationListAdjacentPage(supabase, {
          operatorId,
          page: currentPage,
          pageSize: itemsPerPage,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
          sortBy: 'created_at',
          sortOrder: 'desc',
          count: count ?? null,
          loadedRowCount: rows.length,
        })
        return
      }

      const cardArgs = {
        mode: (groupByDate ? 'card-week' : 'card-flat') as 'card-week' | 'card-flat',
        page: currentPage,
        pageSize: itemsPerPage,
        selectedStatus,
        selectedChannel,
        dateRange,
        customerIdFromUrl,
        debouncedSearchTerm,
        sortBy,
        sortOrder,
        operatorId,
        ...(groupByDate
          ? { activityRangeStartIso: rangeStartIso, activityRangeEndIso: rangeEndIso }
          : {}),
      }
      if (cardArgs.mode === 'card-week' && !debouncedSearchTerm.trim()) {
        const recentGteIso = browserLocalCreatedAtGteIsoForRecentCalendarDays(
          ADMIN_RESERVATION_CARD_WEEK_RECENT_REGISTERED_DAYS
        )
        const weekCacheKey = buildAdminReservationCardWeekCacheKey({
          operatorId,
          weekOffset: cardsWeekPage,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
        })
        const cachedWeek = readAdminReservationCardWeekCache(weekCacheKey)
        if (cachedWeek) {
          seedFirstPaintSideHydrate(cachedWeek.data)
          if (fetchGen !== adminCardWeekFetchGenRef.current) return
          await replaceReservationsFromQueryResultRef.current(cachedWeek.data, {
            skipLoadingFlags: true,
            skipHeavySideMaps: true,
            listProgress: {
              current: cachedWeek.data.length,
              total: cachedWeek.count,
            },
          })
          setServerListTotal(cachedWeek.count ?? cachedWeek.data.length)
          setServerListLoading(false)
        }

        let totalForProgress: number | null = cachedWeek?.count ?? null
        const countPromise = fetchAdminReservationListActivityWindowRowCount(supabase, cardArgs).then(
          (result) => {
            if (fetchGen !== adminCardWeekFetchGenRef.current) return result
            if (!result.error && result.count != null) {
              totalForProgress = result.count
              setAdminListChunkProgress((prev) =>
                prev
                  ? { loaded: prev.loaded, total: result.count ?? prev.loaded }
                  : null
              )
              setServerListTotal((prev) => (prev > 0 ? prev : result.count ?? prev))
            }
            return result
          }
        )

        let tierBaseLoaded = 0
        let firstPaintDone = !!cachedWeek
        const hydrationBatch = createAdminListHydrationBatch({
          isCurrent: () => fetchGen === adminCardWeekFetchGenRef.current,
          // choices/고객 prefetch는 본문 완료를 막지 않음 (flush가 끝나야 finally가 돈다)
          mergePrefetch: async (rows) => {
            void mergeReservationListSideDataPrefetch(rows)
          },
          mergeHydrate: async (rows, listProgress) => {
            await mergeMoreReservationsFromQueryResultRef.current(rows, {
              skipLoadingFlags: true,
              skipHeavySideMaps: true,
              listProgress,
            })
            setServerListTotal(totalForProgress ?? listProgress.total ?? listProgress.current)
          },
        })

        try {
          for (const tier of ['tier1_recent_modern', 'tier2_older_modern', 'tier3_legacy_tour'] as const) {
            const tierArgs = {
              ...cardArgs,
              cardWeekLoadTier: tier,
              ...(tier === 'tier3_legacy_tour' ? {} : { cardWeekRecentCreatedGteIso: recentGteIso }),
            }
            const { error: progError, loadedRowCount } = await fetchAdminReservationListCardWeekProgressive(
              supabase,
              tierArgs,
              {
                onProgress: (info) => {
                  if (fetchGen !== adminCardWeekFetchGenRef.current) return
                  setAdminListChunkProgress({
                    loaded: tierBaseLoaded + info.loaded,
                    total: totalForProgress ?? tierBaseLoaded + info.loaded,
                  })
                },
                onFirstChunk: async ({ rows, totalCount: tierTotal }) => {
                  if (fetchGen !== adminCardWeekFetchGenRef.current) return false
                  if (rows.length === 0) {
                    // tier1·2가 비어 있어도 tier3에 데이터가 있을 수 있음 — 조기 빈 목록 방지
                    const resolvedTotal = totalForProgress ?? tierTotal ?? 0
                    if (
                      !firstPaintDone &&
                      tier === 'tier3_legacy_tour' &&
                      resolvedTotal === 0
                    ) {
                      await replaceReservationsFromQueryResultRef.current([], { skipLoadingFlags: true })
                      setResidentCustomerBatchMap(new Map())
                      setServerListTotal(0)
                      setServerListLoading(false)
                      firstPaintDone = true
                    }
                    return true
                  }
                  if (!firstPaintDone) {
                    seedFirstPaintSideHydrate(rows)
                    await replaceReservationsFromQueryResultRef.current(rows, {
                      skipLoadingFlags: true,
                      skipHeavySideMaps: true,
                      listProgress: {
                        current: tierBaseLoaded + rows.length,
                        total: totalForProgress ?? tierTotal,
                      },
                    })
                    setServerListTotal(totalForProgress ?? tierTotal ?? rows.length)
                    setServerListLoading(false)
                    firstPaintDone = true
                    writeAdminReservationCardWeekCache(weekCacheKey, {
                      data: rows,
                      count: totalForProgress ?? tierTotal ?? rows.length,
                    })
                  } else if (cachedWeek && tier === 'tier1_recent_modern') {
                    // 캐시로 이미 paint — 첫 청크는 최신으로 교체
                    seedFirstPaintSideHydrate(rows)
                    await replaceReservationsFromQueryResultRef.current(rows, {
                      skipLoadingFlags: true,
                      skipHeavySideMaps: true,
                      listProgress: {
                        current: tierBaseLoaded + rows.length,
                        total: totalForProgress ?? tierTotal,
                      },
                    })
                    setServerListTotal(totalForProgress ?? tierTotal ?? rows.length)
                    writeAdminReservationCardWeekCache(weekCacheKey, {
                      data: rows,
                      count: totalForProgress ?? tierTotal ?? rows.length,
                    })
                  } else {
                    await hydrationBatch.enqueue(rows, {
                      current: tierBaseLoaded + rows.length,
                      total: totalForProgress ?? tierTotal,
                    })
                  }
                  return true
                },
                onAdditionalChunk: async ({ rows, mergedLoaded, totalCount: tierTotal }) => {
                  if (fetchGen !== adminCardWeekFetchGenRef.current) return false
                  if (rows.length === 0) return true
                  await hydrationBatch.enqueue(rows, {
                    current: tierBaseLoaded + mergedLoaded,
                    total: totalForProgress ?? tierTotal,
                  })
                  return true
                },
              }
            )
            await hydrationBatch.flush()
            tierBaseLoaded += loadedRowCount ?? 0
            if (progError) throw progError
          }
        } finally {
          await hydrationBatch.flush()
          hydrationBatch.dispose()
        }

        // count RPC/head count가 지연·중단돼도 본문 finally가 막히지 않게 비동기로만 반영
        void countPromise.then((result) => {
          if (fetchGen !== adminCardWeekFetchGenRef.current) return
          if (result.error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[admin reservations] activity window count failed:', result.error)
            }
            return
          }
          if (result.count != null) {
            setServerListTotal(result.count)
          }
        })

        if (!firstPaintDone) {
          await replaceReservationsFromQueryResultRef.current([], { skipLoadingFlags: true })
          setResidentCustomerBatchMap(new Map())
          setServerListTotal(totalForProgress ?? tierBaseLoaded)
          setServerListLoading(false)
        }

        void prefetchAdminReservationCardWeekAdjacentSnapshots(supabase, {
          operatorId,
          currentWeekOffset: cardsWeekPage,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
          sortBy,
          sortOrder,
          weekRangeForOffset: browserLocalWeekRangeFromOffset,
        })
      } else if (cardArgs.mode === 'card-week') {
        const hydrationBatch = createAdminListHydrationBatch({
          isCurrent: () => fetchGen === adminCardWeekFetchGenRef.current,
          mergePrefetch: async (rows) => {
            void mergeReservationListSideDataPrefetch(rows)
          },
          mergeHydrate: async (rows, listProgress) => {
            await mergeMoreReservationsFromQueryResultRef.current(rows, {
              skipLoadingFlags: true,
              skipHeavySideMaps: true,
              listProgress,
            })
            setServerListTotal(listProgress.total ?? listProgress.current)
          },
        })
        try {
          const { error: progError } = await fetchAdminReservationListCardWeekProgressive(supabase, cardArgs, {
            onProgress: (info) => {
              if (fetchGen !== adminCardWeekFetchGenRef.current) return
              setAdminListChunkProgress({ loaded: info.loaded, total: info.total })
            },
            onFirstChunk: async ({ rows, totalCount }) => {
              if (fetchGen !== adminCardWeekFetchGenRef.current) return false
              if (rows.length === 0) {
                await replaceReservationsFromQueryResultRef.current([], { skipLoadingFlags: true })
                setResidentCustomerBatchMap(new Map())
                setServerListTotal(totalCount ?? 0)
                setServerListLoading(false)
                return true
              }
              seedFirstPaintSideHydrate(rows)
              await replaceReservationsFromQueryResultRef.current(rows, {
                skipLoadingFlags: true,
                skipHeavySideMaps: true,
                listProgress: { current: rows.length, total: totalCount },
              })
              setServerListTotal(totalCount ?? rows.length)
              setServerListLoading(false)
              return true
            },
            onAdditionalChunk: async ({ rows, mergedLoaded, totalCount }) => {
              if (fetchGen !== adminCardWeekFetchGenRef.current) return false
              if (rows.length === 0) return true
              await hydrationBatch.enqueue(rows, {
                current: mergedLoaded,
                total: totalCount,
              })
              return true
            },
          })
          if (progError) throw progError
        } finally {
          await hydrationBatch.flush()
          hydrationBatch.dispose()
        }
      } else {
        const flatCacheKey = buildAdminReservationListPageCacheKey({
          operatorId,
          page: currentPage,
          pageSize: itemsPerPage,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
          sortBy,
          sortOrder,
        })
        const cachedFlat = readAdminReservationListPageCache(flatCacheKey)
        if (cachedFlat) {
          seedFirstPaintSideHydrate(cachedFlat.data)
          if (fetchGen !== adminCardWeekFetchGenRef.current) return
          await replaceReservationsFromQueryResultRef.current(cachedFlat.data, {
            skipLoadingFlags: true,
            skipHeavySideMaps: true,
          })
          setServerListTotal(cachedFlat.count ?? cachedFlat.data.length)
          setServerListLoading(false)
        }

        const { data, count, error } = await fetchAdminReservationList(supabase, cardArgs)
        if (error) throw error
        if (fetchGen !== adminCardWeekFetchGenRef.current) return
        const rows = (data || []) as Record<string, unknown>[]
        writeAdminReservationListPageCache(flatCacheKey, {
          data: rows,
          count: count ?? null,
        })
        seedFirstPaintSideHydrate(rows)
        await replaceReservationsFromQueryResultRef.current(rows, {
          skipLoadingFlags: true,
          skipHeavySideMaps: true,
        })
        setServerListTotal(count ?? 0)
        void prefetchAdminReservationListAdjacentPage(supabase, {
          operatorId,
          page: currentPage,
          pageSize: itemsPerPage,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
          sortBy,
          sortOrder,
          count: count ?? null,
          loadedRowCount: rows.length,
        })
      }
    } catch (e) {
      // Strict Mode·탭 전환·필터 변경 등으로 이전 요청이 Abort된 경우 — 목록을 비우지 않고 무시
      if (isAbortLikeError(e)) {
        return
      }
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
      if (msg.includes('AbortError') || msg.includes('aborted')) {
        return
      }
      console.error(`loadAdminReservationList: ${describeError(e)}`, serializeError(e))
      setResidentCustomerBatchMap(new Map())
      await replaceReservationsFromQueryResultRef.current([], { skipLoadingFlags: true })
      setServerListTotal(0)
    } finally {
      if (fetchGen === adminCardWeekFetchGenRef.current) {
        setAdminListChunkProgress(null)
        setServerListLoading(false)
      }
    }
  }, [
    cardsWeekPage,
    viewMode,
    groupByDate,
    currentPage,
    itemsPerPage,
    listQueryFilters,
    customerIdFromUrl,
    debouncedSearchTerm,
    sortBy,
    sortOrder,
    calendarMonthOffset,
    operatorId,
    mergeReservationListSideDataPrefetch,
    seedFirstPaintSideHydrate,
  ])

  const mapStatisticsRawRows = useCallback((rows: Record<string, unknown>[]) => {
    return mapDbReservationRowsToReservations(rows, new Map(), new Map())
  }, [])

  const mergeStatisticsReservations = useCallback((incoming: Reservation[]) => {
    if (incoming.length === 0) return
    setStatisticsReservations((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]))
      for (const r of incoming) byId.set(r.id, r)
      return [...byId.values()]
    })
  }, [])

  const loadStatisticsReservations = useCallback(async () => {
    if (!weeklyStatsModalOpen || !groupByDate || viewMode === 'list' || viewMode === 'calendar') {
      setStatisticsReservationsLoading(false)
      return
    }

    statisticsFetchGenRef.current += 1
    const fetchGen = statisticsFetchGenRef.current

    const coreRange = computeStatisticsCoreActivityIsoRange({
      statisticsWeekOffset,
      regCancelGranularity,
      regCancelMonthOffset,
      regCancelYearOffset,
    })
    const statsCacheKey = buildAdminReservationStatsCoreCacheKey({
      operatorId,
      rangeStartIso: coreRange.rangeStartIso,
      rangeEndIso: coreRange.rangeEndIso,
      selectedStatus,
      selectedChannel,
      dateRange,
      customerIdFromUrl,
      debouncedSearchTerm,
    })
    const cachedStatsRows = readAdminReservationStatsCoreCache(statsCacheKey)
    if (cachedStatsRows && cachedStatsRows.length > 0) {
      setStatisticsReservations(mapStatisticsRawRows(cachedStatsRows))
      setStatisticsReservationsLoading(false)
    } else {
      setStatisticsReservations([])
      setStatisticsReservationsLoading(true)
    }

    const statsBaseArgs = {
      mode: 'card-week' as const,
      page: 1,
      pageSize: 20,
      selectedStatus,
      selectedChannel,
      dateRange,
      customerIdFromUrl,
      debouncedSearchTerm,
      sortBy,
      sortOrder,
      operatorId,
      selectFieldsOverride: RESERVATION_STATS_SELECT,
      includeExactCount: false,
    }

    const accumulatedRaw: Record<string, unknown>[] = []

    const runProgressiveFetch = async (
      rangeStartIso: string,
      rangeEndIso: string,
      onChunk: (reservations: Reservation[]) => void
    ) => {
      const { error } = await fetchAdminReservationListCardWeekProgressive(
        supabase,
        {
          ...statsBaseArgs,
          activityRangeStartIso: rangeStartIso,
          activityRangeEndIso: rangeEndIso,
        },
        {
          onFirstChunk: async ({ rows }) => {
            if (fetchGen !== statisticsFetchGenRef.current) return false
            accumulatedRaw.push(...rows)
            onChunk(mapStatisticsRawRows(rows))
            return true
          },
          onAdditionalChunk: async ({ rows }) => {
            if (fetchGen !== statisticsFetchGenRef.current) return false
            accumulatedRaw.push(...rows)
            onChunk(mapStatisticsRawRows(rows))
            return true
          },
        }
      )
      if (error) throw error
    }

    try {
      // 캐시로 이미 그린 경우: 네트워크 첫 청크로 교체한 뒤 추가 청크는 병합
      let replacedFromNetwork = false
      const mergeOrReplace = (incoming: Reservation[]) => {
        if (!replacedFromNetwork) {
          replacedFromNetwork = true
          setStatisticsReservations(incoming)
          return
        }
        mergeStatisticsReservations(incoming)
      }

      await runProgressiveFetch(
        coreRange.rangeStartIso,
        coreRange.rangeEndIso,
        mergeOrReplace
      )
      if (fetchGen !== statisticsFetchGenRef.current) return
      writeAdminReservationStatsCoreCache(statsCacheKey, accumulatedRaw)
      setStatisticsReservationsLoading(false)
      void prefetchAdminReservationStatsCoreAdjacent(supabase, {
        operatorId,
        statisticsWeekOffset,
        regCancelGranularity,
        regCancelMonthOffset,
        regCancelYearOffset,
        selectedStatus,
        selectedChannel,
        dateRange,
        customerIdFromUrl,
        debouncedSearchTerm,
        sortBy,
        sortOrder,
      })
    } catch (e) {
      if (isAbortLikeError(e)) return
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
      if (msg.includes('AbortError') || msg.includes('aborted')) return
      if (process.env.NODE_ENV === 'development') {
        console.warn('[admin reservations] statistics reservations load failed:', e)
      }
      if (fetchGen === statisticsFetchGenRef.current) {
        if (!cachedStatsRows) setStatisticsReservations([])
        setStatisticsReservationsLoading(false)
      }
    }
  }, [
    weeklyStatsModalOpen,
    groupByDate,
    viewMode,
    statisticsWeekOffset,
    regCancelGranularity,
    regCancelMonthOffset,
    regCancelYearOffset,
    selectedStatus,
    selectedChannel,
    dateRange,
    customerIdFromUrl,
    debouncedSearchTerm,
    sortBy,
    sortOrder,
    operatorId,
    mapStatisticsRawRows,
    mergeStatisticsReservations,
  ])

  const ytdWeekdayAvgScopeKey = useMemo(() => {
    if (!weeklyStatsModalOpen || regCancelGranularity !== 'week') return null
    if (!groupByDate || viewMode === 'list' || viewMode === 'calendar') return null
    return [
      selectedStatus,
      selectedChannel,
      `${dateRange.start}\u0001${dateRange.end}`,
      debouncedSearchTerm,
      customerIdFromUrl ?? '',
      operatorId ?? '',
      browserLocalTodayYmd().slice(0, 4),
      browserLocalYesterdayYmd(),
    ].join('\u001f')
  }, [
    weeklyStatsModalOpen,
    regCancelGranularity,
    groupByDate,
    viewMode,
    selectedStatus,
    selectedChannel,
    dateRange.start,
    dateRange.end,
    debouncedSearchTerm,
    customerIdFromUrl,
    operatorId,
  ])

  useEffect(() => {
    const scope = ytdWeekdayAvgScopeKey
    if (!scope) {
      setYtdWeekdayAvgRpc(null)
      setStatisticsYtdExtensionLoading(false)
      return
    }

    const gen = ++ytdWeekdayAvgFetchGenRef.current
    setStatisticsYtdExtensionLoading(true)

    void fetchAdminRegCancelYtdWeekdayAvg(supabase, {
      selectedStatus,
      selectedChannel,
      dateRange,
      customerIdFromUrl,
      debouncedSearchTerm,
      operatorId,
    }).then(({ data, error, usedRpc }) => {
      if (gen !== ytdWeekdayAvgFetchGenRef.current) return
      if (error && process.env.NODE_ENV === 'development') {
        console.warn('[admin reservations] YTD weekday avg RPC failed:', error)
      }
      if (!usedRpc && process.env.NODE_ENV === 'development') {
        console.warn(
          '[admin reservations] admin_reg_cancel_ytd_weekday_avg RPC unavailable — apply migration for YTD average line'
        )
      }
      setYtdWeekdayAvgRpc(data)
      setStatisticsYtdExtensionLoading(false)
    })

    return () => {
      ytdWeekdayAvgFetchGenRef.current += 1
    }
  }, [
    ytdWeekdayAvgScopeKey,
    selectedStatus,
    selectedChannel,
    dateRange,
    customerIdFromUrl,
    debouncedSearchTerm,
    operatorId,
  ])

  const weekRegRollupRange = useMemo(() => {
    if (!weeklyStatsModalOpen || regCancelGranularity !== 'week') return null
    if (!groupByDate || viewMode === 'list' || viewMode === 'calendar') return null
    return browserLocalWeekRangeFromOffset(statisticsWeekOffset)
  }, [
    weeklyStatsModalOpen,
    regCancelGranularity,
    groupByDate,
    viewMode,
    statisticsWeekOffset,
  ])

  useEffect(() => {
    const range = weekRegRollupRange
    if (!range) {
      setWeekRegRollupByYmd(null)
      return
    }

    const gen = ++weekRegRollupFetchGenRef.current
    void fetchAdminRegCancelWeekDailyRegistered(supabase, {
      operatorId,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
      selectedStatus,
      selectedChannel,
      dateRange,
      customerIdFromUrl,
      debouncedSearchTerm,
    }).then(({ data, usedRpc }) => {
      if (gen !== weekRegRollupFetchGenRef.current) return
      if (!usedRpc && process.env.NODE_ENV === 'development') {
        console.warn(
          '[admin reservations] admin_reg_cancel_week_daily_registered RPC unavailable — using reservation scan for registrations'
        )
      }
      setWeekRegRollupByYmd(data.size > 0 ? data : null)
      void prefetchAdminRegCancelWeekDailyRegisteredAdjacent(supabase, {
        operatorId,
        currentWeekOffset: statisticsWeekOffset,
        selectedStatus,
        selectedChannel,
        dateRange,
        customerIdFromUrl,
        debouncedSearchTerm,
      })
    })

    return () => {
      weekRegRollupFetchGenRef.current += 1
    }
  }, [
    weekRegRollupRange,
    operatorId,
    statisticsWeekOffset,
    selectedStatus,
    selectedChannel,
    dateRange,
    customerIdFromUrl,
    debouncedSearchTerm,
  ])

  const loadOperationalQueueSnapshot = useCallback(async () => {
    if (operationalQueueInFlightRef.current) return
    operationalQueueInFlightRef.current = true
    const gen = ++operationalQueueFetchGenRef.current
    setOperationalQueueLoading(true)

    const opQueueCacheKey = buildAdminOperationalQueueCacheKey({
      operatorId,
      customerIdFromUrl,
    })
    const cachedOpQueue = readAdminOperationalQueueCache(opQueueCacheKey)
    if (cachedOpQueue?.reservations?.length) {
      setOperationalQueueSnapshot(cachedOpQueue)
      setOperationalQueueLoading(false)
    }

    let replacedFromNetwork = false
    const applyHydratedChunk = async (rows: Record<string, unknown>[]) => {
      if (gen !== operationalQueueFetchGenRef.current) return false
      if (rows.length === 0) return true
      const hydrated = await hydrateAdminListRawRows(rows)
      if (gen !== operationalQueueFetchGenRef.current) return false
      if (!replacedFromNetwork) {
        replacedFromNetwork = true
        setOperationalQueueSnapshot(hydrated)
      } else {
        setOperationalQueueSnapshot((prev) => mergeAdminListHydratedSnapshots(prev, hydrated))
      }
      return true
    }

    const finalizeSnapshot = () => {
      if (gen !== operationalQueueFetchGenRef.current) return
      setOperationalQueueSnapshot((prev) => {
        if (!prev?.reservations?.length) return null
        const reservations = [...prev.reservations].sort((a, b) => {
          const ca = String(a.addedTime ?? '')
          const cb = String(b.addedTime ?? '')
          if (ca !== cb) return cb.localeCompare(ca)
          return String(b.id).localeCompare(String(a.id))
        })
        const next = { ...prev, reservations }
        writeAdminOperationalQueueCache(opQueueCacheKey, next)
        return next
      })
    }

    try {
      const { ids: candidateIds, error: candidateError, usedRpc } =
        await fetchOperationalQueueCandidateIds(supabase, customerIdFromUrl, operatorId)
      if (candidateError) throw candidateError

      if (usedRpc) {
        const { error } = await fetchReservationsByIdsProgressive(
          supabase,
          candidateIds ?? [],
          {
            onChunk: (rows) => applyHydratedChunk(rows),
          },
          operatorId
        )
        if (error) throw error
        finalizeSnapshot()
        return
      }

      const flatArgs = {
        selectedStatus: 'all' as const,
        selectedChannel: 'all' as const,
        dateRange: { start: '', end: '' },
        customerIdFromUrl,
        debouncedSearchTerm: '',
        sortBy: 'created_at' as const,
        sortOrder: 'desc' as const,
        selectFieldsOverride: RESERVATION_LIST_SELECT,
        includeExactCount: false,
        operatorId,
      }
      const { error } = await fetchAdminReservationListAllFlatProgressive(supabase, flatArgs, {
        onChunk: async ({ rows }) => applyHydratedChunk(rows),
      })
      if (error) throw error
      finalizeSnapshot()
    } catch (e) {
      if (gen !== operationalQueueFetchGenRef.current) return
      console.error(`loadOperationalQueueSnapshot: ${describeError(e)}`, serializeError(e))
      if (!cachedOpQueue) setOperationalQueueSnapshot(null)
    } finally {
      operationalQueueInFlightRef.current = false
      if (gen === operationalQueueFetchGenRef.current) {
        setOperationalQueueLoading(false)
      }
    }
  }, [customerIdFromUrl, hydrateAdminListRawRows, operatorId])

  const ensureOperationalQueueSnapshot = useCallback(() => {
    void loadOperationalQueueSnapshot()
  }, [loadOperationalQueueSnapshot])

  /** 헤더 버튼 hover/focus 시 모달 오픈 전 운영 큐 선로드 */
  const prefetchOperationalQueueSnapshot = useCallback(() => {
    if (!reservationListUiHydrated || serverListLoading || adminListChunkProgress) return
    if (operationalQueueInFlightRef.current) return
    if (operationalQueueLoading) return
    if (operationalQueueHasReservations(operationalQueueSnapshot)) return
    ensureOperationalQueueSnapshot()
  }, [
    reservationListUiHydrated,
    serverListLoading,
    adminListChunkProgress,
    operationalQueueLoading,
    operationalQueueSnapshot,
    ensureOperationalQueueSnapshot,
  ])

  /** 예약 처리 필요 모달 — 탭·테이블 목록만 DB에서 다시 불러옴(주간 예약 목록은 건드리지 않음) */
  const refreshActionRequiredTableList = useCallback(async () => {
    operationalQueueFetchGenRef.current += 1
    operationalQueueInFlightRef.current = false
    setOperationalQueueSnapshot(null)
    await loadOperationalQueueSnapshot()
  }, [loadOperationalQueueSnapshot])

  /** 예약 처리 필요 / Follow-up 모달 열릴 때만 운영 큐 전량 로드(목록 첫 페인트 백그라운드 프리페치 제거) */
  useEffect(() => {
    if (!showActionRequiredModal && !followUpQueueModalOpen) return
    if (operationalQueueHasReservations(operationalQueueSnapshot) && !operationalQueueLoading) return
    ensureOperationalQueueSnapshot()
  }, [
    showActionRequiredModal,
    followUpQueueModalOpen,
    operationalQueueSnapshot,
    operationalQueueLoading,
    ensureOperationalQueueSnapshot,
  ])

  useLayoutEffect(() => {
    setOperationalQueueSnapshot(null)
    operationalQueueFetchGenRef.current += 1
    operationalQueueInFlightRef.current = false
  }, [customerIdFromUrl, operatorId])

  const refreshReservations = useCallback(async () => {
    invalidateAdminReservationViewCaches()
    setOperationalQueueSnapshot(null)
    clearOperationalBadgeSnapshot()
    operationalQueueFetchGenRef.current += 1
    operationalQueueInFlightRef.current = false
    await Promise.all([
      loadAdminReservationList(),
      weeklyStatsModalOpen ? loadStatisticsReservations() : Promise.resolve(),
    ])
    if (showActionRequiredModalRef.current || followUpQueueModalOpenRef.current) {
      ensureOperationalQueueSnapshot()
    }
  }, [
    loadAdminReservationList,
    loadStatisticsReservations,
    weeklyStatsModalOpen,
    ensureOperationalQueueSnapshot,
    clearOperationalBadgeSnapshot,
  ])

  /** 카드 주간뷰: 목록이 안정되면 통계 코어를 idle에 미리 채워 모달 오픈을 빠르게 */
  useEffect(() => {
    if (!reservationListUiHydrated) return
    if (viewMode === 'list' || viewMode === 'calendar' || !groupByDate) return
    if (weeklyStatsModalOpen) return
    if (serverListLoading || adminListChunkProgress) return

    let cancelled = false
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null

    const run = () => {
      if (cancelled) return
      void warmAdminReservationStatsCoreCaches(supabase, {
        operatorId,
        statisticsWeekOffset,
        regCancelGranularity,
        regCancelMonthOffset,
        regCancelYearOffset,
        selectedStatus,
        selectedChannel,
        dateRange,
        customerIdFromUrl,
        debouncedSearchTerm,
        sortBy,
        sortOrder,
      }).catch((e) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[admin reservations] stats core idle warm failed:', e)
        }
      })
      // 필터 대응 주간 등록 차트도 idle에 미리 채움 (모달 오픈 시 즉시)
      const wr = browserLocalWeekRangeFromOffset(statisticsWeekOffset)
      void fetchAdminRegCancelWeekDailyRegistered(supabase, {
        operatorId,
        startYmd: wr.startYmd,
        endYmd: wr.endYmd,
        selectedStatus,
        selectedChannel,
        dateRange,
        customerIdFromUrl,
        debouncedSearchTerm,
      })
        .then(() =>
          prefetchAdminRegCancelWeekDailyRegisteredAdjacent(supabase, {
            operatorId,
            currentWeekOffset: statisticsWeekOffset,
            selectedStatus,
            selectedChannel,
            dateRange,
            customerIdFromUrl,
            debouncedSearchTerm,
          })
        )
        .catch((e) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[admin reservations] week daily reg idle warm failed:', e)
          }
        })
    }

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof w.requestIdleCallback === 'function') {
      idleHandle = w.requestIdleCallback(run, { timeout: 2500 })
    } else {
      timeoutHandle = window.setTimeout(run, 600)
    }

    return () => {
      cancelled = true
      if (idleHandle != null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle != null) window.clearTimeout(timeoutHandle)
    }
  }, [
    reservationListUiHydrated,
    viewMode,
    groupByDate,
    weeklyStatsModalOpen,
    serverListLoading,
    adminListChunkProgress,
    operatorId,
    statisticsWeekOffset,
    regCancelGranularity,
    regCancelMonthOffset,
    regCancelYearOffset,
    selectedStatus,
    selectedChannel,
    dateRange,
    customerIdFromUrl,
    debouncedSearchTerm,
    sortBy,
    sortOrder,
  ])

  /** 모든 뷰: 목록 안정 후 운영 큐를 idle soft prefetch (카드 주간 통계 warm과 별도) */
  useEffect(() => {
    if (!reservationListUiHydrated) return
    if (serverListLoading || adminListChunkProgress) return
    if (showActionRequiredModal || followUpQueueModalOpen) return

    let cancelled = false
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null

    const run = () => {
      if (cancelled) return
      prefetchOperationalQueueSnapshot()
    }

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof w.requestIdleCallback === 'function') {
      idleHandle = w.requestIdleCallback(run, { timeout: 3500 })
    } else {
      timeoutHandle = window.setTimeout(run, 900)
    }

    return () => {
      cancelled = true
      if (idleHandle != null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle != null) window.clearTimeout(timeoutHandle)
    }
  }, [
    reservationListUiHydrated,
    serverListLoading,
    adminListChunkProgress,
    showActionRequiredModal,
    followUpQueueModalOpen,
    prefetchOperationalQueueSnapshot,
  ])

  useLayoutEffect(() => {
    if (!reservationListUiHydrated) return
    if (reservationFilterLayoutResetSkipRef.current) {
      reservationFilterLayoutResetSkipRef.current = false
      return
    }
    setCurrentPage(1)
  }, [
    reservationListUiHydrated,
    debouncedSearchTerm,
    selectedStatus,
    selectedChannel,
    dateRange.start,
    dateRange.end,
    groupByDate,
    customerIdFromUrl,
    viewMode,
    sortBy,
    sortOrder,
    cardsWeekPage,
  ])

  useEffect(() => {
    if (!reservationListUiHydrated) return
    void loadAdminReservationList()
  }, [loadAdminReservationList, currentPage, reservationListUiHydrated])

  useEffect(() => {
    if (!reservationListUiHydrated || !weeklyStatsModalOpen) return
    void loadStatisticsReservations()
  }, [loadStatisticsReservations, reservationListUiHydrated, weeklyStatsModalOpen])

  // ??????????? (created_at ???) - ?? ????????????
  const groupedReservations = useMemo(() => {
    if (!groupByDate) {
      return { 'all': filteredReservations }
    }
    
    const groups: { [key: string]: typeof filteredReservations } = {}
    
    // ??? ?? ??? ?? ?? (?? ????? ???)
    const { startYmd: weekStartStr, endYmd: weekEndStr } = browserLocalWeekRangeFromOffset(cardsWeekPage)

    filteredReservations.forEach((reservation) => {
      const auditRows = regCancelChartAuditReady
        ? regCancelChartAuditRowsByRecordId[String(reservation.id ?? '').trim()]
        : undefined
      const activityDates = collectReservationActivityDateKeys(reservation, auditRows)
      if (activityDates.length === 0) return

      activityDates.forEach((ymd) => {
        if (ymd < weekStartStr || ymd > weekEndStr) return
        if (!groups[ymd]) groups[ymd] = []
        const bucket = groups[ymd]
        if (!bucket.some((r) => r.id === reservation.id)) bucket.push(reservation)
      })
    })
    
    
    // ????? ??? (?? ??????
    const sortedGroups: { [key: string]: typeof filteredReservations } = {}
    Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .forEach((date) => {
        const list = [...groups[date]].sort((a, b) => {
          const ua = new Date(a.updated_at || a.addedTime || 0).getTime()
          const ub = new Date(b.updated_at || b.addedTime || 0).getTime()
          if (ub !== ua) return ub - ua
          return new Date(b.addedTime || 0).getTime() - new Date(a.addedTime || 0).getTime()
        })
        sortedGroups[date] = list
      })
    
    return sortedGroups
  }, [filteredReservations, groupByDate, cardsWeekPage, regCancelChartAuditReady, regCancelChartAuditRowsByRecordId])

  useEffect(() => {
    regCancelChartAuditInFlightSignatureRef.current = null
    lastRegCancelChartAuditFetchedSignatureRef.current = null
    setRegCancelChartAuditRowsByRecordId({})
    setRegCancelChartAuditLoaded(false)
    setRegCancelChartAuditLoadedSignature(null)
  }, [regCancelChartAuditScopeKey])

  /** 심플 카드 주(카드 주간)가 등록·취소 차트 감사 ISO 구간에 포함되면 차트 조회 결과를 재사용할 수 있다 */
  const chartAuditRangeCoversSimpleCardWeek = useMemo(() => {
    if (!groupByDate) return false
    const range = regCancelChartAuditIsoRange
    if (!range) return false
    const req = buildSimpleCardStatusChangeAuditRequestFromFiltered(
      filteredReservations,
      cardsWeekPage,
      simpleCardStatusAuditRowsForRequest
    )
    return req.rangeStart >= range.rangeStartIso && req.rangeEnd <= range.rangeEndIso
  }, [
    groupByDate,
    filteredReservations,
    cardsWeekPage,
    regCancelChartAuditIsoRange,
    simpleCardStatusAuditRowsForRequest,
  ])

  useEffect(() => {
    if (!groupByDate || !weeklyStatsModalOpen) {
      return
    }
    const range = regCancelChartAuditIsoRange
    if (!range) return
    const scopeSignature = regCancelChartAuditScopeKey
    if (!scopeSignature) return
    if (lastRegCancelChartAuditFetchedSignatureRef.current === scopeSignature) {
      regCancelChartAuditInFlightSignatureRef.current = null
      return
    }
    if (regCancelChartAuditInFlightSignatureRef.current === scopeSignature) {
      return
    }

    let cancelled = false
    regCancelChartAuditInFlightSignatureRef.current = scopeSignature
    void (async () => {
      const indexRows = (rows: ReservationStatusAuditRow[]) => {
        const next: Record<string, ReservationStatusAuditRow[]> = {}
        for (const row of rows) {
          const id = String(row.record_id ?? '').trim()
          if (!id) continue
          const arr = next[id] ?? []
          arr.push(row)
          next[id] = arr
        }
        return next
      }

      try {
        const { rows, error } = await fetchReservationStatusTransitionsByTimeRange(supabase, {
          rangeStartIso: range.rangeStartIso,
          rangeEndIso: range.rangeEndIso,
          shouldAbort: () => cancelled,
          includeAuditLogs: false,
        })
        if (cancelled) return
        if (error) {
          if (!isAbortLikeError(error) && !cancelled) {
            console.error('reservation_status_events (reg-cancel chart):', error)
          }
          if (isAbortLikeError(error)) return
        }
        setRegCancelChartAuditRowsByRecordId(indexRows(rows))
        setRegCancelChartAuditLoaded(true)
        setRegCancelChartAuditLoadedSignature(scopeSignature)
        lastRegCancelChartAuditFetchedSignatureRef.current = scopeSignature

        const auditSupplement = await fetchReservationStatusAuditLogsTransitionsByTimeRange(supabase, {
          rangeStartIso: range.rangeStartIso,
          rangeEndIso: range.rangeEndIso,
          shouldAbort: () => cancelled,
        })
        if (cancelled) return
        if (!auditSupplement.error && auditSupplement.rows.length > 0) {
          setRegCancelChartAuditRowsByRecordId((prev) =>
            mergeIndexedStatusAuditRows(prev, auditSupplement.rows)
          )
        } else if (auditSupplement.error && !isAbortLikeError(auditSupplement.error) && !cancelled) {
          console.error('audit_logs (reg-cancel chart supplement):', auditSupplement.error)
        }
      } catch (e) {
        if (!cancelled && !isAbortLikeError(e)) {
          console.error('reservation_status_events chart fetch failed:', e)
        }
      } finally {
        if (!cancelled) {
          regCancelChartAuditInFlightSignatureRef.current = null
        }
      }
    })()

    return () => {
      cancelled = true
      if (regCancelChartAuditInFlightSignatureRef.current === scopeSignature) {
        regCancelChartAuditInFlightSignatureRef.current = null
      }
    }
  }, [
    groupByDate,
    weeklyStatsModalOpen,
    regCancelChartAuditIsoRange,
    regCancelChartAuditScopeKey,
  ])

  /** 일별·월별·연별 등록/취소 차트 행 — WeeklyStatsPanel (live 집계) */
  const regCancelChartRowsLive = useMemo(() => {
    if (!weeklyStatsModalOpen) return []
    type Row = {
      dateKey: string
      registeredPeople: number
      registeredCount: number
      cancelledPeople: number
      cancelledCount: number
      /** 7일 탭: 올해 로컬 YTD 순(등록−취소) 요일별 일평균 인원. 월간: 해당 연 등록만 요일 평균. */
      avgLineRegistered: number
      /** 예약건 기준 평균선(7일 YTD 순·요일 / 월간·연간 등록 건수) */
      avgLineRegisteredCount: number
    }
    const isCancelledLike = (status: string | undefined) =>
      isReservationCancelledStatus(status) || isReservationDeletedStatus(status)

    const useWeekRegRollup =
      regCancelGranularity === 'week' && weekRegRollupByYmd != null && weekRegRollupByYmd.size > 0

    const aggregateIntoKeys = (keys: string[], keyFromCreated: (ck: string) => string | null, keyFromUpdated: (uk: string) => string | null) => {
      const rowByKey = new Map<string, Row>()
      const rows: Row[] = []
      for (const k of keys) {
        const row: Row = {
          dateKey: k,
          registeredPeople: 0,
          registeredCount: 0,
          cancelledPeople: 0,
          cancelledCount: 0,
          avgLineRegistered: 0,
          avgLineRegisteredCount: 0,
        }
        rows.push(row)
        rowByKey.set(k, row)
      }
      if (useWeekRegRollup && weekRegRollupByYmd) {
        for (const k of keys) {
          const rollup = weekRegRollupByYmd.get(k)
          if (!rollup) continue
          const row = rowByKey.get(k)
          if (row) {
            row.registeredPeople = rollup.registeredPeople
            row.registeredCount = rollup.registeredCount
          }
        }
      }
      for (const r of statisticsReservations) {
        const p = getReservationPartySize(r as unknown as Record<string, unknown>)
        const id = String(r.id ?? '').trim()
        const isRebookingCancel = isRebookingReservationByReasonMap(id, cancellationReasonByReservationId)
        if (!useWeekRegRollup) {
          const createdKey = isoToLocalCalendarDateKey(r.addedTime)
          if (createdKey) {
            const bk = keyFromCreated(createdKey)
            if (bk) {
              const row = rowByKey.get(bk)
              if (row) {
                row.registeredCount += 1
                row.registeredPeople += p
              }
            }
          }
        }
        if (isRebookingCancel) continue
        if (groupByDate && id) {
          const auditRows = regCancelChartAuditRowsByRecordId[id]
          if (auditRows && auditRows.length > 0) {
            const ymds = localYmdSetWhereBecameCancelledFromAuditRows(auditRows)
            for (const ymd of ymds) {
              const bk = keyFromUpdated(ymd)
              if (bk) {
                const row = rowByKey.get(bk)
                if (row) {
                  row.cancelledCount += 1
                  row.cancelledPeople += p
                }
              }
            }
          } else {
            const updatedKey = isoToLocalCalendarDateKey(r.updated_at ?? null)
            if (updatedKey && isCancelledLike(r.status)) {
              const bk = keyFromUpdated(updatedKey)
              if (bk) {
                const row = rowByKey.get(bk)
                if (row) {
                  row.cancelledCount += 1
                  row.cancelledPeople += p
                }
              }
            }
          }
        } else if (!groupByDate) {
          const updatedKey = isoToLocalCalendarDateKey(r.updated_at ?? null)
          if (updatedKey && isCancelledLike(r.status)) {
            const bk = keyFromUpdated(updatedKey)
            if (bk) {
              const row = rowByKey.get(bk)
              if (row) {
                row.cancelledCount += 1
                row.cancelledPeople += p
              }
            }
          }
        }
      }
      return rows
    }

    let base: Row[]
    if (regCancelGranularity === 'week') {
      const { startYmd: weekStartStr, endYmd: weekEndStr } = browserLocalWeekRangeFromOffset(statisticsWeekOffset)
      const keys = browserLocalInclusiveDateKeys(weekStartStr, weekEndStr)
      base = aggregateIntoKeys(keys, (ck) => ck, (uk) => uk)
    } else if (regCancelGranularity === 'month') {
      const { startYmd, endYmd } = browserLocalCalendarMonthWindow(regCancelMonthOffset)
      const keys = browserLocalInclusiveDateKeys(startYmd, endYmd)
      base = aggregateIntoKeys(keys, (ck) => ck, (uk) => uk)
    } else {
      const keys = browserLocalCalendarYearMonthKeys(regCancelYearOffset)
      base = aggregateIntoKeys(
        keys,
        (ck) => (ck.length >= 7 ? ck.slice(0, 7) : null),
        (uk) => (uk.length >= 7 ? uk.slice(0, 7) : null)
      )
    }

    let wdAvg: number[] = Array.from({ length: 7 }, () => 0)
    let wdAvgCount: number[] = Array.from({ length: 7 }, () => 0)
    let monthDailyAvgSameYear: number[] | null = null
    let monthDailyAvgSameYearCount: number[] | null = null

    const netAvgArgs = {
      auditRowsByRecordId: regCancelChartAuditReady ? regCancelChartAuditRowsByRecordId : undefined,
      cancellationReasonById: cancellationReasonByReservationId,
      useAuditCancel: Boolean(groupByDate && regCancelChartAuditReady),
    }

    if (regCancelGranularity === 'week') {
      if (ytdWeekdayAvgRpc) {
        wdAvg = ytdWeekdayAvgRpc.people
        wdAvgCount = ytdWeekdayAvgRpc.bookings
      }
    } else if (regCancelGranularity === 'month') {
      const { startYmd } = browserLocalCalendarMonthWindow(regCancelMonthOffset)
      const y = parseInt(startYmd.slice(0, 4), 10)
      wdAvg = computeAvgDailyNetByWeekdayForYears(statisticsReservations, new Set([y]), {
        ...netAvgArgs,
        mode: 'people',
      })
      wdAvgCount = computeAvgDailyNetByWeekdayForYears(statisticsReservations, new Set([y]), {
        ...netAvgArgs,
        mode: 'bookings',
      })
    } else {
      const chartYear = parseInt(
        browserLocalCalendarYearWindow(regCancelYearOffset).startYmd.slice(0, 4),
        10
      )
      monthDailyAvgSameYear = computeAvgDailyNetByMonthForCalendarYear(statisticsReservations, chartYear, {
        ...netAvgArgs,
        mode: 'people',
      })
      monthDailyAvgSameYearCount = computeAvgDailyNetByMonthForCalendarYear(
        statisticsReservations,
        chartYear,
        {
          ...netAvgArgs,
          mode: 'bookings',
        }
      )
    }

    return base.map((row) => {
      let avgLine = 0
      let avgLineCount = 0
      if (regCancelGranularity === 'week' || regCancelGranularity === 'month') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(row.dateKey)) {
          avgLine = wdAvg[localWeekdayIndexFromYmd(row.dateKey)] ?? 0
          avgLineCount = wdAvgCount[localWeekdayIndexFromYmd(row.dateKey)] ?? 0
        }
      } else if (monthDailyAvgSameYear && /^\d{4}-\d{2}$/.test(row.dateKey)) {
        const mi = parseInt(row.dateKey.slice(5, 7), 10)
        avgLine = monthDailyAvgSameYear[mi] ?? 0
        avgLineCount = monthDailyAvgSameYearCount?.[mi] ?? 0
      }
      return { ...row, avgLineRegistered: avgLine, avgLineRegisteredCount: avgLineCount }
    })
  }, [
    weeklyStatsModalOpen,
    statisticsReservations,
    regCancelGranularity,
    statisticsWeekOffset,
    regCancelMonthOffset,
    regCancelYearOffset,
    groupByDate,
    ytdWeekdayAvgRpc,
    weekRegRollupByYmd,
    regCancelChartAuditRowsByRecordId,
    cancellationReasonByReservationId,
    regCancelChartAuditReady,
  ])

  const regCancelChartRows = useMemo(() => {
    const scope = regCancelChartDisplayScopeKey
    if (scope !== regCancelChartStableScopeRef.current) {
      regCancelChartStableScopeRef.current = scope
      regCancelChartStableRowsRef.current = []
    }
    if (!regCancelChartDataReady) {
      if (statisticsReservations.length > 0) {
        regCancelChartStableRowsRef.current = regCancelChartRowsLive
        return regCancelChartRowsLive
      }
      return regCancelChartStableRowsRef.current
    }
    regCancelChartStableRowsRef.current = regCancelChartRowsLive
    return regCancelChartRowsLive
  }, [
    regCancelChartRowsLive,
    regCancelChartDataReady,
    regCancelChartDisplayScopeKey,
    statisticsReservations.length,
  ])

  const regCancelChartRangeSubtitle = useMemo(() => {
    const localeTag = locale === 'en' ? 'en-US' : 'ko-KR'
    if (regCancelGranularity === 'week') {
      const { startYmd, endYmd } = browserLocalWeekRangeFromOffset(statisticsWeekOffset)
      return formatBrowserLocalYmdRangeDisplay(startYmd, endYmd, localeTag)
    }
    if (regCancelGranularity === 'month') {
      const { startYmd, endYmd } = browserLocalCalendarMonthWindow(regCancelMonthOffset)
      return formatBrowserLocalYmdRangeDisplay(startYmd, endYmd, localeTag)
    }
    const { startYmd, endYmd } = browserLocalCalendarYearWindow(regCancelYearOffset)
    return formatBrowserLocalYmdRangeDisplay(startYmd, endYmd, localeTag)
  }, [locale, regCancelGranularity, statisticsWeekOffset, regCancelMonthOffset, regCancelYearOffset])

  /** 날짜 그룹 보기: 목록에서 사라진 날짜만 펼침 상태에서 제거 (기본은 접힘 유지). */
  useEffect(() => {
    if (!groupByDate || !groupedReservations || Object.keys(groupedReservations).length === 0) return
    const allDatesSet = new Set(Object.keys(groupedReservations))
    setExpandedDateGroups((prev) => {
      let next: Set<string> = prev
      for (const p of prev) {
        if (!allDatesSet.has(p)) {
          if (next === prev) next = new Set(prev)
          next.delete(p)
        }
      }
      return next === prev ? prev : next
    })
  }, [groupedReservations, groupByDate])

  /** 참조가 아닌 감사 대상 식별 — 목록이 같은 내용으로 자주 갱신돼도 로딩 문구가 깜빡이지 않게 함 */
  const simpleCardStatusAuditPlan = useMemo(
    () =>
      computeSimpleCardStatusAuditPlan(
        groupByDate,
        filteredReservations,
        cardsWeekPage,
        simpleCardStatusAuditRowsForRequest
      ),
    [groupByDate, filteredReservations, cardsWeekPage, simpleCardStatusAuditRowsForRequest]
  )
  /** 심플 카드 상태 전환 집계 UI 안정용 — contentKey(대상 목록)와 무관하게 «같은 7일 카드 주» */
  const simpleCardStatusScopeKey = useMemo(() => {
    if (!groupByDate) return null
    const { startYmd, endYmd } = browserLocalWeekRangeFromOffset(cardsWeekPage)
    return `${cardsWeekPage}\u0001${startYmd}\u0001${endYmd}`
  }, [groupByDate, cardsWeekPage])
  const simpleCardAuditContentKey = simpleCardStatusAuditPlan?.contentKey ?? null
  /** 필터·주간 페이지 등 «목록 창»이 바뀌면 집계 표시를 리셋 */
  const reservationListWindowSignature = useMemo(
    () =>
      [
        String(groupByDate),
        debouncedSearchTerm,
        selectedStatus,
        selectedChannel,
        `${dateRange.start}\u0001${dateRange.end}`,
        sortBy,
        sortOrder,
        String(currentPage),
        String(cardsWeekPage),
      ].join('\u001f'),
    [
      groupByDate,
      debouncedSearchTerm,
      selectedStatus,
      selectedChannel,
      dateRange.start,
      dateRange.end,
      sortBy,
      sortOrder,
      currentPage,
      cardsWeekPage,
    ]
  )

  useEffect(() => {
    lastSimpleCardStatusAuditFetchedKeyRef.current = null
    simpleCardStatusTransitionInFlightKeyRef.current = null
    simpleCardStatusTransitionMapClearedForScopeRef.current = null
    setSimpleCardStatusTransitionDisplayScopeKey(null)
  }, [reservationListWindowSignature])

  /** 집계 스피너: 주간 스코프가 확정되면 contentKey(청크마다 바뀜)와 무관하게 유지 */
  const simpleCardStatusTransitionLoadingEffective =
    Boolean(simpleCardStatusAuditPlan?.needsNetworkFetch) &&
    simpleCardStatusScopeKey != null &&
    simpleCardStatusTransitionDisplayScopeKey !== simpleCardStatusScopeKey

  useEffect(() => {
    const runKey = simpleCardAuditContentKey
    const scheduleScopeKey = simpleCardStatusScopeKey
    if (runKey === null) {
      lastSimpleCardStatusAuditFetchedKeyRef.current = null
      simpleCardStatusTransitionInFlightKeyRef.current = null
      simpleCardStatusTransitionMapClearedForScopeRef.current = null
      setSimpleCardStatusTransitionMap({})
      setSimpleCardStatusTransitionDisplayScopeKey(null)
      return
    }
    /** 이미 이 키로 조회·커밋 완료 — 차트 rows 객체 참조만 바뀌는 재실행에서 맵·요약을 지우지 않음 */
    if (lastSimpleCardStatusAuditFetchedKeyRef.current === runKey) {
      simpleCardStatusTransitionInFlightKeyRef.current = null
      return
    }
    /** 동일 키로 이미 디바운스·fetch 진행 중(첫 라운드 미완료) — 재진입 시 맵·로딩을 다시 건드리지 않음 */
    if (simpleCardStatusTransitionInFlightKeyRef.current === runKey) {
      return
    }
    const reqSync = buildSimpleCardStatusChangeAuditRequestFromFiltered(
      filteredReservations,
      cardsWeekPage,
      simpleCardStatusAuditRowsForRequest
    )
    if (reqSync.targets.length === 0) {
      setSimpleCardStatusTransitionMap({})
      if (scheduleScopeKey) setSimpleCardStatusTransitionDisplayScopeKey(scheduleScopeKey)
      simpleCardStatusTransitionMapClearedForScopeRef.current = scheduleScopeKey
      if (filteredReservations.length > 0) {
        lastSimpleCardStatusAuditFetchedKeyRef.current = runKey
      }
      return
    }
    if (reqSync.uniqueIds.length === 0) {
      setSimpleCardStatusTransitionMap({})
      if (scheduleScopeKey) setSimpleCardStatusTransitionDisplayScopeKey(scheduleScopeKey)
      simpleCardStatusTransitionMapClearedForScopeRef.current = scheduleScopeKey
      if (filteredReservations.length > 0) {
        lastSimpleCardStatusAuditFetchedKeyRef.current = runKey
      }
      return
    }

    let cancelled = false
    simpleCardStatusTransitionInFlightKeyRef.current = runKey
    if (scheduleScopeKey != null && simpleCardStatusTransitionMapClearedForScopeRef.current !== scheduleScopeKey) {
      setSimpleCardStatusTransitionMap({})
      simpleCardStatusTransitionMapClearedForScopeRef.current = scheduleScopeKey
    }

    const debounceMs = 450
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (cancelled) return
          const req = buildSimpleCardStatusChangeAuditRequestFromFiltered(
            filteredReservations,
            cardsWeekPage,
            simpleCardStatusAuditRowsForRequest
          )
          if (req.targets.length === 0 || req.uniqueIds.length === 0) {
            setSimpleCardStatusTransitionMap({})
            if (scheduleScopeKey) setSimpleCardStatusTransitionDisplayScopeKey(scheduleScopeKey)
            if (filteredReservations.length > 0) {
              lastSimpleCardStatusAuditFetchedKeyRef.current = runKey
            }
            return
          }

          if (regCancelChartAuditReady && chartAuditRangeCoversSimpleCardWeek) {
            const next = buildSimpleCardStatusTransitionMapFromCachedAuditRows(
              req,
              regCancelChartAuditRowsByRecordId
            )
            if (cancelled) return
            setSimpleCardStatusTransitionMap(next)
            if (scheduleScopeKey) setSimpleCardStatusTransitionDisplayScopeKey(scheduleScopeKey)
            lastSimpleCardStatusAuditFetchedKeyRef.current = runKey
            return
          }

          const { rows, error } = await fetchReservationStatusTransitionsChunked(supabase, {
            reservationIds: req.uniqueIds,
            rangeStartIso: req.rangeStart,
            rangeEndIso: req.rangeEnd,
            shouldAbort: () => cancelled,
          })
          if (cancelled) return

          if (error) {
            if (!isAbortLikeError(error) && !cancelled) {
              console.error('reservation_status_events (status transitions):', error)
            }
            if (isAbortLikeError(error)) {
              if (scheduleScopeKey) setSimpleCardStatusTransitionDisplayScopeKey(scheduleScopeKey)
              return
            }
          }

          const rowsByRecord: Record<string, ReservationStatusAuditRow[]> = {}
          for (const row of rows) {
            const id = String(row.record_id ?? '').trim()
            if (!id) continue
            const arr = rowsByRecord[id] ?? []
            arr.push(row)
            rowsByRecord[id] = arr
          }

          const next = buildSimpleCardStatusTransitionMapFromCachedAuditRows(req, rowsByRecord)
          if (cancelled) return
          setSimpleCardStatusTransitionMap(next)
          if (scheduleScopeKey) setSimpleCardStatusTransitionDisplayScopeKey(scheduleScopeKey)
          lastSimpleCardStatusAuditFetchedKeyRef.current = runKey
        } catch (e) {
          if (!cancelled && !isAbortLikeError(e)) console.error('reservation_status_events fetch failed:', e)
          if (!cancelled) {
            if (scheduleScopeKey) setSimpleCardStatusTransitionDisplayScopeKey(scheduleScopeKey)
          }
        } finally {
          if (simpleCardStatusTransitionInFlightKeyRef.current === runKey) {
            simpleCardStatusTransitionInFlightKeyRef.current = null
          }
        }
      })()
    }, debounceMs)

    // filteredReservations·cardsWeekPage는 contentKey에 녹아 있음. 차트 rows 참조 변경만으로 재실행하지 않음(맵 깜빡임 방지).
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (simpleCardStatusTransitionInFlightKeyRef.current === runKey) {
        simpleCardStatusTransitionInFlightKeyRef.current = null
      }
    }
  }, [simpleCardAuditContentKey, regCancelChartAuditReady, chartAuditRangeCoversSimpleCardWeek])

  const statisticsWeekBoundary = useMemo(
    () => browserLocalWeekRangeFromOffset(statisticsWeekOffset),
    [statisticsWeekOffset]
  )

  /** 통계 패널 요약·차트용: 통계 주간에 활동(등록/수정일)이 겹치는 예약만 */
  const statisticsWeekReservations = useMemo(() => {
    const { startYmd, endYmd } = statisticsWeekBoundary
    const seen = new Set<string>()
    const out: Reservation[] = []
    for (const r of reservationsForStatistics) {
      const c = isoToLocalCalendarDateKey(r.addedTime)
      const u = isoToLocalCalendarDateKey(r.updated_at ?? null)
      const inB = (k: string | null) => !!k && k >= startYmd && k <= endYmd
      if (!inB(c) && !inB(u)) continue
      const id = String(r.id ?? '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(r)
    }
    return out
  }, [reservationsForStatistics, statisticsWeekBoundary])

  /** 통계 패널 상단: 선택 주(달력 N일) 기준 등록·취소(감사)·순 건수·인원 및 일평균 */
  const statisticsWeekHeaderSummary = useMemo(() => {
    const { startYmd, endYmd } = statisticsWeekBoundary
    const calendarKeys = browserLocalInclusiveDateKeys(startYmd, endYmd)
    const dayDen = Math.max(calendarKeys.length, 1)
    const round1 = (n: number) => Math.round(n * 10) / 10

    let regBookings = 0
    let regPeople = 0
    for (const r of reservationsForStatistics) {
      const ck = isoToLocalCalendarDateKey(r.addedTime)
      if (ck && ck >= startYmd && ck <= endYmd) {
        regBookings += 1
        regPeople += getReservationPartySize(r as unknown as Record<string, unknown>)
      }
    }

    let cancelBookings = 0
    let cancelPeople = 0
    const useAuditCancel = groupByDate && regCancelChartAuditReady
    if (useAuditCancel) {
      for (const r of reservationsForStatistics) {
        const id = String(r.id ?? '').trim()
        if (!id) continue
        if (isRebookingReservationByReasonMap(id, cancellationReasonByReservationId)) continue
        const ymds = localYmdSetWhereBecameCancelledFromAuditRows(regCancelChartAuditRowsByRecordId[id])
        const p = getReservationPartySize(r as unknown as Record<string, unknown>)
        for (const ymd of ymds) {
          if (ymd >= startYmd && ymd <= endYmd) {
            cancelBookings += 1
            cancelPeople += p
          }
        }
      }
    } else {
      for (const r of reservationsForStatistics) {
        const id = String(r.id ?? '').trim()
        if (isRebookingReservationByReasonMap(id, cancellationReasonByReservationId)) continue
        const uk = isoToLocalCalendarDateKey(r.updated_at ?? null)
        if (!uk || uk < startYmd || uk > endYmd) continue
        if (!isReservationCancelledStatus(r.status) && !isReservationDeletedStatus(r.status)) continue
        cancelBookings += 1
        cancelPeople += getReservationPartySize(r as unknown as Record<string, unknown>)
      }
    }

    const netBookings = regBookings - cancelBookings
    const netPeople = regPeople - cancelPeople

    return {
      calendarDayCount: dayDen,
      regBookings,
      regPeople,
      cancelBookings,
      cancelPeople,
      netBookings,
      netPeople,
      avgRegBookingsPerDay: round1(regBookings / dayDen),
      avgRegPeoplePerDay: round1(regPeople / dayDen),
      avgCancelBookingsPerDay: round1(cancelBookings / dayDen),
      avgCancelPeoplePerDay: round1(cancelPeople / dayDen),
      avgNetBookingsPerDay: round1(netBookings / dayDen),
      avgNetPeoplePerDay: round1(netPeople / dayDen),
    }
  }, [
    reservationsForStatistics,
    statisticsWeekBoundary,
    groupByDate,
    regCancelChartAuditReady,
    regCancelChartAuditRowsByRecordId,
    cancellationReasonByReservationId,
  ])

  /** 통계 주(차트·상단 요약과 동일 구간): 상품·채널·상태별 등록/취소/순 인원 */
  const weeklyStats = useMemo(() => {
    if (!weeklyStatsModalOpen) {
      return {
        productStats: [],
        channelStats: [],
        statusStats: [],
        totalReservations: 0,
        totalPeople: 0,
      }
    }
    const allReservations = statisticsWeekReservations
    const { startYmd, endYmd } = statisticsWeekBoundary
    const useAuditCancel = groupByDate && regCancelChartAuditReady
    const party = (r: Reservation) => getReservationPartySize(r as unknown as Record<string, unknown>)

    type FlowPair = { reg: number; cancel: number; regBookings: number; cancelBookings: number }
    const prodMap = new Map<string, FlowPair>()
    const statMap = new Map<string, FlowPair>()
    const chanMap = new Map<
      string,
      FlowPair & { name: string; channelId: string; favicon_url: string | null }
    >()

    const bumpReg = (pair: FlowPair, n: number) => {
      pair.reg += n
      pair.regBookings += 1
    }
    const bumpCancel = (pair: FlowPair, n: number) => {
      pair.cancel += n
      pair.cancelBookings += 1
    }
    const getProd = (k: string) => {
      let p = prodMap.get(k)
      if (!p) {
        p = { reg: 0, cancel: 0, regBookings: 0, cancelBookings: 0 }
        prodMap.set(k, p)
      }
      return p
    }
    const getStat = (k: string) => {
      let p = statMap.get(k)
      if (!p) {
        p = { reg: 0, cancel: 0, regBookings: 0, cancelBookings: 0 }
        statMap.set(k, p)
      }
      return p
    }
    const getChan = (channelId: string, name: string) => {
      const key = `${name}|${channelId}`
      let row = chanMap.get(key)
      if (!row) {
        const ch = (channels as Array<{ id: string; name: string; favicon_url?: string | null }>)?.find(
          (c) => c.id === channelId
        )
        row = {
          name,
          channelId,
          favicon_url: ch?.favicon_url ?? null,
          reg: 0,
          cancel: 0,
          regBookings: 0,
          cancelBookings: 0,
        }
        chanMap.set(key, row)
      }
      return row
    }

    for (const r of reservationsForStatistics) {
      const p = party(r)
      const productName = getProductName(r.productId, products || [])
      const channelName = getChannelName(r.channelId, channels || [])
      const chRow = getChan(r.channelId, channelName)
      const statusKey = String(r.status ?? 'unknown').trim() || 'unknown'
      const id = String(r.id ?? '').trim()

      const createdKey = isoToLocalCalendarDateKey(r.addedTime)
      if (createdKey && createdKey >= startYmd && createdKey <= endYmd) {
        bumpReg(getProd(productName), p)
        bumpReg(chRow, p)
        if (!useAuditCancel) bumpReg(getStat(statusKey), p)
      }

      if (useAuditCancel && id) {
        if (isRebookingReservationByReasonMap(id, cancellationReasonByReservationId)) continue
        const ymds = localYmdSetWhereBecameCancelledFromAuditRows(regCancelChartAuditRowsByRecordId[id])
        for (const ymd of ymds) {
          if (ymd < startYmd || ymd > endYmd) continue
          bumpCancel(getProd(productName), p)
          bumpCancel(chRow, p)
        }
      } else {
        if (isRebookingReservationByReasonMap(id, cancellationReasonByReservationId)) continue
        const uk = isoToLocalCalendarDateKey(r.updated_at ?? null)
        if (!uk || uk < startYmd || uk > endYmd) continue
        if (!isReservationCancelledStatus(r.status) && !isReservationDeletedStatus(r.status)) continue
        bumpCancel(getProd(productName), p)
        bumpCancel(chRow, p)
        bumpCancel(getStat(statusKey), p)
      }
    }

    const statusTransitionByTarget = useAuditCancel
      ? aggregateStatusTransitionBucketsForReservationWindow({
          reservations: reservationsForStatistics,
          party: (res: unknown) => party(res as Reservation),
          auditRowsByReservationId: regCancelChartAuditRowsByRecordId,
          dayKeys: browserLocalInclusiveDateKeys(startYmd, endYmd),
        })
      : undefined

    const toNet = (v: FlowPair) => ({
      regPeople: v.reg,
      cancelPeople: v.cancel,
      netPeople: v.reg - v.cancel,
      regBookings: v.regBookings,
      cancelBookings: v.cancelBookings,
      netBookings: v.regBookings - v.cancelBookings,
    })
    const sumFlow = (v: { reg: number; cancel: number }) => v.reg + v.cancel

    const productStats = [...prodMap.entries()]
      .map(([name, v]) => ({ name, ...toNet(v) }))
      .filter((row) => row.regPeople > 0 || row.cancelPeople > 0)
      .sort((a, b) => sumFlow({ reg: b.regPeople, cancel: b.cancelPeople }) - sumFlow({ reg: a.regPeople, cancel: a.cancelPeople }))

    const channelStats = [...chanMap.values()]
      .map((row) => ({
        name: row.name,
        channelId: row.channelId,
        favicon_url: row.favicon_url,
        ...toNet(row),
      }))
      .filter((row) => row.regPeople > 0 || row.cancelPeople > 0)
      .sort((a, b) => sumFlow({ reg: b.regPeople, cancel: b.cancelPeople }) - sumFlow({ reg: a.regPeople, cancel: a.cancelPeople }))

    const statusStats = useAuditCancel
      ? []
      : [...statMap.entries()]
          .map(([statusKey, v]) => ({ statusKey, ...toNet(v) }))
          .filter((row) => row.regPeople > 0 || row.cancelPeople > 0)
          .sort((a, b) => sumFlow({ reg: b.regPeople, cancel: b.cancelPeople }) - sumFlow({ reg: a.regPeople, cancel: a.cancelPeople }))

    return {
      productStats,
      channelStats,
      statusStats,
      totalReservations: allReservations.length,
      totalPeople: allReservations.reduce((total, reservation) => total + reservation.totalPeople, 0),
      ...(statusTransitionByTarget !== undefined ? { statusTransitionByTarget } : {}),
    }
  }, [
    weeklyStatsModalOpen,
    statisticsWeekReservations,
    statisticsWeekBoundary,
    reservationsForStatistics,
    products,
    channels,
    groupByDate,
    regCancelChartAuditReady,
    regCancelChartAuditRowsByRecordId,
    cancellationReasonByReservationId,
  ])
  
  // ??????????? (?????? ???? ?????)
  const totalPages =
    groupByDate && viewMode !== 'list' ? 1 : Math.max(1, Math.ceil(serverListTotal / itemsPerPage))
  const startIndex = groupByDate && viewMode !== 'list' ? 0 : (currentPage - 1) * itemsPerPage
  const paginatedReservations = groupByDate ? filteredReservations : filteredReservations

  // reservation_pricing ?????? useReservationData ????????? ????
  // ?????????? reservation???????????????????
  // (hookReservationPricingMap?? ?? reservation????????????? ???)

  // ????? ????????
  const calendarReservations = useMemo(() => {
    return filteredReservations.map(reservation => ({
      id: reservation.id,
      product_id: reservation.productId,
      product_name: getProductName(reservation.productId, products || []),
      tour_date: reservation.tourDate,
      status: reservation.status,
      tour_time: reservation.tourTime,
      pickup_hotel: reservation.pickUpHotel,
      pickup_time: reservation.pickUpTime,
      adults: reservation.adults,
      child: reservation.child,
      infant: reservation.infant,
      total_people: reservation.totalPeople,
      customer_name: getCustomerName(reservation.customerId, (customers as Customer[]) || []),
      channel_name: getChannelName(reservation.channelId, channels || []),
      created_at: reservation.addedTime,
      total_price: calculateTotalPrice(reservation, products || [], optionChoices || [])
    }))
  }, [filteredReservations, products, customers, channels, optionChoices])

  const isAddingReservationRef = useRef(false)
  
  const handleAddReservation = useCallback(async (reservation: Omit<Reservation, 'id'> & { id?: string }) => {
    // ?? ??? ???
    if (isAddingReservationRef.current) {
      return
    }
    
    isAddingReservationRef.current = true
    
    // ??? ID ??? (?? ??? ???????ID ??? reservation.id)
    const reservationId = (reservation as any).id || newReservationId

    if (!reservationId) {
      console.error('??? ID? ??????!')
      alert(t('messages.noReservationId'))
      isAddingReservationRef.current = false
      return
    }

    const customerIdTrimmed = String((reservation as { customerId?: string }).customerId ?? '').trim()
    if (!customerIdTrimmed) {
      alert(t('messages.selectCustomerBeforeSave'))
      isAddingReservationRef.current = false
      return
    }

    try {
      // Supabase??????? ????????
      // tour_id????? null????????, ??? ??? ????????
      const reservationData = {
        id: reservationId, // ?? ?????ID ???
        customer_id: reservation.customerId,
        product_id: reservation.productId,
        tour_date: reservation.tourDate,
        tour_time: reservation.tourTime || null, // ??????? null?????
        event_note: reservation.eventNote,
        pickup_hotel: reservation.pickUpHotel,
        pickup_time: reservation.pickUpTime || null, // ??????? null?????
        adults: reservation.adults,
        child: reservation.child,
        infant: reservation.infant,
        total_people: reservation.totalPeople,
        channel_id: reservation.channelId,
        channel_rn: reservation.channelRN,
        added_by: reservation.addedBy,
        tour_id: null, // ??? null?????
        status: reservation.status,
        selected_options: reservation.selectedOptions,
        selected_option_prices: reservation.selectedOptionPrices,
        is_private_tour: reservation.isPrivateTour || false,
        choices: reservation.choices,
        variant_key: (reservation as any).variantKey || 'default', // variant_key ???
        ...operatorIdInsert(operatorId),
      }

      // ID? ?????upsert ??? (???? ????? update, ?????insert)
      let newReservation
      let error
      
      // ??? ?? ???? ???
      const { data: existingReservation } = await supabase
        .from('reservations')
        .select('id')
        .eq('id', reservationId)
        .maybeSingle()
      
      if (existingReservation) {
        // ???? ????? update
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (supabase as any)
          .from('reservations')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(reservationData as any)
          .eq('id', reservationId)
          .select('*')
          .single()
        newReservation = result.data
        error = result.error
      } else {
        // ?????insert
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (supabase as any)
          .from('reservations')
          .insert(reservationData)
          .select('*')
          .single()
        newReservation = result.data
        error = result.error
      }

      if (error) {
        console.error('Error saving reservation:', error)
        alert(t('messages.reservationAddError') + error.message)
        isAddingReservationRef.current = false
        return
      }

      // reservation_customers ????? ?? ???????? ??????
      if (reservationId) {
        try {
          // ?? reservation_customers ????????? (?????? ??
          await supabase
            .from('reservation_customers')
            .delete()
            .eq('reservation_id', reservationId)

          // ???????? ??? ??? reservation_customers ????????
          const reservationCustomers: any[] = []
          let orderIndex = 0

          // ?? ????
          const usResidentCount = (reservation as any).usResidentCount || 0
          for (let i = 0; i < usResidentCount; i++) {
            reservationCustomers.push({
              reservation_id: reservationId,
              customer_id: reservation.customerId,
              resident_status: 'us_resident',
              pass_covered_count: 0,
              order_index: orderIndex++
            })
          }

          // ????
          const nonResidentCount = (reservation as any).nonResidentCount || 0
          for (let i = 0; i < nonResidentCount; i++) {
            reservationCustomers.push({
              reservation_id: reservationId,
              customer_id: reservation.customerId,
              resident_status: 'non_resident',
              pass_covered_count: 0,
              order_index: orderIndex++
            })
          }

          // ??????(16?????)
          const nonResidentUnder16Count = (reservation as any).nonResidentUnder16Count || 0
          for (let i = 0; i < nonResidentUnder16Count; i++) {
            reservationCustomers.push({
              reservation_id: reservationId,
              customer_id: reservation.customerId,
              resident_status: 'non_resident_under_16',
              pass_covered_count: 0,
              order_index: orderIndex++
            })
          }

          // ???? (??? ??) - ??? ?????nonResidentWithPassCount?? ??
          const nonResidentWithPassCount = (reservation as any).nonResidentWithPassCount || 0
          
          // ???? (??? ??) - ??? ????? ???, ???????4??? ??
          for (let i = 0; i < nonResidentWithPassCount; i++) {
            reservationCustomers.push({
              reservation_id: reservationId,
              customer_id: reservation.customerId,
              resident_status: 'non_resident_with_pass',
              pass_covered_count: 4, // ??? 1??? 4????
              order_index: orderIndex++
            })
          }

          // ???? (??? ??)
          const nonResidentPurchasePassCount = (reservation as any).nonResidentPurchasePassCount || 0
          for (let i = 0; i < nonResidentPurchasePassCount; i++) {
            reservationCustomers.push({
              reservation_id: reservationId,
              customer_id: reservation.customerId,
              resident_status: 'non_resident_purchase_pass',
              pass_covered_count: 0,
              order_index: orderIndex++
            })
          }

          // reservation_customers ????????
          if (reservationCustomers.length > 0) {
            const { error: rcError } = await supabase
              .from('reservation_customers')
              .insert(reservationCustomers as any)

            if (rcError) {
              console.error('Error saving reservation_customers:', rcError)
            }
          }
        } catch (rcError) {
          console.error('Error saving reservation_customers:', rcError)
        }
      }

      // ????? ??????????????? ???(reservation_options) ??? ????
      const pendingOptions = (reservation as any).pendingReservationOptions as Array<{ option_id: string; ea?: number; price?: number; total_price?: number; status?: string; note?: string }> | undefined
      if (reservationId && Array.isArray(pendingOptions) && pendingOptions.length > 0) {
        try {
          for (const opt of pendingOptions) {
            if (!opt?.option_id) continue
            const resOpt = await fetch(`/api/reservation-options/${reservationId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                option_id: opt.option_id,
                ea: opt.ea ?? 1,
                price: opt.price ?? 0,
                total_price: opt.total_price ?? (Number(opt.price) || 0) * (opt.ea ?? 1),
                status: opt.status || 'active',
                note: opt.note || null
              })
            })
            if (!resOpt.ok) {
              const errData = await resOpt.json().catch(() => ({}))
              console.error('Error saving reservation option:', errData?.error || resOpt.statusText)
            }
          }
        } catch (roError) {
          console.error('Error saving reservation_options:', roError)
        }
      }

      // ??? ??? ??? ??? ??????
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (newReservation && (newReservation as any).id) {
        try {
          const tourResult = await autoCreateOrUpdateTour(
            reservation.productId,
            reservation.tourDate,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (newReservation as any).id,
            reservation.isPrivateTour
          )
          
          if (!tourResult.success || !tourResult.tourId) {
            console.warn('Tour creation failed:', tourResult.message)
          }
        } catch (tourError) {
          console.error('Error in tour auto-creation:', tourError)
        }
      }

      // Save choices to reservation_choices from selectedChoices or choices.required
      if (reservationId) {
        try {
          const UNDECIDED_OPTION_ID = '__undecided__' // "??" ????? reservation_choices???????? ???
          let choicesToSave: Array<{
            reservation_id: string
            choice_id: string
            option_id: string
            quantity: number
            total_price: number
          }> = []
          
          // 1. reservation.selectedChoices??? ??????(?????? 1 - ?? ???)
          if ((reservation as any).selectedChoices) {
            const selectedChoices = (reservation as any).selectedChoices

            if (Array.isArray(selectedChoices) && selectedChoices.length > 0) {
              for (const choice of selectedChoices) {
                if (choice.choice_id && choice.option_id && choice.option_id !== UNDECIDED_OPTION_ID) {
                  choicesToSave.push({
                    reservation_id: reservationId,
                    choice_id: choice.choice_id,
                    option_id: choice.option_id,
                    quantity: choice.quantity || 1,
                    total_price: choice.total_price || 0
                  })
                } else if (choice.option_id === UNDECIDED_OPTION_ID) {
                  // "??" ????? reservation_choices???????? ??? (choice_options FK ???)
                } else {
                  console.warn('?????????? choice_id ??? option_id? ??????:', choice)
                }
              }
            }
          }
          
          // 2. reservation.choices.required??? ??????(fallback)
          if (choicesToSave.length === 0 && reservation.choices && reservation.choices.required && Array.isArray(reservation.choices.required)) {
            for (const choice of reservation.choices.required) {
              if (choice.choice_id && choice.option_id && choice.option_id !== UNDECIDED_OPTION_ID) {
                choicesToSave.push({
                  reservation_id: reservationId,
                  choice_id: choice.choice_id,
                  option_id: choice.option_id,
                  quantity: choice.quantity || 1,
                  total_price: choice.total_price || 0
                })
              }
            }
          }
          
          
          if (choicesToSave.length > 0) {
            // option_id ??? ????? ?? ????(??? ??? ?????? ????? ?????????)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: choicesError } = await (supabase as any)
              .from('reservation_choices')
              .insert(choicesToSave)
              .select()

            if (choicesError) {
              console.error('???????????:', choicesError)
              console.error('??????????????', choicesToSave)
              console.error('??? ???:', {
                message: choicesError.message,
                details: choicesError.details,
                hint: choicesError.hint,
                code: choicesError.code
              })
              alert(t('messages.choicesSaveError') + choicesError.message)
            }
          } else {
            console.warn('????? ??????????? ??????.', {
              hasChoices: !!reservation.choices,
              choicesRequiredCount: Array.isArray(reservation.choices?.required) ? reservation.choices.required.length : 0,
              hasSelectedChoices: !!(reservation as any).selectedChoices,
              selectedChoicesCount: Array.isArray((reservation as any).selectedChoices) ? (reservation as any).selectedChoices.length : 0,
              selectedChoicesType: typeof (reservation as any).selectedChoices,
              selectedChoicesValue: (reservation as any).selectedChoices
            })
          }
        } catch (choicesError) {
          console.error('?????????????:', choicesError)
          // ?????????????? ????? ?????? ??
        }
      }

      // selected_options??reservations ????? selected_options ?????????
      // ????reservation_options ??????????? ??? ?????

      // ??????????? reservations ????? selected_option_prices ?????????
      // ????reservation_pricing ??????????? ??? ?????

      // Auto-create reservation_pricing row
      if (reservationId) {
        // pricingInfo? ??????????????
        const pricingInfo = (reservation as any).pricingInfo || {}
        try {
          const pricingId = crypto.randomUUID()
          // ??????????(????? = ??? ???????subtotal?total_price???????? ????
          const totalPeople = (reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)
          const notIncludedTotal = (pricingInfo.not_included_price || 0) * (totalPeople || 1)

          const pricingData = {
            id: pricingId,
            reservation_id: reservationId,
            adult_product_price: pricingInfo.adultProductPrice || 0,
            child_product_price: pricingInfo.childProductPrice || 0,
            infant_product_price: pricingInfo.infantProductPrice || 0,
            product_price_total: (pricingInfo.productPriceTotal || 0) + notIncludedTotal,
            not_included_price: pricingInfo.not_included_price || 0,
            required_options: pricingInfo.requiredOptions || {},
            required_option_total: pricingInfo.requiredOptionTotal || 0,
            choices: pricingInfo.choices || {},
            choices_total: pricingInfo.choicesTotal || 0,
            subtotal: (pricingInfo.subtotal || 0) + notIncludedTotal,
            coupon_code: pricingInfo.couponCode || null,
            coupon_discount: pricingInfo.couponDiscount || 0,
            additional_discount: pricingInfo.additionalDiscount || 0,
            additional_cost: pricingInfo.additionalCost || 0,
            refund_reason: String(pricingInfo.refundReason ?? '').trim() || null,
            refund_amount: Number(pricingInfo.refundAmount) || 0,
            card_fee: pricingInfo.cardFee || 0,
            tax: pricingInfo.tax || 0,
            prepayment_cost: pricingInfo.prepaymentCost || 0,
            prepayment_tip: pricingInfo.prepaymentTip || 0,
            selected_options: pricingInfo.selectedOptionalOptions || {},
            option_total: pricingInfo.optionTotal || 0,
            total_price: (pricingInfo.totalPrice || 0) + notIncludedTotal,
            deposit_amount: pricingInfo.depositAmount || 0,
            balance_amount: pricingInfo.balanceAmount || 0,
            private_tour_additional_cost: pricingInfo.privateTourAdditionalCost || 0,
            commission_percent: pricingInfo.commission_percent || 0,
            commission_amount: pricingInfo.commission_amount || 0,
            pricing_adults: Math.max(
              0,
              Math.floor(
                Number(
                  pricingInfo.pricingAdults ??
                    pricingInfo.pricing_adults ??
                    reservation.adults ??
                    0
                ) || 0
              )
            ),
          }


          const { error: pricingError } = await supabase
            .from('reservation_pricing')
            .insert(pricingData as any)
            .select()
            .single()

          if (pricingError) {
            console.error('reservation_pricing ??? ???:', pricingError)
            console.error('??????????????', pricingData)
            console.error('??? ???:', {
              message: pricingError.message,
              details: pricingError.details,
              hint: pricingError.hint,
              code: pricingError.code
            })
            alert(t('messages.pricingSaveError') + pricingError.message)
          }
        } catch (pricingError) {
          console.error('reservation_pricing ??? ?????:', pricingError)
          console.error('??? ???:', (pricingError as Error).stack)
          alert(t('messages.pricingSaveException') + (pricingError as Error).message)
        }
      } else {
        console.warn('reservationId? ??? reservation_pricing????????? ??????.', {
          reservationId,
          hasPricingInfo: !!(reservation as any).pricingInfo
        })
      }

      // payment_records ??? ??? (??????? ?????depositAmount??Deposit Received)
      if (reservationId && (reservation as any).pricingInfo) {
        try {
          const pricingInfo = (reservation as any).pricingInfo
          // ??????? ?????depositAmount ???
          const depositAmount = pricingInfo.depositAmount || 0
          
          if (depositAmount > 0) {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
              const response = await fetch('/api/payment-records', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  reservation_id: reservationId,
                  payment_status: 'Deposit Received',
                  amount: depositAmount,
                  payment_method: 'PAYM033'
                })
              })

              if (!response.ok) {
                const errorData = await response.json()
                console.error('payment_records ??? ???:', errorData.error)
              }
            }
          }
        } catch (paymentError) {
          console.error('payment_records ??? ?????:', paymentError)
        }
      }

      // ??? ???? ??? ???(??????? ??????? ?????, ????? ?? ????? ????? ???
      setShowAddForm(false)
      setNewReservationId(null)
      await refreshReservations()
      alert(t('messages.reservationAdded'))
    } catch (error) {
      console.error('handleAddReservation: ??? ??? ?????:', error)
      console.error('??? ???:', (error as Error).stack)
      alert(t('messages.reservationAddErrorGeneric') + ((error as Error).message || ''))
    } finally {
      isAddingReservationRef.current = false
    }
  }, [refreshReservations, operatorId, t, newReservationId])

  const handleEditReservation = useCallback(async (reservation: Omit<Reservation, 'id'>) => {
    if (!editingReservation) return
    try {
      const fullPayload = toReservationUpdatePayload(reservation as ReservationUpdatePayload)
      const result = await updateReservation(editingReservation.id, fullPayload)
      if (!result.success) {
        alert(t('messages.reservationUpdateError') + (result.error ?? ''))
        return
      }
      const savedId = editingReservation.id
      await refreshReservationPricingForActionRequired([savedId])
      void refreshReservations()
      setEditingReservation(null)
      alert(t('messages.reservationUpdated'))
    } catch (error) {
      console.error('Error updating reservation:', error)
      alert(t('messages.reservationUpdateError') + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }, [editingReservation, refreshReservationPricingForActionRequired, refreshReservations, t])



  // ??? ?? ???? ??? ???
  const checkTourExists = async (productId: string, tourDate: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('tours')
        .select('id, tour_status')
        .eq('product_id', productId)
        .eq('tour_date', tourDate)

      if (error) {
        console.error('Error checking tour existence:', error)
        return false
      }

      const rows = data || []
      return rows.some((row) => !isTourCancelled(row.tour_status))
    } catch (error) {
      console.error('Error checking tour existence:', error)
      return false
    }
  }

  // ??? ??? ??? - useCallback??? ????????
  const handleCreateTour = useCallback(async (reservation: Reservation) => {
    try {
      // ??? ???? ??????????? ??? ??? ???
      const tourExists = await checkTourExists(reservation.productId, reservation.tourDate)
      
      if (tourExists) {
        alert(t('messages.tourExists'))
        // ??? ?? ???????? ?? ??? ??
        await refreshReservations()
        return
      }

      const result = await autoCreateOrUpdateTour(
        reservation.productId,
        reservation.tourDate,
        reservation.id,
        reservation.isPrivateTour
      )

      if (result.success) {
        // ??? ??? ??? ??tour-photos ???????
        const bucketCreated = await createTourPhotosBucket()
        if (!bucketCreated) {
          console.warn('Failed to create tour-photos bucket, but tour creation succeeded')
        }
        
        alert(t('messages.tourCreated'))
        // ??? ?? ?????
        await refreshReservations()
      } else {
        alert(t('messages.tourCreationError') + result.message)
      }
    } catch (error) {
      console.error('Error creating tour:', error)
      alert(t('messages.tourCreationError'))
    }
  }, [refreshReservations, t])

  // ?????????? ??? ????? ?? ??? - useCallback??? ????????
  const handleCalendarReservationClick = useCallback((calendarReservation: { id: string }) => {
    const originalReservation = reservations.find(r => r.id === calendarReservation.id)
    if (originalReservation) {
      setEditingReservation(originalReservation)
    }
  }, [reservations])

  // ?????? ?? ??? - reservationPricingMap????? reservation??????? ????? ?? ???
  const handlePricingInfoClick = useCallback((reservation: Reservation) => {
    const pricing = reservationPricingMap.get(reservation.id)
    const reservationWithPricing = pricing
      ? {
          ...reservation,
          pricing: pricing as unknown as {
            adult_product_price?: number
            child_product_price?: number
            infant_product_price?: number
            [k: string]: unknown
          }
        }
      : reservation
    setPricingModalReservation(reservationWithPricing)
    setShowPricingModal(true)
  }, [reservationPricingMap])

  // ?????? ?? ??? - useCallback??? ????????
  const handleClosePricingModal = useCallback(() => {
    setShowPricingModal(false)
    setPricingModalReservation(null)
  }, [])
  const getTourDetailModalTitle = useCallback(
    (tourId: string) => {
      const tourMeta = tourInfoMap.get(tourId)
      const productId = tourMeta?.productId ?? null
      const productName =
        (products as Array<{ id: string; name?: string | null; name_ko?: string | null }>).find(
          (p) => p.id === productId
        )?.name_ko ||
        (products as Array<{ id: string; name?: string | null }>).find((p) => p.id === productId)?.name ||
        '투어'
      const tourDate = tourMeta?.tourDate ?? ''
      const [, m, d] = tourDate.split('-')
      const datePart = m && d ? `${m}/${d}` : ''
      return datePart ? `${datePart} ${productName}` : productName
    },
    [products, tourInfoMap]
  )

  const handleOpenTourDetailModal = useCallback(
    (tourId: string) => {
      setTourDetailModal({ tourId, title: getTourDetailModalTitle(tourId) })
    },
    [getTourDetailModalTitle]
  )

  /** 투어 상세 모달 JS 청크를 유휴 시간에 미리 받아 첫 클릭 지연을 줄임 */
  useEffect(() => {
    let cancelled = false
    const preload = () => {
      if (cancelled) return
      void import('@/components/tour/TourDetailModalContent')
    }
    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }).requestIdleCallback
    if (typeof ric === 'function') {
      const id = ric(preload, { timeout: 2500 })
      return () => {
        cancelled = true
        window.cancelIdleCallback?.(id)
      }
    }
    const t = window.setTimeout(preload, 1200)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [])


  // ????????? ?? ??? - useCallback??? ????????
  const handleOpenEmailPreview = useCallback((reservation: Reservation, emailType: 'confirmation' | 'departure' | 'pickup' | 'resident_inquiry') => {
    const customer = (customers as Customer[]).find(c => c.id === reservation.customerId)
    if (!customer) {
      alert(t('messages.customerNotLinkedForEmailPreview'))
      return
    }

    if (emailType === 'pickup' && (!reservation.pickUpTime || !reservation.tourDate)) {
      alert(t('messages.pickupAndTourDateRequired'))
      return
    }

    if (emailType === 'resident_inquiry') {
      const prod = (
        products as
          | Array<{
              id: string
              name?: string | null
              name_ko?: string | null
              name_en?: string | null
              customer_name_ko?: string | null
              customer_name_en?: string | null
              product_code?: string | null
              tags?: string[] | null
            }>
          | null
          | undefined
      )?.find((p) => p.id === reservation.productId)
      const emailIsEn = resolveReservationEmailIsEnglish(customer.language ?? null, null)
      const productNameForEmail =
        prod != null
          ? emailIsEn
            ? String(prod.customer_name_en || prod.name_en || prod.name || '').trim()
            : String(prod.customer_name_ko || prod.name_ko || prod.name || '').trim()
          : ''
      setEmailPreviewData({
        reservationId: reservation.id,
        emailType: 'resident_inquiry',
        customerEmail: customer.email ?? '',
        pickupTime: null,
        tourDate: reservation.tourDate,
        customerName: getCustomerName(reservation.customerId, (customers as Customer[]) || []) || customer.name || '',
        productName:
          productNameForEmail || getProductName(reservation.productId, products || []),
        channelRN: reservation.channelRN ?? null,
        customerLanguage: customer.language ?? null,
        productCode: prod?.product_code ?? null,
        productTags: prod?.tags ?? null,
      })
      setShowEmailPreview(true)
      setEmailDropdownOpen(null)
      return
    }

    setEmailPreviewData({
      reservationId: reservation.id,
      emailType,
      customerEmail: customer.email ?? '',
      pickupTime: reservation.pickUpTime,
      tourDate: reservation.tourDate
    })
    setShowEmailPreview(true)
    setEmailDropdownOpen(null)
  }, [customers, products])

  // ???????? ?? ??? - useCallback??? ????????
  const handleSendEmailFromPreview = useCallback(async (opts?: { includePriceInfo?: boolean }) => {
    if (!emailPreviewData) return

    if (!emailPreviewData.customerEmail?.trim()) {
      alert(t('messages.emailSendRequiresCustomerEmail'))
      return
    }

    const includePriceInfo = opts?.includePriceInfo !== false

    setSendingEmail(emailPreviewData.reservationId)

    try {
      let response: Response
      const customer = (customers as Customer[]).find(c => {
        const reservation = reservations.find(r => r.id === emailPreviewData.reservationId)
        return reservation && c.id === reservation.customerId
      })
      
      const locale = resolveReservationEmailLocale(customer?.language ?? null, null)

      if (emailPreviewData.emailType === 'resident_inquiry') {
        response = await fetchApiWithAuth('/api/send-resident-inquiry-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservationId: emailPreviewData.reservationId,
            locale,
            sentBy: user?.email || null,
          }),
        })
      } else if (emailPreviewData.emailType === 'confirmation') {
        // ??? ??? ?????
        response = await fetchApiWithAuth('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservationId: emailPreviewData.reservationId,
            email: emailPreviewData.customerEmail,
            type: 'both',
            locale,
            sentBy: user?.email || null,
            includePriceInfo
          })
        })
      } else if (emailPreviewData.emailType === 'departure') {
        // ??? ?? ??? ?????
        response = await fetchApiWithAuth('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservationId: emailPreviewData.reservationId,
            email: emailPreviewData.customerEmail,
            type: 'voucher',
            locale,
            sentBy: user?.email || null,
            includePriceInfo
          })
        })
      } else if (emailPreviewData.emailType === 'pickup') {
        // ??? notification ?????
        if (!emailPreviewData.pickupTime || !emailPreviewData.tourDate) {
          throw new Error('??? ???????? ???? ????????')
        }

        response = await fetchApiWithAuth('/api/send-pickup-schedule-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservationId: emailPreviewData.reservationId,
            pickupTime: emailPreviewData.pickupTime.includes(':') 
              ? emailPreviewData.pickupTime 
              : `${emailPreviewData.pickupTime}:00`,
            tourDate: emailPreviewData.tourDate,
            locale,
            sentBy: user?.email || null
          })
        })
      } else {
        throw new Error(t('messages.emailSendError'))
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '??????????????????.')
      }

      alert(t('messages.emailSendSuccess'))
      setShowEmailPreview(false)
      setEmailPreviewData(null)
    } catch (error) {
      console.error('??????? ???:', error)
      alert(error instanceof Error ? error.message : t('messages.emailSendError'))
    } finally {
      setSendingEmail(null)
    }
  }, [emailPreviewData, customers, reservations, user?.email, t])

  const closePickupTimeModalAndMaybeReshowSummary = useCallback(() => {
    const returnId = pendingReturnToPickupSummaryRef.current
    pendingReturnToPickupSummaryRef.current = null
    // 다음 틱에 닫아 같은 클릭이 픽업 요약 백드롭으로 떨어져 요약까지 닫히는 것을 방지
    window.setTimeout(() => {
      setShowPickupTimeModal(false)
      setSelectedReservationForPickupTime(null)
      setPickupTimeValue('')
      if (returnId) {
        setPickupSummaryReshowRequest({ reservationId: returnId, nonce: Date.now() })
      }
    }, 0)
  }, [])

  // ??? ??? ??? ?? ???
  const handlePickupTimeClick = useCallback(
    (reservation: Reservation, e: React.MouseEvent, opts?: { resumePickupSummary?: boolean }) => {
      e.stopPropagation()
      pendingReturnToPickupSummaryRef.current = opts?.resumePickupSummary ? reservation.id : null
      setSelectedReservationForPickupTime(reservation)
      // <input type="time"> 값은 HH:mm — DB의 HH:mm:ss 등을 정규화
      setPickupTimeValue(timeToHHmm(reservation.pickUpTime || '') || '')
      setShowPickupTimeModal(true)
    },
    []
  )

  // 픽업 시간 저장
  const handleSavePickupTime = useCallback(async () => {
    if (!selectedReservationForPickupTime) return

    try {
      const hhmm = timeToHHmm(pickupTimeValue || '')
      const timeValue = hhmm ? `${hhmm}:00` : null

      const { data: updatedRow, error } = await (supabase as any)
        .from('reservations')
        .update({ pickup_time: timeValue })
        .eq('id', selectedReservationForPickupTime.id)
        .select('id, pickup_time')
        .maybeSingle()

      if (error) {
        console.error('픽업 시간 업데이트 오류:', error)
        alert(t('messages.pickupTimeUpdateError'))
        return
      }

      if (!updatedRow) {
        console.error('픽업 시간 업데이트 실패: 권한이 없거나 행을 찾을 수 없음')
        alert(t('messages.pickupTimeUpdateError'))
        return
      }

      await refreshReservations()
      closePickupTimeModalAndMaybeReshowSummary()
    } catch (error) {
      console.error('픽업 시간 저장 오류:', error)
      alert(t('messages.pickupTimeSaveError'))
    }
  }, [selectedReservationForPickupTime, pickupTimeValue, refreshReservations, closePickupTimeModalAndMaybeReshowSummary, t])

  // ??? ??? ??? ?? ???
  const handlePickupHotelClick = useCallback(
    (reservation: Reservation, e: React.MouseEvent, opts?: { resumePickupSummary?: boolean }) => {
      e.stopPropagation()
      pendingReturnToPickupSummaryRef.current = opts?.resumePickupSummary ? reservation.id : null
      setSelectedReservationForPickupHotel(reservation)
      setHotelSearchTerm('')
      setShowPickupHotelModal(true)
    },
    []
  )

  const closePickupHotelModalAndMaybeReshowSummary = useCallback(() => {
    const returnId = pendingReturnToPickupSummaryRef.current
    pendingReturnToPickupSummaryRef.current = null
    window.setTimeout(() => {
      setShowPickupHotelModal(false)
      setSelectedReservationForPickupHotel(null)
      setHotelSearchTerm('')
      if (returnId) {
        setPickupSummaryReshowRequest({ reservationId: returnId, nonce: Date.now() })
      }
    }, 0)
  }, [])

  const consumePickupSummaryReshowRequest = useCallback(() => {
    setPickupSummaryReshowRequest(null)
  }, [])

  // ??? ??? ????
  const handleSavePickupHotel = useCallback(async (hotelId: string) => {
    if (!selectedReservationForPickupHotel) return

    try {
      const { error } = await (supabase as any)
        .from('reservations')
        .update({ pickup_hotel: hotelId || null })
        .eq('id', selectedReservationForPickupHotel.id)

      if (error) {
        console.error('??? ??? ?????? ???:', error)
        alert(t('messages.pickupHotelUpdateError'))
        return
      }

      await refreshReservations()
      closePickupHotelModalAndMaybeReshowSummary()
    } catch (error) {
      console.error('??? ??? ???????:', error)
      alert(t('messages.pickupHotelSaveError'))
    }
  }, [selectedReservationForPickupHotel, refreshReservations, closePickupHotelModalAndMaybeReshowSummary])

  // ???????? ??
  const filteredHotels = useMemo(() => {
    if (!hotelSearchTerm) {
      return pickupHotels || []
    }
    const searchLower = hotelSearchTerm.toLowerCase()
    return (pickupHotels || []).filter((hotel: {
      id: string
      hotel?: string | null
      name?: string | null
      name_ko?: string | null
      pick_up_location?: string | null
      address?: string | null
    }) => 
      hotel.hotel?.toLowerCase().includes(searchLower) ||
      hotel.name?.toLowerCase().includes(searchLower) ||
      hotel.name_ko?.toLowerCase().includes(searchLower) ||
      hotel.pick_up_location?.toLowerCase().includes(searchLower) ||
      hotel.address?.toLowerCase().includes(searchLower)
    )
  }, [hotelSearchTerm, pickupHotels])

  // ?? ??? ??????
  const getCustomerLanguage = useCallback((customerId: string) => {
    const customer = (customers as Customer[]).find(c => c.id === customerId)
    return customer?.language || 'ko'
  }, [customers])

  // ??? ?? ??????
  const getCountryCode = useCallback((language: string) => {
    const lang = language.toLowerCase()
    if (lang === 'kr' || lang === 'ko' || lang === '???') return 'KR'
    if (lang === 'en' || lang === '??') return 'US'
    if (lang === 'jp' || lang === '???') return 'JP'
    if (lang === 'cn' || lang === '???') return 'CN'
    return 'US'
  }, [])

  // ??? ?????????????- useCallback??? ????????
  const handlePaymentClick = useCallback((reservation: Reservation) => {
    setSelectedReservationForPayment(reservation)
    setShowPaymentRecords(true)
  }, [])

  const handleDetailClick = useCallback((reservation: Reservation) => {
    setSelectedReservationForDetail(reservation)
    setShowReservationDetailModal(true)
  }, [])

  const handleReceiptClick = useCallback((reservation: Reservation) => {
    setReceiptModalReservationId(reservation.id)
  }, [])

  const handleReviewClick = useCallback((reservation: Reservation) => {
    setSelectedReservationForReview(reservation)
    setShowReviewModal(true)
  }, [])

  const handleEditClick = useCallback((reservationId: string) => {
    const fromMain = reservations.find((r) => r.id === reservationId)
    const fromOperational = operationalQueueSnapshot?.reservations.find((r) => r.id === reservationId)
    const fromDeletedModal = deletedModalReservations.find((r) => r.id === reservationId)
    const originalReservation = fromMain ?? fromOperational ?? fromDeletedModal
    if (originalReservation) {
      setShowAddForm(false)
      setNewReservationId(null)
      setEditingReservation(originalReservation)
    } else {
      router.push(`/${locale}/admin/reservations/${reservationId}`)
    }
  }, [router, locale, reservations, operationalQueueSnapshot, deletedModalReservations])

  const handleCustomerClick = useCallback((customer: Customer) => {
    setEditingCustomer(customer)
  }, [])

  const handleStatusChange = useCallback(async (reservationId: string, newStatus: string) => {
    const normalized = (newStatus || '').toLowerCase()
    if (normalized === 'cancelled_rebooking') {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservationId)
      if (error) throw error
      await upsertReservationCancellationReason(reservationId, '재예약', user?.email ?? null)
      await refreshReservations()
      void refreshCancelReasonQueueStats()
      return
    }
    if (normalized === 'cancelled' || normalized === 'canceled') {
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', reservationId)
      if (error) throw error
      await refreshReservations()
      void refreshCancelReasonQueueStats()
      return
    }
    if (normalized === 'no_show') {
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', reservationId)
      if (error) throw error
      await upsertReservationCancellationReason(reservationId, 'No Show', user?.email ?? null)
      await applyNoShowReservationSideEffects(reservationId)
      await refreshReservations()
      return
    }
    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus })
      .eq('id', reservationId)
    if (error) throw error
    await refreshReservations()
  }, [refreshReservations, refreshCancelReasonQueueStats, user?.email])

  const patchOperationalQueueReservation = useCallback(
    (reservationId: string, patch: Partial<Reservation>) => {
      setOperationalQueueSnapshot((prev) => {
        if (!prev) return prev
        const idx = prev.reservations.findIndex((r) => r.id === reservationId)
        if (idx < 0) return prev
        const nextReservations = [...prev.reservations]
        nextReservations[idx] = { ...nextReservations[idx], ...patch }
        return { ...prev, reservations: nextReservations }
      })
    },
    []
  )

  const handleCommunicationChannelChange = useCallback(
    async (reservationId: string, channel: CustomerCommunicationChannel) => {
      const previous =
        reservations.find((r) => r.id === reservationId)?.customerCommunicationChannel ?? null
      patchReservationInList(reservationId, { customerCommunicationChannel: channel })
      patchOperationalQueueReservation(reservationId, { customerCommunicationChannel: channel })
      const { error } = await supabase
        .from('reservations')
        .update({ customer_communication_channel: channel })
        .eq('id', reservationId)
      if (error) {
        patchReservationInList(reservationId, { customerCommunicationChannel: previous })
        patchOperationalQueueReservation(reservationId, { customerCommunicationChannel: previous })
        throw error
      }
    },
    [reservations, patchReservationInList, patchOperationalQueueReservation]
  )

  const handlePreTourSmsSendSuccess = useCallback(
    (reservationId: string) => {
      patchReservationInList(reservationId, { customerCommunicationChannel: 'text_message' })
      patchOperationalQueueReservation(reservationId, {
        customerCommunicationChannel: 'text_message',
      })
    },
    [patchReservationInList, patchOperationalQueueReservation]
  )

  const handleEmailLogsClick = useCallback((reservationId: string) => {
    setSelectedReservationForEmailLogs(reservationId)
    setShowEmailLogs(true)
    setEmailDropdownOpen(null)
  }, [])

  const handleSmsLogsClick = useCallback((reservationId: string) => {
    setSelectedReservationForSmsLogs(reservationId)
    setShowSmsLogs(true)
  }, [])

  const handleEmailDropdownToggle = useCallback((reservationId: string | null) => {
    setEmailDropdownOpen(reservationId)
  }, [])

  // ???? ???? ?????- useCallback??? ????????
  const handleClearSearch = useCallback(() => {
    setSearchTerm('')
    setDebouncedSearchTerm('')
  }, [])

  const handleDeleteReservation = useCallback(async (id: string) => {
    if (!confirm(t('messages.reservationDeleteConfirmSoft'))) return
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'deleted' })
        .eq('id', id)

      if (error) {
        console.error('Error deleting reservation:', error)
        alert(t('messages.reservationDeleteError') + error.message)
        return
      }

      await refreshReservations()
      alert(t('messages.reservationDeleted'))
    } catch (error) {
      console.error('Error deleting reservation:', error)
      alert(t('messages.reservationDeleteErrorGeneric'))
    }
  }, [t, refreshReservations])

  // ?? ??? ???
  const handleAddCustomer = useCallback(async (customerData: Database['public']['Tables']['customers']['Insert']) => {
    try {
      // ?????????????????? ?????ISO ????? ???
      const getLasVegasToday = () => {
        const now = new Date()
        // ?????????????????? ?????????
        const lasVegasFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        })
        
        const parts = lasVegasFormatter.formatToParts(now)
        const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
        const month = parseInt(parts.find(p => p.type === 'month')?.value || '0')
        const day = parseInt(parts.find(p => p.type === 'day')?.value || '0')
        
        // ?????????????????? ??? ???(00:00:00)??UTC?????
        // ?????????????????? ???/?????????UTC ?????? ????? ???
        // ??? ?????UTC???????Date ???????? ?????????????????????????????????????
        const tempUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)) // ??????????? DST ?? ???
        
        // ??UTC ?????????????????????????????????
        const lasVegasFormatter2 = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
        
        const lasVegasParts = lasVegasFormatter2.formatToParts(tempUTC)
        const lvYear = parseInt(lasVegasParts.find(p => p.type === 'year')?.value || '0')
        const lvMonth = parseInt(lasVegasParts.find(p => p.type === 'month')?.value || '0')
        const lvDay = parseInt(lasVegasParts.find(p => p.type === 'day')?.value || '0')
        const lvHour = parseInt(lasVegasParts.find(p => p.type === 'hour')?.value || '0')
        const lvMinute = parseInt(lasVegasParts.find(p => p.type === 'minute')?.value || '0')
        const lvSecond = parseInt(lasVegasParts.find(p => p.type === 'second')?.value || '0')
        
        // ??????????????????/???????????? Date ?? ??? (?? ??????????)
        const lasVegasTime = new Date(lvYear, lvMonth - 1, lvDay, lvHour, lvMinute, lvSecond)
        
        // ??????? (??? ???)
        // tempUTC??UTC ??????, lasVegasTime?? ??UTC ???????????????????????? ??
        // ???????????? tempUTC - lasVegasTime (?????????? UTC?? ??????
        const offsetMs = tempUTC.getTime() - lasVegasTime.getTime()
        
        // ?????????????????? ??? ???(00:00:00)??UTC?????
        // ??????????????????/???????????? Date ?? ???
        const lasVegasDateLocal = new Date(year, month - 1, day, 0, 0, 0)
        const utcDate = new Date(lasVegasDateLocal.getTime() + offsetMs)
        
        return utcDate.toISOString()
      }
      
      // created_at???????????????????? ????????
      const customerDataWithDate = {
        ...customerData,
        created_at: getLasVegasToday()
      }
      
      const { customer, errorMessage } = await insertCustomerViaAdminApi(
        customerDataWithDate as Record<string, unknown>
      )

      if (errorMessage || !customer) {
        console.error('Error adding customer:', errorMessage)
        alert(t('messages.customerAddError') + (errorMessage || ''))
        return
      }

      mergeCustomers?.([customer as Customer])
      if (!mergeCustomers) {
        await refreshCustomers()
      }
      setShowCustomerForm(false)
      alert(t('messages.customerAdded'))

      if (showAddForm && customer) {
        alert(t('messages.newCustomerAdded').replace('{name}', customer.name || ''))
      }
    } catch (error) {
      console.error('Error adding customer:', error)
      alert(t('messages.customerAddErrorGeneric'))
    }
  }, [showAddForm, refreshCustomers, mergeCustomers, t])

  const reservationFormCatalogOptions: Option[] = (catalogOptions || []) as Option[]

  /** 헤더·필터는 유지하고, UI 복원·서버 목록만 본문 로딩에 반영.
   * products/channels(listCatalogLoading)는 카드에 상품명·채널명을 채우지만,
   * 카탈로그가 지연/멈춘 경우에도 예약 카드는 보여야 한다. */
  const calendarListLoading = serverListLoading || !!adminListChunkProgress
  const hasReservationListPaintData = reservations.length > 0
  const listContentStillPending =
    serverListLoading ||
    !!adminListChunkProgress ||
    (serverListTotal > 0 && filteredReservations.length === 0)
  const showMainBodyLoading =
    !reservationListUiHydrated ||
    (serverListLoading && !hasReservationListPaintData && viewMode !== 'calendar')
  const mainBodyLoadingHeadline = !reservationListUiHydrated
    ? t('loadingReservationData')
    : t('loadingReservationList')

  // Header/Filters 핸들러 — useCallback 으로 안정 참조를 만들어 React.memo 효과를 살린다.
  const handleHeaderSearchChange = useCallback(
    (term: string) => {
      setSearchTerm(term)
    },
    [setSearchTerm]
  )
  const handleSearchSubmit = useCallback(() => {
    setDebouncedSearchTerm(searchTerm)
    setViewMode('list')
  }, [searchTerm, setViewMode])
  const handleHeaderAddReservation = useCallback(() => {
    const newId = generateReservationId()
    setNewReservationId(newId)
    setShowAddForm(true)
  }, [])
  const handleOpenActionRequired = useCallback(() => setShowActionRequiredModal(true), [])
  const handleOpenFilter = useCallback(() => setFilterModalOpen(true), [])
  const handleOpenDeletedReservations = useCallback(() => setShowDeletedReservationsModal(true), [])
  const handleOpenFollowUpQueue = useCallback(() => setFollowUpQueueModalOpen(true), [])
  const handleFiltersStatusChange = useCallback(
    (status: string) => {
      setSelectedStatus(status)
      setCurrentPage(1)
    },
    [setSelectedStatus, setCurrentPage]
  )
  const handleFiltersChannelChange = useCallback(
    (channel: string) => {
      setSelectedChannel(channel)
      setCurrentPage(1)
    },
    [setSelectedChannel, setCurrentPage]
  )
  const handleFiltersDateRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange(range)
      setCurrentPage(1)
    },
    [setDateRange, setCurrentPage]
  )
  const handleFiltersItemsPerPageChange = useCallback(
    (items: number) => {
      setItemsPerPage(items)
      setCurrentPage(1)
    },
    [setItemsPerPage, setCurrentPage]
  )
  const handleFiltersReset = useCallback(() => {
    setSearchTerm('')
    setDebouncedSearchTerm('')
    setSelectedStatus('all')
    setSelectedChannel('all')
    setDateRange({ start: '', end: '' })
    setSortBy('created_at')
    setSortOrder('desc')
    setGroupByDate(true)
    setCurrentPage(1)
    setReservationListUi((u) => ({
      ...u,
      statisticsWeekOffset: 0,
      cardsWeekPage: 0,
    }))
  }, [
    setSearchTerm,
    setSelectedStatus,
    setSelectedChannel,
    setDateRange,
    setSortBy,
    setSortOrder,
    setGroupByDate,
    setCurrentPage,
    setReservationListUi,
  ])

  const renderReservationCard = useCallback(
    (reservation: Reservation) => {
      return (
        <ReservationCardItem
          key={reservation.id}
          reservation={reservation}
          customers={(customers as Customer[]) || []}
          products={(products as Array<{ id: string; name: string; sub_category?: string }>) || []}
          channels={(channels as Array<{ id: string; name: string; favicon_url?: string }>) || []}
          pickupHotels={
            (pickupHotels as Array<{
              id: string
              hotel?: string | null
              name?: string | null
              name_ko?: string | null
              pick_up_location?: string | null
            }>) || []
          }
          productOptions={(productOptions as Array<{ id: string; name: string; is_required?: boolean }>) || []}
          optionChoices={(optionChoices as Array<{ id: string; name: string }>) || []}
          tourInfoMap={tourInfoMap}
          reservationPricingMap={reservationPricingMap}
          locale={locale}
          onPricingInfoClick={handlePricingInfoClick}
          onCreateTour={handleCreateTour}
          onPickupTimeClick={handlePickupTimeClick}
          onPickupHotelClick={handlePickupHotelClick}
          onPaymentClick={handlePaymentClick}
          onDetailClick={handleDetailClick}
          onReceiptClick={handleReceiptClick}
          onReviewClick={handleReviewClick}
          onEmailPreview={handleOpenEmailPreview}
          onEmailLogsClick={handleEmailLogsClick}
          onEditClick={handleEditClick}
          onCustomerClick={handleCustomerClick}
          similarCustomerProductMap={productMapForCancelReasonQueue}
          operatorId={operatorId}
          onRefreshReservations={refreshReservations}
          onStatusChange={handleStatusChange}
          generatePriceCalculation={generatePriceCalculation}
          getGroupColorClasses={getGroupColorClasses}
          getSelectedChoicesFromNewSystem={getSelectedChoicesNormalized}
          choicesCacheRef={choicesCacheRef}
          residentCustomerBatchMap={residentCustomerBatchMap}
          linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
          onOpenTourDetailModal={handleOpenTourDetailModal}
          reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
          onReservationOptionsMutated={handleReservationOptionsMutated}
          reshowPickupSummaryRequest={pickupSummaryReshowRequest}
          onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
          followUpPipelineSnapshot={
            followUpSnapshotsByReservationId.has(reservation.id)
              ? followUpSnapshotsByReservationId.get(reservation.id)!
              : null
          }
          followUpPipelineSnapshotLoaded={followUpSnapshotsByReservationId.has(reservation.id)}
          onFollowUpPipelineManualChange={handleFollowUpPipelineManualChange}
          onCancelFollowUpManualChange={handleCancelFollowUpManualChange}
          onCommunicationChannelChange={handleCommunicationChannelChange}
          sentBy={user?.email ?? null}
          onPreTourSmsSendSuccess={handlePreTourSmsSendSuccess}
          onSmsLogsClick={handleSmsLogsClick}
        />
      )
    },
    [
      customers,
      products,
      channels,
      pickupHotels,
      productOptions,
      optionChoices,
      tourInfoMap,
      reservationPricingMap,
      locale,
      handlePricingInfoClick,
      handleCreateTour,
      handlePickupTimeClick,
      handlePickupHotelClick,
      handlePaymentClick,
      handleDetailClick,
      handleReceiptClick,
      handleReviewClick,
      handleOpenEmailPreview,
      handleEmailLogsClick,
      handleEditClick,
      handleCustomerClick,
      productMapForCancelReasonQueue,
      operatorId,
      refreshReservations,
      handleStatusChange,
      generatePriceCalculation,
      getGroupColorClasses,
      getSelectedChoicesNormalized,
      choicesCacheRef,
      residentCustomerBatchMap,
      tourIdByReservationId,
      handleOpenTourDetailModal,
      hookReservationOptionsPresenceByReservationId,
      handleReservationOptionsMutated,
      pickupSummaryReshowRequest,
      consumePickupSummaryReshowRequest,
      followUpSnapshotsByReservationId,
      handleFollowUpPipelineManualChange,
      handleCancelFollowUpManualChange,
      handleCommunicationChannelChange,
      user?.email,
      handlePreTourSmsSendSuccess,
    ]
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ??? - ????????*/}
      <ReservationsHeader
        customerIdFromUrl={customerIdFromUrl}
        customers={(customers as Customer[]) || []}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchTerm={searchTerm}
        onSearchChange={handleHeaderSearchChange}
        onSearchSubmit={handleSearchSubmit}
        onAddReservation={handleHeaderAddReservation}
        onActionRequired={handleOpenActionRequired}
        actionRequiredCount={headerActionRequiredCount}
        onOpenFilter={handleOpenFilter}
        onOpenDeletedReservations={handleOpenDeletedReservations}
        onOpenFollowUpQueue={handleOpenFollowUpQueue}
        followUpQueueCount={headerFollowUpQueueCount}
        onOpenCancelReasonQueue={handleOpenCancelReasonQueue}
        cancelReasonQueueCount={cancelReasonQueueStats.union}
        onPrefetchOperationalQueue={prefetchOperationalQueueSnapshot}
        {...(viewMode !== 'list' && (groupByDate || debouncedSearchTerm.trim().length > 0)
          ? { onOpenWeeklyStats: () => setWeeklyStatsModalOpen(true) }
          : {})}
      />

      {/* ???????: ????(???) + ??? ??(??? ??????? ???) */}
      <div className="md:hidden flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSearchSubmit()
              }
            }}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-ring focus:border-transparent text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleSearchSubmit}
          className="shrink-0 rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t('search')}
        </button>
        <button
          type="button"
          onClick={() => setFilterModalOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span>{t('filter')}</span>
        </button>
      </div>

      {/* ??? ??(??????) + ??? ?? */}
      <ReservationsFilters
        filterModalOpen={filterModalOpen}
        onFilterModalOpenChange={setFilterModalOpen}
        selectedStatus={selectedStatus}
        onStatusChange={handleFiltersStatusChange}
        selectedChannel={selectedChannel}
        onChannelChange={handleFiltersChannelChange}
        channels={(channels as Array<{ id: string; name: string }>) || []}
        dateRange={dateRange}
        onDateRangeChange={handleFiltersDateRangeChange}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        groupByDate={groupByDate}
        onGroupByDateChange={setGroupByDate}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleFiltersItemsPerPageChange}
        onReset={handleFiltersReset}
        listViewActive={viewMode === 'list'}
      />

      <Dialog open={weeklyStatsModalOpen} onOpenChange={setWeeklyStatsModalOpen}>
        <DialogContent className="max-h-[92vh] w-[min(100vw-1.5rem,72rem)] max-w-none gap-0 overflow-y-auto p-3 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>{t('stats.weeklyStatsModalTitle')}</DialogTitle>
          </DialogHeader>
          {weeklyStatsModalOpen && viewMode !== 'list' && (groupByDate || debouncedSearchTerm.trim().length > 0) ? (
            <WeeklyStatsPanel
              embeddedInModal
              currentWeek={statisticsWeekOffset}
              onWeekChange={setStatisticsWeekOffset}
              onInitialLoadChange={setIsInitialLoad}
              isInitialLoad={isInitialLoad}
              weeklyStats={weeklyStats}
              weeklyRegCancelByDay={regCancelChartRows}
              regCancelGranularity={regCancelGranularity}
              onRegCancelGranularityChange={setRegCancelGranularity}
              regCancelMonthOffset={regCancelMonthOffset}
              onRegCancelMonthOffsetChange={setRegCancelMonthOffset}
              regCancelYearOffset={regCancelYearOffset}
              onRegCancelYearOffsetChange={setRegCancelYearOffset}
              chartRangeSubtitle={regCancelChartRangeSubtitle}
              weekHeaderSummary={statisticsWeekHeaderSummary}
              formatWeekRange={formatWeekRange}
              weeklyRegCancelChartLoading={!!regCancelChartLoading}
              weeklyRegCancelChartYtdRefining={!!regCancelChartYtdRefining}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {groupByDate && viewMode !== 'list' && !showMainBodyLoading && (
        <div className="mb-4 flex flex-col gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <h3 className="min-w-0 flex-1 text-sm font-semibold text-gray-900 sm:flex-none">
              {t('stats.cardsListSectionTitle')}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setCardsWeekPage((p) => p - 1)}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-100"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setCardsWeekPage(0)}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  cardsWeekPage === 0
                    ? 'border border-primary bg-primary text-primary-foreground'
                    : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-100'
                }`}
              >
                {t('stats.cardsWeekNavCurrent')}
              </button>
              <button
                type="button"
                onClick={() => setCardsWeekPage((p) => p + 1)}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-100"
              >
                →
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-600 tabular-nums">{formatWeekRange(cardsWeekPage).display}</p>
        </div>
      )}

      {!showMainBodyLoading && (
        <div className="text-sm text-gray-600">
          {groupByDate && viewMode !== 'list' ? (
            <>
              {Object.values(groupedReservations).flat().length}
              {t('groupingLabels.reservationsGroupedBy')} {Object.keys(groupedReservations).length}
              {t('groupingLabels.registrationDates')}
              {Object.values(groupedReservations).flat().length !== serverListTotal && serverListTotal > 0 && (
                <span className="ml-2 text-primary">
                  ({t('groupingLabels.filteredFromTotal')} {serverListTotal}
                  {t('stats.more')})
                </span>
              )}
            </>
          ) : viewMode === 'list' ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {t('paginationDisplay', {
                  total: serverListTotal,
                  start: serverListTotal === 0 ? 0 : startIndex + 1,
                  end:
                    serverListTotal === 0
                      ? 0
                      : Math.min(startIndex + filteredReservations.length, serverListTotal),
                })}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="reservations-list-page-size" className="text-xs font-medium text-gray-700 whitespace-nowrap">
                  {t('listView.perPageLabel')}
                </label>
                <select
                  id="reservations-list-page-size"
                  value={[10, 20, 50, 100].includes(itemsPerPage) ? itemsPerPage : 20}
                  onChange={(e) => handleFiltersItemsPerPageChange(Number(e.target.value))}
                  disabled={serverListLoading}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-transparent focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                      {t('pagination.itemsPerPage')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <>
              {t('paginationDisplay', {
                total: serverListTotal,
                start: serverListTotal === 0 ? 0 : startIndex + 1,
                end:
                  serverListTotal === 0
                    ? 0
                    : Math.min(startIndex + filteredReservations.length, serverListTotal),
              })}
            </>
          )}
        </div>
      )}

      {showMainBodyLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm sm:p-12">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="mt-4 text-base font-semibold text-gray-900">{mainBodyLoadingHeadline}</p>
            {reservationsPageLoadingProgress.total > 0 && (
              <div className="mt-4 space-y-2 text-left">
                <div className="text-sm text-gray-600">
                  {reservationsPageLoadingProgress.current} / {reservationsPageLoadingProgress.total}{' '}
                  {t('reservationsLoading')}
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (reservationsPageLoadingProgress.current /
                          Math.max(reservationsPageLoadingProgress.total, 1)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round(
                    (reservationsPageLoadingProgress.current /
                      Math.max(reservationsPageLoadingProgress.total, 1)) *
                      100
                  )}
                  % {t('completed')}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : viewMode === 'calendar' ? (
        <ReservationCalendar 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reservations={calendarReservations as any} 
          onReservationClick={handleCalendarReservationClick}
          viewMonthOffset={calendarMonthOffset}
          onViewMonthOffsetChange={setCalendarMonthOffset}
          isLoading={calendarListLoading}
          loadingProgress={reservationsPageLoadingProgress}
        />
      ) : (
          /* ????*/
          <>
            {filteredReservations.length === 0 ? (
              listContentStillPending ? (
                <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm sm:p-12">
                  <div className="mx-auto max-w-md text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
                    <p className="mt-3 text-sm font-medium text-gray-700">{t('loadingReservationList')}</p>
                    {adminListChunkProgress && (
                      <p className="mt-2 text-xs text-gray-500 tabular-nums">
                        {adminListChunkProgress.loaded} / {adminListChunkProgress.total ?? adminListChunkProgress.loaded}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <ReservationsEmptyState
                  hasSearchTerm={debouncedSearchTerm.trim().length > 0}
                  searchTerm={debouncedSearchTerm}
                  hasDateRange={!!(dateRange.start && dateRange.end)}
                  dateRangeStart={dateRange.start}
                  dateRangeEnd={dateRange.end}
                  onClearSearch={handleClearSearch}
                  variant="grid"
                />
              )
            ) : groupByDate && viewMode !== 'list' ? (
          /* ?????????? ????*/
          <div className="space-y-8">
            {Object.keys(groupedReservations).length === 0 ? (
              /* ???????? ????? ??? */
              <ReservationsEmptyState
                hasSearchTerm={false}
                searchTerm=""
                hasDateRange={!!(dateRange.start && dateRange.end)}
                dateRangeStart={dateRange.start}
                dateRangeEnd={dateRange.end}
                variant="calendar"
              />
            ) : (
              Object.entries(groupedReservations).map(([date, reservations]) => {
                const handleToggleCollapse = () => toggleGroupCollapse(date)
                const dayReservations = reservations as Reservation[]
                const { registration: regList, statusChange: statusListFromUpdated } =
                  splitReservationsByActivityForDate(date, dayReservations)

                /** 이벤트(occurred_at) 로컬일 기준 — updated_at 그룹과 달라도 당일 상태 전환이 보이게 */
                const simpleCardStatusAuditReady =
                  !simpleCardStatusTransitionLoadingEffective &&
                  simpleCardStatusScopeKey != null &&
                  simpleCardStatusTransitionDisplayScopeKey === simpleCardStatusScopeKey

                const statusListFromEvents = simpleCardStatusAuditReady
                  ? dayReservations.filter(
                      (r) =>
                        !!simpleCardStatusTransitionMap[`${r.id}|${date}`] &&
                        isoToLocalCalendarDateKey(r.addedTime) !== date
                    )
                  : statusListFromUpdated
                /** events·audit 미동기화 시에도 수정일 기준 후보는 유지(빈 섹션 방지) */
                const statusList =
                  simpleCardStatusAuditReady && statusListFromEvents.length === 0
                    ? statusListFromUpdated
                    : statusListFromEvents

                const statusListForSimple = statusList

                const gridClass = 'admin-reservations-card-grid admin-reservations-card-grid--simple'

                const simpleCardStatusSubgroups =
                  statusListForSimple.length > 0 && !simpleCardStatusTransitionLoadingEffective
                    ? (() => {
                        const buckets = new Map<string, Reservation[]>()
                        for (const r of statusListForSimple) {
                          const tr = simpleCardStatusTransitionMap[`${r.id}|${date}`]
                          const bucketKey = tr ? `${tr.from}\u0000${tr.to}` : '__unknown__'
                          const arr = buckets.get(bucketKey) ?? []
                          arr.push(r)
                          buckets.set(bucketKey, arr)
                        }
                        const rows: {
                          bucketKey: string
                          title: string
                          items: Reservation[]
                          sortIx: number
                        }[] = []
                        for (const [bucketKey, items] of buckets.entries()) {
                          let title: string
                          let sortIx: number
                          if (bucketKey === '__unknown__') {
                            title = t('groupingLabels.simpleCardStatusTransitionUnknown')
                            sortIx = 10000
                          } else {
                            const sep = bucketKey.indexOf('\0')
                            const from = bucketKey.slice(0, sep)
                            const to = bucketKey.slice(sep + 1)
                            title = `${getStatusLabel(from, (key) => t(key))} → ${getStatusLabel(to, (key) => t(key))}`
                            sortIx = statusTransitionSortIndex(from, to)
                          }
                          rows.push({ bucketKey, title, items, sortIx })
                        }
                        rows.sort((a, b) => {
                          if (a.sortIx !== b.sortIx) return a.sortIx - b.sortIx
                          return a.title.localeCompare(b.title, 'ko')
                        })
                        return rows
                      })()
                    : null

                const cancellationStatsForHeader = simpleCardStatusTransitionLoadingEffective
                  ? ({ mode: 'audit-loading' as const } as const)
                  : ({
                      mode: 'audit' as const,
                      reservations: dayReservations.filter((r) => {
                        const st = (r.status || '').toLowerCase()
                        if (st !== 'cancelled' && st !== 'canceled' && st !== 'deleted') return false
                        /** 당일 등록 건은 등록 집계에만 포함 — 취소 집계에서 중복 제외 */
                        if (isoToLocalCalendarDateKey(r.addedTime) === date) return false
                        const tr = simpleCardStatusTransitionMap[`${r.id}|${date}`]
                        return isIntoCancelledLikeTransition(tr)
                      }),
                    } as const)

                return (
                  <div key={date} className="space-y-4">
                    <DateGroupHeader
                      date={date}
                      reservations={dayReservations}
                      isCollapsed={!expandedDateGroups.has(date)}
                      onToggleCollapse={handleToggleCollapse}
                      customers={(customers as Array<{ id: string; name?: string }>) || []}
                      products={(products as Array<{ id: string; name: string }>) || []}
                      channels={(channels as Array<{ id: string; name: string; favicon_url?: string }>) || []}
                      cancellationStats={cancellationStatsForHeader}
                      {...(groupByDate && regCancelChartAuditReady
                        ? { auditRowsByReservationId: regCancelChartAuditRowsByRecordId }
                        : {})}
                      {...(groupByDate ? { statusAuditLoading: !regCancelChartAuditReady } : {})}
                      cancellationReasonByReservationId={cancellationReasonByReservationId}
                    />

                    <div className="space-y-4">
                        {(() => {
                          const accRegKey = `${date}|simple-acc-reg`
                          const accStatusKey = `${date}|simple-acc-status`
                          const defaultRegOpen = true
                          const defaultStatusOpen = false
                          const regOpen = resolveSimpleCardAccordionOpen(accRegKey, defaultRegOpen)
                          const statusOpen = resolveSimpleCardAccordionOpen(accStatusKey, defaultStatusOpen)
                          const regPeopleTotal = regList.reduce(
                            (sum, r) =>
                              sum + getReservationPartySize(r as unknown as Record<string, unknown>),
                            0
                          )
                          return (
                            <>
                              <div className="rounded-lg border border-gray-200 bg-white">
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                                  onClick={() => toggleSimpleCardAccordion(accRegKey, defaultRegOpen)}
                                  aria-expanded={regOpen}
                                >
                                  <span className="text-sm font-semibold text-gray-900 flex items-baseline gap-2 min-w-0 flex-wrap">
                                    <span>{t('groupingLabels.simpleCardGroupRegistration')}</span>
                                    <span className="text-xs font-normal text-gray-500 tabular-nums">
                                      {t('groupingLabels.simpleCardRegistrationSummary', {
                                        count: regList.length,
                                        people: regPeopleTotal,
                                      })}
                                    </span>
                                  </span>
                                  <ChevronDown
                                    className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${regOpen ? 'rotate-180' : ''}`}
                                    aria-hidden
                                  />
                                </button>
                                {regOpen && (
                                  <div className="border-t border-gray-100 pl-3 pr-2 pb-3 pt-2">
                                    {regList.length > 0 ? (
                                      <AdminReservationCardVirtualGrid
                                        reservations={regList}
                                        gridClassName={gridClass}
                                        renderCard={(r) => renderReservationCard(r)}
                                        onRenderedReservationIds={(ids) =>
                                          handleFollowUpRenderedReservationIds(`${date}-reg`, ids)
                                        }
                                      />
                                    ) : (
                                      <p className="text-xs text-gray-400 px-1 py-1">
                                        {t('groupingLabels.simpleCardGroupEmpty')}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="rounded-lg border border-gray-200 bg-white">
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                                  onClick={() => toggleSimpleCardAccordion(accStatusKey, defaultStatusOpen)}
                                  aria-expanded={statusOpen}
                                >
                                  <span className="text-sm font-semibold text-gray-900 flex items-baseline gap-2 min-w-0 flex-wrap">
                                    <span>{t('groupingLabels.simpleCardGroupStatusChange')}</span>
                                    <span className="text-xs font-normal text-gray-500 tabular-nums">
                                      {simpleCardStatusTransitionLoadingEffective
                                        ? t('groupingLabels.simpleCardStatusChangeAuditLoadingBadge')
                                        : t('groupingLabels.simpleCardRegistrationSummary', {
                                            count: statusListForSimple.length,
                                            people: statusListForSimple.reduce(
                                              (sum, r) =>
                                                sum +
                                                getReservationPartySize(r as unknown as Record<string, unknown>),
                                              0
                                            ),
                                          })}
                                    </span>
                                  </span>
                                  <ChevronDown
                                    className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${statusOpen ? 'rotate-180' : ''}`}
                                    aria-hidden
                                  />
                                </button>
                                {statusOpen && (
                                  <div className="border-t border-gray-100 pl-3 pr-2 pb-3 pt-2 space-y-3">
                                    {statusList.length > 0 ? (
                                      simpleCardStatusTransitionLoadingEffective ? (
                                        <p className="text-xs text-gray-500 px-1 py-2 leading-relaxed">
                                          {t('groupingLabels.simpleCardStatusChangeAuditLoadingBody')}
                                        </p>
                                      ) : statusListForSimple.length === 0 ? (
                                        <p className="text-xs text-gray-400 px-1 py-1">
                                          {t('groupingLabels.simpleCardGroupEmpty')}
                                        </p>
                                      ) : simpleCardStatusSubgroups ? (
                                        simpleCardStatusSubgroups.map((g, subIdx) => {
                                          const subKey = `${date}|simple-acc-status-sub|${subIdx}`
                                          const defaultSubOpen = false
                                          const subOpen = resolveSimpleCardAccordionOpen(subKey, defaultSubOpen)
                                          const subPeopleTotal = g.items.reduce(
                                            (sum, r) =>
                                              sum +
                                              getReservationPartySize(r as unknown as Record<string, unknown>),
                                            0
                                          )
                                          return (
                                            <div
                                              key={`${date}-sub-${subIdx}-${g.bucketKey}`}
                                              className="rounded-md border border-gray-100 bg-gray-50/80"
                                            >
                                              <button
                                                type="button"
                                                className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-gray-100/80 transition-colors"
                                                onClick={() => toggleSimpleCardAccordion(subKey, defaultSubOpen)}
                                                aria-expanded={subOpen}
                                              >
                                                <span className="text-xs font-semibold text-gray-800 flex items-baseline gap-2 min-w-0 flex-wrap">
                                                  <span className="truncate">{g.title}</span>
                                                  <span className="text-xs font-normal text-gray-500 tabular-nums flex-shrink-0">
                                                    {t('groupingLabels.simpleCardRegistrationSummary', {
                                                      count: g.items.length,
                                                      people: subPeopleTotal,
                                                    })}
                                                  </span>
                                                </span>
                                                <ChevronDown
                                                  className={`h-3.5 w-3.5 flex-shrink-0 text-gray-500 transition-transform ${subOpen ? 'rotate-180' : ''}`}
                                                  aria-hidden
                                                />
                                              </button>
                                              {subOpen && (
                                                <div className="border-t border-gray-100 bg-white pl-3 pr-2 pb-2 pt-2">
                                                  <AdminReservationCardVirtualGrid
                                                    reservations={g.items}
                                                    gridClassName={gridClass}
                                                    renderCard={(r) => renderReservationCard(r)}
                                                    onRenderedReservationIds={(ids) =>
                                                      handleFollowUpRenderedReservationIds(
                                                        `${date}-status-${g.bucketKey}`,
                                                        ids
                                                      )
                                                    }
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })
                                      ) : null
                                    ) : (
                                      <p className="text-xs text-gray-400 px-1 py-1">
                                        {t('groupingLabels.simpleCardGroupEmpty')}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                  </div>
                )
              })
            )
            }
          </div>
        ) : (
          /* ??? ????- ????? ????? ??????? ??? */
          paginatedReservations.length === 0 ? (
            /* ???????? ????? ??? */
            <ReservationsEmptyState
              hasSearchTerm={debouncedSearchTerm.trim().length > 0}
              searchTerm={debouncedSearchTerm}
              hasDateRange={!!(dateRange.start && dateRange.end)}
              dateRangeStart={dateRange.start}
              dateRangeEnd={dateRange.end}
              onClearSearch={() => {
                setSearchTerm('')
                setDebouncedSearchTerm('')
              }}
              variant="grid"
            />
          ) : (
            <div className="space-y-4">
              <AdminReservationCardVirtualGrid
                reservations={paginatedReservations}
                gridClassName="admin-reservations-card-grid admin-reservations-card-grid--simple"
                renderCard={(r) => renderReservationCard(r)}
                onRenderedReservationIds={(ids) => handleFollowUpRenderedReservationIds('flat-list', ids)}
              />
            </div>
          )
        )
            }
          </>
        )
      }
      
      {/* ?????????- ??????? ??? (?????? ???? ?????) */}
      {(!groupByDate || viewMode === 'list') && totalPages > 1 && (
        <ReservationsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={serverListTotal}
          onPageChange={setCurrentPage}
        />
      )}

      {/* ??? ???/??? ?? */}
      {(showAddForm || editingReservation) && (
        <ReservationForm
          reservation={editingReservation || (newReservationId ? { id: newReservationId } as Reservation : null)}
          customers={customers || []}
          products={products || []}
          channels={(channels || []) as Channel[]}
          productOptions={productOptions || []}
          options={reservationFormCatalogOptions}
          pickupHotels={(pickupHotels || []) as PickupHotel[]}
          coupons={(coupons || []) as { id: string; coupon_code: string; discount_type: 'percentage' | 'fixed'; [key: string]: unknown }[]}
          onSubmit={editingReservation ? handleEditReservation : handleAddReservation}
          isNewReservation={showAddForm && !editingReservation}
          onCancel={() => {
            setShowAddForm(false)
            setNewReservationId(null)
            setEditingReservation(null)
          }}
          onRefreshCustomers={refreshCustomers}
          onDelete={handleDeleteReservation}
          layout="modal"
          allowPastDateEdit={isSuper}
          useServerCustomerInsert
          followUpPipelineSnapshotRefreshToken={followUpFormPipelineRefresh}
          titleAction={
            editingReservation ? (
              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handleReceiptClick(editingReservation)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                  title={t('print') || '????????'}
                >
                  <Printer className="w-5 h-5" />
                </button>
                <div className="hidden sm:block h-6 w-px bg-gray-200 shrink-0" aria-hidden />
                <ReservationFormEmailSendButtons
                  reservation={editingReservation}
                  customers={(customers || []) as Customer[]}
                  sentBy={user?.email ?? null}
                  uiLocale={locale === 'en' ? 'en' : 'ko'}
                  onSendSuccess={() => setFollowUpFormPipelineRefresh((n) => n + 1)}
                />
                <ReservationFormSmsSendButton
                  reservation={editingReservation}
                  customers={(customers || []) as Customer[]}
                  sentBy={user?.email ?? null}
                  uiLocale={locale === 'en' ? 'en' : 'ko'}
                  onSendSuccess={() => setFollowUpFormPipelineRefresh((n) => n + 1)}
                />
              </div>
            ) : undefined
          }
        />
      )}

      {/* ?? ??? ?? */}
      {showCustomerForm && (
        <CustomerForm
          customer={null}
          channels={channels || []}
          onSubmit={handleAddCustomer}
          onCancel={() => setShowCustomerForm(false)}
        />
      )}

      {/* 고객 정보 수정 + 유사 고객 예약 카드 */}
      {editingCustomer && (
        <CustomerEditSimilarReservationsModal
          customer={editingCustomer}
          allCustomers={(customers as Customer[]) || []}
          channels={channels || []}
          productMap={productMapForCancelReasonQueue}
          operatorId={operatorId}
          locale={locale}
          onCustomerClick={handleCustomerClick}
          onReservationsLoaded={(loaded) => {
            const ids = loaded.map((r) => r.id)
            if (ids.length > 0) {
              void refreshReservationPricingForIds(ids)
              void refreshReservationOptionsPresenceForIds(ids)
            }
          }}
          onSimilarCustomersLoaded={(loaded) => {
            mergeCustomers?.(loaded)
          }}
          renderReservationCard={(r) => renderReservationCard(r)}
          onSubmit={async (customerData) => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (supabase as any)
                .from('customers')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .update(customerData as any)
                .eq('id', editingCustomer.id)

              if (error) {
                console.error('Error updating customer:', error)
                alert(t('messages.customerUpdateError') + error.message)
                return
              }

              await refreshCustomers()
              setEditingCustomer(null)
              alert(t('messages.customerUpdated'))
            } catch (error) {
              console.error('Error updating customer:', error)
              alert(t('messages.customerUpdateErrorGeneric'))
            }
          }}
          onCancel={() => setEditingCustomer(null)}
          onDelete={async () => {
            if (confirm(t('messages.confirmDeleteCustomer'))) {
              try {
                const { error } = await supabase
                  .from('customers')
                  .delete()
                  .eq('id', editingCustomer.id)

                if (error) {
                  console.error('Error deleting customer:', error)
                  alert(t('messages.customerDeleteError') + error.message)
                  return
                }

                await refreshCustomers()
                setEditingCustomer(null)
                alert(t('messages.customerDeleted'))
              } catch (error) {
                console.error('Error deleting customer:', error)
                alert(t('messages.customerDeleteErrorGeneric'))
              }
            }
          }}
        />
      )}

      {/* ?????? ?? */}
      <PricingInfoModal
        reservation={pricingModalReservation}
        isOpen={showPricingModal}
        onClose={handleClosePricingModal}
      />

      {/* ??? ??? ?? */}
      {showPaymentRecords && selectedReservationForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                ??? ??? ???- {getCustomerName(selectedReservationForPayment.customerId, (customers as Customer[]) || [])}
              </h2>
              <button
                onClick={() => {
                  setShowPaymentRecords(false)
                  setSelectedReservationForPayment(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
              <PaymentRecordsList
                reservationId={selectedReservationForPayment.id}
                customerName={getCustomerName(selectedReservationForPayment.customerId, (customers as Customer[]) || [])}
                suggestedCancelRefundAmountUsd={
                  Number(reservationPricingMap.get(selectedReservationForPayment.id)?.deposit_amount) || 0
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ???????? ?? (??? ????? ???) */}
      {receiptModalReservationId && (
        <CustomerReceiptModal
          isOpen={!!receiptModalReservationId}
          onClose={() => setReceiptModalReservationId(null)}
          reservationId={receiptModalReservationId}
        />
      )}

      {/* ??? ?? ??? ?? */}
      <ReservationActionRequiredModal
        isOpen={showActionRequiredModal}
        onClose={() => setShowActionRequiredModal(false)}
        bulkReservationsLoading={operationalQueueLoading && !operationalQueueSnapshot}
        bulkReservationsSyncing={operationalQueueLoading && !!operationalQueueSnapshot}
        reservations={pickReservationsForOperationalQueue(operationalQueueSnapshot, reservations)}
        customers={(customers as Customer[]) || []}
        products={(products as Array<{ id: string; name: string; sub_category?: string; base_price?: number }>) || []}
        channels={
          (channels as Array<{
            id: string
            name: string
            favicon_url?: string | null
            type?: string | null
            category?: string | null
            commission_percent?: number | null
          }>) || []
        }
        pickupHotels={(pickupHotels as Array<{ id: string; hotel?: string | null; name?: string | null; name_ko?: string | null; pick_up_location?: string | null }>) || []}
        productOptions={(productOptions as Array<{ id: string; name: string; is_required?: boolean }>) || []}
        optionChoices={(optionChoices as Array<{ id: string; name: string; option_id?: string; adult_price?: number; child_price?: number; infant_price?: number }>) || []}
        tourInfoMap={tourInfoMap}
        reservationPricingMap={pricingForOperationalMetrics}
        locale={locale}
        onPricingInfoClick={handlePricingInfoClick}
        onCreateTour={handleCreateTour}
        onPickupTimeClick={handlePickupTimeClick}
        onPickupHotelClick={handlePickupHotelClick}
        onPaymentClick={handlePaymentClick}
        onDetailClick={handleDetailClick}
        onReviewClick={handleReviewClick}
        onEmailPreview={handleOpenEmailPreview}
        onEmailLogsClick={handleEmailLogsClick}
        onEmailDropdownToggle={(id) => handleEmailDropdownToggle(id)}
        onEditClick={handleEditClick}
        onExitOneByOneEdit={() => {
          setEditingReservation(null)
        }}
        onCustomerClick={handleCustomerClick}
        onRefreshReservations={refreshReservations}
        onRefreshTableList={refreshActionRequiredTableList}
        onRefreshReservationPricing={refreshReservationPricingForActionRequired}
        onStatusChange={handleStatusChange}
        generatePriceCalculation={generatePriceCalculation}
        getGroupColorClasses={getGroupColorClasses}
        getSelectedChoicesFromNewSystem={getSelectedChoicesNormalized}
        choicesCacheRef={choicesCacheRef}
        emailDropdownOpen={emailDropdownOpen}
        sendingEmail={sendingEmail}
        tourIdByReservationId={tourIdByReservationId}
        reshowPickupSummaryRequest={pickupSummaryReshowRequest}
        onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
      />

      <CancelledMissingReasonModal
        isOpen={cancelReasonQueueOpen}
        onClose={() => setCancelReasonQueueOpen(false)}
        locale={locale}
        productMap={productMapForCancelReasonQueue}
        tourMap={tourMapForCancelReasonQueue}
        onDataLoaded={(payload) => {
          setCancelReasonQueueStats({
            union: payload.unionCount,
            needsFollowUp: payload.needsFollowUpCount,
            awaitingReason: payload.awaitingReasonCount,
          })
        }}
        onQueueChanged={() => {
          // 저장 직후 서버 재조회는 낙관적 제거를 되돌릴 수 있어 지연 동기화만 수행
          window.setTimeout(() => {
            void refreshCancelReasonQueueStats()
          }, 2500)
        }}
        onCustomersLoaded={(rows) => {
          mergeCustomers?.(rows)
        }}
        renderSimpleReservationCard={(reservation, { onReasonSaved, queueCustomers }) => {
          const pageCustomers = (customers as Customer[]) || []
          const extraQueueCustomers = queueCustomers.filter(
            (q) => !pageCustomers.some((p) => p.id === q.id)
          )
          const cardCustomers = extraQueueCustomers.length
            ? [...pageCustomers, ...extraQueueCustomers]
            : pageCustomers

          return (
          <ReservationCardItem
            reservation={reservation}
            customers={cardCustomers}
            products={(products as Array<{ id: string; name: string; sub_category?: string }>) || []}
            channels={(channels as Array<{ id: string; name: string; favicon_url?: string }>) || []}
            pickupHotels={
              (pickupHotels as Array<{
                id: string
                hotel?: string | null
                name?: string | null
                name_ko?: string | null
                pick_up_location?: string | null
              }>) || []
            }
            productOptions={(productOptions as Array<{ id: string; name: string; is_required?: boolean }>) || []}
            optionChoices={(optionChoices as Array<{ id: string; name: string }>) || []}
            tourInfoMap={tourInfoMap}
            reservationPricingMap={reservationPricingMap}
            locale={locale}
            onPricingInfoClick={handlePricingInfoClick}
            onCreateTour={handleCreateTour}
            onPickupTimeClick={handlePickupTimeClick}
            onPickupHotelClick={handlePickupHotelClick}
            onPaymentClick={handlePaymentClick}
            onDetailClick={handleDetailClick}
            onReceiptClick={handleReceiptClick}
            onReviewClick={handleReviewClick}
            onEmailPreview={handleOpenEmailPreview}
            onEmailLogsClick={handleEmailLogsClick}
            onEditClick={(id) => {
              handleEditClick(id)
              setCancelReasonQueueOpen(false)
            }}
            onCustomerClick={handleCustomerClick}
            similarCustomerProductMap={productMapForCancelReasonQueue}
            operatorId={operatorId}
            showSimilarCustomerReservationsHint={false}
            onRefreshReservations={refreshReservations}
            onStatusChange={handleStatusChange}
            generatePriceCalculation={generatePriceCalculation}
            getGroupColorClasses={getGroupColorClasses}
            getSelectedChoicesFromNewSystem={getSelectedChoicesNormalized}
            choicesCacheRef={choicesCacheRef}
            residentCustomerBatchMap={residentCustomerBatchMap}
            linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
            onOpenTourDetailModal={handleOpenTourDetailModal}
            reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
            onReservationOptionsMutated={handleReservationOptionsMutated}
            reshowPickupSummaryRequest={pickupSummaryReshowRequest}
            onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
            followUpPipelineSnapshot={
            followUpSnapshotsByReservationId.has(reservation.id)
              ? followUpSnapshotsByReservationId.get(reservation.id)!
              : null
          }
          followUpPipelineSnapshotLoaded={followUpSnapshotsByReservationId.has(reservation.id)}
            onFollowUpPipelineManualChange={handleFollowUpPipelineManualChange}
            onCancelFollowUpManualChange={handleCancelFollowUpManualChange}
            onCommunicationChannelChange={handleCommunicationChannelChange}
            sentBy={user?.email ?? null}
            onPreTourSmsSendSuccess={handlePreTourSmsSendSuccess}
          onSmsLogsClick={handleSmsLogsClick}
            onCancellationReasonSaved={() => onReasonSaved(reservation.id)}
          />
          )
        }}
      />

      <ReservationFollowUpQueueModal
        isOpen={followUpQueueModalOpen}
        onClose={() => setFollowUpQueueModalOpen(false)}
        bulkReservationsLoading={operationalQueueLoading && !operationalQueueSnapshot}
        bulkReservationsSyncing={operationalQueueLoading && !!operationalQueueSnapshot}
        reservations={reservationsForFollowUpPipeline as Reservation[]}
        customers={(customers as Customer[]) || []}
        snapshotsByReservationId={followUpSnapshotsByReservationId}
        loadingSnapshots={followUpSnapshotsLoading}
        onCancelFollowUpManualChange={handleCancelFollowUpManualChange}
        cancellationReasonByReservationId={cancellationReasonByReservationId}
        renderSimpleReservationCard={(reservation) => (
          <ReservationCardItem
            reservation={reservation}
            customers={(customers as Customer[]) || []}
            products={(products as Array<{ id: string; name: string; sub_category?: string }>) || []}
            channels={(channels as Array<{ id: string; name: string; favicon_url?: string }>) || []}
            pickupHotels={
              (pickupHotels as Array<{
                id: string
                hotel?: string | null
                name?: string | null
                name_ko?: string | null
                pick_up_location?: string | null
              }>) || []
            }
            productOptions={(productOptions as Array<{ id: string; name: string; is_required?: boolean }>) || []}
            optionChoices={(optionChoices as Array<{ id: string; name: string }>) || []}
            tourInfoMap={tourInfoMap}
            reservationPricingMap={reservationPricingMap}
            locale={locale}
            onPricingInfoClick={handlePricingInfoClick}
            onCreateTour={handleCreateTour}
            onPickupTimeClick={handlePickupTimeClick}
            onPickupHotelClick={handlePickupHotelClick}
            onPaymentClick={handlePaymentClick}
            onDetailClick={handleDetailClick}
            onReceiptClick={handleReceiptClick}
            onReviewClick={handleReviewClick}
            onEmailPreview={handleOpenEmailPreview}
            onEmailLogsClick={handleEmailLogsClick}
            onEditClick={(id) => {
              handleEditClick(id)
              setFollowUpQueueModalOpen(false)
            }}
            onCustomerClick={handleCustomerClick}
            similarCustomerProductMap={productMapForCancelReasonQueue}
            operatorId={operatorId}
            onRefreshReservations={refreshReservations}
            onStatusChange={handleStatusChange}
            generatePriceCalculation={generatePriceCalculation}
            getGroupColorClasses={getGroupColorClasses}
            getSelectedChoicesFromNewSystem={getSelectedChoicesNormalized}
            choicesCacheRef={choicesCacheRef}
            residentCustomerBatchMap={residentCustomerBatchMap}
            linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
            onOpenTourDetailModal={handleOpenTourDetailModal}
            reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
            onReservationOptionsMutated={handleReservationOptionsMutated}
            reshowPickupSummaryRequest={pickupSummaryReshowRequest}
            onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
            followUpPipelineSnapshot={
            followUpSnapshotsByReservationId.has(reservation.id)
              ? followUpSnapshotsByReservationId.get(reservation.id)!
              : null
          }
          followUpPipelineSnapshotLoaded={followUpSnapshotsByReservationId.has(reservation.id)}
            onFollowUpPipelineManualChange={handleFollowUpPipelineManualChange}
            onCancelFollowUpManualChange={handleCancelFollowUpManualChange}
            onCommunicationChannelChange={handleCommunicationChannelChange}
            sentBy={user?.email ?? null}
            onPreTourSmsSendSuccess={handlePreTourSmsSendSuccess}
          onSmsLogsClick={handleSmsLogsClick}
          />
        )}
      />

      {/* ??? ??? ??? ?? */}
      {showPickupTimeModal && selectedReservationForPickupTime && (
        <PickupTimeModal
          isOpen={showPickupTimeModal}
          selectedReservation={{
            id: selectedReservationForPickupTime.id,
            customer_id: selectedReservationForPickupTime.customerId,
            pickup_time: selectedReservationForPickupTime.pickUpTime,
            pickup_hotel: selectedReservationForPickupTime.pickUpHotel
          }}
          pickupTimeValue={pickupTimeValue}
          onTimeChange={setPickupTimeValue}
          onSave={handleSavePickupTime}
          onCancel={closePickupTimeModalAndMaybeReshowSummary}
          getCustomerName={(customerId: string) => getCustomerName(customerId, (customers as Customer[]) || [])}
          getCustomerLanguage={getCustomerLanguage}
          getPickupHotelName={(hotelId: string) => getPickupHotelDisplay(hotelId, pickupHotels || [])}
          getCountryCode={getCountryCode}
        />
      )}

      {/* ??? ??? ??? ?? */}
      {showPickupHotelModal && selectedReservationForPickupHotel && (
        <PickupHotelModal
          isOpen={showPickupHotelModal}
          selectedReservation={{
            id: selectedReservationForPickupHotel.id,
            customer_id: selectedReservationForPickupHotel.customerId,
            pickup_time: selectedReservationForPickupHotel.pickUpTime,
            pickup_hotel: selectedReservationForPickupHotel.pickUpHotel
          }}
          hotelSearchTerm={hotelSearchTerm}
          filteredHotels={filteredHotels.map((hotel: {
            id: string
            hotel?: string | null
            name?: string | null
            name_ko?: string | null
            pick_up_location?: string | null
          }) => ({
            id: hotel.id,
            hotel: hotel.hotel || hotel.name || hotel.name_ko || '',
            pick_up_location: hotel.pick_up_location || ''
          }))}
          onSearchChange={setHotelSearchTerm}
          onHotelSelect={handleSavePickupHotel}
          onCancel={closePickupHotelModalAndMaybeReshowSummary}
          getCustomerName={(customerId: string) => getCustomerName(customerId, (customers as Customer[]) || [])}
        />
      )}

      {/* ????????? ?? */}
      {showEmailPreview && emailPreviewData && emailPreviewData.emailType === 'resident_inquiry' && (
        <ResidentInquiryEmailPreviewModal
          isOpen
          onClose={() => {
            setShowEmailPreview(false)
            setEmailPreviewData(null)
          }}
          reservationId={emailPreviewData.reservationId}
          customerEmail={emailPreviewData.customerEmail}
          customerName={emailPreviewData.customerName || ''}
          customerLanguage={emailPreviewData.customerLanguage}
          tourDate={emailPreviewData.tourDate}
          productName={emailPreviewData.productName || ''}
          channelRN={emailPreviewData.channelRN}
          productCode={emailPreviewData.productCode ?? null}
          productTags={emailPreviewData.productTags ?? null}
          onSend={handleSendEmailFromPreview}
        />
      )}

      {showEmailPreview && emailPreviewData && emailPreviewData.emailType !== 'resident_inquiry' && (
        <EmailPreviewModal
          isOpen={showEmailPreview}
          onClose={() => {
            setShowEmailPreview(false)
            setEmailPreviewData(null)
          }}
          reservationId={emailPreviewData.reservationId}
          emailType={emailPreviewData.emailType}
          customerEmail={emailPreviewData.customerEmail}
          pickupTime={emailPreviewData.pickupTime || null}
          tourDate={emailPreviewData.tourDate || null}
          onSend={handleSendEmailFromPreview}
        />
      )}

      {/* ??????? ??? ?? */}
      {showEmailLogs && selectedReservationForEmailLogs && (
        <EmailLogsModal
          isOpen={showEmailLogs}
          onClose={() => {
            const reservationId = selectedReservationForEmailLogs
            setShowEmailLogs(false)
            setSelectedReservationForEmailLogs(null)
            if (reservationId) {
              void refreshFollowUpReservationIds([reservationId])
            }
          }}
          onDeliveryStatusSynced={() => {
            if (selectedReservationForEmailLogs) {
              void refreshFollowUpReservationIds([selectedReservationForEmailLogs])
            }
          }}
          reservationId={selectedReservationForEmailLogs}
        />
      )}

      {showSmsLogs && selectedReservationForSmsLogs && (
        <SmsLogsModal
          isOpen={showSmsLogs}
          onClose={() => {
            setShowSmsLogs(false)
            setSelectedReservationForSmsLogs(null)
          }}
          reservationId={selectedReservationForSmsLogs}
          uiLocale={locale === 'en' ? 'en' : 'ko'}
        />
      )}

      {/* ??? ??? ?? (?? ??) */}
      {showReservationDetailModal && selectedReservationForDetail && (() => {
        // ????????????????locale?????
        const customer = (customers as Customer[]).find(c => c.id === selectedReservationForDetail.customerId)
        const customerLanguage = customer?.language
        // ?? ?????locale ?????? ???('EN' ??? 'en' -> 'en', ????-> 'ko')
        const customerLocale = customerLanguage && 
          (customerLanguage.toLowerCase() === 'en' || customerLanguage === 'EN' || customerLanguage === '???') 
          ? 'en' 
          : 'ko'
        
        return (
          <ResizableModal
            isOpen={showReservationDetailModal}
            onClose={() => {
              setShowReservationDetailModal(false)
              setSelectedReservationForDetail(null)
            }}
            title={`?? ??? ??? - ${getCustomerName(selectedReservationForDetail.customerId, (customers as Customer[]) || [])}`}
            initialHeight={typeof window !== 'undefined' ? window.innerHeight * 0.9 : 600}
            onHeightChange={() => {}}
          >
            <iframe
              src={`/${customerLocale}/dashboard/reservations/${selectedReservationForDetail.customerId}/${selectedReservationForDetail.id}`}
              className="w-full h-full border-0"
              title="??? ??? ???"
            />
          </ResizableModal>
        )
      })()}

      {/* ??? ????? */}
      {showReviewModal && selectedReservationForReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-semibold text-gray-900">?? ??</h2>
              <button
                onClick={() => {
                  setShowReviewModal(false)
                  setSelectedReservationForReview(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ReviewManagementSection reservationId={selectedReservationForReview.id} />
            </div>
          </div>
        </div>
      )}

      <TourDetailResizableDialog
        open={Boolean(tourDetailModal)}
        modal={false}
        onOpenChange={(open) => {
          if (!open) {
            setTourDetailModal(null)
            setTourDetailRefreshNonce(0)
          }
        }}
        tourId={tourDetailModal?.tourId ?? null}
        refreshNonce={tourDetailRefreshNonce}
        onNavigateToTour={(nextTourId) =>
          setTourDetailModal((prev) =>
            prev
              ? { tourId: nextTourId, title: getTourDetailModalTitle(nextTourId) }
              : { tourId: nextTourId, title: getTourDetailModalTitle(nextTourId) }
          )
        }
        accessibilityTitle={tourDetailModal?.title ?? t('card.tourDetailModalTitle')}
        titleFallback={tourDetailModal?.title ?? t('card.tourDetailModalTitle')}
      />

      <DeletedReservationsTableModal
        isOpen={showDeletedReservationsModal}
        onClose={() => setShowDeletedReservationsModal(false)}
        title={t('deletedReservationsModalTitle')}
        reservations={deletedModalReservations}
        loading={deletedReservationsModalLoading}
        userEmail={user?.email ?? null}
        locale={locale}
        onPermanentDelete={async (reservationId) => {
          const { error } = await supabase.from('reservations').delete().eq('id', reservationId)
          if (error) {
            alert(
              locale === 'ko'
                ? '영구 삭제에 실패했습니다: ' + error.message
                : 'Purge failed: ' + error.message
            )
            throw error
          }
          setDeletedModalReservations((prev) => prev.filter((r) => r.id !== reservationId))
          await refreshReservations()
        }}
        renderReservationCard={(reservation) => (
          <ReservationCardItem
            reservation={reservation}
            customers={(customers as Customer[]) || []}
            products={(products as Array<{ id: string; name: string; sub_category?: string }>) || []}
            channels={(channels as Array<{ id: string; name: string; favicon_url?: string }>) || []}
            pickupHotels={
              (pickupHotels as Array<{
                id: string
                hotel?: string | null
                name?: string | null
                name_ko?: string | null
                pick_up_location?: string | null
              }>) || []
            }
            productOptions={(productOptions as Array<{ id: string; name: string; is_required?: boolean }>) || []}
            optionChoices={(optionChoices as Array<{ id: string; name: string }>) || []}
            tourInfoMap={tourInfoMap}
            reservationPricingMap={reservationPricingMap}
            locale={locale}
            onPricingInfoClick={handlePricingInfoClick}
            onCreateTour={handleCreateTour}
            onPickupTimeClick={handlePickupTimeClick}
            onPickupHotelClick={handlePickupHotelClick}
            onPaymentClick={handlePaymentClick}
            onDetailClick={handleDetailClick}
            onReceiptClick={handleReceiptClick}
            onReviewClick={handleReviewClick}
            onEmailPreview={handleOpenEmailPreview}
            onEmailLogsClick={handleEmailLogsClick}
            onEditClick={handleEditClick}
            onCustomerClick={handleCustomerClick}
            similarCustomerProductMap={productMapForCancelReasonQueue}
            operatorId={operatorId}
            onRefreshReservations={refreshReservations}
            onStatusChange={handleStatusChange}
            generatePriceCalculation={generatePriceCalculation}
            getGroupColorClasses={getGroupColorClasses}
            getSelectedChoicesFromNewSystem={getSelectedChoicesNormalized}
            choicesCacheRef={choicesCacheRef}
            residentCustomerBatchMap={residentCustomerBatchMap}
            linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
            onOpenTourDetailModal={handleOpenTourDetailModal}
            reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
            onReservationOptionsMutated={handleReservationOptionsMutated}
            reshowPickupSummaryRequest={pickupSummaryReshowRequest}
            onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
            followUpPipelineSnapshot={
            followUpSnapshotsByReservationId.has(reservation.id)
              ? followUpSnapshotsByReservationId.get(reservation.id)!
              : null
          }
          followUpPipelineSnapshotLoaded={followUpSnapshotsByReservationId.has(reservation.id)}
            onFollowUpPipelineManualChange={handleFollowUpPipelineManualChange}
            onCancelFollowUpManualChange={handleCancelFollowUpManualChange}
            onCommunicationChannelChange={handleCommunicationChannelChange}
            sentBy={user?.email ?? null}
            onPreTourSmsSendSuccess={handlePreTourSmsSendSuccess}
          onSmsLogsClick={handleSmsLogsClick}
          />
        )}
      />

      <AwayOtherUserChangesModal
        open={awayNotifier.open}
        loading={awayNotifier.loading}
        items={awayNotifier.items}
        locale={locale}
        onClose={awayNotifier.dismiss}
      />
    </div>
  )
}
