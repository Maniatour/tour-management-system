import { createClientSupabase, supabaseAdmin } from '@/lib/supabase'
import { computeSunriseSunsetArizona } from '@/lib/sunriseSunsetFetch'
import { addTourLocalCalendarDays, getTourLocalToday } from '@/lib/tourWeatherDates'

function dbForWeatherJob() {
  return typeof window === 'undefined' && supabaseAdmin ? supabaseAdmin : createClientSupabase()
}

export const GOBLIN_TOUR_LOCATIONS = [
  { name: 'Grand Canyon South Rim', lat: 36.1069, lng: -112.1129 },
  { name: 'Zion Canyon', lat: 37.2982, lng: -113.0263 },
  { name: 'Page City', lat: 36.9147, lng: -111.4558 },
] as const

/** 외부 API 없이 suncalc — Arizona 현지 시각 (투어·픽업용 근사값) */
function getSunriseSunsetComputed(lat: number, lng: number, date: string) {
  return computeSunriseSunsetArizona(lat, lng, date)
}

const SUNRISE_UPSERT_CHUNK = 80

async function upsertSunriseSunsetRows(
  supabase: ReturnType<typeof dbForWeatherJob>,
  rows: Array<{
    location_name: string
    latitude: number
    longitude: number
    date: string
    sunrise_time: string
    sunset_time: string
  }>
) {
  for (let i = 0; i < rows.length; i += SUNRISE_UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + SUNRISE_UPSERT_CHUNK)
    const { error } = await supabase
      .from('sunrise_sunset_data')
      .upsert(chunk, { onConflict: 'location_name,date' })
    if (error) throw error
  }
}

/**
 * 지정일부터 dayCount일 × 투어 지역 — 일출·일몰 근사값 일괄 저장 (suncalc).
 * 외부 sunrise-sunset.org 미사용.
 */
export async function collectSunriseSunsetComputedYear(
  startDate: string,
  dayCount: number = 365,
  locations: ReadonlyArray<{ name: string; lat: number; lng: number }> = GOBLIN_TOUR_LOCATIONS
) {
  const supabase = dbForWeatherJob()
  const days = Math.max(1, Math.min(400, Math.floor(dayCount)))
  const rows: Array<{
    location_name: string
    latitude: number
    longitude: number
    date: string
    sunrise_time: string
    sunset_time: string
  }> = []

  for (let i = 0; i < days; i++) {
    const dateString = addTourLocalCalendarDays(startDate, i)
    for (const location of locations) {
      const { sunrise, sunset } = getSunriseSunsetComputed(location.lat, location.lng, dateString)
      rows.push({
        location_name: location.name,
        latitude: location.lat,
        longitude: location.lng,
        date: dateString,
        sunrise_time: sunrise,
        sunset_time: sunset,
      })
    }
  }

  await upsertSunriseSunsetRows(supabase, rows)

  const endDate = addTourLocalCalendarDays(startDate, days - 1)
  return {
    successCount: rows.length,
    errorCount: 0,
    dayCount: days,
    locationCount: locations.length,
    startDate,
    endDate,
  }
}

async function getWeatherData(lat: number, lng: number, date?: string) {
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
  if (!apiKey) {
    console.error('OpenWeatherMap API key not found')
    throw new Error(
      'OpenWeatherMap API key not found. Please set NEXT_PUBLIC_OPENWEATHER_API_KEY in your environment variables.'
    )
  }
  try {
    const targetDate = date || getTourLocalToday()
    const today = getTourLocalToday()
    const forecastEnd = addTourLocalCalendarDays(today, 4)
    if (targetDate >= today && targetDate <= forecastEnd) {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`
      )
      const data = await response.json()
      if (String(data.cod) === '200' && Array.isArray(data.list)) {
        const targetForecasts = data.list.filter((item: { dt_txt: string }) =>
          item.dt_txt.startsWith(targetDate)
        )
        if (targetForecasts.length > 0) {
          const temperatures = targetForecasts.map((item: { main: { temp: number } }) => item.main.temp)
          const temp_max = Math.max(...temperatures)
          const temp_min = Math.min(...temperatures)
          const currentForecast = targetForecasts[targetForecasts.length - 1]
          return {
            temperature: currentForecast.main.temp,
            temp_max,
            temp_min,
            humidity: currentForecast.main.humidity,
            weather_main: currentForecast.weather[0].main,
            weather_description: currentForecast.weather[0].description,
            wind_speed: currentForecast.wind.speed,
            visibility: currentForecast.visibility,
          }
        }
      }
    }
    console.warn(`Weather data not available for ${targetDate}, using default values`)
    return {
      temperature: 20,
      temp_max: 25,
      temp_min: 15,
      humidity: 50,
      weather_main: 'Clear',
      weather_description: 'Clear sky',
      wind_speed: 5,
      visibility: 10000,
    }
  } catch (error) {
    console.error('Error fetching weather data:', error)
    return null
  }
}

export async function collectDataForDate(date: string, weatherOnly: boolean = false): Promise<void> {
  const supabase = dbForWeatherJob()
  console.log(`Starting data collection for date: ${date}, weatherOnly: ${weatherOnly}`)
  for (const location of GOBLIN_TOUR_LOCATIONS) {
    try {
      console.log(`Processing location: ${location.name}`)
      if (!weatherOnly) {
        const sunriseSunsetData = getSunriseSunsetComputed(location.lat, location.lng, date)
        const { error: sunriseError } = await supabase.from('sunrise_sunset_data').upsert(
          {
            location_name: location.name,
            latitude: location.lat,
            longitude: location.lng,
            date,
            sunrise_time: sunriseSunsetData.sunrise,
            sunset_time: sunriseSunsetData.sunset,
          },
          { onConflict: 'location_name,date' }
        )
        if (sunriseError) {
          console.error(`Error upserting sunrise data for ${location.name}:`, sunriseError)
        }
      }
      const weatherData = await getWeatherData(location.lat, location.lng, date)
      if (weatherData) {
        const { error: weatherError } = await supabase.from('weather_data').upsert(
          {
            location_name: location.name,
            latitude: location.lat,
            longitude: location.lng,
            date,
            ...weatherData,
          },
          { onConflict: 'location_name,date' }
        )
        if (weatherError) {
          console.error(`Error upserting weather data for ${location.name}:`, weatherError)
        }
      } else {
        console.warn(`No weather data received for ${location.name}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`Error collecting data for ${location.name} on ${date}:`, error)
    }
  }
  console.log(`Completed data collection for date: ${date}`)
}

/** @deprecated collectSunriseSunsetComputedYear 사용 — 하위 호환(30일·3지역) */
export async function collect1MonthSunriseSunset(startDate: string) {
  return collectSunriseSunsetComputedYear(startDate, 30)
}
