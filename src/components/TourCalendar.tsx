'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Database } from '@/lib/supabase'

type Tour = Database['public']['Tables']['tours']['Row']

interface TourCalendarProps {
  tours: any[] // 예약 데이터를 받도록 수정
  onTourClick: (tour: any) => void
}

export default function TourCalendar({ tours, onTourClick }: TourCalendarProps) {
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

  // 특정 날짜의 예약들 가져오기
  const getToursForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    return tours.filter(tour => tour.tour_date === dateString)
  }

  // 이전/다음 월로 이동
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  // 오늘 날짜인지 확인
  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // 현재 월의 날짜인지 확인
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth()
  }

  // 예약 상태에 따른 색상 반환
  const getTourStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'confirmed': return 'bg-green-500'
      case 'completed': return 'bg-blue-500'
      case 'cancelled': return 'bg-red-500'
      case 'recruiting': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

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

              {/* 예약 라벨들 */}
              <div className="space-y-1">
                {dayTours.slice(0, 2).map((reservation, index) => {
                  const totalParticipants = reservation.adults + reservation.child + reservation.infant
                  
                  return (
                    <div
                      key={reservation.id}
                      onClick={() => onTourClick(reservation)}
                      className={`text-xs p-1 rounded cursor-pointer text-white hover:opacity-80 transition-opacity ${
                        getTourStatusColor(reservation.tour_status)
                      }`}
                      title={`${reservation.customer_name} | ${reservation.product_id} | 총 ${totalParticipants}명`}
                    >
                      <div className="truncate">
                        <span className="font-medium">{reservation.customer_name}</span>
                        <span className="mx-1">|</span>
                        <span className="opacity-90">{reservation.product_id}</span>
                        <span className="mx-1">|</span>
                        <span className="opacity-75">총 {totalParticipants}명</span>
                      </div>
                    </div>
                  )
                })}
                {dayTours.length > 2 && (
                  <div 
                    className="text-xs text-gray-500 text-center cursor-pointer hover:text-gray-700 transition-colors"
                    onClick={() => {
                      // 추가 예약들을 보여주는 모달이나 상세 뷰를 열 수 있음
                      console.log('추가 예약들:', dayTours.slice(2))
                    }}
                    title={`추가 ${dayTours.length - 2}개 예약: ${dayTours.slice(2).map(r => r.customer_name).join(', ')}`}
                  >
                    +{dayTours.length - 2}개 더
                  </div>
                )}
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
      </div>
    </div>
  )
}
