'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Sun, Sunset, Cloud, Thermometer, Droplets, Wind, MapPin, Clock, RefreshCw, CloudRain, CloudSnow, CloudLightning, Eye, EyeOff, ChevronDown, ChevronUp, CloudSun, CloudDrizzle, CloudFog, CloudHail } from 'lucide-react'
import { getGoblinTourWeatherData, type LocationWeather } from '@/lib/weatherApi'

interface TourWeatherProps {
  tourDate?: string
  productId?: string
}

// 날씨 상태에 따른 Lucide 아이콘 반환 함수 (헤더용)
const getWeatherIconComponent = (weatherMain: string, weatherDescription: string) => {
  const main = weatherMain?.toLowerCase() || ''
  const description = weatherDescription?.toLowerCase() || ''
  
  // 구체적인 날씨 상태별 아이콘
  if (description.includes('thunderstorm') || description.includes('storm')) {
    return <CloudLightning className="w-6 h-6 text-purple-600" />
  }
  if (description.includes('snow') || description.includes('blizzard')) {
    return <CloudSnow className="w-6 h-6 text-blue-400" />
  }
  if (description.includes('rain') || description.includes('shower')) {
    return <CloudRain className="w-6 h-6 text-blue-500" />
  }
  if (description.includes('drizzle')) {
    return <CloudDrizzle className="w-6 h-6 text-blue-400" />
  }
  if (description.includes('fog') || description.includes('mist') || description.includes('haze')) {
    return <CloudFog className="w-6 h-6 text-gray-500" />
  }
  if (description.includes('clear') || description.includes('sunny')) {
    return <Sun className="w-6 h-6 text-yellow-500" />
  }
  if (description.includes('clouds') && description.includes('partly')) {
    return <CloudSun className="w-6 h-6 text-orange-400" />
  }
  if (description.includes('clouds')) {
    return <Cloud className="w-6 h-6 text-gray-500" />
  }
  
  // 기본 날씨 상태별 아이콘
  switch (main) {
    case 'thunderstorm':
      return <CloudLightning className="w-6 h-6 text-purple-600" />
    case 'drizzle':
      return <CloudDrizzle className="w-6 h-6 text-blue-400" />
    case 'rain':
      return <CloudRain className="w-6 h-6 text-blue-500" />
    case 'snow':
      return <CloudSnow className="w-6 h-6 text-blue-400" />
    case 'clear':
      return <Sun className="w-6 h-6 text-yellow-500" />
    case 'clouds':
      return <CloudSun className="w-6 h-6 text-orange-400" />
    case 'mist':
    case 'fog':
    case 'haze':
      return <CloudFog className="w-6 h-6 text-gray-500" />
    default:
      return <Cloud className="w-6 h-6 text-gray-500" />
  }
}

// 날씨 상태에 따른 아이콘 반환 함수 (상세 정보용)
const getWeatherIcon = (weatherMain: string, weatherDescription: string) => {
  const main = weatherMain?.toLowerCase() || ''
  const description = weatherDescription?.toLowerCase() || ''
  
  // 구체적인 날씨 상태별 아이콘
  if (description.includes('thunderstorm') || description.includes('storm')) {
    return <CloudLightning className="h-3 w-3 text-purple-600" />
  }
  if (description.includes('snow') || description.includes('blizzard')) {
    return <CloudSnow className="h-3 w-3 text-blue-400" />
  }
  if (description.includes('rain') || description.includes('drizzle') || description.includes('shower')) {
    return <CloudRain className="h-3 w-3 text-blue-500" />
  }
  if (description.includes('fog') || description.includes('mist') || description.includes('haze')) {
    return <EyeOff className="h-3 w-3 text-gray-500" />
  }
  if (description.includes('clear') || description.includes('sunny')) {
    return <Sun className="h-3 w-3 text-yellow-500" />
  }
  if (description.includes('clouds')) {
    return <Cloud className="h-3 w-3 text-gray-500" />
  }
  
  // 기본 날씨 상태별 아이콘
  switch (main) {
    case 'thunderstorm':
      return <CloudLightning className="h-3 w-3 text-purple-600" />
    case 'drizzle':
    case 'rain':
      return <CloudRain className="h-3 w-3 text-blue-500" />
    case 'snow':
      return <CloudSnow className="h-3 w-3 text-blue-400" />
    case 'clear':
      return <Sun className="h-3 w-3 text-yellow-500" />
    case 'clouds':
      return <Cloud className="h-3 w-3 text-gray-500" />
    case 'mist':
    case 'fog':
    case 'haze':
      return <EyeOff className="h-3 w-3 text-gray-500" />
    default:
      return <Cloud className="h-3 w-3 text-gray-500" />
  }
}

