'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useProductTourDateAvailability } from '@/hooks/useProductTourDateAvailability'
import {
  buildMonthGrid,
  TOUR_DATE_STATUS_DOT_CLASS,
  toIsoDateLocal,
  type TourDateStatus,
} from '@/lib/productTourDateStatus'

type BookingFlowAlternateDatesMultiCalendarProps = {
  productId: string
  primaryTourDate: string
  selectedDates: string[]
  onSelectedDatesChange: (dates: string[]) => void
  translate: (ko: string, en: string) => string
}

const STATUS_KEYS: TourDateStatus[] = [
  'available',
  'recruiting',
  'confirmed',
  'almost_full',
  'closed',
]

function formatAlternateDateLabel(ymd: string, locale: string): string {
  const date = new Date(`${ymd}T12:00:00`)
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export default function BookingFlowAlternateDatesMultiCalendar({
  productId,
  primaryTourDate,
  selectedDates,
  onSelectedDatesChange,
  translate,
}: BookingFlowAlternateDatesMultiCalendarProps) {
  const t = useTranslations('productDetail')
  const locale = useLocale()
  const { loading, getStatusForDate, isDateSelectable, todayIso } =
    useProductTourDateAvailability(productId)

  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDates[0]
      ? new Date(`${selectedDates[0]}T12:00:00`)
      : primaryTourDate
        ? new Date(`${primaryTourDate}T12:00:00`)
        : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const monthPair = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const second = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
    return [first, second]
  }, [viewMonth])

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      weekday: 'short',
    })
    return Array.from({ length: 7 }, (_, offset) =>
      formatter.format(new Date(2024, 0, 7 + offset))
    )
  }, [locale])

  const statusLabels: Record<TourDateStatus, string> = {
    available: t('dateStatusAvailable'),
    recruiting: t('dateStatusRecruiting'),
    confirmed: t('dateStatusConfirmed'),
    almost_full: t('dateStatusAlmostFull'),
    closed: t('dateStatusClosed'),
    past: '',
  }

  const toggleDate = (iso: string) => {
    if (iso === primaryTourDate) return
    if (selectedDates.includes(iso)) {
      onSelectedDatesChange(selectedDates.filter((date) => date !== iso))
      return
    }
    onSelectedDatesChange([...selectedDates, iso].sort())
  }

  const renderMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const cells = buildMonthGrid(year, month)
    const monthTitle = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      month: 'long',
      year: 'numeric',
    }).format(monthDate)

    return (
      <div className="booking-calendar-month" key={`${year}-${month}`}>
        <p className="booking-calendar-month-title">{monthTitle}</p>
        <div className="booking-calendar-weekdays">
          {weekdayLabels.map((label) => (
            <span key={`${monthTitle}-${label}`} className="booking-calendar-weekday">
              {label}
            </span>
          ))}
        </div>
        <div className="booking-calendar-days">
          {cells.map((cell, index) => {
            if (!cell.date || !cell.isCurrentMonth) {
              return <span key={`empty-${year}-${month}-${index}`} className="booking-calendar-day-empty" />
            }

            const iso = toIsoDateLocal(cell.date)
            const status = getStatusForDate(cell.date)
            const selectable = isDateSelectable(cell.date)
            const isPrimary = iso === primaryTourDate
            const isSelected = selectedDates.includes(iso)
            const isToday = iso === todayIso
            const canSelect = selectable && !isPrimary

            return (
              <button
                key={iso}
                type="button"
                disabled={!canSelect && !isSelected}
                onClick={() => toggleDate(iso)}
                aria-pressed={isSelected}
                aria-label={
                  isPrimary
                    ? translate('주 출발일', 'Primary departure date')
                    : formatAlternateDateLabel(iso, locale)
                }
                className={`booking-calendar-day ${isSelected ? 'is-selected' : ''} ${isPrimary ? 'is-primary-tour' : ''} ${isToday && !isSelected && !isPrimary ? 'is-today' : ''} ${!canSelect && !isSelected ? 'is-disabled' : ''}`}
              >
                <span className="booking-calendar-day-number">{cell.date.getDate()}</span>
                {status !== 'past' ? (
                  <span
                    className={`booking-calendar-status-dot ${TOUR_DATE_STATUS_DOT_CLASS[status]}`}
                    aria-hidden
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="booking-alternate-dates-calendar">
      <p className="mb-3 text-xs text-muted-foreground">
        {translate(
          '달력에서 여러 날짜를 선택할 수 있습니다. 날짜를 다시 누르면 선택이 해제됩니다.',
          'Select multiple dates on the calendar. Tap a selected date again to remove it.'
        )}
      </p>

      {selectedDates.length > 0 ? (
        <p className="mb-3 text-xs font-medium text-foreground">
          {translate(
            `${selectedDates.length}개 날짜 선택됨`,
            `${selectedDates.length} date${selectedDates.length === 1 ? '' : 's'} selected`
          )}
        </p>
      ) : null}

      <div className="booking-calendar-panel !pb-4">
        {loading ? (
          <div className="booking-calendar-loading">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span>{t('calendarLoading')}</span>
          </div>
        ) : (
          <>
            <div className="booking-calendar-nav">
              <button
                type="button"
                className="booking-calendar-nav-btn"
                onClick={() =>
                  setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                aria-label={t('previousMonth')}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="booking-calendar-nav-btn"
                onClick={() =>
                  setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                aria-label={t('nextMonth')}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="booking-calendar-months">{monthPair.map((month) => renderMonth(month))}</div>

            <div className="booking-calendar-legend">
              {STATUS_KEYS.map((status) => (
                <div key={status} className="booking-calendar-legend-item">
                  <span
                    className={`booking-calendar-legend-dot ${TOUR_DATE_STATUS_DOT_CLASS[status]}`}
                    aria-hidden
                  />
                  <span>{statusLabels[status]}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
