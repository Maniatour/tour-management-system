import SunCalc from 'suncalc'

const ARIZONA_TZ = 'America/Phoenix'

/** sunrise-sunset.org 응답을 Arizona(Phoenix, DST 없음) 시각 문자열로 변환 */
export function convertUtcTimeStringToArizona(utcTimeString: string): string {
  try {
    const [hours, minutes, seconds] = utcTimeString.split(':').map(Number)
    const today = new Date()
    const utcDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hours,
      minutes,
      seconds ?? 0
    )
    const arizonaTime = new Date(utcDate.getTime() - 7 * 60 * 60 * 1000)
    return formatTimeInArizona(arizonaTime)
  } catch (error) {
    console.error('Error converting time to Arizona time:', error)
    return utcTimeString
  }
}

function formatTimeInArizona(instant: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: ARIZONA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant)
}

/**
 * 외부 API 없이 suncalc 로 일출·일몰 계산 (sunrise-sunset.org 장애 시 fallback).
 * Grand Canyon 등 Arizona 투어 지역용 — America/Phoenix 기준.
 */
export function computeSunriseSunsetArizona(
  lat: number,
  lng: number,
  date: string
): { sunrise: string; sunset: string } {
  const day = new Date(`${date}T12:00:00-07:00`)
  const times = SunCalc.getTimes(day, lat, lng)
  return {
    sunrise: formatTimeInArizona(times.sunrise),
    sunset: formatTimeInArizona(times.sunset),
  }
}

type SunriseSunsetApiPayload = {
  status?: string
  results?: {
    sunrise?: string
    sunset?: string
  }
}

/** sunrise-sunset.org 직접 호출 (서버 전용, CORS 없음) */
export async function fetchSunriseSunsetExternal(
  lat: number,
  lng: number,
  date: string,
  init?: { signal?: AbortSignal }
): Promise<{ sunrise: string; sunset: string } | null> {
  const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`
  const response = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as SunriseSunsetApiPayload
  if (data.status !== 'OK' || !data.results?.sunrise || !data.results?.sunset) {
    return null
  }

  const sunriseUTC = data.results.sunrise.split('T')[1]?.split('+')[0]
  const sunsetUTC = data.results.sunset.split('T')[1]?.split('+')[0]
  if (!sunriseUTC || !sunsetUTC) return null

  return {
    sunrise: convertUtcTimeStringToArizona(sunriseUTC),
    sunset: convertUtcTimeStringToArizona(sunsetUTC),
  }
}

export type SunriseSunsetResult = {
  sunrise: string
  sunset: string
  /** api = sunrise-sunset.org, computed = suncalc fallback */
  source: 'api' | 'computed'
}

/** API 우선, 실패 시 suncalc 로 계산 (항상 값 반환) */
export async function getSunriseSunsetForLocation(
  lat: number,
  lng: number,
  date: string,
  init?: { signal?: AbortSignal }
): Promise<SunriseSunsetResult> {
  try {
    const fromApi = await fetchSunriseSunsetExternal(lat, lng, date, init)
    if (fromApi) {
      return { ...fromApi, source: 'api' }
    }
  } catch (error) {
    console.warn('[sunriseSunset] external API failed, using computed fallback:', error)
  }

  const computed = computeSunriseSunsetArizona(lat, lng, date)
  return { ...computed, source: 'computed' }
}

export function parseSunriseSunsetQuery(
  latRaw: string | null,
  lngRaw: string | null,
  dateRaw: string | null
): { lat: number; lng: number; date: string } | null {
  const lat = Number(latRaw)
  const lng = Number(lngRaw)
  const date = (dateRaw ?? '').trim()
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return { lat, lng, date }
}
