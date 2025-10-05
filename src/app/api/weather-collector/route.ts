import { NextRequest, NextResponse } from 'next/server'
import { createClientSupabase } from '@/lib/supabase'

// Goblin tour locations
const GOBLIN_TOUR_LOCATIONS = [
  { name: 'Grand Canyon South Rim', lat: 36.1069, lng: -112.1129 },
  { name: 'Zion Canyon', lat: 37.2982, lng: -113.0263 },
  { name: 'Page City', lat: 36.9147, lng: -111.4558 }
]

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
    
    // Format as HH:MM:SS
    return arizonaTime.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch (error) {
    console.error('Error converting time to Arizona time:', error)
    return utcTimeString // Return original if conversion fails
  }
}

// Get sunrise/sunset data from API
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
        sunset: convertToArizonaTime(sunsetUTC)
      }
    }
    throw new Error('Sunrise-sunset API error')
  } catch (error) {
    console.error('Error fetching sunrise/sunset data:', error)
    return null
  }
}

// Get weather data from OpenWeatherMap API
async function getWeatherData(lat: number, lng: number, date?: string) {
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
  if (!apiKey) {
    console.error('OpenWeatherMap API key not found')
    throw new Error('OpenWeatherMap API key not found. Please set NEXT_PUBLIC_OPENWEATHER_API_KEY in your environment variables.')
  }

  try {
    const targetDate = date || new Date().toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    
    // For today and next 4 days, use forecast API
    if (targetDate >= today && targetDate <= getDateAfterDays(today, 4)) {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`
      )
      const data = await response.json()
      
      if (data.cod === '200') {
        const targetForecasts = data.list.filter((item: any) => 
          item.dt_txt.startsWith(targetDate)
        )
        
        if (targetForecasts.length > 0) {
          // Calculate min/max temperatures from the day's forecasts
          const temperatures = targetForecasts.map((item: any) => item.main.temp)
          const temp_max = Math.max(...temperatures)
          const temp_min = Math.min(...temperatures)
          
          // Use the most recent forecast for current conditions
          const currentForecast = targetForecasts[targetForecasts.length - 1]
          
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
    }
    
    // For dates beyond 5 days, use historical weather API or return default data
    // Since historical API requires paid subscription, we'll return reasonable defaults
    console.warn(`Weather data not available for ${targetDate}, using default values`)
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
    console.error('Error fetching weather data:', error)
    return null
  }
}

// Helper function to get date after N days
function getDateAfterDays(dateString: string, days: number): string {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

// Collect data for a specific date
async function collectDataForDate(date: string, weatherOnly: boolean = false) {
  const supabase = createClientSupabase()
  console.log(`Starting data collection for date: ${date}, weatherOnly: ${weatherOnly}`)
  
  for (const location of GOBLIN_TOUR_LOCATIONS) {
    try {
      console.log(`Processing location: ${location.name}`)
      
      // Get sunrise/sunset data (only if not weather-only update)
      if (!weatherOnly) {
        console.log(`Getting sunrise/sunset data for ${location.name}`)
        const sunriseSunsetData = await getSunriseSunsetData(location.lat, location.lng, date)
        if (sunriseSunsetData) {
          console.log(`Sunrise/sunset data for ${location.name}:`, sunriseSunsetData)
          const { error: sunriseError } = await supabase.from('sunrise_sunset_data').upsert({
            location_name: location.name,
            latitude: location.lat,
            longitude: location.lng,
            date,
            sunrise_time: sunriseSunsetData.sunrise,
            sunset_time: sunriseSunsetData.sunset
          })
          if (sunriseError) {
            console.error(`Error upserting sunrise data for ${location.name}:`, sunriseError)
          } else {
            console.log(`Successfully upserted sunrise/sunset data for ${location.name}`)
          }
        } else {
          console.warn(`No sunrise/sunset data received for ${location.name}`)
        }
      }

      // Get weather data
      console.log(`Getting weather data for ${location.name}`)
      const weatherData = await getWeatherData(location.lat, location.lng, date)
      if (weatherData) {
        console.log(`Weather data for ${location.name}:`, weatherData)
        const { error: weatherError } = await supabase.from('weather_data').upsert({
          location_name: location.name,
          latitude: location.lat,
          longitude: location.lng,
          date,
          ...weatherData
        })
        if (weatherError) {
          console.error(`Error upserting weather data for ${location.name}:`, weatherError)
        } else {
          console.log(`Successfully upserted weather data for ${location.name}`)
        }
      } else {
        console.warn(`No weather data received for ${location.name}`)
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`Error collecting data for ${location.name} on ${date}:`, error)
    }
  }
  
  console.log(`Completed data collection for date: ${date}`)
}

// Collect 1 month of sunrise/sunset data for Grand Canyon South Rim
async function collect1MonthSunriseSunset(startDate: string) {
  const supabase = createClientSupabase()
  let successCount = 0
  let errorCount = 0
  
  // Only Grand Canyon South Rim
  const grandCanyonLocation = GOBLIN_TOUR_LOCATIONS.find(loc => loc.name === 'Grand Canyon South Rim')
  
  if (!grandCanyonLocation) {
    throw new Error('Grand Canyon South Rim location not found')
  }
  
  const start = new Date(startDate)
  
  for (let i = 0; i < 30; i++) { // 30일 (1개월)
    const targetDate = new Date(start)
    targetDate.setDate(start.getDate() + i)
    const dateString = targetDate.toISOString().split('T')[0]
    
    try {
      const sunriseSunsetData = await getSunriseSunsetData(grandCanyonLocation.lat, grandCanyonLocation.lng, dateString)
      if (sunriseSunsetData) {
        await supabase.from('sunrise_sunset_data').upsert({
          location_name: grandCanyonLocation.name,
          latitude: grandCanyonLocation.lat,
          longitude: grandCanyonLocation.lng,
          date: dateString,
          sunrise_time: sunriseSunsetData.sunrise,
          sunset_time: sunriseSunsetData.sunset
        })
        successCount++
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`Error collecting sunrise/sunset data for ${grandCanyonLocation.name} on ${dateString}:`, error)
      errorCount++
    }
    
    // Progress update every 5 days
    if ((i + 1) % 5 === 0) {
      console.log(`Progress: ${i + 1}/30 days completed`)
    }
  }
  
  return { successCount, errorCount, startDate, endDate: new Date(start.getTime() + 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check if this is a 1-month sunrise/sunset collection request
    if (body.collect1MonthSunriseSunset) {
      const { startDate } = body
      
      if (!startDate) {
        return NextResponse.json({ error: 'Start date is required for 1-month collection' }, { status: 400 })
      }
      
      const result = await collect1MonthSunriseSunset(startDate)
      
      return NextResponse.json({ 
        success: true, 
        message: `1개월 일출/일몰 데이터 수집 완료 (${result.startDate} ~ ${result.endDate}). 성공: ${result.successCount}개, 실패: ${result.errorCount}개`,
        details: result
      })
    }
    
    // Regular single date collection
    const { date, updateWeatherOnly } = body
    
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    await collectDataForDate(date, updateWeatherOnly || false)
    
    const message = updateWeatherOnly 
      ? `Weather data updated for ${date}` 
      : `Data collected for ${date}`
    
    return NextResponse.json({ 
      success: true, 
      message 
    })
  } catch (error) {
    console.error('Error in weather data collection:', error)
    return NextResponse.json(
      { error: 'Failed to collect weather data' }, 
      { status: 500 }
    )
  }
}

// Collect data for multiple dates (for scheduling)
export async function PUT(request: NextRequest) {
  try {
    const { startDate, endDate } = await request.json()
    
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const dates = []
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    for (const date of dates) {
      await collectDataForDate(date)
      // Add delay between dates to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Data collected for ${dates.length} dates from ${startDate} to ${endDate}` 
    })
  } catch (error) {
    console.error('Error in bulk weather data collection:', error)
    return NextResponse.json(
      { error: 'Failed to collect weather data' }, 
      { status: 500 }
    )
  }
}
