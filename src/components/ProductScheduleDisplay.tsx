'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, MapPin, Utensils, Car, Coffee, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ScheduleItem {
  id: string
  product_id: string
  day_number: number
  start_time: string
  end_time: string
  title: string
  description: string
  location: string
  duration_minutes: number
  is_break: boolean
  is_meal: boolean
  is_transport: boolean
  transport_type: string
  transport_details: string
  notes: string
}

interface ProductScheduleDisplayProps {
  productId: string
}

export default function ProductScheduleDisplay({ productId }: ProductScheduleDisplayProps) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())

  const fetchSchedules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('product_schedules')
        .select('*')
        .eq('product_id', productId)
        .order('day_number', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Supabase 오류:', error)
        throw new Error(`데이터베이스 오류: ${error.message}`)
      }

      setSchedules(data || [])
      
      // 첫 번째 날짜를 기본으로 확장
      if (data && data.length > 0) {
        const firstDay = data[0].day_number
        setExpandedDays(new Set([firstDay]))
      }
    } catch (error) {
      console.error('일정 로드 오류:', error)
      // 오류가 발생해도 빈 배열로 설정하여 UI가 정상적으로 표시되도록 함
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  const toggleDayExpansion = (dayNumber: number) => {
    const newExpanded = new Set(expandedDays)
    if (newExpanded.has(dayNumber)) {
      newExpanded.delete(dayNumber)
    } else {
      newExpanded.add(dayNumber)
    }
    setExpandedDays(newExpanded)
  }

  const getScheduleIcon = (schedule: ScheduleItem) => {
    if (schedule.is_meal) return <Utensils className="h-4 w-4" />
    if (schedule.is_transport) return <Car className="h-4 w-4" />
    if (schedule.is_break) return <Coffee className="h-4 w-4" />
    return <Calendar className="h-4 w-4" />
  }

  const getScheduleColor = (schedule: ScheduleItem) => {
    if (schedule.is_meal) return 'bg-orange-50 text-orange-800 border-orange-200'
    if (schedule.is_transport) return 'bg-blue-50 text-blue-800 border-blue-200'
    if (schedule.is_break) return 'bg-green-50 text-green-800 border-green-200'
    return 'bg-gray-50 text-gray-800 border-gray-200'
  }

  const formatTime = (time: string) => {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    return `${hours}:${minutes}`
  }

  const groupSchedulesByDay = () => {
    const grouped: { [key: number]: ScheduleItem[] } = {}
    schedules.forEach(schedule => {
      if (!grouped[schedule.day_number]) {
        grouped[schedule.day_number] = []
      }
      grouped[schedule.day_number].push(schedule)
    })
    return grouped
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">일정을 불러오는 중...</span>
      </div>
    )
  }

  if (schedules.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>등록된 일정이 없습니다.</p>
      </div>
    )
  }

  const groupedSchedules = groupSchedulesByDay()

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">투어 일정</h3>
      
      {Object.entries(groupedSchedules).map(([dayNumber, daySchedules]) => {
        const dayNum = parseInt(dayNumber)
        const isExpanded = expandedDays.has(dayNum)
        
        return (
          <div key={dayNumber} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleDayExpansion(dayNum)}
              className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <h4 className="text-lg font-medium text-gray-900">
                {dayNum}일차
              </h4>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">
                  {daySchedules.length}개 일정
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </button>
            
            {isExpanded && (
              <div className="p-6 space-y-4">
                {daySchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`p-4 rounded-lg border ${getScheduleColor(schedule)}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getScheduleIcon(schedule)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h5 className="font-medium text-sm">{schedule.title}</h5>
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                          </div>
                          {schedule.location && (
                            <div className="flex items-center text-xs text-gray-500">
                              <MapPin className="h-3 w-3 mr-1" />
                              {schedule.location}
                            </div>
                          )}
                        </div>
                        
                        {schedule.description && (
                          <p className="text-sm text-gray-600 mb-2">{schedule.description}</p>
                        )}
                        
                        {schedule.transport_details && (
                          <p className="text-xs text-gray-500">
                            <Car className="h-3 w-3 inline mr-1" />
                            {schedule.transport_details}
                          </p>
                        )}
                        
                        {schedule.notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">{schedule.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
