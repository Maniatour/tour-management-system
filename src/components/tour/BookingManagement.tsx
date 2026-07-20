import React from 'react'
import { Plus, Hotel, ListPlus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { formatTicketBookingStatusLabel, getTicketBookingStatusBadgeClass } from '@/lib/ticketBookingStatus'
import { ConnectionStatusLabel } from './TourUIComponents'

/** 간단히 보기(집계) 시 체크인·시간·인원·예약번호를 줄 단위로 표시하기 위한 한 줄 데이터 */
export interface TicketBookingDetailRow {
  check_in_date: string | null
  time: string | null
  ea: number
  reservation_id: string | null
  rn_number: string | null
  invoice_number?: string | null
  status?: string | null
}

interface LocalTicketBooking {
  id: string
  reservation_id?: string | null
  status?: string | null
  company?: string | null
  category?: string | null
  check_in_date?: string | null
  time?: string | null
  ea?: number | null
  expense?: number | null
  rn_number?: string | null
  invoice_number?: string | null
  deletion_requested_at?: string | null
  /** 간단히 보기 시 회사별 하위 행 */
  bookingDetails?: TicketBookingDetailRow[]
}

function formatTicketCheckInYmd(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s
}

function formatTicketTimeHm(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null
  return typeof raw === 'string' ? raw.substring(0, 5) : String(raw)
}

function TicketBookingInfoBadges({
  checkInDate,
  time,
  ea,
  reservationId,
  peopleLabel,
  checkInLabel,
  timeLabel,
  reservationLabel,
}: {
  checkInDate: string | null
  time: string | null
  ea: number
  reservationId: string | null
  peopleLabel: string
  checkInLabel: string
  timeLabel: string
  reservationLabel: string
}) {
  const dateYmd = formatTicketCheckInYmd(checkInDate)
  const timeHm = formatTicketTimeHm(time)
  const resId = reservationId?.trim() || null

  return (
    <div className="flex flex-wrap items-center gap-1">
      {dateYmd ? (
        <span
          className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900"
          title={checkInLabel}
        >
          {dateYmd}
        </span>
      ) : null}
      {timeHm ? (
        <span
          className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950"
          title={timeLabel}
        >
          {timeHm}
        </span>
      ) : null}
      <span
        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-800"
        title={peopleLabel}
      >
        {ea} {peopleLabel}
      </span>
      {resId ? (
        <span
          className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-mono text-xs font-medium text-violet-900"
          title={reservationLabel}
        >
          #{resId}
        </span>
      ) : null}
    </div>
  )
}

interface LocalTourHotelBooking {
  id: string
  reservation_id?: string | null
  reservation_name?: string | null
  status?: string | null
  hotel?: string | null
  room_type?: string | null
  rooms?: number | null
  check_in_date?: string | null
  check_out_date?: string | null
  rn_number?: string | null
  booking_reference?: string | null
  total_price?: number | null
}

interface BookingManagementProps {
  ticketBookings: LocalTicketBooking[]
  tourHotelBookings: LocalTourHotelBooking[]
  filteredTicketBookings: LocalTicketBooking[]
  showTicketBookingDetails: boolean
  loadingStates: { bookings: boolean }
  connectionStatus: { bookings: boolean; hotelBookings: boolean }
  isStaff: boolean
  onAddTicketBooking: () => void
  /** 입장권 일괄 추가 모달 (투어 상세 등에서 전달) */
  onBulkAddTicketBooking?: () => void
  onAddTourHotelBooking: () => void
  onEditTicketBooking: (booking: LocalTicketBooking) => void
  onEditTourHotelBooking: (booking: LocalTourHotelBooking) => void
  onToggleTicketBookingDetails: () => void
}

export const BookingManagement: React.FC<BookingManagementProps> = ({
  ticketBookings,
  tourHotelBookings,
  filteredTicketBookings,
  showTicketBookingDetails,
  loadingStates,
  connectionStatus,
  isStaff,
  onAddTicketBooking,
  onBulkAddTicketBooking,
  onAddTourHotelBooking,
  onEditTicketBooking,
  onEditTourHotelBooking,
  onToggleTicketBookingDetails
}) => {
  const t = useTranslations('tours.bookingManagement')
  const tCal = useTranslations('booking.calendar')
  const locale = useLocale()

  const badgeLabels = {
    checkIn: t('checkIn'),
    time: t('time'),
    people: t('people'),
    reservation: t('reservationId'),
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            {t('title')}
            <ConnectionStatusLabel status={connectionStatus.bookings && connectionStatus.hotelBookings} section={t('section')} />
            {loadingStates.bookings && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
            )}
          </h2>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={onAddTicketBooking}
              className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 flex items-center space-x-1"
            >
              <Plus size={12} />
              <span>{t('addTicket')}</span>
            </button>
            {onBulkAddTicketBooking ? (
              <button
                type="button"
                onClick={onBulkAddTicketBooking}
                className="px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 flex items-center space-x-1"
              >
                <ListPlus size={12} />
                <span>{t('bulkAddTicket')}</span>
              </button>
            ) : null}
            <button
              onClick={onAddTourHotelBooking}
              className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center space-x-1"
            >
              <Plus size={12} />
              <span>{t('addHotel')}</span>
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
          {/* 입장권 부킹 목록 */}
          {ticketBookings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  {t('ticketBookingLabel')} ({filteredTicketBookings.length})
                  {!showTicketBookingDetails && ticketBookings.length > filteredTicketBookings.length && 
                    ` / Total ${ticketBookings.length}`
                  }
                </h3>
                <button
                  onClick={onToggleTicketBookingDetails}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                >
                  {showTicketBookingDetails ? t('simpleView') : t('detailedView')}
                </button>
              </div>
              <div className="space-y-1">
                {filteredTicketBookings.map((booking: LocalTicketBooking) => {
                  // 간단 보기일 때는 합산된 결과이므로 클릭 불가
                  const isAggregated = booking.id?.startsWith('aggregated-')
                  
                  return (
                    <div 
                      key={booking.id} 
                      className={`p-2 border rounded ${isAggregated ? '' : 'cursor-pointer hover:bg-gray-50'} transition-colors ${isStaff && !isAggregated ? '' : 'cursor-not-allowed'}`}
                      onClick={() => !isAggregated && onEditTicketBooking(booking)}
                    >
                      {/* 첫 번째 줄: company, status(우상단), 삭제 요청 배지 */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex min-w-0 items-center space-x-2">
                          <span className="text-lg shrink-0">🎫</span>
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {booking.company || 'N/A'}
                          </span>
                          {!isAggregated && booking.deletion_requested_at && (
                            <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              {t('deletionRequested')}
                            </span>
                          )}
                        </div>
                        {booking.status ? (
                          <span
                            className={`shrink-0 text-xs px-2 py-1 rounded-full ${getTicketBookingStatusBadgeClass(booking.status)}`}
                          >
                            {formatTicketBookingStatusLabel(booking.status, tCal, locale)}
                          </span>
                        ) : null}
                      </div>
                      
                      {/* 두 번째 줄: 체크인·시간·인원·예약번호 뱃지 */}
                      <div className="text-xs">
                        {isAggregated && booking.bookingDetails && booking.bookingDetails.length > 0 ? (
                          <div className="space-y-1.5">
                            {booking.bookingDetails.map((row, i) => (
                              <div key={i} className="flex flex-wrap items-center justify-between gap-1">
                                <TicketBookingInfoBadges
                                  checkInDate={row.check_in_date}
                                  time={row.time}
                                  ea={row.ea}
                                  reservationId={row.reservation_id}
                                  peopleLabel={badgeLabels.people}
                                  checkInLabel={badgeLabels.checkIn}
                                  timeLabel={badgeLabels.time}
                                  reservationLabel={badgeLabels.reservation}
                                />
                                <span className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                                  {/* 카드 우상단 상태가 없을 때(회사 내 상태 혼재) 행별 상태 표시 */}
                                  {!booking.status && row.status ? (
                                    <span
                                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getTicketBookingStatusBadgeClass(row.status)}`}
                                    >
                                      {formatTicketBookingStatusLabel(row.status, tCal, locale)}
                                    </span>
                                  ) : null}
                                  {row.rn_number ? (
                                    <span className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 font-mono">
                                      {t('rnNumber')}: {row.rn_number}
                                    </span>
                                  ) : null}
                                  {row.invoice_number?.trim() ? (
                                    <span className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 font-mono">
                                      Inv: {row.invoice_number}
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-1">
                              {!isAggregated && booking.category ? (
                                <span className="block text-[11px] font-medium text-gray-600">
                                  {booking.category}
                                </span>
                              ) : null}
                              <TicketBookingInfoBadges
                                checkInDate={booking.check_in_date ?? null}
                                time={booking.time ?? null}
                                ea={booking.ea || 0}
                                reservationId={booking.reservation_id ?? null}
                                peopleLabel={badgeLabels.people}
                                checkInLabel={badgeLabels.checkIn}
                                timeLabel={badgeLabels.time}
                                reservationLabel={badgeLabels.reservation}
                              />
                              {!isAggregated && (booking.rn_number || booking.invoice_number?.trim()) ? (
                                <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                                  {booking.rn_number ? (
                                    <span className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 font-mono">
                                      {t('rnNumber')}: {booking.rn_number}
                                    </span>
                                  ) : null}
                                  {booking.invoice_number?.trim() ? (
                                    <span className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 font-mono">
                                      Inv: {booking.invoice_number}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            {!isAggregated && booking.expense && booking.expense > 0 ? (
                              <span className="shrink-0 font-semibold text-green-600">
                                ${booking.expense.toFixed(2)}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 투어 호텔 부킹 목록 */}
          {tourHotelBookings.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">{t('hotelBooking')} ({tourHotelBookings.length})</h3>
              <div className="space-y-2">
                {tourHotelBookings.map((booking: LocalTourHotelBooking) => (
                  <div 
                    key={booking.id} 
                    className={`border rounded p-3 cursor-pointer hover:bg-gray-50 ${isStaff ? '' : 'cursor-not-allowed'}`}
                    onClick={() => onEditTourHotelBooking(booking)}
                  >
                    {/* 호텔 부킹 제목과 예약번호 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Hotel className="h-3 w-3 text-primary" />
                        <span className="font-medium text-sm">
                          {booking.hotel} ({booking.room_type}, {booking.rooms} {t('rooms')})
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 font-mono">
                        {booking.rn_number || booking.booking_reference || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-600">
                      {/* 체크인/체크아웃 같은 줄에 배치 */}
                      <div className="flex items-center space-x-4 mb-2">
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500">{t('checkIn')}:</span>
                          <span className="font-medium">{booking.check_in_date}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500">{t('checkOut')}:</span>
                          <span className="font-medium">{booking.check_out_date}</span>
                        </div>
                      </div>
                      
                      {/* 예약자 이름 + 상태 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                          <span
                            className="text-sm font-medium text-gray-900 truncate max-w-[min(100%,14rem)]"
                            title={booking.reservation_name?.trim() || undefined}
                          >
                            {booking.reservation_name?.trim() || '—'}
                          </span>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-gray-500">{t('statusLabel')}:</span>
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${getTicketBookingStatusBadgeClass(booking.status)}`}
                            >
                              {formatTicketBookingStatusLabel(booking.status, tCal, locale)}
                            </span>
                          </div>
                        </div>
                        {/* 오른쪽 아래: 금액 */}
                        {booking.total_price != null && Number(booking.total_price) > 0 && (
                          <span className="font-semibold text-green-600">
                            ${Number(booking.total_price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 부킹이 없는 경우 */}
          {ticketBookings.length === 0 && tourHotelBookings.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <Hotel className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">{t('noBookings')}</p>
              <p className="text-xs">{t('noBookingsMessage')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
