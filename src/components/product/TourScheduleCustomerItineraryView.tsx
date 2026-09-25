'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Car,
  ChevronDown,
  ChevronUp,
  Flag,
  Info,
  MapPin,
  Navigation,
  Pencil,
  Trash2,
  Utensils,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import ProductDetailDeparturePointModal from '@/components/product/ProductDetailDeparturePointModal'
import { useProductDetailTourScheduleTiming } from '@/hooks/useProductDetailTourScheduleTiming'
import {
  decorateHotelDropTimeRange,
  HOTEL_TRANSFER_STOP_MINUTES,
} from '@/lib/productDetailTourScheduleTiming'
import {
  getScheduleLocalizedText,
  type ScheduleContentI18n,
} from '@/lib/productScheduleLocales'

export type CustomerScheduleItem = {
  id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  is_break: boolean | null
  is_meal: boolean | null
  is_transport: boolean | null
  is_tour: boolean | null
  title_ko: string | null
  title_en: string | null
  description_ko: string | null
  description_en: string | null
  location_ko: string | null
  location_en: string | null
  content_i18n?: ScheduleContentI18n | null
  thumbnail_url: string | null
  google_maps_link: string | null
  show_to_customers?: boolean | null
}

type TourScheduleCustomerItineraryViewProps = {
  schedules: CustomerScheduleItem[]
  locale: string
  selectedDate?: string
  product?: {
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
  }
  allSchedulesExpanded: boolean
  expandedSchedules: Set<string>
  onToggleAll: () => void
  onToggleSchedule: (scheduleId: string) => void
  getText: (koText: string, enText?: string) => string
  getLocalizedText: (
    ko: string | null,
    en: string | null,
    fallback: string | null,
    fieldName?: string
  ) => string
  interactive?: boolean
  hideChrome?: boolean
  hiddenFromCustomerIds?: ReadonlySet<string>
  hiddenLabel?: string
  clickToEditLabel?: string
  deleteLabel?: string
  onEditItem?: (id: string) => void
  onDeleteItem?: (id: string) => void
}

