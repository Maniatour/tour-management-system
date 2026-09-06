export type OpenWeatherForecastItem = {
  dt_txt: string
  main: { temp: number; humidity: number }
  weather: Array<{ main: string; description: string }>
  wind: { speed: number }
  visibility?: number
}

export type PickedDayWeather = {
  temperature: number
  temp_max: number
  temp_min: number
  humidity: number
  weather_main: string
  weather_description: string
  wind_speed: number
  visibility: number
}

function openWeatherDtTxtToUtc(dtTxt: string): Date {
  return new Date(`${dtTxt.replace(' ', 'T')}Z`)
}

export function timeZoneForWeatherLocation(locationName: string): string {
  return locationName.toLowerCase().includes('zion') ? 'America/Denver' : 'America/Phoenix'
}

/** Local hour the goblin itinerary typically hits this stop. */
export function targetLocalHourForWeatherLocation(locationName: string): number {
  const name = locationName.toLowerCase()
  if (name.includes('grand canyon')) return 6
  if (name.includes('page')) return 12
  if (name.includes('zion')) return 15
  return 9
}

export function forecastLocalYmd(dtTxt: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(openWeatherDtTxtToUtc(dtTxt))
}

function localHour(dtTxt: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(openWeatherDtTxtToUtc(dtTxt))
  return Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
}

export function pickTourDayForecast<T extends { dt_txt: string }>(
  forecasts: T[],
  locationName: string,
  localYmd: string
): T | null {
  if (forecasts.length === 0) return null
  const timeZone = timeZoneForWeatherLocation(locationName)
  const targetHour = targetLocalHourForWeatherLocation(locationName)
  const day = forecasts.filter((item) => forecastLocalYmd(item.dt_txt, timeZone) === localYmd)
  const pool = day.length > 0 ? day : forecasts

  let best = pool[0]
  let bestDiff = Number.POSITIVE_INFINITY
  for (const item of pool) {
    const hour = localHour(item.dt_txt, timeZone)
    const raw = Math.abs(hour - targetHour)
    const diff = Math.min(raw, 24 - raw)
    if (diff < bestDiff) {
      bestDiff = diff
      best = item
    }
  }
  return best
}

export function weatherFromDayForecasts(
  list: OpenWeatherForecastItem[],
  locationName: string,
  localYmd: string
): PickedDayWeather | null {
  const timeZone = timeZoneForWeatherLocation(locationName)
  const day = list.filter((item) => forecastLocalYmd(item.dt_txt, timeZone) === localYmd)
  if (day.length === 0) return null

  const picked = pickTourDayForecast(day, locationName, localYmd)
  if (!picked?.weather?.[0]) return null

  const temperatures = day.map((item) => item.main.temp)
  return {
    temperature: picked.main.temp,
    temp_max: Math.max(...temperatures),
    temp_min: Math.min(...temperatures),
    humidity: picked.main.humidity,
    weather_main: picked.weather[0].main,
    weather_description: picked.weather[0].description,
    wind_speed: picked.wind.speed,
    visibility: picked.visibility ?? 10000,
  }
}
