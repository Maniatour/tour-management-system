'use client'

import React, { useState, useEffect } from 'react'
import { Sun } from 'lucide-react'

interface TourSunriseTimeProps {
  tourDate?: string
  className?: string
}

export default function TourSunriseTime({ tourDate, className = '' }: TourSunriseTimeProps) {
  const [sunriseTime, setSunriseTime] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasEnvVars, setHasEnvVars] = useState(false)

  useEffect(() => {
    const loadSunriseTime = async () => {
      try {
        // 환경변수 확인
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        
        if (!supabaseUrl || !supabaseKey) {
          console.warn('Supabase environment variables not found, hiding sunrise time component')
          setLoading(false)
          return
        }

        setHasEnvVars(true)

        // 투어 날짜가 없으면 오늘 날짜 사용
        const targetDate = tourDate || new Date().toISOString().split('T')[0]

        // 동적 import로 weatherApi 로드
        const { getCachedSunriseSunsetData } = await import('@/lib/weatherApi')
        
        const data = await getCachedSunriseSunsetData('Grand Canyon South Rim', targetDate)
        
        if (data) {
          setSunriseTime(data.sunrise)
        }
      } catch (error) {
        console.error('일출 시간 로딩 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSunriseTime()
  }, [tourDate])

  // 환경변수가 없으면 아예 렌더링하지 않음
  if (!hasEnvVars && !loading) {
    return null
  }

  if (loading) {
    return (
      <div className={`flex items-center space-x-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg min-w-0 max-w-full overflow-hidden ${className}`}>
        <Sun className="w-3 h-3 animate-pulse flex-shrink-0" />
        <span className="text-xs font-mono truncate">--:--</span>
      </div>
    )
  }

  if (!sunriseTime) {
    return null
  }

  return (
    <div className={`flex items-center space-x-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg min-w-0 max-w-full overflow-hidden ${className}`}>
      <Sun className="w-3 h-3 flex-shrink-0" />
      <span className="text-xs font-mono font-medium truncate block min-w-0">
        {sunriseTime}
      </span>
    </div>
  )
}