function resolveThumbnailUrl(thumbnailUrl: string | null) {
  if (!thumbnailUrl) return null
  if (thumbnailUrl.startsWith('http')) return thumbnailUrl
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${thumbnailUrl}`
}

function getScheduleIcon(schedule: CustomerScheduleItem) {
  if (schedule.is_transport) return <Car className="h-4 w-4" />
  if (schedule.is_meal) return <Utensils className="h-4 w-4" />
  return <MapPin className="h-4 w-4" />
}

function HotelTransferItineraryStep({
  title,
  timeRangeLabel,
  durationLabel,
  badgeLabel,
}: {
  title: string
  timeRangeLabel: string
  durationLabel: string
  badgeLabel?: string
}) {
  return (
    <div className="airbnb-itinerary-step">
      <div className="airbnb-itinerary-marker" aria-hidden>
        <Car className="h-4 w-4" />
      </div>
      <article className="airbnb-itinerary-card">
        <div className="airbnb-itinerary-card-header">
          <div className="min-w-0 flex-1 text-left">
            <h4
              className={`airbnb-itinerary-card-title${badgeLabel ? ' airbnb-itinerary-card-title--wrap' : ''}`}
            >
              <span className="airbnb-itinerary-card-time">{timeRangeLabel}</span>
              <span className="airbnb-itinerary-card-separator" aria-hidden>
                |
              </span>
              <span className="airbnb-itinerary-card-title-text">{title}</span>
              <span className="airbnb-itinerary-duration-badge">{durationLabel}</span>
              {badgeLabel ? (
                <span className="airbnb-itinerary-previous-day-badge">{badgeLabel}</span>
              ) : null}
            </h4>
          </div>
        </div>
      </article>
    </div>
  )
}

export default function TourScheduleCustomerItineraryView({
  schedules,
  locale,
  selectedDate = '',
  product = {},
  allSchedulesExpanded,
  expandedSchedules,
  onToggleAll,
  onToggleSchedule,
  getText,
  getLocalizedText,
  interactive = false,
  hideChrome = false,
  hiddenFromCustomerIds,
  hiddenLabel,
  clickToEditLabel,
  deleteLabel,
  onEditItem,
  onDeleteItem,
}: TourScheduleCustomerItineraryViewProps) {
  const t = useTranslations('productDetail')
  const isEnglish = locale.trim().toLowerCase() === 'en'
  const [departureModalOpen, setDepartureModalOpen] = useState(false)

  const getLocalizedTitle = (schedule: CustomerScheduleItem) =>
    getScheduleLocalizedText(schedule, 'title', locale) ||
    getLocalizedText(schedule.title_ko, schedule.title_en, '')

  const { displayItems, sunriseSummary, loadingSunrise, hotelTransferStops } =
    useProductDetailTourScheduleTiming(
    schedules,
    selectedDate,
    product,
    isEnglish,
    getLocalizedTitle
  )
  const schedulesByDay = schedules.reduce<Record<number, CustomerScheduleItem[]>>((acc, schedule) => {
    if (!acc[schedule.day_number]) acc[schedule.day_number] = []
    acc[schedule.day_number].push(schedule)
    return acc
  }, {})

  const dayEntries = Object.entries(schedulesByDay).sort(([a], [b]) => Number(a) - Number(b))

  return (
    <div className="airbnb-itinerary">
      {hideChrome ? null : (
        <div className="airbnb-itinerary-schedule-toggle">
          <h3 className="airbnb-detail-section-title">
            {getText('여행 일정', 'Itinerary')}
          </h3>
          <button
            type="button"
            className="airbnb-itinerary-detail-toggle-btn"
            onClick={onToggleAll}
            aria-expanded={allSchedulesExpanded}
          >
            {allSchedulesExpanded
              ? getText('간략히 보기', 'Show less')
              : getText('자세히 보기', 'View details')}
          </button>
        </div>
      )}

      {!hideChrome && sunriseSummary?.showDifferentDatesWarning ? (
        <section className="airbnb-itinerary-sunrise-alert" aria-live="polite">
          <p className="airbnb-itinerary-sunrise-alert-title">
            {t('sunrisePickupDifferentDateTitle')}
          </p>
          <p className="airbnb-itinerary-sunrise-alert-copy">{t('sunrisePickupDifferentDateBody')}</p>
          <div className="airbnb-itinerary-sunrise-alert-grid">
            <div>
              <span className="airbnb-itinerary-sunrise-alert-label">{t('sunriseTourDateLabel')}</span>
              <strong>{sunriseSummary.tourDateLabel}</strong>
            </div>
            <div>
              <span className="airbnb-itinerary-sunrise-alert-label">{t('sunrisePickupDateLabel')}</span>
              <strong>{sunriseSummary.pickupDateLabel}</strong>
            </div>
          </div>
          <p className="airbnb-itinerary-sunrise-alert-window">
            {t('sunrisePickupWindowLabel')}: {sunriseSummary.pickupWindowLabel}
          </p>
          {hotelTransferStops?.pickup ? (
            <p className="airbnb-itinerary-sunrise-alert-window">
              {getText('호텔 픽업', 'Hotel pickup')}: {hotelTransferStops.pickup.timeRangeLabel}{' '}
              (
              {getText(
                `${hotelTransferStops.pickup.durationMinutes}분`,
                `${hotelTransferStops.pickup.durationMinutes} min`
              )}
              )
            </p>
          ) : null}
          <p className="airbnb-itinerary-sunrise-alert-sunrise">
            {t('sunriseApproxLabel')}: {sunriseSummary.sunriseClock}
            {sunriseSummary.usedApproxTable ? ` · ${t('sunriseApproxNote')}` : ''}
          </p>
        </section>
      ) : null}

      {!hideChrome && loadingSunrise ? (
        <p className="airbnb-itinerary-sunrise-loading">{t('sunriseScheduleLoading')}</p>
      ) : null}

      {hideChrome ? null : (
        <>
          <ProductDetailDeparturePointModal
            open={departureModalOpen}
            onOpenChange={setDepartureModalOpen}
            locale={locale}
          />

          <div className="airbnb-itinerary-timeline-toolbar">
            <button
              type="button"
              className="airbnb-itinerary-departure-link"
              onClick={() => setDepartureModalOpen(true)}
            >
              {getText('출발 위치 확인', 'Find your departure point')}
              <Navigation className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </>
      )}

      <div className="airbnb-itinerary-timeline">
        {dayEntries.map(([dayNumber, daySchedules], dayIndex) => {
          const dayNum = Number(dayNumber)
          const showDayLabel = dayEntries.length > 1
          const isFirstDay = dayIndex === 0
          const isLastDay = dayIndex === dayEntries.length - 1

          return (
            <div key={dayNum} className="airbnb-itinerary-day-group">
              {showDayLabel ? (
                <div className="airbnb-itinerary-group-label">
                  <Flag className="h-4 w-4" aria-hidden />
                  <span>{getText(`${dayNum}일차`, `Day ${dayNum}`)}</span>
                </div>
              ) : null}

              {isFirstDay && hotelTransferStops?.pickup ? (
                <HotelTransferItineraryStep
                  title={getText('호텔 픽업', 'Hotel pickup')}
                  timeRangeLabel={hotelTransferStops.pickup.timeRangeLabel}
                  durationLabel={getText(
                    `${hotelTransferStops.pickup.durationMinutes}분`,
                    `${hotelTransferStops.pickup.durationMinutes} min`
                  )}
                  {...(hotelTransferStops.pickup.startsDayBeforeTour
                    ? { badgeLabel: getText('투어일 전날', 'Day before tour') }
                    : {})}
                />
              ) : null}

              {daySchedules.map((schedule) => {
                const displayItem = displayItems.find((item) => item.schedule.id === schedule.id)
                if (!displayItem) return null

                const { title } = displayItem
                const isLastDisplayItem =
                  displayItem.schedule.id === displayItems[displayItems.length - 1]?.schedule.id
                const timeRangeLabel =
                  isLastDisplayItem && hotelTransferStops && !hotelTransferStops.dropoff
                    ? decorateHotelDropTimeRange(title, displayItem.timeRangeLabel)
                    : displayItem.timeRangeLabel
                const description =
                  getScheduleLocalizedText(schedule, 'description', locale) ||
                  getLocalizedText(
                    schedule.description_ko,
                    schedule.description_en,
                    ''
                  )
                const hasDescription = description.trim() !== ''
                const isExpanded =
                  allSchedulesExpanded || (hasDescription && expandedSchedules.has(schedule.id))
                const thumbnailUrl = resolveThumbnailUrl(schedule.thumbnail_url)
                const durationLabel =
                  schedule.duration_minutes && schedule.duration_minutes > 0
                    ? getText(`${schedule.duration_minutes}분`, `${schedule.duration_minutes} min`)
                    : timeRangeLabel &&
                        timeRangeLabel !== displayItem.timeRangeLabel &&
                        timeRangeLabel.includes('~')
                      ? getText(`${HOTEL_TRANSFER_STOP_MINUTES}분`, `${HOTEL_TRANSFER_STOP_MINUTES} min`)
                      : null
                const hiddenFromCustomer =
                  schedule.show_to_customers === false ||
                  Boolean(hiddenFromCustomerIds?.has(schedule.id))

                return (
                  <div key={schedule.id} className="airbnb-itinerary-step">
                    <div className="airbnb-itinerary-marker" aria-hidden>
                      {getScheduleIcon(schedule)}
                    </div>

                    <article
                      className={`airbnb-itinerary-card ${interactive ? 'is-editable group relative' : ''} ${
                        hiddenFromCustomer ? 'is-hidden-from-customer' : ''
                      }`}
                      {...(interactive && onEditItem
                        ? { onClick: () => onEditItem(schedule.id) }
                        : {})}
                    >
                      {interactive ? (
                        <div
                          className="airbnb-itinerary-card-edit-bar"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {onEditItem ? (
                            <button
                              type="button"
                              onClick={() => onEditItem(schedule.id)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={clickToEditLabel || getText('수정', 'Edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          ) : null}
                          {onDeleteItem ? (
                            <button
                              type="button"
                              onClick={() => onDeleteItem(schedule.id)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                              aria-label={deleteLabel || getText('삭제', 'Delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className={`airbnb-itinerary-card-header ${
                          hasDescription || interactive ? 'is-clickable' : ''
                        }`}
                        onClick={(event) => {
                          if (interactive) {
                            event.stopPropagation()
                            onEditItem?.(schedule.id)
                            return
                          }
                          if (hasDescription) onToggleSchedule(schedule.id)
                        }}
                        disabled={!hasDescription && !interactive}
                        aria-expanded={isExpanded}
                      >
                        <div className="min-w-0 flex-1 text-left">
                          {title || timeRangeLabel || durationLabel ? (
                            <h4 className="airbnb-itinerary-card-title">
                              {timeRangeLabel ? (
                                <span className="airbnb-itinerary-card-time">{timeRangeLabel}</span>
                              ) : null}
                              {timeRangeLabel && title ? (
                                <span className="airbnb-itinerary-card-separator" aria-hidden>
                                  |
                                </span>
                              ) : null}
                              {title ? (
                                <span className="airbnb-itinerary-card-title-text">{title}</span>
                              ) : null}
                              {durationLabel ? (
                                <span className="airbnb-itinerary-duration-badge">{durationLabel}</span>
                              ) : null}
                            </h4>
                          ) : null}
                          {hiddenFromCustomer && hiddenLabel ? (
                            <span className="mt-1 inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              {hiddenLabel}
                            </span>
                          ) : null}
                          {interactive && !hasDescription && clickToEditLabel ? (
                            <p className="mt-1 text-xs text-muted-foreground">{clickToEditLabel}</p>
                          ) : null}
                        </div>

                        {hasDescription && !allSchedulesExpanded ? (
                          <span
                            className="airbnb-itinerary-card-chevron"
                            aria-hidden
                            onClick={(event) => {
                              if (!interactive) return
                              event.stopPropagation()
                              onToggleSchedule(schedule.id)
                            }}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        ) : null}
                      </button>

                      {isExpanded ? (
                        <div className="airbnb-itinerary-card-body">
                          {description ? (
                            <div
                              className="airbnb-itinerary-description"
                              dangerouslySetInnerHTML={{
                                __html: markdownToHtml(description),
                              }}
                            />
                          ) : null}

                          {thumbnailUrl ? (
                            <div className="airbnb-itinerary-photo-grid">
                              <div className="airbnb-itinerary-photo">
                                <Image
                                  src={thumbnailUrl}
                                  alt={title || getText('일정 이미지', 'Schedule image')}
                                  fill
                                  sizes="(min-width: 1024px) 132px, (min-width: 640px) 23vw, 42vw"
                                  className="object-cover transition duration-300 hover:scale-105"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  </div>
                )
              })}

              {isLastDay && hotelTransferStops?.dropoff ? (
                <HotelTransferItineraryStep
                  title={getText('호텔 드롭', 'Hotel drop-off')}
                  timeRangeLabel={hotelTransferStops.dropoff.timeRangeLabel}
                  durationLabel={getText(
                    `${hotelTransferStops.dropoff.durationMinutes}분`,
                    `${hotelTransferStops.dropoff.durationMinutes} min`
                  )}
                />
              ) : null}
            </div>
          )
        })}
      </div>

      {hideChrome ? null : (
        <p className="airbnb-itinerary-disclaimer">
          <Info className="h-4 w-4 shrink-0" aria-hidden />
          <span>{t('tourScheduleDisclaimer')}</span>
        </p>
      )}
    </div>
  )
}
