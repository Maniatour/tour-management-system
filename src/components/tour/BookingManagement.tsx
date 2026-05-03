import React from 'react'
import { Plus, Hotel, ListPlus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { formatTicketBookingStatusLabel, getTicketBookingStatusBadgeClass } from '@/lib/ticketBookingStatus'
import { ConnectionStatusLabel } from './TourUIComponents'

/** 간단히 보기(집계) 시 시간·인원·예약번호·RN#을 줄 단위로 표시하기 위한 한 줄 데이터 */
export interface TicketBookingDetailRow {
  time: string | null
  ea: number
  reservation_id: string | null
  rn_number: string | null
  invoice_number?: string | null
}

interface LocalTicketBooking {
  id: string
  reservation_id?: string | null
  status?: string | null
  company?: string | null
  category?: string | null
  time?: string | null
  ea?: number | null
  expense?: number | null
  rn_number?: string | null
  invoice_number?: string | null
  deletion_requested_at?: string | null
  /** 간단히 보기 시 회사별 하위 행 (시간, 인원, 예약번호) */
  bookingDetails?: TicketBookingDetailRow[]
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

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            {t('title')}
            <ConnectionStatusLabel status={connectionStatus.bookings && connectionStatus.hotelBookings} section={t('section')} />
            {loadingStates.bookings && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 ml-2"></div>
            )}
          </h2>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={onAddTicketBooking}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center space-x-1"
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
                      {/* 첫 번째 줄: company, status, 삭제 요청 배지 */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">🎫</span>
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {booking.company || 'N/A'}
                          </span>
                          {!isAggregated && booking.deletion_requested_at && (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              {t('deletionRequested')}
                            </span>
                          )}
                        </div>
                        {!isAggregated && booking.status && (
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${getTicketBookingStatusBadgeClass(booking.status)}`}
                          >
                            {formatTicketBookingStatusLabel(booking.status, tCal, locale)}
                          </span>
                        )}
                      </div>
                      
                      {/* 두 번째 줄: 상세보기 = 카테고리/시간/인원/예약번호, 간단히 보기 = 줄마다 "시간 인원 #예약번호" */}
                      <div className="text-xs text-gray-500">
                        {isAggregated && booking.bookingDetails && booking.bookingDetails.length > 0 ? (
                          <div className="space-y-0.5">
                            {booking.bookingDetails.map((row, i) => (
                              <div key={i} className="flex items-center gap-x-2">
                                <span>{row.time ?? '–'}</span>
                                <span>{row.ea} {t('people')}</span>
                                {row.reservation_id && (
                                  <span className="font-mono">#{row.reservation_id}</span>
                                )}
                                {row.rn_number && (
                                  <span className="font-mono">{t('rnNumber')}: {row.rn_number}</span>
                                )}
                                {row.invoice_number?.trim() && (
                                  <span className="font-mono">Invoice#: {row.invoice_number}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {!isAggregated && (
                                <span className="font-medium text-gray-700">
                                  {booking.category || 'N/A'}
                                </span>
                              )}
                              {booking.time != null && booking.time !== '' && (
                                <span>{typeof booking.time === 'string' ? booking.time.substring(0, 5) : booking.time}</span>
                              )}
                              <span>
                                {booking.ea || 0} {t('people')}
                              </span>
                              {booking.reservation_id != null && booking.reservation_id !== '' && (
                                <span className="font-mono">{booking.reservation_id}</span>
                              )}
                              {!isAggregated && booking.rn_number && (
                                <span>#{booking.rn_number}</span>
                              )}
                              {!isAggregated && booking.invoice_number?.trim() && (
                                <span className="font-mono">Inv: {booking.invoice_number}</span>
                              )}
                            </div>
                            {!isAggregated && booking.expense && booking.expense > 0 && (
                              <span className="font-semibold text-green-600">
                                ${booking.expense.toFixed(2)}
                              </span>
                            )}
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
                        <Hotel className="h-3 w-3 text-blue-600" />
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
