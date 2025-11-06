'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Clock, Calendar, MapPin, Car, Camera, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set())
  const [isExpanded, setIsExpanded] = useState(true)

  // 아코디언 토글 함수
  const toggleScheduleExpansion = (scheduleId: string) => {
    setExpandedSchedules(prev => {
      const newSet = new Set(prev)
      if (newSet.has(scheduleId)) {
        newSet.delete(scheduleId)
      } else {
        newSet.add(scheduleId)
      }
      return newSet
    })
  }

  // 언어별 텍스트 가져오기 함수
  const getText = (koText: string, enText?: string) => {
    return locale === 'ko' ? koText : (enText || koText)
  }

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true)
      
      // 고객 페이지에서는 show_to_customers가 true인 일정만 가져오기
      const { data, error } = await supabase
        .from('product_schedules')
        .select(`
          *,
          two_guide_schedule,
          guide_driver_schedule
        `)
        .eq('product_id', productId)
        .eq('show_to_customers', true)
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

  // 모든 개별 아코디언이 열려있는지 확인
  const schedulesWithDescription = schedules.filter(s => getLocalizedText(s.description_ko, s.description_en, ''))
  const allSchedulesExpanded = schedulesWithDescription.length > 0 && 
    schedulesWithDescription.every(s => expandedSchedules.has(s.id))

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
    // 담당자 색상만 적용 (교통편 특별 색상 제거)
    if (teamType === '2guide') {
      // 2가이드일 때는 two_guide_schedule 컬럼 값에 따라 색깔 결정
      if (schedule.two_guide_schedule) {
        return schedule.two_guide_schedule === 'guide' ? 'bg-red-50 border-red-300 border-2' : 
               schedule.two_guide_schedule === 'assistant' ? 'bg-blue-50 border-blue-300 border-2' : 
               'bg-gray-50 border-gray-200'
      }
    } else if (teamType === 'guide+driver') {
      // 가이드+드라이버일 때는 guide_driver_schedule 컬럼 값에 따라 색깔 결정
      // assistant = 파란색, guide = 빨간색
      if (schedule.guide_driver_schedule) {
        return schedule.guide_driver_schedule === 'guide' ? 'bg-red-50 border-red-300 border-2' : 
               schedule.guide_driver_schedule === 'assistant' ? 'bg-blue-50 border-blue-300 border-2' : 
               'bg-gray-50 border-gray-200'
      }
    }
    
    return 'bg-gray-50 border-gray-200' // 기본 색상
  }

  // 아이콘 선택 함수
  const getTimeIcon = (schedule: ScheduleItem) => {
    if (schedule.is_tour) {
      return <Camera className="h-4 w-4 text-purple-600" />
    } else if (schedule.is_transport) {
      return <Car className="h-4 w-4 text-green-600" />
    } else {
      return <Clock className="h-4 w-4 text-blue-600" />
    }
  }

  const getResponsibleLabels = (schedule: ScheduleItem): LabelInfo[] => {
    const labels: LabelInfo[] = []
    
    // teamType에 따른 라벨 표시
    if (teamType === '2guide' && schedule.two_guide_schedule) {
      const label = schedule.two_guide_schedule === 'guide' ? getText('가이드', 'Guide') : 
                   schedule.two_guide_schedule === 'assistant' ? getText('어시스턴트', 'Assistant') : 
                   schedule.two_guide_schedule
      // guide = 빨간색, assistant = 파란색
      const color = schedule.two_guide_schedule === 'guide' ? 'bg-red-100 text-red-800' : 
                   schedule.two_guide_schedule === 'assistant' ? 'bg-blue-100 text-blue-800' : 
                   'bg-gray-100 text-gray-800'
      labels.push({ text: label, color })
    }
    
    if (teamType === 'guide+driver' && schedule.guide_driver_schedule) {
      const label = schedule.guide_driver_schedule === 'guide' ? getText('가이드', 'Guide') : 
                   schedule.guide_driver_schedule === 'assistant' ? getText('어시스턴트', 'Assistant') : 
                   schedule.guide_driver_schedule
      // guide = 빨간색, assistant = 파란색
      const color = schedule.guide_driver_schedule === 'guide' ? 'bg-red-100 text-red-800' : 
                   schedule.guide_driver_schedule === 'assistant' ? 'bg-blue-100 text-blue-800' : 
                   'bg-gray-100 text-gray-800'
      labels.push({ text: label, color })
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
          {teamType === '2guide' ? getText('2가이드 담당 일정 (제목만 보기)', '2-Guide Assigned Schedules (Title Only)') : 
           teamType === 'guide+driver' ? getText('가이드+드라이버 담당 일정 (제목만 보기)', 'Guide+Driver Assigned Schedules (Title Only)') : 
           getText('투어 일정 (제목만 보기)', 'Tour Schedules (Title Only)')}
        </h3>
        <div className="text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">{getText('등록된 일정이 없습니다.', 'No schedules registered.')}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 아코디언 헤더 */}
      <div 
        className="flex items-center justify-between cursor-pointer mb-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        onClick={() => {
          // 모든 개별 아코디언이 열려있으면 닫기, 아니면 열기
          if (allSchedulesExpanded) {
            // 제목만 보기: 모든 개별 아코디언 닫기
            setExpandedSchedules(new Set())
          } else {
            // 상세보기: 모든 개별 아코디언 열기 (설명이 있는 것만)
            const allScheduleIds = schedules
              .filter(s => getLocalizedText(s.description_ko, s.description_en, ''))
              .map(s => s.id)
            setExpandedSchedules(new Set(allScheduleIds))
          }
        }}
      >
        <h3 className="text-lg font-semibold text-gray-900">
          {teamType === '2guide' ? (
            allSchedulesExpanded 
              ? getText('2가이드 담당 일정 (상세보기)', '2-Guide Assigned Schedules (Detail View)')
              : getText('2가이드 담당 일정 (제목만 보기)', '2-Guide Assigned Schedules (Title Only)')
          ) : teamType === 'guide+driver' ? (
            allSchedulesExpanded 
              ? getText('가이드+드라이버 담당 일정 (상세보기)', 'Guide+Driver Assigned Schedules (Detail View)')
              : getText('가이드+드라이버 담당 일정 (제목만 보기)', 'Guide+Driver Assigned Schedules (Title Only)')
          ) : (
            allSchedulesExpanded 
              ? getText('투어 일정 (상세보기)', 'Tour Schedules (Detail View)')
              : getText('투어 일정 (제목만 보기)', 'Tour Schedules (Title Only)')
          )}
        </h3>
        {allSchedulesExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </div>
      
      {isExpanded && (
        <div className="space-y-4">
        {Object.entries(schedulesByDay)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([dayNumber, daySchedules]) => {
            const dayNum = Number(dayNumber)
            
            return (
              <div key={dayNum} className="space-y-3">
                {/* 일차 헤더 */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                    {dayNum}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {getText(`${dayNum}일차`, `Day ${dayNum}`)}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {getText(`${daySchedules.length}개 일정`, `${daySchedules.length} schedules`)}
                    </p>
                  </div>
                </div>
                
                {/* 일정 목록 - 항상 표시 */}
                <div className="space-y-3">
                  {daySchedules.map((schedule) => {
                    const isExpanded = expandedSchedules.has(schedule.id)
                    const hasDescription = getLocalizedText(schedule.description_ko, schedule.description_en, '')
                    
                    return (
                      <div key={schedule.id} className={`p-2 rounded-lg border ${getScheduleBackgroundColor(schedule)}`}>
                        {/* 클릭 가능한 헤더 영역 */}
                        <div 
                          className={`${hasDescription ? 'cursor-pointer' : ''}`}
                          onClick={() => hasDescription && toggleScheduleExpansion(schedule.id)}
                        >
                          {/* 첫 번째 줄: 시작 종료시간, 소요시간, 제목, 담당자 라벨 */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              {/* 시간 영역 - 고정 너비 */}
                              <div className="flex items-center space-x-2 text-sm text-gray-700 flex-shrink-0 w-28">
                                {getTimeIcon(schedule)}
                                <span className="font-medium whitespace-nowrap">
                                  {schedule.start_time ? formatTime(schedule.start_time) : ''}
                                  {schedule.end_time ? `-${formatTime(schedule.end_time)}` : ''}
                                </span>
                              </div>
                              {/* 소요시간 영역 - 고정 너비 */}
                              <div className="flex-shrink-0 w-16">
                                {schedule.duration_minutes && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {schedule.duration_minutes}
                                  </span>
                                )}
                              </div>
                              <h5 className="font-medium text-gray-900 text-sm flex-1 min-w-0">
                                {getLocalizedText(schedule.title_ko, schedule.title_en, '')}
                              </h5>
                              <div className="flex items-center space-x-2 flex-shrink-0">
                                {getResponsibleLabels(schedule).map((label, index) => (
                                  <span key={index} className={`px-2 py-1 text-xs rounded ${label.color}`}>
                                    {label.text}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {hasDescription && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleScheduleExpansion(schedule.id)
                                }}
                                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors flex-shrink-0 ml-2"
                                title={isExpanded ? '접기' : '펼치기'}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* 설명 영역 (아코디언) */}
                        {hasDescription && isExpanded && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                              {getLocalizedText(schedule.description_ko, schedule.description_en, '')}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
