'use client'

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Plus, Users, DollarSign, Eye, Clock, Edit, MessageSquare, X, FileText, Printer, Flag, Hotel, Receipt, CheckCircle2, CircleCheck, XCircle, HelpCircle, MessageCircleQuestion, UserX, MoreHorizontal, CalendarPlus, CalendarX } from 'lucide-react'
import { useTranslations } from 'next-intl'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - react-country-flag may lack types
import ReactCountryFlag from 'react-country-flag'
import { 
  getPickupHotelDisplay, 
  getCustomerName, 
  getProductName, 
  getChannelName, 
  getStatusLabel, 
  getStatusColor, 
  normalizeTourDateKey
} from '@/utils/reservationUtils'
import { isRebookingCancellationReason } from '@/lib/reservationCancellationReason'
import { ResidentStatusIcon } from '@/components/reservation/ResidentStatusIcon'
import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'
import { ChoicesDisplay } from '@/components/reservation/ChoicesDisplay'
import ReservationFollowUpSection from '@/components/reservation/ReservationFollowUpSection'
import { ReservationFollowUpPipelineIcons } from '@/components/reservation/ReservationFollowUpPipelineIcons'
import CancelledSimpleCardFollowUpStrip from '@/components/reservation/CancelledSimpleCardFollowUpStrip'
import { SimilarCustomerReservationsHintButton } from '@/components/reservation/SimilarCustomerReservationsHintButton'
import TourChatRoomEmailPreviewModal from '@/components/reservation/TourChatRoomEmailPreviewModal'
import type { CancelFollowUpManualKind } from '@/components/reservation/ReservationFollowUpQueueModal'
import type { ReservationFollowUpPipelineSnapshot, FollowUpPipelineStepKey } from '@/lib/reservationFollowUpPipeline'
import { supabase } from '@/lib/supabase'
import type { Reservation, Customer } from '@/types/reservation'
import { CustomerCommunicationChannelPicker } from '@/components/reservation/CustomerCommunicationChannelPicker'
import { ReservationCardSmsMenuButton } from '@/components/reservation/ReservationCardSmsMenuButton'
import type { CustomerCommunicationChannel } from '@/lib/customerCommunicationChannel'
import { ADMIN_FLOATING_PORTAL_Z_INDEX } from '@/lib/adminFloatingFabLayout'

function getLanguageFlagCountryCode(language: string | undefined | null): string {
  if (!language) return 'US'
  const lang = language.toLowerCase().trim()
  if (lang === 'kr' || lang === 'ko' || lang.startsWith('ko-') || lang === 'korean') return 'KR'
  if (lang === 'en' || lang.startsWith('en-') || lang === 'english') return 'US'
  if (lang === 'ja' || lang === 'jp' || lang.startsWith('ja-') || lang === 'japanese') return 'JP'
  if (lang === 'zh' || lang === 'cn' || lang.startsWith('zh-') || lang === 'chinese') return 'CN'
  if (lang === 'es' || lang.startsWith('es-') || lang === 'spanish') return 'ES'
  if (lang === 'fr' || lang.startsWith('fr-') || lang === 'french') return 'FR'
  if (lang === 'de' || lang.startsWith('de-') || lang === 'german') return 'DE'
  if (lang === 'it' || lang.startsWith('it-') || lang === 'italian') return 'IT'
  if (lang === 'pt' || lang.startsWith('pt-') || lang === 'portuguese') return 'PT'
  if (lang === 'ru' || lang.startsWith('ru-') || lang === 'russian') return 'RU'
  if (lang === 'th' || lang === 'thai') return 'TH'
  if (lang === 'vi' || lang === 'vietnamese') return 'VN'
  if (lang === 'id' || lang === 'indonesian') return 'ID'
  if (lang === 'ms' || lang === 'malay') return 'MY'
  if (lang === 'ph' || lang === 'filipino' || lang === 'tl') return 'PH'
  return 'US'
}

function formatTourDateMmDdYyyy(tourDate: string | null | undefined): string {
  if (!tourDate?.trim()) return '-'
  const raw = tourDate.trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
  const parsed = Date.parse(raw)
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${mm}/${dd}/${d.getFullYear()}`
  }
  return raw
}

function normalizeReservationStatusKey(statusRaw: string): string {
  return statusRaw.trim().toLowerCase().replace(/\s+/g, '_')
}

function reservationStatusIcon(statusRaw: string, className = 'h-4 w-4'): React.ReactNode {
  const s = normalizeReservationStatusKey(statusRaw)
  if (s === 'inquiry') return <MessageCircleQuestion className={`${className} text-sky-700`} aria-hidden />
  if (s === 'pending') return <Clock className={`${className} text-amber-700`} aria-hidden />
  if (s === 'confirmed') return <CheckCircle2 className={`${className} text-emerald-700`} aria-hidden />
  if (s === 'completed') return <CircleCheck className={`${className} text-primary`} aria-hidden />
  if (s === 'cancelled' || s === 'canceled' || s === 'cancelled_rebooking') {
    return <XCircle className={`${className} text-red-700`} aria-hidden />
  }
  if (s === 'no_show' || s === 'noshow') return <UserX className={`${className} text-orange-700`} aria-hidden />
  return <HelpCircle className={`${className} text-gray-500`} aria-hidden />
}

function simpleCardTourStatusGlyph(statusRaw: string): React.ReactNode {
  const x = statusRaw.trim().toLowerCase()
  const cls = 'h-3.5 w-3.5 shrink-0'
  if (x === 'confirmed') return <CheckCircle2 className={`${cls} text-emerald-600`} aria-hidden />
  if (x === 'completed') return <CircleCheck className={`${cls} text-primary`} aria-hidden />
  if (x === 'cancelled' || x === 'canceled') return <XCircle className={`${cls} text-red-600`} aria-hidden />
  return <HelpCircle className={`${cls} text-gray-400`} aria-hidden />
}

function formatCardLocaleDate(raw: string | null | undefined, locale: string): string {
  if (!raw?.trim()) return '-'
  const parsed = Date.parse(raw)
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  return raw.trim()
}

function formatCardTimestampMmDdYyyyHm(raw: string | null | undefined, locale: string): string {
  if (!raw?.trim()) return '—'
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return raw.trim()
  const d = new Date(parsed)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const time = d.toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${mm}/${dd}/${d.getFullYear()} ${time}`
}

