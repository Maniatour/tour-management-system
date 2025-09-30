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
  
  const { data, error } = await supabase
    .from('sunrise_sunset_data')
    .select('sunrise_time, sunset_time')
    .eq('location_name', locationName)
    .eq('date', date)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return {
    sunrise: convertToArizonaTime(data.sunrise_time),
    sunset: convertToArizonaTime(data.sunset_time)
  }
}

// Get cached weather data from database
async function getCachedWeatherData(locationName: string, date: string) {
  const supabase = createClientSupabase()
  
  const { data, error } = await supabase
    .from('weather_data')
    .select('temperature, temp_max, temp_min, humidity, weather_main, weather_description, wind_speed, visibility')
    .eq('location_name', locationName)
    .eq('date', date)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data
}

// Fallback: Get sunrise/sunset data from API (only if cache miss)
async function getSunriseSunsetDataFromAPI(lat: number, lng: number, date: string) {
  try {
    const response = await fetch(
      `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`
    )
    const data = await response.json()
    
    if (data.status === 'OK') {
      const sunriseUTC = data.results.sunrise.split('T')[1].split('+')[0]
      const sunsetUTC = data.results.sunset.split('T')[1].split('+')[0]
      
      return {
        sunrise: convertToArizonaTime(sunriseUTC),
        sunset: convertToArizonaTime(sunsetUTC)
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching sunrise/sunset data from API:', error)
    return null
  }
}

// Fallback: Get weather data from API (only if cache miss)
async function getWeatherDataFromAPI(lat: number, lng: number) {
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
  if (!apiKey) {
    console.warn('OpenWeatherMap API key not found')
    return null
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`
    )
    const data = await response.json()
    
    if (data.cod === '200') {
      // Get today's forecast data
      const today = new Date().toISOString().split('T')[0]
      const todayForecasts = data.list.filter((item: any) => 
        item.dt_txt.startsWith(today)
      )
      
      if (todayForecasts.length > 0) {
        // Calculate min/max temperatures from today's forecasts
        const temperatures = todayForecasts.map((item: any) => item.main.temp)
        const temp_max = Math.max(...temperatures)
        const temp_min = Math.min(...temperatures)
        
        // Use the most recent forecast for current conditions
        const currentForecast = todayForecasts[todayForecasts.length - 1]
        
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
  } catch (error) {
    console.error('Error fetching weather data from API:', error)
    return null
  }
}

// Get sunrise/sunset data (cached first, API fallback)
export async function getSunriseSunsetData(locationName: string, date: string) {
  // Try cached data first
  const cachedData = await getCachedSunriseSunsetData(locationName, date)
  if (cachedData) {
    return cachedData
  }
  
  // Fallback to API
  const location = GOBLIN_TOUR_LOCATIONS.find(loc => loc.name === locationName)
  if (location) {
    return await getSunriseSunsetDataFromAPI(location.lat, location.lng, date)
  }
  
  return null
}

// Get weather data (cached first, API fallback)
export async function getWeatherData(locationName: string, date: string) {
  // Try cached data first
  const cachedData = await getCachedWeatherData(locationName, date)
  if (cachedData) {
    return cachedData
  }
  
  // Fallback to API
  const location = GOBLIN_TOUR_LOCATIONS.find(loc => loc.name === locationName)
  if (location) {
    return await getWeatherDataFromAPI(location.lat, location.lng)
  }
  
  return null
}

// Get all goblin tour weather data for a specific date
export async function getGoblinTourWeatherData(tourDate: string): Promise<{
  grandCanyon: LocationWeather
  zionCanyon: LocationWeather
  pageCity: LocationWeather
}> {
  const results = []
  
  for (const location of GOBLIN_TOUR_LOCATIONS) {
    try {
      const [sunriseSunsetData, weatherData] = await Promise.all([
        getSunriseSunsetData(location.name, tourDate),
        getWeatherData(location.name, tourDate)
      ])
      
      results.push({
        location: location.name,
        sunrise: sunriseSunsetData?.sunrise || 'N/A',
        sunset: sunriseSunsetData?.sunset || 'N/A',
        weather: weatherData || {
          temperature: null,
          temp_max: null,
          temp_min: null,
          humidity: null,
          weather_main: 'N/A',
          weather_description: 'N/A',
          wind_speed: null,
          visibility: null
        }
      })
    } catch (error) {
      console.error(`Error getting data for ${location.name}:`, error)
      results.push({
        location: location.name,
        sunrise: 'N/A',
        sunset: 'N/A',
        weather: {
          temperature: null,
          temp_max: null,
          temp_min: null,
          humidity: null,
          weather_main: 'N/A',
          weather_description: 'N/A',
          wind_speed: null,
          visibility: null
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