'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudSnow, 
  CloudLightning, 
  CloudSun, 
  CloudDrizzle, 
  CloudFog,
  MapPin,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sunrise,
  Sunset
} from 'lucide-react'
import { getGoblinTourWeatherData, get7DayWeatherForecast, type LocationWeather } from '@/lib/weatherApi'

interface AdminWeatherWidgetProps {
  className?: string
}

// 날씨 상태에 따른 아이콘 반환 함수
const getWeatherIcon = (weatherMain: string, weatherDescription: string) => {
  const main = weatherMain?.toLowerCase() || ''
  const description = weatherDescription?.toLowerCase() || ''
  
  if (description.includes('thunderstorm') || description.includes('storm')) {
    return <CloudLightning className="w-4 h-4 text-purple-600" />
  }
  if (description.includes('snow') || description.includes('blizzard')) {
    return <CloudSnow className="w-4 h-4 text-blue-400" />
  }
  if (description.includes('rain') || description.includes('shower')) {
    return <CloudRain className="w-4 h-4 text-blue-500" />
  }
  if (description.includes('drizzle')) {
    return <CloudDrizzle className="w-4 h-4 text-blue-400" />
  }
  if (description.includes('fog') || description.includes('mist') || description.includes('haze')) {
    return <CloudFog className="w-4 h-4 text-gray-500" />
  }
  if (description.includes('clear') || description.includes('sunny')) {
    return <Sun className="w-4 h-4 text-yellow-500" />
  }
  if (description.includes('clouds') && description.includes('partly')) {
    return <CloudSun className="w-4 h-4 text-orange-400" />
  }
  if (description.includes('clouds')) {
    return <Cloud className="w-4 h-4 text-gray-500" />
  }
  
  switch (main) {
    case 'thunderstorm':
      return <CloudLightning className="w-4 h-4 text-purple-600" />
    case 'drizzle':
      return <CloudDrizzle className="w-4 h-4 text-blue-400" />
    case 'rain':
      return <CloudRain className="w-4 h-4 text-blue-500" />
    case 'snow':
      return <CloudSnow className="w-4 h-4 text-blue-400" />
    case 'clear':
      return <Sun className="w-4 h-4 text-yellow-500" />
    case 'clouds':
      return <CloudSun className="w-4 h-4 text-orange-400" />
    case 'mist':
    case 'fog':
    case 'haze':
      return <CloudFog className="w-4 h-4 text-gray-500" />
    default:
      return <Cloud className="w-4 h-4 text-gray-500" />
  }
}

// 위치명을 간단하게 표시
const getSimpleLocationName = (location: string) => {
  if (location.includes('Grand Canyon')) {
    return 'Grand Canyon'
  } else if (location.includes('Zion')) {
    return 'Zion Canyon'
  } else if (location.includes('Page')) {
    return 'Page City'
  } else if (location.includes('Las Vegas')) {
    return 'Las Vegas'
  }
  return location
}

// 온도를 화씨로 변환
const convertToFahrenheit = (celsius: number) => {
  return Math.round(celsius * 9/5 + 32)
}

