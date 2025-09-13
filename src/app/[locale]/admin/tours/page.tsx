'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Calendar, User, Car, Edit, Trash2, Clock, Grid, Eye, CalendarDays, BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import TourCalendar from '@/components/TourCalendar'
import ScheduleView from '@/components/ScheduleView'
import { calculateAssignedPeople, calculateTotalPeopleForSameProductDate, calculateUnassignedPeople } from '@/utils/tourUtils'

type Tour = Database['public']['Tables']['tours']['Row']
type ExtendedTour = Tour & {
  product_name?: string | null;
  total_people?: number;
  assigned_people?: number;
  unassigned_people?: number;
  guide_name?: string | null;
  assistant_name?: string | null;
}

type Employee = Database['public']['Tables']['team']['Row']
type Product = Database['public']['Tables']['products']['Row']

export default function AdminTours() {
  const params = useParams()
  const t = useTranslations('tours')
  const tCommon = useTranslations('common')
  
  // 직원 데이터 (Supabase에서 가져옴)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tours, setTours] = useState<ExtendedTour[]>([])
  const [allReservations, setAllReservations] = useState<Database['public']['Tables']['reservations']['Row'][]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'schedule'>('calendar')

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('*')
        .eq('is_active', true)
        .order('name_ko')

      if (error) {
        console.error('Error fetching employees:', error)
        return
      }

      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name_ko')

      if (error) {
        console.error('Error fetching products:', error)
        return
      }

      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchTours = useCallback(async () => {
    try {
      setLoading(true)
      
      // 1. 투어 데이터 가져오기
      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select('*')
        .order('tour_date', { ascending: false })

      if (toursError) {
        console.error('Error fetching tours:', toursError)
        return
      }

      // 2. 상품 정보 가져오기
      const productIds = [...new Set((toursData || []).map((tour: ExtendedTour) => tour.product_id).filter(Boolean))]
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name_ko, name_en')
        .in('id', productIds)

      const productMap = new Map(productsData?.map((p: Product) => [p.id, p.name_ko || p.name_en || p.id]) || [])

      // 3. 가이드와 어시스턴트 정보 가져오기
      const guideEmails = [...new Set((toursData || []).map((tour: ExtendedTour) => tour.tour_guide_id).filter(Boolean))]
      const assistantEmails = [...new Set((toursData || []).map((tour: ExtendedTour) => tour.assistant_id).filter(Boolean))]
      const allEmails = [...new Set([...guideEmails, ...assistantEmails])]

      const { data: teamMembers } = await supabase
        .from('team')
        .select('email, name_ko')
        .in('email', allEmails)

      const teamMap = new Map(teamMembers?.map((member: Employee) => [member.email, member]) || [])

      // 4. 모든 예약 데이터 가져오기 (confirmed, recruiting만)
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .in('status', ['confirmed', 'recruiting'])

      if (reservationsError) {
        console.error('Error fetching reservations:', reservationsError)
        return
      }

      // 5. allReservations 상태 설정
      setAllReservations(reservationsData || [])

      // 6. 각 투어에 대해 인원 계산
      const toursWithDetails: ExtendedTour[] = (toursData || []).map((tour: ExtendedTour) => {
        const assignedPeople = calculateAssignedPeople(tour, reservationsData || [])
        const totalPeople = calculateTotalPeopleForSameProductDate(tour, reservationsData || [])
        const unassignedPeople = calculateUnassignedPeople(tour, reservationsData || [])

        const guide = tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) : null
        const assistant = tour.assistant_id ? teamMap.get(tour.assistant_id) : null

        return {
          ...tour,
          product_name: tour.product_id ? productMap.get(tour.product_id) : null,
          total_people: totalPeople,
          assigned_people: assignedPeople,
          unassigned_people: unassignedPeople,
          guide_name: guide?.name_ko || null,
          assistant_name: assistant?.name_ko || null,
          is_private_tour: tour.is_private_tour === true
        }
      })

      setTours(toursWithDetails)
    } catch (error) {
      console.error('Error fetching tours:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
    fetchProducts()
    fetchTours()
  }, [fetchTours])

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  // 필터링된 투어 목록
  const filteredTours = tours.filter(tour => {
    const matchesSearch = !searchTerm || 
      tour.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tour.product_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tour.guide_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tour.assistant_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = selectedStatus === 'all' || tour.status === selectedStatus

    return matchesSearch && matchesStatus
  })

  const handleTourClick = (tour: ExtendedTour) => {
    window.location.href = `/ko/admin/tours/${tour.id}`
  }

  const handleDeleteTour = async (tourId: string) => {
    if (!confirm('정말로 이 투어를 삭제하시겠습니까?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('tours')
        .delete()
        .eq('id', tourId)

      if (error) {
        console.error('Error deleting tour:', error)
        alert('투어 삭제 중 오류가 발생했습니다.')
        return
      }

      // 투어 목록 새로고침
      fetchTours()
      alert('투어가 성공적으로 삭제되었습니다.')
    } catch (error) {
      console.error('Error deleting tour:', error)
      alert('투어 삭제 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">투어 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('title')}</h1>
        
        {/* 검색 및 필터 */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Q 투어 ID, 상품 ID, 투어 가이드로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">모든 상태</option>
            <option value="pending">대기중</option>
            <option value="confirmed">확정</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소</option>
            <option value="recruiting">모집중</option>
          </select>
        </div>

        {/* 뷰 모드 및 액션 버튼 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                viewMode === 'list' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span className="hidden xs:inline">리스트 뷰</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                viewMode === 'calendar' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden xs:inline">달력 보기</span>
            </button>
            <button
              onClick={() => setViewMode('schedule')}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                viewMode === 'schedule' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span className="hidden xs:inline">스케줄 뷰</span>
            </button>
          </div>
          
          <button
            onClick={() => window.location.href = '/ko/admin/tours/new'}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">{t('addTour')}</span>
          </button>
        </div>
      </div>

      {/* 달력 보기 */}
      {viewMode === 'calendar' && (
        <TourCalendar tours={filteredTours} onTourClick={handleTourClick} allReservations={allReservations} />
      )}

      {/* 스케줄 뷰 */}
      {viewMode === 'schedule' && (
        <ScheduleView />
      )}

      {/* 리스트 뷰 */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-lg shadow-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">투어 ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">투어 날짜</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가이드</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">인원</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTours.map((tour) => (
                  <tr key={tour.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tour.id}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tour.product_name || tour.product_id}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tour.tour_date}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        tour.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        tour.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        tour.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        tour.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        tour.status === 'recruiting' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {tour.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tour.guide_name || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tour.assigned_people || 0} / {tour.total_people || 0}
                      {tour.unassigned_people && tour.unassigned_people > 0 && (
                        <span className="text-red-600 ml-1">({tour.unassigned_people}명)</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleTourClick(tour)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.location.href = `/ko/admin/tours/${tour.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTour(tour.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}