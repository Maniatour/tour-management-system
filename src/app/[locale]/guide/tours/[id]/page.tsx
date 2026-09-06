'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Hotel,
  MapPin,
  Clock,
  Users,
  Camera,
  Image as ImageIcon,
  MessageSquare,
  FileText,
  Calculator,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Car,
  User,
  Plus,
  Receipt,
  Share2,
  type LucideIcon,
} from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { isBrowserOffline, loadGuideSnapshot, saveGuideSnapshot } from '@/lib/guideOfflineStore'
import { chunkStrings } from '@/lib/supabaseInChunks'
import { useAuth } from '@/contexts/AuthContext'
import TourPhotoUpload, { type TourPhotoUploadHandle } from '@/components/TourPhotoUpload'
import { ChoiceOptionBadges, type ChoiceOptionBadgeItem } from '@/components/reservation/ChoiceOptionBadges'
import TourChatRoom from '@/components/TourChatRoom'
import TourChatModal from '@/components/TourChatModal'
import TourExpenseManager, { type TourExpenseManagerHandle } from '@/components/TourExpenseManager'
import TourReportSection from '@/components/TourReportSection'
import TourReportForm from '@/components/TourReportForm'
import { UncompletedTourReportReminderModal } from '@/components/guide/UncompletedTourReportReminderLayer'
import TourWeather from '@/components/TourWeather'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import { formatCustomerNameEnhanced } from '@/utils/koreanTransliteration'
import { formatTimeWithAMPM, timeToHHmm } from '@/lib/utils'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'
import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'
import {
  fetchPersonallyRespondedTourIds,
  respondToTourAssignment,
} from '@/lib/guideAssignmentStatus'
import {
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  normalizeReservationIds,
} from '@/utils/tourUtils'
import { fetchReservationOptionLinesBatch } from '@/lib/reservationOptionsForEmail'
import { resolveReservationChoicesBatch } from '@/lib/resolveReservationChoices'
import { teamMemberNameForLocale, teamMemberNickDisplayName } from '@/lib/teamMemberDisplayName'
import {
  adjustOptionTotalExcludingLegacyNonResident,
  getBalanceAmountForDisplay,
  resolveResidentFeeUsdForBalanceDisplay,
  withNormalizedBalanceAmountForDisplay,
} from '@/utils/reservationPricingBalance'
import {
  buildBalanceEnvelopeBreakdownLines,
  countResidentLinesFromCustomers,
  formatBalanceEnvelopeLine,
} from '@/utils/balanceEnvelopeBreakdown'
import { residentFeeAmountsFromPricingChoicesJson, residentFeeCountsFromPricingChoicesJson } from '@/utils/usResidentChoiceSync'
import {
  fetchGuideToursVisibleUntil,
  isTourDateVisibleToGuide,
} from '@/lib/guideToursVisibleUntil'
import { GuideBackupTourBadge } from '@/components/guide/GuideBackupTourBadge'
import { isGuideBackupTour } from '@/lib/guideBackupTour'
import GuidePickupChargeModal, {
  GuidePickupChargeButton,
  type GuidePickupChargeTarget,
} from '@/components/guide/GuidePickupChargeModal'
import { TOUR_REPORT_REQUIRED_FROM } from '@/lib/tourReportExtras'

// 타입 정의 (DB 스키마 기반) — 픽업 잔액 헬퍼보다 먼저 두어 타입 순서 유지
type TourRow = Database['public']['Tables']['tours']['Row']
type ReservationRow = Database['public']['Tables']['reservations']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
type PickupHotel = Database['public']['Tables']['pickup_hotels']['Row']
/** DB `nick` 컬럼 — generated types가 뒤처질 수 있어 교차 타입으로 보강 */
type Vehicle = Database['public']['Tables']['vehicles']['Row'] & { nick?: string | null }
type TourHotelBooking = Database['public']['Tables']['tour_hotel_bookings']['Row']
type TicketBooking = Database['public']['Tables']['ticket_bookings']['Row']
type TeamMember = {
  email: string
  name_ko: string | null
  name_en: string | null
  nick_name?: string | null
  phone?: string | null
}

/** 픽업 호텔 미지정 예약을 한 그룹으로 묶기 위한 키 (DB id와 충돌하지 않도록 함) */
const GUIDE_UNASSIGNED_PICKUP_HOTEL_KEY = '__guide_pickup_hotel_unassigned__'

type GuidePickupBalanceBreakdown = {
  displayBalance: number
  currency: string
  detailLines: string[]
}

/** 픽업 카드 잔금 라벨: 가이드 화면 로케일 기준 (봉투 인쇄는 고객 언어 유지) */
function guidePickupUseEnvelopeEnglish(pageLocale: string | null | undefined): boolean {
  const l = (pageLocale || '').toString().toLowerCase()
  return !(l === 'ko' || l.startsWith('ko-') || l === 'korean' || l === 'kr')
}

function formatGuideEnvelopeMoney(amount: number, currency: string): string {
  if (currency === 'KRW') return `₩${Math.round(amount).toLocaleString()}`
  return `$${amount.toFixed(2)}`
}

