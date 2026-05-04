'use client'

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Users, MapPin, X, ArrowUp, ArrowDown, GripVertical, CalendarOff, ExternalLink, Plus, Trash2, UserPlus, Car, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  isReservationCancelledStatus,
  normalizeReservationIds,
  canonicalReservationIdKey,
} from '@/utils/tourUtils'
import { getCustomerName, getStatusColor, getStatusLabel } from '@/utils/reservationUtils'
import { getStatusColor as getTourStatusColor, getStatusText as getTourStatusLabel, isTourCancelled, tourStatusOptions } from '@/utils/tourStatusUtils'
import ReservationForm from '@/components/reservation/ReservationForm'
import CancellationReasonModal from '@/components/reservation/CancellationReasonModal'
import ReactCountryFlag from 'react-country-flag'
import DateNoteModal from './DateNoteModal'
import dynamic from 'next/dynamic'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTourHandlers } from '@/hooks/useTourHandlers'
import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'
import { createTourPhotosBucket } from '@/lib/tourPhotoBucket'
import { generateTourId } from '@/lib/entityIds'
import { upsertReservationCancellationReason } from '@/lib/reservationCancellationReason'
import {
  SCHEDULE_COLOR_PRESETS,
  getScheduleProductDisplayProps,
} from '@/lib/scheduleProductColorPresets'
import ScheduleTicketBookingAxisInline from '@/components/booking/ScheduleTicketBookingAxisInline'
import {
  TicketBookingBookingStatusIcon,
  TicketBookingVendorStatusIcon,
} from '@/components/booking/ticketBookingAxisStatusIcons'
import { formatTicketBookingAxisLabel } from '@/lib/ticketBookingAxisLabels'
import {
  filterTicketBookingsExcludedFromMainUi,
  canRequestTicketBookingSoftDelete,
} from '@/lib/ticketBookingSoftDelete'
import { isSuperAdminActor } from '@/lib/superAdmin'

const VehicleEditModal = dynamic(() => import('@/components/VehicleEditModal'), {
  ssr: false,
  loading: () => null,
})

const ScheduleTicketBookingForm = dynamic(() => import('@/components/booking/TicketBookingForm'), {
  ssr: false,
  loading: () => null,
})

