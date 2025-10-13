'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Calendar, Plus, Eye, Users, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import TableScheduleAdd from '../TableScheduleAdd'

interface ScheduleItem {
  id?: string
  product_id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  is_break: boolean | null
  is_meal: boolean | null
  is_transport: boolean | null
  is_tour: boolean | null
  latitude?: number | null
  longitude?: number | null
  show_to_customers: boolean | null
  title_ko?: string | null
  title_en?: string | null
  description_ko?: string | null
  description_en?: string | null
  location_ko?: string | null
  location_en?: string | null
  guide_notes_ko?: string | null
  guide_notes_en?: string | null
  thumbnail_url?: string | null
  order_index?: number | null
  two_guide_schedule?: string | null
  guide_driver_schedule?: string | null
}

interface ProductScheduleTabProps {
  productId: string
  isNewProduct: boolean
  formData: unknown
  setFormData: (data: unknown) => void
  teamType?: 'guide+driver' | '2guide' | null
}

export default function ProductScheduleTab({
  productId,
  isNewProduct,
  teamType
}: ProductScheduleTabProps) {
  
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showTableAdd, setShowTableAdd] = useState(false)
  const [tableSchedules, setTableSchedules] = useState<ScheduleItem[]>([])
  const [saving, setSaving] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Array<{email: string, name_ko: string, position: string}>>([])
  const [viewMode, setViewMode] = useState<'customer' | 'guide'>('customer')
  const [language, setLanguage] = useState<'ko' | 'en'>('ko')

  // 언어별 텍스트 가져오기 함수
  const getText = (koText: string, enText?: string) => {
    return language === 'ko' ? koText : (enText || koText)
  }

  // 구글맵 네비게이션 함수
  const openGoogleMapsNavigation = (schedule: ScheduleItem) => {
    if (schedule.latitude && schedule.longitude) {
      // 구글맵 네비게이션 URL 생성
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${schedule.latitude},${schedule.longitude}`
      window.open(googleMapsUrl, '_blank')
    } else if (getScheduleText(schedule, 'location')) {
      // 좌표가 없으면 주소로 검색
      const address = encodeURIComponent(getScheduleText(schedule, 'location'))
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${address}`
      window.open(googleMapsUrl, '_blank')
    }
  }

  // 일정의 언어별 텍스트 가져오기
  const getScheduleText = (schedule: ScheduleItem, field: 'title' | 'description' | 'location' | 'guide_notes') => {
    if (language === 'ko') {
      switch (field) {
        case 'title': return schedule.title_ko || ''
        case 'description': return schedule.description_ko || ''
        case 'location': return schedule.location_ko || ''
        case 'guide_notes': return schedule.guide_notes_ko || ''
        default: return ''
      }
    } else {
      switch (field) {
        case 'title': return schedule.title_en || schedule.title_ko || ''
        case 'description': return schedule.description_en || schedule.description_ko || ''
        case 'location': return schedule.location_en || schedule.location_ko || ''
        case 'guide_notes': return schedule.guide_notes_en || schedule.guide_notes_ko || ''
        default: return ''
      }
    }
  }

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('product_schedules')
        .select('*')
        .eq('product_id', productId)
        .order('day_number', { ascending: true })
        .order('order_index', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        console.error('일정 로드 오류:', error)
        return
      }

      setSchedules(data || [])
    } catch (error) {
      console.error('일정 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }, [productId])

  const fetchTeamMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, position')
        .eq('is_active', true)
        .order('name_ko')

      if (error) {
        console.error('팀 멤버 로드 오류:', error)
        return
      }

      setTeamMembers(data || [])
    } catch (error) {
      console.error('팀 멤버 로드 오류:', error)
    }
  }, [])

  useEffect(() => {
    if (!isNewProduct) {
      fetchSchedules()
      fetchTeamMembers()
    }
  }, [productId, isNewProduct, fetchSchedules, fetchTeamMembers])

  const handleAddSchedule = () => {
    // 기존 데이터를 tableSchedules에 로드
    setTableSchedules([...schedules])
    setShowTableAdd(true)
  }

  // 뷰 모드에 따라 필터링된 일정 반환
  const getFilteredSchedules = () => {
    if (viewMode === 'customer') {
      // 고객뷰: 고객에게 표시 옵션이 선택된 일정만
      return schedules.filter(schedule => schedule.show_to_customers)
    }
    // 가이드뷰: 모든 일정
    return schedules
  }

  // 일차별로 그룹화하는 함수
  const groupSchedulesByDay = (scheduleList: ScheduleItem[]) => {
    const grouped = scheduleList.reduce((acc, schedule) => {
      const day = schedule.day_number
      if (!acc[day]) {
        acc[day] = []
      }
      acc[day].push(schedule)
      return acc
    }, {} as Record<number, ScheduleItem[]>)

    // 일차 순으로 정렬
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map(day => ({ day, schedules: grouped[day] }))
  }

  // 통계 계산 함수 (시간이 있는 일정만 계산)
  const getScheduleStats = () => {
    let twoGuidesGuideTransport = 0
    let twoGuidesGuideTour = 0
    let twoGuidesGuideTotal = 0
    let twoGuidesAssistantTransport = 0
    let twoGuidesAssistantTour = 0
    let twoGuidesAssistantTotal = 0
    let guideDriverGuideTransport = 0
    let guideDriverGuideTour = 0
    let guideDriverGuideTotal = 0
    let guideDriverDriverTransport = 0
    let guideDriverDriverTour = 0
    let guideDriverDriverTotal = 0

    schedules.forEach(schedule => {
      // 시간이 있는 일정만 통계에 포함
      if (!schedule.duration_minutes || schedule.duration_minutes <= 0) {
        return
      }
      
      const duration = schedule.duration_minutes
      
      // 2가이드에서 가이드가 선택된 경우
      if (schedule.two_guide_schedule === 'guide') {
        twoGuidesGuideTotal += duration
        if (schedule.is_transport) twoGuidesGuideTransport += duration
        if (schedule.is_tour) twoGuidesGuideTour += duration
      }
      // 2가이드에서 어시스턴트가 선택된 경우
      else if (schedule.two_guide_schedule === 'assistant') {
        twoGuidesAssistantTotal += duration
        if (schedule.is_transport) twoGuidesAssistantTransport += duration
        if (schedule.is_tour) twoGuidesAssistantTour += duration
      }
      
      // 가이드+드라이버에서 가이드가 선택된 경우
      if (schedule.guide_driver_schedule === 'guide') {
        guideDriverGuideTotal += duration
        if (schedule.is_transport) guideDriverGuideTransport += duration
        if (schedule.is_tour) guideDriverGuideTour += duration
      }
      // 가이드+드라이버에서 드라이버가 선택된 경우
      else if (schedule.guide_driver_schedule === 'assistant') {
        guideDriverDriverTotal += duration
        if (schedule.is_transport) guideDriverDriverTransport += duration
        if (schedule.is_tour) guideDriverDriverTour += duration
      }
    })

    const formatTime = (minutes: number) => {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      
      if (hours > 0 && mins > 0) {
        return `${hours}${getText('시간', 'h')} ${mins}${getText('분', 'min')}`
      } else if (hours > 0) {
        return `${hours}${getText('시간', 'h')}`
      } else {
        return `${mins}${getText('분', 'min')}`
      }
    }

    return {
      twoGuidesGuide: {
        transport: formatTime(twoGuidesGuideTransport),
        tour: formatTime(twoGuidesGuideTour),
        total: formatTime(twoGuidesGuideTotal)
      },
      twoGuidesAssistant: {
        transport: formatTime(twoGuidesAssistantTransport),
        tour: formatTime(twoGuidesAssistantTour),
        total: formatTime(twoGuidesAssistantTotal)
      },
      guideDriverGuide: {
        transport: formatTime(guideDriverGuideTransport),
        tour: formatTime(guideDriverGuideTour),
        total: formatTime(guideDriverGuideTotal)
      },
      guideDriverDriver: {
        transport: formatTime(guideDriverDriverTransport),
        tour: formatTime(guideDriverDriverTour),
        total: formatTime(guideDriverDriverTotal)
      }
    }
  }




  const handleSaveTableSchedules = useCallback(async () => {
    try {
      setSaving(true)
      
      // 기존 일정들과 새 일정들을 비교하여 업데이트/삭제/추가 처리
      const existingScheduleIds = schedules.map(s => s.id).filter(Boolean)
      const newScheduleIds = tableSchedules.map(s => s.id).filter(Boolean)
      
      // 삭제할 일정들 (기존에 있지만 새 목록에 없는 것들)
      const schedulesToDelete = existingScheduleIds.filter(id => !newScheduleIds.includes(id))
      
      // 삭제 실행
      if (schedulesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('product_schedules')
          .delete()
          .in('id', schedulesToDelete)

        if (deleteError) {
          console.error('일정 삭제 오류:', deleteError)
          return
        }
      }
      
      // 업데이트할 일정들 (기존에 있던 것들)
      const schedulesToUpdate = tableSchedules.filter(schedule => schedule.id && existingScheduleIds.includes(schedule.id))
      
      // 업데이트 실행
      for (const schedule of schedulesToUpdate) {
        const { id, ...scheduleData } = schedule
        const { error: updateError } = await supabase
          .from('product_schedules')
          .update({
            ...scheduleData,
            product_id: productId,
            is_tour: schedule.is_tour ?? false
          })
          .eq('id', id)

        if (updateError) {
          console.error('일정 업데이트 오류:', updateError)
          return
        }
      }
      
      // 추가할 일정들 (새로 생성된 것들)
      const schedulesToInsert = tableSchedules.filter(schedule => !schedule.id)
      
      if (schedulesToInsert.length > 0) {
        const insertData = schedulesToInsert.map(schedule => ({
          ...schedule,
          product_id: productId,
          is_tour: schedule.is_tour ?? false
        }))

        const { error: insertError } = await supabase
          .from('product_schedules')
          .insert(insertData)

        if (insertError) {
          console.error('일정 추가 오류:', insertError)
          return
        }
      }
      
      setTableSchedules([])
      setShowTableAdd(false)
      await fetchSchedules()
    } catch (error) {
      console.error('테이블 일정 저장 오류:', error)
    } finally {
      setSaving(false)
    }
  }, [tableSchedules, schedules, productId, fetchSchedules])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          {getText('투어 일정 관리', 'Tour Schedule Management')}
        </h3>
        <div className="flex items-center space-x-4">
          {/* 언어 전환 버튼 */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setLanguage('ko')}
              className={`flex items-center px-3 py-2 rounded-lg text-sm ${
                language === 'ko'
                  ? 'bg-white text-gray-900 shadow-sm border'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="한국어"
            >
              🇰🇷
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`flex items-center px-3 py-2 rounded-lg text-sm ${
                language === 'en'
                  ? 'bg-white text-gray-900 shadow-sm border'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="English"
            >
              🇺🇸
            </button>
          </div>
          
          {/* 뷰 모드 토글 */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
              onClick={() => setViewMode('customer')}
            className={`flex items-center px-3 py-2 rounded-lg text-sm ${
                viewMode === 'customer'
                  ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
              <Eye className="h-4 w-4 mr-1" />
              {getText('고객뷰', 'Customer View')}
          </button>
          <button
            type="button"
              onClick={() => setViewMode('guide')}
            className={`flex items-center px-3 py-2 rounded-lg text-sm ${
                viewMode === 'guide'
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="h-4 w-4 mr-1" />
              {getText('가이드뷰', 'Guide View')}
            </button>
          </div>
          
          <button
            type="button"
            onClick={handleAddSchedule}
            disabled={isNewProduct}
            className="flex items-center px-3 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 mr-1" />
            테이블로 추가/수정
          </button>
        </div>
      </div>

      {/* 일정 목록 */}
      <div className="space-y-6">
        {viewMode === 'customer' ? (
          // 고객뷰
          <div className="space-y-4">
            {groupSchedulesByDay(getFilteredSchedules()).map(({ day, schedules }) => (
              <div key={day} className="space-y-2">
                <h5 className="text-md font-semibold text-gray-800 mb-2">{day}{getText('일차', ' Day')}</h5>
                <div className="space-y-2">
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        {/* 썸네일 */}
                        <div className="w-12 h-8 flex-shrink-0 flex items-center justify-center">
                          {schedule.thumbnail_url ? (
                            <Image 
                              src={schedule.thumbnail_url} 
                              alt="썸네일" 
                              width={48}
                              height={32}
                              className="w-full h-full object-cover rounded border"
                              style={{ width: 'auto', height: 'auto' }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 rounded border flex items-center justify-center">
                              <span className="text-xs text-gray-400">이미지</span>
                            </div>
                          )}
                        </div>
                        
                        {/* 시간 */}
                        <div className="w-28 flex-shrink-0 flex items-center justify-center">
                          <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                            {schedule.start_time ? schedule.start_time.substring(0, 5) : ''}
                            {schedule.end_time && ` - ${schedule.end_time.substring(0, 5)}`}
                          </span>
                        </div>
                        
                        {/* 소요시간 */}
                        <div className="w-16 flex-shrink-0 flex items-center justify-center">
                          <span className="text-sm text-gray-500">
                            {schedule.duration_minutes && schedule.duration_minutes > 0 ? `${schedule.duration_minutes}분` : ''}
                          </span>
                        </div>
                        
                        {/* 제목과 설명 */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm leading-tight">
                            {getScheduleText(schedule, 'title')}
                          </div>
                          {getScheduleText(schedule, 'description') && (
                            <div className="text-xs text-gray-600 mt-1 whitespace-pre-line">
                              {getScheduleText(schedule, 'description')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {getFilteredSchedules().length === 0 && (
              <div className="text-center py-8 text-gray-500">
                고객에게 표시할 일정이 없습니다.
              </div>
            )}
          </div>
        ) : (
          // 가이드뷰
          <div className="space-y-6">
            {/* 통계 섹션 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">📊 {getText('담당별 시간 통계', 'Time Statistics by Assignment')}</h4>
              
              {/* 2열 레이아웃 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 2가이드 박스 */}
                <div className="bg-white border border-green-200 rounded-lg p-4">
                  <h5 className="text-md font-semibold text-green-800 mb-3 flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    {getText('2가이드 담당', '2 Guides Assigned')}
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    {/* 가이드 */}
                    <div className="space-y-2">
                      <h6 className="text-sm font-medium text-green-800 text-center">{getText('가이드', 'Guide')}</h6>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-green-700">{getText('운전시간', 'Drive Time')}</span>
                          <span className="text-sm font-bold text-green-900">{getScheduleStats().twoGuidesGuide.transport}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-green-700">{getText('관광시간', 'Tour Time')}</span>
                          <span className="text-sm font-bold text-green-900">{getScheduleStats().twoGuidesGuide.tour}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-green-200">
                          <span className="text-xs font-medium text-green-800">{getText('총시간', 'Total Time')}</span>
                          <span className="text-sm font-bold text-green-900">{getScheduleStats().twoGuidesGuide.total}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 어시스턴트 */}
                    <div className="space-y-2">
                      <h6 className="text-sm font-medium text-green-800 text-center">{getText('어시스턴트', 'Assistant')}</h6>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-green-700">{getText('운전시간', 'Drive Time')}</span>
                          <span className="text-sm font-bold text-green-900">{getScheduleStats().twoGuidesAssistant.transport}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-green-700">{getText('관광시간', 'Tour Time')}</span>
                          <span className="text-sm font-bold text-green-900">{getScheduleStats().twoGuidesAssistant.tour}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-green-200">
                          <span className="text-xs font-medium text-green-800">{getText('총시간', 'Total Time')}</span>
                          <span className="text-sm font-bold text-green-900">{getScheduleStats().twoGuidesAssistant.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 가이드+드라이버 박스 */}
                <div className="bg-white border border-blue-200 rounded-lg p-4">
                  <h5 className="text-md font-semibold text-blue-800 mb-3 flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    {getText('가이드+드라이버 담당', 'Guide+Driver Assigned')}
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    {/* 가이드 */}
                    <div className="space-y-2">
                      <h6 className="text-sm font-medium text-blue-800 text-center">{getText('가이드', 'Guide')}</h6>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-blue-700">{getText('운전시간', 'Drive Time')}</span>
                          <span className="text-sm font-bold text-blue-900">{getScheduleStats().guideDriverGuide.transport}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-blue-700">{getText('관광시간', 'Tour Time')}</span>
                          <span className="text-sm font-bold text-blue-900">{getScheduleStats().guideDriverGuide.tour}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-blue-200">
                          <span className="text-xs font-medium text-blue-800">{getText('총시간', 'Total Time')}</span>
                          <span className="text-sm font-bold text-blue-900">{getScheduleStats().guideDriverGuide.total}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 드라이버 */}
                    <div className="space-y-2">
                      <h6 className="text-sm font-medium text-orange-800 text-center">{getText('드라이버', 'Driver')}</h6>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-orange-700">{getText('운전시간', 'Drive Time')}</span>
                          <span className="text-sm font-bold text-orange-900">{getScheduleStats().guideDriverDriver.transport}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-orange-700">{getText('관광시간', 'Tour Time')}</span>
                          <span className="text-sm font-bold text-orange-900">{getScheduleStats().guideDriverDriver.tour}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-orange-200">
                          <span className="text-xs font-medium text-orange-800">{getText('총시간', 'Total Time')}</span>
                          <span className="text-sm font-bold text-orange-900">{getScheduleStats().guideDriverDriver.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 담당별 일정 - 2열 레이아웃 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 2가이드 담당 일정 */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-green-600" />
                  {getText('2가이드 담당 일정', '2 Guides Assigned Schedules')}
                </h4>
      <div className="space-y-4">
                  {groupSchedulesByDay(schedules).map(({ day, schedules }) => (
                    <div key={day} className="space-y-2">
                      <h5 className="text-md font-semibold text-gray-800 mb-2">{day}{getText('일차', ' Day')}</h5>
                      <div className="space-y-2">
        {schedules.map((schedule) => (
                          <div key={schedule.id} className="bg-white border border-gray-200 rounded-lg p-3">
                            {/* 1번째 줄: 썸네일, 출발-도착(소요) 제목 가이드담당 | 이동시간 */}
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center space-x-3">
                                {/* 썸네일 */}
                                <div className="w-12 h-8 flex-shrink-0">
                                  {schedule.thumbnail_url ? (
                                    <Image 
                                      src={schedule.thumbnail_url} 
                                      alt="썸네일" 
                                      width={48}
                                      height={32}
                                      className="w-full h-full object-cover rounded border"
                                      style={{ width: 'auto', height: 'auto' }}
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-100 rounded border flex items-center justify-center">
                                      <span className="text-xs text-gray-400">이미지</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-3">
                                  <div className="w-20 flex-shrink-0">
                                    <span className="text-sm text-gray-600 whitespace-nowrap">
                                      {schedule.start_time ? schedule.start_time.substring(0, 5) : ''}
                                      {schedule.end_time && ` - ${schedule.end_time.substring(0, 5)}`}
                                    </span>
                                  </div>
                                  <div className="w-16 flex-shrink-0 text-right">
                                    <span className="text-sm text-gray-500">
                                      {schedule.duration_minutes && schedule.duration_minutes > 0 ? `${schedule.duration_minutes}${getText('분', 'min')}` : ''}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-medium text-gray-900">
                                  {getScheduleText(schedule, 'title')}
                  </span>
                                {/* teamType에 따른 라벨 표시 */}
                                {teamType === '2guide' && schedule.two_guide_schedule && (
                                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                    {schedule.two_guide_schedule === 'guide' ? getText('가이드', 'Guide') : 
                                     schedule.two_guide_schedule === 'assistant' ? getText('어시스턴트', 'Assistant') : 
                                     schedule.two_guide_schedule}
                                  </span>
                                )}
                                {teamType === 'guide+driver' && schedule.guide_driver_schedule && (
                                  <span className={`px-2 py-1 text-xs rounded ${
                                    schedule.guide_driver_schedule === 'guide' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : schedule.guide_driver_schedule === 'driver'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {schedule.guide_driver_schedule === 'guide' ? getText('가이드', 'Guide') : 
                                     schedule.guide_driver_schedule === 'driver' ? getText('드라이버', 'Driver') : 
                                     schedule.guide_driver_schedule}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-1">
                  {schedule.is_transport && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                    {getText('이동시간', 'Transport')}
                    </span>
                  )}
                  {schedule.is_break && (
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                                    {getText('휴식', 'Break')}
                    </span>
                  )}
                  {schedule.is_meal && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                    {getText('식사', 'Meal')}
                                  </span>
                                )}
                                {schedule.is_tour && (
                                  <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                                    {getText('관광시간', 'Tour Time')}
                    </span>
                  )}
                                {/* 핀 맵 아이콘 버튼 */}
                                {(schedule.latitude && schedule.longitude) || getScheduleText(schedule, 'location') ? (
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
                
                            {/* 2번째 줄: 설명 | 가이드 메모 */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                {getScheduleText(schedule, 'description') ? (
                                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {getScheduleText(schedule, 'description')}
                  </p>
                ) : null}
                
                              </div>
                
                {getScheduleText(schedule, 'guide_notes') && (
                                <div className="text-right ml-4">
                                  <p className="text-xs text-gray-500 italic">
                    {getText('가이드 메모', 'Guide Notes')}: {getScheduleText(schedule, 'guide_notes')}
                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {schedules.length === 0 && (
                    <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                      {getText('일정이 없습니다.', 'No schedules.')}
                    </div>
                  )}
                </div>
              </div>

              {/* 가이드+드라이버 담당 일정 */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  {getText('가이드+드라이버 담당 일정', 'Guide+Driver Assigned Schedules')}
                </h4>
                <div className="space-y-4">
                  {groupSchedulesByDay(schedules).map(({ day, schedules }) => (
                    <div key={day} className="space-y-2">
                      <h5 className="text-md font-semibold text-gray-800 mb-2">{day}{getText('일차', ' Day')}</h5>
                      <div className="space-y-2">
                        {schedules.map((schedule) => (
                          <div key={schedule.id} className="bg-white border border-gray-200 rounded-lg p-3">
                            {/* 1번째 줄: 썸네일, 출발-도착(소요) 제목 가이드담당 | 이동시간 */}
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center space-x-3">
                                {/* 썸네일 */}
                                <div className="w-12 h-8 flex-shrink-0">
                                  {schedule.thumbnail_url ? (
                                    <Image 
                                      src={schedule.thumbnail_url} 
                                      alt="썸네일" 
                                      width={48}
                                      height={32}
                                      className="w-full h-full object-cover rounded border"
                                      style={{ width: 'auto', height: 'auto' }}
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-100 rounded border flex items-center justify-center">
                                      <span className="text-xs text-gray-400">이미지</span>
                                    </div>
                                  )}
                                </div>
              
                                <div className="flex items-center space-x-3">
                                  <div className="w-24 flex-shrink-0">
                                    <span className="text-sm text-gray-600 whitespace-nowrap">
                                      {schedule.start_time ? schedule.start_time.substring(0, 5) : ''}
                                      {schedule.end_time && ` - ${schedule.end_time.substring(0, 5)}`}
                                    </span>
                                  </div>
                                  <div className="w-16 flex-shrink-0 text-right">
                                    <span className="text-sm text-gray-500">
                                      {schedule.duration_minutes && schedule.duration_minutes > 0 ? `${schedule.duration_minutes}${getText('분', 'min')}` : ''}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-medium text-gray-900">
                                  {getScheduleText(schedule, 'title')}
                  </span>
                                {/* teamType에 따른 라벨 표시 */}
                                {teamType === '2guide' && schedule.two_guide_schedule && (
                                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                    {schedule.two_guide_schedule === 'guide' ? getText('가이드', 'Guide') : 
                                     schedule.two_guide_schedule === 'assistant' ? getText('어시스턴트', 'Assistant') : 
                                     schedule.two_guide_schedule}
                                  </span>
                                )}
                                {teamType === 'guide+driver' && schedule.guide_driver_schedule && (
                                  <span className={`px-2 py-1 text-xs rounded ${
                                    schedule.guide_driver_schedule === 'guide' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : schedule.guide_driver_schedule === 'driver'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {schedule.guide_driver_schedule === 'guide' ? getText('가이드', 'Guide') : 
                                     schedule.guide_driver_schedule === 'driver' ? getText('드라이버', 'Driver') : 
                                     schedule.guide_driver_schedule}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-1">
                  {schedule.is_transport && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {getText('이동시간', 'Transport')}
                    </span>
                  )}
                  {schedule.is_break && (
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                      {getText('휴식', 'Break')}
                    </span>
                  )}
                  {schedule.is_meal && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      {getText('식사', 'Meal')}
                    </span>
                  )}
                  {schedule.is_tour && (
                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                      {getText('관광시간', 'Tour Time')}
                    </span>
                  )}
                                {/* 핀 맵 아이콘 버튼 */}
                                {(schedule.latitude && schedule.longitude) || getScheduleText(schedule, 'location') ? (
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
                
                            {/* 2번째 줄: 설명 | 가이드 메모 */}
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                {getScheduleText(schedule, 'description') ? (
                                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {getScheduleText(schedule, 'description')}
                  </p>
                ) : null}
                
                              </div>
                
                {(schedule.guide_notes_ko || schedule.guide_notes_en) && (
                                <div className="text-right ml-4">
                                  <p className="text-xs text-gray-500 italic">
                    가이드 메모: {schedule.guide_notes_ko || schedule.guide_notes_en}
                    {schedule.guide_notes_en && schedule.guide_notes_ko && (
                      <span className="ml-1">({schedule.guide_notes_en})</span>
                    )}
                  </p>
                                </div>
                )}
              </div>
              </div>
                        ))}
            </div>
          </div>
        ))}
        
                  {schedules.length === 0 && (
                    <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                      {getText('일정이 없습니다.', 'No schedules.')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 테이블 형식 일정 추가 모달 */}
      {showTableAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col overflow-hidden">
            <TableScheduleAdd
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              schedules={tableSchedules as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onSchedulesChange={setTableSchedules as any}
              onSave={handleSaveTableSchedules}
              onClose={() => setShowTableAdd(false)}
              saving={saving}
              teamMembers={teamMembers}
              productId={productId}
            />
          </div>
        </div>
      )}
    </div>
  )
}
