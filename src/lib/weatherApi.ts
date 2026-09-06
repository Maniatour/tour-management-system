import { createClientSupabase } from './supabase'
import { getSunriseSunsetForLocation } from '@/lib/sunriseSunsetFetch'
import { addTourLocalCalendarDays, getTourLocalToday } from '@/lib/tourWeatherDates'
import { weatherFromDayForecasts, type OpenWeatherForecastItem } from '@/lib/weatherForecastPick'

// Goblin tour locations
const GOBLIN_TOUR_LOCATIONS = [
  { name: 'Grand Canyon South Rim', lat: 36.1069, lng: -112.1129 },
  { name: 'Zion Canyon', lat: 37.2982, lng: -113.0263 },
  { name: 'Page City', lat: 36.9147, lng: -111.4558 }
]

export interface WeatherData {
  temperature: number | null
  temp_max: number | null
  temp_min: number | null
  humidity: number | null
  weather_main: string | null
  weather_description: string | null
  wind_speed: number | null
  visibility: number | null
}

export interface SunriseSunsetData {
  sunrise: string
  sunset: string
}

export interface LocationWeather {
  location: string
  sunrise: string
  sunset: string
  weather: WeatherData
}

// Get cached sunrise/sunset data from database
export async function getCachedSunriseSunsetData(locationName: string, date: string) {
  const supabase = createClientSupabase()
  
  try {
    const { data, error } = await supabase
      .from('sunrise_sunset_data')
      .select('sunrise_time, sunset_time')
      .eq('location_name', locationName)
      .eq('date', date)
      .limit(1)
    
    if (error || !data || data.length === 0) {
      // Only log if there's an actual error, not just missing cache. AbortError는 로그 생략.
      if (error) {
        const msg = typeof (error as { message?: string })?.message === 'string' ? (error as { message: string }).message : ''
        if (!msg || (!msg.includes('AbortError') && !msg.includes('aborted'))) {
          console.warn(`Error fetching cached sunrise/sunset data for ${locationName} on ${date}:`, error.message)
        }
      }
      return null
    }
    
    const record = data[0]
    
    // DB에 저장된 시간은 이미 weather-collector에서 Arizona 시간(MST)으로 변환되어 있음
    // 따라서 추가 변환 없이 그대로 반환
    return {
      sunrise: record.sunrise_time,
      sunset: record.sunset_time
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!msg.includes('AbortError') && !msg.includes('aborted')) {
      console.warn(`Error fetching sunrise/sunset data for ${locationName}:`, error)
    }
    return null
  }
}

// Get cached weather data from database
async function getCachedWeatherData(locationName: string, date: string) {
  const supabase = createClientSupabase()
  
  try {
    const { data, error } = await supabase
      .from('weather_data')
      .select('temperature, temp_max, temp_min, humidity, weather_main, weather_description, wind_speed, visibility')
      .eq('location_name', locationName)
      .eq('date', date)
      .limit(1)
    
    if (error || !data || data.length === 0) {
      // Only log if there's an actual error, not just missing cache
      if (error) {
        console.warn(`Error fetching cached weather data for ${locationName} on ${date}:`, error.message)
      }
      return null
    }
    
    return data[0]
  } catch (error) {
    console.warn(`Error fetching weather data for ${locationName}:`, error)
    return null
  }
}

// Fallback: 일출·일몰 (캐시 미스). 브라우저는 /api/sunrise-sunset, 서버는 lib 직접 호출.
async function getSunriseSunsetDataFromAPI(lat: number, lng: number, date: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  try {
    if (typeof window !== 'undefined') {
      const response = await fetch(
        `/api/sunrise-sunset?lat=${lat}&lng=${lng}&date=${date}`,
        { signal: controller.signal, headers: { Accept: 'application/json' } }
      )
      clearTimeout(timeoutId)
      if (!response.ok) {
        console.warn(`Sunrise/sunset proxy responded with status ${response.status}`)
        return null
      }
      const data = (await response.json()) as { sunrise?: string; sunset?: string }
      if (data.sunrise && data.sunset) {
        return { sunrise: data.sunrise, sunset: data.sunset }
      }
      return null
    }

    const result = await getSunriseSunsetForLocation(lat, lng, date, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return { sunrise: result.sunrise, sunset: result.sunset }
  } catch (error: unknown) {
    clearTimeout(timeoutId)
    const err = error as { name?: string; message?: string }
    if (err.name === 'AbortError') {
      console.warn('Sunrise/sunset request timed out')
    } else if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      console.warn('Sunrise/sunset request failed (network error)')
    } else {
      console.error('Error fetching sunrise/sunset data:', error)
    }
    return null
  }
}

