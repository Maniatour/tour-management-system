import React from 'react'
import { Hotel, Ticket } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { formatTicketBookingStatusLabel, getTicketBookingStatusBadgeClass } from '@/lib/ticketBookingStatus'
import { ConnectionStatusLabel } from './TourUIComponents'
import { useTourDetailSectionChrome } from './TourDetailModalChromeContext'

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

function formatTicketBookingAmount(expense: number, ea: number): string {
  const total = expense.toFixed(2)
  if (ea > 0) {
    const perPerson = (expense / ea).toFixed(2)
    return `$${total} ($${perPerson})`
  }
  return `$${total}`
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
  loadingStates: { bookings: boolean }
  connectionStatus: { bookings: boolean; hotelBookings: boolean }
  isStaff: boolean
  onAddTicketBooking: () => void
  /** 입장권 일괄 추가 모달 (투어 상세 등에서 전달) */
  onBulkAddTicketBooking?: () => void
  onAddTourHotelBooking: () => void
  onEditTicketBooking: (booking: LocalTicketBooking) => void
  onEditTourHotelBooking: (booking: LocalTourHotelBooking) => void
  /** 투어 상세 모달 — 아이콘 버튼·일괄 추가 숨김 */
  compact?: boolean
}

export const BookingManagement: React.FC<BookingManagementProps> = ({
  ticketBookings,
  tourHotelBookings,
  loadingStates,
  connectionStatus,
  isStaff,
  onAddTicketBooking,
  onBulkAddTicketBooking,
  onAddTourHotelBooking,
  onEditTicketBooking,
  onEditTourHotelBooking,
  compact = false,
}) => {
  const chrome = useTourDetailSectionChrome()
  const isCompact = compact || chrome.compact
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
      <div className={chrome.shellPadding}>
        <div className={`flex items-center justify-between gap-2 ${chrome.headerMargin}`}>
          <h2 className={`${chrome.sectionTitle} flex items-center min-w-0`}>
            {t('title')}
            <ConnectionStatusLabel status={connectionStatus.bookings && connectionStatus.hotelBookings} section={t('section')} />
            {loadingStates.bookings && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
            )}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            {isCompact ? (
              <>
                <button
                  type="button"
                  onClick={onAddTicketBooking}
                  className={`${chrome.iconButton} bg-primary text-primary-foreground hover:bg-primary/90`}
                  title={t('addTicket')}
                  aria-label={t('addTicket')}
                >
                  <Ticket size={chrome.iconSize} />
                </button>
                <button
                  type="button"
                  onClick={onAddTourHotelBooking}
                  className={`${chrome.iconButton} bg-green-600 text-white hover:bg-green-700`}
                  title={t('addHotel')}
                  aria-label={t('addHotel')}
                >
                  <Hotel size={chrome.iconSize} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onAddTicketBooking}
                  className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 flex items-center space-x-1"
                >
                  <Ticket size={12} />
                  <span>{t('addTicket')}</span>
                </button>
                {onBulkAddTicketBooking ? (
                  <button
                    type="button"
                    onClick={onBulkAddTicketBooking}
                    className="px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 flex items-center space-x-1"
                  >
                    <span>{t('bulkAddTicket')}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onAddTourHotelBooking}
                  className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center space-x-1"
                >
                  <Hotel size={12} />
                  <span>{t('addHotel')}</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className={chrome.bodyStack}>
          {/* 입장권 부킹 목록 */}
          {ticketBookings.length > 0 && (
            <div>
              <h3 className={chrome.subsectionTitle}>
                {t('ticketBookingLabel')} ({ticketBookings.length})
              </h3>
              <div className="space-y-1">
                {ticketBookings.map((booking: LocalTicketBooking) => (
                    <div 
                      key={booking.id} 
                      className={`${chrome.compact ? 'p-1.5' : 'p-2'} border rounded cursor-pointer hover:bg-gray-50 transition-colors ${isStaff ? '' : 'cursor-not-allowed'}`}
                      onClick={() => onEditTicketBooking(booking)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex min-w-0 items-center space-x-2">
                          <span className={`${chrome.compact ? 'text-base' : 'text-lg'} shrink-0`}>🎫</span>
                          <span className={`font-medium ${chrome.bodyText} truncate`}>
                            {booking.company || 'N/A'}
                          </span>
                          {booking.deletion_requested_at && (
                            <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              {t('deletionRequested')}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {booking.rn_number ? (
                            <span className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-600">
                              {t('rnNumber')}: {booking.rn_number}
                            </span>
                          ) : null}
                          {booking.status ? (
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${getTicketBookingStatusBadgeClass(booking.status)}`}
                            >
                              {formatTicketBookingStatusLabel(booking.status, tCal, locale)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      
                      <div className={chrome.bodyCaption}>
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <div className="min-w-0 flex-1 space-y-1">
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
                          </div>
                          <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                            {booking.expense != null && booking.expense > 0 ? (
                              <span className="font-semibold text-green-600">
                                {formatTicketBookingAmount(booking.expense, booking.ea || 0)}
                              </span>
                            ) : null}
                            {booking.invoice_number?.trim() ? (
                              <span className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                                Inv: {booking.invoice_number}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          )}

          {/* 투어 호텔 부킹 목록 */}
          {tourHotelBookings.length > 0 && (
            <div>
              <h3 className={chrome.subsectionTitle}>{t('hotelBooking')} ({tourHotelBookings.length})</h3>
              <div className="space-y-1">
                {tourHotelBookings.map((booking: LocalTourHotelBooking) => (
                  <div 
                    key={booking.id} 
                    className={`border rounded ${chrome.compact ? 'p-2' : 'p-3'} cursor-pointer hover:bg-gray-50 ${isStaff ? '' : 'cursor-not-allowed'}`}
                    onClick={() => onEditTourHotelBooking(booking)}
                  >
                    <div className={`flex items-center justify-between ${chrome.compact ? 'mb-1' : 'mb-2'}`}>
                      <div className="flex items-center space-x-2">
                        <Hotel className={`${chrome.compact ? 'h-3 w-3' : 'h-4 w-4'} text-primary`} />
                        <span className={`font-medium ${chrome.bodyText}`}>
                          {booking.hotel} ({booking.room_type}, {booking.rooms} {t('rooms')})
                        </span>
                      </div>
                      <span className={`${chrome.bodyMuted} font-mono`}>
                        {booking.rn_number || booking.booking_reference || 'N/A'}
                      </span>
                    </div>
                    
                    <div className={chrome.bodyCaption}>
                      <div className={`flex items-center ${chrome.bodyRowGap} ${chrome.compact ? 'mb-1' : 'mb-2'}`}>
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500">{t('checkIn')}:</span>
                          <span className="font-medium">{booking.check_in_date}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500">{t('checkOut')}:</span>
                          <span className="font-medium">{booking.check_out_date}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                          <span
                            className={`font-medium ${chrome.bodyText} truncate max-w-[min(100%,14rem)]`}
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
            <div className={`text-center py-6 ${chrome.bodyCaption}`}>
              <Hotel className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>{t('noBookings')}</p>
              <p className={chrome.bodyMuted}>{t('noBookingsMessage')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
