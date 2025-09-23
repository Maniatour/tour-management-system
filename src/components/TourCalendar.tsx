'use client'

import { useState, useMemo, useCallback, memo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import type { Database } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

type Tour = Database['public']['Tables']['tours']['Row']

interface ExtendedTour extends Tour {
  product_name?: string | null;
  total_people?: number;
  assigned_people?: number;
  unassigned_people?: number;
  guide_name?: string | null;
  assistant_name?: string | null;
  vehicle_number?: string | null;
}

interface TourCalendarProps {
  tours: ExtendedTour[]
  onTourClick: (tour: ExtendedTour) => void
  allReservations?: Database['public']['Tables']['reservations']['Row'][]
}

const TourCalendar = memo(function TourCalendar({ tours, onTourClick, allReservations = [] }: TourCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [productMetaById, setProductMetaById] = useState<{[id: string]: { name: string; sub_category: string }}>({})
  const [hoveredTour, setHoveredTour] = useState<ExtendedTour | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  // 현재 월의 첫 번째 날 계산 (메모이제이션)
  const firstDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
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


  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ]

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  // 마우스 이벤트 핸들러
  const handleMouseEnter = useCallback((tour: ExtendedTour, event: React.MouseEvent) => {
    setHoveredTour(tour)
    const rect = event.currentTarget.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
    
    setTooltipPosition({
      x: rect.left + scrollLeft + rect.width / 2,
      y: rect.top + scrollTop - 10
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredTour(null)
  }, [])

  // 성능 최적화를 위한 메모이제이션된 사전 계산 (예약 4500+건 고려)

  // 2) (product_id, tour_date) -> 해당일 같은 투어의 총 인원 합계 (상태 무관)
  const productDateKeyToTotalPeopleAll = useMemo(() => {
    const map = new Map<string, number>()
    for (const res of allReservations) {
      const productId = (res.product_id ? String(res.product_id) : '').trim()
      const date = (res.tour_date ? String(res.tour_date) : '').trim()
      const key = `${productId}__${date}`
      const prev = map.get(key) || 0
      map.set(key, prev + (res.total_people || 0))
    }
    return map
  }, [allReservations])

  // 3) (product_id, tour_date) -> Recruiting/Confirmed만 합산 (대소문자 무관)
  const productDateKeyToTotalPeopleFiltered = useMemo(() => {
    const map = new Map<string, number>()
    for (const res of allReservations) {
      const status = (res.status || '').toString().toLowerCase()
      if (status !== 'confirmed' && status !== 'recruiting') continue
      const productId = (res.product_id ? String(res.product_id) : '').trim()
      const date = (res.tour_date ? String(res.tour_date) : '').trim()
      const key = `${productId}__${date}`
      const prev = map.get(key) || 0
      map.set(key, prev + (res.total_people || 0))
    }
    return map
  }, [allReservations])

  // reservation_ids 정규화: 배열/JSON 문자열/콤마 문자열 모두 지원
  const normalizeReservationIds = useCallback((value: unknown): string[] => {
    if (!value) return []
    if (Array.isArray(value)) {
      return value.map(v => String(v).trim()).filter(v => v.length > 0)
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed)
          return Array.isArray(parsed) ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0) : []
        } catch {
          return []
        }
      }
      // 콤마 구분 문자열 처리
      if (trimmed.includes(',')) {
        return trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0)
      }
      return trimmed.length > 0 ? [trimmed] : []
    }
    return []
  }, [])

  // 투어별 배정 인원 계산: reservation_ids에 있는 예약들 중 confirmed/recruiting 상태만 total_people 합계
  const getAssignedPeople = useCallback((tour: ExtendedTour) => {
    const ids = normalizeReservationIds(tour.reservation_ids as unknown)
    if (ids.length === 0) return 0
    
    // 중복 제거
    const uniqueIds = [...new Set(ids)]
    let total = 0
    
    for (const id of uniqueIds) {
      const reservation = allReservations.find(r => String(r.id).trim() === String(id).trim())
      if (reservation) {
        // confirmed 또는 recruiting 상태의 예약만 계산
        const status = (reservation.status || '').toString().toLowerCase()
        if (status === 'confirmed' || status === 'recruiting') {
          total += reservation.total_people || 0
        }
      }
    }
    
    return total
  }, [allReservations, normalizeReservationIds])

  // 같은 상품/날짜의 전체 인원 계산 (Recruiting/Confirmed만)
  const getTotalPeopleSameProductDateFiltered = useCallback((tour: ExtendedTour) => {
    const key = `${(tour.product_id ? String(tour.product_id) : '').trim()}__${(tour.tour_date ? String(tour.tour_date) : '').trim()}`
    return productDateKeyToTotalPeopleFiltered.get(key) || 0
  }, [productDateKeyToTotalPeopleFiltered])

  // 같은 상품/날짜의 전체 인원 계산 (상태 무관)
  const getTotalPeopleSameProductDateAll = useCallback((tour: ExtendedTour) => {
    const key = `${(tour.product_id ? String(tour.product_id) : '').trim()}__${(tour.tour_date ? String(tour.tour_date) : '').trim()}`
    return productDateKeyToTotalPeopleAll.get(key) || 0
  }, [productDateKeyToTotalPeopleAll])

  // 현재 달력에 표시된 투어들의 상품 메타(이름, 서브카테고리) 로드
  useEffect(() => {
    const loadProductMeta = async () => {
      try {
        const ids = Array.from(new Set((tours || []).map(t => (t.product_id ? String(t.product_id) : '').trim()).filter(Boolean)))
        if (ids.length === 0) return

        // 이미 로드된 항목 제외
        const missing = ids.filter(id => !productMetaById[id])
        if (missing.length === 0) return

        const { data, error } = await supabase
          .from('products')
          .select('id, name, name_ko, name_en, sub_category')
          .in('id', missing)

        if (error) {
          console.warn('제품 메타 로드 실패:', error)
          return
        }

        const next: {[id: string]: { name: string; sub_category: string }} = {}
        ;(data as Array<{ id: string; name?: string | null; name_ko?: string | null; name_en?: string | null; sub_category?: string | null }> | null || []).forEach((p) => {
          const label = (p.name as string) || p.name_ko || p.name_en || p.id
          next[p.id] = { name: label, sub_category: p.sub_category || '' }
        })

        setProductMetaById(prev => ({ ...prev, ...next }))
      } catch (e) {
        console.warn('제품 메타 로드 중 예외:', e)
      }
    }
    loadProductMeta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tours])

  // 상품 색상 범례 (Mania Tour / Mania Service만)
  const productLegend = useMemo(() => {
    const allowed = new Set(['Mania Tour', 'Mania Service'])
    const added = new Set<string>()
    const items: Array<{ id: string; label: string; colorClass: string }> = []
    for (const t of tours || []) {
      const pid = (t.product_id ? String(t.product_id) : '').trim()
      if (!pid || added.has(pid)) continue
      const meta = productMetaById[pid]
      if (!meta) continue
      if (!allowed.has(meta.sub_category)) continue
      items.push({ id: pid, label: meta.name, colorClass: getProductColor(pid) })
      added.add(pid)
    }
    return items
  }, [tours, productMetaById, getProductColor])

  return (
    <div className="bg-white rounded-lg shadow-md border p-2 sm:p-4">
      {/* 달력 헤더 */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
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
          <span className="text-sm sm:text-base font-medium text-gray-900">
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
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((day, index) => (
          <div
            key={day}
            className={`p-1 text-center text-sm font-medium ${
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
              className={`min-h-[120px] p-1 border border-gray-200 ${
                isCurrentMonthDay ? 'bg-white' : 'bg-gray-50'
              } ${isTodayDate ? 'ring-2 ring-blue-500' : ''}`}
            >
              {/* 날짜 */}
              <div className={`text-sm font-medium mb-0.5 ${
                isCurrentMonthDay ? 'text-gray-900' : 'text-gray-400'
              } ${isTodayDate ? 'text-blue-600 font-bold' : ''}`}>
                {date.getDate()}
              </div>

              {/* 투어 라벨들 */}
              <div className="space-y-0.5">
                {dayTours.map((tour, tourIndex) => {
                  // 인원 계산
                  const assignedPeople = getAssignedPeople(tour)
                  const totalPeopleFiltered = getTotalPeopleSameProductDateFiltered(tour)
                  const totalPeopleAll = getTotalPeopleSameProductDateAll(tour)
                  const othersPeople = Math.max(totalPeopleAll - totalPeopleFiltered, 0)

                  // 단독투어 여부 확인
                  const isPrivateTour = (typeof tour.is_private_tour === 'string'
                    ? tour.is_private_tour === 'TRUE'
                    : !!tour.is_private_tour)
                  
                  // 고유한 key 생성: tour.id + tourIndex + date 정보를 조합
                  const uniqueKey = `${tour.id}-${tourIndex}-${date.getTime()}`
                  
                  return (
                    <div
                      key={uniqueKey}
                      onClick={() => onTourClick(tour)}
                      onMouseEnter={(e) => handleMouseEnter(tour, e)}
                      onMouseLeave={handleMouseLeave}
                      className={`text-[10px] sm:text-xs px-0.5 sm:px-1 py-0.5 rounded cursor-pointer text-white hover:opacity-80 transition-opacity ${
                        getProductColor(tour.product_id)
                      } ${
                        isPrivateTour ? 'ring-2 ring-purple-400 ring-opacity-100' : ''
                      }`}
                    >
                      <div className="whitespace-normal break-words leading-tight sm:whitespace-nowrap sm:truncate">
                        <span className={`font-medium ${isPrivateTour ? 'text-purple-100' : ''}`}>
                          {isPrivateTour ? '🔒 ' : ''}{tour.product_name || tour.product_id}
                        </span>
                        <span className="mx-0.5 sm:mx-1">{assignedPeople}/{totalPeopleFiltered} ({othersPeople})</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 상품 색상 범례 (Mania Tour / Mania Service만) */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">상품 색상</h3>
        <div className="flex flex-wrap gap-3">
          {productLegend.length > 0 ? (
            productLegend.map((p: { id: string; label: string; colorClass: string }) => (
              <div key={p.id} className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${p.colorClass}`} />
                <span className="text-sm text-gray-600">{p.label}</span>
              </div>
            ))
          ) : (
            <span className="text-sm text-gray-500">표시할 상품 색상이 없습니다 (Mania Tour / Mania Service)</span>
          )}
        </div>
        
        {/* 단독투어 범례 */}
        <div className="mt-3">
          <h3 className="text-sm font-medium text-gray-700 mb-2">투어 유형</h3>
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

      {/* 호버 툴팁 */}
      {hoveredTour && (
        <div
          className="absolute z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-3 max-w-xs pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          <div className="text-sm">
            <div className="font-semibold text-gray-900 mb-2 border-b border-gray-200 pb-1">
              {hoveredTour.product_name || hoveredTour.product_id}
            </div>
            
            {/* 인원 정보 */}
            <div className="mb-2 text-xs text-gray-600">
              배정: {hoveredTour.assigned_people || 0}명 / 총: {hoveredTour.total_people || 0}명
              {hoveredTour.is_private_tour && <span className="ml-1 text-purple-600">(단독투어)</span>}
            </div>
            
            <div className="space-y-1.5">
              {hoveredTour.guide_name && (
                <div className="flex items-center">
                  <span className="text-gray-600 w-20 text-xs">가이드:</span>
                  <span className="text-gray-900 font-medium text-sm">{hoveredTour.guide_name}</span>
                </div>
              )}
              
              {hoveredTour.assistant_name && (
                <div className="flex items-center">
                  <span className="text-gray-600 w-20 text-xs">어시스턴트:</span>
                  <span className="text-gray-900 font-medium text-sm">{hoveredTour.assistant_name}</span>
                </div>
              )}
              
              {hoveredTour.vehicle_number && (
                <div className="flex items-center">
                  <span className="text-gray-600 w-20 text-xs">차량:</span>
                  <span className="text-gray-900 font-medium text-sm">{hoveredTour.vehicle_number}</span>
                </div>
              )}
              
              {!hoveredTour.guide_name && !hoveredTour.assistant_name && !hoveredTour.vehicle_number && (
                <div className="text-gray-500 text-xs italic">
                  배정된 가이드, 어시스턴트, 차량 정보가 없습니다.
                </div>
              )}
            </div>
          </div>
          
          {/* 툴팁 화살표 */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-300"></div>
          </div>
        </div>
      )}
    </div>
  )
})

export default TourCalendar
