'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Plus, Search, Calendar, MapPin, Users, Grid3X3, CalendarDays, DollarSign, Eye, X, GripVertical, Clock, Mail, ChevronDown, Edit, MessageSquare } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
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
import { useAuth } from '@/contexts/AuthContext'
import { 
  getPickupHotelDisplay, 
  getCustomerName, 
  getProductName, 
  getChannelName, 
  getStatusLabel, 
  getStatusColor, 
  calculateTotalPrice 
} from '@/utils/reservationUtils'
import { ResidentStatusIcon } from '@/components/reservation/ResidentStatusIcon'
import type { 
  Customer, 
  Reservation
} from '@/types/reservation'

interface AdminReservationsProps {
  params: Promise<{ locale: string }>
}

export default function AdminReservations({ }: AdminReservationsProps) {
  const t = useTranslations('reservations')
  const { user } = useAuth()
  
  // 초이스 옵션별 색상 매핑 함수 (옵션 이름 기준으로 색상 결정)
  const getGroupColorClasses = (groupId: string, groupName?: string, optionName?: string) => {
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
  }

  // 새로운 초이스 시스템에서 선택된 옵션을 가져오는 함수
  const getSelectedChoicesFromNewSystem = useCallback(async (reservationId: string) => {
    try {
      // 마이그레이션 전/후 모두 지원: choice_group, option_key는 선택적
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

      if (error) {
        console.error('Error fetching reservation choices:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getSelectedChoicesFromNewSystem:', error)
      return []
    }
  }, [])

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

  // 새로운 초이스 시스템을 사용하는 Choices 표시 컴포넌트
  const ChoicesDisplay = React.memo(function ChoicesDisplay({ reservation }: { reservation: Reservation }) {
    const reservationId = reservation.id
    const [selectedChoices, setSelectedChoices] = useState<Array<{
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
    }>>(() => {
      // 초기값을 캐시에서 가져오기
      return choicesCacheRef.current.get(reservationId) || []
    })
    const [loading, setLoading] = useState(() => {
      // 캐시에 있으면 로딩 상태 false
      return !choicesCacheRef.current.has(reservationId)
    })

    useEffect(() => {
      // 캐시에 이미 있으면 캐시에서 가져오기
      if (choicesCacheRef.current.has(reservationId)) {
        const cachedChoices = choicesCacheRef.current.get(reservationId) || []
        if (cachedChoices.length > 0) {
          setSelectedChoices(cachedChoices)
          setLoading(false)
          return
        }
      }

      // 캐시에 없으면 로드
      const loadChoices = async () => {
        try {
          const choices = await getSelectedChoicesFromNewSystem(reservationId)
          // 캐시에 저장
          choicesCacheRef.current.set(reservationId, choices)
          setSelectedChoices(choices)
        } catch (error) {
          console.error('Error loading choices:', error)
        } finally {
          setLoading(false)
        }
      }
      
      setLoading(true)
      loadChoices()
    }, [reservationId])

    // 로딩 중이고 데이터가 없을 때만 null 반환
    if (loading && selectedChoices.length === 0) {
      return null
    }

    if (selectedChoices.length === 0) {
      return null
    }

    return (
      <>
        {selectedChoices.map((choice, index) => {
          const optionName = choice.choice_options?.option_name_ko || choice.choice_options?.option_name || 'Unknown'
          const groupName = choice.choice_options?.product_choices?.choice_group_ko || 'Unknown'
          const badgeClass = getGroupColorClasses(choice.choice_id, groupName, optionName)
          
          return (
            <span key={`${choice.choice_id}-${choice.option_id}-${index}`} className={badgeClass}>
              ✓ {optionName}
            </span>
          )
        })}
      </>
    )
  }, (prevProps, nextProps) => {
    // 메모이제이션 비교: reservation.id만 비교
    return prevProps.reservation.id === nextProps.reservation.id
  })

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
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState<boolean>(true) // 필터 접힘/펼침 상태 (기본 접힘)

  // 그룹 접기/펼치기 함수
  const toggleGroupCollapse = (date: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(date)) {
        newSet.delete(date)
      } else {
        newSet.add(date)
      }
      return newSet
    })
  }

  // 주간 통계 아코디언 상태 (기본 접힘)
  const [isWeeklyStatsCollapsed, setIsWeeklyStatsCollapsed] = useState(true)

  // 입금 내역 관련 상태
  const [showPaymentRecords, setShowPaymentRecords] = useState(false)
  const [selectedReservationForPayment, setSelectedReservationForPayment] = useState<Reservation | null>(null)

  // 예약 상세 모달 관련 상태
  const [showReservationDetailModal, setShowReservationDetailModal] = useState(false)
  const [selectedReservationForDetail, setSelectedReservationForDetail] = useState<Reservation | null>(null)

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
    status: string
    guideName: string
    assistantName: string
    vehicleName: string
    tourDate: string
    tourStartDatetime: string | null
    isAssigned: boolean
    reservationIds: string[]
  }>>(new Map())

  // reservation_pricing 데이터 상태 (계산식 표시를 위한 모든 필드 포함)
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

  // Net Price 계산식 생성 함수
  const generatePriceCalculation = (reservation: any, pricing: any): string => {
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
  }

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

  // 투어 정보 가져오기
  useEffect(() => {
    const fetchTourInfo = async () => {
      if (!reservations.length) return

      // reservations에서 tour_id가 있는 예약들을 직접 확인
      const tourIds = new Set<string>()
      const reservationsWithTourId = reservations.filter(r => {
        // tourId 또는 직접 tour_id 확인
        const tourId = r.tourId || (r as any).tour_id
        return tourId && tourId.trim() !== '' && tourId !== 'null' && tourId !== 'undefined'
      })
      
      reservationsWithTourId.forEach(reservation => {
        const tourId = reservation.tourId || (reservation as any).tour_id
        if (tourId && tourId.trim() !== '') {
          tourIds.add(tourId.trim())
        }
      })

      console.log('투어 ID 수집:', { 
        totalReservations: reservations.length,
        reservationsWithTourId: reservationsWithTourId.length,
        tourIdsCount: tourIds.size, 
        tourIds: Array.from(tourIds),
        sampleReservations: reservationsWithTourId.slice(0, 3).map(r => ({
          id: r.id,
          tourId: r.tourId,
          tour_id: (r as any).tour_id
        }))
      })

      if (tourIds.size === 0) {
        console.log('투어 ID가 없어서 투어 정보를 가져오지 않습니다.')
        setTourInfoMap(new Map()) // 빈 맵으로 초기화
        return
      }

      try {
        // 연결된 투어를 투어 상태, 배정 상태와 상관없이 모두 가져옴
        // Supabase의 .in() 쿼리는 기본적으로 1000개 제한이 있으므로 청크로 나눠서 조회
        const tourIdsArray = Array.from(tourIds)
        const chunkSize = 1000 // 한 번에 1000개씩 조회
        const allTours: any[] = []

        // 투어 ID를 청크로 나눠서 여러 번 조회
        for (let i = 0; i < tourIdsArray.length; i += chunkSize) {
          const chunk = tourIdsArray.slice(i, i + chunkSize)
          
          const { data: toursChunk, error: chunkError } = await supabase
            .from('tours')
            .select('id, tour_status, tour_guide_id, assistant_id, reservation_ids, tour_car_id, tour_date, tour_start_datetime')
            .in('id', chunk)
            // 상태 필터링 없음 - 모든 상태의 투어 표시

          if (chunkError) {
            console.error(`투어 정보 조회 오류 (청크 ${i / chunkSize + 1}):`, chunkError)
            continue // 오류가 발생해도 다음 청크는 계속 조회
          }

          if (toursChunk) {
            allTours.push(...toursChunk)
          }
        }

        console.log('투어 정보 조회 성공:', { 
          totalTourIds: tourIdsArray.length,
          toursCount: allTours.length, 
          chunks: Math.ceil(tourIdsArray.length / chunkSize)
        })

        const tours = allTours

        const newTourInfoMap = new Map<string, {
          totalPeople: number
          status: string
          guideName: string
          assistantName: string
          vehicleName: string
          tourDate: string
          tourStartDatetime: string | null
          isAssigned: boolean
          reservationIds: string[]
        }>()

        // 모든 가이드 이메일과 어시스턴트 이메일 수집
        const guideEmails = new Set<string>()
        const assistantEmails = new Set<string>()
        const vehicleIds = new Set<string>()
        
        tours?.forEach(tour => {
          if (tour.tour_guide_id) guideEmails.add(tour.tour_guide_id)
          if (tour.assistant_id) assistantEmails.add(tour.assistant_id)
          if (tour.tour_car_id) vehicleIds.add(tour.tour_car_id)
        })

        // 가이드 정보 일괄 조회 (1000개 제한 대응)
        const guideMap = new Map<string, string>()
        if (guideEmails.size > 0) {
          const guideEmailsArray = Array.from(guideEmails)
          for (let i = 0; i < guideEmailsArray.length; i += chunkSize) {
            const chunk = guideEmailsArray.slice(i, i + chunkSize)
            const { data: guides } = await supabase
              .from('team')
              .select('email, name_ko')
              .in('email', chunk)
            
            if (guides) {
              guides.forEach((guide: { email: string; name_ko: string | null }) => {
                if (guide.email) {
                  guideMap.set(guide.email, guide.name_ko || '-')
                }
              })
            }
          }
        }

        // 어시스턴트 정보 일괄 조회 (1000개 제한 대응)
        const assistantMap = new Map<string, string>()
        if (assistantEmails.size > 0) {
          const assistantEmailsArray = Array.from(assistantEmails)
          for (let i = 0; i < assistantEmailsArray.length; i += chunkSize) {
            const chunk = assistantEmailsArray.slice(i, i + chunkSize)
            const { data: assistants } = await supabase
              .from('team')
              .select('email, name_ko')
              .in('email', chunk)
            
            if (assistants) {
              assistants.forEach((assistant: { email: string; name_ko: string | null }) => {
                if (assistant.email) {
                  assistantMap.set(assistant.email, assistant.name_ko || '-')
                }
              })
            }
          }
        }

        // 차량 정보 일괄 조회 (1000개 제한 대응)
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

        // 각 투어에 대해 정보 매핑
        for (const tour of tours || []) {
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

          // 총 인원 계산 및 reservation_ids 저장
          let reservationIds: string[] = []
          if (tour.reservation_ids) {
            reservationIds = Array.isArray(tour.reservation_ids)
              ? tour.reservation_ids
              : String(tour.reservation_ids).split(',').map((id: string) => id.trim()).filter((id: string) => id)
            
            // reservation_ids에 있는 예약들의 total_people 합계 계산 (취소된 예약 제외)
            totalPeople = reservationIds.reduce((sum: number, id: string) => {
              const reservation = reservations.find(r => r.id === id)
              if (!reservation) return sum
              
              // 취소된 예약은 제외
              const statusLower = reservation.status?.toLowerCase() || ''
              if (statusLower === 'cancelled' || statusLower === 'canceled') {
                return sum
              }
              
              return sum + (reservation.totalPeople || 0)
            }, 0)
          }

          newTourInfoMap.set(tour.id, {
            totalPeople,
            status: tour.tour_status || '-',
            guideName,
            assistantName,
            vehicleName,
            tourDate: tour.tour_date || '',
            tourStartDatetime: tour.tour_start_datetime || null,
            isAssigned: true, // tour_id가 있으면 배정된 것으로 간주
            reservationIds: reservationIds
          })
        }

        console.log('투어 정보 맵 생성 완료:', { mapSize: newTourInfoMap.size, mapEntries: Array.from(newTourInfoMap.entries()) })
        setTourInfoMap(newTourInfoMap)
      } catch (error) {
        console.error('투어 정보 조회 중 오류:', error)
      }
    }

    fetchTourInfo()
  }, [reservations])

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

  // reservation_pricing 데이터 가져오기 (성능 최적화: 페이지네이션된 reservation만)
  useEffect(() => {
    const fetchReservationPricing = async () => {
      // 페이지네이션된 reservation만 가져오기 (성능 최적화)
      if (!paginatedReservations.length) return

      try {
        // 현재 페이지의 reservation ID만 가져오기
        const reservationIds = paginatedReservations.map(r => r.id)
        if (reservationIds.length === 0) return
        
        // URL 길이 제한을 피하기 위해 청크 단위로 나눠서 요청
        const chunkSize = 50 // 청크 크기 줄임 (성능 최적화)
        const pricingMap = new Map<string, {
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
        }>()

        // 청크 단위로 나눠서 요청
        for (let i = 0; i < reservationIds.length; i += chunkSize) {
          const chunk = reservationIds.slice(i, i + chunkSize)
          
          const { data: pricingData, error } = await supabase
            .from('reservation_pricing')
            .select('reservation_id, total_price, balance_amount, adult_product_price, child_product_price, infant_product_price, product_price_total, coupon_discount, additional_discount, additional_cost, commission_percent, commission_amount')
            .in('reservation_id', chunk)

          if (error) {
            console.error('reservation_pricing 조회 오류:', error)
            continue // 다음 청크 계속 처리
          }

          if (pricingData) {
            pricingData.forEach((p: {
              reservation_id: string
              total_price: number | null
              balance_amount: number | null
              adult_product_price: number | null
              child_product_price: number | null
              infant_product_price: number | null
              product_price_total: number | null
              coupon_discount: number | null
              additional_discount: number | null
              additional_cost: number | null
              commission_percent: number | null
              commission_amount: number | null
            }) => {
              const toNumber = (val: number | null | undefined): number => {
                if (val === null || val === undefined) return 0
                if (typeof val === 'string') return parseFloat(val) || 0
                return val || 0
              }
              
              pricingMap.set(p.reservation_id, {
                total_price: toNumber(p.total_price),
                balance_amount: toNumber(p.balance_amount),
                adult_product_price: toNumber(p.adult_product_price),
                child_product_price: toNumber(p.child_product_price),
                infant_product_price: toNumber(p.infant_product_price),
                product_price_total: toNumber(p.product_price_total),
                coupon_discount: toNumber(p.coupon_discount),
                additional_discount: toNumber(p.additional_discount),
                additional_cost: toNumber(p.additional_cost),
                commission_percent: toNumber(p.commission_percent),
                commission_amount: toNumber(p.commission_amount),
                currency: 'USD' // 기본값 USD (currency 컬럼이 없으므로)
              })
            })
          }
        }

        setReservationPricingMap(pricingMap)
      } catch (error) {
        console.error('reservation_pricing 로드 오류:', error)
      }
    }

    fetchReservationPricing()
  }, [paginatedReservations])

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
      alert('예약 ID가 없습니다. 모달을 다시 열어주세요.')
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
        alert('예약 추가 중 오류가 발생했습니다: ' + error.message)
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
                if (choice.choice_id && choice.option_id) {
                  choicesToSave.push({
                    reservation_id: reservationId,
                    choice_id: choice.choice_id,
                    option_id: choice.option_id,
                    quantity: choice.quantity || 1,
                    total_price: choice.total_price || 0
                  })
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
              if (choice.choice_id && choice.option_id) {
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
              alert('초이스 저장 중 오류가 발생했습니다: ' + choicesError.message)
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
            alert('가격 정보 저장 중 오류가 발생했습니다: ' + pricingError.message)
          } else {
            console.log('reservation_pricing 생성 성공:', pricingId, insertedPricing)
          }
        } catch (pricingError) {
          console.error('reservation_pricing 생성 중 예외:', pricingError)
          console.error('예외 스택:', (pricingError as Error).stack)
          alert('가격 정보 저장 중 예외가 발생했습니다: ' + (pricingError as Error).message)
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
      alert('예약이 성공적으로 추가되었습니다!')
    } catch (error) {
      console.error('handleAddReservation: 예약 추가 중 오류:', error)
      console.error('오류 스택:', (error as Error).stack)
      alert('예약 추가 중 오류가 발생했습니다: ' + ((error as Error).message || '알 수 없는 오류'))
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
        if (reservation.choices && reservation.choices.required && Array.isArray(reservation.choices.required)) {
          try {
            // 기존 reservation_choices 삭제
            await supabase
              .from('reservation_choices')
              .delete()
              .eq('reservation_id', editingReservation.id)

            // option_id가 choice_options 테이블에 존재하는지 검증
            const validChoices = []
            for (const choice of reservation.choices.required) {
              if (!choice.option_id) {
                console.warn('option_id가 없는 choice 건너뛰기:', choice)
                continue
              }

              // choice_options 테이블에서 option_id 존재 여부 확인
              const { data: optionExists, error: checkError } = await supabase
                .from('choice_options')
                .select('id')
                .eq('id', choice.option_id)
                .maybeSingle()

              if (checkError) {
                console.error('choice_options 확인 오류:', checkError)
                continue
              }

              if (!optionExists) {
                console.warn(`option_id ${choice.option_id}가 choice_options 테이블에 존재하지 않습니다. 건너뜁니다.`)
                continue
              }

              validChoices.push({
                reservation_id: editingReservation.id,
                choice_id: choice.choice_id,
                option_id: choice.option_id,
                quantity: choice.quantity || 1,
                total_price: choice.total_price || 0
              })
            }

            if (validChoices.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error: choicesError } = await (supabase as any)
                .from('reservation_choices')
                .insert(validChoices)

              if (choicesError) {
                console.error('초이스 저장 오류:', choicesError)
                alert('초이스 저장 중 오류가 발생했습니다: ' + choicesError.message)
                return
              }
            }
          } catch (choicesError) {
            console.error('초이스 저장 중 예외:', choicesError)
            alert('초이스 저장 중 오류가 발생했습니다.')
            return
          }
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
            commission_percent: pricingInfo.commission_percent || 0
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

  // 투어 생성 함수
  const handleCreateTour = async (reservation: Reservation) => {
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
  }

  // 달력뷰에서 예약 클릭 시 편집 모달 열기
  const handleCalendarReservationClick = (calendarReservation: { id: string }) => {
    const originalReservation = reservations.find(r => r.id === calendarReservation.id)
    if (originalReservation) {
      setEditingReservation(originalReservation)
    }
  }

  // 가격 정보 모달 열기
  const handlePricingInfoClick = (reservation: Reservation) => {
    setPricingModalReservation(reservation)
    setShowPricingModal(true)
  }

  // 가격 정보 모달 닫기
  const handleClosePricingModal = () => {
    setShowPricingModal(false)
    setPricingModalReservation(null)
  }

  // 이메일 미리보기 모달 열기
  const handleOpenEmailPreview = (reservation: Reservation, emailType: 'confirmation' | 'departure' | 'pickup') => {
    const customer = (customers as Customer[]).find(c => c.id === reservation.customerId)
    if (!customer?.email) {
      alert('고객 이메일 주소가 없습니다.')
      return
    }

    if (emailType === 'pickup' && (!reservation.pickUpTime || !reservation.tourDate)) {
      alert('픽업 시간과 투어 날짜가 필요합니다.')
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
  }

  // 이메일 실제 발송 함수
  const handleSendEmailFromPreview = async () => {
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

      alert('이메일이 성공적으로 발송되었습니다.')
      setShowEmailPreview(false)
      setEmailPreviewData(null)
    } catch (error) {
      console.error('이메일 발송 오류:', error)
      alert(error instanceof Error ? error.message : '이메일 발송 중 오류가 발생했습니다.')
    } finally {
      setSendingEmail(null)
    }
  }

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
        alert('픽업 시간 업데이트 중 오류가 발생했습니다.')
        return
      }

      // 자동 알림 발송은 제거 (일괄 발송 버튼 사용)

      await refreshReservations()
      setShowPickupTimeModal(false)
      setSelectedReservationForPickupTime(null)
    } catch (error) {
      console.error('픽업 시간 저장 오류:', error)
      alert('픽업 시간 저장 중 오류가 발생했습니다.')
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
        alert('픽업 호텔 업데이트 중 오류가 발생했습니다.')
        return
      }

      await refreshReservations()
      setShowPickupHotelModal(false)
      setSelectedReservationForPickupHotel(null)
      setHotelSearchTerm('')
    } catch (error) {
      console.error('픽업 호텔 저장 오류:', error)
      alert('픽업 호텔 저장 중 오류가 발생했습니다.')
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

  const handleDeleteReservation = useCallback(async (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      try {
        const { error } = await supabase
          .from('reservations')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting reservation:', error)
          alert('예약 삭제 중 오류가 발생했습니다: ' + error.message)
          return
        }

        // 성공 시 예약 목록 새로고침
        await refreshReservations()
        alert('예약이 성공적으로 삭제되었습니다!')
      } catch (error) {
        console.error('Error deleting reservation:', error)
        alert('예약 삭제 중 오류가 발생했습니다.')
      }
    }
  }, [t, refreshReservations])

  // 고객 추가 함수
  const handleAddCustomer = useCallback(async (customerData: Database['public']['Tables']['customers']['Insert']) => {
    try {
      // Supabase에 저장
      const { data, error } = await supabase
        .from('customers')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(customerData as any)
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
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('loadingReservationData')}</h3>
            {loadingProgress.total > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  {loadingProgress.current} / {loadingProgress.total} {t('reservationsLoading')}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round((loadingProgress.current / loadingProgress.total) * 100)}% {t('completed')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 - 모바일 최적화 */}
      <div className="space-y-4">
        {/* 첫 번째 줄: 타이틀과 액션 버튼들 */}
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex-shrink-0">
              {customerIdFromUrl ? (
                <div className="flex items-center space-x-2">
                  <span>{t('title')}</span>
                  <span className="text-lg text-gray-500">-</span>
                  <span className="text-lg text-blue-600">
                    {getCustomerName(customerIdFromUrl, (customers as Customer[]) || [])}
                  </span>
                </div>
              ) : (
                t('title')
              )}
            </h1>
            
            {/* 뷰 전환 버튼 - 제목 바로 오른쪽에 배치 */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setViewMode('card')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors text-xs ${
                  viewMode === 'card' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Grid3X3 className="w-3 h-3" />
                <span className="hidden sm:inline">카드</span>
              </button>
              <button
                onClick={() => {
                  setViewMode('calendar')
                }}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors text-xs ${
                  viewMode === 'calendar' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <CalendarDays className="w-3 h-3" />
                <span className="hidden sm:inline">달력</span>
              </button>
            </div>
          </div>
          
          {/* 검색창과 새예약 추가 버튼 */}
          <div className="flex items-center space-x-2 flex-1 max-w-xs">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1) // 검색 시 첫 페이지로 이동
                }}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
              />
            </div>
            <button
              onClick={() => {
                // 새 예약 ID 생성
                const newId = crypto.randomUUID()
                setNewReservationId(newId)
                setShowAddForm(true)
                console.log('새 예약 모달 오픈, 예약 ID 생성:', newId)
              }}
              className="bg-blue-600 text-white px-2 sm:px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center space-x-1 text-xs sm:text-sm flex-shrink-0"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">{t('addReservation')}</span>
              <span className="sm:hidden">추가</span>
            </button>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="space-y-4">
        {/* 필터 접기/펼치기 버튼 */}
        <button
          onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
          className="flex items-center justify-between w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">필터</span>
          <ChevronDown 
            className={`w-4 h-4 text-gray-600 transition-transform ${isFiltersCollapsed ? '' : 'rotate-180'}`}
          />
        </button>

        {/* 고급 필터 - 모바일 최적화 */}
        {!isFiltersCollapsed && (
        <div className="space-y-3">
          {/* 첫 번째 줄: 상태, 채널, 시작일, 종료일 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setCurrentPage(1)
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
            >
              <option value="all">{t('filters.allStatus')}</option>
              <option value="pending">{t('filters.pending')}</option>
              <option value="confirmed">{t('filters.confirmed')}</option>
              <option value="completed">{t('filters.completed')}</option>
              <option value="cancelled">{t('filters.cancelled')}</option>
              <option value="recruiting">{t('filters.recruiting')}</option>
            </select>
            
            <select
              value={selectedChannel}
              onChange={(e) => {
                setSelectedChannel(e.target.value)
                setCurrentPage(1)
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
            >
              <option value="all">{t('filters.allChannel')}</option>
              {channels?.map((channel: { id: string; name: string }) => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </select>
            
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, start: e.target.value }))
                setCurrentPage(1)
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
              placeholder="시작일"
            />
            
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, end: e.target.value }))
                setCurrentPage(1)
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
              placeholder="종료일"
            />
          </div>
          
          {/* 두 번째 줄: 정렬, 그룹화, 페이지당, 초기화 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="flex items-center space-x-1">
              <label className="text-xs font-medium text-gray-700 whitespace-nowrap">{t('sorting.label')}</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'created_at' | 'tour_date' | 'customer_name' | 'product_name')}
                className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs flex-1"
              >
                <option value="created_at">{t('sorting.registrationDate')}</option>
                <option value="tour_date">{t('sorting.tourDate')}</option>
                <option value="customer_name">{t('sorting.customerName')}</option>
                <option value="product_name">{t('sorting.productName')}</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>

            <button
              onClick={() => setGroupByDate(!groupByDate)}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                groupByDate 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {groupByDate ? t('grouping.on') : t('grouping.off')}
            </button>
            
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs"
            >
              <option value={10}>10{t('pagination.itemsPerPage')}</option>
              <option value={20}>20{t('pagination.itemsPerPage')}</option>
              <option value={50}>50{t('pagination.itemsPerPage')}</option>
              <option value={100}>100{t('pagination.itemsPerPage')}</option>
            </select>
            
            <button
              onClick={() => {
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
              className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              {t('pagination.reset')}
            </button>
          </div>
        </div>
        )}
        
        {/* 주간 페이지네이션 및 통계 통합 패널 - 날짜별 그룹화가 활성화된 경우에만 표시 */}
        {groupByDate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg">
            {/* 주간 네비게이션 헤더 - 초컴팩트 모바일 최적화 */}
            <div className="p-2 sm:p-4 border-b border-blue-200">
              <div className="flex items-center justify-between">
                {/* 제목과 통계 정보 - 한 줄에 압축 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    <h3 className="text-sm sm:text-lg font-semibold text-blue-900 whitespace-nowrap">
                      {currentWeek === 0 ? '최근 7일' : 
                       currentWeek < 0 ? `${Math.abs(currentWeek) * 7}일 전` : 
                       `${currentWeek * 7}일 후`}
                    </h3>
                    <div className="text-xs sm:text-sm text-blue-700 whitespace-nowrap">
                      {formatWeekRange(currentWeek).display}
                    </div>
                  </div>
                  
                  {/* 통계 정보 - 한 줄에 압축 */}
                  <div className="mt-1 flex items-center space-x-3 text-xs">
                    <span className="text-blue-600">
                      <span className="font-semibold">{Object.keys(groupedReservations).length}일</span>
                    </span>
                    <span className="text-blue-600">
                      <span className="font-semibold">{Object.values(groupedReservations).flat().length}예약</span>
                    </span>
                    <span className="text-green-600">
                      <span className="font-semibold">{weeklyStats.totalPeople}{t('stats.people')}</span>
                    </span>
                    <span className="text-green-600">
                      <span className="font-semibold">{Math.round(weeklyStats.totalPeople / Math.max(Object.keys(groupedReservations).length, 1))}/일</span>
                    </span>
                  </div>
                </div>
                
                {/* 네비게이션 버튼들 - 초컴팩트 */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => {
                      setIsInitialLoad(false);
                      setCurrentWeek(prev => prev - 1);
                    }}
                    className="px-1.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50"
                  >
                    ←
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsInitialLoad(false);
                      setCurrentWeek(0);
                    }}
                    className={`px-1.5 py-1 text-xs font-medium rounded ${
                      currentWeek === 0 && !isInitialLoad
                        ? 'text-white bg-blue-600 border border-blue-600'
                        : 'text-blue-700 bg-white border border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    {t('pagination.thisWeek')}
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsInitialLoad(false);
                      setCurrentWeek(prev => prev + 1);
                    }}
                    className="px-1.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50"
                  >
                    →
                  </button>
                  
                  {/* 아코디언 화살표 */}
                  {weeklyStats.totalReservations > 0 && (
                    <button
                      onClick={() => setIsWeeklyStatsCollapsed(!isWeeklyStatsCollapsed)}
                      className="p-1 text-blue-500 hover:bg-blue-100 rounded transition-colors"
                    >
                      <svg 
                        className={`w-3 h-3 transition-transform ${isWeeklyStatsCollapsed ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 주간 통계 아코디언 - 초컴팩트 모바일 최적화 */}
            {weeklyStats.totalReservations > 0 && !isWeeklyStatsCollapsed && (
              <div className="p-2 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  {/* 상품별 인원 통계 */}
                  <div className="bg-white border border-blue-200 rounded p-2 sm:p-3 shadow-sm">
                    <h5 className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center">
                      <svg className="w-3 h-3 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      {t('stats.byProduct')}
                    </h5>
                    <div className="space-y-0.5">
                      {weeklyStats.productStats.slice(0, 3).map(([productName, count]) => (
                        <div key={productName} className="flex justify-between items-center py-0.5 px-1.5 bg-gray-50 rounded text-xs">
                          <span className="text-gray-700 truncate flex-1 mr-1 text-xs">{productName}</span>
                          <span className="font-semibold bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">
                            {count}{t('stats.people')}
                          </span>
                        </div>
                      ))}
                      {weeklyStats.productStats.length > 3 && (
                        <div className="text-xs text-gray-500 text-center py-0.5">
                          +{weeklyStats.productStats.length - 3}개
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 채널별 인원 통계 */}
                  <div className="bg-white border border-blue-200 rounded p-2 sm:p-3 shadow-sm">
                    <h5 className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center">
                      <svg className="w-3 h-3 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      {t('stats.byChannel')}
                    </h5>
                    <div className="space-y-0.5">
                      {weeklyStats.channelStats.slice(0, 3).map((channelInfo) => (
                        <div key={channelInfo.channelId} className="flex justify-between items-center py-0.5 px-1.5 bg-gray-50 rounded text-xs">
                          <div className="flex items-center space-x-1 flex-1 mr-1">
                            {channelInfo.favicon_url ? (
                              <Image 
                                src={channelInfo.favicon_url} 
                                alt={`${channelInfo.name} favicon`} 
                                width={12}
                                height={12}
                                className="rounded flex-shrink-0"
                                style={{ width: 'auto', height: 'auto' }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const parent = target.parentElement
                                  if (parent) {
                                    const fallback = document.createElement('div')
                                    fallback.className = 'h-3 w-3 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0'
                                    fallback.innerHTML = '🌐'
                                    parent.appendChild(fallback)
                                  }
                                }}
                              />
                            ) : (
                              <div className="h-3 w-3 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                                🌐
                              </div>
                            )}
                            <span className="text-gray-700 truncate text-xs">{channelInfo.name}</span>
                          </div>
                          <span className="font-semibold bg-green-100 text-green-800 px-1 py-0.5 rounded text-xs">
                            {channelInfo.count}{t('stats.people')}
                          </span>
                        </div>
                      ))}
                      {weeklyStats.channelStats.length > 3 && (
                        <div className="text-xs text-gray-500 text-center py-0.5">
                          +{weeklyStats.channelStats.length - 3}개
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 상태별 인원 통계 */}
                  <div className="bg-white border border-blue-200 rounded p-2 sm:p-3 shadow-sm">
                    <h5 className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center">
                      <svg className="w-3 h-3 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('stats.byStatus')}
                    </h5>
                    <div className="space-y-0.5">
                      {weeklyStats.statusStats.map(([status, count]) => (
                        <div key={status} className="flex justify-between items-center py-0.5 px-1.5 bg-gray-50 rounded text-xs">
                          <span className="text-gray-700 truncate flex-1 mr-1 text-xs">{getStatusLabel(status, t)}</span>
                          <span className="font-semibold bg-purple-100 text-purple-800 px-1 py-0.5 rounded text-xs">
                            {count}{t('stats.people')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
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
              Total {filteredReservations.length} {t('stats.reservations')} {startIndex + 1}-{Math.min(endIndex, filteredReservations.length)} {t('stats.more')} displayed
              {filteredReservations.length !== reservations.length && (
                <span className="ml-2 text-blue-600">
                  ({t('groupingLabels.filteredFromTotal')} {reservations.length} {t('stats.more')})
                </span>
              )}
            </>
          )}
        </div>
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
              <div className="text-center py-16">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                  <Grid3X3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {debouncedSearchTerm.trim() 
                      ? `"${debouncedSearchTerm}" 검색 결과가 없습니다`
                      : '선택한 조건에 예약이 없습니다'
                    }
                  </h3>
                  <p className="text-gray-500 mb-6">
                    {debouncedSearchTerm.trim() 
                      ? '다른 검색어를 입력하거나 필터 조건을 변경해보세요.'
                      : (dateRange.start && dateRange.end ? 
                          `${new Date(dateRange.start).toLocaleDateString('ko-KR')} ~ ${new Date(dateRange.end).toLocaleDateString('ko-KR')} 기간에 등록된 예약이 없습니다.` :
                          '현재 선택한 필터 조건에 해당하는 예약이 없습니다.')
                    }
                  </p>
                  {debouncedSearchTerm.trim() && (
                    <button
                      onClick={() => {
                        setSearchTerm('')
                        setDebouncedSearchTerm('')
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      검색어 지우기
                    </button>
                  )}
                </div>
              </div>
            ) : groupByDate ? (
          /* 날짜별 그룹화된 카드뷰 */
          <div className="space-y-8">
            {Object.keys(groupedReservations).length === 0 ? (
              /* 예약이 없을 때 안내 메시지 */
              <div className="text-center py-16">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                  <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">선택한 기간에 예약이 없습니다</h3>
                  <p className="text-gray-500 mb-6">
                    {dateRange.start && dateRange.end ? 
                      `${new Date(dateRange.start).toLocaleDateString('ko-KR')} ~ ${new Date(dateRange.end).toLocaleDateString('ko-KR')} 기간에 등록된 예약이 없습니다.` :
                      '현재 선택한 필터 조건에 해당하는 예약이 없습니다.'
                    }
                  </p>
                  <div className="space-y-2 text-sm text-gray-400">
                    <p>• 다른 날짜 범위를 선택해보세요</p>
                    <p>• 필터 조건을 변경해보세요</p>
                    <p>• 새로운 예약을 등록해보세요</p>
                  </div>
                </div>
              </div>
            ) : (
              Object.entries(groupedReservations).map(([date, reservations]) => (
              <div key={date} className="space-y-4">
                {/* 등록일 헤더 */}
                <div className="bg-gray-50 px-2 sm:px-4 py-2 sm:py-3 rounded-lg border border-gray-200">
                  <div 
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-100 rounded-lg p-1 sm:p-2 -m-1 sm:-m-2 transition-colors"
                    onClick={() => toggleGroupCollapse(date)}
                  >
                    <div className="flex items-center space-x-1 sm:space-x-3 flex-1 min-w-0">
                      <Calendar className="h-3 w-3 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                      <h3 className="text-xs sm:text-lg font-semibold text-gray-900 whitespace-nowrap">
                        {(() => {
                          // 날짜 문자열(YYYY-MM-DD)을 로컬 시간대 기준으로 파싱
                          const [year, month, day] = date.split('-').map(Number)
                          const dateObj = new Date(year, month - 1, day)
                          return dateObj.toLocaleDateString('ko-KR', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            weekday: 'long'
                          })
                        })()} {t('groupingLabels.registeredOn')}
                      </h3>
                      <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                        <span className="px-1 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-800 text-xs sm:text-sm font-medium rounded-full whitespace-nowrap">
                          {reservations.length}{t('stats.reservations')}
                        </span>
                        <span className="px-1 sm:px-2 py-0.5 sm:py-1 bg-green-100 text-green-800 text-xs sm:text-sm font-medium rounded-full whitespace-nowrap">
                          Total {reservations.reduce((total, reservation) => total + reservation.totalPeople, 0)} {t('stats.people')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <svg 
                        className={`w-3 h-3 sm:w-5 sm:h-5 text-gray-500 transition-transform ${collapsedGroups.has(date) ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* 상세 정보 (접혀있지 않을 때만 표시) */}
                  {!collapsedGroups.has(date) && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 상품별 인원 정보 */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          {t('stats.byProduct')} 인원
                        </h4>
                        <div className="space-y-2">
                          {(() => {
                            const productGroups = reservations.reduce((groups, reservation) => {
                              const productName = getProductName(reservation.productId, products || [])
                              if (!groups[productName]) {
                                groups[productName] = 0
                              }
                              groups[productName] += reservation.totalPeople
                              return groups
                            }, {} as Record<string, number>)
                            
                            return Object.entries(productGroups)
                              .sort(([,a], [,b]) => b - a)
                              .map(([productName, count]) => (
                                <div key={productName} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded">
                                  <span className="text-gray-700 text-sm truncate flex-1 mr-2">{productName}</span>
                                  <span className="font-semibold text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full min-w-0">
                                    {count}{t('stats.people')}
                                  </span>
                                </div>
                              ))
                          })()}
                        </div>
                      </div>
                      
                      {/* 채널별 인원 정보 */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          {t('stats.byChannel')} 인원
                        </h4>
                        <div className="space-y-2">
                          {(() => {
                            const channelGroups = reservations.reduce((groups, reservation) => {
                              const channelName = getChannelName(reservation.channelId, channels || [])
                              if (!groups[channelName]) {
                                groups[channelName] = 0
                              }
                              groups[channelName] += reservation.totalPeople
                              return groups
                            }, {} as Record<string, number>)
                            
                            return Object.entries(channelGroups)
                              .sort(([,a], [,b]) => b - a)
                              .map(([channelName, count]) => {
                      const channel = (channels as Array<{ id: string; name: string; favicon_url?: string }>)?.find(c => c.name === channelName)
                      const channelWithFavicon = channel as { favicon_url?: string; name?: string } | undefined
                                return (
                                  <div key={channelName} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded">
                                    <div className="flex items-center space-x-2 flex-1 mr-2 min-w-0">
                                      {channelWithFavicon?.favicon_url ? (
                                        <Image 
                                          src={channelWithFavicon.favicon_url} 
                                          alt={`${channelWithFavicon.name || 'Channel'} favicon`} 
                                          width={16}
                                          height={16}
                                          className="rounded flex-shrink-0"
                                          style={{ width: 'auto', height: 'auto' }}
                                          onError={(e) => {
                                            // 파비콘 로드 실패 시 기본 아이콘으로 대체
                                            const target = e.target as HTMLImageElement
                                            target.style.display = 'none'
                                            const parent = target.parentElement
                                            if (parent) {
                                              const fallback = document.createElement('div')
                                              fallback.className = 'h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0'
                                              fallback.innerHTML = '🌐'
                                              parent.appendChild(fallback)
                                            }
                                          }}
                                        />
                                      ) : (
                                        <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                                          🌐
                                        </div>
                                      )}
                                      <span className="text-gray-700 text-sm truncate">{channelName}</span>
                                    </div>
                                    <span className="font-semibold text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full min-w-0">
                                      {count}{t('stats.people')}
                                    </span>
                                  </div>
                                )
                              })
                          })()}
                        </div>
                      </div>
                      
                      {/* 상태별 인원 정보 */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {t('stats.byStatus')} 인원
                        </h4>
                        <div className="space-y-2">
                          {(() => {
                            const statusGroups = reservations.reduce((groups, reservation) => {
                              const status = reservation.status
                              if (!groups[status]) {
                                groups[status] = 0
                              }
                              groups[status] += reservation.totalPeople
                              return groups
                            }, {} as Record<string, number>)
                            
                            return Object.entries(statusGroups)
                              .sort(([,a], [,b]) => b - a)
                              .map(([status, count]) => (
                                <div key={status} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded">
                                  <span className="text-gray-700 text-sm truncate flex-1 mr-2">{getStatusLabel(status, t)}</span>
                                  <span className="font-semibold text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full min-w-0">
                                    {count}{t('stats.people')}
                                  </span>
                                </div>
                              ))
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 해당 날짜의 예약 카드들 (항상 표시) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 group"
            >
              {/* 카드 헤더 - 상태 표시 */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex justify-between items-start mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                    {getStatusLabel(reservation.status, t)}
                  </span>
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const channel = (channels as Array<{ id: string; name: string; favicon_url?: string }>)?.find(c => c.id === reservation.channelId)
                      const channelWithFavicon = channel as { favicon_url?: string; name?: string } | undefined
                      return (
                        <>
                          {channelWithFavicon?.favicon_url ? (
                            <Image 
                              src={channelWithFavicon.favicon_url} 
                              alt={`${channelWithFavicon.name || 'Channel'} favicon`} 
                              width={16}
                              height={16}
                              className="rounded flex-shrink-0"
                              style={{ width: 'auto', height: 'auto' }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                const parent = target.parentElement
                                if (parent) {
                                  const fallback = document.createElement('div')
                                  fallback.className = 'h-4 w-4 rounded bg-gray-100 flex items-center justify-center flex-shrink-0'
                                  fallback.innerHTML = '🌐'
                                  parent.appendChild(fallback)
                                }
                              }}
                            />
                          ) : (
                            <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-400 text-xs">🌐</span>
                            </div>
                          )}
                          <span className="text-xs text-gray-600">{getChannelName(reservation.channelId, channels || [])}</span>
                          <span className="text-xs text-gray-400">RN: {reservation.channelRN}</span>
                        </>
                      )
                    })()}
                  </div>
                </div>
                
                {/* 고객 이름 */}
                <div className="mb-2">
                  <div 
                    className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline flex items-center space-x-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      const customer = (customers as Customer[]).find(c => c.id === reservation.customerId);
                      if (customer) {
                        setEditingCustomer(customer);
                      }
                    }}
                  >
                    {/* 언어별 국기 아이콘 */}
                    {(() => {
                      const customer = (customers as Customer[]).find(c => c.id === reservation.customerId);
                      if (!customer?.language) return null;
                      
                      const language = customer.language.toLowerCase();
                      if (language === 'kr' || language === 'ko' || language === '한국어') {
                        return <ReactCountryFlag countryCode="KR" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                      } else if (language === 'en' || language === '영어') {
                        return <ReactCountryFlag countryCode="US" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                      } else if (language === 'jp' || language === '일본어') {
                        return <ReactCountryFlag countryCode="JP" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                      } else if (language === 'cn' || language === '중국어') {
                        return <ReactCountryFlag countryCode="CN" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                      }
                      return null;
                    })()}
                    <span>{getCustomerName(reservation.customerId, (customers as Customer[]) || [])}</span>
                    {/* 인원 정보 */}
                    {(() => {
                      const hasChild = reservation.child > 0
                      const hasInfant = reservation.infant > 0
                      const hasAdult = reservation.adults > 0
                      
                      // 아동과 유아가 0명이면 성인만 표시
                      if (!hasAdult) return null
                      
                      return (
                        <span className="flex items-center space-x-1 text-xs text-gray-600 ml-2">
                          <Users className="h-3 w-3" />
                          <span>{reservation.adults}명</span>
                          {hasChild && <span className="text-orange-600">{reservation.child}아</span>}
                          {hasInfant && <span className="text-blue-600">{reservation.infant}유</span>}
                        </span>
                      )
                    })()}
                  </div>
                  <a 
                    href={`mailto:${(customers as Customer[]).find(c => c.id === reservation.customerId)?.email || ''}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer block"
                  >
                    {(customers as Customer[]).find(c => c.id === reservation.customerId)?.email}
                  </a>
                  {/* 전화번호와 등록일 - 같은 줄에 배치 */}
                  <div className="flex items-center justify-between">
                    <a 
                      href={`tel:${(customers as Customer[]).find(c => c.id === reservation.customerId)?.phone || ''}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer"
                    >
                      {(customers as Customer[]).find(c => c.id === reservation.customerId)?.phone || '-'}
                    </a>
                    {reservation.addedTime ? (
                      <span className="text-xs text-gray-500">
                        {new Date(reservation.addedTime).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* 카드 본문 */}
              <div className="p-4 space-y-3">
                {/* 상품 정보 */}
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="text-sm font-medium text-gray-900">{getProductName(reservation.productId, products || [])}</div>
                    
                    {/* 새로운 초이스 시스템 뱃지 표시 */}
                    <ChoicesDisplay reservation={reservation} />
                  </div>
                  
                  {/* 기존 selectedOptions 표시 (필요한 경우) */}
                  {reservation.selectedOptions && Object.keys(reservation.selectedOptions).length > 0 && (
                    <div className="mt-1 space-y-1">
                      {Object.entries(reservation.selectedOptions).map(([optionId, choiceIds]) => {
                        if (!choiceIds || choiceIds.length === 0) return null;
                        
                        const option = (productOptions as Array<{ id: string; name: string; is_required?: boolean }>)?.find(opt => opt.id === optionId);
                        
                        if (!option) return null;
                        
                        // 필수 옵션만 표시 (is_required가 true인 옵션만)
                        if (!option.is_required) return null;
                        
                        // 실제 시스템에서는 choice ID가 옵션 ID와 동일하므로 옵션명을 직접 표시
                        return (
                          <div key={optionId} className="text-xs text-gray-600">
                            <span className="font-medium">{option.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 투어 날짜 및 픽업 시간 */}
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {(() => {
                    const pickupTime = reservation.pickUpTime || ''
                    let displayDate = reservation.tourDate
                    
                    // 픽업 시간이 21시(9PM) 이후면 날짜를 -1일
                    if (pickupTime) {
                      const timeMatch = pickupTime.match(/(\d{1,2}):(\d{2})/)
                      if (timeMatch) {
                        const hour = parseInt(timeMatch[1], 10)
                        if (hour >= 21) {
                          const date = new Date(reservation.tourDate)
                          date.setDate(date.getDate() - 1)
                          displayDate = date.toISOString().split('T')[0]
                        }
                      }
                    }
                    
                    return (
                      <>
                        <span className="text-sm text-gray-900">{displayDate}</span>
                        {pickupTime && (
                          <>
                            <span className="text-gray-400">|</span>
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span 
                              className="text-sm text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
                              onClick={(e) => handlePickupTimeClick(reservation, e)}
                            >
                              {pickupTime}
                            </span>
                          </>
                        )}
                      </>
                    )
                  })()}
                </div>

                {/* 픽업 호텔 정보 */}
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span 
                    className={`text-sm hover:text-blue-600 hover:underline cursor-pointer ${
                      reservation.pickUpHotel 
                        ? 'text-gray-900' 
                        : 'text-gray-500 italic'
                    }`}
                    onClick={(e) => handlePickupHotelClick(reservation, e)}
                  >
                    {reservation.pickUpHotel 
                      ? getPickupHotelDisplay(reservation.pickUpHotel, pickupHotels || [])
                      : '픽업 호텔 미정'
                    }
                  </span>
                </div>

                {/* Net Price 계산식 표시 */}
                <div className="pt-2 border-t border-gray-100">
                  {(() => {
                    const pricing = reservationPricingMap.get(reservation.id)
                    if (!pricing || !pricing.total_price) {
                      // pricing 데이터가 없으면 기본 가격 표시
                      const totalPrice = reservation.totalPrice || reservation.pricingInfo?.totalPrice || calculateTotalPrice(reservation, products || [], optionChoices || [])
                      return (
                        <div className="text-xs text-gray-700">
                          <div className="text-gray-600 break-words font-medium">
                            ${totalPrice.toLocaleString()}
                          </div>
                        </div>
                      )
                    }
                    
                    const calculationString = generatePriceCalculation(reservation, pricing)
                    const currency = pricing.currency || 'USD'
                    const currencySymbol = currency === 'KRW' ? '₩' : '$'
                    
                    return (
                      <div className="text-xs text-gray-700">
                        <div className="text-gray-600 break-words font-medium">
                          {calculationString || `${currencySymbol}${pricing.total_price.toFixed(2)}`}
                        </div>
                        {pricing.balance_amount > 0 && (
                          <div className="text-red-600 font-medium mt-1">
                            Balance: {currencySymbol}{pricing.balance_amount.toFixed(2)}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* 연결된 투어 정보 */}
                {(() => {
                  // 취소된 예약은 연결된 투어를 표시하지 않음
                  const statusLower = reservation.status?.toLowerCase() || ''
                  if (statusLower === 'cancelled' || statusLower === 'canceled') {
                    return null
                  }
                  
                  const tourId = reservation.tourId || (reservation as any).tour_id
                  if (!tourId || tourId.trim() === '' || tourId === 'null' || tourId === 'undefined' || !tourInfoMap.has(tourId)) {
                    return null
                  }
                  
                  const tourInfo = tourInfoMap.get(tourId)!
                  
                  // 예약 ID가 투어의 reservation_ids에 포함되어 있는지 확인
                  if (!tourInfo.reservationIds.includes(reservation.id)) {
                    return null
                  }
                  
                  // 상태 색상
                  const getStatusColor = (status: string) => {
                    const statusLower = status.toLowerCase()
                    if (statusLower === 'confirmed') return 'bg-green-100 text-green-800'
                    if (statusLower === 'completed') return 'bg-blue-100 text-blue-800'
                    if (statusLower === 'cancelled') return 'bg-red-100 text-red-800'
                    return 'bg-gray-100 text-gray-800'
                  }
                  
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/${locale}/admin/tours/${tourId}`)
                        }}
                        className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-gray-900">
                            배정된 투어 ({tourInfo.totalPeople}명)
                          </div>
                          <div className="flex items-center space-x-2">
                            {tourInfo.isAssigned && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                배정됨
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(tourInfo.status)}`}>
                              {tourInfo.status}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {tourInfo.guideName !== '-' && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              {tourInfo.guideName}
                            </span>
                          )}
                          {tourInfo.assistantName !== '-' && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              {tourInfo.assistantName}
                            </span>
                          )}
                          {tourInfo.vehicleName !== '-' && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {tourInfo.vehicleName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* 버튼들 - 가장 아래에 배치 */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePricingInfoClick(reservation);
                      }}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center space-x-1 border border-blue-200"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      <span>{t('actions.price')}</span>
                    </button>
                    
                    {/* 투어 생성 버튼 - Mania Tour/Service이고 투어가 없을 때만 표시 */}
                    {(() => {
                      const product = (products as Array<{ id: string; sub_category?: string }>)?.find(p => p.id === reservation.productId);
                      const isManiaTour = product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service';
                      
                      // hasExistingTour 필드를 사용하여 투어 존재 여부 확인
                      if (isManiaTour && !reservation.hasExistingTour) {
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateTour(reservation);
                            }}
                            className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors flex items-center space-x-1 border border-green-200"
                            title="투어 생성"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t('actions.tour')}</span>
                          </button>
                        );
                      }
                      return null;
                    })()}

                    {/* 입금 내역 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReservationForPayment(reservation);
                        setShowPaymentRecords(true);
                      }}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center space-x-1 border border-blue-200"
                      title="입금 내역 관리"
                    >
                      <DollarSign className="w-3 h-3" />
                      <span>{t('actions.deposit')}</span>
                    </button>
                    
                    {/* 고객 보기 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReservationForDetail(reservation);
                        setShowReservationDetailModal(true);
                      }}
                      className="px-2 py-1 text-xs bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors flex items-center space-x-1 border border-purple-200"
                      title="고객 보기"
                    >
                      <Eye className="w-3 h-3" />
                      <span>고객 보기</span>
                    </button>

                    {/* 후기 관리 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReservationForReview(reservation);
                        setShowReviewModal(true);
                      }}
                      className="px-2 py-1 text-xs bg-pink-50 text-pink-600 rounded-md hover:bg-pink-100 transition-colors flex items-center space-x-1 border border-pink-200"
                      title="후기 관리"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>후기</span>
                    </button>

                    {/* 이메일 발송 드롭다운 */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmailDropdownOpen(emailDropdownOpen === reservation.id ? null : reservation.id);
                        }}
                        disabled={sendingEmail === reservation.id}
                        className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors flex items-center space-x-1 border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="이메일 발송"
                      >
                        <Mail className="w-3 h-3" />
                        <span>{sendingEmail === reservation.id ? '발송 중...' : '이메일'}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {emailDropdownOpen === reservation.id && (
                        <div 
                          className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleOpenEmailPreview(reservation, 'confirmation')}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Mail className="w-3 h-3" />
                            <span>예약 확인 이메일</span>
                          </button>
                          <button
                            onClick={() => handleOpenEmailPreview(reservation, 'departure')}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Mail className="w-3 h-3" />
                            <span>투어 출발 확정 이메일</span>
                          </button>
                          <button
                            onClick={() => handleOpenEmailPreview(reservation, 'pickup')}
                            disabled={!reservation.pickUpTime || !reservation.tourDate}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Mail className="w-3 h-3" />
                            <span>픽업 notification 이메일</span>
                          </button>
                          <div className="border-t border-gray-200 my-1"></div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReservationForEmailLogs(reservation.id);
                              setShowEmailLogs(true);
                              setEmailDropdownOpen(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 flex items-center space-x-2"
                          >
                            <Clock className="w-3 h-3" />
                            <span>이메일 발송 내역</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 수정 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/${locale}/admin/reservations/${reservation.id}`);
                      }}
                      className="px-2 py-1 text-xs bg-orange-50 text-orange-600 rounded-md hover:bg-orange-100 transition-colors flex items-center space-x-1 border border-orange-200"
                      title="예약 수정"
                    >
                      <Edit className="w-3 h-3" />
                      <span>수정</span>
                    </button>
                  </div>
                </div>
              </div>

                  
            </div>
                  ))}
                </div>
              </div>
              ))
            )}
          </div>
        ) : (
          /* 일반 카드뷰 - 그룹화된 카드뷰와 동일한 구조 사용 */
          paginatedReservations.length === 0 ? (
            /* 예약이 없을 때 안내 메시지 */
            <div className="text-center py-16">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                <Grid3X3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {debouncedSearchTerm.trim() 
                    ? `"${debouncedSearchTerm}" 검색 결과가 없습니다`
                    : '선택한 조건에 예약이 없습니다'
                  }
                </h3>
                <p className="text-gray-500 mb-6">
                  {debouncedSearchTerm.trim() 
                    ? '다른 검색어를 입력하거나 필터 조건을 변경해보세요.'
                    : (dateRange.start && dateRange.end ? 
                        `${new Date(dateRange.start).toLocaleDateString('ko-KR')} ~ ${new Date(dateRange.end).toLocaleDateString('ko-KR')} 기간에 등록된 예약이 없습니다.` :
                        '현재 선택한 필터 조건에 해당하는 예약이 없습니다.')
                  }
                </p>
                <div className="space-y-2 text-sm text-gray-400">
                  {debouncedSearchTerm.trim() ? (
                    <>
                      <p>• 다른 검색어를 입력해보세요</p>
                      <p>• 필터 조건을 변경해보세요</p>
                      <button
                        onClick={() => {
                          setSearchTerm('')
                          setDebouncedSearchTerm('')
                        }}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        검색어 지우기
                      </button>
                    </>
                  ) : (
                    <>
                      <p>• 다른 날짜 범위를 선택해보세요</p>
                      <p>• 필터 조건을 변경해보세요</p>
                      <p>• 새로운 예약을 등록해보세요</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 그룹화된 카드뷰와 동일한 구조 사용 (날짜 헤더 없이) */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedReservations.map((reservation) => (
              <div
                key={reservation.id}
                className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 group"
              >
                {/* 카드 헤더 - 상태 표시 */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                      {getStatusLabel(reservation.status, t)}
                    </span>
                    <div className="flex items-center space-x-2">
                      {(() => {
                        const channel = (channels as Array<{ id: string; name: string; favicon_url?: string }>)?.find(c => c.id === reservation.channelId)
                        const channelWithFavicon = channel as { favicon_url?: string; name?: string } | undefined
                        return (
                          <>
                            {channelWithFavicon?.favicon_url ? (
                              <Image 
                                src={channelWithFavicon.favicon_url} 
                                alt={`${channelWithFavicon.name || 'Channel'} favicon`} 
                                width={16}
                                height={16}
                                className="rounded flex-shrink-0"
                                style={{ width: 'auto', height: 'auto' }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const parent = target.parentElement
                                  if (parent) {
                                    const fallback = document.createElement('div')
                                    fallback.className = 'h-4 w-4 rounded bg-gray-100 flex items-center justify-center flex-shrink-0'
                                    fallback.innerHTML = '🌐'
                                    parent.appendChild(fallback)
                                  }
                                }}
                              />
                            ) : (
                              <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-400 text-xs">🌐</span>
                              </div>
                            )}
                            <span className="text-xs text-gray-600">{getChannelName(reservation.channelId, channels || [])}</span>
                            <span className="text-xs text-gray-400">RN: {reservation.channelRN}</span>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  
                  {/* 고객 이름 */}
                  <div className="mb-2">
                    <div 
                      className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline flex items-center space-x-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        const customer = (customers as Customer[]).find(c => c.id === reservation.customerId);
                        if (customer) {
                          setEditingCustomer(customer);
                        }
                      }}
                    >
                      {/* 언어별 국기 아이콘 */}
                      {(() => {
                        const customer = (customers as Customer[]).find(c => c.id === reservation.customerId);
                        if (!customer?.language) return null;
                        
                        const language = customer.language.toLowerCase();
                        if (language === 'kr' || language === 'ko' || language === '한국어') {
                          return <ReactCountryFlag countryCode="KR" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                        } else if (language === 'en' || language === '영어') {
                          return <ReactCountryFlag countryCode="US" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                        } else if (language === 'jp' || language === '일본어') {
                          return <ReactCountryFlag countryCode="JP" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                        } else if (language === 'cn' || language === '중국어') {
                          return <ReactCountryFlag countryCode="CN" svg className="mr-2" style={{ width: '20px', height: '15px' }} />;
                        }
                        return null;
                      })()}
                      
                      {/* 거주 상태 아이콘 */}
                      <ResidentStatusIcon
                        reservationId={reservation.id}
                        customerId={reservation.customerId}
                        totalPeople={(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}
                        onUpdate={() => {
                          // 예약 목록 새로고침
                          refreshReservations()
                        }}
                      />
                      
                      <span>{getCustomerName(reservation.customerId, (customers as Customer[]) || [])}</span>
                      {/* 인원 정보 */}
                      {(() => {
                        const hasChild = reservation.child > 0
                        const hasInfant = reservation.infant > 0
                        const hasAdult = reservation.adults > 0
                        
                        // 아동과 유아가 0명이면 성인만 표시
                        if (!hasAdult) return null
                        
                        return (
                          <span className="flex items-center space-x-1 text-xs text-gray-600 ml-2">
                            <Users className="h-3 w-3" />
                            <span>{reservation.adults}명</span>
                            {hasChild && <span className="text-orange-600">{reservation.child}아</span>}
                            {hasInfant && <span className="text-blue-600">{reservation.infant}유</span>}
                          </span>
                        )
                      })()}
                    </div>
                    <a 
                      href={`mailto:${(customers as Customer[]).find(c => c.id === reservation.customerId)?.email || ''}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer block"
                    >
                      {(customers as Customer[]).find(c => c.id === reservation.customerId)?.email}
                    </a>
                    {/* 전화번호와 등록일 - 같은 줄에 배치 */}
                    <div className="flex items-center justify-between">
                      <a 
                        href={`tel:${(customers as Customer[]).find(c => c.id === reservation.customerId)?.phone || ''}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer"
                      >
                        {(customers as Customer[]).find(c => c.id === reservation.customerId)?.phone || '-'}
                      </a>
                      {reservation.addedTime ? (
                        <span className="text-xs text-gray-500">
                          {new Date(reservation.addedTime).toLocaleDateString('ko-KR', { 
                            year: 'numeric',
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 카드 본문 */}
                <div className="p-4 space-y-3">
                  {/* 상품 정보 */}
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="text-sm font-medium text-gray-900">{getProductName(reservation.productId, products || [])}</div>
                      
                      {/* 새로운 초이스 시스템 뱃지 표시 */}
                      <ChoicesDisplay reservation={reservation} />
                    </div>
                    
                    {/* 기존 selectedOptions 표시 (필요한 경우) */}
                    {reservation.selectedOptions && Object.keys(reservation.selectedOptions).length > 0 && (
                      <div className="mt-1 space-y-1">
                        {Object.entries(reservation.selectedOptions).map(([optionId, choiceIds]) => {
                          if (!choiceIds || choiceIds.length === 0) return null;
                          
                        const option = (productOptions as Array<{ id: string; name: string; is_required?: boolean }>)?.find(opt => opt.id === optionId);
                        
                        if (!option) return null;
                        
                        // 필수 옵션만 표시 (is_required가 true인 옵션만)
                        if (!option.is_required) return null;
                        
                        // 실제 시스템에서는 choice ID가 옵션 ID와 동일하므로 옵션명을 직접 표시
                        return (
                          <div key={optionId} className="text-xs text-gray-600">
                            <span className="font-medium">{option.name}</span>
                          </div>
                        );
                        })}
                      </div>
                    )}

                  </div>

                  {/* 투어 날짜 및 픽업 시간 */}
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {(() => {
                      const pickupTime = reservation.pickUpTime || ''
                      let displayDate = reservation.tourDate
                      
                      // 픽업 시간이 21시(9PM) 이후면 날짜를 -1일
                      if (pickupTime) {
                        const timeMatch = pickupTime.match(/(\d{1,2}):(\d{2})/)
                        if (timeMatch) {
                          const hour = parseInt(timeMatch[1], 10)
                          if (hour >= 21) {
                            const date = new Date(reservation.tourDate)
                            date.setDate(date.getDate() - 1)
                            displayDate = date.toISOString().split('T')[0]
                          }
                        }
                      }
                      
                      return (
                        <>
                          <span className="text-sm text-gray-900">{displayDate}</span>
                          {pickupTime && (
                            <>
                              <span className="text-gray-400">|</span>
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span 
                                className="text-sm text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
                                onClick={(e) => handlePickupTimeClick(reservation, e)}
                              >
                                {pickupTime}
                              </span>
                            </>
                          )}
                        </>
                      )
                    })()}
                  </div>

                  {/* 픽업 호텔 정보 */}
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span 
                      className={`text-sm hover:text-blue-600 hover:underline cursor-pointer ${
                        reservation.pickUpHotel 
                          ? 'text-gray-900' 
                          : 'text-gray-500 italic'
                      }`}
                      onClick={(e) => handlePickupHotelClick(reservation, e)}
                    >
                      {reservation.pickUpHotel 
                        ? getPickupHotelDisplay(reservation.pickUpHotel, pickupHotels || [])
                        : '픽업 호텔 미정'
                      }
                    </span>
                  </div>

                  {/* Net Price 계산식 표시 */}
                  <div className="pt-2 border-t border-gray-100">
                    {(() => {
                      const pricing = reservationPricingMap.get(reservation.id)
                      if (!pricing || !pricing.total_price) {
                        // pricing 데이터가 없으면 기본 가격 표시
                        const totalPrice = reservation.totalPrice || reservation.pricingInfo?.totalPrice || calculateTotalPrice(reservation, products || [], optionChoices || [])
                        return (
                          <div className="text-xs text-gray-700">
                            <div className="text-gray-600 break-words font-medium">
                              ${totalPrice.toLocaleString()}
                            </div>
                          </div>
                        )
                      }
                      
                      const calculationString = generatePriceCalculation(reservation, pricing)
                      const currency = pricing.currency || 'USD'
                      const currencySymbol = currency === 'KRW' ? '₩' : '$'
                      
                      return (
                        <div className="text-xs text-gray-700">
                          <div className="text-gray-600 break-words font-medium">
                            {calculationString || `${currencySymbol}${pricing.total_price.toFixed(2)}`}
                          </div>
                          {pricing.balance_amount > 0 && (
                            <div className="text-red-600 font-medium mt-1">
                              Balance: {currencySymbol}{pricing.balance_amount.toFixed(2)}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* 연결된 투어 정보 */}
                {(() => {
                  // 취소된 예약은 연결된 투어를 표시하지 않음
                  const statusLower = reservation.status?.toLowerCase() || ''
                  if (statusLower === 'cancelled' || statusLower === 'canceled') {
                    return null
                  }
                  
                  const tourId = reservation.tourId || (reservation as any).tour_id
                  if (!tourId || tourId.trim() === '' || tourId === 'null' || tourId === 'undefined' || !tourInfoMap.has(tourId)) {
                    return null
                  }
                  
                  const tourInfo = tourInfoMap.get(tourId)!
                  
                  // 예약 ID가 투어의 reservation_ids에 포함되어 있는지 확인
                  if (!tourInfo.reservationIds.includes(reservation.id)) {
                    return null
                  }
                  
                  // 상태 색상
                  const getStatusColor = (status: string) => {
                    const statusLower = status.toLowerCase()
                    if (statusLower === 'confirmed') return 'bg-green-100 text-green-800'
                    if (statusLower === 'completed') return 'bg-blue-100 text-blue-800'
                    if (statusLower === 'cancelled') return 'bg-red-100 text-red-800'
                    return 'bg-gray-100 text-gray-800'
                  }
                  
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/${locale}/admin/tours/${tourId}`)
                        }}
                        className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-gray-900">
                            배정된 투어 ({tourInfo.totalPeople}명)
                          </div>
                          <div className="flex items-center space-x-2">
                            {tourInfo.isAssigned && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                배정됨
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(tourInfo.status)}`}>
                              {tourInfo.status}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {tourInfo.guideName !== '-' && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              {tourInfo.guideName}
                            </span>
                          )}
                          {tourInfo.assistantName !== '-' && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              {tourInfo.assistantName}
                            </span>
                          )}
                          {tourInfo.vehicleName !== '-' && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {tourInfo.vehicleName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* 버튼들 - 가장 아래에 배치 */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePricingInfoClick(reservation);
                      }}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center space-x-1 border border-blue-200"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      <span>{t('actions.price')}</span>
                    </button>
                    
                    {/* 투어 생성 버튼 - Mania Tour/Service이고 투어가 없을 때만 표시 */}
                    {(() => {
                      const product = (products as Array<{ id: string; sub_category?: string }>)?.find(p => p.id === reservation.productId);
                      const isManiaTour = product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service';
                      
                      // hasExistingTour 필드를 사용하여 투어 존재 여부 확인
                      if (isManiaTour && !reservation.hasExistingTour) {
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateTour(reservation);
                            }}
                            className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors flex items-center space-x-1 border border-green-200"
                            title="투어 생성"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t('actions.tour')}</span>
                          </button>
                        );
                      }
                      return null;
                    })()}

                    {/* 입금 내역 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReservationForPayment(reservation);
                        setShowPaymentRecords(true);
                      }}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center space-x-1 border border-blue-200"
                      title="입금 내역 관리"
                    >
                      <DollarSign className="w-3 h-3" />
                      <span>{t('actions.deposit')}</span>
                    </button>
                    
                    {/* 고객 보기 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReservationForDetail(reservation);
                        setShowReservationDetailModal(true);
                      }}
                      className="px-2 py-1 text-xs bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors flex items-center space-x-1 border border-purple-200"
                      title="고객 보기"
                    >
                      <Eye className="w-3 h-3" />
                      <span>고객 보기</span>
                    </button>

                    {/* 후기 관리 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReservationForReview(reservation);
                        setShowReviewModal(true);
                      }}
                      className="px-2 py-1 text-xs bg-pink-50 text-pink-600 rounded-md hover:bg-pink-100 transition-colors flex items-center space-x-1 border border-pink-200"
                      title="후기 관리"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>후기</span>
                    </button>

                    {/* 이메일 발송 드롭다운 */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmailDropdownOpen(emailDropdownOpen === reservation.id ? null : reservation.id);
                        }}
                        disabled={sendingEmail === reservation.id}
                        className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors flex items-center space-x-1 border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="이메일 발송"
                      >
                        <Mail className="w-3 h-3" />
                        <span>{sendingEmail === reservation.id ? '발송 중...' : '이메일'}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {emailDropdownOpen === reservation.id && (
                        <div 
                          className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleOpenEmailPreview(reservation, 'confirmation')}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Mail className="w-3 h-3" />
                            <span>예약 확인 이메일</span>
                          </button>
                          <button
                            onClick={() => handleOpenEmailPreview(reservation, 'departure')}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Mail className="w-3 h-3" />
                            <span>투어 출발 확정 이메일</span>
                          </button>
                          <button
                            onClick={() => handleOpenEmailPreview(reservation, 'pickup')}
                            disabled={!reservation.pickUpTime || !reservation.tourDate}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Mail className="w-3 h-3" />
                            <span>픽업 notification 이메일</span>
                          </button>
                          <div className="border-t border-gray-200 my-1"></div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReservationForEmailLogs(reservation.id);
                              setShowEmailLogs(true);
                              setEmailDropdownOpen(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 flex items-center space-x-2"
                          >
                            <Clock className="w-3 h-3" />
                            <span>이메일 발송 내역</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 수정 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/${locale}/admin/reservations/${reservation.id}`);
                      }}
                      className="px-2 py-1 text-xs bg-orange-50 text-orange-600 rounded-md hover:bg-orange-100 transition-colors flex items-center space-x-1 border border-orange-200"
                      title="예약 수정"
                    >
                      <Edit className="w-3 h-3" />
                      <span>수정</span>
                    </button>
                  </div>
                </div>
              </div>
                ))}
              </div>
            </div>
          )
        )}
        
        {/* 페이지네이션 - 카드뷰에서만 표시 (그룹화되지 않은 경우에만) */}
        {!groupByDate && totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <div className="text-sm text-gray-700">
              페이지 {currentPage} / {totalPages} (총 {filteredReservations.length}개)
            </div>
            
            <div className="flex items-center space-x-2">
              {/* 이전 페이지 버튼 */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>
              
              {/* 페이지 번호들 */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      currentPage === pageNum
                        ? 'text-white bg-blue-600 border border-blue-600'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              
              {/* 다음 페이지 버튼 */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
          )}
        </>
      )}

      {/* 예약 추가/편집 모달 */}
      {(showAddForm || editingReservation) && (
        <ReservationForm
          reservation={editingReservation || (newReservationId ? { id: newReservationId } as Reservation : null)}
          customers={customers || []}
          products={products || []}
          channels={channels || []}
          productOptions={productOptions || []}
          options={options || []}
          pickupHotels={pickupHotels || []}
          coupons={coupons || []}
          onSubmit={editingReservation ? handleEditReservation : handleAddReservation}
          onCancel={() => {
            setShowAddForm(false)
            setNewReservationId(null)
            setEditingReservation(null)
          }}
          onRefreshCustomers={refreshCustomers}
          onDelete={handleDeleteReservation}
          layout="modal"
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
                  alert('고객 삭제 중 오류가 발생했습니다: ' + error.message)
                  return
                }

                // 성공 시 고객 목록 새로고침
                await refreshCustomers()
                setEditingCustomer(null)
                alert('고객이 성공적으로 삭제되었습니다!')
              } catch (error) {
                console.error('Error deleting customer:', error)
                alert('고객 삭제 중 오류가 발생했습니다.')
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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

// 리사이즈 가능한 모달 컴포넌트
function ResizableModal({
  isOpen,
  onClose,
  title,
  children,
  initialHeight,
  onHeightChange
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  initialHeight: number
  onHeightChange: (height: number) => void
}) {
  const [height, setHeight] = useState(initialHeight)
  const [isResizing, setIsResizing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHeight(initialHeight)
  }, [initialHeight])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const windowHeight = window.innerHeight
      const newHeight = windowHeight - e.clientY
      const minHeight = 300
      const maxHeight = windowHeight - 100
      
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight))
      setHeight(clampedHeight)
      onHeightChange(clampedHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, onHeightChange])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-t-lg shadow-xl w-full max-w-7xl overflow-hidden flex flex-col"
        style={{ height: `${height}px`, maxHeight: '95vh' }}
      >
        {/* 리사이즈 핸들 */}
        <div
          onMouseDown={handleMouseDown}
          className="w-full h-2 bg-gray-200 hover:bg-gray-300 cursor-ns-resize flex items-center justify-center group transition-colors"
        >
          <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        </div>
        
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden" style={{ height: `calc(${height}px - 80px)` }}>
          {children}
        </div>
      </div>
    </div>
  )
}