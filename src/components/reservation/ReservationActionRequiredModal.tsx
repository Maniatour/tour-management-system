'use client'

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { X, AlertCircle, MapPin, DollarSign, CreditCard, Scale, HelpCircle, ChevronLeft, ChevronRight, XCircle, LayoutGrid, Table2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { aggregateReservationOptionSumsByReservationId } from '@/lib/syncReservationPricingAggregates'
import { ReservationCardItem } from '@/components/reservation/ReservationCardItem'
import {
  ReservationActionRequiredTable,
  type ActionRequiredTableVariant,
} from '@/components/reservation/ReservationActionRequiredTable'
import { calculateTotalPrice } from '@/utils/reservationUtils'
import {
  computeRemainingBalanceAmount,
  isStoredCustomerTotalMismatchWithFormula,
  summarizePaymentRecordsForBalance,
  type PaymentRecordLike,
  type PricingBalanceFields,
} from '@/utils/reservationPricingBalance'
import type { Reservation, Customer } from '@/types/reservation'

export type ActionRequiredTabId = 'status' | 'tour' | 'pricing' | 'deposit' | 'balance' | 'followUpCancel'
export type PricingSubTabId = 'noPrice' | 'mismatch'
export type BalanceSubTabId = 'cancelled' | 'unpaid' | 'calcWrong'
export type BalanceTotalFilterId = 'all' | 'totalMismatch'

export interface ReservationActionRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  reservations: Reservation[]
  customers: Customer[]
  products: Array<{ id: string; name: string; sub_category?: string; base_price?: number }>
  channels: Array<{ id: string; name: string; favicon_url?: string | null }>
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
  onEmailPreview: (reservation: Reservation, emailType: 'confirmation' | 'departure' | 'pickup') => void
  onEmailLogsClick: (reservationId: string) => void
  onEmailDropdownToggle: (reservationId: string) => void
  onEditClick: (reservationId: string) => void
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
  { id: 'balance', labelKey: 'actionRequired.tabs.balance', icon: Scale },
  { id: 'followUpCancel', labelKey: 'actionRequired.tabs.followUpCancel', icon: XCircle }
]

const CARDS_PER_PAGE = 12 // 가로 4개 x 3행
const TABLE_PAGE_SIZE_OPTIONS = [50, 100, 250] as const
type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number]

