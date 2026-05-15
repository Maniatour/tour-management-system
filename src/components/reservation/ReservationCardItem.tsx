'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Plus, Calendar, MapPin, Users, DollarSign, Eye, Clock, Mail, ChevronDown, Edit, MessageSquare, X, FileText, Printer, Flag, Hotel, Receipt, UserRound, CheckCircle2, CircleCheck, XCircle, HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - react-country-flag may lack types
import ReactCountryFlag from 'react-country-flag'
import { 
  getPickupHotelDisplay, 
  getCustomerName, 
  getProductName, 
  getProductNameForLocale, 
  getChannelName, 
  getStatusLabel, 
  getStatusColor, 
  calculateTotalPrice,
  normalizeTourDateKey
} from '@/utils/reservationUtils'
import { ResidentStatusIcon } from '@/components/reservation/ResidentStatusIcon'
import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'
import { ChoicesDisplay } from '@/components/reservation/ChoicesDisplay'
import ReservationFollowUpSection from '@/components/reservation/ReservationFollowUpSection'
import { ReservationFollowUpPipelineIcons } from '@/components/reservation/ReservationFollowUpPipelineIcons'
import CancelledSimpleCardFollowUpStrip from '@/components/reservation/CancelledSimpleCardFollowUpStrip'
import TourChatRoomEmailPreviewModal from '@/components/reservation/TourChatRoomEmailPreviewModal'
import type { CancelFollowUpManualKind } from '@/components/reservation/ReservationFollowUpQueueModal'
import type { ReservationFollowUpPipelineSnapshot, FollowUpPipelineStepKey } from '@/lib/reservationFollowUpPipeline'
import { reservationExcludedFromFollowUpPipeline } from '@/lib/reservationFollowUpPipeline'
import { supabase } from '@/lib/supabase'
import type { Reservation, Customer } from '@/types/reservation'

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

function simpleCardTourStatusGlyph(statusRaw: string): React.ReactNode {
  const x = statusRaw.trim().toLowerCase()
  const cls = 'h-3.5 w-3.5 shrink-0'
  if (x === 'confirmed') return <CheckCircle2 className={`${cls} text-emerald-600`} aria-hidden />
  if (x === 'completed') return <CircleCheck className={`${cls} text-blue-600`} aria-hidden />
  if (x === 'cancelled' || x === 'canceled') return <XCircle className={`${cls} text-red-600`} aria-hidden />
  return <HelpCircle className={`${cls} text-gray-400`} aria-hidden />
}

function formatRegistrationDateForCard(reservation: Reservation, locale: string): string {
  const raw =
    reservation.addedTime ||
    (reservation as { created_at?: string | null }).created_at ||
    ''
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
  emailDropdownOpen: string | null
  sendingEmail: string | null
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
  onEmailDropdownToggle: (reservationId: string) => void
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
      product_choices: {
        choice_group_ko: string
      }
    }
  }>>>
  /** reservations.tour_id or tours.reservation_ids-derived tour ID */
  linkedTourId?: string | null
  /** Card density: full detail vs compact rows */
  cardLayout?: 'standard' | 'simple'
  onOpenTourDetailModal?: (tourId: string) => void
  reservationOptionsPresenceByReservationId?: Map<string, boolean>
  onReservationOptionsMutated?: (reservationId: string) => void
  /** 이메일 Follow-up 파이프라인(컨펌·거주·출발·픽업) 표시용 스냅샷 */
  followUpPipelineSnapshot?: ReservationFollowUpPipelineSnapshot | null
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
  if (diffDays < 3) return 'border-2 border-red-500'
  if (diffDays <= 7) return 'border-2 border-blue-500'
  return 'border border-gray-200'
}

