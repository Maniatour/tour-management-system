import React, { useMemo, useState } from 'react'
import { DoorClosed, DoorOpen, Hotel, History, RefreshCw, Ticket } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { formatTicketBookingStatusLabel, getTicketBookingStatusBadgeClass } from '@/lib/ticketBookingStatus'
import { tourHotelBookingStatusLabel, isCancelledTourHotelBooking, isActiveTourHotelBookingForList, normalizeTourHotelBookingStatus } from '@/lib/tourHotelReferences'
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

function getHotelBookingStatusBadgeClass(status: string | null | undefined): string {
  switch (normalizeTourHotelBookingStatus(status)) {
    case 'confirmed':
      return 'bg-green-100 text-green-800'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
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
  unit_price?: number | null
  payment_method?: string | null
  replaces_booking_id?: string | null
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
  onRebookTourHotelBooking?: (booking: LocalTourHotelBooking) => void
  onViewTourHotelBookingHistory?: (booking: LocalTourHotelBooking) => void
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
  onRebookTourHotelBooking,
  onViewTourHotelBookingHistory,
  compact = false,
}) => {
  const chrome = useTourDetailSectionChrome()
  const isCompact = compact || chrome.compact
  const t = useTranslations('tours.bookingManagement')
  const tCal = useTranslations('booking.calendar')
  const locale = useLocale()
  const [showCancelledHotelBookings, setShowCancelledHotelBookings] = useState(false)

  const cancelledHotelBookingsCount = useMemo(
    () => tourHotelBookings.filter((b) => isCancelledTourHotelBooking(b.status)).length,
    [tourHotelBookings]
  )

  const visibleHotelBookings = useMemo(() => {
    if (showCancelledHotelBookings) return tourHotelBookings
    return tourHotelBookings.filter((b) => isActiveTourHotelBookingForList(b.status))
  }, [tourHotelBookings, showCancelledHotelBookings])

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
              <div className={`flex flex-wrap items-center justify-between gap-2 ${chrome.compact ? 'mb-1' : 'mb-2'}`}>
                <h3 className={chrome.subsectionTitle}>
                  {t('hotelBooking')} ({visibleHotelBookings.length}
                  {cancelledHotelBookingsCount > 0 && !showCancelledHotelBookings
                    ? ` / ${tourHotelBookings.length}`
                    : ''}
                  )
                </h3>
                {cancelledHotelBookingsCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowCancelledHotelBookings((v) => !v)}
                    className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
                      showCancelledHotelBookings
                        ? 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    {showCancelledHotelBookings ? t('hideCancelledHotelBookings') : t('showCancelledHotelBookings')}
                    {!showCancelledHotelBookings ? ` (${cancelledHotelBookingsCount})` : ''}
                  </button>
                ) : null}
              </div>
              {visibleHotelBookings.length === 0 ? (
                <p className={`${chrome.bodyCaption} text-muted-foreground py-2`}>
                  {t('noActiveHotelBookings')}
                </p>
              ) : (
              <div className="space-y-1">
                {visibleHotelBookings.map((booking: LocalTourHotelBooking) => (
                  <div 
                    key={booking.id} 
                    className={`border rounded ${chrome.compact ? 'p-2' : 'p-3'} cursor-pointer hover:bg-gray-50 ${isStaff ? '' : 'cursor-not-allowed'} ${
                      isCancelledTourHotelBooking(booking.status) ? 'opacity-75 bg-red-50/40' : ''
                    }`}
                    onClick={() => isStaff && onEditTourHotelBooking(booking)}
                  >
                    <div className={`grid grid-cols-[1fr_auto] gap-x-3 ${chrome.compact ? 'gap-y-1' : 'gap-y-1.5'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Hotel className={`${chrome.compact ? 'h-3 w-3' : 'h-4 w-4'} text-primary shrink-0`} />
                        <span className={`font-medium ${chrome.bodyText} truncate`}>
                          {booking.hotel} ({booking.room_type}, {booking.rooms} {t('rooms')})
                        </span>
                        {booking.replaces_booking_id ? (
                          <span
                            className="shrink-0 rounded-full bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[10px] font-medium text-violet-800"
                            title={booking.replaces_booking_id}
                          >
                            {locale === 'ko' ? '변경' : 'Replaced'}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-end self-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs leading-none whitespace-nowrap ${getHotelBookingStatusBadgeClass(booking.status)}`}
                        >
                          {tourHotelBookingStatusLabel(booking.status, locale)}
                        </span>
                      </div>

                      <div className={`flex items-center ${chrome.bodyRowGap} min-w-0 ${chrome.bodyCaption}`}>
                        <div
                          className="flex items-center gap-1"
                          title={t('checkIn')}
                          aria-label={`${t('checkIn')}: ${booking.check_in_date}`}
                        >
                          <DoorOpen className={`${chrome.compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-gray-500 shrink-0`} aria-hidden />
                          <span className="font-medium">{booking.check_in_date}</span>
                        </div>
                        <div
                          className="flex items-center gap-1"
                          title={t('checkOut')}
                          aria-label={`${t('checkOut')}: ${booking.check_out_date}`}
                        >
                          <DoorClosed className={`${chrome.compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-gray-500 shrink-0`} aria-hidden />
                          <span className="font-medium">{booking.check_out_date}</span>
                        </div>
                      </div>
                      <div className={`flex items-center justify-end self-center ${chrome.bodyCaption}`}>
                        <span className={`${chrome.bodyMuted} font-mono text-xs whitespace-nowrap`}>
                          RN# {booking.rn_number || booking.booking_reference || 'N/A'}
                        </span>
                      </div>

                      <div className={`flex items-center gap-2 min-w-0 ${chrome.bodyCaption}`}>
                        <span
                          className={`font-medium ${chrome.bodyText} truncate`}
                          title={booking.reservation_name?.trim() || undefined}
                        >
                          {booking.reservation_name?.trim() || '—'}
                        </span>
                        {booking.total_price != null && Number(booking.total_price) > 0 && (
                          <span className="font-semibold text-green-600 shrink-0">
                            ${Number(booking.total_price).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-1 self-center">
                        {onViewTourHotelBookingHistory && isStaff ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onViewTourHotelBookingHistory(booking)
                            }}
                            className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={locale === 'ko' ? '히스토리' : 'History'}
                            aria-label={locale === 'ko' ? '히스토리' : 'History'}
                          >
                            <History className={chrome.compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                          </button>
                        ) : null}
                        {onRebookTourHotelBooking && isStaff && !isCancelledTourHotelBooking(booking.status) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onRebookTourHotelBooking(booking)
                            }}
                            className="p-1 rounded text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                            title={locale === 'ko' ? '재예약' : 'Rebook'}
                            aria-label={locale === 'ko' ? '재예약' : 'Rebook'}
                          >
                            <RefreshCw className={chrome.compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          {/* 부킹이 없는 경우 */}
          {ticketBookings.length === 0 && visibleHotelBookings.length === 0 && tourHotelBookings.length === 0 && (
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
