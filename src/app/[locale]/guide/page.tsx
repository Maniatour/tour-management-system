'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Calendar, Users, CalendarOff, CheckCircle, XCircle, Clock as ClockIcon, Plus, X, User, Car, History } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations, useLocale } from 'next-intl'

type Tour = Database['public']['Tables']['tours']['Row']
type ExtendedTour = Omit<Tour, 'assignment_status'> & {
  product_name?: string | null;
  product_name_en?: string | null;
  name_ko?: string | null;
  name_en?: string | null;
  assignment_status?: string | null | undefined;
  assigned_people?: number;
  assigned_adults?: number;
  assigned_children?: number;
  assigned_infants?: number;
  guide_name?: string | null;
  guide_name_en?: string | null;
  assistant_name?: string | null;
  assistant_name_en?: string | null;
  vehicle_number?: string | null;
}

type OffSchedule = Database['public']['Tables']['off_schedules']['Row']

export default function GuideDashboard() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClientSupabase()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  const t = useTranslations('guide')
  const localeFromHook = useLocale()
  
  // URL 디코딩 및 locale 추출
  const decodedPathname = decodeURIComponent(pathname)
  const pathSegments = decodedPathname.split('/').filter(Boolean)
  const localeFromPath = pathSegments[0] || 'ko'
  
  // 브라우저의 현재 URL에서 locale 추출 (fallback)
  const currentUrl = typeof window !== 'undefined' ? window.location.pathname : ''
  const urlSegments = currentUrl.split('/').filter(Boolean)
  const localeFromUrl = urlSegments[0] || 'ko'
  
  // 임시 하드코딩 방법 (디버깅용)
  const isEnglishPage = currentUrl.includes('/en/') || decodedPathname.includes('/en/')
  const hardcodedLocale = isEnglishPage ? 'en' : 'ko'
  
  // locale 우선순위: 하드코딩 > URL path > useLocale > 기본값
  const locale = hardcodedLocale || 
    (localeFromPath && localeFromPath !== '%24%7Blocale%7D' && localeFromPath !== '${locale}') 
    ? localeFromPath 
    : (localeFromUrl && localeFromUrl !== '%24%7Blocale%7D' && localeFromUrl !== '${locale}') 
    ? localeFromUrl 
    : localeFromHook || 'ko'
  
  // 디버깅을 위한 로그
  console.log('GuideDashboard locale debug:', {
    localeFromHook,
    localeFromPath,
    localeFromUrl,
    hardcodedLocale,
    isEnglishPage,
    finalLocale: locale,
    pathname,
    decodedPathname,
    currentUrl
  })
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  // 라스베가스 시간대 기준 오늘 날짜 계산
  const getLasVegasToday = () => {
    const now = new Date()
    // 라스베가스 시간대로 변환
    const lasVegasDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
    const year = lasVegasDate.getFullYear()
    const month = String(lasVegasDate.getMonth() + 1).padStart(2, '0')
    const day = String(lasVegasDate.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const today = getLasVegasToday()
  
  // 디버깅을 위한 로그
  console.log('Today date (Las Vegas timezone):', today)

  // 날짜에 요일 추가하는 함수
  const formatDateWithDay = (dateString: string) => {
    const date = new Date(dateString)
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const dayName = days[date.getDay()]
    return `${dateString} (${dayName})`
  }
  
  const [upcomingTours, setUpcomingTours] = useState<ExtendedTour[]>([])
  const [pastTours, setPastTours] = useState<ExtendedTour[]>([])
  const [offSchedules, setOffSchedules] = useState<OffSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [offScheduleActiveTab, setOffScheduleActiveTab] = useState<'upcoming' | 'past' | 'pending' | 'approved' | 'rejected'>('upcoming')
  
  // 팀채팅 관련 상태 (제거됨 - 별도 페이지로 이동)
  
  const [showOffScheduleModal, setShowOffScheduleModal] = useState(false)
  const [offScheduleForm, setOffScheduleForm] = useState({
    off_date: '',
    reason: '',
    is_multi_day: false,
    end_date: ''
  })

  // 팀채팅 데이터 로드 함수 제거됨 - 별도 페이지로 이동


  useEffect(() => {
    const loadTours = async () => {
      try {
        setLoading(true)
        console.log('Starting to load tours for user:', currentUserEmail)

        if (!currentUserEmail) {
          console.log('No current user email, skipping tour load')
          return
        }
        

        // 투어 가이드가 배정된 투어 가져오기 (최근 30일 + 미래 30일)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
        
        const thirtyDaysLater = new Date()
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
        const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0]

        console.log('Tour query date range:', { 
          from: thirtyDaysAgoStr, 
          to: thirtyDaysLaterStr, 
          today: today,
          currentUserEmail,
          userRole,
          isSimulating
        })

        // 사용자 역할에 따라 투어 쿼리 조건 설정
        let tourQuery = supabase
          .from('tours')
          .select('*')
          .gte('tour_date', thirtyDaysAgoStr)
          .lte('tour_date', thirtyDaysLaterStr)
          .order('tour_date', { ascending: true })
          .limit(100)

        // 일반 가이드는 배정된 투어만, 관리자/매니저는 모든 투어
        if (userRole === 'admin' || userRole === 'manager') {
          console.log('Admin/Manager: Loading all tours')
        } else {
          console.log('Guide: Loading assigned tours only')
          tourQuery = tourQuery.or(`tour_guide_id.eq.${currentUserEmail},assistant_id.eq.${currentUserEmail}`)
        }

        const { data: toursData, error } = await tourQuery as { data: Tour[] | null; error: Error | null }

        if (error) {
          console.error('Error loading tours:', error)
          return
        }

        console.log('Raw tours data from database:', toursData)
        
        // 오늘 날짜의 투어가 있는지 확인
        const todayTours = (toursData || []).filter(tour => tour.tour_date === today)
        console.log('Today tours in raw data:', todayTours.map(t => ({ 
          id: t.id, 
          tour_date: t.tour_date, 
          product_id: t.product_id,
          tour_guide_id: t.tour_guide_id,
          assistant_id: t.assistant_id
        })))

        // 상품 정보 가져오기
        const productIds = [...new Set((toursData || []).map(tour => tour.product_id).filter(Boolean))]
        let productMap = new Map()
        let productEnMap = new Map()
        let productInternalKoMap = new Map()
        let productInternalEnMap = new Map()
        
        if (productIds.length > 0) {
          const { data: productsData } = await supabase
            .from('products')
            .select('id, name, name_en, name_ko, customer_name_en, customer_name_ko')
            .in('id', productIds) as { data: { id: string; name: string; name_en: string | null; name_ko: string | null; customer_name_en: string | null; customer_name_ko: string | null }[] | null }
          
          // 디버깅을 위한 로그
          console.log('Products Data Debug:', productsData)
          
          productMap = new Map((productsData || []).map(p => [p.id, p.customer_name_ko || p.name_ko || p.name]))
          // 영어 맵: 영어 이름만 사용 (한글 이름은 fallback으로 사용하지 않음)
          productEnMap = new Map((productsData || []).map(p => [p.id, p.customer_name_en || p.name_en || null]))
          productInternalKoMap = new Map((productsData || []).map(p => [p.id, p.name_ko || p.name]))
          productInternalEnMap = new Map((productsData || []).map(p => [p.id, p.name_en || null]))
          
          // 디버깅을 위한 로그
          console.log('Product Maps Debug:', {
            productMap: Array.from(productMap.entries()),
            productEnMap: Array.from(productEnMap.entries())
          })
        }

        // 팀원 정보 가져오기
        const guideEmails = [...new Set((toursData || []).map(tour => tour.tour_guide_id).filter(Boolean))]
        const assistantEmails = [...new Set((toursData || []).map(tour => tour.assistant_id).filter(Boolean))]
        const allEmails = [...new Set([...guideEmails, ...assistantEmails])]
        
        let teamMap = new Map()
        let teamEnMap = new Map()
        if (allEmails.length > 0) {
          try {
            // 먼저 직접 조회 시도 (더 안전한 방식)
            const { data: directData, error: directError } = await supabase
              .from('team')
              .select('email, name_ko, name_en')
              .in('email', allEmails)
            
            if (!directError && directData) {
              teamMap = new Map((directData as Array<{ email: string; name_ko: string; name_en: string }> || []).map(member => [member.email, member.name_ko]))
              teamEnMap = new Map((directData as Array<{ email: string; name_ko: string; name_en: string }> || []).map(member => [member.email, member.name_en]))
            } else {
              // 직접 조회 실패 시 RPC 함수 시도 (fallback)
              console.log('Direct query failed, trying RPC function...', directError)
              
              const { data: rpcData, error: rpcError } = await supabase
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .rpc('get_team_members_info', { p_emails: allEmails } as any)
              
              if (!rpcError && rpcData) {
                teamMap = new Map((rpcData as Array<{ email: string; name_ko: string; name_en: string }> || []).map((member: { email: string; name_ko: string; name_en: string }) => [member.email, member.name_ko]))
                teamEnMap = new Map((rpcData as Array<{ email: string; name_ko: string; name_en: string }> || []).map((member: { email: string; name_ko: string; name_en: string }) => [member.email, member.name_en]))
              } else {
                console.error('Both direct query and RPC failed:', { directError, rpcError })
                teamMap = new Map()
                teamEnMap = new Map()
              }
            }
          } catch (error) {
            console.error('Error fetching team data:', error)
            teamMap = new Map()
            teamEnMap = new Map()
          }
        }

        // 차량 정보 가져오기
        const vehicleIds = [...new Set((toursData || []).map(tour => tour.tour_car_id).filter(Boolean))]
        
        let vehicleMap = new Map()
        if (vehicleIds.length > 0) {
          const { data: vehiclesData } = await supabase
            .from('vehicles')
            .select('id, vehicle_number')
            .in('id', vehicleIds) as { data: { id: string; vehicle_number: string }[] | null }
          
          vehicleMap = new Map((vehiclesData || []).map(vehicle => [vehicle.id, vehicle.vehicle_number]))
        }

        // reservation_ids 정규화 함수: 배열/JSON/콤마 지원
        const normalizeReservationIds = (value: unknown): string[] => {
          if (!value) return []
          if (Array.isArray(value)) {
            return value.map(v => String(v).trim()).filter(v => v.length > 0)
          }
          if (typeof value === 'string') {
            const trimmed = value.trim()
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
              try {
                const parsed = JSON.parse(trimmed)
                return Array.isArray(parsed) 
                  ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0) 
                  : []
              } catch {
                return []
              }
            }
            if (trimmed.includes(',')) {
              return trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0)
            }
            return trimmed.length > 0 ? [trimmed] : []
          }
          return []
        }

        // 예약 정보로 인원 계산
        const reservationIds = [...new Set((toursData || []).flatMap(tour => {
          return normalizeReservationIds(tour.reservation_ids)
        }))]

        console.log('Reservation IDs to fetch:', reservationIds)

        let reservationMap = new Map<string, { total: number; adults: number; children: number; infants: number }>()
        if (reservationIds.length > 0) {
          try {
            const { data: reservationsData, error: reservationsError } = await supabase
              .from('reservations')
              .select('id, adults, child, infant, total_people')
              .in('id', reservationIds)
            
            if (reservationsError) {
              console.error('Error fetching reservations:', reservationsError)
              console.error('Error details:', {
                message: reservationsError.message,
                details: reservationsError.details,
                hint: reservationsError.hint,
                code: reservationsError.code
              })
            } else {
              console.log('Reservations data fetched:', reservationsData?.length || 0, 'reservations')
              
              if (reservationsData && reservationsData.length > 0) {
                reservationMap = new Map((reservationsData as Array<{
                  id: string;
                  adults?: number | null;
                  child?: number | null;
                  infant?: number | null;
                  total_people?: number | null;
                }>).map(r => {
                  const adults = r.adults || 0
                  const children = r.child || 0
                  const infants = r.infant || 0
                  const total = r.total_people || (adults + children + infants)
                  return [r.id, { total, adults, children, infants }]
                }))
                
                console.log('Reservation map created:', reservationMap.size, 'entries')
              }
            }
          } catch (error) {
            console.error('Exception while fetching reservations:', error)
          }
        }

        // 투어 데이터 확장
        const extendedTours: ExtendedTour[] = (toursData || []).map(tour => {
          let assignedPeople = 0
          let assignedAdults = 0
          let assignedChildren = 0
          let assignedInfants = 0
          
          const ids = normalizeReservationIds(tour.reservation_ids)
          // 중복 제거
          const uniqueIds = [...new Set(ids)]
          console.log(`Tour ${tour.id} reservation_ids:`, tour.reservation_ids, 'normalized:', ids, 'unique:', uniqueIds)
          
          uniqueIds.forEach(id => {
            const reservation = reservationMap.get(id)
            if (reservation) {
              assignedPeople += reservation.total
              assignedAdults += reservation.adults
              assignedChildren += reservation.children
              assignedInfants += reservation.infants
              console.log(`Tour ${tour.id} - Reservation ${id}: total=${reservation.total}, adults=${reservation.adults}, children=${reservation.children}, infants=${reservation.infants}`)
            } else {
              console.warn(`Tour ${tour.id} - Reservation ${id} not found in map`)
            }
          })
          
          console.log(`Tour ${tour.id} final counts: total=${assignedPeople}, adults=${assignedAdults}, children=${assignedChildren}, infants=${assignedInfants}`)

          const extendedTour = {
            ...tour,
            product_name: tour.product_id ? productMap.get(tour.product_id) : null,
            product_name_en: tour.product_id ? productEnMap.get(tour.product_id) : null,
            name_ko: tour.product_id ? productInternalKoMap.get(tour.product_id) : null,
            name_en: tour.product_id ? productInternalEnMap.get(tour.product_id) : null,
            assigned_people: assignedPeople,
            assigned_adults: assignedAdults,
            assigned_children: assignedChildren,
            assigned_infants: assignedInfants,
            guide_name: tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) : null,
            guide_name_en: tour.tour_guide_id ? teamEnMap.get(tour.tour_guide_id) : null,
            assistant_name: tour.assistant_id ? teamMap.get(tour.assistant_id) : null,
            assistant_name_en: tour.assistant_id ? teamEnMap.get(tour.assistant_id) : null,
            vehicle_number: tour.tour_car_id ? vehicleMap.get(tour.tour_car_id) : null,
          }

          // 디버깅을 위한 로그
          if (tour.product_id === 'MDGCSUNRISE') {
            console.log('MDGCSUNRISE Extended Tour Data:', {
              tourId: tour.id,
              productId: tour.product_id,
              product_name: extendedTour.product_name,
              product_name_en: extendedTour.product_name_en,
              name_ko: extendedTour.name_ko,
              name_en: extendedTour.name_en,
              productMapValue: tour.product_id ? productMap.get(tour.product_id) : null,
              productEnMapValue: tour.product_id ? productEnMap.get(tour.product_id) : null
            })
          }

          return extendedTour
        })

        // 투어 분류 - 오늘 투어는 두 탭 모두에 표시
        console.log('All tours before filtering:', extendedTours.map(t => ({ 
          id: t.id, 
          tour_date: t.tour_date, 
          product_id: t.product_id,
          tour_guide_id: t.tour_guide_id,
          assistant_id: t.assistant_id
        })))
        
        // 오늘 날짜의 투어가 확장된 데이터에 있는지 확인
        const todayToursExtended = extendedTours.filter(tour => tour.tour_date === today)
        console.log('Today tours in extended data:', todayToursExtended.map(t => ({ 
          id: t.id, 
          tour_date: t.tour_date, 
          product_id: t.product_id,
          tour_guide_id: t.tour_guide_id,
          assistant_id: t.assistant_id
        })))
        
        const upcomingToursList = extendedTours.filter(tour => tour.tour_date >= today)
        const pastToursList = extendedTours.filter(tour => tour.tour_date <= today)
        
        console.log('Filtered tours:', {
          today,
          upcomingToursList: upcomingToursList.map(t => ({ id: t.id, tour_date: t.tour_date })),
          pastToursList: pastToursList.map(t => ({ id: t.id, tour_date: t.tour_date }))
        })

        setUpcomingTours(upcomingToursList.slice(0, 5)) // 최대 5개만 표시
        setPastTours(pastToursList.slice(0, 10)) // 최대 10개만 표시
        
        console.log('Final tour state set:', {
          upcomingToursCount: upcomingToursList.slice(0, 5).length,
          pastToursCount: pastToursList.slice(0, 10).length,
          todayToursInUpcoming: upcomingToursList.filter(t => t.tour_date === today).length,
          todayToursInPast: pastToursList.filter(t => t.tour_date === today).length
        })

        // 오프 스케줄 데이터 로드 (모든 오프 스케줄)
        const { data: offSchedulesData, error: offSchedulesError } = await supabase
          .from('off_schedules')
          .select('*')
          .eq('team_email', currentUserEmail)
          .order('off_date', { ascending: false }) // 최신순으로 정렬
          .limit(20) // 더 많은 오프 스케줄 표시

        if (offSchedulesError) {
          console.error('Error loading off schedules:', offSchedulesError)
        } else {
          setOffSchedules(offSchedulesData || [])
        }

      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTours()
  }, [currentUserEmail, supabase, today, userRole, isSimulating])

  // 탭 변경 시 해당 데이터 로드 (team-board 탭은 제거됨)
  // useEffect(() => {
  //   if (activeTab === 'team-board') {
  //     loadTeamBoard()
  //   }
  // }, [activeTab, currentUserEmail])



  const getOffScheduleStatusBadgeClasses = (status: string | null | undefined) => {
    const s = (status || '').toString().toLowerCase()
    switch (s) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getOffScheduleStatusIcon = (status: string | null | undefined) => {
    const s = (status || '').toString().toLowerCase()
    switch (s) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'pending':
        return <ClockIcon className="w-4 h-4 text-yellow-600" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <ClockIcon className="w-4 h-4 text-gray-600" />
    }
  }

  // 오프 스케줄 모달 열기
  const openOffScheduleModal = () => {
    setOffScheduleForm({ off_date: '', reason: '', is_multi_day: false, end_date: '' })
    setShowOffScheduleModal(true)
  }

  // 오프 스케줄 모달 닫기
  const closeOffScheduleModal = () => {
    setShowOffScheduleModal(false)
    setOffScheduleForm({ off_date: '', reason: '', is_multi_day: false, end_date: '' })
  }

  // 오프 스케줄 추가
  const handleOffScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentUserEmail || !offScheduleForm.off_date || !offScheduleForm.reason.trim()) {
      alert(t('offSchedule.validation.dateAndReasonRequired'))
      return
    }

    if (offScheduleForm.is_multi_day && (!offScheduleForm.end_date || offScheduleForm.end_date < offScheduleForm.off_date)) {
      alert(t('offSchedule.validation.endDateAfterStart'))
      return
    }

    try {
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
        (supabase as unknown as { from: (table: string) => { insert: (data: Record<string, unknown>) => Promise<{ error: Error | null }> } })
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

      alert(t('offSchedule.success.added', { count: dates.length }))
      closeOffScheduleModal()
      
      // 오프 스케줄 데이터 다시 로드
      const { data: offSchedulesData, error: offSchedulesError } = await supabase
        .from('off_schedules')
        .select('*')
        .eq('team_email', currentUserEmail)
        .order('off_date', { ascending: false })
        .limit(20)

      if (offSchedulesError) {
        console.error('Error loading off schedules:', offSchedulesError)
      } else {
        setOffSchedules(offSchedulesData || [])
      }
    } catch (error) {
      console.error('Error saving off schedule:', error)
      alert(t('offSchedule.error.saveFailed'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingDashboard')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* 환영 메시지 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 sm:p-6 text-white">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">
{t('greeting')}, {isSimulating && simulatedUser ? simulatedUser.name_ko : currentUserEmail}!
          {isSimulating && simulatedUser && (
            <span className="text-sm font-normal text-blue-200 ml-2">
              ({t('simulation')}: {simulatedUser.position})
            </span>
          )}
        </h1>
        <p className="text-blue-100">
          {userRole === 'admin' || userRole === 'manager' 
            ? t('welcomeAdmin')
            : t('welcome')
          }
        </p>
      </div>

      {/* 투어 탭 */}
      <div className="bg-white rounded-lg shadow">
        {/* 탭 헤더 */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'upcoming'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
{t('tours.upcoming')} ({upcomingTours.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'past'
                  ? 'border-gray-500 text-gray-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <History className="w-4 h-4 mr-2" />
{t('tours.past')} ({pastTours.length})
              </div>
            </button>
          </nav>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-2 sm:p-4">
          {activeTab === 'upcoming' && (
            <div className="space-y-2">
              {upcomingTours.length > 0 ? (
                <>
                  {(() => {
                    console.log('About to render upcoming tours:', upcomingTours.map(t => ({ id: t.id, tour_date: t.tour_date, product_id: t.product_id })))
                    return upcomingTours.map((tour) => {
                      console.log('Rendering TourCard for:', tour.id, 'date:', tour.tour_date)
                      return <TourCard key={tour.id} tour={tour} onClick={() => router.push(`/${locale}/guide/tours/${tour.id}`)} locale={locale} />
                    })
                  })()}
                </>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('tours.noUpcoming')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'past' && (
            <div className="space-y-2">
              {pastTours.length > 0 ? (
                        pastTours.map((tour) => (
                          <TourCard key={tour.id} tour={tour} onClick={() => router.push(`/${locale}/guide/tours/${tour.id}`)} locale={locale} />
                        ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>{t('tours.noPast')}</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* 오프 스케줄 */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CalendarOff className="w-5 h-5 mr-2 text-purple-500" />
{t('offSchedule.title')} ({offSchedules.length})
          </h2>
          <button
            onClick={openOffScheduleModal}
            className="w-8 h-8 bg-purple-100 hover:bg-purple-200 text-purple-600 hover:text-purple-700 rounded-lg flex items-center justify-center transition-colors"
            title={t('offSchedule.add')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* 탭 메뉴 */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
            <button
              onClick={() => setOffScheduleActiveTab('upcoming')}
              className={`py-2 px-2 sm:px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                offScheduleActiveTab === 'upcoming'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upcoming
              <span className="ml-1 sm:ml-2 bg-gray-100 text-gray-600 py-0.5 px-1.5 sm:px-2 rounded-full text-xs">
                {offSchedules.filter(s => {
                  return s.off_date >= today
                }).length}
              </span>
            </button>
            <button
              onClick={() => setOffScheduleActiveTab('past')}
              className={`py-2 px-2 sm:px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                offScheduleActiveTab === 'past'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Past
              <span className="ml-1 sm:ml-2 bg-gray-100 text-gray-600 py-0.5 px-1.5 sm:px-2 rounded-full text-xs">
                {offSchedules.filter(s => {
                  return s.off_date < today
                }).length}
              </span>
            </button>
            <button
              onClick={() => setOffScheduleActiveTab('pending')}
              className={`py-2 px-2 sm:px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                offScheduleActiveTab === 'pending'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending
              <span className="ml-1 sm:ml-2 bg-yellow-100 text-yellow-600 py-0.5 px-1.5 sm:px-2 rounded-full text-xs">
                {offSchedules.filter(s => s.status === 'pending').length}
              </span>
            </button>
            <button
              onClick={() => setOffScheduleActiveTab('approved')}
              className={`py-2 px-2 sm:px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                offScheduleActiveTab === 'approved'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Approved
              <span className="ml-1 sm:ml-2 bg-green-100 text-green-600 py-0.5 px-1.5 sm:px-2 rounded-full text-xs">
                {offSchedules.filter(s => s.status === 'approved').length}
              </span>
            </button>
            <button
              onClick={() => setOffScheduleActiveTab('rejected')}
              className={`py-2 px-2 sm:px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                offScheduleActiveTab === 'rejected'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Rejected
              <span className="ml-1 sm:ml-2 bg-red-100 text-red-600 py-0.5 px-1.5 sm:px-2 rounded-full text-xs">
                {offSchedules.filter(s => s.status === 'rejected').length}
              </span>
            </button>
          </nav>
        </div>
        
        {(() => {
          // 필터링된 오프 스케줄 목록
          const filteredSchedules = offSchedules.filter((schedule) => {
            const isUpcoming = schedule.off_date >= today
            const isPast = schedule.off_date < today

            switch (offScheduleActiveTab) {
              case 'upcoming':
                return isUpcoming
              case 'past':
                return isPast
              case 'pending':
                return schedule.status === 'pending'
              case 'approved':
                return schedule.status === 'approved'
              case 'rejected':
                return schedule.status === 'rejected'
              default:
                return true
            }
          })

          return filteredSchedules.length > 0 ? (
            <div className="space-y-3">
              {filteredSchedules.slice(0, 10).map((schedule) => (
              <div
                key={schedule.id}
                onClick={() => {
                  setOffScheduleForm({ 
                    off_date: schedule.off_date, 
                    reason: schedule.reason,
                    is_multi_day: false,
                    end_date: ''
                  })
                  setShowOffScheduleModal(true)
                }}
                className={`border rounded-lg p-2 sm:p-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                  schedule.off_date < today 
                    ? 'border-gray-200 bg-gray-50' 
                    : schedule.off_date === today
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center text-sm mb-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span className={`font-medium ${
                        schedule.off_date < today 
                          ? 'text-gray-500' 
                          : schedule.off_date === today
                          ? 'text-blue-600'
                          : 'text-gray-700'
                      }`}>
                        {formatDateWithDay(schedule.off_date)}
                                {schedule.off_date === today && (
                                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                    {t('offSchedule.today')}
                                  </span>
                                )}
                                {schedule.off_date < today && (
                                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                    {t('offSchedule.pastDay')}
                                  </span>
                                )}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{schedule.reason}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                      {getOffScheduleStatusIcon(schedule.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOffScheduleStatusBadgeClasses(schedule.status)}`}>
                        {schedule.status?.toLowerCase() === 'approved' ? t('offSchedule.status.approved') : 
                         schedule.status?.toLowerCase() === 'pending' ? t('offSchedule.status.pending') : 
                         schedule.status?.toLowerCase() === 'rejected' ? t('offSchedule.status.rejected') : schedule.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <CalendarOff className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>
                {offScheduleActiveTab === 'upcoming' && '예정된 Off가 없습니다.'}
                {offScheduleActiveTab === 'past' && '과거 Off가 없습니다.'}
                {offScheduleActiveTab === 'pending' && '대기 중인 Off가 없습니다.'}
                {offScheduleActiveTab === 'approved' && '승인된 Off가 없습니다.'}
                {offScheduleActiveTab === 'rejected' && '거부된 Off가 없습니다.'}
              </p>
            </div>
          )
        })()}
      </div>


      {/* 오프 스케줄 모달 */}
      {showOffScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xs w-full max-h-[75vh] overflow-y-auto relative top-0 left-0 right-0 bottom-0 m-auto">
            <div className="flex items-center justify-between p-3 sm:p-6 border-b">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
{t('offSchedule.addTitle')}
              </h3>
              <button
                onClick={closeOffScheduleModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            <form onSubmit={handleOffScheduleSubmit} className="p-3 sm:p-6 space-y-3">
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
                  {t('offSchedule.addButton')}
                </button>
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
}

// 투어 카드 컴포넌트
function TourCard({ tour, onClick, locale }: { tour: ExtendedTour; onClick: () => void; locale: string }) {
  const t = useTranslations('guide')
  
  // 디버깅을 위한 로그
  console.log('TourCard component called:', {
    tourId: tour.id,
    tourDate: tour.tour_date,
    productId: tour.product_id,
    locale,
    assignmentStatus: tour.assignment_status,
    allTourData: tour
  })
  
  // 투어 이름 매핑 함수
  const getTourDisplayName = (tour: ExtendedTour, locale: string) => {
    // 디버깅을 위한 로그
    console.log('TourCard Debug - getTourDisplayName:', {
      tourId: tour.id,
      locale,
      name_en: tour.name_en,
      name_ko: tour.name_ko,
      product_name_en: tour.product_name_en,
      product_name: tour.product_name,
      product_id: tour.product_id,
      allTourData: tour
    })
    
    if (locale === 'en') {
      // 영어 모드에서는 product_id의 name_en을 우선 사용
      // name_en (productInternalEnMap에서 가져온 product의 name_en)을 최우선 사용
      // 없으면 product_id만 표시 (한글 이름이나 customer_name_en은 표시하지 않음)
      const result = tour.name_en || tour.product_id
      console.log('English result:', result, {
        name_en: tour.name_en,
        product_name_en: tour.product_name_en,
        name_ko: tour.name_ko,
        product_name: tour.product_name
      })
      return result
    } else {
      // 한국어 모드에서는 한국어 이름 우선 사용
      const result = tour.name_ko || tour.product_name || tour.name_en || tour.product_name_en || tour.product_id
      console.log('Korean result:', result)
      return result
    }
  }
  

  const getAssignmentStatusBadgeClasses = (status: string | null | undefined) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-800'
      case 'pending':
        return 'bg-amber-100 text-amber-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 라스베가스 시간대 기준 오늘 날짜 계산
  const getLasVegasToday = () => {
    const now = new Date()
    // 라스베가스 시간대로 변환
    const lasVegasDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
    const year = lasVegasDate.getFullYear()
    const month = String(lasVegasDate.getMonth() + 1).padStart(2, '0')
    const day = String(lasVegasDate.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const today = getLasVegasToday()
  const isToday = tour.tour_date === today
  
  console.log('TourCard date check:', {
    tourId: tour.id,
    tourDate: tour.tour_date,
    today,
    isToday,
    comparison: `${tour.tour_date} === ${today}`,
    comparisonResult: tour.tour_date === today
  })
  
  // 렌더링 전 로그
  console.log('TourCard DOM rendering for tour:', tour.id, 'date:', tour.tour_date, 'isToday:', isToday)
  
  // 실제 DOM 렌더링 로그
  console.log('TourCard about to render DOM for:', tour.id)
  
  // DOM 요소 생성 로그
  console.log('TourCard DOM element created for:', tour.id, 'date:', tour.tour_date)
  
  // 투어 카드 렌더링 시작 로그
  console.log('TourCard rendering started for:', tour.id, 'date:', tour.tour_date, 'isToday:', isToday)
  
  // 투어 카드 렌더링 완료 로그
  console.log('TourCard rendering completed for:', tour.id, 'date:', tour.tour_date, 'isToday:', isToday)
  
  // 투어 카드 렌더링 최종 로그
  console.log('TourCard final rendering for:', tour.id, 'date:', tour.tour_date, 'isToday:', isToday)
  
  // 투어 카드 렌더링 최종 최종 로그
  console.log('TourCard ultimate rendering for:', tour.id, 'date:', tour.tour_date, 'isToday:', isToday)

  return (
    <div
      onClick={onClick}
      className={`border rounded-lg p-2 sm:p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
        isToday ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200'
      }`}
    >
      <div className="space-y-2">
        {/* 첫번째 줄: 투어명 */}
        <div>
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
            {getTourDisplayName(tour, locale)}
          </h3>
        </div>

        {/* 두번째 줄: 날짜, 인원, status */}
        <div className="flex flex-wrap gap-1 justify-between items-center">
          <div className="flex flex-wrap gap-1">
            {/* 날짜 배지 */}
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              isToday ? 'bg-blue-200 text-blue-900 font-bold' : 'bg-blue-100 text-blue-800'
            }`}>
              <Calendar className="w-3 h-3 mr-1" />
              {tour.tour_date}
              {isToday && <span className="ml-1 text-xs">({t('tourCard.today')})</span>}
            </span>

            {/* 인원 배지 - 성인/아동/유아 구분 표시 */}
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <Users className="w-3 h-3 mr-1" />
              <span>
                {(() => {
                  const adults = tour.assigned_adults || 0
                  const children = tour.assigned_children || 0
                  const infants = tour.assigned_infants || 0
                  const total = tour.assigned_people || 0
                  
                  // locale에 따른 텍스트
                  const isEnglish = locale === 'en'
                  const totalLabel = isEnglish ? 'Total' : '총'
                  const peopleLabel = isEnglish ? 'people' : '명'
                  const childLabel = isEnglish ? 'Child' : '아동'
                  const infantLabel = isEnglish ? 'Infant' : '유아'
                  
                  // 성인만 있는 경우
                  if (children === 0 && infants === 0) {
                    return `${total}${peopleLabel}`
                  }
                  
                  // 아동이나 유아가 있는 경우
                  const detailParts: string[] = []
                  if (children > 0) {
                    detailParts.push(isEnglish ? `${childLabel} ${children}` : `${childLabel}${children}`)
                  }
                  if (infants > 0) {
                    detailParts.push(isEnglish ? `${infantLabel} ${infants}` : `${infantLabel}${infants}`)
                  }
                  
                  return isEnglish 
                    ? `${totalLabel} ${total} ${peopleLabel}, ${detailParts.join(', ')}`
                    : `${totalLabel} ${total}${peopleLabel}, ${detailParts.join(', ')}`
                })()}
              </span>
            </span>

          </div>

          {/* 배정 상태 배지 - 오른쪽 끝 정렬 (투어 상태 대신 배정 상태 표시) */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAssignmentStatusBadgeClasses(tour.assignment_status)}`}>
            {tour.assignment_status === 'confirmed' ? 'Confirmed' : 'Pending'}
          </span>
        </div>

        {/* 세번째 줄: 가이드, 어시스턴트, 차량 */}
        <div className="flex flex-wrap gap-1">
          {/* 가이드 배지 */}
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <User className="w-3 h-3 mr-1" />
            {locale === 'en' ? (tour.guide_name_en || tour.guide_name || t('tourCard.unassigned')) : (tour.guide_name || t('tourCard.unassigned'))}
          </span>

          {/* 어시스턴트 배지 */}
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <User className="w-3 h-3 mr-1" />
            {locale === 'en' ? (tour.assistant_name_en || tour.assistant_name || t('tourCard.unassigned')) : (tour.assistant_name || t('tourCard.unassigned'))}
          </span>

          {/* 차량 배지 */}
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <Car className="w-3 h-3 mr-1" />
            {tour.vehicle_number || t('tourCard.unassigned')}
          </span>
        </div>
      </div>
    </div>
  )
}
