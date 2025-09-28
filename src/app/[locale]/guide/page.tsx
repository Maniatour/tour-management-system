'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Users, MapPin, Clock, ArrowRight, CalendarOff, CheckCircle, XCircle, Clock as ClockIcon } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type Tour = Database['public']['Tables']['tours']['Row']
type ExtendedTour = Tour & {
  product_name?: string | null;
  assigned_people?: number;
  guide_name?: string | null;
  assistant_name?: string | null;
}

type OffSchedule = Database['public']['Tables']['off_schedules']['Row']

export default function GuideDashboard() {
  const router = useRouter()
  const supabase = createClientSupabase()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  // 오늘 날짜 (컴포넌트 레벨에서 정의)
  const today = new Date().toISOString().split('T')[0]
  
  const [upcomingTours, setUpcomingTours] = useState<ExtendedTour[]>([])
  const [todayTours, setTodayTours] = useState<ExtendedTour[]>([])
  const [offSchedules, setOffSchedules] = useState<OffSchedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTours = async () => {
      try {
        setLoading(true)

        if (!currentUserEmail) return
        
        // 내일 날짜
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        // 투어 가이드가 배정된 투어 가져오기
        const { data: toursData, error } = await supabase
          .from('tours')
          .select('*')
          .or(`tour_guide_id.eq.${currentUserEmail},assistant_id.eq.${currentUserEmail}`)
          .gte('tour_date', today)
          .order('tour_date', { ascending: true })
          .limit(10)

        if (error) {
          console.error('Error loading tours:', error)
          return
        }

        // 상품 정보 가져오기
        const productIds = [...new Set((toursData || []).map(tour => tour.product_id).filter(Boolean))]
        let productMap = new Map()
        
        if (productIds.length > 0) {
          const { data: productsData } = await supabase
            .from('products')
            .select('id, name_ko, name_en, name')
            .in('id', productIds)
          
          productMap = new Map((productsData || []).map(p => [p.id, p.name_ko || p.name_en || p.name]))
        }

        // 팀원 정보 가져오기
        const guideEmails = [...new Set((toursData || []).map(tour => tour.tour_guide_id).filter(Boolean))]
        const assistantEmails = [...new Set((toursData || []).map(tour => tour.assistant_id).filter(Boolean))]
        const allEmails = [...new Set([...guideEmails, ...assistantEmails])]
        
        let teamMap = new Map()
        if (allEmails.length > 0) {
          const { data: teamData } = await supabase
            .from('team')
            .select('email, name_ko')
            .in('email', allEmails)
          
          teamMap = new Map((teamData || []).map(member => [member.email, member.name_ko]))
        }

        // 예약 정보로 인원 계산
        const reservationIds = [...new Set((toursData || []).flatMap(tour => {
          if (!tour.reservation_ids) return []
          return Array.isArray(tour.reservation_ids) 
            ? tour.reservation_ids 
            : String(tour.reservation_ids).split(',').map(id => id.trim()).filter(id => id)
        }))]

        let reservationMap = new Map()
        if (reservationIds.length > 0) {
          const { data: reservationsData } = await supabase
            .from('reservations')
            .select('id, total_people')
            .in('id', reservationIds)
          
          reservationMap = new Map((reservationsData || []).map(r => [r.id, r.total_people || 0]))
        }

        // 투어 데이터 확장
        const extendedTours: ExtendedTour[] = (toursData || []).map(tour => {
          let assignedPeople = 0
          if (tour.reservation_ids) {
            const ids = Array.isArray(tour.reservation_ids) 
              ? tour.reservation_ids 
              : String(tour.reservation_ids).split(',').map(id => id.trim()).filter(id => id)
            
            assignedPeople = ids.reduce((sum, id) => sum + (reservationMap.get(id) || 0), 0)
          }

          return {
            ...tour,
            product_name: tour.product_id ? productMap.get(tour.product_id) : null,
            assigned_people: assignedPeople,
            guide_name: tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) : null,
            assistant_name: tour.assistant_id ? teamMap.get(tour.assistant_id) : null,
          }
        })

        // 오늘 투어와 다가오는 투어 분리
        const todayToursList = extendedTours.filter(tour => tour.tour_date === today)
        const upcomingToursList = extendedTours.filter(tour => tour.tour_date !== today)

        setTodayTours(todayToursList)
        setUpcomingTours(upcomingToursList.slice(0, 5)) // 최대 5개만 표시

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
  }, [currentUserEmail, supabase])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">대시보드를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* 환영 메시지 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 sm:p-6 text-white">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">
          안녕하세요, {isSimulating && simulatedUser ? simulatedUser.name_ko : currentUserEmail}님!
          {isSimulating && simulatedUser && (
            <span className="text-sm font-normal text-blue-200 ml-2">
              (시뮬레이션: {simulatedUser.position})
            </span>
          )}
        </h1>
        <p className="text-blue-100">
          {userRole === 'admin' || userRole === 'manager' 
            ? '투어 가이드 페이지를 확인하고 있습니다. (관리자 모드)'
            : '투어 가이드 대시보드에 오신 것을 환영합니다.'
          }
        </p>
      </div>

      {/* 오늘 투어 */}
      {todayTours.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-red-500" />
              오늘의 투어
            </h2>
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-medium">
              {todayTours.length}개
            </span>
          </div>
          <div className="space-y-3">
            {todayTours.map((tour) => (
              <div
                key={tour.id}
                onClick={() => router.push(`/ko/guide/tours/${tour.id}`)}
                className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {tour.product_name || tour.product_id}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Clock className="w-4 h-4 mr-1" />
                      {tour.tour_start_datetime || '시간 미정'}
                      {tour.tour_end_datetime && (
                        <>
                          <span className="mx-2">-</span>
                          {tour.tour_end_datetime}
                        </>
                      )}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Users className="w-4 h-4 mr-1" />
                      {tour.assigned_people || 0}명
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClasses(tour.tour_status)}`}>
                      {tour.tour_status || '상태 없음'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 다가오는 투어 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-500" />
            다가오는 투어
          </h2>
          <button
            onClick={() => router.push('/ko/guide/tours')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            전체 보기
          </button>
        </div>
        
        {upcomingTours.length > 0 ? (
          <div className="space-y-3">
            {upcomingTours.map((tour) => (
              <div
                key={tour.id}
                onClick={() => router.push(`/ko/guide/tours/${tour.id}`)}
                className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {tour.product_name || tour.product_id}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      {tour.tour_date}
                      {tour.tour_start_datetime && (
                        <>
                          <span className="mx-2">|</span>
                          <Clock className="w-4 h-4 mr-1" />
                          {tour.tour_start_datetime}
                        </>
                      )}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Users className="w-4 h-4 mr-1" />
                      {tour.assigned_people || 0}명
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClasses(tour.tour_status)}`}>
                      {tour.tour_status || '상태 없음'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>다가오는 투어가 없습니다.</p>
          </div>
        )}
      </div>

      {/* 오프 스케줄 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CalendarOff className="w-5 h-5 mr-2 text-purple-500" />
            내 오프 스케줄 ({offSchedules.length}개)
          </h2>
          <button
            onClick={() => router.push('/ko/off-schedule')}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
          >
            전체 보기
          </button>
        </div>
        
        {offSchedules.length > 0 ? (
          <div className="space-y-3">
            {offSchedules.slice(0, 10).map((schedule) => (
              <div
                key={schedule.id}
                className={`border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors ${
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
                        {schedule.off_date}
                        {schedule.off_date === today && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            오늘
                          </span>
                        )}
                        {schedule.off_date < today && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            지난 날
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
                        {schedule.status === 'approved' ? '승인됨' : 
                         schedule.status === 'pending' ? '대기중' : 
                         schedule.status === 'rejected' ? '거부됨' : schedule.status}
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
            <p>신청한 오프 스케줄이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 빠른 액션 */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">빠른 액션</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <button
            onClick={() => router.push('/ko/guide/tours')}
            className="flex items-center p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 mr-3 sm:mr-4" />
            <div className="text-left">
              <h3 className="font-medium text-gray-900">투어 관리</h3>
              <p className="text-sm text-gray-500">내 투어 목록 보기</p>
            </div>
          </button>
          
          <button
            onClick={() => router.push('/ko/guide/tours?view=calendar')}
            className="flex items-center p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <MapPin className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mr-3 sm:mr-4" />
            <div className="text-left">
              <h3 className="font-medium text-gray-900">달력 보기</h3>
              <p className="text-sm text-gray-500">투어 일정 달력</p>
            </div>
          </button>
          
          <button
            onClick={() => router.push('/ko/off-schedule')}
            className="flex items-center p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <CalendarOff className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 mr-3 sm:mr-4" />
            <div className="text-left">
              <h3 className="font-medium text-gray-900">오프 스케줄</h3>
              <p className="text-sm text-gray-500">휴가 신청하기</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
