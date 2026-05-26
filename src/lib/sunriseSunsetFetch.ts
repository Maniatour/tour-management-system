import SunCalc from 'suncalc'

const ARIZONA_TZ = 'America/Phoenix'

/** ISO 8601 UTC 시각 → Arizona(Phoenix) HH:MM:SS */
export function formatIsoInstantInArizona(isoUtc: string): string {
  const instant = new Date(isoUtc)
  if (Number.isNaN(instant.getTime())) {
    return isoUtc
  }
  return formatTimeInArizona(instant)
}

function formatTimeInArizona(instant: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ARIZONA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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

  return {
    sunrise: formatIsoInstantInArizona(data.results.sunrise),
    sunset: formatIsoInstantInArizona(data.results.sunset),
  }
}

export type SunriseSunsetResult = {
  sunrise: string
  sunset: string
  /** api = sunrise-sunset.org, computed = suncalc fallback */
  source: 'api' | 'computed'
}

/**
 * 일출·일몰 — 기본은 suncalc(Arizona)만 사용(근사값·서버 TZ 무관).
 * 외부 API는 `preferExternalApi: true` 일 때만 시도.
 */
export async function getSunriseSunsetForLocation(
  lat: number,
  lng: number,
  date: string,
  init?: { signal?: AbortSignal; preferExternalApi?: boolean }
): Promise<SunriseSunsetResult> {
  if (init?.preferExternalApi) {
    try {
      const fromApi = await fetchSunriseSunsetExternal(lat, lng, date, init)
      if (fromApi) {
        return { ...fromApi, source: 'api' }
      }
    } catch (error) {
      console.warn('[sunriseSunset] external API failed, using computed:', error)
    }
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
