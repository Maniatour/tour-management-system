'use client'

import { useState, useEffect } from 'react'
import { Sun } from 'lucide-react'

function formatSunriseDisplay(sunriseTime: string, compact: boolean): string {
  if (!compact) return sunriseTime
  const parts = sunriseTime.trim().split(':')
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`
  return sunriseTime
}

interface TourSunriseTimeProps {
  tourDate?: string
  className?: string
  /** 모바일 툴바용: HH:MM + 작은 패딩 */
  compact?: boolean
}

export default function TourSunriseTime({
  tourDate,
  className = '',
  compact = false,
}: TourSunriseTimeProps) {
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

  const shellClass = compact
    ? `inline-flex h-7 items-center gap-0.5 rounded-md bg-yellow-50 px-1.5 text-yellow-700 ${className}`
    : `flex items-center space-x-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg min-w-0 max-w-full overflow-hidden ${className}`

  if (loading) {
    return (
      <div className={shellClass}>
        <Sun className="h-3 w-3 flex-shrink-0 animate-pulse" />
        <span className={`font-mono truncate ${compact ? 'text-[11px] leading-none' : 'text-xs'}`}>
          --:--
        </span>
      </div>
    )
  }

  if (!sunriseTime) {
    return null
  }

  return (
    <div className={shellClass}>
      <Sun className="h-3 w-3 flex-shrink-0" />
      <span
        className={`font-mono font-medium truncate ${compact ? 'text-[11px] leading-none' : 'text-xs block min-w-0'}`}
      >
        {formatSunriseDisplay(sunriseTime, compact)}
      </span>
    </div>
  )
}
