import {
  buildGrandCanyonSunrisePickupEmailInfo,
  formatYmdLong,
  GRAND_CANYON_SUNRISE_PICKUP_WINDOW_END_MINUTES_BEFORE_SUNRISE,
  roundMinutesToNearest10,
  type GrandCanyonSunrisePickupEmailInfo,
} from '@/lib/goblinGrandCanyonSunrisePickup'
import type { CustomerScheduleItem } from '@/components/product/TourScheduleCustomerItineraryView'

export type CustomerScheduleDisplayItem = {
  schedule: CustomerScheduleItem
  title: string
  timeRangeLabel: string | null
  eventDateYmd: string | null
  eventDateLabel: string | null
  isPreviousDayPickup: boolean
  isPickupStop: boolean
}

export type HotelPickupWindowDisplay = {
  timeRangeLabel: string
  pickupWindowLabel: string
  pickupDateLabel: string
  pickupStartYmd: string
  pickupEndYmd: string
}

export const HOTEL_PICKUP_HIDDEN_TRAVEL_MINUTES = 10
export const HOTEL_PICKUP_WINDOW_DURATION_MINUTES = 60

function parseScheduleTimeToMinutes(time: string | null | undefined): number | null {
  if (!time || time.trim() === '') return null
  const parts = time.split(':')
  const h = Number.parseInt(parts[0] ?? '', 10)
  const m = Number.parseInt(parts[1] ?? '0', 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return (((h * 60 + m) % 1440) + 1440) % 1440
}

function minutesToScheduleTime(mins: number): string {
  const value = ((Math.round(mins) % 1440) + 1440) % 1440
  const h = Math.floor(value / 60)
  const m = value % 60
  return `${h < 10 ? `0${h}` : h}:${m < 10 ? `0${m}` : m}`
}

function normalizeMinutesToYmd(
  offsetFromTourMidnight: number,
  tourYmd: string
): { ymd: string; minutesInDay: number } {
  let minutes = offsetFromTourMidnight
  let ymd = tourYmd

  while (minutes < 0) {
    const [y, mo, d] = ymd.split('-').map(Number)
    const dt = new Date(Date.UTC(y!, mo! - 1, d! - 1))
    ymd = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
    minutes += 24 * 60
  }

  while (minutes >= 24 * 60) {
    const [y, mo, d] = ymd.split('-').map(Number)
    const dt = new Date(Date.UTC(y!, mo! - 1, d! + 1))
    ymd = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
    minutes -= 24 * 60
  }

  return { ymd, minutesInDay: minutes }
}

function formatTimeRange(start: string | null, end: string | null): string | null {
  if (!start) return null
  if (!end || end === start) return start
  return `${start} ~ ${end}`
}

function parseTimeRangeStart(timeRangeLabel: string | null | undefined): string | null {
  if (!timeRangeLabel?.trim()) return null
  const startPart = timeRangeLabel.split('~')[0]?.trim()
  return startPart || null
}

function formatClockMinutes(minutes: number, isEnglish: boolean): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  if (isEnglish) {
    const period = h24 >= 12 ? 'PM' : 'AM'
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
    return `${h12}:${m < 10 ? `0${m}` : m} ${period}`
  }
  const period = h24 < 12 ? '오전' : '오후'
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24 === 12 ? 12 : h24
  return m === 0 ? `${period} ${h12}시` : `${period} ${h12}시 ${m}분`
}

export function buildHotelPickupWindowDisplay(
  tourYmd: string,
  firstItem: CustomerScheduleDisplayItem | undefined,
  isEnglish: boolean
): HotelPickupWindowDisplay | null {
  const firstScheduleStart = parseTimeRangeStart(firstItem?.timeRangeLabel)
  if (!firstScheduleStart) return null

  const anchorYmd = firstItem?.eventDateYmd ?? tourYmd
  const firstStartMinutes = parseScheduleTimeToMinutes(firstScheduleStart)
  if (firstStartMinutes == null) return null

  const pickupEndNorm = normalizeMinutesToYmd(
    firstStartMinutes - HOTEL_PICKUP_HIDDEN_TRAVEL_MINUTES,
    anchorYmd
  )
  const pickupStartNorm = normalizeMinutesToYmd(
    firstStartMinutes - HOTEL_PICKUP_HIDDEN_TRAVEL_MINUTES - HOTEL_PICKUP_WINDOW_DURATION_MINUTES,
    anchorYmd
  )

  const startTime = minutesToScheduleTime(pickupStartNorm.minutesInDay)
  const endTime = minutesToScheduleTime(pickupEndNorm.minutesInDay)
  const timeRangeLabel = formatTimeRange(startTime, endTime) ?? startTime

  const pickupDateLabel = formatYmdLong(pickupStartNorm.ymd, isEnglish)
  const pickupEndDateLabel = formatYmdLong(pickupEndNorm.ymd, isEnglish)
  const startClock = formatClockMinutes(pickupStartNorm.minutesInDay, isEnglish)
  const endClock = formatClockMinutes(pickupEndNorm.minutesInDay, isEnglish)

  const pickupWindowLabel =
    pickupStartNorm.ymd === pickupEndNorm.ymd
      ? isEnglish
        ? `${pickupDateLabel}: ${startClock} – ${endClock}`
        : `${pickupDateLabel} ${startClock} ~ ${endClock}`
      : isEnglish
        ? `${pickupDateLabel} ${startClock} – ${pickupEndDateLabel} ${endClock}`
        : `${pickupDateLabel} ${startClock} ~ ${pickupEndDateLabel} ${endClock}`

  return {
    timeRangeLabel,
    pickupWindowLabel,
    pickupDateLabel,
    pickupStartYmd: pickupStartNorm.ymd,
    pickupEndYmd: pickupEndNorm.ymd,
  }
}