function formatRegistrationDateForCard(
  reservation: Reservation,
  locale: string,
  includeTime = false
): string {
  const raw =
    reservation.addedTime ||
    (reservation as { created_at?: string | null }).created_at ||
    ''
  return includeTime ? formatCardTimestampMmDdYyyyHm(raw, locale) : formatCardLocaleDate(raw, locale)
}

function formatCancellationDateForCard(reservation: Reservation, locale: string): string {
  const ext = reservation as {
    cancellation_recorded_at?: string | null
    updated_at?: string | null
  }
  const raw = ext.cancellation_recorded_at ?? ext.updated_at ?? null
  return formatCardTimestampMmDdYyyyHm(raw, locale)
}

interface ReservationCardItemProps {
  reservation: Reservation
  customers: Customer[]
  products: Array<{ id: string; name: string; sub_category?: string; product_code?: string | null }>
  channels: Array<{ id: string; name: string; favicon_url?: string }>
  pickupHotels: Array<{ id: string; hotel?: string | null; name?: string | null; name_ko?: string | null; pick_up_location?: string | null }>
  productOptions: Array<{ id: string; name: string; is_required?: boolean }>
  optionChoices: Array<{ id: string; name: string }>
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
    maxParticipants?: number
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
  onReceiptClick?: (reservation: Reservation) => void
  onReviewClick: (reservation: Reservation) => void
  onEmailPreview: (
    reservation: Reservation,
    emailType: 'confirmation' | 'departure' | 'pickup' | 'resident_inquiry'
  ) => void
  onEmailLogsClick: (reservationId: string) => void
  onEditClick: (reservationId: string) => void
  onCustomerClick: (customer: Customer) => void
  onRefreshReservations: () => void
  onStatusChange?: (reservationId: string, newStatus: string) => Promise<void>
  generatePriceCalculation: (reservation: Reservation, pricing: any) => string
  getGroupColorClasses: (groupId: string, groupName?: string, optionName?: string) => string
  getSelectedChoicesFromNewSystem: (reservationId: string) => Promise<Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: {
      option_key: string
      option_name: string
      option_name_ko: string
      internal_name?: string
      product_choices: {
        choice_group_ko: string
      }
    }
  }>>
  choicesCacheRef: React.MutableRefObject<Map<string, Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: {
      option_key: string
      option_name: string
      option_name_ko: string
      internal_name?: string
      product_choices: {
        choice_group_ko: string
      }
    }
  }>>>
  /** reservations.tour_id or tours.reservation_ids-derived tour ID */
  linkedTourId?: string | null
  /** Card density: full detail vs compact rows */
  onOpenTourDetailModal?: (tourId: string) => void
  reservationOptionsPresenceByReservationId?: Map<string, boolean>
  onReservationOptionsMutated?: (reservationId: string) => void
  /** 이메일 Follow-up 파이프라인(컨펌·거주·출발·픽업) 표시용 스냅샷 */
  followUpPipelineSnapshot?: ReservationFollowUpPipelineSnapshot | null
  /** follow-up 스냅샷 로드 완료 여부 */
  followUpPipelineSnapshotLoaded?: boolean
  /** 간단 카드: 파이프라인 아이콘 우클릭 시 다른 채널 완료 표시 */
  onFollowUpPipelineManualChange?: (
    reservationId: string,
    step: FollowUpPipelineStepKey,
    action: 'mark' | 'clear'
  ) => void | Promise<void>
  /** 간단 카드·취소: 취소 후 Follow-up 수동 완료(전화·재예약 권유) */
  onCancelFollowUpManualChange?: (
    reservationId: string,
    kind: CancelFollowUpManualKind,
    action: 'mark' | 'clear'
  ) => void | Promise<void>
  /** 픽업 요약 모달 재표시 요청 */
  reshowPickupSummaryRequest?: { reservationId: string; nonce: number } | null
  onReshowPickupSummaryConsumed?: () => void
  /** 예약 관리: 목록 로드 시 배치로 채운 reservation_customers (카드별 GET 감소) */
  residentCustomerBatchMap?: Map<string, { resident_status: string | null }[]>
  /** 간단 카드: 고객 소통 채널 변경 */
  onCommunicationChannelChange?: (
    reservationId: string,
    channel: CustomerCommunicationChannel
  ) => void | Promise<void>
  /** 간단 카드: 사전연락 SMS 발송 시 sent_by */
  sentBy?: string | null
  /** 간단 카드: SMS 발송 성공 후 (예: 소통 채널 UI 갱신) */
  onPreTourSmsSendSuccess?: (reservationId: string) => void
  /** 간단 카드: SMS 발송 내역 모달 */
  onSmsLogsClick?: (reservationId: string) => void
  /** 취소 사유 저장 후 부모 갱신(큐 모달 등) */
  onCancellationReasonSaved?: () => void
  /** 유사 고객 예약 배지·모달 (취소 예약) */
  similarCustomerProductMap?: Map<string, string>
  operatorId?: string | null
  /** false면 유사 고객 DB 조회 생략 (취소 사유 큐 모달 등) */
  showSimilarCustomerReservationsHint?: boolean
}