// 요청한 날짜를 YYYY-MM-DD로 통일 (캐시/API 일치용). 투어 상세·이메일 미리보기 동일 데이터 보장.
export function normalizeDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return new Date().toISOString().split('T')[0]
  const trimmed = dateStr.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (trimmed.includes('T')) return trimmed.split('T')[0]
  return trimmed
}

function isWithinOpenWeatherForecastWindow(date: string): boolean {
  const today = getTourLocalToday()
  const forecastEnd = addTourLocalCalendarDays(today, 4)
  return date >= today && date <= forecastEnd
}

// Fallback: Get weather data from API. date는 YYYY-MM-DD.
async function getWeatherDataFromAPI(lat: number, lng: number, date: string, locationName: string) {
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
  if (!apiKey) {
    console.warn('OpenWeatherMap API key not found')
    return null
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15초 타임아웃
    
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      }
    )
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.warn(`OpenWeatherMap API responded with status ${response.status}`)
      return null
    }
    
    const data = await response.json()

    if (String(data.cod) === '200' && Array.isArray(data.list)) {
      return weatherFromDayForecasts(
        data.list as OpenWeatherForecastItem[],
        locationName,
        normalizeDate(date)
      )
    }
    return null
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string }
    if (err.name === 'AbortError') {
      console.warn('Weather API request timed out')
    } else if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      console.warn('Weather API request failed (network error)')
    } else {
      console.error('Error fetching weather data from API:', error)
    }
    return null
  }
}

// Get sunrise/sunset data (cached first, API fallback). date는 YYYY-MM-DD로 통일.
export async function getSunriseSunsetData(locationName: string, date: string) {
  const normalizedDate = normalizeDate(date)
  try {
    const cachedData = await getCachedSunriseSunsetData(locationName, normalizedDate)
    if (cachedData) {
      return cachedData
    }
    
    const location = GOBLIN_TOUR_LOCATIONS.find(loc => loc.name === locationName)
    if (location) {
      const apiData = await getSunriseSunsetDataFromAPI(location.lat, location.lng, normalizedDate)
      if (apiData) return apiData
    }

    // Return default values if everything fails
    return {
      sunrise: '06:00',
      sunset: '18:00'
    }
  } catch (error) {
    console.warn(`Error getting sunrise/sunset data for ${locationName}:`, error)
    return {
      sunrise: '06:00',
      sunset: '18:00'
    }
  }
}

// Get weather data. Upcoming dates use the live 3-hour slot nearest tour time
// so afternoon monsoon rain is not shown as the day's icon.
export async function getWeatherData(locationName: string, date: string) {
  const normalizedDate = normalizeDate(date)
  try {
    const location = GOBLIN_TOUR_LOCATIONS.find(loc => loc.name === locationName)
    if (location && isWithinOpenWeatherForecastWindow(normalizedDate)) {
      const apiData = await getWeatherDataFromAPI(location.lat, location.lng, normalizedDate, location.name)
      if (apiData) return apiData
    }

    const cachedData = await getCachedWeatherData(locationName, normalizedDate)
    if (cachedData) {
      return cachedData
    }
    
    if (location) {
      return await getWeatherDataFromAPI(location.lat, location.lng, normalizedDate, location.name)
    }
    
    // Return default values if everything fails
    return {
      temperature: 20,
      temp_max: 25,
      temp_min: 15,
      humidity: 50,
      weather_main: 'Clear',
      weather_description: 'Clear sky',
      wind_speed: 5,
      visibility: 10000
    }
  } catch (error) {
    console.warn(`Error getting weather data for ${locationName}:`, error)
    return {
      temperature: 20,
      temp_max: 25,
      temp_min: 15,
      humidity: 50,
      weather_main: 'Clear',
      weather_description: 'Clear sky',
      wind_speed: 5,
      visibility: 10000
    }
  }
}

