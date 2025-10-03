'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Clock, Calendar, MapPin, Car } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ScheduleItem {
  id: string
  product_id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  is_break: boolean | null
  is_meal: boolean | null
  is_transport: boolean | null
  is_tour: boolean | null
  latitude: number | null
  longitude: number | null
  show_to_customers: boolean | null
  title_ko: string | null
  title_en: string | null
  description_ko: string | null
  description_en: string | null
  location_ko: string | null
  location_en: string | null
  guide_notes_ko: string | null
  guide_notes_en: string | null
  thumbnail_url: string | null
  order_index: number | null
  two_guide_schedule: string | null
  guide_driver_schedule: string | null
  created_at: string | null
  updated_at: string | null
}

interface LabelInfo {
  text: string
  color: string
}

interface TourScheduleSectionProps {
  productId: string
  teamType: 'guide+driver' | '2guide' | null
  locale?: string
}

export default function TourScheduleSection({ 
  productId, 
  teamType, 
  locale = 'ko' 
}: TourScheduleSectionProps) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true)
      
      // 모든 일정을 가져오되, 담당 정보는 라벨로 표시
      const { data, error } = await supabase
        .from('product_schedules')
        .select(`
          *,
          two_guide_schedule,
          guide_driver_schedule
        `)
        .eq('product_id', productId)
        .order('day_number', { ascending: true })
        .order('order_index', { ascending: true })
        .order('start_time', { ascending: true })
      
      if (error) throw error
      setSchedules(data || [])
    } catch (error) {
      console.error('스케줄 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])


  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.substring(0, 5) // HH:MM 형식으로 변환
  }

  const getLocalizedText = (ko: string | null, en: string | null, fallback: string | null) => {
    if (locale === 'en' && en) return en
    if (ko) return ko
    return fallback || ''
  }

  // 구글맵 네비게이션 함수
  const openGoogleMapsNavigation = (schedule: ScheduleItem) => {
    if (schedule.latitude && schedule.longitude) {
      // 구글맵 네비게이션 URL 생성
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${schedule.latitude},${schedule.longitude}`
      window.open(googleMapsUrl, '_blank')
    } else if (getLocalizedText(schedule.location_ko, schedule.location_en, '')) {
      // 좌표가 없으면 주소로 검색
      const address = encodeURIComponent(getLocalizedText(schedule.location_ko, schedule.location_en, ''))
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${address}`
      window.open(googleMapsUrl, '_blank')
    }
  }


  const getScheduleBackgroundColor = (schedule: ScheduleItem) => {
    // 교통편 일정인 경우 눈에 띄는 색상 사용
    if (schedule.is_transport) {
      return 'bg-purple-50 border-purple-300 border-2' // 교통편 - 보라색 테두리 강조
    }
    
    // team_type에 따라 다른 필드로 배경 색깔 결정
    if (teamType === '2guide') {
      // 2가이드일 때는 two_guide_schedule 컬럼 값에 따라 색깔 결정
      if (schedule.two_guide_schedule) {
        return schedule.two_guide_schedule === 'guide' ? 'bg-green-50 border-green-200' : 
               schedule.two_guide_schedule === 'assistant' ? 'bg-blue-50 border-blue-200' : 
               'bg-gray-50 border-gray-200'
      }
    } else if (teamType === 'guide+driver') {
      // 가이드+드라이버일 때는 guide_driver_schedule 컬럼 값에 따라 색깔 결정
      if (schedule.guide_driver_schedule) {
        return schedule.guide_driver_schedule === 'guide' ? 'bg-green-50 border-green-200' : 
               schedule.guide_driver_schedule === 'assistant' ? 'bg-orange-50 border-orange-200' : 
               'bg-gray-50 border-gray-200'
      }
    }
    
    return 'bg-gray-50 border-gray-200' // 기본 색상 (담당자 미정)
  }

  const getResponsibleLabels = (schedule: ScheduleItem): LabelInfo[] => {
    const labels: LabelInfo[] = []
    
    // teamType에 따른 라벨 표시
    if (teamType === '2guide' && schedule.two_guide_schedule) {
      const label = schedule.two_guide_schedule === 'guide' ? '가이드' : 
                   schedule.two_guide_schedule === 'assistant' ? '어시스턴트' : 
                   schedule.two_guide_schedule
      labels.push({ text: label, color: 'bg-green-100 text-green-800' })
    }
    
    if (teamType === 'guide+driver' && schedule.guide_driver_schedule) {
      const label = schedule.guide_driver_schedule === 'guide' ? '가이드' : 
                   schedule.guide_driver_schedule === 'driver' ? '드라이버' : 
                   schedule.guide_driver_schedule
      labels.push({ text: label, color: 'bg-blue-100 text-blue-800' })
    }
    
    return labels
  }

  const generateRouteUrl = (dayNumber: number) => {
    // 해당 일차의 모든 일정에서 위치 정보 추출 (좌표 우선, 텍스트 대체)
    const daySchedules = schedulesByDay[dayNumber] || []
    const locations = daySchedules
      .filter(schedule => {
        // 좌표가 있거나 위치 텍스트가 있는 일정만 포함
        return (schedule.latitude && schedule.longitude) || 
               getLocalizedText(schedule.location_ko, schedule.location_en, '')
      })
      .map(schedule => {
        // 좌표가 있으면 좌표를 우선 사용
        if (schedule.latitude && schedule.longitude) {
          return `${schedule.latitude},${schedule.longitude}`
        } 
        // 좌표가 없으면 location_ko 컬럼 우선
        else if (schedule.location_ko) {
          return schedule.location_ko
        }
        // location_ko도 없으면 location_en 사용
        else if (schedule.location_en) {
          return schedule.location_en
        }
        return null
      })
      .filter(location => location && location.trim() !== '')
    
    if (locations.length === 0) return null
    
    // 구글맵 경유지 URL 생성
    const waypoints = locations.slice(1, -1) // 첫 번째와 마지막을 제외한 중간 지점들
    const destination = locations[locations.length - 1] // 마지막 지점이 목적지
    const origin = locations[0] // 첫 번째 지점이 출발지
    
    let url = `https://www.google.com/maps/dir/?api=1`
    
    if (origin) {
      url += `&origin=${encodeURIComponent(origin)}`
    }
    
    if (destination) {
      url += `&destination=${encodeURIComponent(destination)}`
    }
    
    if (waypoints.length > 0) {
      url += `&waypoints=${waypoints.map(wp => wp ? encodeURIComponent(wp) : '').filter(wp => wp).join('|')}`
    }
    
    return url
  }

  // 일차별로 그룹화
  const schedulesByDay = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.day_number]) {
      acc[schedule.day_number] = []
    }
    acc[schedule.day_number].push(schedule)
    return acc
  }, {} as Record<number, ScheduleItem[]>)

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (schedules.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {teamType === '2guide' ? '2가이드 담당 일정 (전체)' : 
           teamType === 'guide+driver' ? '가이드+드라이버 담당 일정 (전체)' : 
           '투어 일정 (전체)'}
        </h3>
        <div className="text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">등록된 일정이 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {teamType === '2guide' ? '2가이드 담당 일정 (전체)' : 
         teamType === 'guide+driver' ? '가이드+드라이버 담당 일정 (전체)' : 
         '투어 일정 (전체)'}
      </h3>
      
      <div className="space-y-4">
        {Object.entries(schedulesByDay)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([dayNumber, daySchedules]) => {
            const dayNum = Number(dayNumber)
            
            return (
              <div key={dayNum} className="space-y-3">
                {/* 일차 헤더 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                      {dayNum}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {dayNum}일차
                      </h4>
                      <p className="text-sm text-gray-500">
                        {daySchedules.length}개 일정
                      </p>
                    </div>
                  </div>
                  {generateRouteUrl(dayNum) && (
                    <a
                      href={generateRouteUrl(dayNum)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                      title="전체 일정 경로 보기"
                    >
                      <Car className="w-4 h-4" />
                    </a>
                  )}
                </div>
                
                {/* 일정 목록 - 항상 표시 */}
                <div className="space-y-3">
                  {daySchedules.map((schedule) => (
                    <div key={schedule.id} className={`p-3 rounded-lg border ${getScheduleBackgroundColor(schedule)}`}>
                      {/* 첫 번째 줄: 시간, 소요시간, 담당자 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2 text-lg text-gray-700">
                            <Clock className="h-5 w-5" />
                            <span className="font-bold">
                              {schedule.start_time ? formatTime(schedule.start_time) : ''}
                              {schedule.end_time ? `-${formatTime(schedule.end_time)}` : ''}
                            </span>
                          </div>
                          {schedule.duration_minutes && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              <Clock className="w-3 h-3 mr-1" />
                              {schedule.duration_minutes}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {getResponsibleLabels(schedule).map((label, index) => (
                            <span key={index} className={`px-2 py-1 text-xs rounded ${label.color}`}>
                              {label.text}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {/* 두 번째 줄: 제목 */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between">
                          <h5 className="font-semibold text-gray-900 text-base">
                            {getLocalizedText(schedule.title_ko, schedule.title_en, '')}
                          </h5>
                          {(schedule.latitude && schedule.longitude) || getLocalizedText(schedule.location_ko, schedule.location_en, '') ? (
                            <button
                              onClick={() => openGoogleMapsNavigation(schedule)}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                              title="구글맵에서 네비게이션 열기"
                            >
                              <MapPin className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      
                      {/* 세 번째 줄: 설명 */}
                      {getLocalizedText(schedule.description_ko, schedule.description_en, '') && (
                        <div>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {getLocalizedText(schedule.description_ko, schedule.description_en, '')}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
