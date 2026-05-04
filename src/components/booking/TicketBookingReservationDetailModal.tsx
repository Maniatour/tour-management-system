'use client'

import type { ReactNode } from 'react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { isSuperAdminActor } from '@/lib/superAdmin'
import { canRequestTicketBookingSoftDelete } from '@/lib/ticketBookingSoftDelete'
import {
  formatTicketBookingAxisLabel,
  getBookingAxisStatusBadgeClass,
  getChangeAxisStatusBadgeClass,
  getVendorAxisStatusBadgeClass,
} from '@/lib/ticketBookingAxisLabels'
import {
  isWorkflowInitialPhase,
  type TicketBookingWorkflowSnapshot,
} from '@/lib/ticketBookingWorkflow'
import {
  TicketBookingBookingStatusIcon,
  TicketBookingVendorStatusIcon,
} from '@/components/booking/ticketBookingAxisStatusIcons'
import TicketBookingActionPanel from '@/components/booking/TicketBookingActionPanel'
import ScheduleTicketBookingAxisInline from '@/components/booking/ScheduleTicketBookingAxisInline'

/** 입장권 부킹 — 예약 상세 정보 모달에 필요한 행 타입 */
export type TicketBookingReservationDetailRow = {
  id: string
  submit_on: string
  category: string
  company: string
  reservation_name: string
  time: string
  ea: number
  total_price: number
  status: string
  cc: string
  rn_number: string
  invoice_number?: string | undefined
  /** Zelle 결제 시 Confirmation 번호 */
  zelle_confirmation_number?: string | null | undefined
  updated_at: string
  booking_status?: string | null | undefined
  vendor_status?: string | null | undefined
  change_status?: string | null | undefined
  payment_status?: string | null | undefined
  refund_status?: string | null | undefined
  operation_status?: string | null | undefined
  tours?: {
    tour_date: string
    total_people?: number
    products?: { name?: string; name_en?: string; name_ko?: string }
  } | undefined
  /** 테이블 뷰와 동일 컬럼용 (선택 — 없으면 '—') */
  check_in_date?: string | undefined
  expense?: number | null | undefined
  income?: number | null | undefined
  payment_method?: string | undefined
  unit_price?: number | undefined
  paid_amount?: number | null | undefined
  deletion_requested_at?: string | null | undefined
}

function getProductName(
  locale: string,
  product: { name?: string; name_en?: string; name_ko?: string } | undefined,
  tourFallback: string
) {
  if (!product) return tourFallback
  if (locale === 'en' && product.name_en) return product.name_en
  return product.name || tourFallback
}

function getCCStatusText(cc: string) {
  switch (cc) {
    case 'sent':
      return 'CC 발송 완료'
    case 'not_sent':
      return '미발송'
    case 'not_needed':
      return '필요없음'
    default:
      return cc || '-'
  }
}

function getCCStatusTextLocale(cc: string, locale: string) {
  if (locale !== 'en') return getCCStatusText(cc)
  switch (cc) {
    case 'sent':
      return 'CC sent'
    case 'not_sent':
      return 'Not sent'
    case 'not_needed':
      return 'N/A'
    default:
      return cc || '—'
  }
}

