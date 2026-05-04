'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Hotel,
  MapPin,
  Clock,
  Users,
  Camera,
  MessageSquare,
  FileText,
  Calculator,
  ChevronDown,
  ChevronUp,
  Calendar,
  Phone,
  Mail,
  Car,
  type LucideIcon,
} from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TourPhotoUpload from '@/components/TourPhotoUpload'
import TourChatRoom from '@/components/TourChatRoom'
import TourExpenseManager from '@/components/TourExpenseManager'
import TourReportSection from '@/components/TourReportSection'
import TourReportForm from '@/components/TourReportForm'
import TourWeather from '@/components/TourWeather'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import { formatCustomerNameEnhanced } from '@/utils/koreanTransliteration'
import { formatTimeWithAMPM, timeToHHmm } from '@/lib/utils'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'
import { toast } from 'sonner'
import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'
import {
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  normalizeReservationIds,
} from '@/utils/tourUtils'

// 타입 정의 (DB 스키마 기반)
type TourRow = Database['public']['Tables']['tours']['Row']
type ReservationRow = Database['public']['Tables']['reservations']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type PickupHotel = Database['public']['Tables']['pickup_hotels']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']
type TourHotelBooking = Database['public']['Tables']['tour_hotel_bookings']['Row']
type TicketBooking = Database['public']['Tables']['ticket_bookings']['Row']
type TeamMember = {
  email: string
  name_ko: string | null
  name_en: string | null
  phone?: string | null
}

/** 픽업 호텔 미지정 예약을 한 그룹으로 묶기 위한 키 (DB id와 충돌하지 않도록 함) */
const GUIDE_UNASSIGNED_PICKUP_HOTEL_KEY = '__guide_pickup_hotel_unassigned__'
const REPORT_REMINDER_START_DATE = '2026-04-01'