function resolveSunriseEventTimes(
  tourYmd: string,
  sunriseMinutes: number,
  templateStartMinutes: number,
  scheduleStartMinutes: number | null,
  scheduleEndMinutes: number | null
) {
  const endOffset = roundMinutesToNearest10(
    sunriseMinutes - GRAND_CANYON_SUNRISE_PICKUP_WINDOW_END_MINUTES_BEFORE_SUNRISE
  )
  const startMinutes = scheduleStartMinutes ?? templateStartMinutes
  const relativeStart = startMinutes - templateStartMinutes
  const relativeEnd =
    scheduleEndMinutes != null && scheduleStartMinutes != null
      ? scheduleEndMinutes - scheduleStartMinutes + relativeStart
      : null

  const startNorm = normalizeMinutesToYmd(endOffset + relativeStart, tourYmd)
  const endNorm =
    relativeEnd != null ? normalizeMinutesToYmd(endOffset + relativeEnd, tourYmd) : null

  return {
    startYmd: startNorm.ymd,
    startTime: minutesToScheduleTime(startNorm.minutesInDay),
    endYmd: endNorm?.ymd ?? null,
    endTime: endNorm ? minutesToScheduleTime(endNorm.minutesInDay) : null,
  }
}

export function buildCustomerScheduleDisplayItems(
  schedules: CustomerScheduleItem[],
  options: {
    selectedDate: string
    isEnglish: boolean
    gcSunrise: GrandCanyonSunrisePickupEmailInfo | null
    getLocalizedTitle: (schedule: CustomerScheduleItem) => string
  }
): CustomerScheduleDisplayItem[] {
  const { selectedDate, isEnglish, gcSunrise, getLocalizedTitle } = options
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)

  const firstWithStart = schedules.find((schedule) => parseScheduleTimeToMinutes(schedule.start_time) != null)
  const templateStartMinutes = parseScheduleTimeToMinutes(firstWithStart?.start_time ?? null) ?? 0

  return schedules.map((schedule, index) => {
    const title = getLocalizedTitle(schedule)
    const isPickupStop = Boolean(schedule.is_transport) || index === 0

    if (!hasDate || !gcSunrise) {
      const start = schedule.start_time?.substring(0, 5) ?? null
      const end = schedule.end_time?.substring(0, 5) ?? null
      return {
        schedule,
        title,
        timeRangeLabel: formatTimeRange(start, end),
        eventDateYmd: hasDate ? selectedDate : null,
        eventDateLabel: hasDate ? formatYmdLong(selectedDate, isEnglish) : null,
        isPreviousDayPickup: false,
        isPickupStop,
      }
    }

    const startMinutes = parseScheduleTimeToMinutes(schedule.start_time)
    const endMinutes = parseScheduleTimeToMinutes(schedule.end_time)
    const eventTimes = resolveSunriseEventTimes(
      selectedDate,
      gcSunrise.sunriseMinutes,
      templateStartMinutes,
      startMinutes,
      endMinutes
    )

    const isPreviousDayPickup = eventTimes.startYmd < selectedDate
    const eventDateLabel = formatYmdLong(eventTimes.startYmd, isEnglish)

    return {
      schedule,
      title,
      timeRangeLabel: formatTimeRange(eventTimes.startTime, eventTimes.endTime),
      eventDateYmd: eventTimes.startYmd,
      eventDateLabel,
      isPreviousDayPickup,
      isPickupStop,
    }
  })
}

export function getSunrisePickupWindowSummary(
  gcSunrise: GrandCanyonSunrisePickupEmailInfo,
  isEnglish: boolean,
  hotelPickupWindow?: HotelPickupWindowDisplay | null
) {
  const tourDateLabel = formatYmdLong(gcSunrise.tourYmd, isEnglish)
  const pickupDateLabel =
    hotelPickupWindow?.pickupDateLabel ?? formatYmdLong(gcSunrise.pickupYmd, isEnglish)
  const sunriseClock = formatClockMinutes(gcSunrise.sunriseMinutes, isEnglish)

  const pickupWindowLabel =
    hotelPickupWindow?.pickupWindowLabel ??
    (() => {
      const pickupEndDateLabel = formatYmdLong(gcSunrise.pickupEndYmd, isEnglish)
      const startClock = formatClockMinutes(gcSunrise.pickupWindowStartMinutes, isEnglish)
      const endClock = formatClockMinutes(gcSunrise.pickupWindowEndMinutes, isEnglish)

      return gcSunrise.pickupYmd === gcSunrise.pickupEndYmd
        ? isEnglish
          ? `${formatYmdLong(gcSunrise.pickupYmd, isEnglish)}: ${startClock} – ${endClock}`
          : `${formatYmdLong(gcSunrise.pickupYmd, isEnglish)} ${startClock} ~ ${endClock}`
        : isEnglish
          ? `${formatYmdLong(gcSunrise.pickupYmd, isEnglish)} ${startClock} – ${pickupEndDateLabel} ${endClock}`
          : `${formatYmdLong(gcSunrise.pickupYmd, isEnglish)} ${startClock} ~ ${pickupEndDateLabel} ${endClock}`
    })()

  return {
    tourDateLabel,
    pickupDateLabel,
    pickupWindowLabel,
    sunriseClock,
    showDifferentDatesWarning: gcSunrise.showDifferentDatesWarning,
    usedApproxTable: gcSunrise.usedApproxTable,
  }
}

export async function resolveGrandCanyonSunrisePickupForDate(
  tourYmd: string,
  cachedSunrise: string | null | undefined
) {
  return buildGrandCanyonSunrisePickupEmailInfo(tourYmd, cachedSunrise)
}