function tourDateProximityBorderClasses(tourDate: string | null | undefined): string {
  const key = normalizeTourDateKey(tourDate)
  const iso = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!iso) return 'border border-gray-200'
  const y = Number(iso[1])
  const mo = Number(iso[2])
  const d = Number(iso[3])
  const tour = new Date(y, mo - 1, d)
  if (Number.isNaN(tour.getTime())) return 'border border-gray-200'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((tour.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return 'border border-gray-200'
  if (diffDays < 3) return 'border border-gray-200 ring-2 ring-inset ring-red-500'
  if (diffDays <= 7) return 'border border-gray-200 ring-2 ring-inset ring-primary'
  return 'border border-gray-200'
}

export const ReservationCardItem = React.memo(function ReservationCardItem({
  reservation,
  customers,
  products,
  channels,
  pickupHotels,
  productOptions: _productOptions,
  optionChoices: _optionChoices,
  tourInfoMap,
  reservationPricingMap: _reservationPricingMap,
  locale,
  onPricingInfoClick,
  onCreateTour,
  onPickupTimeClick,
  onPickupHotelClick,
  onPaymentClick,
  onDetailClick,
  onReceiptClick,
  onReviewClick,
  onEmailPreview,
  onEmailLogsClick,
  onEditClick,
  onCustomerClick,
  onRefreshReservations,
  onStatusChange,
  generatePriceCalculation: _generatePriceCalculation,
  getGroupColorClasses,
  getSelectedChoicesFromNewSystem,
  choicesCacheRef,
  linkedTourId = null,
  onOpenTourDetailModal,
  reservationOptionsPresenceByReservationId: _reservationOptionsPresence,
  onReservationOptionsMutated: _onReservationOptionsMutated,
  reshowPickupSummaryRequest = null,
  onReshowPickupSummaryConsumed,
  followUpPipelineSnapshot = null,
  followUpPipelineSnapshotLoaded = false,
  onFollowUpPipelineManualChange,
  onCancelFollowUpManualChange,
  residentCustomerBatchMap,
  onCommunicationChannelChange,
  sentBy = null,
  onPreTourSmsSendSuccess,
  onSmsLogsClick,
  onCancellationReasonSaved,
  similarCustomerProductMap,
  operatorId,
  showSimilarCustomerReservationsHint = true,
}: ReservationCardItemProps) {
  const t = useTranslations('reservations')
  const router = useRouter()

  const prefetchedResidentCustomerRows = residentCustomerBatchMap?.get(reservation.id)

  const reservationProduct = products.find((p) => p.id === reservation.productId)
  const showResidentStatusUi = productShowsResidentStatusSectionByCode(
    reservationProduct?.product_code ?? null
  )

  const normalizeTourId = (raw: string | null | undefined) => {
    const s = (raw || '').trim()
    if (!s || s === 'null' || s === 'undefined') return ''
    return s
  }
  const reservationIdNorm = String(reservation.id ?? '').trim()
  const tourIdFromReservationRow =
    normalizeTourId(reservation.tourId) ||
    normalizeTourId((reservation as { tour_id?: string }).tour_id)
  const tourInfoForDbTour = tourIdFromReservationRow ? tourInfoMap.get(tourIdFromReservationRow) : undefined
  const dbTourListsThisReservation =
    !!tourInfoForDbTour?.reservationIds?.some((x) => String(x ?? '').trim() === reservationIdNorm)
  /**
   * 대표 투어: (1) tours.reservation_ids 기반 linkedTourId
   * (2) 예약 row의 tour_id는 해당 투어의 reservation_ids에 이 예약이 있을 때만 사용 (오래된 tour_id 오표시 방지)
   */
  const effectiveTourId =
    normalizeTourId(linkedTourId) || (dbTourListsThisReservation ? tourIdFromReservationRow : '')

  const reservationStatusLower = (reservation.status as string)?.toLowerCase?.() || ''
  const isReservationCancelled =
    reservationStatusLower === 'cancelled' || reservationStatusLower === 'canceled'
  const linkedCustomer = customers.find((c) => c.id === reservation.customerId)
  const similarReservationsHint =
    showSimilarCustomerReservationsHint &&
    isReservationCancelled &&
    linkedCustomer &&
    similarCustomerProductMap ? (
      <SimilarCustomerReservationsHintButton
        customer={linkedCustomer}
        allCustomers={customers}
        productMap={similarCustomerProductMap}
        operatorId={operatorId ?? null}
        onOpen={onCustomerClick}
      />
    ) : null
  /** 삭제만 파이프라인 비활성. 취소 건은 발송 이력(컨펌·거주·출발·픽업) 아이콘을 계속 표시 */
  const followUpPipelineIconsDisabled = reservationStatusLower === 'deleted'
  const hideAssignedTourUi =
    reservationStatusLower === 'cancelled' ||
    reservationStatusLower === 'canceled' ||
    reservationStatusLower === 'deleted'

  const sameDayProductTourBadges = useMemo(() => {
    if (!hideAssignedTourUi) return []
    const productId = String(reservation.productId ?? '').trim()
    const tourDateKey = normalizeTourDateKey(reservation.tourDate)
    if (!productId || !tourDateKey) return []

    const badges: Array<{ tourId: string; assigned: number; max: number; sortKey: string }> = []
    tourInfoMap.forEach((info, tourId) => {
      if (String(info.productId ?? '').trim() !== productId) return
      if (normalizeTourDateKey(info.tourDate) !== tourDateKey) return
      badges.push({
        tourId,
        assigned: info.totalPeople,
        max: info.maxParticipants ?? 12,
        sortKey: info.tourStartDatetime ?? tourId,
      })
    })
    return badges.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [hideAssignedTourUi, reservation.productId, reservation.tourDate, tourInfoMap])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false)
  const [simpleMoreMenuOpen, setSimpleMoreMenuOpen] = useState(false)
  const [pickupSummaryModalOpen, setPickupSummaryModalOpen] = useState(false)
  const [pickupSummaryPortalReady, setPickupSummaryPortalReady] = useState(false)
  const [tourChatRoomPreviewOpen, setTourChatRoomPreviewOpen] = useState(false)
  const [cancelReasonBadge, setCancelReasonBadge] = useState<string | null>(null)
  const [cancelReasonFetchIx, setCancelReasonFetchIx] = useState(0)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const simpleMoreMenuRef = useRef<HTMLDivElement>(null)
  const simpleMoreMenuButtonRef = useRef<HTMLButtonElement>(null)
  const simpleMoreMenuPanelRef = useRef<HTMLDivElement>(null)
  const [simpleMoreMenuPos, setSimpleMoreMenuPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!reshowPickupSummaryRequest) return
    if (reshowPickupSummaryRequest.reservationId !== reservation.id) return
    setPickupSummaryModalOpen(true)
    onReshowPickupSummaryConsumed?.()
  }, [reshowPickupSummaryRequest, reservation.id, onReshowPickupSummaryConsumed])

  useEffect(() => {
    setPickupSummaryPortalReady(true)
  }, [])

  useEffect(() => {
    if (!statusDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [statusDropdownOpen])

  useEffect(() => {
    if (!simpleMoreMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        simpleMoreMenuRef.current?.contains(target) ||
        simpleMoreMenuPanelRef.current?.contains(target)
      ) {
        return
      }
      setSimpleMoreMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [simpleMoreMenuOpen])

  useLayoutEffect(() => {
    if (!simpleMoreMenuOpen) {
      setSimpleMoreMenuPos(null)
      return
    }

    const positionMenu = () => {
      const btn = simpleMoreMenuButtonRef.current
      const panel = simpleMoreMenuPanelRef.current
      if (!btn) return

      const rect = btn.getBoundingClientRect()
      const menuWidth = 208
      const menuHeight = panel?.offsetHeight ?? 320
      const pad = 8
      const headerBottom = 64

      const left = Math.min(
        Math.max(pad, rect.right - menuWidth),
        window.innerWidth - menuWidth - pad
      )

      const spaceAbove = rect.top - headerBottom - pad
      const spaceBelow = window.innerHeight - rect.bottom - pad
      const openAbove = spaceAbove >= menuHeight || spaceAbove >= spaceBelow

      let top = openAbove ? rect.top - menuHeight - 4 : rect.bottom + 4
      top = Math.max(headerBottom + pad, top)
      top = Math.min(top, window.innerHeight - menuHeight - pad)

      setSimpleMoreMenuPos({ top, left })
    }

    positionMenu()
    const raf = requestAnimationFrame(positionMenu)
    window.addEventListener('resize', positionMenu)
    const closeOnScroll = () => setSimpleMoreMenuOpen(false)
    window.addEventListener('scroll', closeOnScroll, true)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [simpleMoreMenuOpen])

  useEffect(() => {
    if (!isReservationCancelled) {
      setCancelReasonBadge(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await (supabase as any)
        .from('reservation_follow_ups')
        .select('content')
        .eq('reservation_id', reservation.id)
        .eq('type', 'cancellation_reason')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled || error) return
      const text = String((data as { content?: string | null } | null)?.content ?? '').trim()
      setCancelReasonBadge(text.length > 0 ? text : null)
    })()
    return () => {
      cancelled = true
    }
  }, [isReservationCancelled, reservation.id, cancelReasonFetchIx])

  const statusOptions = [
    { value: 'inquiry', labelKey: 'status.inquiry' },
    { value: 'pending', labelKey: 'status.pending' },
    { value: 'confirmed', labelKey: 'status.confirmed' },
    { value: 'completed', labelKey: 'status.completed' },
    { value: 'cancelled', labelKey: 'status.cancelled' },
    { value: 'cancelled_rebooking', labelKey: 'status.cancelled_rebooking' },
    { value: 'no_show', labelKey: 'status.no_show' },
  ] as const

  const handleStatusSelect = async (newStatus: string) => {
    if (!onStatusChange) {
      setStatusDropdownOpen(false)
      setStatusModalOpen(false)
      return
    }
    const currentStatus = (reservation.status as string)?.toLowerCase?.() ?? ''
    if (newStatus === 'cancelled_rebooking') {
      if (currentStatus === 'cancelled' && isRebookingCancellationReason(cancelReasonBadge)) {
        setStatusDropdownOpen(false)
        setStatusModalOpen(false)
        return
      }
    } else if (newStatus === currentStatus) {
      setStatusDropdownOpen(false)
      setStatusModalOpen(false)
      return
    }
    setStatusUpdating(true)
    try {
      await onStatusChange(reservation.id, newStatus)
      if (newStatus === 'cancelled_rebooking') {
        setCancelReasonBadge('재예약')
        setCancelReasonFetchIx((n) => n + 1)
      }
      setStatusDropdownOpen(false)
      setStatusModalOpen(false)
    } finally {
      setStatusUpdating(false)
    }
  }

  const tourDateBorderClass = tourDateProximityBorderClasses(reservation.tourDate)

  // Pickup summary (modal): pickup date/time display without click handler.
  const pickupSummaryTimeDisplay = (() => {
    const pickupTime = reservation.pickUpTime || ''
    if (!pickupTime) {
      return <span className="text-sm text-gray-500 italic">{t('card.pickupTbd')}</span>
    }
    let pickupDate = reservation.tourDate || ''
    const timeMatch = pickupTime.match(/(\d{1,2}):(\d{2})/)
    if (timeMatch && reservation.tourDate) {
      const hour = parseInt(timeMatch[1], 10)
      if (hour >= 21) {
        const d = new Date(reservation.tourDate)
        d.setDate(d.getDate() - 1)
        pickupDate = d.toISOString().split('T')[0]
      }
    }
    return (
      <span className="text-sm text-gray-900">
        {pickupDate} {pickupTime}
      </span>
    )
  })()

  return (
    <div
      key={reservation.id}
      className={`bg-white rounded-lg shadow-md ${tourDateBorderClass} hover:shadow-lg transition-shadow duration-200 group w-full max-w-full min-w-0 h-full`}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement
        if (
          target.closest(
            'button, a, input, select, textarea, [role="menu"], [role="menuitem"], .fixed.inset-0'
          )
        ) {
          return
        }
        onEditClick(reservation.id)
      }}
    >
      
        <div className="flex h-full flex-col p-3 space-y-2">
          {/* Row 1 */}
          <div className="flex justify-between items-center gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {onStatusChange ? (
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(true)}
                  disabled={statusUpdating}
                  title={getStatusLabel(reservation.status, t)}
                  aria-label={getStatusLabel(reservation.status, t)}
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full cursor-pointer hover:opacity-90 disabled:opacity-70 ${getStatusColor(reservation.status)}`}
                >
                  {reservationStatusIcon(String(reservation.status), 'h-4 w-4')}
                </button>
              ) : (
                <span
                  title={getStatusLabel(reservation.status, t)}
                  aria-label={getStatusLabel(reservation.status, t)}
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${getStatusColor(reservation.status)}`}
                >
                  {reservationStatusIcon(String(reservation.status), 'h-4 w-4')}
                </span>
              )}
              {(() => {
                const customer = customers.find((c) => c.id === reservation.customerId)
                if (!customer?.language) return null
                const code = getLanguageFlagCountryCode(customer.language)
                return (
                  <ReactCountryFlag
                    countryCode={code}
                    svg
                    style={{ width: '14px', height: '11px', borderRadius: '2px', flexShrink: 0 }}
                  />
                )
              })()}
              <button
                type="button"
                className={`min-w-0 truncate text-left text-sm font-medium hover:underline ${
                  isReservationCancelled
                    ? 'text-gray-400 hover:text-gray-500'
                    : 'text-gray-900 hover:text-primary'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  const customer = customers.find((c) => c.id === reservation.customerId)
                  if (customer) onCustomerClick(customer)
                }}
              >
                {getCustomerName(reservation.customerId, customers || [])}
              </button>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 leading-none">
              {onCommunicationChannelChange ? (
                <CustomerCommunicationChannelPicker
                  compact
                  align="right"
                  value={reservation.customerCommunicationChannel}
                  channelId={reservation.channelId}
                  channelName={
                    reservation.channelNameSnapshot ??
                    getChannelName(reservation.channelId, channels || [])
                  }
                  onChange={(channel) => onCommunicationChannelChange(reservation.id, channel)}
                />
              ) : null}
              {showResidentStatusUi && (
                <ResidentStatusIcon
                  compact
                  reservationId={reservation.id}
                  customerId={reservation.customerId}
                  totalPeople={(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}
                  onUpdate={onRefreshReservations}
                  {...(prefetchedResidentCustomerRows !== undefined
                    ? { prefetchedResidentCustomerRows }
                    : {})}
                />
              )}
              {(() => {
                const channel = channels?.find((c) => c.id === reservation.channelId)
                const chName = getChannelName(reservation.channelId, channels || [])
                return (
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                    {channel?.favicon_url ? (
                      <img
                        src={channel.favicon_url}
                        alt={chName || 'Channel'}
                        className="block h-4 w-4 rounded object-cover"
                        title={chName}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    ) : (
                      <span className="h-4 w-4 rounded bg-gray-100 block" title={chName || ''} aria-hidden />
                    )}
                  </span>
                )
              })()}
              <span className="inline-flex h-4 items-center gap-0.5 text-[11px] font-semibold text-gray-800 tabular-nums" title={t('peopleLabel')}>
                <Users className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
                {(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}
              </span>
            </div>
          </div>

          {/* Row 2: 투어일·상품·뱃지 */}
          <div className="flex items-center gap-x-2 gap-y-1.5 min-w-0">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="shrink-0 text-xs font-medium text-gray-900 tabular-nums">
                {formatTourDateMmDdYyyy(reservation.tourDate)}
              </span>
              <span className="text-xs font-medium text-gray-900 break-words [overflow-wrap:anywhere]">
                {getProductName(reservation.productId, products as any || [])}
              </span>
              <span className="inline-flex shrink-0 flex-wrap items-center gap-1 font-normal [&>span]:!px-1.5 [&>span]:!py-0.5 [&>span]:!text-[11px] [&>span]:!leading-tight">
                <ChoicesDisplay
                  reservation={reservation}
                  getGroupColorClasses={getGroupColorClasses}
                  getSelectedChoicesFromNewSystem={getSelectedChoicesFromNewSystem}
                  choicesCacheRef={choicesCacheRef}
                />
              </span>
            </div>
            {sameDayProductTourBadges.length > 0 ? (
              <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
                {sameDayProductTourBadges.map((badge) => (
                  <button
                    key={badge.tourId}
                    type="button"
                    disabled={!onOpenTourDetailModal}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenTourDetailModal?.(badge.tourId)
                    }}
                    className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium tabular-nums text-slate-700 ring-1 ring-slate-200/80 hover:bg-slate-200/80 disabled:cursor-default disabled:hover:bg-slate-100"
                    title={t('card.tourCapacityBadgeTitle', {
                      assigned: badge.assigned,
                      max: badge.max,
                    })}
                  >
                    <Users className="h-2.5 w-2.5 shrink-0 text-slate-500" aria-hidden />
                    {badge.assigned}/{badge.max}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Row 3: 가이드·차량·인원 (취소 시 등록일·사유) */}
          {(() => {
            if (hideAssignedTourUi) {
              return (
                <div className="flex items-start gap-1 min-w-0">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-gray-600">
                    <span
                      className="inline-flex items-center gap-1 tabular-nums"
                      title={t('card.registrationDateIconTitle')}
                    >
                      <CalendarPlus className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                      <span className="font-medium text-gray-800">
                        {formatRegistrationDateForCard(reservation, locale, true)}
                      </span>
                    </span>
                    {isReservationCancelled ? (
                      <span
                        className="inline-flex flex-wrap items-center gap-1 tabular-nums"
                        title={t('card.cancellationDateIconTitle')}
                      >
                        <CalendarX className="h-3 w-3 shrink-0 text-red-600" aria-hidden />
                        <span className="font-medium text-gray-800">
                          {formatCancellationDateForCard(reservation, locale)}
                        </span>
                        {similarReservationsHint}
                      </span>
                    ) : null}
                  </div>
                  {isReservationCancelled && cancelReasonBadge ? (
                    <span
                      className="max-w-[11rem] shrink-0 truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-800 ring-1 ring-slate-200/80"
                      title={cancelReasonBadge}
                    >
                      {cancelReasonBadge}
                    </span>
                  ) : null}
                </div>
              )
            }
            const tourInfo = effectiveTourId ? tourInfoMap.get(effectiveTourId) : undefined
            const tourStatusLabel = tourInfo?.status ?? '-'
            const g = tourInfo?.guideName && tourInfo.guideName !== '-' ? tourInfo.guideName.trim() : ''
            const a = tourInfo?.assistantName && tourInfo.assistantName !== '-' ? tourInfo.assistantName.trim() : ''
            const guideAssistantLine =
              g && a ? `${g} / ${a}` : g || a || '-'
            const v = tourInfo?.vehicleName && tourInfo.vehicleName !== '-' ? tourInfo.vehicleName : '-'
            const assignedN = tourInfo?.totalPeople ?? null
            return (
              <div className="flex items-center gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] leading-none text-gray-800 min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={!effectiveTourId}
                    onMouseEnter={() => {
                      if (effectiveTourId) void import('@/components/tour/TourDetailModalContent')
                    }}
                    onFocus={() => {
                      if (effectiveTourId) void import('@/components/tour/TourDetailModalContent')
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!effectiveTourId) return
                      if (onOpenTourDetailModal) onOpenTourDetailModal(effectiveTourId)
                      else router.push(`/${locale}/admin/tours/${effectiveTourId}`)
                    }}
                    className="shrink-0 rounded p-0.5 text-primary hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-30"
                    title={t('card.tourDetailModalTitle')}
                  >
                    <Flag className="h-4 w-4" />
                  </button>
                  <span
                    className="max-w-[11rem] truncate tracking-tight"
                    title={guideAssistantLine}
                  >
                    {guideAssistantLine}
                  </span>
                  <span className="inline-flex max-w-[7rem] items-center gap-0.5 text-gray-800 min-w-0" title={v}>
                    <span className="inline-flex shrink-0 items-center text-[13px] select-none" aria-hidden>
                      🚌
                    </span>
                    <span className="min-w-0 truncate leading-snug">{v}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums text-gray-700" title={t('card.assignedTourBasic')}>
                    <span className="inline-flex shrink-0 items-center text-[13px] select-none" aria-hidden>
                      👥
                    </span>
                    {assignedN != null ? assignedN : '-'}
                  </span>
                  <span
                    className="inline-flex shrink-0 items-center"
                    title={tourStatusLabel}
                    aria-label={tourStatusLabel}
                  >
                    {simpleCardTourStatusGlyph(tourStatusLabel)}
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Row 4: Follow-up(취소 포함) 왼쪽 + 더보기(기존 액션) 오른쪽 */}
          <div className="mt-auto flex items-center gap-2 min-w-0 border-t border-gray-100 pt-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-1">
              {isReservationCancelled ? (
                <CancelledSimpleCardFollowUpStrip
                  reservationId={reservation.id}
                  snapshot={followUpPipelineSnapshot}
                  customerEmail={
                    customers.find((c) => c.id === reservation.customerId)?.email ?? ''
                  }
                  customerPhone={
                    customers.find((c) => c.id === reservation.customerId)?.phone ?? null
                  }
                  customerName={getCustomerName(reservation.customerId, customers || [])}
                  customerLanguage={
                    customers.find((c) => c.id === reservation.customerId)?.language ?? null
                  }
                  tourDate={reservation.tourDate ?? null}
                  productId={reservation.productId}
                  products={(products as Array<{
                    id: string
                    name?: string | null
                    name_ko?: string | null
                    name_en?: string | null
                    customer_name_ko?: string | null
                    customer_name_en?: string | null
                  }>) || []}
                  adults={reservation.adults || 0}
                  children={reservation.child || 0}
                  infants={reservation.infant || 0}
                  channelRN={reservation.channelRN ?? null}
                  channelName={
                    reservation.channelNameSnapshot ??
                    getChannelName(reservation.channelId, channels || [])
                  }
                  {...(onCancelFollowUpManualChange !== undefined
                    ? { onCancelFollowUpManualChange }
                    : {})}
                  onReasonSaved={() => {
                    setCancelReasonFetchIx((x) => x + 1)
                    onCancellationReasonSaved?.()
                  }}
                  knownCancellationReason={cancelReasonBadge}
                />
              ) : (
                <>
                  {onCommunicationChannelChange ? (
                    <ReservationCardSmsMenuButton
                      reservationId={reservation.id}
                      customer={customers.find((c) => c.id === reservation.customerId)}
                      sentBy={sentBy}
                      uiLocale={locale === 'en' ? 'en' : 'ko'}
                      {...(onPreTourSmsSendSuccess
                        ? { onSendSuccess: () => onPreTourSmsSendSuccess(reservation.id) }
                        : {})}
                      {...(onSmsLogsClick
                        ? { onSmsLogsClick: () => onSmsLogsClick(reservation.id) }
                        : {})}
                    />
                  ) : null}
                  <ReservationFollowUpPipelineIcons
                  snapshot={followUpPipelineSnapshot}
                  snapshotLoaded={followUpPipelineSnapshotLoaded}
                  disabled={followUpPipelineIconsDisabled}
                  onEmailPreviewClick={(emailType) => onEmailPreview(reservation, emailType)}
                  onEmailLogsClick={() => onEmailLogsClick(reservation.id)}
                  showTourChatRoomPreviewButton
                  onTourChatRoomPreviewClick={() => setTourChatRoomPreviewOpen(true)}
                  {...(onFollowUpPipelineManualChange
                    ? {
                        allowManualCompletion: true as const,
                        onManualStepChange: (step: FollowUpPipelineStepKey, action: 'mark' | 'clear') =>
                          onFollowUpPipelineManualChange(reservation.id, step, action),
                      }
                    : {})}
                />
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <div className="relative shrink-0" ref={simpleMoreMenuRef}>
                <button
                  ref={simpleMoreMenuButtonRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSimpleMoreMenuOpen((open) => !open)
                  }}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  title={t('card.simpleActionsToggle')}
                  aria-label={t('card.simpleActionsToggle')}
                  aria-expanded={simpleMoreMenuOpen}
                  aria-haspopup="menu"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {simpleMoreMenuOpen &&
            pickupSummaryPortalReady &&
            createPortal(
              <div
                ref={simpleMoreMenuPanelRef}
                role="menu"
                className="fixed w-52 max-h-[min(70vh,calc(100vh-5rem))] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                style={
                  simpleMoreMenuPos
                    ? {
                        top: simpleMoreMenuPos.top,
                        left: simpleMoreMenuPos.left,
                        zIndex: ADMIN_FLOATING_PORTAL_Z_INDEX,
                      }
                    : { visibility: 'hidden', top: 0, left: 0, zIndex: ADMIN_FLOATING_PORTAL_Z_INDEX }
                }
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const closeMenu = () => setSimpleMoreMenuOpen(false)
                  const menuBtnClass =
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50'
                  const product = products?.find((p) => p.id === reservation.productId)
                  const isManiaTour =
                    product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service'
                  const showCreateTour = Boolean(isManiaTour && !reservation.hasExistingTour)
                  return (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className={menuBtnClass}
                        onClick={() => {
                          closeMenu()
                          onEditClick(reservation.id)
                        }}
                      >
                        <Edit className="h-3.5 w-3.5 shrink-0 text-orange-600" />
                        {t('card.editReservationTitle')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={menuBtnClass}
                        onClick={() => {
                          closeMenu()
                          onPricingInfoClick(reservation)
                        }}
                      >
                        <Receipt className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {t('actions.price')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={menuBtnClass}
                        onClick={() => {
                          closeMenu()
                          setPickupSummaryModalOpen(true)
                        }}
                      >
                        <Hotel className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                        {t('card.pickupHotelIconTitle')}
                      </button>
                      {showCreateTour ? (
                        <button
                          type="button"
                          role="menuitem"
                          className={menuBtnClass}
                          onClick={() => {
                            closeMenu()
                            onCreateTour(reservation)
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 shrink-0 text-green-600" />
                          {t('card.createTourTitle')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        className={menuBtnClass}
                        onClick={() => {
                          closeMenu()
                          onPaymentClick(reservation)
                        }}
                      >
                        <DollarSign className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {t('card.paymentHistoryTitle')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={menuBtnClass}
                        onClick={() => {
                          closeMenu()
                          onDetailClick(reservation)
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                        {t('card.viewCustomerTitle')}
                      </button>
                      {onReceiptClick ? (
                        <button
                          type="button"
                          role="menuitem"
                          className={menuBtnClass}
                          onClick={() => {
                            closeMenu()
                            onReceiptClick(reservation)
                          }}
                        >
                          <Printer className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                          {t('print')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        className={menuBtnClass}
                        onClick={() => {
                          closeMenu()
                          setFollowUpModalOpen(true)
                        }}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                        Follow up
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={menuBtnClass}
                        onClick={() => {
                          closeMenu()
                          onReviewClick(reservation)
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-pink-600" />
                        {t('card.reviewManagementTitle')}
                      </button>
                    </>
                  )
                })()}
              </div>,
              document.body
            )}

          {statusModalOpen && onStatusChange && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
              onClick={(e) => {
                e.stopPropagation()
                setStatusModalOpen(false)
              }}
            >
              <div
                className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-200 p-3">
                  <h3 className="text-sm font-semibold text-gray-900">{t('card.changeStatusModalTitle')}</h3>
                  <button
                    type="button"
                    onClick={() => setStatusModalOpen(false)}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                    aria-label={t('card.close')}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="max-h-[60vh] space-y-1 overflow-y-auto p-2">
                  {statusOptions.map((opt) => {
                    const currentStatus = (reservation.status as string)?.toLowerCase?.() ?? ''
                    const isCurrent =
                      opt.value === 'cancelled_rebooking'
                        ? currentStatus === 'cancelled' && isRebookingCancellationReason(cancelReasonBadge)
                        : opt.value === 'cancelled'
                          ? currentStatus === 'cancelled' && !isRebookingCancellationReason(cancelReasonBadge)
                          : currentStatus === opt.value
                    const label = t(opt.labelKey)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={statusUpdating}
                        onClick={() => handleStatusSelect(opt.value)}
                        title={label}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-gray-50 disabled:opacity-50 ${getStatusColor(opt.value)} ${isCurrent ? 'ring-2 ring-blue-300' : ''}`}
                      >
                        {reservationStatusIcon(opt.value, 'h-4 w-4')}
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {pickupSummaryModalOpen && pickupSummaryPortalReady &&
            createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
              onClick={(e) => {
                e.stopPropagation()
                if (e.target !== e.currentTarget) return
                setPickupSummaryModalOpen(false)
              }}
            >
              <div
                className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-200 p-3">
                  <h3 className="text-sm font-semibold text-gray-900">{t('card.pickupSummaryModalTitle')}</h3>
                  <button
                    type="button"
                    onClick={() => setPickupSummaryModalOpen(false)}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                    aria-label={t('card.close')}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-2 p-3">
                  <button
                    type="button"
                    className="w-full rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPickupTimeClick(reservation, e, { resumePickupSummary: true })
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {t('card.pickupSummaryTimeLabel')}
                    </div>
                    <div className="mt-1">{pickupSummaryTimeDisplay}</div>
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPickupHotelClick(reservation, e, { resumePickupSummary: true })
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Hotel className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {t('card.pickupSummaryHotelLabel')}
                    </div>
                    <div className="mt-1 text-sm text-gray-900 break-words">
                      {reservation.pickUpHotel
                        ? getPickupHotelDisplay(reservation.pickUpHotel, pickupHotels as any || [])
                        : t('card.pickupHotelTbd')}
                    </div>
                  </button>
                  <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPickupTimeClick(reservation, e, { resumePickupSummary: true })
                      }}
                      className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary/90"
                    >
                      {t('card.editPickupTimeButton')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPickupHotelClick(reservation, e, { resumePickupSummary: true })
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
                    >
                      {t('card.editPickupHotelButton')}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>

      {/* Follow up ?? */}
      {followUpModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            e.stopPropagation()
            setFollowUpModalOpen(false)
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Follow up</h3>
              <button
                type="button"
                onClick={() => setFollowUpModalOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label={t('card.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ReservationFollowUpSection
                reservationId={reservation.id}
                status={reservation.status as string}
              />
            </div>
          </div>
        </div>
      )}

      <TourChatRoomEmailPreviewModal
        isOpen={tourChatRoomPreviewOpen}
        onClose={() => setTourChatRoomPreviewOpen(false)}
        reservationId={reservation.id}
        tourDate={reservation.tourDate}
        tourId={effectiveTourId || linkedTourId || null}
      />
    </div>
  )
}, (prevProps, nextProps) => {
  const pa = prevProps.followUpPipelineSnapshot
  const na = nextProps.followUpPipelineSnapshot
  const snapSame =
    (!pa && !na) ||
    (!!pa &&
      !!na &&
      pa.confirmationSent === na.confirmationSent &&
      pa.confirmationSentDirect === na.confirmationSentDirect &&
      pa.confirmationInferredFromDeparture === na.confirmationInferredFromDeparture &&
      pa.residentInquirySent === na.residentInquirySent &&
      pa.guestResidentFlowCompleted === na.guestResidentFlowCompleted &&
      pa.departureSent === na.departureSent &&
      pa.pickupSent === na.pickupSent &&
      pa.needsResidentFlow === na.needsResidentFlow &&
      pa.manualConfirmation === na.manualConfirmation &&
      pa.manualResident === na.manualResident &&
      pa.manualDeparture === na.manualDeparture &&
      pa.manualPickup === na.manualPickup &&
      pa.cancelFollowUpManual === na.cancelFollowUpManual &&
      pa.cancelRebookingOutreachManual === na.cancelRebookingOutreachManual &&
      JSON.stringify(pa.emailDelivery ?? {}) === JSON.stringify(na.emailDelivery ?? {}))

  return (
    prevProps.reservation.id === nextProps.reservation.id &&
    prevProps.reservation.status === nextProps.reservation.status &&
    prevProps.reservation.tourId === nextProps.reservation.tourId &&
    prevProps.linkedTourId === nextProps.linkedTourId &&
    prevProps.tourInfoMap === nextProps.tourInfoMap &&
    prevProps.reservationPricingMap.get(prevProps.reservation.id) === nextProps.reservationPricingMap.get(nextProps.reservation.id) &&
    prevProps.followUpPipelineSnapshotLoaded === nextProps.followUpPipelineSnapshotLoaded &&
    prevProps.onFollowUpPipelineManualChange === nextProps.onFollowUpPipelineManualChange &&
    prevProps.onCancelFollowUpManualChange === nextProps.onCancelFollowUpManualChange &&
    snapSame
  )
})
