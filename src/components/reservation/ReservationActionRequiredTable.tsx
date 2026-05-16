'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Eye,
  Edit,
  Plus,
  Mail,
  ChevronDown,
  MessageSquare,
  FileText,
  Users,
  X,
  UserRound,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Reservation, Customer } from '@/types/reservation'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import {
  getPickupHotelDisplay,
  getCustomerName,
  getProductNameForLocale,
  getStatusLabel,
  getStatusColor,
  formatChannelDashVariant,
} from '@/utils/reservationUtils'
import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'
import { ChoicesDisplay } from '@/components/reservation/ChoicesDisplay'
import ReservationFollowUpSection from '@/components/reservation/ReservationFollowUpSection'
import { ReservationActionRequiredBalanceTable } from '@/components/reservation/ReservationActionRequiredBalanceTable'
import { ReservationChannelFavicon } from '@/components/reservation/ReservationChannelFavicon'
import TableSortHeaderButton from '@/components/expenses/TableSortHeaderButton'
import type { SortDir } from '@/lib/clientTableSort'
import {
  isManiaTourOrServiceSubCategory,
  productExemptFromDepositRequirement,
} from '@/lib/reservationActionRequiredDepositTab'

/** 예약 처리 필요 모달 — 탭(및 가격 하위 탭)별 테이블 컬럼 구성 */
export type ActionRequiredTableVariant =
  | 'status'
  | 'tour'
  | 'pricingNoPrice'
  | 'pricingMismatch'
  | 'deposit'
  | 'balance'
  | 'incompleteDraft'

export interface ReservationActionRequiredTableProps {
  reservations: Reservation[]
  customers: Customer[]
  products: Array<{ id: string; name: string; sub_category?: string; product_code?: string | null }>
  channels: Array<{
    id: string
    name: string
    favicon_url?: string | null
    type?: string | null
    category?: string | null
    commission_percent?: number | null
  }>
  pickupHotels: Array<{ id: string; hotel?: string | null; name?: string | null; name_ko?: string | null; pick_up_location?: string | null }>
  productOptions: Array<{ id: string; name: string; is_required?: boolean }>
  optionChoices: Array<{ id: string; name: string; option_id?: string; adult_price?: number; child_price?: number; infant_price?: number }>
  reservationPricingMap: Map<string, ReservationPricingMapValue>
  tableVariant: ActionRequiredTableVariant
  /** 테이블 뷰: 투어일 헤더 정렬 */
  tourDateSortActive?: boolean
  tourDateSortDir?: SortDir
  onTourDateSortClick?: () => void
  /** status 탭: 오늘 기준 투어일까지 일수 */
  todayStr?: string
  /** deposit / tour 탭: 투어 배정 여부 */
  hasTourAssigned?: (r: Reservation) => boolean
  /** deposit 탭: payment_records 존재 여부 */
  reservationIdsWithPayments?: Set<string>
  /** balance 테이블: 예약별 입금 내역(DB와 비교) */
  paymentRecordsByReservationId?: Map<string, Array<{ payment_status: string; amount: number }>>
  /** balance 테이블: reservation_options 실시간 합 → 선택옵션·소계·산식에 반영 */
  reservationOptionSumByReservationId?: Map<string, number>
  locale: string
  emailDropdownOpen: string | null
  sendingEmail: string | null
  onPricingInfoClick: (reservation: Reservation) => void
  onCreateTour: (reservation: Reservation) => void
  onPickupTimeClick: (reservation: Reservation, e: React.MouseEvent) => void
  onPickupHotelClick: (reservation: Reservation, e: React.MouseEvent) => void
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
  onCustomerClick: (customer: Customer) => void
  onStatusChange?: (reservationId: string, newStatus: string) => Promise<void>
  getGroupColorClasses: (groupId: string, groupName?: string, optionName?: string) => string
  getSelectedChoicesFromNewSystem: (reservationId: string) => Promise<Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: {
      option_key: string
      option_name: string
      option_name_ko: string
      product_choices: { choice_group_ko: string }
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
      product_choices: { choice_group_ko: string }
    }
  }>>>
  /** Balance 테이블: 선택 행 산식 반영 후 목록 갱신 */
  onRefreshReservations?: () => void
  /** Balance: pricing만 병합 갱신(전체 재조회 없음 · 모달 유지) */
  onRefreshReservationPricing?: (reservationIds: string[]) => void | Promise<void>
  /** Balance 테이블: 페이지 밖에서 선택한 id의 예약 조회용(전체 필터 목록) */
  balanceReservationsForApply?: Reservation[]
  /** 취소 탭 등: 파트너 보증금 반환(-$취소) 행 추가 */
  showPartnerCancelRefundAction?: boolean
  /** 입금/옵션 집계 일부 갱신(예: 반환 라인 추가 후) */
  onRefreshPaymentAggregates?: (reservationIds: string[]) => void | Promise<void>
}

