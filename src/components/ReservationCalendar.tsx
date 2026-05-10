'use client'

import React, { useState, useMemo, useCallback, memo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import type { Database } from '@/lib/supabase'

type Reservation = Database['public']['Tables']['reservations']['Row']

type CalendarReservation = Reservation & {
  customer_name?: string
  product_name?: string
  product_name_en?: string
  total_people?: number
  channel_name?: string
  products?: {
    name: string
    name_en?: string
    name_ko?: string
  }
}

interface ReservationCalendarProps {
  reservations: CalendarReservation[]
  onReservationClick: (reservation: Reservation) => void
  onLoadComplete?: () => void
}

const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
] as const

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const

const STATUS_LEGEND: Array<{ status: string; label: string }> = [
  { status: 'pending', label: '대기중' },
  { status: 'confirmed', label: '확정' },
  { status: 'completed', label: '완료' },
  { status: 'cancelled', label: '취소' },
  { status: 'recruiting', label: '모집중' },
]

// 모듈 스코프 헬퍼들 — 매 렌더마다 재생성되지 않도록 유지
function getReservationStatusColor(status: string): string {
  const normalizedStatus = status?.toLowerCase() || ''
  switch (normalizedStatus) {
    case 'pending':
      return 'bg-yellow-500'
    case 'confirmed':
      return 'bg-green-500'
    case 'completed':
      return 'bg-blue-500'
    case 'cancelled':
    case 'canceled':
      return 'bg-red-500'
    case 'recruiting':
      return 'bg-purple-500'
    default:
      return 'bg-gray-500'
  }
}

function getStatusLabelKo(status: string): string {
  const normalizedStatus = status?.toLowerCase() || ''
  switch (normalizedStatus) {
    case 'pending':
      return '대기중'
    case 'confirmed':
      return '확정'
    case 'completed':
      return '완료'
    case 'cancelled':
    case 'canceled':
      return '취소'
    case 'recruiting':
      return '모집중'
    default:
      return status || '상태 없음'
  }
}

function formatDateMDY(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const year = d.getFullYear()
  return `${month}/${day}/${year}`
}

function formatYmdLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const PT_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

interface CalendarDayCellProps {
  date: Date
  dayReservations: CalendarReservation[]
  isCurrentMonthDay: boolean
  isTodayDate: boolean
  dateFilter: 'created_at' | 'tour_date'
  locale: string
  onReservationClick: (reservation: Reservation) => void
}

/**
 * 모듈 스코프 컴포넌트 — 부모 컴포넌트 본문에서 정의하지 않아야 React.memo 가 의미 있다.
 * (이전엔 ReservationCalendar 함수 안에서 memo() 호출 → 매 렌더마다 새 컴포넌트 타입이 생겨
 *  42개 셀이 전부 unmount/remount 되며 메모이제이션 효과가 0이었다.)
 */
