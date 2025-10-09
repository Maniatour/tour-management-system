'use client'

import { useState, useEffect, useCallback, useMemo, use } from 'react'
import { Search, Calendar, Grid, CalendarDays, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import TourCalendar from '@/components/TourCalendar'
import ScheduleView from '@/components/ScheduleView'
import SunriseTime from '@/components/SunriseTime'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import { useAuth } from '@/contexts/AuthContext'

type Tour = Database['public']['Tables']['tours']['Row']

type ExtendedTour = Omit<Tour, 'assignment_status'> & {
  product_name?: string | null;
  name_ko?: string | null;
  name_en?: string | null;
  assignment_status?: string | null | undefined;
  customer_name_en?: string | null;
  total_people?: number;
  assigned_people?: number;
  unassigned_people?: number;
  guide_name?: string | null;
  guide_name_en?: string | null;
  assistant_name?: string | null;
  assistant_name_en?: string | null;
  status?: string | null;
  tour_status?: string | null;
  vehicle_number?: string | null;
}

type Employee = Database['public']['Tables']['team']['Row']
type Product = Database['public']['Tables']['products']['Row']

interface GuideToursProps {
  params: Promise<{ locale: string }>
}

export default function GuideTours({ params }: GuideToursProps) {
  const { locale } = use(params)
  const t = useTranslations('tours')
  const gt = useTranslations('tours.guideTours')
  const router = useRouter()
  const supabase = createClientSupabase()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  // 직원 데이터 (Supabase에서 가져옴)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [, setProducts] = useState<Product[]>([])
  const [tours, setTours] = useState<ExtendedTour[]>([])
  const [allReservations, setAllReservations] = useState<Database['public']['Tables']['reservations']['Row'][]>([])
  const [offSchedules, setOffSchedules] = useState<any[]>([])
  // 투어 가이드는 항상 달력 보기, 관리자/매니저는 선택 가능
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'schedule'>('calendar')
  
  // 모든 사용자가 뷰를 선택할 수 있음
  const effectiveViewMode = viewMode
  const [gridMonth, setGridMonth] = useState<Date>(new Date())

  // 최적화된 데이터 로딩
  const { data: toursData, loading: toursLoading } = useOptimizedData({
    fetchFn: async () => {
      // 관리자/매니저는 모든 투어를, 투어 가이드는 배정된 투어만 가져오기
      let query = supabase.from('tours').select('*')
      
      if (userRole === 'team_member') {
        // 투어 가이드는 배정된 투어만
        query = query.or(`tour_guide_id.eq.${currentUserEmail},assistant_id.eq.${currentUserEmail}`)
      }
      // 관리자/매니저는 모든 투어를 볼 수 있음
      
      const { data, error } = await query.order('tour_date', { ascending: false })
      
      if (error) throw error
      return data || []
    },
    cacheKey: `guide-tours-${currentUserEmail}-${userRole}`,
    cacheTime: 2 * 60 * 1000 // 2분 캐시
  })

  const { data: employeesData, loading: employeesLoading } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('team')
        .select('*')
        .eq('is_active', true)
        .order('name_ko')
      
      if (error) throw error
      return data || []
    },
    cacheKey: 'employees',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  const { data: productsData, loading: productsLoading } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en, status')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    },
    cacheKey: 'products',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  // 통합 로딩 상태
  const loading = toursLoading || employeesLoading || productsLoading

  const goToPrevGridMonth = () => {
    setGridMonth(new Date(gridMonth.getFullYear(), gridMonth.getMonth() - 1, 1))
  }

  const goToNextGridMonth = () => {
    setGridMonth(new Date(gridMonth.getFullYear(), gridMonth.getMonth() + 1, 1))
  }

  const getStatusBadgeClasses = (status: string | null | undefined) => {
    const s = (status || '').toString().toLowerCase()
    switch (s) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
      case 'canceled':
        return 'bg-red-100 text-red-800'
      case 'recruiting':
        return 'bg-purple-100 text-purple-800'
      case 'scheduled':
        return 'bg-gray-100 text-gray-800'
      case 'inprogress':
      case 'in_progress':
        return 'bg-amber-100 text-amber-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 투어 이름 매핑 함수
  const getTourDisplayName = (tour: ExtendedTour, locale: string) => {
    if (locale === 'en') {
      // 영어 모드에서는 name_en 우선 사용
      return tour.name_en || tour.product_name || tour.product_id
    } else {
      // 한국어 모드에서는 name_ko 우선 사용
      return tour.name_ko || tour.product_name || tour.product_id
    }
  }

  // 데이터 동기화
  useEffect(() => {
    if (employeesData) {
      setEmployees(employeesData)
    }
  }, [employeesData])

  useEffect(() => {
    if (productsData) {
      setProducts(productsData)
    }
  }, [productsData])

  // 투어 데이터 처리 및 확장
  const processToursData = useCallback(async (toursData: Database['public']['Tables']['tours']['Row'][]) => {
    try {
      // 2. 상품 정보 가져오기 (status 포함) 및 비활성 상품 제외
      const productIdsAll = [...new Set((toursData || []).map((tour: ExtendedTour) => tour.product_id).filter(Boolean))]
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en, status')
        .in('id', productIdsAll)

      const activeProductIds = new Set(
        ((productsData || []) as Array<{ id: string; name?: string | null; name_ko?: string | null; name_en?: string | null; status?: string | null }>)
          .filter((p) => (String(p.status || '').toLowerCase() !== 'inactive'))
          .map((p) => p.id)
      )

      // 비활성 상품의 투어 제거
      const toursDataActive = (toursData || []).filter((tour: ExtendedTour) => {
        const pid = tour.product_id as unknown as string | null
        return pid ? activeProductIds.has(pid) : true
      })

      const productMap = new Map(
        (((productsData || []) as Array<{ id: string; name?: string | null; name_ko?: string | null; name_en?: string | null }>))
          .filter((p) => activeProductIds.has(p.id))
          .map((p) => [p.id, (p.name as string) || p.name_ko || p.name_en || p.id])
      )

      // 3. 가이드와 어시스턴트 정보 가져오기
      const guideEmails = [...new Set((toursDataActive || []).map((tour: ExtendedTour) => tour.tour_guide_id).filter(Boolean))]
      const assistantEmails = [...new Set((toursDataActive || []).map((tour: ExtendedTour) => tour.assistant_id).filter(Boolean))]
      const allEmails = [...new Set([...guideEmails, ...assistantEmails])]

      const { data: teamMembers } = await supabase
        .from('team')
        .select('email, name_ko, name_en')
        .in('email', allEmails)

      const teamMap = new Map((teamMembers || []).map((member: { email: string; name_ko: string; name_en?: string | null }) => [member.email, member]))

      // 3-1. 차량 정보 가져오기 (카드에 차량 번호 표시)
      const vehicleIds = [...new Set((toursDataActive || []).map((t: { tour_car_id?: string | null }) => t.tour_car_id).filter(Boolean))]
      let vehicleMap = new Map<string, string | null>()
      if (vehicleIds.length > 0) {
        const { data: vehiclesData } = await supabase
          .from('vehicles')
          .select('id, vehicle_number')
          .in('id', vehicleIds)
        vehicleMap = new Map((vehiclesData || []).map((v: { id: string; vehicle_number: string | null }) => [v.id, v.vehicle_number]))
      }

      // 4. 현재 달력 그리드 범위를 커버하는 날짜 구간으로 예약 데이터 조회 (URL 길이/성능 고려)
      // 그리드 시작: 이번 달 1일에서 요일만큼 빼기, 끝: 시작에서 41일 더하기 (6주)
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const gridStart = new Date(firstOfMonth)
      gridStart.setDate(gridStart.getDate() - gridStart.getDay())
      const gridEnd = new Date(gridStart)
      gridEnd.setDate(gridEnd.getDate() + 41)

      const fmt = (d: Date) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      }

      let reservationsData: Database['public']['Tables']['reservations']['Row'][] | null = []
      let reservationsError: unknown = null
      const productIdsActive = [...new Set((toursDataActive || []).map((tour: ExtendedTour) => tour.product_id).filter(Boolean))]

      // 미리 모든 투어의 reservation_ids 수집 (배정 인원 계산 정확도 보장)
      const normalizeIds = (value: unknown): string[] => {
        if (!value) return []
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(v => v.length > 0)
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              const parsed = JSON.parse(trimmed)
              return Array.isArray(parsed) ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0) : []
            } catch { return [] }
          }
          if (trimmed.includes(',')) return trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0)
          return trimmed.length > 0 ? [trimmed] : []
        }
        return []
      }
      const assignedIdsSet = new Set<string>()
      for (const t of (toursDataActive || [])) {
        const ids = normalizeIds((t as unknown as { reservation_ids?: unknown }).reservation_ids)
        ids.forEach(id => assignedIdsSet.add(id))
      }

      if (productIdsActive.length > 0) {
        const { data, error } = await supabase
          .from('reservations')
          .select('*')
          .in('product_id', productIdsActive)
          .gte('tour_date', fmt(gridStart))
          .lte('tour_date', fmt(gridEnd))
        reservationsData = data
        reservationsError = error
      }

      // 누락된 배정 예약(id 기반)이 있으면 추가로 가져와 병합
      if (!reservationsError && assignedIdsSet.size > 0) {
        const existingIds = new Set((reservationsData || []).map(r => String(r.id)))
        const missingIds = [...assignedIdsSet].filter(id => !existingIds.has(id))
        if (missingIds.length > 0) {
          const { data: extraReservations, error: extraErr } = await supabase
            .from('reservations')
            .select('*')
            .in('id', missingIds)
          if (!extraErr && extraReservations && extraReservations.length > 0) {
            reservationsData = [...(reservationsData || []), ...extraReservations]
          }
        }
      }

      if (reservationsError) {
        console.error('Error fetching reservations:', reservationsError)
        return
      }

      // 5. allReservations 상태 설정
      setAllReservations(reservationsData || [])

      // 6. 사전 계산 맵 구성 (성능 최적화)
      const reservationIdToPeople = new Map<string, number>()
      const reservationIdToRow = new Map<string, Database['public']['Tables']['reservations']['Row']>()
      const productDateKeyToTotalPeople = new Map<string, number>()
      const productDateKeyToUnassignedPeople = new Map<string, number>()

      for (const res of reservationsData || []) {
        if (res && res.id) {
          const rid = String(res.id).trim()
          reservationIdToPeople.set(rid, res.total_people || 0)
          reservationIdToRow.set(rid, res)
        }
        const productId = (res?.product_id ? String(res.product_id) : '').trim()
        const date = (res?.tour_date ? String(res.tour_date) : '').trim()
        const key = `${productId}__${date}`
        productDateKeyToTotalPeople.set(key, (productDateKeyToTotalPeople.get(key) || 0) + (res?.total_people || 0))
        if (res?.tour_id === null) {
          productDateKeyToUnassignedPeople.set(key, (productDateKeyToUnassignedPeople.get(key) || 0) + (res?.total_people || 0))
        }
      }

      // 7. 각 투어에 대해 인원 계산
      const toursWithDetails: ExtendedTour[] = (toursDataActive || []).map((tour: ExtendedTour) => {
        // 배정 인원: reservation_ids 합산
        let assignedPeople = 0
        const counted = new Set<string>()
        // reservation_ids 정규화: 배열/JSON/콤마 지원
        const normalize = (value: unknown): string[] => {
          if (!value) return []
          if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(v => v.length > 0)
          if (typeof value === 'string') {
            const trimmed = value.trim()
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
              try {
                const parsed = JSON.parse(trimmed)
                return Array.isArray(parsed) ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0) : []
              } catch { return [] }
            }
            if (trimmed.includes(',')) return trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0)
            return trimmed.length > 0 ? [trimmed] : []
          }
          return []
        }
        const ids = normalize(tour.reservation_ids as unknown)
        for (const id of ids) {
          const rid = String(id).trim()
          if (counted.has(rid)) continue
          counted.add(rid)
          const row = reservationIdToRow.get(rid)
          if (!row) continue
          // 동일한 상품/날짜에 속하는 예약만 합산 (잘못 연결된 ID 방지)
          if ((row.product_id || '') === (tour.product_id || '') && (row.tour_date || '') === (tour.tour_date || '')) {
            assignedPeople += row.total_people || 0
          }
        }
        // 같은 상품/날짜 총 인원
        const key = `${tour.product_id || ''}__${tour.tour_date || ''}`
        const totalPeople = productDateKeyToTotalPeople.get(key) || 0
        const unassignedPeople = productDateKeyToUnassignedPeople.get(key) || 0

        const guide = tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) : null
        const assistant = tour.assistant_id ? teamMap.get(tour.assistant_id) : null

        const product = tour.product_id ? productsData.find(p => p.id === tour.product_id) : null
        
        return {
          ...tour,
          product_name: tour.product_id ? productMap.get(tour.product_id) : null,
          name_ko: product?.name_ko || null,
          name_en: product?.name_en || null,
          customer_name_ko: product?.customer_name_ko || null,
          customer_name_en: product?.customer_name_en || null,
          total_people: totalPeople,
          assigned_people: assignedPeople,
          unassigned_people: unassignedPeople,
          guide_name: guide?.name_ko || null,
          guide_name_en: guide?.name_en || null,
          assistant_name: assistant?.name_ko || null,
          assistant_name_en: assistant?.name_en || null,
          is_private_tour: tour.is_private_tour === true,
          vehicle_number: tour.tour_car_id ? (vehicleMap.get(tour.tour_car_id as unknown as string) || null) : null
        }
      })

      setTours(toursWithDetails)

      // 오프 스케줄 데이터 로드
      const { data: offSchedulesData, error: offSchedulesError } = await supabase
        .from('off_schedules')
        .select('*')
        .eq('team_email', currentUserEmail)
        .order('off_date', { ascending: false })

      if (offSchedulesError) {
        console.error('Error loading off schedules:', offSchedulesError)
      } else {
        setOffSchedules(offSchedulesData || [])
      }
    } catch (error) {
      console.error('Error processing tours:', error)
    }
  }, [supabase, currentUserEmail])

  // 투어 데이터가 로드되면 처리
  useEffect(() => {
    if (toursData) {
      processToursData(toursData)
    }
  }, [toursData, processToursData])

  const [searchTerm, setSearchTerm] = useState('')

  // 필터링된 투어 목록 (검색만 적용)
  const filteredTours = tours.filter(tour => {
    const matchesSearch = !searchTerm || 
      (tour.id || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tour.product_id || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tour.guide_name || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tour.assistant_name || '').toString().toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  // 리스트(카드) 뷰 전용: 선택된 gridMonth로 월 필터링
  const listMonthPrefix = `${gridMonth.getFullYear()}-${String(gridMonth.getMonth() + 1).padStart(2, '0')}-`
  const listViewTours = filteredTours.filter(t => (t.tour_date || '').startsWith(listMonthPrefix))

  const [navigatingToTour, setNavigatingToTour] = useState<string | null>(null)

  const handleTourClick = (tour: ExtendedTour) => {
    setNavigatingToTour(tour.id)
    router.push(`/${locale}/guide/tours/${tour.id}`)
  }

  // 오프 스케줄 변경 시 데이터 새로고침
  const handleOffScheduleChange = useCallback(() => {
    // 오프 스케줄 데이터 다시 로드
    const loadOffSchedules = async () => {
      try {
        const { data: offSchedulesData, error: offSchedulesError } = await supabase
          .from('off_schedules')
          .select('*')
          .eq('team_email', currentUserEmail)
          .order('off_date', { ascending: false })

        if (offSchedulesError) {
          console.error('Error loading off schedules:', offSchedulesError)
        } else {
          setOffSchedules(offSchedulesData || [])
        }
      } catch (error) {
        console.error('Error loading off schedules:', error)
      }
    }

    loadOffSchedules()
  }, [supabase, currentUserEmail])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{gt('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4 sm:mx-0 px-0 sm:px-6 py-2 sm:py-6">
      {/* 헤더 */}
      <div className="mb-6 px-[10px] sm:px-0">
        {/* 가이드 대시보드로 돌아가기 버튼 */}
        <div className="mb-3">
          <button
            onClick={() => router.push('/${locale}/guide')}
            className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {gt('backToDashboard')}
          </button>
        </div>
        
        {/* 제목 + 뷰 전환 (한 줄) */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 m-0">
              {userRole === 'admin' || userRole === 'manager' ? gt('adminMode') : gt('myTours')}
            </h1>
            {/* 일출 시간 표시 */}
            <SunriseTime />
          </div>
          {/* 뷰 전환 버튼 */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-2 py-1 sm:px-4 sm:py-2 rounded-lg flex items-center space-x-1 sm:space-x-2 text-xs sm:text-base ${
                effectiveViewMode === 'calendar' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">{gt('calendarView')}</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-1 sm:px-4 sm:py-2 rounded-lg flex items-center space-x-1 sm:space-x-2 text-xs sm:text-base ${
                effectiveViewMode === 'list' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span className="hidden sm:inline">카드 뷰</span>
            </button>
          </div>
        </div>

        {/* 검색 */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={gt('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      </div>

      {/* 달력 보기 */}
      {effectiveViewMode === 'calendar' && (
        <div className="relative">
          {navigatingToTour && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">{gt('navigatingToTour')}</p>
              </div>
            </div>
          )}
          <TourCalendar tours={filteredTours} onTourClick={handleTourClick} allReservations={allReservations} offSchedules={offSchedules} onOffScheduleChange={handleOffScheduleChange} />
        </div>
      )}

      {/* 스케줄 뷰 */}
      {effectiveViewMode === 'schedule' && (
        <ScheduleView />
      )}

      {/* 리스트(카드) 뷰 */}
      {effectiveViewMode === 'list' && (
        <>
          <div className="flex items-center justify-between mb-2">
            <button onClick={goToPrevGridMonth} className="p-1 hover:bg-gray-100 rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-medium">
              {gridMonth.getFullYear()}년 {gridMonth.getMonth() + 1}월
            </div>
            <button onClick={goToNextGridMonth} className="p-1 hover:bg-gray-100 rounded">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {listViewTours.map((tour) => (
            <div
              key={tour.id}
              onClick={() => handleTourClick(tour)}
              className={`block bg-white rounded-lg shadow-md border p-3 transition-all cursor-pointer ${
                navigatingToTour === tour.id 
                  ? 'opacity-50 pointer-events-none' 
                  : 'hover:shadow-lg'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {tour.tour_date} {getTourDisplayName(tour, locale)} {tour.assigned_people || 0}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    {navigatingToTour === tour.id && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    )}
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusBadgeClasses(tour.status || tour.tour_status)}`}>
                      {(tour.status || tour.tour_status) || '-'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 border border-blue-200 rounded text-xs text-blue-700 bg-blue-50">
                    {locale === 'en' ? (tour.guide_name_en || tour.guide_name || '-') : (tour.guide_name || '-')}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 border border-emerald-200 rounded text-xs text-emerald-700 bg-emerald-50">
                    {locale === 'en' ? (tour.assistant_name_en || tour.assistant_name || '-') : (tour.assistant_name || '-')}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 border border-teal-200 rounded text-xs text-teal-700 bg-teal-50">
                    {tour.vehicle_number || '-'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {listViewTours.length === 0 && (
            <div className="col-span-full text-center text-sm text-gray-500 py-6">{gt('noToursThisMonth')}</div>
          )}
          </div>
        </>
      )}
    </div>
  )
}