function getCCStatusColor(cc: string) {
  switch (cc) {
    case 'sent':
      return 'bg-green-100 text-green-800'
    case 'not_sent':
      return 'bg-yellow-100 text-yellow-800'
    case 'not_needed':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function paymentMethodLabel(locale: string, method: string | undefined): string {
  const m = (method ?? '').trim().toLowerCase()
  const ko: Record<string, string> = {
    credit_card: '신용카드',
    bank_transfer: '계좌이체',
    cash: '현금',
    other: '기타',
  }
  const en: Record<string, string> = {
    credit_card: 'Credit card',
    bank_transfer: 'Bank transfer',
    cash: 'Cash',
    other: 'Other',
  }
  const map = locale === 'en' ? en : ko
  return map[m] || (m ? m : '—')
}

function formatSubmitOnCell(submit_on: string): string {
  const date = new Date(submit_on)
  if (Number.isNaN(date.getTime())) return submit_on || '—'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day}/${year} ${hours}:${minutes}`
}

function formatCheckInYmd(raw: string | undefined): string {
  const s = (raw ?? '').trim()
  if (!s) return '—'
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatUsdCell(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `$${Number(n)}`
}

function workflowSnapshotFromDetailRow(
  b: TicketBookingReservationDetailRow
): TicketBookingWorkflowSnapshot {
  return {
    booking_status: b.booking_status ?? null,
    vendor_status: b.vendor_status ?? null,
    change_status: b.change_status ?? null,
    payment_status: b.payment_status ?? null,
  }
}

function paymentAxisCellText(
  booking: TicketBookingReservationDetailRow,
  tTbAxis: (key: string) => string
): string {
  if (isWorkflowInitialPhase(workflowSnapshotFromDetailRow(booking))) return '—'
  const label = formatTicketBookingAxisLabel(tTbAxis, 'payment', booking.payment_status)
  if (String(booking.payment_status ?? '').toLowerCase() === 'paid') {
    const amt = booking.paid_amount ?? booking.expense
    if (amt != null && Number.isFinite(Number(amt))) return `${label} · $${Number(amt)}`
  }
  return label
}

const DETAIL_TABLE_COL_COUNT = 20

function rowBackgroundForLegacyStatus(status: string): string {
  const st = status.toLowerCase()
  if (st === 'pending') return 'bg-yellow-50/90'
  if (st === 'confirmed') return 'bg-green-50/90'
  if (st === 'cancelled' || st === 'canceled') return 'bg-red-50/90'
  if (st === 'completed') return 'bg-blue-50/90'
  if (st === 'credit') return 'bg-cyan-50/90'
  return 'bg-gray-50/90'
}

export type TicketBookingReservationDetailModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookings: TicketBookingReservationDetailRow[]
  /** true면 편집/히스토리/삭제 버튼 숨김 (통계 등 조회 전용) */
  readOnly?: boolean
  onEdit?: (booking: TicketBookingReservationDetailRow) => void
  onViewHistory?: (bookingId: string) => void
  /** OP·매니저 — 삭제 요청(소프트) */
  onRequestSoftDelete?: (bookingId: string) => void
  /** SUPER — 영구 삭제 */
  onHardDelete?: (bookingId: string) => void
  /** 데이터 로딩 중 (통계에서 비동기 조회 시) */
  loading?: boolean
  /** 액션 RPC 성공 후 목록 새로고침 등 */
  onActionApplied?: () => void
  /**
   * 제공 시 RN 그룹마다 메인 테이블과 동일한 데스크톱 행을 렌더 (TicketBookingList 전용).
   * 미제공 시 기존 요약 테이블 UI(통계 등).
   */
  renderGroupDesktopTable?: (groupRows: TicketBookingReservationDetailRow[]) => ReactNode
  /** 테이블과 함께 제공 시 상단에서 카드/테이블 전환 (TicketBookingList 전용) */
  renderGroupCardBookings?: (groupRows: TicketBookingReservationDetailRow[]) => ReactNode
}

export default function TicketBookingReservationDetailModal({
  open,
  onOpenChange,
  bookings,
  readOnly = false,
  onEdit,
  onViewHistory,
  onRequestSoftDelete,
  onHardDelete,
  loading = false,
  onActionApplied,
  renderGroupDesktopTable,
  renderGroupCardBookings,
}: TicketBookingReservationDetailModalProps) {
  const locale = useLocale()
  const t = useTranslations('booking.calendar')
  const tTbAxis = useTranslations('booking.calendar.ticketBookingAxis')
  const { user, userPosition } = useAuth()
  const canHardDeleteBooking = useMemo(
    () => isSuperAdminActor(user?.email, userPosition),
    [user?.email, userPosition]
  )
  const canSoftDeleteRequest = useMemo(
    () => canRequestTicketBookingSoftDelete(userPosition),
    [userPosition]
  )
  const tourFallback = t('tour')
  const [detailListView, setDetailListView] = useState<'table' | 'card'>('card')
  const showDetailViewToggle = Boolean(renderGroupDesktopTable && renderGroupCardBookings)

  useEffect(() => {
    if (open) setDetailListView('card')
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-booking-detail-modal-title"
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white ${
          showDetailViewToggle && detailListView === 'card'
            ? 'max-w-[min(42.667rem,calc(100vw-2rem))] shadow-xl'
            : 'max-w-none shadow-lg sm:max-w-[min(1920px,calc(100vw-1rem))]'
        }`}
      >
        <div
          className={
            showDetailViewToggle && detailListView === 'card' ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
          }
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 id="ticket-booking-detail-modal-title" className="text-lg font-semibold sm:text-xl">
              {t('ticketBookingDetailModalTitle')}
            </h3>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {showDetailViewToggle ? (
                <div
                  className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 shadow-sm"
                  role="group"
                  aria-label={locale === 'en' ? 'Detail layout' : '상세 표시 방식'}
                >
                  <button
                    type="button"
                    onClick={() => setDetailListView('table')}
                    title={t('ticketBookingDetailModalViewTableTitle')}
                    aria-pressed={detailListView === 'table'}
                    className={`touch-manipulation rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                      detailListView === 'table'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('ticketBookingDetailModalViewTable')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailListView('card')}
                    title={t('ticketBookingDetailModalViewCardTitle')}
                    aria-pressed={detailListView === 'card'}
                    className={`touch-manipulation rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                      detailListView === 'card'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('ticketBookingDetailModalViewCard')}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="닫기"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-gray-500">불러오는 중...</p>
          ) : bookings.length === 0 ? (
            <p className="py-8 text-center text-gray-500">등록된 입장권 부킹이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {(() => {
                const rnGroupKey = (b: TicketBookingReservationDetailRow) => {
                  const v = b.rn_number?.trim()
                  return v ? v : '__empty_rn__'
                }
                const rnGroupLabel = (key: string) => (key === '__empty_rn__' ? 'RN# 없음' : key)

                const map = new Map<string, TicketBookingReservationDetailRow[]>()
                for (const b of bookings) {
                  const k = rnGroupKey(b)
                  const list = map.get(k)
                  if (list) list.push(b)
                  else map.set(k, [b])
                }

                const sortedKeys = [...map.keys()].sort((a, b) => {
                  if (a === '__empty_rn__') return 1
                  if (b === '__empty_rn__') return -1
                  return a.localeCompare(b, undefined, { numeric: true })
                })

                return sortedKeys.map((key) => {
                  const groupBookings = (map.get(key) || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                  const finalized = groupBookings.filter((b) => {
                    const s = b.status?.toLowerCase()
                    return s === 'confirmed' || s === 'completed'
                  })
                  const finalBooking =
                    finalized.length === 0
                      ? null
                      : finalized.reduce((best, b) => {
                          const tB = new Date(b.updated_at).getTime()
                          const tBest = new Date(best.updated_at).getTime()
                          return tB >= tBest ? b : best
                        })
                  const finalTimeDisplay = finalBooking?.time ? finalBooking.time.replace(/:\d{2}$/, '') : null
                  return (
                    <div key={`modal-rn-${key}`} className="space-y-2">
                      <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="shrink-0 text-sm font-semibold text-gray-800">RN#: {rnGroupLabel(key)}</span>
                          {finalBooking ? (
                            <span className="text-xs text-gray-600">
                              <span className="text-gray-500">시간</span>{' '}
                              <span className="font-medium text-gray-800">{finalTimeDisplay || '—'}</span>
                              <span className="mx-1.5 text-gray-300">·</span>
                              <span className="text-gray-500">수량</span>{' '}
                              <span className="font-medium text-gray-800">{finalBooking.ea}개</span>
                              <span className="mx-1.5 text-gray-300">·</span>
                              <span className="text-gray-500">가격</span>{' '}
                              <span className="font-medium text-gray-800">${finalBooking.total_price}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">확정/완료 없음</span>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-gray-500">{groupBookings.length}건</span>
                      </div>
                      {renderGroupDesktopTable ? (
                        detailListView === 'card' && renderGroupCardBookings ? (
                          renderGroupCardBookings(groupBookings)
                        ) : (
                          renderGroupDesktopTable(groupBookings)
                        )
                      ) : (
                      <div className="mt-1 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                        {(() => {
                          const col =
                            locale === 'en'
                              ? {
                                  status: 'Status',
                                  vendor: 'Vendor',
                                  payment: 'Payment',
                                  refund: 'Refund',
                                  supplier: 'Supplier',
                                  category: 'Category',
                                  date: 'Date',
                                  time: 'Time',
                                  qty: 'Qty',
                                  expense: 'Expense (USD)',
                                  income: 'Income (USD)',
                                  rn: 'RN#',
                                  payMethod: 'Pay method',
                                  zelle: 'Zelle #',
                                  cc: 'CC',
                                  tour: 'Tour',
                                  invoice: 'Invoice#',
                                  submit: 'Submitted',
                                  guest: 'Guest',
                                  actions: 'Actions',
                                }
                              : {
                                  status: '상태',
                                  vendor: '벤더',
                                  payment: '결제',
                                  refund: '환불·크레딧',
                                  supplier: '공급업체',
                                  category: '카테고리',
                                  date: '날짜',
                                  time: '시간',
                                  qty: '수량',
                                  expense: '비용(USD)',
                                  income: '수입(USD)',
                                  rn: 'RN#',
                                  payMethod: '결제방법',
                                  zelle: 'Zelle 확인#',
                                  cc: 'CC',
                                  tour: '투어연결',
                                  invoice: 'Invoice#',
                                  submit: '제출일',
                                  guest: '예약자',
                                  actions: '액션',
                                }
                          const th =
                            'px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-gray-500 border-b border-gray-200 bg-gray-50 whitespace-nowrap'
                          const td = 'px-2 py-1.5 align-top text-xs text-gray-900 border-b border-gray-100'

                          return (
                            <table className="w-full min-w-[1100px] border-collapse text-left">
                              <thead>
                                <tr>
                                  <th className={th}>{col.status}</th>
                                  <th className={th}>{col.vendor}</th>
                                  <th className={th}>{col.payment}</th>
                                  <th className={th}>{col.refund}</th>
                                  <th className={th}>{col.supplier}</th>
                                  <th className={th}>{col.category}</th>
                                  <th className={th}>{col.date}</th>
                                  <th className={th}>{col.time}</th>
                                  <th className={th}>{col.qty}</th>
                                  <th className={th}>{col.expense}</th>
                                  <th className={th}>{col.income}</th>
                                  <th className={th}>{col.rn}</th>
                                  <th className={th}>{col.payMethod}</th>
                                  <th className={th}>{col.zelle}</th>
                                  <th className={th}>{col.cc}</th>
                                  <th className={th}>{col.tour}</th>
                                  <th className={th}>{col.invoice}</th>
                                  <th className={th}>{col.submit}</th>
                                  <th className={th}>{col.guest}</th>
                                  <th className={`${th} text-center`}>{col.actions}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupBookings.map((booking) => {
                                  const rowBg = rowBackgroundForLegacyStatus(booking.status || '')
                                  const timeShort = (booking.time || '').replace(/:\d{2}$/, '') || '—'
                                  const refundText = isWorkflowInitialPhase(
                                    workflowSnapshotFromDetailRow(booking)
                                  )
                                    ? '—'
                                    : formatTicketBookingAxisLabel(tTbAxis, 'refund', booking.refund_status)
                                  return (
                                    <Fragment key={booking.id}>
                                      <tr className={rowBg}>
                                        <td className={`${td} max-w-[7rem]`}>
                                          <div className="flex min-w-0 flex-col gap-1">
                                            <span
                                              className={`inline-flex max-w-full w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getBookingAxisStatusBadgeClass(booking.booking_status)}`}
                                            >
                                              <TicketBookingBookingStatusIcon
                                                status={booking.booking_status}
                                                className="h-3 w-3 shrink-0"
                                                title={formatTicketBookingAxisLabel(
                                                  tTbAxis,
                                                  'booking',
                                                  booking.booking_status
                                                )}
                                              />
                                              <span className="truncate">
                                                {formatTicketBookingAxisLabel(
                                                  tTbAxis,
                                                  'booking',
                                                  booking.booking_status
                                                )}
                                              </span>
                                            </span>
                                            {!isWorkflowInitialPhase(
                                              workflowSnapshotFromDetailRow(booking)
                                            ) &&
                                            String(booking.change_status ?? 'none').toLowerCase() !== 'none' ? (
                                              <span
                                                className={`inline-flex w-fit max-w-full truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${getChangeAxisStatusBadgeClass(booking.change_status)}`}
                                              >
                                                {formatTicketBookingAxisLabel(
                                                  tTbAxis,
                                                  'change',
                                                  booking.change_status
                                                )}
                                              </span>
                                            ) : null}
                                          </div>
                                        </td>
                                        <td className={`${td} max-w-[6rem]`}>
                                          <span
                                            className={`inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getVendorAxisStatusBadgeClass(booking.vendor_status)}`}
                                          >
                                            <TicketBookingVendorStatusIcon
                                              status={booking.vendor_status}
                                              className="h-3 w-3 shrink-0"
                                              title={formatTicketBookingAxisLabel(
                                                tTbAxis,
                                                'vendor',
                                                booking.vendor_status
                                              )}
                                            />
                                            <span className="truncate">
                                              {formatTicketBookingAxisLabel(
                                                tTbAxis,
                                                'vendor',
                                                booking.vendor_status
                                              )}
                                            </span>
                                          </span>
                                        </td>
                                        <td className={`${td} max-w-[9rem] whitespace-normal break-words`}>
                                          {paymentAxisCellText(booking, tTbAxis)}
                                        </td>
                                        <td className={td}>{refundText}</td>
                                        <td className={`${td} min-w-[5rem]`}>
                                          <span className="line-clamp-2 break-words">{booking.company}</span>
                                        </td>
                                        <td className={`${td} max-w-[6rem]`}>
                                          <span className="line-clamp-2 break-words">{booking.category}</span>
                                        </td>
                                        <td className={`${td} whitespace-nowrap tabular-nums`}>
                                          {formatCheckInYmd(booking.check_in_date)}
                                        </td>
                                        <td className={`${td} whitespace-nowrap tabular-nums`}>{timeShort}</td>
                                        <td className={`${td} tabular-nums`}>
                                          {locale === 'en' ? `${booking.ea} ea` : `${booking.ea}개`}
                                        </td>
                                        <td className={`${td} tabular-nums`}>{formatUsdCell(booking.expense)}</td>
                                        <td className={`${td} tabular-nums`}>{formatUsdCell(booking.income)}</td>
                                        <td className={`${td} font-mono text-[11px]`}>{booking.rn_number || '—'}</td>
                                        <td className={td}>{paymentMethodLabel(locale, booking.payment_method)}</td>
                                        <td
                                          className={`${td} max-w-[6rem] truncate`}
                                          title={booking.zelle_confirmation_number?.trim() || ''}
                                        >
                                          {booking.zelle_confirmation_number?.trim() || '—'}
                                        </td>
                                        <td className={td}>
                                          <span
                                            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getCCStatusColor(booking.cc)}`}
                                          >
                                            {getCCStatusTextLocale(booking.cc, locale)}
                                          </span>
                                        </td>
                                        <td className={`${td} max-w-[8rem]`}>
                                          {booking.tours ? (
                                            <div className="min-w-0">
                                              <div className="font-medium text-green-700">
                                                {locale === 'en' ? 'Linked' : '연결'}
                                              </div>
                                              <div className="truncate text-[11px] text-gray-600">
                                                {getProductName(locale, booking.tours.products, tourFallback)}
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="text-red-600">{locale === 'en' ? 'Unlinked' : '미연결'}</span>
                                          )}
                                        </td>
                                        <td className={`${td} max-w-[6rem] truncate font-mono text-[11px]`}>
                                          {booking.invoice_number?.trim() || '—'}
                                        </td>
                                        <td className={`${td} whitespace-nowrap text-[11px] tabular-nums`}>
                                          {formatSubmitOnCell(booking.submit_on)}
                                        </td>
                                        <td className={`${td} max-w-[7rem]`}>
                                          <span className="line-clamp-2 break-words">{booking.reservation_name}</span>
                                        </td>
                                        <td className={`${td} text-center`}>
                                          {!readOnly &&
                                          (onEdit ||
                                            onViewHistory ||
                                            (onHardDelete && canHardDeleteBooking) ||
                                            (onRequestSoftDelete &&
                                              canSoftDeleteRequest &&
                                              !canHardDeleteBooking &&
                                              !booking.deletion_requested_at)) ? (
                                            <div className="flex flex-col items-stretch gap-1">
                                              {onEdit ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    onEdit(booking)
                                                    onOpenChange(false)
                                                  }}
                                                  className="rounded bg-blue-600 px-2 py-0.5 text-[10px] text-white hover:bg-blue-700"
                                                >
                                                  {locale === 'en' ? 'Edit' : '편집'}
                                                </button>
                                              ) : null}
                                              {onViewHistory ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    onViewHistory(booking.id)
                                                    onOpenChange(false)
                                                  }}
                                                  className="rounded bg-green-600 px-2 py-0.5 text-[10px] text-white hover:bg-green-700"
                                                >
                                                  {locale === 'en' ? 'History' : '히스토리'}
                                                </button>
                                              ) : null}
                                              {booking.deletion_requested_at ? (
                                                <span className="text-[10px] text-amber-700">
                                                  {locale === 'en' ? 'Deletion pending' : '삭제 요청됨'}
                                                </span>
                                              ) : null}
                                              {onRequestSoftDelete &&
                                              canSoftDeleteRequest &&
                                              !canHardDeleteBooking &&
                                              !booking.deletion_requested_at ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    onRequestSoftDelete(booking.id)
                                                    onOpenChange(false)
                                                  }}
                                                  className="rounded bg-amber-600 px-2 py-0.5 text-[10px] text-white hover:bg-amber-700"
                                                >
                                                  {locale === 'en' ? 'Delete' : '삭제'}
                                                </button>
                                              ) : null}
                                              {onHardDelete && canHardDeleteBooking ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    onHardDelete(booking.id)
                                                    onOpenChange(false)
                                                  }}
                                                  className="rounded bg-red-600 px-2 py-0.5 text-[10px] text-white hover:bg-red-700"
                                                >
                                                  {locale === 'en' ? 'Delete' : '삭제'}
                                                </button>
                                              ) : null}
                                            </div>
                                          ) : (
                                            <span className="text-gray-400">—</span>
                                          )}
                                        </td>
                                      </tr>
                                      {!readOnly ? (
                                        <tr className="bg-white">
                                          <td
                                            colSpan={DETAIL_TABLE_COL_COUNT}
                                            className="border-b border-gray-200 px-3 py-3"
                                          >
                                            <div className="space-y-3 text-xs">
                                              <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2">
                                                <span className="shrink-0 font-semibold text-gray-700">
                                                  {locale === 'en' ? 'Booking & vendor' : '예약·벤더'}
                                                </span>
                                                <ScheduleTicketBookingAxisInline
                                                  booking={{
                                                    id: booking.id,
                                                    status: booking.status ?? null,
                                                    booking_status: booking.booking_status,
                                                    vendor_status: booking.vendor_status,
                                                    change_status: booking.change_status,
                                                    payment_status: booking.payment_status,
                                                    refund_status: booking.refund_status,
                                                    operation_status: booking.operation_status,
                                                  }}
                                                  instanceKey={`ticket-detail-modal-${booking.id}`}
                                                  disabled={false}
                                                  compact={false}
                                                  className="min-w-0"
                                                  onAxesUpdated={() => {
                                                    onActionApplied?.()
                                                  }}
                                                />
                                              </div>
                                              <TicketBookingActionPanel
                                                bookingId={booking.id}
                                                axes={{
                                                  booking_status: booking.booking_status,
                                                  vendor_status: booking.vendor_status,
                                                  change_status: booking.change_status,
                                                  payment_status: booking.payment_status,
                                                  refund_status: booking.refund_status,
                                                  operation_status: booking.operation_status,
                                                }}
                                                onApplied={() => {
                                                  onActionApplied?.()
                                                }}
                                              />
                                            </div>
                                          </td>
                                        </tr>
                                      ) : null}
                                    </Fragment>
                                  )
                                })}
                              </tbody>
                            </table>
                          )
                        })()}
                      </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