export default function AdminWeatherWidget({ className = '' }: AdminWeatherWidgetProps) {
  const t = useTranslations('weather')
  const [weatherData, setWeatherData] = useState<{
    grandCanyon: LocationWeather
    zionCanyon: LocationWeather
    pageCity: LocationWeather
  } | null>(null)
  const [sevenDayForecast, setSevenDayForecast] = useState<LocationWeather[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<'grandCanyon' | 'zionCanyon' | 'pageCity'>('grandCanyon')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const loadWeatherData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const today = new Date().toISOString().split('T')[0]
      const data = await getGoblinTourWeatherData(today)
      setWeatherData(data)
      
      // 7일간 날씨 예보 로드
      const locationNames = {
        grandCanyon: 'Grand Canyon South Rim',
        zionCanyon: 'Zion Canyon',
        pageCity: 'Page City'
      }
      
      const forecast = await get7DayWeatherForecast(locationNames[currentLocation])
      setSevenDayForecast(forecast)
      
      // 마지막 업데이트 시간 설정
      const now = new Date()
      const lasVegasTime = now.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      setLastUpdated(lasVegasTime)
      
    } catch (err) {
      setError('날씨 데이터 로딩 실패')
      console.error('날씨 데이터 로딩 실패:', err)
    } finally {
      setLoading(false)
    }
  }, [currentLocation])

  const updateWeatherData = async () => {
    try {
      setUpdating(true)
      setError(null)
      
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
        await loadWeatherData()
      } else {
        const errorData = await response.json()
        setError(`업데이트 실패: ${errorData.error}`)
      }
    } catch (err) {
      setError(`업데이트 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    loadWeatherData()
  }, [loadWeatherData])

  // 지역 변경 시 7일간 예보 다시 로드
  useEffect(() => {
    const loadForecastForLocation = async () => {
      const locationNames = {
        grandCanyon: 'Grand Canyon South Rim',
        zionCanyon: 'Zion Canyon',
        pageCity: 'Page City'
      }
      
      try {
        const forecast = await get7DayWeatherForecast(locationNames[currentLocation])
        setSevenDayForecast(forecast)
      } catch (err) {
        console.error('7일간 예보 로딩 실패:', err)
      }
    }
    
    loadForecastForLocation()
  }, [currentLocation])

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">날씨 로딩중...</span>
      </div>
    )
  }

  if (error || !weatherData) {
    return (
      <div className={`flex items-center space-x-2 px-3 py-2 bg-red-50 rounded-lg ${className}`}>
        <Cloud className="w-4 h-4 text-red-500" />
        <span className="text-sm text-red-600">날씨 오류</span>
      </div>
    )
  }

  const currentWeather = weatherData[currentLocation]
  const tempF = currentWeather.weather.temperature ? convertToFahrenheit(currentWeather.weather.temperature) : null

  return (
    <div className={`relative ${className}`}>
      {/* 메인 날씨 표시 */}
      <div className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
        {/* 날씨 아이콘 */}
        {getWeatherIcon(currentWeather.weather.weather_main || '', currentWeather.weather.weather_description || '')}
        
        {/* 위치명과 온도 */}
        <div className="flex items-center space-x-1">
          <MapPin className="w-3 h-3 text-gray-500" />
          <span className="text-sm font-medium text-gray-800">
            {getSimpleLocationName(currentWeather.location)}
          </span>
          {tempF && (
            <span className="text-sm text-gray-600 font-mono">
              {tempF}°F
            </span>
          )}
        </div>
        
        {/* 확장/축소 버튼 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* 확장된 날씨 정보 */}
      {isExpanded && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">7일간 날씨</h3>
            <div className="flex items-center space-x-2">
              {lastUpdated && (
                <span className="text-xs text-gray-500">{lastUpdated}</span>
              )}
              <button
                onClick={updateWeatherData}
                disabled={updating}
                className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                title="날씨 업데이트"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${updating ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* 지역 선택 버튼 */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex space-x-1">
              {[
                { key: 'grandCanyon', label: 'Grand Canyon' },
                { key: 'zionCanyon', label: 'Zion Canyon' },
                { key: 'pageCity', label: 'Page City' }
              ].map((location) => (
                <button
                  key={location.key}
                  onClick={() => setCurrentLocation(location.key as any)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    currentLocation === location.key
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {location.label}
                </button>
              ))}
            </div>
          </div>

          {/* 7일간 날씨 예보 */}
          <div className="p-3">
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">
                {getSimpleLocationName(currentWeather.location)} 7일간 예보
              </h4>
            </div>

            {/* 7일간 날씨 카드들 */}
            <div className="space-y-2">
              {sevenDayForecast.map((dayWeather, index) => {
                const date = new Date()
                date.setDate(date.getDate() + index)
                const dayName = index === 0 ? '오늘' : 
                               index === 1 ? '내일' : 
                               date.toLocaleDateString('ko-KR', { weekday: 'short' })
                const dayDate = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                const dayTempF = dayWeather.weather.temperature ? convertToFahrenheit(dayWeather.weather.temperature) : null
                const dayMaxF = dayWeather.weather.temp_max ? convertToFahrenheit(dayWeather.weather.temp_max) : null
                const dayMinF = dayWeather.weather.temp_min ? convertToFahrenheit(dayWeather.weather.temp_min) : null

                return (
                  <div key={index} className={`p-3 rounded-lg ${
                    index === 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                  }`}>
                    {/* 첫 번째 행: 날짜, 날씨 아이콘, 온도 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        {/* 날짜 정보 */}
                        <div className="text-left">
                          <div className="text-xs font-medium text-gray-800">{dayName}</div>
                          <div className="text-xs text-gray-500">{dayDate}</div>
                        </div>
                        
                        {/* 날씨 아이콘 */}
                        {getWeatherIcon(dayWeather.weather.weather_main || '', dayWeather.weather.weather_description || '')}
                        
                        {/* 날씨 설명 */}
                        <div className="text-xs text-gray-600 max-w-20 truncate">
                          {dayWeather.weather.weather_description || 'N/A'}
                        </div>
                      </div>
                      
                      {/* 온도 정보 */}
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-800">
                          {dayTempF ? `${dayTempF}°F` : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {dayMaxF && dayMinF ? `${dayMinF}°/${dayMaxF}°` : 'N/A'}
                        </div>
                      </div>
                    </div>
                    
                    {/* 두 번째 행: 일출/일몰 시간 */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1">
                        <Sunrise className="w-3 h-3 text-yellow-500" />
                        <span className="text-gray-600">일출:</span>
                        <span className="font-medium text-gray-800">{dayWeather.sunrise || 'N/A'}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Sunset className="w-3 h-3 text-orange-500" />
                        <span className="text-gray-600">일몰:</span>
                        <span className="font-medium text-gray-800">{dayWeather.sunset || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 현재 날씨 상세 정보 (첫 번째 날) */}
            {sevenDayForecast.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-700 mb-2">오늘 추가 정보</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500">습도:</span>
                    <span className="font-medium">{sevenDayForecast[0].weather.humidity ? `${sevenDayForecast[0].weather.humidity}%` : 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500">풍속:</span>
                    <span className="font-medium">{sevenDayForecast[0].weather.wind_speed ? `${sevenDayForecast[0].weather.wind_speed}m/s` : 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500">가시거리:</span>
                    <span className="font-medium">
                      {sevenDayForecast[0].weather.visibility ? `${Math.round(sevenDayForecast[0].weather.visibility / 1000)}km` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500">상태:</span>
                    <span className="font-medium">{sevenDayForecast[0].weather.weather_main || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