export const ReservationCardItem = React.memo(function ReservationCardItem({
  reservation,
  customers,
  products,
  channels,
  pickupHotels,
  productOptions,
  optionChoices,
  tourInfoMap,
  reservationPricingMap,
  locale,
  emailDropdownOpen,
  sendingEmail,
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
  onEmailDropdownToggle,
  onEditClick,
  onCustomerClick,
  onRefreshReservations,
  onStatusChange,
  generatePriceCalculation,
  getGroupColorClasses,
  getSelectedChoicesFromNewSystem,
  choicesCacheRef,
  linkedTourId = null,
  cardLayout = 'standard',
  onOpenTourDetailModal,
  reservationOptionsPresenceByReservationId: _reservationOptionsPresence,
  onReservationOptionsMutated: _onReservationOptionsMutated,
  reshowPickupSummaryRequest = null,
  onReshowPickupSummaryConsumed,
  followUpPipelineSnapshot = null,
  onFollowUpPipelineManualChange,
  onCancelFollowUpManualChange,
  residentCustomerBatchMap,
}: ReservationCardItemProps) {
  const t = useTranslations('reservations')
  const router = useRouter()

  const prefetchedResidentCustomerRows = residentCustomerBatchMap?.get(reservation.id)

  const showResidentStatusUi = productShowsResidentStatusSectionByCode(
    products.find((p) => p.id === reservation.productId)?.product_code ?? null
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
  const hideAssignedTourUi =
    reservationStatusLower === 'cancelled' ||
    reservationStatusLower === 'canceled' ||
    reservationStatusLower === 'deleted'
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false)
  const [simpleActionsExpanded, setSimpleActionsExpanded] = useState(false)
  const [pickupSummaryModalOpen, setPickupSummaryModalOpen] = useState(false)
  const [pickupSummaryPortalReady, setPickupSummaryPortalReady] = useState(false)
  const [tourChatRoomPreviewOpen, setTourChatRoomPreviewOpen] = useState(false)
  const [cancelReasonBadge, setCancelReasonBadge] = useState<string | null>(null)
  const [cancelReasonFetchIx, setCancelReasonFetchIx] = useState(0)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

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
    if (cardLayout !== 'simple' || !isReservationCancelled) {
      setCancelReasonBadge(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
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
  }, [cardLayout, isReservationCancelled, reservation.id, cancelReasonFetchIx])

  const statusOptions = [
    { value: 'inquiry', labelKey: 'status.inquiry' },
    { value: 'pending', labelKey: 'status.pending' },
    { value: 'confirmed', labelKey: 'status.confirmed' },
    { value: 'completed', labelKey: 'status.completed' },
    { value: 'cancelled', labelKey: 'status.cancelled' }
  ] as const

  const handleStatusSelect = async (newStatus: string) => {
    if (!onStatusChange || newStatus === (reservation.status as string)?.toLowerCase?.()) {
      setStatusDropdownOpen(false)
      setStatusModalOpen(false)
      return
    }
    setStatusUpdating(true)
    try {
      await onStatusChange(reservation.id, newStatus)
      setStatusDropdownOpen(false)
      setStatusModalOpen(false)
    } finally {
      setStatusUpdating(false)
    }
  }

  const tourDateBorderClass = tourDateProximityBorderClasses(reservation.tourDate)

  const pickupTimeLine = (() => {
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
      <span
        className="text-sm text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
        onClick={(e) => onPickupTimeClick(reservation, e)}
      >
        {pickupDate} {pickupTime}
      </span>
    )
  })()

  // Pickup summary (modal): same date/time rules as pickupTimeLine, without click handler.
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
      className={`bg-white rounded-lg shadow-md ${tourDateBorderClass} hover:shadow-lg transition-shadow duration-200 group`}
    >
      {cardLayout === 'simple' ? (
        <div className="p-3 space-y-2">
          {/* Row 1 */}
          <div className="flex justify-between items-center gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {onStatusChange ? (
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(true)}
                  disabled={statusUpdating}
                  className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:opacity-90 disabled:opacity-70 ${getStatusColor(reservation.status)}`}
                >
                  {getStatusLabel(reservation.status, t)}
                </button>
              ) : (
                <span className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(reservation.status)}`}>
                  {getStatusLabel(reservation.status, t)}
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
                    : 'text-gray-900 hover:text-blue-600'
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
            <div className="flex items-center gap-1.5 shrink-0">
              {showResidentStatusUi && (
                <ResidentStatusIcon
                  reservationId={reservation.id}
                  customerId={reservation.customerId}
                  totalPeople={(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}
                  onUpdate={onRefreshReservations}
                  prefetchedResidentCustomerRows={prefetchedResidentCustomerRows}
                />
              )}
              {(() => {
                const channel = channels?.find((c) => c.id === reservation.channelId)
                const chName = getChannelName(reservation.channelId, channels || [])
                return channel?.favicon_url ? (
                  <Image
                    src={channel.favicon_url}
                    alt={chName || 'Channel'}
                    width={16}
                    height={16}
                    className="rounded flex-shrink-0"
                    style={{ width: 'auto', height: 'auto' }}
                    title={chName}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded bg-gray-100 block" title={chName || ''} aria-hidden />
                )
              })()}
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-gray-800 tabular-nums" title={t('peopleLabel')}>
                <Users className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
                {(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}
              </span>
            </div>
          </div>

          {/* Row 2: 투어일·상품 + Follow-up 아이콘(오른쪽 정렬) — 한 줄 우선 */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-2 overflow-hidden">
              <span className="shrink-0 text-xs font-medium text-gray-900 tabular-nums">
                {formatTourDateMmDdYyyy(reservation.tourDate)}
              </span>
              <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-1 overflow-hidden text-xs font-medium text-gray-900">
                <span className="min-w-0 truncate">
                  {getProductName(reservation.productId, products as any || [])}
                </span>
                <span className="inline-flex shrink-0 flex-nowrap items-center gap-1 font-normal [&>span]:!px-1.5 [&>span]:!py-0.5 [&>span]:!text-[11px] [&>span]:!leading-tight">
                  <ChoicesDisplay
                    reservation={reservation}
                    getGroupColorClasses={getGroupColorClasses}
                    getSelectedChoicesFromNewSystem={getSelectedChoicesFromNewSystem}
                    choicesCacheRef={choicesCacheRef}
                  />
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              {cardLayout === 'simple' && isReservationCancelled ? (
                <CancelledSimpleCardFollowUpStrip
                  reservationId={reservation.id}
                  snapshot={followUpPipelineSnapshot}
                  onCancelFollowUpManualChange={onCancelFollowUpManualChange}
                  onReasonSaved={() => setCancelReasonFetchIx((x) => x + 1)}
                />
              ) : (
                <ReservationFollowUpPipelineIcons
                  snapshot={followUpPipelineSnapshot}
                  disabled={reservationExcludedFromFollowUpPipeline(reservation.status)}
                  onEmailPreviewClick={(emailType) => onEmailPreview(reservation, emailType)}
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
              )}
            </div>
          </div>

          {/* Row 3 */}
          {(() => {
            if (hideAssignedTourUi) {
              return (
                <div className="flex items-center gap-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-gray-800 min-w-0 flex-1">
                    <span className="text-xs font-medium text-gray-600 shrink-0">{t('card.registrationDateLabel')}</span>
                    <span className="tabular-nums">{formatRegistrationDateForCard(reservation, locale)}</span>
                    {cardLayout === 'simple' && isReservationCancelled && cancelReasonBadge ? (
                      <span
                        className="max-w-[11rem] truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-800 ring-1 ring-slate-200/80"
                        title={cancelReasonBadge}
                      >
                        {cancelReasonBadge}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSimpleActionsExpanded((x) => !x)
                    }}
                    className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100"
                    title={t('card.simpleActionsToggle')}
                    aria-expanded={simpleActionsExpanded}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${simpleActionsExpanded ? 'rotate-180' : ''}`} />
                  </button>
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
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!effectiveTourId) return
                      if (onOpenTourDetailModal) onOpenTourDetailModal(effectiveTourId)
                      else router.push(`/${locale}/admin/tours/${effectiveTourId}`)
                    }}
                    className="shrink-0 rounded p-0.5 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-30"
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSimpleActionsExpanded((x) => !x)
                  }}
                  className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100"
                  title={t('card.simpleActionsToggle')}
                  aria-expanded={simpleActionsExpanded}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${simpleActionsExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )
          })()}

          {/* Row 4: icons only */}
          {simpleActionsExpanded && (
          <div className="flex flex-wrap gap-1 border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPricingInfoClick(reservation)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
              title={t('actions.price')}
            >
              <Receipt className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPickupSummaryModalOpen(true)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
              title={t('card.pickupHotelIconTitle')}
            >
              <Hotel className="h-4 w-4" />
            </button>
            {(() => {
              const product = products?.find((p) => p.id === reservation.productId)
              const isManiaTour = product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service'
              if (isManiaTour && !reservation.hasExistingTour) {
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateTour(reservation)
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
                    title={t('card.createTourTitle')}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )
              }
              return null
            })()}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPaymentClick(reservation)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
              title={t('card.paymentHistoryTitle')}
            >
              <DollarSign className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDetailClick(reservation)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100"
              title={t('card.viewCustomerTitle')}
            >
              <Eye className="h-4 w-4" />
            </button>
            {onReceiptClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onReceiptClick(reservation)
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                title={t('print')}
              >
                <Printer className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setFollowUpModalOpen(true)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              title="Follow up"
            >
              <FileText className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onReviewClick(reservation)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100"
              title={t('card.reviewManagementTitle')}
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <div className="relative inline-block">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onEmailDropdownToggle(reservation.id)
                }}
                disabled={sendingEmail === reservation.id}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-200 bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50"
                title={t('card.emailTitle')}
              >
                <Mail className="h-4 w-4" />
              </button>
              {emailDropdownOpen === reservation.id && (
                <div
                  className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onEmailPreview(reservation, 'confirmation')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Mail className="w-3 h-3" />
                    {t('card.emailConfirmation')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEmailPreview(reservation, 'departure')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Mail className="w-3 h-3" />
                    {t('card.emailDeparture')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEmailPreview(reservation, 'pickup')}
                    disabled={!reservation.pickUpTime || !reservation.tourDate}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Mail className="w-3 h-3 inline mr-2" />
                    {t('card.emailPickup')}
                  </button>
                  {showResidentStatusUi && (
                    <button
                      type="button"
                      onClick={() => onEmailPreview(reservation, 'resident_inquiry')}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <UserRound className="w-3 h-3 shrink-0" />
                      {t('card.emailResidentInquiry')}
                    </button>
                  )}
                  <div className="border-t border-gray-200 my-1" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEmailLogsClick(reservation.id)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <Clock className="w-3 h-3" />
                    {t('card.emailLogs')}
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEditClick(reservation.id)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
              title={t('card.editReservationTitle')}
            >
              <Edit className="h-4 w-4" />
            </button>
          </div>
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
                    const isCurrent = (reservation.status as string)?.toLowerCase?.() === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={statusUpdating}
                        onClick={() => handleStatusSelect(opt.value)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-gray-50 disabled:opacity-50 ${getStatusColor(opt.value)} ${isCurrent ? 'ring-2 ring-blue-300' : ''}`}
                      >
                        {t(opt.labelKey)}
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
                      className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
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
      ) : (
      <>
      {/* ?? ?? - ?? ?? */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-start mb-3">
          <div className="relative" ref={statusDropdownRef}>
            {onStatusChange ? (
              <button
                type="button"
                onClick={() => setStatusDropdownOpen((v) => !v)}
                disabled={statusUpdating}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-90 disabled:opacity-70 ${getStatusColor(reservation.status)}`}
              >
                {getStatusLabel(reservation.status, t)}
                <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                {getStatusLabel(reservation.status, t)}
              </span>
            )}
            {onStatusChange && statusDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-20 py-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[7rem]">
                {statusOptions.map((opt) => {
                  const isCurrent = (reservation.status as string)?.toLowerCase?.() === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleStatusSelect(opt.value)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 ${getStatusColor(opt.value)} ${isCurrent ? 'font-semibold' : ''}`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {(() => {
              const channel = channels?.find(c => c.id === reservation.channelId)
              return (
                <>
                  {channel?.favicon_url ? (
                    <Image 
                      src={channel.favicon_url} 
                      alt={`${channel.name || 'Channel'} favicon`} 
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
                          fallback.innerHTML = '??'
                          parent.appendChild(fallback)
                        }
                      }}
                    />
                  ) : (
                    <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 text-xs">??</span>
                    </div>
                  )}
                  <span className="text-xs text-gray-600">{getChannelName(reservation.channelId, channels || [])}</span>
                  <span className="text-xs text-gray-400">RN: {reservation.channelRN}</span>
                </>
              )
            })()}
          </div>
        </div>

        {/* 두 번째 줄: 고객 요약 + Follow-up 아이콘(오른쪽) */}
        <div className="mb-2">
          <div className="flex items-start justify-between gap-2">
          <div 
            className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline flex items-center space-x-2 min-w-0 flex-1"
            onClick={(e) => {
              e.stopPropagation()
              const customer = customers.find(c => c.id === reservation.customerId)
              if (customer) {
                onCustomerClick(customer)
              }
            }}
          >
            {/* ??? ?? ??? */}
            {(() => {
              const customer = customers.find(c => c.id === reservation.customerId)
              if (!customer?.language) return null
              
              const getLanguageFlag = (language: string): string => {
                if (!language) return 'US'
                const lang = language.toLowerCase().trim()
                if (lang === 'kr' || lang === 'ko' || lang.startsWith('ko-') || lang === '???' || lang === 'korean') return 'KR'
                if (lang === 'en' || lang === '??' || lang.startsWith('en-') || lang === 'english') return 'US'
                if (lang === 'ja' || lang === 'jp' || lang.startsWith('ja-') || lang === '???' || lang === 'japanese') return 'JP'
                if (lang === 'zh' || lang === 'cn' || lang.startsWith('zh-') || lang === '???' || lang === 'chinese') return 'CN'
                if (lang === 'es' || lang.startsWith('es-') || lang === '????' || lang === 'spanish') return 'ES'
                if (lang === 'fr' || lang.startsWith('fr-') || lang === '????' || lang === 'french') return 'FR'
                if (lang === 'de' || lang.startsWith('de-') || lang === '???' || lang === 'german') return 'DE'
                if (lang === 'it' || lang.startsWith('it-') || lang === '?????' || lang === 'italian') return 'IT'
                if (lang === 'pt' || lang.startsWith('pt-') || lang === '?????' || lang === 'portuguese') return 'PT'
                if (lang === 'ru' || lang.startsWith('ru-') || lang === '????' || lang === 'russian') return 'RU'
                if (lang === 'th' || lang === '???' || lang === 'thai') return 'TH'
                if (lang === 'vi' || lang === '????' || lang === 'vietnamese') return 'VN'
                if (lang === 'id' || lang === '??????' || lang === 'indonesian') return 'ID'
                if (lang === 'ms' || lang === '????' || lang === 'malay') return 'MY'
                if (lang === 'ph' || lang === '????' || lang === 'filipino') return 'PH'
                return 'US'
              }
              
              const flagCode = getLanguageFlag(customer.language)
              return (
                <ReactCountryFlag
                  countryCode={flagCode}
                  svg
                  style={{
                    width: '16px',
                    height: '12px',
                    borderRadius: '2px',
                    marginRight: '6px'
                  }}
                />
              )
            })()}
            
            {/* ?? ?? ??? */}
            {showResidentStatusUi && (
              <ResidentStatusIcon
                reservationId={reservation.id}
                customerId={reservation.customerId}
                totalPeople={(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}
                onUpdate={onRefreshReservations}
                prefetchedResidentCustomerRows={prefetchedResidentCustomerRows}
              />
            )}
            
            <span className={isReservationCancelled ? 'text-gray-400' : undefined}>
              {getCustomerName(reservation.customerId, customers || [])}
            </span>
            {/* ?? ?? */}
            {(() => {
              const hasChild = reservation.child > 0
              const hasInfant = reservation.infant > 0
              const hasAdult = reservation.adults > 0
              
              if (!hasAdult) return null
              
              return (
                <span className="flex items-center space-x-1 text-xs text-gray-600 ml-2">
                  <Users className="h-3 w-3" />
                  <span>{reservation.adults}{t('card.peopleShort')}</span>
                  {hasChild && <span className="text-orange-600">{reservation.child}{t('card.childShort')}</span>}
                  {hasInfant && <span className="text-blue-600">{reservation.infant}{t('card.infantShort')}</span>}
                </span>
              )
            })()}
          </div>
          <div className="shrink-0 pt-0.5">
            <ReservationFollowUpPipelineIcons
              snapshot={followUpPipelineSnapshot}
              disabled={reservationExcludedFromFollowUpPipeline(reservation.status)}
              onEmailPreviewClick={(emailType) => onEmailPreview(reservation, emailType)}
              {...(onFollowUpPipelineManualChange
                ? {
                    allowManualCompletion: true as const,
                    onManualStepChange: (step: FollowUpPipelineStepKey, action: 'mark' | 'clear') =>
                      onFollowUpPipelineManualChange(reservation.id, step, action),
                  }
                : {})}
            />
          </div>
          </div>
          <a 
            href={`mailto:${customers.find(c => c.id === reservation.customerId)?.email || ''}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer block"
          >
            {customers.find(c => c.id === reservation.customerId)?.email}
          </a>
          {/* ????? ??? - ?? ?? ?? */}
          <div className="flex items-center justify-between">
            <a 
              href={`tel:${customers.find(c => c.id === reservation.customerId)?.phone || ''}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer"
            >
              {customers.find(c => c.id === reservation.customerId)?.phone || '-'}
            </a>
            {reservation.addedTime ? (
              <span className="text-xs text-gray-500">
                {new Date(reservation.addedTime).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ?? ?? */}
      <div className="p-4 space-y-3">
        {/* ?? ?? */}
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="text-sm font-medium text-gray-900">{getProductNameForLocale(reservation.productId, products as any || [], locale)}</div>
            
            {/* ??? ??? ??? ?? ?? */}
            <ChoicesDisplay 
              reservation={reservation}
              getGroupColorClasses={getGroupColorClasses}
              getSelectedChoicesFromNewSystem={getSelectedChoicesFromNewSystem}
              choicesCacheRef={choicesCacheRef}
            />
          </div>
          
          {/* ?? selectedOptions ?? (??? ??) */}
          {reservation.selectedOptions && Object.keys(reservation.selectedOptions).length > 0 && (
            <div className="mt-1 space-y-1">
              {Object.entries(reservation.selectedOptions).map(([optionId, choiceIds]) => {
                if (!choiceIds || choiceIds.length === 0) return null
                
                const option = productOptions?.find(opt => opt.id === optionId)
                
                if (!option) return null
                
                // ?? ??? ?? (is_required? true? ???)
                if (!option.is_required) return null
                
                return (
                  <div key={optionId} className="text-xs text-gray-600">
                    <span className="font-medium">{option.name}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {hideAssignedTourUi ? (
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-900">
              <span className="text-gray-600 font-medium">{t('card.registrationDateLabel')}</span>{' '}
              <span className="tabular-nums">{formatRegistrationDateForCard(reservation, locale)}</span>
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
              <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-900">{reservation.tourDate || '-'}</span>
              <span className="text-gray-400">·</span>
              <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
              {pickupTimeLine}
            </div>

            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span
                className={`text-sm hover:text-blue-600 hover:underline cursor-pointer ${
                  reservation.pickUpHotel
                    ? 'text-gray-900'
                    : 'text-gray-500 italic'
                }`}
                onClick={(e) => onPickupHotelClick(reservation, e)}
              >
                {reservation.pickUpHotel
                  ? getPickupHotelDisplay(reservation.pickUpHotel, pickupHotels as any || [])
                  : t('card.pickupHotelTbd')}
              </span>
            </div>
          </>
        )}

        {/* Net Price ??? ?? */}
        <div className="pt-2 border-t border-gray-100">
          {(() => {
            const pricing = reservationPricingMap.get(reservation.id)
            if (!pricing || !pricing.total_price) {
              const totalPrice = reservation.totalPrice || reservation.pricingInfo?.totalPrice || calculateTotalPrice(reservation, (products || []) as any, optionChoices || [])
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
            const currencySymbol = currency === 'KRW' ? '?' : '$'
            
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

        {/* Assigned tour summary (linked tour card) */}
        {(() => {
          if (!effectiveTourId || hideAssignedTourUi) {
            return null
          }

          const tourInfo = tourInfoMap.get(effectiveTourId)

          const getStatusColor = (status: string) => {
            const s = status.toLowerCase()
            if (s === 'confirmed') return 'bg-green-100 text-green-800'
            if (s === 'completed') return 'bg-blue-100 text-blue-800'
            if (s === 'cancelled' || s === 'canceled') return 'bg-red-100 text-red-800'
            return 'bg-gray-100 text-gray-800'
          }

          const assignedTourTotalPeople = tourInfo?.totalPeople ?? 0
          const finalAllDateTotalPeople = tourInfo?.allDateTotalPeople ?? assignedTourTotalPeople
          const otherStatusPeople = tourInfo?.allDateOtherStatusPeople ?? 0
          const tourStatusLabel = tourInfo?.status ?? '-'

          const assignedTourTitle = tourInfo
            ? otherStatusPeople > 0
              ? t('card.assignedTourWithOther', {
                  n: assignedTourTotalPeople,
                  total: finalAllDateTotalPeople,
                  other: otherStatusPeople
                })
              : t('card.assignedTour', { n: assignedTourTotalPeople, total: finalAllDateTotalPeople })
            : t('card.assignedTourBasic')

          return (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/${locale}/admin/tours/${effectiveTourId}`)
                }}
                className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div
                    className="text-xs font-semibold text-gray-900"
                    title={otherStatusPeople > 0 ? t('card.assignedTourOtherHint') : undefined}
                  >
                    {assignedTourTitle}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {t('card.assigned')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(tourStatusLabel)}`}>
                      {tourStatusLabel}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 mb-2 font-mono">
                  ID: {effectiveTourId}
                </div>

                {tourInfo ? (
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
                ) : (
                  <p className="text-[11px] text-gray-500 mt-1">{t('card.assignedTourMetaLoading')}</p>
                )}
              </div>
            </div>
          )
        })()}

        {/* ??? - ?? ??? ?? */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPricingInfoClick(reservation)
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center space-x-1 border border-blue-200"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span>{t('actions.price')}</span>
            </button>
            
            {/* ?? ?? ?? - Mania Tour/Service?? ??? ?? ?? ?? */}
            {(() => {
              const product = products?.find(p => p.id === reservation.productId)
              const isManiaTour = product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service'
              
              if (isManiaTour && !reservation.hasExistingTour) {
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateTour(reservation)
                    }}
                    className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors flex items-center space-x-1 border border-green-200"
                    title={t('card.createTourTitle')}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('actions.tour')}</span>
                  </button>
                )
              }
              return null
            })()}

            {/* ?? ?? ?? */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPaymentClick(reservation)
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center space-x-1 border border-blue-200"
              title={t('card.paymentHistoryTitle')}
            >
              <DollarSign className="w-3 h-3" />
              <span>{t('actions.deposit')}</span>
            </button>
            
            {/* ?? ?? ?? */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDetailClick(reservation)
              }}
              className="px-2 py-1 text-xs bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors flex items-center space-x-1 border border-purple-200"
              title={t('card.viewCustomerTitle')}
            >
              <Eye className="w-3 h-3" />
              <span>{t('card.viewCustomer')}</span>
            </button>

            {/* ??? ?? ?? */}
            {onReceiptClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onReceiptClick(reservation)
                }}
                className="px-2 py-1 text-xs bg-slate-50 text-slate-600 rounded-md hover:bg-slate-100 transition-colors flex items-center space-x-1 border border-slate-200"
                title={t('print')}
              >
                <Printer className="w-3 h-3" />
                <span>{t('print')}</span>
              </button>
            )}

            {/* Follow up ?? - ?? ???? ?? */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setFollowUpModalOpen(true)
              }}
              className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100 transition-colors flex items-center space-x-1 border border-amber-200"
              title="Follow up"
            >
              <FileText className="w-3 h-3" />
              <span>Follow up</span>
            </button>

            {/* ?? ?? ?? */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onReviewClick(reservation)
              }}
              className="px-2 py-1 text-xs bg-pink-50 text-pink-600 rounded-md hover:bg-pink-100 transition-colors flex items-center space-x-1 border border-pink-200"
              title={t('card.reviewManagementTitle')}
            >
              <MessageSquare className="w-3 h-3" />
              <span>{t('card.reviews')}</span>
            </button>

            {/* ??? ?? ???? */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEmailDropdownToggle(reservation.id)
                }}
                disabled={sendingEmail === reservation.id}
                className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors flex items-center space-x-1 border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('card.emailTitle')}
              >
                <Mail className="w-3 h-3" />
                <span>{sendingEmail === reservation.id ? t('card.sending') : t('card.email')}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {emailDropdownOpen === reservation.id && (
                <div 
                  className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onEmailPreview(reservation, 'confirmation')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Mail className="w-3 h-3" />
                    <span>{t('card.emailConfirmation')}</span>
                  </button>
                  <button
                    onClick={() => onEmailPreview(reservation, 'departure')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Mail className="w-3 h-3" />
                    <span>{t('card.emailDeparture')}</span>
                  </button>
                  <button
                    onClick={() => onEmailPreview(reservation, 'pickup')}
                    disabled={!reservation.pickUpTime || !reservation.tourDate}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail className="w-3 h-3" />
                    <span>{t('card.emailPickup')}</span>
                  </button>
                  {showResidentStatusUi && (
                    <button
                      type="button"
                      onClick={() => onEmailPreview(reservation, 'resident_inquiry')}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <UserRound className="w-3 h-3 shrink-0" />
                      <span>{t('card.emailResidentInquiry')}</span>
                    </button>
                  )}
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEmailLogsClick(reservation.id)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 flex items-center space-x-2"
                  >
                    <Clock className="w-3 h-3" />
                    <span>{t('card.emailLogs')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* ?? ?? */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEditClick(reservation.id)
              }}
              className="px-2 py-1 text-xs bg-orange-50 text-orange-600 rounded-md hover:bg-orange-100 transition-colors flex items-center space-x-1 border border-orange-200"
              title={t('card.editReservationTitle')}
            >
              <Edit className="w-3 h-3" />
              <span>{t('actions.edit')}</span>
            </button>
          </div>
        </div>
      </div>
      </>
      )}

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
      pa.cancelRebookingOutreachManual === na.cancelRebookingOutreachManual)

  return (
    prevProps.reservation.id === nextProps.reservation.id &&
    prevProps.cardLayout === nextProps.cardLayout &&
    prevProps.emailDropdownOpen === nextProps.emailDropdownOpen &&
    prevProps.sendingEmail === nextProps.sendingEmail &&
    prevProps.reservation.status === nextProps.reservation.status &&
    prevProps.reservation.tourId === nextProps.reservation.tourId &&
    prevProps.linkedTourId === nextProps.linkedTourId &&
    prevProps.tourInfoMap === nextProps.tourInfoMap &&
    prevProps.reservationPricingMap.get(prevProps.reservation.id) === nextProps.reservationPricingMap.get(nextProps.reservation.id) &&
    prevProps.onFollowUpPipelineManualChange === nextProps.onFollowUpPipelineManualChange &&
    prevProps.onCancelFollowUpManualChange === nextProps.onCancelFollowUpManualChange &&
    snapSame
  )
})
