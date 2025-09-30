'use client'

import { useState, useEffect } from 'react'
import { Sun } from 'lucide-react'

interface SunriseTimeProps {
  className?: string
}

export default function SunriseTime({ className = '' }: SunriseTimeProps) {
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

        // 동적 import로 weatherApi 로드
        const { getCachedSunriseSunsetData } = await import('@/lib/weatherApi')
        
        const today = new Date().toISOString().split('T')[0]
        const data = await getCachedSunriseSunsetData('Grand Canyon South Rim', today)
        
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
  }, [])

  // 환경변수가 없으면 아예 렌더링하지 않음
  if (!hasEnvVars && !loading) {
    return null
  }

  if (loading) {
    return (
      <div className={`flex items-center space-x-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg ${className}`}>
        <Sun className="w-3 h-3 animate-pulse" />
        <span className="text-xs font-mono">--:--</span>
      </div>
    )
  }

  if (!sunriseTime) {
    return null
  }

  return (
    <div className={`flex items-center space-x-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg ${className}`}>
      <Sun className="w-3 h-3" />
      <span className="text-xs font-mono font-medium">
        {sunriseTime}
      </span>
    </div>
  )
}