// 가시거리 기준 반환 함수
const getVisibilityLevel = (visibility: number, t: (key: string) => string) => {
  const km = visibility / 1000
  
  if (km >= 10) return t('visibilityLevels.excellent')
  if (km >= 5) return t('visibilityLevels.good')
  if (km >= 1) return t('visibilityLevels.fair')
  return t('visibilityLevels.poor')
}

export default function TourWeather({ tourDate, productId }: TourWeatherProps) {
  const t = useTranslations('weather')
  const [weatherData, setWeatherData] = useState<{
    grandCanyon: LocationWeather
    zionCanyon: LocationWeather
    pageCity: LocationWeather
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [hasData, setHasData] = useState(false)

  // Convert time to 12-hour format (all times are already in Las Vegas local time)
  const convertToLocalTime = (timeString: string, location: string, isSunrise: boolean = false): string => {
    try {
      // Check if timeString is valid
      if (!timeString || timeString === 'N/A' || timeString === '') {
        return 'N/A'
      }

      console.log('Processing time:', { timeString, location, isSunrise })

      // If the time is already in 12-hour format, return as-is
      if (timeString.includes('AM') || timeString.includes('PM')) {
        return timeString
      }

      // Parse the time string (format: "HH:MM:SS" or "HH:MM")
      const timeParts = timeString.split(':')
      if (timeParts.length < 2) {
        return timeString
      }

      const hours = parseInt(timeParts[0], 10)
      const minutes = parseInt(timeParts[1], 10)

      if (isNaN(hours) || isNaN(minutes)) {
        return timeString
      }

      console.log('Parsed hours/minutes:', { hours, minutes })

      // Convert to 12-hour format
      const period = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
      const displayMinutes = minutes.toString().padStart(2, '0')

      const result = `${displayHours}:${displayMinutes} ${period}`
      console.log('Final result:', result)
      
      return result
    } catch (error) {
      console.error('Error processing time:', error, { timeString, location })
      return timeString
    }
  }

  const loadWeatherData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const targetDate = tourDate || new Date().toISOString().split('T')[0]
      const data = await getGoblinTourWeatherData(targetDate)
      setWeatherData(data)
      
      // Check if we have actual data in Supabase
      const { createClientSupabase } = await import('@/lib/supabase')
      const supabase = createClientSupabase()
      
      const { data: weatherData, error } = await supabase
        .from('weather_data')
        .select('created_at')
        .eq('date', targetDate)
        .limit(1)
      
      if (error || !weatherData || weatherData.length === 0) {
        setHasData(false)
        setLastUpdated(null)
      } else {
        setHasData(true)
        // Convert UTC time to Las Vegas time
        const createdAt = new Date((weatherData[0] as { created_at: string }).created_at)
        const lasVegasTime = createdAt.toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
        setLastUpdated(lasVegasTime)
      }
      
    } catch (err) {
      setError(t('error'))
      console.error('날씨 데이터 로딩 실패:', err)
      setHasData(false)
      setLastUpdated(null)
    } finally {
      setLoading(false)
    }
  }, [tourDate, t])

  const updateWeatherData = async () => {
    try {
      setUpdating(true)
      setError(null)
      
      // 오늘 날짜 데이터를 수집 (날씨와 일출/일몰 모두)
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch('/api/weather-collector', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          date: today
        })
      })

      if (response.ok) {
        // 데이터 수집 후 다시 로드
        await loadWeatherData()
        
        // 업데이트 성공 메시지 표시
        const now = new Date()
        const lasVegasTime = now.toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
        setLastUpdated(lasVegasTime)
        setHasData(true)
      } else {
        const errorData = await response.json()
        setError(`${t('update')} 실패: ${errorData.error}`)
      }
    } catch (err) {
      setError(`${t('update')} 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    // 밤도깨비 투어인 경우에만 데이터 로드
    if (productId === 'MDGCSUNRISE') {
      loadWeatherData()
    } else {
      setLoading(false)
    }
  }, [tourDate, productId, loadWeatherData])

  // 밤도깨비 투어가 아닌 경우 컴포넌트를 렌더링하지 않음
  if (productId !== 'MDGCSUNRISE') {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        <span className="ml-2 text-purple-700 text-sm">{t('loading')}</span>
      </div>
    )
  }

  if (error || !weatherData) {
    return (
      <div className="text-center py-3">
        <Cloud className="h-6 w-6 text-purple-400 mx-auto mb-1" />
        <p className="text-purple-700 text-sm">{t('error')}</p>
      </div>
    )
  }

  const WeatherCard = ({ locationData, showSunriseSunset = false }: { 
    locationData: LocationWeather
    showSunriseSunset?: boolean 
  }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    
    // 최저/최고 기온을 간단한 형식으로 표시
    const getTempRange = () => {
      if (locationData.weather.temp_min !== null && locationData.weather.temp_max !== null) {
        const minF = Math.round(locationData.weather.temp_min * 9/5 + 32)
        const maxF = Math.round(locationData.weather.temp_max * 9/5 + 32)
        return `${minF}°F~${maxF}°F`
      }
      return 'N/A'
    }

    // 위치명을 간단하게 표시
    const getSimpleLocationName = () => {
      if (locationData.location.includes('Grand Canyon')) {
        return 'Grand Canyon'
      } else if (locationData.location.includes('Zion')) {
        return 'Zion Canyon'
      } else if (locationData.location.includes('Page')) {
        return 'Page City'
      }
      return locationData.location
    }

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* 헤더 - 어코디언 토글 버튼 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            {/* 날씨 아이콘 (Lucide 아이콘) */}
            {getWeatherIconComponent(locationData.weather.weather_main || '', locationData.weather.weather_description || '')}
            
            {/* 위치명 */}
            <span className="font-medium text-gray-800 text-sm">{getSimpleLocationName()}</span>
            
            {/* 최저/최고 기온 */}
            <span className="text-xs text-gray-600 font-mono">
              {getTempRange()}
            </span>
            
            {/* 일출/일몰 시간 (아이콘과 함께) */}
            {showSunriseSunset && (
              <div className="flex items-center space-x-1">
                     {locationData.location.includes('Grand Canyon') && locationData.sunrise && (
                       <>
                         <Sun className="w-3 h-3 text-yellow-500" />
                         <span className="text-xs text-gray-600 font-mono">
                           {convertToLocalTime(locationData.sunrise, locationData.location, true)}
                         </span>
                       </>
                     )}
                     {locationData.location.includes('Zion') && locationData.sunset && (
                       <>
                         <Sunset className="w-3 h-3 text-orange-500" />
                         <span className="text-xs text-gray-600 font-mono">
                           {convertToLocalTime(locationData.sunset, locationData.location, false)}
                         </span>
                       </>
                     )}
              </div>
            )}
          </div>
          
          {/* 쉐브론 애로우 */}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </button>
        
        {/* 확장된 내용 */}
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2 mb-2 pt-2">
              <div className="flex items-center">
                <Thermometer className="h-3 w-3 text-red-500 mr-1" />
                <span className="text-xs text-gray-600">
                  {locationData.weather.temperature ? 
                    `${Math.round(locationData.weather.temperature)}°C (${Math.round(locationData.weather.temperature * 9/5 + 32)}°F)` : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="flex items-center">
                <Droplets className="h-3 w-3 text-blue-500 mr-1" />
                <span className="text-xs text-gray-600">
                  {locationData.weather.humidity ? `${locationData.weather.humidity}%` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center">
                <Wind className="h-3 w-3 text-gray-500 mr-1" />
                <span className="text-xs text-gray-600">
                  {locationData.weather.wind_speed ? `${locationData.weather.wind_speed}m/s` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center">
                <Eye className="h-3 w-3 text-gray-500 mr-1" />
                <span className="text-xs text-gray-600">
                  {locationData.weather.visibility ? 
                    `${Math.round(locationData.weather.visibility / 1000)}km ${getVisibilityLevel(locationData.weather.visibility, t)}` : 
                    'N/A'
                  }
                </span>
              </div>
            </div>

            {/* 최고/최저 기온 상세 표시 */}
            {(locationData.weather.temp_max !== null || locationData.weather.temp_min !== null) && (
              <div className="flex items-center justify-between text-xs text-gray-600 border-t border-gray-100 pt-2 mt-2">
                <span>
                  {t('maxTemp')}: {locationData.weather.temp_max ? 
                    `${Math.round(locationData.weather.temp_max)}°C (${Math.round(locationData.weather.temp_max * 9/5 + 32)}°F)` : 
                    'N/A'
                  }
                </span>
                <span>
                  {t('minTemp')}: {locationData.weather.temp_min ? 
                    `${Math.round(locationData.weather.temp_min)}°C (${Math.round(locationData.weather.temp_min * 9/5 + 32)}°F)` : 
                    'N/A'
                  }
                </span>
              </div>
            )}

            {/* 일출/일몰 시간 상세 표시 */}
            {showSunriseSunset && (
              <div className="border-t border-gray-100 pt-2 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center">
                    <Sun className="h-3 w-3 text-yellow-500 mr-1" />
                    <div>
                      <div className="text-xs text-gray-500">{t('sunrise')}</div>
                           <div className="text-xs font-medium text-gray-800">
                             {convertToLocalTime(locationData.sunrise, locationData.location, true)}
                           </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Sunset className="h-3 w-3 text-orange-500 mr-1" />
                    <div>
                      <div className="text-xs text-gray-500">{t('sunset')}</div>
                           <div className="text-xs font-medium text-gray-800">
                             {convertToLocalTime(locationData.sunset, locationData.location, false)}
                           </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className="bg-purple-100 rounded-full p-1.5 mr-2">
            <Cloud className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-purple-800">{t('title')}</h2>
              <span className="text-xs text-purple-600">
                {hasData ? lastUpdated : 'N/A'}
              </span>
            </div>
            {t('subtitle') && <p className="text-xs text-purple-600">{t('subtitle')}</p>}
          </div>
        </div>
        <button
          onClick={updateWeatherData}
          disabled={updating || loading}
          className="p-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          title="오늘 날짜 데이터 수집"
        >
          {updating ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="space-y-2">
        <WeatherCard locationData={weatherData.grandCanyon} showSunriseSunset={true} />
        
        {/* Page City를 가운데 배치 */}
        <div className="flex justify-center">
          <div className="w-full max-w-sm">
            <WeatherCard locationData={weatherData.pageCity} />
          </div>
        </div>
        
        <WeatherCard locationData={weatherData.zionCanyon} showSunriseSunset={true} />
      </div>

      <div className="mt-3 p-2 bg-purple-100 rounded-lg">
        <div className="flex items-start">
          <Clock className="h-3 w-3 text-purple-600 mr-1 mt-0.5" />
          <div className="text-xs text-purple-700">
            <p className="font-medium mb-1">{t('tourNotes.title')}</p>
            <ul className="text-xs space-y-0.5">
                   <li>• {t('tourNotes.sunriseTime')} {convertToLocalTime(weatherData.grandCanyon.sunrise, weatherData.grandCanyon.location, true)}</li>
              <li>• {t('tourNotes.sunsetTime')} {convertToLocalTime(weatherData.zionCanyon.sunset, weatherData.zionCanyon.location, false)}</li>
              <li>• {t('tourNotes.clothing')}</li>
              <li>• {t('tourNotes.seasonal')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
