'use client'

import React, { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { isSuperAdminEmail } from '@/lib/superAdmin'

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
  invoice_number?: string
  /** Zelle 결제 시 Confirmation 번호 */
  zelle_confirmation_number?: string | null
  updated_at: string
  tours?: {
    tour_date: string
    products?: { name?: string; name_en?: string; name_ko?: string }
  }
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

function getStatusColor(status: string) {
  const normalizedStatus = status?.toLowerCase()
  switch (normalizedStatus) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'confirmed':
      return 'bg-green-100 text-green-800'
    case 'cancelled':
    case 'canceled':
      return 'bg-red-100 text-red-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    case 'credit':
      return 'bg-cyan-100 text-cyan-800'
    case 'cancellation_requested':
      return 'bg-orange-100 text-orange-800'
    case 'guest_change_requested':
      return 'bg-purple-100 text-purple-800'
    case 'time_change_requested':
      return 'bg-indigo-100 text-indigo-800'
    case 'payment_requested':
      return 'bg-pink-100 text-pink-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
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

export type TicketBookingReservationDetailModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookings: TicketBookingReservationDetailRow[]
  /** true면 편집/히스토리/삭제 버튼 숨김 (통계 등 조회 전용) */
  readOnly?: boolean
  onEdit?: (booking: TicketBookingReservationDetailRow) => void
  onViewHistory?: (bookingId: string) => void
  onDelete?: (bookingId: string) => void
  /** 데이터 로딩 중 (통계에서 비동기 조회 시) */
  loading?: boolean
}

export default function TicketBookingReservationDetailModal({
  open,
  onOpenChange,
  bookings,
  readOnly = false,
  onEdit,
  onViewHistory,
  onDelete,
  loading = false,
}: TicketBookingReservationDetailModalProps) {
  const locale = useLocale()
  const t = useTranslations('booking.calendar')
  const { user } = useAuth()
  const canDeleteBooking = useMemo(() => isSuperAdminEmail(user?.email), [user?.email])
  const tourFallback = t('tour')

  const getStatusText = (status: string) => {
    const normalizedStatus = status?.toLowerCase()
    switch (normalizedStatus) {
      case 'pending':
        return t('pending')
      case 'confirmed':
        return t('confirmed')
      case 'cancelled':
      case 'canceled':
        return t('cancelled')
      case 'completed':
        return t('completed')
      case 'credit':
        return '크레딧'
      case 'cancellation_requested':
        return '전체 취소 요청'
      case 'guest_change_requested':
        return '인원 변경 요청'
      case 'time_change_requested':
        return '시간 변경 요청'
      case 'payment_requested':
        return '결제 요청'
      default:
        return status
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-booking-detail-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 id="ticket-booking-detail-modal-title" className="text-xl font-semibold">
              {t('ticketBookingDetailModalTitle')}
            </h3>
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
                      <div className="space-y-1 pl-0 sm:pl-1">
                        {groupBookings.map((booking) => {
                          const st = (booking.status || '').toLowerCase()
                          const rowTone =
                            st === 'pending'
                              ? 'border-yellow-200 bg-yellow-50'
                              : st === 'confirmed'
                                ? 'border-green-200 bg-green-50'
                                : st === 'cancelled' || st === 'canceled'
                                  ? 'border-red-200 bg-red-50'
                                  : st === 'completed'
                                    ? 'border-blue-200 bg-blue-50'
                                    : st === 'credit'
                                      ? 'border-cyan-200 bg-cyan-50'
                                      : 'border-gray-200 bg-gray-50'
                          return (
                          <div
                            key={booking.id}
                            className={`rounded border p-2 transition-opacity hover:opacity-90 ${rowTone}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="grid flex-1 grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-6">
                                <div>
                                  <div className="text-xs text-gray-500">제출일</div>
                                  <div className="text-xs font-medium">
                                    {(() => {
                                      const date = new Date(booking.submit_on)
                                      const month = String(date.getMonth() + 1).padStart(2, '0')
                                      const day = String(date.getDate()).padStart(2, '0')
                                      const year = date.getFullYear()
                                      const hours = String(date.getHours()).padStart(2, '0')
                                      const minutes = String(date.getMinutes()).padStart(2, '0')
                                      return `${month}/${day}/${year} ${hours}:${minutes}`
                                    })()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">카테고리</div>
                                  <div className="truncate text-sm font-medium">{booking.category}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">공급업체</div>
                                  <div className="truncate text-sm font-medium">{booking.company}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">예약자</div>
                                  <div className="truncate text-sm font-medium">{booking.reservation_name}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">시간</div>
                                  <div className="text-sm font-medium">
                                    {(booking.time || '').replace(/:\d{2}$/, '') || '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">수량/가격</div>
                                  <div className="text-sm font-medium">
                                    {booking.ea}개 / ${booking.total_price}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">Invoice#</div>
                                  <div className="truncate text-sm font-medium">
                                    {booking.invoice_number?.trim() || '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">Zelle 확인#</div>
                                  <div className="truncate text-sm font-medium">
                                    {booking.zelle_confirmation_number?.trim() || '—'}
                                  </div>
                                </div>
                              </div>

                              <div className="ml-2 flex items-center space-x-2">
                                <div className="flex flex-col items-end space-y-1">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(booking.status)}`}
                                  >
                                    {getStatusText(booking.status)}
                                  </span>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getCCStatusColor(booking.cc)}`}
                                  >
                                    {getCCStatusText(booking.cc)}
                                  </span>
                                </div>

                                <div className="min-w-[80px] text-right">
                                  {booking.tours ? (
                                    <div>
                                      <div className="text-xs font-medium text-green-600">투어 연결</div>
                                      <div className="truncate text-xs text-gray-500">
                                        {getProductName(locale, booking.tours.products, tourFallback)}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-red-500">미연결</div>
                                  )}
                                </div>

                                {!readOnly && (onEdit || onViewHistory || (onDelete && canDeleteBooking)) ? (
                                  <div className="flex space-x-1">
                                    {onEdit ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onEdit(booking)
                                          onOpenChange(false)
                                        }}
                                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-700"
                                        title="편집"
                                      >
                                        편집
                                      </button>
                                    ) : null}
                                    {onViewHistory ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onViewHistory(booking.id)
                                          onOpenChange(false)
                                        }}
                                        className="rounded bg-green-600 px-2 py-1 text-xs text-white transition-colors hover:bg-green-700"
                                        title="히스토리"
                                      >
                                        히스토리
                                      </button>
                                    ) : null}
                                    {onDelete && canDeleteBooking ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onDelete(booking.id)
                                          onOpenChange(false)
                                        }}
                                        className="rounded bg-red-600 px-2 py-1 text-xs text-white transition-colors hover:bg-red-700"
                                        title="삭제"
                                      >
                                        삭제
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          )
                        })}
                      </div>
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
