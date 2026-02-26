'use client'

import React, { useState, useMemo, useCallback, memo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X as XIcon } from 'lucide-react'
import type { Database } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations, useLocale } from 'next-intl'

type Tour = Database['public']['Tables']['tours']['Row']

interface ExtendedTour extends Omit<Tour, 'assignment_status'> {
  product_name?: string | null | undefined;
  name?: string | null | undefined;
  name_ko?: string | null | undefined;
  name_en?: string | null | undefined;
  assignment_status?: string | null | undefined;
  total_people?: number | undefined;
  assigned_people?: number | undefined;
  assigned_adults?: number | undefined;
  assigned_children?: number | undefined;
  assigned_infants?: number | undefined;
  unassigned_people?: number | undefined;
  guide_name?: string | null | undefined;
  assistant_name?: string | null | undefined;
  vehicle_number?: string | null | undefined;
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
  reservationPricingMap?: Map<string, Database['public']['Tables']['reservation_pricing']['Row']>
  offSchedules?: OffSchedule[]
  onOffScheduleChange?: () => void
  onTourStatusUpdate?: (tourId: string, newStatus: string) => Promise<void>
  userRole?: string | undefined
  userPosition?: string | null | undefined
}

const TourCalendar = memo(function TourCalendar({ tours, onTourClick, allReservations = [], reservationPricingMap = new Map(), offSchedules = [], onOffScheduleChange, onTourStatusUpdate, userRole, userPosition }: TourCalendarProps) {
  const { user, simulatedUser, isSimulating } = useAuth()
  const t = useTranslations('tours.calendar')
  const locale = useLocale()
  
  // 투어 상태 변경 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    tour: ExtendedTour
    x: number
    y: number
  } | null>(null)
  
  // 투어 이름 매핑 함수 — 상품 name을 처음부터 사용(name_ko 별도 로드 없음)
  const getTourDisplayName = (tour: ExtendedTour) => {
    // 상품 name이 processToursData에서 이미 채워져 있음 → 별도 로드 없이 사용
    const primaryName = tour.name || tour.product_name
    if (primaryName) {
      return primaryName
    }
    // locale별 fallback
    if (locale === 'en' && tour.name_en) {
      return tour.name_en
    }
    if (tour.name_ko || tour.name_en) {
      return tour.name_ko || tour.name_en || tour.product_id || ''
    }
    
    const tourName = tour.product_id || ''
    try {
      // 번역 키 존재 여부 확인
      const translationKey = `tourNameMapping.${tourName}`
      
      try {
        const translatedName = t(translationKey)
        // 번역이 성공하고 원본과 다르면 번역된 이름 반환
        return translatedName && translatedName !== translationKey ? translatedName : tourName
      } catch {
        // 번역 키가 없으면 원본 이름 반환
        console.warn(`Translation key not found for tour name: ${tourName}`)
        return tourName
      }
    } catch (error) {
      // 번역 실패 시 원본 이름 반환
      console.warn(`Translation failed for tour name: ${tourName}`, error)
      return tourName
    }
  }

  // locale별 상품 표시명: 한국어=name 컬럼, 영문=name_en 컬럼
  const getProductDisplayName = useCallback((meta: { name?: string; name_ko?: string | null; name_en?: string | null } | undefined) => {
    if (!meta) return ''
    if (locale === 'ko') return (meta.name || meta.name_ko || meta.name_en || '').trim() || ''
    return (meta.name_en || meta.name || meta.name_ko || '').trim() || ''
  }, [locale])

  const [currentDate, setCurrentDate] = useState(new Date())
  const [productMetaById, setProductMetaById] = useState<{[id: string]: { name: string; name_ko?: string | null; name_en?: string | null; sub_category: string }}>({})
  const [choiceSummaryByTourId, setChoiceSummaryByTourId] = useState<Record<string, Record<string, number>>>({})
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
  const [updatingTourStatus, setUpdatingTourStatus] = useState<string | null>(null)
  
  // 투어 상태 옵션
  const tourStatusOptions = [
    { value: 'Recruiting', label: locale === 'ko' ? '모집중' : 'Recruiting', icon: '📢' },
    { value: 'Confirmed', label: locale === 'ko' ? '확정' : 'Confirmed', icon: '✓' },
    { value: 'Canceled - No Minimum', label: locale === 'ko' ? '취소 - 최소인원 미달' : 'Canceled - No Minimum', icon: '🚫' },
    { value: 'Canceled - by customer', label: locale === 'ko' ? '취소 - 고객 요청' : 'Canceled - by customer', icon: '🚫' },
    { value: 'Canceled - No Answer', label: locale === 'ko' ? '취소 - 응답 없음' : 'Canceled - No Answer', icon: '🚫' },
    { value: 'Canceled - Event Closed', label: locale === 'ko' ? '취소 - 이벤트 종료' : 'Canceled - Event Closed', icon: '🚫' },
    { value: 'Deleted', label: locale === 'ko' ? '삭제됨' : 'Deleted', icon: '🗑️' },
    { value: 'Approved', label: locale === 'ko' ? '승인됨' : 'Approved', icon: '✅' },
    { value: 'Requested', label: locale === 'ko' ? '요청됨' : 'Requested', icon: '📝' }
  ]
  
  // 우클릭 핸들러
  const handleContextMenu = useCallback((e: React.MouseEvent, tour: ExtendedTour) => {
    e.preventDefault()
    e.stopPropagation()
    
    // 관리자/매니저/OP만 상태 변경 가능
    // OP는 roles.ts에서 'admin' 역할로 반환되므로 userRole === 'admin'이면 OP도 포함됨
    // 추가로 position을 직접 확인하여 OP도 명시적으로 허용
    const normalizedPosition = userPosition?.toLowerCase() || ''
    const isOP = normalizedPosition === 'op'
    const canChangeStatus = userRole === 'admin' || userRole === 'manager' || isOP
    
    if (!canChangeStatus) {
      return
    }
    
    setContextMenu({
      tour,
      x: e.clientX,
      y: e.clientY
    })
  }, [userRole, userPosition])
  
  // 컨텍스트 메뉴 닫기
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])
  
  // 투어 상태 변경 핸들러
  const handleTourStatusChange = useCallback(async (tourId: string, newStatus: string) => {
    if (!onTourStatusUpdate) return
    
    setUpdatingTourStatus(tourId)
    try {
      await onTourStatusUpdate(tourId, newStatus)
      closeContextMenu()
    } catch (error) {
      console.error('Error updating tour status:', error)
      alert(locale === 'ko' ? '투어 상태 업데이트에 실패했습니다.' : 'Failed to update tour status.')
    } finally {
      setUpdatingTourStatus(null)
    }
  }, [onTourStatusUpdate, closeContextMenu, locale])
  
  // 외부 클릭 시 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        closeContextMenu()
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu, closeContextMenu])

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('off_schedules')
          .update({
            off_date: offScheduleForm.off_date,
            reason: offScheduleForm.reason.trim()
          })
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from('off_schedules')
            .insert({
              team_email: currentUserEmail,
              off_date: date,
              reason: offScheduleForm.reason.trim()
            })
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
  }, [currentUserEmail, offScheduleForm, selectedOffSchedule, closeOffScheduleModal, onOffScheduleChange, t])

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
    
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
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
      // Postgres text[] 형식 {uuid1,uuid2}
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const inner = trimmed.slice(1, -1).trim()
        return inner ? inner.split(',').map(s => s.trim()).filter(s => s.length > 0) : []
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

  // 투어별 밸런스 확인: reservation_ids에 있는 예약들의 balance_amount 확인
  const hasBalance = useCallback((tour: ExtendedTour) => {
    const ids = normalizeReservationIds(tour.reservation_ids as unknown)
    if (ids.length === 0) return false
    
    // 중복 제거
    const uniqueIds = [...new Set(ids)]
    
    for (const id of uniqueIds) {
      const pricing = reservationPricingMap.get(id)
      if (pricing) {
        const balanceAmount = typeof pricing.balance_amount === 'string'
          ? parseFloat(pricing.balance_amount) || 0
          : (pricing.balance_amount || 0)
        if (balanceAmount > 0) {
          return true
        }
      }
    }
    
    return false
  }, [reservationPricingMap, normalizeReservationIds])

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

        const next: {[id: string]: { name: string; name_ko?: string | null; name_en?: string | null; sub_category: string }} = {}
        ;(data as Array<{ id: string; name?: string | null; name_ko?: string | null; name_en?: string | null; sub_category?: string | null }> | null || []).forEach((p) => {
          next[p.id] = {
            name: p.name ?? '',
            name_ko: p.name_ko ?? null,
            name_en: p.name_en ?? null,
            sub_category: p.sub_category || ''
          }
        })

        setProductMetaById(prev => ({ ...prev, ...next }))
      } catch (e) {
        console.warn('제품 메타 로드 중 예외:', e)
      }
    }
    loadProductMeta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tours])

  // 투어별 초이스 합계 로드 — 스케줄 뷰·투어 상세 모달과 동일: "초이스: X : 2 / L : 5"
  useEffect(() => {
    const loadChoiceSummaries = async () => {
      const reservationIds = new Set<string>()
      for (const tour of tours || []) {
        const ids = normalizeReservationIds(tour.reservation_ids as unknown)
        for (const id of ids) {
          const rid = String(id).trim()
          if (rid) reservationIds.add(rid)
        }
      }
      if (reservationIds.size === 0) {
        setChoiceSummaryByTourId({})
        return
      }
      const isUuid = (s: string | null | undefined) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((s || '').trim())
      const choiceLabelToKey = (nameKo: string | null | undefined, nameEn: string | null | undefined, optionKey: string | null | undefined): string => {
        const label = (nameKo || nameEn || (optionKey && !isUuid(optionKey) ? optionKey : '') || '').toString().trim()
        const labelLower = label.toLowerCase()
        const labelKo = label
        if (labelLower.includes('antelope x canyon') || /엑스\s*앤텔롭|엑스\s*앤틸롭|엑스\s*엔텔롭/.test(labelKo)) return 'X'
        if (labelLower.includes('lower antelope canyon') || /로어\s*앤텔롭|로어\s*앤틸롭|로어\s*엔텔롭/.test(labelKo)) return 'L'
        if (labelLower.includes('upper antelope canyon') || /어퍼\s*앤텔롭|어퍼\s*앤틸롭|어퍼\s*엔텔롭/.test(labelKo)) return 'U'
        if (labelLower.includes('antelope x') || labelLower.includes(' x ')) return 'X'
        if (labelLower.includes('lower')) return 'L'
        if (labelLower.includes('upper')) return 'U'
        return '_other'
      }
      try {
        const idsArray = Array.from(reservationIds)
        const BATCH = 100
        let choicesFlat: Array<{ reservation_id: string; choiceKey: string; quantity: number }> = []
        for (let i = 0; i < idsArray.length; i += BATCH) {
          const batchIds = idsArray.slice(i, i + BATCH)
          const { data: rcData, error } = await supabase
            .from('reservation_choices')
            .select('reservation_id, quantity, choice_options!inner(option_key, option_name_ko, option_name)')
            .in('reservation_id', batchIds)
          if (error) {
            console.warn('초이스 합계 로드 실패:', error)
            setChoiceSummaryByTourId({})
            return
          }
          const rows = (rcData || []) as Array<{
            reservation_id: string
            quantity?: number | null
            choice_options?: { option_key?: string | null; option_name_ko?: string | null; option_name?: string | null } | null
          }>
          choicesFlat = choicesFlat.concat(rows.map((row) => {
            const opt = row.choice_options
            const choiceKey = choiceLabelToKey(opt?.option_name_ko ?? null, opt?.option_name ?? null, opt?.option_key ?? null)
            return { reservation_id: row.reservation_id, choiceKey, quantity: Number(row.quantity) || 1 }
          }))
        }
        const choiceRowsByResId = new Map<string, Array<{ choiceKey: string; quantity: number }>>()
        choicesFlat.forEach((c) => {
          const list = choiceRowsByResId.get(c.reservation_id) || []
          list.push({ choiceKey: c.choiceKey, quantity: c.quantity })
          choiceRowsByResId.set(c.reservation_id, list)
        })
        const displayOrder = ['X', 'L', 'U', '_other']
        const next: Record<string, Record<string, number>> = {}
        for (const tour of tours || []) {
          const tourIdKey = tour.id != null ? String(tour.id) : ''
          if (!tourIdKey) continue
          const assignedIds = new Set(normalizeReservationIds(tour.reservation_ids as unknown))
          const assignedResList = allReservations.filter((r) => assignedIds.has(String(r.id)))
          const choiceCounts: Record<string, number> = {}
          assignedResList.forEach((res) => {
            const rows = choiceRowsByResId.get(String(res.id)) || []
            const people = res.total_people || 0
            if (rows.length === 0) return
            if (rows.length === 1) {
              const key = rows[0].choiceKey
              choiceCounts[key] = (choiceCounts[key] || 0) + people
            } else {
              rows.forEach((r) => {
                choiceCounts[r.choiceKey] = (choiceCounts[r.choiceKey] || 0) + r.quantity
              })
            }
          })
          const hasAny = displayOrder.some((k) => (choiceCounts[k] || 0) > 0)
          if (hasAny) {
            next[tourIdKey] = { ...choiceCounts }
          }
        }
        setChoiceSummaryByTourId(next)
      } catch (e) {
        console.warn('초이스 합계 로드 중 예외:', e)
        setChoiceSummaryByTourId({})
      }
    }
    loadChoiceSummaries()
  }, [tours, allReservations])

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
      const translatedName = getProductDisplayName(meta)
      items.push({ id: pid, label: translatedName, colorClass: getProductColor(pid, meta.name) })
      added.add(pid)
    }
    return items
  }, [tours, productMetaById, getProductColor, getProductDisplayName])

  return (
    <div className="bg-white rounded-lg shadow-md border p-1 sm:p-4">
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
            {currentDate.getFullYear()}{locale === 'ko' ? '년' : ''} {monthNames[currentDate.getMonth()]}
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
                  
                  // 배정 상태 아이콘 가져오기
                  const getAssignmentStatusIcon = (status?: string | null) => {
                    if (!status) return '⏸️' // 상태 없음
                    const normalizedStatus = String(status).toLowerCase().trim()
                    switch (normalizedStatus) {
                      case 'assigned':
                        return '⏳' // 배정됨 (오피스에서 배정)
                      case 'confirmed':
                        return '✅' // 확인됨 (가이드가 확인)
                      case 'rejected':
                        return '❌' // 거절됨 (가이드가 거절)
                      case 'pending':
                        return '⏸️' // 대기 중
                      default:
                        return '⏸️' // 기타 상태
                    }
                  }
                  
                  // 투어 상태 아이콘 가져오기
                  const getTourStatusIcon = (status?: string | null) => {
                    if (!status) return ''
                    const normalizedStatus = String(status).toLowerCase().trim()
                    // Canceled 변형들 처리
                    if (normalizedStatus.includes('canceled') || normalizedStatus.includes('cancel')) {
                      return '🚫' // 취소
                    }
                    switch (normalizedStatus) {
                      case 'recruiting':
                        return '📢' // 모집중
                      case 'confirmed':
                      case 'confirm':
                        return '✓' // 확정
                      case 'deleted':
                        return '🗑️' // 삭제됨
                      case 'approved':
                        return '✅' // 승인됨
                      case 'requested':
                        return '📝' // 요청됨
                      default:
                        return ''
                    }
                  }
                  
                  // assignment_status 확인 - 여러 방법으로 시도
                  const assignmentStatus = tour.assignment_status 
                    || (tour as any).assignment_status 
                    || (tour as Database['public']['Tables']['tours']['Row']).assignment_status
                    || null
                  
                  // tour_status 확인
                  const tourStatus = tour.tour_status 
                    || (tour as any).tour_status 
                    || (tour as Database['public']['Tables']['tours']['Row']).tour_status
                    || null
                  
                  const assignmentIcon = getAssignmentStatusIcon(assignmentStatus)
                  const tourStatusIcon = getTourStatusIcon(tourStatus)
                  
                  // 디버깅: 모든 투어의 assignment_status 확인 (개발 환경에서만)
                  if (process.env.NODE_ENV === 'development' && tourIndex === 0) {
                    console.log('Tour assignment status check:', {
                      tourId: tour.id,
                      productName: getTourDisplayName(tour),
                      assignmentStatus: assignmentStatus,
                      hasAssignmentStatus: 'assignment_status' in tour,
                      tourKeys: Object.keys(tour),
                      icon: assignmentIcon
                    })
                  }
                  
                  // 픽업 안내 미발송 예약 확인
                  const hasUnsentPickupNotification = (() => {
                    if (!tour.reservation_ids || !Array.isArray(tour.reservation_ids) || tour.reservation_ids.length === 0) {
                      return false
                    }
                    const tourReservations = allReservations.filter((r: any) => 
                      tour.reservation_ids?.includes(r.id)
                    )
                    // 픽업 시간이 있고, 픽업 안내를 보내지 않은 예약이 있는지 확인
                    return tourReservations.some((r: any) => 
                      r.pickup_time && 
                      r.pickup_time.trim() !== '' && 
                      (!r.pickup_notification_sent || r.pickup_notification_sent === false)
                    )
                  })()
                  
                  // 밸런스 확인
                  const tourHasBalance = hasBalance(tour)
                  
                  // 고유한 key 생성: tour.id + tourIndex + date 정보를 조합
                  const uniqueKey = `${tour.id}-${tourIndex}-${date.getTime()}`
                  
                  return (
                    <div
                      key={uniqueKey}
                      onClick={(e) => {
                        e.stopPropagation() // 부모 요소의 클릭 이벤트 방지
                        onTourClick(tour)
                      }}
                      onContextMenu={(e) => handleContextMenu(e, tour)}
                      onMouseEnter={(e) => handleMouseEnter(tour, e)}
                      onMouseLeave={handleMouseLeave}
                      className={`text-[8px] sm:text-[10px] px-px py-0.5 rounded cursor-pointer text-white hover:opacity-80 transition-opacity ${
                        getProductColor(tour.product_id, tour.product_name)
                      } ${
                        isPrivateTour ? 'ring-2 ring-purple-400 ring-opacity-100' : ''
                      } ${
                        hasUnsentPickupNotification ? 'ring-2 ring-red-500 ring-opacity-100' : ''
                      } ${
                        tourHasBalance ? 'ring-2 ring-yellow-400 ring-opacity-100' : ''
                      }`}
                      title={
                        (hasUnsentPickupNotification ? '픽업 안내 미발송 예약이 있습니다. ' : '') +
                        (tourHasBalance ? '밸런스가 남아 있는 투어입니다.' : '')
                      }
                    >
                      <div className="whitespace-normal break-words leading-tight sm:whitespace-nowrap sm:truncate flex flex-wrap items-baseline gap-x-0.5">
                        <span className={`font-medium ${isPrivateTour ? 'text-purple-100' : ''}`}>
                          {hasUnsentPickupNotification && <span className="inline-block mr-0.5" title="픽업 안내 미발송">📧</span>}
                          {tourHasBalance && <span className="inline-block mr-0.5" title="밸런스 남음">💲</span>}
                          {tourStatusIcon && <span className="inline-block mr-0.5">{tourStatusIcon}</span>}
                          {assignmentIcon && <span className="inline-block mr-0.5">{assignmentIcon}</span>}
                          {isPrivateTour ? '🔒 ' : ''}{getTourDisplayName(tour) || getProductDisplayName(productMetaById[tour.product_id ?? ''])}
                        </span>
                        <span className="ml-0.5 sm:ml-1">
                          {(() => {
                            const children = tour.assigned_children ?? 0
                            const infants = tour.assigned_infants ?? 0
                            const total = tour.assigned_people ?? assignedPeople
                            if (children === 0 && infants === 0) {
                              return `${total}/${totalPeopleFiltered}${othersPeople > 0 ? ` (${othersPeople})` : ''}`
                            }
                            const detailParts: string[] = []
                            if (children > 0) detailParts.push(locale === 'en' ? `Child ${children}` : `아동${children}`)
                            if (infants > 0) detailParts.push(locale === 'en' ? `Infant ${infants}` : `유아${infants}`)
                            return locale === 'en'
                              ? `Total ${total}/${totalPeopleFiltered}${othersPeople > 0 ? ` (${othersPeople})` : ''}, ${detailParts.join(', ')}`
                              : `총 ${total}/${totalPeopleFiltered}${othersPeople > 0 ? ` (${othersPeople})` : ''}, ${detailParts.join(', ')}`
                          })()}
                        </span>
                        {(() => {
                          const counts = choiceSummaryByTourId[String(tour.id)]
                          if (!counts) return null
                          const order = ['X', 'L', 'U', '_other'] as const
                          const labels: Record<string, string> = { X: 'X', L: 'L', U: 'U', _other: '기타' }
                          const emojis: Record<string, string> = { X: '❌', L: '🔽', U: '🔼', _other: '⭕' }
                          return (
                            <span className="ml-0.5 inline-flex items-baseline gap-0.5 flex-wrap align-baseline">
                              {order.filter((k) => (counts[k] || 0) > 0).map((k) => (
                                <span key={k} className="inline-flex items-baseline gap-px opacity-95" title={`${labels[k]} : ${counts[k]}`}>
                                  <span className="leading-none">{emojis[k]}</span>
                                  <span className="text-[8px] sm:text-[9px] font-medium leading-none">{counts[k]}</span>
                                </span>
                              ))}
                            </span>
                          )
                        })()}
                        {tour.vehicle_number && (
                          <span className="ml-0.5 text-[8px] sm:text-[9px] font-medium leading-none" title={t('vehicle')}>
                            {tour.vehicle_number}
                          </span>
                        )}
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
                      onClick={(e) => {
                        e.stopPropagation() // 부모 요소의 클릭 이벤트 방지
                        openOffScheduleModal(date, schedule)
                      }}
                      className={`text-[8px] sm:text-[10px] px-px py-0.5 rounded cursor-pointer text-white hover:opacity-80 transition-opacity ${statusColor}`}
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
        
        {/* 투어 상태 아이콘 범례 */}
        <div className="mt-3">
          <h3 className="text-sm font-medium text-gray-700 mb-2">{locale === 'ko' ? '투어 상태 아이콘' : 'Tour Status Icons'}</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">📢</span>
              <span className="text-sm text-gray-600">{locale === 'ko' ? '모집중 (Recruiting)' : 'Recruiting'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">✓</span>
              <span className="text-sm text-gray-600">{locale === 'ko' ? '확정 (Confirmed)' : 'Confirmed'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">🚫</span>
              <span className="text-sm text-gray-600">{locale === 'ko' ? '취소 (Canceled)' : 'Canceled'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">🗑️</span>
              <span className="text-sm text-gray-600">{locale === 'ko' ? '삭제됨 (Deleted)' : 'Deleted'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">✅</span>
              <span className="text-sm text-gray-600">{locale === 'ko' ? '승인됨 (Approved)' : 'Approved'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">📝</span>
              <span className="text-sm text-gray-600">{locale === 'ko' ? '요청됨 (Requested)' : 'Requested'}</span>
            </div>
          </div>
        </div>
        
        {/* 배정 상태 아이콘 범례 */}
        <div className="mt-3">
          <h3 className="text-sm font-medium text-gray-700 mb-2">{locale === 'ko' ? '배정 상태 아이콘' : 'Assignment Status Icons'}</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">⏳</span>
              <span className="text-sm text-gray-600">{locale === 'ko' ? '배정됨 (Assigned)' : 'Assigned'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">✅</span>
              <span className="text-sm text-gray-600">{locale === 'ko' ? '확인됨 (Confirmed)' : 'Confirmed'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">❌</span>
              <span className="text-sm text-gray-600">{locale === 'ko' ? '거절됨 (Rejected)' : 'Rejected'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">⏸️</span>
              <span className="text-sm text-gray-600">{locale === 'ko' ? '대기 (Pending)' : 'Pending'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 호버 툴팁 */}
      {hoveredTour && (() => {
        // 툴팁에서도 상태 아이콘 가져오기
        const getAssignmentStatusIcon = (status?: string | null) => {
          if (!status) return '⏸️'
          const normalizedStatus = String(status).toLowerCase().trim()
          switch (normalizedStatus) {
            case 'assigned': return '⏳'
            case 'confirmed': return '✅'
            case 'rejected': return '❌'
            case 'pending': return '⏸️'
            default: return '⏸️'
          }
        }
        
        const getTourStatusIcon = (status?: string | null) => {
          if (!status) return ''
          const normalizedStatus = String(status).toLowerCase().trim()
          // Canceled 변형들 처리
          if (normalizedStatus.includes('canceled') || normalizedStatus.includes('cancel')) {
            return '🚫'
          }
          switch (normalizedStatus) {
            case 'recruiting': return '📢'
            case 'confirmed':
            case 'confirm': return '✓'
            case 'deleted': return '🗑️'
            case 'approved': return '✅'
            case 'requested': return '📝'
            default: return ''
          }
        }
        
        const hoveredTourStatus = hoveredTour.tour_status 
          || (hoveredTour as any).tour_status 
          || null
        const hoveredAssignmentStatus = hoveredTour.assignment_status 
          || (hoveredTour as any).assignment_status 
          || null
        
        const tourStatusIcon = getTourStatusIcon(hoveredTourStatus)
        const assignmentIcon = getAssignmentStatusIcon(hoveredAssignmentStatus)
        
        // 상태 텍스트 가져오기
        const getStatusText = (status: string | null, type: 'tour' | 'assignment') => {
          if (!status) return type === 'tour' ? (locale === 'ko' ? '미정' : 'Undefined') : (locale === 'ko' ? '대기' : 'Pending')
          const normalized = String(status).toLowerCase().trim()
          if (type === 'tour') {
            // Canceled 변형들 처리
            if (normalized.includes('canceled') || normalized.includes('cancel')) {
              return locale === 'ko' ? '취소' : 'Canceled'
            }
            switch (normalized) {
              case 'recruiting': return locale === 'ko' ? '모집중' : 'Recruiting'
              case 'confirmed':
              case 'confirm': return locale === 'ko' ? '확정' : 'Confirmed'
              case 'deleted': return locale === 'ko' ? '삭제됨' : 'Deleted'
              case 'approved': return locale === 'ko' ? '승인됨' : 'Approved'
              case 'requested': return locale === 'ko' ? '요청됨' : 'Requested'
              default: return status
            }
          } else {
            switch (normalized) {
              case 'assigned': return locale === 'ko' ? '배정됨' : 'Assigned'
              case 'confirmed': return locale === 'ko' ? '확인됨' : 'Confirmed'
              case 'rejected': return locale === 'ko' ? '거절됨' : 'Rejected'
              case 'pending': return locale === 'ko' ? '대기' : 'Pending'
              default: return status
            }
          }
        }
        
        return (
          <div
            className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-3 max-w-xs pointer-events-none"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translateX(-50%) translateY(-100%)'
            }}
          >
            <div className="text-sm">
              <div className="font-semibold text-gray-900 mb-2 border-b border-gray-200 pb-1 flex items-center gap-1">
                {tourStatusIcon && <span>{tourStatusIcon}</span>}
                {assignmentIcon && <span>{assignmentIcon}</span>}
                <span>{getTourDisplayName(hoveredTour) || getProductDisplayName(productMetaById[hoveredTour.product_id ?? ''])}</span>
              </div>
              
              {/* 상태 정보 */}
              <div className="mb-2 space-y-1">
                {hoveredTourStatus && (
                  <div className="flex items-center text-xs">
                    <span className="text-gray-600 w-16">{locale === 'ko' ? '투어 상태' : 'Tour Status'}:</span>
                    <span className="text-gray-900 font-medium">{tourStatusIcon} {getStatusText(hoveredTourStatus, 'tour')}</span>
                  </div>
                )}
                {hoveredAssignmentStatus && (
                  <div className="flex items-center text-xs">
                    <span className="text-gray-600 w-16">{locale === 'ko' ? '배정 상태' : 'Assignment'}:</span>
                    <span className="text-gray-900 font-medium">{assignmentIcon} {getStatusText(hoveredAssignmentStatus, 'assignment')}</span>
                  </div>
                )}
              </div>
              
              {/* 인원 정보 */}
              <div className="mb-2 text-xs text-gray-600">
                {t('assignedPeople')}: {hoveredTour.assigned_people || 0}{t('peopleUnit')} / {t('totalPeople')}: {hoveredTour.total_people || 0}{t('peopleUnit')}
                {hoveredTour.is_private_tour && <span className="ml-1 text-purple-600">({t('privateTour')})</span>}
              </div>
              
              {/* Lower / X / Upper 등 초이스별 인원 */}
              {(() => {
                const counts = choiceSummaryByTourId[String(hoveredTour.id)]
                if (!counts || Object.keys(counts).length === 0) return null
                const order = ['X', 'L', 'U', '_other'] as const
                const labels: Record<string, string> = { X: 'X', L: 'L', U: 'U', _other: locale === 'ko' ? '기타' : 'Other' }
                const parts = order.filter((k) => (counts[k] || 0) > 0).map((k) => `${labels[k]} ${counts[k]}`)
                if (parts.length === 0) return null
                return (
                  <div className="mb-2 flex items-center text-xs">
                    <span className="text-gray-600 shrink-0">{locale === 'ko' ? '초이스 인원' : 'Choice'}:</span>
                    <span className="text-gray-900 font-medium ml-1">{parts.join(' / ')}</span>
                  </div>
                )
              })()}
              
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
        )
      })()}

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
                <XIcon className="w-5 h-5 sm:w-6 sm:h-6" />
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

      {/* 투어 상태 변경 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl py-1 min-w-[200px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            pointerEvents: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-xs font-semibold text-gray-500 border-b border-gray-200">
            {locale === 'ko' ? '투어 상태 변경' : 'Change Tour Status'}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {tourStatusOptions.map((option) => {
              const isCurrentStatus = (contextMenu.tour.tour_status || '').toLowerCase() === option.value.toLowerCase()
              const isUpdating = updatingTourStatus === contextMenu.tour.id
              
              return (
                <button
                  key={option.value}
                  onClick={() => handleTourStatusChange(contextMenu.tour.id, option.value)}
                  disabled={isUpdating || isCurrentStatus}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                    isCurrentStatus ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                  } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span>{option.icon}</span>
                  <span className="flex-1">{option.label}</span>
                  {isCurrentStatus && <span className="text-xs">✓</span>}
                  {isUpdating && (
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600"></div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

export default TourCalendar
