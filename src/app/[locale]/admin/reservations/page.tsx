'use client'

import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { X, Search, SlidersHorizontal, Printer, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { insertCustomerViaAdminApi } from '@/lib/adminCustomerInsert'
import { generateReservationId } from '@/lib/entityIds'
import { updateReservation, type ReservationUpdatePayload } from '@/lib/reservationUpdate'
import type { Database } from '@/lib/supabase'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import { computeCustomerPaymentTotalLineFormula } from '@/utils/reservationPricingBalance'
import CustomerForm from '@/components/CustomerForm'
import ReservationForm from '@/components/reservation/ReservationForm'
import { mapDbReservationRowsToReservations } from '@/lib/mapDbReservationRowsToReservations'
import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'
import { createTourPhotosBucket } from '@/lib/tourPhotoBucket'
import PricingInfoModal from '@/components/reservation/PricingInfoModal'
import ReservationCalendar from '@/components/ReservationCalendar'
import PaymentRecordsList from '@/components/PaymentRecordsList'
import { useReservationData } from '@/hooks/useReservationData'
import { useReservationFollowUpSnapshots } from '@/hooks/useReservationFollowUpSnapshots'
import PickupTimeModal from '@/components/tour/modals/PickupTimeModal'
import PickupHotelModal from '@/components/tour/modals/PickupHotelModal'
import EmailPreviewModal from '@/components/reservation/EmailPreviewModal'
import ResidentInquiryEmailPreviewModal from '@/components/reservation/ResidentInquiryEmailPreviewModal'
import EmailLogsModal from '@/components/reservation/EmailLogsModal'
import ReviewManagementSection from '@/components/reservation/ReviewManagementSection'
import ResizableModal from '@/components/reservation/ResizableModal'
import ReservationsHeader from '@/components/reservation/ReservationsHeader'
import ReservationsFilters from '@/components/reservation/ReservationsFilters'
import WeeklyStatsPanel from '@/components/reservation/WeeklyStatsPanel'
import { DateGroupHeader } from '@/components/reservation/DateGroupHeader'
import ReservationsEmptyState from '@/components/reservation/ReservationsEmptyState'
import ReservationsPagination from '@/components/reservation/ReservationsPagination'
import { ReservationCardItem } from '@/components/reservation/ReservationCardItem'
import ReservationFollowUpQueueModal, {
  type CancelFollowUpManualKind,
} from '@/components/reservation/ReservationFollowUpQueueModal'
import ReservationActionRequiredModal from '@/components/reservation/ReservationActionRequiredModal'
import CancellationReasonModal from '@/components/reservation/CancellationReasonModal'
import CustomerReceiptModal from '@/components/receipt/CustomerReceiptModal'
import { ReservationFormEmailSendButtons } from '@/components/reservation/ReservationFormEmailSendButtons'
import { useAuth } from '@/contexts/AuthContext'
import { upsertReservationCancellationReason } from '@/lib/reservationCancellationReason'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
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
  isReservationAddedStrictlyBeforeTodayLocal,
} from '@/utils/reservationUtils'
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
import { DeletedReservationsTableModal } from '@/components/shared/DeletedReservationsTableModal'
import { TourDetailModalContent } from '@/components/tour/TourDetailModalContent'
import AwayOtherUserChangesModal from '@/components/shared/AwayOtherUserChangesModal'
import { useAwayOtherUserChangesNotifier } from '@/hooks/useAwayOtherUserChangesNotifier'
import {
  fetchAdminReservationList,
  fetchAdminReservationListCardWeekProgressive,
} from '@/lib/adminReservationListFetch'
import { prefetchAdminReservationCardSideData } from '@/lib/adminReservationCardPrefetch'
import {
  browserLocalInclusiveDateKeys,
  browserLocalTodayYmd,
  browserLocalYesterdayYmd,
  browserLocalWeekRangeFromOffset,
  formatBrowserLocalYmdRangeDisplay,
  browserLocalCalendarMonthWindow,
  browserLocalCalendarYearWindow,
  browserLocalCalendarYearMonthKeys,
} from '@/lib/browserLocalWeek'
import {
  type ReservationStatusAuditRow,
  localYmdSetWhereBecameCancelledFromAuditRows,
  pickReservationStatusTransitionForDay,
  isIntoCancelledLikeTransition,
  statusTransitionSortIndex,
} from '@/lib/reservationStatusAudit'
import { aggregateStatusTransitionBucketsForReservationWindow } from '@/lib/reservationStatusTargetBuckets'
import { describeError, serializeError } from '@/lib/errorSerialization'
import {
  reservationMatchesExtendedPricingMismatchCriteria,
  type BalanceChannelRowInput,
} from '@/utils/balanceChannelRevenue'
import type { PaymentRecordLike } from '@/utils/reservationPricingBalance'
import { reservationNeedsCancelFinancialCleanup } from '@/lib/reservationActionRequiredCancelTab'
import {
  reservationNeedsAnyFollowUpAttention,
  reservationNeedsCancelFollowUpQueueAttention,
  type FollowUpPipelineStepKey,
} from '@/lib/reservationFollowUpPipeline'

const RESERVATIONS_LIST_UI_DEFAULT = {
  searchTerm: '',
  viewMode: 'card' as 'card' | 'calendar',
  cardLayout: 'simple' as 'standard' | 'simple',
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
  isWeeklyStatsCollapsed: true,
  /** 일별 등록·취소 차트: 7일 / 월간(한 달) / 연간(1~12월) */
  regCancelGranularity: 'week' as 'week' | 'month' | 'year',
  regCancelMonthOffset: 0,
  regCancelYearOffset: 0,
}

function localWeekdayIndexFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay()
}

/** 로드된 예약 기준: `allowedYears`에 속한 연도의 날만 사용, 요일별 일합 평균 */
function computeAvgDailyRegisteredByWeekdayForYears(
  reservations: Reservation[],
  allowedYears: Set<number>
): number[] {
  const daily = new Map<string, number>()
  for (const r of reservations) {
    const k = isoToLocalCalendarDateKey(r.addedTime)
    if (!k || k.length < 10) continue
    const y = parseInt(k.slice(0, 4), 10)
    if (!allowedYears.has(y)) continue
    const p = getReservationPartySize(r as unknown as Record<string, unknown>)
    daily.set(k, (daily.get(k) ?? 0) + p)
  }
  const buckets: number[][] = Array.from({ length: 7 }, () => [])
  for (const [ymd, total] of daily) {
    const y = parseInt(ymd.slice(0, 4), 10)
    if (!allowedYears.has(y)) continue
    buckets[localWeekdayIndexFromYmd(ymd)].push(total)
  }
  return buckets.map((arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0))
}

/** 연도 Y: 각 달 m에 대해 (그 달 1~말일 일별 등록 인원 합, 미등록일 0) / 말일 수 */
function computeAvgDailyRegisteredByMonthForCalendarYear(
  reservations: Reservation[],
  year: number
): number[] {
  const daily = new Map<string, number>()
  for (const r of reservations) {
    const k = isoToLocalCalendarDateKey(r.addedTime)
    if (!k || k.length < 10) continue
    if (parseInt(k.slice(0, 4), 10) !== year) continue
    const p = getReservationPartySize(r as unknown as Record<string, unknown>)
    daily.set(k, (daily.get(k) ?? 0) + p)
  }
  const out: number[] = new Array(13).fill(0)
  for (let m = 1; m <= 12; m++) {
    const dim = new Date(year, m, 0).getDate()
    let sum = 0
    for (let d = 1; d <= dim; d++) {
      const ymd = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      sum += daily.get(ymd) ?? 0
    }
    out[m] = dim > 0 ? sum / dim : 0
  }
  return out
}

/** 당일 등록 직후에도 수정이 한 번이라도 더 있으면 true (등록 시각과 동일한 updated_at은 false) */
function isReservationUpdatedStrictlyAfterAdded(r: Reservation): boolean {
  const a = r.addedTime?.trim() ? new Date(r.addedTime).getTime() : NaN
  const u = r.updated_at?.trim() ? new Date(r.updated_at).getTime() : NaN
  return Number.isFinite(a) && Number.isFinite(u) && u > a
}

/** 그룹 날짜 기준: 해당일 등록(addedTime) vs 해당일 수정(updated_at) — 당일 등록+당일 상태변경은 둘 다에 포함 */
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
    if (
      updatedKey === date &&
      !seenStatus.has(r.id) &&
      (createdKey !== date || isReservationUpdatedStrictlyAfterAdded(r))
    ) {
      seenStatus.add(r.id)
      statusChange.push(r)
    }
  }
  return { registration, statusChange }
}

/**
 * 로컬 `year`년 1/1 ~ (같은 해이면 `throughYmd`까지, 과거 해이면 12/31까지) 각 달력일의
 * 순 등록 인원(등록 − 취소, 차트와 동일한 취소 규칙)을 요일별로 합산한 뒤,
 * 그 기간에 실제 존재한 해당 요일 수로 나눈 일평균(7요소).
 * `throughYmd`는 보통 **어제**(오늘 미완료일 제외).
 */
