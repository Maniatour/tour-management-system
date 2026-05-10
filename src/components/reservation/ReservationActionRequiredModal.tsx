'use client'

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertCircle, MapPin, DollarSign, CreditCard, Scale, HelpCircle, ChevronLeft, ChevronRight, LayoutGrid, Table2, GalleryHorizontal, Ban } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { aggregateReservationOptionSumsByReservationId } from '@/lib/syncReservationPricingAggregates'
import { ReservationCardItem } from '@/components/reservation/ReservationCardItem'
import {
  ReservationActionRequiredTable,
  type ActionRequiredTableVariant,
} from '@/components/reservation/ReservationActionRequiredTable'
import {
  computeRemainingBalanceAmount,
  normalizeReservationIdForPayments,
  paymentRecordAmountToNumber,
  summarizePaymentRecordsForBalance,
  type PaymentRecordLike,
  type PricingBalanceFields,
} from '@/utils/reservationPricingBalance'
import {
  reservationMatchesExtendedPricingMismatchCriteria,
  type BalanceChannelRowInput,
} from '@/utils/balanceChannelRevenue'
import { reservationNeedsCancelFinancialCleanup } from '@/lib/reservationActionRequiredCancelTab'
import type { Reservation, Customer } from '@/types/reservation'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'

export type ActionRequiredTabId = 'status' | 'tour' | 'pricing' | 'deposit' | 'cancel' | 'balance'
export type PricingSubTabId = 'noPrice' | 'mismatch'
export type BalanceSubTabId = 'cancelled' | 'unpaid' | 'calcWrong'
export type BalanceTotalFilterId = 'all' | 'totalMismatch'

export interface ReservationActionRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  /** 운영 큐용 전역 목록을 처음 채우는 동안 */
  bulkReservationsLoading?: boolean
  reservations: Reservation[]
  customers: Customer[]
  products: Array<{ id: string; name: string; sub_category?: string; base_price?: number }>
  channels: Array<{
    id: string
    name: string
    favicon_url?: string | null
    type?: string | null
    category?: string | null
    commission_percent?: number | null
  }>
  pickupHotels: Array<{ id: string; hotel?: string | null; name?: string | null; name_ko?: string | null; pick_up_location?: string | null; address?: string | null }>
  productOptions: Array<{ id: string; name: string; is_required?: boolean }>
  optionChoices: Array<{ id: string; name: string; option_id?: string; adult_price?: number; child_price?: number; infant_price?: number }>
  tourInfoMap: Map<string, {
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
  }>
  reservationPricingMap: Map<string, {
    total_price: number
    balance_amount: number
    adult_product_price?: number
    child_product_price?: number
    infant_product_price?: number
    product_price_total?: number
    coupon_discount?: number
    additional_discount?: number
    additional_cost?: number
    commission_percent?: number
    commission_amount?: number
    deposit_amount?: number
    option_total?: number
    choices_total?: number
    not_included_price?: number
    currency?: string
  }>
  locale: string
  onPricingInfoClick: (reservation: Reservation) => void
  onCreateTour: (reservation: Reservation) => void
  onPickupTimeClick: (reservation: Reservation, e: React.MouseEvent, opts?: { resumePickupSummary?: boolean }) => void
  onPickupHotelClick: (reservation: Reservation, e: React.MouseEvent, opts?: { resumePickupSummary?: boolean }) => void
  onPaymentClick: (reservation: Reservation) => void
  onDetailClick: (reservation: Reservation) => void
  onReviewClick: (reservation: Reservation) => void
  onEmailPreview: (
    reservation: Reservation,
    emailType: 'confirmation' | 'departure' | 'pickup' | 'resident_inquiry'
  ) => void
  onEmailLogsClick: (reservationId: string) => void
  onEmailDropdownToggle: (reservationId: string) => void
  onEditClick: (reservationId: string) => void
  /** 한 건씩(가격 불일치) 모드 종료 시 예약 수정 폼 닫기 — admin에서 setEditingReservation(null) 등 */
  onExitOneByOneEdit?: () => void
  onCustomerClick: (customer: Customer) => void
  onRefreshReservations: () => void
  /** pricing 행만 갱신 — 전체 목록 재조회 없이 reservation_pricing 맵 병합(모달 리셋 방지) */
  onRefreshReservationPricing?: (reservationIds: string[]) => void | Promise<void>
  onStatusChange?: (reservationId: string, newStatus: string) => Promise<void>
  generatePriceCalculation: (reservation: Reservation, pricing: unknown) => string
  getGroupColorClasses: (groupId: string, groupName?: string, optionName?: string) => string
  getSelectedChoicesFromNewSystem: (reservationId: string) => Promise<Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: { option_key: string; option_name: string; option_name_ko: string; product_choices: { choice_group_ko: string } }
  }>>
  choicesCacheRef: React.MutableRefObject<Map<string, Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: { option_key: string; option_name: string; option_name_ko: string; product_choices: { choice_group_ko: string } }
  }>>>
  emailDropdownOpen: string | null
  sendingEmail: string | null
  /** tours.reservation_ids만으로 연결된 경우 투어 배정으로 간주 */
  tourIdByReservationId?: Map<string, string>
  reshowPickupSummaryRequest?: { reservationId: string; nonce: number } | null
  onReshowPickupSummaryConsumed?: () => void
}

const TABS: { id: ActionRequiredTabId; labelKey: string; icon: React.ElementType }[] = [
  { id: 'status', labelKey: 'actionRequired.tabs.status', icon: AlertCircle },
  { id: 'tour', labelKey: 'actionRequired.tabs.tour', icon: MapPin },
  { id: 'pricing', labelKey: 'actionRequired.tabs.pricing', icon: DollarSign },
  { id: 'deposit', labelKey: 'actionRequired.tabs.deposit', icon: CreditCard },
  { id: 'cancel', labelKey: 'actionRequired.tabs.cancel', icon: Ban },
  { id: 'balance', labelKey: 'actionRequired.tabs.balance', icon: Scale },
]