/** 투어 업무 기준일(라스베이거스) 오늘 날짜 YYYY-MM-DD */
function getTodayLasVegasYyyyMmDd(): string {
  const now = new Date()
  const las = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const y = las.getFullYear()
  const m = String(las.getMonth() + 1).padStart(2, '0')
  const d = String(las.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 픽업 스케줄 헤더와 동일: 21:00 이후 픽업은 달력상 전날(야간 픽업).
 * DB의 tour_date만 쓰면 전날 밤 픽업이 “내일 투어”로 남아 선불 팁이 숨겨지는 문제가 있음.
 */
function getGuidePickupCalendarYyyyMmDd(
  tourDate: string | null | undefined,
  pickupTime: string | null | undefined
): string | null {
  if (!tourDate) return null
  let displayDate = String(tourDate).slice(0, 10)
  if (pickupTime && pickupTime.length >= 5) {
    const time = pickupTime.substring(0, 5)
    const timeHour = parseInt(time.split(':')[0], 10)
    if (!Number.isNaN(timeHour) && timeHour >= 21) {
      const date = new Date(tourDate)
      date.setDate(date.getDate() - 1)
      displayDate = date.toISOString().split('T')[0]
    }
  }
  return displayDate
}

/** 선불 팁: 픽업 달력일이 라스베이거스 “오늘” 이전·당일일 때만(미래 일정 숨김) */
function isGuidePrepaidTipAllowedByPickupCalendar(
  tourDate: string | null | undefined,
  pickupTime: string | null | undefined
): boolean {
  const cal = getGuidePickupCalendarYyyyMmDd(tourDate, pickupTime)
  if (!cal) return false
  return cal <= getTodayLasVegasYyyyMmDd()
}

/** 티켓 부킹 회사 표시명 (관리 화면과 동일 규칙) */
function normalizeTicketCompanyName(company: string | null | undefined): string {
  const c = company || 'Unknown'
  const companyLower = c.toLowerCase()
  if (companyLower === 'see canyon') return 'Dixies'
  if (companyLower === 'mei tour' || companyLower === "ken's tour") return "Ken's"
  return c
}

function groupReservationsByPickupHotel(reservations: ReservationRow[]) {
  return reservations.reduce(
    (acc, reservation) => {
      const raw = reservation.pickup_hotel
      const hotelId =
        raw != null && String(raw).trim() !== '' ? raw : GUIDE_UNASSIGNED_PICKUP_HOTEL_KEY
      if (!acc[hotelId]) acc[hotelId] = []
      acc[hotelId].push(reservation)
      return acc
    },
    {} as Record<string, ReservationRow[]>
  )
}

export default function GuideTourDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  const t = useTranslations('guideTour')
  const tCommon = useTranslations('common')
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  const [tour, setTour] = useState<TourRow | null>(null)
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [product, setProduct] = useState<ProductRow | null>(null)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [pickupHotels, setPickupHotels] = useState<PickupHotel[]>([])
  const [tourHotelBookings, setTourHotelBookings] = useState<TourHotelBooking[]>([])
  const [ticketBookings, setTicketBookings] = useState<TicketBooking[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [channels, setChannels] = useState<Array<{ id: string; name: string; favicon_url?: string }>>([])
  const [reservationPricing, setReservationPricing] = useState<Array<{
    reservation_id: string
    balance_amount: number
    prepayment_tip: number
    currency: string
  }>>([])
  /** Tips 쉐어 관리에서 저장된 투어 단위 가이드/어시 몫(OP 제외) */
  const [tourTipShare, setTourTipShare] = useState<{
    guide_amount: number
    assistant_amount: number
  } | null>(null)
  const [reservationChoicesMap, setReservationChoicesMap] = useState<Map<string, Array<{
    choice_id: string
    option_id: string
    quantity: number
    option_name: string
    option_name_ko: string
    choice_group_ko: string
  }>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [residentStatusSummary, setResidentStatusSummary] = useState({
    usResident: 0,
    nonResident: 0,
    nonResidentWithPass: 0,
    passCoveredCount: 0
  })
  
  // 모바일 최적화를 위한 상태
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'bookings' | 'photos' | 'chat' | 'expenses' | 'report'>('overview')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tour-info', 'pickup-schedule', 'chat']))
  /** 가이드 모바일(lg 미만): 부킹·사진·정산·리포트 섹션은 항상 펼침 */
  const [isGuideMobileLayout, setIsGuideMobileLayout] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [calculatedTourTimes, setCalculatedTourTimes] = useState<{
    startTime: string;
    endTime: string;
    sunriseTime: string;
  } | null>(null)
  const reportReminderShownForTourRef = useRef<string | null>(null)
  
  // balance 정보를 가져오는 함수
  const getReservationBalance = (reservationId: string) => {
    const pricing = reservationPricing.find(p => p.reservation_id === reservationId)
    return pricing?.balance_amount || 0
  }

  const getReservationPrepaidTip = (reservationId: string) => {
    const pricing = reservationPricing.find(p => p.reservation_id === reservationId)
    return pricing?.prepayment_tip ?? 0
  }

  const emailsMatchLoose = (a: string | null | undefined, b: string | null | undefined) => {
    if (a == null || b == null) return false
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
  }

  /**
   * 픽업 카드 선팁 표시: Tips 쉐어 저장 시 → 로그인 역할(가이드/어시) 몫을
   * 투어 전체 prepayment_tip 합 대비 해당 예약 비율로 배분. 미저장 시 고객 선불 팁 원액.
   * (관리자 등 배정 역할 아님 → 원액)
   */
  const getDisplayPrepaidTipForPickupCard = (reservationId: string) => {
    const prep = getReservationPrepaidTip(reservationId)
    if (prep <= 0) return 0
    if (!tour || !tourTipShare) return prep

    const guideId = (tour as TourRow & { tour_guide_id?: string | null }).tour_guide_id
    const assistantId = (tour as TourRow & { assistant_id?: string | null }).assistant_id
    const me = currentUserEmail

    let pool = 0
    if (emailsMatchLoose(me, guideId)) {
      pool = tourTipShare.guide_amount
    } else if (emailsMatchLoose(me, assistantId)) {
      pool = tourTipShare.assistant_amount
    } else {
      return prep
    }

    if (pool <= 0) return prep

    const totalPrepaid = reservationPricing.reduce((s, p) => s + (p.prepayment_tip || 0), 0)
    if (totalPrepaid <= 0) return prep
    return Math.round(pool * (prep / totalPrepaid) * 100) / 100
  }

  const formatGuidePricingAmount = (amount: number, currency: string) => {
    if (currency === 'KRW') return `₩${amount.toLocaleString()}`
    return `$${amount.toLocaleString()}`
  }

  const formatGuideTipUsd2 = (amount: number) =>
    `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // 총 balance 계산 함수
  const getTotalBalance = () => {
    return reservationPricing.reduce((total, pricing) => total + (pricing.balance_amount || 0), 0)
  }

  // 투어 데이터 로드
  const loadTourData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setTourTipShare(null)

      const tourId = params.id as string
      if (!tourId) {
        setError(t('errors.noTourId'))
        return
      }

      // 투어 정보 가져오기
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single()

      if (tourError || !tourData) {
        setError(t('errors.cannotLoadTour'))
        return
      }

      // 권한 확인 (관리자/매니저는 모든 투어 접근 가능, 투어 가이드는 배정된 투어만)
      if (userRole === 'team_member' && (tourData as TourRow & { tour_guide_id?: string; assistant_id?: string })?.tour_guide_id !== currentUserEmail && (tourData as TourRow & { tour_guide_id?: string; assistant_id?: string })?.assistant_id !== currentUserEmail) {
        setError(t('errors.noAccess'))
        return
      }

      setTour(tourData)

      {
        const { data: tipShareRow, error: tipShareErr } = await supabase
          .from('tour_tip_shares')
          .select('guide_amount, assistant_amount')
          .eq('tour_id', tourId)
          .maybeSingle()
        if (tipShareErr && (tipShareErr as { code?: string }).code !== 'PGRST116') {
          console.warn('가이드 페이지: tour_tip_shares 조회:', tipShareErr)
        }
        if (tipShareRow) {
          const ga =
            tipShareRow.guide_amount === null || tipShareRow.guide_amount === undefined
              ? 0
              : typeof tipShareRow.guide_amount === 'string'
                ? parseFloat(tipShareRow.guide_amount) || 0
                : Number(tipShareRow.guide_amount) || 0
          const aa =
            tipShareRow.assistant_amount === null || tipShareRow.assistant_amount === undefined
              ? 0
              : typeof tipShareRow.assistant_amount === 'string'
                ? parseFloat(tipShareRow.assistant_amount) || 0
                : Number(tipShareRow.assistant_amount) || 0
          setTourTipShare({ guide_amount: ga, assistant_amount: aa })
        } else {
          setTourTipShare(null)
        }
      }

      let tourProductRow: ProductRow | null = null
      // 상품 정보 가져오기
      if ((tourData as TourRow & { product_id?: string }).product_id) {
        const { data: productData } = await supabase
          .from('products')
          .select('*')
          .eq('id', (tourData as TourRow & { product_id: string }).product_id)
          .single()
        tourProductRow = productData
        setProduct(productData)
      }

      // 차량 정보 가져오기
      if ((tourData as TourRow & { tour_car_id?: string }).tour_car_id) {
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', (tourData as TourRow & { tour_car_id: string }).tour_car_id)
          .maybeSingle()
        
        if (!vehicleError && vehicleData) {
          setVehicle(vehicleData)
        } else {
          setVehicle(null)
        }
      }

      // 예약 정보 가져오기 (투어에 배정된 예약만)
      // tours.reservation_ids에 있는 예약 ID들만 가져옴 (tour_id 기반 조회 제거)
      /** 픽업·인원 등 가이드 화면에 표시할 예약 ID (취소·삭제 제외). 배정은 tours.reservation_ids 기준 — 관리자 투어 상세와 동일 */
      let guideActiveReservationIds: string[] = []
      const allReservationIds: string[] = []
      const normalizedTourReservationIds = normalizeReservationIds(
        (tourData as TourRow & { reservation_ids?: unknown }).reservation_ids
      )
      if (normalizedTourReservationIds.length > 0) {
        const ids = normalizedTourReservationIds
        
        // reservation_ids에 있는 ID들이 실제 reservations 테이블에 존재하는지만 확인
        if (ids.length > 0) {
          const { data: existingReservations } = await supabase
            .from('reservations')
            .select('id')
            .in('id', ids)
          
          // 실제로 존재하는 예약 ID만 추가
          allReservationIds.push(...((existingReservations || []).map(r => r.id)))
        }
      }

      if (allReservationIds.length > 0) {
        const { data: reservationsData } = await supabase
          .from('reservations')
          .select('*, selected_options')
          .in('id', allReservationIds)

        const reservationsListRaw = (reservationsData || []) as ReservationRow[]
        // 관리자 투어 상세(배정·픽업 스케줄)와 동일: reservation_ids에 포함된 예약만 표시, 취소·삭제만 제외.
        // reservations.tour_id는 배정 과정에서 동기화가 어긋날 수 있어 필터에 쓰지 않음.
        const reservationsList = reservationsListRaw.filter((r) => {
          if (
            isReservationCancelledStatus(r.status) ||
            isReservationDeletedStatus(r.status)
          ) {
            return false
          }
          return true
        })
        guideActiveReservationIds = reservationsList.map((r) => r.id)

        if (guideActiveReservationIds.length > 0) {
          const { data: pricingData } = await supabase
            .from('reservation_pricing')
            // currency 컬럼은 스키마에 없을 수 있음 — select에 넣으면 PostgREST 400
            .select('reservation_id, balance_amount, prepayment_tip')
            .in('reservation_id', guideActiveReservationIds)
          const normalized = (pricingData || []).map((row: {
            reservation_id: string
            balance_amount?: number | string | null
            prepayment_tip?: number | string | null
          }) => {
            const bal =
              row.balance_amount === null || row.balance_amount === undefined
                ? 0
                : typeof row.balance_amount === 'string'
                  ? parseFloat(row.balance_amount) || 0
                  : row.balance_amount
            const tipRaw = row.prepayment_tip
            const tip =
              tipRaw === null || tipRaw === undefined
                ? 0
                : typeof tipRaw === 'string'
                  ? parseFloat(tipRaw) || 0
                  : Number(tipRaw) || 0
            return {
              reservation_id: row.reservation_id,
              balance_amount: bal,
              prepayment_tip: tip,
              currency: 'USD',
            }
          })
          setReservationPricing(normalized)
        } else {
          setReservationPricing([])
        }

        const choicesMap = new Map<string, Array<{
          choice_id: string
          option_id: string
          quantity: number
          option_name: string
          option_name_ko: string
          choice_group_ko: string
        }>>()

        for (const reservationId of guideActiveReservationIds) {
          try {
            const { data: choicesData, error: choicesError } = await supabase
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

            if (choicesError) {
              console.error(`가이드 페이지: 예약 ${reservationId} 초이스 로드 오류:`, choicesError)
              continue
            }

            if (choicesData && choicesData.length > 0) {
              const formattedChoices = choicesData.map((choice: any) => ({
                choice_id: choice.choice_id,
                option_id: choice.option_id,
                quantity: choice.quantity,
                option_name: choice.choice_options?.option_name || '',
                option_name_ko: choice.choice_options?.option_name_ko || choice.choice_options?.option_name || '',
                choice_group_ko: choice.choice_options?.product_choices?.choice_group_ko || ''
              }))
              choicesMap.set(reservationId, formattedChoices)
            }
          } catch (err) {
            console.error(`가이드 페이지: 예약 ${reservationId} 초이스 처리 중 예외:`, err)
            continue
          }
        }

        setReservationChoicesMap(choicesMap)
        
        // 픽업 시간으로 정렬
        const sortedReservations = reservationsList.sort((a, b) => {
          const timeA = (a as ReservationRow).pickup_time || '00:00'
          const timeB = (b as ReservationRow).pickup_time || '00:00'
          return timeA.localeCompare(timeB)
        })
        
        setReservations(sortedReservations)

        // 고객 정보 가져오기
        const customerIds = [...new Set(reservationsList.map(r => (r as ReservationRow & { customer_id?: string }).customer_id).filter(Boolean))]
        if (customerIds.length > 0) {
          const { data: customersData } = await supabase
            .from('customers')
            .select('*')
            .in('id', customerIds)
          setCustomers(customersData || [])
        }

        // 픽업 호텔 정보 가져오기 (reservations의 pickup_hotel 정보 사용)
        if (reservationsList.length > 0) {
          // 예약에서 pickup_hotel ID들 수집
          const pickupHotelIds = [...new Set(
            reservationsList
              .map(r => (r as ReservationRow & { pickup_hotel?: string }).pickup_hotel)
              .filter(Boolean)
          )]
          
          if (pickupHotelIds.length > 0) {
            const { data: hotelsData } = await supabase
              .from('pickup_hotels')
              .select('*')
              .in('id', pickupHotelIds)
            setPickupHotels(hotelsData || [])
          }
        }
      }


      // 투어 호텔 부킹 정보 가져오기 (cancelled가 아닌 것만)
      const { data: hotelBookingsData } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('tour_id', tourId)
        .not('status', 'ilike', 'cancelled');
      setTourHotelBookings(hotelBookingsData || [])

      // 티켓 부킹 정보 가져오기 (모든 status 포함)
      const { data: ticketBookingsData } = await supabase
        .from('ticket_bookings')
        .select('*')
        .eq('tour_id', tourId);
      setTicketBookings(filterTicketBookingsExcludedFromMainUi(ticketBookingsData || []))

      // 팀 멤버 정보 가져오기 (가이드와 어시스턴트 이름 표시용)
      const { data: teamData } = await supabase
        .from('team')
        .select('email, name_ko, name_en, phone');
      setTeamMembers(teamData || [])

      // 채널 정보 가져오기
      const { data: channelsData } = await supabase
        .from('channels')
        .select('id, name, favicon_url');
      setChannels(channelsData || [])

      // 거주 상태별 인원 수 합산 가져오기 (해당 상품 코드에서만)
      const showResidentSummary = productShowsResidentStatusSectionByCode(
        (tourProductRow as { product_code?: string | null } | null)?.product_code
      )
      if (!showResidentSummary) {
        setResidentStatusSummary({
          usResident: 0,
          nonResident: 0,
          nonResidentWithPass: 0,
          passCoveredCount: 0
        })
      } else if (guideActiveReservationIds.length > 0) {
        const { data: reservationCustomers, error: rcError } = await supabase
          .from('reservation_customers')
          .select('resident_status, pass_covered_count')
          .in('reservation_id', guideActiveReservationIds)
        
        if (!rcError && reservationCustomers) {
          let usResidentCount = 0
          let nonResidentCount = 0
          let nonResidentWithPassCount = 0
          let passCoveredCount = 0
          
          reservationCustomers.forEach((rc: any) => {
            if (rc.resident_status === 'us_resident') {
              usResidentCount++
            } else if (rc.resident_status === 'non_resident') {
              nonResidentCount++
            } else if (rc.resident_status === 'non_resident_with_pass') {
              nonResidentWithPassCount++
              if (rc.pass_covered_count) {
                passCoveredCount += rc.pass_covered_count
              }
            }
          })
          
          setResidentStatusSummary({
            usResident: usResidentCount,
            nonResident: nonResidentCount,
            nonResidentWithPass: nonResidentWithPassCount,
            passCoveredCount: passCoveredCount
          })
        } else {
          setResidentStatusSummary({
            usResident: 0,
            nonResident: 0,
            nonResidentWithPass: 0,
            passCoveredCount: 0
          })
        }
      } else if (showResidentSummary) {
        setResidentStatusSummary({
          usResident: 0,
          nonResident: 0,
          nonResidentWithPass: 0,
          passCoveredCount: 0
        })
      }

    } catch (err) {
      console.error('Error loading tour data:', err)
      setError(locale === 'ko' ? '데이터를 불러오는 중 오류가 발생했습니다.' : 'An error occurred while loading data.')
    } finally {
      setLoading(false)
    }
  }, [params.id, currentUserEmail, userRole, t, locale])

  useEffect(() => {
    loadTourData()
  }, [loadTourData])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const sync = () => setIsGuideMobileLayout(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const remindMissingReport = async () => {
      if (!tour?.id || !currentUserEmail) return

      // 2026-04-01부터 알림 시작
      const now = new Date()
      const start = new Date(`${REPORT_REMINDER_START_DATE}T00:00:00`)
      if (Number.isNaN(start.getTime()) || now < start) return

      if (reportReminderShownForTourRef.current === tour.id) return

      const { data, error } = await supabase
        .from('tour_reports')
        .select('id')
        .eq('tour_id', tour.id)
        .eq('user_email', currentUserEmail)
        .limit(1)

      if (error) {
        console.error('Report reminder check failed:', error)
        return
      }

      if (!data || data.length === 0) {
        toast.warning(
          locale === 'en'
            ? 'Please submit your tour report for this tour.'
            : '이 투어의 리포트를 작성해 주세요.'
        )
      }

      reportReminderShownForTourRef.current = tour.id
    }

    void remindMissingReport()
  }, [tour?.id, currentUserEmail, locale])

  // 고객 정보 조회 함수
  const getCustomerInfo = (customerId: string) => {
    return customers.find(c => c.id === customerId)
  }

  // 언어별 국기 코드 반환 함수
  const getLanguageFlag = (language: string) => {
    const lang = language.toLowerCase()
    if (lang === 'kr' || lang === 'ko' || lang === '한국어') return 'KR'
    if (lang === 'en' || lang === '영어') return 'US'
    if (lang === 'jp' || lang === '일본어') return 'JP'
    if (lang === 'cn' || lang === '중국어') return 'CN'
    return 'US' // 기본값
  }


  // 총 인원 계산
  const totalPeople = reservations.reduce((sum, reservation) => sum + (reservation.total_people || 0), 0)
  
  // 아코디언 토글 함수
  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }
  
  // 가이드 구성 타입 판단 함수
  const getGuideConfiguration = () => {
    if (!tour?.tour_guide_id) return { type: 'none', label: t('guideConfig.unassigned'), color: 'text-gray-500' }
    
    if (tour.assistant_id) {
      // 두 명의 가이드가 있는 경우
      return { type: 'two-guides', label: t('guideConfig.twoGuides'), color: 'text-blue-600' }
    } else {
      // 가이드 1명만 있는 경우 (가이드 + 드라이버)
      return { type: 'guide-driver', label: t('guideConfig.oneGuideDriver'), color: 'text-green-600' }
    }
  }
  
  // 가이드/어시스턴트 이름 가져오기 함수
  const getTeamMemberName = (email: string | null) => {
    if (!email) return t('unassigned')
    
    const member = teamMembers.find(m => m.email === email)
    if (!member) return email // 팀 멤버 정보가 없으면 이메일 표시
    
    // 한국어 페이지에서는 name_ko, 영어 페이지에서는 name_en 표시
    if (locale === 'ko') {
      return member.name_ko || member.name_en || email
    } else {
      return member.name_en || member.name_ko || email
    }
  }

  // 팀 멤버 전화번호 가져오기 함수
  const getTeamMemberPhone = (email: string | null) => {
    if (!email) return null
    
    const member = teamMembers.find(m => m.email === email)
    return member?.phone || null
  }

  
  // 투어명 가져오기 함수
  const getProductName = () => {
    if (!product) return tour?.product_id || t('noProductInfo')
    
    // 한국어 페이지에서는 name, 영어 페이지에서는 name_en 표시
    if (locale === 'ko') {
      return product.name || product.name_en || product.id
    } else {
      return product.name_en || product.name || product.id
    }
  }
  
  // 가이드 구성 라벨 가져오기 함수
  const getGuideConfigurationLabel = () => {
    if (!tour?.tour_guide_id) {
      return t('noGuideAssigned')
    }
    
    if (tour.assistant_id) {
      // 두 명의 가이드가 있는 경우
      return t('twoGuides')
    } else {
      // 가이드 1명만 있는 경우 (가이드 + 드라이버)
      return t('oneGuideDriver')
    }
  }

  // 배정 상태 업데이트 함수 (가이드가 확인/거절)
  const handleAssignmentResponse = useCallback(async (status: 'confirmed' | 'rejected') => {
    if (!tour || !currentUserEmail) return

    // 가이드가 자신에게 배정된 투어인지 확인
    const isAssignedGuide = tour.tour_guide_id === currentUserEmail || tour.assistant_id === currentUserEmail
    if (!isAssignedGuide) {
      alert(locale === 'ko' ? '배정된 가이드만 확인/거절할 수 있습니다.' : 'Only assigned guides can confirm or reject.')
      return
    }

    // assignment_status가 'assigned'인 경우에만 확인/거절 가능
    const currentStatus = (tour as TourRow & { assignment_status?: string }).assignment_status
    if (currentStatus !== 'assigned') {
      alert(locale === 'ko' ? '배정 대기 중인 투어만 확인/거절할 수 있습니다.' : 'Only tours with assigned status can be confirmed or rejected.')
      return
    }

    try {
      const { error } = await supabase
        .from('tours')
        .update({ assignment_status: status } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error updating assignment status:', error)
        alert(locale === 'ko' ? '배정 상태 업데이트 중 오류가 발생했습니다.' : 'Error updating assignment status.')
        return
      }

      // 로컬 상태 업데이트
      setTour((prev: TourRow | null) =>
        prev ? ({ ...prev, assignment_status: status } as TourRow) : null
      )
      
      alert(locale === 'ko' 
        ? (status === 'confirmed' ? '배정을 확인했습니다.' : '배정을 거절했습니다.')
        : (status === 'confirmed' ? 'Assignment confirmed.' : 'Assignment rejected.')
      )
    } catch (error) {
      console.error('Error updating assignment status:', error)
      alert(locale === 'ko' ? '배정 상태 업데이트 중 오류가 발생했습니다.' : 'Error updating assignment status.')
    }
  }, [tour, currentUserEmail, locale])

  // 날짜 시간 형식 변환 함수
  const formatDateTime = (dateTimeString: string | null) => {
    if (!dateTimeString) return t('tbd')
    
    try {
      const date = new Date(dateTimeString)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const year = String(date.getFullYear()).slice(-2)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${month}/${day}/${year} ${hours}:${minutes}`
    } catch {
      return dateTimeString
    }
  }

  /** DB `ticket_bookings.time` 표시 (입장권 부킹) */
  const formatTicketBookingTime = (time: string | null | undefined) => {
    if (time == null || String(time).trim() === '') return t('timeTbd')
    const hhmm = timeToHHmm(String(time))
    const base = hhmm || String(time).substring(0, 5)
    if (locale === 'en') return formatTimeWithAMPM(base) || base
    return base
  }

  // MDGCSUNRISE 상품의 일출 시간 기반 투어 시간 계산 함수
  const calculateSunriseTourTimes = useCallback(async (tourDate: string, durationHours: number = 8) => {
    try {
      const { getSunriseSunsetData } = await import('@/lib/weatherApi')
      const data = await getSunriseSunsetData('Grand Canyon South Rim', tourDate)
      
      if (data && data.sunrise) {
        const sunriseTime = data.sunrise
        const [sunriseHours, sunriseMinutes] = sunriseTime.split(':').map(Number)
        
        // 투어 시작 시간: 일출 시간에서 8시간 빼기 (전날 밤)
        const tourStartHours = (sunriseHours - 8 + 24) % 24
        const tourStartMinutes = sunriseMinutes
        
        // 투어 종료 시간: 일출 시간에서 duration 시간 더하기
        const tourEndHours = (sunriseHours + durationHours) % 24
        const tourEndMinutes = sunriseMinutes
        
        // 날짜 계산
        const tourDateObj = new Date(tourDate + 'T00:00:00')
        const startDate = new Date(tourDateObj)
        const endDate = new Date(tourDateObj)
        
        // 시작 시간이 전날이면 날짜를 하루 빼기
        if (sunriseHours - 8 < 0) {
          startDate.setDate(startDate.getDate() - 1)
        }
        
        // 종료 시간이 다음날이면 날짜를 하루 더하기
        if (sunriseHours + durationHours >= 24) {
          endDate.setDate(endDate.getDate() + 1)
        }
        
        return {
          startTime: `${startDate.toISOString().split('T')[0]} ${String(tourStartHours).padStart(2, '0')}:${String(tourStartMinutes).padStart(2, '0')}`,
          endTime: `${endDate.toISOString().split('T')[0]} ${String(tourEndHours).padStart(2, '0')}:${String(tourEndMinutes).padStart(2, '0')}`,
          sunriseTime: sunriseTime
        }
      }
      
      return {
        startTime: `${tourDate} 22:00`,
        endTime: `${tourDate} 06:00`,
        sunriseTime: '06:00'
      }
    } catch (error) {
      console.error(locale === 'ko' ? '일출 투어 시간 계산 실패:' : 'Failed to calculate sunrise tour time:', error)
      return {
        startTime: `${tourDate} 22:00`,
        endTime: `${tourDate} 06:00`,
        sunriseTime: '06:00'
      }
    }
  }, [locale])

  // 투어 시간 계산 (MDGCSUNRISE 상품의 경우 일출 시간 기반)
  useEffect(() => {
    const calcTourTimes = async () => {
      if (tour?.tour_date && product) {
        if (tour.product_id === 'MDGCSUNRISE') {
          // MDGCSUNRISE 상품의 경우 일출 시간 기반으로 계산
          const durationHours = 8 // MDGCSUNRISE는 기본 8시간 투어
          const tourTimes = await calculateSunriseTourTimes(tour.tour_date, durationHours)
          setCalculatedTourTimes(tourTimes)
        } else {
          // 다른 상품의 경우 기본값으로 설정
          setCalculatedTourTimes(null)
        }
      }
    }
    calcTourTimes()
  }, [tour?.tour_date, tour?.product_id, product, calculateSunriseTourTimes])
  
  // 탭 변경 함수
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    // 탭 변경 시에는 섹션 상태를 강제로 변경하지 않음
    // 사용자가 collapse한 섹션은 그대로 유지
  }
  
  // 아코디언 섹션 컴포넌트
  const AccordionSection = ({ 
    id, 
    title, 
    icon: Icon, 
    children,
    headerButton,
    alwaysExpanded = false,
  }: { 
    id: string
    title: string
    icon: LucideIcon
    children: React.ReactNode
    headerButton?: React.ReactNode
    /** 모바일 가이드 전용: 접기 없이 항상 본문 표시 */
    alwaysExpanded?: boolean
  }) => {
    const isExpanded = alwaysExpanded || expandedSections.has(id)
    const handleToggle = () => {
      if (alwaysExpanded) return
      toggleSection(id)
    }
    
    return (
      <div className="bg-white rounded-lg shadow mb-3 sm:mb-4">
        <div className="flex items-center justify-between p-3 sm:p-4">
          <button
            type="button"
            onClick={handleToggle}
            disabled={alwaysExpanded}
            className={`flex items-center flex-1 text-left rounded -ml-3 sm:-ml-4 px-3 sm:px-4 py-2 -my-2 ${
              alwaysExpanded ? 'cursor-default' : 'hover:bg-gray-50 transition-colors'
            }`}
          >
            <Icon className="w-5 h-5 text-gray-400 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </button>
          <div className="flex items-center space-x-2">
            {headerButton}
            {!alwaysExpanded && (
              <button
                type="button"
                onClick={handleToggle}
                className="p-1 hover:bg-gray-50 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
            )}
          </div>
        </div>
        {isExpanded && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            {children}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingTourInfo')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{locale === 'ko' ? '오류' : 'Error'}</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => router.push(`/${locale}/guide/tours`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {t('backToTourList')}
          </button>
        </div>
      </div>
    )
  }

  if (!tour) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{locale === 'ko' ? '투어를 찾을 수 없습니다' : 'Tour not found'}</h1>
          <button 
            onClick={() => router.push(`/${locale}/guide/tours`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {t('backToTourList')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2">
      {/* 헤더 - 모바일 최적화 */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/${locale}/guide/tours`)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('backToTourList')}
        </button>
      </div>

      {/* 모바일 탭 네비게이션 - 앱 스타일 */}
      <div className="lg:hidden mb-4">
        <div className="bg-white rounded-lg shadow p-2">
          <div className="flex space-x-2 overflow-x-auto pb-1">
            <button
              onClick={() => handleTabChange('overview')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <Clock className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{t('overview')}</span>
            </button>
            
            <button
              onClick={() => handleTabChange('schedule')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'schedule'
                  ? 'bg-green-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <MapPin className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{t('schedule')}</span>
            </button>
            
            <button
              onClick={() => handleTabChange('bookings')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'bookings'
                  ? 'bg-purple-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <Hotel className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{t('booking')}</span>
            </button>
            
            <button
              onClick={() => handleTabChange('photos')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'photos'
                  ? 'bg-orange-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <Camera className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{t('photos')}</span>
            </button>
            
            <button
              onClick={() => handleTabChange('chat')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'bg-teal-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <MessageSquare className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{t('chat')}</span>
            </button>
            
            <button
              onClick={() => handleTabChange('expenses')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'expenses'
                  ? 'bg-yellow-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <Calculator className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{t('expenses')}</span>
        </button>
        
            <button
              onClick={() => handleTabChange('report')}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'report'
                  ? 'bg-red-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
              }`}
            >
              <FileText className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{t('report')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 최적화된 아코디언 레이아웃 */}
      <div className="space-y-3 sm:space-y-4">
        {/* 투어 기본 정보 - 개요 탭에만 표시 */}
        <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white rounded-lg shadow mb-3 sm:mb-4">
            <div className="flex items-center justify-between p-3 sm:p-4">
              <button
                onClick={() => toggleSection('tour-info')}
                className="flex items-center flex-1 text-left hover:bg-gray-50 transition-colors rounded -ml-3 sm:-ml-4 px-3 sm:px-4 py-2 -my-2"
              >
                <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">{t('tourInfo')}</h2>
              </button>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'rejected' ? 'bg-red-100 text-red-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'recruiting' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {(() => {
                    const status = (tour as TourRow & { assignment_status?: string }).assignment_status
                    if (status === 'assigned') return locale === 'ko' ? '배정됨' : 'Assigned'
                    if (status === 'confirmed') return locale === 'ko' ? '확인됨' : 'Confirmed'
                    if (status === 'rejected') return locale === 'ko' ? '거절됨' : 'Rejected'
                    return status || t('assignmentStatus')
                  })()}
                </span>
                {/* 배정 확인/거절 버튼 (assignment_status가 'assigned'이고 현재 사용자가 가이드로 배정된 경우에만 표시) */}
                {(tour as TourRow & { assignment_status?: string }).assignment_status === 'assigned' && 
                 (tour.tour_guide_id === currentUserEmail || tour.assistant_id === currentUserEmail) && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(locale === 'ko' ? '배정을 확인하시겠습니까?' : 'Confirm assignment?')) {
                          handleAssignmentResponse('confirmed')
                        }
                      }}
                      className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                    >
                      {locale === 'ko' ? '확인' : 'Confirm'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(locale === 'ko' ? '배정을 거절하시겠습니까?' : 'Reject assignment?')) {
                          handleAssignmentResponse('rejected')
                        }
                      }}
                      className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                    >
                      {locale === 'ko' ? '거절' : 'Reject'}
                    </button>
                  </div>
                )}
                <button
                  onClick={() => toggleSection('tour-info')}
                  className="p-1 hover:bg-gray-50 rounded transition-colors"
                >
                  {expandedSections.has('tour-info') ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            {expandedSections.has('tour-info') && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="space-y-2">
                  {/* 투어 제목과 총 balance */}
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-gray-900">
                      {getProductName()}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">{tCommon('totalBalance')}</div>
                      <div className="text-lg font-bold text-green-600">
                        ${getTotalBalance().toLocaleString()}
                      </div>
                    </div>
                  </div>
            
            {/* 날짜, 인원, 차량 - 뱃지 스타일 */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                📅 {tour.tour_date}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-green-100 text-green-800">
                👥 {totalPeople}{locale === 'ko' ? t('people') : ' people'}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-purple-100 text-purple-800">
                🚗 {vehicle?.vehicle_number || t('unassigned')}
              </span>
            </div>
            
            {/* 가이드 정보 - 뱃지 스타일 */}
            <div className="flex flex-wrap gap-2">
              {getTeamMemberPhone(tour.tour_guide_id) ? (
                  <a 
                    href={`tel:${getTeamMemberPhone(tour.tour_guide_id) || ''}`}
                    className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors cursor-pointer"
                  >
                  👨‍💼 {getTeamMemberName(tour.tour_guide_id)}
                </a>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-orange-100 text-orange-800">
                  👨‍💼 {getTeamMemberName(tour.tour_guide_id)}
                </span>
              )}
              {tour.assistant_id && (
                getTeamMemberPhone(tour.assistant_id) ? (
                  <a 
                    href={`tel:${getTeamMemberPhone(tour.assistant_id) || ''}`}
                    className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-teal-100 text-teal-800 hover:bg-teal-200 transition-colors cursor-pointer"
                  >
                    👨‍💼 {getTeamMemberName(tour.assistant_id)}
                  </a>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-teal-100 text-teal-800">
                    👨‍💼 {getTeamMemberName(tour.assistant_id)}
                  </span>
                )
              )}
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-medium ${
                getGuideConfiguration().type === 'two-guides' ? 'bg-blue-100 text-blue-800' :
                getGuideConfiguration().type === 'guide-driver' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                👥 {getGuideConfigurationLabel()}
              </span>
            </div>
            
            {/* 티켓 부킹 정보 - 회사별 요약 + 건별 시간·RN# */}
            {ticketBookings.length > 0 && (() => {
              const companyMap = new Map<
                string,
                { totalEa: number; rows: { sortKey: string; timeLabel: string; rn: string; ea: number }[] }
              >()
              ticketBookings.forEach(booking => {
                const company = normalizeTicketCompanyName(booking.company)
                const ea = booking.ea || 0
                const timeLabel = formatTicketBookingTime(booking.time)
                const sortKey =
                  timeToHHmm(String(booking.time ?? '')) || String(booking.time || '').substring(0, 8) || '00:00'
                const rn = (booking.rn_number && String(booking.rn_number).trim()) || ''

                if (!companyMap.has(company)) {
                  companyMap.set(company, { totalEa: 0, rows: [] })
                }
                const companyData = companyMap.get(company)!
                companyData.totalEa += ea
                companyData.rows.push({ sortKey, timeLabel, rn, ea })
              })

              return (
                <div className="space-y-2">
                  <hr className="border-gray-200" />
                  {Array.from(companyMap.entries())
                    .sort(([companyA], [companyB]) => companyA.localeCompare(companyB))
                    .map(([company, { totalEa, rows }]) => (
                      <div key={company} className="text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-gray-700 font-medium">{company}</span>
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                            👥 {totalEa}
                          </span>
                        </div>
                        <ul className="mt-1 ml-1 text-xs text-gray-600 space-y-0.5 list-disc list-inside">
                          {[...rows]
                            .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
                            .map((row, idx) => (
                              <li key={`${company}-${idx}-${row.sortKey}`}>
                                {t('bookingTime')}: {row.timeLabel} · {t('rnNumber')}:{' '}
                                {row.rn || t('noInfo')} · {t('ea')}: {row.ea}
                              </li>
                            ))}
                        </ul>
                      </div>
                    ))}
                </div>
              )
            })()}
            
                  {/* 거주 상태별 인원 수 합산 */}
                  {productShowsResidentStatusSectionByCode(product?.product_code) && reservations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {tCommon('residentStatusByCount')}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="w-3 h-3 rounded-full bg-green-600"></span>
                            <span className="text-xs font-medium text-green-900">{tCommon('statusUsResident')}</span>
                          </div>
                          <div className="text-lg font-semibold text-green-900">
                            {residentStatusSummary.usResident}{locale === 'ko' ? '명' : ''}
                          </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                            <span className="text-xs font-medium text-blue-900">{tCommon('statusNonResident')}</span>
                          </div>
                          <div className="text-lg font-semibold text-blue-900">
                            {residentStatusSummary.nonResident}{locale === 'ko' ? '명' : ''}
                          </div>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                            <span className="text-xs font-medium text-purple-900">{locale === 'ko' ? '패스 커버' : 'Pass Covered'}</span>
                          </div>
                          <div className="text-lg font-semibold text-purple-900">
                            {residentStatusSummary.passCoveredCount}{locale === 'ko' ? '명' : ''}
                          </div>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                            <span className="text-xs font-medium text-purple-900">{locale === 'ko' ? '패스 장수' : 'Pass Count'}</span>
                          </div>
                          <div className="text-lg font-semibold text-purple-900">
                            {residentStatusSummary.nonResidentWithPass}{locale === 'ko' ? '장' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        {tCommon('total')}: {residentStatusSummary.usResident + residentStatusSummary.nonResident + residentStatusSummary.passCoveredCount}{locale === 'ko' ? '명' : ` ${tCommon('people')}`}
                      </div>
                    </div>
                  )}
                  
                  {/* 출발 - 종료 시간 */}
                  <div className="text-gray-700">
                    {calculatedTourTimes ? (
                      <>
                        {formatDateTime(calculatedTourTimes.startTime)} - {formatDateTime(calculatedTourTimes.endTime)}
                        <div className="text-xs text-gray-500 mt-1">
{locale === 'ko' ? '일출 시간' : 'Sunrise time'}: {calculatedTourTimes.sunriseTime}
                        </div>
                      </>
                    ) : (
                      `${formatDateTime(tour.tour_start_datetime)} - ${formatDateTime(tour.tour_end_datetime)}`
                    )}
                  </div>
                </div>
              </div>
            )}
                </div>
              </div>

        {/* 밤도깨비 투어 특별 정보 - 개요 탭에만 표시 */}
        <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
          <TourWeather 
            tourDate={tour.tour_date} 
            productId={(tour as TourRow & { product_id?: string }).product_id} 
          />
        </div>


        {/* 픽업 스케줄 - 오버뷰 탭에 표시 */}
        <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection 
            id="pickup-schedule" 
            title={t('pickupSchedule')} 
            icon={Clock}
            headerButton={(() => {
              const groupedByHotel = groupReservationsByPickupHotel(reservations)

              const getActualPickupDateTime = (pickupTime: string | null) => {
                if (!pickupTime) return new Date(tour.tour_date + 'T00:00:00').getTime()
                const time = pickupTime.substring(0, 5)
                const timeHour = parseInt(time.split(':')[0])
                let displayDate = tour.tour_date
                if (timeHour >= 21) {
                  const date = new Date(tour.tour_date)
                  date.setDate(date.getDate() - 1)
                  displayDate = date.toISOString().split('T')[0]
                }
                return new Date(displayDate + 'T' + time + ':00').getTime()
              }

              const hotelEntries = Object.entries(groupedByHotel) as [string, ReservationRow[]][]
              const sortedHotelEntries = hotelEntries.sort(([, reservationsA], [, reservationsB]) => {
                const firstPickupA = reservationsA[0]?.pickup_time || '00:00'
                const firstPickupB = reservationsB[0]?.pickup_time || '00:00'
                return getActualPickupDateTime(firstPickupA) - getActualPickupDateTime(firstPickupB)
              })

              const hotelLocations: string[] = []
              sortedHotelEntries.forEach(([hotelId]) => {
                if (hotelId === GUIDE_UNASSIGNED_PICKUP_HOTEL_KEY) return
                const hotel = pickupHotels.find(h => h.id === hotelId)
                if (hotel) {
                  if (hotel.pin) {
                    hotelLocations.push(hotel.pin)
                  } else if (hotel.address) {
                    hotelLocations.push(hotel.address)
                  }
                }
              })

              if (hotelLocations.length > 0) {
                let url = `https://www.google.com/maps/dir/?api=1`
                url += `&origin=${encodeURIComponent(hotelLocations[0])}`
                if (hotelLocations.length > 1) {
                  url += `&destination=${encodeURIComponent(hotelLocations[hotelLocations.length - 1])}`
                }
                if (hotelLocations.length > 2) {
                  const waypoints = hotelLocations.slice(1, -1)
                  url += `&waypoints=${waypoints.map(wp => encodeURIComponent(wp)).join('|')}`
                }

                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(url, '_blank')
                    }}
                    className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors flex items-center"
                    title={locale === 'ko' ? '전체 픽업 경로 구글맵 보기' : 'View All Pickup Route on Google Maps'}
                  >
                    <Car className="w-4 h-4" />
                  </button>
                )
              }
              return null
            })()}
          >
            <div className="space-y-4">
              {(() => {
                const groupedByHotel = groupReservationsByPickupHotel(reservations)

                // 호텔 그룹을 실제 픽업 날짜+시간으로 정렬 (21시 이후는 전날로 계산)
                const getActualPickupDateTime = (pickupTime: string | null) => {
                  if (!pickupTime) return new Date(tour.tour_date + 'T00:00:00').getTime()
                  const time = pickupTime.substring(0, 5)
                  const timeHour = parseInt(time.split(':')[0])
                  let displayDate = tour.tour_date
                  // 21시 이후면 전날
                  if (timeHour >= 21) {
                    const date = new Date(tour.tour_date)
                    date.setDate(date.getDate() - 1)
                    displayDate = date.toISOString().split('T')[0]
                  }
                  return new Date(displayDate + 'T' + time + ':00').getTime()
                }

                const hotelEntriesInner = Object.entries(groupedByHotel) as [string, ReservationRow[]][]
                const sortedHotelEntries = hotelEntriesInner.sort(([, reservationsA], [, reservationsB]) => {
                  const firstPickupA = reservationsA[0]?.pickup_time || '00:00'
                  const firstPickupB = reservationsB[0]?.pickup_time || '00:00'
                  return getActualPickupDateTime(firstPickupA) - getActualPickupDateTime(firstPickupB)
                })

                // 모든 픽업 호텔을 경유지로 하는 구글맵 URL 생성
                const hotelLocations: string[] = []
                sortedHotelEntries.forEach(([hotelId]) => {
                  if (hotelId === GUIDE_UNASSIGNED_PICKUP_HOTEL_KEY) return
                  const hotel = pickupHotels.find(h => h.id === hotelId)
                  if (hotel) {
                    // pin(좌표)이 있으면 우선 사용, 없으면 address 사용
                    if (hotel.pin) {
                      hotelLocations.push(hotel.pin)
                    } else if (hotel.address) {
                      hotelLocations.push(hotel.address)
                    }
                  }
                })

                return sortedHotelEntries.map(([hotelId, hotelReservations]) => {
                  const hotel = pickupHotels.find(h => h.id === hotelId)
                  const isUnassignedHotel = hotelId === GUIDE_UNASSIGNED_PICKUP_HOTEL_KEY
                  const sortedReservations = [...hotelReservations].sort((a: ReservationRow, b: ReservationRow) => {
                    return getActualPickupDateTime(a.pickup_time) - getActualPickupDateTime(b.pickup_time)
                  })

                  return (
                    <div key={hotelId} className="space-y-4">
                      {/* 구분선 - 픽업 시간 위에 */}
                      <div className="border-t border-gray-200"></div>
                      
                      {/* 호텔 정보 헤더 - 3줄 구조 */}
                      <div className="space-y-2">
                        {/* 1줄: 픽업 시간 - 더 크게 */}
                        <div className="text-blue-600 font-bold text-lg">
                          {(() => {
                            if (!sortedReservations[0]?.pickup_time) {
                              return `${t('tbd')} ${tour.tour_date}`
                            }
                            
                            const pickupTime = sortedReservations[0].pickup_time.substring(0, 5)
                            const timeHour = parseInt(pickupTime.split(':')[0])
                            
                            // 오후 9시(21:00) 이후면 날짜를 하루 빼기
                            let displayDate = tour.tour_date
                            if (timeHour >= 21) {
                              const date = new Date(tour.tour_date)
                              date.setDate(date.getDate() - 1)
                              displayDate = date.toISOString().split('T')[0]
                            }
                            
                            return `${formatTimeWithAMPM(pickupTime)} ${displayDate}`
                          })()}
                        </div>
                        
                        {/* 2줄: 호텔 정보 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Hotel className={`w-4 h-4 ${isUnassignedHotel ? 'text-amber-600' : 'text-blue-600'}`} />
                            <span className={`font-semibold ${isUnassignedHotel ? 'text-amber-900' : 'text-gray-900'}`}>
                              {isUnassignedHotel ? t('pickupHotelUnassigned') : (hotel?.hotel || t('noHotelInfo'))}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              isUnassignedHotel ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-800'
                            }`}>
                              <Users className="w-3 h-3 mr-1" />
                              {sortedReservations.reduce(
                                (sum: number, r: ReservationRow) => sum + (r.total_people || 0),
                                0
                              )}
                            </span>
                          </div>
                          {!isUnassignedHotel && (hotel?.link || (hotel as PickupHotel & { pin?: string })?.pin) && (
                            <a 
                              href={hotel?.link || `https://www.google.com/maps?q=${(hotel as PickupHotel & { pin?: string })?.pin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 transition-colors"
                              title={locale === 'ko' ? '지도에서 보기' : 'View on map'}
                            >
                              <MapPin className="w-4 h-4" />
                            </a>
                          )}
                        </div>

                        {/* 3줄: 픽업 위치 정보 */}
                        {!isUnassignedHotel && hotel?.pick_up_location && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-gray-600">{hotel.pick_up_location}</span>
                          </div>
                        )}
                      </div>

                      {/* 예약자 카드 목록 */}
                      <div className="space-y-3">
                        {sortedReservations.map((reservation: ReservationRow) => {
                          const customer = getCustomerInfo(reservation.customer_id || '')
                          return (
                            <div key={reservation.id}>
                              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                {/* 상단: 언어·채널·이름·인원(왼쪽) / 선불 팁(오른쪽, 픽업 달력일 기준 당일·과거만) */}
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center space-x-2 min-w-0">
                                    {/* 언어별 국기 아이콘 */}
                                    {customer?.language && (
                                      <ReactCountryFlag
                                        countryCode={getLanguageFlag(customer.language)}
                                        svg
                                        style={{
                                          width: '16px',
                                          height: '12px',
                                          borderRadius: '2px'
                                        }}
                                      />
                                    )}

                                    {/* 채널 아이콘 */}
                                    {reservation.channel_id && (() => {
                                      const channel = channels.find(c => c.id === reservation.channel_id)
                                      return channel?.favicon_url ? (
                                        <img
                                          src={channel.favicon_url}
                                          alt={`${channel.name} favicon`}
                                          className="h-4 w-4 rounded flex-shrink-0"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement
                                            target.style.display = 'none'
                                            const parent = target.parentElement
                                            if (parent) {
                                              const fallback = document.createElement('div')
                                              fallback.className =
                                                'h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0'
                                              fallback.innerHTML = '🌐'
                                              parent.appendChild(fallback)
                                            }
                                          }}
                                        />
                                      ) : (
                                        <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                                          🌐
                                        </div>
                                      )
                                    })()}

                                    <div className="font-medium text-gray-900 truncate">
                                      {formatCustomerNameEnhanced(customer as any, locale)}
                                    </div>
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 shrink-0">
                                      <Users className="w-3 h-3 mr-1" />
                                      {reservation.total_people || 0}
                                    </span>
                                  </div>
                                  {tour &&
                                    isGuidePrepaidTipAllowedByPickupCalendar(
                                      tour.tour_date,
                                      reservation.pickup_time
                                    ) &&
                                    (() => {
                                      const grossTip = getReservationPrepaidTip(reservation.id)
                                      if (grossTip <= 0) return null
                                      const displayTip = getDisplayPrepaidTipForPickupCard(
                                        reservation.id
                                      )
                                      if (displayTip <= 0) return null
                                      const row = reservationPricing.find(
                                        (p) => p.reservation_id === reservation.id
                                      )
                                      const cur = row?.currency || 'USD'
                                      return (
                                        <div
                                          className="text-right shrink-0"
                                          title={t('prepaidTipShareTitle')}
                                        >
                                          <div className="text-[10px] text-gray-500 leading-tight">
                                            {t('prepaidTipShareShort')}
                                          </div>
                                          <div className="text-sm font-semibold text-amber-800 tabular-nums">
                                            {cur === 'KRW'
                                              ? formatGuidePricingAmount(displayTip, cur)
                                              : formatGuideTipUsd2(displayTip)}
                                          </div>
                                        </div>
                                      )
                                    })()}
                                </div>

                                {/* 중단: 초이스와 연락처 아이콘 */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm text-gray-600">
                                    {(() => {
                                      // reservation_choices 테이블에서 가져온 초이스 데이터 사용 (예약 페이지와 동일)
                                      const choices = reservationChoicesMap.get(reservation.id)
                                      
                                      if (!choices || choices.length === 0) {
                                        return t('noOptions')
                                      }
                                      
                                      // 선택된 옵션 이름들을 표시
                                      const optionNames = choices.map((choice) => {
                                        // 로케일에 따라 한국어 또는 영어 이름 표시
                                        return locale === 'ko' 
                                          ? (choice.option_name_ko || choice.option_name)
                                          : (choice.option_name || choice.option_name_ko)
                                      }).filter(Boolean)
                                      
                                      if (optionNames.length === 0) {
                                        return t('noOptions')
                                      }
                                      
                                      return optionNames.join(', ')
                                    })()}
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    {/* Balance 표시 */}
                                    <div className="text-right">
                                      <div className="text-xs text-gray-500">Balance</div>
                                      <div className="text-sm font-semibold text-green-600">
                                        ${getReservationBalance(reservation.id).toLocaleString()}
                                      </div>
                                    </div>
                                    
                                    {customer?.phone && (
                                      <a 
                                        href={`tel:${customer.phone}`}
                                        className="text-green-600 hover:text-green-700 transition-colors"
                                        title={customer.phone}
                                      >
                                        <Phone className="w-4 h-4" />
                                      </a>
                                    )}
                                    {customer?.email && (
                                      <a 
                                        href={`mailto:${customer.email}`}
                                        className="text-blue-600 hover:text-blue-700 transition-colors"
                                        title={customer.email}
                                      >
                                        <Mail className="w-4 h-4" />
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {/* 하단: event_note */}
                                {(reservation as ReservationRow & { event_note?: string }).event_note && (
                                  <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                                    {(reservation as ReservationRow & { event_note: string }).event_note}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}
              {reservations.length === 0 && (
                <p className="text-gray-500 text-center py-4">{t('noPickupSchedule')}</p>
              )}
            </div>
          </AccordionSection>
        </div>

        {/* 투어 스케줄 - 스케줄 탭에만 표시 */}
        {tour.product_id && (
          <div className={`${activeTab === 'schedule' ? 'block' : 'hidden'} lg:block`}>
            <div className="bg-white rounded-lg shadow mb-3 sm:mb-4 p-3 sm:p-4">
              <TourScheduleSection 
                productId={tour.product_id} 
                teamType={tour.team_type as 'guide+driver' | '2guide' | null}
                locale={locale}
                showAllSchedules={true}
                currentUserEmail={currentUserEmail ?? null}
                tourGuideId={tour.tour_guide_id}
                assistantId={tour.assistant_id}
              />
            </div>
          </div>
        )}

        {/* 투어 메모 - 개요 탭에만 표시 */}
        {(tour as { tour_info?: string }).tour_info && (
          <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
            <AccordionSection id="tour-memo" title={t('tourMemo')} icon={FileText}>
              <p className="text-gray-700 whitespace-pre-wrap">{(tour as unknown as { tour_info: string }).tour_info}</p>
            </AccordionSection>
          </div>
        )}
      </div>

      {/* 추가 섹션들 - 아코디언 형태 */}
      <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">

        {/* 부킹 관리 - 부킹 탭에만 표시 */}
        <div className={`${activeTab === 'bookings' ? 'block' : 'hidden'} lg:block`}>
        <AccordionSection id="bookings" title={t('bookingManagement')} icon={Hotel} alwaysExpanded={isGuideMobileLayout}>
          {/* 호텔 부킹 */}
          {tourHotelBookings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">{t('hotelBooking')}</h3>
              <div className="space-y-3">
                {tourHotelBookings.map((booking) => {
                  const row = booking as TourHotelBooking & {
                    hotel_name?: string | null
                    room_count?: number | null
                    notes?: string | null
                    note?: string | null
                  }
                  const hotelTitle =
                    (row.hotel && String(row.hotel).trim()) ||
                    (row.hotel_name && String(row.hotel_name).trim()) ||
                    t('noInfo')
                  const roomsVal = row.rooms ?? row.room_count
                  const cityVal = row.city && String(row.city).trim()
                  const resName = row.reservation_name && String(row.reservation_name).trim()
                  const rnVal = row.rn_number && String(row.rn_number).trim()
                  const memoVal =
                    (row.note && String(row.note).trim()) ||
                    (row.notes && String(row.notes).trim()) ||
                    ''

                  return (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm sm:text-base">{hotelTitle}</h4>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'confirmed'
                              ? 'bg-green-100 text-green-800'
                              : booking.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          {t('city')}: {cityVal || t('noInfo')}
                        </p>
                        <p>
                          {t('bookerName')}: {resName || t('noInfo')}
                        </p>
                        <p>
                          {t('rnNumber')}: {rnVal || t('noInfo')}
                        </p>
                        <p>
                          {t('roomCount')}: {roomsVal != null ? roomsVal : t('noInfo')}
                        </p>
                        <p>
                          {t('checkIn')}: {booking.check_in_date}
                        </p>
                        <p>
                          {t('checkOut')}: {booking.check_out_date}
                        </p>
                        {memoVal ? (
                          <p className="mt-2">
                            {t('memo')}: {memoVal}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 티켓 부킹 — 건별 시간·RN#·EA (가이드 확인용) */}
          {ticketBookings.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">{t('ticketBooking')}</h3>
              <div className="space-y-3">
                {[...ticketBookings]
                  .sort((a, b) => {
                    const ta = timeToHHmm(String(a.time ?? '')) || String(a.time || '').substring(0, 8) || ''
                    const tb = timeToHHmm(String(b.time ?? '')) || String(b.time || '').substring(0, 8) || ''
                    const byTime = ta.localeCompare(tb)
                    if (byTime !== 0) return byTime
                    return normalizeTicketCompanyName(a.company).localeCompare(normalizeTicketCompanyName(b.company))
                  })
                  .map(booking => {
                    const rnVal = booking.rn_number && String(booking.rn_number).trim()
                    return (
                      <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                            {normalizeTicketCompanyName(booking.company)}
                          </h4>
                          <span
                            className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                              booking.status === 'confirmed'
                                ? 'bg-green-100 text-green-800'
                                : booking.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {booking.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            {t('bookingTime')}: {formatTicketBookingTime(booking.time)}
                          </p>
                          <p>
                            {t('rnNumber')}: {rnVal || t('noInfo')}
                          </p>
                          <p>
                            {t('ea')}: {booking.ea ?? 0}
                          </p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {tourHotelBookings.length === 0 && ticketBookings.length === 0 && (
            <p className="text-gray-500">{t('noBookingInfo')}</p>
          )}
        </AccordionSection>
        </div>

        {/* 투어 사진 - 사진 탭에만 표시 */}
        <div className={`${activeTab === 'photos' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="photos" title={t('tourPhotos')} icon={Camera} alwaysExpanded={isGuideMobileLayout}>
          <TourPhotoUpload tourId={tour.id} uploadedBy={currentUserEmail || ''} />
          </AccordionSection>
        </div>

        {/* 채팅 - 채팅 탭에만 표시 */}
        <div className={`${activeTab === 'chat' ? 'block' : 'hidden'} lg:block`}>
          {tour && tour.tour_date && currentUserEmail ? (
            <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden bg-white">
              <TourChatRoom
                tourId={tour.id}
                guideEmail={currentUserEmail}
                tourDate={tour.tour_date}
                isPublicView={false}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 bg-white rounded-lg shadow">
              <MessageSquare className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{locale === 'ko' ? '투어 채팅방' : 'Tour Chat Room'}</h3>
              <p className="text-sm text-gray-500 mb-4">{locale === 'ko' ? '투어 정보를 불러오는 중...' : 'Loading tour information...'}</p>
            </div>
          )}
        </div>

        {/* 정산 관리 - 정산 탭에만 표시 */}
        <div className={`${activeTab === 'expenses' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="expenses" title={t('expenseManagement')} icon={Calculator} alwaysExpanded={isGuideMobileLayout}>
          <TourExpenseManager
            tourId={tour.id}
            tourDate={tour.tour_date}
            productId={tour.product_id}
            submittedBy={currentUserEmail || ''}
            reservationIds={tour.reservation_ids || []}
            userRole={userRole || 'team_member'}
            allowReceiptOnlyUpload
            tourGuideFee={isTourCancelled(tour.tour_status) ? 0 : tour.guide_fee}
            tourAssistantFee={isTourCancelled(tour.tour_status) ? 0 : tour.assistant_fee}
            tourStatus={tour.tour_status}
          />
          </AccordionSection>
        </div>

        {/* 투어 리포트 - 리포트 탭에만 표시 */}
        <div className={`${activeTab === 'report' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection id="report" title={t('tourReport')} icon={FileText} alwaysExpanded={isGuideMobileLayout}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">{t('reportManagement')}</h3>
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title={t('addTourReport')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          <TourReportSection tourId={tour.id} productId={tour.product_id} />
          </div>
          </AccordionSection>
        </div>
      </div>

      {/* 투어 리포트 추가 모달 — z-index를 가이드 하단 푸터(z-50)보다 위로 (안 그러면 버튼이 푸터에 가려짐) */}
      {isReportModalOpen && (
        <div
          className="modal-inset-below-chrome bg-black/50"
          aria-modal="true"
          role="presentation"
        >
          {/* 헤더·모바일 푸터 바깥 영역만 사용 / sm+: 카드형 */}
          <div className="flex h-full max-h-full w-full max-w-none flex-col overflow-hidden bg-white sm:mx-auto sm:h-auto sm:max-h-[min(90vh,calc(100dvh-var(--header-height)-1.5rem))] sm:max-w-4xl sm:rounded-lg sm:shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-3 sm:px-4 md:px-6 md:py-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('addTourReport')}</h3>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <TourReportForm
                tourId={tour.id}
                productId={tour.product_id ?? undefined}
                variant="modal"
                onSuccess={() => {
                  setIsReportModalOpen(false)
                }}
                onCancel={() => setIsReportModalOpen(false)}
                locale={locale}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

