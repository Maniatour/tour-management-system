/**
 * Goblin Grand Canyon sunrise tour — Lipan Point (South Rim) sunrise-based hotel pickup window.
 * Sunrise: cached DB time for Grand Canyon South Rim when present; otherwise monthly Arizona local approximations.
 */

/** Hotel pickup window starts this many minutes before sunrise; lasts GRAND_CANYON_SUNRISE_PICKUP_WINDOW_MINUTES. */
export const GRAND_CANYON_SUNRISE_PICKUP_MINUTES_BEFORE_SUNRISE = 6 * 60 + 40
export const GRAND_CANYON_SUNRISE_PICKUP_WINDOW_MINUTES = 50

/** South Rim / Lipan approximate sunrise (Arizona local, minutes 0–1439) */
const LIPAN_APPROX_SUNRISE_MINUTES_BY_MONTH: readonly number[] = [
  7 * 60 + 45, // Jan
  7 * 60 + 15, // Feb
  6 * 60 + 35, // Mar
  5 * 60 + 55, // Apr
  5 * 60 + 20, // May (e.g. 5:20 → pickup from22:40 previous calendar day)
  5 * 60 + 8, // Jun
  5 * 60 + 15, // Jul
  5 * 60 + 38, // Aug
  6 * 60 + 5, // Sep
  6 * 60 + 32, // Oct
  6 * 60 + 55, // Nov
  7 * 60 + 35, // Dec
]

function normCompact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

export function isGoblinGrandCanyonSunriseTour(product: {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
}): boolean {
  const fields = [
    product.customer_name_ko,
    product.name_ko,
    product.name,
    product.customer_name_en,
    product.name_en,
  ].filter((f): f is string => typeof f === 'string' && f.length > 0)

  const hasGoblin = fields.some(
    (f) => f.includes('\ubc24\ub3c4\uae68\ube44') || normCompact(f).includes('goblin')
  )
  const hasGc = fields.some(
    (f) =>
      f.includes('\uadf8\ub79c\ub4dc\uce90\ub155') ||
      f.includes('\uadf8\ub79c\ub4dc \uce90\ub2c8\uc5b8') ||
      normCompact(f).includes('grandcanyon')
  )
  const hasSunrise = fields.some((f) => f.includes('일출') || normCompact(f).includes('sunrise'))
  return hasGoblin && hasGc && hasSunrise
}

export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** "HH:MM" or "HH:MM:SS" (Arizona 24h) */
export function parseSunriseCacheToMinutes(sunrise: string | null | undefined): number | null {
  if (sunrise == null || sunrise === '') return null
  const part = sunrise.trim().split(':')
  if (part.length < 2) return null
  const h = parseInt(part[0], 10)
  const m = parseInt(part[1], 10)
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

export function getApproxSunriseMinutesFromTourYmd(tourYmd: string): number {
  const [, mo] = tourYmd.split('-').map(Number)
  const month = mo >= 1 && mo <= 12 ? mo : 6
  return LIPAN_APPROX_SUNRISE_MINUTES_BY_MONTH[month - 1]
}

export function resolveSunriseMinutesForEmail(
  tourYmd: string,
  cachedSunrise: string | null | undefined
): { sunriseMinutes: number; usedApproxTable: boolean } {
  const parsed = parseSunriseCacheToMinutes(cachedSunrise ?? null)
  if (parsed != null) return { sunriseMinutes: parsed, usedApproxTable: false }
  return { sunriseMinutes: getApproxSunriseMinutesFromTourYmd(tourYmd), usedApproxTable: true }
}

export type GrandCanyonSunrisePickupEmailInfo = {
  tourYmd: string
  pickupYmd: string
  pickupEndYmd: string
  sunriseMinutes: number
  pickupWindowStartMinutes: number
  pickupWindowEndMinutes: number
  showDifferentDatesWarning: boolean
  usedApproxTable: boolean
}

export function buildGrandCanyonSunrisePickupEmailInfo(
  tourYmd: string,
  cachedSunrise: string | null | undefined
): GrandCanyonSunrisePickupEmailInfo {
  const { sunriseMinutes, usedApproxTable } = resolveSunriseMinutesForEmail(tourYmd, cachedSunrise)

  let pickupStartFromTourMidnight = sunriseMinutes - GRAND_CANYON_SUNRISE_PICKUP_MINUTES_BEFORE_SUNRISE
  let pickupYmd = tourYmd
  if (pickupStartFromTourMidnight < 0) {
    pickupYmd = addCalendarDaysYmd(tourYmd, -1)
    pickupStartFromTourMidnight += 24 * 60
  }

  const startMin = pickupStartFromTourMidnight
  let endMin = startMin + GRAND_CANYON_SUNRISE_PICKUP_WINDOW_MINUTES
  let pickupEndYmd = pickupYmd
  if (endMin >= 24 * 60) {
    endMin -= 24 * 60
    pickupEndYmd = addCalendarDaysYmd(pickupYmd, 1)
  }

  return {
    tourYmd,
    pickupYmd,
    pickupEndYmd,
    sunriseMinutes,
    pickupWindowStartMinutes: startMin,
    pickupWindowEndMinutes: endMin,
    showDifferentDatesWarning: pickupYmd !== tourYmd,
    usedApproxTable,
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

export function formatMinutesAmPmEn(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  return `${h12}:${pad2(m)} ${period}`
}

/** Korean 오전/오후 */
export function formatMinutesKoreanClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const isAm = h24 < 12
  const period = isAm ? '오전' : '오후'
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24 === 12 ? 12 : h24
  if (m === 0) return `${period} ${h12}시`
  return `${period} ${h12}시 ${m}분`
}

export function formatYmdLong(ymd: string, isEnglish: boolean): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(isEnglish ? 'en-US' : 'ko-KR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
