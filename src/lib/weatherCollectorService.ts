import { createClientSupabase, supabaseAdmin } from '@/lib/supabase'
import { addTourLocalCalendarDays, getTourLocalToday } from '@/lib/tourWeatherDates'

function dbForWeatherJob() {
  return typeof window === 'undefined' && supabaseAdmin ? supabaseAdmin : createClientSupabase()
}

const GOBLIN_TOUR_LOCATIONS = [
  { name: 'Grand Canyon South Rim', lat: 36.1069, lng: -112.1129 },
  { name: 'Zion Canyon', lat: 37.2982, lng: -113.0263 },
  { name: 'Page City', lat: 36.9147, lng: -111.4558 },
]

function convertToArizonaTime(utcTimeString: string): string {
  try {
    const [hours, minutes, seconds] = utcTimeString.split(':').map(Number)
    const today = new Date()
    const utcDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds)
    const arizonaTime = new Date(utcDate.getTime() - 7 * 60 * 60 * 1000)
    return arizonaTime.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch (error) {
    console.error('Error converting time to Arizona time:', error)
    return utcTimeString
  }
}

async function getSunriseSunsetData(lat: number, lng: number, date: string) {
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
        sunset: convertToArizonaTime(sunsetUTC),
      }
    }
    throw new Error('Sunrise-sunset API error')
  } catch (error) {
    console.error('Error fetching sunrise/sunset data:', error)
    return null
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
        const sunriseSunsetData = await getSunriseSunsetData(location.lat, location.lng, date)
        if (sunriseSunsetData) {
          const { error: sunriseError } = await supabase.from('sunrise_sunset_data').upsert({
            location_name: location.name,
            latitude: location.lat,
            longitude: location.lng,
            date,
            sunrise_time: sunriseSunsetData.sunrise,
            sunset_time: sunriseSunsetData.sunset,
          })
          if (sunriseError) {
            console.error(`Error upserting sunrise data for ${location.name}:`, sunriseError)
          }
        } else {
          console.warn(`No sunrise/sunset data received for ${location.name}`)
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

export async function collect1MonthSunriseSunset(startDate: string) {
  const supabase = dbForWeatherJob()
  let successCount = 0
  let errorCount = 0
  const grandCanyonLocation = GOBLIN_TOUR_LOCATIONS.find((loc) => loc.name === 'Grand Canyon South Rim')
  if (!grandCanyonLocation) {
    throw new Error('Grand Canyon South Rim location not found')
  }
  const start = new Date(startDate)
  for (let i = 0; i < 30; i++) {
    const targetDate = new Date(start)
    targetDate.setDate(start.getDate() + i)
    const dateString = targetDate.toISOString().split('T')[0]
    try {
      const sunriseSunsetData = await getSunriseSunsetData(
        grandCanyonLocation.lat,
        grandCanyonLocation.lng,
        dateString
      )
      if (sunriseSunsetData) {
        await supabase.from('sunrise_sunset_data').upsert({
          location_name: grandCanyonLocation.name,
          latitude: grandCanyonLocation.lat,
          longitude: grandCanyonLocation.lng,
          date: dateString,
          sunrise_time: sunriseSunsetData.sunrise,
          sunset_time: sunriseSunsetData.sunset,
        })
        successCount++
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error) {
      console.error(
        `Error collecting sunrise/sunset data for ${grandCanyonLocation.name} on ${dateString}:`,
        error
      )
      errorCount++
    }
    if ((i + 1) % 5 === 0) {
      console.log(`Progress: ${i + 1}/30 days completed`)
    }
  }
  return {
    successCount,
    errorCount,
    startDate,
    endDate: new Date(start.getTime() + 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  }
}