const CARDS_PER_PAGE = 12 // 가로 4개 x 3행
const TABLE_PAGE_SIZE_OPTIONS = [50, 100, 250] as const
type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number]

export default function ReservationActionRequiredModal({
  isOpen,
  onClose,
  bulkReservationsLoading = false,
  reservations,
  customers,
  products,
  channels,
  pickupHotels,
  productOptions,
  optionChoices,
  tourInfoMap,
  reservationPricingMap,
  locale,
  onPricingInfoClick,
  onCreateTour,
  onPickupTimeClick,
  onPickupHotelClick,
  onPaymentClick,
  onDetailClick,
  onReviewClick,
  onEmailPreview,
  onEmailLogsClick,
  onEmailDropdownToggle,
  onEditClick,
  onExitOneByOneEdit,
  onCustomerClick,
  onRefreshReservations,
  onRefreshReservationPricing,
  onStatusChange,
  generatePriceCalculation,
  getGroupColorClasses,
  getSelectedChoicesFromNewSystem,
  choicesCacheRef,
  emailDropdownOpen,
  sendingEmail,
  tourIdByReservationId,
  reshowPickupSummaryRequest = null,
  onReshowPickupSummaryConsumed
}: ReservationActionRequiredModalProps) {
  const t = useTranslations('reservations')
  const [activeTab, setActiveTab] = useState<ActionRequiredTabId>('status')
  const [pricingSubTab, setPricingSubTab] = useState<PricingSubTabId>('noPrice')
  const [balanceSubTab, setBalanceSubTab] = useState<BalanceSubTabId>('unpaid')
  const [balanceTotalFilter, setBalanceTotalFilter] = useState<BalanceTotalFilterId>('all')
  const [page, setPage] = useState(1)
  const [tableRowsPerPage, setTableRowsPerPage] = useState<TablePageSize>(50)
  const [listViewMode, setListViewMode] = useState<'card' | 'table' | 'detail'>('table')
  const [manualOpen, setManualOpen] = useState(false)
  const [reservationIdsWithPayments, setReservationIdsWithPayments] = useState<Set<string>>(new Set())
  const [paymentRecordsByReservationId, setPaymentRecordsByReservationId] = useState<
    Map<string, PaymentRecordLike[]>
  >(() => new Map())
  const [reservationOptionSumByReservationId, setReservationOptionSumByReservationId] = useState<
    Map<string, number>
  >(() => new Map())
  const [reservationOptionsPresenceByReservationId, setReservationOptionsPresenceByReservationId] =
    useState<Map<string, boolean>>(() => new Map())
  const [loadingPayments, setLoadingPayments] = useState(false)

  // 탭 전환 시 1페이지로
  useEffect(() => {
    setPage(1)
  }, [activeTab, pricingSubTab, balanceSubTab, balanceTotalFilter])

  useEffect(() => {
    setPage(1)
  }, [listViewMode])

  useEffect(() => {
    setPage(1)
  }, [tableRowsPerPage])

  /** ② 불일치 탭 전용 '한 건씩' 모드 — 다른 탭으로 나가면 테이블로 복귀 */
  useEffect(() => {
    if (listViewMode !== 'detail') return
    if (activeTab !== 'pricing' || pricingSubTab !== 'mismatch') {
      setListViewMode('table')
    }
  }, [activeTab, pricingSubTab, listViewMode])

  const prevListViewModeRef = useRef(listViewMode)
  useEffect(() => {
    const prev = prevListViewModeRef.current
    prevListViewModeRef.current = listViewMode
    if (prev === 'detail' && listViewMode !== 'detail') {
      onExitOneByOneEdit?.()
    }
  }, [listViewMode, onExitOneByOneEdit])

  const detailSwipeStartX = useRef<number | null>(null)

  const pricingMismatchDetailMode =
    activeTab === 'pricing' && pricingSubTab === 'mismatch' && listViewMode === 'detail'

  const renderManualText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g)
    return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))
  }

  const todayStr = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
  }, [])

  const sevenDaysLaterStr = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  }, [])

  /** 부모가 매 렌더 `reservations` 새 배열을 넘겨도 id 집합이 같으면 입금/옵션 집계 effect가 다시 돌지 않음 */
  const reservationsPaymentLoadKey = useMemo(
    () =>
      [...new Set(reservations.map((r) => normalizeReservationIdForPayments(r.id)).filter(Boolean))]
        .sort()
        .join(','),
    [reservations]
  )

  const mergePaymentAndOptionAggregates = useCallback(async (reservationIds: string[]) => {
    const ids = [...new Set(reservationIds)].filter(Boolean)
    if (ids.length === 0) return
    const chunkSize = 200
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = [...new Set(ids.slice(i, i + chunkSize).map(normalizeReservationIdForPayments).filter(Boolean))]
      const [{ data }, { data: optRows }] = await Promise.all([
        supabase
          .from('payment_records')
          .select('reservation_id, payment_status, amount')
          .in('reservation_id', chunk),
        supabase
          .from('reservation_options')
          .select('reservation_id, total_price, price, ea, status')
          .in('reservation_id', chunk),
      ])
      const chunkByRes = new Map<string, PaymentRecordLike[]>()
      for (const id of chunk) {
        chunkByRes.set(id, [])
      }
      if (data) {
        for (const row of data as {
          reservation_id: string
          payment_status: string
          amount: unknown
        }[]) {
          const rid = normalizeReservationIdForPayments(row.reservation_id)
          if (!rid) continue
          const rec: PaymentRecordLike = {
            payment_status: String(row.payment_status ?? '').trim(),
            amount: paymentRecordAmountToNumber(row.amount),
          }
          const arr = chunkByRes.get(rid) ?? []
          arr.push(rec)
          chunkByRes.set(rid, arr)
        }
      }
      setReservationIdsWithPayments((prev) => {
        const next = new Set(prev)
        for (const id of chunk) {
          const rows = chunkByRes.get(id) ?? []
          if (rows.length > 0) next.add(id)
        }
        return next
      })
      setPaymentRecordsByReservationId((prev) => {
        const next = new Map(prev)
        for (const id of chunk) {
          next.set(id, chunkByRes.get(id) ?? [])
        }
        return next
      })
      const chunkSums = aggregateReservationOptionSumsByReservationId(optRows ?? [])
      setReservationOptionSumByReservationId((prev) => {
        const n = new Map(prev)
        const sumsByNorm = new Map<string, number>()
        for (const [rid, v] of chunkSums) {
          const k = normalizeReservationIdForPayments(rid)
          if (!k) continue
          sumsByNorm.set(k, Math.round(((sumsByNorm.get(k) ?? 0) + v) * 100) / 100)
        }
        for (const id of chunk) {
          n.set(id, sumsByNorm.get(id) ?? 0)
        }
        return n
      })
      setReservationOptionsPresenceByReservationId((prev) => {
        const n = new Map(prev)
        for (const id of chunk) {
          n.set(id, false)
        }
        for (const row of optRows ?? []) {
          const rid = normalizeReservationIdForPayments((row as { reservation_id?: string }).reservation_id)
          if (rid) n.set(rid, true)
        }
        return n
      })
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !reservationsPaymentLoadKey) {
      setReservationIdsWithPayments(new Set())
      setPaymentRecordsByReservationId(new Map())
      setReservationOptionSumByReservationId(new Map())
      setReservationOptionsPresenceByReservationId(new Map())
      setLoadingPayments(false)
      return
    }
    const ids = reservationsPaymentLoadKey.split(',').filter(Boolean)
    let cancelled = false
    setLoadingPayments(true)
    void (async () => {
      const set = new Set<string>()
      const byRes = new Map<string, PaymentRecordLike[]>()
      const mergedOptionSums = new Map<string, number>()
      const mergedOptionsPresence = new Map<string, boolean>()
      ids.forEach((id) => mergedOptionsPresence.set(id, false))
      const chunkSize = 200
      try {
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = [...new Set(ids.slice(i, i + chunkSize).map(normalizeReservationIdForPayments).filter(Boolean))]
          const [{ data }, { data: optRows }] = await Promise.all([
            supabase
              .from('payment_records')
              .select('reservation_id, payment_status, amount')
              .in('reservation_id', chunk),
            supabase
              .from('reservation_options')
              .select('reservation_id, total_price, price, ea, status')
              .in('reservation_id', chunk),
          ])
          if (cancelled) return
          if (data) {
            data.forEach((row: { reservation_id: string; payment_status: string; amount: unknown }) => {
              const rid = normalizeReservationIdForPayments(row.reservation_id)
              if (!rid) return
              set.add(rid)
              const rec: PaymentRecordLike = {
                payment_status: String(row.payment_status ?? '').trim(),
                amount: paymentRecordAmountToNumber(row.amount),
              }
              const arr = byRes.get(rid) ?? []
              arr.push(rec)
              byRes.set(rid, arr)
            })
          }
          const chunkSums = aggregateReservationOptionSumsByReservationId(optRows ?? [])
          for (const [rid, v] of chunkSums) {
            const k = normalizeReservationIdForPayments(rid)
            if (!k) continue
            const prev = mergedOptionSums.get(k) ?? 0
            mergedOptionSums.set(k, Math.round((prev + v) * 100) / 100)
          }
          for (const row of optRows ?? []) {
            const rid = normalizeReservationIdForPayments((row as { reservation_id?: string }).reservation_id)
            if (rid) mergedOptionsPresence.set(rid, true)
          }
        }
        if (cancelled) return
        setReservationIdsWithPayments(set)
        setPaymentRecordsByReservationId(byRes)
        setReservationOptionSumByReservationId(mergedOptionSums)
        setReservationOptionsPresenceByReservationId(mergedOptionsPresence)
      } finally {
        if (!cancelled) setLoadingPayments(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, reservationsPaymentLoadKey])

  const handleReservationOptionsMutated = useCallback(
    (reservationId: string) => {
      void (async () => {
        const { data: optRows } = await supabase
          .from('reservation_options')
          .select('reservation_id, total_price, price, ea, status')
          .eq('reservation_id', reservationId)
        const has = (optRows?.length ?? 0) > 0
        setReservationOptionsPresenceByReservationId((prev) => {
          const next = new Map(prev)
          next.set(reservationId, has)
          return next
        })
        const chunkSums = aggregateReservationOptionSumsByReservationId(optRows ?? [])
        const sum = chunkSums.get(reservationId) ?? 0
        setReservationOptionSumByReservationId((prev) => {
          const next = new Map(prev)
          next.set(reservationId, sum)
          return next
        })
        await onRefreshReservationPricing?.([reservationId])
      })()
    },
    [onRefreshReservationPricing]
  )

  const hasTourAssigned = useCallback(
    (r: Reservation) => {
      const id = r.tourId?.trim?.()
      if (id && id !== '' && id !== 'null' && id !== 'undefined') return true
      return tourIdByReservationId?.has(r.id) ?? false
    },
    [tourIdByReservationId]
  )

  const filteredByTab = useMemo(() => {
    // 동일 id가 배열에 중복되면 탭 목록·카드 key가 겹침 → id 기준으로 한 건만 유지
    const isDeleted = (r: Reservation) => {
      const s = (r.status as string)?.trim?.() ?? ''
      return s.toLowerCase() === 'deleted'
    }
    const list = [...new Map(reservations.map((r) => [r.id, r])).values()].filter((r) => !isDeleted(r))

    const statusPending = (r: Reservation) => (r.status === 'pending' || (r.status as string)?.toLowerCase?.() === 'pending')
    const statusConfirmed = (r: Reservation) => (r.status === 'confirmed' || (r.status as string)?.toLowerCase?.() === 'confirmed')
    const hasPayment = (r: Reservation) => reservationIdsWithPayments.has(r.id)
    const hasPricing = (r: Reservation) => {
      const p = reservationPricingMap.get(r.id)
      return !!(p && (p.total_price != null && p.total_price > 0))
    }
    const getBalance = (r: Reservation) => {
      const p = reservationPricingMap.get(r.id)
      const b = p?.balance_amount
      if (b == null) return 0
      return typeof b === 'number' ? b : parseFloat(String(b)) || 0
    }
    const tourDateBeforeToday = (r: Reservation) => {
      const d = r.tourDate
      if (!d) return false
      return d < todayStr
    }
    const tourDateWithin7Days = (r: Reservation) => {
      const d = r.tourDate
      if (!d) return false
      return d >= todayStr && d <= sevenDaysLaterStr
    }
    const isManiaTourOrService = (r: Reservation) => {
      const product = products.find(p => p.id === r.productId)
      const sub = product?.sub_category?.trim() || ''
      return sub === 'Mania Tour' || sub === 'Mania Service'
    }
    const isNotCancelled = (r: Reservation) => {
      const s = (r.status as string)?.trim?.() ?? ''
      return !s.toLowerCase().startsWith('cancelled')
    }
    const isCancelled = (r: Reservation) => {
      const s = (r.status as string)?.trim?.() ?? ''
      return s.toLowerCase() === 'cancelled' || s.toLowerCase() === 'canceled'
    }

    const statusList = list.filter(r =>
      tourDateWithin7Days(r) && statusPending(r)
    )
    const tourList = list.filter(r =>
      statusConfirmed(r) && !hasTourAssigned(r) && isManiaTourOrService(r)
    )
    const noPricing = list.filter(r => !hasPricing(r) && isNotCancelled(r))
    const pricingMismatch = list.filter(
      (r) =>
        hasPricing(r) &&
        isNotCancelled(r) &&
        reservationMatchesExtendedPricingMismatchCriteria(
          r,
          reservationPricingMap as Map<string, ReservationPricingMapValue>,
          channels as BalanceChannelRowInput[],
          paymentRecordsByReservationId,
          reservationOptionSumByReservationId
        )
    )
    const pricingList = [...new Map([...noPricing.map(r => [r.id, r]), ...pricingMismatch.map(r => [r.id, r])]).values()]
    const depositNoTour = list.filter(r => hasPayment(r) && !hasTourAssigned(r))
    const confirmedNoDeposit = list.filter(r => statusConfirmed(r) && !hasPayment(r))
    const depositList = [...new Map([...depositNoTour.map(r => [r.id, r]), ...confirmedNoDeposit.map(r => [r.id, r])]).values()]

    const cancelFinancialList = list.filter((r) =>
      reservationNeedsCancelFinancialCleanup(
        r,
        reservationPricingMap as Map<string, ReservationPricingMapValue>,
        paymentRecordsByReservationId,
        channels as BalanceChannelRowInput[],
        reservationOptionSumByReservationId
      )
    )

    const pricingNum = (v: unknown): number => {
      if (v == null || v === '') return 0
      if (typeof v === 'number' && !Number.isNaN(v)) return v
      const n = parseFloat(String(v))
      return Number.isNaN(n) ? 0 : n
    }
    const balanceStoredMatchesFormula = (r: Reservation) => {
      const p = reservationPricingMap.get(r.id)
      if (!p || !hasPricing(r)) return true
      try {
        const party = { adults: r.adults ?? 0, children: r.child ?? 0, infants: r.infant ?? 0 }
        const expected = computeRemainingBalanceAmount(p as PricingBalanceFields, null, party)
        if (Number.isNaN(expected)) return true
        const stored = getBalance(r)
        return Math.abs(stored - expected) <= 0.01
      } catch {
        return true
      }
    }
    const pastTour = (r: Reservation) => tourDateBeforeToday(r)
    const balanceCancelledList = list.filter(
      r => isCancelled(r) && pastTour(r) && getBalance(r) > 0
    )
    const balanceUnpaidList = list.filter(
      r => !isCancelled(r) && pastTour(r) && getBalance(r) > 0 && balanceStoredMatchesFormula(r)
    )
    /** 총액(DB) − 보증금(DB) − 잔금 수령(입금 집계) ≠ 0 */
    const balanceCalcWrongList = list.filter((r) => {
      if (isCancelled(r) || !pastTour(r) || !hasPricing(r)) return false
      const p = reservationPricingMap.get(r.id)
      if (!p) return false
      const records = paymentRecordsByReservationId?.get(r.id) ?? []
      const balanceReceived = summarizePaymentRecordsForBalance(records).balanceReceivedTotal
      const total = pricingNum(p.total_price)
      const dep = pricingNum(p.deposit_amount)
      return Math.abs(total - dep - balanceReceived) > 0.01
    })
    const balanceAllUnion = [
      ...new Map([
        ...balanceCancelledList.map((r) => [r.id, r] as const),
        ...balanceUnpaidList.map((r) => [r.id, r] as const),
        ...balanceCalcWrongList.map((r) => [r.id, r] as const)
      ]).values()
    ]

    return {
      status: statusList,
      tour: tourList,
      pricing: pricingList,
      pricingNoPrice: noPricing,
      pricingMismatch,
      deposit: depositList,
      cancel: cancelFinancialList,
      balance: balanceAllUnion,
      balanceCancelled: balanceCancelledList,
      balanceUnpaid: balanceUnpaidList,
      balanceCalcWrong: balanceCalcWrongList,
    }
  }, [
    reservations,
    reservationPricingMap,
    reservationOptionSumByReservationId,
    products,
    optionChoices,
    reservationIdsWithPayments,
    todayStr,
    sevenDaysLaterStr,
    hasTourAssigned,
    paymentRecordsByReservationId,
    channels
  ])

  const counts = useMemo(() => ({
    status: filteredByTab.status.length,
    tour: filteredByTab.tour.length,
    pricing: filteredByTab.pricing.length,
    deposit: filteredByTab.deposit.length,
    cancel: filteredByTab.cancel.length,
    balance: filteredByTab.balance.length,
  }), [filteredByTab])

  const totalActionCount = useMemo(() =>
    new Set([
      ...filteredByTab.status.map(r => r.id),
      ...filteredByTab.tour.map(r => r.id),
      ...filteredByTab.pricing.map(r => r.id),
      ...filteredByTab.deposit.map(r => r.id),
      ...filteredByTab.cancel.map(r => r.id),
      ...filteredByTab.balance.map(r => r.id),
    ]).size
  , [filteredByTab])

  const currentList = useMemo(() => {
    if (activeTab === 'pricing') {
      return filteredByTab[pricingSubTab === 'noPrice' ? 'pricingNoPrice' : 'pricingMismatch']
    }
    if (activeTab === 'balance') {
      let list =
        filteredByTab[
          balanceSubTab === 'cancelled'
            ? 'balanceCancelled'
            : balanceSubTab === 'unpaid'
              ? 'balanceUnpaid'
              : 'balanceCalcWrong'
        ]
      if (balanceTotalFilter === 'totalMismatch') {
        list = list.filter((r) =>
          reservationMatchesExtendedPricingMismatchCriteria(
            r,
            reservationPricingMap as Map<string, ReservationPricingMapValue>,
            channels as BalanceChannelRowInput[],
            paymentRecordsByReservationId,
            reservationOptionSumByReservationId
          )
        )
      }
      return list
    }
    return filteredByTab[activeTab as keyof typeof filteredByTab] as Reservation[]
  }, [
    activeTab,
    pricingSubTab,
    balanceSubTab,
    balanceTotalFilter,
    filteredByTab,
    reservationPricingMap,
    reservationOptionSumByReservationId,
    channels,
    paymentRecordsByReservationId,
  ])

  const balanceSubTabBaseList = useMemo(() => {
    if (activeTab !== 'balance') return []
    return filteredByTab[
      balanceSubTab === 'cancelled'
        ? 'balanceCancelled'
        : balanceSubTab === 'unpaid'
          ? 'balanceUnpaid'
          : 'balanceCalcWrong'
    ]
  }, [activeTab, balanceSubTab, filteredByTab])

  const balanceTotalMismatchCount = useMemo(() => {
    return balanceSubTabBaseList.filter((r) =>
      reservationMatchesExtendedPricingMismatchCriteria(
        r,
        reservationPricingMap as Map<string, ReservationPricingMapValue>,
        channels as BalanceChannelRowInput[],
        paymentRecordsByReservationId,
        reservationOptionSumByReservationId
      )
    ).length
  }, [
    balanceSubTabBaseList,
    reservationPricingMap,
    reservationOptionSumByReservationId,
    channels,
    paymentRecordsByReservationId,
  ])

  useEffect(() => {
    if (activeTab !== 'balance') setBalanceTotalFilter('all')
  }, [activeTab])

  const pageSize =
    listViewMode === 'detail' ? 1 : listViewMode === 'table' ? tableRowsPerPage : CARDS_PER_PAGE
  const totalPages = Math.max(1, Math.ceil(currentList.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedList = useMemo(
    () => currentList.slice((safePage - 1) * pageSize, safePage * pageSize),
    [currentList, safePage, pageSize]
  )

  /** 한 건씩: 현재 예약에 대해 상위의 예약 수정 모달(ReservationForm) 열기 */
  useEffect(() => {
    if (!pricingMismatchDetailMode || !paginatedList[0]) return
    onEditClick(paginatedList[0].id)
  }, [pricingMismatchDetailMode, paginatedList[0]?.id, onEditClick])

  const handleCloseModal = useCallback(() => {
    if (listViewMode === 'detail') {
      setListViewMode('table')
    }
    onClose()
  }, [listViewMode, onClose])

  const actionRequiredTableVariant = useMemo((): ActionRequiredTableVariant => {
    if (activeTab === 'balance') return 'balance'
    if (activeTab === 'cancel') return 'balance'
    if (activeTab === 'status') return 'status'
    if (activeTab === 'tour') return 'tour'
    if (activeTab === 'pricing') return pricingSubTab === 'noPrice' ? 'pricingNoPrice' : 'pricingMismatch'
    return 'deposit'
  }, [activeTab, pricingSubTab])

  const showCardTableToggle =
    currentList.length > 0 && !(loadingPayments && (activeTab === 'deposit' || activeTab === 'cancel'))

  // 현재 탭 목록이 줄었을 때 페이지 범위 맞추기
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [totalPages, page])

  const onDetailTouchStart = useCallback((e: React.TouchEvent) => {
    detailSwipeStartX.current = e.targetTouches[0]?.clientX ?? null
  }, [])

  const onDetailTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = detailSwipeStartX.current
      detailSwipeStartX.current = null
      if (start == null || totalPages <= 1) return
      const end = e.changedTouches[0]?.clientX
      if (end == null) return
      const delta = end - start
      if (Math.abs(delta) < 56) return
      if (delta < 0) setPage((p) => Math.min(totalPages, p + 1))
      else setPage((p) => Math.max(1, p - 1))
    },
    [totalPages]
  )

  useEffect(() => {
    if (!isOpen || !pricingMismatchDetailMode || currentList.length <= 1) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target
      if (el instanceof HTMLElement) {
        const name = el.tagName
        if (name === 'INPUT' || name === 'TEXTAREA' || el.isContentEditable) return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setPage((p) => Math.max(1, p - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setPage((p) => Math.min(totalPages, p + 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, pricingMismatchDetailMode, currentList.length, totalPages])

  if (!isOpen) return null

  if (bulkReservationsLoading) {
    const loadingMsg =
      locale === 'en' ? 'Loading all reservations for this queue…' : '처리 큐용 전체 예약을 불러오는 중…'
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          className="flex flex-col items-center gap-3 rounded-xl bg-white px-8 py-10 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-center text-sm text-gray-700">{loadingMsg}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        className="flex h-full min-h-0 w-full max-w-none flex-col bg-white pt-[env(safe-area-inset-top)] shadow-xl rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-[min(98vw,2000px)] sm:rounded-xl sm:pt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 flex-col gap-3 border-b border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h2 className="min-w-0 text-base font-semibold text-gray-900 sm:text-lg">
              <span className="inline align-middle">{t('actionRequired.title')}</span>
              {totalActionCount > 0 && (
                <span className="ml-2 inline-flex shrink-0 items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-800">
                  {totalActionCount}건
                </span>
              )}
            </h2>
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-100"
              title={t('actionRequired.helpButton')}
              aria-label={t('actionRequired.helpButton')}
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
            {showCardTableToggle && (
              <div
                className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50"
                role="group"
                aria-label={`${t('actionRequired.viewCard')} / ${t('actionRequired.viewTable')}${
                  activeTab === 'pricing' && pricingSubTab === 'mismatch'
                    ? ` / ${t('actionRequired.viewDetail')}`
                    : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setListViewMode('card')}
                  className={`inline-flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:min-h-0 sm:py-1.5 ${
                    listViewMode === 'card'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title={t('actionRequired.viewCard')}
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{t('actionRequired.viewCard')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setListViewMode('table')}
                  className={`inline-flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:min-h-0 sm:py-1.5 ${
                    listViewMode === 'table'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title={t('actionRequired.viewTable')}
                >
                  <Table2 className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{t('actionRequired.viewTable')}</span>
                </button>
                {activeTab === 'pricing' && pricingSubTab === 'mismatch' && (
                  <button
                    type="button"
                    onClick={() => setListViewMode('detail')}
                    className={`inline-flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:min-h-0 sm:py-1.5 ${
                      listViewMode === 'detail'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title={t('actionRequired.viewDetailTooltip')}
                  >
                    <GalleryHorizontal className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">{t('actionRequired.viewDetail')}</span>
                  </button>
                )}
              </div>
            )}
            {showCardTableToggle && listViewMode === 'table' && (
              <label className="inline-flex min-h-[40px] shrink-0 touch-manipulation items-center gap-1.5 text-xs text-gray-600 sm:min-h-0">
                <span className="hidden whitespace-nowrap sm:inline">{t('actionRequired.tableRowsPerPage')}</span>
                <select
                  value={tableRowsPerPage}
                  onChange={(e) => setTableRowsPerPage(Number(e.target.value) as TablePageSize)}
                  className="max-w-[5.5rem] rounded-md border border-gray-300 bg-white px-2 py-2 text-xs text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:py-1"
                  aria-label={t('actionRequired.tableRowsPerPageAria')}
                >
                  {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={handleCloseModal}
              className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-100"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-nowrap overflow-x-auto overscroll-x-contain border-b border-gray-200 [-webkit-overflow-scrolling:touch]">
          {TABS.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              title={t(`actionRequired.tabTooltips.${id}` as Parameters<typeof t>[0])}
              className={`flex min-h-[48px] touch-manipulation items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors sm:min-h-0 sm:px-4 sm:py-3 sm:text-sm ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t(labelKey)}</span>
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs ${
                counts[id] > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {counts[id]}
              </span>
            </button>
          ))}
        </div>

        {/* 예약 가격 탭 하위 탭 */}
        {activeTab === 'pricing' && (
          <div className="flex flex-shrink-0 flex-nowrap overflow-x-auto overscroll-x-contain border-b border-gray-200 bg-gray-50/80 [-webkit-overflow-scrolling:touch]">
            <button
              type="button"
              onClick={() => setPricingSubTab('noPrice')}
              title={t('actionRequired.pricingSubTabTooltips.noPrice')}
              className={`flex min-h-[44px] touch-manipulation items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-sm ${
                pricingSubTab === 'noPrice'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span>{t('actionRequired.pricingSubTabs.noPrice')}</span>
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs ${
                filteredByTab.pricingNoPrice.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-500'
              }`}>
                {filteredByTab.pricingNoPrice.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPricingSubTab('mismatch')}
              title={t('actionRequired.pricingSubTabTooltips.mismatch')}
              className={`flex min-h-[44px] touch-manipulation items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-sm ${
                pricingSubTab === 'mismatch'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span>{t('actionRequired.pricingSubTabs.mismatch')}</span>
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs ${
                filteredByTab.pricingMismatch.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-500'
              }`}>
                {filteredByTab.pricingMismatch.length}
              </span>
            </button>
          </div>
        )}

        {/* Balance 탭 하위 탭 */}
        {activeTab === 'balance' && (
          <div className="flex flex-shrink-0 flex-nowrap overflow-x-auto overscroll-x-contain border-b border-gray-200 bg-gray-50/80 [-webkit-overflow-scrolling:touch]">
            <button
              type="button"
              onClick={() => setBalanceSubTab('cancelled')}
              title={t('actionRequired.balanceSubTabTooltips.cancelled')}
              className={`flex min-h-[44px] touch-manipulation items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-sm ${
                balanceSubTab === 'cancelled'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span>{t('actionRequired.balanceSubTabs.cancelled')}</span>
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs ${
                filteredByTab.balanceCancelled.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-500'
              }`}>
                {filteredByTab.balanceCancelled.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBalanceSubTab('unpaid')}
              title={t('actionRequired.balanceSubTabTooltips.unpaid')}
              className={`flex min-h-[44px] touch-manipulation items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-sm ${
                balanceSubTab === 'unpaid'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span>{t('actionRequired.balanceSubTabs.unpaid')}</span>
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs ${
                filteredByTab.balanceUnpaid.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-500'
              }`}>
                {filteredByTab.balanceUnpaid.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBalanceSubTab('calcWrong')}
              title={t('actionRequired.balanceSubTabTooltips.calcWrong')}
              className={`flex min-h-[44px] touch-manipulation items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-sm ${
                balanceSubTab === 'calcWrong'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span>{t('actionRequired.balanceSubTabs.calcWrong')}</span>
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs ${
                filteredByTab.balanceCalcWrong.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-500'
              }`}>
                {filteredByTab.balanceCalcWrong.length}
              </span>
            </button>
          </div>
        )}

        {activeTab === 'balance' && (
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:px-4">
            <div
              className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50"
              role="group"
              aria-label={t('actionRequired.balanceTotalFilterAria')}
            >
              <button
                type="button"
                onClick={() => setBalanceTotalFilter('all')}
                title={t('actionRequired.balanceTotalFilterTooltips.all')}
                className={`flex min-h-[40px] touch-manipulation items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:min-h-0 sm:py-1.5 ${
                  balanceTotalFilter === 'all'
                    ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                }`}
              >
                <span>{t('actionRequired.balanceTotalFilterTabs.all')}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[10px] ${
                    balanceSubTabBaseList.length > 0 ? 'bg-slate-200 text-slate-800' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {balanceSubTabBaseList.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBalanceTotalFilter('totalMismatch')}
                title={t('actionRequired.balanceTotalFilterTooltips.totalMismatch')}
                className={`flex min-h-[40px] touch-manipulation items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:min-h-0 sm:py-1.5 ${
                  balanceTotalFilter === 'totalMismatch'
                    ? 'bg-white text-amber-800 shadow-sm border border-amber-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                }`}
              >
                <span>{t('actionRequired.balanceTotalFilterTabs.totalMismatch')}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[10px] ${
                    balanceTotalMismatchCount > 0 ? 'bg-amber-100 text-amber-900' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {balanceTotalMismatchCount}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-3 max-lg:pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-4">
          {loadingPayments && (activeTab === 'deposit' || activeTab === 'cancel') ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
              <span className="ml-2 text-sm text-gray-600">입금 데이터 조회 중...</span>
            </div>
          ) : currentList.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {t('actionRequired.empty')}
            </div>
          ) : (
            <>
              {listViewMode === 'detail' && paginatedList[0] ? (
                <>
                  {typeof document !== 'undefined' &&
                    createPortal(
                      <div
                        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[105] flex -translate-x-1/2 flex-col items-center gap-1.5 pointer-events-none"
                        aria-live="polite"
                      >
                        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-gray-200 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur-sm sm:gap-2 sm:px-3 sm:py-2">
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                            className="rounded-full p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={t('actionRequired.detailPrevReservation')}
                          >
                            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                          </button>
                          <span className="min-w-[5rem] text-center text-xs font-medium tabular-nums text-gray-800 sm:text-sm">
                            {safePage} / {totalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                            className="rounded-full p-2 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={t('actionRequired.detailNextReservation')}
                          >
                            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                          </button>
                        </div>
                        {totalPages > 1 && (
                          <p className="pointer-events-none max-w-[min(90vw,20rem)] text-center text-[10px] text-gray-600 sm:text-xs">
                            {t('actionRequired.detailSwipeHint')}
                          </p>
                        )}
                      </div>,
                      document.body
                    )}
                  <div
                    className="flex min-h-[4rem] flex-col items-center justify-center py-4 text-center text-xs text-gray-500"
                    onTouchStart={onDetailTouchStart}
                    onTouchEnd={onDetailTouchEnd}
                  >
                    <p className="max-w-md text-sm text-gray-700">{t('actionRequired.detailEditFormHint')}</p>
                    <p className="mt-1 max-w-md text-[11px] leading-relaxed text-gray-500">
                      {t('actionRequired.detailEditFormSubHint')}
                    </p>
                  </div>
                </>
              ) : listViewMode === 'card' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {paginatedList.map((reservation) => (
                    <ReservationCardItem
                      key={reservation.id}
                      reservation={reservation}
                      customers={customers}
                      products={products}
                      channels={channels}
                      pickupHotels={pickupHotels}
                      productOptions={productOptions}
                      optionChoices={optionChoices}
                      tourInfoMap={tourInfoMap}
                      reservationPricingMap={reservationPricingMap}
                      locale={locale}
                      emailDropdownOpen={emailDropdownOpen}
                      sendingEmail={sendingEmail}
                      onPricingInfoClick={onPricingInfoClick}
                      onCreateTour={onCreateTour}
                      onPickupTimeClick={onPickupTimeClick}
                      onPickupHotelClick={onPickupHotelClick}
                      onPaymentClick={onPaymentClick}
                      onDetailClick={onDetailClick}
                      onReviewClick={onReviewClick}
                      onEmailPreview={onEmailPreview}
                      onEmailLogsClick={onEmailLogsClick}
                      onEmailDropdownToggle={onEmailDropdownToggle}
                      onEditClick={onEditClick}
                      onCustomerClick={onCustomerClick}
                      onRefreshReservations={onRefreshReservations}
                      onStatusChange={onStatusChange}
                      generatePriceCalculation={generatePriceCalculation}
                      getGroupColorClasses={getGroupColorClasses}
                      getSelectedChoicesFromNewSystem={getSelectedChoicesFromNewSystem}
                      choicesCacheRef={choicesCacheRef}
                      linkedTourId={tourIdByReservationId?.get(reservation.id) ?? null}
                      reservationOptionsPresenceByReservationId={reservationOptionsPresenceByReservationId}
                      onReservationOptionsMutated={handleReservationOptionsMutated}
                      reshowPickupSummaryRequest={reshowPickupSummaryRequest}
                      onReshowPickupSummaryConsumed={onReshowPickupSummaryConsumed}
                    />
                  ))}
                </div>
              ) : (
                <ReservationActionRequiredTable
                  reservations={paginatedList}
                  tableVariant={actionRequiredTableVariant}
                  todayStr={todayStr}
                  hasTourAssigned={hasTourAssigned}
                  reservationIdsWithPayments={reservationIdsWithPayments}
                  paymentRecordsByReservationId={paymentRecordsByReservationId}
                  reservationOptionSumByReservationId={reservationOptionSumByReservationId}
                  customers={customers}
                  products={products}
                  channels={channels}
                  pickupHotels={pickupHotels}
                  productOptions={productOptions}
                  optionChoices={optionChoices}
                  reservationPricingMap={reservationPricingMap}
                  locale={locale}
                  emailDropdownOpen={emailDropdownOpen}
                  sendingEmail={sendingEmail}
                  onPricingInfoClick={onPricingInfoClick}
                  onCreateTour={onCreateTour}
                  onPickupTimeClick={onPickupTimeClick}
                  onPickupHotelClick={onPickupHotelClick}
                  onPaymentClick={onPaymentClick}
                  onDetailClick={onDetailClick}
                  onReviewClick={onReviewClick}
                  onEmailPreview={onEmailPreview}
                  onEmailLogsClick={onEmailLogsClick}
                  onEmailDropdownToggle={onEmailDropdownToggle}
                  onEditClick={onEditClick}
                  onCustomerClick={onCustomerClick}
                  onStatusChange={onStatusChange}
                  getGroupColorClasses={getGroupColorClasses}
                  getSelectedChoicesFromNewSystem={getSelectedChoicesFromNewSystem}
                  choicesCacheRef={choicesCacheRef}
                  onRefreshReservations={onRefreshReservations}
                  onRefreshReservationPricing={onRefreshReservationPricing}
                  balanceReservationsForApply={
                    activeTab === 'balance' || activeTab === 'cancel' ? currentList : undefined
                  }
                  showPartnerCancelRefundAction={activeTab === 'cancel'}
                  onRefreshPaymentAggregates={mergePaymentAndOptionAggregates}
                />
              )}
              {((listViewMode === 'detail' && currentList.length > 0) ||
                (listViewMode === 'table' && currentList.length > 0) ||
                (listViewMode === 'card' && currentList.length > pageSize)) && (
                <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center justify-center gap-3 sm:justify-start">
                    <span className="text-center text-sm text-gray-600 sm:text-left">
                      {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, currentList.length)} /{' '}
                      {currentList.length}건
                    </span>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex shrink-0 items-center justify-center gap-1 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="이전 페이지"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <span className="px-3 py-2 text-sm text-gray-700 sm:py-1">
                        {safePage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="다음 페이지"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {manualOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setManualOpen(false)}
        >
          <div
            className="flex h-full min-h-0 w-full max-w-none flex-col bg-white pt-[env(safe-area-inset-top)] shadow-xl rounded-none sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-xl sm:pt-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-3 sm:p-4">
              <h3 className="min-w-0 pr-2 text-base font-semibold text-gray-900">{t('actionRequired.manualTitle')}</h3>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-100"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-4">
              <p className="text-sm text-gray-600">{t('actionRequired.manualIntro')}</p>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 shrink-0">{t('actionRequired.tabs.status')}:</span>
                  <span>{renderManualText(t('actionRequired.manualStatus'))}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 shrink-0">{t('actionRequired.tabs.tour')}:</span>
                  <span>{renderManualText(t('actionRequired.manualTour'))}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 shrink-0">{t('actionRequired.tabs.pricing')}:</span>
                  <span>{renderManualText(t('actionRequired.manualPricing'))}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 shrink-0">{t('actionRequired.tabs.deposit')}:</span>
                  <span>{renderManualText(t('actionRequired.manualDeposit'))}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 shrink-0">{t('actionRequired.tabs.cancel')}:</span>
                  <span>{renderManualText(t('actionRequired.manualCancel'))}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 shrink-0">{t('actionRequired.tabs.balance')}:</span>
                  <span>{renderManualText(t('actionRequired.manualBalance'))}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 shrink-0">{t('followUpPipeline.tabCancel')}:</span>
                  <span>{renderManualText(t('actionRequired.manualFollowUpCancel'))}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
