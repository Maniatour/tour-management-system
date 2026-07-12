'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useProductTourDateAvailability } from '@/hooks/useProductTourDateAvailability'
import { isGoblinGrandCanyonSunriseTour } from '@/lib/goblinGrandCanyonSunrisePickup'
import {
  buildMonthGrid,
  TOUR_DATE_STATUS_DOT_CLASS,
  toIsoDateLocal,
  type TourDateStatus,
} from '@/lib/productTourDateStatus'

type ProductDetailBookingCalendarProps = {
  productId: string
  selectedDate: string
  onDateChange: (value: string) => void
  onClose?: () => void
  customerTourName?: string
  product?: {
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
  }
}

const STATUS_KEYS: TourDateStatus[] = [
  'available',
  'recruiting',
  'confirmed',
  'almost_full',
  'closed',
]

export default function ProductDetailBookingCalendar({
  productId,
  selectedDate,
  onDateChange,
  onClose,
  customerTourName = '',
  product = {},
}: ProductDetailBookingCalendarProps) {
  const t = useTranslations('productDetail')
  const locale = useLocale()
  const isGoblinSunriseTour = useMemo(() => isGoblinGrandCanyonSunriseTour(product), [product])
  const resolvedTourName =
    customerTourName.trim() ||
    product.customer_name_en?.trim() ||
    product.customer_name_ko?.trim() ||
    product.name_en?.trim() ||
    product.name_ko?.trim() ||
    product.name?.trim() ||
    ''
  const { loading, getStatusForDate, isDateSelectable, todayIso } =
    useProductTourDateAvailability(productId)

  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date()
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

  const handleSelect = (date: Date) => {
    if (!isDateSelectable(date)) return
    onDateChange(toIsoDateLocal(date))
    onClose?.()
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
            const isSelected = selectedDate === iso
            const isToday = iso === todayIso

            return (
              <button
                key={iso}
                type="button"
                disabled={!selectable}
                onClick={() => handleSelect(cell.date!)}
                className={`booking-calendar-day ${isSelected ? 'is-selected' : ''} ${isToday && !isSelected ? 'is-today' : ''} ${!selectable ? 'is-disabled' : ''}`}
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
    <div className="booking-calendar-panel">
      <div className="booking-calendar-info">
        <p className="booking-calendar-info-text">{t('calendarDailyDeparturesHint')}</p>
        {isGoblinSunriseTour ? (
          <div className="booking-calendar-goblin-notice">
            <p className="booking-calendar-goblin-notice-title">
              {t('calendarGoblinSunriseDateTitle', { tourName: resolvedTourName })}
            </p>
            <p className="booking-calendar-goblin-notice-text">{t('calendarGoblinSunriseDateBody')}</p>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="booking-calendar-loading">
          <Loader2 className="h-6 w-6 animate-spin text-[#6b7280]" />
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
  )
}
