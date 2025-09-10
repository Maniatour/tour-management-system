'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Database } from '@/lib/supabase'

type Tour = Database['public']['Tables']['tours']['Row']

interface TourCalendarProps {
  tours: (Tour & { product_name?: string; total_people?: number; assigned_people?: number; guide_name?: string; assistant_name?: string })[] // 투어 데이터 + 상품명 + 총인원 + 배정인원 + 가이드명 + 어시스턴트명
  onTourClick: (tour: Tour) => void
}

const TourCalendar = memo(function TourCalendar({ tours, onTourClick }: TourCalendarProps) {
  const t = useTranslations('tours')
  const [currentDate, setCurrentDate] = useState(new Date())

  // 현재 월의 첫 번째 날과 마지막 날 계산
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  
  // 달력에 표시할 날짜들 계산 (이전/다음 달의 일부 포함)
  const calendarDays = useMemo(() => {
    const days = []
    const firstDay = new Date(firstDayOfMonth)
    firstDay.setDate(firstDay.getDate() - firstDay.getDay()) // 일요일부터 시작
    
    for (let i = 0; i < 42; i++) { // 6주 x 7일
      const date = new Date(firstDay)
      date.setDate(firstDay.getDate() + i)
      days.push(date)
    }
    
    return days
  }, [firstDayOfMonth])

  // 특정 날짜의 예약들 가져오기 (메모이제이션)
  const getToursForDate = useCallback((date: Date) => {
    // 라스베가스 시간대 (Pacific Time) 기준으로 날짜 문자열 생성
    // Intl.DateTimeFormat을 사용하여 정확한 시간대 변환
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    const lasVegasDate = formatter.format(date)
    const dateString = lasVegasDate // YYYY-MM-DD 형식
    
    return tours.filter(tour => tour.tour_date === dateString)
  }, [tours])

  // 이전/다음 월로 이동 (메모이제이션)
  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }, [currentDate])

  const goToNextMonth = useCallback(() => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }, [currentDate])

  // 오늘 날짜인지 확인 (메모이제이션)
  const isToday = useCallback((date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }, [])

  // 현재 월의 날짜인지 확인 (메모이제이션)
  const isCurrentMonth = useCallback((date: Date) => {
    return date.getMonth() === currentDate.getMonth()
  }, [currentDate])

  // 상품별 색상 생성 (일관된 색상, 메모이제이션)
  const getProductColor = useCallback((productId: string | null) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
      'bg-cyan-500'
    ]
    
    // productId가 null이거나 빈 문자열인 경우 기본 색상 반환
    if (!productId) {
      return 'bg-gray-500'
    }
    
    // productId의 해시값을 사용하여 일관된 색상 선택
    let hash = 0
    for (let i = 0; i < productId.length; i++) {
      hash = productId.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }, [])

  // 예약 상태에 따른 색상 반환 (메모이제이션)
  const getTourStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'confirmed': return 'bg-green-500'
      case 'completed': return 'bg-blue-500'
      case 'cancelled': return 'bg-red-500'
      case 'recruiting': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }, [])

  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ]

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="bg-white rounded-lg shadow-md border p-6">
      {/* 달력 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <CalendarIcon className="w-5 h-5 mr-2" />
          예약 달력
        </h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-medium text-gray-900">
            {currentDate.getFullYear()}년 {monthNames[currentDate.getMonth()]}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day, index) => (
          <div
            key={day}
            className={`p-2 text-center text-sm font-medium ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => {
          const dayTours = getToursForDate(date)
          const isCurrentMonthDay = isCurrentMonth(date)
          const isTodayDate = isToday(date)

          return (
            <div
              key={index}
              className={`min-h-[120px] p-2 border border-gray-200 ${
                isCurrentMonthDay ? 'bg-white' : 'bg-gray-50'
              } ${isTodayDate ? 'ring-2 ring-blue-500' : ''}`}
            >
              {/* 날짜 */}
              <div className={`text-sm font-medium mb-1 ${
                isCurrentMonthDay ? 'text-gray-900' : 'text-gray-400'
              } ${isTodayDate ? 'text-blue-600 font-bold' : ''}`}>
                {date.getDate()}
              </div>

              {/* 투어 라벨들 */}
              <div className="space-y-1">
                {dayTours.map((tour, index) => {
                  // 배정된 인원 수와 총 인원 수
                  const assignedPeople = tour.assigned_people || 0
                  const totalPeople = tour.total_people || 0
                  const hasUnassignedReservations = totalPeople > assignedPeople
                  
                  // 툴팁 텍스트 구성
                  let tooltipText = `${tour.product_name || tour.product_id} | 배정: ${assignedPeople}명 / 총: ${totalPeople}명 (Recruiting/Confirmed만)`
                  if (hasUnassignedReservations) {
                    tooltipText += ' (미배정 있음)'
                  }
                  
                  // 가이드 정보 추가
                  if (tour.guide_name) {
                    tooltipText += `\n가이드: ${tour.guide_name}`
                  }
                  
                  // 어시스턴트 정보 추가
                  if (tour.assistant_name) {
                    tooltipText += `\n어시스턴트: ${tour.assistant_name}`
                  }
                  
                  // 단독투어 여부 확인
                  const isPrivateTour = tour.is_private_tour === 'TRUE' || tour.is_private_tour === true
                  
                  return (
                    <div
                      key={tour.id}
                      onClick={() => onTourClick(tour)}
                      className={`text-xs p-1 rounded cursor-pointer text-white hover:opacity-80 transition-opacity ${
                        getProductColor(tour.product_id)
                      } ${hasUnassignedReservations ? 'ring-2 ring-red-500 ring-opacity-75' : ''} ${
                        isPrivateTour ? 'ring-2 ring-purple-400 ring-opacity-100' : ''
                      }`}
                      title={tooltipText + (isPrivateTour ? '\n단독투어' : '')}
                    >
                      <div className="truncate">
                        <span className={`font-medium ${isPrivateTour ? 'text-purple-100' : ''}`}>
                          {isPrivateTour ? '🔒 ' : ''}{tour.product_name || tour.product_id}
                        </span>
                        <span className="mx-1">|</span>
                        <span className="opacity-90">{assignedPeople} / {totalPeople}명</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 예약 상태 범례 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">예약 상태</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { status: 'pending', label: '대기중' },
            { status: 'confirmed', label: '확정' },
            { status: 'completed', label: '완료' },
            { status: 'cancelled', label: '취소' },
            { status: 'recruiting', label: '모집중' }
          ].map(({ status, label }) => (
            <div key={status} className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getTourStatusColor(status)}`} />
              <span className="text-sm text-gray-600">{label}</span>
            </div>
          ))}
        </div>
        
        {/* 단독투어 범례 */}
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">투어 유형</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-purple-400 ring-2 ring-purple-400 ring-opacity-50" />
              <span className="text-sm text-gray-600">단독투어</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm text-gray-600">일반투어</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default TourCalendar
