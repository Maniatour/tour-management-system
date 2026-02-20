'use client'

import React, { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { X, FileText, Calendar, MapPin, Users, User, Car, CheckCircle, AlertCircle, Edit, Clock } from 'lucide-react'
import TourReportForm from './TourReportForm'

type Tour = Database['public']['Tables']['tours']['Row']
type ExtendedTour = Tour & {
  product_name?: string | null;
  product_name_en?: string | null;
  assigned_people?: number;
  guide_name?: string | null;
  assistant_name?: string | null;
  vehicle_number?: string | null;
  has_report?: boolean;
  report_id?: string | null;
  report_created_at?: string | null;
  can_edit?: boolean;
}

interface TourReportModalProps {
  isOpen: boolean
  onClose: () => void
  locale: string
}

export default function TourReportModal({ isOpen, onClose, locale }: TourReportModalProps) {
  const supabase = createClientSupabase()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  
  // 번역 함수
  const getText = (ko: string, en: string) => locale === 'en' ? en : ko
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  const [tours, setTours] = useState<ExtendedTour[]>([])
  const [selectedTour, setSelectedTour] = useState<ExtendedTour | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [showReportForm, setShowReportForm] = useState(false)
  const [currentEditingTour, setCurrentEditingTour] = useState<ExtendedTour | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadTours()
    }
  }, [isOpen, currentUserEmail])

  const loadTours = async () => {
    try {
      setLoading(true)
      
      if (!currentUserEmail) return

      // 최근 30일간의 투어 데이터 가져오기
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

      const { data: toursData, error } = await supabase
        .from('tours')
        .select('*')
        .or(`tour_guide_id.eq.${currentUserEmail},assistant_id.eq.${currentUserEmail}`)
        .gte('tour_date', thirtyDaysAgoStr)
        .order('tour_date', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error loading tours:', error)
        return
      }

      // 상품 정보 가져오기
      const productIds = [...new Set((toursData || []).map(tour => tour.product_id).filter(Boolean))]
      let productMap = new Map()
      let productEnMap = new Map()
      
      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name_ko, name_en, name')
          .in('id', productIds)
        
        productMap = new Map((productsData || []).map(p => [p.id, p.name_ko || p.name_en || p.name]))
        productEnMap = new Map((productsData || []).map(p => [p.id, p.name_en || p.name_ko || p.name]))
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

      // 차량 정보 가져오기
      const vehicleIds = [...new Set((toursData || []).map(tour => tour.tour_car_id).filter(Boolean))]
      
      let vehicleMap = new Map()
      if (vehicleIds.length > 0) {
        const { data: vehiclesData } = await supabase
          .from('vehicles')
          .select('id, vehicle_number, nick')
          .in('id', vehicleIds)
        
        vehicleMap = new Map((vehiclesData || []).map((vehicle: { id: string; vehicle_number: string | null; nick?: string | null }) => [vehicle.id, (vehicle.nick && vehicle.nick.trim()) || vehicle.vehicle_number || null]))
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

      // 투어 리포트 정보 가져오기
      const tourIds = (toursData || []).map(tour => tour.id)
      let reportMap = new Map()
      
      if (tourIds.length > 0) {
        const { data: reportsData } = await supabase
          .from('tour_reports')
          .select('id, tour_id, created_at')
          .in('tour_id', tourIds)
          .eq('user_email', currentUserEmail)
        
        reportMap = new Map((reportsData || []).map(report => [report.tour_id, {
          id: report.id,
          created_at: report.created_at
        }]))
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

        const reportInfo = reportMap.get(tour.id)
        const hasReport = !!reportInfo
        const reportCreatedAt = reportInfo?.created_at
        
        // 3일 내 수정 가능 여부 확인
        let canEdit = false
        if (reportCreatedAt) {
          const reportDate = new Date(reportCreatedAt)
          const threeDaysAgo = new Date()
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
          canEdit = reportDate > threeDaysAgo
        }

        return {
          ...tour,
          product_name: tour.product_id ? productMap.get(tour.product_id) : null,
          product_name_en: tour.product_id ? productEnMap.get(tour.product_id) : null,
          assigned_people: assignedPeople,
          guide_name: tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) : null,
          assistant_name: tour.assistant_id ? teamMap.get(tour.assistant_id) : null,
          vehicle_number: tour.tour_car_id ? vehicleMap.get(tour.tour_car_id) : null,
          has_report: hasReport,
          report_id: reportInfo?.id || null,
          report_created_at: reportCreatedAt || null,
          can_edit: canEdit
        }
      })

      setTours(extendedTours)

    } catch (error) {
      console.error('Error loading tours:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTours = tours.filter(tour => {
    const matchesSearch = !searchTerm || 
      (tour.product_name && tour.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tour.product_name_en && tour.product_name_en.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesDate = !dateFilter || tour.tour_date === dateFilter
    
    // 오늘 날짜 기준으로 미래 투어는 제외
    const today = new Date().toISOString().split('T')[0]
    const isPastOrToday = tour.tour_date <= today
    
    return matchesSearch && matchesDate && isPastOrToday
  })

  // 미작성 투어와 작성된 투어 분리
  const uncompletedTours = filteredTours.filter(tour => !tour.has_report)
  const completedTours = filteredTours.filter(tour => tour.has_report)

  const formatDateWithDay = (dateString: string) => {
    const date = new Date(dateString)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const dayName = days[date.getDay()]
    return `${dateString} (${dayName})`
  }

  const getReportStatusBadge = (tour: ExtendedTour) => {
    if (!tour.has_report) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          {getText('미작성', 'Unwritten')}
        </span>
      )
    } else if (tour.can_edit) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          {getText('수정가능', 'Editable')}
        </span>
      )
    } else {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          {getText('작성완료', 'Completed')}
        </span>
      )
    }
  }

  const handleCreateReport = (tour: ExtendedTour) => {
    setCurrentEditingTour(tour)
    setShowReportForm(true)
  }

  const handleEditReport = (tour: ExtendedTour) => {
    setCurrentEditingTour(tour)
    setShowReportForm(true)
  }

  const handleReportFormSuccess = () => {
    setShowReportForm(false)
    setCurrentEditingTour(null)
    loadTours() // 데이터 다시 로드
  }

  const handleReportFormCancel = () => {
    setShowReportForm(false)
    setCurrentEditingTour(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="w-6 h-6 mr-2 text-red-500" />
            {getText('투어 리포트 작성', 'Tour Report')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {!showReportForm ? (
            // 투어 선택 단계
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={getText('투어명으로 검색...', 'Search by tour name...')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="w-40">
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">투어 목록을 불러오는 중...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 미작성 투어 목록 */}
                  {uncompletedTours.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">{getText('미작성 리포트', 'Unwritten Reports')}</h3>
                      <div className="grid gap-3">
                        {uncompletedTours.map((tour) => (
                          <div
                            key={tour.id}
                            onClick={() => handleCreateReport(tour)}
                            className="border border-red-300 bg-red-50 rounded-lg p-4 hover:opacity-80 cursor-pointer transition-all"
                          >
                            {/* 상단: 투어 이름 */}
                            <div className="mb-3">
                              <h4 className="font-semibold text-gray-900 text-base">
                                {locale === 'en' ? (tour.product_name_en || tour.product_name || tour.product_id) : (tour.product_name || tour.product_id)}
                              </h4>
                            </div>

                            {/* 중단: 날짜, 인원, 상태 */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <span className="flex items-center text-sm text-gray-600">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {formatDateWithDay(tour.tour_date)}
                                </span>
                                <span className="flex items-center text-sm text-gray-600">
                                  <Users className="w-4 h-4 mr-1" />
                                  {tour.assigned_people || 0}
                                </span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                tour.tour_status === 'completed' ? 'bg-green-100 text-green-800' :
                                tour.tour_status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                tour.tour_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {tour.tour_status || '상태없음'}
                              </span>
                            </div>

                            {/* 하단: 가이드, 어시스턴트, 차량, 미작성뱃지 */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 text-sm text-gray-600">
                                <span className="flex items-center">
                                  <User className="w-4 h-4 mr-1" />
                                  {tour.guide_name || getText('미배정', 'Unassigned')}
                                </span>
                                <span className="flex items-center">
                                  <User className="w-4 h-4 mr-1" />
                                  {tour.assistant_name || getText('미배정', 'Unassigned')}
                                </span>
                                {tour.vehicle_number && (
                                  <span className="flex items-center">
                                    <Car className="w-4 h-4 mr-1" />
                                    {tour.vehicle_number}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {getReportStatusBadge(tour)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 작성된 투어 목록 */}
                  {completedTours.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">{getText('작성된 리포트', 'Written Reports')}</h3>
                      <div className="grid gap-3">
                        {completedTours.map((tour) => (
                          <div
                            key={tour.id}
                            onClick={() => tour.can_edit ? handleEditReport(tour) : undefined}
                            className={`border border-blue-300 bg-blue-50 rounded-lg p-4 transition-all ${
                              tour.can_edit ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            {/* 상단: 투어 이름 */}
                            <div className="mb-3">
                              <h4 className="font-semibold text-gray-900 text-base">
                                {locale === 'en' ? (tour.product_name_en || tour.product_name || tour.product_id) : (tour.product_name || tour.product_id)}
                              </h4>
                            </div>

                            {/* 중단: 날짜, 인원, 상태 */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <span className="flex items-center text-sm text-gray-600">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {formatDateWithDay(tour.tour_date)}
                                </span>
                                <span className="flex items-center text-sm text-gray-600">
                                  <Users className="w-4 h-4 mr-1" />
                                  {tour.assigned_people || 0}
                                </span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                tour.tour_status === 'completed' ? 'bg-green-100 text-green-800' :
                                tour.tour_status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                tour.tour_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {tour.tour_status || '상태없음'}
                              </span>
                            </div>

                            {/* 하단: 가이드, 어시스턴트, 차량, 작성뱃지 */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 text-sm text-gray-600">
                                <span className="flex items-center">
                                  <User className="w-4 h-4 mr-1" />
                                  {tour.guide_name || getText('미배정', 'Unassigned')}
                                </span>
                                <span className="flex items-center">
                                  <User className="w-4 h-4 mr-1" />
                                  {tour.assistant_name || getText('미배정', 'Unassigned')}
                                </span>
                                {tour.vehicle_number && (
                                  <span className="flex items-center">
                                    <Car className="w-4 h-4 mr-1" />
                                    {tour.vehicle_number}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {getReportStatusBadge(tour)}
                                {tour.report_created_at && (
                                  <span className="text-xs text-gray-500">
                                    {new Date(tour.report_created_at).toLocaleDateString('ko-KR')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {uncompletedTours.length === 0 && completedTours.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>선택 가능한 투어가 없습니다</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : (
            // 리포트 작성 폼 (기존 TourReportForm 컴포넌트 사용)
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-green-900">
                    리포트 작성 중: {locale === 'en' ? (currentEditingTour?.product_name_en || currentEditingTour?.product_name || currentEditingTour?.product_id) : (currentEditingTour?.product_name || currentEditingTour?.product_id)}
                  </h4>
                  <button
                    onClick={() => setShowReportForm(false)}
                    className="text-sm text-green-600 hover:text-green-800 underline"
                  >
                    다른 투어 선택
                  </button>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-green-700">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {currentEditingTour && formatDateWithDay(currentEditingTour.tour_date)}
                  </span>
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {currentEditingTour?.assigned_people || 0}명
                  </span>
                </div>
              </div>
              
              {/* 실제 리포트 폼 컴포넌트 */}
              {currentEditingTour && (
                <TourReportForm
                  tourId={currentEditingTour.id}
                  onSuccess={handleReportFormSuccess}
                  onCancel={handleReportFormCancel}
                  locale={locale}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
