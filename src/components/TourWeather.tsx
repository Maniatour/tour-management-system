'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Sun, Sunset, Cloud, Thermometer, Droplets, Wind, MapPin, Clock, RefreshCw, CloudRain, CloudSnow, CloudLightning, Eye, EyeOff } from 'lucide-react'
import { getGoblinTourWeatherData, type LocationWeather } from '@/lib/weatherApi'

interface TourWeatherProps {
  tourDate?: string
  productId?: string
}

// 날씨 상태에 따른 아이콘 반환 함수
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
const getVisibilityLevel = (visibility: number, t: any) => {
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

  const loadWeatherData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data = await getGoblinTourWeatherData(tourDate || new Date().toISOString().split('T')[0])
      setWeatherData(data)
    } catch (err) {
      setError(t('error'))
      console.error('날씨 데이터 로딩 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateWeatherData = async () => {
    try {
      setUpdating(true)
      setError(null)
      
      // 날씨 데이터만 업데이트 (일출/일몰은 제외)
      const response = await fetch('/api/weather-collector', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          date: tourDate || new Date().toISOString().split('T')[0],
          updateWeatherOnly: true // 날씨만 업데이트
        })
      })

      if (response.ok) {
        // 데이터 수집 후 다시 로드
        await loadWeatherData()
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
  }, [tourDate, productId])

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
  }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <MapPin className="h-3 w-3 text-gray-500 mr-1" />
          <h3 className="font-medium text-gray-800 text-xs">{locationData.location}</h3>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-2">
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
        <div className="flex items-center text-xs text-gray-600 capitalize truncate col-span-2">
          {getWeatherIcon(locationData.weather.weather_main || '', locationData.weather.weather_description || '')}
          <span className="ml-1">{locationData.weather.weather_description || 'N/A'}</span>
        </div>
        {/* 최고/최저 기온 표시 */}
        {(locationData.weather.temp_max !== null || locationData.weather.temp_min !== null) && (
          <div className="col-span-2 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100 pt-1 mt-1">
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
      </div>

      {showSunriseSunset && (
        <div className="border-t border-gray-100 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center">
              <Sun className="h-3 w-3 text-yellow-500 mr-1" />
              <div>
                <div className="text-xs text-gray-500">{t('sunrise')}</div>
                <div className="text-xs font-medium text-gray-800">
                  {locationData.sunrise}
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <Sunset className="h-3 w-3 text-orange-500 mr-1" />
              <div>
                <div className="text-xs text-gray-500">{t('sunset')}</div>
                <div className="text-xs font-medium text-gray-800">
                  {locationData.sunset}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className="bg-purple-100 rounded-full p-1.5 mr-2">
            <Cloud className="h-4 w-4 text-purple-600" />
          </div>
               <div>
                 <h2 className="text-sm font-semibold text-purple-800">{t('title')}</h2>
                 <p className="text-xs text-purple-600">{t('subtitle')}</p>
               </div>
        </div>
        <button
          onClick={updateWeatherData}
          disabled={updating || loading}
          className="p-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          title={t('update')}
        >
          {updating ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </button>
      </div>

      <div className="space-y-2">
        <WeatherCard locationData={weatherData.grandCanyon} showSunriseSunset={true} />
        <WeatherCard locationData={weatherData.zionCanyon} showSunriseSunset={true} />
        <WeatherCard locationData={weatherData.pageCity} />
      </div>

      <div className="mt-3 p-2 bg-purple-100 rounded-lg">
        <div className="flex items-start">
          <Clock className="h-3 w-3 text-purple-600 mr-1 mt-0.5" />
          <div className="text-xs text-purple-700">
            <p className="font-medium mb-1">{t('tourNotes.title')}</p>
            <ul className="text-xs space-y-0.5">
              <li>• {t('tourNotes.sunriseTime')} {weatherData.grandCanyon.sunrise}</li>
              <li>• {t('tourNotes.sunsetTime')} {weatherData.zionCanyon.sunset}</li>
              <li>• {t('tourNotes.clothing')}</li>
              <li>• {t('tourNotes.seasonal')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
