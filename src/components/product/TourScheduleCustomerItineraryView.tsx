'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Car,
  ChevronDown,
  ChevronUp,
  Clock3,
  Flag,
  Info,
  MapPin,
  Navigation,
  Ticket,
  Utensils,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import ProductDetailDeparturePointModal from '@/components/product/ProductDetailDeparturePointModal'
import { useProductDetailTourScheduleTiming } from '@/hooks/useProductDetailTourScheduleTiming'

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
  thumbnail_url: string | null
  google_maps_link: string | null
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

function getScheduleMeta(
  schedule: CustomerScheduleItem,
  getText: TourScheduleCustomerItineraryViewProps['getText'],
  showDurationOnly: boolean
) {
  const items: Array<{ icon: typeof Clock3; label: string }> = []

  if (showDurationOnly && schedule.duration_minutes && schedule.duration_minutes > 0) {
    items.push({
      icon: Clock3,
      label: getText(`${schedule.duration_minutes}분`, `${schedule.duration_minutes} min(s)`),
    })
  }

  if (schedule.is_tour) {
    items.push({ icon: Flag, label: getText('가이드 동행', 'Guided') })
  }

  if (schedule.is_transport) {
    items.push({ icon: Ticket, label: getText('픽업/이동', 'Transfer') })
  }

  return items
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
}: TourScheduleCustomerItineraryViewProps) {
  const t = useTranslations('productDetail')
  const isEnglish = locale.trim().toLowerCase() === 'en'
  const [departureModalOpen, setDepartureModalOpen] = useState(false)

  const getLocalizedTitle = (schedule: CustomerScheduleItem) =>
    getLocalizedText(schedule.title_ko, schedule.title_en, '')

  const { displayItems, sunriseSummary, loadingSunrise } = useProductDetailTourScheduleTiming(
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

      {sunriseSummary?.showDifferentDatesWarning ? (
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
          <p className="airbnb-itinerary-sunrise-alert-sunrise">
            {t('sunriseApproxLabel')}: {sunriseSummary.sunriseClock}
            {sunriseSummary.usedApproxTable ? ` · ${t('sunriseApproxNote')}` : ''}
          </p>
        </section>
      ) : null}

      {loadingSunrise ? (
        <p className="airbnb-itinerary-sunrise-loading">{t('sunriseScheduleLoading')}</p>
      ) : null}

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

      <div className="airbnb-itinerary-timeline">
        {dayEntries.map(([dayNumber, daySchedules]) => {
          const dayNum = Number(dayNumber)
          const showDayLabel = dayEntries.length > 1

          return (
            <div key={dayNum} className="airbnb-itinerary-day-group">
              {showDayLabel ? (
                <div className="airbnb-itinerary-group-label">
                  <Flag className="h-4 w-4" aria-hidden />
                  <span>{getText(`${dayNum}일차`, `Day ${dayNum}`)}</span>
                </div>
              ) : null}

              {daySchedules.map((schedule) => {
                const displayItem = displayItems.find((item) => item.schedule.id === schedule.id)
                if (!displayItem) return null

                const { title, timeRangeLabel } = displayItem
                const description = getLocalizedText(
                  schedule.description_ko,
                  schedule.description_en,
                  ''
                )
                const hasDescription = description.trim() !== ''
                const isExpanded =
                  allSchedulesExpanded || (hasDescription && expandedSchedules.has(schedule.id))
                const thumbnailUrl = resolveThumbnailUrl(schedule.thumbnail_url)
                const metaItems = getScheduleMeta(schedule, getText, Boolean(timeRangeLabel))

                return (
                  <div key={schedule.id} className="airbnb-itinerary-step">
                    <div className="airbnb-itinerary-marker" aria-hidden>
                      {getScheduleIcon(schedule)}
                    </div>

                    <article className="airbnb-itinerary-card">
                      <button
                        type="button"
                        className={`airbnb-itinerary-card-header ${hasDescription ? 'is-clickable' : ''}`}
                        onClick={() => hasDescription && onToggleSchedule(schedule.id)}
                        disabled={!hasDescription}
                        aria-expanded={isExpanded}
                      >
                        <div className="min-w-0 flex-1 text-left">
                          {title || timeRangeLabel ? (
                            <h4 className="airbnb-itinerary-card-title">
                              {timeRangeLabel ? (
                                <>
                                  <span className="airbnb-itinerary-card-time">{timeRangeLabel}</span>
                                  {title ? (
                                    <>
                                      <span className="airbnb-itinerary-card-separator" aria-hidden>
                                        |
                                      </span>
                                      <span>{title}</span>
                                    </>
                                  ) : null}
                                </>
                              ) : (
                                title
                              )}
                            </h4>
                          ) : null}
                          {metaItems.length > 0 ? (
                            <div className="airbnb-itinerary-meta">
                              {metaItems.map((item) => {
                                const Icon = item.icon
                                return (
                                  <span key={item.label}>
                                    <Icon className="h-4 w-4" aria-hidden />
                                    {item.label}
                                  </span>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>

                        {hasDescription && !allSchedulesExpanded ? (
                          <span className="airbnb-itinerary-card-chevron" aria-hidden>
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
            </div>
          )
        })}
      </div>

      <p className="airbnb-itinerary-disclaimer">
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        <span>{t('tourScheduleDisclaimer')}</span>
      </p>
    </div>
  )
}
