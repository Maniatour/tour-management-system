'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Users, CalendarOff, CheckCircle, XCircle, Clock as ClockIcon, Plus, X, User, Car, History } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'

type Tour = Database['public']['Tables']['tours']['Row']
type ExtendedTour = Tour & {
  product_name?: string | null;
  product_name_en?: string | null;
  internal_name_ko?: string | null;
  internal_name_en?: string | null;
  assigned_people?: number;
  guide_name?: string | null;
  guide_name_en?: string | null;
  assistant_name?: string | null;
  assistant_name_en?: string | null;
  assignment_status?: string | null;
  vehicle_number?: string | null;
}

type OffSchedule = Database['public']['Tables']['off_schedules']['Row']

export default function GuideDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const supabase = createClientSupabase()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  const t = useTranslations('guide')
  const { locale } = use(params)
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  // 오늘 날짜 (컴포넌트 레벨에서 정의)
  const today = new Date().toISOString().split('T')[0]

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

        if (!currentUserEmail) return
        

        // 투어 가이드가 배정된 투어 가져오기 (최근 30일)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

        const { data: toursData, error } = await supabase
          .from('tours')
          .select('*')
          .or(`tour_guide_id.eq.${currentUserEmail},assistant_id.eq.${currentUserEmail}`)
          .gte('tour_date', thirtyDaysAgoStr)
          .order('tour_date', { ascending: true })
          .limit(50) as { data: Tour[] | null; error: Error | null }

        if (error) {
          console.error('Error loading tours:', error)
          return
        }

        // 상품 정보 가져오기
        const productIds = [...new Set((toursData || []).map(tour => tour.product_id).filter(Boolean))]
        let productMap = new Map()
        let productEnMap = new Map()
        let productInternalKoMap = new Map()
        let productInternalEnMap = new Map()
        
        if (productIds.length > 0) {
          const { data: productsData } = await supabase
            .from('products')
            .select('id, name_ko, name_en, name, internal_name_ko, internal_name_en')
            .in('id', productIds) as { data: { id: string; name_ko: string; name_en: string; name: string; internal_name_ko: string | null; internal_name_en: string | null }[] | null }
          
          productMap = new Map((productsData || []).map(p => [p.id, p.name_ko || p.name]))
          productEnMap = new Map((productsData || []).map(p => [p.id, p.name_en || p.name]))
          productInternalKoMap = new Map((productsData || []).map(p => [p.id, p.internal_name_ko]))
          productInternalEnMap = new Map((productsData || []).map(p => [p.id, p.internal_name_en]))
        }

        // 팀원 정보 가져오기
        const guideEmails = [...new Set((toursData || []).map(tour => tour.tour_guide_id).filter(Boolean))]
        const assistantEmails = [...new Set((toursData || []).map(tour => tour.assistant_id).filter(Boolean))]
        const allEmails = [...new Set([...guideEmails, ...assistantEmails])]
        
        let teamMap = new Map()
        let teamEnMap = new Map()
        if (allEmails.length > 0) {
          const { data: teamData } = await supabase
            .from('team')
            .select('email, name_ko, name_en')
            .in('email', allEmails) as { data: { email: string; name_ko: string; name_en: string }[] | null }
          
          teamMap = new Map((teamData || []).map(member => [member.email, member.name_ko]))
          teamEnMap = new Map((teamData || []).map(member => [member.email, member.name_en]))
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
            .in('id', reservationIds) as { data: { id: string; total_people: number | null }[] | null }
          
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
            product_name_en: tour.product_id ? productEnMap.get(tour.product_id) : null,
            internal_name_ko: tour.product_id ? productInternalKoMap.get(tour.product_id) : null,
            internal_name_en: tour.product_id ? productInternalEnMap.get(tour.product_id) : null,
            assigned_people: assignedPeople,
            guide_name: tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) : null,
            guide_name_en: tour.tour_guide_id ? teamEnMap.get(tour.tour_guide_id) : null,
            assistant_name: tour.assistant_id ? teamMap.get(tour.assistant_id) : null,
            assistant_name_en: tour.assistant_id ? teamEnMap.get(tour.assistant_id) : null,
            vehicle_number: tour.tour_car_id ? vehicleMap.get(tour.tour_car_id) : null,
          }
        })

        // 투어 분류
        const upcomingToursList = extendedTours.filter(tour => tour.tour_date >= today)
        const pastToursList = extendedTours.filter(tour => tour.tour_date < today)

        setUpcomingTours(upcomingToursList.slice(0, 5)) // 최대 5개만 표시
        setPastTours(pastToursList.slice(0, 10)) // 최대 10개만 표시

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
      alert('날짜와 사유를 모두 입력해주세요.')
      return
    }

    if (offScheduleForm.is_multi_day && (!offScheduleForm.end_date || offScheduleForm.end_date < offScheduleForm.off_date)) {
      alert('종료 날짜를 시작 날짜 이후로 설정해주세요.')
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

      alert(`${dates.length}일의 오프 스케줄이 추가되었습니다.`)
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
      alert('오프 스케줄 저장 중 오류가 발생했습니다.')
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
              (시뮬레이션: {simulatedUser.position})
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
                        upcomingTours.map((tour) => (
                          <TourCard key={tour.id} tour={tour} onClick={() => router.push(`/${locale}/guide/tours/${tour.id}`)} locale={locale} />
                        ))
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
        
        {offSchedules.length > 0 ? (
          <div className="space-y-3">
            {offSchedules.slice(0, 10).map((schedule) => (
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
            <p>{t('offSchedule.noSchedules')}</p>
          </div>
        )}
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
                  추가하기
                </button>
                <button
                  type="button"
                  onClick={closeOffScheduleModal}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
                >
                  취소
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
  
  // 투어 이름 매핑 함수
  const getTourDisplayName = (tour: ExtendedTour, locale: string) => {
    if (locale === 'en') {
      // 영어 모드에서는 internal_name_en 우선 사용
      return tour.internal_name_en || tour.product_name_en || tour.product_name || tour.product_id
    } else {
      // 한국어 모드에서는 internal_name_ko 우선 사용
      return tour.internal_name_ko || tour.product_name || tour.product_id
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

  return (
    <div
      onClick={onClick}
      className="border border-gray-200 rounded-lg p-2 sm:p-3 hover:bg-gray-50 cursor-pointer transition-colors"
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
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <Calendar className="w-3 h-3 mr-1" />
              {tour.tour_date}
            </span>

            {/* 인원 배지 */}
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <Users className="w-3 h-3 mr-1" />
              {tour.assigned_people || 0}
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