async function computeGuidePickupBalanceBreakdowns(
  supabaseClient: typeof supabase,
  reservationIds: string[],
  reservations: ReservationRow[],
  useEnglish: boolean
): Promise<Record<string, GuidePickupBalanceBreakdown>> {
  const ids = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  const out: Record<string, GuidePickupBalanceBreakdown> = {}
  if (ids.length === 0) return out

  const { data: sessionData } = await supabaseClient.auth.getSession()
  const token = sessionData?.session?.access_token?.trim()

  const pricingByResId = new Map<string, Record<string, unknown> | null>()
  if (token && typeof window !== 'undefined') {
    try {
      const res = await fetch(
        `${window.location.origin}/api/reservation-pricing?reservation_ids=${encodeURIComponent(ids.join(','))}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.ok) {
        const json = (await res.json()) as {
          items?: Array<{ reservation_id: string; pricing: Record<string, unknown> | null }>
        }
        const items = json.items
        if (Array.isArray(items)) {
          for (const { reservation_id, pricing } of items) {
            pricingByResId.set(
              reservation_id,
              pricing && typeof pricing === 'object' ? pricing : null
            )
          }
        }
      }
    } catch (e) {
      console.warn('가이드 픽업 잔액: reservation-pricing API', e)
    }
  }

  const missing = ids.filter((id) => !pricingByResId.has(id))
  if (missing.length > 0) {
    const { data: pricingList, error: pricingErr } = await supabaseClient
      .from('reservation_pricing')
      .select('*')
      .in('reservation_id', missing)
    if (pricingErr) {
      console.warn('가이드 픽업 잔액: reservation_pricing 직접 조회', pricingErr)
    }
    for (const row of pricingList || []) {
      const rid = (row as { reservation_id?: string }).reservation_id
      if (rid) pricingByResId.set(rid, row as Record<string, unknown>)
    }
  }
  for (const id of ids) {
    if (!pricingByResId.has(id)) pricingByResId.set(id, null)
  }

  const optionLinesByResId = await fetchReservationOptionLinesBatch(supabaseClient, ids)

  const { data: payRows } = await supabaseClient
    .from('payment_records')
    .select('reservation_id, amount, payment_status')
    .in('reservation_id', ids)

  const { data: rcRows } = await supabaseClient
    .from('reservation_customers')
    .select('reservation_id, resident_status')
    .in('reservation_id', ids)

  const residentsByResId = new Map<string, Array<{ resident_status?: string | null }>>()
  for (const r of rcRows || []) {
    const row = r as { reservation_id: string; resident_status?: string | null }
    const list = residentsByResId.get(row.reservation_id) || []
    list.push({ resident_status: row.resident_status ?? null })
    residentsByResId.set(row.reservation_id, list)
  }

  const paymentsByResId = new Map<string, Array<{ payment_status: string; amount: number }>>()
  for (const r of payRows || []) {
    const row = r as { reservation_id: string; amount?: unknown; payment_status?: string | null }
    const list = paymentsByResId.get(row.reservation_id) || []
    list.push({
      payment_status: row.payment_status || '',
      amount: Number(row.amount) || 0,
    })
    paymentsByResId.set(row.reservation_id, list)
  }

  const rezById = new Map<string, ReservationRow>()
  for (const r of reservations) rezById.set(r.id, r)

  for (const id of ids) {
    const rez = rezById.get(id)
    if (!rez) {
      out[id] = { displayBalance: 0, currency: 'USD', detailLines: [] }
      continue
    }

    const pricingRaw = pricingByResId.get(id) ?? null
    const pricing = pricingRaw ? withNormalizedBalanceAmountForDisplay(pricingRaw) : null

    const lines = optionLinesByResId.get(id) || []
    const optionsSumRaw = lines.length
      ? lines.reduce((s, o) => s + (Number(o.lineTotal) || 0), 0)
      : null

    const residentCountsFromCustomers = countResidentLinesFromCustomers(residentsByResId.get(id))
    const choicesJson =
      pricing && typeof (pricing as { choices?: unknown }).choices !== 'undefined'
        ? (pricing as { choices?: unknown }).choices
        : null
    const fromChoices = residentFeeCountsFromPricingChoicesJson(choicesJson)
    const residentCounts = { ...fromChoices }
    for (const [k, v] of Object.entries(residentCountsFromCustomers)) {
      const key = k as keyof typeof residentCounts
      residentCounts[key] = Math.max(Number(residentCounts[key]) || 0, Number(v) || 0)
    }
    const residentStatusAmounts = residentFeeAmountsFromPricingChoicesJson(choicesJson)
    const party = {
      adults: rez.adults ?? null,
      child: rez.child ?? null,
      infant: rez.infant ?? null,
    }
    const residentFeeUsd = resolveResidentFeeUsdForBalanceDisplay(
      pricing as Parameters<typeof resolveResidentFeeUsdForBalanceDisplay>[0],
      party,
      optionsSumRaw,
      residentCounts,
      residentStatusAmounts
    )
    const optionRowsForAdj = lines.map((o) => ({
      option_id: o.optionId,
      total_price: o.lineTotal,
      status: 'active',
    }))
    const optionsSum =
      optionsSumRaw === null
        ? null
        : adjustOptionTotalExcludingLegacyNonResident(
            optionsSumRaw,
            residentFeeUsd,
            optionRowsForAdj
          )

    const displayBalance = getBalanceAmountForDisplay(pricing, optionsSum, party, {
      paymentRecords: paymentsByResId.get(id) ?? [],
      reservationStatus: rez.status ?? null,
      residentFeeUsd,
    })

    const currency =
      pricing && typeof (pricing as { currency?: unknown }).currency === 'string'
        ? String((pricing as { currency: string }).currency || 'USD')
        : 'USD'

    const p = pricing as { not_included_price?: unknown; pricing_adults?: unknown } | null
    const pricingAdultsRaw = p?.pricing_adults
    const pricingAdults =
      pricingAdultsRaw !== undefined &&
      pricingAdultsRaw !== null &&
      pricingAdultsRaw !== '' &&
      Number.isFinite(Number(pricingAdultsRaw))
        ? Math.max(0, Math.floor(Number(pricingAdultsRaw)))
        : rez.adults ?? 0
    const notIncludedPerPerson = Number(p?.not_included_price) || 0
    const reservationOptions = lines.map((o) => ({
      labelKo: o.labelKo,
      labelEn: o.labelEn,
      unitPrice: o.unitPrice,
      qty: o.quantity,
      subtotal: o.lineTotal,
    }))

    const balanceLines =
      displayBalance > 0.005
        ? buildBalanceEnvelopeBreakdownLines({
            balanceAmount: displayBalance,
            notIncludedPerPerson,
            pricingAdults,
            child: rez.child ?? 0,
            infant: rez.infant ?? 0,
            residentCounts,
            residentStatusAmounts,
            reservationOptions,
          })
        : []

    const detailLines = balanceLines.map((line) =>
      formatBalanceEnvelopeLine(line, currency, useEnglish, formatGuideEnvelopeMoney)
    )

    out[id] = { displayBalance, currency, detailLines }
  }

  return out
}

type GuideTourDetailSnapshot = {
  tour: TourRow
  tourTipShare: { guide_amount: number; assistant_amount: number } | null
  product: ProductRow | null
  vehicle: Vehicle | null
  reservations: ReservationRow[]
  customers: CustomerRow[]
  pickupHotels: PickupHotel[]
  tourHotelBookings: TourHotelBooking[]
  ticketBookings: TicketBooking[]
  teamMembers: TeamMember[]
  channels: Array<{ id: string; name: string; favicon_url?: string }>
  reservationPricing: Array<{
    reservation_id: string
    balance_amount: number
    prepayment_tip: number
    currency: string
  }>
  reservationChoicesEntries: Array<[string, ChoiceOptionBadgeItem[]]>
  residentStatusSummary: {
    usResident: number
    nonResident: number
    nonResidentWithPass: number
    passCoveredCount: number
  }
  /** 픽업 카드 Balance 내역 (Balance 봉투 모달과 동일 산식) */
  pickupBalanceBreakdownByReservation: Record<string, GuidePickupBalanceBreakdown>
}

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

/** 21시 이후 픽업은 투어일 전날로 본다. */
function pickupInstantMs(tourDate: string, pickupTime: string | null | undefined): number | null {
  if (!pickupTime) return null
  const time = String(pickupTime).substring(0, 5)
  const [hStr, mStr] = time.split(':')
  const hour = parseInt(hStr, 10)
  const minute = parseInt(mStr, 10)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  const [y, mo, d] = tourDate.split('-').map(Number)
  if (!y || !mo || !d) return null
  const dt = new Date(y, mo - 1, d, hour, minute, 0, 0)
  if (hour >= 21) {
    dt.setDate(dt.getDate() - 1)
  }
  return dt.getTime()
}

/** 첫 픽업 시각 ~ 18시간 30분 */
function getGuideTourWindowFromPickups(
  tourDate: string,
  pickupTimes: Array<string | null | undefined>
): { start: Date; end: Date } | null {
  const instants = pickupTimes
    .map((time) => pickupInstantMs(tourDate, time))
    .filter((n): n is number => n != null)
  if (instants.length === 0) return null
  const start = new Date(Math.min(...instants))
  const end = new Date(start.getTime() + (18 * 60 + 30) * 60 * 1000)
  return { start, end }
}

function formatGuideLocalDateTime(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day}/${year} ${hours}:${minutes}`
}

function formatTourCalendarDate(tourDate: string): string {
  const [y, mo, d] = tourDate.split('-').map(Number)
  if (!y || !mo || !d) return tourDate
  return `${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`
}

export default function GuideTourDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  const t = useTranslations('guideTour')
  const tCommon = useTranslations('common')
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  const [tour, setTour] = useState<TourRow | null>(null)
  const [assignmentPersonallyResponded, setAssignmentPersonallyResponded] = useState(false)
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
  const [reservationChoicesMap, setReservationChoicesMap] = useState<Map<string, ChoiceOptionBadgeItem[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [onlineRefreshTick, setOnlineRefreshTick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [residentStatusSummary, setResidentStatusSummary] = useState({
    usResident: 0,
    nonResident: 0,
    nonResidentWithPass: 0,
    passCoveredCount: 0
  })
  const [pickupBalanceBreakdownByReservationId, setPickupBalanceBreakdownByReservationId] = useState<
    Record<string, GuidePickupBalanceBreakdown>
  >({})
  const [fieldChargeTarget, setFieldChargeTarget] = useState<GuidePickupChargeTarget | null>(null)

  // 모바일 최적화를 위한 상태
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'bookings' | 'photos' | 'chat' | 'expenses' | 'report'>('overview')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tour-info', 'pickup-schedule', 'chat']))
  /** 가이드 모바일(lg 미만): 부킹·사진·정산·리포트 섹션은 항상 펼침 */
  const [isGuideMobileLayout, setIsGuideMobileLayout] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [showMissingReportReminder, setShowMissingReportReminder] = useState(false)
  const reportReminderShownForTourRef = useRef<string | null>(null)
  const [calculatedTourTimes, setCalculatedTourTimes] = useState<{
    startTime: string;
    endTime: string;
    sunriseTime: string;
  } | null>(null)
  const assignmentActionRef = useRef<HTMLDivElement | null>(null)
  const expenseManagerRef = useRef<TourExpenseManagerHandle>(null)
  const photoUploadRef = useRef<TourPhotoUploadHandle>(null)

  useEffect(() => {
    if (searchParams.get('assignment') !== '1') return
    setExpandedSections((prev) => {
      const next = new Set(prev)
      next.add('tour-info')
      return next
    })
    const timer = window.setTimeout(() => {
      assignmentActionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [searchParams, tour?.id])

  useEffect(() => {
    const onOnline = () => setOnlineRefreshTick((n) => n + 1)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])
  
  // balance 정보를 가져오는 함수 (픽업 내역 로드 후에는 봉투와 동일 표시 잔액)
  const getReservationBalance = (reservationId: string) => {
    if (Object.prototype.hasOwnProperty.call(pickupBalanceBreakdownByReservationId, reservationId)) {
      return pickupBalanceBreakdownByReservationId[reservationId].displayBalance
    }
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
    const entries = Object.values(pickupBalanceBreakdownByReservationId)
    if (entries.length > 0) {
      return entries.reduce((total, b) => total + (b.displayBalance || 0), 0)
    }
    return reservationPricing.reduce((total, pricing) => total + (pricing.balance_amount || 0), 0)
  }

  // 투어 데이터 로드
  const loadTourData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setTourTipShare(null)
      setPickupBalanceBreakdownByReservationId({})

      const tourId = params.id as string
      if (!tourId) {
        setError(t('errors.noTourId'))
        return
      }

      const snapshotKey = `guide-tour-detail-${tourId}-${currentUserEmail ?? 'anon'}-${userRole}-${locale}-${isSimulating && simulatedUser?.email ? simulatedUser.email : 'live'}`

      if (isBrowserOffline()) {
        const raw = await loadGuideSnapshot(snapshotKey)
        if (raw && typeof raw === 'object' && raw !== null && 'tour' in raw) {
          const s = raw as GuideTourDetailSnapshot
          setTour(s.tour)
          setTourTipShare(s.tourTipShare)
          setProduct(s.product)
          setVehicle(s.vehicle)
          setReservations(s.reservations)
          setCustomers(s.customers)
          setPickupHotels(s.pickupHotels)
          setTourHotelBookings(s.tourHotelBookings)
          setTicketBookings(s.ticketBookings)
          setTeamMembers(s.teamMembers)
          setChannels(s.channels)
          setReservationPricing(s.reservationPricing)
          setReservationChoicesMap(new Map(s.reservationChoicesEntries))
          setResidentStatusSummary(s.residentStatusSummary)
          setPickupBalanceBreakdownByReservationId(s.pickupBalanceBreakdownByReservation ?? {})
          setError(null)
          return
        }
        setError(
          locale === 'ko'
            ? '오프라인입니다. 이 투어를 한 번 온라인에서 연 뒤 다시 시도해 주세요.'
            : 'You are offline. Open this tour once while online, then try again.'
        )
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

      // 가이드 공개 마감일 이후 투어는 가이드(또는 시뮬레이션)에게 숨김
      const applyGuideVisibleCutoff = userRole === 'team_member' || isSimulating
      if (applyGuideVisibleCutoff) {
        const visibleUntil = await fetchGuideToursVisibleUntil(supabase)
        if (!isTourDateVisibleToGuide((tourData as TourRow).tour_date, visibleUntil)) {
          setError(
            locale === 'ko'
              ? '가이드 공개 기간이 지난 투어입니다. 목록에서 확인할 수 없습니다.'
              : 'This tour is outside the guide visibility window.'
          )
          return
        }
      }

      setTour(tourData)

      const snapForPersist: GuideTourDetailSnapshot = {
        tour: tourData as TourRow,
        tourTipShare: null,
        product: null,
        vehicle: null,
        reservations: [],
        customers: [],
        pickupHotels: [],
        tourHotelBookings: [],
        ticketBookings: [],
        teamMembers: [],
        channels: [],
        reservationPricing: [],
        reservationChoicesEntries: [],
        residentStatusSummary: {
          usResident: 0,
          nonResident: 0,
          nonResidentWithPass: 0,
          passCoveredCount: 0,
        },
        pickupBalanceBreakdownByReservation: {},
      }

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
          snapForPersist.tourTipShare = { guide_amount: ga, assistant_amount: aa }
        } else {
          setTourTipShare(null)
          snapForPersist.tourTipShare = null
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
        snapForPersist.product = productData
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
          snapForPersist.vehicle = vehicleData
        } else {
          setVehicle(null)
          snapForPersist.vehicle = null
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
          for (const chunk of chunkStrings(ids)) {
            const { data: existingReservations } = await supabase
              .from('reservations')
              .select('id')
              .in('id', chunk)

            allReservationIds.push(...((existingReservations || []).map((r) => r.id)))
          }
        }
      }

      if (allReservationIds.length > 0) {
        const reservationsListRaw: ReservationRow[] = []
        for (const chunk of chunkStrings(allReservationIds)) {
          const { data: reservationsData, error: resChunkErr } = await supabase
            .from('reservations')
            .select('*, selected_options')
            .in('id', chunk)
          if (resChunkErr) {
            console.error('예약 조회 오류 (chunk):', resChunkErr)
            continue
          }
          if (reservationsData?.length) {
            reservationsListRaw.push(...(reservationsData as ReservationRow[]))
          }
        }
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
          snapForPersist.reservationPricing = normalized
        } else {
          setReservationPricing([])
          snapForPersist.reservationPricing = []
          setPickupBalanceBreakdownByReservationId({})
          snapForPersist.pickupBalanceBreakdownByReservation = {}
        }

        const choicesMap = new Map<string, ChoiceOptionBadgeItem[]>()

        if (guideActiveReservationIds.length > 0) {
          try {
            const resolved = await resolveReservationChoicesBatch(supabase, guideActiveReservationIds)
            for (const reservationId of guideActiveReservationIds) {
              const rows = resolved.get(reservationId) || []
              if (rows.length === 0) continue
              choicesMap.set(
                reservationId,
                rows.map((choice) => ({
                  choice_id: choice.choice_id,
                  option_id: choice.option_id,
                  quantity: choice.quantity,
                  option_name: choice.choice_options?.option_name || '',
                  option_name_ko:
                    choice.choice_options?.option_name_ko || choice.choice_options?.option_name || '',
                  option_key:
                    choice.option_key ||
                    choice.canonical_option_key ||
                    choice.canyon_key ||
                    choice.choice_options?.option_key ||
                    '',
                  internal_name: choice.choice_options?.internal_name || '',
                  badge_icon_url: choice.choice_options?.badge_icon_url || '',
                  choice_group_ko: choice.product_choices?.choice_group_ko || '',
                }))
              )
            }
          } catch (err) {
            console.error('가이드 페이지: 예약 초이스 일괄 로드 오류:', err)
          }
        }

        setReservationChoicesMap(choicesMap)
        snapForPersist.reservationChoicesEntries = Array.from(choicesMap.entries())
        
        // 픽업 시간으로 정렬
        const sortedReservations = reservationsList.sort((a, b) => {
          const timeA = (a as ReservationRow).pickup_time || '00:00'
          const timeB = (b as ReservationRow).pickup_time || '00:00'
          return timeA.localeCompare(timeB)
        })
        
        setReservations(sortedReservations)
        snapForPersist.reservations = sortedReservations

        // 고객 정보 가져오기
        let loadedCustomers: CustomerRow[] = []
        const customerIds = [...new Set(reservationsList.map(r => (r as ReservationRow & { customer_id?: string }).customer_id).filter(Boolean))]
        if (customerIds.length > 0) {
          const { data: customersData } = await supabase
            .from('customers')
            .select('*')
            .in('id', customerIds)
          loadedCustomers = customersData || []
          setCustomers(loadedCustomers)
          snapForPersist.customers = loadedCustomers
        } else {
          setCustomers([])
          snapForPersist.customers = []
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
            snapForPersist.pickupHotels = hotelsData || []
          }
        }

        if (guideActiveReservationIds.length > 0) {
          try {
            const breakdown = await computeGuidePickupBalanceBreakdowns(
              supabase,
              guideActiveReservationIds,
              sortedReservations,
              guidePickupUseEnvelopeEnglish(locale)
            )
            setPickupBalanceBreakdownByReservationId(breakdown)
            snapForPersist.pickupBalanceBreakdownByReservation = breakdown
          } catch (e) {
            console.warn('가이드 픽업 잔액 내역:', e)
            setPickupBalanceBreakdownByReservationId({})
            snapForPersist.pickupBalanceBreakdownByReservation = {}
          }
        } else {
          setPickupBalanceBreakdownByReservationId({})
          snapForPersist.pickupBalanceBreakdownByReservation = {}
        }
      }


      // 투어 호텔 부킹 정보 가져오기 (cancelled가 아닌 것만)
      const { data: hotelBookingsData } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('tour_id', tourId)
        .not('status', 'ilike', 'cancelled');
      setTourHotelBookings(hotelBookingsData || [])
      snapForPersist.tourHotelBookings = hotelBookingsData || []

      // 티켓 부킹 정보 가져오기 (모든 status 포함)
      const { data: ticketBookingsData } = await supabase
        .from('ticket_bookings')
        .select('*')
        .eq('tour_id', tourId);
      const ticketRows = filterTicketBookingsExcludedFromMainUi(ticketBookingsData || [])
      setTicketBookings(ticketRows)
      snapForPersist.ticketBookings = ticketRows

      // 팀 멤버 정보 가져오기 (가이드와 어시스턴트 이름 표시용)
      const { data: teamData } = await supabase
        .from('team')
        .select('email, name_ko, name_en, nick_name, phone');
      setTeamMembers(teamData || [])
      snapForPersist.teamMembers = (teamData || []) as TeamMember[]

      // 채널 정보 가져오기
      const { data: channelsData } = await supabase
        .from('channels')
        .select('id, name, favicon_url');
      const channelsNorm = (channelsData || []) as Array<{ id: string; name: string; favicon_url?: string }>
      setChannels(channelsNorm)
      snapForPersist.channels = channelsNorm

      // 거주 상태별 인원 수 합산 가져오기 (해당 상품 코드에서만)
      const showResidentSummary = productShowsResidentStatusSectionByCode(
        (tourProductRow as { product_code?: string | null } | null)?.product_code
      )
      if (!showResidentSummary) {
        const emptyRes = {
          usResident: 0,
          nonResident: 0,
          nonResidentWithPass: 0,
          passCoveredCount: 0
        }
        setResidentStatusSummary(emptyRes)
        snapForPersist.residentStatusSummary = emptyRes
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
            } else if (
              rc.resident_status === 'non_resident' ||
              rc.resident_status === 'non_resident_under_16'
            ) {
              nonResidentCount++
            } else if (rc.resident_status === 'non_resident_with_pass') {
              nonResidentWithPassCount++
              if (rc.pass_covered_count) {
                passCoveredCount += rc.pass_covered_count
              }
            }
          })
          
          const filledRes = {
            usResident: usResidentCount,
            nonResident: nonResidentCount,
            nonResidentWithPass: nonResidentWithPassCount,
            passCoveredCount: passCoveredCount
          }
          setResidentStatusSummary(filledRes)
          snapForPersist.residentStatusSummary = filledRes
        } else {
          const emptyRes = {
            usResident: 0,
            nonResident: 0,
            nonResidentWithPass: 0,
            passCoveredCount: 0
          }
          setResidentStatusSummary(emptyRes)
          snapForPersist.residentStatusSummary = emptyRes
        }
      } else if (showResidentSummary) {
        const emptyRes = {
          usResident: 0,
          nonResident: 0,
          nonResidentWithPass: 0,
          passCoveredCount: 0
        }
        setResidentStatusSummary(emptyRes)
        snapForPersist.residentStatusSummary = emptyRes
      }

      void saveGuideSnapshot(snapshotKey, snapForPersist).catch(() => {})

    } catch (err) {
      console.error('Error loading tour data:', err)
      setError(locale === 'ko' ? '데이터를 불러오는 중 오류가 발생했습니다.' : 'An error occurred while loading data.')
    } finally {
      setLoading(false)
    }
  }, [params.id, currentUserEmail, userRole, t, locale, isSimulating, simulatedUser?.email, onlineRefreshTick, supabase])

  useEffect(() => {
    loadTourData()
  }, [loadTourData])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!tour?.id || !currentUserEmail) {
        setAssignmentPersonallyResponded(false)
        return
      }
      const ids = await fetchPersonallyRespondedTourIds(currentUserEmail)
      if (!cancelled) {
        setAssignmentPersonallyResponded(ids.has(tour.id))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tour?.id, currentUserEmail])

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
      if (tour.tour_date < TOUR_REPORT_REQUIRED_FROM) return

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
        setShowMissingReportReminder(true)
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
  const isBackupTour = isGuideBackupTour({
    assignedPeople: totalPeople,
    tourGuideId: tour?.tour_guide_id,
    assistantId: tour?.assistant_id,
    tourStatus: tour?.tour_status,
    assignmentStatus: (tour as TourRow & { assignment_status?: string } | null)?.assignment_status,
  })
  
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
  
  // 가이드/어시스턴트 이름 가져오기 함수
  const getTeamMemberName = (email: string | null) => {
    if (!email) return t('unassigned')
    
    const member = teamMembers.find(m => m.email === email)
    if (!member) return email // 팀 멤버 정보가 없으면 이메일 표시
    
    // 한국어: nick/name_ko, 영어: name_en 우선 (한글 nick이 덮지 않음)
    return teamMemberNameForLocale(member, locale) || email
  }

  // 팀 멤버 전화번호 가져오기 함수
  const getTeamMemberPhone = (email: string | null) => {
    if (!email) return null
    
    const member = teamMembers.find(m => m.email === email)
    return member?.phone || null
  }

  const getTeamMemberNick = (email: string | null) => {
    if (!email) return null
    const member = teamMembers.find(m => m.email === email)
    return teamMemberNickDisplayName(member) || teamMemberNameForLocale(member, locale) || email.split('@')[0]
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

    const email = currentUserEmail.toLowerCase()
    const isAssignedGuide =
      String(tour.tour_guide_id || '').toLowerCase() === email ||
      String(tour.assistant_id || '').toLowerCase() === email
    if (!isAssignedGuide) {
      alert(locale === 'ko' ? '배정된 가이드만 확인/거절할 수 있습니다.' : 'Only assigned guides can confirm or reject.')
      return
    }

    const currentStatus = (tour as TourRow & { assignment_status?: string }).assignment_status
    if (currentStatus !== 'assigned') {
      alert(locale === 'ko' ? '배정 대기 중인 투어만 확인/거절할 수 있습니다.' : 'Only tours with assigned status can be confirmed or rejected.')
      return
    }

    try {
      const result = await respondToTourAssignment(tour.id, status, email)
      if (!result.ok) {
        console.error('Error updating assignment status:', result.error)
        alert(locale === 'ko' ? '배정 상태 업데이트 중 오류가 발생했습니다.' : 'Error updating assignment status.')
        return
      }

      setAssignmentPersonallyResponded(true)
      setTour((prev: TourRow | null) =>
        prev
          ? ({ ...prev, assignment_status: result.assignment_status } as TourRow)
          : null
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
    if (tab === 'chat') {
      setChatModalOpen(true)
      return
    }
    setChatModalOpen(false)
    setActiveTab(tab)
  }

  const mobileNavTabs: Array<{
    id: typeof activeTab
    label: string
    icon: LucideIcon
    activeTile: string
    idleTile: string
  }> = [
    { id: 'overview', label: t('overview'), icon: Clock, activeTile: 'bg-primary text-white', idleTile: 'bg-primary/10 text-primary' },
    { id: 'schedule', label: t('schedule'), icon: MapPin, activeTile: 'bg-green-500 text-white', idleTile: 'bg-green-100 text-green-700' },
    { id: 'bookings', label: t('booking'), icon: Hotel, activeTile: 'bg-purple-500 text-white', idleTile: 'bg-purple-100 text-purple-700' },
    { id: 'photos', label: t('photos'), icon: Camera, activeTile: 'bg-orange-500 text-white', idleTile: 'bg-orange-100 text-orange-700' },
    { id: 'chat', label: t('chat'), icon: MessageSquare, activeTile: 'bg-teal-500 text-white', idleTile: 'bg-teal-100 text-teal-700' },
    { id: 'expenses', label: t('expenses'), icon: Calculator, activeTile: 'bg-amber-500 text-white', idleTile: 'bg-amber-100 text-amber-700' },
    { id: 'report', label: t('report'), icon: FileText, activeTile: 'bg-rose-500 text-white', idleTile: 'bg-rose-100 text-rose-700' },
  ]
  
  // 아코디언 섹션 컴포넌트
  const guidePanelShell = isGuideMobileLayout
    ? 'bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'
    : 'bg-white rounded-xl border border-gray-200 shadow-sm'
  const guideContentInset = isGuideMobileLayout ? 'px-3' : ''

  const AccordionSection = ({ 
    id, 
    title, 
    icon: Icon, 
    children,
    headerButton,
    alwaysExpanded = false,
    iconWrapClass = 'bg-gray-100 text-gray-600',
    flush = false,
  }: { 
    id: string
    title: string
    icon: LucideIcon
    children: React.ReactNode
    headerButton?: React.ReactNode
    /** 모바일 가이드 전용: 접기 없이 항상 본문 표시 */
    alwaysExpanded?: boolean
    iconWrapClass?: string
    flush?: boolean
  }) => {
    const isExpanded = alwaysExpanded || expandedSections.has(id)
    const handleToggle = () => {
      if (alwaysExpanded) return
      toggleSection(id)
    }
    
    return (
      <div className={flush ? '' : guidePanelShell}>
        <div className={`flex items-center justify-between gap-2 ${
          flush
            ? 'px-0 py-0 mb-3'
            : `border-b border-gray-100 bg-gray-50/90 px-3 py-3 sm:px-4 ${guideContentInset}`
        }`}>
          <button
            type="button"
            onClick={handleToggle}
            disabled={alwaysExpanded}
            className={`flex min-w-0 flex-1 items-center text-left rounded-lg ${
              alwaysExpanded ? 'cursor-default' : 'hover:bg-white/80 transition-colors'
            }`}
          >
            <span className={`mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}>
              <Icon className="h-4 w-4" />
            </span>
            <h2 className="truncate text-base font-semibold text-gray-900">{title}</h2>
          </button>
          <div className="flex shrink-0 items-center space-x-2">
            {headerButton}
            {!alwaysExpanded && (
              <button
                type="button"
                onClick={handleToggle}
                className="p-1 hover:bg-white rounded-lg transition-colors"
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
          <div className={flush ? 'px-0 py-0' : 'px-3 sm:px-4 py-3 sm:pb-4'}>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
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
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90"
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
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90"
          >
            {t('backToTourList')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen lg:bg-transparent">
      <div className="bg-white border-b border-gray-200 lg:border-0 lg:bg-transparent">
      {/* 헤더 - 모바일 최적화 */}
      <div className={`px-3 pt-3 pb-2 sm:mb-4 lg:px-0 lg:pt-0 ${guideContentInset}`}>
        <button
          onClick={() => router.push(`/${locale}/guide/tours`)}
          className="flex items-center text-gray-600 hover:text-gray-900 text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('backToTourList')}
        </button>
      </div>

      {/* 모바일 탭 네비게이션 — 색 타일로 탭 구분 */}
      <div className="lg:hidden">
        <div className="flex items-end justify-between gap-1 px-2 pb-2">
            {mobileNavTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = tab.id === 'chat' ? chatModalOpen : activeTab === tab.id && !chatModalOpen
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${
                      isActive ? `${tab.activeTile} shadow-md` : tab.idleTile
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.75} />
                  </span>
                  <span
                    className={`w-full truncate px-0.5 text-center text-[10px] leading-none ${
                      isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              )
            })}
        </div>
      </div>
      </div>

      {/* 모바일 최적화된 아코디언 레이아웃 */}
      <div className={`${
        activeTab === 'overview' ? 'space-y-0 px-0 py-0' : 'space-y-3 px-3 py-3'
      } lg:space-y-4 lg:px-0 lg:py-4`}>
        {/* 투어 정보 · 날씨 · 픽업 — 가로줄 + 교차 배경 */}
        <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white border-b border-gray-200 px-3 py-4">
            <div className="flex items-center justify-between gap-2 pb-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="shrink-0 whitespace-nowrap text-base font-semibold leading-snug text-gray-900">
                  {formatTourCalendarDate(tour.tour_date)}
                </span>
                <h2 className="min-w-0 truncate text-base font-semibold leading-snug text-gray-900">
                  {getProductName()}
                </h2>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-gray-900">
                  <Users className="h-4 w-4 text-gray-500" />
                  {totalPeople}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isBackupTour && <GuideBackupTourBadge />}
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'assigned' ? 'bg-primary/10 text-primary' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'rejected' ? 'bg-red-100 text-red-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  (tour as TourRow & { assignment_status?: string }).assignment_status === 'recruiting' ? 'bg-primary/10 text-primary' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {(() => {
                    const status = (tour as TourRow & { assignment_status?: string }).assignment_status
                    if (status === 'pending') return locale === 'ko' ? '대기' : 'Pending'
                    if (status === 'assigned') return locale === 'ko' ? '부여' : 'Assigned'
                    if (status === 'confirmed') return locale === 'ko' ? '배정' : 'Confirmed'
                    if (status === 'rejected') return locale === 'ko' ? '거절' : 'Rejected'
                    return status || t('assignmentStatus')
                  })()}
                </span>
              </div>
            </div>
            <div className="space-y-3">
                  {(tour as TourRow & { assignment_status?: string }).assignment_status === 'assigned' &&
                   !assignmentPersonallyResponded &&
                   (String(tour.tour_guide_id || '').toLowerCase() === String(currentUserEmail || '').toLowerCase() ||
                     String(tour.assistant_id || '').toLowerCase() === String(currentUserEmail || '').toLowerCase()) && (
                    <div ref={assignmentActionRef} className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(locale === 'ko' ? '배정을 확인하시겠습니까?' : 'Confirm assignment?')) {
                            handleAssignmentResponse('confirmed')
                          }
                        }}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
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
                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                      >
                        {locale === 'ko' ? '거절' : 'Reject'}
                      </button>
                    </div>
                  )}

                  <div className="rounded-xl bg-gray-50 px-3 py-2.5 flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium text-gray-500">{tCommon('totalBalance')}</span>
                    <span className="text-lg font-bold tabular-nums text-emerald-600">
                      ${getTotalBalance().toLocaleString()}
                    </span>
                  </div>
            
            {isBackupTour && (
              <GuideBackupTourBadge variant="banner" />
            )}

            <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="text-[11px] font-medium text-gray-500">
                  {locale === 'ko' ? '가이드 & 차량' : 'Guides & Vehicle'}
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {getGuideConfigurationLabel()}
                </span>
              </div>
              <div className="space-y-1.5 text-sm text-gray-700">
              {getTeamMemberPhone(tour.tour_guide_id) ? (
                  <a 
                    href={`tel:${getTeamMemberPhone(tour.tour_guide_id) || ''}`}
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                  <User className="h-4 w-4 text-gray-400" />
                  {getTeamMemberName(tour.tour_guide_id)}
                </a>
              ) : (
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-gray-400" />
                  {getTeamMemberName(tour.tour_guide_id)}
                </div>
              )}
              {tour.assistant_id && (
                getTeamMemberPhone(tour.assistant_id) ? (
                  <a 
                    href={`tel:${getTeamMemberPhone(tour.assistant_id) || ''}`}
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    {getTeamMemberName(tour.assistant_id)}
                  </a>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <User className="h-4 w-4 text-gray-400" />
                    {getTeamMemberName(tour.assistant_id)}
                  </span>
                )
              )}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <Car className="h-4 w-4 text-gray-400" />
                  {(vehicle?.nick?.trim() || vehicle?.vehicle_number) || t('unassigned')}
                </div>
              </div>
            </div>
            
                  <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-2">
                    <div className="mb-1 flex items-center gap-1 text-[11px] text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      {locale === 'ko' ? '운행 시간' : 'Tour time'}
                    </div>
                    <div className="text-sm text-gray-900">
                    {(() => {
                      const windowTimes = tour.tour_date
                        ? getGuideTourWindowFromPickups(
                            tour.tour_date,
                            reservations.map((r) => r.pickup_time)
                          )
                        : null
                      const startLabel = windowTimes
                        ? formatGuideLocalDateTime(windowTimes.start)
                        : formatDateTime(tour.tour_start_datetime)
                      const endLabel = windowTimes
                        ? formatGuideLocalDateTime(windowTimes.end)
                        : formatDateTime(tour.tour_end_datetime)
                      return (
                        <>
                          <div className="flex items-center whitespace-nowrap tabular-nums">
                            <span className="min-w-0 flex-1">{startLabel}</span>
                            <span className="px-1.5 text-gray-400">~</span>
                            <span className="min-w-0 flex-1 text-right">{endLabel}</span>
                          </div>
                          {windowTimes && calculatedTourTimes?.sunriseTime ? (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {locale === 'ko' ? '일출 시간' : 'Sunrise time'}: {calculatedTourTimes.sunriseTime}
                            </div>
                          ) : null}
                        </>
                      )
                    })()}
                    </div>
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
                <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="text-xs font-semibold text-gray-500">{t('ticketBooking')}</div>
                  {Array.from(companyMap.entries())
                    .sort(([companyA], [companyB]) => companyA.localeCompare(companyB))
                    .map(([company, { totalEa, rows }]) => (
                      <div key={company} className="text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-gray-900 font-medium">{company}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            <Users className="h-3.5 w-3.5 text-gray-400" />
                            {totalEa}
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
                    <div className="rounded-xl border border-gray-200 p-3">
                      <div className="text-xs font-semibold text-gray-500 mb-2">
                        {tCommon('residentStatusByCount')}
                      </div>
                      {(() => {
                        const undeterminedPeople = Math.max(
                          0,
                          totalPeople -
                            residentStatusSummary.usResident -
                            residentStatusSummary.nonResident -
                            residentStatusSummary.passCoveredCount
                        )
                        return (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <div className="text-xs font-medium text-gray-500 mb-1">{tCommon('statusUsResident')}</div>
                          <div className="text-lg font-semibold text-gray-900">
                            {residentStatusSummary.usResident}{locale === 'ko' ? '명' : ''}
                          </div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <div className="text-xs font-medium text-gray-500 mb-1">{tCommon('statusNonResident')}</div>
                          <div className="text-lg font-semibold text-gray-900">
                            {residentStatusSummary.nonResident}{locale === 'ko' ? '명' : ''}
                          </div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <div className="text-xs font-medium text-gray-500 mb-1">
                            {locale === 'ko' ? '패스 장수' : 'Pass Count'}
                          </div>
                          <div className="text-lg font-semibold text-gray-900">
                            {residentStatusSummary.nonResidentWithPass}
                            {locale === 'ko' ? '장' : ''}
                            <span className="ml-1 text-sm font-medium text-gray-500">
                              {locale === 'ko'
                                ? `(${residentStatusSummary.passCoveredCount}명 커버)`
                                : `(${residentStatusSummary.passCoveredCount} ppl covers)`}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <div className="text-xs font-medium text-gray-500 mb-1">
                            {locale === 'ko' ? '미정' : 'Undetermined'}
                          </div>
                          <div className="text-lg font-semibold text-gray-900">
                            {undeterminedPeople}{locale === 'ko' ? '명' : ''}
                          </div>
                        </div>
                      </div>
                        )
                      })()}
                      <div className="mt-2 text-xs text-gray-600">
                        {tCommon('total')}: {totalPeople}{locale === 'ko' ? '명' : ` ${tCommon('people')}`}
                      </div>
                    </div>
                  )}
            </div>
          </div>

          <div className="bg-gray-100 border-b border-gray-200 px-3 py-4">
            <TourWeather 
              tourDate={tour.tour_date} 
              productId={(tour as TourRow & { product_id?: string }).product_id} 
            />
          </div>

          <div className="bg-white px-3 py-4">
          <AccordionSection 
            id="pickup-schedule" 
            title={t('pickupSchedule')} 
            icon={Clock}
            iconWrapClass="bg-green-100 text-green-700"
            flush
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
            <div className="space-y-3">
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
                    <div key={hotelId} className={`space-y-3 rounded-xl border p-3 ${
                      isUnassignedHotel
                        ? 'border-amber-200 bg-amber-50/80'
                        : 'border-gray-200 bg-gray-50'
                    }`}>
                      {/* 호텔 정보 헤더 - 3줄 구조 */}
                      <div className="space-y-1.5">
                        {/* 1줄: 픽업 시간 - 더 크게 */}
                        <div className="text-primary font-bold text-lg">
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
                            <Hotel className={`w-4 h-4 ${isUnassignedHotel ? 'text-amber-600' : 'text-primary'}`} />
                            <span className={`font-semibold ${isUnassignedHotel ? 'text-amber-900' : 'text-gray-900'}`}>
                              {isUnassignedHotel ? t('pickupHotelUnassigned') : (hotel?.hotel || t('noHotelInfo'))}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              isUnassignedHotel ? 'bg-amber-100 text-amber-900' : 'bg-primary/10 text-primary'
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
                              className="text-primary hover:text-primary/80 transition-colors"
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
                            <div key={reservation.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                {/* 상단: 언어·채널·이름·인원(왼쪽) / 선불 팁(오른쪽, 픽업 달력일 기준 당일·과거만) */}
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                                <div className="flex items-center justify-between mb-2 gap-2">
                                  <div className="min-w-0 flex-1 pr-2">
                                    {(() => {
                                      const choices = reservationChoicesMap.get(reservation.id)
                                      if (!choices || choices.length === 0) {
                                        return <span className="text-sm text-gray-500">{t('noOptions')}</span>
                                      }
                                      return <ChoiceOptionBadges items={choices} compact />
                                    })()}
                                  </div>
                                  <div className="flex items-center space-x-3 shrink-0">
                                    <GuidePickupChargeButton
                                      ariaLabel={t('fieldCharge.buttonAria')}
                                      onClick={() => {
                                        const recorded = getReservationBalance(reservation.id)
                                        setFieldChargeTarget({
                                          reservationId: reservation.id,
                                          customerName: formatCustomerNameEnhanced(customer as any, locale),
                                          recordedBalanceUsd: Number.isFinite(recorded) ? recorded : 0,
                                          tourDate: tour?.tour_date ?? null,
                                          productName:
                                            locale === 'en'
                                              ? product?.name_en || product?.name_ko || product?.name || null
                                              : product?.name_ko || product?.name_en || product?.name || null,
                                        })
                                      }}
                                    />
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
                                        className="text-primary hover:text-primary/80 transition-colors"
                                        title={customer.email}
                                      >
                                        <Mail className="w-4 h-4" />
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {/* Balance: 봉투 인쇄 모달과 동일 산식 — 라인별 + 합계 (옵션·미포함·거주 수수료 등) */}
                                {(() => {
                                  const bd = pickupBalanceBreakdownByReservationId[reservation.id]
                                  const bal = getReservationBalance(reservation.id)
                                  const currency = bd?.currency ?? 'USD'
                                  const detailLines = bd?.detailLines ?? []
                                  const useEn = guidePickupUseEnvelopeEnglish(locale)
                                  const showLines = detailLines.length > 0 && bal > 0.005

                                  return (
                                    <div className="mt-1 pt-2 border-t border-dashed border-gray-200 space-y-0.5">
                                      {showLines ? (
                                        <>
                                          {detailLines.map((line, i) => (
                                            <div
                                              key={i}
                                              className="text-[11px] sm:text-xs leading-snug text-gray-700 tabular-nums break-words"
                                            >
                                              {line}
                                            </div>
                                          ))}
                                          <div
                                            className={`text-xs sm:text-sm font-semibold pt-0.5 tabular-nums ${
                                              bal > 0.005 ? 'text-red-600' : 'text-gray-700'
                                            }`}
                                          >
                                            {useEn
                                              ? `Total Balance : ${formatGuideEnvelopeMoney(bal, currency)}`
                                              : `잔액 합계 : ${formatGuideEnvelopeMoney(bal, currency)}`}
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-xs text-gray-600 tabular-nums">
                                          <span className="text-gray-500">
                                            {useEn ? 'Total Balance' : '잔액 합계'}
                                          </span>{' '}
                                          <span
                                            className={`font-semibold ${
                                              bal > 0.005 ? 'text-red-600' : 'text-gray-700'
                                            }`}
                                          >
                                            {formatGuideEnvelopeMoney(bal, currency)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}

                                {/* 하단: event_note */}
                                {(reservation as ReservationRow & { event_note?: string }).event_note && (
                                  <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                                    {(reservation as ReservationRow & { event_note: string }).event_note}
                                  </div>
                                )}
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
        </div>

        {/* 투어 스케줄 - 스케줄 탭에만 표시 */}
        {tour.product_id && (
          <div className={`${activeTab === 'schedule' ? 'block' : 'hidden'} lg:block`}>
              <TourScheduleSection 
                productId={tour.product_id} 
                teamType={tour.team_type as 'guide+driver' | '2guide' | null}
                locale={locale}
                showAllSchedules={true}
                currentUserEmail={currentUserEmail ?? null}
                tourGuideId={tour.tour_guide_id}
                assistantId={tour.assistant_id}
                guideName={getTeamMemberNick(tour.tour_guide_id)}
                assistantName={getTeamMemberNick(tour.assistant_id)}
              />
          </div>
        )}

        {/* 투어 메모 - 개요 탭에만 표시 */}
        {(tour as { tour_info?: string }).tour_info && (
          <div className={`${activeTab === 'overview' ? 'block' : 'hidden'} lg:block`}>
            <AccordionSection id="tour-memo" title={t('tourMemo')} icon={FileText} iconWrapClass="bg-slate-100 text-slate-700">
              <p className="text-gray-700 whitespace-pre-wrap">{(tour as unknown as { tour_info: string }).tour_info}</p>
            </AccordionSection>
          </div>
        )}

        {/* 추가 섹션들 - 아코디언 형태 */}

        {/* 부킹 관리 - 부킹 탭에만 표시 */}
        <div className={`${activeTab === 'bookings' ? 'block' : 'hidden'} lg:block`}>
        <AccordionSection id="bookings" title={t('bookingManagement')} icon={Hotel} alwaysExpanded={isGuideMobileLayout} iconWrapClass="bg-purple-100 text-purple-700" flush>
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
          <AccordionSection
            id="photos"
            title={t('tourPhotos')}
            icon={Camera}
            alwaysExpanded={isGuideMobileLayout}
            iconWrapClass="bg-orange-100 text-orange-700"
            flush
            headerButton={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => photoUploadRef.current?.shareAll()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                  title={locale === 'ko' ? '공유 링크 복사' : 'Copy share link'}
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => photoUploadRef.current?.openGallery()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  title={locale === 'ko' ? '갤러리에서 선택' : 'Select from gallery'}
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => photoUploadRef.current?.openCamera()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700"
                  title={locale === 'ko' ? '사진 촬영' : 'Take photo'}
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
            }
          >
          <TourPhotoUpload
            ref={photoUploadRef}
            tourId={tour.id}
            uploadedBy={currentUserEmail || ''}
            hideToolbar
          />
          </AccordionSection>
        </div>

        {/* 채팅 - 데스크톱은 페이지에 표시, 모바일은 전체 화면 모달 */}
        <div className="hidden lg:block">
          {tour.tour_date && currentUserEmail ? (
            <div className="h-[600px] overflow-hidden rounded-lg border border-gray-200 bg-white">
              <TourChatRoom
                tourId={tour.id}
                guideEmail={currentUserEmail}
                tourDate={tour.tour_date}
                isPublicView={false}
                customerLanguage={locale === 'ko' ? 'ko' : 'en'}
                productNames={
                  product
                    ? {
                        name: product.name,
                        name_ko: product.name_ko ?? product.name,
                        name_en: product.name_en,
                      }
                    : null
                }
              />
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center py-8 ${guidePanelShell}`}>
              <MessageSquare className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{locale === 'ko' ? '투어 채팅방' : 'Tour Chat Room'}</h3>
              <p className="text-sm text-gray-500 mb-4">{locale === 'ko' ? '투어 정보를 불러오는 중...' : 'Loading tour information...'}</p>
            </div>
          )}
        </div>

        {/* 정산 관리 - 정산 탭에만 표시 */}
        <div className={`${activeTab === 'expenses' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection
            id="expenses"
            title={t('expenseManagement')}
            icon={Calculator}
            alwaysExpanded={isGuideMobileLayout}
            iconWrapClass="bg-amber-100 text-amber-700"
            flush
            headerButton={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => expenseManagerRef.current?.openReceiptOnlyUpload()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  title={locale === 'ko' ? '영수증만 첨부' : 'Attach receipt'}
                >
                  <Receipt className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => expenseManagerRef.current?.openAddExpense()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  title={locale === 'ko' ? '지출 추가' : 'Add expense'}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            }
          >
          <TourExpenseManager
            ref={expenseManagerRef}
            tourId={tour.id}
            tourDate={tour.tour_date}
            productId={tour.product_id}
            submittedBy={currentUserEmail || ''}
            reservationIds={tour.reservation_ids || []}
            userRole={userRole || 'team_member'}
            allowReceiptOnlyUpload
            hideTitle
            tourGuideFee={isTourCancelled(tour.tour_status) ? 0 : tour.guide_fee}
            tourAssistantFee={isTourCancelled(tour.tour_status) ? 0 : tour.assistant_fee}
            tourStatus={tour.tour_status}
          />
          </AccordionSection>
        </div>

        {/* 투어 리포트 - 리포트 탭에만 표시 */}
        <div className={`${activeTab === 'report' ? 'block' : 'hidden'} lg:block`}>
          <AccordionSection
            id="report"
            title={t('tourReport')}
            icon={FileText}
            alwaysExpanded={isGuideMobileLayout}
            iconWrapClass="bg-rose-100 text-rose-700"
            flush
            headerButton={
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                title={t('addTourReport')}
              >
                <Plus className="h-4 w-4" />
              </button>
            }
          >
          <TourReportSection
            tourId={tour.id}
            productId={tour.product_id}
            tourDate={tour.tour_date}
            tourName={
              locale === 'en'
                ? product?.name_en || product?.name_ko || product?.name || ''
                : product?.name_ko || product?.name_en || product?.name || ''
            }
          />
          </AccordionSection>
        </div>
      </div>

      {/* 투어 리포트 추가 모달 — z-index를 가이드 하단 푸터(z-50)보다 위로 (안 그러면 버튼이 푸터에 가려짐) */}
      <UncompletedTourReportReminderModal
        open={showMissingReportReminder && !isReportModalOpen}
        locale={locale}
        items={
          tour
            ? [
                {
                  id: tour.id,
                  tourDate: tour.tour_date,
                  name:
                    locale === 'en'
                      ? product?.name_en || product?.name_ko || product?.name || tour.product_id || tour.id
                      : product?.name_ko || product?.name_en || product?.name || tour.product_id || tour.id,
                },
              ]
            : []
        }
        onWriteNow={() => {
          setShowMissingReportReminder(false)
          setIsReportModalOpen(true)
        }}
        onDismiss={() => setShowMissingReportReminder(false)}
      />
      {isReportModalOpen && (
        <div
          className="modal-inset-below-chrome bg-black/50"
          aria-modal="true"
          role="presentation"
        >
          {/* 헤더·모바일 푸터 바깥 영역만 사용 / sm+: 카드형 */}
          <div className="flex h-full max-h-full w-full max-w-none flex-col overflow-hidden bg-white sm:mx-auto sm:h-[min(90vh,calc(100dvh-var(--header-height)-1.5rem))] sm:max-w-4xl sm:rounded-lg sm:shadow-xl">
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
                productId={tour.product_id ?? null}
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

      <GuidePickupChargeModal
        open={fieldChargeTarget != null}
        onClose={() => setFieldChargeTarget(null)}
        locale={locale}
        target={fieldChargeTarget}
        onPaid={() => {
          const ids = reservations.map((r) => r.id)
          if (ids.length === 0) return
          void computeGuidePickupBalanceBreakdowns(
            supabase,
            ids,
            reservations,
            guidePickupUseEnvelopeEnglish(locale)
          ).then(setPickupBalanceBreakdownByReservationId)
        }}
      />

      {tour.tour_date && currentUserEmail ? (
        <TourChatModal
          isOpen={chatModalOpen}
          onClose={() => setChatModalOpen(false)}
          tourId={tour.id}
          guideEmail={currentUserEmail}
          tourDate={tour.tour_date}
          title={t('chat')}
          closeLabel={t('closeChat')}
          customerLanguage={locale === 'ko' ? 'ko' : 'en'}
          productNames={
            product
              ? {
                  name: product.name,
                  name_ko: product.name_ko ?? product.name,
                  name_en: product.name_en,
                }
              : null
          }
        />
      ) : null}

    </div>
  )
}

