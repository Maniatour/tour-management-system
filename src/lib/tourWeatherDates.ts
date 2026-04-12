/**
 * Tour weather uses America/Phoenix calendar for `weather_data.date`
 * so it matches admin checks and on-site expectations (Grand Canyon area).
 */
export const TOUR_WEATHER_TIMEZONE = 'America/Phoenix'

export function getTourLocalToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TOUR_WEATHER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Phoenix has no DST; noon local ↔ fixed UTC offset for stable calendar stepping. */
function phoenixYmdToUtcNoonMs(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d, 12 + 7, 0, 0)
}

/** Add whole calendar days in tour TZ (YYYY-MM-DD in / out). */
export function addTourLocalCalendarDays(ymd: string, deltaDays: number): string {
  const [y0, m0, d0] = ymd.split('-').map((s) => parseInt(s, 10))
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TOUR_WEATHER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const baseMs = phoenixYmdToUtcNoonMs(y0, m0, d0)
  return formatter.format(new Date(baseMs + deltaDays * 24 * 60 * 60 * 1000))
}

/** Inclusive of today in tour TZ, then +1 … + (count - 1). */
export function getTourLocalNextNDates(count: number): string[] {
  const today = getTourLocalToday()
  const [y0, m0, d0] = today.split('-').map((s) => parseInt(s, 10))
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TOUR_WEATHER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const out: string[] = []
  const baseMs = phoenixYmdToUtcNoonMs(y0, m0, d0)
  const dayMs = 24 * 60 * 60 * 1000
  for (let i = 0; i < count; i++) {
    out.push(formatter.format(new Date(baseMs + i * dayMs)))
  }
  return out
}
