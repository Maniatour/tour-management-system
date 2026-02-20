'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { X, Search, SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
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
import { useAuth } from '@/contexts/AuthContext'
import { 
  getPickupHotelDisplay, 
  getCustomerName, 
  getProductName, 
  getChannelName, 
  calculateTotalPrice 
} from '@/utils/reservationUtils'
import type { 
  Customer, 
  Reservation,
  Channel,
  PickupHotel
} from '@/types/reservation'

interface AdminReservationsProps {
  params: Promise<{ locale: string }>
}

export default function AdminReservations({ }: AdminReservationsProps) {
  const t = useTranslations('reservations')
  const { user, userPosition } = useAuth()
  const isSuper = userPosition === 'super'
  
  // 초이스 옵션별 색상 매핑 함수 (옵션 이름 기준으로 색상 결정) - useCallback으로 메모이제이션
  const getGroupColorClasses = useCallback((groupId: string, groupName?: string, optionName?: string) => {
    // 풍부한 색상 팔레트 (각 옵션마다 다른 색상)
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
    
    // 옵션 이름을 기준으로 해시값 계산 (같은 옵션 이름은 항상 같은 색상)
    const hashSource = optionName || groupName || groupId
    let hash = 0
    for (let i = 0; i < hashSource.length; i++) {
      hash = hashSource.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    return colorPalette[Math.abs(hash) % colorPalette.length]
  }, [])

  // 새로운 초이스 시스템에서 선택된 옵션을 가져오는 함수
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
      const isAbortError =
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted') || error.message.includes('signal is aborted'))

      if (isAbortError && !isRetry) {
        // 동시 다수 요청 시 발생하는 AbortError는 한 번만 재시도
        await new Promise((r) => setTimeout(r, 100))
        return getSelectedChoicesFromNewSystem(reservationId, true)
      }

      if (isAbortError) {
        // 재시도 후에도 AbortError면 로그 없이 빈 배열 반환 (동시 요청/모달 전환 등으로 인한 정상적 취소)
        return []
      }

      // 의미 있는 에러 정보가 있을 때만 로그 (빈 객체 로그 방지)
      const err = error as { message?: string; code?: string; details?: string; hint?: string }
      const msg = (err?.message && err.message.trim()) || (error instanceof Error ? error.message : '')
      const code = err?.code?.trim?.()
      const details = (err?.details && err.details.trim()) || (err?.hint && err.hint.trim())
      if (msg || code || details) {
        console.error('Error fetching reservation choices:', {
          message: msg || undefined,
          code: code || undefined,
          details: details || undefined,
          reservationId
        })
      }
      return []
    }
  }, [])

  // ReservationCardItem용: null을 빈 값으로 정규화한 choices 반환
  const getSelectedChoicesNormalized = useCallback(async (reservationId: string) => {
    const rows = await getSelectedChoicesFromNewSystem(reservationId)
    return rows.map(r => ({
      choice_id: r.choice_id ?? '',
      option_id: r.option_id ?? '',
      quantity: r.quantity ?? 0,
      choice_options: r.choice_options
    }))
  }, [getSelectedChoicesFromNewSystem])

  // 초이스 데이터 캐시 (깜빡거림 방지)
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
  
  // URL에서 고객 ID 파라미터 가져오기
  const customerIdFromUrl = searchParams.get('customer')
  
  // 커스텀 훅으로 데이터 관리
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
    toursMap: hookToursMap,
    loading,
    loadingProgress,
    refreshReservations,
    refreshCustomers
  } = useReservationData()

  // 상태 관리
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  // 검색어 debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchTerm])
  const [showAddForm, setShowAddForm] = useState(false)
  
  // URL 파라미터 add=true일 때 모달 자동 열기
  useEffect(() => {
    const addParam = searchParams.get('add')
    if (addParam === 'true' && !showAddForm) {
      const newId = crypto.randomUUID()
      setNewReservationId(newId)
      setShowAddForm(true)
      // URL에서 add 파라미터 제거 (뒤로가기 시 모달이 다시 열리지 않도록)
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('add')
      const newUrl = `${window.location.pathname}${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''}`
      window.history.replaceState({}, '', newUrl)
    }
  }, [searchParams, showAddForm])
  const [newReservationId, setNewReservationId] = useState<string | null>(null)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'calendar'>('card')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [pricingModalReservation, setPricingModalReservation] = useState<Reservation | null>(null)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedReservationForReview, setSelectedReservationForReview] = useState<Reservation | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  // 주간 페이지네이션 상태
  const [currentWeek, setCurrentWeek] = useState(0) // 0은 현재 주, 음수는 이전 주, 양수는 다음 주
  const [isInitialLoad, setIsInitialLoad] = useState(true) // 초기 로딩 여부 추적
  
  // 고급 필터링 상태
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({start: '', end: ''})
  const [sortBy, setSortBy] = useState<'created_at' | 'tour_date' | 'customer_name' | 'product_name'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [groupByDate, setGroupByDate] = useState<boolean>(true) // 기본값을 true로 설정하여 날짜별 그룹화
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [filterModalOpen, setFilterModalOpen] = useState(false) // 필터 모달 열림 상태

  // 그룹 접기/펼치기 함수 - useCallback으로 메모이제이션
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

  // 주간 통계 아코디언 상태 (기본 접힘)
  const [isWeeklyStatsCollapsed, setIsWeeklyStatsCollapsed] = useState(true)

  // 입금 내역 관련 상태
  const [showPaymentRecords, setShowPaymentRecords] = useState(false)
  const [selectedReservationForPayment, setSelectedReservationForPayment] = useState<Reservation | null>(null)

  // 예약 상세 모달 관련 상태
  const [showReservationDetailModal, setShowReservationDetailModal] = useState(false)
  const [selectedReservationForDetail, setSelectedReservationForDetail] = useState<Reservation | null>(null)

  // 예약 처리 필요 모달 및 입금 데이터(배지 카운트용)
  const [showActionRequiredModal, setShowActionRequiredModal] = useState(false)
  const [reservationIdsWithPayments, setReservationIdsWithPayments] = useState<Set<string>>(new Set())

  // 이메일 발송 관련 상태
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

  // 이메일 드롭다운 외부 클릭 시 닫기
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

  // 투어 정보 상태
  const [tourInfoMap, setTourInfoMap] = useState<Map<string, {
    totalPeople: number
    otherReservationsTotalPeople: number
    allDateTotalPeople: number
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

  // reservation_pricing 데이터는 useReservationData 훅에서 가져옴
  // hookReservationPricingMap을 사용하되, 로컬 상태도 유지 (필터링/페이지네이션 대응)
  const [reservationPricingMap, setReservationPricingMap] = useState<Map<string, {
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
    currency?: string
  }>>(new Map())

  // hookReservationPricingMap이 업데이트되면 로컬 상태도 업데이트
  useEffect(() => {
    if (hookReservationPricingMap.size > 0) {
      setReservationPricingMap(hookReservationPricingMap)
    }
  }, [hookReservationPricingMap])

  // Net Price 계산식 생성 함수 - useCallback으로 메모이제이션
  const generatePriceCalculation = useCallback((reservation: any, pricing: any): string => {
    if (!pricing || !pricing.total_price) {
      // pricing이 없으면 기본값 반환
      return ''
    }
    
    const toNumber = (val: number | undefined): number => val || 0
    
    const adultPrice = toNumber(pricing.adult_product_price)
    const childPrice = toNumber(pricing.child_product_price)
    const infantPrice = toNumber(pricing.infant_product_price)
    const productPriceTotal = toNumber(pricing.product_price_total)
    const couponDiscount = toNumber(pricing.coupon_discount)
    const additionalDiscount = toNumber(pricing.additional_discount)
    const additionalCost = toNumber(pricing.additional_cost)
    const grandTotal = pricing.total_price
    const commissionPercent = toNumber(pricing.commission_percent)
    const commissionAmount = toNumber(pricing.commission_amount)
    
    const totalPeople = (reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)
    const discountTotal = couponDiscount + additionalDiscount
    const adjustmentTotal = additionalCost - discountTotal
    
    let calculatedCommission = 0
    if (commissionAmount > 0) {
      calculatedCommission = commissionAmount
    } else if (commissionPercent > 0 && grandTotal > 0) {
      calculatedCommission = grandTotal * (commissionPercent / 100)
    }
    
    const netPrice = grandTotal > 0 ? (grandTotal - calculatedCommission) : 0
    const currency = pricing.currency || 'USD'
    const currencySymbol = currency === 'KRW' ? '₩' : '$'
    
    // 계산식 구성 (항상 최소한 grandTotal - commission = Net Price는 표시)
    let calculationString = ''
    let subtotal = productPriceTotal
    
    // subtotal 계산
    if (subtotal === 0 && adultPrice > 0 && totalPeople > 0) {
      subtotal = adultPrice * (reservation.adults || 0) + childPrice * (reservation.child || 0) + infantPrice * (reservation.infant || 0)
    }
    
    if (subtotal === 0) {
      subtotal = grandTotal + discountTotal - additionalCost
      if (subtotal <= 0) subtotal = grandTotal
    }
    
    // 1. 상품가격 x 총인원 = 소계
    if (subtotal > 0 && totalPeople > 0) {
      if (adultPrice > 0 && totalPeople === (reservation.adults || 0) && (reservation.child || 0) === 0 && (reservation.infant || 0) === 0) {
        calculationString = `${currencySymbol}${adultPrice.toFixed(2)} × ${totalPeople} = ${currencySymbol}${subtotal.toFixed(2)}`
      } else if (totalPeople > 0 && (adultPrice > 0 || childPrice > 0 || infantPrice > 0)) {
        const priceParts: string[] = []
        if ((reservation.adults || 0) > 0 && adultPrice > 0) {
          priceParts.push(`${currencySymbol}${adultPrice.toFixed(2)} × ${reservation.adults || 0}`)
        }
        if ((reservation.child || 0) > 0 && childPrice > 0) {
          priceParts.push(`${currencySymbol}${childPrice.toFixed(2)} × ${reservation.child || 0}`)
        }
        if ((reservation.infant || 0) > 0 && infantPrice > 0) {
          priceParts.push(`${currencySymbol}${infantPrice.toFixed(2)} × ${reservation.infant || 0}`)
        }
        if (priceParts.length > 0) {
          calculationString = `${priceParts.join(' + ')} = ${currencySymbol}${subtotal.toFixed(2)}`
        } else if (subtotal > 0) {
          calculationString = `${currencySymbol}${subtotal.toFixed(2)}`
        }
      } else if (subtotal > 0) {
        calculationString = `${currencySymbol}${subtotal.toFixed(2)}`
      }
    }
    
    // calculationString이 비어있으면 grandTotal부터 시작
    if (!calculationString) {
      calculationString = `${currencySymbol}${grandTotal.toFixed(2)}`
    }
    
    // 2. 소계 - 할인/추가비용 = grand total
    if (adjustmentTotal !== 0 && calculationString) {
      const prevValue = subtotal > 0 ? subtotal : grandTotal
      if (adjustmentTotal > 0) {
        calculationString = `${currencySymbol}${prevValue.toFixed(2)} + ${currencySymbol}${adjustmentTotal.toFixed(2)} = ${currencySymbol}${grandTotal.toFixed(2)}`
      } else {
        calculationString = `${currencySymbol}${prevValue.toFixed(2)} - ${currencySymbol}${Math.abs(adjustmentTotal).toFixed(2)} = ${currencySymbol}${grandTotal.toFixed(2)}`
      }
    } else if (calculationString && subtotal > 0 && Math.abs(subtotal - grandTotal) > 0.01) {
      calculationString += ` = ${currencySymbol}${grandTotal.toFixed(2)}`
    }
    
    // 3. grand total - commission = Net price (항상 표시)
    if (calculatedCommission > 0) {
      calculationString += ` - ${currencySymbol}${calculatedCommission.toFixed(2)} = ${currencySymbol}${netPrice.toFixed(2)}`
    } else if (Math.abs(grandTotal - netPrice) > 0.01) {
      calculationString += ` = ${currencySymbol}${netPrice.toFixed(2)}`
    } else {
      // commission이 없어도 Net Price는 표시
      calculationString += ` = ${currencySymbol}${netPrice.toFixed(2)}`
    }
    
    // 최종 fallback: 계산식이 비어있으면 최소한 grandTotal - commission = Net Price 표시
    if (!calculationString || calculationString.trim() === '') {
      if (calculatedCommission > 0) {
        calculationString = `${currencySymbol}${grandTotal.toFixed(2)} - ${currencySymbol}${calculatedCommission.toFixed(2)} = ${currencySymbol}${netPrice.toFixed(2)}`
      } else {
        calculationString = `${currencySymbol}${grandTotal.toFixed(2)} = ${currencySymbol}${netPrice.toFixed(2)}`
      }
    }
    
    return calculationString
  }, [])

  // 픽업 시간 수정 모달 상태
  const [showPickupTimeModal, setShowPickupTimeModal] = useState(false)
  const [selectedReservationForPickupTime, setSelectedReservationForPickupTime] = useState<Reservation | null>(null)
  const [pickupTimeValue, setPickupTimeValue] = useState('')

  // 픽업 호텔 수정 모달 상태
  const [showPickupHotelModal, setShowPickupHotelModal] = useState(false)
  const [selectedReservationForPickupHotel, setSelectedReservationForPickupHotel] = useState<Reservation | null>(null)
  const [hotelSearchTerm, setHotelSearchTerm] = useState('')

  // 검색어에 따른 그룹화 상태 조정
  useEffect(() => {
    if (searchTerm.trim()) {
      // 검색어가 있을 때는 그룹화 해제
      setGroupByDate(false)
    } else {
      // 검색어가 없을 때는 그룹화 활성화
      setGroupByDate(true)
    }
  }, [searchTerm])

  // 투어 정보 가져오기 (hookToursMap 사용)
  useEffect(() => {
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

        // 모든 가이드 이메일과 어시스턴트 이메일 수집
        const guideEmails = new Set<string>()
        const assistantEmails = new Set<string>()
        const vehicleIds = new Set<string>()
        
        hookToursMap.forEach(tour => {
          if (tour.tour_guide_id) guideEmails.add(tour.tour_guide_id)
          if (tour.assistant_id) assistantEmails.add(tour.assistant_id)
          if (tour.tour_car_id) vehicleIds.add(tour.tour_car_id)
        })

        const chunkSize = 1000

        // 가이드 정보 일괄 조회
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

        // 어시스턴트 정보 일괄 조회
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

        // 차량 정보 일괄 조회
        const vehicleMap = new Map<string, string>()
        if (vehicleIds.size > 0) {
          try {
            const vehicleIdsArray = Array.from(vehicleIds)
            for (let i = 0; i < vehicleIdsArray.length; i += chunkSize) {
              const chunk = vehicleIdsArray.slice(i, i + chunkSize)
              const { data: vehicles } = await supabase
                .from('vehicles')
                .select('id, vehicle_number, vehicle_type')
                .in('id', chunk)
              
              if (vehicles) {
                vehicles.forEach((vehicle: { id: string; vehicle_number: string | null; vehicle_type: string | null }) => {
                  if (vehicle.id) {
                    vehicleMap.set(vehicle.id, vehicle.vehicle_number || vehicle.vehicle_type || '-')
                  }
                })
              }
            }
          } catch (error) {
            console.error('차량 정보 조회 오류:', error)
          }
        }

        // 예약 데이터를 ID 기반 Map으로 미리 인덱싱 (O(1) 조회용)
        const reservationById = new Map<string, Reservation>()
        const reservationByTourId = new Map<string, Reservation>()
        reservations.forEach(r => {
          reservationById.set(r.id, r)
          if (r.tourId) {
            reservationByTourId.set(r.tourId, r)
          }
        })

        // 같은 tour_date + product_id 조합의 총 인원 수 계산
        const dateProductTotalPeopleMap = new Map<string, number>()
        reservations.forEach(r => {
          const tourDate = r.tourDate || ''
          const productId = r.productId || ''
          const statusLower = r.status?.toLowerCase() || ''
          
          // 취소된 예약 제외
          if (statusLower === 'cancelled' || statusLower === 'canceled') {
            return
          }
          
          const key = `${productId}__${tourDate}`
          const currentTotal = dateProductTotalPeopleMap.get(key) || 0
          dateProductTotalPeopleMap.set(key, currentTotal + (r.totalPeople || 0))
        })

        // 각 투어에 대해 정보 매핑 (최적화된 O(1) 조회 사용)
        hookToursMap.forEach((tour, tourId) => {
          let guideName = '-'
          let assistantName = '-'
          let vehicleName = '-'
          let totalPeople = 0

          // 가이드 정보
          if (tour.tour_guide_id) {
            guideName = guideMap.get(tour.tour_guide_id) || '-'
          }

          // 어시스턴트 정보
          if (tour.assistant_id) {
            assistantName = assistantMap.get(tour.assistant_id) || '-'
          }

          // 차량 정보
          if (tour.tour_car_id) {
            vehicleName = vehicleMap.get(tour.tour_car_id) || '-'
          }

          // 배정된 투어 인원 계산: reservation_ids의 unique 값으로 예약들의 total_people 합산
          if (tour.reservation_ids && tour.reservation_ids.length > 0) {
            const uniqueReservationIds = [...new Set(tour.reservation_ids)]
            totalPeople = uniqueReservationIds.reduce((sum: number, id: string) => {
              const reservation = reservationById.get(id)
              if (!reservation) return sum
              
              const statusLower = reservation.status?.toLowerCase() || ''
              if (statusLower === 'cancelled' || statusLower === 'canceled') {
                return sum
              }
              
              return sum + (reservation.totalPeople || 0)
            }, 0)
          }

          // 관련 예약 찾기 (O(1) 조회)
          const reservation = reservationByTourId.get(tourId)
          const productId = reservation?.productId || null
          const tourDate = tour.tour_date || reservation?.tourDate || ''
          
          // allDateTotalPeople: 같은 tour_date + product_id를 가진 모든 예약의 total_people 합산
          const key = `${productId}__${tourDate}`
          const allDateTotalPeople = dateProductTotalPeopleMap.get(key) || totalPeople

          newTourInfoMap.set(tourId, {
            totalPeople,
            otherReservationsTotalPeople: 0, // 성능상 0으로 설정
            allDateTotalPeople,
            status: tour.tour_status || '-',
            guideName,
            assistantName,
            vehicleName,
            tourDate: tour.tour_date || '',
            tourStartDatetime: tour.tour_start_datetime || null,
            isAssigned: true,
            reservationIds: tour.reservation_ids,
            productId
          })
        })

        console.log('투어 정보 맵 생성 완료:', { mapSize: newTourInfoMap.size })
        setTourInfoMap(newTourInfoMap)
      } catch (error) {
        console.error('투어 정보 맵 생성 중 오류:', error)
      }
    }

    buildTourInfoMap()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, hookToursMap])

  // 예약 처리 필요 배지용: 입금이 있는 예약 ID 수집
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

  // 예약 처리 필요 건수 (배지 표시용)
  const actionRequiredCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const d = new Date()
    d.setDate(d.getDate() + 7)
    const sevenDaysLaterStr = d.toISOString().split('T')[0]
    const statusPending = (r: Reservation) => (r.status === 'pending' || (r.status as string)?.toLowerCase?.() === 'pending')
    const statusConfirmed = (r: Reservation) => (r.status === 'confirmed' || (r.status as string)?.toLowerCase?.() === 'confirmed')
    const hasPayment = (r: Reservation) => reservationIdsWithPayments.has(r.id)
    const hasTourAssigned = (r: Reservation) => {
      const id = r.tourId?.trim?.()
      return !!(id && id !== '' && id !== 'null' && id !== 'undefined')
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
    const statusList = reservations.filter(r => tourDateWithin7Days(r) && statusPending(r))
    const tourList = reservations.filter(r => statusConfirmed(r) && !hasTourAssigned(r))
    const noPricing = reservations.filter(r => !hasPricing(r))
    const pricingMismatch = reservations.filter(r => hasPricing(r) && !storedTotalMatchesDynamic(r))
    const depositNoTour = reservations.filter(r => hasPayment(r) && !hasTourAssigned(r))
    const confirmedNoDeposit = reservations.filter(r => statusConfirmed(r) && !hasPayment(r))
    const balanceList = reservations.filter(r => tourDateBeforeToday(r) && getBalance(r) > 0)
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
    optionChoices
  ])

  // 필터링 및 정렬 로직 - useMemo로 최적화
  const filteredAndSortedReservations = useMemo(() => {
    const filtered = reservations.filter(reservation => {
      // 고객 ID 필터 (URL 파라미터에서)
      const matchesCustomer = !customerIdFromUrl || reservation.customerId === customerIdFromUrl
      
      // 검색 조건 - 검색어가 있을 때만 검색 수행
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
    
      // 상태 필터
    const matchesStatus = selectedStatus === 'all' || reservation.status === selectedStatus
      
      // 채널 필터
      const matchesChannel = selectedChannel === 'all' || reservation.channelId === selectedChannel
      
      // 날짜 범위 필터 - 빈 날짜 범위일 때는 모든 데이터 표시
      let matchesDateRange = true
      if (dateRange.start && dateRange.end) {
        const tourDate = new Date(reservation.tourDate)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        // 날짜가 유효한 경우에만 필터링 적용
        if (!isNaN(tourDate.getTime()) && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          matchesDateRange = tourDate >= startDate && tourDate <= endDate
        }
      }
      
      return matchesCustomer && matchesSearch && matchesStatus && matchesChannel && matchesDateRange
    })
    
    // 정렬
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
    
    return filtered
  }, [reservations, customers, products, channels, debouncedSearchTerm, selectedStatus, selectedChannel, dateRange, sortBy, sortOrder, customerIdFromUrl])
  
  const filteredReservations = filteredAndSortedReservations
  
  // 7일 단위 페이지네이션을 위한 유틸리티 함수들 (오늘 기준)
  const getWeekStartDate = useCallback((weekOffset: number) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // weekOffset이 0이면 오늘부터 6일 전까지 (총 7일)
    // weekOffset이 1이면 7일 전부터 13일 전까지
    // weekOffset이 -1이면 7일 후부터 13일 후까지
    const daysToSubtract = (weekOffset * 7) + 6 // 오늘 포함 7일이므로 6일 전부터 시작
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - daysToSubtract)
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  }, [])

  const getWeekEndDate = useCallback((weekOffset: number) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // weekOffset이 0이면 오늘까지
    // weekOffset이 1이면 7일 전까지
    // weekOffset이 -1이면 7일 후까지
    const daysToAdd = weekOffset * 7
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() + daysToAdd)
    weekEnd.setHours(23, 59, 59, 999)
    return weekEnd
  }, [])

  const formatWeekRange = useCallback((weekOffset: number) => {
    const weekStart = getWeekStartDate(weekOffset)
    const weekEnd = getWeekEndDate(weekOffset)
    
    // 로컬 시간대 기준으로 YYYY-MM-DD 형식 변환
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

  // 날짜별 그룹화 로직 (created_at 기준) - 주간 페이지네이션 적용
  const groupedReservations = useMemo(() => {
    if (!groupByDate) {
      return { 'all': filteredReservations }
    }
    
    const groups: { [key: string]: typeof filteredReservations } = {}
    
    // 현재 주의 날짜 범위 계산 (로컬 시간대 기준)
    const weekStart = getWeekStartDate(currentWeek)
    const weekEnd = getWeekEndDate(currentWeek)
    
    // 주간 범위를 YYYY-MM-DD 형식으로 변환 (로컬 시간대 기준)
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
    const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`
    
    filteredReservations.forEach((reservation) => {
      // created_at 날짜를 변환 없이 그대로 사용하여 YYYY-MM-DD 형식으로 추출
      if (!reservation.addedTime) {
        return // addedTime이 없으면 건너뛰기
      }
      
      const date = new Date(reservation.addedTime)
      
      // 유효한 날짜인지 확인
      if (isNaN(date.getTime())) {
        return // 유효하지 않은 날짜면 건너뛰기
      }
      
      // 로컬 시간대 기준으로 날짜 부분만 추출 (YYYY-MM-DD)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const createdDate = `${year}-${month}-${day}`
      
      // 현재 주 범위에 포함되는지 확인 (문자열 비교)
      const isInRange = createdDate >= weekStartStr && createdDate <= weekEndStr
      
      
      if (isInRange) {
        if (!groups[createdDate]) {
          groups[createdDate] = []
        }
        groups[createdDate].push(reservation)
      }
    })
    
    
    // 날짜별로 정렬 (최신 날짜부터)
    const sortedGroups: { [key: string]: typeof filteredReservations } = {}
    Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .forEach(date => {
        sortedGroups[date] = groups[date]
      })
    
    return sortedGroups
  }, [filteredReservations, groupByDate, currentWeek, getWeekStartDate, getWeekEndDate])

  // 날짜별 그룹을 기본적으로 접힌 상태로 설정
  useEffect(() => {
    if (groupByDate && groupedReservations && Object.keys(groupedReservations).length > 0) {
      const allDates = Object.keys(groupedReservations)
      setCollapsedGroups(prev => {
        // 이미 모든 날짜가 접힌 상태인지 확인
        const allCollapsed = allDates.every(date => prev.has(date))
        if (allCollapsed && prev.size === allDates.length) {
          return prev // 이미 모든 날짜가 접힌 상태면 변경하지 않음
        }
        // 새로운 날짜를 포함하여 모든 날짜를 접힌 상태로 설정
        const newSet = new Set(prev)
        allDates.forEach(date => newSet.add(date))
        return newSet
      })
    }
  }, [groupedReservations, groupByDate])

  // 주간 통계 데이터 계산
  const weeklyStats = useMemo(() => {
    const allReservations = Object.values(groupedReservations).flat()
    
    // 상품별 인원 통계
    const productStats = allReservations.reduce((groups, reservation) => {
      const productName = getProductName(reservation.productId, products || [])
      if (!groups[productName]) {
        groups[productName] = 0
      }
      groups[productName] += reservation.totalPeople
      return groups
    }, {} as Record<string, number>)

    // 채널별 인원 통계 (파비콘 정보 포함)
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

    // 상태별 인원 통계
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
  
  // 페이지네이션 계산 (그룹화되지 않은 경우에만)
  const totalPages = groupByDate ? 1 : Math.ceil(filteredReservations.length / itemsPerPage)
  const startIndex = groupByDate ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = groupByDate ? filteredReservations.length : startIndex + itemsPerPage
  const paginatedReservations = groupByDate ? filteredReservations : filteredReservations.slice(startIndex, endIndex)

  // reservation_pricing 데이터는 useReservationData 훅에서 이미 로딩됨
  // 페이지네이션된 reservation에 대해서만 필터링하여 사용
  // (hookReservationPricingMap은 모든 reservation에 대한 데이터를 포함)

  // 달력뷰용 데이터 변환
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
    // 중복 호출 방지
    if (isAddingReservationRef.current) {
      console.log('handleAddReservation: 이미 처리 중입니다. 중복 호출 방지.')
      return
    }
    
    isAddingReservationRef.current = true
    
    // 예약 ID 확인 (모달 오픈 시 생성된 ID 또는 reservation.id)
    const reservationId = (reservation as any).id || newReservationId
    
    console.log('handleAddReservation 호출됨:', {
      reservationId,
      hasChoices: !!reservation.choices,
      choicesRequiredCount: Array.isArray(reservation.choices?.required) ? reservation.choices.required.length : 0,
      hasSelectedChoices: !!(reservation as any).selectedChoices,
      selectedChoicesCount: Array.isArray((reservation as any).selectedChoices) ? (reservation as any).selectedChoices.length : 0,
      hasPricingInfo: !!(reservation as any).pricingInfo,
      pricingInfo: (reservation as any).pricingInfo
    })
    
    if (!reservationId) {
      console.error('예약 ID가 없습니다!')
      alert(t('messages.noReservationId'))
      isAddingReservationRef.current = false
      return
    }
    
    try {
      // Supabase에 저장할 데이터 준비
      // tour_id는 먼저 null로 설정하고, 투어 생성 후 업데이트
      const reservationData = {
        id: reservationId, // 미리 생성된 ID 사용
        customer_id: reservation.customerId,
        product_id: reservation.productId,
        tour_date: reservation.tourDate,
        tour_time: reservation.tourTime || null, // 빈 문자열을 null로 변환
        event_note: reservation.eventNote,
        pickup_hotel: reservation.pickUpHotel,
        pickup_time: reservation.pickUpTime || null, // 빈 문자열을 null로 변환
        adults: reservation.adults,
        child: reservation.child,
        infant: reservation.infant,
        total_people: reservation.totalPeople,
        channel_id: reservation.channelId,
        channel_rn: reservation.channelRN,
        added_by: reservation.addedBy,
        tour_id: null, // 먼저 null로 설정
        status: reservation.status,
        selected_options: reservation.selectedOptions,
        selected_option_prices: reservation.selectedOptionPrices,
        is_private_tour: reservation.isPrivateTour || false,
        choices: reservation.choices,
        variant_key: (reservation as any).variantKey || 'default' // variant_key 추가
      }

      // ID가 있으면 upsert 사용 (이미 존재하면 update, 없으면 insert)
      let newReservation
      let error
      
      // 먼저 존재 여부 확인
      const { data: existingReservation } = await supabase
        .from('reservations')
        .select('id')
        .eq('id', reservationId)
        .maybeSingle()
      
      if (existingReservation) {
        // 이미 존재하면 update
        console.log('기존 예약 발견, 업데이트:', reservationId)
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
        // 없으면 insert
        console.log('새 예약 생성:', reservationId)
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

      console.log('Reservation saved with ID:', reservationId)
      
      console.log('Reservation upserted with ID:', reservationId)
      console.log('Full reservation data:', newReservation)
      console.log('Reservation payload received:', {
        hasChoices: !!reservation.choices,
        choicesRequiredCount: Array.isArray(reservation.choices?.required) ? reservation.choices.required.length : 0,
        hasSelectedChoices: !!(reservation as any).selectedChoices,
        selectedChoicesCount: Array.isArray((reservation as any).selectedChoices) ? (reservation as any).selectedChoices.length : 0,
        hasPricingInfo: !!(reservation as any).pricingInfo
      })

      // reservation_customers 테이블에 거주 상태별 인원 수 저장
      if (reservationId) {
        try {
          // 기존 reservation_customers 데이터 삭제 (업데이트 시)
          await supabase
            .from('reservation_customers')
            .delete()
            .eq('reservation_id', reservationId)

          // 상태별 인원 수에 따라 reservation_customers 레코드 생성
          const reservationCustomers: any[] = []
          let orderIndex = 0

          // 미국 거주자
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

          // 비거주자
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

          // 비 거주자 (16세 이하)
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

          // 비거주자 (패스 보유) - 패스 장수는 nonResidentWithPassCount와 같음
          const nonResidentWithPassCount = (reservation as any).nonResidentWithPassCount || 0
          
          // 비거주자 (패스 보유) - 패스 장수만큼 생성, 각 패스는 4인을 커버
          for (let i = 0; i < nonResidentWithPassCount; i++) {
            reservationCustomers.push({
              reservation_id: reservationId,
              customer_id: reservation.customerId,
              resident_status: 'non_resident_with_pass',
              pass_covered_count: 4, // 패스 1장당 4인 커버
              order_index: orderIndex++
            })
          }

          // reservation_customers 데이터 삽입
          if (reservationCustomers.length > 0) {
            const { error: rcError } = await supabase
              .from('reservation_customers')
              .insert(reservationCustomers as any)

            if (rcError) {
              console.error('Error saving reservation_customers:', rcError)
            } else {
              console.log('Reservation customers saved successfully')
            }
          }
        } catch (rcError) {
          console.error('Error saving reservation_customers:', rcError)
        }
      }

      // 투어 자동 생성 또는 업데이트
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
          
          if (tourResult.success && tourResult.tourId) {
            console.log('Tour created/updated successfully:', tourResult.tourId)
          } else {
            console.warn('Tour creation failed:', tourResult.message)
          }
        } catch (tourError) {
          console.error('Error in tour auto-creation:', tourError)
        }
      }

      // 새로운 초이스 시스템: reservation_choices 테이블에 저장
      // reservation.choices 또는 reservation.selectedChoices에서 초이스 데이터 가져오기
      console.log('초이스 저장 시도:', {
        reservationId,
        hasChoices: !!reservation.choices,
        choicesRequiredCount: Array.isArray(reservation.choices?.required) ? reservation.choices.required.length : 0,
        hasSelectedChoices: !!(reservation as any).selectedChoices,
        selectedChoicesCount: Array.isArray((reservation as any).selectedChoices) ? (reservation as any).selectedChoices.length : 0,
        choices: reservation.choices,
        selectedChoices: (reservation as any).selectedChoices
      })
      
      if (reservationId) {
        try {
          const UNDECIDED_OPTION_ID = '__undecided__' // "미정" 선택은 reservation_choices에 저장하지 않음
          let choicesToSave: Array<{
            reservation_id: string
            choice_id: string
            option_id: string
            quantity: number
            total_price: number
          }> = []
          
          // 1. reservation.selectedChoices에서 가져오기 (우선순위 1 - 배열 형태)
          if ((reservation as any).selectedChoices) {
            const selectedChoices = (reservation as any).selectedChoices
            console.log('reservation.selectedChoices 확인:', {
              isArray: Array.isArray(selectedChoices),
              length: Array.isArray(selectedChoices) ? selectedChoices.length : 'not array',
              type: typeof selectedChoices,
              value: selectedChoices
            })
            
            if (Array.isArray(selectedChoices) && selectedChoices.length > 0) {
              console.log('reservation.selectedChoices에서 초이스 데이터 발견:', selectedChoices.length, '개')
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
                  // "미정" 선택은 reservation_choices에 저장하지 않음 (choice_options FK 제약)
                } else {
                  console.warn('초이스 데이터에 choice_id 또는 option_id가 없습니다:', choice)
                }
              }
            }
          }
          
          // 2. reservation.choices.required에서 가져오기 (fallback)
          if (choicesToSave.length === 0 && reservation.choices && reservation.choices.required && Array.isArray(reservation.choices.required)) {
            console.log('reservation.choices.required에서 초이스 데이터 발견:', reservation.choices.required.length, '개')
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
          
          console.log('저장할 초이스 데이터:', choicesToSave.length, '개', choicesToSave)
          
          if (choicesToSave.length > 0) {
            // option_id 검증을 건너뛰고 바로 저장 (검증이 너무 엄격해서 저장이 안 될 수 있음)
            console.log('reservation_choices에 저장할 데이터:', choicesToSave)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: insertedChoices, error: choicesError } = await (supabase as any)
              .from('reservation_choices')
              .insert(choicesToSave)
              .select()

            if (choicesError) {
              console.error('초이스 저장 오류:', choicesError)
              console.error('저장 시도한 데이터:', choicesToSave)
              console.error('오류 상세:', {
                message: choicesError.message,
                details: choicesError.details,
                hint: choicesError.hint,
                code: choicesError.code
              })
              alert(t('messages.choicesSaveError') + choicesError.message)
            } else {
              console.log('초이스 저장 성공:', choicesToSave.length, '개', insertedChoices)
            }
          } else {
            console.warn('저장할 초이스 데이터가 없습니다.', {
              hasChoices: !!reservation.choices,
              choicesRequiredCount: Array.isArray(reservation.choices?.required) ? reservation.choices.required.length : 0,
              hasSelectedChoices: !!(reservation as any).selectedChoices,
              selectedChoicesCount: Array.isArray((reservation as any).selectedChoices) ? (reservation as any).selectedChoices.length : 0,
              selectedChoicesType: typeof (reservation as any).selectedChoices,
              selectedChoicesValue: (reservation as any).selectedChoices
            })
          }
        } catch (choicesError) {
          console.error('초이스 저장 중 예외:', choicesError)
          // 초이스 저장 실패해도 예약은 성공으로 처리
        }
      }

      // selected_options는 reservations 테이블의 selected_options 컬럼에 저장됨
      // 별도의 reservation_options 테이블 저장은 현재 비활성화

      // 가격 정보는 현재 reservations 테이블의 selected_option_prices 컬럼에 저장됨
      // 별도의 reservation_pricing 테이블 저장은 현재 비활성화

      // reservation_pricing 자동 생성
      console.log('가격 정보 저장 시도:', {
        reservationId,
        hasPricingInfo: !!(reservation as any).pricingInfo,
        pricingInfo: (reservation as any).pricingInfo,
        pricingInfoKeys: (reservation as any).pricingInfo ? Object.keys((reservation as any).pricingInfo) : []
      })
      
      if (reservationId) {
        // pricingInfo가 없어도 기본값으로 생성
        const pricingInfo = (reservation as any).pricingInfo || {}
        try {
          const pricingId = crypto.randomUUID()
          
          const pricingData = {
            id: pricingId,
            reservation_id: reservationId,
            adult_product_price: pricingInfo.adultProductPrice || 0,
            child_product_price: pricingInfo.childProductPrice || 0,
            infant_product_price: pricingInfo.infantProductPrice || 0,
            product_price_total: pricingInfo.productPriceTotal || 0,
            not_included_price: pricingInfo.not_included_price || 0,
            required_options: pricingInfo.requiredOptions || {},
            required_option_total: pricingInfo.requiredOptionTotal || 0,
            choices: pricingInfo.choices || {},
            choices_total: pricingInfo.choicesTotal || 0,
            subtotal: pricingInfo.subtotal || 0,
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
            total_price: pricingInfo.totalPrice || 0,
            deposit_amount: pricingInfo.depositAmount || 0,
            balance_amount: pricingInfo.balanceAmount || 0,
            private_tour_additional_cost: pricingInfo.privateTourAdditionalCost || 0,
            commission_percent: pricingInfo.commission_percent || 0,
            commission_amount: pricingInfo.commission_amount || 0
          }

          console.log('reservation_pricing 저장 데이터:', pricingData)

          const { data: insertedPricing, error: pricingError } = await supabase
            .from('reservation_pricing')
            .insert(pricingData as any)
            .select()
            .single()

          if (pricingError) {
            console.error('reservation_pricing 생성 오류:', pricingError)
            console.error('저장 시도한 데이터:', pricingData)
            console.error('오류 상세:', {
              message: pricingError.message,
              details: pricingError.details,
              hint: pricingError.hint,
              code: pricingError.code
            })
            alert(t('messages.pricingSaveError') + pricingError.message)
          } else {
            console.log('reservation_pricing 생성 성공:', pricingId, insertedPricing)
          }
        } catch (pricingError) {
          console.error('reservation_pricing 생성 중 예외:', pricingError)
          console.error('예외 스택:', (pricingError as Error).stack)
          alert(t('messages.pricingSaveException') + (pricingError as Error).message)
        }
      } else {
        console.warn('reservationId가 없어 reservation_pricing을 생성하지 않습니다.', {
          reservationId,
          hasPricingInfo: !!(reservation as any).pricingInfo
        })
      }

      // payment_records 자동 생성 (사용자가 입력한 depositAmount로 Deposit Received)
      if (reservationId && (reservation as any).pricingInfo) {
        try {
          const pricingInfo = (reservation as any).pricingInfo
          // 사용자가 입력한 depositAmount 사용
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
                console.error('payment_records 생성 오류:', errorData.error)
              } else {
                console.log('payment_records 생성 성공 (depositAmount:', depositAmount, ')')
              }
            }
          }
        } catch (paymentError) {
          console.error('payment_records 생성 중 예외:', paymentError)
        }
      }

      // 성공 시 예약 목록 새로고침
      console.log('handleAddReservation: 모든 저장 완료, 예약 목록 새로고침 시작')
      await refreshReservations()
      console.log('handleAddReservation: 예약 목록 새로고침 완료')
      setShowAddForm(false)
      setNewReservationId(null)
      alert(t('messages.reservationAdded'))
    } catch (error) {
      console.error('handleAddReservation: 예약 추가 중 오류:', error)
      console.error('오류 스택:', (error as Error).stack)
      alert(t('messages.reservationAddErrorGeneric') + ((error as Error).message || ''))
    } finally {
      isAddingReservationRef.current = false
    }
  }, [refreshReservations])

  const handleEditReservation = useCallback(async (reservation: Omit<Reservation, 'id'>) => {
    if (editingReservation) {
      try {
        // Supabase에 저장할 데이터 준비
        const reservationData = {
          customer_id: reservation.customerId,
          product_id: reservation.productId,
          tour_date: reservation.tourDate,
          tour_time: reservation.tourTime || null, // 빈 문자열을 null로 변환
          event_note: reservation.eventNote,
          pickup_hotel: reservation.pickUpHotel,
          pickup_time: reservation.pickUpTime || null, // 빈 문자열을 null로 변환
          adults: reservation.adults,
          child: reservation.child,
          infant: reservation.infant,
          total_people: reservation.totalPeople,
          channel_id: reservation.channelId,
          channel_rn: reservation.channelRN,
          added_by: reservation.addedBy,
          tour_id: reservation.tourId,
          status: reservation.status,
          selected_options: reservation.selectedOptions,
          selected_option_prices: reservation.selectedOptionPrices,
          is_private_tour: reservation.isPrivateTour || false,
          choices: reservation.choices,
          variant_key: (reservation as any).variantKey || 'default' // variant_key 추가
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('reservations')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(reservationData as any)
          .eq('id', editingReservation.id)

        if (error) {
          console.error('Error updating reservation:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          })
          alert(t('messages.reservationUpdateError') + error.message)
          return
        }

        // 새로운 초이스 시스템: reservation_choices 테이블에 저장
        try {
          const UNDECIDED_OPTION_ID = '__undecided__'
          // 기존 reservation_choices 삭제
          await supabase
            .from('reservation_choices')
            .delete()
            .eq('reservation_id', editingReservation.id)

          let choicesToSave: Array<{
            reservation_id: string
            choice_id: string
            option_id: string
            quantity: number
            total_price: number
          }> = []
          
          // 1. reservation.selectedChoices에서 가져오기 (우선순위 1 - 배열 형태)
          if ((reservation as any).selectedChoices) {
            const selectedChoices = (reservation as any).selectedChoices
            console.log('handleEditReservation: reservation.selectedChoices 확인:', {
              isArray: Array.isArray(selectedChoices),
              length: Array.isArray(selectedChoices) ? selectedChoices.length : 'not array',
              type: typeof selectedChoices,
              value: selectedChoices
            })
            
            if (Array.isArray(selectedChoices) && selectedChoices.length > 0) {
              console.log('handleEditReservation: reservation.selectedChoices에서 초이스 데이터 발견:', selectedChoices.length, '개')
              for (const choice of selectedChoices) {
                if (choice.choice_id && choice.option_id && choice.option_id !== UNDECIDED_OPTION_ID) {
                  const totalPrice = choice.total_price !== undefined && choice.total_price !== null 
                    ? Number(choice.total_price) 
                    : 0
                  console.log('handleEditReservation: 초이스 저장 데이터:', {
                    choice_id: choice.choice_id,
                    option_id: choice.option_id,
                    quantity: choice.quantity || 1,
                    total_price: totalPrice,
                    original_total_price: choice.total_price,
                    type: typeof choice.total_price
                  })
                  choicesToSave.push({
                    reservation_id: editingReservation.id,
                    choice_id: choice.choice_id,
                    option_id: choice.option_id,
                    quantity: choice.quantity || 1,
                    total_price: totalPrice
                  })
                } else if (choice.option_id === UNDECIDED_OPTION_ID) {
                  // "미정" 선택은 reservation_choices에 저장하지 않음
                } else {
                  console.warn('초이스 데이터에 choice_id 또는 option_id가 없습니다:', choice)
                }
              }
            }
          }
          
          // 2. reservation.choices.required에서 가져오기 (fallback)
          if (choicesToSave.length === 0 && reservation.choices && reservation.choices.required && Array.isArray(reservation.choices.required)) {
            console.log('handleEditReservation: reservation.choices.required에서 초이스 데이터 발견:', reservation.choices.required.length, '개')
            for (const choice of reservation.choices.required) {
              if (choice.choice_id && choice.option_id && choice.option_id !== UNDECIDED_OPTION_ID) {
                choicesToSave.push({
                  reservation_id: editingReservation.id,
                  choice_id: choice.choice_id,
                  option_id: choice.option_id,
                  quantity: choice.quantity || 1,
                  total_price: choice.total_price || 0
                })
              }
            }
          }
          
          console.log('handleEditReservation: 저장할 초이스 데이터:', choicesToSave.length, '개', choicesToSave)
          
          if (choicesToSave.length > 0) {
            // option_id 검증을 건너뛰고 바로 저장 (검증이 너무 엄격해서 저장이 안 될 수 있음)
            console.log('handleEditReservation: reservation_choices에 저장할 데이터:', choicesToSave)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: insertedChoices, error: choicesError } = await (supabase as any)
              .from('reservation_choices')
              .insert(choicesToSave)
              .select()

            if (choicesError) {
              console.error('초이스 저장 오류:', choicesError)
              console.error('저장 시도한 데이터:', choicesToSave)
              console.error('오류 상세:', {
                message: choicesError.message,
                details: choicesError.details,
                hint: choicesError.hint,
                code: choicesError.code
              })
              alert(t('messages.choicesSaveError') + choicesError.message)
            } else {
              console.log('초이스 저장 성공:', choicesToSave.length, '개', insertedChoices)
            }
          } else {
            console.warn('저장할 초이스 데이터가 없습니다.', {
              hasChoices: !!reservation.choices,
              choicesRequiredCount: Array.isArray(reservation.choices?.required) ? reservation.choices.required.length : 0,
              hasSelectedChoices: !!(reservation as any).selectedChoices,
              selectedChoicesCount: Array.isArray((reservation as any).selectedChoices) ? (reservation as any).selectedChoices.length : 0,
              selectedChoicesType: typeof (reservation as any).selectedChoices,
              selectedChoicesValue: (reservation as any).selectedChoices
            })
          }
        } catch (choicesError) {
          console.error('초이스 저장 중 예외:', choicesError)
          // 초이스 저장 실패해도 예약은 성공으로 처리
        }

        // reservation_customers 테이블에 거주 상태별 인원 수 저장
        try {
          // 기존 reservation_customers 데이터 삭제
          await supabase
            .from('reservation_customers')
            .delete()
            .eq('reservation_id', editingReservation.id)

          // 상태별 인원 수에 따라 reservation_customers 레코드 생성
          const reservationCustomers: any[] = []
          let orderIndex = 0

          // 미국 거주자
          const usResidentCount = (reservation as any).usResidentCount || 0
          for (let i = 0; i < usResidentCount; i++) {
            reservationCustomers.push({
              reservation_id: editingReservation.id,
              customer_id: reservation.customerId,
              resident_status: 'us_resident',
              pass_covered_count: 0,
              order_index: orderIndex++
            })
          }

          // 비거주자
          const nonResidentCount = (reservation as any).nonResidentCount || 0
          for (let i = 0; i < nonResidentCount; i++) {
            reservationCustomers.push({
              reservation_id: editingReservation.id,
              customer_id: reservation.customerId,
              resident_status: 'non_resident',
              pass_covered_count: 0,
              order_index: orderIndex++
            })
          }

          // 비 거주자 (16세 이하)
          const nonResidentUnder16Count = (reservation as any).nonResidentUnder16Count || 0
          for (let i = 0; i < nonResidentUnder16Count; i++) {
            reservationCustomers.push({
              reservation_id: editingReservation.id,
              customer_id: reservation.customerId,
              resident_status: 'non_resident_under_16',
              pass_covered_count: 0,
              order_index: orderIndex++
            })
          }

          // 비거주자 (패스 보유) - 패스 장수는 nonResidentWithPassCount와 같음
          const nonResidentWithPassCount = (reservation as any).nonResidentWithPassCount || 0
          
          // 비거주자 (패스 보유) - 패스 장수만큼 생성, 각 패스는 4인을 커버
          for (let i = 0; i < nonResidentWithPassCount; i++) {
            reservationCustomers.push({
              reservation_id: editingReservation.id,
              customer_id: reservation.customerId,
              resident_status: 'non_resident_with_pass',
              pass_covered_count: 4, // 패스 1장당 4인 커버
              order_index: orderIndex++
            })
          }

          // reservation_customers 데이터 삽입
          if (reservationCustomers.length > 0) {
            const { error: rcError } = await supabase
              .from('reservation_customers')
              .insert(reservationCustomers as any)

            if (rcError) {
              console.error('Error saving reservation_customers:', rcError)
            } else {
              console.log('Reservation customers updated successfully')
            }
          }
        } catch (rcError) {
          console.error('Error saving reservation_customers:', rcError)
        }

        // 가격 정보가 있으면 업데이트 또는 삽입
        if (reservation.pricingInfo) {
          try {
            const pricingInfo = reservation.pricingInfo as any
            const pricingData = {
              reservation_id: editingReservation.id,
              adult_product_price: pricingInfo.adultProductPrice,
              child_product_price: pricingInfo.childProductPrice,
              infant_product_price: pricingInfo.infantProductPrice,
              product_price_total: pricingInfo.productPriceTotal,
              not_included_price: pricingInfo.not_included_price || 0,
              required_options: pricingInfo.requiredOptions,
              required_option_total: pricingInfo.requiredOptionTotal,
              choices: pricingInfo.choices || {},
              choices_total: pricingInfo.choicesTotal || 0,
              subtotal: pricingInfo.subtotal,
              coupon_code: pricingInfo.couponCode,
              coupon_discount: pricingInfo.couponDiscount,
              additional_discount: pricingInfo.additionalDiscount,
              additional_cost: pricingInfo.additionalCost,
              card_fee: pricingInfo.cardFee,
              tax: pricingInfo.tax,
              prepayment_cost: pricingInfo.prepaymentCost,
              prepayment_tip: pricingInfo.prepaymentTip,
              selected_options: pricingInfo.selectedOptionalOptions,
              option_total: pricingInfo.optionTotal,
              total_price: pricingInfo.totalPrice,
              deposit_amount: pricingInfo.depositAmount,
              balance_amount: pricingInfo.balanceAmount,
              private_tour_additional_cost: pricingInfo.privateTourAdditionalCost,
              commission_percent: pricingInfo.commission_percent || 0,
              commission_amount: pricingInfo.commission_amount || 0
            }

            // upsert를 사용하여 기존 레코드가 있으면 업데이트, 없으면 삽입
            const { error: pricingError } = await supabase
              .from('reservation_pricing')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .upsert(pricingData as any, { 
                onConflict: 'reservation_id',
                ignoreDuplicates: false 
              })

            if (pricingError) {
              console.error('Error saving pricing info:', pricingError)
              // 가격 정보 저장 실패는 예약 수정 성공에 영향을 주지 않음
            } else {
              console.log('가격 정보가 성공적으로 저장되었습니다.')
            }
          } catch (pricingError) {
            console.error('Error saving pricing info:', pricingError)
          }
        }

        // Mania Tour 또는 Mania Service인 경우 자동으로 투어 생성 또는 업데이트
        try {
          const tourResult = await autoCreateOrUpdateTour(
            reservation.productId,
            reservation.tourDate,
            editingReservation.id,
            reservation.isPrivateTour
          )
          
          if (tourResult.success) {
            console.log('투어 자동 생성/업데이트 성공:', tourResult.message)
          } else {
            console.warn('투어 자동 생성/업데이트 실패:', tourResult.message)
            // 투어 생성 실패는 예약 수정 성공에 영향을 주지 않음
          }
        } catch (tourError) {
          console.error('투어 자동 생성/업데이트 중 예상치 못한 오류:', tourError)
          // 투어 생성 실패는 예약 수정 성공에 영향을 주지 않음
        }

        // 성공 시 예약 목록 새로고침
        await refreshReservations()
        setEditingReservation(null)
        alert(t('messages.reservationUpdated'))
      } catch (error) {
        console.error('Error updating reservation:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          error: error
        })
        alert(t('messages.reservationUpdateError') + (error instanceof Error ? error.message : 'Unknown error'))
      }
    }
  }, [editingReservation, refreshReservations, t])



  // 투어 존재 여부 확인 함수
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

  // 투어 생성 함수 - useCallback으로 메모이제이션
  const handleCreateTour = useCallback(async (reservation: Reservation) => {
    try {
      // 먼저 투어가 실제로 존재하는지 다시 한번 확인
      const tourExists = await checkTourExists(reservation.productId, reservation.tourDate)
      
      if (tourExists) {
        alert(t('messages.tourExists'))
        // 예약 목록 새로고침하여 최신 상태 반영
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
        // 투어 생성 성공 시 tour-photos 버켓도 생성
        const bucketCreated = await createTourPhotosBucket()
        if (!bucketCreated) {
          console.warn('Failed to create tour-photos bucket, but tour creation succeeded')
        }
        
        alert(t('messages.tourCreated'))
        // 예약 목록 새로고침
        await refreshReservations()
      } else {
        alert(t('messages.tourCreationError') + result.message)
      }
    } catch (error) {
      console.error('Error creating tour:', error)
      alert(t('messages.tourCreationError'))
    }
  }, [refreshReservations, t])

  // 달력뷰에서 예약 클릭 시 편집 모달 열기 - useCallback으로 메모이제이션
  const handleCalendarReservationClick = useCallback((calendarReservation: { id: string }) => {
    const originalReservation = reservations.find(r => r.id === calendarReservation.id)
    if (originalReservation) {
      setEditingReservation(originalReservation)
    }
  }, [reservations])

  // 가격 정보 모달 열기 - reservationPricingMap의 가격을 reservation에 병합하여 모달에서 바로 표시
  const handlePricingInfoClick = useCallback((reservation: Reservation) => {
    const pricing = reservationPricingMap.get(reservation.id)
    const reservationWithPricing = pricing
      ? { ...reservation, pricing: pricing as { adult_product_price?: number; child_product_price?: number; infant_product_price?: number; [k: string]: unknown } }
      : reservation
    setPricingModalReservation(reservationWithPricing)
    setShowPricingModal(true)
  }, [reservationPricingMap])

  // 가격 정보 모달 닫기 - useCallback으로 메모이제이션
  const handleClosePricingModal = useCallback(() => {
    setShowPricingModal(false)
    setPricingModalReservation(null)
  }, [])

  // 이메일 미리보기 모달 열기 - useCallback으로 메모이제이션
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

  // 이메일 실제 발송 함수 - useCallback으로 메모이제이션
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
        // 예약 확인 이메일
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
        // 투어 출발 확정 이메일
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
        // 픽업 notification 이메일
        if (!emailPreviewData.pickupTime || !emailPreviewData.tourDate) {
          throw new Error('픽업 시간과 투어 날짜가 필요합니다.')
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
        throw new Error(data.error || '이메일 발송에 실패했습니다.')
      }

      alert(t('messages.emailSendSuccess'))
      setShowEmailPreview(false)
      setEmailPreviewData(null)
    } catch (error) {
      console.error('이메일 발송 오류:', error)
      alert(error instanceof Error ? error.message : t('messages.emailSendError'))
    } finally {
      setSendingEmail(null)
    }
  }, [emailPreviewData, customers, reservations, user?.email])

  // 픽업 시간 수정 모달 열기
  const handlePickupTimeClick = useCallback((reservation: Reservation, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedReservationForPickupTime(reservation)
    setPickupTimeValue(reservation.pickUpTime || '')
    setShowPickupTimeModal(true)
  }, [])

  // 픽업 시간 저장
  const handleSavePickupTime = useCallback(async () => {
    if (!selectedReservationForPickupTime) return

    try {
      const { error } = await (supabase as any)
        .from('reservations')
        .update({ pickup_time: pickupTimeValue || null })
        .eq('id', selectedReservationForPickupTime.id)

      if (error) {
        console.error('픽업 시간 업데이트 오류:', error)
        alert(t('messages.pickupTimeUpdateError'))
        return
      }

      // 자동 알림 발송은 제거 (일괄 발송 버튼 사용)

      await refreshReservations()
      setShowPickupTimeModal(false)
      setSelectedReservationForPickupTime(null)
    } catch (error) {
      console.error('픽업 시간 저장 오류:', error)
      alert(t('messages.pickupTimeSaveError'))
    }
  }, [selectedReservationForPickupTime, pickupTimeValue, refreshReservations])

  // 픽업 호텔 수정 모달 열기
  const handlePickupHotelClick = useCallback((reservation: Reservation, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedReservationForPickupHotel(reservation)
    setHotelSearchTerm('')
    setShowPickupHotelModal(true)
  }, [])

  // 픽업 호텔 저장
  const handleSavePickupHotel = useCallback(async (hotelId: string) => {
    if (!selectedReservationForPickupHotel) return

    try {
      const { error } = await (supabase as any)
        .from('reservations')
        .update({ pickup_hotel: hotelId || null })
        .eq('id', selectedReservationForPickupHotel.id)

      if (error) {
        console.error('픽업 호텔 업데이트 오류:', error)
        alert(t('messages.pickupHotelUpdateError'))
        return
      }

      await refreshReservations()
      setShowPickupHotelModal(false)
      setSelectedReservationForPickupHotel(null)
      setHotelSearchTerm('')
    } catch (error) {
      console.error('픽업 호텔 저장 오류:', error)
      alert(t('messages.pickupHotelSaveError'))
    }
  }, [selectedReservationForPickupHotel, refreshReservations])

  // 필터된 호텔 목록
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

  // 고객 언어 가져오기
  const getCustomerLanguage = useCallback((customerId: string) => {
    const customer = (customers as Customer[]).find(c => c.id === customerId)
    return customer?.language || 'ko'
  }, [customers])

  // 국가 코드 가져오기
  const getCountryCode = useCallback((language: string) => {
    const lang = language.toLowerCase()
    if (lang === 'kr' || lang === 'ko' || lang === '한국어') return 'KR'
    if (lang === 'en' || lang === '영어') return 'US'
    if (lang === 'jp' || lang === '일본어') return 'JP'
    if (lang === 'cn' || lang === '중국어') return 'CN'
    return 'US'
  }, [])

  // 예약 관련 핸들러 함수들 - useCallback으로 메모이제이션
  const handlePaymentClick = useCallback((reservation: Reservation) => {
    setSelectedReservationForPayment(reservation)
    setShowPaymentRecords(true)
  }, [])

  const handleDetailClick = useCallback((reservation: Reservation) => {
    setSelectedReservationForDetail(reservation)
    setShowReservationDetailModal(true)
  }, [])

  const handleReviewClick = useCallback((reservation: Reservation) => {
    setSelectedReservationForReview(reservation)
    setShowReviewModal(true)
  }, [])

  const handleEditClick = useCallback((reservationId: string) => {
    router.push(`/${locale}/admin/reservations/${reservationId}`)
  }, [router, locale])

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

  // 검색어 지우기 핸들러 - useCallback으로 메모이제이션
  const handleClearSearch = useCallback(() => {
    setSearchTerm('')
    setDebouncedSearchTerm('')
  }, [])

  const handleDeleteReservation = useCallback(async (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      try {
        const { error } = await supabase
          .from('reservations')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting reservation:', error)
          alert(t('messages.reservationDeleteError') + error.message)
          return
        }

        // 성공 시 예약 목록 새로고침
        await refreshReservations()
        alert(t('messages.reservationDeleted'))
      } catch (error) {
        console.error('Error deleting reservation:', error)
        alert(t('messages.reservationDeleteErrorGeneric'))
      }
    }
  }, [t, refreshReservations])

  // 고객 추가 함수
  const handleAddCustomer = useCallback(async (customerData: Database['public']['Tables']['customers']['Insert']) => {
    try {
      // 라스베가스 시간대의 오늘 날짜를 ISO 문자열로 생성
      const getLasVegasToday = () => {
        const now = new Date()
        // 라스베가스 시간대의 현재 날짜를 가져옴
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
        
        // 라스베가스 시간대의 오늘 날짜 자정(00:00:00)을 UTC로 변환
        // 라스베가스 시간대의 특정 날짜/시간에 대한 UTC 오프셋을 계산하기 위해
        // 먼저 임시로 UTC로 해석된 Date 객체를 만들고, 그 시각을 라스베가스 시간대로 포맷팅하여 오프셋 계산
        const tempUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)) // 정오를 사용하여 DST 문제 방지
        
        // 그 UTC 시간을 라스베가스 시간대로 변환하여 오프셋 계산
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
        
        // 라스베가스 시간대의 날짜/시간을 나타내는 Date 객체 생성 (로컬 시간대로 해석)
        const lasVegasTime = new Date(lvYear, lvMonth - 1, lvDay, lvHour, lvMinute, lvSecond)
        
        // 오프셋 계산 (밀리초 단위)
        // tempUTC는 UTC 시간이고, lasVegasTime은 그 UTC 시간을 라스베가스 시간대로 변환한 것
        // 따라서 오프셋은 tempUTC - lasVegasTime (라스베가스가 UTC보다 느리므로)
        const offsetMs = tempUTC.getTime() - lasVegasTime.getTime()
        
        // 라스베가스 시간대의 오늘 날짜 자정(00:00:00)을 UTC로 변환
        // 라스베가스 시간대의 날짜/시간을 나타내는 Date 객체 생성
        const lasVegasDateLocal = new Date(year, month - 1, day, 0, 0, 0)
        const utcDate = new Date(lasVegasDateLocal.getTime() + offsetMs)
        
        return utcDate.toISOString()
      }
      
      // created_at을 라스베가스 시간대의 오늘 날짜로 설정
      const customerDataWithDate = {
        ...customerData,
        created_at: getLasVegasToday()
      }
      
      // Supabase에 저장
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

      // 성공 시 고객 목록 새로고침
      await refreshCustomers()
      setShowCustomerForm(false)
      alert(t('messages.customerAdded'))
      
      // 새로 추가된 고객을 자동으로 선택 (예약 폼이 열려있는 경우)
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

  // 로딩 화면
  if (loading) {
    return <ReservationsLoadingSpinner loadingProgress={loadingProgress} />
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 - 모바일 최적화 */}
      <ReservationsHeader
        customerIdFromUrl={customerIdFromUrl}
        customers={(customers as Customer[]) || []}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchTerm={searchTerm}
        onSearchChange={(term) => {
          setSearchTerm(term)
          setCurrentPage(1) // 검색 시 첫 페이지로 이동
        }}
        onAddReservation={() => {
          // 새 예약 ID 생성
          const newId = crypto.randomUUID()
          setNewReservationId(newId)
          setShowAddForm(true)
          console.log('새 예약 모달 오픈, 예약 ID 생성:', newId)
        }}
        onActionRequired={() => setShowActionRequiredModal(true)}
        actionRequiredCount={actionRequiredCount}
        onOpenFilter={() => setFilterModalOpen(true)}
      />

      {/* 모바일 전용: 검색창(넓게) + 필터 버튼(추가 버튼과 동일 크기) */}
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
          <span>필터</span>
        </button>
      </div>

      {/* 필터 버튼(데스크톱) + 필터 모달 */}
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
          setGroupByDate(true) // 그룹화 상태도 초기화
          setCurrentPage(1)
          setCurrentWeek(0) // 주간 페이지네이션도 현재 주로 초기화
        }}
      />

      {/* 주간 페이지네이션 및 통계 통합 패널 - 날짜별 그룹화가 활성화된 경우에만 표시 */}
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

      {/* 결과 정보 */}
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

      {/* 예약 목록 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      ) : viewMode === 'calendar' ? (
        /* 달력뷰 */
        <ReservationCalendar 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reservations={calendarReservations as any} 
          onReservationClick={handleCalendarReservationClick}
        />
      ) : (
          /* 카드뷰 */
          <>
            {filteredReservations.length === 0 ? (
              /* 검색 결과가 없을 때 안내 메시지 */
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
          /* 날짜별 그룹화된 카드뷰 */
          <div className="space-y-8">
            {Object.keys(groupedReservations).length === 0 ? (
              /* 예약이 없을 때 안내 메시지 */
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
                    {/* 등록일 헤더 */}
                    <DateGroupHeader
                      date={date}
                      reservations={reservations as Reservation[]}
                      isCollapsed={collapsedGroups.has(date)}
                      onToggleCollapse={handleToggleCollapse}
                      customers={(customers as Array<{ id: string; name?: string }>) || []}
                      products={(products as Array<{ id: string; name: string }>) || []}
                      channels={(channels as Array<{ id: string; name: string; favicon_url?: string }>) || []}
                    />
                  
                  {/* 해당 날짜의 예약 카드들 (항상 표시) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {reservations.map((reservation) => (
                      <ReservationCardItem
                        key={`${reservation.id}-${tourInfoMap.size}`}
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
                        showResidentStatusIcon={false}
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
          /* 일반 카드뷰 - 그룹화된 카드뷰와 동일한 구조 사용 */
          paginatedReservations.length === 0 ? (
            /* 예약이 없을 때 안내 메시지 */
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
                    key={`${reservation.id}-${tourInfoMap.size}`}
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
                    showResidentStatusIcon={false}
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
      
      {/* 페이지네이션 - 카드뷰에서만 표시 (그룹화되지 않은 경우에만) */}
      {!groupByDate && totalPages > 1 && (
        <ReservationsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredReservations.length}
          onPageChange={setCurrentPage}
        />
      )}

      {/* 예약 추가/편집 모달 */}
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
          onCancel={() => {
            setShowAddForm(false)
            setNewReservationId(null)
            setEditingReservation(null)
          }}
          onRefreshCustomers={refreshCustomers}
          onDelete={handleDeleteReservation}
          layout="modal"
          allowPastDateEdit={isSuper}
        />
      )}

      {/* 고객 추가 모달 */}
      {showCustomerForm && (
        <CustomerForm
          customer={null}
          channels={channels || []}
          onSubmit={handleAddCustomer}
          onCancel={() => setShowCustomerForm(false)}
        />
      )}

      {/* 고객 수정 모달 */}
      {editingCustomer && (
        <CustomerForm
          customer={editingCustomer}
          channels={channels || []}
          onSubmit={async (customerData) => {
            try {
              // Supabase에 고객 정보 업데이트
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

              // 성공 시 고객 목록 새로고침
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

                // 성공 시 고객 목록 새로고침
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

      {/* 가격 정보 모달 */}
      <PricingInfoModal
        reservation={pricingModalReservation}
        isOpen={showPricingModal}
        onClose={handleClosePricingModal}
      />

      {/* 입금 내역 모달 */}
      {showPaymentRecords && selectedReservationForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                입금 내역 관리 - {getCustomerName(selectedReservationForPayment.customerId, (customers as Customer[]) || [])}
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

      {/* 예약 처리 필요 모달 */}
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
        onStatusChange={handleStatusChange}
        generatePriceCalculation={generatePriceCalculation}
        getGroupColorClasses={getGroupColorClasses}
        getSelectedChoicesFromNewSystem={getSelectedChoicesNormalized}
        choicesCacheRef={choicesCacheRef}
        emailDropdownOpen={emailDropdownOpen}
        sendingEmail={sendingEmail}
      />

      {/* 픽업 시간 수정 모달 */}
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
          onCancel={() => {
            setShowPickupTimeModal(false)
            setSelectedReservationForPickupTime(null)
            setPickupTimeValue('')
          }}
          getCustomerName={(customerId: string) => getCustomerName(customerId, (customers as Customer[]) || [])}
          getCustomerLanguage={getCustomerLanguage}
          getPickupHotelName={(hotelId: string) => getPickupHotelDisplay(hotelId, pickupHotels || [])}
          getCountryCode={getCountryCode}
        />
      )}

      {/* 픽업 호텔 수정 모달 */}
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
          onCancel={() => {
            setShowPickupHotelModal(false)
            setSelectedReservationForPickupHotel(null)
            setHotelSearchTerm('')
          }}
          getCustomerName={(customerId: string) => getCustomerName(customerId, (customers as Customer[]) || [])}
        />
      )}

      {/* 이메일 미리보기 모달 */}
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

      {/* 이메일 발송 내역 모달 */}
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

      {/* 예약 상세 모달 (고객 보기) */}
      {showReservationDetailModal && selectedReservationForDetail && (() => {
        // 고객의 언어를 가져와서 locale로 변환
        const customer = (customers as Customer[]).find(c => c.id === selectedReservationForDetail.customerId)
        const customerLanguage = customer?.language
        // 고객 언어를 locale 형식으로 변환 ('EN' 또는 'en' -> 'en', 그 외 -> 'ko')
        const customerLocale = customerLanguage && 
          (customerLanguage.toLowerCase() === 'en' || customerLanguage === 'EN' || customerLanguage === '영어') 
          ? 'en' 
          : 'ko'
        
        return (
          <ResizableModal
            isOpen={showReservationDetailModal}
            onClose={() => {
              setShowReservationDetailModal(false)
              setSelectedReservationForDetail(null)
            }}
            title={`고객 예약 상세 - ${getCustomerName(selectedReservationForDetail.customerId, (customers as Customer[]) || [])}`}
            initialHeight={typeof window !== 'undefined' ? window.innerHeight * 0.9 : 600}
            onHeightChange={() => {}}
          >
            <iframe
              src={`/${customerLocale}/dashboard/reservations/${selectedReservationForDetail.customerId}/${selectedReservationForDetail.id}`}
              className="w-full h-full border-0"
              title="예약 상세 정보"
            />
          </ResizableModal>
        )
      })()}

      {/* 후기 관리 모달 */}
      {showReviewModal && selectedReservationForReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-semibold text-gray-900">후기 관리</h2>
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
    </div>
  )
}