function pickupSummary(reservation: Reservation): { date: string; time: string } {
  const pickupTime = reservation.pickUpTime || ''
  if (!pickupTime) {
    return { date: '', time: '' }
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
  return { date: pickupDate, time: pickupTime }
}

function daysFromToday(tourDate: string | undefined, todayStr: string): number | null {
  if (!tourDate) return null
  const a = new Date(tourDate + 'T12:00:00')
  const b = new Date(todayStr + 'T12:00:00')
  const n = Math.round((a.getTime() - b.getTime()) / 86400000)
  return Number.isNaN(n) ? null : n
}

function isConfirmedReservation(r: Reservation): boolean {
  const s = (r.status as string)?.trim?.().toLowerCase?.() ?? ''
  return s === 'confirmed'
}

type TableRowProps = Omit<ReservationActionRequiredTableProps, 'reservations' | 'tableVariant'> & {
  reservation: Reservation
  onFollowUpClick: (reservation: Reservation) => void
}

function ReservationStatusDropdown({
  reservation,
  onStatusChange,
}: {
  reservation: Reservation
  onStatusChange?: (reservationId: string, newStatus: string) => Promise<void>
}) {
  const t = useTranslations('reservations')
  const [statusOpen, setStatusOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!statusOpen) return
    const close = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [statusOpen])

  const statusOptions = [
    { value: 'inquiry', labelKey: 'status.inquiry' },
    { value: 'pending', labelKey: 'status.pending' },
    { value: 'confirmed', labelKey: 'status.confirmed' },
    { value: 'completed', labelKey: 'status.completed' },
    { value: 'cancelled', labelKey: 'status.cancelled' },
  ] as const

  const handleStatusSelect = async (newStatus: string) => {
    if (!onStatusChange || newStatus === (reservation.status as string)?.toLowerCase?.()) {
      setStatusOpen(false)
      return
    }
    setStatusUpdating(true)
    try {
      await onStatusChange(reservation.id, newStatus)
      setStatusOpen(false)
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <div className="relative inline-block" ref={statusRef}>
      {onStatusChange ? (
        <button
          type="button"
          onClick={() => setStatusOpen((v) => !v)}
          disabled={statusUpdating}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-90 disabled:opacity-70 ${getStatusColor(reservation.status)}`}
        >
          {getStatusLabel(reservation.status, t)}
          <ChevronDown className={`w-3 h-3 ml-0.5 ${statusOpen ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
          {getStatusLabel(reservation.status, t)}
        </span>
      )}
      {onStatusChange && statusOpen && (
        <div className="absolute left-0 top-full mt-1 z-[70] py-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[7rem]">
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
  )
}

function CustomerCell({
  reservation,
  customers,
  onCustomerClick,
}: Pick<TableRowProps, 'reservation' | 'customers' | 'onCustomerClick'>) {
  const t = useTranslations('reservations')
  return (
    <td className="px-2 py-2 max-w-[10rem]">
      <button
        type="button"
        className="text-left font-medium text-gray-900 hover:text-blue-600 hover:underline"
        onClick={() => {
          const customer = customers.find((c) => c.id === reservation.customerId)
          if (customer) onCustomerClick(customer)
        }}
      >
        {getCustomerName(reservation.customerId, customers || [])}
      </button>
      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
        <Users className="w-3 h-3 shrink-0" />
        <span>
          {reservation.adults ?? 0}
          {t('card.peopleShort')}
          {(reservation.child ?? 0) > 0 && (
            <span className="text-orange-600">
              {' '}
              {reservation.child}
              {t('card.childShort')}
            </span>
          )}
          {(reservation.infant ?? 0) > 0 && (
            <span className="text-blue-600">
              {' '}
              {reservation.infant}
              {t('card.infantShort')}
            </span>
          )}
        </span>
      </div>
    </td>
  )
}

function ProductCell({
  reservation,
  products,
  locale,
  getGroupColorClasses,
  getSelectedChoicesFromNewSystem,
  choicesCacheRef,
}: Pick<
  TableRowProps,
  'reservation' | 'products' | 'locale' | 'getGroupColorClasses' | 'getSelectedChoicesFromNewSystem' | 'choicesCacheRef'
>) {
  return (
    <td className="px-2 py-2 min-w-[12rem]">
      <div className="font-medium text-gray-900 leading-snug">
        {getProductNameForLocale(reservation.productId, (products as any) || [], locale)}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        <ChoicesDisplay
          reservation={reservation}
          getGroupColorClasses={getGroupColorClasses}
          getSelectedChoicesFromNewSystem={getSelectedChoicesFromNewSystem}
          choicesCacheRef={choicesCacheRef}
        />
      </div>
    </td>
  )
}

function TourDateCell({ reservation }: Pick<TableRowProps, 'reservation'>) {
  return (
    <td className="px-2 py-2 whitespace-nowrap text-gray-800">
      <div className="flex items-center gap-1">
        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        {reservation.tourDate || '—'}
      </div>
    </td>
  )
}

function PickupCell({
  reservation,
  pickupHotels,
  onPickupTimeClick,
  onPickupHotelClick,
}: Pick<TableRowProps, 'reservation' | 'pickupHotels' | 'onPickupTimeClick' | 'onPickupHotelClick'>) {
  const t = useTranslations('reservations')
  const { date: puDate, time: puTime } = pickupSummary(reservation)
  return (
    <td className="px-2 py-2 max-w-[11rem]">
      <div className="flex items-start gap-1 text-gray-800">
        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
        {puTime ? (
          <button
            type="button"
            className="text-left hover:text-blue-600 hover:underline"
            onClick={(e) => onPickupTimeClick(reservation, e)}
          >
            {puDate} {puTime}
          </button>
        ) : (
          <span className="text-gray-500 italic text-xs">{t('card.pickupTbd')}</span>
        )}
      </div>
      <div className="flex items-start gap-1 mt-1 text-gray-700">
        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
        <button
          type="button"
          className="text-left text-xs leading-snug hover:text-blue-600 hover:underline line-clamp-2"
          onClick={(e) => onPickupHotelClick(reservation, e)}
        >
          {reservation.pickUpHotel
            ? getPickupHotelDisplay(reservation.pickUpHotel, (pickupHotels as any) || [])
            : t('card.pickupHotelTbd')}
        </button>
      </div>
    </td>
  )
}

function ChannelCell({ reservation, channels }: Pick<TableRowProps, 'reservation' | 'channels'>) {
  const line = formatChannelDashVariant(reservation.channelId, channels || [], reservation)
  return (
    <td className="px-2 py-2 max-w-[14rem]">
      <div className="flex items-start gap-1.5 min-w-0">
        <ReservationChannelFavicon
          channelId={reservation.channelId}
          channels={channels}
          sizeClass="h-3.5 w-3.5"
          className="mt-0.5"
        />
        <div className="min-w-0">
          <div className="text-xs text-gray-800 leading-snug break-words" title={line}>
            {line}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">RN: {reservation.channelRN ?? '—'}</div>
        </div>
      </div>
    </td>
  )
}

function ActionsCell(row: TableRowProps) {
  const t = useTranslations('reservations')
  const {
    reservation,
    onFollowUpClick,
    onPricingInfoClick,
    onCreateTour,
    onPaymentClick,
    onDetailClick,
    onReviewClick,
    onEmailPreview,
    onEmailLogsClick,
    onEmailDropdownToggle,
    onEditClick,
    emailDropdownOpen,
    sendingEmail,
    products,
  } = row
  const product = products?.find((p) => p.id === reservation.productId)
  const isManiaTour = product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service'
  const showCreateTour = isManiaTour && !reservation.hasExistingTour
  const showResidentInquiryEmail = productShowsResidentStatusSectionByCode(product?.product_code ?? null)

  return (
    <td className="px-2 py-2">
      <div className="flex flex-wrap gap-1 justify-end">
        <button
          type="button"
          title={t('actions.price')}
          className="p-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
          onClick={() => onPricingInfoClick(reservation)}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        </button>
        {showCreateTour && (
          <button
            type="button"
            title={t('card.createTourTitle')}
            className="p-1.5 rounded-md bg-green-50 text-green-600 border border-green-200 hover:bg-green-100"
            onClick={() => onCreateTour(reservation)}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          title={t('card.paymentHistoryTitle')}
          className="p-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
          onClick={() => onPaymentClick(reservation)}
        >
          <DollarSign className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title={t('card.viewCustomerTitle')}
          className="p-1.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100"
          onClick={() => onDetailClick(reservation)}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Follow up"
          className="p-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
          onClick={() => onFollowUpClick(reservation)}
        >
          <FileText className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title={t('card.reviewManagementTitle')}
          className="p-1.5 rounded-md bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-100"
          onClick={() => onReviewClick(reservation)}
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        <div className="relative inline-block">
          <button
            type="button"
            title={t('card.emailTitle')}
            disabled={sendingEmail === reservation.id}
            className="p-1.5 rounded-md bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 disabled:opacity-50"
            onClick={() => onEmailDropdownToggle(reservation.id)}
          >
            <Mail className="w-3.5 h-3.5" />
          </button>
          {emailDropdownOpen === reservation.id && (
            <div className="absolute right-0 mt-1 w-44 bg-white rounded-md shadow-lg border border-gray-200 z-[70] py-1">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => onEmailPreview(reservation, 'confirmation')}
              >
                {t('card.emailConfirmation')}
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => onEmailPreview(reservation, 'departure')}
              >
                {t('card.emailDeparture')}
              </button>
              <button
                type="button"
                disabled={!reservation.pickUpTime || !reservation.tourDate}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => onEmailPreview(reservation, 'pickup')}
              >
                {t('card.emailPickup')}
              </button>
              {showResidentInquiryEmail && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => onEmailPreview(reservation, 'resident_inquiry')}
                >
                  <UserRound className="w-3 h-3 shrink-0" />
                  {t('card.emailResidentInquiry')}
                </button>
              )}
              <div className="border-t border-gray-100 my-1" />
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                onClick={() => onEmailLogsClick(reservation.id)}
              >
                {t('card.emailLogs')}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          title={t('card.editReservationTitle')}
          className="p-1.5 rounded-md bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100"
          onClick={() => onEditClick(reservation.id)}
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
      </div>
    </td>
  )
}

function TourDateSortTh({
  label,
  tourDateSortActive,
  tourDateSortDir,
  onTourDateSortClick,
  className = 'px-2 py-2 whitespace-nowrap',
}: {
  label: string
  tourDateSortActive?: boolean
  tourDateSortDir?: SortDir
  onTourDateSortClick?: () => void
  className?: string
}) {
  if (!onTourDateSortClick) {
    return (
      <th scope="col" className={className}>
        {label}
      </th>
    )
  }
  return (
    <th scope="col" className={className}>
      <TableSortHeaderButton
        label={label}
        active={tourDateSortActive === true}
        dir={tourDateSortDir ?? 'asc'}
        onClick={onTourDateSortClick}
        className="text-xs font-semibold uppercase tracking-wide"
      />
    </th>
  )
}

function VariantTableThead({
  variant,
  tourDateSortActive,
  tourDateSortDir,
  onTourDateSortClick,
}: {
  variant: Exclude<ActionRequiredTableVariant, 'balance' | 'pricingNoPrice' | 'pricingMismatch'>
  tourDateSortActive?: boolean
  tourDateSortDir?: SortDir
  onTourDateSortClick?: () => void
}) {
  const t = useTranslations('reservations')
  const tc = (key: string) => t(`actionRequired.table.${key}` as Parameters<typeof t>[0])

  const base = 'bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide'

  switch (variant) {
    case 'status':
      return (
        <thead>
          <tr className={base}>
            <th scope="col" className="px-2 py-2">
              {tc('customer')}
            </th>
            <th scope="col" className="px-2 py-2">
              {tc('product')}
            </th>
            <TourDateSortTh
              label={tc('tourDate')}
              tourDateSortActive={tourDateSortActive}
              tourDateSortDir={tourDateSortDir}
              onTourDateSortClick={onTourDateSortClick}
            />
            <th scope="col" className="px-2 py-2 whitespace-nowrap">
              {tc('daysLeft')}
            </th>
            <th scope="col" className="px-2 py-2 whitespace-nowrap">
              {tc('status')}
            </th>
            <th scope="col" className="px-2 py-2">
              {tc('channelVariant')}
            </th>
            <th scope="col" className="px-2 py-2 text-right whitespace-nowrap">
              {tc('actions')}
            </th>
          </tr>
        </thead>
      )
    case 'tour':
      return (
        <thead>
          <tr className={base}>
            <th scope="col" className="px-2 py-2">
              {tc('customer')}
            </th>
            <th scope="col" className="px-2 py-2">
              {tc('product')}
            </th>
            <TourDateSortTh
              label={tc('tourDate')}
              tourDateSortActive={tourDateSortActive}
              tourDateSortDir={tourDateSortDir}
              onTourDateSortClick={onTourDateSortClick}
            />
            <th scope="col" className="px-2 py-2">
              {tc('pickup')}
            </th>
            <th scope="col" className="px-2 py-2 whitespace-nowrap">
              {tc('status')}
            </th>
            <th scope="col" className="px-2 py-2 whitespace-nowrap">
              {tc('tourAssignment')}
            </th>
            <th scope="col" className="px-2 py-2">
              {tc('channelVariant')}
            </th>
            <th scope="col" className="px-2 py-2 text-right whitespace-nowrap">
              {tc('actions')}
            </th>
          </tr>
        </thead>
      )
    case 'deposit':
      return (
        <thead>
          <tr className={base}>
            <th scope="col" className="px-2 py-2">
              {tc('customer')}
            </th>
            <th scope="col" className="px-2 py-2">
              {tc('product')}
            </th>
            <TourDateSortTh
              label={tc('tourDate')}
              tourDateSortActive={tourDateSortActive}
              tourDateSortDir={tourDateSortDir}
              onTourDateSortClick={onTourDateSortClick}
            />
            <th scope="col" className="px-2 py-2 whitespace-nowrap">
              {tc('status')}
            </th>
            <th scope="col" className="px-2 py-2">
              {tc('depositIssue')}
            </th>
            <th scope="col" className="px-2 py-2">
              {tc('channelVariant')}
            </th>
            <th scope="col" className="px-2 py-2 text-right whitespace-nowrap">
              {tc('actions')}
            </th>
          </tr>
        </thead>
      )
    case 'incompleteDraft':
      return (
        <thead>
          <tr className={base}>
            <th scope="col" className="px-2 py-2 whitespace-nowrap">
              {tc('reservationId')}
            </th>
            <th scope="col" className="px-2 py-2 whitespace-nowrap">
              {tc('createdAt')}
            </th>
            <th scope="col" className="px-2 py-2">
              {tc('channelVariant')}
            </th>
            <TourDateSortTh
              label={tc('tourDate')}
              tourDateSortActive={tourDateSortActive}
              tourDateSortDir={tourDateSortDir}
              onTourDateSortClick={onTourDateSortClick}
            />
            <th scope="col" className="px-2 py-2 min-w-[12rem]">
              {tc('incompleteDraftNote')}
            </th>
            <th scope="col" className="px-2 py-2 text-right whitespace-nowrap">
              {tc('actions')}
            </th>
          </tr>
        </thead>
      )
    default:
      return null
  }
}

type VariantRowHandlers = Omit<ReservationActionRequiredTableProps, 'reservations' | 'tableVariant'> & {
  onFollowUpClick: (reservation: Reservation) => void
}

function VariantTableBody({
  variant,
  reservations,
  onFollowUpClick,
  todayStr = new Date().toISOString().split('T')[0],
  hasTourAssigned,
  reservationIdsWithPayments,
  reservationPricingMap,
  optionChoices,
  products,
  locale,
  ...rowFields
}: {
  variant: Exclude<ActionRequiredTableVariant, 'balance' | 'pricingNoPrice' | 'pricingMismatch'>
  reservations: Reservation[]
} & VariantRowHandlers) {
  const t = useTranslations('reservations')
  const tc = (key: string) => t(`actionRequired.table.${key}` as Parameters<typeof t>[0])

  const toRow = (reservation: Reservation): TableRowProps => ({
    ...rowFields,
    reservationPricingMap,
    optionChoices,
    products,
    locale,
    onFollowUpClick,
    reservation,
  })

  return (
    <tbody>
      {reservations.map((reservation) => {
        const row = toRow(reservation)

        if (variant === 'status') {
          const d = daysFromToday(reservation.tourDate, todayStr)
          return (
            <tr key={reservation.id} className="border-b border-gray-100 hover:bg-gray-50/80 align-top">
              <CustomerCell reservation={reservation} customers={row.customers} onCustomerClick={row.onCustomerClick} />
              <ProductCell
                reservation={reservation}
                products={row.products}
                locale={row.locale}
                getGroupColorClasses={row.getGroupColorClasses}
                getSelectedChoicesFromNewSystem={row.getSelectedChoicesFromNewSystem}
                choicesCacheRef={row.choicesCacheRef}
              />
              <TourDateCell reservation={reservation} />
              <td className="px-2 py-2 whitespace-nowrap tabular-nums text-gray-800">{d == null ? '—' : d}</td>
              <td className="px-2 py-2 whitespace-nowrap">
                <ReservationStatusDropdown reservation={reservation} onStatusChange={row.onStatusChange} />
              </td>
              <ChannelCell reservation={reservation} channels={row.channels} />
              <ActionsCell {...row} />
            </tr>
          )
        }

        if (variant === 'tour') {
          const assigned = hasTourAssigned?.(reservation) ?? false
          return (
            <tr key={reservation.id} className="border-b border-gray-100 hover:bg-gray-50/80 align-top">
              <CustomerCell reservation={reservation} customers={row.customers} onCustomerClick={row.onCustomerClick} />
              <ProductCell
                reservation={reservation}
                products={row.products}
                locale={row.locale}
                getGroupColorClasses={row.getGroupColorClasses}
                getSelectedChoicesFromNewSystem={row.getSelectedChoicesFromNewSystem}
                choicesCacheRef={row.choicesCacheRef}
              />
              <TourDateCell reservation={reservation} />
              <PickupCell
                reservation={reservation}
                pickupHotels={row.pickupHotels}
                onPickupTimeClick={row.onPickupTimeClick}
                onPickupHotelClick={row.onPickupHotelClick}
              />
              <td className="px-2 py-2 whitespace-nowrap">
                <ReservationStatusDropdown reservation={reservation} onStatusChange={row.onStatusChange} />
              </td>
              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-800">
                <span className={assigned ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
                  {assigned ? tc('tourAssigned') : tc('tourUnassigned')}
                </span>
              </td>
              <ChannelCell reservation={reservation} channels={row.channels} />
              <ActionsCell {...row} />
            </tr>
          )
        }

        if (variant === 'deposit') {
          const hasPay = reservationIdsWithPayments?.has(reservation.id) ?? false
          const tourOk = hasTourAssigned?.(reservation) ?? false
          const product = row.products.find((p) => p.id === reservation.productId)
          const isMania = isManiaTourOrServiceSubCategory(product?.sub_category)
          const depositExempt = productExemptFromDepositRequirement(product)
          let issueLabel = tc('issueOther')
          if (isMania && hasPay && !tourOk) issueLabel = tc('issuePaymentNoTour')
          else if (isConfirmedReservation(reservation) && !hasPay && !depositExempt) {
            issueLabel = tc('issueConfirmedNoDeposit')
          }

          return (
            <tr key={reservation.id} className="border-b border-gray-100 hover:bg-gray-50/80 align-top">
              <CustomerCell reservation={reservation} customers={row.customers} onCustomerClick={row.onCustomerClick} />
              <ProductCell
                reservation={reservation}
                products={row.products}
                locale={row.locale}
                getGroupColorClasses={row.getGroupColorClasses}
                getSelectedChoicesFromNewSystem={row.getSelectedChoicesFromNewSystem}
                choicesCacheRef={row.choicesCacheRef}
              />
              <TourDateCell reservation={reservation} />
              <td className="px-2 py-2 whitespace-nowrap">
                <ReservationStatusDropdown reservation={reservation} onStatusChange={row.onStatusChange} />
              </td>
              <td className="px-2 py-2 text-xs text-gray-800 leading-snug max-w-[14rem]">{issueLabel}</td>
              <ChannelCell reservation={reservation} channels={row.channels} />
              <ActionsCell {...row} />
            </tr>
          )
        }

        if (variant === 'incompleteDraft') {
          const created =
            reservation.addedTime && String(reservation.addedTime).trim() !== ''
              ? String(reservation.addedTime).replace('T', ' ').slice(0, 19)
              : '—'
          return (
            <tr key={reservation.id} className="border-b border-gray-100 hover:bg-gray-50/80 align-top">
              <td className="px-2 py-2 font-mono text-[11px] text-gray-800 break-all max-w-[11rem]">{reservation.id}</td>
              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 tabular-nums">{created}</td>
              <ChannelCell reservation={reservation} channels={row.channels} />
              <TourDateCell reservation={reservation} />
              <td className="px-2 py-2 text-xs text-amber-900 leading-snug max-w-[18rem]">{tc('incompleteDraftHint')}</td>
              <ActionsCell {...row} />
            </tr>
          )
        }

        return null
      })}
    </tbody>
  )
}

function FollowUpModal({
  followUpReservation,
  onClose,
}: {
  followUpReservation: Reservation
  onClose: () => void
}) {
  const t = useTranslations('reservations')
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900">Follow up</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('card.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ReservationFollowUpSection reservationId={followUpReservation.id} status={followUpReservation.status as string} />
        </div>
      </div>
    </div>
  )
}

export function ReservationActionRequiredTable(props: ReservationActionRequiredTableProps) {
  const {
    reservations,
    tableVariant,
    tourDateSortActive,
    tourDateSortDir,
    onTourDateSortClick,
    showPartnerCancelRefundAction,
    onRefreshPaymentAggregates,
    ...rest
  } = props
  const [followUpReservation, setFollowUpReservation] = useState<Reservation | null>(null)

  const useBalanceLayout =
    tableVariant === 'balance' ||
    tableVariant === 'pricingNoPrice' ||
    tableVariant === 'pricingMismatch'

  if (useBalanceLayout) {
    return (
      <>
        <ReservationActionRequiredBalanceTable
          reservations={reservations}
          customers={rest.customers}
          products={rest.products}
          channels={rest.channels}
          reservationPricingMap={rest.reservationPricingMap}
          paymentRecordsByReservationId={rest.paymentRecordsByReservationId}
          reservationOptionSumByReservationId={rest.reservationOptionSumByReservationId}
          locale={rest.locale}
          emailDropdownOpen={rest.emailDropdownOpen}
          sendingEmail={rest.sendingEmail}
          onPricingInfoClick={rest.onPricingInfoClick}
          onCreateTour={rest.onCreateTour}
          onPaymentClick={rest.onPaymentClick}
          onDetailClick={rest.onDetailClick}
          onReviewClick={rest.onReviewClick}
          onEmailPreview={rest.onEmailPreview}
          onEmailLogsClick={rest.onEmailLogsClick}
          onEmailDropdownToggle={rest.onEmailDropdownToggle}
          onEditClick={rest.onEditClick}
          onCustomerClick={rest.onCustomerClick}
          onStatusChange={rest.onStatusChange}
          onFollowUpClick={setFollowUpReservation}
          onRefreshReservations={rest.onRefreshReservations}
          onRefreshReservationPricing={rest.onRefreshReservationPricing}
          balanceReservationsForApply={
            tableVariant === 'balance' ? rest.balanceReservationsForApply : undefined
          }
          actionsColumnEditOnly
          enableMismatchFormulaBundleApply={tableVariant === 'pricingMismatch'}
          showPartnerCancelRefundAction={showPartnerCancelRefundAction}
          onRefreshPaymentAggregates={onRefreshPaymentAggregates}
          tourDateSortActive={tourDateSortActive}
          tourDateSortDir={tourDateSortDir}
          onTourDateSortClick={onTourDateSortClick}
        />
        {followUpReservation && <FollowUpModal followUpReservation={followUpReservation} onClose={() => setFollowUpReservation(null)} />}
      </>
    )
  }

  const minW =
    tableVariant === 'tour'
      ? 'min-w-[1000px]'
      : tableVariant === 'incompleteDraft'
        ? 'min-w-[820px]'
        : 'min-w-[880px]'

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className={`w-full text-sm text-left ${minW}`}>
          <VariantTableThead
            variant={tableVariant}
            tourDateSortActive={tourDateSortActive}
            tourDateSortDir={tourDateSortDir}
            onTourDateSortClick={onTourDateSortClick}
          />
          <VariantTableBody
            variant={tableVariant}
            reservations={reservations}
            onFollowUpClick={setFollowUpReservation}
            {...rest}
          />
        </table>
      </div>
      {followUpReservation && <FollowUpModal followUpReservation={followUpReservation} onClose={() => setFollowUpReservation(null)} />}
    </>
  )
}