function computeYtdNetPeopleAvgByWeekdayForLocalYear(
  reservations: Reservation[],
  year: number,
  throughYmd: string,
  useAuditCancel: boolean,
  auditByRecordId: Record<string, ReservationStatusAuditRow[]>
): number[] {
  const throughYear = parseInt(throughYmd.slice(0, 4), 10)
  if (!Number.isFinite(year)) return Array.from({ length: 7 }, () => 0)
  if (year > throughYear) {
    return Array.from({ length: 7 }, () => 0)
  }
  const startYmd = `${year}-01-01`
  let endYmd: string
  if (year < throughYear) {
    endYmd = `${year}-12-31`
  } else {
    endYmd = throughYmd
  }
  if (startYmd > endYmd) return Array.from({ length: 7 }, () => 0)

  const isCancelledLike = (status: string | undefined) =>
    isReservationCancelledStatus(status) || isReservationDeletedStatus(status)

  const regByYmd = new Map<string, number>()
  for (const r of reservations) {
    const ck = isoToLocalCalendarDateKey(r.addedTime)
    if (!ck || ck < startYmd || ck > endYmd) continue
    if (parseInt(ck.slice(0, 4), 10) !== year) continue
    const p = getReservationPartySize(r as unknown as Record<string, unknown>)
    regByYmd.set(ck, (regByYmd.get(ck) ?? 0) + p)
  }

  const cancelByYmd = new Map<string, number>()
  for (const r of reservations) {
    const p = getReservationPartySize(r as unknown as Record<string, unknown>)
    const id = String(r.id ?? '').trim()
    if (useAuditCancel && id) {
      const ymds = localYmdSetWhereBecameCancelledFromAuditRows(auditByRecordId[id])
      for (const ymd of ymds) {
        if (ymd < startYmd || ymd > endYmd) continue
        if (parseInt(ymd.slice(0, 4), 10) !== year) continue
        cancelByYmd.set(ymd, (cancelByYmd.get(ymd) ?? 0) + p)
      }
    } else {
      const uk = isoToLocalCalendarDateKey(r.updated_at ?? null)
      if (!uk || uk < startYmd || uk > endYmd) continue
      if (parseInt(uk.slice(0, 4), 10) !== year) continue
      if (!isCancelledLike(r.status)) continue
      cancelByYmd.set(uk, (cancelByYmd.get(uk) ?? 0) + p)
    }
  }

  const sums = Array.from({ length: 7 }, () => 0)
  const counts = Array.from({ length: 7 }, () => 0)
  for (const ymd of browserLocalInclusiveDateKeys(startYmd, endYmd)) {
    const net = (regByYmd.get(ymd) ?? 0) - (cancelByYmd.get(ymd) ?? 0)
    const wd = localWeekdayIndexFromYmd(ymd)
    sums[wd] += net
    counts[wd] += 1
  }

  return sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0))
}

/** 심플 카드 상태변경 소그룹: 대기중→취소(영·미 철자)만 기본 펼침 대상 */
function isPendingToCancelledTransitionBucket(bucketKey: string): boolean {
  if (bucketKey === '__unknown__') return false
  const sep = bucketKey.indexOf('\0')
  if (sep === -1) return false
  const from = bucketKey.slice(0, sep).toLowerCase()
  const to = bucketKey.slice(sep + 1).toLowerCase()
  return from === 'pending' && (to === 'cancelled' || to === 'canceled')
}

interface AdminReservationsProps {
  params: Promise<{ locale: string }>
}

