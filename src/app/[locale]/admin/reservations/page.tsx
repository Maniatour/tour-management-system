'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { X, Search, SlidersHorizontal, Printer } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { generateReservationId } from '@/lib/entityIds'
import { updateReservation, type ReservationUpdatePayload } from '@/lib/reservationUpdate'
import type { Database } from '@/lib/supabase'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import { computeCustomerPaymentTotalLineFormula } from '@/utils/reservationPricingBalance'
import CustomerForm from '@/components/CustomerForm'
import ReservationForm from '@/components/reservation/ReservationForm'
import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'
import { createTourPhotosBucket } from '@/lib/tourPhotoBucket'
import PricingInfoModal from '@/components/reservation/PricingInfoModal'
import ReservationCalendar from '@/components/ReservationCalendar'
import PaymentRecordsList from '@/components/PaymentRecordsList'
import { useReservationData } from '@/hooks/useReservationData'
import PickupTimeModal from '@/components/tour/modals/PickupTimeModal'
import PickupHotelModal from '@/components/tour/modals/PickupHotelModal'
import EmailPreviewModal from '@/components/reservation/EmailPreviewModal'
import EmailLogsModal from '@/components/reservation/EmailLogsModal'
import ReviewManagementSection from '@/components/reservation/ReviewManagementSection'
import ResizableModal from '@/components/reservation/ResizableModal'
import ReservationsLoadingSpinner from '@/components/reservation/ReservationsLoadingSpinner'
import ReservationsHeader from '@/components/reservation/ReservationsHeader'
import ReservationsFilters from '@/components/reservation/ReservationsFilters'
import WeeklyStatsPanel from '@/components/reservation/WeeklyStatsPanel'
import { DateGroupHeader } from '@/components/reservation/DateGroupHeader'
import ReservationsEmptyState from '@/components/reservation/ReservationsEmptyState'
import ReservationsPagination from '@/components/reservation/ReservationsPagination'
import { ReservationCardItem } from '@/components/reservation/ReservationCardItem'
import ReservationActionRequiredModal from '@/components/reservation/ReservationActionRequiredModal'
import CustomerReceiptModal from '@/components/receipt/CustomerReceiptModal'
import { ReservationFormEmailSendButtons } from '@/components/reservation/ReservationFormEmailSendButtons'
import { useAuth } from '@/contexts/AuthContext'
import { 
  getPickupHotelDisplay, 
  getCustomerName, 
  getProductName, 
  getChannelName, 
  calculateTotalPrice,
  getReservationPartySize,
  normalizeTourDateKey,
  isoToLocalCalendarDateKey
} from '@/utils/reservationUtils'
import type { 
  Customer, 
  Reservation,
  Channel,
  PickupHotel
} from '@/types/reservation'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'
import { DeletedReservationsTableModal } from '@/components/shared/DeletedReservationsTableModal'

const RESERVATIONS_LIST_UI_DEFAULT = {
  searchTerm: '',
  viewMode: 'card' as 'card' | 'calendar',
  cardLayout: 'simple' as 'standard' | 'simple',
  selectedStatus: 'all',
  currentPage: 1,
  itemsPerPage: 20,
  currentWeek: 0,
  selectedChannel: 'all',
  dateRange: { start: '', end: '' } as { start: string; end: string },
  sortBy: 'created_at' as 'created_at' | 'tour_date' | 'customer_name' | 'product_name',
  sortOrder: 'desc' as 'asc' | 'desc',
  groupByDate: true,
  isWeeklyStatsCollapsed: true,
}

interface AdminReservationsProps {
  params: Promise<{ locale: string }>
}

