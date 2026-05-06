import { createClientSupabase } from './supabase'

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

// Convert UTC time to Arizona local time (MST/MDT)
function convertToArizonaTime(utcTimeString: string): string {
  try {
    // Parse UTC time string (format: "HH:MM:SS")
    const [hours, minutes, seconds] = utcTimeString.split(':').map(Number)
    
    // Create a date object for today with the UTC time
    const today = new Date()
    const utcDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds)
    
    // Convert to Arizona time (UTC-7, no daylight saving time)
    const arizonaTime = new Date(utcDate.getTime() - 7 * 60 * 60 * 1000)
    
    // Format as HH:MM
    return arizonaTime.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  } catch (error) {
    console.error('Error converting time to Arizona time:', error)
    return utcTimeString // Return original if conversion fails
  }
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

// Fallback: Get sunrise/sunset data from API (only if cache miss). Retries on 429/503 (rate limit / overload).
async function getSunriseSunsetDataFromAPI(lat: number, lng: number, date: string) {
  const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`
  const maxAttempts = 4

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      })

      if (response.status === 429 || response.status === 503) {
        clearTimeout(timeoutId)
        if (attempt < maxAttempts) {
          const waitMs = 900 * 2 ** (attempt - 1)
          console.warn(`Sunrise/sunset API status ${response.status}, retrying in ${waitMs}ms`)
          await new Promise((r) => setTimeout(r, waitMs))
          continue
        }
        console.warn(`Sunrise/sunset API responded with status ${response.status}`)
        return null
      }

      if (!response.ok) {
        clearTimeout(timeoutId)
        console.warn(`Sunrise/sunset API responded with status ${response.status}`)
        return null
      }

      clearTimeout(timeoutId)

      const data = await response.json()

      if (data.status === 'OK' && data.results) {
        const sunriseUTC = data.results.sunrise.split('T')[1].split('+')[0]
        const sunsetUTC = data.results.sunset.split('T')[1].split('+')[0]

        return {
          sunrise: convertToArizonaTime(sunriseUTC),
          sunset: convertToArizonaTime(sunsetUTC),
        }
      }
      return null
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        console.warn('Sunrise/sunset API request timed out')
      } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        console.warn('Sunrise/sunset API request failed (network error)')
      } else {
        console.error('Error fetching sunrise/sunset data from API:', error)
      }
      return null
    }
  }
  return null
}

// 요청한 날짜를 YYYY-MM-DD로 통일 (캐시/API 일치용). 투어 상세·이메일 미리보기 동일 데이터 보장.
export function normalizeDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return new Date().toISOString().split('T')[0]
  const trimmed = dateStr.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (trimmed.includes('T')) return trimmed.split('T')[0]
  return trimmed
}

// Fallback: Get weather data from API (only if cache miss). date는 YYYY-MM-DD.
async function getWeatherDataFromAPI(lat: number, lng: number, date: string) {
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

    if (data.cod === '200') {
      const targetDate = normalizeDate(date)
      const dayForecasts = data.list.filter((item: any) => 
        item.dt_txt.startsWith(targetDate)
      )
      
      if (dayForecasts.length > 0) {
        const temperatures = dayForecasts.map((item: any) => item.main.temp)
        const temp_max = Math.max(...temperatures)
        const temp_min = Math.min(...temperatures)
        const currentForecast = dayForecasts[dayForecasts.length - 1]
        
        return {
          temperature: currentForecast.main.temp,
          temp_max: temp_max,
          temp_min: temp_min,
          humidity: currentForecast.main.humidity,
          weather_main: currentForecast.weather[0].main,
          weather_description: currentForecast.weather[0].description,
          wind_speed: currentForecast.wind.speed,
          visibility: currentForecast.visibility
        }
      }
    }
    return null
  } catch (error: any) {
    // 네트워크 오류는 조용히 처리 (fallback 사용)
    if (error.name === 'AbortError') {
      console.warn('Weather API request timed out')
    } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
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

// Get weather data (cached first, API fallback). date는 YYYY-MM-DD로 통일해 사용.
export async function getWeatherData(locationName: string, date: string) {
  const normalizedDate = normalizeDate(date)
  try {
    const cachedData = await getCachedWeatherData(locationName, normalizedDate)
    if (cachedData) {
      return cachedData
    }
    
    const location = GOBLIN_TOUR_LOCATIONS.find(loc => loc.name === locationName)
    if (location) {
      return await getWeatherDataFromAPI(location.lat, location.lng, normalizedDate)
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
    
    if (data.cod === '200') {
      const forecasts: LocationWeather[] = []
      const today = new Date()
      
      // Group forecasts by date
      const forecastsByDate: { [key: string]: any[] } = {}
      
      data.list.forEach((item: any) => {
        const date = item.dt_txt.split(' ')[0]
        if (!forecastsByDate[date]) {
          forecastsByDate[date] = []
        }
        forecastsByDate[date].push(item)
      })
      
      // Get 7 days of forecasts
      for (let i = 0; i < 7; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        const dateString = date.toISOString().split('T')[0]
        
        if (forecastsByDate[dateString]) {
          const dayForecasts = forecastsByDate[dateString]
          
          // Calculate min/max temperatures for the day
          const temperatures = dayForecasts.map((item: any) => item.main.temp)
          const temp_max = Math.max(...temperatures)
          const temp_min = Math.min(...temperatures)
          
          // Use midday forecast for current conditions
          const middayForecast = dayForecasts.find((item: any) => {
            const hour = new Date(item.dt_txt).getHours()
            return hour >= 12 && hour <= 14
          }) || dayForecasts[Math.floor(dayForecasts.length / 2)]
          
          // 연속 일출/일몰 API 호출로 429가 나기 쉬워 날짜마다 짧게 간격을 둠
          if (i > 0) {
            await new Promise((r) => setTimeout(r, 400))
          }
          // Get sunrise/sunset data
          const sunriseSunsetData = await getSunriseSunsetData(locationName, dateString)
          
          forecasts.push({
            location: locationName,
            sunrise: sunriseSunsetData?.sunrise || '06:00',
            sunset: sunriseSunsetData?.sunset || '18:00',
            weather: {
              temperature: middayForecast.main.temp,
              temp_max: temp_max,
              temp_min: temp_min,
              humidity: middayForecast.main.humidity,
              weather_main: middayForecast.weather[0].main,
              weather_description: middayForecast.weather[0].description,
              wind_speed: middayForecast.wind.speed,
              visibility: middayForecast.visibility
            }
          })
        }
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
  const results = []
  
  for (const location of GOBLIN_TOUR_LOCATIONS) {
    try {
      const [sunriseSunsetData, weatherData] = await Promise.all([
        getSunriseSunsetData(location.name, normalizedDate),
        getWeatherData(location.name, normalizedDate)
      ])
      
      results.push({
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
          visibility: 10000
        }
      })
    } catch (error) {
      console.warn(`Error getting data for ${location.name}:`, error)
      results.push({
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
          visibility: 10000
        }
      })
    }
  }
  
  return {
    grandCanyon: results[0],
    zionCanyon: results[1],
    pageCity: results[2]
  }
}