export default function AdminReservations({ }: AdminReservationsProps) {
  const t = useTranslations('reservations')
  const { user, userPosition, hasPermission } = useAuth()
  const isSuper = userPosition === 'super'
  
  // ???????????? ?? ??? (??? ??? ?????? ??? ??) - useCallback??? ????????
  const getGroupColorClasses = useCallback((groupId: string, groupName?: string, optionName?: string) => {
    // ??????? ???? ?????L / ?????X / ?????U ?? ??? (??? ??? ?????? ???????)
    const opt = (optionName || '').trim()
    if (opt === '??? L') {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300'
    }
    if (opt === '??? X') {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800 border border-violet-300'
    }
    if (opt === '??? U') {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200'
    }

    // ????????? ?????(??????? ??? ???)
    const colorPalette = [
      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200",
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
    
    // ??? ??????????? ??????? (??? ??? ????? ???? ??? ???)
    const hashSource = optionName || groupName || groupId
    let hash = 0
    for (let i = 0; i < hashSource.length; i++) {
      hash = hashSource.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    return colorPalette[Math.abs(hash) % colorPalette.length]
  }, [])

  // ????????????????????????????????????
  const getSelectedChoicesFromNewSystem = useCallback(async (reservationId: string, isRetry = false) => {
    if (!reservationId?.trim()) {
      return []
    }

    const run = async () => {
      // product_choices는 reservation_choices.choice_id FK로도 연결됨. choice_options 안에 중첩하면
      // PostgREST/데이터 불일치 시 조회가 실패할 수 있어 ReservationCard와 동일하게 형제 임베드 사용.
      const { data, error } = await supabase
        .from('reservation_choices')
        .select(`
          choice_id,
          option_id,
          quantity,
          choice_options!inner (
            option_key,
            option_name,
            option_name_ko
          ),
          product_choices!inner (
            choice_group_ko
          )
        `)
        .eq('reservation_id', reservationId)

      if (error) throw error
      return data || []
    }

    try {
      return await run()
    } catch (error) {
      // AbortError ???: Error ?????? ??? Supabase? ????? { message, code, details } ?? ?? ??
      const msg = typeof (error as { message?: string })?.message === 'string' ? (error as { message: string }).message : (error instanceof Error ? error.message : '')
      const isAbortError =
        (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted') || error.message.includes('signal is aborted'))) ||
        (msg && (msg.includes('AbortError') || msg.includes('aborted') || msg.includes('signal is aborted')))

      if (isAbortError && !isRetry) {
        // ??? ??? ??? ??????? AbortError?????? ?????
        await new Promise((r) => setTimeout(r, 100))
        return getSelectedChoicesFromNewSystem(reservationId, true)
      }

      if (isAbortError) {
        // ??????????AbortError???? ??? ???? ?? (??? ???/?? ??? ???????? ???????)
        return []
      }

      const err = error as { message?: string; code?: string | number; details?: string; hint?: string }
      const errMsg =
        (typeof err?.message === 'string' && err.message.trim()) ||
        (error instanceof Error ? error.message : '')
      const code =
        typeof err?.code === 'string'
          ? err.code.trim() || undefined
          : err?.code != null
            ? String(err.code)
            : undefined
      const details =
        (typeof err?.details === 'string' && err.details.trim()) ||
        (typeof err?.hint === 'string' && err.hint.trim()) ||
        undefined
      console.error('Error fetching reservation choices:', {
        reservationId,
        message: errMsg || undefined,
        code,
        details,
        raw: error,
      })
      return []
    }
  }, [])

  // ReservationCardItem?? null?????????????? choices ??
  const getSelectedChoicesNormalized = useCallback(async (reservationId: string) => {
    const rows = await getSelectedChoicesFromNewSystem(reservationId)
    return rows.map((r) => {
      const row = r as {
        choice_id?: string | null
        option_id?: string | null
        quantity?: number | null
        choice_options?: {
          option_key?: string | null
          option_name?: string | null
          option_name_ko?: string | null
        }
        product_choices?: { choice_group_ko?: string | null }
      }
      const co = row.choice_options
      const pc = row.product_choices
      return {
        choice_id: row.choice_id ?? '',
        option_id: row.option_id ?? '',
        quantity: row.quantity ?? 0,
        choice_options: {
          option_key: co?.option_key ?? '',
          option_name: co?.option_name ?? '',
          option_name_ko: co?.option_name_ko ?? '',
          product_choices: { choice_group_ko: pc?.choice_group_ko ?? '' },
        },
      }
    })
  }, [getSelectedChoicesFromNewSystem])

  // ??????????? (???? ???)
  const choicesCacheRef = useRef<Map<string, Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: {
      option_key: string
      option_name: string
      option_name_ko: string
      product_choices: {
        choice_group_ko: string
      }
    }
  }>>>(new Map())

  const [residentCustomerBatchMap, setResidentCustomerBatchMap] = useState<
    Map<string, { resident_status: string | null }[]>
  >(() => new Map())

  const router = useRouter()
  const routeParams = useParams() as { locale?: string }
  const locale = routeParams?.locale || 'ko'
  const searchParams = useSearchParams()

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
    loading,
    loadingProgress,
    reservationsAggregateReady,
    replaceReservationsFromQueryResult,
    mergeMoreReservationsFromQueryResult,
    refreshReservationPricingForIds,
    refreshReservationOptionsPresenceForIds,
    refreshCustomers,
    mergeCustomers,
  } = useReservationData({ disableReservationsAutoLoad: true, customersByReservationIds: true })

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

  const refreshReservationPricingForIdsRef = useRef(refreshReservationPricingForIds)
  const refreshReservationOptionsPresenceForIdsRef = useRef(refreshReservationOptionsPresenceForIds)
  refreshReservationPricingForIdsRef.current = refreshReservationPricingForIds
  refreshReservationOptionsPresenceForIdsRef.current = refreshReservationOptionsPresenceForIds

  /**
   * 예약 ID → 투어 ID: tours.reservation_ids에 실제로 포함된 투어만 반영.
   * 동일 예약이 여러 투어에 남아 있으면 tour_status가 deleted인 투어는 뒤로 두고,
   * 그중 첫 번째(비삭제 우선)를 대표 투어로 사용.
   */
  const tourIdByReservationId = useMemo(() => {
    const byRes = new Map<string, { tourId: string; deletedRank: number }[]>()
    hookToursMap.forEach((tour, tourId) => {
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
  }, [hookToursMap])

  const handleReservationOptionsMutated = useCallback(
    (reservationId: string) => {
      void refreshReservationOptionsPresenceForIds([reservationId])
      void refreshReservationPricingForIds([reservationId])
    },
    [refreshReservationOptionsPresenceForIds, refreshReservationPricingForIds]
  )

  // ??? ???(?? ??? ??????? ????)
  const [reservationListUi, setReservationListUi, reservationListUiHydrated] = useRoutePersistedState(
    'reservations-list',
    RESERVATIONS_LIST_UI_DEFAULT
  )
  const {
    searchTerm,
    viewMode,
    cardLayout,
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
    isWeeklyStatsCollapsed,
    regCancelGranularity: regCancelGranularityStored,
    regCancelMonthOffset: regCancelMonthOffsetStored,
    regCancelYearOffset: regCancelYearOffsetStored,
  } = reservationListUi as typeof RESERVATIONS_LIST_UI_DEFAULT & { currentWeek?: number }
  const statisticsWeekOffset =
    statisticsWeekOffsetStored ?? (reservationListUi as { currentWeek?: number }).currentWeek ?? 0
  const cardsWeekPage =
    cardsWeekPageStored ?? (reservationListUi as { currentWeek?: number }).currentWeek ?? 0
  const regCancelGranularity = regCancelGranularityStored ?? 'week'
  const regCancelMonthOffset = regCancelMonthOffsetStored ?? 0
  const regCancelYearOffset = regCancelYearOffsetStored ?? 0

  const setSearchTerm = (v: React.SetStateAction<string>) =>
    setReservationListUi((u) => ({
      ...u,
      searchTerm: typeof v === 'function' ? (v as (s: string) => string)(u.searchTerm) : v,
    }))
  const setViewMode = (m: 'card' | 'calendar') => setReservationListUi((u) => ({ ...u, viewMode: m }))
const setCardLayout = (l: 'standard' | 'simple') => setReservationListUi((u) => ({ ...u, cardLayout: l }))
  const setSelectedStatus = (s: string) => setReservationListUi((u) => ({ ...u, selectedStatus: s }))
  const setCurrentPage = (v: React.SetStateAction<number>) =>
    setReservationListUi((u) => ({
      ...u,
      currentPage: typeof v === 'function' ? (v as (n: number) => number)(u.currentPage) : v,
    }))
  const setItemsPerPage = (v: React.SetStateAction<number>) =>
    setReservationListUi((u) => ({
      ...u,
      itemsPerPage: typeof v === 'function' ? (v as (n: number) => number)(u.itemsPerPage) : v,
    }))
  const setStatisticsWeekOffset = (v: React.SetStateAction<number>) =>
    setReservationListUi((u) => {
      const prev =
        (u as { statisticsWeekOffset?: number; currentWeek?: number }).statisticsWeekOffset ??
        (u as { currentWeek?: number }).currentWeek ??
        0
      const next = typeof v === 'function' ? (v as (n: number) => number)(prev) : v
      return { ...u, statisticsWeekOffset: next }
    })
  const setCardsWeekPage = (v: React.SetStateAction<number>) =>
    setReservationListUi((u) => {
      const prev =
        (u as { cardsWeekPage?: number; currentWeek?: number }).cardsWeekPage ??
        (u as { currentWeek?: number }).currentWeek ??
        0
      const next = typeof v === 'function' ? (v as (n: number) => number)(prev) : v
      return { ...u, cardsWeekPage: next }
    })
  const setSelectedChannel = (c: string) => setReservationListUi((u) => ({ ...u, selectedChannel: c }))
  const setDateRange = (v: React.SetStateAction<{ start: string; end: string }>) =>
    setReservationListUi((u) => ({
      ...u,
      dateRange: typeof v === 'function' ? (v as (r: { start: string; end: string }) => { start: string; end: string })(u.dateRange) : v,
    }))
  const setSortBy = (v: React.SetStateAction<'created_at' | 'tour_date' | 'customer_name' | 'product_name'>) =>
    setReservationListUi((u) => ({
      ...u,
      sortBy: typeof v === 'function' ? (v as (s: typeof u.sortBy) => typeof u.sortBy)(u.sortBy) : v,
    }))
  const setSortOrder = (v: React.SetStateAction<'asc' | 'desc'>) =>
    setReservationListUi((u) => ({
      ...u,
      sortOrder: typeof v === 'function' ? (v as (s: 'asc' | 'desc') => 'asc' | 'desc')(u.sortOrder) : v,
    }))
  const setGroupByDate = (v: React.SetStateAction<boolean>) =>
    setReservationListUi((u) => ({
      ...u,
      groupByDate: typeof v === 'function' ? (v as (g: boolean) => boolean)(u.groupByDate) : v,
    }))
  const setIsWeeklyStatsCollapsed = (v: React.SetStateAction<boolean>) =>
    setReservationListUi((u) => ({
      ...u,
      isWeeklyStatsCollapsed: typeof v === 'function'
        ? (v as (b: boolean) => boolean)(u.isWeeklyStatsCollapsed)
        : v,
    }))
  const setRegCancelGranularity = (g: 'week' | 'month' | 'year') =>
    setReservationListUi((u) => ({ ...u, regCancelGranularity: g }))
  const setRegCancelMonthOffset = (v: React.SetStateAction<number>) =>
    setReservationListUi((u) => ({
      ...u,
      regCancelMonthOffset: typeof v === 'function' ? (v as (n: number) => number)(u.regCancelMonthOffset ?? 0) : v,
    }))
  const setRegCancelYearOffset = (v: React.SetStateAction<number>) =>
    setReservationListUi((u) => ({
      ...u,
      regCancelYearOffset: typeof v === 'function' ? (v as (n: number) => number)(u.regCancelYearOffset ?? 0) : v,
    }))

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  // 검색 debounce — 짧으면 Supabase·Auth 요청이 겹쳐 Failed to fetch가 나기 쉬움
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 550)

    return () => clearTimeout(timer)
  }, [searchTerm])
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
  
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [simpleCardStatusTransitionMap, setSimpleCardStatusTransitionMap] = useState<
    Record<string, { from: string; to: string }>
  >({})
  const [simpleCardStatusTransitionLoading, setSimpleCardStatusTransitionLoading] = useState(false)

  /** 일별 등록·취소 차트: 취소 = 그날 감사상 취소/삭제 전환일만 (DateGroupHeader 심플 카드와 동일 기준) */
  const [regCancelChartAuditRowsByRecordId, setRegCancelChartAuditRowsByRecordId] = useState<
    Record<string, ReservationStatusAuditRow[]>
  >({})
  const [regCancelChartAuditLoaded, setRegCancelChartAuditLoaded] = useState(false)
  /**
   * 심플 카드 아코디언: 맵에만 사용자 오버라이드 저장.
   * 키 없음 → defaultOpen (등록·상태변경 상위=열림, 소그룹=대기→취소만 열림·수정됨·그 외=접힘).
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
    setCollapsedGroups(prev => {
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
  const [followUpPipelineManualRefresh, setFollowUpPipelineManualRefresh] = useState(0)
  const [followUpFormPipelineRefresh, setFollowUpFormPipelineRefresh] = useState(0)
  const [tourDetailModalTourId, setTourDetailModalTourId] = useState<string | null>(null)
  const [reservationIdsWithPayments, setReservationIdsWithPayments] = useState<Set<string>>(new Set())
  const [paymentRecordsByReservationIdForActionBadge, setPaymentRecordsByReservationIdForActionBadge] =
    useState<Map<string, PaymentRecordLike[]>>(() => new Map())

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
    if (searchTerm.trim()) {
      // ????? ??? ??? ???????
      setGroupByDate(false)
    } else {
      // ????? ??? ??? ?????????
      setGroupByDate(true)
    }
  }, [searchTerm])

  // ??? ??? ??????(hookToursMap ???) ????? ??? ?? ??? ?????? ??
  useEffect(() => {
    if (!reservationsAggregateReady) {
      setTourInfoMap(new Map())
      return
    }

    const buildTourInfoMap = async () => {
      if (!reservations.length || hookToursMap.size === 0) {
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
        }>()

        // ?? ???? ?????? ????????????????
        const guideEmails = new Set<string>()
        const assistantEmails = new Set<string>()
        const vehicleIds = new Set<string>()
        
        hookToursMap.forEach(tour => {
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
                .select('id, memo, vehicle_number, vehicle_type')
                .in('id', chunk)
              
              if (vehicles) {
                const rows = vehicles as Pick<
                  Database['public']['Tables']['vehicles']['Row'],
                  'id' | 'memo' | 'vehicle_number' | 'vehicle_type'
                >[]
                rows.forEach((vehicle) => {
                  if (vehicle.id) {
                    const label =
                      vehicle.memo?.trim() ||
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
        reservations.forEach(r => {
          reservationById.set(r.id, r)
          if (r.tourId) {
            reservationByTourId.set(r.tourId, r)
          }
        })

        // ??? ??? TourHeader?? ???: ??= ??????(confirmed/recruiting) ???, ?? = ??? ????(?????????????
        const isConfirmedOrRecruiting = (status: string | undefined) => {
          const s = (status || '').toString().toLowerCase().trim()
          return s === 'confirmed' || s === 'recruiting'
        }
        const dateProductAllPeopleMap = new Map<string, number>()
        const dateProductConfirmedRecruitingMap = new Map<string, number>()
        reservations.forEach(r => {
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
        hookToursMap.forEach((tour, tourId) => {
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

          // ??????? ??? ??: reservation_ids??unique ?????????? total_people ???
          if (tour.reservation_ids && tour.reservation_ids.length > 0) {
            const uniqueReservationIds = [...new Set(tour.reservation_ids)]
            totalPeople = uniqueReservationIds.reduce((sum: number, id: string) => {
              const reservation = reservationById.get(id)
              if (!reservation) return sum
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
            productId: productIdForKey || null
          })
        })

        setTourInfoMap(newTourInfoMap)
      } catch (error) {
        console.error('??? ??? ????? ?????:', error)
      }
    }

    buildTourInfoMap()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, hookToursMap, reservationsAggregateReady])

  // ??? ?? ??? ????? ???????? ??? ID ???
  useEffect(() => {
    if (!reservations.length) {
      setReservationIdsWithPayments(new Set())
      setPaymentRecordsByReservationIdForActionBadge(new Map())
      return
    }
    const ids = reservations.map(r => r.id)
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
        if (data) {
          data.forEach((row: { reservation_id: string; payment_status: string; amount: unknown }) => {
            set.add(row.reservation_id)
            const rec: PaymentRecordLike = {
              payment_status: row.payment_status || '',
              amount: Number(row.amount) || 0,
            }
            const arr = byRes.get(row.reservation_id) ?? []
            arr.push(rec)
            byRes.set(row.reservation_id, arr)
          })
        }
      }
      setReservationIdsWithPayments(set)
      setPaymentRecordsByReservationIdForActionBadge(byRes)
    }
    load()
  }, [reservations])

  // ??? ?? ??? ?? (??? ?????
  const actionRequiredCount = useMemo(() => {
    const isDeleted = (r: Reservation) => {
      const s = (r.status as string)?.trim?.() ?? ''
      return s.toLowerCase() === 'deleted'
    }
    const arReservations = reservations.filter((r) => !isDeleted(r))
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
      const p = reservationPricingMap.get(r.id)
      return !!(p && (p.total_price != null && p.total_price > 0))
    }
    const isNotCancelledPricing = (r: Reservation) => {
      const s = (r.status as string)?.trim?.() ?? ''
      return !s.toLowerCase().startsWith('cancelled')
    }
    const getBalance = (r: Reservation) => {
      const p = reservationPricingMap.get(r.id)
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
    const statusList = arReservations.filter(r => tourDateWithin7Days(r) && statusPending(r))
    const tourList = arReservations.filter(r => statusConfirmed(r) && !hasTourAssigned(r))
    const noPricing = arReservations.filter(r => !hasPricing(r))
    const pricingMismatch = arReservations.filter(
      (r) =>
        isNotCancelledPricing(r) &&
        reservationMatchesExtendedPricingMismatchCriteria(
          r,
          reservationPricingMap,
          (channels || []) as BalanceChannelRowInput[],
          new Map(),
          undefined
        )
    )
    const depositNoTour = arReservations.filter(r => hasPayment(r) && !hasTourAssigned(r))
    const confirmedNoDeposit = arReservations.filter(r => statusConfirmed(r) && !hasPayment(r))
    const balanceList = arReservations.filter(r => tourDateBeforeToday(r) && getBalance(r) > 0)
    const cancelFinancialList = arReservations.filter((r) =>
      reservationNeedsCancelFinancialCleanup(
        r,
        reservationPricingMap,
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
  }, [reservations, reservationPricingMap, reservationIdsWithPayments, paymentRecordsByReservationIdForActionBadge, tourIdByReservationId, channels])

  /** 서버에서 필터·검색·정렬·페이지 반영된 목록 */
  const filteredAndSortedReservations = useMemo(
    () => [...new Map(reservations.map((r) => [r.id, r])).values()],
    [reservations]
  )
  
  const filteredReservations = filteredAndSortedReservations

  const reservationsLiteForFollowUp = useMemo(
    () => filteredReservations.map((r) => ({ id: r.id, productId: r.productId })),
    [filteredReservations]
  )

  const {
    snapshotsByReservationId: followUpSnapshotsByReservationId,
    loading: followUpSnapshotsLoading,
    patchCancelManualFlags,
  } = useReservationFollowUpSnapshots(
    reservationsLiteForFollowUp,
    (products as Array<{ id: string; product_code?: string | null }>) || [],
    followUpPipelineManualRefresh
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
    },
    [locale, patchCancelManualFlags]
  )

  const followUpQueueUnionCount = useMemo(() => {
    let n = 0
    for (const r of filteredReservations) {
      if (isReservationTourDatePastLocal(r.tourDate)) continue
      const snap = followUpSnapshotsByReservationId.get(r.id)
      if (reservationNeedsCancelFollowUpQueueAttention(r.status as string | undefined, r.tourDate, snap)) {
        n += 1
        continue
      }
      if (isReservationAddedStrictlyBeforeTodayLocal(r.addedTime)) continue
      if (reservationNeedsAnyFollowUpAttention(r.status as string | undefined, snap)) n += 1
    }
    return n
  }, [filteredReservations, followUpSnapshotsByReservationId])
  
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

  const applyReservationListSideDataPrefetch = useCallback(async (rows: Record<string, unknown>[] | null) => {
    const ids = (rows || [])
      .map((r) =>
        r && typeof r === 'object' && 'id' in r ? String((r as { id: unknown }).id ?? '').trim() : ''
      )
      .filter(Boolean)
    if (ids.length === 0) {
      setResidentCustomerBatchMap(new Map())
      return
    }
    try {
      const m = await prefetchAdminReservationCardSideData(supabase, ids, choicesCacheRef)
      setResidentCustomerBatchMap(m)
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[admin reservations] card side prefetch failed:', e)
      }
      const fallback = new Map<string, { resident_status: string | null }[]>()
      for (const id of ids) fallback.set(id, [])
      setResidentCustomerBatchMap(fallback)
    }
  }, [])

  const mergeReservationListSideDataPrefetch = useCallback(async (rows: Record<string, unknown>[] | null) => {
    const ids = (rows || [])
      .map((r) =>
        r && typeof r === 'object' && 'id' in r ? String((r as { id: unknown }).id ?? '').trim() : ''
      )
      .filter(Boolean)
    if (ids.length === 0) return
    try {
      const m = await prefetchAdminReservationCardSideData(supabase, ids, choicesCacheRef)
      setResidentCustomerBatchMap((prev) => new Map([...prev, ...m]))
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[admin reservations] card side merge prefetch failed:', e)
      }
    }
  }, [])

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
    setServerListLoading(true)
    setAdminListChunkProgress(null)
    try {
      const cardsWR = browserLocalWeekRangeFromOffset(cardsWeekPage)
      const statsWR = browserLocalWeekRangeFromOffset(statisticsWeekOffset)
      let rangeStartIso = cardsWR.rangeStartIso
      let rangeEndIso = cardsWR.rangeEndIso
      if (statsWR.rangeStartIso < rangeStartIso) rangeStartIso = statsWR.rangeStartIso
      if (statsWR.rangeEndIso > rangeEndIso) rangeEndIso = statsWR.rangeEndIso
      if (groupByDate) {
        if (regCancelGranularity === 'month') {
          const m = browserLocalCalendarMonthWindow(regCancelMonthOffset)
          if (m.rangeStartIso < rangeStartIso) rangeStartIso = m.rangeStartIso
          if (m.rangeEndIso > rangeEndIso) rangeEndIso = m.rangeEndIso
        } else if (regCancelGranularity === 'year') {
          const y = browserLocalCalendarYearWindow(regCancelYearOffset)
          if (y.rangeStartIso < rangeStartIso) rangeStartIso = y.rangeStartIso
          if (y.rangeEndIso > rangeEndIso) rangeEndIso = y.rangeEndIso
        }
        /** 7일 차트 YTD 요일 평균선: 올해 1/1 이후 등록·취소가 반영되도록 조회 시작 확장 */
        const jan1Local = new Date()
        jan1Local.setHours(0, 0, 0, 0)
        const jan1Iso = new Date(jan1Local.getFullYear(), 0, 1, 0, 0, 0, 0).toISOString()
        if (jan1Iso < rangeStartIso) rangeStartIso = jan1Iso
      }

      if (viewMode === 'calendar') {
        const calStart = new Date()
        calStart.setMonth(calStart.getMonth() - 6)
        calStart.setHours(0, 0, 0, 0)
        const calEnd = new Date()
        calEnd.setMonth(calEnd.getMonth() + 6)
        calEnd.setHours(23, 59, 59, 999)
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const { data, count, error } = await fetchAdminReservationList(supabase, {
          mode: 'calendar',
          page: 1,
          pageSize: 20,
          selectedStatus,
          selectedChannel,
          dateRange,
          customerIdFromUrl,
          debouncedSearchTerm,
          sortBy,
          sortOrder,
          calendarTourDateStart: fmt(calStart),
          calendarTourDateEnd: fmt(calEnd),
          calendarCreatedStartIso: calStart.toISOString(),
          calendarCreatedEndIso: calEnd.toISOString(),
        })
        if (error) throw error
        await replaceReservationsFromQueryResultRef.current(data || [], { skipLoadingFlags: true })
        await applyReservationListSideDataPrefetch((data || []) as Record<string, unknown>[])
        setServerListTotal(count ?? 0)
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
        ...(groupByDate
          ? { activityRangeStartIso: rangeStartIso, activityRangeEndIso: rangeEndIso }
          : {}),
      }
      if (cardArgs.mode === 'card-week') {
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
            await replaceReservationsFromQueryResultRef.current(rows, {
              skipLoadingFlags: true,
              listProgress: { current: rows.length, total: totalCount },
            })
            await applyReservationListSideDataPrefetch(rows)
            setServerListTotal(totalCount ?? rows.length)
            setServerListLoading(false)
            return true
          },
          onAdditionalChunk: async ({ rows, mergedLoaded, totalCount }) => {
            if (fetchGen !== adminCardWeekFetchGenRef.current) return false
            if (rows.length === 0) return true
            await mergeMoreReservationsFromQueryResultRef.current(rows, {
              skipLoadingFlags: true,
              listProgress: { current: mergedLoaded, total: totalCount },
            })
            await mergeReservationListSideDataPrefetch(rows)
            setServerListTotal(totalCount ?? mergedLoaded)
            return true
          },
        })
        if (progError) throw progError
      } else {
        const { data, count, error } = await fetchAdminReservationList(supabase, cardArgs)
        if (error) throw error
        await replaceReservationsFromQueryResultRef.current(data || [], { skipLoadingFlags: true })
        await applyReservationListSideDataPrefetch((data || []) as Record<string, unknown>[])
        setServerListTotal(count ?? 0)
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
    statisticsWeekOffset,
    viewMode,
    groupByDate,
    currentPage,
    itemsPerPage,
    selectedStatus,
    selectedChannel,
    dateRange,
    customerIdFromUrl,
    debouncedSearchTerm,
    sortBy,
    sortOrder,
    regCancelGranularity,
    regCancelMonthOffset,
    regCancelYearOffset,
    applyReservationListSideDataPrefetch,
    mergeReservationListSideDataPrefetch,
  ])

  const refreshReservations = useCallback(async () => {
    await loadAdminReservationList()
  }, [loadAdminReservationList])

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

  // ??????????? (created_at ???) - ?? ????????????
  const groupedReservations = useMemo(() => {
    if (!groupByDate) {
      return { 'all': filteredReservations }
    }
    
    const groups: { [key: string]: typeof filteredReservations } = {}
    
    // ??? ?? ??? ?? ?? (?? ????? ???)
    const { startYmd: weekStartStr, endYmd: weekEndStr } = browserLocalWeekRangeFromOffset(cardsWeekPage)

    filteredReservations.forEach((reservation) => {
      const activityDates = new Set<string>()
      const createdKey = isoToLocalCalendarDateKey(reservation.addedTime)
      const updatedKey = isoToLocalCalendarDateKey(reservation.updated_at ?? null)
      if (createdKey) activityDates.add(createdKey)
      if (updatedKey) activityDates.add(updatedKey)
      if (activityDates.size === 0) return

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
  }, [filteredReservations, groupByDate, cardsWeekPage])

  /** 목록 조회와 동일하게 주·월·연 차트 구간을 합친 ISO 범위 — 감사(취소 전환) 조회에 사용 */
  const regCancelChartAuditIsoRange = useMemo(() => {
    if (!groupByDate) return null
    const weekR = browserLocalWeekRangeFromOffset(statisticsWeekOffset)
    let rangeStartIso = weekR.rangeStartIso
    let rangeEndIso = weekR.rangeEndIso
    const m = browserLocalCalendarMonthWindow(regCancelMonthOffset)
    if (m.rangeStartIso < rangeStartIso) rangeStartIso = m.rangeStartIso
    if (m.rangeEndIso > rangeEndIso) rangeEndIso = m.rangeEndIso
    const y = browserLocalCalendarYearWindow(regCancelYearOffset)
    if (y.rangeStartIso < rangeStartIso) rangeStartIso = y.rangeStartIso
    if (y.rangeEndIso > rangeEndIso) rangeEndIso = y.rangeEndIso
    const jan1Iso = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0, 0).toISOString()
    if (jan1Iso < rangeStartIso) rangeStartIso = jan1Iso
    return { rangeStartIso, rangeEndIso }
  }, [groupByDate, statisticsWeekOffset, regCancelMonthOffset, regCancelYearOffset])

  useEffect(() => {
    if (!groupByDate) {
      setRegCancelChartAuditRowsByRecordId({})
      setRegCancelChartAuditLoaded(false)
      return
    }
    const range = regCancelChartAuditIsoRange
    if (!range) return
    const uniqueIds = [...new Set(filteredReservations.map((r) => r.id).filter(Boolean))]
    if (uniqueIds.length === 0) {
      setRegCancelChartAuditRowsByRecordId({})
      setRegCancelChartAuditLoaded(true)
      return
    }

    let cancelled = false

    void (async () => {
      const chunkSize = 80
      const byRecord = new Map<string, ReservationStatusAuditRow[]>()
      try {
        for (let i = 0; i < uniqueIds.length; i += chunkSize) {
          const chunk = uniqueIds.slice(i, i + chunkSize)
          const { data, error } = await supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- audit_logs 미생성 타입
            .from('audit_logs' as any)
            .select('record_id, old_values, new_values, changed_fields, created_at')
            .eq('table_name', 'reservations')
            .eq('action', 'UPDATE')
            .gte('created_at', range.rangeStartIso)
            .lte('created_at', range.rangeEndIso)
            .in('record_id', chunk)
            // postgrest-js: .contains(col, ['status']) → cs.{status} (따옴표 없음) → PG text[] 파싱 오류·500 가능
            .contains('changed_fields', '{"status"}')
          if (cancelled) return
          if (error) {
            if (!isAbortLikeError(error) && !cancelled) {
              console.error('audit_logs (reg-cancel chart):', error)
            }
            if (isAbortLikeError(error)) return
            break
          }
          for (const row of data || []) {
            const id = String((row as unknown as ReservationStatusAuditRow).record_id ?? '').trim()
            if (!id) continue
            const arr = byRecord.get(id) ?? []
            arr.push(row as unknown as ReservationStatusAuditRow)
            byRecord.set(id, arr)
          }
        }
      } catch (e) {
        if (!cancelled && !isAbortLikeError(e)) console.error('audit_logs chart fetch failed:', e)
      }
      if (cancelled) return
      const next: Record<string, ReservationStatusAuditRow[]> = {}
      for (const [id, arr] of byRecord) next[id] = arr
      setRegCancelChartAuditRowsByRecordId(next)
      setRegCancelChartAuditLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [groupByDate, regCancelChartAuditIsoRange, filteredReservations])

  /** 일별·월별·연별 등록/취소 차트 행 — WeeklyStatsPanel */
  const regCancelChartRows = useMemo(() => {
    type Row = {
      dateKey: string
      registeredPeople: number
      registeredCount: number
      cancelledPeople: number
      cancelledCount: number
      /** 7일 탭: 올해 로컬 YTD 순(등록−취소) 요일별 일평균 인원. 월간: 해당 연 등록만 요일 평균. */
      avgLineRegistered: number
    }
    const isCancelledLike = (status: string | undefined) =>
      isReservationCancelledStatus(status) || isReservationDeletedStatus(status)

    const useAuditCancel = groupByDate && regCancelChartAuditLoaded
    const cancelYmdByResId = new Map<string, Set<string>>()
    if (useAuditCancel) {
      for (const r of filteredReservations) {
        const id = String(r.id ?? '').trim()
        if (!id) continue
        cancelYmdByResId.set(
          id,
          localYmdSetWhereBecameCancelledFromAuditRows(regCancelChartAuditRowsByRecordId[id])
        )
      }
    }

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
        }
        rows.push(row)
        rowByKey.set(k, row)
      }
      for (const r of filteredReservations) {
        const p = getReservationPartySize(r as unknown as Record<string, unknown>)
        const id = String(r.id ?? '').trim()
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
        if (useAuditCancel && id) {
          const ymds = cancelYmdByResId.get(id)
          if (ymds && ymds.size > 0) {
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
    let monthDailyAvgSameYear: number[] | null = null

    if (regCancelGranularity === 'week') {
      const todayYmd = browserLocalTodayYmd()
      const yesterdayYmd = browserLocalYesterdayYmd()
      const chartYear = parseInt(todayYmd.slice(0, 4), 10)
      wdAvg = computeYtdNetPeopleAvgByWeekdayForLocalYear(
        filteredReservations,
        chartYear,
        yesterdayYmd,
        useAuditCancel,
        regCancelChartAuditRowsByRecordId
      )
    } else if (regCancelGranularity === 'month') {
      const { startYmd } = browserLocalCalendarMonthWindow(regCancelMonthOffset)
      const y = parseInt(startYmd.slice(0, 4), 10)
      wdAvg = computeAvgDailyRegisteredByWeekdayForYears(filteredReservations, new Set([y]))
    } else {
      const chartYear = parseInt(
        browserLocalCalendarYearWindow(regCancelYearOffset).startYmd.slice(0, 4),
        10
      )
      monthDailyAvgSameYear = computeAvgDailyRegisteredByMonthForCalendarYear(
        filteredReservations,
        chartYear
      )
    }

    return base.map((row) => {
      let avgLine = 0
      if (regCancelGranularity === 'week' || regCancelGranularity === 'month') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(row.dateKey)) {
          avgLine = wdAvg[localWeekdayIndexFromYmd(row.dateKey)] ?? 0
        }
      } else if (monthDailyAvgSameYear && /^\d{4}-\d{2}$/.test(row.dateKey)) {
        const mi = parseInt(row.dateKey.slice(5, 7), 10)
        avgLine = monthDailyAvgSameYear[mi] ?? 0
      }
      return { ...row, avgLineRegistered: avgLine }
    })
  }, [
    filteredReservations,
    regCancelGranularity,
    statisticsWeekOffset,
    regCancelMonthOffset,
    regCancelYearOffset,
    groupByDate,
    regCancelChartAuditLoaded,
    regCancelChartAuditRowsByRecordId,
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

  // ??????????????????? ????????
  useEffect(() => {
    if (groupByDate && groupedReservations && Object.keys(groupedReservations).length > 0) {
      const allDates = Object.keys(groupedReservations)
      setCollapsedGroups(prev => {
        // ???? ?? ???? ??? ??????? ???
        const allCollapsed = allDates.every(date => prev.has(date))
        if (allCollapsed && prev.size === allDates.length) {
          return prev // ???? ?? ???? ??? ????????? ???
        }
        // ???????????????? ?? ???????? ????????
        const newSet = new Set(prev)
        allDates.forEach(date => newSet.add(date))
        return newSet
      })
    }
  }, [groupedReservations, groupByDate])

  const simpleCardStatusChangeAuditRequest = useMemo(() => {
    if (!groupByDate || cardLayout !== 'simple') return null
    const { rangeStartIso: rangeStart, rangeEndIso: rangeEnd } = browserLocalWeekRangeFromOffset(cardsWeekPage)
    const targets: { key: string; reservationId: string; dateKey: string }[] = []
    for (const [dateKey, dayList] of Object.entries(groupedReservations)) {
      const { statusChange } = splitReservationsByActivityForDate(dateKey, dayList)
      for (const r of statusChange) {
        targets.push({ key: `${r.id}|${dateKey}`, reservationId: r.id, dateKey })
      }
    }
    const uniqueIds = [...new Set(targets.map((x) => x.reservationId))]
    return { rangeStart, rangeEnd, targets, uniqueIds }
  }, [groupByDate, cardLayout, cardsWeekPage, groupedReservations])

  useEffect(() => {
    const req = simpleCardStatusChangeAuditRequest
    if (!req) {
      setSimpleCardStatusTransitionMap({})
      setSimpleCardStatusTransitionLoading(false)
      return
    }
    if (req.targets.length === 0) {
      setSimpleCardStatusTransitionMap({})
      setSimpleCardStatusTransitionLoading(false)
      return
    }
    if (req.uniqueIds.length === 0) {
      setSimpleCardStatusTransitionMap({})
      setSimpleCardStatusTransitionLoading(false)
      return
    }

    let cancelled = false
    setSimpleCardStatusTransitionLoading(true)

    void (async () => {
      const chunkSize = 80
      const collected: ReservationStatusAuditRow[] = []
      try {
        for (let i = 0; i < req.uniqueIds.length; i += chunkSize) {
          const chunk = req.uniqueIds.slice(i, i + chunkSize)
          const { data, error } = await supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- audit_logs 미생성 타입
            .from('audit_logs' as any)
            .select('record_id, old_values, new_values, changed_fields, created_at')
            .eq('table_name', 'reservations')
            .eq('action', 'UPDATE')
            .gte('created_at', req.rangeStart)
            .lte('created_at', req.rangeEnd)
            .in('record_id', chunk)
            .contains('changed_fields', '{"status"}')
          if (cancelled) return
          if (error) {
            if (!isAbortLikeError(error) && !cancelled) {
              console.error('audit_logs (status transitions):', error)
            }
            if (isAbortLikeError(error)) {
              if (!cancelled) setSimpleCardStatusTransitionLoading(false)
              return
            }
            break
          }
          for (const row of data || []) {
            collected.push(row as unknown as ReservationStatusAuditRow)
          }
        }
      } catch (e) {
        if (!cancelled && !isAbortLikeError(e)) console.error('audit_logs fetch failed:', e)
      }

      if (cancelled) return

      const byRecord = new Map<string, ReservationStatusAuditRow[]>()
      for (const row of collected) {
        const id = String(row.record_id ?? '').trim()
        if (!id) continue
        const arr = byRecord.get(id) ?? []
        arr.push(row)
        byRecord.set(id, arr)
      }

      const next: Record<string, { from: string; to: string }> = {}
      for (const t of req.targets) {
        const tr = pickReservationStatusTransitionForDay(byRecord.get(t.reservationId) ?? [], t.dateKey)
        if (tr) next[t.key] = tr
      }
      setSimpleCardStatusTransitionMap(next)
      setSimpleCardStatusTransitionLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [simpleCardStatusChangeAuditRequest])

  const statisticsWeekBoundary = useMemo(
    () => browserLocalWeekRangeFromOffset(statisticsWeekOffset),
    [statisticsWeekOffset]
  )

  /** 통계 패널 요약·차트용: 통계 주간에 활동(등록/수정일)이 겹치는 예약만 */
  const statisticsWeekReservations = useMemo(() => {
    const { startYmd, endYmd } = statisticsWeekBoundary
    const seen = new Set<string>()
    const out: Reservation[] = []
    for (const r of filteredReservations) {
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
  }, [filteredReservations, statisticsWeekBoundary])

  /** 통계 패널 상단: 선택 주(달력 N일) 기준 등록·취소(감사)·순 건수·인원 및 일평균 */
  const statisticsWeekHeaderSummary = useMemo(() => {
    const { startYmd, endYmd } = statisticsWeekBoundary
    const calendarKeys = browserLocalInclusiveDateKeys(startYmd, endYmd)
    const dayDen = Math.max(calendarKeys.length, 1)
    const round1 = (n: number) => Math.round(n * 10) / 10

    let regBookings = 0
    let regPeople = 0
    for (const r of filteredReservations) {
      const ck = isoToLocalCalendarDateKey(r.addedTime)
      if (ck && ck >= startYmd && ck <= endYmd) {
        regBookings += 1
        regPeople += getReservationPartySize(r as unknown as Record<string, unknown>)
      }
    }

    let cancelBookings = 0
    let cancelPeople = 0
    const useAuditCancel = groupByDate && regCancelChartAuditLoaded
    if (useAuditCancel) {
      for (const r of filteredReservations) {
        const id = String(r.id ?? '').trim()
        if (!id) continue
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
      for (const r of filteredReservations) {
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
    filteredReservations,
    statisticsWeekBoundary,
    groupByDate,
    regCancelChartAuditLoaded,
    regCancelChartAuditRowsByRecordId,
  ])

  /** 통계 주(차트·상단 요약과 동일 구간): 상품·채널·상태별 등록/취소/순 인원 */
  const weeklyStats = useMemo(() => {
    const allReservations = statisticsWeekReservations
    const { startYmd, endYmd } = statisticsWeekBoundary
    const useAuditCancel = groupByDate && regCancelChartAuditLoaded
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

    for (const r of filteredReservations) {
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
        const ymds = localYmdSetWhereBecameCancelledFromAuditRows(regCancelChartAuditRowsByRecordId[id])
        for (const ymd of ymds) {
          if (ymd < startYmd || ymd > endYmd) continue
          bumpCancel(getProd(productName), p)
          bumpCancel(chRow, p)
        }
      } else {
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
          reservations: filteredReservations,
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
    statisticsWeekReservations,
    statisticsWeekBoundary,
    filteredReservations,
    products,
    channels,
    groupByDate,
    regCancelChartAuditLoaded,
    regCancelChartAuditRowsByRecordId,
  ])
  
  // ??????????? (?????? ???? ?????)
  const totalPages = groupByDate ? 1 : Math.max(1, Math.ceil(serverListTotal / itemsPerPage))
  const startIndex = groupByDate ? 0 : (currentPage - 1) * itemsPerPage
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
        variant_key: (reservation as any).variantKey || 'default' // variant_key ???
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
  }, [refreshReservations])

  const handleEditReservation = useCallback(async (reservation: Omit<Reservation, 'id'>) => {
    if (!editingReservation) return
    try {
      const fullPayload = {
        ...reservation,
        pricingInfo: (reservation as ReservationUpdatePayload).pricingInfo,
        customerLanguage: (reservation as ReservationUpdatePayload).customerLanguage,
        variantKey: (reservation as ReservationUpdatePayload).variantKey,
        selectedChoices: Array.isArray((reservation as ReservationUpdatePayload).selectedChoices)
          ? (reservation as ReservationUpdatePayload).selectedChoices
          : undefined,
        usResidentCount: (reservation as ReservationUpdatePayload).usResidentCount,
        nonResidentCount: (reservation as ReservationUpdatePayload).nonResidentCount,
        nonResidentWithPassCount: (reservation as ReservationUpdatePayload).nonResidentWithPassCount,
        nonResidentUnder16Count: (reservation as ReservationUpdatePayload).nonResidentUnder16Count,
      } as ReservationUpdatePayload
      const result = await updateReservation(editingReservation.id, fullPayload)
      if (!result.success) {
        alert(t('messages.reservationUpdateError') + (result.error ?? ''))
        return
      }
      await refreshReservations()
      setEditingReservation(null)
      alert(t('messages.reservationUpdated'))
    } catch (error) {
      console.error('Error updating reservation:', error)
      alert(t('messages.reservationUpdateError') + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }, [editingReservation, refreshReservations, t])



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
  const handleOpenTourDetailModal = useCallback((tourId: string) => {
    setTourDetailModalTourId(tourId)
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
  const handleSendEmailFromPreview = useCallback(async () => {
    if (!emailPreviewData) return

    if (!emailPreviewData.customerEmail?.trim()) {
      alert(t('messages.emailSendRequiresCustomerEmail'))
      return
    }

    setSendingEmail(emailPreviewData.reservationId)

    try {
      let response: Response
      const customer = (customers as Customer[]).find(c => {
        const reservation = reservations.find(r => r.id === emailPreviewData.reservationId)
        return reservation && c.id === reservation.customerId
      })
      
      const customerLanguage = customer?.language?.toLowerCase() || 'ko'
      const locale = customerLanguage === 'en' || customerLanguage === 'english' ? 'en' : 'ko'

      if (emailPreviewData.emailType === 'resident_inquiry') {
        response = await fetch('/api/send-resident-inquiry-email', {
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
        response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservationId: emailPreviewData.reservationId,
            email: emailPreviewData.customerEmail,
            type: 'both',
            locale,
            sentBy: user?.email || null
          })
        })
      } else if (emailPreviewData.emailType === 'departure') {
        // ??? ?? ??? ?????
        response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservationId: emailPreviewData.reservationId,
            email: emailPreviewData.customerEmail,
            type: 'voucher',
            locale,
            sentBy: user?.email || null
          })
        })
      } else if (emailPreviewData.emailType === 'pickup') {
        // ??? notification ?????
        if (!emailPreviewData.pickupTime || !emailPreviewData.tourDate) {
          throw new Error('??? ???????? ???? ????????')
        }

        response = await fetch('/api/send-pickup-schedule-notification', {
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
      setPickupTimeValue(reservation.pickUpTime || '')
      setShowPickupTimeModal(true)
    },
    []
  )

  // ??? ??? ????
  const handleSavePickupTime = useCallback(async () => {
    if (!selectedReservationForPickupTime) return

    try {
      const { error } = await (supabase as any)
        .from('reservations')
        .update({ pickup_time: pickupTimeValue || null })
        .eq('id', selectedReservationForPickupTime.id)

      if (error) {
        console.error('??? ??? ?????? ???:', error)
        alert(t('messages.pickupTimeUpdateError'))
        return
      }

      // ??? ??? ???? ??? (??? ?? ?? ???)

      await refreshReservations()
      closePickupTimeModalAndMaybeReshowSummary()
    } catch (error) {
      console.error('??? ??? ???????:', error)
      alert(t('messages.pickupTimeSaveError'))
    }
  }, [selectedReservationForPickupTime, pickupTimeValue, refreshReservations, closePickupTimeModalAndMaybeReshowSummary])

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
    const originalReservation = reservations.find((r) => r.id === reservationId)
    if (originalReservation) {
      setShowAddForm(false)
      setNewReservationId(null)
      setEditingReservation(originalReservation)
    } else {
      router.push(`/${locale}/admin/reservations/${reservationId}`)
    }
  }, [router, locale, reservations])

  const handleCustomerClick = useCallback((customer: Customer) => {
    setEditingCustomer(customer)
  }, [])

  const [cancellationReasonModalOpen, setCancellationReasonModalOpen] = useState(false)
  const [cancellationReasonValue, setCancellationReasonValue] = useState('')
  const [cancellationReasonSaving, setCancellationReasonSaving] = useState(false)
  const cancellationReasonTargetReservationIdRef = useRef<string | null>(null)
  const cancellationReasonResolveRef = useRef<((value: string | null) => void) | null>(null)

  const requestCancellationReason = useCallback((reservationId: string) => {
    cancellationReasonTargetReservationIdRef.current = reservationId
    setCancellationReasonValue('')
    setCancellationReasonModalOpen(true)
    return new Promise<string | null>((resolve) => {
      cancellationReasonResolveRef.current = resolve
    })
  }, [])

  const closeCancellationReasonModal = useCallback(() => {
    setCancellationReasonModalOpen(false)
    cancellationReasonTargetReservationIdRef.current = null
    cancellationReasonResolveRef.current?.(null)
    cancellationReasonResolveRef.current = null
  }, [])

  const submitCancellationReasonModal = useCallback(async (reason: string) => {
    const trimmed = reason.trim()
    if (!trimmed) return
    setCancellationReasonSaving(true)
    try {
      setCancellationReasonModalOpen(false)
      cancellationReasonResolveRef.current?.(trimmed)
      cancellationReasonResolveRef.current = null
      cancellationReasonTargetReservationIdRef.current = null
      setCancellationReasonValue(trimmed)
    } finally {
      setCancellationReasonSaving(false)
    }
  }, [])

  const handleStatusChange = useCallback(async (reservationId: string, newStatus: string) => {
    const normalized = (newStatus || '').toLowerCase()
    if (normalized === 'cancelled' || normalized === 'canceled') {
      const reason = await requestCancellationReason(reservationId)
      if (!reason) return
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', reservationId)
      if (error) throw error
      await upsertReservationCancellationReason(reservationId, reason, user?.email ?? null)
      await refreshReservations()
      return
    }
    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus })
      .eq('id', reservationId)
    if (error) throw error
    await refreshReservations()
  }, [refreshReservations, requestCancellationReason, user?.email])

  const handleEmailLogsClick = useCallback((reservationId: string) => {
    setSelectedReservationForEmailLogs(reservationId)
    setShowEmailLogs(true)
    setEmailDropdownOpen(null)
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

  /** 헤더·필터는 유지하고, 스토리지 복원·카탈로그·목록 구간은 본문만 로딩 */
  const showMainBodyLoading =
    !reservationListUiHydrated || loading || serverListLoading
  const mainBodyLoadingHeadline =
    !reservationListUiHydrated || loading
      ? t('loadingReservationData')
      : t('loadingReservationList')

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ??? - ????????*/}
      <ReservationsHeader
        customerIdFromUrl={customerIdFromUrl}
        customers={(customers as Customer[]) || []}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchTerm={searchTerm}
        onSearchChange={(term) => {
          setSearchTerm(term)
          setCurrentPage(1) // ????????????????
        }}
        onAddReservation={() => {
          // ????? ID ???
          const newId = generateReservationId()
          setNewReservationId(newId)
          setShowAddForm(true)
        }}
        onActionRequired={() => setShowActionRequiredModal(true)}
        actionRequiredCount={actionRequiredCount}
        onOpenFilter={() => setFilterModalOpen(true)}
        onOpenDeletedReservations={() => setShowDeletedReservationsModal(true)}
        onOpenFollowUpQueue={() => setFollowUpQueueModalOpen(true)}
        followUpQueueCount={followUpQueueUnionCount}
        cardLayout={cardLayout}
        onCardLayoutChange={setCardLayout}
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
              setCurrentPage(1)
            }}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFilterModalOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
        onStatusChange={(status) => {
          setSelectedStatus(status)
          setCurrentPage(1)
        }}
        selectedChannel={selectedChannel}
        onChannelChange={(channel) => {
          setSelectedChannel(channel)
          setCurrentPage(1)
        }}
        channels={(channels as Array<{ id: string; name: string }>) || []}
        dateRange={dateRange}
        onDateRangeChange={(range) => {
          setDateRange(range)
          setCurrentPage(1)
        }}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        groupByDate={groupByDate}
        onGroupByDateChange={setGroupByDate}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(items) => {
          setItemsPerPage(items)
          setCurrentPage(1)
        }}
        onReset={() => {
          setSearchTerm('')
          setSelectedStatus('all')
          setSelectedChannel('all')
          setDateRange({start: '', end: ''})
          setSortBy('created_at')
          setSortOrder('desc')
          setGroupByDate(true) // ?????????????
          setCurrentPage(1)
          setReservationListUi((u) => ({
            ...u,
            statisticsWeekOffset: 0,
            cardsWeekPage: 0,
          }))
        }}
      />

      {/* 검색 시 groupByDate 가 꺼져도 주간 통계는 유지(검색 결과·필터 기준) */}
      {(groupByDate || debouncedSearchTerm.trim().length > 0) && (
        <WeeklyStatsPanel
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
          isWeeklyStatsCollapsed={isWeeklyStatsCollapsed}
          onToggleStatsCollapsed={() => setIsWeeklyStatsCollapsed(!isWeeklyStatsCollapsed)}
          weekHeaderSummary={statisticsWeekHeaderSummary}
          formatWeekRange={formatWeekRange}
        />
      )}

      {groupByDate && !showMainBodyLoading && (
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
                    ? 'border border-blue-600 bg-blue-600 text-white'
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
          {groupByDate ? (
            <>
              {Object.values(groupedReservations).flat().length}
              {t('groupingLabels.reservationsGroupedBy')} {Object.keys(groupedReservations).length}
              {t('groupingLabels.registrationDates')}
              {Object.values(groupedReservations).flat().length !== serverListTotal && serverListTotal > 0 && (
                <span className="ml-2 text-blue-600">
                  ({t('groupingLabels.filteredFromTotal')} {serverListTotal}
                  {t('stats.more')})
                </span>
              )}
            </>
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
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
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
        />
      ) : (
          /* ????*/
          <>
            {filteredReservations.length === 0 ? (
              /* ?????? ??? ????? ??? */
              <ReservationsEmptyState
                hasSearchTerm={debouncedSearchTerm.trim().length > 0}
                searchTerm={debouncedSearchTerm}
                hasDateRange={!!(dateRange.start && dateRange.end)}
                dateRangeStart={dateRange.start}
                dateRangeEnd={dateRange.end}
                onClearSearch={handleClearSearch}
                variant="grid"
              />
            ) : groupByDate ? (
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
                const { registration: regList, statusChange: statusList } =
                  cardLayout === 'simple'
                    ? splitReservationsByActivityForDate(date, dayReservations)
                    : { registration: dayReservations, statusChange: [] as Reservation[] }

                const gridClass =
                  'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'

                const renderReservationCard = (reservation: Reservation) => (
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
                    emailDropdownOpen={emailDropdownOpen}
                    sendingEmail={sendingEmail}
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
                    onEmailDropdownToggle={handleEmailDropdownToggle}
                    onEditClick={handleEditClick}
                    onCustomerClick={handleCustomerClick}
                    onRefreshReservations={refreshReservations}
                    onStatusChange={handleStatusChange}
                    generatePriceCalculation={generatePriceCalculation}
                    getGroupColorClasses={getGroupColorClasses}
                    getSelectedChoicesFromNewSystem={getSelectedChoicesNormalized}
                    choicesCacheRef={choicesCacheRef}
                    residentCustomerBatchMap={residentCustomerBatchMap}
                    linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
                    cardLayout={cardLayout}
                    onOpenTourDetailModal={handleOpenTourDetailModal}
                    reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
                    onReservationOptionsMutated={handleReservationOptionsMutated}
                    reshowPickupSummaryRequest={pickupSummaryReshowRequest}
                    onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
                    followUpPipelineSnapshot={followUpSnapshotsByReservationId.get(reservation.id) ?? null}
                    {...(cardLayout === 'simple'
                      ? {
                          onFollowUpPipelineManualChange: handleFollowUpPipelineManualChange,
                          onCancelFollowUpManualChange: handleCancelFollowUpManualChange,
                        }
                      : {})}
                  />
                )

                const simpleCardStatusSubgroups =
                  statusList.length > 0 && !simpleCardStatusTransitionLoading
                    ? (() => {
                        const buckets = new Map<string, Reservation[]>()
                        for (const r of statusList) {
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

                const cancellationStatsForHeader =
                  cardLayout === 'simple'
                    ? simpleCardStatusTransitionLoading
                      ? ({ mode: 'audit-loading' as const } as const)
                      : ({
                          mode: 'audit' as const,
                          reservations: dayReservations.filter((r) => {
                            const st = (r.status || '').toLowerCase()
                            if (st !== 'cancelled' && st !== 'canceled' && st !== 'deleted') return false
                            const tr = simpleCardStatusTransitionMap[`${r.id}|${date}`]
                            return isIntoCancelledLikeTransition(tr)
                          }),
                        } as const)
                    : ({ mode: 'default' as const } as const)

                return (
                  <div key={date} className="space-y-4">
                    <DateGroupHeader
                      date={date}
                      reservations={dayReservations}
                      isCollapsed={collapsedGroups.has(date)}
                      onToggleCollapse={handleToggleCollapse}
                      customers={(customers as Array<{ id: string; name?: string }>) || []}
                      products={(products as Array<{ id: string; name: string }>) || []}
                      channels={(channels as Array<{ id: string; name: string; favicon_url?: string }>) || []}
                      cancellationStats={cancellationStatsForHeader}
                      {...(groupByDate && regCancelChartAuditLoaded
                        ? { auditRowsByReservationId: regCancelChartAuditRowsByRecordId }
                        : {})}
                      {...(groupByDate ? { statusAuditLoading: !regCancelChartAuditLoaded } : {})}
                    />

                    {cardLayout === 'simple' ? (
                      <div className="space-y-4">
                        {(() => {
                          const accRegKey = `${date}|simple-acc-reg`
                          const accStatusKey = `${date}|simple-acc-status`
                          const defaultRegOpen = true
                          /** 상태변경 상위도 기본 펼침 → 안에서 대기중→취소 소그룹만 기본 펼침, 수정됨·그 외 소그룹은 기본 접힘. */
                          const defaultStatusOpen = true
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
                                  <div className="border-t border-gray-100 px-2 pb-3 pt-2">
                                    {regList.length > 0 ? (
                                      <div className={gridClass}>{regList.map(renderReservationCard)}</div>
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
                                  <span className="text-sm font-semibold text-gray-900 flex items-baseline gap-2 min-w-0">
                                    <span>{t('groupingLabels.simpleCardGroupStatusChange')}</span>
                                    <span className="text-xs font-normal text-gray-500 tabular-nums">
                                      {statusList.length}
                                    </span>
                                  </span>
                                  <ChevronDown
                                    className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${statusOpen ? 'rotate-180' : ''}`}
                                    aria-hidden
                                  />
                                </button>
                                {statusOpen && (
                                  <div className="border-t border-gray-100 px-2 pb-3 pt-2 space-y-3">
                                    {statusList.length > 0 ? (
                                      simpleCardStatusTransitionLoading ? (
                                        <div className={gridClass}>{statusList.map(renderReservationCard)}</div>
                                      ) : simpleCardStatusSubgroups ? (
                                        simpleCardStatusSubgroups.map((g, subIdx) => {
                                          const subKey = `${date}|simple-acc-status-sub|${subIdx}`
                                          const defaultSubOpen = isPendingToCancelledTransitionBucket(g.bucketKey)
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
                                                <div className="border-t border-gray-100 bg-white px-2 pb-2 pt-2">
                                                  <div className={gridClass}>{g.items.map(renderReservationCard)}</div>
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })
                                      ) : (
                                        <div className={gridClass}>{statusList.map(renderReservationCard)}</div>
                                      )
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
                    ) : (
                      <div className={gridClass}>{dayReservations.map(renderReservationCard)}</div>
                    )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedReservations.map((reservation) => (
                  <ReservationCardItem
                    key={reservation.id}
                    reservation={reservation}
                    customers={(customers as Customer[]) || []}
                    products={(products as Array<{ id: string; name: string; sub_category?: string }>) || []}
                    channels={(channels as Array<{ id: string; name: string; favicon_url?: string }>) || []}
                    pickupHotels={(pickupHotels as Array<{ id: string; hotel?: string | null; name?: string | null; name_ko?: string | null; pick_up_location?: string | null }>) || []}
                    productOptions={(productOptions as Array<{ id: string; name: string; is_required?: boolean }>) || []}
                    optionChoices={(optionChoices as Array<{ id: string; name: string }>) || []}
                    tourInfoMap={tourInfoMap}
                    reservationPricingMap={reservationPricingMap}
                    locale={locale}
                    emailDropdownOpen={emailDropdownOpen}
                    sendingEmail={sendingEmail}
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
                    onEmailDropdownToggle={handleEmailDropdownToggle}
                    onEditClick={handleEditClick}
                    onCustomerClick={handleCustomerClick}
                    onRefreshReservations={refreshReservations}
                    onStatusChange={handleStatusChange}
                    generatePriceCalculation={generatePriceCalculation}
                    getGroupColorClasses={getGroupColorClasses}
                        getSelectedChoicesFromNewSystem={getSelectedChoicesNormalized}
                        choicesCacheRef={choicesCacheRef}
                        residentCustomerBatchMap={residentCustomerBatchMap}
                        linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
                        cardLayout={cardLayout}
                        onOpenTourDetailModal={handleOpenTourDetailModal}
                        reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
                        onReservationOptionsMutated={handleReservationOptionsMutated}
                        reshowPickupSummaryRequest={pickupSummaryReshowRequest}
                        onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
                    followUpPipelineSnapshot={followUpSnapshotsByReservationId.get(reservation.id) ?? null}
                    {...(cardLayout === 'simple'
                      ? {
                          onFollowUpPipelineManualChange: handleFollowUpPipelineManualChange,
                          onCancelFollowUpManualChange: handleCancelFollowUpManualChange,
                        }
                      : {})}
                  />
                ))}
              </div>
            </div>
          )
        )
            }
          </>
        )
      }
      
      {/* ?????????- ??????? ??? (?????? ???? ?????) */}
      {!groupByDate && totalPages > 1 && (
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

      {/* ?? ??? ?? */}
      {editingCustomer && (
        <CustomerForm
          customer={editingCustomer}
          channels={channels || []}
          onSubmit={async (customerData) => {
            try {
              // Supabase???? ??? ??????
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

              // ??? ???? ?? ?????
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

                // ??? ???? ?? ?????
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
        reservations={reservations}
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
        reservationPricingMap={reservationPricingMap}
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
        onRefreshReservationPricing={refreshReservationPricingForIds}
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

      <ReservationFollowUpQueueModal
        isOpen={followUpQueueModalOpen}
        onClose={() => setFollowUpQueueModalOpen(false)}
        reservations={filteredReservations as Reservation[]}
        customers={(customers as Customer[]) || []}
        snapshotsByReservationId={followUpSnapshotsByReservationId}
        loadingSnapshots={followUpSnapshotsLoading}
        onCancelFollowUpManualChange={handleCancelFollowUpManualChange}
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
            emailDropdownOpen={emailDropdownOpen}
            sendingEmail={sendingEmail}
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
            onEmailDropdownToggle={handleEmailDropdownToggle}
            onEditClick={(id) => {
              handleEditClick(id)
              setFollowUpQueueModalOpen(false)
            }}
            onCustomerClick={handleCustomerClick}
            onRefreshReservations={refreshReservations}
            onStatusChange={handleStatusChange}
            generatePriceCalculation={generatePriceCalculation}
            getGroupColorClasses={getGroupColorClasses}
            getSelectedChoicesFromNewSystem={getSelectedChoicesNormalized}
            choicesCacheRef={choicesCacheRef}
            residentCustomerBatchMap={residentCustomerBatchMap}
            linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
            cardLayout="simple"
            onOpenTourDetailModal={handleOpenTourDetailModal}
            reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
            onReservationOptionsMutated={handleReservationOptionsMutated}
            reshowPickupSummaryRequest={pickupSummaryReshowRequest}
            onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
            followUpPipelineSnapshot={followUpSnapshotsByReservationId.get(reservation.id) ?? null}
            onFollowUpPipelineManualChange={handleFollowUpPipelineManualChange}
            onCancelFollowUpManualChange={handleCancelFollowUpManualChange}
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
            setShowEmailLogs(false)
            setSelectedReservationForEmailLogs(null)
          }}
          reservationId={selectedReservationForEmailLogs}
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

      {tourDetailModalTourId ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reservations-tour-detail-modal-title"
          onClick={() => setTourDetailModalTourId(null)}
        >
          <div
            className="flex h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <h3 id="reservations-tour-detail-modal-title" className="text-lg font-semibold text-gray-900 truncate pr-2">
                {t('card.tourDetailModalTitle')}
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`/${locale}/admin/tours/${tourDetailModalTourId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                >
                  {t('card.openTourInNewTab')}
                </a>
                <button
                  type="button"
                  onClick={() => setTourDetailModalTourId(null)}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                  aria-label={t('card.close')}
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-gray-50">
              <TourDetailModalContent tourId={tourDetailModalTourId} />
            </div>
          </div>
        </div>
      ) : null}

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
            emailDropdownOpen={emailDropdownOpen}
            sendingEmail={sendingEmail}
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
            onEmailDropdownToggle={handleEmailDropdownToggle}
            onEditClick={handleEditClick}
            onCustomerClick={handleCustomerClick}
            onRefreshReservations={refreshReservations}
            onStatusChange={handleStatusChange}
            generatePriceCalculation={generatePriceCalculation}
            getGroupColorClasses={getGroupColorClasses}
            getSelectedChoicesFromNewSystem={getSelectedChoicesNormalized}
            choicesCacheRef={choicesCacheRef}
            residentCustomerBatchMap={residentCustomerBatchMap}
            linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
            cardLayout="simple"
            onOpenTourDetailModal={handleOpenTourDetailModal}
            reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
            onReservationOptionsMutated={handleReservationOptionsMutated}
            reshowPickupSummaryRequest={pickupSummaryReshowRequest}
            onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
            followUpPipelineSnapshot={followUpSnapshotsByReservationId.get(reservation.id) ?? null}
            onFollowUpPipelineManualChange={handleFollowUpPipelineManualChange}
            onCancelFollowUpManualChange={handleCancelFollowUpManualChange}
          />
        )}
      />

      <CancellationReasonModal
        isOpen={cancellationReasonModalOpen}
        locale={locale}
        initialValue={cancellationReasonValue}
        saving={cancellationReasonSaving}
        onClose={closeCancellationReasonModal}
        onSubmit={submitCancellationReasonModal}
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
