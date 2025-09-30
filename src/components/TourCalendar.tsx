'use client'

import { useState, useMemo, useCallback, memo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react'
import type { Database } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'

type Tour = Database['public']['Tables']['tours']['Row']

interface ExtendedTour extends Tour {
  product_name?: string | null;
  internal_name_ko?: string | null;
  internal_name_en?: string | null;
  customer_name_ko?: string | null;
  customer_name_en?: string | null;
  total_people?: number;
  assigned_people?: number;
  unassigned_people?: number;
  guide_name?: string | null;
  assistant_name?: string | null;
  vehicle_number?: string | null;
}

interface OffSchedule {
  id: string
  team_email: string
  off_date: string
  reason: string
  status: string
  approved_by?: string | null
  approved_at?: string | null
  created_at: string
  updated_at: string
}

interface TourCalendarProps {
  tours: ExtendedTour[]
  onTourClick: (tour: ExtendedTour) => void
  allReservations?: Database['public']['Tables']['reservations']['Row'][]
  offSchedules?: OffSchedule[]
  onOffScheduleChange?: () => void
}

const TourCalendar = memo(function TourCalendar({ tours, onTourClick, allReservations = [], offSchedules = [], onOffScheduleChange }: TourCalendarProps) {
  const { user, simulatedUser, isSimulating } = useAuth()
  const t = useTranslations('tours.calendar')
  
  // 투어 이름 매핑 함수 (내부용 간단한 이름 사용)
  const getTourDisplayName = (tour: ExtendedTour) => {
    // 내부용 간단한 이름이 있으면 사용, 없으면 기존 방식 사용
    if (tour.internal_name_ko && tour.internal_name_en) {
      // 현재 로케일에 따라 적절한 내부용 이름 반환
      const locale = document.documentElement.lang || 'ko'
      return locale === 'en' ? tour.internal_name_en : tour.internal_name_ko
    }
    
    // 기존 방식 (fallback)
    const tourName = tour.product_name || tour.product_id
    try {
      // 한글 상품명을 영문으로 번역
      const translatedName = t(`tourNameMapping.${tourName}`)
      // 번역이 실패하거나 원본과 같으면 원본 반환
      return translatedName && translatedName !== `tourNameMapping.${tourName}` ? translatedName : tourName
    } catch (error) {
      // 번역 실패 시 원본 이름 반환
      console.warn(`Translation failed for tour name: ${tourName}`, error)
      return tourName
    }
  }
  const [currentDate, setCurrentDate] = useState(new Date())
  const [productMetaById, setProductMetaById] = useState<{[id: string]: { name: string; sub_category: string }}>({})
  const [hoveredTour, setHoveredTour] = useState<ExtendedTour | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [showOffScheduleModal, setShowOffScheduleModal] = useState(false)
  const [selectedOffSchedule, setSelectedOffSchedule] = useState<OffSchedule | null>(null)
  const [offScheduleForm, setOffScheduleForm] = useState({
    off_date: '',
    reason: '',
    is_multi_day: false,
    end_date: ''
  })

  // 현재 사용자 이메일 가져오기
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email

  // 오프 스케줄 모달 열기
  const openOffScheduleModal = useCallback((date: Date, existingSchedule?: OffSchedule) => {
    const dateString = date.toISOString().split('T')[0]
    setSelectedOffSchedule(existingSchedule || null)
    setOffScheduleForm({
      off_date: dateString,
      reason: existingSchedule?.reason || '',
      is_multi_day: false,
      end_date: ''
    })
    setShowOffScheduleModal(true)
  }, [])

  // 오프 스케줄 모달 닫기
  const closeOffScheduleModal = useCallback(() => {
    setShowOffScheduleModal(false)
    setSelectedOffSchedule(null)
    setOffScheduleForm({ off_date: '', reason: '', is_multi_day: false, end_date: '' })
  }, [])

  // 오프 스케줄 저장/수정
  const handleOffScheduleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentUserEmail || !offScheduleForm.off_date || !offScheduleForm.reason.trim()) {
      alert('날짜와 사유를 모두 입력해주세요.')
      return
    }

    if (offScheduleForm.is_multi_day && (!offScheduleForm.end_date || offScheduleForm.end_date < offScheduleForm.off_date)) {
      alert('종료 날짜를 시작 날짜 이후로 설정해주세요.')
      return
    }

    try {
      if (selectedOffSchedule) {
        // 수정 (단일 날짜만)
        const { error } = await supabase
          .from('off_schedules')
          .update({
            off_date: offScheduleForm.off_date,
            reason: offScheduleForm.reason.trim()
          } as any)
          .eq('id', selectedOffSchedule.id)
          .eq('team_email', currentUserEmail)

        if (error) throw error
        alert('오프 스케줄이 수정되었습니다.')
      } else {
        // 새로 추가 (멀티 데이 지원)
        const startDate = new Date(offScheduleForm.off_date)
        const endDate = offScheduleForm.is_multi_day ? new Date(offScheduleForm.end_date) : startDate
        
        // 날짜 범위 생성
        const dates = []
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          dates.push(currentDate.toISOString().split('T')[0])
          currentDate.setDate(currentDate.getDate() + 1)
        }

        // 각 날짜에 대해 오프 스케줄 생성
        const insertPromises = dates.map(date => 
          supabase
            .from('off_schedules')
            .insert({
              team_email: currentUserEmail,
              off_date: date,
              reason: offScheduleForm.reason.trim()
            } as any)
        )

        const results = await Promise.all(insertPromises)
        
        // 에러 확인
        const errors = results.filter(result => result.error)
        if (errors.length > 0) {
          throw errors[0].error
        }

        alert(`${dates.length}${t('offScheduleAdded')}`)
      }

      closeOffScheduleModal()
      if (onOffScheduleChange) {
        onOffScheduleChange()
      }
    } catch (error) {
      console.error('Error saving off schedule:', error)
      alert('오프 스케줄 저장 중 오류가 발생했습니다.')
    }
  }, [currentUserEmail, offScheduleForm, selectedOffSchedule, closeOffScheduleModal, onOffScheduleChange])

  // 오프 스케줄 삭제
  const handleOffScheduleDelete = useCallback(async () => {
    if (!selectedOffSchedule || !currentUserEmail) return

    if (!confirm('정말로 이 오프 스케줄을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('off_schedules')
        .delete()
        .eq('id', selectedOffSchedule.id)
        .eq('team_email', currentUserEmail)

      if (error) throw error
      alert('오프 스케줄이 삭제되었습니다.')
      closeOffScheduleModal()
      if (onOffScheduleChange) {
        onOffScheduleChange()
      }
    } catch (error) {
      console.error('Error deleting off schedule:', error)
      alert('오프 스케줄 삭제 중 오류가 발생했습니다.')
    }
  }, [selectedOffSchedule, currentUserEmail, closeOffScheduleModal, onOffScheduleChange])

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

  // 특정 날짜의 오프 스케줄 가져오기 (메모이제이션)
  const getOffSchedulesForDate = useCallback((date: Date) => {
    const dateString = date.toISOString().split('T')[0] // YYYY-MM-DD 형식
    return offSchedules.filter(schedule => schedule.off_date === dateString)
  }, [offSchedules])

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
  const getProductColor = useCallback((productId: string | null, productName?: string | null) => {
    // 도깨비 투어는 보라색으로 고정
    const productNameStr = (productName || '').toLowerCase()
    if (productNameStr.includes('도깨비') || productNameStr.includes('goblin')) {
      return 'bg-purple-600'  // 도깨비 투어 전용 보라색
    }
    
    // 오프 스케줄 색상과 구분되는 상품 전용 색상 팔레트
    const colors = [
      'bg-blue-600',      // 진한 파란색
      'bg-orange-600',    // 진한 주황색
      'bg-pink-600',      // 진한 분홍색
      'bg-indigo-600',    // 진한 남색
      'bg-teal-600',      // 진한 청록색
      'bg-cyan-600',      // 진한 하늘색
      'bg-emerald-600',   // 진한 에메랄드색
      'bg-violet-600',    // 진한 바이올렛색
      'bg-rose-600',      // 진한 로즈색
      'bg-sky-600',       // 진한 스카이색
      'bg-lime-600'       // 진한 라임색
    ]
    
    // productId가 null이거나 빈 문자열인 경우 기본 색상 반환
    if (!productId) {
      return 'bg-slate-600'  // 오프 스케줄과 구분되는 회색
    }
    
    // productId의 해시값을 사용하여 일관된 색상 선택
    let hash = 0
    for (let i = 0; i < productId.length; i++) {
      hash = productId.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }, [])


  const monthNames = [
    t('months.0'), t('months.1'), t('months.2'), t('months.3'), t('months.4'), t('months.5'),
    t('months.6'), t('months.7'), t('months.8'), t('months.9'), t('months.10'), t('months.11')
  ]
  const dayNames = [
    t('days.0'), t('days.1'), t('days.2'), t('days.3'), t('days.4'), t('days.5'), t('days.6')
  ]

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
    for (const tour of tours || []) {
      const pid = (tour.product_id ? String(tour.product_id) : '').trim()
      if (!pid || added.has(pid)) continue
      const meta = productMetaById[pid]
      if (!meta) continue
      if (!allowed.has(meta.sub_category)) continue
      // 한글 상품명을 영어로 번역
      const translatedName = t(`tourNameMapping.${meta.name}`) || meta.name
      items.push({ id: pid, label: translatedName, colorClass: getProductColor(pid, meta.name) })
      added.add(pid)
    }
    return items
  }, [tours, productMetaById, getProductColor, t])

  return (
    <div className="bg-white rounded-lg shadow-md border p-2 sm:p-4">
      {/* 달력 헤더 */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <CalendarIcon className="w-5 h-5 mr-2" />
          {t('reservationCalendar')}
        </h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm sm:text-base font-medium text-gray-900">
            {currentDate.getFullYear()}{t('yearUnit')} {monthNames[currentDate.getMonth()]}
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
      <div className="grid grid-cols-7 gap-px mb-1">
        {dayNames.map((day, index) => (
          <div
            key={day}
            className={`p-1 text-center text-xs font-medium ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((date, index) => {
          const dayTours = getToursForDate(date)
          const dayOffSchedules = getOffSchedulesForDate(date)
          const isCurrentMonthDay = isCurrentMonth(date)
          const isTodayDate = isToday(date)

          return (
            <div
              key={index}
              className={`min-h-[120px] p-px border border-gray-200 ${
                isCurrentMonthDay ? 'bg-white' : 'bg-gray-50'
              } ${isTodayDate ? 'ring-2 ring-blue-500' : ''} ${
                isCurrentMonthDay ? 'cursor-pointer hover:bg-gray-50' : ''
              }`}
              onClick={() => {
                if (isCurrentMonthDay) {
                  // 기존 오프 스케줄이 있으면 수정, 없으면 새로 추가
                  const existingSchedule = dayOffSchedules.find(s => s.team_email === currentUserEmail)
                  openOffScheduleModal(date, existingSchedule)
                }
              }}
            >
              {/* 날짜 */}
              <div className={`text-xs font-medium mb-0.5 ml-[3px] mt-[3px] ${
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
                      className={`text-[8px] sm:text-[10px] px-px py-0.5 rounded cursor-pointer text-white hover:opacity-80 transition-opacity ${
                        getProductColor(tour.product_id, tour.product_name)
                      } ${
                        isPrivateTour ? 'ring-2 ring-purple-400 ring-opacity-100' : ''
                      }`}
                    >
                      <div className="whitespace-normal break-words leading-tight sm:whitespace-nowrap sm:truncate">
                        <span className={`font-medium ${isPrivateTour ? 'text-purple-100' : ''}`}>
                          {isPrivateTour ? '🔒 ' : ''}{getTourDisplayName(tour)}
                        </span>
                        <span className="mx-0.5 sm:mx-1">{assignedPeople}/{totalPeopleFiltered} ({othersPeople})</span>
                      </div>
                    </div>
                  )
                })}
                
                {/* 오프 스케줄 라벨들 */}
                {dayOffSchedules.map((schedule, scheduleIndex) => {
                  const statusColor = schedule.status === 'approved' ? 'bg-green-500' : 
                                    schedule.status === 'pending' ? 'bg-yellow-500' : 
                                    schedule.status === 'rejected' ? 'bg-red-500' : 'bg-gray-500'
                  
                  const statusText = schedule.status?.toLowerCase() === 'approved' ? t('offSchedule.status.approved') : 
                                   schedule.status?.toLowerCase() === 'pending' ? t('offSchedule.status.pending') : 
                                   schedule.status?.toLowerCase() === 'rejected' ? t('offSchedule.status.rejected') : schedule.status
                  
                  return (
                    <div
                      key={`off-${schedule.id}-${scheduleIndex}`}
                      className={`text-[8px] sm:text-[10px] px-px py-0.5 rounded cursor-default text-white ${statusColor}`}
                      title={`오프 스케줄: ${schedule.reason} (${statusText})`}
                    >
                      <div className="whitespace-normal break-words leading-tight sm:whitespace-nowrap sm:truncate">
                        <span className="font-medium">🏖️ {statusText}</span>
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
        <h3 className="text-sm font-medium text-gray-700 mb-2">{t('productColors')}</h3>
        <div className="flex flex-wrap gap-3">
          {productLegend.length > 0 ? (
            productLegend.map((p: { id: string; label: string; colorClass: string }) => (
              <div key={p.id} className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${p.colorClass}`} />
                <span className="text-sm text-gray-600">{p.label}</span>
              </div>
            ))
          ) : (
            <span className="text-sm text-gray-500">{t('noProductColors')}</span>
          )}
        </div>
        
        {/* 단독투어 범례 */}
        <div className="mt-3">
          <h3 className="text-sm font-medium text-gray-700 mb-2">{t('tourType')}</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-purple-400 ring-2 ring-purple-400 ring-opacity-50" />
              <span className="text-sm text-gray-600">{t('privateTour')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm text-gray-600">{t('regularTour')}</span>
            </div>
          </div>
        </div>
        
        {/* 오프 스케줄 범례 */}
        <div className="mt-3">
          <h3 className="text-sm font-medium text-gray-700 mb-2">{t('offScheduleLegend')}</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600">{t('offSchedule.status.approved')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm text-gray-600">{t('offSchedule.status.pending')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-gray-600">{t('offSchedule.status.rejected')}</span>
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
              {getTourDisplayName(hoveredTour)}
            </div>
            
            {/* 인원 정보 */}
            <div className="mb-2 text-xs text-gray-600">
              {t('assignedPeople')}: {hoveredTour.assigned_people || 0}{t('peopleUnit')} / {t('totalPeople')}: {hoveredTour.total_people || 0}{t('peopleUnit')}
              {hoveredTour.is_private_tour && <span className="ml-1 text-purple-600">({t('privateTour')})</span>}
            </div>
            
            <div className="space-y-1.5">
              {hoveredTour.guide_name && (
                <div className="flex items-center">
                  <span className="text-gray-600 w-20 text-xs">{t('guide')}</span>
                  <span className="text-gray-900 font-medium text-sm">{hoveredTour.guide_name}</span>
                </div>
              )}
              
              {hoveredTour.assistant_name && (
                <div className="flex items-center">
                  <span className="text-gray-600 w-20 text-xs">{t('assistant')}</span>
                  <span className="text-gray-900 font-medium text-sm">{hoveredTour.assistant_name}</span>
                </div>
              )}
              
              {hoveredTour.vehicle_number && (
                <div className="flex items-center">
                  <span className="text-gray-600 w-20 text-xs">{t('vehicle')}</span>
                  <span className="text-gray-900 font-medium text-sm">{hoveredTour.vehicle_number}</span>
                </div>
              )}
              
              {!hoveredTour.guide_name && !hoveredTour.assistant_name && !hoveredTour.vehicle_number && (
                <div className="text-gray-500 text-xs italic">
                  {t('noStaffInfo')}
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

      {/* 오프 스케줄 모달 */}
      {showOffScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xs w-full max-h-[75vh] overflow-y-auto relative top-0 left-0 right-0 bottom-0 m-auto">
            <div className="flex items-center justify-between p-3 sm:p-6 border-b">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                {selectedOffSchedule ? t('offSchedule.editTitle') : t('offSchedule.addTitle')}
              </h3>
              <button
                onClick={closeOffScheduleModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            <form onSubmit={handleOffScheduleSubmit} className="p-3 sm:p-6 space-y-3">
              {/* 현재 상태 표시 (수정 모드일 때만) */}
              {selectedOffSchedule && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('offSchedule.currentStatus')}
                  </label>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    selectedOffSchedule.status === 'approved' ? 'bg-green-100 text-green-800' :
                    selectedOffSchedule.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    selectedOffSchedule.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedOffSchedule.status === 'approved' ? t('offSchedule.status.approved') :
                     selectedOffSchedule.status === 'pending' ? t('offSchedule.status.pending') :
                     selectedOffSchedule.status === 'rejected' ? t('offSchedule.status.rejected') :
                     selectedOffSchedule.status}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('offSchedule.startDate')}
                </label>
                <input
                  type="date"
                  value={offScheduleForm.off_date}
                  onChange={(e) => setOffScheduleForm({ ...offScheduleForm, off_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>

              {!selectedOffSchedule && (
                <>
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={offScheduleForm.is_multi_day}
                        onChange={(e) => setOffScheduleForm({ 
                          ...offScheduleForm, 
                          is_multi_day: e.target.checked,
                          end_date: e.target.checked ? offScheduleForm.end_date : ''
                        })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span className="text-xs sm:text-sm font-medium text-gray-700">{t('offSchedule.multiDay')}</span>
                    </label>
                  </div>

                  {offScheduleForm.is_multi_day && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('offSchedule.endDate')}
                      </label>
                      <input
                        type="date"
                        value={offScheduleForm.end_date}
                        onChange={(e) => setOffScheduleForm({ ...offScheduleForm, end_date: e.target.value })}
                        min={offScheduleForm.off_date || new Date().toISOString().split('T')[0]}
                        className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        required={offScheduleForm.is_multi_day}
                      />
                    </div>
                  )}
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('offSchedule.reason')}
                </label>
                <textarea
                  value={offScheduleForm.reason || ''}
                  onChange={(e) => setOffScheduleForm({ ...offScheduleForm, reason: e.target.value })}
                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={2}
                  placeholder={t('offSchedule.reasonPlaceholder')}
                  required
                />
              </div>
              
              <div className="flex space-x-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  {selectedOffSchedule ? t('offSchedule.editButton') : t('offSchedule.addButton')}
                </button>
                {selectedOffSchedule && (
                  <button
                    type="button"
                    onClick={handleOffScheduleDelete}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    {t('offSchedule.deleteButton')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeOffScheduleModal}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
})

export default TourCalendar
