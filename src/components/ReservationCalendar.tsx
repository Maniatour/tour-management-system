'use client'

import { useState, useMemo, useCallback, memo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Database } from '@/lib/supabase'

type Reservation = Database['public']['Tables']['reservations']['Row']

interface ReservationCalendarProps {
  reservations: (Reservation & { 
    customer_name?: string; 
    product_name?: string; 
    total_people?: number; 
    channel_name?: string;
  })[]
  onReservationClick: (reservation: Reservation) => void
  onLoadComplete?: () => void
}

const ReservationCalendar = memo(function ReservationCalendar({ 
  reservations, 
  onReservationClick,
  onLoadComplete
}: ReservationCalendarProps) {
  const t = useTranslations('reservations')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [dateFilter, setDateFilter] = useState<'created_at' | 'tour_date'>('created_at')

  // 컴포넌트 마운트 시 로딩 완료 알림
  useEffect(() => {
    if (onLoadComplete) {
      onLoadComplete()
    }
  }, [onLoadComplete])

  // 현재 월의 첫 번째 날과 마지막 날 계산
  const { firstDayOfMonth, lastDayOfMonth } = useMemo(() => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    return { firstDayOfMonth: firstDay, lastDayOfMonth: lastDay }
  }, [currentDate])
  
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

  // 예약 데이터를 날짜별로 미리 그룹화 (성능 최적화)
  const reservationsByDate = useMemo(() => {
    const groups: { [key: string]: typeof reservations } = {}
    
    reservations.forEach(reservation => {
      let dateString: string
      
      if (dateFilter === 'created_at') {
        // 등록일 기준 필터링
        const utcDate = new Date(reservation.created_at)
        const lasVegasCreatedDate = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
        dateString = lasVegasCreatedDate.toISOString().split('T')[0]
      } else {
        // 투어일 기준 필터링
        dateString = reservation.tour_date
      }
      
      if (!groups[dateString]) {
        groups[dateString] = []
      }
      groups[dateString].push(reservation)
    })
    
    return groups
  }, [reservations, dateFilter])

  // 특정 날짜의 예약들 가져오기 (최적화된 버전)
  const getReservationsForDate = useCallback((date: Date) => {
    // 라스베가스 시간대 (Pacific Time) 기준으로 날짜 문자열 생성
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    const lasVegasDate = formatter.format(date)
    const dateString = lasVegasDate // YYYY-MM-DD 형식
    
    return reservationsByDate[dateString] || []
  }, [reservationsByDate])

  // 이전/다음 월로 이동 (메모이제이션)
  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [])

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  // 오늘 날짜인지 확인 (메모이제이션)
  const isToday = useCallback((date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }, [])

  // 현재 월의 날짜인지 확인 (메모이제이션)
  const isCurrentMonth = useCallback((date: Date) => {
    return date.getMonth() === currentDate.getMonth()
  }, [currentDate])

  // 예약 상태에 따른 색상 반환 (메모이제이션)
  const getReservationStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'confirmed': return 'bg-green-500'
      case 'completed': return 'bg-blue-500'
      case 'cancelled': return 'bg-red-500'
      case 'recruiting': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }, [])

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

  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ]

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  // 달력 날짜 셀 컴포넌트 (메모이제이션)
  const CalendarDayCell = memo(({ 
    date, 
    dayReservations, 
    isCurrentMonthDay, 
    isTodayDate 
  }: {
    date: Date
    dayReservations: typeof reservations
    isCurrentMonthDay: boolean
    isTodayDate: boolean
  }) => {
    // 예약 상태에 따른 색상 반환 (로컬 함수)
    const getReservationStatusColor = (status: string) => {
      switch (status) {
        case 'pending': return 'bg-yellow-500'
        case 'confirmed': return 'bg-green-500'
        case 'completed': return 'bg-blue-500'
        case 'cancelled': return 'bg-red-500'
        case 'recruiting': return 'bg-purple-500'
        default: return 'bg-gray-500'
      }
    }
    return (
      <div
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
          {dayReservations.map((reservation, reservationIndex) => {
            // 예약 데이터에서 정보 추출
            const customerName = reservation.customer_name || '고객명 없음'
            const productName = reservation.product_name || reservation.product_id || '상품명 없음'
            const totalPeople = reservation.total_people || 0
            const status = reservation.status || '상태 없음'
            
            // 툴팁 텍스트 구성
            let tooltipText = `고객: ${customerName}\n상품: ${productName}\n총인원: ${totalPeople}명\n상태: ${status}`
            
            // 추가 정보가 있으면 툴팁에 포함
            if (reservation.pickup_hotel) {
              tooltipText += `\n픽업호텔: ${reservation.pickup_hotel}`
            }
            if (reservation.pickup_time) {
              tooltipText += `\n픽업시간: ${reservation.pickup_time}`
            }
            if (reservation.channel_name) {
              tooltipText += `\n채널: ${reservation.channel_name}`
            }
            
            // 상태에 따른 색상 결정
            const statusColor = getReservationStatusColor(status)
            
            // 고유한 key 생성
            const uniqueKey = `${reservation.id}-${reservationIndex}-${date.getTime()}`
            
            return (
              <div
                key={uniqueKey}
                onClick={() => onReservationClick(reservation)}
                className={`text-xs p-1 rounded cursor-pointer text-white hover:opacity-80 transition-opacity ${statusColor}`}
                title={tooltipText}
              >
                <div className="truncate">
                  <div className="font-medium">{customerName}</div>
                  <div className="opacity-90 text-xs">
                    {productName} | {totalPeople}명 | {status}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  })

  return (
    <div className="bg-white rounded-lg shadow-md border p-6">
      {/* 달력 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <CalendarIcon className="w-5 h-5 mr-2" />
          예약 달력
        </h2>
        <div className="flex items-center space-x-4">
          {/* 날짜 필터 선택 */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'created_at' | 'tour_date')}
              className="px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="created_at">등록일 기준</option>
              <option value="tour_date">투어일 기준</option>
            </select>
          </div>
          
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
          const dayReservations = getReservationsForDate(date)
          const isCurrentMonthDay = isCurrentMonth(date)
          const isTodayDate = isToday(date)

          return (
            <CalendarDayCell
              key={`${date.getTime()}-${index}`}
              date={date}
              dayReservations={dayReservations}
              isCurrentMonthDay={isCurrentMonthDay}
              isTodayDate={isTodayDate}
            />
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
              <div className={`w-3 h-3 rounded-full ${getReservationStatusColor(status)}`} />
              <span className="text-sm text-gray-600">{label}</span>
            </div>
          ))}
        </div>
        
        {/* 예약 정보 안내 */}
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">라벨 정보</h3>
          <div className="text-sm text-gray-600">
            <p>• <strong>고객명</strong> | 상품명 | 총인원 | 상태</p>
            <p>• 마우스를 올리면 상세 정보를 확인할 수 있습니다</p>
            <p>• {dateFilter === 'created_at' ? '등록일' : '투어일'} 기준으로 표시됩니다</p>
          </div>
        </div>
      </div>
    </div>
  )
})

export default ReservationCalendar
