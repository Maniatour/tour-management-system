import {
  addCalendarDaysYmd,
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
  /** 픽업 시간대 끝. 해당 날짜 0시부터의 분 */
  pickupEndMinutes: number
}

export type ItineraryHotelTransferStop = {
  id: 'hotel-pickup' | 'hotel-dropoff'
  dayNumber: number
  timeRangeLabel: string
  durationMinutes: number
  /** 표시된 픽업 시작이 투어일 0시보다 앞일 때만 true */
  startsDayBeforeTour?: boolean
}

export const HOTEL_PICKUP_HIDDEN_TRAVEL_MINUTES = 10
export const HOTEL_PICKUP_WINDOW_DURATION_MINUTES = 60
export const HOTEL_TRANSFER_STOP_MINUTES = 30

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
    pickupEndMinutes: pickupEndNorm.minutesInDay,
  }
}

function compactTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '')
}

function isHotelPickupTitle(title: string): boolean {
  const compact = compactTitle(title)
  return compact.includes('호텔픽업') || compact.includes('hotelpickup')
}

function isHotelDropTitle(title: string): boolean {
  const compact = compactTitle(title)
  return (
    compact.includes('호텔드롭') ||
    compact.includes('호텔드랍') ||
    compact.includes('호텔하차') ||
    compact.includes('hoteldropoff') ||
    compact.includes('hoteldrop-off') ||
    compact.includes('hoteldrop')
  )
}

/** 이미 호텔 하차 일정이 있고 종료 시각이 없으면, 카드에 30분 구간으로 보여 준다. */
export function decorateHotelDropTimeRange(
  title: string,
  timeRangeLabel: string | null
): string | null {
  if (!timeRangeLabel || timeRangeLabel.includes('~') || !isHotelDropTitle(title)) {
    return timeRangeLabel
  }
  const startMinutes = parseScheduleTimeToMinutes(timeRangeLabel)
  if (startMinutes == null) return timeRangeLabel
  const end = normalizeMinutesToYmd(startMinutes + HOTEL_TRANSFER_STOP_MINUTES, '2000-01-01')
  return formatTimeRange(minutesToScheduleTime(startMinutes), minutesToScheduleTime(end.minutesInDay))
}

function resolveDisplayItemEnd(
  item: CustomerScheduleDisplayItem
): { ymd: string; minutes: number } | null {
  if (!item.eventDateYmd || !item.timeRangeLabel) return null
  const [startRaw, endRaw] = item.timeRangeLabel.split('~').map((part) => part.trim())
  const startMinutes = parseScheduleTimeToMinutes(startRaw)
  if (startMinutes == null) return null

  const explicitEnd = endRaw ? parseScheduleTimeToMinutes(endRaw) : null
  const duration = item.schedule.duration_minutes
  let endMinutes = explicitEnd
  let extraDays = 0

  if (endMinutes == null && duration && duration > 0) {
    endMinutes = startMinutes + duration
    while (endMinutes >= 24 * 60) {
      endMinutes -= 24 * 60
      extraDays += 1
    }
  }

  if (endMinutes == null) endMinutes = startMinutes
  if (explicitEnd != null && explicitEnd < startMinutes) extraDays = 1

  return {
    ymd: extraDays > 0 ? addCalendarDaysYmd(item.eventDateYmd, extraDays) : item.eventDateYmd,
    minutes: endMinutes,
  }
}

/** 고객 일정 화면 전용. 저장된 일정에는 넣지 않고, 픽업 시간대 끝에 맞춰 30분을 붙인다. */
export function buildItineraryHotelTransferStops(
  windowDisplay: HotelPickupWindowDisplay,
  displayItems: CustomerScheduleDisplayItem[],
  tourYmd?: string
): { pickup: ItineraryHotelTransferStop | null; dropoff: ItineraryHotelTransferStop | null } {
  const first = displayItems[0]
  const last = displayItems[displayItems.length - 1]
  if (!first || !last) return { pickup: null, dropoff: null }

  const pickupStart = normalizeMinutesToYmd(
    windowDisplay.pickupEndMinutes - HOTEL_TRANSFER_STOP_MINUTES,
    windowDisplay.pickupEndYmd
  )
  const pickupTime = formatTimeRange(
    minutesToScheduleTime(pickupStart.minutesInDay),
    minutesToScheduleTime(windowDisplay.pickupEndMinutes)
  )

  const pickup =
    isHotelPickupTitle(first.title) || !pickupTime
      ? null
      : {
          id: 'hotel-pickup' as const,
          dayNumber: first.schedule.day_number,
          timeRangeLabel: pickupTime,
          durationMinutes: HOTEL_TRANSFER_STOP_MINUTES,
          startsDayBeforeTour: tourYmd != null && pickupStart.ymd < tourYmd,
        }

  const lastEnd = resolveDisplayItemEnd(last)
  if (!lastEnd || isHotelDropTitle(last.title)) return { pickup, dropoff: null }

  const dropEnd = normalizeMinutesToYmd(
    lastEnd.minutes + HOTEL_TRANSFER_STOP_MINUTES,
    lastEnd.ymd
  )
  const dropTime = formatTimeRange(
    minutesToScheduleTime(lastEnd.minutes),
    minutesToScheduleTime(dropEnd.minutesInDay)
  )

  return {
    pickup,
    dropoff: dropTime
      ? {
          id: 'hotel-dropoff',
          dayNumber: last.schedule.day_number,
          timeRangeLabel: dropTime,
          durationMinutes: HOTEL_TRANSFER_STOP_MINUTES,
        }
      : null,
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