const CalendarDayCell = memo(function CalendarDayCell({
  date,
  dayReservations,
  isCurrentMonthDay,
  isTodayDate,
  dateFilter,
  locale,
  onReservationClick,
}: CalendarDayCellProps) {
  return (
    <div
      className={`min-h-[120px] p-2 border border-gray-200 ${
        isCurrentMonthDay ? 'bg-white' : 'bg-gray-50'
      } ${isTodayDate ? 'ring-2 ring-blue-500' : ''}`}
    >
      <div
        className={`text-sm font-medium mb-1 ${
          isCurrentMonthDay ? 'text-gray-900' : 'text-gray-400'
        } ${isTodayDate ? 'text-blue-600 font-bold' : ''}`}
      >
        {date.getDate()}
      </div>

      <div className="space-y-1">
        {dayReservations.map((reservation, reservationIndex) => {
          const customerName = reservation.customer_name || '고객명 없음'
          const productName =
            locale === 'en'
              ? reservation.products?.name_en ||
                reservation.product_name_en ||
                reservation.product_name ||
                reservation.product_id ||
                '상품명 없음'
              : reservation.products?.name_ko ||
                reservation.product_name ||
                reservation.products?.name_en ||
                reservation.product_id ||
                '상품명 없음'
          const totalPeople = reservation.total_people || 0
          const rawStatus = reservation.status || ''
          const statusLabel = getStatusLabelKo(rawStatus)

          let tooltipText = `고객: ${customerName}\n상품: ${productName}\n총인원: ${totalPeople}명\n상태: ${statusLabel}`
          if (reservation.pickup_hotel) tooltipText += `\n픽업호텔: ${reservation.pickup_hotel}`
          if (reservation.pickup_time) tooltipText += `\n픽업시간: ${reservation.pickup_time}`
          if (reservation.channel_name) tooltipText += `\n채널: ${reservation.channel_name}`

          const statusColor = getReservationStatusColor(rawStatus)
          const uniqueKey = `${reservation.id}-${reservationIndex}-${date.getTime()}`

          const secondLineContent =
            dateFilter === 'created_at'
              ? `${formatDateMDY(reservation.tour_date)} ${productName} | ${statusLabel}`
              : `${productName} | ${statusLabel} (${formatDateMDY(reservation.created_at)})`

          return (
            <div
              key={uniqueKey}
              onClick={() => onReservationClick(reservation)}
              className={`text-xs p-1 rounded cursor-pointer text-white hover:opacity-80 transition-opacity ${statusColor}`}
              title={tooltipText}
            >
              <div className="truncate">
                <div className="font-medium">
                  {customerName} {totalPeople}인
                </div>
                <div className="opacity-90 text-xs">{secondLineContent}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

const ReservationCalendar = memo(function ReservationCalendar({
  reservations,
  onReservationClick,
  onLoadComplete,
}: ReservationCalendarProps) {
  // 사용 안 하는 t — 번역 키가 추가되면 활용
  useTranslations('reservations')
  const locale = useLocale()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [dateFilter, setDateFilter] = useState<'created_at' | 'tour_date'>('created_at')

  useEffect(() => {
    if (onLoadComplete) {
      onLoadComplete()
    }
  }, [onLoadComplete])

  const { firstDayOfMonth } = useMemo(() => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    return { firstDayOfMonth: firstDay, lastDayOfMonth: lastDay }
  }, [currentDate])

  const calendarDays = useMemo(() => {
    const days: Date[] = []
    const firstDay = new Date(firstDayOfMonth)
    firstDay.setDate(firstDay.getDate() - firstDay.getDay())

    for (let i = 0; i < 42; i++) {
      const date = new Date(firstDay)
      date.setDate(firstDay.getDate() + i)
      days.push(date)
    }

    return days
  }, [firstDayOfMonth])

  // 예약 데이터를 날짜별로 미리 그룹화 (성능 최적화)
  const reservationsByDate = useMemo(() => {
    const groups: { [key: string]: CalendarReservation[] } = {}

    for (const reservation of reservations) {
      let dateString: string
      if (dateFilter === 'created_at') {
        dateString = formatYmdLocal(new Date(reservation.created_at))
      } else {
        dateString = reservation.tour_date
      }

      const bucket = groups[dateString] ?? (groups[dateString] = [])
      bucket.push(reservation)
    }

    return groups
  }, [reservations, dateFilter])

  const getReservationsForDate = useCallback(
    (date: Date): CalendarReservation[] => {
      const dateString =
        dateFilter === 'created_at' ? formatYmdLocal(date) : PT_DATE_FORMATTER.format(date)
      return reservationsByDate[dateString] || EMPTY_RESERVATIONS
    },
    [reservationsByDate, dateFilter]
  )

  const goToPreviousMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [])

  const goToNextMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  const isToday = useCallback((date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }, [])

  const isCurrentMonth = useCallback(
    (date: Date) => date.getMonth() === currentDate.getMonth(),
    [currentDate]
  )

  return (
    <div className="bg-white rounded-lg shadow-md border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <CalendarIcon className="w-5 h-5 mr-2" />
          예약 달력
        </h2>
        <div className="flex items-center space-x-4">
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
            {currentDate.getFullYear()}년 {MONTH_NAMES[currentDate.getMonth()]}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_NAMES.map((day, index) => (
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
              dateFilter={dateFilter}
              locale={locale}
              onReservationClick={onReservationClick}
            />
          )
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">예약 상태</h3>
        <div className="flex flex-wrap gap-3">
          {STATUS_LEGEND.map(({ status, label }) => (
            <div key={status} className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getReservationStatusColor(status)}`} />
              <span className="text-sm text-gray-600">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">라벨 정보</h3>
          <div className="text-sm text-gray-600">
            <p>
              • <strong>고객명</strong> | 상품명 | 총인원 | 상태
            </p>
            <p>• 마우스를 올리면 상세 정보를 확인할 수 있습니다</p>
            <p>• {dateFilter === 'created_at' ? '등록일' : '투어일'} 기준으로 표시됩니다</p>
          </div>
        </div>
      </div>
    </div>
  )
})

// 빈 날짜 셀에 매번 새 [] 가 들어가지 않도록 공유 상수 사용
const EMPTY_RESERVATIONS: CalendarReservation[] = []

export default ReservationCalendar