const SCHEDULE_VEHICLE_EDIT_SELECT = `
  id,
  vehicle_number,
  vin,
  vehicle_type,
  capacity,
  year,
  mileage_at_purchase,
  purchase_amount,
  purchase_date,
  memo,
  engine_oil_change_cycle,
  current_mileage,
  recent_engine_oil_change_mileage,
  status,
  front_tire_size,
  rear_tire_size,
  windshield_wiper_size,
  headlight_model,
  headlight_model_name,
  is_installment,
  installment_amount,
  interest_rate,
  monthly_payment,
  additional_payment,
  payment_due_date,
  installment_start_date,
  installment_end_date,
  vehicle_image_url,
  color,
  vehicle_category,
  rental_company,
  daily_rate,
  rental_booking_price,
  rental_start_date,
  rental_end_date,
  rental_pickup_location,
  rental_return_location,
  rental_total_cost,
  rental_notes,
  rental_agreement_number,
  nick,
  created_at,
  updated_at
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tour = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Product = any
type Team = Database['public']['Tables']['team']['Row']
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reservation = any
type Customer = Database['public']['Tables']['customers']['Row']

/** 스케줄 그리드·호버 합계용 입장권 행 (ticket_bookings 일부 컬럼) */
type ScheduleTicketBookingRow = {
  id: string
  tour_id: string | null
  status: string | null
  ea: number | null
  company?: string
  time?: string
  check_in_date?: string
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  payment_status?: string | null
  refund_status?: string | null
  operation_status?: string | null
  deletion_requested_at?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReservationFormAny = ReservationForm as any

const PRODUCT_SCHEDULE_KEYCAP_DIGITS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'] as const

/** 단독 투어 인원만 키캡 이모지로 표시. 동행모집(비단독) 인원이 같이 있으면 `4️⃣ 5` 형태 */
function formatProductScheduleCellPeopleWithPrivateSplit(
  privateTourPeople: number,
  companionTourPeople: number,
  waiting: number,
  canceled: number
): string {
  const toKeycap = (n: number) =>
    String(Math.max(0, Math.floor(n)))
      .split('')
      .map((ch) => {
        const d = ch.charCodeAt(0) - 48
        return d >= 0 && d <= 9 ? PRODUCT_SCHEDULE_KEYCAP_DIGITS[d] : ch
      })
      .join('')

  let out: string
  if (privateTourPeople > 0 && companionTourPeople > 0) {
    out = `${toKeycap(privateTourPeople)} ${companionTourPeople}`
  } else if (privateTourPeople > 0) {
    out = toKeycap(privateTourPeople)
  } else {
    out = String(companionTourPeople)
  }
  if (waiting > 0) out += ` +${waiting}`
  if (canceled > 0) out += ` (${canceled})`
  return out
}

function scheduleReservationPrivateBucket(res: Reservation, dayTours: Tour[]): 'private' | 'companion' {
  const tourPrivate = (t: Tour) => t.is_private_tour === 'TRUE' || t.is_private_tour === true
  const rid = String(res.id)
  for (const tour of dayTours) {
    const ids = (tour.reservation_ids && Array.isArray(tour.reservation_ids))
      ? (tour.reservation_ids as string[])
      : []
    if (!ids.some((x) => String(x) === rid)) continue
    return tourPrivate(tour) ? 'private' : 'companion'
  }
  const r = res.is_private_tour === true || res.is_private_tour === 'TRUE' || res.is_private_tour === 1
  return r ? 'private' : 'companion'
}

interface DailyData {
  totalPeople: number
  assignedPeople: number
  tours: number
  productColors: { [productId: string]: string }
  role: string | null
  guideInitials: string | null
  isMultiDay: boolean
  multiDayDays: number
  extendsToNextMonth?: boolean
}

// interface ScheduleData {
//   product_id: string
//   product_name: string
//   team_member_id: string
//   team_member_name: string
//   position: string
//   dailyData: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number } }
//   totalPeople: number
//   totalAssignedPeople: number
//   totalTours: number
// }

/** 스케줄 부킹 행: 시간 표시용 (HH:mm) */
function normalizeBookingTimeForSchedule(time: string): { display: string; sort: string } {
  const t = (time || '').trim()
  if (!t) return { display: '—', sort: '99:99' }
  const m = t.match(/(\d{1,2})\s*:\s*(\d{2})/)
  if (m) {
    const h = Math.min(23, Math.max(0, parseInt(m[1], 10)))
    const min = m[2]
    const display = `${String(h).padStart(2, '0')}:${min}`
    return { display, sort: display }
  }
  return { display: t.length > 8 ? `${t.slice(0, 8)}…` : t, sort: t }
}

/** 입장권 공급사 등 짧은 태그 (첫 글자) */
function ticketCompanyShortTag(company: string): string {
  const c = (company || '').trim()
  if (!c) return '?'
  const normalized = c.replace(/\s+/g, ' ')
  if (/^antelope\s+x(\s+canyon)?$/i.test(normalized) || /\bantelope\s+x\b/i.test(normalized)) {
    return 'X'
  }
  const match = c.match(/[A-Za-z0-9가-힣]/)
  if (!match) return '?'
  const ch = match[0]
  return /[a-zA-Z]/.test(ch) ? ch.toUpperCase() : ch
}

function aggregateTicketDetailsForScheduleDisplay(
  details: Array<{ id: string; company: string; time: string; ea: number }>
): Array<{ displayTime: string; tag: string; ea: number; bookingIds: string[] }> {
  const map = new Map<string, { sort: string; displayTime: string; tag: string; ea: number; bookingIds: string[] }>()
  for (const d of details) {
    const { display, sort } = normalizeBookingTimeForSchedule(d.time || '')
    const tag = ticketCompanyShortTag(d.company || '')
    const mergeKey = `${sort}|${tag}`
    const prev = map.get(mergeKey)
    if (prev) {
      prev.ea += d.ea
      prev.bookingIds.push(d.id)
    } else {
      map.set(mergeKey, { sort, displayTime: display, tag, ea: d.ea, bookingIds: [d.id] })
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.sort !== b.sort) return a.sort.localeCompare(b.sort)
    return a.tag.localeCompare(b.tag)
  })
}

/** 부킹 상세 뱃지 표기: 공급사 첫글자 S → L 로 표시 (데이터·집계 키는 그대로 S) */
function scheduleBookingSupplierTagDisplay(tag: string): string {
  const t = tag.trim()
  const u = t.length === 1 && /[a-zA-Z]/.test(t) ? t.toUpperCase() : t
  return u === 'S' ? 'L' : t
}

function scheduleBookingSupplierTagBadgeClass(tag: string): string {
  const t = tag.trim()
  const u = t.length === 1 && /[a-zA-Z]/.test(t) ? t.toUpperCase() : t
  switch (u) {
    case 'S':
      return 'bg-slate-200 text-slate-900 ring-1 ring-slate-400/55'
    case 'X':
      return 'bg-amber-200 text-amber-950 ring-1 ring-amber-500/50'
    case 'D':
      return 'bg-emerald-200 text-emerald-950 ring-1 ring-emerald-500/45'
    case 'K':
      return 'bg-rose-200 text-rose-950 ring-1 ring-rose-400/55'
    default:
      return 'bg-violet-100 text-violet-900 ring-1 ring-violet-300/70'
  }
}

type ScheduleBookingDetailRow =
  | {
      kind: 'ticket'
      displayTime: string
      tag: string
      ea: number
      bookingIds: string[]
    }
  | { kind: 'hotel'; line: string }

/** 달력에 합쳐진 여러 입장권 행의 예약·벤더 축이 모두 같은지 */
function resolveMergedTicketBookingAxisDisplay(
  bookingIds: string[],
  byId: Map<string, ScheduleTicketBookingRow>
): { mixed: boolean; bookingStatus: string | null; vendorStatus: string | null } {
  const rows = bookingIds
    .map((id) => byId.get(id))
    .filter((x): x is ScheduleTicketBookingRow => Boolean(x))
  if (rows.length === 0) return { mixed: true, bookingStatus: null, vendorStatus: null }
  const bs = new Set(rows.map((r) => (r.booking_status ?? 'requested').trim().toLowerCase()))
  const vs = new Set(rows.map((r) => (r.vendor_status ?? 'pending').trim().toLowerCase()))
  const mixed = bs.size > 1 || vs.size > 1 || rows.length < bookingIds.length
  return {
    mixed,
    bookingStatus: mixed ? null : [...bs][0] ?? null,
    vendorStatus: mixed ? null : [...vs][0] ?? null,
  }
}

/** 드롭 존·행 재정렬 하이라이트는 classList만 갱신해 dragover마다 전체 트리 리렌더를 피함 */
const SCHEDULE_GUIDE_DROP_ZONE_HIGHLIGHT = ['bg-blue-200', 'border-2', 'border-blue-400'] as const
const SCHEDULE_VEHICLE_CELL_DROP_HIGHLIGHT = ['ring-2', 'ring-blue-400', 'bg-blue-50'] as const
const SCHEDULE_ROW_REORDER_HIGHLIGHT = ['border-t-2', 'border-blue-500'] as const

function addScheduleLocalDaysYmd(daysFromToday: number): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getScheduleRentalVehiclePrefill() {
  return {
    vehicle_category: 'rental',
    vehicle_number: 'RENT',
    vehicle_type: 'Ford Transit 15 passenger',
    capacity: 15,
    rental_company: 'Enterprise',
    status: 'reserved',
    rental_start_date: addScheduleLocalDaysYmd(1),
    rental_end_date: addScheduleLocalDaysYmd(2),
    rental_pickup_location: 'Airport Rent a Car Center',
    rental_return_location: 'Airport Rent a Car Center',
  }
}

export default function ScheduleView() {
  const router = useRouter()
  const locale = useLocale()
  const tReservations = useTranslations('reservations')
  const tTourCal = useTranslations('tours.calendar')
  const tTbAxis = useTranslations('booking.calendar.ticketBookingAxis')
  const { user, userRole, userPosition, hasPermission } = useAuth()
  const tourHandlers = useTourHandlers()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [products, setProducts] = useState<Product[]>([])
  const [teamMembers, setTeamMembers] = useState<Team[]>([])
  const [inactiveTeamMembers, setInactiveTeamMembers] = useState<Team[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([])
  
  // 관리자 권한 확인 (super 또는 admin)
  const isSuperAdmin = useMemo(() => {
    if (!user?.email) return false
    const normalizedEmail = user.email.toLowerCase()
    const superAdminEmails = ['info@maniatour.com', 'wooyong.shim09@gmail.com']
    if (superAdminEmails.includes(normalizedEmail)) return true
    
    // team 테이블에서 position 확인
    const teamMember = teamMembers.find(m => m.email === user.email)
    return teamMember?.position?.toLowerCase() === 'super' || userRole === 'admin'
  }, [user, userRole, teamMembers])

  /** 배차 표에서 차량명 → VehicleEditModal (super/admin·manager·OP) */
  const canEditVehicleFromSchedule = useMemo(
    () =>
      isSuperAdmin ||
      userRole === 'manager' ||
      (userPosition || '').toLowerCase().trim() === 'op',
    [isSuperAdmin, userRole, userPosition]
  )

  /** 입장권 폼: 실제 삭제·삭제 요청 권한 (SUPER / OP·매니저) */
  const canSuperActorTicketBookingForm = useMemo(
    () => isSuperAdminActor(user?.email, userPosition),
    [user?.email, userPosition]
  )
  const canRequestScheduleTicketSoftDelete = useMemo(
    () => canRequestTicketBookingSoftDelete(userPosition),
    [userPosition]
  )

  /** 투어 상세 모달·스케줄에서 상태 변경 (투어 상세 페이지 useTourDetailData와 동일 기준) */
  const isScheduleStaff = useMemo(
    () =>
      hasPermission('canManageReservations') ||
      hasPermission('canManageTours') ||
      userRole === 'admin' ||
      userRole === 'manager',
    [hasPermission, userRole]
  )
  const [loading, setLoading] = useState(true)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamModalTab, setTeamModalTab] = useState<'active' | 'inactive'>('active')
  const [teamModalSearchQuery, setTeamModalSearchQuery] = useState('')
  const [activatingTeamMemberEmail, setActivatingTeamMemberEmail] = useState<string | null>(null)
  const [productColors, setProductColors] = useState<{ [productId: string]: string }>({})
  // const [currentUserId] = useState('admin') // 실제로는 인증된 사용자 ID를 사용해야 함
  const [draggedTour, setDraggedTour] = useState<Tour | null>(null)
  const [unassignedTours, setUnassignedTours] = useState<Tour[]>([])
  const [ticketBookings, setTicketBookings] = useState<ScheduleTicketBookingRow[]>([])
  const [tourHotelBookings, setTourHotelBookings] = useState<Array<{ id: string; tour_id: string | null; status: string | null; rooms: number | null; hotel?: string; check_in_date?: string }>>([])
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null)
  const [hoveredBookingDate, setHoveredBookingDate] = useState<string | null>(null)
  const [bookingRowExpanded, setBookingRowExpanded] = useState(false)
  const [scheduleTicketBookingFormOpen, setScheduleTicketBookingFormOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scheduleTicketBookingEdit, setScheduleTicketBookingEdit] = useState<any>(null)
  const [pickScheduleTicketBookingIds, setPickScheduleTicketBookingIds] = useState<string[] | null>(null)
  const [offSchedules, setOffSchedules] = useState<Array<{ team_email: string; off_date: string; reason: string; status: string }>>([])
  const [draggedUnassignedTour, setDraggedUnassignedTour] = useState<Tour | null>(null)
  /** 미배정 투어 드래그 중: 화면 상·하단 근처에서 페이지 자동 스크롤 */
  const unassignedDragAutoScrollCleanupRef = useRef<(() => void) | null>(null)
  const unassignedDragScrollRafRef = useRef<number | null>(null)
  const unassignedDragPendingClientYRef = useRef<number | null>(null)
  const scheduleDragHighlightElRef = useRef<HTMLElement | null>(null)
  const scheduleDragHighlightClassesRef = useRef<readonly string[]>([])
  const [updatingUnassignedTourStatusId, setUpdatingUnassignedTourStatusId] = useState<string | null>(null)
  const [unassignedTourStatusModalTourId, setUnassignedTourStatusModalTourId] = useState<string | null>(null)
  /** 미배정 카드: 버튼으로 가이드/어시스턴트 배정 */
  const [unassignedPersonAssignModal, setUnassignedPersonAssignModal] = useState<{
    tour: Tour
    role: 'guide' | 'assistant'
  } | null>(null)
  /** 미배정 카드: 버튼으로 차량 배정 */
  const [unassignedVehicleAssignModalTourId, setUnassignedVehicleAssignModalTourId] = useState<string | null>(null)
  const [draggedRole, setDraggedRole] = useState<'guide' | 'assistant' | null>(null)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageModalContent, setMessageModalContent] = useState({ title: '', message: '', type: 'success' as 'success' | 'error' })
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmModalContent, setConfirmModalContent] = useState({ title: '', message: '', onConfirm: () => {}, buttonText: '확인', buttonColor: 'bg-red-500 hover:bg-red-600' })
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [guideModalContent, setGuideModalContent] = useState({ title: '', content: '', tourId: '' })
  const [tourDetailModal, setTourDetailModal] = useState<{ tourId: string; title: string } | null>(null)
  const [tourDetailIframeReloadNonce, setTourDetailIframeReloadNonce] = useState(0)
  const [updatingTourDetailModalStatusId, setUpdatingTourDetailModalStatusId] = useState<string | null>(null)
  
  // 행 드래그앤드롭 상태 (가이드/상품)
  const [draggedGuideRow, setDraggedGuideRow] = useState<string | null>(null)
  const [hoveredGuideRow, setHoveredGuideRow] = useState<string | null>(null)
  const [draggedProductRow, setDraggedProductRow] = useState<string | null>(null)
  const [vehicleRowOrderForMonth, setVehicleRowOrderForMonth] = useState<string[] | null>(null)
  const [draggedVehicleRowId, setDraggedVehicleRowId] = useState<string | null>(null)
  const [shareTeamMembersSetting, setShareTeamMembersSetting] = useState(false)

  const clearScheduleDragHighlight = useCallback(() => {
    const el = scheduleDragHighlightElRef.current
    if (el) {
      scheduleDragHighlightClassesRef.current.forEach((c) => el.classList.remove(c))
      scheduleDragHighlightElRef.current = null
      scheduleDragHighlightClassesRef.current = []
    }
  }, [])

  const applyScheduleDragHighlight = useCallback(
    (el: HTMLElement, classes: readonly string[]) => {
      // dragover는 같은 요소에 반복 호출됨. React 리렌더가 className을 덮어쓸 수 있어
      // 동일 요소여도 매번 제거 후 다시 적용해야 시각 피드백이 유지됨.
      clearScheduleDragHighlight()
      for (const c of classes) el.classList.add(c)
      scheduleDragHighlightElRef.current = el
      scheduleDragHighlightClassesRef.current = classes
    },
    [clearScheduleDragHighlight]
  )

  /** 드래그 배정/행 순서 변경 중에는 호버 state 갱신으로 리렌더가 나지 않도록 함 */
  const scheduleInteractionDragging = Boolean(
    draggedTour ||
      draggedUnassignedTour ||
      draggedVehicleRowId ||
      draggedGuideRow ||
      draggedProductRow
  )

  /** 페이지(뷰포트) 세로 스크롤 시 날짜 행 sticky — 고정 상단 헤더 높이(px), 없으면 :root --header-height */
  const [productScheduleStickyTopPx, setProductScheduleStickyTopPx] = useState(64)
  useLayoutEffect(() => {
    const readStickyTopPx = () => {
      if (typeof window === 'undefined') return
      const fixedHeader = document.querySelector<HTMLElement>('header.fixed')
      if (fixedHeader) {
        const h = fixedHeader.getBoundingClientRect().height
        if (h > 0) {
          setProductScheduleStickyTopPx(Math.round(h))
          return
        }
      }
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
      if (raw.endsWith('px')) {
        const n = parseFloat(raw)
        if (!Number.isNaN(n)) setProductScheduleStickyTopPx(Math.round(n))
        return
      }
      if (raw.endsWith('rem')) {
        const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        const n = parseFloat(raw)
        if (!Number.isNaN(n)) setProductScheduleStickyTopPx(Math.round(n * fs))
      }
    }
    readStickyTopPx()
    window.addEventListener('resize', readStickyTopPx)
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => readStickyTopPx())
        : null
    const headerEl = document.querySelector<HTMLElement>('header.fixed')
    if (ro && headerEl) ro.observe(headerEl)
    return () => {
      window.removeEventListener('resize', readStickyTopPx)
      ro?.disconnect()
    }
  }, [])

  
  // 날짜별 노트 상태
  const [dateNotes, setDateNotes] = useState<{ [date: string]: { note: string; created_by?: string } }>({})
  const [showDateNoteModal, setShowDateNoteModal] = useState(false)
  const [selectedDateForNote, setSelectedDateForNote] = useState<string | null>(null)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  // 해당 월 사용 가능 차량 목록 (취소·비활성 제외, 렌터카는 렌트 시작~종료가 해당 월과 겹치는 것만)
  const [scheduleVehicles, setScheduleVehicles] = useState<Array<{
    id: string
    label: string
    vehicle_category?: string | null
    rental_start_date?: string | null
    rental_end_date?: string | null
  }>>([])
  // 차량·날짜 셀 클릭 시 투어 배정 모달
  const [showVehicleAssignModal, setShowVehicleAssignModal] = useState(false)
  const [vehicleAssignTarget, setVehicleAssignTarget] = useState<{ vehicleId: string; dateString: string } | null>(null)
  const [showVehicleEditModal, setShowVehicleEditModal] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [vehicleEditModalVehicle, setVehicleEditModalVehicle] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [vehicleEditModalPrefill, setVehicleEditModalPrefill] = useState<any>(null)
  // 상품 색상 프리셋 선택 모달 (상품별로 클릭 시 열림)
  const [colorPresetModal, setColorPresetModal] = useState<{ productId: string; productName: string } | null>(null)

  // 예약별 초이스 (상품별 스케줄 툴팁·투어 상세 모달용, 인원(quantity) 합산)
  const [reservationChoices, setReservationChoices] = useState<Array<{
    reservation_id: string
    choiceKey: string
    quantity: number
  }>>([])

  // 배치 저장용 변경 대기 상태
  const [pendingChanges, setPendingChanges] = useState<{ [tourId: string]: Partial<Tour> }>({})
  const [pendingOffScheduleChanges, setPendingOffScheduleChanges] = useState<{ [key: string]: { team_email: string; off_date: string; reason: string; status: string; action: 'approve' | 'delete' | 'reject' } }>({})
  const pendingCount = useMemo(() => Object.keys(pendingChanges).length + Object.keys(pendingOffScheduleChanges).length, [pendingChanges, pendingOffScheduleChanges])
  
  // 오프 스케줄 액션 모달 상태
  const [showOffScheduleActionModal, setShowOffScheduleActionModal] = useState(false)
  const [selectedOffSchedule, setSelectedOffSchedule] = useState<{ team_email: string; off_date: string; reason: string; status: string } | null>(null)
  const [newOffScheduleReason, setNewOffScheduleReason] = useState('')

  // 일괄 오프 스케줄 모달 상태
  const [showBatchOffModal, setShowBatchOffModal] = useState(false)
  const [batchOffGuides, setBatchOffGuides] = useState<string[]>([])
  const [batchOffPeriods, setBatchOffPeriods] = useState<Array<{ id: string; startDate: string; endDate: string }>>(() => [
    { id: crypto.randomUUID(), startDate: '', endDate: '' },
  ])
  const [batchOffReason, setBatchOffReason] = useState('')
  const [batchOffSaving, setBatchOffSaving] = useState(false)

  /** 드래그 배정 후: 서버에 바로 저장할지 묻는 모달 */
  const [dragAssignSaveModalOpen, setDragAssignSaveModalOpen] = useState(false)
  const [dragAssignSaveLoading, setDragAssignSaveLoading] = useState(false)
  /** 켜면 드래그 배정 후 즉시 저장 모달 없음 · 다른 페이지로 이동 시 저장/폐기 선택 */
  const [scheduleExplorationMode, setScheduleExplorationMode] = useState(false)
  const [scheduleLeavePromptOpen, setScheduleLeavePromptOpen] = useState(false)
  const [scheduleLeaveSaving, setScheduleLeaveSaving] = useState(false)
  const pendingScheduleLeaveRef = useRef<(() => void) | null>(null)

  const resetBatchOffModalFields = useCallback(() => {
    setBatchOffGuides([])
    setBatchOffPeriods([{ id: crypto.randomUUID(), startDate: '', endDate: '' }])
    setBatchOffReason('')
  }, [])

  /** 여러 기간을 합쳐 중복 없는 날짜 목록 */
  const collectBatchOffDatesFromPeriods = useCallback((periods: Array<{ startDate: string; endDate: string }>) => {
    const unique = new Set<string>()
    for (const p of periods) {
      if (!p.startDate || !p.endDate) continue
      if (dayjs(p.endDate).isBefore(dayjs(p.startDate), 'day')) continue
      let current = dayjs(p.startDate)
      const end = dayjs(p.endDate)
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        unique.add(current.format('YYYY-MM-DD'))
        current = current.add(1, 'day')
      }
    }
    return Array.from(unique)
  }, [])

  const batchOffPeriodsValid = useMemo(() => {
    if (batchOffPeriods.length === 0) return false
    return batchOffPeriods.every((p) => {
      if (!p.startDate || !p.endDate) return false
      return !dayjs(p.endDate).isBefore(dayjs(p.startDate), 'day')
    })
  }, [batchOffPeriods])

  const batchOffUniqueDayCount = useMemo(
    () =>
      collectBatchOffDatesFromPeriods(
        batchOffPeriods.map(({ startDate, endDate }) => ({ startDate, endDate }))
      ).length,
    [batchOffPeriods, collectBatchOffDatesFromPeriods]
  )

  /** 정원 초과(배정 > 수용) 안내 모달 — 월 변경 시 다시 표시 가능 */
  const [capacityOverflowModalOpen, setCapacityOverflowModalOpen] = useState(false)
  const [capacityOverflowModalDismissed, setCapacityOverflowModalDismissed] = useState(false)
  const [capacityOverflowCreatingKey, setCapacityOverflowCreatingKey] = useState<string | null>(null)

  /** 스케쥴뷰(상품별 인원) 셀 클릭 → 해당일·상품 예약 목록 */
  const [productCellReservationsModal, setProductCellReservationsModal] = useState<{
    productId: string
    dateString: string
    productName: string
  } | null>(null)
  const [reservationIdForScheduleEdit, setReservationIdForScheduleEdit] = useState<string | null>(null)
  const [scheduleEditingReservation, setScheduleEditingReservation] = useState<Record<string, unknown> | null>(null)
  const [scheduleReservationFormData, setScheduleReservationFormData] = useState<{
    customers: unknown[]
    products: unknown[]
    channels: unknown[]
    productOptions: unknown[]
    options: unknown[]
    pickupHotels: unknown[]
    coupons: unknown[]
  } | null>(null)
  const [loadingScheduleReservationEdit, setLoadingScheduleReservationEdit] = useState(false)

  // 통합 스크롤 컨테이너는 하나의 스크롤로 동기화됨

  // 메시지 모달 표시 함수
  const showMessage = useCallback((title: string, message: string, type: 'success' | 'error' = 'success') => {
    setMessageModalContent({ title, message, type })
    setShowMessageModal(true)
  }, [])

  // 확인 모달 표시 함수
  const showConfirm = (title: string, message: string, onConfirm: () => void, buttonText: string = '확인', buttonColor: string = 'bg-red-500 hover:bg-red-600') => {
    setConfirmModalContent({ title, message, onConfirm, buttonText, buttonColor })
    setShowConfirmModal(true)
  }

  // 가이드 모달 표시 함수
  const showGuideModalContent = (title: string, content: string, tourId: string = '') => {
    setGuideModalContent({ title, content, tourId })
    setShowGuideModal(true)
  }

  // 날짜 노트 모달 열기
  const openDateNoteModal = useCallback((dateString: string) => {
    setSelectedDateForNote(dateString)
    setShowDateNoteModal(true)
  }, [])

  // 날짜 노트 저장
  const saveDateNote = useCallback(async (noteText: string) => {
    if (!selectedDateForNote) return

    try {
      const noteData = {
        note_date: selectedDateForNote,
        note: noteText.trim() || null,
        created_by: user?.email || null
      }

      // 노트가 비어있으면 삭제, 있으면 upsert
      if (!noteText.trim()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from('date_notes' as any)
          .delete()
          .eq('note_date', selectedDateForNote)

        if (error) throw error

        // 상태 업데이트
        setDateNotes(prev => {
          const newNotes = { ...prev }
          delete newNotes[selectedDateForNote]
          return newNotes
        })
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from('date_notes' as any)
          .upsert(noteData, { onConflict: 'note_date' })

        if (error) throw error

        // 상태 업데이트
        setDateNotes(prev => ({
          ...prev,
          [selectedDateForNote]: {
            note: noteText.trim(),
            ...(user?.email ? { created_by: user.email } : {})
          }
        }))
      }

      setShowDateNoteModal(false)
      setSelectedDateForNote(null)
      showMessage('저장 완료', '날짜 노트가 저장되었습니다.', 'success')
    } catch (error) {
      console.error('Error saving date note:', error)
      showMessage('저장 실패', '날짜 노트 저장 중 오류가 발생했습니다.', 'error')
      throw error
    }
  }, [selectedDateForNote, user?.email, showMessage])

  // 날짜 노트 삭제
  const deleteDateNote = useCallback(async () => {
    if (!selectedDateForNote) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('date_notes' as any)
        .delete()
        .eq('note_date', selectedDateForNote)

      if (error) throw error

      // 상태 업데이트
      setDateNotes(prev => {
        const newNotes = { ...prev }
        delete newNotes[selectedDateForNote]
        return newNotes
      })

      setShowDateNoteModal(false)
      setSelectedDateForNote(null)
      showMessage('삭제 완료', '날짜 노트가 삭제되었습니다.', 'success')
    } catch (error) {
      console.error('Error deleting date note:', error)
      showMessage('삭제 실패', '날짜 노트 삭제 중 오류가 발생했습니다.', 'error')
      throw error
    }
  }, [selectedDateForNote, showMessage])

  // 날짜 노트 모달 닫기
  const closeDateNoteModal = useCallback(() => {
    setShowDateNoteModal(false)
    setSelectedDateForNote(null)
  }, [])

  // 공유 설정 저장 (관리자만, 데이터베이스에 저장)
  const saveSharedSetting = async (
    key: string,
    value: string[] | number | boolean | Record<string, string[]>
  ) => {
    if (!isSuperAdmin || !user?.id) return
    
    try {
      if (Array.isArray(value) && value.length === 0) {
        console.log('Skipping save for empty array:', key)
        // 빈 배열인 경우 데이터베이스에서 삭제
        await supabase
          .from('shared_settings')
          .delete()
          .eq('setting_key', key)
        return
      }
      
      if (value === null || value === undefined) {
        console.log('Skipping save for null/undefined value:', key)
        return
      }

      // 데이터베이스에 저장 (upsert 사용)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('shared_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          updated_by: user.id
        }, {
          onConflict: 'setting_key'
        })

      if (error) {
        console.error('Error saving shared setting to database:', error)
        // 실패 시 localStorage에 fallback 저장
        const sharedKey = `shared_${key}`
        localStorage.setItem(sharedKey, JSON.stringify(value))
      } else {
        console.log('Shared setting saved to database:', key, value)
        // 성공 시 localStorage에도 저장 (캐시용)
        const sharedKey = `shared_${key}`
        localStorage.setItem(sharedKey, JSON.stringify(value))
      }
    } catch (error) {
      console.error('Error saving shared setting:', error)
      // 에러 발생 시 localStorage에 fallback 저장
      const sharedKey = `shared_${key}`
      localStorage.setItem(sharedKey, JSON.stringify(value))
    }
  }

  // 사용자 설정 저장
  const saveUserSetting = async (
    key: string,
    value: string[] | number | boolean | Record<string, string[]>,
    saveAsShared: boolean = false
  ) => {
    try {
      // 빈 배열이나 유효하지 않은 값은 저장하지 않음
      if (Array.isArray(value) && value.length === 0) {
        console.log('Skipping save for empty array:', key)
        return
      }
      
      if (value === null || value === undefined) {
        console.log('Skipping save for null/undefined value:', key)
        return
      }

      // 관리자가 공유 설정으로 저장하는 경우
      if (saveAsShared && isSuperAdmin) {
        await saveSharedSetting(key, value)
      }

      // 개인 설정은 항상 저장
      localStorage.setItem(key, JSON.stringify(value))
      console.log('User setting saved to localStorage:', key, value)
    } catch (error) {
      console.error('Error saving user setting:', error)
      // fallback to localStorage
      localStorage.setItem(key, JSON.stringify(value))
    }
  }

  // 사용자 설정 불러오기
  const loadUserSettings = useCallback(async () => {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
    try {
      // 먼저 데이터베이스에서 공유 설정 로드
      const { data: sharedSettings, error: sharedError } = await supabase
        .from('shared_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['schedule_selected_products', 'schedule_selected_team_members', 'schedule_product_colors', 'schedule_vehicle_row_order'])

      if (sharedError) {
        console.warn('Error loading shared settings from database:', sharedError)
      }

      // 공유 설정을 Map으로 변환
      type SharedSetting = {
        setting_key: string
        setting_value: string[] | number | boolean | Record<string, string[]>
      }
      const sharedSettingsMap = new Map<string, string[] | number | boolean | Record<string, string[]>>()
      if (sharedSettings) {
        (sharedSettings as SharedSetting[]).forEach(setting => {
          sharedSettingsMap.set(setting.setting_key, setting.setting_value)
          // localStorage에도 캐시 저장
          localStorage.setItem(`shared_${setting.setting_key}`, JSON.stringify(setting.setting_value))
        })
      }

      // 공유 설정이 있으면 우선 사용, 없으면 localStorage에서 확인, 그래도 없으면 개인 설정 사용
      const sharedProducts = sharedSettingsMap.get('schedule_selected_products')
        || (() => {
          const cached = localStorage.getItem('shared_schedule_selected_products')
          return cached ? JSON.parse(cached) : null
        })()
      
      const sharedTeamMembers = sharedSettingsMap.get('schedule_selected_team_members')
        || (() => {
          const cached = localStorage.getItem('shared_schedule_selected_team_members')
          return cached ? JSON.parse(cached) : null
        })()

      const savedProducts = sharedProducts || localStorage.getItem('schedule_selected_products')
      const savedTeamMembers = sharedTeamMembers || localStorage.getItem('schedule_selected_team_members')
      
      if (savedProducts) {
        try {
          const products = typeof savedProducts === 'string' ? JSON.parse(savedProducts) : savedProducts
          setSelectedProducts(products)
        } catch (parseError) {
          console.warn('Error parsing saved products:', parseError)
        }
      }
      if (savedTeamMembers) {
        try {
          const members = typeof savedTeamMembers === 'string' ? JSON.parse(savedTeamMembers) : savedTeamMembers
          setSelectedTeamMembers(members)
        } catch (parseError) {
          console.warn('Error parsing saved team members:', parseError)
        }
      }

      // 상품 색상 복원
      const sharedColors = sharedSettingsMap.get('schedule_product_colors')
        || (() => {
          const cached = localStorage.getItem('shared_schedule_product_colors')
          return cached ? JSON.parse(cached) : null
        })()
      const savedColors = sharedColors || localStorage.getItem('schedule_product_colors')
      if (savedColors) {
        try {
          const colors = typeof savedColors === 'string' ? JSON.parse(savedColors) : savedColors
          if (colors && typeof colors === 'object') {
            setProductColors(prev => ({ ...prev, ...colors }))
          }
        } catch (parseError) {
          console.warn('Error parsing saved product colors:', parseError)
        }
      }

      const sharedVehicleRowOrder = sharedSettingsMap.get('schedule_vehicle_row_order')
        || (() => {
          const cached = localStorage.getItem('shared_schedule_vehicle_row_order')
          return cached ? JSON.parse(cached) : null
        })()
      const savedVehicleRowOrder = sharedVehicleRowOrder || localStorage.getItem('schedule_vehicle_row_order')
      if (savedVehicleRowOrder) {
        try {
          const orderByMonth = typeof savedVehicleRowOrder === 'string'
            ? JSON.parse(savedVehicleRowOrder)
            : savedVehicleRowOrder
          if (orderByMonth && typeof orderByMonth === 'object') {
            setVehicleRowOrderForMonth((orderByMonth as Record<string, string[]>)[monthKey] ?? null)
          }
        } catch (parseError) {
          console.warn('Error parsing saved vehicle row order:', parseError)
        }
      }
    } catch (error) {
      console.warn('Error in loadUserSettings, using localStorage fallback:', error)
      // localStorage에서 직접 로드
      const savedProducts = localStorage.getItem('shared_schedule_selected_products') || localStorage.getItem('schedule_selected_products')
      const savedTeamMembers = localStorage.getItem('shared_schedule_selected_team_members') || localStorage.getItem('schedule_selected_team_members')
      
      if (savedProducts) {
        try {
          setSelectedProducts(JSON.parse(savedProducts))
        } catch (parseError) {
          console.warn('Error parsing saved products from localStorage:', parseError)
        }
      }
      if (savedTeamMembers) {
        try {
          setSelectedTeamMembers(JSON.parse(savedTeamMembers))
        } catch (parseError) {
          console.warn('Error parsing saved team members from localStorage:', parseError)
        }
      }
      // 색상도 localStorage에서 복원
      const savedColors = localStorage.getItem('shared_schedule_product_colors') || localStorage.getItem('schedule_product_colors')
      if (savedColors) {
        try {
          const colors = JSON.parse(savedColors)
          if (colors && typeof colors === 'object') {
            setProductColors(prev => ({ ...prev, ...colors }))
          }
        } catch (parseError) {
          console.warn('Error parsing saved product colors from localStorage:', parseError)
        }
      }

      const savedVehicleRowOrder = localStorage.getItem('shared_schedule_vehicle_row_order') || localStorage.getItem('schedule_vehicle_row_order')
      if (savedVehicleRowOrder) {
        try {
          const orderByMonth = JSON.parse(savedVehicleRowOrder)
          if (orderByMonth && typeof orderByMonth === 'object') {
            setVehicleRowOrderForMonth((orderByMonth as Record<string, string[]>)[monthKey] ?? null)
          }
        } catch (parseError) {
          console.warn('Error parsing saved vehicle row order from localStorage:', parseError)
        }
      }
    }
  }, [currentDate])

  // 프리셋 id면 스타일 반환, 아니면 레거시 className (하위 호환)
  const getProductDisplayProps = getScheduleProductDisplayProps
  // 기본 색상(프리셋 id) - 상품 순서별 폴백
  const defaultPresetIds = useMemo(() => SCHEDULE_COLOR_PRESETS.map(p => p.id), [])


  // 상품 색상 변경 (관리자는 항상 공유 설정 DB 저장 → 모든 사용자 동일 적용)
  const changeProductColor = async (productId: string, colorClass: string) => {
    const newColors = { ...productColors, [productId]: colorClass }
    setProductColors(newColors)
    localStorage.setItem('schedule_product_colors', JSON.stringify(newColors))
    if (isSuperAdmin) {
      await saveSharedSetting('schedule_product_colors', newColors as unknown as string[])
      localStorage.setItem('shared_schedule_product_colors', JSON.stringify(newColors))
    }
  }

  // Tailwind CSS 클래스 또는 프리셋 id를 배경 hex로 변환
  const getColorFromClass = (colorClass: string | undefined) => {
    if (colorClass == null || typeof colorClass !== 'string') return '#6b7280'
    const preset = SCHEDULE_COLOR_PRESETS.find(p => p.id === colorClass)
    if (preset) return preset.bgHex
    const colorMap: { [key: string]: string } = {
      'bg-blue-500 border-blue-600 text-white': '#3b82f6',
      'bg-green-500 border-green-600 text-white': '#10b981',
      'bg-yellow-500 border-yellow-600 text-black': '#eab308',
      'bg-purple-500 border-purple-600 text-white': '#8b5cf6',
      'bg-pink-500 border-pink-600 text-white': '#ec4899',
      'bg-indigo-500 border-indigo-600 text-white': '#6366f1',
      'bg-red-500 border-red-600 text-white': '#ef4444',
      'bg-red-500': '#ef4444',
      'bg-orange-500 border-orange-600 text-white': '#f97316',
      'bg-orange-500': '#f97316',
      'bg-cyan-500 border-cyan-600 text-white': '#06b6d4',
      'bg-cyan-500': '#06b6d4',
      'bg-lime-500 border-lime-600 text-black': '#84cc16',
      'bg-lime-500': '#84cc16',
      'bg-gray-500 border-gray-600 text-white': '#6b7280',
      'bg-slate-500 border-slate-600 text-white': '#64748b',
      'bg-amber-500 border-amber-600 text-black': '#f59e0b',
      'bg-amber-500': '#f59e0b',
      'bg-teal-500 border-teal-600 text-white': '#14b8a6',
      'bg-teal-500': '#14b8a6',
      'bg-violet-500 border-violet-600 text-white': '#8b5cf6',
      'bg-violet-500': '#8b5cf6',
      'bg-rose-500 border-rose-600 text-white': '#f43f5e',
      'bg-rose-500': '#f43f5e',
      'bg-sky-500 border-sky-600 text-white': '#0ea5e9',
      'bg-sky-500': '#0ea5e9',
      'bg-fuchsia-500 border-fuchsia-600 text-white': '#d946ef',
      'bg-fuchsia-500': '#d946ef',
      'bg-emerald-500 border-emerald-600 text-white': '#10b981',
      'bg-emerald-500': '#10b981',
      'bg-stone-500 border-stone-600 text-white': '#78716c',
      'bg-stone-500': '#78716c',
      'bg-blue-600 border-blue-700 text-white': '#2563eb',
      'bg-blue-600': '#2563eb',
      'bg-green-600 border-green-700 text-white': '#059669',
      'bg-green-600': '#059669',
      'bg-red-600 border-red-700 text-white': '#dc2626',
      'bg-red-600': '#dc2626',
      'bg-purple-600 border-purple-700 text-white': '#9333ea',
      'bg-purple-600': '#9333ea',
      'bg-blue-500': '#3b82f6',
      'bg-green-500': '#10b981',
      'bg-pink-500': '#ec4899',
      'bg-indigo-500': '#6366f1',
      // 파스텔 (200/300)
      'bg-blue-200': '#bfdbfe',
      'bg-green-200': '#bbf7d0',
      'bg-yellow-200': '#fef08a',
      'bg-purple-200': '#e9d5ff',
      'bg-pink-200': '#fbcfe8',
      'bg-teal-200': '#99f6e4',
      'bg-orange-200': '#fed7aa',
      'bg-sky-200': '#bae6fd',
      'bg-rose-200': '#fecdd3',
      'bg-violet-200': '#ddd6fe',
      // 형광 (400)
      'bg-lime-400': '#a3e635',
      'bg-cyan-400': '#22d3ee',
      'bg-pink-400': '#f472b6',
      'bg-orange-400': '#fb923c',
      'bg-yellow-400': '#facc15',
      'bg-blue-400': '#60a5fa',
      'bg-fuchsia-400': '#e879f9',
      'bg-green-400': '#4ade80',
      'bg-violet-400': '#a78bfa',
      'bg-red-400': '#f87171',
      'bg-black': '#000000'
    }
    if (colorMap[colorClass]) return colorMap[colorClass]
    // 조합 문자열: bg-* 클래스 추출 후 매핑
    const bgMatch = colorClass.match(/\bbg-[a-z]+-\d+\b/)
    const bgOnly = bgMatch ? bgMatch[0] : ''
    return colorMap[bgOnly] || '#6b7280'
  }

  // 테두리 색상 클래스를 실제 색상 값으로 변환
  const getBorderColorValue = (borderColorClass: string) => {
    const colorMap: { [key: string]: string } = {
      'border-black': '#000000',
      'border-red-500': '#ef4444',
      'border-blue-500': '#3b82f6',
      'border-green-500': '#10b981',
      'border-yellow-500': '#eab308',
      'border-purple-500': '#8b5cf6',
      'border-pink-500': '#ec4899',
      'border-indigo-500': '#6366f1',
      'border-orange-500': '#f97316',
      'border-cyan-500': '#06b6d4',
      'border-lime-500': '#84cc16',
      'border-gray-500': '#6b7280',
      'border-slate-500': '#64748b',
      'border-teal-500': '#14b8a6',
      'border-amber-500': '#f59e0b',
      'border-emerald-500': '#10b981',
      'border-violet-500': '#8b5cf6'
    }
    return colorMap[borderColorClass] || '#000000'
  }

  // 같은 날짜 같은 product_id의 투어들을 팀별(가이드 기준)로 그룹화하여 테두리 색상 매핑
  const getTourBorderColor = useMemo(() => {
    const borderColors = [
      'border-black',      // 검은색 (첫 번째 팀)
      'border-red-500',    // 빨간색 (두 번째 팀)
      'border-blue-500',
      'border-green-500',
      'border-yellow-500',
      'border-purple-500',
      'border-pink-500',
      'border-indigo-500',
      'border-orange-500',
      'border-cyan-500',
      'border-lime-500',
      'border-gray-500',
      'border-slate-500',
      'border-teal-500',
      'border-amber-500',
      'border-emerald-500',
      'border-violet-500'
    ]
    
    // 날짜별, product_id별로 투어들을 그룹화하고 가이드 기준으로 팀 식별
    // Key: "date_productId", Value: Map<guideId, color>
    const dateProductTeamColorMap = new Map<string, Map<string, string>>()
    
    // 모든 투어를 날짜별, product_id별로 그룹화
    const dateProductToursMap = new Map<string, Array<{ tour: Tour; guideId: string }>>()
    
    tours.forEach(tour => {
      if (tour.tour_date && tour.product_id && tour.tour_guide_id) {
        const key = `${tour.tour_date}_${tour.product_id}`
        if (!dateProductToursMap.has(key)) {
          dateProductToursMap.set(key, [])
        }
        dateProductToursMap.get(key)!.push({
          tour,
          guideId: tour.tour_guide_id
        })
      }
    })
    
    // 각 날짜-product_id 조합에서 투어 ID별로 팀을 식별하고 색상 할당
    dateProductToursMap.forEach((tourList, dateProductKey) => {
      // 같은 투어 ID를 가진 투어들을 하나의 팀으로 봄
      const tourIdSet = new Set<string>()
      tourList.forEach(({ tour }) => {
        if (tour.id) {
          tourIdSet.add(tour.id)
        }
      })
      
      // 같은 날짜, 같은 product_id에서 여러 투어 ID(팀)가 있으면 색상 할당
      if (tourIdSet.size > 1) {
        Array.from(tourIdSet).forEach((tourId, teamIndex) => {
          const color = borderColors[teamIndex % borderColors.length]
          
          if (!dateProductTeamColorMap.has(dateProductKey)) {
            dateProductTeamColorMap.set(dateProductKey, new Map())
          }
          const tourIdColorMap = dateProductTeamColorMap.get(dateProductKey)!
          tourIdColorMap.set(tourId, color)
        })
      }
    })
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (tourId: string, dateString: string, productId: string, _guideId: string) => {
      const key = `${dateString}_${productId}`
      const tourIdColorMap = dateProductTeamColorMap.get(key)
      if (tourIdColorMap) {
        return tourIdColorMap.get(tourId) || ''
      }
      return ''
    }
  }, [tours])

  // 현재 월의 첫 번째 날과 마지막 날 계산 (dayjs)
  const firstDayOfMonth = useMemo(() => dayjs(currentDate).startOf('month'), [currentDate])
  const lastDayOfMonth = useMemo(() => dayjs(currentDate).endOf('month'), [currentDate])
  
  // 오늘 날짜 확인 함수
  const isToday = (dateString: string) => {
    const todayString = dayjs().format('YYYY-MM-DD')
    return dateString === todayString
  }

  // Off 날짜 확인 함수 (pending 변경사항 포함)
  const isOffDate = useCallback((teamMemberId: string, dateString: string) => {
    // teamMemberId를 team_email로 변환
    const teamMember = teamMembers.find(member => member.email === teamMemberId)
    if (!teamMember) return false
    
    // 기존 오프 스케줄 확인
    const existingOffSchedule = offSchedules.some(off => 
      off.team_email === teamMember.email && off.off_date === dateString
    )
    
    // pending 변경사항 확인 (삭제 예정인 경우 제외)
    const key = `${teamMember.email}_${dateString}`
    const pendingChange = pendingOffScheduleChanges[key]
    const isPendingDelete = pendingChange?.action === 'delete'
    const isPendingApprove = pendingChange?.action === 'approve'
    
    // 기존 오프 스케줄이 있고 삭제 예정이 아니거나, 승인 예정인 경우
    return (existingOffSchedule && !isPendingDelete) || isPendingApprove
  }, [teamMembers, offSchedules, pendingOffScheduleChanges])

  /** 배정 그리드 OFF 셀: 대기(amber)·승인(teal) 등 상태별 색 구분 */
  const offScheduleAssignmentCellClass = useCallback((status: string | undefined) => {
    const s = (status || '').toLowerCase()
    if (s === 'pending') {
      return 'absolute inset-0 bg-amber-500 text-amber-950 hover:bg-amber-400 rounded px-1 text-[10px] font-bold flex items-center justify-center leading-none cursor-pointer transition-colors select-none ring-2 ring-amber-400 ring-inset'
    }
    if (s === 'approved') {
      return 'absolute inset-0 bg-teal-900 text-teal-50 hover:bg-teal-800 rounded px-1 text-[10px] font-bold flex items-center justify-center leading-none cursor-pointer transition-colors select-none'
    }
    return 'absolute inset-0 bg-gray-600 text-gray-200 hover:bg-gray-500 rounded px-1 text-[10px] font-bold flex items-center justify-center leading-none cursor-pointer transition-colors select-none'
  }, [])

  // 상품 ID에 따른 멀티데이 투어 일수 계산
  const getMultiDayTourDays = useCallback((productId: string): number => {
    const multiDayPatterns = {
      'MNGC1N': 2,  // 1박2일
      'MNM1': 2,    // 1박2일
      'MNGC2N': 3,  // 2박3일
      'MNGC3N': 4,  // 3박4일
    }

    // 정확한 매치 확인
    if (multiDayPatterns[productId as keyof typeof multiDayPatterns]) {
      return multiDayPatterns[productId as keyof typeof multiDayPatterns]
    }

    // 패턴 매치 확인 (MNGC1N, MNM1 등으로 시작하는 경우)
    if (productId.startsWith('MNGC1N') || productId.startsWith('MNM1')) {
      return 2
    }
    if (productId.startsWith('MNGC2N')) {
      return 3
    }
    if (productId.startsWith('MNGC3N')) {
      return 4
    }

    return 1 // 기본값: 1일 투어
  }, [])

  /** 차량 스케줄·일별 투어 건수 공통: 해당 일이 투어 진행일(시작~N일째)에 포함되는지 */
  const tourCoversScheduleDate = useCallback(
    (tour: Tour, dateString: string): boolean => {
      if (tour.tour_date === dateString) return true
      const days = getMultiDayTourDays(tour.product_id)
      if (days <= 1) return false
      const start = dayjs(tour.tour_date)
      const end = start.add(days - 1, 'day')
      const d = dayjs(dateString)
      return !d.isBefore(start, 'day') && !d.isAfter(end, 'day')
    },
    [getMultiDayTourDays]
  )


  // 월 컬럼: 전월 마지막 날 + 해당 월 전체 + 익월 첫날 (예: 5월 뷰 → 4/30 … 5/31 … 6/1)
  const monthDays = useMemo(() => {
    const days = [] as { date: number; dateString: string; dayOfWeek: string; isEdgePadding: boolean }[]
    const dowMap = ['일', '월', '화', '수', '목', '금', '토']
    const first = dayjs(currentDate).startOf('month')
    const last = dayjs(currentDate).endOf('month')
    const prev = first.subtract(1, 'day')
    days.push({
      date: prev.date(),
      dateString: prev.format('YYYY-MM-DD'),
      dayOfWeek: dowMap[prev.day()],
      isEdgePadding: true,
    })
    const daysInMonth = dayjs(currentDate).daysInMonth()
    for (let i = 1; i <= daysInMonth; i++) {
      const d = dayjs(currentDate).date(i)
      days.push({
        date: i,
        dateString: d.format('YYYY-MM-DD'),
        dayOfWeek: dowMap[d.day()],
        isEdgePadding: false,
      })
    }
    const next = last.add(1, 'day')
    days.push({
      date: next.date(),
      dateString: next.format('YYYY-MM-DD'),
      dayOfWeek: dowMap[next.day()],
      isEdgePadding: true,
    })
    return days
  }, [currentDate])

  /** 당월 날만 (전월 말·익월 첫날 패딩 컬럼 제외) — 우측 합계 열 집계용 */
  const monthDaysCore = useMemo(
    () => monthDays.filter((d) => !d.isEdgePadding),
    [monthDays]
  )

  /** 그리드 마지막 컬럼 날짜(익월 1일 패딩). 달력 월 말일만 기준으로 멀티데이를 자르면 말일 시작 1박2일이 하루로 잘림 */
  const scheduleGridLastDay = useMemo(
    () =>
      monthDays.length > 0
        ? dayjs(monthDays[monthDays.length - 1].dateString)
        : dayjs(currentDate).endOf('month'),
    [monthDays, currentDate]
  )

  // 날짜 컬럼 공통 스타일 계산: 최소 40px, 남는 공간은 균등 분배
  const fixedSideColumnsPx = 176 // 좌측 제목칸 96 + 우측 합계 80
  const dayColumnWidthCalc = useMemo(() => `calc((100% - ${fixedSideColumnsPx}px) / ${monthDays.length})`, [monthDays.length])
  const dynamicMinTableWidthPx = useMemo(() => fixedSideColumnsPx + monthDays.length * 40, [monthDays.length])

  /** 상품 날짜 헤더 / 본문 가로 스크롤 동기화 (thead를 별도 sticky 래퍼에 두어 뷰포트 기준 sticky 유지) */
  const productScheduleHeaderScrollRef = useRef<HTMLDivElement>(null)
  const productScheduleBodyScrollRef = useRef<HTMLDivElement>(null)
  const productScheduleScrollSyncRef = useRef<'header' | 'body' | null>(null)

  const syncProductScheduleHorizontalScroll = useCallback((source: 'header' | 'body', scrollLeft: number) => {
    if (productScheduleScrollSyncRef.current) return
    productScheduleScrollSyncRef.current = source
    const headerEl = productScheduleHeaderScrollRef.current
    const bodyEl = productScheduleBodyScrollRef.current
    if (headerEl && bodyEl) {
      if (source === 'header') bodyEl.scrollLeft = scrollLeft
      else headerEl.scrollLeft = scrollLeft
    }
    requestAnimationFrame(() => {
      productScheduleScrollSyncRef.current = null
    })
  }, [])

  const onProductScheduleHeaderScroll = useCallback(() => {
    const el = productScheduleHeaderScrollRef.current
    if (el) syncProductScheduleHorizontalScroll('header', el.scrollLeft)
  }, [syncProductScheduleHorizontalScroll])

  const onProductScheduleBodyScroll = useCallback(() => {
    const el = productScheduleBodyScrollRef.current
    if (el) syncProductScheduleHorizontalScroll('body', el.scrollLeft)
  }, [syncProductScheduleHorizontalScroll])

  useLayoutEffect(() => {
    const headerEl = productScheduleHeaderScrollRef.current
    const bodyEl = productScheduleBodyScrollRef.current
    if (headerEl && bodyEl) bodyEl.scrollLeft = headerEl.scrollLeft
  }, [dynamicMinTableWidthPx, monthDays.length])

  // 미 배정된 투어: 달력에 선택된 월의 tour_date만 (그리드 투어 조회는 ±3일 버퍼 사용, 미배정 카드는 이전 달이 섞이지 않게)
  const fetchUnassignedTours = useCallback(async () => {
    try {
      const startDate = firstDayOfMonth.format('YYYY-MM-DD')
      const endDate = lastDayOfMonth.format('YYYY-MM-DD')
      
      // 가이드 또는 어시스턴트가 배정되지 않은 투어들 (특정 상태 제외)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: unassignedToursData, error } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('tours' as any)
        .select(`
          *,
          products!inner(name)
        `)
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)
        .or('tour_guide_id.is.null,tour_guide_id.eq.,assistant_id.is.null,assistant_id.eq.')
        .not('tour_status', 'like', 'canceled%')
        .not('tour_status', 'like', 'Canceled%')
        .not('tour_status', 'eq', 'Deleted')
        .not('tour_status', 'eq', 'Requested for Delete')
        .order('tour_date', { ascending: true })

      if (error) {
        console.error('Error fetching unassigned tours:', error)
        return
      }

      setUnassignedTours(unassignedToursData || [])
    } catch (error) {
      console.error('Error fetching unassigned tours:', error)
    }
  }, [firstDayOfMonth, lastDayOfMonth])

  const loadFullTicketBookingAndOpen = useCallback(
    async (id: string) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).from('ticket_bookings').select('*').eq('id', id).maybeSingle()
        if (error) throw error
        if (!data) {
          alert(locale === 'ko' ? '부킹을 불러오지 못했습니다.' : 'Failed to load booking.')
          return
        }
        if ((data as { deletion_requested_at?: string | null }).deletion_requested_at) {
          alert(
            locale === 'ko'
              ? '삭제 요청된 부킹은 목록에 표시되지 않습니다. SUPER 관리자가 입장권 부킹 메뉴에서 처리합니다.'
              : 'This booking is pending deletion and is hidden from the schedule. A super admin can process it from ticket bookings.'
          )
          return
        }
        setScheduleTicketBookingEdit(data)
        setScheduleTicketBookingFormOpen(true)
      } catch (e) {
        console.error(e)
        alert(locale === 'ko' ? '부킹을 불러오지 못했습니다.' : 'Failed to load booking.')
      }
    },
    [locale]
  )

  const onScheduleTicketBookingRowClick = useCallback(
    (bookingIds: string[]) => {
      const unique = [...new Set(bookingIds)].filter(Boolean)
      if (unique.length === 0) return
      if (unique.length === 1) {
        void loadFullTicketBookingAndOpen(unique[0])
        return
      }
      setPickScheduleTicketBookingIds(unique)
    },
    [loadFullTicketBookingAndOpen]
  )

  const closeScheduleTicketBookingForm = useCallback(() => {
    setScheduleTicketBookingFormOpen(false)
    setScheduleTicketBookingEdit(null)
  }, [])

  // 데이터 가져오기
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // 상품 데이터 가져오기 (Mania Tour, Mania Service만)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: productsData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('products' as any)
        .select('*')
        .in('sub_category', ['Mania Tour', 'Mania Service'])
        .order('name')

      // 팀 멤버 데이터 가져오기
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: teamData } = await (supabase as any)
        .from('team')
        .select('*')
        .eq('is_active', true)
        .order('name_ko')

      // 비활성 팀원은 선택 모달에서 재활성화할 때만 사용합니다.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inactiveTeamData } = await (supabase as any)
        .from('team')
        .select('*')
        .eq('is_active', false)
        .order('name_ko')

      // 투어·예약: 멀티데이 이전 달 꼬리(최대 3일) + 그리드 끝(익월 1일 컬럼)까지
      const startDate = firstDayOfMonth.subtract(3, 'day').format('YYYY-MM-DD')
      const endDate = lastDayOfMonth.add(1, 'day').format('YYYY-MM-DD')
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: toursData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('tours' as any)
        .select('*, products(name)')
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)

      // 해당 월 투어에서 사용하는 차량 ID로 차량 정보 조회 (라벨/범례용)
      const rawVehicleIds = (toursData || []).map((t: { tour_car_id?: string | null }) => t.tour_car_id).filter((id: string | null | undefined): id is string => id != null && String(id).trim().length > 0)
      const vehicleIds: string[] = Array.from(new Set(rawVehicleIds))
      let vehicleMap = new Map<string, string | null>()
      if (vehicleIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: vehiclesData } = await (supabase as any)
          .from('vehicles')
          .select('id, vehicle_number, nick')
          .in('id', vehicleIds)
        vehicleMap = new Map((vehiclesData || []).map((v: { id: string; vehicle_number: string | null; nick?: string | null }) => [v.id, (v.nick && v.nick.trim()) || v.vehicle_number || null]))
      }
      const toursWithVehicles = (toursData || []).map((t: Tour) => ({
        ...t,
        vehicle_number: t.tour_car_id ? (vehicleMap.get(String(t.tour_car_id).trim()) ?? null) : null
      }))

      // 해당 월 사용 가능 차량 목록 (취소·비활성 제외, 렌터카는 렌트 시작~종료가 해당 월과 겹치는 예약만)
      const monthStart = firstDayOfMonth.format('YYYY-MM-DD')
      const monthEnd = lastDayOfMonth.format('YYYY-MM-DD')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allVehiclesData } = await (supabase as any)
        .from('vehicles')
        .select('id, vehicle_number, nick, vehicle_category, status, rental_start_date, rental_end_date')
      const isCancelled = (s: string | null | undefined) => {
        if (!s) return false
        const lower = String(s).toLowerCase().trim()
        return lower === 'cancelled' || lower === '취소됨' || lower.includes('취소') || lower.includes('cancel')
      }
      const isInactiveStatus = (s: string | null | undefined) => {
        if (!s) return false
        const lower = String(s).toLowerCase().trim()
        return lower === 'inactive' || lower.includes('inactive') || lower.includes('비활성')
      }
      const availableInMonth = (allVehiclesData || []).filter((v: { vehicle_category?: string | null; status?: string | null; rental_start_date?: string | null; rental_end_date?: string | null }) => {
        if (isCancelled(v.status)) return false
        if (isInactiveStatus(v.status)) return false
        const isRental = (v.vehicle_category || '').toString().toLowerCase() === 'rental'
        if (!isRental) return true
        const start = (v.rental_start_date || '').toString().trim().substring(0, 10)
        const end = (v.rental_end_date || '').toString().trim().substring(0, 10)
        if (!start || !end) return false
        return start <= monthEnd && end >= monthStart
      })
      const sorted = availableInMonth.sort((a: { vehicle_category?: string | null; vehicle_number?: string | null; nick?: string | null; id: string }, b: typeof a) => {
        const aRental = (a.vehicle_category || '').toString().toLowerCase() === 'rental' ? 1 : 0
        const bRental = (b.vehicle_category || '').toString().toLowerCase() === 'rental' ? 1 : 0
        if (aRental !== bRental) return aRental - bRental
        const aLabel = (a.nick && a.nick.trim()) || a.vehicle_number || a.id
        const bLabel = (b.nick && b.nick.trim()) || b.vehicle_number || b.id
        return String(aLabel).localeCompare(String(bLabel))
      })
      setScheduleVehicles(sorted.map((v: { id: string; vehicle_number?: string | null; nick?: string | null; vehicle_category?: string | null; rental_start_date?: string | null; rental_end_date?: string | null }) => ({
        id: v.id,
        label: ((v.nick && v.nick.trim()) || v.vehicle_number || v.id).toString().trim() || v.id,
        vehicle_category: v.vehicle_category ?? null,
        rental_start_date: v.rental_start_date ?? null,
        rental_end_date: v.rental_end_date ?? null
      })))

      // 예약 데이터 가져오기 (현재 월)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: reservationsData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('reservations' as any)
        .select('*')
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)

      // 상품별 스케줄 툴팁: 카드와 동일 — 1) reservation_choices 2) 없으면 reservation.choices JSON 폴백 → 예약별 X/L/U 뽑은 뒤 합산
      const isUuid = (s: string | null | undefined) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((s || '').trim())
      // ReservationCard.simplifyChoiceLabel와 동일: option_name_ko || option_name || option_key → X / L / U / 기타
      const choiceLabelToKey = (nameKo: string | null | undefined, nameEn: string | null | undefined, optionKey: string | null | undefined): string => {
        const label = (nameKo || nameEn || (optionKey && !isUuid(optionKey) ? optionKey : '') || '').toString().trim()
        const labelLower = label.toLowerCase()
        const labelKo = label
        if (labelLower.includes('antelope x canyon') || /엑스\s*앤텔롭|엑스\s*앤틸롭|엑스\s*엔텔롭/.test(labelKo)) return 'X'
        if (labelLower.includes('lower antelope canyon') || /로어\s*앤텔롭|로어\s*앤틸롭|로어\s*엔텔롭/.test(labelKo)) return 'L'
        if (labelLower.includes('upper antelope canyon') || /어퍼\s*앤텔롭|어퍼\s*앤틸롭|어퍼\s*엔텔롭/.test(labelKo)) return 'U'
        if (labelLower.includes('antelope x') || labelLower.includes(' x ')) return 'X'
        if (labelLower.includes('lower')) return 'L'
        if (labelLower.includes('upper')) return 'U'
        return '_other'
      }
      const safeJsonParse = (val: string | object | null | undefined, fallback: unknown = null) => {
        if (val == null) return fallback
        if (typeof val === 'object') return val
        try { return JSON.parse(String(val)) } catch { return fallback }
      }
      const reservationIds = (reservationsData || []).map((r: { id?: string }) => r.id).filter(Boolean)
      let choicesFlat: Array<{ reservation_id: string; choiceKey: string; quantity: number }> = []
      if (reservationIds.length > 0) {
        const BATCH = 100
        for (let i = 0; i < reservationIds.length; i += BATCH) {
          const batchIds = reservationIds.slice(i, i + BATCH)
          const { data: rcData } = await supabase
            .from('reservation_choices')
            .select('reservation_id, quantity, choice_options!inner(option_key, option_name_ko, option_name)')
            .in('reservation_id', batchIds)
          if (rcData?.length) {
            choicesFlat = choicesFlat.concat(
              (rcData as Array<{
                reservation_id: string | null
                quantity?: number | null
                choice_options?: { option_key?: string | null; option_name_ko?: string | null; option_name?: string | null } | null
              }>)
                .filter((row) => Boolean(row.reservation_id))
                .map((row) => {
                  const opt = row.choice_options
                  const choiceKey = choiceLabelToKey(opt?.option_name_ko ?? null, opt?.option_name ?? null, opt?.option_key ?? null)
                  return { reservation_id: row.reservation_id as string, choiceKey, quantity: Number(row.quantity) || 1 }
                })
            )
          }
        }
      }
      const hasTableChoices = new Set(choicesFlat.map(c => c.reservation_id))
      ;(reservationsData || []).forEach((r: { id: string; choices?: string | null }) => {
        if (hasTableChoices.has(r.id) || !r.choices) return
        try {
          const choicesObj = safeJsonParse(r.choices) as Record<string, unknown> | null
          if (!choicesObj || !Array.isArray(choicesObj.required)) return
          ;(choicesObj.required as Array<Record<string, unknown>>).forEach((item) => {
            const qty = Number((item as { quantity?: number }).quantity) || 1
            if (item.option_id && item.choice_id) {
              const key = choiceLabelToKey(
                item.option_name_ko as string | null,
                item.option_name as string | null,
                item.option_key as string | null
              )
              choicesFlat.push({ reservation_id: r.id, choiceKey: key, quantity: qty })
            } else if (Array.isArray(item.options)) {
              (item.options as Array<Record<string, unknown>>).forEach((opt) => {
                if (opt.selected || opt.is_default) {
                  const key = choiceLabelToKey(opt.name_ko as string | null, opt.name as string | null, null)
                  choicesFlat.push({ reservation_id: r.id, choiceKey: key, quantity: qty })
                }
              })
            }
          })
        } catch (_) { /* ignore */ }
      })
      setReservationChoices(choicesFlat)

      // 고객 데이터 가져오기 (해당 예약의 고객만)
      let customersData: Pick<Customer, 'id' | 'language' | 'name'>[] | null = []
      const customerIds: string[] = Array.from(new Set((reservationsData || []).map((r: { customer_id?: string | null }) => r.customer_id).filter((id: string | null | undefined): id is string => Boolean(id))))
      if (customerIds.length > 0) {
        const { data: customersFetched } = await supabase
          .from('customers')
          .select('id, language, name')
          .in('id', customerIds)
        customersData = customersFetched as Pick<Customer, 'id' | 'language' | 'name'>[] | null
      }

      // 부킹(입장권) 데이터 가져오기: hover summary용 confirmed EA 합계 계산
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ticketBookingsData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('ticket_bookings' as any)
        .select(
          'id, tour_id, status, ea, company, time, check_in_date, booking_status, vendor_status, change_status, payment_status, refund_status, operation_status, deletion_requested_at'
        )
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate)

      // 투어 호텔 부킹 데이터 가져오기
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tourHotelBookingsData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('tour_hotel_bookings' as any)
        .select('id, tour_id, status, rooms, hotel, check_in_date')
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate)

      // Off 스케줄 (그리드에 보이는 전월 말일·익월 1일 포함)
      const gridNoteStart = firstDayOfMonth.subtract(1, 'day').format('YYYY-MM-DD')
      const gridNoteEnd = lastDayOfMonth.add(1, 'day').format('YYYY-MM-DD')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: offSchedulesData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('off_schedules' as any)
        .select('team_email, off_date, reason, status')
        .in('status', ['pending', 'approved'])
        .gte('off_date', gridNoteStart)
        .lte('off_date', gridNoteEnd)

      // 날짜별 노트 (전월 말·익월 1일 컬럼 포함)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: dateNotesData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('date_notes' as any)
        .select('note_date, note, created_by')
        .gte('note_date', gridNoteStart)
        .lte('note_date', gridNoteEnd)

      // 날짜별 노트를 객체로 변환
      const notesMap: { [date: string]: { note: string; created_by?: string } } = {}
      if (dateNotesData) {
        dateNotesData.forEach((item: { note_date: string; note: string | null; created_by?: string | null }) => {
          notesMap[item.note_date] = {
            note: item.note || '',
            ...(item.created_by ? { created_by: item.created_by } : {})
          }
        })
      }

      console.log('=== ScheduleView 데이터 로딩 결과 ===')
      console.log('Loaded products:', productsData?.length || 0, productsData)
      console.log('Loaded team members:', teamData?.length || 0, teamData)
      console.log('Loaded inactive team members:', inactiveTeamData?.length || 0, inactiveTeamData)
      console.log('Loaded tours:', toursData?.length || 0, toursData)
      console.log('Loaded reservations:', reservationsData?.length || 0, reservationsData)
      console.log('=====================================')

      setProducts(productsData || [])
      setTeamMembers(teamData || [])
      setInactiveTeamMembers(inactiveTeamData || [])
      setTours(toursWithVehicles)
      setReservations(reservationsData || [])
      setCustomers((customersData || []) as Customer[])
      setTicketBookings(
        filterTicketBookingsExcludedFromMainUi((ticketBookingsData || []) as ScheduleTicketBookingRow[])
      )
      setTourHotelBookings(tourHotelBookingsData || [])
      setOffSchedules(offSchedulesData || [])
      setDateNotes(notesMap)

      // 저장된 사용자 설정 불러오기 (오류가 발생해도 계속 진행)
      try {
        await loadUserSettings()
      } catch (settingsError) {
        console.warn('Failed to load user settings, continuing with default values:', settingsError)
      }

      // 미 배정된 투어 가져오기
      await fetchUnassignedTours()

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [firstDayOfMonth, lastDayOfMonth, loadUserSettings, fetchUnassignedTours])

  const handleScheduleTicketBookingSaved = useCallback(async () => {
    closeScheduleTicketBookingForm()
    await fetchData()
  }, [closeScheduleTicketBookingForm, fetchData])

  const handleRequestScheduleTicketBookingDelete = useCallback(
    async (id: string) => {
      const email = user?.email || ''
      try {
        const { error } = await supabase
          .from('ticket_bookings')
          .update({
            deletion_requested_at: new Date().toISOString(),
            deletion_requested_by: email || null,
          })
          .eq('id', id)
        if (error) throw error
        alert(
          locale === 'ko'
            ? '삭제 요청되었습니다. SUPER 관리자가 확인 후 영구 삭제합니다.'
            : 'Deletion requested. A super admin will permanently delete after review.'
        )
        await handleScheduleTicketBookingSaved()
      } catch (e) {
        console.error(e)
        alert(locale === 'ko' ? '삭제 요청 처리 중 오류가 발생했습니다.' : 'Failed to request deletion.')
      }
    },
    [user?.email, locale, handleScheduleTicketBookingSaved]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const convertScheduleReservationToFormType = useCallback((reservation: Record<string, unknown>) => {
    return {
      id: reservation.id,
      customerId: reservation.customer_id || '',
      productId: reservation.product_id || '',
      tourDate: reservation.tour_date || '',
      tourTime: reservation.tour_time || '',
      eventNote: reservation.event_note || '',
      pickUpHotel: reservation.pickup_hotel || '',
      pickUpTime: reservation.pickup_time || '',
      adults: reservation.adults || 0,
      child: reservation.child || 0,
      infant: reservation.infant || 0,
      totalPeople: reservation.total_people || 0,
      channelId: reservation.channel_id || '',
      channelRN: reservation.channel_rn || '',
      addedBy: reservation.added_by || '',
      addedTime: reservation.created_at || '',
      tourId: reservation.tour_id || '',
      status: (reservation.status as 'pending' | 'confirmed' | 'completed' | 'cancelled') || 'pending',
      selectedOptions:
        typeof reservation.selected_options === 'string'
          ? (() => {
              try {
                return JSON.parse(reservation.selected_options as string)
              } catch {
                return {}
              }
            })()
          : ((reservation.selected_options as Record<string, string[]>) || {}),
      selectedOptionPrices:
        typeof reservation.selected_option_prices === 'string'
          ? (() => {
              try {
                return JSON.parse(reservation.selected_option_prices as string)
              } catch {
                return {}
              }
            })()
          : ((reservation.selected_option_prices as Record<string, number>) || {}),
      isPrivateTour: reservation.is_private_tour || false
    }
  }, [])

  const handleCloseScheduleReservationEdit = useCallback(() => {
    setScheduleEditingReservation(null)
    setScheduleReservationFormData(null)
    setReservationIdForScheduleEdit(null)
  }, [])

  useEffect(() => {
    if (!reservationIdForScheduleEdit) return
    let cancelled = false
    setLoadingScheduleReservationEdit(true)
    ;(async () => {
      try {
        const { data: reservation, error: resError } = await supabase
          .from('reservations')
          .select('*')
          .eq('id', reservationIdForScheduleEdit)
          .maybeSingle()
        if (resError || !reservation || cancelled) {
          setLoadingScheduleReservationEdit(false)
          setReservationIdForScheduleEdit(null)
          return
        }
        const [customersRes, productsRes, channelsRes, productOptionsRes, optionsRes, pickupHotelsRes, couponsRes] =
          await Promise.all([
            supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(2000),
            supabase.from('products').select('*').order('name', { ascending: true }).limit(2000),
            supabase
              .from('channels')
              .select(
                'id, name, type, favicon_url, pricing_type, commission_base_price_only, category, has_not_included_price, not_included_type, not_included_price, commission_percent, commission'
              )
              .order('name', { ascending: true }),
            supabase.from('product_options').select('*').order('name', { ascending: true }),
            supabase.from('options').select('*').order('name', { ascending: true }),
            supabase
              .from('pickup_hotels')
              .select('*')
              .eq('use_for_pickup', true)
              .or('is_active.is.null,is_active.eq.true')
              .order('hotel', { ascending: true }),
            supabase.from('coupons').select('*').eq('status', 'active').order('coupon_code', { ascending: true })
          ])
        if (cancelled) return
        setScheduleReservationFormData({
          customers: customersRes.data || [],
          products: productsRes.data || [],
          channels: channelsRes.data || [],
          productOptions: productOptionsRes.data || [],
          options: optionsRes.data || [],
          pickupHotels: pickupHotelsRes.data || [],
          coupons: couponsRes.data || []
        })
        setScheduleEditingReservation(convertScheduleReservationToFormType(reservation as Record<string, unknown>))
      } catch (e) {
        console.error('스케줄에서 예약 폼 데이터 로드 오류:', e)
      } finally {
        if (!cancelled) setLoadingScheduleReservationEdit(false)
        setReservationIdForScheduleEdit(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reservationIdForScheduleEdit, convertScheduleReservationToFormType])

  const openProductCellReservationsModal = useCallback(
    (productId: string, dateString: string, productName: string) => {
      setProductCellReservationsModal({ productId, dateString, productName })
    },
    []
  )

  /** 상품별 인원 모달에서 상태만 빠르게 변경 */
  const productCellQuickStatusValues = ['pending', 'recruiting', 'confirmed', 'completed', 'cancelled', 'deleted'] as const
  const [productCellStatusSavingId, setProductCellStatusSavingId] = useState<string | null>(null)
  const [productCellCreateTourLoading, setProductCellCreateTourLoading] = useState(false)
  const [cancellationReasonModalOpen, setCancellationReasonModalOpen] = useState(false)
  const [cancellationReasonSaving, setCancellationReasonSaving] = useState(false)
  const [cancellationReasonValue, setCancellationReasonValue] = useState('')
  const cancellationReasonResolveRef = useRef<((value: string | null) => void) | null>(null)

  const requestCancellationReason = useCallback(() => {
    setCancellationReasonValue('')
    setCancellationReasonModalOpen(true)
    return new Promise<string | null>((resolve) => {
      cancellationReasonResolveRef.current = resolve
    })
  }, [])

  const closeCancellationReasonModal = useCallback(() => {
    setCancellationReasonModalOpen(false)
    cancellationReasonResolveRef.current?.(null)
    cancellationReasonResolveRef.current = null
  }, [])

  const submitCancellationReasonModal = useCallback(async (reason: string) => {
    const trimmed = reason.trim()
    if (!trimmed) return
    setCancellationReasonSaving(true)
    try {
      setCancellationReasonValue(trimmed)
      setCancellationReasonModalOpen(false)
      cancellationReasonResolveRef.current?.(trimmed)
      cancellationReasonResolveRef.current = null
    } finally {
      setCancellationReasonSaving(false)
    }
  }, [])

  const handleProductCellReservationStatusChange = useCallback(
    async (reservationId: string, newStatus: string) => {
      const next = newStatus.trim().toLowerCase()
      if (!next) return
      const currentRow = (reservations as Reservation[]).find((r) => String(r.id) === reservationId)
      const prevStatus = currentRow?.status
      if (String(prevStatus ?? '').toLowerCase() === next) return

      setProductCellStatusSavingId(reservationId)
      setReservations((prev) =>
        (prev as Reservation[]).map((r) =>
          String(r.id) === reservationId ? { ...r, status: next } : r
        )
      )
      try {
        let cancellationReasonForSave: string | null = null
        if (next === 'cancelled' || next === 'canceled') {
          const reason = await requestCancellationReason()
          if (!reason) {
            setReservations((prev) =>
              (prev as Reservation[]).map((r) =>
                String(r.id) === reservationId ? { ...r, status: prevStatus } : r
              )
            )
            return
          }
          cancellationReasonForSave = reason
        }
        const { error } = await supabase.from('reservations').update({ status: next }).eq('id', reservationId)
        if (error) {
          setReservations((prev) =>
            (prev as Reservation[]).map((r) =>
              String(r.id) === reservationId ? { ...r, status: prevStatus } : r
            )
          )
          showMessage(locale === 'ko' ? '오류' : 'Error', error.message, 'error')
          return
        }
        if (cancellationReasonForSave) {
          await upsertReservationCancellationReason(reservationId, cancellationReasonForSave, user?.email ?? null)
        }
      } catch (e) {
        setReservations((prev) =>
          (prev as Reservation[]).map((r) =>
            String(r.id) === reservationId ? { ...r, status: prevStatus } : r
          )
        )
        showMessage(locale === 'ko' ? '오류' : 'Error', String(e), 'error')
      } finally {
        setProductCellStatusSavingId(null)
      }
    },
    [reservations, locale, showMessage, requestCancellationReason, user?.email]
  )

  const productCellReservationList = useMemo(() => {
    if (!productCellReservationsModal) return [] as Reservation[]
    const { productId, dateString } = productCellReservationsModal
    return (reservations as Reservation[])
      .filter((r) => {
        if (r.product_id !== productId) return false
        const d = String(r.tour_date || '').slice(0, 10)
        if (d !== dateString) return false
        const st = String(r.status || '').toLowerCase()
        return st !== 'deleted'
      })
      .slice()
      .sort((a, b) => {
        const na = getCustomerName(String(a.customer_id || ''), customers as Customer[]).toLowerCase()
        const nb = getCustomerName(String(b.customer_id || ''), customers as Customer[]).toLowerCase()
        if (na !== nb) return na.localeCompare(nb, locale)
        const ca = String(a.created_at || '')
        const cb = String(b.created_at || '')
        return cb.localeCompare(ca)
      })
  }, [productCellReservationsModal, reservations, customers, locale])

  const checkScheduleTourExistsForProductDate = useCallback(async (productId: string, tourDate: string) => {
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
      return Boolean(data && data.length > 0)
    } catch (e) {
      console.error('Error checking tour existence:', e)
      return false
    }
  }, [])

  const handleProductCellModalCreateTour = useCallback(async () => {
    if (!productCellReservationsModal) return
    const { productId, dateString } = productCellReservationsModal
    const eligible = productCellReservationList.filter((r) => {
      const st = String(r.status ?? '').toLowerCase()
      return st === 'confirmed' || st === 'recruiting'
    })
    if (eligible.length === 0) {
      showMessage(
        locale === 'ko' ? '안내' : 'Notice',
        locale === 'ko'
          ? '확정 또는 모집중인 예약이 있어야 투어를 생성할 수 있습니다.'
          : 'You need at least one confirmed or recruiting reservation.',
        'error'
      )
      return
    }

    setProductCellCreateTourLoading(true)
    try {
      const exists = await checkScheduleTourExistsForProductDate(productId, dateString)
      if (exists) {
        showMessage(
          locale === 'ko' ? '안내' : 'Notice',
          locale === 'ko'
            ? '해당 날짜에 이미 투어가 있습니다.'
            : 'A tour already exists for this product and date.',
          'error'
        )
        await fetchData()
        return
      }

      for (const r of eligible) {
        const isPriv = r.is_private_tour === true || String(r.is_private_tour ?? '').toUpperCase() === 'TRUE'
        const result = await autoCreateOrUpdateTour(productId, dateString, String(r.id), isPriv)
        if (!result.success) {
          showMessage(
            locale === 'ko' ? '오류' : 'Error',
            result.message || (locale === 'ko' ? '투어 생성에 실패했습니다.' : 'Failed to create tour.'),
            'error'
          )
          await fetchData()
          return
        }
        if (result.message?.includes('자동 투어 생성 대상이 아닙니다')) {
          showMessage(locale === 'ko' ? '안내' : 'Notice', result.message, 'error')
          return
        }
      }

      try {
        await createTourPhotosBucket()
      } catch {
        /* 버킷 생성 실패해도 투어 생성은 유지 */
      }

      showMessage(
        locale === 'ko' ? '완료' : 'Done',
        locale === 'ko' ? '투어가 생성되었습니다.' : 'Tour created.',
        'success'
      )
      setProductCellReservationsModal(null)
      await fetchData()
    } catch (e) {
      console.error('Schedule product cell create tour:', e)
      showMessage(locale === 'ko' ? '오류' : 'Error', String(e), 'error')
    } finally {
      setProductCellCreateTourLoading(false)
    }
  }, [
    productCellReservationsModal,
    productCellReservationList,
    locale,
    showMessage,
    fetchData,
    checkScheduleTourExistsForProductDate,
  ])

  /** 정원 초과 시 같은 날짜에 빈 투어(2팀 등) 추가 — 예약 없이 투어 행만 생성 */
  const handleCreateEmptyTourFromOverflow = useCallback(
    async (productId: string, dateString: string) => {
      const key = `${productId}__${dateString}`
      setCapacityOverflowCreatingKey(key)
      try {
        const tourId = generateTourId()
        const { error } = await (supabase as any).from('tours').insert({
          id: tourId,
          product_id: productId,
          tour_date: dateString,
          reservation_ids: [],
          tour_status: 'scheduled',
          is_private_tour: false,
        })
        if (error) throw error
        try {
          await createTourPhotosBucket()
        } catch {
          /* 버킷 실패해도 투어는 유지 */
        }
        showMessage(
          locale === 'ko' ? '완료' : 'Done',
          locale === 'ko' ? '투어가 추가되었습니다.' : 'Tour added.',
          'success'
        )
        await fetchData()
      } catch (e) {
        console.error('handleCreateEmptyTourFromOverflow', e)
        showMessage(locale === 'ko' ? '오류' : 'Error', String(e), 'error')
      } finally {
        setCapacityOverflowCreatingKey(null)
      }
    },
    [fetchData, locale, showMessage]
  )

  const openVehicleEditFromSchedule = useCallback(
    async (vehicleId: string) => {
      if (!canEditVehicleFromSchedule) return
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('vehicles')
          .select(SCHEDULE_VEHICLE_EDIT_SELECT)
          .eq('id', vehicleId)
          .single()
        if (error) throw error
        if (!data) throw new Error('차량을 찾을 수 없습니다.')
        const row = data as {
          id: string
          vehicle_image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        const withPhotos = row.vehicle_image_url
          ? {
              ...row,
              photos: [
                {
                  id: 'legacy',
                  vehicle_id: row.id,
                  photo_url: row.vehicle_image_url,
                  is_primary: true,
                  display_order: 0,
                  created_at: row.created_at,
                  updated_at: row.updated_at,
                },
              ],
              typePhotos: [],
            }
          : { ...row, photos: [], typePhotos: [] }
        setVehicleEditModalVehicle(withPhotos)
        setVehicleEditModalPrefill(null)
        setShowVehicleEditModal(true)
      } catch (e) {
        console.error('스케줄에서 차량 조회 오류:', e)
        alert(e instanceof Error ? e.message : '차량 정보를 불러오지 못했습니다.')
      }
    },
    [canEditVehicleFromSchedule]
  )

  const openRentalVehicleAddFromSchedule = useCallback(() => {
    if (!isSuperAdmin) return
    setVehicleEditModalVehicle(null)
    setVehicleEditModalPrefill(getScheduleRentalVehiclePrefill())
    setShowVehicleEditModal(true)
  }, [isSuperAdmin])

  const handleVehicleEditModalSave = useCallback(
    async (vehicleData: Record<string, unknown>) => {
      const id = vehicleEditModalVehicle?.id as string | undefined
      const allowedFields = [
        'vehicle_number',
        'vin',
        'vehicle_type',
        'capacity',
        'year',
        'mileage_at_purchase',
        'purchase_amount',
        'purchase_date',
        'memo',
        'engine_oil_change_cycle',
        'current_mileage',
        'recent_engine_oil_change_mileage',
        'status',
        'front_tire_size',
        'rear_tire_size',
        'windshield_wiper_size',
        'headlight_model',
        'headlight_model_name',
        'is_installment',
        'installment_amount',
        'interest_rate',
        'monthly_payment',
        'additional_payment',
        'payment_due_date',
        'installment_start_date',
        'installment_end_date',
        'vehicle_image_url',
        'vehicle_category',
        'rental_company',
        'daily_rate',
        'rental_booking_price',
        'rental_start_date',
        'rental_end_date',
        'rental_pickup_location',
        'rental_return_location',
        'rental_total_cost',
        'rental_notes',
        'rental_agreement_number',
        'nick',
      ]
      const cleanedData = { ...vehicleData }
      const dateFields = [
        'purchase_date',
        'insurance_start_date',
        'insurance_end_date',
        'rental_start_date',
        'rental_end_date',
      ] as const
      dateFields.forEach((field) => {
        if (cleanedData[field] === '' || cleanedData[field] === null) {
          cleanedData[field] = null
        }
      })
      const filteredData = Object.keys(cleanedData)
        .filter((key) => allowedFields.includes(key))
        .reduce(
          (obj, key) => {
            const value = cleanedData[key]
            obj[key] = value === '' ? null : value
            return obj
          },
          {} as Record<string, unknown>
        )
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vehiclesTable = (supabase as any).from('vehicles')
        const { error } = id
          ? await vehiclesTable.update(filteredData).eq('id', id)
          : await vehiclesTable.insert([filteredData])
        if (error) throw error
        await fetchData()
        setShowVehicleEditModal(false)
        setVehicleEditModalVehicle(null)
        setVehicleEditModalPrefill(null)
        showMessage('저장 완료', '차량 정보가 저장되었습니다.', 'success')
      } catch (error) {
        console.error('스케줄에서 차량 저장 오류:', error)
        alert(
          `차량 저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        )
      }
    },
    [vehicleEditModalVehicle, fetchData, showMessage]
  )

  // 로컬 임시 저장
  const LOCAL_DRAFT_KEY = 'schedule_pending_draft'

  const saveDraftToLocal = () => {
    const draft = {
      pendingChanges,
      pendingOffScheduleChanges,
      savedAt: new Date().toISOString(),
      month: `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`
    }
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft))
    showMessage('임시 저장 완료', `${pendingCount}건의 변경사항이 로컬에 임시 저장되었습니다.`, 'success')
  }

  const loadDraftFromLocal = () => {
    try {
      const saved = localStorage.getItem(LOCAL_DRAFT_KEY)
      if (!saved) return false
      const draft = JSON.parse(saved)
      if (draft.pendingChanges) {
        setPendingChanges(draft.pendingChanges)
        // tours 상태에 변경사항을 즉시 반영하여 화면에 미리보기
        setTours(prev => prev.map(t => {
          const change = draft.pendingChanges[t.id]
          return change ? { ...t, ...change } : t
        }))
      }
      if (draft.pendingOffScheduleChanges) setPendingOffScheduleChanges(draft.pendingOffScheduleChanges)
      return draft
    } catch {
      return false
    }
  }

  const clearDraftFromLocal = () => {
    localStorage.removeItem(LOCAL_DRAFT_KEY)
  }

  // 초기 로드 시 로컬 임시 저장 데이터 확인
  const [hasDraft, setHasDraft] = useState(false)
  const [draftInfo, setDraftInfo] = useState<{ savedAt: string; month: string; count: number } | null>(null)

  /** 상단 저장 버튼과 동일: 투어 pending + 오프스케줄 pending 일괄 반영 */
  const executeBatchSave = useCallback(async (): Promise<boolean> => {
    try {
      const tourEntries = Object.entries(pendingChanges)
      for (const [tourId, updateData] of tourEntries) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from('tours' as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(updateData as any)
          .eq('id', tourId)
        if (error) {
          console.error('Batch save error:', error)
          showMessage('저장 실패', '일부 변경사항 저장에 실패했습니다.', 'error')
          return false
        }
      }

      const offScheduleEntries = Object.entries(pendingOffScheduleChanges)
      for (const [, change] of offScheduleEntries) {
        if (change.action === 'approve') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('off_schedules' as any)
            .update({ status: 'approved', approved_by: user?.email ?? null })
            .eq('team_email', change.team_email)
            .eq('off_date', change.off_date)
          if (error) {
            console.error('Off schedule approve error:', error)
            showMessage('저장 실패', '오프 스케줄 승인에 실패했습니다.', 'error')
            return false
          }
        } else if (change.action === 'reject') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('off_schedules' as any)
            .update({ status: 'rejected', approved_by: user?.email ?? null })
            .eq('team_email', change.team_email)
            .eq('off_date', change.off_date)
          if (error) {
            console.error('Off schedule reject error:', error)
            showMessage('저장 실패', '오프 스케줄 거절에 실패했습니다.', 'error')
            return false
          }
        } else if (change.action === 'delete') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('off_schedules' as any)
            .delete()
            .eq('team_email', change.team_email)
            .eq('off_date', change.off_date)
          if (error) {
            console.error('Off schedule delete error:', error)
            showMessage('저장 실패', '오프 스케줄 삭제에 실패했습니다.', 'error')
            return false
          }
        }
      }

      setPendingChanges({})
      setPendingOffScheduleChanges({})
      clearDraftFromLocal()
      setHasDraft(false)
      setDraftInfo(null)
      await fetchData()
      await fetchUnassignedTours()
      showMessage('저장 완료', '변경사항이 저장되었습니다.', 'success')
      return true
    } catch (err) {
      console.error('Batch save unexpected error:', err)
      showMessage('오류', '변경사항 저장 중 오류가 발생했습니다.', 'error')
      return false
    }
  }, [pendingChanges, pendingOffScheduleChanges, fetchData, fetchUnassignedTours, showMessage, user?.email])

  /** 상단 취소와 동일: 서버 기준으로 되돌림(미저장 변경 폐기) */
  const discardPendingScheduleChanges = useCallback(async () => {
    setPendingChanges({})
    setPendingOffScheduleChanges({})
    await fetchData()
    await fetchUnassignedTours()
  }, [fetchData, fetchUnassignedTours])

  const requestSaveAfterDragAssignment = useCallback(() => {
    if (scheduleExplorationMode) return
    setTimeout(() => setDragAssignSaveModalOpen(true), 0)
  }, [scheduleExplorationMode])

  const confirmDragAssignSave = useCallback(async () => {
    setDragAssignSaveLoading(true)
    try {
      const ok = await executeBatchSave()
      if (ok) setDragAssignSaveModalOpen(false)
    } finally {
      setDragAssignSaveLoading(false)
    }
  }, [executeBatchSave])

  const runPendingScheduleLeave = useCallback(() => {
    const go = pendingScheduleLeaveRef.current
    pendingScheduleLeaveRef.current = null
    setScheduleLeavePromptOpen(false)
    go?.()
  }, [])

  const handleScheduleLeaveSaveAndGo = useCallback(async () => {
    setScheduleLeaveSaving(true)
    try {
      const ok = await executeBatchSave()
      if (ok) runPendingScheduleLeave()
    } finally {
      setScheduleLeaveSaving(false)
    }
  }, [executeBatchSave, runPendingScheduleLeave])

  const handleScheduleLeaveDiscardAndGo = useCallback(async () => {
    setScheduleLeaveSaving(true)
    try {
      await discardPendingScheduleChanges()
      runPendingScheduleLeave()
    } finally {
      setScheduleLeaveSaving(false)
    }
  }, [discardPendingScheduleChanges, runPendingScheduleLeave])

  /** 스케줄링 모드 + 미저장 시 사이드바 등 내부 링크 클릭을 가로채 커스텀 확인 */
  useEffect(() => {
    if (!scheduleExplorationMode || pendingCount === 0) return

    const onDocClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const el = (e.target as HTMLElement | null)?.closest?.('a[href]')
      if (!el) return
      const a = el as HTMLAnchorElement
      if (a.target === '_blank' || a.hasAttribute('download')) return
      const role = a.getAttribute('role')
      if (role === 'button') return
      const hrefAttr = a.getAttribute('href')
      if (!hrefAttr || hrefAttr.startsWith('#') || hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:')) return
      let url: URL
      try {
        url = new URL(a.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      const cur = new URL(window.location.href)
      if (url.pathname === cur.pathname && url.search === cur.search && url.hash === cur.hash) return

      e.preventDefault()
      e.stopPropagation()
      const dest = `${url.pathname}${url.search}${url.hash}`
      pendingScheduleLeaveRef.current = () => {
        router.push(dest)
      }
      setScheduleLeavePromptOpen(true)
    }

    document.addEventListener('click', onDocClickCapture, true)
    return () => document.removeEventListener('click', onDocClickCapture, true)
  }, [scheduleExplorationMode, pendingCount, router])
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_DRAFT_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        const count = Object.keys(draft.pendingChanges || {}).length + Object.keys(draft.pendingOffScheduleChanges || {}).length
        if (count > 0) {
          setHasDraft(true)
          setDraftInfo({ savedAt: draft.savedAt, month: draft.month, count })
        }
      }
    } catch { /* ignore */ }
  }, [])

  // 페이지 이탈 시 저장되지 않은 변경사항이 있으면 경고
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingCount > 0) {
        e.preventDefault()
        e.returnValue = '저장되지 않은 변경사항이 있습니다. 페이지를 벗어나시겠습니까?'
        return '저장되지 않은 변경사항이 있습니다. 페이지를 벗어나시겠습니까?'
      }
      return undefined
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [pendingCount])

  // 상품별 색상 초기화 (저장된 색상 로드 후 없는 것만 기본값 할당)
  useEffect(() => {
    if (products.length > 0) {
      setProductColors(prev => {
        // 저장된 색상 로드 (공유 설정 > localStorage > 현재 상태)
        let savedColors: { [key: string]: string } = {}
        try {
          const sharedSaved = localStorage.getItem('shared_schedule_product_colors')
          const personalSaved = localStorage.getItem('schedule_product_colors')
          const savedStr = sharedSaved || personalSaved
          if (savedStr) {
            savedColors = JSON.parse(savedStr)
          }
        } catch (e) {
          console.warn('Error parsing saved product colors:', e)
        }
        
        // 저장된 색상 + 현재 상태를 병합
        const newColors = { ...prev, ...savedColors }
        let hasChanges = Object.keys(savedColors).length > 0
        
        // 색상이 아직 없는 상품만 기본 프리셋 할당
        products.forEach((product, index) => {
          if (!newColors[product.id]) {
            newColors[product.id] = defaultPresetIds[index % defaultPresetIds.length]
            hasChanges = true
          }
        })
        
        return hasChanges ? newColors : prev
      })
    }
  }, [products, defaultPresetIds])

  // 고객 언어 맵 (customer_id -> ko 여부)
  const customerIdToIsKo = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const c of customers) {
      const lang = (c?.language || '').toString().toLowerCase()
      const isKo = lang === 'ko' || lang === 'kr' || lang === '한국어' || lang === 'korean'
      map.set(String(c.id), isKo)
    }
    return map
  }, [customers])

  // 상품별 스케줄 데이터 계산 (초이스별 인원 포함)
  const productScheduleData = useMemo(() => {
    if (!tours.length || !reservations.length) return []

    // 고객 언어 맵: customer_id -> isKo
    const idToIsKo = new Map<string, boolean>()
    for (const c of customers) {
      const lang = (c?.language || '').toString().toLowerCase()
      const isKo = lang === 'ko' || lang === 'kr' || lang === '한국어' || lang === 'korean'
      idToIsKo.set(String(c.id), isKo)
    }

    const data: {
      [productId: string]: {
        product_name: string
        dailyData: {
          [date: string]: {
            totalPeople: number
            waitingPeople: number
            koWaitingPeople: number
            enWaitingPeople: number
            canceledPeople: number
            /** 확정·모집인데 해당일 같은 상품 투어 어디에도 배정되지 않은 예약 건수 */
            assignmentPendingReservationCount: number
            tours: number
            koPeople: number
            enPeople: number
            choiceCounts: Record<string, number>
            /** 투어별 초이스 집계(카드와 일치) — 해당 날짜에 투어가 1개면 이걸 툴팁에 사용 */
            toursChoiceCounts: Array<{ tourId: string; label: string; choiceCounts: Record<string, number> }>
            /** 단독 투어(투어 플래그 또는 미배정+예약 단독)에 속한 확정·모집 인원 */
            privateTourPeople: number
            /** 비단독 투어·동행모집 쪽 확정·모집 인원 */
            companionTourPeople: number
            /** 해당일 투어별 정원(배정 인원 / 최대) — 스케줄 셀 툴팁용 */
            tourCapacityBreakdown: {
              rows: Array<{
                tourId: string
                teamIndex: number
                guideName: string
                assistantName: string
                assigned: number
                max: number
                spotsLeft: number
              }>
              totalAssigned: number
              totalMax: number
              totalSpotsLeft: number
            } | null
          }
        }
        totalPeople: number
        totalTours: number
      }
    } = {}

    // 선택된 상품별로 데이터 생성
    selectedProducts.forEach(productId => {
      const product = products.find(p => p.id === productId)
      if (!product) return

      const productTours = tours.filter(tour => tour.product_id === productId)
      const dailyData: {
        [date: string]: {
          totalPeople: number
          waitingPeople: number
          koWaitingPeople: number
          enWaitingPeople: number
          canceledPeople: number
          assignmentPendingReservationCount: number
          tours: number
          koPeople: number
          enPeople: number
          choiceCounts: Record<string, number>
          toursChoiceCounts: Array<{ tourId: string; label: string; choiceCounts: Record<string, number> }>
          privateTourPeople: number
          companionTourPeople: number
          tourCapacityBreakdown: {
            rows: Array<{
              tourId: string
              teamIndex: number
              guideName: string
              assistantName: string
              assigned: number
              max: number
              spotsLeft: number
            }>
            totalAssigned: number
            totalMax: number
            totalSpotsLeft: number
          } | null
        }
      } = {}
      let totalPeople = 0
      let totalTours = 0

      const resolveMemberDisplay = (email: string | null | undefined) => {
        if (!email) return '—'
        const m =
          teamMembers.find((t) => t.email === email) ||
          inactiveTeamMembers.find((t) => t.email === email)
        if (!m) return String(email).split('@')[0] || '—'
        const nick = (m as { nick_name?: string | null }).nick_name
        return (typeof nick === 'string' && nick.trim() ? nick.trim() : '') || m.name_ko || m.email || '—'
      }

      // 각 날짜별로 데이터 계산 (우측 합계는 당월 컬럼만 포함)
      monthDays.forEach(({ dateString, isEdgePadding }) => {
        const dayTours = productTours.filter(tour => tour.tour_date === dateString)
        const dayReservations = reservations.filter(res => 
          res.product_id === productId && 
          res.tour_date === dateString &&
          (res.status?.toLowerCase() === 'confirmed' || res.status?.toLowerCase() === 'recruiting')
        )

        const dayReservationsSameDate = reservations.filter(
          res => res.product_id === productId && res.tour_date === dateString
        )
        const dayPendingReservations = dayReservationsSameDate.filter(
          res => (res.status ?? '').toString().toLowerCase() === 'pending'
        )
        const dayWaitingPeople = dayPendingReservations.reduce(
          (sum, res) => sum + (res.total_people || 0),
          0
        )
        const dayKoWaitingPeople = dayPendingReservations.reduce((sum, res) => {
          const cid = String(res.customer_id || '')
          const isKo = idToIsKo.get(cid) === true
          return sum + (isKo ? (res.total_people || 0) : 0)
        }, 0)
        const dayEnWaitingPeople = Math.max(dayWaitingPeople - dayKoWaitingPeople, 0)
        const dayCanceledPeople = dayReservationsSameDate
          .filter(res => isReservationCancelledStatus(res.status))
          .reduce((sum, res) => sum + (res.total_people || 0), 0)

        const assignedKeySet = new Set<string>()
        for (const tour of dayTours) {
          for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
            if (rawId) assignedKeySet.add(canonicalReservationIdKey(rawId))
          }
        }
        const dayAssignmentPendingReservationCount = dayReservations.filter(
          (r) => !assignedKeySet.has(canonicalReservationIdKey(String(r.id)))
        ).length

        let dayPrivateTourPeople = 0
        let dayCompanionTourPeople = 0
        for (const res of dayReservations) {
          const p = res.total_people || 0
          if (scheduleReservationPrivateBucket(res, dayTours) === 'private') dayPrivateTourPeople += p
          else dayCompanionTourPeople += p
        }
        const dayTotalPeople = dayPrivateTourPeople + dayCompanionTourPeople
        const dayKoPeople = dayReservations.reduce((sum, res) => {
          const cid = String(res.customer_id || '')
          const isKo = idToIsKo.get(cid) === true
          return sum + (isKo ? (res.total_people || 0) : 0)
        }, 0)
        const dayEnPeople = Math.max(dayTotalPeople - dayKoPeople, 0)

        const dayReservationIds = new Set(dayReservations.map(r => r.id))
        // 초이스별 집계: 투어 상세 모달과 동일 — 예약당 초이스 1개면 total_people, 여러 개면 quantity 합 (Lower/X 인원)
        const choiceRowsByResId = new Map<string, Array<{ choiceKey: string; quantity: number }>>()
        reservationChoices.forEach(rc => {
          if (!dayReservationIds.has(rc.reservation_id)) return
          const list = choiceRowsByResId.get(rc.reservation_id) || []
          list.push({ choiceKey: rc.choiceKey || '_other', quantity: rc.quantity ?? 1 })
          choiceRowsByResId.set(rc.reservation_id, list)
        })
        const choiceCountsByKey: Record<string, number> = {}
        dayReservations.forEach(res => {
          const rows = choiceRowsByResId.get(res.id) || []
          const people = res.total_people || 0
          if (rows.length === 0) return
          if (rows.length === 1) {
            const key = rows[0].choiceKey
            choiceCountsByKey[key] = (choiceCountsByKey[key] || 0) + people
          } else {
            rows.forEach(r => { choiceCountsByKey[r.choiceKey] = (choiceCountsByKey[r.choiceKey] || 0) + r.quantity })
          }
        })

        // 투어별 초이스 집계: 위와 동일 식 — 예약당 1개 행이면 total_people, 여러 개면 quantity 합
        const toursChoiceCounts: Array<{ tourId: string; label: string; choiceCounts: Record<string, number> }> = []
        dayTours.forEach((tour, idx) => {
          const assignedCanon = new Set<string>()
          for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
            if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
          }
          const assignedResList = dayReservations.filter((r) =>
            assignedCanon.has(canonicalReservationIdKey(String(r.id)))
          )
          const byKey: Record<string, number> = {}
          assignedResList.forEach(res => {
            const rows = choiceRowsByResId.get(res.id) || []
            const people = res.total_people || 0
            if (rows.length === 0) return
            if (rows.length === 1) {
              const key = rows[0].choiceKey
              byKey[key] = (byKey[key] || 0) + people
            } else {
              rows.forEach(r => { byKey[r.choiceKey] = (byKey[r.choiceKey] || 0) + r.quantity })
            }
          })
          const label = (tour.tour_time && String(tour.tour_time).trim()) ? String(tour.tour_time).trim() : `투어 ${idx + 1}`
          toursChoiceCounts.push({ tourId: tour.id, label, choiceCounts: byKey })
        })

        const sortedDayTours = [...dayTours]
          .filter((t) => !isTourCancelled(t.tour_status))
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        const tourCapacityRows = sortedDayTours.map((tour, idx) => {
          const assignedCanon = new Set<string>()
          for (const rawId of normalizeReservationIds(tour.reservation_ids)) {
            if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
          }
          const assigned = dayReservations
            .filter((r) => assignedCanon.has(canonicalReservationIdKey(String(r.id))))
            .reduce((s, r) => s + (r.total_people || 0), 0)
          const max =
            typeof tour.max_participants === 'number' && Number.isFinite(tour.max_participants)
              ? tour.max_participants
              : 12
          const spotsLeft = Math.max(0, max - assigned)
          const teamTypeStr = (tour.team_type || '').toString()
          const guideName = resolveMemberDisplay(tour.tour_guide_id)
          const assistantName =
            teamTypeStr === '1guide' || !tour.assistant_id
              ? '—'
              : resolveMemberDisplay(tour.assistant_id)
          return {
            tourId: String(tour.id),
            teamIndex: idx + 1,
            guideName,
            assistantName,
            assigned,
            max,
            spotsLeft
          }
        })
        const capTotalAssigned = tourCapacityRows.reduce((s, r) => s + r.assigned, 0)
        const capTotalMax = tourCapacityRows.reduce((s, r) => s + r.max, 0)
        const capTotalSpotsLeft = Math.max(0, capTotalMax - capTotalAssigned)
        const tourCapacityBreakdown =
          sortedDayTours.length === 0
            ? null
            : {
                rows: tourCapacityRows,
                totalAssigned: capTotalAssigned,
                totalMax: capTotalMax,
                totalSpotsLeft: capTotalSpotsLeft
              }

        // 멀티데이 투어 처리: 시작일에만 인원 표시
        if (!dailyData[dateString]) {
          dailyData[dateString] = {
            totalPeople: 0,
            waitingPeople: 0,
            koWaitingPeople: 0,
            enWaitingPeople: 0,
            canceledPeople: 0,
            assignmentPendingReservationCount: 0,
            tours: 0,
            koPeople: 0,
            enPeople: 0,
            choiceCounts: {},
            toursChoiceCounts: [],
            privateTourPeople: 0,
            companionTourPeople: 0,
            tourCapacityBreakdown: null
          }
        }
        // 멀티데이든 1일 투어든, 해당 날짜(시작일)에만 합산
        dailyData[dateString].totalPeople += dayTotalPeople
        dailyData[dateString].privateTourPeople += dayPrivateTourPeople
        dailyData[dateString].companionTourPeople += dayCompanionTourPeople
        dailyData[dateString].waitingPeople += dayWaitingPeople
        dailyData[dateString].koWaitingPeople += dayKoWaitingPeople
        dailyData[dateString].enWaitingPeople += dayEnWaitingPeople
        dailyData[dateString].canceledPeople += dayCanceledPeople
        dailyData[dateString].assignmentPendingReservationCount += dayAssignmentPendingReservationCount
        dailyData[dateString].koPeople += dayKoPeople
        dailyData[dateString].enPeople += dayEnPeople
        dailyData[dateString].tours += dayTours.length
        Object.entries(choiceCountsByKey).forEach(([k, v]) => {
          dailyData[dateString].choiceCounts[k] = (dailyData[dateString].choiceCounts[k] || 0) + v
        })
        dailyData[dateString].toursChoiceCounts = toursChoiceCounts
        dailyData[dateString].tourCapacityBreakdown = tourCapacityBreakdown

        if (!isEdgePadding) {
          totalPeople += dayTotalPeople
          totalTours += dayTours.length
        }
      })

      data[productId] = {
        product_name: product.name,
        dailyData,
        totalPeople,
        totalTours
      }
    })

    return data
  }, [tours, reservations, customers, products, selectedProducts, monthDays, reservationChoices, teamMembers, inactiveTeamMembers])

  // 가이드별 스케줄 데이터 계산
  const guideScheduleData = useMemo(() => {
    if (!tours.length || !reservations.length) return []

    const data: { [teamMemberId: string]: { team_member_name: string; position: string; dailyData: { [date: string]: DailyData }; totalPeople: number; totalAssignedPeople: number; totalTours: number } } = {}
    const teamMap = new Map(teamMembers.map(t => [t.email, t]))

    // 선택된 팀 멤버별로 데이터 생성
    selectedTeamMembers.forEach(teamMemberId => {
      const teamMember = teamMap.get(teamMemberId)
      if (!teamMember) return

      const memberTours = tours.filter(tour => 
        tour.tour_guide_id === teamMemberId || tour.assistant_id === teamMemberId
      )

      const dailyData: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number; productColors: { [productId: string]: string }; role: string | null; guideInitials: string | null; isMultiDay: boolean; multiDayDays: number } } = {}
      let totalPeople = 0
      let totalAssignedPeople = 0
      let totalTours = 0

      // 각 날짜별로 데이터 계산 (우측 합계는 당월 컬럼만 포함)
      monthDays.forEach(({ dateString, isEdgePadding }) => {
        const dayTours = memberTours.filter(tour => tour.tour_date === dateString)
        const dayReservations = reservations.filter(res => 
          res.tour_date === dateString &&
          (res.status?.toLowerCase() === 'confirmed' || res.status?.toLowerCase() === 'recruiting')
        )

        const dayTotalPeople = dayReservations.reduce((sum, res) => sum + (res.total_people || 0), 0)
        
        const dayAssignedPeople = dayTours.reduce((sum, tour) => {
          if (!tour.reservation_ids || !Array.isArray(tour.reservation_ids)) return sum
          const assignedReservations = dayReservations.filter(res => 
            tour.reservation_ids.includes(res.id)
          )
          return sum + assignedReservations.reduce((s, res) => s + (res.total_people || 0), 0)
        }, 0)

        // 역할과 가이드 초성 정보 추가
        const isGuide = dayTours.some(tour => tour.tour_guide_id === teamMemberId)
        const isAssistant = dayTours.some(tour => tour.assistant_id === teamMemberId)
        const role = isGuide ? 'guide' : isAssistant ? 'assistant' : null

        // 가이드 초성 추출 (어시스턴트인 경우)
        let guideInitials = null
        if (isAssistant) {
          const guideTour = dayTours.find(tour => tour.assistant_id === teamMemberId)
          if (guideTour && guideTour.tour_guide_id) {
            const guide = teamMap.get(guideTour.tour_guide_id)
            if (guide) {
              const gName = (guide as any).nick_name || guide.name_ko
              guideInitials = gName.split('').map((char: string) => char.charAt(0)).join('').substring(0, 2)
            }
          }
        }

        // 멀티데이 투어와 1일 투어를 분리하여 처리
        const multiDayTours = dayTours.filter(tour => getMultiDayTourDays(tour.product_id) > 1)
        const singleDayTours = dayTours.filter(tour => getMultiDayTourDays(tour.product_id) === 1)
        
        // 멀티데이 투어 처리 - 시작일만 표시
        if (multiDayTours.length > 0) {
          const tour = multiDayTours[0] // 첫 번째 멀티데이 투어만 사용
          const multiDayDays = getMultiDayTourDays(tour.product_id)
          
          dailyData[dateString] = {
            totalPeople: dayTotalPeople,
            assignedPeople: dayAssignedPeople,
            tours: 1,
            productColors: { [tour.product_id]: productColors[tour.product_id] || defaultPresetIds[0] },
            role: role,
            guideInitials: guideInitials,
            isMultiDay: true,
            multiDayDays: multiDayDays
          } as DailyData
          
          // 그리드 밖으로 넘어가는 경우에만 일수·화살표 조정 (익월 1일 컬럼까지는 그리드에 포함)
          const start = dayjs(dateString)
          const end = start.add(multiDayDays - 1, 'day')
          if (end.isAfter(scheduleGridLastDay, 'day')) {
            const daysVisibleOnGrid = scheduleGridLastDay.diff(start, 'day') + 1
            dailyData[dateString].multiDayDays = Math.max(1, daysVisibleOnGrid)
            ;(dailyData[dateString] as DailyData).extendsToNextMonth = true
          } else {
            dailyData[dateString].multiDayDays = multiDayDays
            ;(dailyData[dateString] as DailyData).extendsToNextMonth = false
          }
          
          // 멀티데이 투어의 경우 실제 투어 일수만큼 합계에 추가 (OFF·패딩 컬럼 제외)
          if (!isEdgePadding && !isOffDate(teamMemberId, dateString)) {
            // 멀티데이 투어의 경우 실제 투어 일수만큼 계산
            const actualTourDays = Math.min(multiDayDays, monthDays.length - monthDays.findIndex(d => d.dateString === dateString))
            totalPeople += dayTotalPeople * actualTourDays
            totalAssignedPeople += dayAssignedPeople * actualTourDays
            totalTours += actualTourDays
          }
        }
        
        // 1일 투어 처리
        if (singleDayTours.length > 0) {
          if (!dailyData[dateString]) {
            dailyData[dateString] = {
              totalPeople: 0,
              assignedPeople: 0,
              tours: 0,
              productColors: {},
              role: null,
              guideInitials: null,
              isMultiDay: false,
              multiDayDays: 1
            }
          }
          
          // 멀티데이 투어가 없는 경우에만 1일 투어 데이터 추가
          if (!multiDayTours.length) {
            dailyData[dateString].totalPeople += dayTotalPeople
            dailyData[dateString].assignedPeople += dayAssignedPeople
            dailyData[dateString].tours += singleDayTours.length
            dailyData[dateString].role = role
            dailyData[dateString].guideInitials = guideInitials
            dailyData[dateString].isMultiDay = false
            dailyData[dateString].multiDayDays = 1
            
            // 상품별 색상 매핑
            singleDayTours.forEach((tour) => {
              const productId = tour.product_id
              if (!dailyData[dateString].productColors[productId]) {
                const productIndex = selectedProducts.indexOf(productId)
                dailyData[dateString].productColors[productId] = productColors[productId] || defaultPresetIds[productIndex % defaultPresetIds.length]
              }
            })
            
            // 1일 투어: OFF·패딩 컬럼이 아닐 때만 우측 합계에 반영
            if (!isEdgePadding && !isOffDate(teamMemberId, dateString)) {
              totalPeople += dayTotalPeople
              totalAssignedPeople += dayAssignedPeople
              totalTours += singleDayTours.length
            }
          }
        }
      })

      data[teamMemberId] = {
        team_member_name: (teamMember as any).nick_name || teamMember.name_ko,
        position: teamMember.position || '',
        dailyData,
        totalPeople,
        totalAssignedPeople,
        totalTours
      }
    })

    return data
  }, [tours, reservations, teamMembers, selectedProducts, selectedTeamMembers, monthDays, productColors, currentDate, isOffDate, defaultPresetIds, scheduleGridLastDay])

  // 월 이동
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getTeamMemberDisplayName = (member: Team) => member.nick_name || member.name_ko || member.email

  const teamModalSearchNormalized = teamModalSearchQuery.trim().toLowerCase()
  const teamMembersFilteredForModal = useMemo(() => {
    if (!teamModalSearchNormalized) return teamMembers
    return teamMembers.filter((member) => {
      const displayName = member.nick_name || member.name_ko || member.email
      const hay = [displayName, member.name_ko, member.nick_name, member.name_en, member.email, member.position]
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .join(' ')
        .toLowerCase()
      return hay.includes(teamModalSearchNormalized)
    })
  }, [teamMembers, teamModalSearchNormalized])

  const inactiveTeamMembersFilteredForModal = useMemo(() => {
    if (!teamModalSearchNormalized) return inactiveTeamMembers
    return inactiveTeamMembers.filter((member) => {
      const displayName = member.nick_name || member.name_ko || member.email
      const hay = [displayName, member.name_ko, member.nick_name, member.name_en, member.email, member.position]
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .join(' ')
        .toLowerCase()
      return hay.includes(teamModalSearchNormalized)
    })
  }, [inactiveTeamMembers, teamModalSearchNormalized])

  useEffect(() => {
    if (!showTeamModal) setTeamModalSearchQuery('')
  }, [showTeamModal])

  const sortTeamMembersByDisplayName = (members: Team[]) => {
    return [...members].sort((a, b) =>
      getTeamMemberDisplayName(a).localeCompare(getTeamMemberDisplayName(b), locale === 'ko' ? 'ko' : 'en')
    )
  }

  // 상품 선택 토글 (관리자는 항상 공유 설정 DB 저장 → 모든 사용자 동일 적용)
  const toggleProduct = async (productId: string) => {
    const newSelection = selectedProducts.includes(productId) 
      ? selectedProducts.filter(id => id !== productId)
      : [...selectedProducts, productId]
    setSelectedProducts(newSelection)
    localStorage.setItem('schedule_selected_products', JSON.stringify(newSelection))
    if (isSuperAdmin) {
      if (newSelection.length > 0) {
        await saveSharedSetting('schedule_selected_products', newSelection)
        localStorage.setItem('shared_schedule_selected_products', JSON.stringify(newSelection))
      } else {
        await (supabase as any).from('shared_settings').delete().eq('setting_key', 'schedule_selected_products')
        localStorage.removeItem('shared_schedule_selected_products')
      }
    } else if (newSelection.length > 0) {
      await saveUserSetting('schedule_selected_products', newSelection)
    }
  }

  // 팀 멤버 선택 토글
  const toggleTeamMember = async (teamMemberId: string, saveAsShared: boolean = false) => {
    const newSelection = selectedTeamMembers.includes(teamMemberId) 
      ? selectedTeamMembers.filter(id => id !== teamMemberId)
      : [...selectedTeamMembers, teamMemberId]
    
    setSelectedTeamMembers(newSelection)
    
    // 관리자가 공유 설정으로 저장하는 경우
    if (saveAsShared && isSuperAdmin) {
      if (newSelection.length > 0) {
        await saveSharedSetting('schedule_selected_team_members', newSelection)
      }
    } else {
      // 개인 설정으로 저장
      if (newSelection.length > 0) {
        await saveUserSetting('schedule_selected_team_members', newSelection)
      }
    }
    
    // 로컬 스토리지에는 항상 저장 (fallback)
    localStorage.setItem('schedule_selected_team_members', JSON.stringify(newSelection))
  }

  const activateTeamMemberForSchedule = async (member: Team) => {
    if (!member.email || activatingTeamMemberEmail) return

    try {
      setActivatingTeamMemberEmail(member.email)
      const nextStatus = member.status === 'inactive' ? 'active' : member.status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('team')
        .update({
          is_active: true,
          ...(nextStatus !== member.status ? { status: nextStatus } : {})
        })
        .eq('email', member.email)

      if (error) throw error

      const activatedMember = { ...member, is_active: true, status: nextStatus }
      setInactiveTeamMembers(prev => prev.filter(item => item.email !== member.email))
      setTeamMembers(prev => sortTeamMembersByDisplayName([
        ...prev.filter(item => item.email !== member.email),
        activatedMember
      ]))

      const newSelection = selectedTeamMembers.includes(member.email)
        ? selectedTeamMembers
        : [...selectedTeamMembers, member.email]
      setSelectedTeamMembers(newSelection)
      if (newSelection.length > 0) {
        await saveUserSetting('schedule_selected_team_members', newSelection)
      }
      localStorage.setItem('schedule_selected_team_members', JSON.stringify(newSelection))
      setTeamModalTab('active')
      showMessage('팀원 활성화 완료', `${getTeamMemberDisplayName(member)} 팀원을 활성화하고 스케줄에 표시했습니다.`, 'success')
    } catch (error) {
      console.error('Error activating team member:', error)
      showMessage('팀원 활성화 실패', '팀원을 활성화하는 중 오류가 발생했습니다.', 'error')
    } finally {
      setActivatingTeamMemberEmail(null)
    }
  }

  // 상품 순서 변경 (관리자는 항상 공유 설정 DB 저장)
  const moveProduct = async (fromIndex: number, toIndex: number) => {
    const newSelection = [...selectedProducts]
    const [movedItem] = newSelection.splice(fromIndex, 1)
    newSelection.splice(toIndex, 0, movedItem)
    setSelectedProducts(newSelection)
    localStorage.setItem('schedule_selected_products', JSON.stringify(newSelection))
    if (isSuperAdmin) {
      await saveSharedSetting('schedule_selected_products', newSelection)
      localStorage.setItem('shared_schedule_selected_products', JSON.stringify(newSelection))
    } else {
      await saveUserSetting('schedule_selected_products', newSelection)
    }
  }

  // 팀원 순서 변경
  const moveTeamMember = async (fromIndex: number, toIndex: number) => {
    const newSelection = [...selectedTeamMembers]
    const [movedItem] = newSelection.splice(fromIndex, 1)
    newSelection.splice(toIndex, 0, movedItem)
    
    setSelectedTeamMembers(newSelection)
    
    // 공유 설정이 존재하면 DB에도 저장 (순서 변경이 다른 사용자에게도 반영)
    const hasSharedSetting = !!localStorage.getItem('shared_schedule_selected_team_members')
    if (hasSharedSetting && isSuperAdmin) {
      await saveSharedSetting('schedule_selected_team_members', newSelection)
    }
    
    // 개인 설정 저장
    await saveUserSetting('schedule_selected_team_members', newSelection)
    
    // 로컬 스토리지에도 저장 (fallback)
    localStorage.setItem('schedule_selected_team_members', JSON.stringify(newSelection))
    // 공유 캐시도 갱신
    if (hasSharedSetting) {
      localStorage.setItem('shared_schedule_selected_team_members', JSON.stringify(newSelection))
    }
  }

  // 가이드 행 드래그앤드롭 핸들러
  const handleGuideRowDragStart = (e: React.DragEvent, teamMemberId: string) => {
    setDraggedGuideRow(teamMemberId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/guide-row', teamMemberId)
    // 드래그 이미지를 작게 설정
    const target = e.currentTarget as HTMLElement
    if (target) {
      e.dataTransfer.setDragImage(target, 40, 15)
    }
  }

  const handleGuideRowDragOver = (e: React.DragEvent<HTMLTableRowElement>, teamMemberId: string) => {
    e.preventDefault()
    if (draggedGuideRow && draggedGuideRow !== teamMemberId) {
      e.dataTransfer.dropEffect = 'move'
      applyScheduleDragHighlight(e.currentTarget, SCHEDULE_ROW_REORDER_HIGHLIGHT)
    }
  }

  const handleGuideRowDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
    const next = e.relatedTarget
    if (next instanceof Node && e.currentTarget.contains(next)) return
    clearScheduleDragHighlight()
  }

  const handleGuideRowDrop = async (e: React.DragEvent, targetTeamMemberId: string) => {
    e.preventDefault()
    clearScheduleDragHighlight()
    
    if (!draggedGuideRow || draggedGuideRow === targetTeamMemberId) {
      setDraggedGuideRow(null)
      return
    }

    const fromIndex = selectedTeamMembers.indexOf(draggedGuideRow)
    const toIndex = selectedTeamMembers.indexOf(targetTeamMemberId)
    
    if (fromIndex !== -1 && toIndex !== -1) {
      await moveTeamMember(fromIndex, toIndex)
    }
    
    setDraggedGuideRow(null)
  }

  const handleGuideRowDragEnd = () => {
    setDraggedGuideRow(null)
    clearScheduleDragHighlight()
  }

  // 상품 행 드래그앤드롭 핸들러
  const handleProductRowDragStart = (e: React.DragEvent, productId: string) => {
    setDraggedProductRow(productId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/product-row', productId)
    const target = e.currentTarget as HTMLElement
    if (target) {
      e.dataTransfer.setDragImage(target, 40, 15)
    }
  }

  const handleProductRowDragOver = (e: React.DragEvent<HTMLTableRowElement>, productId: string) => {
    e.preventDefault()
    if (draggedProductRow && draggedProductRow !== productId) {
      e.dataTransfer.dropEffect = 'move'
      applyScheduleDragHighlight(e.currentTarget, SCHEDULE_ROW_REORDER_HIGHLIGHT)
    }
  }

  const handleProductRowDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
    const next = e.relatedTarget
    if (next instanceof Node && e.currentTarget.contains(next)) return
    clearScheduleDragHighlight()
  }

  const handleProductRowDrop = async (e: React.DragEvent, targetProductId: string) => {
    e.preventDefault()
    clearScheduleDragHighlight()
    
    if (!draggedProductRow || draggedProductRow === targetProductId) {
      setDraggedProductRow(null)
      return
    }

    const fromIndex = selectedProducts.indexOf(draggedProductRow)
    const toIndex = selectedProducts.indexOf(targetProductId)
    
    if (fromIndex !== -1 && toIndex !== -1) {
      await moveProduct(fromIndex, toIndex)
    }
    
    setDraggedProductRow(null)
  }

  const handleProductRowDragEnd = () => {
    setDraggedProductRow(null)
    clearScheduleDragHighlight()
  }

  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, tour: Tour) => {
    setDraggedTour(tour)
    e.dataTransfer.effectAllowed = 'move'
    
    // 드래그 시 표시할 투어 정보 설정
    const tourInfo = `${tour.products?.name || 'N/A'} (${tour.tour_date})`
    e.dataTransfer.setData('text/plain', tourInfo)
    // 같은 날짜 찾기 쉽게 하이라이트
    if (tour.tour_date) {
      setHighlightedDate(tour.tour_date)
    }
  }

  /** 가이드 표에서 투어 칩 드래그 취소 시 하이라이트·상태 정리 */
  const handleAssignedTourDragEnd = useCallback(() => {
    clearScheduleDragHighlight()
    setDraggedTour(null)
    setHighlightedDate(null)
    setDraggedRole(null)
  }, [clearScheduleDragHighlight])

  // 가이드 스케줄 드롭 존: 하이라이트는 DOM만 갱신 (React state 없음)
  const handleGuideScheduleDropZoneDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    applyScheduleDragHighlight(e.currentTarget, SCHEDULE_GUIDE_DROP_ZONE_HIGHLIGHT)
  }

  const handleGuideScheduleDropZoneDragLeave = (e: React.DragEvent<HTMLElement>) => {
    const next = e.relatedTarget
    if (next instanceof Node && e.currentTarget.contains(next)) return
    clearScheduleDragHighlight()
  }


  // 오프 스케줄 삭제 (배치 저장용)
  const handleOffScheduleDelete = (offSchedule: { team_email: string; off_date: string; reason: string; status: string }) => {
    const key = `${offSchedule.team_email}_${offSchedule.off_date}`
    setPendingOffScheduleChanges(prev => ({
      ...prev,
      [key]: {
        ...offSchedule,
        action: 'delete'
      }
    }))
    showMessage('삭제 대기', '오프 스케줄 삭제가 대기 목록에 추가되었습니다. 저장 버튼을 눌러 변경사항을 저장하세요.', 'success')
    setShowOffScheduleActionModal(false)
    setSelectedOffSchedule(null)
  }

  // 오프 스케줄 액션 모달 열기
  const openOffScheduleActionModal = (offSchedule: { team_email: string; off_date: string; reason: string; status: string } | null, teamMemberId?: string, dateString?: string) => {
    if (offSchedule) {
      setSelectedOffSchedule(offSchedule)
    } else if (teamMemberId && dateString) {
      // 빈칸 클릭 시 새로운 오프 스케줄 생성용
      setSelectedOffSchedule({
        team_email: teamMemberId,
        off_date: dateString,
        reason: '',
        status: 'pending'
      })
    }
    setShowOffScheduleActionModal(true)
  }

  // 오프 스케줄 승인 (배치 저장용)
  const handleOffScheduleApprove = (offSchedule: { team_email: string; off_date: string; reason: string; status: string }) => {
    const key = `${offSchedule.team_email}_${offSchedule.off_date}`
    setPendingOffScheduleChanges(prev => ({
      ...prev,
      [key]: {
        ...offSchedule,
        action: 'approve'
      }
    }))
    showMessage('승인 대기', '오프 스케줄 승인이 대기 목록에 추가되었습니다. 저장 버튼을 눌러 변경사항을 저장하세요.', 'success')
    setShowOffScheduleActionModal(false)
    setSelectedOffSchedule(null)
  }

  // 오프 스케줄 거절 (배치 저장용)
  const handleOffScheduleReject = (offSchedule: { team_email: string; off_date: string; reason: string; status: string }) => {
    const key = `${offSchedule.team_email}_${offSchedule.off_date}`
    setPendingOffScheduleChanges(prev => ({
      ...prev,
      [key]: {
        ...offSchedule,
        action: 'reject'
      }
    }))
    showMessage('거절 대기', '오프 스케줄 거절이 대기 목록에 추가되었습니다. 저장 버튼을 눌러 변경사항을 저장하세요.', 'success')
    setShowOffScheduleActionModal(false)
    setSelectedOffSchedule(null)
  }

  // 오프 스케줄 생성
  const handleCreateOffSchedule = async (teamMemberId: string, dateString: string) => {
    try {
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('off_schedules' as any)
        .insert({
          id: crypto.randomUUID(), // UUID 생성
          team_email: teamMemberId,
          off_date: dateString,
          reason: '더블클릭으로 생성',
          status: 'pending'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

      if (error) {
        console.error('Error creating off schedule:', error)
        showMessage('생성 실패', '오프 스케줄 생성에 실패했습니다.', 'error')
        return
      }

      // 성공 시 데이터 새로고침
      await fetchData()
      showMessage('생성 완료', '오프 스케줄이 생성되었습니다.', 'success')
      
    } catch (error) {
      console.error('Error creating off schedule:', error)
      showMessage('오류 발생', '오프 스케줄 생성 중 오류가 발생했습니다.', 'error')
    }
  }

  // 일괄 오프 스케줄 생성
  const handleBatchOffScheduleCreate = async () => {
    if (batchOffGuides.length === 0) {
      showMessage('입력 필요', '가이드를 선택해주세요.', 'error')
      return
    }
    if (!batchOffPeriodsValid) {
      showMessage('입력 필요', '모든 기간의 시작일·종료일을 선택해주세요. (종료일은 시작일 이후여야 합니다)', 'error')
      return
    }
    const dates = collectBatchOffDatesFromPeriods(
      batchOffPeriods.map(({ startDate, endDate }) => ({ startDate, endDate }))
    )
    if (dates.length === 0) {
      showMessage('입력 필요', '유효한 기간이 없습니다.', 'error')
      return
    }
    if (!batchOffReason.trim()) {
      showMessage('입력 필요', '사유를 입력 또는 선택해주세요.', 'error')
      return
    }

    setBatchOffSaving(true)
    try {
      // 각 가이드 x 각 날짜에 대해 오프 스케줄 생성
      const insertData = batchOffGuides.flatMap(guideEmail =>
        dates.map(date => ({
          id: crypto.randomUUID(),
          team_email: guideEmail,
          off_date: date,
          reason: batchOffReason.trim(),
          status: 'pending'
        }))
      )

      // 이미 존재하는 오프 스케줄 제외
      const filteredInsertData = insertData.filter(item => 
        !offSchedules.some(off => 
          off.team_email === item.team_email && off.off_date === item.off_date
        )
      )

      if (filteredInsertData.length === 0) {
        showMessage('중복', '선택한 기간에 이미 모든 오프 스케줄이 등록되어 있습니다.', 'error')
        setBatchOffSaving(false)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('off_schedules' as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(filteredInsertData as any)

      if (error) {
        console.error('Error creating batch off schedules:', error)
        showMessage('생성 실패', '오프 스케줄 일괄 생성에 실패했습니다.', 'error')
        setBatchOffSaving(false)
        return
      }

      const skipped = insertData.length - filteredInsertData.length
      const msg = skipped > 0
        ? `${filteredInsertData.length}건 생성 완료 (${skipped}건 중복 제외)`
        : `${filteredInsertData.length}건 생성 완료`

      await fetchData()
      setShowBatchOffModal(false)
      resetBatchOffModalFields()
      showMessage('일괄 생성 완료', msg, 'success')
    } catch (error) {
      console.error('Error creating batch off schedules:', error)
      showMessage('오류 발생', '오프 스케줄 일괄 생성 중 오류가 발생했습니다.', 'error')
    } finally {
      setBatchOffSaving(false)
    }
  }

  // 드롭 처리
  const handleDrop = async (e: React.DragEvent, teamMemberId: string, dateString: string, role: 'guide' | 'assistant') => {
    e.preventDefault()
    clearScheduleDragHighlight()
    
    if (!draggedTour) return

    // 날짜가 다른 셀에는 드롭 불가
    if (draggedTour.tour_date !== dateString) {
      alert('투어 날짜와 다른 날짜에는 배정할 수 없습니다. 같은 날짜 셀에만 드롭하세요.')
      return
    }

    try {
      // 즉시 저장 대신 변경 누적 + 로컬 미리보기 반영
      // draggedRole이 있으면 우선 사용 (가이드/어시스턴트 재배정 구분)
      const effectiveRole = draggedRole || role
      const updateData: Partial<Tour> = {}
      if (effectiveRole === 'guide') {
        updateData.tour_guide_id = teamMemberId
      } else if (effectiveRole === 'assistant') {
        updateData.assistant_id = teamMemberId
      }

      setPendingChanges(prev => ({
        ...prev,
        [draggedTour.id]: {
          ...(prev[draggedTour.id] || {}),
          ...updateData
        }
      }))

      // tours 상태에 즉시 반영하여 화면에서 미리보기 가능하게 함
      setTours(prev => prev.map(t => t.id === draggedTour.id ? { ...t, ...updateData } : t))
      requestSaveAfterDragAssignment()
    } finally {
      setDraggedTour(null)
      setHighlightedDate(null)
      setDraggedRole(null)
    }
  }

  // 차량 셀에 드롭 처리 (이미 배정된 투어를 다른 차량으로 재배정)
  const handleVehicleCellDrop = (e: React.DragEvent, targetVehicleId: string, dateString: string) => {
    e.preventDefault()
    clearScheduleDragHighlight()
    if (!draggedTour) return
    if (draggedTour.tour_date !== dateString) {
      return
    }
    const newLabel = monthVehiclesWithColors.vehicleList.find(v => v.id === targetVehicleId)?.label ?? null
    setPendingChanges(prev => ({
      ...prev,
      [draggedTour.id]: {
        ...(prev[draggedTour.id] || {}),
        tour_car_id: targetVehicleId
      }
    }))
    setTours(prev => prev.map(t => t.id === draggedTour.id ? { ...t, tour_car_id: targetVehicleId, vehicle_number: newLabel } : t))
    requestSaveAfterDragAssignment()
    setDraggedTour(null)
    setHighlightedDate(null)
    setDraggedRole(null)
  }

  // 미배정 영역으로 드롭 처리 (배정 해제)
  const handleUnassignDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    clearScheduleDragHighlight()
    
    if (!draggedTour) return

    try {
      // 즉시 저장 대신 변경 누적 (해제)
      setPendingChanges(prev => ({
        ...prev,
        [draggedTour.id]: {
          ...(prev[draggedTour.id] || {}),
          tour_guide_id: null,
          assistant_id: null
        }
      }))

      // tours 상태에도 반영
      setTours(prev => prev.map(t => t.id === draggedTour.id ? { ...t, tour_guide_id: null, assistant_id: null } : t))

      // 미배정 목록에 추가 (이미 있지 않은 경우)
      setUnassignedTours(prev => {
        const exists = prev.some(t => t.id === draggedTour.id)
        const updatedTour = { ...draggedTour, tour_guide_id: null, assistant_id: null }
        return exists ? prev.map(t => t.id === draggedTour.id ? updatedTour : t) : [...prev, updatedTour]
      })
      requestSaveAfterDragAssignment()
    } finally {
      setDraggedTour(null)
      setHighlightedDate(null)
    }
  }

  const getTourDetailModalTitle = useCallback(
    (tourId: string) => {
      const tour = tours.find((t: Tour) => t.id === tourId)
      if (!tour) return '투어 상세'
      const productName = products.find((p: Product) => p.id === tour.product_id)?.name || '투어'
      const [, m, d] = (tour.tour_date || '').split('-')
      const datePart = m && d ? `${m}/${d}` : ''
      return datePart ? `${datePart} ${productName}` : productName
    },
    [tours, products]
  )

  const openTourDetailModal = useCallback(
    (tourId: string) => {
      setTourDetailModal({ tourId, title: getTourDetailModalTitle(tourId) })
    },
    [getTourDetailModalTitle]
  )

  // 미 배정된 투어들을 가이드/어시스턴트 배정 카드로 변환
  const unassignedTourCards = useMemo(() => {
    const monthStartStr = firstDayOfMonth.format('YYYY-MM-DD')
    const monthEndStr = lastDayOfMonth.format('YYYY-MM-DD')
    const cards: Array<{
      id: string
      tour: Tour
      role: 'guide' | 'assistant'
      title: string
      isAssigned: boolean
    }> = []
    
    unassignedTours.forEach(tour => {
      const dateKey = String(tour.tour_date ?? '').slice(0, 10)
      if (!dateKey || dateKey < monthStartStr || dateKey > monthEndStr) return
      const product = products.find(p => p.id === tour.product_id)
      const productName = product?.name || 'N/A'
      // tour_date를 그대로 사용 (변환하지 않음)
      const [, month, day] = tour.tour_date.split('-')
      const tourDate = `${month}월 ${day}일`
      const baseTitle = `${tourDate} ${productName}`
      
      // 가이드가 배정되지 않은 경우 가이드 카드 추가
      if (!tour.tour_guide_id) {
        cards.push({
          id: `${tour.id}-guide`,
          tour,
          role: 'guide',
          title: `${baseTitle} - 가이드`,
          isAssigned: false
        })
      }
      
      // team_type이 1guide가 아니고 어시스턴트가 배정되지 않은 경우에만 어시스턴트 카드 추가
      if (tour.team_type !== '1guide' && !tour.assistant_id) {
        cards.push({
          id: `${tour.id}-assistant`,
          tour,
          role: 'assistant',
          title: `${baseTitle} - 어시스턴트`,
          isAssigned: false
        })
      }
    })
    
    // 날짜순, 상품명순으로 정렬
    return cards.sort((a, b) => {
      const dateCompare = a.tour.tour_date.localeCompare(b.tour.tour_date)
      if (dateCompare !== 0) return dateCompare
      
      const productA = products.find(p => p.id === a.tour.product_id)
      const productB = products.find(p => p.id === b.tour.product_id)
      return (productA?.name || '').localeCompare(productB?.name || '')
    })
  }, [unassignedTours, products, firstDayOfMonth, lastDayOfMonth])

  const teamMembersSortedForAssignModal = useMemo(() => {
    return [...teamMembers].sort((a, b) => {
      const na = ((a as { nick_name?: string }).nick_name || a.name_ko || a.email || '').toString()
      const nb = ((b as { nick_name?: string }).nick_name || b.name_ko || b.email || '').toString()
      return na.localeCompare(nb, locale === 'ko' ? 'ko' : 'en')
    })
  }, [teamMembers, locale])

  const detachUnassignedDragPageAutoScroll = useCallback(() => {
    unassignedDragAutoScrollCleanupRef.current?.()
  }, [])

  const attachUnassignedDragPageAutoScroll = useCallback(() => {
    detachUnassignedDragPageAutoScroll()
    const margin = 100
    const maxStep = 36
    const onDragOver = (ev: DragEvent) => {
      ev.preventDefault()
      unassignedDragPendingClientYRef.current = ev.clientY
      if (unassignedDragScrollRafRef.current != null) return
      unassignedDragScrollRafRef.current = requestAnimationFrame(() => {
        unassignedDragScrollRafRef.current = null
        const y = unassignedDragPendingClientYRef.current
        if (y == null) return
        const h = window.innerHeight
        if (y < margin) {
          const k = Math.min(1, (margin - y) / margin)
          window.scrollBy(0, -Math.max(2, Math.round(maxStep * k)))
        } else if (y > h - margin) {
          const k = Math.min(1, (y - (h - margin)) / margin)
          window.scrollBy(0, Math.max(2, Math.round(maxStep * k)))
        }
      })
    }
    document.addEventListener('dragover', onDragOver)
    unassignedDragAutoScrollCleanupRef.current = () => {
      document.removeEventListener('dragover', onDragOver)
      if (unassignedDragScrollRafRef.current != null) {
        cancelAnimationFrame(unassignedDragScrollRafRef.current)
        unassignedDragScrollRafRef.current = null
      }
      unassignedDragPendingClientYRef.current = null
      unassignedDragAutoScrollCleanupRef.current = null
    }
  }, [detachUnassignedDragPageAutoScroll])

  useEffect(() => () => detachUnassignedDragPageAutoScroll(), [detachUnassignedDragPageAutoScroll])

  // 미 배정된 투어 카드 드래그 시작
  const handleUnassignedTourCardDragStart = (e: React.DragEvent, card: { tour: Tour; role: 'guide' | 'assistant' }) => {
    setDraggedUnassignedTour(card.tour)
    setHighlightedDate(card.tour.tour_date) // 해당 날짜 하이라이트
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({
      tourId: card.tour.id,
      role: card.role
    }))
    attachUnassignedDragPageAutoScroll()
  }

  // 미 배정된 투어 드래그 종료
  const handleUnassignedTourDragEnd = () => {
    detachUnassignedDragPageAutoScroll()
    setDraggedUnassignedTour(null)
    clearScheduleDragHighlight()
    setHighlightedDate(null) // 하이라이트 제거
  }

  /** 미배정 투어에 가이드/어시스턴트 배정 (드래그 드롭 · 모달 공통) */
  const applyUnassignedPersonToTour = useCallback(
    (tour: Tour, teamMemberId: string, dateString: string, role: 'guide' | 'assistant') => {
      const updateData: Partial<Tour> = {
        tour_date: dateString,
      }
      if (role === 'guide') {
        updateData.tour_guide_id = teamMemberId
      } else if (role === 'assistant') {
        updateData.assistant_id = teamMemberId
      }

      setPendingChanges((prev) => ({
        ...prev,
        [tour.id]: {
          ...(prev[tour.id] || {}),
          ...updateData,
        },
      }))

      setTours((prev) => prev.map((t) => (t.id === tour.id ? { ...t, ...updateData } : t)))

      setUnassignedTours((prev) => {
        const exists = prev.some((t) => t.id === tour.id)
        if (!exists) return prev
        return prev
          .map((t) => {
            if (t.id !== tour.id) return t
            const updated = { ...t, ...updateData }
            const needsGuide = !updated.tour_guide_id
            const needsAssistant = updated.team_type !== '1guide' && !updated.assistant_id
            return needsGuide || needsAssistant ? updated : null
          })
          .filter(Boolean) as Tour[]
      })
      requestSaveAfterDragAssignment()
    },
    [requestSaveAfterDragAssignment],
  )

  // 가이드/어시스턴트 셀에 드롭
  const handleGuideCellDrop = async (e: React.DragEvent, teamMemberId: string, dateString: string, role: 'guide' | 'assistant') => {
    e.preventDefault()

    if (!draggedUnassignedTour) return

    try {
      applyUnassignedPersonToTour(draggedUnassignedTour, teamMemberId, dateString, role)
    } finally {
      detachUnassignedDragPageAutoScroll()
      setDraggedUnassignedTour(null)
      clearScheduleDragHighlight()
      setHighlightedDate(null)
    }
  }


  // 투어 요약에 쓰는 공통 집계 (모달 요약 · 가이드 스케줄 호버 등)
  const getTourSummaryCore = (tour: Tour) => {
    const productName = tour.products?.name || 'N/A'
    const tourDate = tour.tour_date

    const dayReservations = reservations.filter(r =>
      r.tour_date === tour.tour_date &&
      r.product_id === tour.product_id &&
      (r.status?.toLowerCase() === 'confirmed' || r.status?.toLowerCase() === 'recruiting')
    )
    const totalPeopleAll = dayReservations.reduce((s, r) => s + (r.total_people || 0), 0)
    let assignedPeople = 0
    let assignedKo = 0
    if (tour.reservation_ids && Array.isArray(tour.reservation_ids)) {
      const assigned = dayReservations.filter(r => tour.reservation_ids!.includes(r.id))
      assignedPeople = assigned.reduce((s, r) => s + (r.total_people || 0), 0)
      assignedKo = assigned.reduce((s, r) => {
        const cid = String(r.customer_id || '')
        const isKo = customerIdToIsKo.get(cid) === true
        return s + (isKo ? (r.total_people || 0) : 0)
      }, 0)
    }
    const assignedEn = Math.max(assignedPeople - assignedKo, 0)

    const guide = teamMembers.find(t => t.email === tour.tour_guide_id)
    const assistant = teamMembers.find(t => t.email === tour.assistant_id)
    const guideName = (guide as any)?.nick_name || guide?.name_ko || '-'
    const assistantName = (assistant as any)?.nick_name || assistant?.name_ko || '-'

    const vehicleNumber = tour.vehicle_number || tour.vehicle_id || '-'
    const vehicleAssigned = tour.tour_car_id && String(tour.tour_car_id).trim().length > 0

    const confirmedEa = ticketBookings
      .filter(tb => {
        if (tb.tour_id !== tour.id) return false
        const s = tb.status?.toLowerCase()
        return (
          s === 'confirmed' ||
          s === 'paid' ||
          s === 'pending' ||
          s === 'tentative' ||
          s === 'completed'
        )
      })
      .reduce((s, tb) => s + (tb.ea || 0), 0)

    const isPrivateTour = tour.is_private_tour === 'TRUE' || tour.is_private_tour === true

    const assignedIds = new Set((tour.reservation_ids && Array.isArray(tour.reservation_ids)) ? (tour.reservation_ids as string[]) : [])
    const assignedResList = dayReservations.filter(r => assignedIds.has(r.id))
    const choiceRowsByRes = new Map<string, Array<{ choiceKey: string; quantity: number }>>()
    reservationChoices.forEach(rc => {
      if (!assignedIds.has(rc.reservation_id)) return
      const list = choiceRowsByRes.get(rc.reservation_id) || []
      list.push({ choiceKey: rc.choiceKey || '_other', quantity: rc.quantity ?? 1 })
      choiceRowsByRes.set(rc.reservation_id, list)
    })
    const choiceCounts: Record<string, number> = {}
    assignedResList.forEach(res => {
      const rows = choiceRowsByRes.get(res.id) || []
      const people = res.total_people || 0
      if (rows.length === 0) return
      if (rows.length === 1) {
        const key = rows[0].choiceKey
        choiceCounts[key] = (choiceCounts[key] || 0) + people
      } else {
        rows.forEach(r => {
          choiceCounts[r.choiceKey] = (choiceCounts[r.choiceKey] || 0) + r.quantity
        })
      }
    })
    const displayOrder = ['X', 'L', 'U', '_other']
    const keyToLabel: Record<string, string> = { X: 'X', L: 'L', U: 'U', _other: '기타' }
    const choiceParts = displayOrder
      .filter(k => (choiceCounts[k] || 0) > 0)
      .map(k => `${keyToLabel[k]} : ${choiceCounts[k]}`)
    const choiceLine = choiceParts.length > 0 ? `초이스: ${choiceParts.join(' / ')}` : null

    return {
      productName,
      tourDate,
      assignedPeople,
      totalPeopleAll,
      assignedKo,
      assignedEn,
      guideName,
      assistantName,
      vehicleNumber,
      vehicleAssigned,
      confirmedEa,
      isPrivateTour,
      choiceLine
    }
  }

  /** 가이드 스케줄 셀 호버: 상세 모달과 동일 집계, 빠른 확인용 줄 순서 */
  const getGuideScheduleTourHoverText = (tour: Tour) => {
    const c = getTourSummaryCore(tour)
    const lines = [
      `가이드: ${c.guideName}`,
      `어시스턴트: ${c.assistantName}`,
      `차량: ${c.vehicleNumber}`,
      `인원: ${c.assignedPeople} / ${c.totalPeopleAll}`,
      `배정 언어: ko ${c.assignedKo} / en ${c.assignedEn}`
    ]
    if (c.choiceLine) lines.push(c.choiceLine)
    return lines.join('\n')
  }

  const getTourSummary = (tour: Tour) => {
    const c = getTourSummaryCore(tour)
    const lines = [
      `투어: ${c.productName}${c.isPrivateTour ? ' (단독투어)' : ''}`,
      `날짜: ${c.tourDate}`,
      `인원: ${c.assignedPeople} / ${c.totalPeopleAll}`,
      `배정 언어: ko ${c.assignedKo} / en ${c.assignedEn}`,
      ...(c.choiceLine ? [c.choiceLine] : []),
      `가이드: ${c.guideName}`,
      `어시스턴트: ${c.assistantName}`,
      `차량: ${c.vehicleNumber}`,
      `배차: ${c.vehicleAssigned ? '배차 완료' : '미배차'}`,
      `Confirm EA: ${c.confirmedEa}`
    ]
    return lines.join('\n')
  }

  const isStatusExcludedFromUnassignedList = useCallback((status: string) => {
    const s = (status || '').toLowerCase()
    if (!s) return false
    if (s.includes('canceled') || s.includes('cancelled')) return true
    if (s === 'deleted') return true
    if (s.includes('requested for delete')) return true
    return false
  }, [])

  const updateUnassignedTourStatus = useCallback(
    async (tourId: string, newStatus: string) => {
      setUpdatingUnassignedTourStatusId(tourId)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from('tours' as any)
          .update({ tour_status: newStatus })
          .eq('id', tourId)
        if (error) throw error
        setTours((prev) => prev.map((t) => (t.id === tourId ? { ...t, tour_status: newStatus } : t)))
        setUnassignedTours((prev) => {
          if (isStatusExcludedFromUnassignedList(newStatus)) {
            return prev.filter((t) => t.id !== tourId)
          }
          return prev.map((t) => (t.id === tourId ? { ...t, tour_status: newStatus } : t))
        })
        setUnassignedTourStatusModalTourId(null)
      } catch (e) {
        console.error(e)
        alert(locale === 'ko' ? '투어 상태 업데이트에 실패했습니다.' : 'Failed to update tour status.')
      } finally {
        setUpdatingUnassignedTourStatusId(null)
      }
    },
    [locale, isStatusExcludedFromUnassignedList]
  )

  const guideModalTour = useMemo(() => {
    if (!guideModalContent.tourId) return null
    return tours.find((t: Tour) => t.id === guideModalContent.tourId) ?? null
  }, [guideModalContent.tourId, tours])

  const guideModalStatusSelectOptions = useMemo(() => {
    if (!guideModalContent.tourId) return tourStatusOptions
    const current = guideModalTour?.tour_status || ''
    const known = new Set(tourStatusOptions.map((o) => o.value))
    if (current && !known.has(current)) {
      return [
        {
          value: current,
          label: getTourStatusLabel(current, locale),
          color: getTourStatusColor(current),
        },
        ...tourStatusOptions,
      ]
    }
    return tourStatusOptions
  }, [guideModalContent.tourId, guideModalTour?.tour_status, locale])

  const guideModalStatusSelectValue = useMemo(() => {
    const current = guideModalTour?.tour_status || ''
    if (!current) return ''
    const exact = guideModalStatusSelectOptions.find((o) => o.value === current)
    if (exact) return exact.value
    const ci = guideModalStatusSelectOptions.find(
      (o) => o.value.toLowerCase() === current.toLowerCase()
    )
    return ci?.value ?? current
  }, [guideModalTour?.tour_status, guideModalStatusSelectOptions])

  const updateTourDetailModalTourStatus = useCallback(
    async (tourId: string, newStatus: string) => {
      const prevTour = tours.find((t: Tour) => t.id === tourId)
      const prevStatus = (prevTour?.tour_status || '').toLowerCase().trim()
      if (prevStatus === (newStatus || '').toLowerCase().trim()) return
      setUpdatingTourDetailModalStatusId(tourId)
      try {
        const ok = await tourHandlers.updateTourStatus({ id: tourId }, newStatus, isScheduleStaff)
        if (!ok) return
        setTours((prev) => prev.map((t) => (t.id === tourId ? { ...t, tour_status: newStatus } : t)))
        setUnassignedTours((prev) => {
          if (isStatusExcludedFromUnassignedList(newStatus)) {
            return prev.filter((t) => t.id !== tourId)
          }
          return prev.map((t) => (t.id === tourId ? { ...t, tour_status: newStatus } : t))
        })
        setTourDetailIframeReloadNonce((n) => n + 1)
      } finally {
        setUpdatingTourDetailModalStatusId(null)
      }
    },
    [tours, tourHandlers, isScheduleStaff, isStatusExcludedFromUnassignedList]
  )

  // 상품별 총계 계산
  const productTotals = useMemo(() => {
    const dailyTotals: { [date: string]: { totalPeople: number; waitingPeople: number; tours: number } } = {}
    
    monthDays.forEach(({ dateString }) => {
      dailyTotals[dateString] = { totalPeople: 0, waitingPeople: 0, tours: 0 }
    })

    Object.values(productScheduleData).forEach(product => {
      monthDays.forEach(({ dateString }) => {
        const dayData = product.dailyData[dateString]
        if (dayData) {
          dailyTotals[dateString].totalPeople += dayData.totalPeople
          dailyTotals[dateString].waitingPeople += dayData.waitingPeople ?? 0
          dailyTotals[dateString].tours += dayData.tours
        }
      })
    })

    return dailyTotals
  }, [productScheduleData, monthDays])

  const scheduleMonthKey = useMemo(
    () => `${currentDate.getFullYear()}-${currentDate.getMonth()}`,
    [currentDate]
  )

  /** 해당 월·상품·날짜 중 배정 인원 합이 수용 합을 넘는 셀 목록 */
  const scheduleCapacityOverflowItems = useMemo(() => {
    const items: Array<{
      productId: string
      dateString: string
      productName: string
      assigned: number
      max: number
    }> = []
    const todayStr = dayjs().format('YYYY-MM-DD')
    for (const [productId, prod] of Object.entries(productScheduleData)) {
      for (const { dateString, isEdgePadding } of monthDays) {
        if (isEdgePadding) continue
        if (dateString < todayStr) continue
        const dd = prod.dailyData[dateString]
        const br = dd?.tourCapacityBreakdown
        if (br && br.totalAssigned > br.totalMax) {
          items.push({
            productId,
            dateString,
            productName: prod.product_name || productId,
            assigned: br.totalAssigned,
            max: br.totalMax
          })
        }
      }
    }
    items.sort((a, b) => a.dateString.localeCompare(b.dateString) || a.productName.localeCompare(b.productName))
    return items
  }, [productScheduleData, monthDays])

  useEffect(() => {
    setCapacityOverflowModalDismissed(false)
  }, [scheduleMonthKey])

  useEffect(() => {
    if (capacityOverflowModalDismissed) return
    if (scheduleCapacityOverflowItems.length > 0) setCapacityOverflowModalOpen(true)
    else setCapacityOverflowModalOpen(false)
  }, [scheduleCapacityOverflowItems, capacityOverflowModalDismissed])

  // 공급업체 이름 변환 함수
  const getCompanyDisplayName = (company: string): string => {
    if (company === 'SEE Canyon') {
      return "Dixie's"
    }
    return company
  }

  const ticketBookingsById = useMemo(() => {
    const m = new Map<string, ScheduleTicketBookingRow>()
    for (const b of ticketBookings) {
      m.set(b.id, b)
    }
    return m
  }, [ticketBookings])

  // 부킹 데이터 날짜별 합산
  const bookingTotals = useMemo(() => {
    const dailyTotals: { [date: string]: { 
      ticketCount: number; 
      hotelCount: number; 
      totalCount: number;
      ticketDetails: Array<{
        id: string
        company: string
        time: string
        ea: number
        booking_status?: string | null
        vendor_status?: string | null
      }>;
      hotelDetails: Array<{ hotel: string; rooms: number }>;
    } } = {}
    
    monthDays.forEach(({ dateString }) => {
      dailyTotals[dateString] = { 
        ticketCount: 0, 
        hotelCount: 0, 
        totalCount: 0,
        ticketDetails: [],
        hotelDetails: []
      }
    })

    // tour_id → tour_date 매핑 (check_in_date가 없거나 매칭 안 될 때 fallback)
    const tourDateMap = new Map<string, string>()
    tours.forEach(tour => {
      if (tour.id && tour.tour_date) {
        tourDateMap.set(tour.id, tour.tour_date.substring(0, 10))
      }
    })

    const isActiveStatus = (status: string | null) => {
      if (!status) return false
      const s = status.toLowerCase()
      return (
        s === 'confirmed' ||
        s === 'paid' ||
        s === 'pending' ||
        s === 'tentative' ||
        s === 'completed'
      )
    }

    // 입장권 부킹 합산
    ticketBookings.forEach(booking => {
      if (!isActiveStatus(booking.status)) return
      
      // check_in_date를 YYYY-MM-DD로 정규화, 없으면 tour_date에서 가져오기
      let dateString = booking.check_in_date ? booking.check_in_date.substring(0, 10) : null
      if (!dateString && booking.tour_id) {
        dateString = tourDateMap.get(booking.tour_id) || null
      }
      
      if (dateString && dailyTotals[dateString]) {
        dailyTotals[dateString].ticketCount += booking.ea || 0
        dailyTotals[dateString].totalCount += booking.ea || 0
        dailyTotals[dateString].ticketDetails.push({
          id: booking.id,
          company: booking.company || '',
          time: booking.time || '',
          ea: booking.ea || 0,
          booking_status: booking.booking_status ?? null,
          vendor_status: booking.vendor_status ?? null,
        })
      }
    })

    // 투어 호텔 부킹 합산
    tourHotelBookings.forEach(booking => {
      if (!isActiveStatus(booking.status)) return
      
      let dateString = booking.check_in_date ? booking.check_in_date.substring(0, 10) : null
      if (!dateString && booking.tour_id) {
        dateString = tourDateMap.get(booking.tour_id) || null
      }
      
      if (dateString && dailyTotals[dateString]) {
        dailyTotals[dateString].hotelCount += booking.rooms || 0
        dailyTotals[dateString].totalCount += booking.rooms || 0
        if (booking.hotel) {
          dailyTotals[dateString].hotelDetails.push({
            hotel: booking.hotel,
            rooms: booking.rooms || 0
          })
        }
      }
    })

    return dailyTotals
  }, [ticketBookings, tourHotelBookings, tours, monthDays])

  const bookingDetailRowsByDate = useMemo(() => {
    const out: Record<string, ScheduleBookingDetailRow[]> = {}
    monthDays.forEach(({ dateString }) => {
      const bd = bookingTotals[dateString]
      const rows: ScheduleBookingDetailRow[] = []
      if (bd) {
        const agg = aggregateTicketDetailsForScheduleDisplay(bd.ticketDetails)
        for (const row of agg) {
          rows.push({
            kind: 'ticket',
            displayTime: row.displayTime,
            tag: row.tag,
            ea: row.ea,
            bookingIds: row.bookingIds,
          })
        }
        for (const h of bd.hotelDetails) {
          const name = (h.hotel || '?').trim()
          const short = name.length > 8 ? `${name.slice(0, 7)}…` : name
          rows.push({ kind: 'hotel', line: `${short} ${h.rooms}실` })
        }
      }
      out[dateString] = rows
    })
    return out
  }, [bookingTotals, monthDays])

  // 가이드별 총계 계산
  const guideTotals = useMemo(() => {
    const dailyTotals: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number } } = {}
    
    monthDays.forEach(({ dateString }) => {
      dailyTotals[dateString] = { totalPeople: 0, assignedPeople: 0, tours: 0 }
    })

    Object.values(guideScheduleData).forEach(guide => {
      monthDays.forEach(({ dateString }) => {
        const dayData = guide.dailyData[dateString]
        if (dayData) {
          // 멀티데이 투어의 경우 실제 투어 일수만큼 계산
          if (dayData.isMultiDay) {
            const actualTourDays = Math.min(dayData.multiDayDays, monthDays.length - monthDays.findIndex(d => d.dateString === dateString))
            dailyTotals[dateString].totalPeople += dayData.totalPeople * actualTourDays
            // assistant는 제외하고 guide 역할의 배정 인원만 합산
            const assignedForGuides = dayData.role === 'guide' ? dayData.assignedPeople : 0
            dailyTotals[dateString].assignedPeople += assignedForGuides * actualTourDays
            dailyTotals[dateString].tours += actualTourDays
          } else {
            dailyTotals[dateString].totalPeople += dayData.totalPeople
            // assistant는 제외하고 guide 역할의 배정 인원만 합산
            const assignedForGuides = dayData.role === 'guide' ? dayData.assignedPeople : 0
            dailyTotals[dateString].assignedPeople += assignedForGuides
            dailyTotals[dateString].tours += dayData.tours
          }
        }
      })
    })

    return dailyTotals
  }, [guideScheduleData, monthDays])

  // 해당 월 사용 가능 차량 목록 + 차량별 색상 (scheduleVehicles 기준, 취소·비활성 제외)
  const VEHICLE_COLOR_PALETTE = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-violet-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500', 'bg-indigo-500',
    'bg-rose-500', 'bg-lime-500', 'bg-sky-500', 'bg-fuchsia-500', 'bg-emerald-500'
  ] as const
  const monthVehiclesWithColors = useMemo(() => {
    const vehicleIdToColor = new Map<string, string>()
    const list = scheduleVehicles.map((v, i) => {
      const colorClass = VEHICLE_COLOR_PALETTE[i % VEHICLE_COLOR_PALETTE.length]
      vehicleIdToColor.set(v.id, colorClass)
      return {
        id: v.id,
        label: v.label,
        colorClass,
        vehicle_category: v.vehicle_category,
        rental_start_date: v.rental_start_date,
        rental_end_date: v.rental_end_date
      }
    })
    return { vehicleIdToColor, vehicleList: list }
  }, [scheduleVehicles])

  /** 미배정 카드·모달에서 투어에 차량 배정 (pendingChanges + 로컬 상태) */
  const assignVehicleToTourFromModal = useCallback(
    (tour: Tour, vehicleId: string) => {
      const newLabel = monthVehiclesWithColors.vehicleList.find((v) => v.id === vehicleId)?.label ?? null
      setPendingChanges((prev) => ({
        ...prev,
        [tour.id]: {
          ...(prev[tour.id] || {}),
          tour_car_id: vehicleId,
        },
      }))
      setTours((prev) =>
        prev.map((t) => (t.id === tour.id ? { ...t, tour_car_id: vehicleId, vehicle_number: newLabel } : t)),
      )
      setUnassignedTours((prev) =>
        prev.map((t) => (t.id === tour.id ? { ...t, tour_car_id: vehicleId, vehicle_number: newLabel } : t)),
      )
      requestSaveAfterDragAssignment()
    },
    [monthVehiclesWithColors.vehicleList, requestSaveAfterDragAssignment],
  )

  // 차량별·날짜별 배차 수, 가이드/어시스턴트/드라이버 이름, 투어(상품) 색상 (차량 스케줄 테이블용)
  // 1박2일 등 멀티데이 투어는 투어 기간 내 모든 날짜에 표시 (가이드 스케줄과 동일)
  const vehicleScheduleData = useMemo(() => {
    const result: Record<string, {
      daily: Record<string, {
        count: number
        guideNames: string[]
        assistantNames: string[]
        driverNames: string[]
        productColorClass: string
      }>
      /** 우측 합계: 당월 컬럼만 (패딩일 제외) */
      totalDays: number
      /** 그리드 어딘가에 배차가 있으면 행 표시용 */
      hasAnyDayAssignment: boolean
    }> = {}
    monthVehiclesWithColors.vehicleList.forEach(({ id }) => {
      result[id] = { daily: {}, totalDays: 0, hasAnyDayAssignment: false }
      monthDays.forEach(({ dateString, isEdgePadding }) => {
        const dayTours = tours.filter(t =>
          t.tour_car_id && String(t.tour_car_id).trim() === id && tourCoversScheduleDate(t, dateString)
        )
        const guideNames = [...new Set(dayTours.map(t => {
          const guide = teamMembers.find(m => m.email === t.tour_guide_id)
          return (guide?.nick_name || guide?.name_ko || t.tour_guide_id || '-').trim()
        }).filter(Boolean))]
        const assistantNames = [...new Set(dayTours.map(t => {
          if (!t.assistant_id) return null
          const asst = teamMembers.find(m => m.email === t.assistant_id)
          return (asst?.nick_name || asst?.name_ko || t.assistant_id || '-').trim()
        }).filter(Boolean))] as string[]
        const driverNames = [...new Set(dayTours.map(t => {
          const carDriver = (t as { car_driver_name?: string | null }).car_driver_name
          if (carDriver && String(carDriver).trim()) return String(carDriver).trim()
          const tt = (t.team_type || '').toString().toLowerCase()
          if ((tt === 'guide+driver' || tt === 'guide + driver') && t.assistant_id) {
            const asst = teamMembers.find(m => m.email === t.assistant_id)
            return (asst?.nick_name || asst?.name_ko || t.assistant_id || '-').trim()
          }
          return null
        }).filter(Boolean))] as string[]
        const productColorClass = dayTours.length > 0 && dayTours[0].product_id
          ? (productColors[dayTours[0].product_id] || defaultPresetIds[0])
          : defaultPresetIds[0]
        result[id].daily[dateString] = { count: dayTours.length, guideNames, assistantNames, driverNames, productColorClass }
        if (dayTours.length > 0) {
          result[id].hasAnyDayAssignment = true
        }
        if (!isEdgePadding) {
          result[id].totalDays += dayTours.length
        }
      })
    })
    return result
  }, [monthVehiclesWithColors.vehicleList, monthDays, tours, teamMembers, productColors, defaultPresetIds, tourCoversScheduleDate])

  const vehicleScheduleMonthKey = useMemo(
    () =>
      `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
    [currentDate]
  )

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined'
        ? (localStorage.getItem('shared_schedule_vehicle_row_order') || localStorage.getItem('schedule_vehicle_row_order'))
        : null
      if (!raw) {
        setVehicleRowOrderForMonth(null)
        return
      }
      const all = JSON.parse(raw) as Record<string, string[]>
      setVehicleRowOrderForMonth(all[vehicleScheduleMonthKey] ?? null)
    } catch {
      setVehicleRowOrderForMonth(null)
    }
  }, [vehicleScheduleMonthKey])

  /** 회사차: 당월 배차가 있는 차량만. 렌터카: 당월과 렌트 기간이 겹치는 예약은 배차 없어도 표시. 저장된 행 순서 적용 */
  const orderedVehiclesForScheduleTable = useMemo(() => {
    type Veh = (typeof monthVehiclesWithColors.vehicleList)[number]
    const isRentalVehicle = (v: Veh) => (v.vehicle_category || '').toString().toLowerCase() === 'rental'
    const assigned = monthVehiclesWithColors.vehicleList.filter((v) => {
      if (isRentalVehicle(v)) return true
      return vehicleScheduleData[v.id]?.hasAnyDayAssignment === true
    })
    const assignedIds = assigned.map((v) => v.id)
    if (assignedIds.length === 0) return [] as Veh[]

    const baseOrder = vehicleRowOrderForMonth ?? assignedIds
    const validOrder = baseOrder.filter((id) => assignedIds.includes(id))
    const missing = assigned.filter((v) => !validOrder.includes(v.id))
    const finalIds = [...validOrder, ...missing.map((v) => v.id)]
    return finalIds
      .map((id) => assigned.find((v) => v.id === id))
      .filter((v): v is Veh => v != null)
  }, [monthVehiclesWithColors.vehicleList, vehicleScheduleData, vehicleRowOrderForMonth])

  const handleVehicleRowDragStart = useCallback((e: React.DragEvent, vehicleId: string) => {
    setDraggedVehicleRowId(vehicleId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/vehicle-row', vehicleId)
    const target = e.currentTarget as HTMLElement
    if (target) {
      e.dataTransfer.setDragImage(target, 12, 12)
    }
  }, [])

  const handleVehicleRowDragOver = useCallback(
    (e: React.DragEvent, vehicleId: string) => {
      e.preventDefault()
      if (draggedVehicleRowId && draggedVehicleRowId !== vehicleId) {
        e.dataTransfer.dropEffect = 'move'
        const tr = (e.currentTarget as HTMLElement).closest('tr')
        if (tr) applyScheduleDragHighlight(tr, SCHEDULE_ROW_REORDER_HIGHLIGHT)
      }
    },
    [draggedVehicleRowId, applyScheduleDragHighlight]
  )

  const moveVehicleRow = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0) return
      const ids = orderedVehiclesForScheduleTable.map((v) => v.id)
      if (from >= ids.length || to >= ids.length) return
      const sourceId = ids[from]
      if (!sourceId) return
      const next = [...ids]
      next.splice(from, 1)
      next.splice(to, 0, sourceId)
      setVehicleRowOrderForMonth(next)
      try {
        const raw = localStorage.getItem('schedule_vehicle_row_order')
        const all: Record<string, string[]> = raw ? JSON.parse(raw) : {}
        all[vehicleScheduleMonthKey] = next
        localStorage.setItem('schedule_vehicle_row_order', JSON.stringify(all))
        if (isSuperAdmin) {
          localStorage.setItem('shared_schedule_vehicle_row_order', JSON.stringify(all))
          void saveSharedSetting('schedule_vehicle_row_order', all)
        }
      } catch {
        /* ignore */
      }
    },
    [orderedVehiclesForScheduleTable, vehicleScheduleMonthKey, isSuperAdmin]
  )

  const handleVehicleRowDrop = useCallback(
    (e: React.DragEvent, targetVehicleId: string) => {
      e.preventDefault()
      clearScheduleDragHighlight()
      const sourceId = e.dataTransfer.getData('text/vehicle-row')
      if (!sourceId || sourceId === targetVehicleId) {
        setDraggedVehicleRowId(null)
        return
      }
      const ids = orderedVehiclesForScheduleTable.map((v) => v.id)
      const from = ids.indexOf(sourceId)
      const to = ids.indexOf(targetVehicleId)
      if (from === -1 || to === -1) {
        setDraggedVehicleRowId(null)
        return
      }
      moveVehicleRow(from, to)
      setDraggedVehicleRowId(null)
    },
    [orderedVehiclesForScheduleTable, clearScheduleDragHighlight, moveVehicleRow]
  )

  const handleVehicleRowDragEnd = useCallback(() => {
    setDraggedVehicleRowId(null)
    clearScheduleDragHighlight()
  }, [clearScheduleDragHighlight])

  // 날짜별 차량 배차 합계 (차량 스케줄 테이블 일별 합계 행용)
  const vehicleDailyTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    monthDays.forEach(({ dateString }) => {
      totals[dateString] = Object.keys(vehicleScheduleData).reduce(
        (sum, vehicleId) => sum + (vehicleScheduleData[vehicleId]?.daily[dateString]?.count ?? 0),
        0
      )
    })
    return totals
  }, [vehicleScheduleData, monthDays])

  // 날짜별 투어 갯수 (일별 합계에서 차량 합계와 비교용) - confirmed 만, 멀티데이는 매 진행일마다 1건씩
  const tourCountPerDate = useMemo(() => {
    const counts: Record<string, number> = {}
    monthDays.forEach(({ dateString }) => {
      counts[dateString] = tours.filter(
        (t) =>
          (t.tour_status || '').toString().toLowerCase() === 'confirmed' &&
          tourCoversScheduleDate(t, dateString)
      ).length
    })
    return counts
  }, [tours, monthDays, tourCoversScheduleDate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md border p-2">
      {/* 헤더 */}
      <div className="mb-2">
        {/* 첫 번째 줄: 좌 아이콘 | 가운데 월·오늘 | 우 저장·취소 */}
        <div className="relative flex flex-wrap items-center gap-y-2 min-h-10 sm:min-h-11 mb-2">
          {/* 왼쪽: 선택 버튼들 */}
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            <div className="flex gap-2">
              {/* 상품 선택 버튼 */}
              <button
                onClick={() => setShowProductModal(true)}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors relative"
                title={`상품 선택 (${selectedProducts.length}개)`}
              >
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                {selectedProducts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                    {selectedProducts.length}
                  </span>
                )}
              </button>

              {/* 팀원 선택 버튼 */}
              <button
                onClick={() => {
                  setShareTeamMembersSetting(false)
                  setShowTeamModal(true)
                }}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors relative"
                title={`팀원 선택 (${selectedTeamMembers.length}개)`}
              >
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                {selectedTeamMembers.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                    {selectedTeamMembers.length}
                  </span>
                )}
              </button>

              {/* 일괄 오프 스케줄 버튼 */}
              <button
                onClick={() => {
                  const monthStart = dayjs(currentDate).startOf('month').format('YYYY-MM-DD')
                  setBatchOffPeriods([{ id: crypto.randomUUID(), startDate: monthStart, endDate: monthStart }])
                  setShowBatchOffModal(true)
                }}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                title="일괄 오프 스케줄 추가"
              >
                <CalendarOff className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {isSuperAdmin ? (
                <button
                  type="button"
                  onClick={openRentalVehicleAddFromSchedule}
                  className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  title={locale === 'ko' ? '렌터카 추가' : 'Add rent a car'}
                  aria-label={locale === 'ko' ? '렌터카 추가' : 'Add rent a car'}
                >
                  <Car className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
                  <Plus className="absolute right-1 top-1 h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          {/* 가운데: 모바일은 한 줄 전체(겹침 방지), sm+ 는 절대배치로 화면 중앙 */}
          <div className="order-last flex w-full basis-full justify-center px-2 sm:pointer-events-none sm:absolute sm:inset-0 sm:order-none sm:w-auto sm:basis-auto sm:items-center sm:justify-center sm:px-24 md:px-32">
            <div className="flex items-center gap-1 sm:gap-2 sm:pointer-events-auto">
              <div className="flex items-center space-x-1 sm:space-x-4">
                <button
                  type="button"
                  onClick={goToPreviousMonth}
                  className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <h3 className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">
                  {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                </h3>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={goToToday}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap text-xs sm:text-sm"
              >
                오늘
              </button>
            </div>
          </div>

          {/* 오른쪽: 스케줄링 모드 토글 · 저장/취소 */}
          <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <label
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] sm:text-xs whitespace-nowrap select-none ${
                scheduleExplorationMode
                  ? 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100/90'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
              title="켜면 드래그 배정·배차 후 저장 확인 모달이 나오지 않고, 다른 페이지로 이동할 때 저장 또는 변경 취소를 선택할 수 있습니다."
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 shrink-0 rounded border-gray-400 text-amber-600 focus:ring-amber-500"
                checked={scheduleExplorationMode}
                onChange={(e) => setScheduleExplorationMode(e.target.checked)}
              />
              <span>스케줄링</span>
            </label>
            <button
              type="button"
              onClick={() => {
                void executeBatchSave()
              }}
              disabled={pendingCount === 0}
              className={`px-2 py-1 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap ${pendingCount === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                void discardPendingScheduleChanges()
              }}
              disabled={pendingCount === 0}
              className={`px-2 py-1 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap ${pendingCount === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-600 text-white hover:bg-gray-700'}`}
            >
              취소
            </button>
          </div>
        </div>

        {scheduleExplorationMode && (
          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            스케줄링 모드입니다. 드래그로 배정한 뒤 곧바로 저장을 묻지 않습니다. 상단 저장/취소로 언제든 반영하거나 되돌릴 수 있고, 왼쪽 메뉴 등으로 이 페이지를 벗어날 때 저장·저장 안 함·머무르기를 고를 수 있습니다.
          </div>
        )}

        {/* 두 번째 줄: 임시저장·복원 등 (저장/취소는 상단 월 행 오른쪽) */}
        {((hasDraft && pendingCount === 0) || pendingCount > 0) && (
        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2 mb-2">
          {/* 로컬 임시 저장 복원 알림 */}
          {hasDraft && pendingCount === 0 && (
            <div className="flex items-center gap-1">
              <span className="px-2 py-1 text-[10px] bg-purple-100 text-purple-800 rounded-full">
                임시 저장 {draftInfo?.count}건 ({draftInfo?.month})
              </span>
              <button
                onClick={() => {
                  loadDraftFromLocal()
                  setHasDraft(false)
                  setDraftInfo(null)
                  showMessage('복원 완료', '임시 저장된 변경사항을 불러왔습니다.', 'success')
                }}
                className="px-2 py-1 text-[10px] bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                복원
              </button>
              <button
                onClick={() => {
                  clearDraftFromLocal()
                  setHasDraft(false)
                  setDraftInfo(null)
                }}
                className="px-2 py-1 text-[10px] bg-gray-400 text-white rounded-lg hover:bg-gray-500"
              >
                삭제
              </button>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-full">
                변경 {pendingCount}건 대기중
              </span>
              <button
                onClick={saveDraftToLocal}
                className="px-2 py-1 text-[10px] bg-purple-500 text-white rounded-lg hover:bg-purple-600 whitespace-nowrap"
                title="변경사항을 로컬에 임시 저장"
              >
                임시저장
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* 통합 스케줄 테이블 컨테이너 */}
      <div className="mb-4">
        {/* 드래그 가능한 스크롤 컨테이너 */}
        <div 
          className="relative overflow-x-visible overflow-y-visible border-2 border-dashed border-gray-300 rounded-lg p-2 bg-gray-50"
          id="unified-schedule-scroll"
        >
          <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center justify-between gap-2 leading-tight">
            <div className="flex items-center">
              <MapPin className="w-4 h-4 mr-1 text-blue-500" />
              스케쥴뷰
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded-full" title="한국어">
                <ReactCountryFlag countryCode="KR" svg style={{ width: '22px', height: '16px' }} />
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-100 border border-red-300 rounded-full" title="영어">
                <ReactCountryFlag countryCode="US" svg style={{ width: '22px', height: '16px' }} />
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-100 border border-orange-300 rounded-full" title="한국어 & 영어">
                <ReactCountryFlag countryCode="KR" svg style={{ width: '22px', height: '16px' }} />
                <span className="text-[10px] text-orange-400">&</span>
                <ReactCountryFlag countryCode="US" svg style={{ width: '22px', height: '16px' }} />
              </div>
            </div>
          </h3>
          {/* 날짜 행: 페이지 세로 스크롤에 붙는 sticky는 이 래퍼에 적용 (내부는 가로 스크롤만) */}
          <div
            ref={productScheduleHeaderScrollRef}
            onScroll={onProductScheduleHeaderScroll}
            className="sticky z-[1010] scrollbar-hide min-w-0 overflow-x-auto overflow-y-visible bg-blue-50"
            style={{
              top: productScheduleStickyTopPx,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table className="w-full border-separate border-spacing-0" style={{ tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px` }}>
              <thead className="bg-blue-50">
                <tr className="align-top">
                  <th
                    className="px-2 py-0.5 text-left text-xs font-medium text-gray-700 align-top sticky left-0 z-[1011] bg-blue-50 border-b border-r border-gray-300 shadow-[1px_0_0_0_rgb(209,213,219)]"
                    style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }}
                  >
                    상품명
                  </th>
                  {monthDays.map(({ date, dayOfWeek, dateString, isEdgePadding }) => {
                    const hasNote = dateNotes[dateString]?.note
                    return (
                      <th
                        key={dateString}
                        className={`p-0 text-center text-xs font-medium text-gray-700 align-top bg-blue-50 border-b border-gray-200 ${isEdgePadding ? 'bg-slate-100/90' : ''}`}
                        style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                      >
                      <div 
                        className={`
                          px-1 py-0.5 cursor-pointer transition-colors relative
                          ${isToday(dateString) 
                            ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                            : hasNote 
                              ? 'bg-yellow-50 border-2 border-yellow-400 rounded' 
                              : ''
                          }
                          ${hasNote && !isToday(dateString) ? 'hover:bg-yellow-100' : 'hover:bg-blue-100'}
                        `}
                        onClick={() => openDateNoteModal(dateString)}
                        onMouseEnter={() => {
                          if (scheduleInteractionDragging) return
                          setHoveredDate(dateString)
                        }}
                        onMouseLeave={() => {
                          if (scheduleInteractionDragging) return
                          setHoveredDate(null)
                        }}
                        title={hasNote ? dateNotes[dateString].note : '클릭하여 날짜 노트 작성'}
                      >
                        <div className={`flex items-center justify-center ${isToday(dateString) ? 'font-bold text-red-700' : hasNote ? 'font-semibold text-yellow-800' : isEdgePadding ? 'text-slate-700' : ''}`}>
                          <span>{isEdgePadding ? dayjs(dateString).format('M/D') : `${date}일`}</span>
                        </div>
                        <div className={`text-xs flex items-center justify-center gap-1 ${isToday(dateString) ? 'text-red-600' : hasNote ? 'text-yellow-700 font-medium' : 'text-gray-500'}`}>
                          {dayOfWeek}
                          {hasNote && (
                            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                          )}
                        </div>
                        {/* 마우스 오버 시 노트 표시 */}
                        {hoveredDate === dateString && hasNote && (
                          <div className="absolute z-50 top-full left-1/2 transform -translate-x-1/2 mt-1 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none">
                            <div className="font-semibold mb-1">{dateString}</div>
                            <div className="whitespace-pre-wrap break-words">{dateNotes[dateString].note}</div>
                            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                          </div>
                        )}
                      </div>
                    </th>
                  )
                })}
                <th className="px-2 py-0.5 text-center text-xs font-medium text-gray-700 align-top bg-blue-50 border-b border-gray-200" style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>
                  합계
                </th>
              </tr>
            </thead>
            </table>
          </div>
          <div
            ref={productScheduleBodyScrollRef}
            onScroll={onProductScheduleBodyScroll}
            className="scrollbar-hide min-w-0 overflow-x-auto overflow-y-visible"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table className="w-full border-separate border-spacing-0" style={{ tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px` }}>
            <tbody className="divide-y divide-gray-200">
              {/* 각 상품별 데이터 */}
              {Object.entries(productScheduleData).map(([productId, product], index) => {
                const colorValue = productColors[productId] || defaultPresetIds[index % defaultPresetIds.length]
                const displayProps = getProductDisplayProps(colorValue)
                const selectedIndex = selectedProducts.indexOf(productId)
                const canMoveUp = selectedIndex > 0
                const canMoveDown = selectedIndex >= 0 && selectedIndex < selectedProducts.length - 1
                
                return (
                  <tr 
                    key={productId} 
                    className={`hover:bg-gray-50 transition-colors ${
                      draggedProductRow === productId ? 'opacity-50 bg-blue-50' : ''
                    }`}
                    onDragOver={(e) => handleProductRowDragOver(e, productId)}
                    onDragLeave={handleProductRowDragLeave}
                    onDrop={(e) => handleProductRowDrop(e, productId)}
                  >
                    <td 
                      className={`px-2 py-0.5 text-xs font-medium cursor-grab active:cursor-grabbing select-none border border-gray-300 sticky left-0 z-40 shadow-[1px_0_0_0_rgb(209,213,219)] ${displayProps.className ?? ''}`.trim()}
                      style={{ width: '96px', minWidth: '96px', maxWidth: '96px', ...displayProps.style }}
                      draggable
                      onDragStart={(e) => handleProductRowDragStart(e, productId)}
                      onDragEnd={handleProductRowDragEnd}
                    >
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col items-center -my-0.5">
                          <button
                            type="button"
                            draggable={false}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canMoveUp) void moveProduct(selectedIndex, selectedIndex - 1)
                            }}
                            disabled={!canMoveUp}
                            className="text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="위로 이동"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            draggable={false}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canMoveDown) void moveProduct(selectedIndex, selectedIndex + 1)
                            }}
                            disabled={!canMoveDown}
                            className="text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="아래로 이동"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                        {product.product_name}
                      </div>
                    </td>
                    {monthDays.map(({ dateString }) => {
                      const dayData = product.dailyData[dateString]
                      return (
                        <td 
                          key={dateString} 
                          className="p-0 text-center text-xs overflow-visible"
                          style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                        >
                          {(() => {
                            const langBgClass = dayData ? (() => {
                              const koAll = (dayData.koPeople || 0) + (dayData.koWaitingPeople || 0)
                              const enAll = (dayData.enPeople || 0) + (dayData.enWaitingPeople || 0)
                              if (koAll > 0 && enAll > 0) return 'bg-orange-100'
                              if (koAll > 0) return 'bg-yellow-100'
                              if (enAll > 0) return 'bg-red-100'
                              return 'bg-white'
                            })() : 'bg-white'
                            const todayWrapClass = isToday(dateString)
                              ? `${langBgClass} border-l-2 border-r-2 border-red-500`
                              : langBgClass
                            const displayOrder = ['X', 'L', 'U', '_other']
                            const keyToLabel: Record<string, string> = { X: 'X', L: 'L', U: 'U', _other: '기타' }
                            const choiceLine = dayData?.choiceCounts && Object.keys(dayData.choiceCounts).length > 0
                              ? (() => {
                                  const sortedEntries = Object.entries(dayData.choiceCounts)
                                    .filter(([, n]) => n > 0)
                                    .sort(([a], [b]) => displayOrder.indexOf(a) - displayOrder.indexOf(b))
                                  return sortedEntries
                                    .map(([key, count]) => `🏜️ ${keyToLabel[key] || key} : ${count}`)
                                    .join(' / ')
                                })()
                              : null
                            /** 항상 셀 아래에 표시 — 위쪽(bottom-full)은 sticky 날짜 헤더에 가려짐 */
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                className={`group ${todayWrapClass} px-1 py-0.5 relative overflow-visible cursor-pointer`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openProductCellReservationsModal(productId, dateString, product.product_name)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    openProductCellReservationsModal(productId, dateString, product.product_name)
                                  }
                                }}
                              >
                                {dayData ? (
                                  <div
                                    className={(() => {
                                      const br = dayData.tourCapacityBreakdown
                                      const isCapacityOverfull =
                                        br != null && br.totalAssigned > br.totalMax
                                      const confirmed = dayData.totalPeople
                                      const waiting = dayData.waitingPeople ?? 0
                                      const onlyWaiting = confirmed === 0 && waiting > 0
                                      const ap = dayData.assignmentPendingReservationCount ?? 0
                                      const assignedSum = br?.totalAssigned ?? 0
                                      const hasAssignmentPeopleGap =
                                        (confirmed ?? 0) > assignedSum && (confirmed ?? 0) > 0
                                      if (isCapacityOverfull) {
                                        return `font-bold leading-tight whitespace-nowrap ${
                                          isToday(dateString) ? 'text-red-700' : 'text-red-600'
                                        }`
                                      }
                                      if (ap > 0 || hasAssignmentPeopleGap) {
                                        return `font-bold leading-tight whitespace-nowrap ${
                                          isToday(dateString) ? 'text-red-700' : 'text-red-600'
                                        }`
                                      }
                                      if (onlyWaiting) {
                                        return `font-medium leading-tight whitespace-nowrap ${
                                          isToday(dateString) ? 'text-blue-700' : 'text-blue-600'
                                        }`
                                      }
                                      if (confirmed === 0) {
                                        return 'font-medium leading-tight whitespace-nowrap text-gray-300'
                                      }
                                      if (confirmed < 4) {
                                        return `font-medium leading-tight whitespace-nowrap ${
                                          isToday(dateString) ? 'text-blue-700' : 'text-blue-600'
                                        }`
                                      }
                                      return 'font-medium leading-tight whitespace-nowrap text-gray-900'
                                    })()}
                                  >
                                    {(() => {
                                      const ap = dayData.assignmentPendingReservationCount ?? 0
                                      const canceledP = dayData.canceledPeople ?? 0
                                      const core = formatProductScheduleCellPeopleWithPrivateSplit(
                                        dayData.privateTourPeople ?? 0,
                                        dayData.companionTourPeople ?? 0,
                                        dayData.waitingPeople ?? 0,
                                        0
                                      )
                                      return (
                                        <>
                                          {core}
                                          {ap > 0 && (
                                            <span className="font-bold text-red-600 tabular-nums">({ap})</span>
                                          )}
                                          {canceledP > 0 ? (
                                            <span className="tabular-nums">{` (${canceledP})`}</span>
                                          ) : null}
                                        </>
                                      )
                                    })()}
                                  </div>
                                ) : (
                                  <div className="text-gray-300">-</div>
                                )}
                                {dayData && (
                                  <div
                                    className="absolute z-[1020] left-1/2 -translate-x-1/2 top-full mt-1 min-w-[260px] w-max max-w-[min(90vw,420px)] px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none overflow-visible text-left opacity-0 transition-none group-hover:opacity-100 group-focus-within:opacity-100"
                                  >
                                    <div className="flex items-center gap-2 mb-1.5 flex-nowrap">
                                      <span className="inline-flex items-center gap-1 shrink-0">
                                        <ReactCountryFlag countryCode="KR" svg style={{ width: '1em', height: '0.75em' }} />
                                        <span>{(dayData.koPeople || 0) + (dayData.koWaitingPeople || 0)}</span>
                                      </span>
                                      <span className="text-gray-400 shrink-0">/</span>
                                      <span className="inline-flex items-center gap-1 shrink-0">
                                        <ReactCountryFlag countryCode="US" svg style={{ width: '1em', height: '0.75em' }} />
                                        <span>{(dayData.enPeople || 0) + (dayData.enWaitingPeople || 0)}</span>
                                      </span>
                                    </div>
                                    {choiceLine && (
                                      <div className="whitespace-nowrap break-keep leading-tight">
                                        {choiceLine}
                                      </div>
                                    )}
                                    {dayData.tourCapacityBreakdown && dayData.tourCapacityBreakdown.rows.length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-gray-600 space-y-1.5">
                                        {dayData.tourCapacityBreakdown.rows.map((row) => (
                                          <div key={row.tourId} className="space-y-0.5">
                                            <div className="text-[11px] text-gray-200 leading-snug">
                                              {tTourCal('scheduleCellCapacityTeam', {
                                                n: row.teamIndex,
                                                guide: row.guideName,
                                                assistant: row.assistantName
                                              })}
                                            </div>
                                            <div className="text-[11px] text-gray-100 font-medium tabular-nums">
                                              {tTourCal('scheduleCellCapacityPerTour', {
                                                assigned: row.assigned,
                                                max: row.max,
                                                spots: row.spotsLeft
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                        <div className="text-[11px] text-amber-200 font-semibold pt-0.5 tabular-nums border-t border-gray-700 mt-1.5">
                                          {tTourCal('scheduleCellCapacityTotal', {
                                            assigned: dayData.tourCapacityBreakdown.totalAssigned,
                                            max: dayData.tourCapacityBreakdown.totalMax,
                                            spots: dayData.tourCapacityBreakdown.totalSpotsLeft
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                      )
                    })}
                <td className="px-2 py-0.5 text-center text-xs font-medium bg-white" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  <div className={(() => {
                    const rowWaiting = monthDaysCore.reduce(
                      (s, d) => s + (product.dailyData[d.dateString]?.waitingPeople ?? 0),
                      0
                    )
                    const rowOverflow = monthDaysCore.some((d) => {
                      const br = product.dailyData[d.dateString]?.tourCapacityBreakdown
                      return br != null && br.totalAssigned > br.totalMax
                    })
                    const onlyWaitingTotal = product.totalPeople === 0 && rowWaiting > 0
                    if (rowOverflow) return 'font-bold text-red-600'
                    if (onlyWaitingTotal) return 'font-medium text-blue-600'
                    return `font-medium ${
                      product.totalPeople === 0
                        ? 'text-gray-300'
                        : product.totalPeople < 4
                          ? 'text-blue-600'
                          : 'text-gray-900'
                    }`
                  })()}>{product.totalPeople}</div>
                </td>
                  </tr>
                )
              })}

              {/* 상품별 총계 행 - 가장 아래로 이동 */}
              <tr className="bg-blue-100 font-semibold">
                <td className="px-2 py-0.5 text-xs text-gray-900 sticky left-0 z-40 bg-blue-100 border-r border-gray-300 shadow-[1px_0_0_0_rgb(209,213,219)]" style={{width: '96px', minWidth: '96px', maxWidth: '96px'}}>
                  일별 합계
                </td>
                {monthDays.map(({ dateString }) => {
                  const dayTotal = productTotals[dateString]
                  const dayColOverflow = Object.values(productScheduleData).some((p) => {
                    const br = p.dailyData[dateString]?.tourCapacityBreakdown
                    return br != null && br.totalAssigned > br.totalMax
                  })
                  return (
                    <td 
                      key={dateString} 
                      className="p-0 text-center text-xs"
                      style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                    >
                      <div className={`${isToday(dateString) ? 'border-2 border-red-500 bg-red-50' : ''} px-1 py-0.5`}>
                        <div className={(() => {
                          const confirmed = dayTotal.totalPeople
                          const waiting = dayTotal.waitingPeople ?? 0
                          const onlyWaiting = confirmed === 0 && waiting > 0
                          if (dayColOverflow) {
                            return `font-bold ${isToday(dateString) ? 'text-red-700' : 'text-red-600'}`
                          }
                          if (onlyWaiting) {
                            return `font-medium ${isToday(dateString) ? 'text-blue-700' : 'text-blue-600'}`
                          }
                          return `font-medium ${
                            confirmed === 0
                              ? 'text-gray-300'
                              : confirmed < 4
                                ? 'text-blue-600'
                                : 'text-gray-900'
                          }`
                        })()}>{dayTotal.totalPeople}</div>
                      </div>
                    </td>
                  )
                })}
                <td className="px-2 py-0.5 text-center text-xs font-medium" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  <div>{Object.values(productScheduleData).reduce((sum, product) => sum + product.totalPeople, 0)}</div>
                </td>
              </tr>
            </tbody>
          </table>
          {/* 가이드별 스케줄 테이블 */}
          <div>
            <div className="overflow-visible">
          <table className="w-full" style={{tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px`}}>
            <thead className="bg-green-50 hidden">
              <tr>
                <th className="px-2 py-0.5 text-left text-xs font-medium text-gray-700" style={{width: '96px', minWidth: '96px', maxWidth: '96px'}}>
                  가이드명
                </th>
                {monthDays.map(({ date, dayOfWeek, dateString, isEdgePadding }) => (
                  <th 
                    key={dateString} 
                    className="p-0 text-center text-xs font-medium text-gray-700"
                    style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                  >
                    <div className={`${isToday(dateString) ? 'border-l-2 border-r-2 border-red-500 bg-red-50' : ''} ${isEdgePadding ? 'bg-slate-100/80' : ''} px-1 py-0.5`}>
                      <div className={isToday(dateString) ? 'font-bold text-red-700' : isEdgePadding ? 'text-slate-700' : ''}>
                        {isEdgePadding ? dayjs(dateString).format('M/D') : `${date}일`}
                      </div>
                      <div className={`text-xs ${isToday(dateString) ? 'text-red-600' : 'text-gray-500'}`}>{dayOfWeek}</div>
                    </div>
                  </th>
                ))}
                <th className="px-2 py-0.5 text-center text-xs font-medium text-gray-700" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  합계
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* 가이드별 총계 행 */}
              <tr className="bg-green-100 font-semibold">
                <td className="px-1 py-0 text-xs text-gray-900" style={{width: '96px', minWidth: '96px', maxWidth: '96px'}}>
                  일별 합계
                </td>
                {monthDays.map(({ dateString }) => {
                  const dayTotal = guideTotals[dateString]
                  return (
                    <td 
                      key={dateString} 
                      className={`px-0 py-0 text-center text-xs ${
                        isToday(dateString) 
                          ? 'border-2 border-red-500 bg-red-50' 
                          : ''
                      }`}
                      style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                    >
                      <div className={`font-medium ${
                        dayTotal.assignedPeople === 0 
                          ? 'text-gray-300' 
                          : dayTotal.assignedPeople < 4 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                      } ${isToday(dateString) ? 'text-red-700' : ''}`}>{dayTotal.assignedPeople}</div>
                    </td>
                  )
                })}
                <td className="px-1 py-0 text-center text-xs font-medium" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  <div>{Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalAssignedPeople, 0)} ({Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalTours, 0)}일)</div>
                </td>
              </tr>

              {/* 각 가이드별 데이터 */}
              {Object.entries(guideScheduleData).map(([teamMemberId, guide]) => {
                const selectedIndex = selectedTeamMembers.indexOf(teamMemberId)
                const canMoveUp = selectedIndex > 0
                const canMoveDown = selectedIndex >= 0 && selectedIndex < selectedTeamMembers.length - 1
                // 멀티데이 투어 정보를 미리 계산
                const multiDayTours: { [dateString: string]: { startDate: string; endDate: string; days: number; extendsToNextMonth: boolean; dayData: DailyData } } = {}
                
                monthDays.forEach(({ dateString }) => {
                  const dayData = guide.dailyData[dateString]
                  if (dayData?.isMultiDay && dayData.multiDayDays >= 1) {
                    const start = dayjs(dateString)
                    const end = start.add(dayData.multiDayDays - 1, 'day')
                    const extendsToNextMonth = end.isAfter(scheduleGridLastDay, 'day')
                    
                    multiDayTours[dateString] = {
                      startDate: dateString,
                      endDate: end.format('YYYY-MM-DD'),
                      days: dayData.multiDayDays,
                      extendsToNextMonth,
                      dayData
                    }
                  }
                })

                // 이전 달 말일에 시작하여 이번 달로 이어지는 멀티데이 투어 포함 (최대 3박4일 → 3일 이전까지 조회)
                const windowStart = dayjs(firstDayOfMonth).subtract(3, 'day')
                tours.filter(t => t.tour_guide_id === teamMemberId || t.assistant_id === teamMemberId).forEach(tour => {
                  const mdays = getMultiDayTourDays(tour.product_id)
                  if (mdays <= 1) return
                  // tour_date를 그대로 사용 (변환하지 않음)
                  const start = dayjs(tour.tour_date)
                  if (start.isBefore(firstDayOfMonth, 'day') && !start.isBefore(windowStart, 'day')) {
                    const end = start.add(mdays - 1, 'day')
                    // 이번 달에 걸쳐 있는 경우만 추가
                    if (!end.isBefore(firstDayOfMonth, 'day')) {
                      // 역할/인원/색상 계산 (Recruiting/Confirmed 상태만)
                      const dayReservations = reservations.filter(res => 
                        res.tour_date === tour.tour_date &&
                        (res.status?.toLowerCase() === 'confirmed' || res.status?.toLowerCase() === 'recruiting')
                      )
                      const assignedPeople = (() => {
                        if (!tour.reservation_ids || !Array.isArray(tour.reservation_ids)) return 0
                        const assigned = dayReservations.filter(res => tour.reservation_ids.includes(res.id))
                        return assigned.reduce((s, r) => s + (r.total_people || 0), 0)
                      })()
                      const role = tour.tour_guide_id === teamMemberId ? 'guide' : tour.assistant_id === teamMemberId ? 'assistant' : null
                      let guideInitials = null as string | null
                      if (role === 'assistant' && tour.tour_guide_id) {
                        const guideInfo = teamMembers.find(member => member.email === tour.tour_guide_id)
                        if (guideInfo) {
                          const gInfoName = (guideInfo as any).nick_name || guideInfo.name_ko
                          guideInitials = gInfoName.split('').map((ch: string) => ch.charAt(0)).join('').substring(0, 2)
                        }
                      }
                      const extendsToNextMonth = end.isAfter(scheduleGridLastDay, 'day')
                      const startKey = start.format('YYYY-MM-DD')
                      if (!multiDayTours[startKey]) {
                        multiDayTours[startKey] = {
                          startDate: startKey,
                          endDate: end.format('YYYY-MM-DD'),
                          days: mdays,
                          extendsToNextMonth,
                          dayData: {
                            totalPeople: 0,
                            assignedPeople,
                            tours: 1,
                            productColors: { [tour.product_id]: productColors[tour.product_id] || defaultPresetIds[0] },
                            role,
                            guideInitials,
                            isMultiDay: true,
                            multiDayDays: mdays
                          }
                        }
                        
                        // 이전 달에서 시작한 멀티데이 투어의 경우 이번 달에 해당하는 일수만큼 합계에 추가
                        const daysInCurrentMonth = Math.min(
                          mdays,
                          dayjs(currentDate).endOf('month').diff(firstDayOfMonth, 'day') + 1
                        )
                        if (daysInCurrentMonth > 0) {
                        // 이전 달에서 시작한 투어는 totalPeople이 0이므로 assignedPeople만 계산
                        // totalAssignedPeople += assignedPeople * daysInCurrentMonth
                        // totalTours += daysInCurrentMonth
                        }
                      }
                    }
                  }
                })
                
                return (
                  <tr 
                    key={teamMemberId} 
                    className={`hover:bg-gray-50 transition-colors ${
                      draggedGuideRow === teamMemberId ? 'opacity-50 bg-blue-50' : ''
                    }`}
                    onDragOver={(e) => handleGuideRowDragOver(e, teamMemberId)}
                    onDragLeave={handleGuideRowDragLeave}
                    onDrop={(e) => handleGuideRowDrop(e, teamMemberId)}
                    onMouseEnter={() => {
                      if (scheduleInteractionDragging) return
                      setHoveredGuideRow(teamMemberId)
                    }}
                    onMouseLeave={() => {
                      if (scheduleInteractionDragging) return
                      setHoveredGuideRow(null)
                    }}
                  >
                    <td 
                      className="px-1 py-0 text-xs leading-tight cursor-grab active:cursor-grabbing select-none" 
                      style={{width: '96px', minWidth: '96px', maxWidth: '96px'}}
                      draggable
                      onDragStart={(e) => handleGuideRowDragStart(e, teamMemberId)}
                      onDragEnd={handleGuideRowDragEnd}
                    >
                      <div className={`font-medium flex items-center gap-0.5 ${
                        hoveredGuideRow === teamMemberId 
                          ? 'text-blue-600 animate-pulse' 
                          : 'text-gray-900'
                      }`}>
                        <div className="flex flex-col items-center -my-0.5">
                          <button
                            type="button"
                            draggable={false}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canMoveUp) void moveTeamMember(selectedIndex, selectedIndex - 1)
                            }}
                            disabled={!canMoveUp}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="위로 이동"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            draggable={false}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canMoveDown) void moveTeamMember(selectedIndex, selectedIndex + 1)
                            }}
                            disabled={!canMoveDown}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="아래로 이동"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                        {guide.team_member_name}
                      </div>
                    </td>
                    <td className="p-0" colSpan={monthDays.length}>
                      <div className="relative">
                        <div className="grid" style={{gridTemplateColumns: `repeat(${monthDays.length}, minmax(40px, 1fr))`, width: '100%', minWidth: `calc(${monthDays.length} * 40px)`}}>
                          {monthDays.map(({ dateString }) => {
                          const dayData = guide.dailyData[dateString]
                          
                          // 멀티데이 투어의 연속된 날짜인지 확인하고 해당 투어 정보 가져오기
                          let continuationTour = null
                          for (const tour of Object.values(multiDayTours)) {
                            const tourStart = dayjs(tour.startDate)
                            const tourEnd = dayjs(tour.endDate)
                            const cur = dayjs(dateString)
                            if (cur.isAfter(tourStart, 'day') && (cur.isSame(tourEnd, 'day') || cur.isBefore(tourEnd, 'day'))) {
                              continuationTour = tour
                              break
                            }
                          }
                          
                          // 멀티데이 투어의 연속된 날짜인 경우: 셀 내용은 비워두고(드롭존만 유지), 상단 오버레이에서 하나의 박스로 표시
                          if (continuationTour && !dayData) {
                            const hasNote = dateNotes[dateString]?.note
                            return (
                              <div 
                                key={dateString} 
                                className={`px-1 py-0 text-center text-xs relative ${
                                  isToday(dateString) 
                                    ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                                    : hasNote
                                      ? 'bg-yellow-100'
                                      : 'bg-white'
                                }`}
                                style={{ minWidth: '40px', boxSizing: 'border-box' }}
                              >
                                <div
                                  className="relative h-[22px]"
                                  style={{ pointerEvents: 'auto' }}
                                  onDragOver={(e) => { 
                                    if (draggedTour && draggedTour.tour_date === dateString) {
                                      handleGuideScheduleDropZoneDragOver(e)
                                    } else if (draggedUnassignedTour) {
                                      handleGuideScheduleDropZoneDragOver(e)
                                    }
                                  }}
                                  onDragLeave={handleGuideScheduleDropZoneDragLeave}
                                onDrop={(e) => {
                                  try {
                                    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'))
                                    
                                    if (draggedUnassignedTour) {
                                      // 미 배정 투어 배정
                                      const role = dragData.role || 'guide'
                                      handleGuideCellDrop(e, teamMemberId, dateString, role)
                                    } else {
                                      // 기존 투어 재배정
                                      handleDrop(e, teamMemberId, dateString, 'guide')
                                    }
                                  } catch {
                                    if (draggedUnassignedTour) {
                                      handleGuideCellDrop(e, teamMemberId, dateString, 'guide')
                                    } else {
                                      handleDrop(e, teamMemberId, dateString, 'guide')
                                    }
                                  }
                                }}
                                >
                                  {/* Off 날짜 표시 */}
                                  {isOffDate(teamMemberId, dateString) && !(() => {
                                    const teamMember = teamMembers.find(member => member.email === teamMemberId)
                                    const key = `${teamMember?.email}_${dateString}`
                                    const pendingChange = pendingOffScheduleChanges[key]
                                    return pendingChange?.action === 'delete'
                                  })() ? (
                                    (() => {
                                      const teamMember = teamMembers.find(member => member.email === teamMemberId)
                                      const offSchedule = teamMember ? offSchedules.find(off => 
                                        off.team_email === teamMember.email && off.off_date === dateString
                                      ) : null
                                      
                                      return (
                                        <div 
                                          className={offScheduleAssignmentCellClass(offSchedule?.status)}
                                          onClick={() => {
                                            if (offSchedule) {
                                              openOffScheduleActionModal(offSchedule)
                                            }
                                          }}
                                          title={
                                            offSchedule
                                              ? `${offSchedule.reason || ''} (${offSchedule.status})`
                                              : guide.team_member_name
                                          }
                                          >
                                            OFF
                                          </div>
                                      )
                                    })()
                                  ) : (
                                    /* 이어지는 날짜는 오버레이에서 하나의 박스로 렌더링 */
                                    <div></div>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          
                          // 일반 셀 렌더링 (1일 투어 또는 멀티데이 투어 시작일)
                          const hasNote = dateNotes[dateString]?.note
                          return (
                            <div 
                              key={dateString} 
                              className={`px-1 py-0 text-center text-xs relative ${
                                isToday(dateString) 
                                  ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                                  : hasNote
                                    ? 'bg-yellow-100'
                                    : 'bg-white'
                              } ${highlightedDate === dateString ? 'bg-yellow-200' : ''}`}
                              style={{ minWidth: '40px', boxSizing: 'border-box' }}
                            >
                              <div
                                className="relative h-[22px]"
                                style={{ 
                                  pointerEvents: 'auto',
                                  overflow: 'visible',
                                  position: 'relative'
                                }}
                                onDragOver={(e) => { 
                                  if (draggedTour && draggedTour.tour_date === dateString) {
                                    handleGuideScheduleDropZoneDragOver(e)
                                  } else if (draggedUnassignedTour) {
                                    handleGuideScheduleDropZoneDragOver(e)
                                  }
                                }}
                                onDragLeave={handleGuideScheduleDropZoneDragLeave}
                                onDrop={(e) => {
                                  try {
                                    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'))
                                    
                                    if (draggedUnassignedTour) {
                                      // 미 배정 투어 배정
                                      const role = dragData.role || 'guide'
                                      handleGuideCellDrop(e, teamMemberId, dateString, role)
                                    } else {
                                      // 기존 투어 재배정
                                      handleDrop(e, teamMemberId, dateString, 'guide')
                                    }
                                  } catch {
                                    if (draggedUnassignedTour) {
                                      handleGuideCellDrop(e, teamMemberId, dateString, 'guide')
                                    } else {
                                      handleDrop(e, teamMemberId, dateString, 'guide')
                                    }
                                  }
                                }}
                              >
                                {dayData ? (
                                  <div className="relative h-full">
                                    {/* 상품별 배경색 표시 (텍스트 아래) - 멀티데이 시작일은 오버레이에서만 표시 */}
                                    {Object.keys(dayData.productColors).length > 0 && !dayData.isMultiDay && (
                                      <div className="absolute inset-0 pointer-events-none rounded" 
                                           style={{
                                             background: Object.values(dayData.productColors).length === 1 
                                               ? `linear-gradient(135deg, ${getColorFromClass(Object.values(dayData.productColors)[0])} 0%, ${getColorFromClass(Object.values(dayData.productColors)[0])} 100%)`
                                               : `linear-gradient(135deg, ${Object.values(dayData.productColors).map(color => getColorFromClass(color)).join(', ')})`
                                           }}>
                                      </div>
                                    )}
                                    
                                    {/* 가이드로 배정된 경우 - 인원 표시 */}
                                    {dayData.role === 'guide' && !dayData.isMultiDay && (() => {
                                      // 해당 날짜의 가이드 투어들 중 단독투어 여부 확인
                                      const guideTours = tours.filter(tour => 
                                        tour.tour_date === dateString && 
                                        tour.tour_guide_id === teamMemberId
                                      )
                                      const hasPrivateTour = guideTours.some(tour => 
                                        tour.is_private_tour === 'TRUE' || tour.is_private_tour === true
                                      )
                                      
                                      // 차량 배차 여부 및 배정된 차량 색상
                                      const hasUnassignedVehicle = guideTours.some(t => !t.tour_car_id || String(t.tour_car_id).trim().length === 0)
                                      const assignedCarId = guideTours.find(t => t.tour_car_id && String(t.tour_car_id).trim())?.tour_car_id
                                      const vehicleColorClass = assignedCarId ? monthVehiclesWithColors.vehicleIdToColor.get(String(assignedCarId).trim()) : null
                                      
                                      // 같은 날짜에 같은 product_id의 투어가 여러 팀(가이드)으로 나가는지 확인
                                      if (guideTours.length > 0 && guideTours[0].product_id && guideTours[0].id) {
                                        // 같은 날짜, 같은 product_id를 가진 모든 투어 확인
                                        const sameDateProductTours = tours.filter(t => 
                                          t.tour_date === dateString && 
                                          t.product_id === guideTours[0].product_id &&
                                          t.tour_guide_id // 가이드가 배정된 투어만
                                        )
                                        
                                        // 같은 product_id에서 여러 가이드(팀)가 있으면 테두리 색상 적용
                                        const uniqueGuides = new Set(sameDateProductTours.map(t => t.tour_guide_id).filter(Boolean))
                                        const hasMultipleTeams = uniqueGuides.size > 1
                                        
                                        const borderColor = hasMultipleTeams
                                          ? getTourBorderColor(
                                              guideTours[0].id,
                                              dateString,
                                              guideTours[0].product_id,
                                              teamMemberId
                                            )
                                          : ''
                                        
                                        return (
                                          <div 
                                            className={`absolute inset-0 flex items-center justify-center gap-1 text-white px-2 py-0 text-[10px] rounded z-10 cursor-pointer hover:opacity-80 transition-opacity ${
                                              dayData.assignedPeople === 0 
                                                ? 'bg-gray-400' 
                                                : 'bg-transparent'
                                            } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''} ${borderColor ? 'border-2 border-white' : ''}`}
                                            style={{
                                              backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                                ? getColorFromClass(Object.values(dayData.productColors)[0])
                                                : undefined,
                                              color: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                                ? getProductDisplayProps(Object.values(dayData.productColors)[0]).style?.color
                                                : undefined,
                                              boxShadow: borderColor ? `0 0 0 2px ${getBorderColorValue(borderColor)}` : undefined
                                            }}
                                            title={guideTours.length > 0 ? getGuideScheduleTourHoverText(guideTours[0]) : guide.team_member_name}
                                            draggable
                                            onDragStart={(e) => {
                                              if (guideTours.length > 0) {
                                                setDraggedRole('guide')
                                                handleDragStart(e, guideTours[0])
                                              }
                                            }}
                                            onDragEnd={handleAssignedTourDragEnd}
                                            onDoubleClick={() => {
                                              if (guideTours.length > 0) {
                                                openTourDetailModal(guideTours[0].id)
                                              }
                                            }}
                                            onClick={() => {
                                              if (guideTours.length > 0) {
                                                showGuideModalContent('투어 상세 정보', getTourSummary(guideTours[0]), guideTours[0].id)
                                              }
                                            }}
                                          >
                                            {hasUnassignedVehicle && (
                                              <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                                            )}
                                            {!hasUnassignedVehicle && vehicleColorClass && (
                                              <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full border border-white ${vehicleColorClass}`} />
                                            )}
                                            {hasPrivateTour && <span>🔒</span>}
                                            <span>{dayData.assignedPeople}</span>
                                            {dayData.extendsToNextMonth && (
                                              <span className="text-xs opacity-75">→</span>
                                            )}
                                          </div>
                                        )
                                      }
                                      
                                      // 기본 렌더링 (product_id가 없는 경우)
                                      return (
                                        <div 
                                          className={`absolute inset-0 flex items-center justify-center gap-1 text-white px-2 py-0 text-[10px] rounded z-10 cursor-pointer hover:opacity-80 transition-opacity ${
                                            dayData.assignedPeople === 0 
                                              ? 'bg-gray-400' 
                                              : 'bg-transparent'
                                          } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''}`}
                                          style={{
                                            backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                              ? getColorFromClass(Object.values(dayData.productColors)[0])
                                              : undefined,
                                            color: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                              ? getProductDisplayProps(Object.values(dayData.productColors)[0]).style?.color
                                              : undefined
                                          }}
                                          title={guideTours.length > 0 ? getGuideScheduleTourHoverText(guideTours[0]) : guide.team_member_name}
                                          draggable
                                          onDragStart={(e) => {
                                            if (guideTours.length > 0) {
                                              setDraggedRole('guide')
                                              handleDragStart(e, guideTours[0])
                                            }
                                          }}
                                          onDragEnd={handleAssignedTourDragEnd}
                                          onDoubleClick={() => {
                                            if (guideTours.length > 0) {
                                              openTourDetailModal(guideTours[0].id)
                                            }
                                          }}
                                          onClick={() => {
                                            if (guideTours.length > 0) {
                                              showGuideModalContent('투어 상세 정보', getTourSummary(guideTours[0]), guideTours[0].id)
                                            }
                                          }}
                                        >
                                          {hasUnassignedVehicle && (
                                            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                                          )}
                                          {!hasUnassignedVehicle && vehicleColorClass && (
                                            <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full border border-white ${vehicleColorClass}`} />
                                          )}
                                          {hasPrivateTour && <span>🔒</span>}
                                          <span>{dayData.assignedPeople}</span>
                                          {dayData.extendsToNextMonth && (
                                            <span className="text-xs opacity-75">→</span>
                                          )}
                                        </div>
                                      )
                                    })()}
                                    
                                    {/* 어시스턴트로 배정된 경우 - 가이드 이름 초성 표시 */}
                                    {dayData.role === 'assistant' && !dayData.isMultiDay && (() => {
                                      // 해당 날짜의 어시스턴트 투어들 중 단독투어 여부 확인
                                      const assistantTours = tours.filter(tour => 
                                        tour.tour_date === dateString && 
                                        tour.assistant_id === teamMemberId
                                      )
                                      const hasPrivateTour = assistantTours.some(tour => 
                                        tour.is_private_tour === 'TRUE' || tour.is_private_tour === true
                                      )
                                      
                                      // 차량 배차 여부 및 배정된 차량 색상
                                      const hasUnassignedVehicle = assistantTours.some(t => !t.tour_car_id || String(t.tour_car_id).trim().length === 0)
                                      const assignedCarIdAsst = assistantTours.find(t => t.tour_car_id && String(t.tour_car_id).trim())?.tour_car_id
                                      const vehicleColorClassAsst = assignedCarIdAsst ? monthVehiclesWithColors.vehicleIdToColor.get(String(assignedCarIdAsst).trim()) : null
                                      
                                      // 같은 날짜에 같은 product_id의 투어가 여러 팀(가이드)으로 나가는지 확인
                                      if (assistantTours.length > 0 && assistantTours[0].product_id && assistantTours[0].id && assistantTours[0].tour_guide_id) {
                                        // 같은 날짜, 같은 product_id를 가진 모든 투어 확인
                                        const sameDateProductTours = tours.filter(t => 
                                          t.tour_date === dateString && 
                                          t.product_id === assistantTours[0].product_id &&
                                          t.tour_guide_id // 가이드가 배정된 투어만
                                        )
                                        
                                        // 같은 product_id에서 여러 가이드(팀)가 있으면 테두리 색상 적용
                                        const uniqueGuides = new Set(sameDateProductTours.map(t => t.tour_guide_id).filter(Boolean))
                                        const hasMultipleTeams = uniqueGuides.size > 1
                                        
                                        const borderColor = hasMultipleTeams
                                          ? getTourBorderColor(
                                              assistantTours[0].id,
                                              dateString,
                                              assistantTours[0].product_id,
                                              assistantTours[0].tour_guide_id
                                            )
                                          : ''
                                        
                                        return (
                                          <div 
                                            className={`absolute inset-0 flex items-center justify-center gap-1 text-white px-2 py-0 text-[10px] rounded z-10 cursor-pointer hover:opacity-80 transition-opacity ${
                                              dayData.assignedPeople === 0 
                                                ? 'bg-gray-400' 
                                                : 'bg-transparent'
                                            } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''} ${borderColor ? 'border-2 border-white' : ''}`}
                                            style={{
                                              backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                                ? getColorFromClass(Object.values(dayData.productColors)[0])
                                                : undefined,
                                              color: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                                ? getProductDisplayProps(Object.values(dayData.productColors)[0]).style?.color
                                                : undefined,
                                              boxShadow: borderColor ? `0 0 0 2px ${getBorderColorValue(borderColor)}` : undefined
                                            }}
                                          title={assistantTours.length > 0 ? getGuideScheduleTourHoverText(assistantTours[0]) : guide.team_member_name}
                                          draggable
                                          onDragStart={(e) => {
                                            if (assistantTours.length > 0) {
                                              setDraggedRole('assistant')
                                              handleDragStart(e, assistantTours[0])
                                            }
                                          }}
                                          onDragEnd={handleAssignedTourDragEnd}
                                          onDoubleClick={() => {
                                            if (assistantTours.length > 0) {
                                              openTourDetailModal(assistantTours[0].id)
                                            }
                                          }}
                                          onClick={() => {
                                            if (assistantTours.length > 0) {
                                              showGuideModalContent('투어 상세 정보', getTourSummary(assistantTours[0]), assistantTours[0].id)
                                            }
                                          }}
                                        >
                                          {hasUnassignedVehicle && (
                                            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                                          )}
                                          {!hasUnassignedVehicle && vehicleColorClassAsst && (
                                            <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full border border-white ${vehicleColorClassAsst}`} />
                                          )}
                                          {hasPrivateTour && <span>🔒</span>}
                                          <span>{dayData.guideInitials || 'A'}</span>
                                          {dayData.extendsToNextMonth && (
                                            <span className="text-xs opacity-75">→</span>
                                          )}
                                        </div>
                                      )
                                      }
                                      
                                      // 기본 렌더링 (product_id가 없거나 tour_guide_id가 없는 경우)
                                      return (
                                        <div 
                                          className={`absolute inset-0 flex items-center justify-center gap-1 text-white px-2 py-0 text-[10px] rounded z-10 cursor-pointer hover:opacity-80 transition-opacity ${
                                            dayData.assignedPeople === 0 
                                              ? 'bg-gray-400' 
                                              : 'bg-transparent'
                                          } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''}`}
                                          style={{
                                            backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                              ? getColorFromClass(Object.values(dayData.productColors)[0])
                                              : undefined,
                                            color: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                              ? getProductDisplayProps(Object.values(dayData.productColors)[0]).style?.color
                                              : undefined
                                          }}
                                          title={assistantTours.length > 0 ? getGuideScheduleTourHoverText(assistantTours[0]) : guide.team_member_name}
                                          draggable
                                          onDragStart={(e) => {
                                            if (assistantTours.length > 0) {
                                              setDraggedRole('assistant')
                                              handleDragStart(e, assistantTours[0])
                                            }
                                          }}
                                          onDragEnd={handleAssignedTourDragEnd}
                                          onDoubleClick={() => {
                                            if (assistantTours.length > 0) {
                                              openTourDetailModal(assistantTours[0].id)
                                            }
                                          }}
                                          onClick={() => {
                                            if (assistantTours.length > 0) {
                                              showGuideModalContent('투어 상세 정보', getTourSummary(assistantTours[0]), assistantTours[0].id)
                                            }
                                          }}
                                        >
                                          {hasUnassignedVehicle && (
                                            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                                          )}
                                          {!hasUnassignedVehicle && vehicleColorClassAsst && (
                                            <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full border border-white ${vehicleColorClassAsst}`} />
                                          )}
                                          {hasPrivateTour && <span>🔒</span>}
                                          <span>{dayData.guideInitials || 'A'}</span>
                                          {dayData.extendsToNextMonth && (
                                            <span className="text-xs opacity-75">→</span>
                                          )}
                                        </div>
                                      )
                                    })()}
                                  </div>
                                ) : (
                                  <div className="text-gray-300 text-center py-0 text-[10px]">
                                    {/* Off 날짜 표시 */}
                                    {isOffDate(teamMemberId, dateString) && !(() => {
                                      const teamMember = teamMembers.find(member => member.email === teamMemberId)
                                      const key = `${teamMember?.email}_${dateString}`
                                      const pendingChange = pendingOffScheduleChanges[key]
                                      return pendingChange?.action === 'delete'
                                    })() ? (
                                      (() => {
                                        const teamMember = teamMembers.find(member => member.email === teamMemberId)
                                        const offSchedule = teamMember ? offSchedules.find(off => 
                                          off.team_email === teamMember.email && off.off_date === dateString
                                        ) : null
                                        
                                        return (
                                          <div 
                                            className={offScheduleAssignmentCellClass(offSchedule?.status)}
                                            onClick={() => {
                                              if (offSchedule) {
                                                openOffScheduleActionModal(offSchedule)
                                              }
                                            }}
                                            title={
                                              offSchedule
                                                ? `${offSchedule.reason || ''} (${offSchedule.status})`
                                                : guide.team_member_name
                                            }
                                          >
                                            OFF
                                          </div>
                                        )
                                      })()
                                    ) : (
                                      /* 드롭 영역 */
                                      <div 
                                        className="h-full flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => openOffScheduleActionModal(null, teamMemberId, dateString)}
                                        onDoubleClick={(e) => {
                                          e.stopPropagation()
                                          handleCreateOffSchedule(teamMemberId, dateString)
                                        }}
                                        title={guide.team_member_name}
                                      >
                                        <div className="text-gray-300 text-xs">+</div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                          })}
                        </div>
                        {Object.values(multiDayTours).map((tour, idx) => {
                          const start = dayjs(tour.startDate)
                          const monthStart = dayjs(firstDayOfMonth)
                          // 시작일이 이번 달 이전인 경우 보이는 시작 인덱스를 0으로 클램프
                          const diffFromMonthStart = start.diff(monthStart, 'day')
                          // monthDays[0]은 전월 말일 패딩이므로, 당월 1일은 인덱스 1 — diff만 쓰면 바가 하루 왼쪽으로 밀림
                          const visibleStartIdx = diffFromMonthStart < 0 ? 0 : diffFromMonthStart + 1
                          // 이전 달에서 시작했다면 그 만큼을 잘라내고 남은 일수만 표시
                          const cutDays = diffFromMonthStart < 0 ? Math.min(tour.days, Math.abs(diffFromMonthStart)) : 0
                          const remainingDays = tour.days - cutDays
                          const spanDays = Math.min(remainingDays, monthDays.length - visibleStartIdx)
                          if (spanDays <= 0) return null
                          const hasColors = Object.keys(tour.dayData.productColors).length > 0
                          const colorValues = Object.values(tour.dayData.productColors)
                          const gradient = hasColors
                            ? (colorValues.length === 1
                              ? `linear-gradient(135deg, ${getColorFromClass(colorValues[0])} 0%, ${getColorFromClass(colorValues[0])} 100%)`
                              : `linear-gradient(135deg, ${colorValues.map(color => getColorFromClass(color)).join(', ')})`)
                            : undefined
                          const mdRowTours = tours.filter(tourItem =>
                            tourItem.tour_date === tour.startDate &&
                            (tour.dayData.role === 'guide'
                              ? tourItem.tour_guide_id === teamMemberId
                              : tourItem.assistant_id === teamMemberId)
                          )
                          const hasUnassignedVehicleMd = mdRowTours.some(t => !t.tour_car_id || String(t.tour_car_id).trim().length === 0)
                          const assignedCarIdMd = mdRowTours.find(t => t.tour_car_id && String(t.tour_car_id).trim())?.tour_car_id
                          const vehicleColorClassMd = assignedCarIdMd
                            ? monthVehiclesWithColors.vehicleIdToColor.get(String(assignedCarIdMd).trim())
                            : null
                          return (
                            <div
                              key={`md-overlay-${idx}-${tour.startDate}`}
                              className="absolute z-10 top-0 h-[22px] flex items-center"
                              style={{ left: `calc(${visibleStartIdx} * (100% / ${monthDays.length}))`, width: `calc(${spanDays} * (100% / ${monthDays.length}))` }}
                            >
                              <div
                                className={`relative w-full h-full rounded px-2 py-0 text-[10px] flex items-center justify-center gap-1 cursor-pointer hover:opacity-90 transition-opacity ${tour.dayData.assignedPeople === 0 ? 'bg-gray-400 text-white' : ''}`}
                                style={{ 
                                  background: tour.dayData.assignedPeople > 0 && hasColors ? gradient : undefined,
                                  color:
                                    tour.dayData.assignedPeople > 0 && hasColors && colorValues[0]
                                      ? getProductDisplayProps(colorValues[0]).style?.color
                                      : undefined
                                }}
                                draggable
                                onDragStart={(e) => {
                                  if (mdRowTours.length > 0) {
                                    handleDragStart(e, mdRowTours[0])
                                  }
                                }}
                                onDragEnd={handleAssignedTourDragEnd}
                                onDoubleClick={() => {
                                  if (mdRowTours.length > 0) {
                                    openTourDetailModal(mdRowTours[0].id)
                                  }
                                }}
                                title={mdRowTours.length > 0 ? getGuideScheduleTourHoverText(mdRowTours[0]) : guide.team_member_name}
                              >
                                {hasUnassignedVehicleMd && (
                                  <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                                )}
                                {!hasUnassignedVehicleMd && vehicleColorClassMd && (
                                  <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full border border-white ${vehicleColorClassMd}`} />
                                )}
                                {mdRowTours.some(tourItem => tourItem.is_private_tour === 'TRUE' || tourItem.is_private_tour === true) && (
                                  <span>🔒</span>
                                )}
                                <span>
                                  {tour.dayData.role === 'assistant'
                                    ? (tour.dayData.guideInitials || 'A')
                                    : (tour.dayData.assignedPeople || '')}
                                </span>
                                {tour.extendsToNextMonth && (
                                  <span className="text-xs opacity-75">→</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-1 py-0 text-center text-[10px] font-medium" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                      <div className={`font-medium ${
                        guide.totalAssignedPeople === 0 
                          ? 'text-gray-300' 
                          : guide.totalAssignedPeople < 4 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                      }`}>{guide.totalAssignedPeople} ({guide.totalTours}일)</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
            </div>
          </div>

          {/* 부킹 테이블 */}
          <div>
            <div className="overflow-visible">
              <table className="w-full border-collapse" style={{tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px`}}>
                <tbody>
                  <tr
                    className="bg-purple-50 cursor-pointer hover:bg-purple-100/90 transition-colors"
                    onClick={() => setBookingRowExpanded(v => !v)}
                    title={bookingRowExpanded ? '클릭하여 상세 접기' : '클릭하여 시간·업체별 상세 펼치기'}
                  >
                    <td
                      className={`px-2 py-0.5 text-xs font-medium text-gray-900 border-t-2 border-gray-800 ${bookingRowExpanded ? 'border-b border-gray-300' : 'border-b-2 border-gray-800'}`}
                      style={{width: '96px', minWidth: '96px', maxWidth: '96px'}}
                    >
                      <div className="flex items-center gap-0.5">
                        {bookingRowExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-600" aria-hidden />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-600" aria-hidden />
                        )}
                        부킹
                      </div>
                    </td>
                    {monthDays.map(({ dateString }) => {
                      const bookingData = bookingTotals[dateString]
                      const hasBooking = bookingData && bookingData.totalCount > 0
                      return (
                        <td 
                          key={dateString} 
                          className={`p-0 text-center text-xs relative border-t-2 border-gray-800 ${bookingRowExpanded ? 'border-b border-gray-300' : 'border-b-2 border-gray-800'}`}
                          style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                          onMouseEnter={() => {
                            if (scheduleInteractionDragging) return
                            setHoveredBookingDate(dateString)
                          }}
                          onMouseLeave={() => {
                            if (scheduleInteractionDragging) return
                            setHoveredBookingDate(null)
                          }}
                        >
                          <div className={`px-1 py-0.5 ${isToday(dateString) ? 'border-l-2 border-r-2 border-red-500 bg-red-50' : ''}`}>
                            {hasBooking ? (
                              <div className={`font-medium ${
                                bookingData.totalCount === 0 
                                  ? 'text-gray-300' 
                                  : bookingData.totalCount < 5 
                                    ? 'text-blue-600' 
                                    : 'text-red-600'
                              } ${isToday(dateString) ? 'text-red-700' : ''}`}>
                                {bookingData.totalCount}
                              </div>
                            ) : (
                              <div className="text-gray-300">-</div>
                            )}
                          </div>
                          {/* 마우스 오버 시 부킹 상세 정보 표시 */}
                          {hoveredBookingDate === dateString && hasBooking && bookingData && (
                            <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-1 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none">
                              <div className="font-semibold mb-2">{dateString}</div>
                              {bookingData.ticketDetails.length > 0 && (
                                <div className="mb-2">
                                  <div className="font-semibold text-yellow-400 mb-1">입장권 부킹</div>
                                  {bookingData.ticketDetails.map((detail, idx) => (
                                    <div key={idx} className="ml-2 mb-1 flex flex-wrap items-center gap-1.5">
                                      <span>
                                        {detail.company ? `${getCompanyDisplayName(detail.company)} - ` : ''}
                                        {detail.time || '—'} ({detail.ea}개)
                                      </span>
                                      <span className="inline-flex items-center gap-0.5 text-yellow-100/95">
                                        <TicketBookingBookingStatusIcon
                                          status={detail.booking_status}
                                          className="h-3.5 w-3.5"
                                          title={formatTicketBookingAxisLabel(tTbAxis, 'booking', detail.booking_status)}
                                        />
                                        <span className="text-[10px] font-medium">
                                          {formatTicketBookingAxisLabel(tTbAxis, 'booking', detail.booking_status)}
                                        </span>
                                        <TicketBookingVendorStatusIcon
                                          status={detail.vendor_status}
                                          className="h-3.5 w-3.5"
                                          title={formatTicketBookingAxisLabel(tTbAxis, 'vendor', detail.vendor_status)}
                                        />
                                        <span className="text-[10px] font-medium">
                                          {formatTicketBookingAxisLabel(tTbAxis, 'vendor', detail.vendor_status)}
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {bookingData.hotelDetails.length > 0 && (
                                <div>
                                  <div className="font-semibold text-yellow-400 mb-1">호텔 부킹</div>
                                  {bookingData.hotelDetails.map((detail, idx) => (
                                    <div key={idx} className="ml-2 mb-1">
                                      {detail.hotel} ({detail.rooms}실)
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td
                      className={`px-2 py-0.5 text-center text-xs font-medium border-t-2 border-gray-800 ${bookingRowExpanded ? 'border-b border-gray-300' : 'border-b-2 border-gray-800'}`}
                      style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}
                    >
                      <div>
                        {monthDaysCore.reduce(
                          (sum, d) => sum + (bookingTotals[d.dateString]?.totalCount ?? 0),
                          0
                        )}
                      </div>
                    </td>
                  </tr>
                  {bookingRowExpanded && (
                    <tr className="bg-purple-50/80">
                      <td className="px-2 py-0.5 text-[10px] text-gray-500 align-top border-b-2 border-gray-800" style={{width: '96px', minWidth: '96px', maxWidth: '96px'}}>
                        상세
                      </td>
                      {monthDays.map(({ dateString }) => {
                        const rows = bookingDetailRowsByDate[dateString] || []
                        return (
                          <td
                            key={`${dateString}-detail`}
                            className={`p-0 align-top text-[9px] leading-tight border-b-2 border-gray-800 ${isToday(dateString) ? 'bg-red-50/40' : ''}`}
                            style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                          >
                            <div className="px-0.5 py-1 text-left text-gray-800 space-y-0.5 break-words">
                              {rows.length === 0 ? (
                                <span className="text-gray-300">-</span>
                              ) : (
                                rows.map((row, idx) =>
                                  row.kind === 'ticket' ? (
                                    <div
                                      key={idx}
                                      className="rounded-md px-0.5 py-0.5 -mx-0.5 space-y-0.5"
                                    >
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        title={locale === 'ko' ? '클릭하여 입장권 부킹 수정' : 'Click to edit ticket booking'}
                                        className="cursor-pointer flex flex-wrap items-center gap-0.5 outline-none focus-visible:ring-1 focus-visible:ring-purple-500 hover:bg-purple-200/90 rounded px-0.5 -mx-0.5"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onScheduleTicketBookingRowClick(row.bookingIds)
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onScheduleTicketBookingRowClick(row.bookingIds)
                                          }
                                        }}
                                      >
                                        <span className="text-[9px] tabular-nums text-gray-700 shrink-0 font-medium">
                                          {row.displayTime}
                                        </span>
                                        <span
                                          className={`inline-flex min-w-[0.95rem] items-center justify-center rounded px-1 py-0.5 text-[8px] font-bold leading-none shadow-sm ${scheduleBookingSupplierTagBadgeClass(row.tag)}`}
                                        >
                                          {scheduleBookingSupplierTagDisplay(row.tag)}
                                        </span>
                                        <span className="text-[9px] tabular-nums font-semibold text-gray-800 shrink-0">
                                          {row.ea}
                                        </span>
                                      </div>
                                      {row.bookingIds.length === 1 ? (
                                        (() => {
                                          const b = ticketBookingsById.get(row.bookingIds[0])
                                          if (!b) return null
                                          return (
                                            <ScheduleTicketBookingAxisInline
                                              booking={b}
                                              instanceKey={`sched-tb-${dateString}-${row.bookingIds[0]}-${idx}`}
                                              disabled={!isScheduleStaff}
                                              compact
                                              className="pl-0.5"
                                              onAxesUpdated={(next) => {
                                                setTicketBookings((prev) =>
                                                  prev.map((t) => (t.id === b.id ? { ...t, ...next } : t))
                                                )
                                              }}
                                            />
                                          )
                                        })()
                                      ) : (
                                        (() => {
                                          const merged = resolveMergedTicketBookingAxisDisplay(
                                            row.bookingIds,
                                            ticketBookingsById
                                          )
                                          if (merged.mixed) {
                                            return (
                                              <div
                                                className="flex items-center gap-0.5 pl-0.5 text-[8px] font-medium text-violet-900"
                                                title={
                                                  locale === 'ko'
                                                    ? '같은 줄에 여러 건·상태가 다릅니다. 위 줄을 눌러 선택하세요.'
                                                    : 'Multiple bookings or mixed statuses — click the line above to choose.'
                                                }
                                              >
                                                <Layers className="h-3 w-3 shrink-0" aria-hidden />
                                                {locale === 'ko' ? '혼합' : 'Mixed'}
                                              </div>
                                            )
                                          }
                                          return (
                                            <div className="flex flex-wrap items-center gap-0.5 pl-0.5 text-[8px] text-gray-800">
                                              <TicketBookingBookingStatusIcon
                                                status={merged.bookingStatus}
                                                className="h-3 w-3"
                                                title={formatTicketBookingAxisLabel(
                                                  tTbAxis,
                                                  'booking',
                                                  merged.bookingStatus
                                                )}
                                              />
                                              <span className="max-w-[4rem] truncate font-semibold">
                                                {formatTicketBookingAxisLabel(
                                                  tTbAxis,
                                                  'booking',
                                                  merged.bookingStatus
                                                )}
                                              </span>
                                              <TicketBookingVendorStatusIcon
                                                status={merged.vendorStatus}
                                                className="h-3 w-3"
                                                title={formatTicketBookingAxisLabel(
                                                  tTbAxis,
                                                  'vendor',
                                                  merged.vendorStatus
                                                )}
                                              />
                                              <span className="max-w-[4rem] truncate font-semibold">
                                                {formatTicketBookingAxisLabel(
                                                  tTbAxis,
                                                  'vendor',
                                                  merged.vendorStatus
                                                )}
                                              </span>
                                            </div>
                                          )
                                        })()
                                      )}
                                    </div>
                                  ) : (
                                    <div key={idx} className="text-gray-600">
                                      {row.line}
                                    </div>
                                  )
                                )
                              )}
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-2 py-0.5 align-top border-b-2 border-gray-800" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* 차량별 스케줄 테이블 (부킹 아래 — 해당 월 배차 있는 차량만, 행 드래그로 순서 변경) */}
            {orderedVehiclesForScheduleTable.length > 0 && (
              <div className="mt-1 overflow-visible">
                <table className="w-full" style={{ tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px` }}>
                  <tbody className="divide-y divide-gray-200">
                    {orderedVehiclesForScheduleTable.map(({ id, label, colorClass, rental_start_date, rental_end_date }, index) => {
                      const canMoveUp = index > 0
                      const canMoveDown = index < orderedVehiclesForScheduleTable.length - 1
                      const data = vehicleScheduleData[id]
                      if (!data) return null
                      const allNames = new Set<string>()
                      monthDays.forEach(({ dateString }) => {
                        const dayInfo = data.daily[dateString]
                        if (dayInfo) {
                          dayInfo.guideNames.forEach(n => allNames.add(n))
                          dayInfo.assistantNames.forEach(n => allNames.add(n))
                          dayInfo.driverNames.forEach(n => allNames.add(n))
                        }
                      })
                      const sortedNames = [...allNames].filter(Boolean).sort()
                      const vehicleNameTooltip = sortedNames.length > 0
                        ? `${sortedNames.join(', ')}\n총 ${sortedNames.length}명`
                        : label
                      /** 렌트 구간 ∩ (표시 중인 달 ~ 그 다음 달 말일) 안의 배정일. 다음 달 배차도 툴팁에 포함 */
                      const rentalAssignedDaysCompactList = (() => {
                        const rs = (rental_start_date || '').toString().substring(0, 10)
                        const re = (rental_end_date || '').toString().substring(0, 10)
                        if (!rs || !re) return ''
                        const rentalStart = dayjs(rs)
                        const rentalEnd = dayjs(re)
                        if (!rentalStart.isValid() || !rentalEnd.isValid()) return ''

                        const viewStart = dayjs(currentDate).startOf('month')
                        const viewEnd = dayjs(currentDate).add(1, 'month').endOf('month')
                        const rangeStart = rentalStart.isAfter(viewStart, 'day') ? rentalStart : viewStart
                        const rangeEnd = rentalEnd.isBefore(viewEnd, 'day') ? rentalEnd : viewEnd
                        if (rangeStart.isAfter(rangeEnd, 'day')) return ''

                        const dateStrings: string[] = []
                        for (let cur = rangeStart; !cur.isAfter(rangeEnd, 'day'); cur = cur.add(1, 'day')) {
                          const dateString = cur.format('YYYY-MM-DD')
                          const covered = tours.some(
                            (t) =>
                              t.tour_car_id &&
                              String(t.tour_car_id).trim() === id &&
                              tourCoversScheduleDate(t, dateString),
                          )
                          if (covered) dateStrings.push(dateString)
                        }
                        if (dateStrings.length === 0) return ''

                        const viewYm = dayjs(currentDate).format('YYYY-MM')
                        const allInViewMonth =
                          dateStrings.length > 0 && dateStrings.every((s) => s.slice(0, 7) === viewYm)
                        if (allInViewMonth) {
                          return dateStrings.map((s) => String(Number(s.slice(8, 10)))).join(',')
                        }
                        return dateStrings
                          .map((s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`)
                          .join(',')
                      })()
                      const rentalPeriodTooltipLine = `렌트 기간: ${(rental_start_date || '').toString().substring(0, 10)} ~ ${(rental_end_date || '').toString().substring(0, 10)}`
                      const rentalEmptyCellTooltip = rentalAssignedDaysCompactList
                        ? `${rentalPeriodTooltipLine}\n${rentalAssignedDaysCompactList}`
                        : rentalPeriodTooltipLine
                      return (
                        <tr
                          key={id}
                          className={`hover:bg-gray-50/50 ${
                            draggedVehicleRowId === id ? 'opacity-50 bg-blue-50/80' : ''
                          }`}
                        >
                          <td
                            className="px-1 py-0.5 text-xs leading-tight text-gray-900 select-none"
                            style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }}
                            onDragOver={(e) => {
                              if (draggedVehicleRowId) {
                                handleVehicleRowDragOver(e, id)
                              }
                            }}
                            onDrop={(e) => {
                              if (e.dataTransfer.getData('text/vehicle-row')) {
                                e.preventDefault()
                                handleVehicleRowDrop(e, id)
                              }
                            }}
                          >
                            <div className="flex items-center gap-0.5">
                              <div
                                className="flex shrink-0 items-center gap-0.5 cursor-grab active:cursor-grabbing"
                                draggable
                                onDragStart={(e) => handleVehicleRowDragStart(e, id)}
                                onDragEnd={handleVehicleRowDragEnd}
                                title="행 순서: 이 영역을 드래그하여 이동"
                              >
                                <div className="flex flex-col items-center -my-0.5">
                                  <button
                                    type="button"
                                    draggable={false}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (canMoveUp) moveVehicleRow(index, index - 1)
                                    }}
                                    disabled={!canMoveUp}
                                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="위로 이동"
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    draggable={false}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (canMoveDown) moveVehicleRow(index, index + 1)
                                    }}
                                    disabled={!canMoveDown}
                                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="아래로 이동"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </button>
                                </div>
                                <span className={`flex-shrink-0 w-2 h-2 rounded-full border border-white ${colorClass}`} />
                              </div>
                              <div
                                className={`min-w-0 flex-1 truncate font-medium ${canEditVehicleFromSchedule ? 'cursor-pointer hover:text-blue-700' : 'cursor-help'}`}
                                title={
                                  canEditVehicleFromSchedule
                                    ? `${vehicleNameTooltip}\n클릭하여 차량 정보 수정`
                                    : vehicleNameTooltip
                                }
                                role={canEditVehicleFromSchedule ? 'button' : undefined}
                                tabIndex={canEditVehicleFromSchedule ? 0 : undefined}
                                onClick={
                                  canEditVehicleFromSchedule
                                    ? (e) => {
                                        e.stopPropagation()
                                        void openVehicleEditFromSchedule(id)
                                      }
                                    : undefined
                                }
                                onKeyDown={
                                  canEditVehicleFromSchedule
                                    ? (e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          void openVehicleEditFromSchedule(id)
                                        }
                                      }
                                    : undefined
                                }
                              >
                                {label}
                              </div>
                            </div>
                          </td>
                          {monthDays.map(({ dateString }) => {
                            const dayInfo = data.daily[dateString]
                            const count = dayInfo?.count ?? 0
                            const guideNames = dayInfo?.guideNames ?? []
                            const assistantNames = dayInfo?.assistantNames ?? []
                            const driverNames = dayInfo?.driverNames ?? []
                            const hoverLines: string[] = []
                            if (guideNames.length > 0) hoverLines.push(`가이드: ${guideNames.join(', ')}`)
                            const asstOrDriverNames = [...new Set([...assistantNames, ...driverNames])].filter(Boolean)
                            if (asstOrDriverNames.length > 0) hoverLines.push(`어시스턴트/드라이버: ${asstOrDriverNames.join(', ')}`)
                            hoverLines.push('드래그하여 다른 차량으로 이동')
                            const cellTooltip = hoverLines.join('\n')
                            const dayTours = tours.filter(t => t.tour_car_id && String(t.tour_car_id).trim() === id && t.tour_date === dateString)
                            const isInRentalPeriod = rental_start_date && rental_end_date &&
                              dateString >= (rental_start_date || '').toString().substring(0, 10) &&
                              dateString <= (rental_end_date || '').toString().substring(0, 10)
                            const baseTdClass = isToday(dateString) ? 'border-l-2 border-r-2 border-red-500 bg-red-50' : ''
                            const rentalBgClass = isInRentalPeriod ? 'bg-amber-200' : ''
                            return (
                              <td
                                key={dateString}
                                className={`px-1 py-0 text-center text-xs relative cursor-pointer hover:ring-1 hover:ring-blue-300 ${baseTdClass} ${rentalBgClass}`}
                                style={{ width: dayColumnWidthCalc, minWidth: '40px', boxSizing: 'border-box' }}
                                title={count > 0 ? cellTooltip : (isInRentalPeriod ? rentalEmptyCellTooltip : '클릭하여 투어 배정 / 드래그하여 다른 차량으로 이동')}
                                onClick={(e) => {
                                  if ((e.target as HTMLElement).closest('[data-drag-handle]')) return
                                  setVehicleAssignTarget({ vehicleId: id, dateString })
                                  setShowVehicleAssignModal(true)
                                }}
                                onDragOver={(e) => {
                                  if (draggedVehicleRowId) {
                                    handleVehicleRowDragOver(e, id)
                                    return
                                  }
                                  e.preventDefault()
                                  e.dataTransfer.dropEffect = 'move'
                                  applyScheduleDragHighlight(e.currentTarget, SCHEDULE_VEHICLE_CELL_DROP_HIGHLIGHT)
                                }}
                                onDragLeave={handleGuideScheduleDropZoneDragLeave}
                                onDrop={(e) => {
                                  if (e.dataTransfer.getData('text/vehicle-row')) {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleVehicleRowDrop(e, id)
                                    return
                                  }
                                  handleVehicleCellDrop(e, id, dateString)
                                }}
                              >
                                <div className="relative h-[22px]" style={{ overflow: 'hidden' }}>
                                  {count > 0 ? (
                                    <div
                                      data-drag-handle
                                      className="absolute inset-0 flex items-center justify-center rounded text-white px-0.5 py-0 text-[10px] font-medium leading-tight cursor-grab active:cursor-grabbing"
                                      style={{ backgroundColor: getColorFromClass(dayInfo?.productColorClass || defaultPresetIds[0]) }}
                                      title={cellTooltip}
                                      draggable
                                      onDragStart={(e) => {
                                        if (dayTours.length > 0) {
                                          setDraggedRole(null)
                                          handleDragStart(e, dayTours[0])
                                        }
                                      }}
                                      onDragEnd={() => {
                                        setDraggedTour(null)
                                        setHighlightedDate(null)
                                        clearScheduleDragHighlight()
                                      }}
                                    >
                                      <span className="truncate w-full text-center">
                                        {guideNames.length > 0 ? guideNames.join(', ') : count}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 text-[10px]">-</span>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                          <td
                            className="px-1 py-0.5 text-center text-xs font-medium"
                            style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                            onDragOver={(e) => {
                              if (draggedVehicleRowId) {
                                handleVehicleRowDragOver(e, id)
                              }
                            }}
                            onDrop={(e) => {
                              if (e.dataTransfer.getData('text/vehicle-row')) {
                                e.preventDefault()
                                handleVehicleRowDrop(e, id)
                              }
                            }}
                          >
                            {data.totalDays > 0 ? data.totalDays : '-'}
                          </td>
                        </tr>
                      )
                    })}
                    {/* 일별 합계 행 */}
                    <tr className="bg-gray-100 font-semibold">
                      <td className="px-1 py-0.5 text-xs text-gray-900" style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }}>
                        일별 합계
                      </td>
                      {monthDays.map(({ dateString }) => {
                        const dayTotal = vehicleDailyTotals[dateString] ?? 0
                        const tourCount = tourCountPerDate[dateString] ?? 0
                        const isMismatch = tourCount !== dayTotal
                        return (
                          <td
                            key={dateString}
                            className={`px-1 py-0.5 text-center text-xs ${isToday(dateString) ? 'border-l-2 border-r-2 border-red-500 bg-red-50' : ''} ${isMismatch ? 'text-red-600 font-bold' : ''}`}
                            style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                            title={isMismatch ? `투어 ${tourCount}건, 차량 ${dayTotal}건` : undefined}
                          >
                            {dayTotal > 0 ? dayTotal : '-'}
                          </td>
                        )
                      })}
                      <td className="px-1 py-0.5 text-center text-xs font-medium" style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>
                        {Object.values(vehicleScheduleData).reduce((sum, d) => sum + (d?.totalDays ?? 0), 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* 미 배정된 투어 카드뷰 */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-red-500" />
          미 배정된 투어 스케줄
        </h3>
        {unassignedTourCards.length > 0 ? (
          <div 
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={handleUnassignDrop}
          >
            {unassignedTourCards.map((card) => {
              // 단독투어 여부 확인
              const isPrivateTour = card.tour.is_private_tour === 'TRUE' || card.tour.is_private_tour === true
              const summary = getTourSummaryCore(card.tour)
              const statusModalOpen = unassignedTourStatusModalTourId === card.tour.id

              return (
                <div
                  key={card.id}
                  className={`bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group ${
                    card.role === 'guide' 
                      ? 'border-blue-200 bg-blue-50' 
                      : 'border-green-200 bg-green-50'
                  } ${isPrivateTour ? 'ring-2 ring-purple-400 ring-opacity-50' : ''}`}
                  draggable
                  onDragStart={(e) => handleUnassignedTourCardDragStart(e, card)}
                  onDragEnd={handleUnassignedTourDragEnd}
                  onDoubleClick={() => openTourDetailModal(card.tour.id)}
                  title={getTourSummary(card.tour)}
                >
                  <div className="flex items-start space-x-2">
                    <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className={`text-sm font-medium min-w-0 flex-1 leading-snug ${isPrivateTour ? 'text-purple-700' : 'text-gray-900'}`}>
                          {isPrivateTour ? '🔒 ' : ''}{card.title}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                          <button
                            type="button"
                            aria-label={locale === 'ko' ? '투어 배정' : 'Assign staff'}
                            title={locale === 'ko' ? '투어 배정' : 'Assign staff'}
                            className="inline-flex items-center justify-center p-1 rounded-md border border-blue-300 text-blue-800 bg-white/90 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              setUnassignedPersonAssignModal({ tour: card.tour, role: card.role })
                            }}
                          >
                            <UserPlus className="w-3.5 h-3.5 shrink-0" aria-hidden />
                          </button>
                          <button
                            type="button"
                            aria-label={locale === 'ko' ? '차량 배정' : 'Assign vehicle'}
                            title={locale === 'ko' ? '차량 배정' : 'Assign vehicle'}
                            className="inline-flex items-center justify-center p-1 rounded-md border border-amber-300 text-amber-950 bg-white/90 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              setUnassignedVehicleAssignModalTourId(card.tour.id)
                            }}
                          >
                            <Car className="w-3.5 h-3.5 shrink-0" aria-hidden />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-700 mb-1.5">
                        <span className="font-medium text-gray-600">
                          {locale === 'ko' ? '해당일 인원' : 'People (day)'}
                        </span>
                        : {summary.assignedPeople} / {summary.totalPeopleAll}
                        <span className="text-gray-500 ml-1">
                          ({locale === 'ko' ? '투어 배정' : 'on tour'} / {locale === 'ko' ? '상품·일 합계' : 'product total'})
                        </span>
                      </div>
                      <div className="flex items-center flex-wrap gap-2 text-xs mb-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          card.role === 'guide' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {card.role === 'guide' ? '가이드' : '어시스턴트'}
                        </span>
                        <button
                          type="button"
                          aria-expanded={statusModalOpen}
                          aria-haspopup="dialog"
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer hover:brightness-95 active:brightness-90 ring-offset-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${getTourStatusColor(card.tour.tour_status)}`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            setUnassignedTourStatusModalTourId(card.tour.id)
                          }}
                        >
                          <span>
                            {locale === 'ko' ? '투어 상태' : 'Status'}: {getTourStatusLabel(card.tour.tour_status, locale)}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div 
            className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={handleUnassignDrop}
          >
            <div className="text-4xl mb-4">✅</div>
            <div className="text-lg font-medium text-gray-900 mb-2">미 배정된 투어가 없습니다</div>
            <div className="text-sm text-gray-500">모든 투어가 가이드에게 배정되었습니다</div>
          </div>
        )}
      </div>

      <Dialog
        open={!!unassignedTourStatusModalTourId}
        onOpenChange={(open) => {
          if (!open) setUnassignedTourStatusModalTourId(null)
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {(() => {
            const tid = unassignedTourStatusModalTourId
            if (!tid) return null
            const modalTour =
              unassignedTours.find((t: Tour) => t.id === tid) ?? tours.find((t: Tour) => t.id === tid)
            if (!modalTour) {
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-base">
                      {locale === 'ko' ? '투어 상태 변경' : 'Change tour status'}
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-gray-600">
                    {locale === 'ko' ? '투어를 찾을 수 없습니다.' : 'Tour not found.'}
                  </p>
                </>
              )
            }
            const currentTourStatus = modalTour.tour_status || ''
            const knownStatusValues = new Set(tourStatusOptions.map((o) => o.value))
            const statusButtonOptions =
              currentTourStatus && !knownStatusValues.has(currentTourStatus)
                ? [
                    {
                      value: currentTourStatus,
                      label: getTourStatusLabel(currentTourStatus, locale),
                      color: getTourStatusColor(currentTourStatus)
                    },
                    ...tourStatusOptions
                  ]
                : tourStatusOptions
            const productLabel =
              modalTour.products?.name ||
              products.find((p: Product) => p.id === modalTour.product_id)?.name ||
              '—'
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">
                    {locale === 'ko' ? '투어 상태 변경' : 'Change tour status'}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-gray-600 mb-3 -mt-1">
                  <span className="font-medium text-gray-900">{modalTour.tour_date}</span>
                  {' · '}
                  <span>{productLabel}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {statusButtonOptions.map((option) => {
                    const isCurrent = option.value === currentTourStatus
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={updatingUnassignedTourStatusId === modalTour.id}
                        onClick={() => {
                          if (option.value === currentTourStatus) {
                            setUnassignedTourStatusModalTourId(null)
                            return
                          }
                          void updateUnassignedTourStatus(modalTour.id, option.value)
                        }}
                        className={`px-2 py-2.5 rounded-lg text-xs font-medium text-center transition-colors border border-transparent ${
                          isCurrent
                            ? `${option.color} ring-2 ring-blue-500 ring-offset-1 shadow-sm`
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-900 border-gray-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <span className="line-clamp-3 leading-snug">{option.label}</span>
                        {isCurrent && (
                          <span className="block text-[10px] mt-1 text-blue-800 font-semibold">
                            {locale === 'ko' ? '현재' : 'Current'}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* 미배정 카드: 가이드/어시스턴트(드라이버) 배정 모달 */}
      <Dialog
        open={!!unassignedPersonAssignModal}
        onOpenChange={(open) => {
          if (!open) setUnassignedPersonAssignModal(null)
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {unassignedPersonAssignModal && (() => {
            const { tour: modalTour, role: assignRole } = unassignedPersonAssignModal
            const productLabel =
              modalTour.products?.name ||
              products.find((p: Product) => p.id === modalTour.product_id)?.name ||
              '—'
            const roleLabelKo = assignRole === 'guide' ? '가이드' : '어시스턴트 / 드라이버'
            const roleLabelEn = assignRole === 'guide' ? 'Guide' : 'Assistant / Driver'
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">
                    {locale === 'ko' ? '투어 배정' : 'Assign staff'}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-gray-600 mb-2 -mt-1">
                  <span className="font-medium text-gray-900">{modalTour.tour_date}</span>
                  {' · '}
                  <span>{productLabel}</span>
                </p>
                <p className="text-sm text-gray-700 mb-3">
                  {locale === 'ko' ? (
                    <>
                      배정할 역할: <span className="font-semibold">{roleLabelKo}</span>
                    </>
                  ) : (
                    <>
                      Role: <span className="font-semibold">{roleLabelEn}</span>
                    </>
                  )}
                </p>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {teamMembersSortedForAssignModal.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {locale === 'ko' ? '등록된 팀원이 없습니다.' : 'No team members.'}
                    </p>
                  ) : (
                    teamMembersSortedForAssignModal.map((member) => {
                      const displayName =
                        (member as { nick_name?: string }).nick_name || member.name_ko || member.email || '—'
                      const pos = (member.position || '').toString()
                      return (
                        <button
                          key={member.email}
                          type="button"
                          className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                          onClick={() => {
                            applyUnassignedPersonToTour(modalTour, member.email, modalTour.tour_date, assignRole)
                            setUnassignedPersonAssignModal(null)
                          }}
                        >
                          <div className="font-medium text-gray-900">{displayName}</div>
                          {pos ? <div className="text-xs text-gray-500 mt-0.5">{pos}</div> : null}
                        </button>
                      )
                    })
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* 미배정 카드: 차량 배정 모달 */}
      <Dialog
        open={!!unassignedVehicleAssignModalTourId}
        onOpenChange={(open) => {
          if (!open) setUnassignedVehicleAssignModalTourId(null)
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {(() => {
            const tid = unassignedVehicleAssignModalTourId
            if (!tid) return null
            const modalTour =
              unassignedTours.find((t: Tour) => t.id === tid) ?? tours.find((t: Tour) => t.id === tid)
            if (!modalTour) {
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-base">
                      {locale === 'ko' ? '차량 배정' : 'Assign vehicle'}
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-gray-600">
                    {locale === 'ko' ? '투어를 찾을 수 없습니다.' : 'Tour not found.'}
                  </p>
                </>
              )
            }
            const productLabel =
              modalTour.products?.name ||
              products.find((p: Product) => p.id === modalTour.product_id)?.name ||
              '—'
            const currentCarId = modalTour.tour_car_id && String(modalTour.tour_car_id).trim()
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">
                    {locale === 'ko' ? '차량 배정' : 'Assign vehicle'}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-gray-600 mb-2 -mt-1">
                  <span className="font-medium text-gray-900">{modalTour.tour_date}</span>
                  {' · '}
                  <span>{productLabel}</span>
                </p>
                {currentCarId ? (
                  <p className="text-sm text-gray-700 mb-3">
                    {locale === 'ko' ? '현재 차량: ' : 'Current: '}
                    <span className="font-medium">
                      {monthVehiclesWithColors.vehicleList.find((v) => v.id === currentCarId)?.label || currentCarId}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-amber-800 mb-3">
                    {locale === 'ko' ? '아직 차량이 배정되지 않았습니다.' : 'No vehicle assigned yet.'}
                  </p>
                )}
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {monthVehiclesWithColors.vehicleList.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {locale === 'ko' ? '사용 가능한 차량이 없습니다.' : 'No vehicles available.'}
                    </p>
                  ) : (
                    monthVehiclesWithColors.vehicleList.map((v) => {
                      const isCurrent = currentCarId === v.id
                      return (
                        <div
                          key={v.id}
                          className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${
                            isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate">{v.label}</div>
                            {(v.vehicle_category || '').toString().toLowerCase() === 'rental' ? (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {locale === 'ko' ? '렌터카' : 'Rental'}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => {
                              if (isCurrent) return
                              assignVehicleToTourFromModal(modalTour, v.id)
                              setUnassignedVehicleAssignModalTourId(null)
                            }}
                            className={`shrink-0 px-3 py-1.5 text-sm rounded-lg whitespace-nowrap ${
                              isCurrent
                                ? 'bg-gray-300 text-gray-500 cursor-default'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {isCurrent
                              ? locale === 'ko'
                                ? '현재 배정'
                                : 'Current'
                              : locale === 'ko'
                                ? '이 차량에 배정'
                                : 'Assign'}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* 상품 선택 모달 */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                상품 선택
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                표시할 상품을 선택하세요. ({selectedProducts.length}개 선택됨)
              </p>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {products.length > 0 ? (
                  products.map(product => {
                    const isSelected = selectedProducts.includes(product.id)
                    const selectedIndex = selectedProducts.indexOf(product.id)
                    
                    return (
                      <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => toggleProduct(product.id)}
                            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {product.name}
                          </button>
                          {isSelected && (() => {
                            const previewProps = getProductDisplayProps(productColors[product.id] || defaultPresetIds[0])
                            return (
                              <div
                                className={`px-2 py-1 rounded text-xs border border-gray-300 ${previewProps.className ?? ''}`.trim()}
                                style={previewProps.style}
                              >
                                미리보기
                              </div>
                            )
                          })()}
                        </div>
                        
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            {/* 순서 변경 버튼들 */}
                            <div className="flex flex-col space-y-1">
                              <button
                                onClick={() => selectedIndex > 0 && moveProduct(selectedIndex, selectedIndex - 1)}
                                disabled={selectedIndex === 0}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="위로 이동"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => selectedIndex < selectedProducts.length - 1 && moveProduct(selectedIndex, selectedIndex + 1)}
                                disabled={selectedIndex === selectedProducts.length - 1}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="아래로 이동"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                            {/* 색상 선택 버튼 → 클릭 시 프리셋 모달 */}
                            {(() => {
                              const dp = getProductDisplayProps(productColors[product.id] || defaultPresetIds[0])
                              return (
                                <button
                                  type="button"
                                  onClick={() => setColorPresetModal({ productId: product.id, productName: product.name })}
                                  className={`px-3 py-1.5 rounded border-2 border-gray-300 text-sm font-medium hover:ring-2 hover:ring-gray-400 ring-offset-1 ${dp.className ?? ''}`.trim()}
                                  style={dp.style}
                                  title="색상 프리셋 선택"
                                >
                                  색상 선택
                                </button>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {loading ? 'Loading...' : 'No products to display.'}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              {isSuperAdmin && (
                <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm text-blue-800">
                    적용한 상품 선택·색상이 모든 사용자에게 동일하게 표시됩니다.
                  </span>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={async () => {
                    setSelectedProducts([])
                    await saveUserSetting('schedule_selected_products', [])
                    localStorage.removeItem('schedule_selected_products')
                    if (isSuperAdmin) {
                      // 데이터베이스에서 공유 설정 삭제
                      await supabase
                        .from('shared_settings')
                        .delete()
                        .eq('setting_key', 'schedule_selected_products')
                      localStorage.removeItem('shared_schedule_selected_products')
                    }
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  전체 해제
                </button>
                <button
                  onClick={async () => {
                    localStorage.setItem('schedule_product_colors', JSON.stringify(productColors))
                    if (isSuperAdmin && selectedProducts.length > 0) {
                      await saveSharedSetting('schedule_selected_products', selectedProducts)
                      await saveSharedSetting('schedule_product_colors', productColors as unknown as string[])
                      localStorage.setItem('shared_schedule_selected_products', JSON.stringify(selectedProducts))
                      localStorage.setItem('shared_schedule_product_colors', JSON.stringify(productColors))
                    } else if (selectedProducts.length > 0) {
                      await saveUserSetting('schedule_selected_products', selectedProducts)
                    }
                    setShowProductModal(false)
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 색상 프리셋 선택 모달 */}
      {colorPresetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                색상 프리셋 선택
                <span className="text-sm font-normal text-gray-500 ml-2">({colorPresetModal.productName})</span>
              </h3>
              <button
                type="button"
                onClick={() => setColorPresetModal(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">다른 상품에서 사용 중인 색은 표시되지 않습니다.</p>
            <div className="flex flex-col gap-3 max-h-[65vh] overflow-y-auto">
              {(() => {
                const usedByOthers = new Set(
                  products
                    .filter(p => p.id !== colorPresetModal.productId && selectedProducts.includes(p.id))
                    .map(p => productColors[p.id])
                    .filter(Boolean)
                )
                const groups = Array.from(new Set(SCHEDULE_COLOR_PRESETS.map(p => p.groupLabel)))
                return groups.map(groupLabel => {
                  const presetsInGroup = SCHEDULE_COLOR_PRESETS.filter(p => p.groupLabel === groupLabel)
                  const visible = presetsInGroup.filter(p => !usedByOthers.has(p.id))
                  if (visible.length === 0) return null
                  return (
                    <div key={groupLabel}>
                      <div className="text-xs font-medium text-gray-600 mb-1.5">{groupLabel}</div>
                      <div className="flex flex-wrap gap-2">
                        {visible.map(preset => {
                          const isSelected = productColors[colorPresetModal.productId] === preset.id
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                changeProductColor(colorPresetModal.productId, preset.id)
                                setColorPresetModal(null)
                              }}
                              className={`min-w-[5rem] px-3 py-2 rounded-lg border-2 text-xs font-medium ${
                                isSelected ? 'ring-2 ring-gray-800 ring-offset-2 font-bold border-gray-800' : 'border-gray-300 hover:opacity-90'
                              }`}
                              style={{ backgroundColor: preset.bgHex, color: preset.textHex }}
                              title={preset.name}
                            >
                              {preset.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 팀원 선택 모달 */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Users className="w-5 h-5 mr-2" />
                팀원 선택
              </h3>
              <button
                onClick={() => setShowTeamModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                표시할 팀원을 선택하세요. ({selectedTeamMembers.length}개 선택됨)
              </p>
              <div className="mb-3 grid grid-cols-2 rounded-lg bg-gray-100 p-1 text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setTeamModalTab('active')}
                  className={`rounded-md px-3 py-2 transition-colors ${
                    teamModalTab === 'active'
                      ? 'bg-white text-green-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  활성화 된 팀원 ({teamMembers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeamModalTab('inactive')}
                  className={`rounded-md px-3 py-2 transition-colors ${
                    teamModalTab === 'inactive'
                      ? 'bg-white text-orange-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  비활성화 된 팀원 ({inactiveTeamMembers.length})
                </button>
              </div>

              <div className="mb-3">
                <label htmlFor="schedule-team-modal-search" className="sr-only">
                  가이드·팀원 이름 검색
                </label>
                <input
                  id="schedule-team-modal-search"
                  type="search"
                  value={teamModalSearchQuery}
                  onChange={(e) => setTeamModalSearchQuery(e.target.value)}
                  placeholder="가이드 이름, 닉네임, 이메일로 검색"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {teamModalTab === 'active' ? (
                  teamMembers.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                      활성화 된 팀원이 없습니다.
                    </div>
                  ) : teamMembersFilteredForModal.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                      검색과 일치하는 팀원이 없습니다.
                    </div>
                  ) : (
                    teamMembersFilteredForModal.map(member => {
                      const isSelected = selectedTeamMembers.includes(member.email)
                      const selectedIndex = selectedTeamMembers.indexOf(member.email)
                      
                      return (
                        <div key={member.email} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => toggleTeamMember(member.email)}
                              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                                isSelected
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {getTeamMemberDisplayName(member)} ({member.position || '직책 없음'})
                            </button>
                          </div>
                          
                          {isSelected && (
                            <div className="flex items-center space-x-2">
                              {/* 순서 변경 버튼들 */}
                              <div className="flex flex-col space-y-1">
                                <button
                                  onClick={() => selectedIndex > 0 && moveTeamMember(selectedIndex, selectedIndex - 1)}
                                  disabled={selectedIndex === 0}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="위로 이동"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => selectedIndex < selectedTeamMembers.length - 1 && moveTeamMember(selectedIndex, selectedIndex + 1)}
                                  disabled={selectedIndex === selectedTeamMembers.length - 1}
                                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="아래로 이동"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )
                ) : inactiveTeamMembers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                    비활성화 된 팀원이 없습니다.
                  </div>
                ) : inactiveTeamMembersFilteredForModal.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                    검색과 일치하는 팀원이 없습니다.
                  </div>
                ) : (
                  inactiveTeamMembersFilteredForModal.map(member => (
                    <div key={member.email} className="flex flex-col gap-3 rounded-lg border border-orange-100 bg-orange-50/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {getTeamMemberDisplayName(member)}
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            {member.position || '직책 없음'}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{member.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => activateTeamMemberForSchedule(member)}
                        disabled={activatingTeamMemberEmail === member.email}
                        className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {activatingTeamMemberEmail === member.email ? '활성화 중...' : '활성화하고 표시'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              {isSuperAdmin && (
                <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="share-team-members"
                    checked={shareTeamMembersSetting}
                    onChange={(e) => setShareTeamMembersSetting(e.target.checked)}
                    className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                  />
                  <label htmlFor="share-team-members" className="text-sm text-gray-700 cursor-pointer">
                    모든 사용자에게 공유 (관리자 전용)
                  </label>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={async () => {
                    setSelectedTeamMembers([])
                    setShareTeamMembersSetting(false)
                    await saveUserSetting('schedule_selected_team_members', [])
                    localStorage.removeItem('schedule_selected_team_members')
                    if (isSuperAdmin) {
                      // 데이터베이스에서 공유 설정 삭제
                      await supabase
                        .from('shared_settings')
                        .delete()
                        .eq('setting_key', 'schedule_selected_team_members')
                      localStorage.removeItem('shared_schedule_selected_team_members')
                    }
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  전체 해제
                </button>
                <button
                  onClick={async () => {
                    if (shareTeamMembersSetting && selectedTeamMembers.length > 0) {
                      await saveSharedSetting('schedule_selected_team_members', selectedTeamMembers)
                    }
                    setShareTeamMembersSetting(false)
                    setShowTeamModal(false)
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 메시지 모달 */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  messageModalContent.type === 'success' 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-red-100 text-red-600'
                }`}>
                  {messageModalContent.type === 'success' ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <h3 className={`text-lg font-semibold ${
                  messageModalContent.type === 'success' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {messageModalContent.title}
                </h3>
              </div>
              <button
                onClick={() => setShowMessageModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className={`text-sm ${
              messageModalContent.type === 'success' ? 'text-green-700' : 'text-red-700'
            }`}>
              {messageModalContent.message}
            </p>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowMessageModal(false)}
                className={`px-4 py-2 rounded-lg text-white transition-colors ${
                  messageModalContent.type === 'success' 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 날짜 노트 모달 */}
      {/* 정원 초과: 배정 인원 > 수용 합 — 추가 투어 생성 안내 */}
      <Dialog
        open={capacityOverflowModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCapacityOverflowModalOpen(false)
            setCapacityOverflowModalDismissed(true)
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base text-red-700">
              {locale === 'ko' ? '투어 정원 초과' : 'Tour capacity exceeded'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 -mt-1 mb-3">
            {locale === 'ko'
              ? '이번 달 일정 중 배정 인원이 투어 수용 인원 합보다 많은 날이 있습니다. 팀을 나누려면 투어를 추가로 만드세요.'
              : 'Some days this month have more assigned guests than total tour capacity. Create an additional tour to split groups.'}
          </p>
          <ul className="space-y-2 max-h-[min(50vh,360px)] overflow-y-auto pr-1">
            {scheduleCapacityOverflowItems.map((item) => {
              const ck = `${item.productId}__${item.dateString}`
              const busy = capacityOverflowCreatingKey === ck
              return (
                <li
                  key={ck}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/40 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">{item.productName}</div>
                    <div className="text-xs text-gray-500">{item.dateString}</div>
                    <div className="text-sm font-bold text-red-600 tabular-nums mt-0.5">
                      {item.assigned} / {item.max}
                      {locale === 'ko' ? '명' : ' pax'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateEmptyTourFromOverflow(item.productId, item.dateString)}
                    disabled={busy}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {busy
                      ? locale === 'ko'
                        ? '생성 중…'
                        : 'Creating…'
                      : locale === 'ko'
                        ? '투어 추가'
                        : 'Add tour'}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex justify-end mt-4 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setCapacityOverflowModalOpen(false)
                setCapacityOverflowModalDismissed(true)
              }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {locale === 'ko' ? '닫기' : 'Close'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 스케쥴뷰 셀: 해당일·상품 예약 목록 → 행 클릭 시 예약 수정 */}
      <Dialog
        open={!!productCellReservationsModal}
        onOpenChange={(open) => {
          if (!open) setProductCellReservationsModal(null)
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base pr-8">
              {productCellReservationsModal
                ? `${productCellReservationsModal.productName} · ${productCellReservationsModal.dateString}`
                : ''}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 -mt-2 mb-2">
            {locale === 'ko'
              ? '이름 영역을 누르면 수정 화면이 열립니다. 오른쪽에서 상태만 바로 변경할 수 있습니다.'
              : 'Click the name to open the edit form. Change status quickly from the menu on the right.'}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2 pb-2 border-b border-gray-100 shrink-0">
            <button
              type="button"
              onClick={() => void handleProductCellModalCreateTour()}
              disabled={productCellCreateTourLoading || productCellReservationList.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {productCellCreateTourLoading
                ? locale === 'ko'
                  ? '처리 중…'
                  : 'Working…'
                : locale === 'ko'
                  ? '투어 생성'
                  : 'Create tour'}
            </button>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 space-y-1.5 pr-1 pt-2">
            {productCellReservationList.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                {locale === 'ko' ? '예약이 없습니다.' : 'No reservations.'}
              </p>
            ) : (
              productCellReservationList.map((res) => {
                const st = String(res.status ?? '')
                const normalizedSt = st.trim().toLowerCase()
                const quickSet = productCellQuickStatusValues as readonly string[]
                const statusSelectOptions =
                  normalizedSt && !quickSet.includes(normalizedSt)
                    ? [normalizedSt, ...quickSet]
                    : [...quickSet]
                return (
                  <div
                    key={res.id}
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 hover:bg-gray-50 transition-colors flex flex-row gap-2 items-stretch min-w-0"
                  >
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left flex flex-col gap-1 justify-center rounded-md px-1 py-0.5 -m-0.5 hover:bg-gray-100/80 transition-colors"
                      onClick={() => {
                        setProductCellReservationsModal(null)
                        setReservationIdForScheduleEdit(String(res.id))
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {getCustomerName(String(res.customer_id || ''), customers as Customer[])}
                        </span>
                        <span className="text-xs text-gray-600 shrink-0 tabular-nums">
                          {res.total_people ?? 0}
                          {locale === 'ko' ? '명' : ' pax'}
                        </span>
                      </div>
                      <span
                        className={`inline-flex text-xs px-2 py-0.5 rounded-md w-fit font-medium ${getStatusColor(st)}`}
                      >
                        {st ? getStatusLabel(st, tReservations) : '—'}
                      </span>
                    </button>
                    <div
                      className="shrink-0 flex flex-col justify-center gap-0.5 border-l border-gray-100 pl-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label htmlFor={`schedule-product-cell-status-${res.id}`} className="text-[10px] text-gray-500 whitespace-nowrap">
                        {locale === 'ko' ? '상태 변경' : 'Status'}
                      </label>
                      <select
                        id={`schedule-product-cell-status-${res.id}`}
                        className="text-xs border border-gray-300 rounded-md px-1.5 py-1 bg-white max-w-[7.5rem] disabled:opacity-50"
                        value={normalizedSt || 'pending'}
                        disabled={productCellStatusSavingId === String(res.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          void handleProductCellReservationStatusChange(String(res.id), e.target.value)
                        }}
                      >
                        {statusSelectOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {getStatusLabel(opt, tReservations)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 스케줄 부킹 상세: 같은 시간·업체로 합쳐진 경우 선택 */}
      <Dialog
        open={!!pickScheduleTicketBookingIds?.length}
        onOpenChange={(open) => {
          if (!open) setPickScheduleTicketBookingIds(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {locale === 'ko' ? '편집할 부킹 선택' : 'Choose booking to edit'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 -mt-2">
            {locale === 'ko'
              ? '같은 시간·표시 업체로 합쳐진 줄입니다. 수정할 건을 고르세요.'
              : 'This line merges bookings with the same time and tag. Pick one to edit.'}
          </p>
          <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
            {pickScheduleTicketBookingIds?.map((id) => {
              const b = ticketBookings.find((t) => t.id === id)
              return (
                <button
                  key={id}
                  type="button"
                  className="text-left rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setPickScheduleTicketBookingIds(null)
                    void loadFullTicketBookingAndOpen(id)
                  }}
                >
                  <div className="font-medium text-gray-900">
                    {[b?.company || '—', b?.time || '—'].join(' · ')}
                    <span className="tabular-nums font-medium">
                      {' '}
                      · {b?.ea ?? 0}
                      {locale === 'ko' ? '매' : ' ea'}
                    </span>
                  </div>
                  {b ? (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      <ScheduleTicketBookingAxisInline
                        booking={b}
                        instanceKey={`pick-tb-${id}`}
                        disabled={!isScheduleStaff}
                        compact={false}
                        onAxesUpdated={(next) => {
                          setTicketBookings((prev) => prev.map((t) => (t.id === id ? { ...t, ...next } : t)))
                        }}
                      />
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {scheduleTicketBookingFormOpen && scheduleTicketBookingEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative shadow-xl">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-xl font-semibold">
                {locale === 'ko' ? '입장권 부킹 편집' : 'Edit ticket booking'}
              </h3>
              <button
                type="button"
                onClick={closeScheduleTicketBookingForm}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
                aria-label={locale === 'ko' ? '닫기' : 'Close'}
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <ScheduleTicketBookingForm
                key={scheduleTicketBookingEdit?.id ?? 'new'}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                booking={scheduleTicketBookingEdit as any}
                hideAxisActionPanel
                onSave={() => {
                  void handleScheduleTicketBookingSaved()
                }}
                onCancel={closeScheduleTicketBookingForm}
                canRequestSoftDelete={canRequestScheduleTicketSoftDelete}
                onRequestDelete={handleRequestScheduleTicketBookingDelete}
                {...(canSuperActorTicketBookingForm
                  ? {
                      onDelete: (delId: string) => {
                        void (async () => {
                          try {
                            const { error } = await supabase.from('ticket_bookings').delete().eq('id', delId)
                            if (error) throw error
                          } catch (err) {
                            console.error(err)
                            alert(locale === 'ko' ? '삭제 중 오류가 발생했습니다.' : 'Delete failed.')
                            return
                          }
                          await handleScheduleTicketBookingSaved()
                        })()
                      },
                    }
                  : {})}
                isSuper={canSuperActorTicketBookingForm}
                tourId={scheduleTicketBookingEdit?.tour_id || undefined}
              />
            </div>
          </div>
        </div>
      )}

      {loadingScheduleReservationEdit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[1100]" aria-hidden>
          <div className="text-white font-medium text-sm">{locale === 'ko' ? '불러오는 중…' : 'Loading…'}</div>
        </div>
      )}
      {scheduleEditingReservation && scheduleReservationFormData && (
        <div className="fixed inset-0 z-[1100]">
          <ReservationFormAny
            reservation={scheduleEditingReservation}
            customers={scheduleReservationFormData.customers}
            products={scheduleReservationFormData.products}
            channels={scheduleReservationFormData.channels}
            productOptions={scheduleReservationFormData.productOptions}
            options={scheduleReservationFormData.options}
            pickupHotels={scheduleReservationFormData.pickupHotels}
            coupons={scheduleReservationFormData.coupons}
            layout="modal"
            allowPastDateEdit={isSuperAdmin}
            onSubmit={async (reservationData: Record<string, unknown>) => {
              const editingId = String((scheduleEditingReservation as { id?: string }).id || '')
              try {
                const dbReservationData = {
                  customer_id: reservationData.customerId,
                  product_id: reservationData.productId,
                  tour_date: reservationData.tourDate,
                  tour_time: reservationData.tourTime || null,
                  event_note: reservationData.eventNote,
                  pickup_hotel: reservationData.pickUpHotel,
                  pickup_time: reservationData.pickUpTime || null,
                  adults: reservationData.adults,
                  child: reservationData.child,
                  infant: reservationData.infant,
                  total_people: reservationData.totalPeople,
                  channel_id: reservationData.channelId,
                  channel_rn: reservationData.channelRN,
                  added_by: reservationData.addedBy,
                  tour_id: reservationData.tourId || (scheduleEditingReservation as { tourId?: string }).tourId || null,
                  status: reservationData.status,
                  selected_options: reservationData.selectedOptions,
                  selected_option_prices: reservationData.selectedOptionPrices,
                  is_private_tour: reservationData.isPrivateTour || false
                }
                const { error } = await (supabase as any).from('reservations').update(dbReservationData).eq('id', editingId)
                if (error) {
                  showMessage(locale === 'ko' ? '오류' : 'Error', error.message, 'error')
                  return
                }
                const choicesObj = reservationData.choices as { required?: unknown[] } | undefined
                if (choicesObj?.required && Array.isArray(choicesObj.required)) {
                  await supabase.from('reservation_choices').delete().eq('reservation_id', editingId)
                  const validChoices = (choicesObj.required as Record<string, unknown>[])
                    .filter((c) => c.option_id)
                    .map((c) => ({
                      reservation_id: editingId,
                      choice_id: c.choice_id,
                      option_id: c.option_id,
                      quantity: (c.quantity as number) || 1,
                      total_price: (c.total_price as number) || 0
                    }))
                  if (validChoices.length > 0) {
                    await (supabase as any).from('reservation_choices').insert(validChoices)
                  }
                }
                handleCloseScheduleReservationEdit()
                await fetchData()
                showMessage(
                  locale === 'ko' ? '저장 완료' : 'Saved',
                  locale === 'ko' ? '예약이 수정되었습니다.' : 'Reservation updated.',
                  'success'
                )
              } catch (e) {
                console.error('스케줄 예약 수정 오류:', e)
                showMessage(locale === 'ko' ? '오류' : 'Error', String(e), 'error')
              }
            }}
            onCancel={handleCloseScheduleReservationEdit}
            onRefreshCustomers={async () => {}}
            onDelete={async () => {
              const editingId = String((scheduleEditingReservation as { id?: string }).id || '')
              const ok =
                locale === 'ko'
                  ? window.confirm('이 예약을 삭제(상태: 삭제됨)하시겠습니까?')
                  : window.confirm('Mark this reservation as deleted?')
              if (!ok) return
              try {
                const { error } = await supabase.from('reservations').update({ status: 'deleted' }).eq('id', editingId)
                if (error) {
                  showMessage(locale === 'ko' ? '오류' : 'Error', error.message, 'error')
                  return
                }
                handleCloseScheduleReservationEdit()
                await fetchData()
                showMessage(
                  locale === 'ko' ? '처리 완료' : 'Done',
                  locale === 'ko' ? '예약이 삭제됨으로 변경되었습니다.' : 'Reservation marked deleted.',
                  'success'
                )
              } catch (e) {
                console.error('예약 삭제 처리 오류:', e)
              }
            }}
          />
        </div>
      )}

      <DateNoteModal
        isOpen={showDateNoteModal}
        dateString={selectedDateForNote}
        initialNote={selectedDateForNote ? (dateNotes[selectedDateForNote]?.note || '') : ''}
        onClose={closeDateNoteModal}
        onSave={saveDateNote}
        onDelete={deleteDateNote}
      />

      {scheduleLeavePromptOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">저장되지 않은 스케줄 변경</h3>
              <button
                type="button"
                onClick={() => {
                  if (scheduleLeaveSaving) return
                  pendingScheduleLeaveRef.current = null
                  setScheduleLeavePromptOpen(false)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                disabled={scheduleLeaveSaving}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              이동하면 화면에만 반영된 배정 변경이 사라지거나 그대로 둘지 선택해 주세요. 저장 시 오프 스케줄 등 다른 대기 변경도 함께 서버에 반영됩니다.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  if (scheduleLeaveSaving) return
                  pendingScheduleLeaveRef.current = null
                  setScheduleLeavePromptOpen(false)
                }}
                disabled={scheduleLeaveSaving}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                머무르기
              </button>
              <button
                type="button"
                onClick={() => void handleScheduleLeaveDiscardAndGo()}
                disabled={scheduleLeaveSaving}
                className="px-4 py-2 text-gray-800 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50"
              >
                저장 안 함
              </button>
              <button
                type="button"
                onClick={() => void handleScheduleLeaveSaveAndGo()}
                disabled={scheduleLeaveSaving}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {scheduleLeaveSaving ? '처리 중…' : '저장 후 이동'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dragAssignSaveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">변경사항 저장</h3>
              <button
                type="button"
                onClick={() => !dragAssignSaveLoading && setDragAssignSaveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                disabled={dragAssignSaveLoading}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              드래그로 반영한 배정 변경을 서버에 지금 저장하시겠습니까?
              <span className="block mt-2 text-xs text-gray-500">
                저장 시 상단에 대기 중인 다른 변경사항(오프 스케줄 등)도 함께 저장됩니다.
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDragAssignSaveModalOpen(false)}
                disabled={dragAssignSaveLoading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                나중에
              </button>
              <button
                type="button"
                onClick={() => void confirmDragAssignSave()}
                disabled={dragAssignSaveLoading}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {dragAssignSaveLoading ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 확인 모달 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-100 text-yellow-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-yellow-900">
                  {confirmModalContent.title}
                </h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-sm text-yellow-700 mb-6">
              {confirmModalContent.message}
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  confirmModalContent.onConfirm()
                  setShowConfirmModal(false)
                }}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${confirmModalContent.buttonColor}`}
              >
                {confirmModalContent.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 가이드 모달 */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {guideModalContent.title}
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-line">
              {guideModalContent.content}
            </div>
            {guideModalContent.tourId && isScheduleStaff ? (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                <label className="block text-sm font-medium text-gray-800">
                  {locale === 'ko' ? '투어 상태' : 'Tour status'}
                </label>
                <Select
                  value={guideModalStatusSelectValue || undefined}
                  onValueChange={(v) => {
                    if (!guideModalContent.tourId) return
                    void updateTourDetailModalTourStatus(guideModalContent.tourId, v)
                  }}
                  disabled={updatingTourDetailModalStatusId === guideModalContent.tourId}
                >
                  <SelectTrigger
                    className="h-10 w-full text-sm bg-white"
                    aria-label={locale === 'ko' ? '투어 상태 빠른 변경' : 'Quick change tour status'}
                  >
                    <SelectValue
                      placeholder={locale === 'ko' ? '상태 선택' : 'Select status'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {guideModalStatusSelectOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {getTourStatusLabel(option.value, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => {
                  if (guideModalContent.tourId) {
                    setShowGuideModal(false)
                    openTourDetailModal(guideModalContent.tourId)
                  }
                }}
                disabled={!guideModalContent.tourId}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                투어 상세 열기
              </button>
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 투어 상세 (스케줄 뷰에서 페이지 이동 없이 확인) */}
      <Dialog
        open={!!tourDetailModal}
        onOpenChange={(open) => {
          if (!open) {
            setTourDetailModal(null)
            setTourDetailIframeReloadNonce(0)
          }
        }}
      >
        <DialogContent
          className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-gray-200 px-4 py-3 pr-12 shrink-0 text-left">
            <DialogTitle className="text-base font-semibold leading-snug truncate flex-1 min-w-0" title={tourDetailModal?.title}>
              {tourDetailModal?.title ?? '투어 상세'}
            </DialogTitle>
            {tourDetailModal?.tourId ? (
              <a
                href={`/${locale}/admin/tours/${tourDetailModal.tourId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 shrink-0 ml-2"
              >
                새 탭에서 열기
                <ExternalLink size={14} aria-hidden />
              </a>
            ) : null}
          </DialogHeader>
          {tourDetailModal?.tourId ? (
            <iframe
              key={`${tourDetailModal.tourId}-${tourDetailIframeReloadNonce}`}
              title={tourDetailModal.title ? `${tourDetailModal.title} 투어 상세` : '투어 상세'}
              src={`/${locale}/admin/tours/${tourDetailModal.tourId}`}
              className="w-full flex-1 min-h-0 border-0 bg-white"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 일괄 오프 스케줄 모달 */}
      {showBatchOffModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-orange-500" />
                일괄 오프 스케줄 추가
              </h3>
              <button
                onClick={() => {
                  setShowBatchOffModal(false)
                  resetBatchOffModalFields()
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 가이드 선택 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                가이드 선택 <span className="text-red-500">*</span>
              </label>
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                {/* 전체 선택/해제 */}
                <button
                  onClick={() => {
                    const guideMembers = teamMembers.filter(m => m.position === 'guide' || m.position === '가이드')
                    if (batchOffGuides.length === guideMembers.length) {
                      setBatchOffGuides([])
                    } else {
                      setBatchOffGuides(guideMembers.map(m => m.email))
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  {batchOffGuides.length === teamMembers.filter(m => m.position === 'guide' || m.position === '가이드').length ? '전체 해제' : '가이드 전체 선택'}
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                {teamMembers.map(member => {
                  const isSelected = batchOffGuides.includes(member.email)
                  const displayName = (member as any).nick_name || member.name_ko || member.email
                  return (
                    <label
                      key={member.email}
                      className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setBatchOffGuides(prev =>
                            isSelected
                              ? prev.filter(e => e !== member.email)
                              : [...prev, member.email]
                          )
                        }}
                        className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700">{displayName}</span>
                      <span className="text-xs text-gray-400 ml-auto">{member.position || ''}</span>
                    </label>
                  )
                })}
              </div>
              {batchOffGuides.length > 0 && (
                <p className="mt-1 text-xs text-orange-600">{batchOffGuides.length}명 선택됨</p>
              )}
            </div>

            {/* 기간 선택 (여러 구간) */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                기간 선택 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {batchOffPeriods.map((period, index) => {
                  const isLast = index === batchOffPeriods.length - 1
                  return (
                    <div key={period.id} className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={period.startDate}
                        onChange={(e) => {
                          const start = e.target.value
                          setBatchOffPeriods((prev) =>
                            prev.map((p) =>
                              p.id === period.id
                                ? {
                                    ...p,
                                    startDate: start,
                                    endDate:
                                      !p.endDate || dayjs(start).isAfter(dayjs(p.endDate), 'day')
                                        ? start
                                        : p.endDate,
                                  }
                                : p
                            )
                          )
                        }}
                        className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                      />
                      <span className="text-gray-500 text-sm font-medium shrink-0">~</span>
                      <input
                        type="date"
                        value={period.endDate}
                        min={period.startDate}
                        onChange={(e) =>
                          setBatchOffPeriods((prev) =>
                            prev.map((p) => (p.id === period.id ? { ...p, endDate: e.target.value } : p))
                          )
                        }
                        className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        {isLast ? (
                          <button
                            type="button"
                            onClick={() =>
                              setBatchOffPeriods((prev) => [
                                ...prev,
                                { id: crypto.randomUUID(), startDate: '', endDate: '' },
                              ])
                            }
                            className="p-2 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors"
                            title="기간 추가"
                          >
                            <Plus className="w-4 h-4" aria-hidden />
                          </button>
                        ) : (
                          <span className="w-[40px]" aria-hidden />
                        )}
                        {batchOffPeriods.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setBatchOffPeriods((prev) =>
                                prev.length <= 1 ? prev : prev.filter((p) => p.id !== period.id)
                              )
                            }
                            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                            title="이 기간 삭제"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
              {batchOffPeriodsValid && (
                <p className="mt-1 text-xs text-gray-500">
                  중복 날짜는 한 번만 반영되어 총{' '}
                  <span className="font-medium text-gray-700">{batchOffUniqueDayCount}일</span>이 적용됩니다.
                  {batchOffPeriods.length > 1 && ' (여러 기간 합산)'}
                </p>
              )}
            </div>

            {/* 사유 선택/입력 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사유 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {['연차', '반차', '병가', '경조사', '출장', '교육', '기타'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setBatchOffReason(reason === '기타' ? '' : reason)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      batchOffReason === reason
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-500'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={batchOffReason}
                onChange={(e) => setBatchOffReason(e.target.value)}
                placeholder="사유를 입력하세요 (위 버튼으로 빠른 선택 가능)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
            </div>

            {/* 요약 */}
            {batchOffGuides.length > 0 && batchOffPeriodsValid && batchOffReason && (
              <div className="mb-5 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  <span className="font-medium">{batchOffGuides.length}명</span>의 가이드에 대해{' '}
                  <span className="font-medium">합산 {batchOffUniqueDayCount}일</span>간{' '}
                  총{' '}
                  <span className="font-medium text-orange-600">
                    {batchOffGuides.length * batchOffUniqueDayCount}건
                  </span>
                  의 오프 스케줄이 생성됩니다.
                  {batchOffPeriods.length > 1 && ' (중복 일자는 제외)'}
                </p>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowBatchOffModal(false)
                  resetBatchOffModalFields()
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleBatchOffScheduleCreate}
                disabled={
                  batchOffSaving ||
                  batchOffGuides.length === 0 ||
                  !batchOffPeriodsValid ||
                  !batchOffReason.trim()
                }
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {batchOffSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    저장 중...
                  </>
                ) : (
                  '일괄 추가'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 오프 스케줄 액션 모달 */}
      {showOffScheduleActionModal && selectedOffSchedule && (() => {
        // 기존 오프 스케줄인지 확인 (reason이 있고, offSchedules에 존재하는지 확인)
        const existingOffSchedule = offSchedules.find(off => 
          off.team_email === selectedOffSchedule.team_email && 
          off.off_date === selectedOffSchedule.off_date
        )
        const isNewSchedule = !existingOffSchedule && (!selectedOffSchedule.reason || selectedOffSchedule.reason.trim() === '')
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isNewSchedule ? '오프 스케줄 추가' : '오프 스케줄 액션'}
                </h3>
                <button
                  onClick={() => {
                    setShowOffScheduleActionModal(false)
                    setSelectedOffSchedule(null)
                    setNewOffScheduleReason('')
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mb-6">
                <div className="text-sm text-gray-600 mb-4">
                  <span className="font-medium">날짜:</span> {dayjs(selectedOffSchedule.off_date).format('YYYY년 MM월 DD일 (ddd)')}
                </div>
                
                {isNewSchedule ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      사유
                    </label>
                    <input
                      type="text"
                      value={newOffScheduleReason}
                      onChange={(e) => setNewOffScheduleReason(e.target.value)}
                      placeholder="오프 스케줄 사유를 입력하세요"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">사유:</span> {selectedOffSchedule.reason}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">상태:</span> {
                        selectedOffSchedule.status === 'pending' ? '대기중' :
                        selectedOffSchedule.status === 'approved' ? '승인됨' :
                        selectedOffSchedule.status === 'rejected' ? '거절됨' :
                        '알 수 없음'
                      }
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col space-y-3">
                {isNewSchedule ? (
                  <button
                    onClick={async () => {
                      if (!newOffScheduleReason.trim()) {
                        showMessage('입력 필요', '사유를 입력해주세요.', 'error')
                        return
                      }
                      
                      try {
                        const { error } = await supabase
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          .from('off_schedules' as any)
                          .insert({
                            id: crypto.randomUUID(),
                            team_email: selectedOffSchedule.team_email,
                            off_date: selectedOffSchedule.off_date,
                            reason: newOffScheduleReason.trim(),
                            status: 'pending'
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          } as any)

                        if (error) {
                          console.error('Error creating off schedule:', error)
                          showMessage('생성 실패', '오프 스케줄 생성에 실패했습니다.', 'error')
                          return
                        }

                        await fetchData()
                        setShowOffScheduleActionModal(false)
                        setSelectedOffSchedule(null)
                        setNewOffScheduleReason('')
                        showMessage('생성 완료', '오프 스케줄이 생성되었습니다.', 'success')
                      } catch (error) {
                        console.error('Error creating off schedule:', error)
                        showMessage('오류 발생', '오프 스케줄 생성 중 오류가 발생했습니다.', 'error')
                      }
                    }}
                    className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    오프 스케줄 추가
                  </button>
                ) : (
                  <>
                    {selectedOffSchedule.status === 'pending' && (
                      <button
                        onClick={() => {
                          showConfirm(
                            '오프 스케줄 승인',
                            '오프 스케줄을 승인하시겠습니까?',
                            () => handleOffScheduleApprove(selectedOffSchedule),
                            '승인',
                            'bg-green-500 hover:bg-green-600'
                          )
                        }}
                        className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                      >
                        승인
                      </button>
                    )}
                    {selectedOffSchedule.status === 'pending' && (
                      <button
                        onClick={() => {
                          showConfirm(
                            '오프 스케줄 거절',
                            '오프 스케줄을 거절하시겠습니까?',
                            () => handleOffScheduleReject(selectedOffSchedule),
                            '거절',
                            'bg-orange-500 hover:bg-orange-600'
                          )
                        }}
                        className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                      >
                        거절
                      </button>
                    )}
                    <button
                      onClick={() => {
                        showConfirm(
                          '오프 스케줄 삭제',
                          '오프 스케줄을 삭제하시겠습니까?',
                          () => handleOffScheduleDelete(selectedOffSchedule),
                          '삭제',
                          'bg-red-500 hover:bg-red-600'
                        )
                      }}
                      className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                    >
                      삭제
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setShowOffScheduleActionModal(false)
                    setSelectedOffSchedule(null)
                    setNewOffScheduleReason('')
                  }}
                  className="w-full px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 차량 스케줄: 날짜 셀 클릭 시 투어 배정 모달 */}
      {showVehicleAssignModal && vehicleAssignTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg p-4 max-w-lg w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                차량 배정 — {monthVehiclesWithColors.vehicleList.find(v => v.id === vehicleAssignTarget.vehicleId)?.label || vehicleAssignTarget.vehicleId} / {vehicleAssignTarget.dateString}
              </h3>
              <button
                type="button"
                onClick={() => { setShowVehicleAssignModal(false); setVehicleAssignTarget(null) }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {(() => {
              const dateString = vehicleAssignTarget.dateString
              const tourCovers = (t: Tour) => {
                if (t.tour_date === dateString) return true
                const days = getMultiDayTourDays(t.product_id)
                if (days <= 1) return false
                const start = dayjs(t.tour_date)
                const end = start.add(days - 1, 'day')
                return !dayjs(dateString).isBefore(start, 'day') && !dayjs(dateString).isAfter(end, 'day')
              }
              const dayToursForNames = tours
                .filter(t => tourCovers(t))
                .filter(t => t.tour_car_id && String(t.tour_car_id).trim())
                .filter(t => {
                  const s = (t.tour_status || '').toString().toLowerCase()
                  return s !== 'cancelled' && !s.includes('cancel') && s !== 'deleted'
                })
              const nameSet = new Set<string>()
              const isValidName = (n: string) => n && n.trim() && n.trim() !== '-'
              dayToursForNames.forEach(t => {
                const guide = teamMembers.find(m => m.email === t.tour_guide_id)
                const guideName = (guide?.nick_name || guide?.name_ko || t.tour_guide_id || '').trim() || '-'
                if (isValidName(guideName)) nameSet.add(guideName)
                const asst = teamMembers.find(m => m.email === t.assistant_id)
                const asstName = (asst?.nick_name || asst?.name_ko || t.assistant_id || '').trim() || '-'
                if (isValidName(asstName)) nameSet.add(asstName)
                const carDriver = (t as { car_driver_name?: string | null }).car_driver_name
                if (carDriver && isValidName(String(carDriver).trim())) nameSet.add(String(carDriver).trim())
                else if (((t.team_type || '').toString().toLowerCase() === 'guide+driver' || (t.team_type || '').toString().toLowerCase() === 'guide + driver') && t.assistant_id && isValidName(asstName)) nameSet.add(asstName)
              })
              const assignedNames = [...nameSet].filter(isValidName).sort()
              return (
                <p className="text-sm text-gray-600 mb-3">
                  {assignedNames.length > 0 ? (
                    <>배정된 사람: {assignedNames.join(', ')} (총 {assignedNames.length}명)</>
                  ) : (
                    '해당 날짜에 배정된 투어가 없습니다.'
                  )}
                </p>
              )
            })()}
            <div className="overflow-y-auto flex-1 min-h-0 space-y-2">
              {tours
                .filter(t => t.tour_date === vehicleAssignTarget.dateString)
                .filter(t => {
                  const s = (t.tour_status || '').toString().toLowerCase()
                  return s !== 'cancelled' && !s.includes('cancel') && s !== 'deleted'
                })
                .map(tour => {
                  const guide = teamMembers.find(m => m.email === tour.tour_guide_id)
                  const assistant = teamMembers.find(m => m.email === tour.assistant_id)
                  const carDriver = (tour as { car_driver_name?: string | null }).car_driver_name
                  const asstOrDriverName = (carDriver && String(carDriver).trim())
                    ? String(carDriver).trim()
                    : (assistant ? (assistant as { nick_name?: string; name_ko?: string }).nick_name || assistant.name_ko || '-' : '-')
                  const productName = (tour as { products?: { name?: string } | null })?.products?.name || tour.product_id || '-'
                  const currentCarId = tour.tour_car_id && String(tour.tour_car_id).trim()
                  const isAlreadyThis = currentCarId === vehicleAssignTarget.vehicleId
                  return (
                    <div
                      key={tour.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${isAlreadyThis ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">{productName}</div>
                        <div className="text-xs text-gray-500">
                          가이드: {(guide as { nick_name?: string; name_ko?: string })?.nick_name || guide?.name_ko || '-'}
                          {' · 어시스턴트/드라이버: '}{asstOrDriverName}
                          {currentCarId ? ` · 차량: ${monthVehiclesWithColors.vehicleList.find(v => v.id === currentCarId)?.label || currentCarId}` : ' · 미배정'}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isAlreadyThis}
                        onClick={() => {
                          if (isAlreadyThis) return
                          setPendingChanges(prev => ({ ...prev, [tour.id]: { ...prev[tour.id], tour_car_id: vehicleAssignTarget.vehicleId } }))
                          setTours(prev => prev.map(t => t.id === tour.id ? { ...t, tour_car_id: vehicleAssignTarget.vehicleId, vehicle_number: monthVehiclesWithColors.vehicleList.find(v => v.id === vehicleAssignTarget.vehicleId)?.label ?? null } : t))
                          setShowVehicleAssignModal(false)
                          setVehicleAssignTarget(null)
                          requestSaveAfterDragAssignment()
                        }}
                        className={`ml-2 px-3 py-1.5 text-sm rounded-lg whitespace-nowrap ${isAlreadyThis ? 'bg-gray-300 text-gray-500 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                      >
                        {isAlreadyThis ? '현재 배정됨' : '이 차량에 배정'}
                      </button>
                    </div>
                  )
                })}
            </div>
            {tours.filter(t => t.tour_date === vehicleAssignTarget.dateString).filter(t => { const s = (t.tour_status || '').toString().toLowerCase(); return s !== 'cancelled' && !s.includes('cancel') && s !== 'deleted'; }).length === 0 && (
              <p className="text-sm text-gray-500 py-4">해당 날짜에 배정 가능한 투어가 없습니다.</p>
            )}
            <div className="mt-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => { setShowVehicleAssignModal(false); setVehicleAssignTarget(null) }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {showVehicleEditModal && (
        <VehicleEditModal
          vehicle={vehicleEditModalVehicle}
          prefill={vehicleEditModalVehicle ? null : vehicleEditModalPrefill}
          onSave={handleVehicleEditModalSave}
          onClose={() => {
            setShowVehicleEditModal(false)
            setVehicleEditModalVehicle(null)
            setVehicleEditModalPrefill(null)
          }}
        />
      )}
      <CancellationReasonModal
        isOpen={cancellationReasonModalOpen}
        locale={locale}
        initialValue={cancellationReasonValue}
        saving={cancellationReasonSaving}
        onClose={closeCancellationReasonModal}
        onSubmit={submitCancellationReasonModal}
      />

    </div>
  )
}