export default function AdminReservations({ }: AdminReservationsProps) {
  const t = useTranslations('reservations')
  const { user, userPosition } = useAuth()
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
    const run = async () => {
      const { data, error } = await supabase
        .from('reservation_choices')
        .select(`
          choice_id,
          option_id,
          quantity,
          choice_options!inner (
            option_key,
            option_name,
            option_name_ko,
            product_choices!inner (
              choice_group_ko
            )
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

      // ???? ??? ??? ???? ??? ??? ?? (???? ?? ???)
      const err = error as { message?: string; code?: string; details?: string; hint?: string }
      const errMsg = (err?.message && err.message.trim()) || (error instanceof Error ? error.message : '')
      const code = err?.code?.trim?.()
      const details = (err?.details && err.details.trim()) || (err?.hint && err.hint.trim())
      if (errMsg || code || details) {
        console.error('Error fetching reservation choices:', {
          message: errMsg || undefined,
          code: code || undefined,
          details: details || undefined,
          reservationId
        })
      }
      return []
    }
  }, [])

  // ReservationCardItem?? null?????????????? choices ??
  const getSelectedChoicesNormalized = useCallback(async (reservationId: string) => {
    const rows = await getSelectedChoicesFromNewSystem(reservationId)
    return rows.map(r => ({
      choice_id: r.choice_id ?? '',
      option_id: r.option_id ?? '',
      quantity: r.quantity ?? 0,
      choice_options: r.choice_options
    }))
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

  const router = useRouter()
  const routeParams = useParams() as { locale?: string }
  const locale = routeParams?.locale || 'ko'
  const searchParams = useSearchParams()
  
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
    options,
    pickupHotels,
    coupons,
    reservationPricingMap: hookReservationPricingMap,
    reservationOptionsPresenceByReservationId: hookReservationOptionsPresenceByReservationId,
    toursMap: hookToursMap,
    loading,
    loadingProgress,
    reservationsAggregateReady,
    refreshReservations,
    refreshReservationPricingForIds,
    refreshReservationOptionsPresenceForIds,
    refreshCustomers
  } = useReservationData()

  /** DB tour_id ?????tours.reservation_ids??? ??????? ??/?????*/
  const tourIdByReservationId = useMemo(() => {
    const m = new Map<string, string>()
    hookToursMap.forEach((tour, tourId) => {
      for (const rid of tour.reservation_ids || []) {
        const id = String(rid ?? '').trim()
        if (id && !m.has(id)) m.set(id, tourId)
      }
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
  const [reservationListUi, setReservationListUi] = useRoutePersistedState(
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
    currentWeek,
    selectedChannel,
    dateRange,
    sortBy,
    sortOrder,
    groupByDate,
    isWeeklyStatsCollapsed,
  } = reservationListUi
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
  const setCurrentWeek = (v: React.SetStateAction<number>) =>
    setReservationListUi((u) => ({
      ...u,
      currentWeek: typeof v === 'function' ? (v as (n: number) => number)(u.currentWeek) : v,
    }))
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

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  // ???? debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    
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
  const [filterModalOpen, setFilterModalOpen] = useState(false) // ??? ?? ??? ???
  const [showDeletedReservationsModal, setShowDeletedReservationsModal] = useState(false)
  const [deletedReservationsModalRows, setDeletedReservationsModalRows] = useState<
    Array<{ id: string; customer_id?: string | null; tour_date?: string | null; status?: string | null; customer_name?: string | null }>
  >([])
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
  const [tourDetailModalTourId, setTourDetailModalTourId] = useState<string | null>(null)
  const [reservationIdsWithPayments, setReservationIdsWithPayments] = useState<Set<string>>(new Set())

  // ??????? ??????
  const [emailDropdownOpen, setEmailDropdownOpen] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [emailPreviewData, setEmailPreviewData] = useState<{
    reservationId: string
    emailType: 'confirmation' | 'departure' | 'pickup'
    customerEmail: string
    pickupTime?: string | null
    tourDate?: string | null
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
    if (!showDeletedReservationsModal) return
    let cancelled = false
    void (async () => {
      setDeletedReservationsModalLoading(true)
      try {
        const { data, error } = await supabase
          .from('reservations')
          .select('id, customer_id, tour_date, status')
          .eq('status', 'deleted')
          .order('updated_at', { ascending: false })
          .limit(500)
        if (error || cancelled) {
          if (error) console.error('????????? ?? ?? ???:', error)
          return
        }
        const rows = data || []
        const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[])]
        let nameById = new Map<string, string>()
        if (custIds.length > 0) {
          const { data: custs } = await supabase.from('customers').select('id, name').in('id', custIds)
          nameById = new Map((custs || []).map((c: { id: string; name: string }) => [c.id, c.name]))
        }
        if (cancelled) return
        setDeletedReservationsModalRows(
          rows.map((r) => ({
            ...r,
            customer_name: r.customer_id ? nameById.get(r.customer_id) ?? null : null,
          }))
        )
      } finally {
        if (!cancelled) setDeletedReservationsModalLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showDeletedReservationsModal])

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
                .select('id, nick, vehicle_number, vehicle_type')
                .in('id', chunk)
              
              if (vehicles) {
                vehicles.forEach((vehicle: { id: string; nick?: string | null; vehicle_number: string | null; vehicle_type: string | null }) => {
                  if (vehicle.id) {
                    const nick = vehicle.nick?.trim()
                    vehicleMap.set(
                      vehicle.id,
                      nick || vehicle.vehicle_number || vehicle.vehicle_type || '-'
                    )
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
      return
    }
    const ids = reservations.map(r => r.id)
    const load = async () => {
      const set = new Set<string>()
      const chunkSize = 200
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        const { data } = await supabase
          .from('payment_records')
          .select('reservation_id')
          .in('reservation_id', chunk)
        if (data) {
          data.forEach((row: { reservation_id: string }) => set.add(row.reservation_id))
        }
      }
      setReservationIdsWithPayments(set)
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
    const storedTotalMatchesDynamic = (r: Reservation) => {
      const stored = reservationPricingMap.get(r.id)?.total_price
      if (stored == null) return true
      const calculated = calculateTotalPrice(r, products || [], optionChoices || [])
      return Math.abs((stored ?? 0) - calculated) <= 0.01
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
    const pricingMismatch = arReservations.filter(r => hasPricing(r) && !storedTotalMatchesDynamic(r))
    const depositNoTour = arReservations.filter(r => hasPayment(r) && !hasTourAssigned(r))
    const confirmedNoDeposit = arReservations.filter(r => statusConfirmed(r) && !hasPayment(r))
    const balanceList = arReservations.filter(r => tourDateBeforeToday(r) && getBalance(r) > 0)
    const allIds = new Set<string>()
    statusList.forEach(r => allIds.add(r.id))
    tourList.forEach(r => allIds.add(r.id))
    noPricing.forEach(r => allIds.add(r.id))
    pricingMismatch.forEach(r => allIds.add(r.id))
    depositNoTour.forEach(r => allIds.add(r.id))
    confirmedNoDeposit.forEach(r => allIds.add(r.id))
    balanceList.forEach(r => allIds.add(r.id))
    return allIds.size
  }, [
    reservations,
    reservationPricingMap,
    reservationIdsWithPayments,
    products,
    optionChoices,
    tourIdByReservationId,
  ])

  // ?????????? ?? - useMemo??????
  const filteredAndSortedReservations = useMemo(() => {
    const filtered = reservations.filter(reservation => {
      // ?? ID ??? (URL ????????)
      const matchesCustomer = !customerIdFromUrl || reservation.customerId === customerIdFromUrl
      
      // ????? - ????? ??? ??? ??????
      const customer = customers?.find(c => c.id === reservation.customerId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerSpecialRequests = (customer as any)?.special_requests || ''
      
      const matchesSearch = !debouncedSearchTerm || 
      reservation.id.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      reservation.channelRN.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      getCustomerName(reservation.customerId, (customers as Customer[]) || []).toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      getProductName(reservation.productId, products || []).toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      getChannelName(reservation.channelId, channels || []).toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      reservation.tourDate.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      reservation.tourTime.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      reservation.pickUpHotel.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      reservation.addedBy.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      customerSpecialRequests.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    
      // ??? ??? (?? '???'?????????????? ???, 'deleted' ??? ?????????? ???)
      const matchesStatus =
        selectedStatus === 'all'
          ? reservation.status !== 'deleted'
          : reservation.status === selectedStatus
      
      // ?? ???
      const matchesChannel = selectedChannel === 'all' || reservation.channelId === selectedChannel
      
      // ??? ?? ??? - ????? ??????? ?? ????????
      let matchesDateRange = true
      if (dateRange.start && dateRange.end) {
        const tourDate = new Date(reservation.tourDate)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        // ???? ?????????? ????????
        if (!isNaN(tourDate.getTime()) && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          matchesDateRange = tourDate >= startDate && tourDate <= endDate
        }
      }
      
      return matchesCustomer && matchesSearch && matchesStatus && matchesChannel && matchesDateRange
    })
    
    // ???
    filtered.sort((a, b) => {
      let aValue: string | Date, bValue: string | Date
      
      switch (sortBy) {
        case 'created_at':
          aValue = new Date(a.addedTime)
          bValue = new Date(b.addedTime)
          break
        case 'tour_date':
          aValue = new Date(a.tourDate)
          bValue = new Date(b.tourDate)
          break
        case 'customer_name':
          aValue = getCustomerName(a.customerId, (customers as Customer[]) || [])
          bValue = getCustomerName(b.customerId, (customers as Customer[]) || [])
          break
        case 'product_name':
          aValue = getProductName(a.productId, products || [])
          bValue = getProductName(b.productId, products || [])
          break
        default:
          aValue = new Date(a.addedTime)
          bValue = new Date(b.addedTime)
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    // ???????? ??? id? ????? ?? key? ?? ??id?????? ???? (??? ???????? ???? ????)
    return [...new Map(filtered.map((r) => [r.id, r])).values()]
  }, [reservations, customers, products, channels, debouncedSearchTerm, selectedStatus, selectedChannel, dateRange, sortBy, sortOrder, customerIdFromUrl])
  
  const filteredReservations = filteredAndSortedReservations
  
  // 7????? ?????????? ??? ????? ?????(??? ???)
  const getWeekStartDate = useCallback((weekOffset: number) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // weekOffset??0??? ??????6?????? (??7??
    // weekOffset??1??? 7????????13??????
    // weekOffset??-1??? 7????????13??????
    const daysToSubtract = (weekOffset * 7) + 6 // ??? ??? 7??????6???????????
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - daysToSubtract)
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  }, [])

  const getWeekEndDate = useCallback((weekOffset: number) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // weekOffset??0??? ??????
    // weekOffset??1??? 7??????
    // weekOffset??-1??? 7??????
    const daysToAdd = weekOffset * 7
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() + daysToAdd)
    weekEnd.setHours(23, 59, 59, 999)
    return weekEnd
  }, [])

  const formatWeekRange = useCallback((weekOffset: number) => {
    const weekStart = getWeekStartDate(weekOffset)
    const weekEnd = getWeekEndDate(weekOffset)
    
    // ?? ????? ?????? YYYY-MM-DD ??? ???
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    return {
      start: formatDate(weekStart),
      end: formatDate(weekEnd),
      display: `${weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
    }
  }, [getWeekStartDate, getWeekEndDate])

  // ??????????? (created_at ???) - ?? ????????????
  const groupedReservations = useMemo(() => {
    if (!groupByDate) {
      return { 'all': filteredReservations }
    }
    
    const groups: { [key: string]: typeof filteredReservations } = {}
    
    // ??? ?? ??? ?? ?? (?? ????? ???)
    const weekStart = getWeekStartDate(currentWeek)
    const weekEnd = getWeekEndDate(currentWeek)
    
    // ?? ????YYYY-MM-DD ?????? ???(?? ????? ???)
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
    const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`
    
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
  }, [filteredReservations, groupByDate, currentWeek, getWeekStartDate, getWeekEndDate])

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

  // ?? ??? ???????
  const weeklyStats = useMemo(() => {
    const allReservations = Object.values(groupedReservations).flat()
    
    // ???????? ???
    const productStats = allReservations.reduce((groups, reservation) => {
      const productName = getProductName(reservation.productId, products || [])
      if (!groups[productName]) {
        groups[productName] = 0
      }
      groups[productName] += reservation.totalPeople
      return groups
    }, {} as Record<string, number>)

    // ??????? ??? (???????? ???)
    const channelStats = allReservations.reduce((groups, reservation) => {
      const channel = (channels as Array<{ id: string; name: string; favicon_url?: string }>)?.find(c => c.id === reservation.channelId)
      const channelName = getChannelName(reservation.channelId, channels || [])
      const channelKey = `${channelName}|${reservation.channelId}`
      
      if (!groups[channelKey]) {
        groups[channelKey] = {
          name: channelName,
          count: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          favicon_url: (channel as any)?.favicon_url || null,
          channelId: reservation.channelId
        }
      }
      groups[channelKey].count += reservation.totalPeople
      return groups
    }, {} as Record<string, { name: string; count: number; favicon_url: string | null; channelId: string }>)

    // ???????? ???
    const statusStats = allReservations.reduce((groups, reservation) => {
      const status = reservation.status
      if (!groups[status]) {
        groups[status] = 0
      }
      groups[status] += reservation.totalPeople
      return groups
    }, {} as Record<string, number>)

    return {
      productStats: Object.entries(productStats).sort(([,a], [,b]) => b - a),
      channelStats: Object.values(channelStats).sort((a, b) => b.count - a.count),
      statusStats: Object.entries(statusStats).sort(([,a], [,b]) => b - a),
      totalReservations: allReservations.length,
      totalPeople: allReservations.reduce((total, reservation) => total + reservation.totalPeople, 0)
    }
  }, [groupedReservations, products, channels])
  
  // ??????????? (?????? ???? ?????)
  const totalPages = groupByDate ? 1 : Math.ceil(filteredReservations.length / itemsPerPage)
  const startIndex = groupByDate ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = groupByDate ? filteredReservations.length : startIndex + itemsPerPage
  const paginatedReservations = groupByDate ? filteredReservations : filteredReservations.slice(startIndex, endIndex)

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
        .select('id')
        .eq('product_id', productId)
        .eq('tour_date', tourDate)
        .limit(1)

      if (error) {
        console.error('Error checking tour existence:', error)
        return false
      }

      return data && data.length > 0
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
  const handleOpenEmailPreview = useCallback((reservation: Reservation, emailType: 'confirmation' | 'departure' | 'pickup') => {
    const customer = (customers as Customer[]).find(c => c.id === reservation.customerId)
    if (!customer?.email) {
      alert(t('messages.noCustomerEmail'))
      return
    }

    if (emailType === 'pickup' && (!reservation.pickUpTime || !reservation.tourDate)) {
      alert(t('messages.pickupAndTourDateRequired'))
      return
    }

    setEmailPreviewData({
      reservationId: reservation.id,
      emailType,
      customerEmail: customer.email,
      pickupTime: reservation.pickUpTime,
      tourDate: reservation.tourDate
    })
    setShowEmailPreview(true)
    setEmailDropdownOpen(null)
  }, [customers])

  // ???????? ?? ??? - useCallback??? ????????
  const handleSendEmailFromPreview = useCallback(async () => {
    if (!emailPreviewData) return

    setSendingEmail(emailPreviewData.reservationId)

    try {
      let response: Response
      const customer = (customers as Customer[]).find(c => {
        const reservation = reservations.find(r => r.id === emailPreviewData.reservationId)
        return reservation && c.id === reservation.customerId
      })
      
      const customerLanguage = customer?.language?.toLowerCase() || 'ko'
      const locale = customerLanguage === 'en' || customerLanguage === 'english' ? 'en' : 'ko'

      if (emailPreviewData.emailType === 'confirmation') {
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
      } else {
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
  }, [emailPreviewData, customers, reservations, user?.email])

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

  const handleStatusChange = useCallback(async (reservationId: string, newStatus: string) => {
    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus })
      .eq('id', reservationId)
    if (error) throw error
    await refreshReservations()
  }, [refreshReservations])

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
      
      // Supabase??????
      const { data, error } = await supabase
        .from('customers')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(customerDataWithDate as any)
        .select('*')

      if (error) {
        console.error('Error adding customer:', error)
        alert(t('messages.customerAddError') + error.message)
        return
      }

      // ??? ???? ?? ?????
      await refreshCustomers()
      setShowCustomerForm(false)
      alert(t('messages.customerAdded'))
      
      // ??? ??????????????? ??? (??? ??? ?????? ??)
      if (showAddForm && data && data[0]) {
        const newCustomer = data[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        alert(t('messages.newCustomerAdded').replace('{name}', (newCustomer as any).name))
      }
    } catch (error) {
      console.error('Error adding customer:', error)
      alert(t('messages.customerAddErrorGeneric'))
    }
  }, [showAddForm, refreshCustomers, t])

  // ?? ???
  if (loading) {
    return <ReservationsLoadingSpinner loadingProgress={loadingProgress} />
  }

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
          className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium flex-shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>???</span>
        </button>
        <button
          type="button"
          onClick={() => setShowDeletedReservationsModal(true)}
          className="bg-gray-700 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 flex items-center gap-1.5 text-sm font-medium flex-shrink-0"
        >
          {t('openDeletedReservationsModal')}
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
          setCurrentWeek(0) // ?? ?????????? ??? ?? ????
        }}
      />

      {/* ?? ?????????????? ??? ??? - ??????????? ?????? ????? ??? */}
      {groupByDate && (
        <WeeklyStatsPanel
          currentWeek={currentWeek}
          onWeekChange={setCurrentWeek}
          onInitialLoadChange={setIsInitialLoad}
          isInitialLoad={isInitialLoad}
          weeklyStats={weeklyStats}
          isWeeklyStatsCollapsed={isWeeklyStatsCollapsed}
          onToggleStatsCollapsed={() => setIsWeeklyStatsCollapsed(!isWeeklyStatsCollapsed)}
          groupedReservations={groupedReservations}
          formatWeekRange={formatWeekRange}
        />
      )}

      {/* ?? ??? */}
      <div className="text-sm text-gray-600">
        {groupByDate ? (
          <>
            {Object.values(groupedReservations).flat().length}{t('groupingLabels.reservationsGroupedBy')} {Object.keys(groupedReservations).length}{t('groupingLabels.registrationDates')}
            {Object.values(groupedReservations).flat().length !== reservations.length && (
              <span className="ml-2 text-blue-600">
                ({t('groupingLabels.filteredFromTotal')} {reservations.length}{t('stats.more')})
              </span>
            )}
          </>
        ) : (
          <>
            {t('paginationDisplay', { total: filteredReservations.length, start: startIndex + 1, end: Math.min(endIndex, filteredReservations.length) })}
            {filteredReservations.length !== reservations.length && (
              <span className="ml-2 text-blue-600">
                ({t('groupingLabels.filteredFromTotal')} {reservations.length} {t('stats.more')})
              </span>
            )}
          </>
        )}
      </div>

      {/* ??? ?? */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">??????? ????? ??..</p>
        </div>
      ) : viewMode === 'calendar' ? (
        /* ?????*/
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
                return (
                  <div key={date} className="space-y-4">
                    {/* ???????? */}
                    <DateGroupHeader
                      date={date}
                      reservations={reservations as Reservation[]}
                      isCollapsed={collapsedGroups.has(date)}
                      onToggleCollapse={handleToggleCollapse}
                      customers={(customers as Array<{ id: string; name?: string }>) || []}
                      products={(products as Array<{ id: string; name: string }>) || []}
                      channels={(channels as Array<{ id: string; name: string; favicon_url?: string }>) || []}
                    />
                  
                  {/* ??? ???????? ????(???? ???) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {reservations.map((reservation) => (
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
                        linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
                        cardLayout={cardLayout}
                        onOpenTourDetailModal={handleOpenTourDetailModal}
                        reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
                        onReservationOptionsMutated={handleReservationOptionsMutated}
                        reshowPickupSummaryRequest={pickupSummaryReshowRequest}
                        onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
                      />
                    ))}
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
                        linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
                        cardLayout={cardLayout}
                        onOpenTourDetailModal={handleOpenTourDetailModal}
                        reservationOptionsPresenceByReservationId={hookReservationOptionsPresenceByReservationId}
                        onReservationOptionsMutated={handleReservationOptionsMutated}
                        reshowPickupSummaryRequest={pickupSummaryReshowRequest}
                        onReshowPickupSummaryConsumed={consumePickupSummaryReshowRequest}
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
          totalItems={filteredReservations.length}
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
          options={options || []}
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
        channels={(channels as Array<{ id: string; name: string; favicon_url?: string | null }>) || []}
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
      {showEmailPreview && emailPreviewData && (
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reservations-tour-detail-modal-title"
          onClick={() => setTourDetailModalTourId(null)}
        >
          <div
            className="flex h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
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
              <iframe
                key={tourDetailModalTourId}
                title={t('card.tourDetailModalTitle')}
                src={`/${locale}/admin/tours/${tourDetailModalTourId}`}
                className="h-full w-full min-h-[60vh] border-0"
              />
            </div>
          </div>
        </div>
      ) : null}

      <DeletedReservationsTableModal
        isOpen={showDeletedReservationsModal}
        onClose={() => setShowDeletedReservationsModal(false)}
        title={t('deletedReservationsModalTitle')}
        reservations={deletedReservationsModalRows}
        loading={deletedReservationsModalLoading}
        userEmail={user?.email ?? null}
        locale={locale}
        onPermanentDelete={async (reservationId) => {
          const { error } = await supabase.from('reservations').delete().eq('id', reservationId)
          if (error) {
            alert(locale === 'ko' ? '??? ???? ???: ' + error.message : 'Purge failed: ' + error.message)
            throw error
          }
          setDeletedReservationsModalRows((prev) => prev.filter((r) => r.id !== reservationId))
          await refreshReservations()
        }}
      />
    </div>
  )
}