// Get 7-day weather forecast for a location
export async function get7DayWeatherForecast(locationName: string): Promise<LocationWeather[]> {
  const location = GOBLIN_TOUR_LOCATIONS.find(loc => loc.name === locationName)
  if (!location) {
    return []
  }

  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
  if (!apiKey) {
    console.warn('OpenWeatherMap API key not found')
    return []
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15초 타임아웃
    
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${location.lat}&lon=${location.lng}&appid=${apiKey}&units=metric`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      }
    )
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.warn(`OpenWeatherMap API responded with status ${response.status}`)
      return []
    }
    
    const data = await response.json()
    
    if (String(data.cod) === '200' && Array.isArray(data.list)) {
      const forecasts: LocationWeather[] = []
      const list = data.list as OpenWeatherForecastItem[]

      for (let i = 0; i < 7; i++) {
        const dateString = addTourLocalCalendarDays(getTourLocalToday(), i)
        const dayWeather = weatherFromDayForecasts(list, locationName, dateString)
        if (!dayWeather) continue

        if (i > 0) {
          await new Promise((r) => setTimeout(r, 400))
        }
        const sunriseSunsetData = await getSunriseSunsetData(locationName, dateString)

        forecasts.push({
          location: locationName,
          sunrise: sunriseSunsetData?.sunrise || '06:00',
          sunset: sunriseSunsetData?.sunset || '18:00',
          weather: dayWeather,
        })
      }

      return forecasts
    }
    
    return []
  } catch (error: any) {
    // 네트워크 오류는 조용히 처리 (빈 배열 반환)
    if (error.name === 'AbortError') {
      console.warn('7-day weather forecast API request timed out')
    } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      console.warn('7-day weather forecast API request failed (network error)')
    } else {
      console.error('Error fetching 7-day weather forecast:', error)
    }
    return []
  }
}

// Get all goblin tour weather data for a specific date. tourDate는 ISO 또는 YYYY-MM-DD 모두 허용.
export async function getGoblinTourWeatherData(tourDate: string): Promise<{
  grandCanyon: LocationWeather
  zionCanyon: LocationWeather
  pageCity: LocationWeather
}> {
  const normalizedDate = normalizeDate(tourDate)

  const results = await Promise.all(
    GOBLIN_TOUR_LOCATIONS.map(async (location) => {
      try {
        const [sunriseSunsetData, weatherData] = await Promise.all([
          getSunriseSunsetData(location.name, normalizedDate),
          getWeatherData(location.name, normalizedDate),
        ])

        return {
          location: location.name,
          sunrise: sunriseSunsetData?.sunrise || '06:00',
          sunset: sunriseSunsetData?.sunset || '18:00',
          weather: weatherData || {
            temperature: 20,
            temp_max: 25,
            temp_min: 15,
            humidity: 50,
            weather_main: 'Clear',
            weather_description: 'Clear sky',
            wind_speed: 5,
            visibility: 10000,
          },
        }
      } catch (error) {
        console.warn(`Error getting data for ${location.name}:`, error)
        return {
          location: location.name,
          sunrise: '06:00',
          sunset: '18:00',
          weather: {
            temperature: 20,
            temp_max: 25,
            temp_min: 15,
            humidity: 50,
            weather_main: 'Clear',
            weather_description: 'Clear sky',
            wind_speed: 5,
            visibility: 10000,
          },
        }
      }
    })
  )

  return {
    grandCanyon: results[0],
    zionCanyon: results[1],
    pageCity: results[2],
  }
}