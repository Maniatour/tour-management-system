'use client'

import React, { useState, useEffect } from 'react'
import { Clock, MapPin, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ScheduleItem {
  id: string
  product_id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  title: string
  title_ko: string | null
  title_en: string | null
  description: string | null
  description_ko: string | null
  description_en: string | null
  location: string | null
  location_ko: string | null
  location_en: string | null
  duration_minutes: number | null
  is_break: boolean
  is_meal: boolean
  is_transport: boolean
  transport_type: string | null
  transport_details: string | null
  transport_details_ko: string | null
  transport_details_en: string | null
  notes: string | null
  notes_ko: string | null
  notes_en: string | null
  guide_notes_ko: string | null
  guide_notes_en: string | null
  show_to_customers: boolean
  guide_assignment_type: string
  assigned_guide_1: string | null
  assigned_guide_2: string | null
  assigned_driver: string | null
  assigned_guide_driver_guide: string | null
  assigned_guide_driver_driver: string | null
  created_at: string
  updated_at: string
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
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchSchedules()
  }, [productId, teamType])

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      
      // team_type에 따라 필터링 조건 설정
      let filterCondition = { product_id: productId }
      
      if (teamType === '2guide') {
        // 2가이드 담당 일정: guide_assignment_type이 'two_guides'이거나 'none', 'single_guide'인 경우
        const { data, error } = await supabase
          .from('product_schedules')
          .select(`
            *,
            assigned_guide_1,
            assigned_guide_2,
            assigned_guide_driver_guide,
            assigned_guide_driver_driver
          `)
          .eq('product_id', productId)
          .in('guide_assignment_type', ['two_guides', 'none', 'single_guide'])
          .order('day_number', { ascending: true })
          .order('start_time', { ascending: true })
        
        if (error) throw error
        setSchedules(data || [])
      } else if (teamType === 'guide+driver') {
        // 가이드+드라이버 담당 일정: guide_assignment_type이 'guide_driver'이거나 'none', 'single_guide'인 경우
        const { data, error } = await supabase
          .from('product_schedules')
          .select(`
            *,
            assigned_guide_1,
            assigned_guide_2,
            assigned_guide_driver_guide,
            assigned_guide_driver_driver
          `)
          .eq('product_id', productId)
          .in('guide_assignment_type', ['guide_driver', 'none', 'single_guide'])
          .order('day_number', { ascending: true })
          .order('start_time', { ascending: true })
        
        if (error) throw error
        console.log('가이드+드라이버 스케줄 데이터:', data)
        setSchedules(data || [])
      } else {
        // team_type이 없는 경우 모든 일정 표시
        const { data, error } = await supabase
          .from('product_schedules')
          .select(`
            *,
            assigned_guide_1,
            assigned_guide_2,
            assigned_guide_driver_guide,
            assigned_guide_driver_driver
          `)
          .eq('product_id', productId)
          .order('day_number', { ascending: true })
          .order('start_time', { ascending: true })
        
        if (error) throw error
        setSchedules(data || [])
      }
    } catch (error) {
      console.error('스케줄 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleDayExpansion = (dayNumber: number) => {
    const newExpandedDays = new Set(expandedDays)
    if (newExpandedDays.has(dayNumber)) {
      newExpandedDays.delete(dayNumber)
    } else {
      newExpandedDays.add(dayNumber)
    }
    setExpandedDays(newExpandedDays)
  }

  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.substring(0, 5) // HH:MM 형식으로 변환
  }

  const getLocalizedText = (ko: string | null, en: string | null, fallback: string | null) => {
    if (locale === 'en' && en) return en
    if (ko) return ko
    return fallback || ''
  }

  const getScheduleTypeIcon = (schedule: ScheduleItem) => {
    if (schedule.is_meal) return '🍽️'
    if (schedule.is_transport) return '🚌'
    if (schedule.is_break) return '☕'
    return '📍'
  }

  const getScheduleTypeLabel = (schedule: ScheduleItem) => {
    if (schedule.is_meal) return '식사'
    if (schedule.is_transport) return '이동'
    if (schedule.is_break) return '휴식'
    return '관광'
  }

  const getScheduleBackgroundColor = (schedule: ScheduleItem) => {
    // team_type에 따라 다른 필드로 배경 색깔 결정
    if (teamType === '2guide') {
      // 2가이드일 때는 assigned_guide_1 컬럼 값에 따라 색깔 결정
      if (schedule.assigned_guide_1) {
        return schedule.assigned_guide_1 === 'guide' ? 'bg-green-50 border-green-200' : 
               schedule.assigned_guide_1 === 'assistant' ? 'bg-blue-50 border-blue-200' : 
               'bg-gray-50 border-gray-200'
      }
    } else if (teamType === 'guide+driver') {
      // 가이드+드라이버일 때는 assigned_guide_driver_guide 컬럼 값에 따라 색깔 결정
      if (schedule.assigned_guide_driver_guide) {
        return schedule.assigned_guide_driver_guide === 'guide' ? 'bg-green-50 border-green-200' : 
               schedule.assigned_guide_driver_guide === 'driver' ? 'bg-orange-50 border-orange-200' : 
               'bg-gray-50 border-gray-200'
      }
    }
    
    return 'bg-gray-50 border-gray-200' // 기본 색상 (담당자 미정)
  }

  const getResponsibleLabel = (schedule: ScheduleItem) => {
    console.log('담당자 라벨 계산:', {
      title: schedule.title,
      teamType: teamType,
      guide_assignment_type: schedule.guide_assignment_type,
      assigned_guide_driver_guide: schedule.assigned_guide_driver_guide,
      assigned_guide_driver_driver: schedule.assigned_guide_driver_driver,
      assigned_guide_1: schedule.assigned_guide_1,
      assigned_guide_2: schedule.assigned_guide_2
    })
    
    // team_type에 따라 다른 필드 참조
    if (teamType === '2guide') {
      // 2가이드일 때는 assigned_guide_1 컬럼 값이 담당자
      if (schedule.assigned_guide_1) {
        return schedule.assigned_guide_1 === 'guide' ? '가이드' : 
               schedule.assigned_guide_1 === 'assistant' ? '어시스턴트' : 
               schedule.assigned_guide_1
      }
    } else if (teamType === 'guide+driver') {
      // 가이드+드라이버일 때는 assigned_guide_driver_guide 컬럼 값이 담당자
      if (schedule.assigned_guide_driver_guide) {
        return schedule.assigned_guide_driver_guide === 'guide' ? '가이드' : 
               schedule.assigned_guide_driver_guide === 'driver' ? '드라이버' : 
               schedule.assigned_guide_driver_guide
      }
    }
    
    return '담당자 미정'
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
          {teamType === '2guide' ? '2가이드 담당 일정' : 
           teamType === 'guide+driver' ? '가이드+드라이버 담당 일정' : 
           '투어 일정'}
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
        {teamType === '2guide' ? '2가이드 담당 일정' : 
         teamType === 'guide+driver' ? '가이드+드라이버 담당 일정' : 
         '투어 일정'}
      </h3>
      
      <div className="space-y-4">
        {Object.entries(schedulesByDay)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([dayNumber, daySchedules]) => {
            const dayNum = Number(dayNumber)
            const isExpanded = expandedDays.has(dayNum)
            
            return (
              <div key={dayNum} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleDayExpansion(dayNum)}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
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
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-1">
                    {daySchedules.map((schedule) => (
                      <div key={schedule.id} className={`flex items-center justify-between p-2 rounded-lg border ${getScheduleBackgroundColor(schedule)}`}>
                        {/* 시간 */}
                        <div className="flex-shrink-0 w-20">
                          <div className="flex items-center space-x-1 text-xs text-gray-600">
                            <Clock className="h-3 w-3" />
                            <span>
                              {schedule.start_time ? formatTime(schedule.start_time) : ''}
                              {schedule.end_time ? `-${formatTime(schedule.end_time)}` : ''}
                            </span>
                          </div>
                        </div>
                        
                        {/* 제목 */}
                        <div className="flex-1 px-3">
                          <h5 className="font-medium text-gray-900 text-sm truncate">
                            {getLocalizedText(schedule.title_ko, schedule.title_en, schedule.title)}
                          </h5>
                        </div>
                        
                        {/* 담당자 */}
                        <div className="flex-shrink-0 w-24 text-right">
                          <span className="text-xs text-gray-600 font-medium">
                            {getResponsibleLabel(schedule)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
