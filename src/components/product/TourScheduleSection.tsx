'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Clock, Calendar, MapPin, Car, Camera, ChevronDown, ChevronUp, Navigation } from 'lucide-react'
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
  google_maps_link: string | null
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
  showAllSchedules?: boolean // 가이드 페이지에서는 모든 일정 표시
  currentUserEmail?: string | null // 현재 사용자 이메일 (필터링용)
  tourGuideId?: string | null // 투어 가이드 ID
  assistantId?: string | null // 어시스턴트/드라이버 ID
}

export default function TourScheduleSection({ 
  productId, 
  teamType, 
  locale = 'ko',
  showAllSchedules = false,
  currentUserEmail,
  tourGuideId,
  assistantId
}: TourScheduleSectionProps) {
  // 디버깅: locale 값 확인
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('TourScheduleSection locale:', locale)
    }
  }, [locale])
  
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set())
  const [isExpanded, setIsExpanded] = useState(true)
  const [showOnlyMySchedules, setShowOnlyMySchedules] = useState(false) // 자신의 일정만 보기 필터

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
    // locale 값을 정규화 (공백 제거, 소문자 변환)
    const normalizedLocale = locale?.trim().toLowerCase()
    
    if (normalizedLocale === 'ko') {
      return koText
    }
    // locale이 'en'이거나 다른 값일 때는 영문 반환 (없으면 한글 fallback)
    return enText || koText
  }

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true)
      
      // 가이드 페이지에서는 모든 일정 가져오기, 고객 페이지에서는 show_to_customers가 true인 일정만
      let query = supabase
        .from('product_schedules')
        .select(`
          id,
          product_id,
          day_number,
          start_time,
          end_time,
          duration_minutes,
          is_break,
          is_meal,
          is_transport,
          is_tour,
          latitude,
          longitude,
          show_to_customers,
          title_ko,
          title_en,
          description_ko,
          description_en,
          location_ko,
          location_en,
          guide_notes_ko,
          guide_notes_en,
          thumbnail_url,
          order_index,
          two_guide_schedule,
          guide_driver_schedule,
          google_maps_link,
          created_at,
          updated_at
        `)
        .eq('product_id', productId)
      
      // showAllSchedules가 false일 때만 고객 표시 필터 적용
      if (!showAllSchedules) {
        query = query.eq('show_to_customers', true)
      }
      
      const { data, error } = await query
        .order('day_number', { ascending: true })
        .order('order_index', { ascending: true })
        .order('start_time', { ascending: true })
      
      if (error) throw error
      
      // 디버깅: 개발 환경에서만 로그 출력
      if (process.env.NODE_ENV === 'development' && data && data.length > 0) {
        // title이 있는 첫 번째 일정 찾기
        const scheduleWithTitle = data.find(s => s.title_ko || s.title_en) || data[0]
        console.log('TourScheduleSection - Fetched schedules:', {
          count: data.length,
          locale: locale,
          sampleSchedule: {
            id: scheduleWithTitle.id,
            title_ko: scheduleWithTitle.title_ko,
            title_en: scheduleWithTitle.title_en,
            title_ko_length: scheduleWithTitle.title_ko?.length || 0,
            title_en_length: scheduleWithTitle.title_en?.length || 0,
            title_ko_exists: !!scheduleWithTitle.title_ko,
            title_en_exists: !!scheduleWithTitle.title_en,
            description_ko: scheduleWithTitle.description_ko?.substring(0, 30),
            description_en: scheduleWithTitle.description_en?.substring(0, 30),
          },
          allTitles: data.slice(0, 5).map(s => ({
            id: s.id,
            title_ko: s.title_ko,
            title_en: s.title_en
          }))
        })
      }
      
      setSchedules(data || [])
    } catch (error) {
      console.error('스케줄 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }, [productId, showAllSchedules])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])


  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.substring(0, 5) // HH:MM 형식으로 변환
  }

  const getLocalizedText = (ko: string | null, en: string | null, fallback: string | null, fieldName?: string) => {
    // locale 값을 정규화 (공백 제거, 소문자 변환)
    const normalizedLocale = locale?.trim().toLowerCase()
    
    // 디버깅: 개발 환경에서만 로그 출력 (title 필드에 대해서만)
    if (process.env.NODE_ENV === 'development' && normalizedLocale === 'en' && fieldName === 'title') {
      console.log('getLocalizedText [title]:', { 
        fieldName,
        locale: normalizedLocale, 
        ko: ko || '(null)',
        en: en || '(null)',
        koExists: !!ko,
        enExists: !!en,
        koLength: ko?.length || 0,
        enLength: en?.length || 0,
        koTrimmed: ko?.trim() || '',
        enTrimmed: en?.trim() || ''
      })
    }
    
    // locale이 'en'일 때는 영문 우선
    if (normalizedLocale === 'en') {
      // 영문이 있고 빈 문자열이 아닐 때
      if (en && en.trim() !== '') return en.trim()
      // 영문이 없으면 한글 fallback
      if (ko && ko.trim() !== '') return ko.trim()
      return fallback || ''
    }
    // locale이 'ko'이거나 다른 값일 때는 한글 우선
    if (ko && ko.trim() !== '') return ko.trim()
    // 한글이 없으면 영문 fallback
    if (en && en.trim() !== '') return en.trim()
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
                   schedule.guide_driver_schedule === 'assistant' ? getText('드라이버', 'Driver') : 
                   schedule.guide_driver_schedule
      // guide = 빨간색, assistant (드라이버) = 파란색
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

  // 자신의 일정인지 확인하는 함수
  const isMySchedule = (schedule: ScheduleItem): boolean => {
    if (!currentUserEmail || !showOnlyMySchedules) return true
    
    // 가이드+드라이버 팀 타입
    if (teamType === 'guide+driver') {
      if (currentUserEmail === tourGuideId && schedule.guide_driver_schedule === 'guide') {
        return true
      }
      if (currentUserEmail === assistantId && schedule.guide_driver_schedule === 'assistant') {
        return true
      }
      return false
    }
    
    // 2가이드 팀 타입
    if (teamType === '2guide') {
      if (currentUserEmail === tourGuideId && schedule.two_guide_schedule === 'guide') {
        return true
      }
      if (currentUserEmail === assistantId && schedule.two_guide_schedule === 'assistant') {
        return true
      }
      return false
    }
    
    // 팀 타입이 없으면 모든 일정 표시
    return true
  }

  // 필터링된 일정
  const filteredSchedules = showOnlyMySchedules 
    ? schedules.filter(isMySchedule)
    : schedules

  // 전체 일정을 일차별로 그룹화 (다음 목적지 찾기용)
  const allSchedulesByDay = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.day_number]) {
      acc[schedule.day_number] = []
    }
    acc[schedule.day_number].push(schedule)
    return acc
  }, {} as Record<number, ScheduleItem[]>)

  // 다음 목적지 찾기 함수 (전체 일정에서 찾기)
  const getNextDestination = (currentSchedule: ScheduleItem): ScheduleItem | null => {
    // 같은 일차의 전체 일정 가져오기
    const daySchedules = allSchedulesByDay[currentSchedule.day_number] || []
    
    // 현재 일정의 인덱스 찾기
    const currentIndex = daySchedules.findIndex(s => s.id === currentSchedule.id)
    if (currentIndex === -1 || currentIndex === daySchedules.length - 1) {
      return null
    }
    
    // 다음 일정 찾기
    const nextSchedule = daySchedules[currentIndex + 1]
    return nextSchedule || null
  }

  // 일차별로 그룹화 (필터링된 일정 사용)
  const schedulesByDay = filteredSchedules.reduce((acc, schedule) => {
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

  if (filteredSchedules.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {teamType === '2guide' ? getText('2가이드 담당 일정 (제목만 보기)', '2-Guide Assigned Schedules (Title Only)') : 
           teamType === 'guide+driver' ? getText('가이드+드라이버 담당 일정 (제목만 보기)', 'Guide+Driver Assigned Schedules (Title Only)') : 
           getText('투어 일정 (제목만 보기)', 'Tour Schedules (Title Only)')}
        </h3>
        <div className="text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">
            {showOnlyMySchedules 
              ? getText('담당 일정이 없습니다.', 'No assigned schedules.')
              : getText('등록된 일정이 없습니다.', 'No schedules registered.')}
          </p>
        </div>
      </div>
    )
  }

  // 필터링된 일정으로 allSchedulesExpanded 계산
  const filteredSchedulesWithDescription = filteredSchedules.filter(s => getLocalizedText(s.description_ko, s.description_en, ''))
  const allSchedulesExpanded = filteredSchedulesWithDescription.length > 0 && 
    filteredSchedulesWithDescription.every(s => expandedSchedules.has(s.id))

  return (
    <div>
      {/* 필터 버튼 (가이드 페이지에서만 표시) */}
      {showAllSchedules && currentUserEmail && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex-shrink-0">
            {teamType === '2guide' ? getText('2가이드 담당 일정', '2-Guide Assigned Schedules') : 
             teamType === 'guide+driver' ? getText('가이드+드라이버 담당 일정', 'Guide+Driver Assigned Schedules') : 
             getText('투어 일정', 'Tour Schedules')}
          </h3>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <button
              onClick={() => setShowOnlyMySchedules(false)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                !showOnlyMySchedules
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {getText('전체', 'All')}
            </button>
            <button
              onClick={() => setShowOnlyMySchedules(true)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                showOnlyMySchedules
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {getText('내 일정', 'My')}
            </button>
          </div>
        </div>
      )}

      {/* 아코디언 헤더 */}
      {(!showAllSchedules || !currentUserEmail) && (
        <div 
          className="flex items-center justify-between cursor-pointer mb-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={() => {
            // 모든 개별 아코디언이 열려있으면 닫기, 아니면 열기
            if (allSchedulesExpanded) {
              // 제목만 보기: 모든 개별 아코디언 닫기
              setExpandedSchedules(new Set())
            } else {
              // 상세보기: 모든 개별 아코디언 열기 (설명이 있는 것만)
              const allScheduleIds = filteredSchedules
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
      )}
      
      {isExpanded && (
        <div className="space-y-4">
        {Object.entries(schedulesByDay)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([dayNumber, daySchedules]) => {
            const dayNum = Number(dayNumber)
            
            return (
              <div key={dayNum} className="space-y-3">
                {/* 일차 헤더 */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 text-blue-600 rounded-full text-xs sm:text-sm font-medium flex-shrink-0">
                    {dayNum}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                      {getText(`${dayNum}일차`, `Day ${dayNum}`)}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-500">
                      {getText(`${daySchedules.length}개 일정`, `${daySchedules.length} schedules`)}
                    </p>
                  </div>
                </div>
                
                {/* 일정 목록 - 항상 표시 */}
                <div className="space-y-3">
                  {daySchedules.map((schedule, scheduleIndex) => {
                    const isExpanded = expandedSchedules.has(schedule.id)
                    const hasDescription = getLocalizedText(schedule.description_ko, schedule.description_en, '')
                    // 다음 목적지 찾기 (전체 일정에서 찾기)
                    const nextDestination = showOnlyMySchedules ? getNextDestination(schedule) : null
                    
                    return (
                      <div key={schedule.id} className={`p-2 sm:p-3 rounded-lg border ${getScheduleBackgroundColor(schedule)}`}>
                        {/* 클릭 가능한 헤더 영역 */}
                        <div 
                          className={`${hasDescription ? 'cursor-pointer' : ''}`}
                          onClick={() => hasDescription && toggleScheduleExpansion(schedule.id)}
                        >
                          {/* 첫 번째 줄: 시간, 소요시간, 드라이버 뱃지, 구글맵 버튼 */}
                          <div className="flex items-center justify-between mb-2 space-x-2">
                            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                              {/* 시간 영역 */}
                              <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-700 flex-shrink-0">
                                {getTimeIcon(schedule)}
                                <span className="font-medium whitespace-nowrap">
                                  {schedule.start_time ? formatTime(schedule.start_time) : ''}
                                  {schedule.end_time ? `-${formatTime(schedule.end_time)}` : ''}
                                </span>
                              </div>
                              {/* 소요시간 영역 */}
                              {schedule.duration_minutes && (
                                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  <Clock className="w-3 h-3 mr-0.5 sm:mr-1" />
                                  {schedule.duration_minutes}
                                </span>
                              )}
                              {/* 드라이버/가이드 뱃지 - 소요시간 오른쪽 */}
                              {getResponsibleLabels(schedule).map((label, index) => (
                                <span key={index} className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs rounded ${label.color} whitespace-nowrap`}>
                                  {label.text}
                                </span>
                              ))}
                            </div>
                            {/* 오른쪽 버튼들 */}
                            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                              {hasDescription && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleScheduleExpansion(schedule.id)
                                  }}
                                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors flex-shrink-0"
                                  title={isExpanded ? '접기' : '펼치기'}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              )}
                              {/* 구글맵 버튼 - 가장 오른쪽 끝 */}
                              {schedule.google_maps_link && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    window.open(schedule.google_maps_link!, '_blank')
                                  }}
                                  className="p-1 sm:p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors flex items-center"
                                  title={getText('구글맵으로 열기', 'Open in Google Maps')}
                                >
                                  <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* 제목 - 별도 줄 */}
                          <h5 className="font-medium text-gray-900 text-sm sm:text-base mb-2 break-words">
                            {getLocalizedText(schedule.title_ko, schedule.title_en, '', 'title')}
                          </h5>
                          
                          {/* 다음 목적지 표시 (자신의 일정 보기 모드일 때만) */}
                          {showOnlyMySchedules && nextDestination && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              {/* 첫 번째 줄: 다음 목적지 라벨과 구글맵 버튼 */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                  <span className="text-gray-600 font-medium text-xs sm:text-sm flex-shrink-0">
                                    {getText('다음 목적지:', 'Next Destination:')}
                                  </span>
                                </div>
                                {/* 구글맵 버튼 - 오른쪽 끝 */}
                                {(nextDestination.google_maps_link || (nextDestination.latitude && nextDestination.longitude)) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (nextDestination.google_maps_link) {
                                        window.open(nextDestination.google_maps_link, '_blank')
                                      } else if (nextDestination.latitude && nextDestination.longitude) {
                                        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${nextDestination.latitude},${nextDestination.longitude}`
                                        window.open(googleMapsUrl, '_blank')
                                      }
                                    }}
                                    className="p-1 sm:p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors flex items-center"
                                    title={getText('구글맵으로 보기', 'View in Google Maps')}
                                  >
                                    <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                )}
                              </div>
                              {/* 제목 - 별도 줄 */}
                              <div className="mb-1">
                                <span className="text-blue-700 font-semibold text-xs sm:text-sm break-words">
                                  {getLocalizedText(nextDestination.title_ko, nextDestination.title_en, '')}
                                </span>
                              </div>
                              {/* 주소 - 별도 줄 */}
                              {nextDestination.location_ko || nextDestination.location_en ? (
                                <div>
                                  <span className="text-blue-600 text-xs sm:text-sm break-words">
                                    {getLocalizedText(nextDestination.location_ko, nextDestination.location_en, '')}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          )}
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