export default function ReservationActionRequiredModal({
  isOpen,
  onClose,
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
  const [listViewMode, setListViewMode] = useState<'card' | 'table'>('table')
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

  useEffect(() => {
    if (!isOpen || reservations.length === 0) {
      setReservationIdsWithPayments(new Set())
      setPaymentRecordsByReservationId(new Map())
      setReservationOptionSumByReservationId(new Map())
      setReservationOptionsPresenceByReservationId(new Map())
      return
    }
    const ids = reservations.map(r => r.id)
    setLoadingPayments(true)
    const load = async () => {
      const set = new Set<string>()
      const byRes = new Map<string, PaymentRecordLike[]>()
      const mergedOptionSums = new Map<string, number>()
      const mergedOptionsPresence = new Map<string, boolean>()
      ids.forEach((id) => mergedOptionsPresence.set(id, false))
      const chunkSize = 200
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
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
        const chunkSums = aggregateReservationOptionSumsByReservationId(optRows ?? [])
        for (const [rid, v] of chunkSums) {
          mergedOptionSums.set(rid, v)
        }
        for (const row of optRows ?? []) {
          const rid = (row as { reservation_id?: string }).reservation_id
          if (rid) mergedOptionsPresence.set(rid, true)
        }
      }
      setReservationIdsWithPayments(set)
      setPaymentRecordsByReservationId(byRes)
      setReservationOptionSumByReservationId(mergedOptionSums)
      setReservationOptionsPresenceByReservationId(mergedOptionsPresence)
      setLoadingPayments(false)
    }
    load()
  }, [isOpen, reservations])

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
    const storedTotalMatchesDynamic = (r: Reservation) => {
      const stored = reservationPricingMap.get(r.id)?.total_price
      if (stored == null) return true
      const calculated = calculateTotalPrice(r, products, optionChoices)
      return Math.abs((stored ?? 0) - calculated) <= 0.01
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
    const pricingMismatch = list.filter(r =>
      hasPricing(r) && !storedTotalMatchesDynamic(r) && isNotCancelled(r)
    )
    const pricingList = [...new Map([...noPricing.map(r => [r.id, r]), ...pricingMismatch.map(r => [r.id, r])]).values()]
    const depositNoTour = list.filter(r => hasPayment(r) && !hasTourAssigned(r))
    const confirmedNoDeposit = list.filter(r => statusConfirmed(r) && !hasPayment(r))
    const depositList = [...new Map([...depositNoTour.map(r => [r.id, r]), ...confirmedNoDeposit.map(r => [r.id, r])]).values()]

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

    // 취소된 예약: 최신 상태 변경 순(updated_at 기준, 없으면 addedTime). 투어날짜가 지난 것은 제외
    const followUpCancelList = list
      .filter(r => isCancelled(r))
      .filter(r => !tourDateBeforeToday(r))
      .slice()
      .sort((a, b) => {
        const aTime = a.updated_at || a.addedTime || ''
        const bTime = b.updated_at || b.addedTime || ''
        return bTime.localeCompare(aTime)
      })

    return {
      status: statusList,
      tour: tourList,
      pricing: pricingList,
      pricingNoPrice: noPricing,
      pricingMismatch,
      deposit: depositList,
      balance: balanceAllUnion,
      balanceCancelled: balanceCancelledList,
      balanceUnpaid: balanceUnpaidList,
      balanceCalcWrong: balanceCalcWrongList,
      followUpCancel: followUpCancelList
    }
  }, [
    reservations,
    reservationPricingMap,
    products,
    optionChoices,
    reservationIdsWithPayments,
    todayStr,
    sevenDaysLaterStr,
    hasTourAssigned,
    paymentRecordsByReservationId
  ])

  const counts = useMemo(() => ({
    status: filteredByTab.status.length,
    tour: filteredByTab.tour.length,
    pricing: filteredByTab.pricing.length,
    deposit: filteredByTab.deposit.length,
    balance: filteredByTab.balance.length,
    followUpCancel: filteredByTab.followUpCancel.length
  }), [filteredByTab])

  const totalActionCount = useMemo(() =>
    new Set([
      ...filteredByTab.status.map(r => r.id),
      ...filteredByTab.tour.map(r => r.id),
      ...filteredByTab.pricing.map(r => r.id),
      ...filteredByTab.deposit.map(r => r.id),
      ...filteredByTab.balance.map(r => r.id),
      ...filteredByTab.followUpCancel.map(r => r.id)
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
          isStoredCustomerTotalMismatchWithFormula(
            { adults: r.adults, children: r.child, infants: r.infant },
            reservationPricingMap.get(r.id)
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
      isStoredCustomerTotalMismatchWithFormula(
        { adults: r.adults, children: r.child, infants: r.infant },
        reservationPricingMap.get(r.id)
      )
    ).length
  }, [balanceSubTabBaseList, reservationPricingMap])

  useEffect(() => {
    if (activeTab !== 'balance') setBalanceTotalFilter('all')
  }, [activeTab])

  const pageSize = listViewMode === 'table' ? tableRowsPerPage : CARDS_PER_PAGE
  const totalPages = Math.max(1, Math.ceil(currentList.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedList = useMemo(
    () => currentList.slice((safePage - 1) * pageSize, safePage * pageSize),
    [currentList, safePage, pageSize]
  )

  const actionRequiredTableVariant = useMemo((): ActionRequiredTableVariant => {
    if (activeTab === 'balance') return 'balance'
    if (activeTab === 'status') return 'status'
    if (activeTab === 'tour') return 'tour'
    if (activeTab === 'pricing') return pricingSubTab === 'noPrice' ? 'pricingNoPrice' : 'pricingMismatch'
    if (activeTab === 'deposit') return 'deposit'
    return 'followUpCancel'
  }, [activeTab, pricingSubTab])

  const showCardTableToggle =
    currentList.length > 0 && !(loadingPayments && activeTab === 'deposit')

  // 현재 탭 목록이 줄었을 때 페이지 범위 맞추기
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [totalPages, page])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[min(98vw,2000px)] max-h-[90vh] min-h-0 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('actionRequired.title')}
              {totalActionCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  {totalActionCount}건
                </span>
              )}
            </h2>
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title={t('actionRequired.helpButton')}
              aria-label={t('actionRequired.helpButton')}
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showCardTableToggle && (
              <div
                className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50"
                role="group"
                aria-label={`${t('actionRequired.viewCard')} / ${t('actionRequired.viewTable')}`}
              >
                <button
                  type="button"
                  onClick={() => setListViewMode('card')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    listViewMode === 'card'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title={t('actionRequired.viewCard')}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('actionRequired.viewCard')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setListViewMode('table')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    listViewMode === 'table'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title={t('actionRequired.viewTable')}
                >
                  <Table2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('actionRequired.viewTable')}</span>
                </button>
              </div>
            )}
            {showCardTableToggle && listViewMode === 'table' && (
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
                <span className="hidden sm:inline whitespace-nowrap">{t('actionRequired.tableRowsPerPage')}</span>
                <select
                  value={tableRowsPerPage}
                  onChange={(e) => setTableRowsPerPage(Number(e.target.value) as TablePageSize)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[5.5rem]"
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
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-gray-200 overflow-x-auto flex-shrink-0">
          {TABS.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              title={t(`actionRequired.tabTooltips.${id}` as Parameters<typeof t>[0])}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
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
          <div className="flex border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
            <button
              type="button"
              onClick={() => setPricingSubTab('noPrice')}
              title={t('actionRequired.pricingSubTabTooltips.noPrice')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                pricingSubTab === 'noPrice'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                pricingSubTab === 'mismatch'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
          <div className="flex border-b border-gray-200 bg-gray-50/80 flex-shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setBalanceSubTab('cancelled')}
              title={t('actionRequired.balanceSubTabTooltips.cancelled')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                balanceSubTab === 'cancelled'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                balanceSubTab === 'unpaid'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                balanceSubTab === 'calcWrong'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
            <div
              className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50"
              role="group"
              aria-label={t('actionRequired.balanceTotalFilterAria')}
            >
              <button
                type="button"
                onClick={() => setBalanceTotalFilter('all')}
                title={t('actionRequired.balanceTotalFilterTooltips.all')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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

        <div className="flex-1 min-h-0 overflow-auto p-4 max-lg:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          {loadingPayments && (activeTab === 'deposit') ? (
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
              {listViewMode === 'card' ? (
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
                  balanceReservationsForApply={activeTab === 'balance' ? currentList : undefined}
                />
              )}
              {((listViewMode === 'table' && currentList.length > 0) ||
                (listViewMode === 'card' && currentList.length > pageSize)) && (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200">
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <span className="text-sm text-gray-600">
                      {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, currentList.length)} /{' '}
                      {currentList.length}건
                    </span>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="이전 페이지"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="px-3 py-1 text-sm text-gray-700">
                        {safePage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="다음 페이지"
                      >
                        <ChevronRight className="w-5 h-5" />
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setManualOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">{t('actionRequired.manualTitle')}</h3>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  <span className="font-medium text-gray-900 shrink-0">{t('actionRequired.tabs.balance')}:</span>
                  <span>{renderManualText(t('actionRequired.manualBalance'))}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 shrink-0">{t('actionRequired.tabs.followUpCancel')}:</span>
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
