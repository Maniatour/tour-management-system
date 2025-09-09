'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Calendar, User, Car, DollarSign, Edit, Trash2, Clock, Grid, Eye, CalendarDays, BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import TourCalendar from '@/components/TourCalendar'
import ScheduleView from '@/components/ScheduleView'
type Tour = Database['public']['Tables']['tours']['Row']

type Employee = Database['public']['Tables']['team']['Row']
type Product = Database['public']['Tables']['products']['Row']

export default function AdminTours() {
  const params = useParams()
  const t = useTranslations('tours')
  const tCommon = useTranslations('common')
  
  // 직원 데이터 (Supabase에서 가져옴)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'schedule'>('calendar')

  // Supabase에서 데이터 가져오기
  useEffect(() => {
    fetchEmployees()
    fetchProducts()
    fetchTours()
  }, [])

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
        .eq('status', 'active')
        .in('sub_category', ['Mania Tour', 'Mania Service'])
        .order('name')

      if (error) {
        console.error('Error fetching products:', error)
        return
      }

      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchTours = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .order('tour_date', { ascending: false })

      if (error) {
        console.error('Error fetching tours:', error)
        return
      }

      // 상품 정보 가져오기
      const productIds = [...new Set((data || []).map(tour => tour.product_id).filter(Boolean))]
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds)

      const productMap = new Map(products?.map(p => [p.id, p.name]) || [])

      // 가이드와 어시스턴트 정보 가져오기 (team 테이블 사용)
      const guideEmails = [...new Set((data || []).map(tour => tour.tour_guide_id).filter(Boolean))]
      const assistantEmails = [...new Set((data || []).map(tour => tour.assistant_id).filter(Boolean))]
      const allEmails = [...new Set([...guideEmails, ...assistantEmails])]

      const { data: teamMembers } = await supabase
        .from('team')
        .select('email, name_ko')
        .in('email', allEmails)

      const teamMap = new Map(teamMembers?.map(member => [member.email, member]) || [])

      // 모든 예약 데이터를 한 번에 가져오기 (최적화)
      const reservationMap = new Map<string, Database['public']['Tables']['reservations']['Row'][]>()
      
      // 투어 데이터에서 필요한 날짜 범위 계산
      const tourDates = [...new Set((data || []).map(tour => tour.tour_date).filter(Boolean))]
      
      // 예약 데이터 변수 선언 (TDZ 문제 해결)
      let allReservations: Database['public']['Tables']['reservations']['Row'][] = []
      
      if (tourDates.length > 0 && productIds.length > 0) {
        // 한 번의 요청으로 모든 관련 예약 데이터 가져오기
        const { data: reservationsData } = await supabase
          .from('reservations')
          .select('*')
          .in('product_id', productIds)
          .in('tour_date', tourDates)
        
        allReservations = reservationsData || []
        
        // product_id + tour_date 조합으로 그룹화
        allReservations.forEach(reservation => {
          const key = `${reservation.product_id}-${reservation.tour_date}`
          if (!reservationMap.has(key)) {
            reservationMap.set(key, [])
          }
          reservationMap.get(key)!.push(reservation)
        })
      }


      // 각 투어에 대해 총인원 및 배정된 인원 계산
      const toursWithDetails = (data || []).map(tour => {
        const key = `${tour.product_id}-${tour.tour_date}`
        const tourReservations = reservationMap.get(key) || []
        
        // 총인원 계산 - 해당 상품/날짜의 모든 예약의 total_people 합산
        const totalPeople = tourReservations.reduce((sum, res) => 
          sum + (res.total_people || 0), 0
        )
        
        // 배정된 인원 계산 - reservation_ids 배열의 각 ID에 해당하는 예약의 total_people 합산
        let assignedPeople = 0
        if (tour.reservation_ids && Array.isArray(tour.reservation_ids) && tour.reservation_ids.length > 0) {
          // reservation_ids 배열의 각 ID에 대해 해당하는 예약 찾기
          const assignedReservations = tourReservations.filter(res => 
            tour.reservation_ids.includes(res.id)
          )
          
          assignedPeople = assignedReservations.reduce((sum, res) => 
            sum + (res.total_people || 0), 0
          )
          
          
        }

        const guide = tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) : null
        const assistant = tour.assistant_id ? teamMap.get(tour.assistant_id) : null

        return {
          ...tour,
          product_name: productMap.get(tour.product_id),
          total_people: totalPeople,
          assigned_people: assignedPeople,
          guide_name: guide?.name_ko || null,
          assistant_name: assistant?.name_ko || null,
          // Supabase의 TRUE/FALSE를 JavaScript의 true/false로 변환
          is_private_tour: tour.is_private_tour === 'TRUE' || tour.is_private_tour === true
        }
      })

      setTours(toursWithDetails)
    } catch (error) {
      console.error('Error fetching tours:', error)
    } finally {
      setLoading(false)
    }
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTour, setEditingTour] = useState<Tour | null>(null)

  const filteredTours = tours.filter(tour => {
    const matchesSearch = 
      tour.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tour.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tour.tour_date.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = selectedStatus === 'all' || tour.tour_status === selectedStatus
    
    return matchesSearch && matchesStatus
  })

  const handleAddTour = async (tour: Omit<Tour, 'id' | 'created_at'>) => {
    try {
      // 빈 문자열을 null로 변환
      const cleanedTour = {
        ...tour,
        tour_start_datetime: tour.tour_start_datetime || null,
        tour_end_datetime: tour.tour_end_datetime || null,
        tour_guide_id: tour.tour_guide_id || null,
        assistant_id: tour.assistant_id || null,
        tour_car_id: tour.tour_car_id || null
      }

      const { data, error } = await supabase
        .from('tours')
        .insert([cleanedTour])
        .select()

      if (error) {
        console.error('Error adding tour:', error)
        return
      }

      if (data) {
        setTours([data[0], ...tours])
      }
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding tour:', error)
    }
  }

  const handleEditTour = async (tour: Omit<Tour, 'id' | 'created_at'>) => {
    if (editingTour) {
      try {
        // 빈 문자열을 null로 변환
        const cleanedTour = {
          ...tour,
          tour_start_datetime: tour.tour_start_datetime || null,
          tour_end_datetime: tour.tour_end_datetime || null,
          tour_guide_id: tour.tour_guide_id || null,
          assistant_id: tour.assistant_id || null,
          tour_car_id: tour.tour_car_id || null
        }

        const { error } = await supabase
          .from('tours')
          .update(cleanedTour)
          .eq('id', editingTour.id)

        if (error) {
          console.error('Error updating tour:', error)
          return
        }

        setTours(tours.map(t => t.id === editingTour.id ? { ...t, ...cleanedTour } : t))
        setEditingTour(null)
      } catch (error) {
        console.error('Error updating tour:', error)
      }
    }
  }

  const handleDeleteTour = async (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      try {
        const { error } = await supabase
          .from('tours')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting tour:', error)
          return
        }

        setTours(tours.filter(t => t.id !== id))
      } catch (error) {
        console.error('Error deleting tour:', error)
      }
    }
  }

  const handleTourClick = (tour: Tour) => {
    // 달력에서 투어 클릭 시 상세 페이지로 이동
    window.location.href = `/${params.locale}/admin/tours/${tour.id}`
  }

  const getStatusLabel = (status: string) => {
    return t(`status.${status}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'inProgress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'delayed': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getGuideName = (guideId: string) => {
    const guide = employees.find(e => e.email === guideId)
    return guide ? guide.name_ko : 'Unknown'
  }

  const getAssistantName = (assistantId: string) => {
    if (!assistantId) return '없음'
    const assistant = employees.find(e => e.email === assistantId)
    return assistant ? assistant.name_ko : 'Unknown'
  }

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{tCommon('loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 - 모바일 최적화 */}
      <div className="flex flex-col space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('title')}</h1>
        
        <div className="flex flex-col space-y-3">
          {/* 검색 및 필터 - 모바일 최적화 */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">{t('filter.allStatus')}</option>
              <option value="scheduled">{t('status.scheduled')}</option>
              <option value="inProgress">{t('status.inProgress')}</option>
              <option value="completed">{t('status.completed')}</option>
              <option value="cancelled">{t('status.cancelled')}</option>
              <option value="delayed">{t('status.delayed')}</option>
            </select>
          </div>

          {/* 뷰 모드 전환 버튼 - 모바일 최적화 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 sm:px-3 py-2 rounded-lg flex items-center space-x-1 sm:space-x-2 transition-colors text-xs sm:text-sm ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Grid size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">리스트 뷰</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-2 sm:px-3 py-2 rounded-lg flex items-center space-x-1 sm:space-x-2 transition-colors text-xs sm:text-sm ${
                viewMode === 'calendar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarDays size={16} />
              <span className="hidden sm:inline">{t('view.calendar')}</span>
            </button>
            <button
              onClick={() => setViewMode('schedule')}
              className={`px-2 sm:px-3 py-2 rounded-lg flex items-center space-x-1 sm:space-x-2 transition-colors text-xs sm:text-sm ${
                viewMode === 'schedule'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <BarChart3 size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">스케줄 뷰</span>
            </button>
          </div>

          {/* 투어 추가 버튼 - 모바일 최적화 */}
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2 text-sm"
          >
            <Plus size={16} />
            <span>{t('addTour')}</span>
          </button>
        </div>
      </div>

      {/* 달력 보기 */}
      {viewMode === 'calendar' && (
        <TourCalendar tours={filteredTours} onTourClick={handleTourClick} />
      )}

      {/* 스케줄 뷰 */}
      {viewMode === 'schedule' && (
        <ScheduleView />
      )}

      {/* 리스트 뷰 - 카드뷰 */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTours.map((tour) => (
            <div key={tour.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              {/* 카드 헤더 */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{tour.id}</h3>
                      <p className="text-xs text-gray-500 truncate">상품: {tour.product_id}</p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Link
                      href={`/${params.locale}/admin/tours/${tour.id}`}
                      className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                      title={t('viewDetails')}
                    >
                      <Eye size={14} />
                    </Link>
                    <button
                      onClick={() => setEditingTour(tour)}
                      className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                      title={tCommon('edit')}
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTour(tour.id)}
                      className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                      title={tCommon('delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 카드 본문 */}
              <div className="p-4 space-y-3">
                {/* 투어 정보 */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">날짜:</span>
                    <span className="text-gray-900">{tour.tour_date}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">시간:</span>
                    <span className="text-gray-500 text-xs">
                      {formatDateTime(tour.tour_start_datetime)} - {formatDateTime(tour.tour_end_datetime)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Car className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">차량:</span>
                    <span className="text-gray-900">{tour.tour_car_id || '미배정'}</span>
                  </div>
                </div>

                {/* 스태프 정보 */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <User className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">가이드:</span>
                    <span className="text-gray-900">{getGuideName(tour.tour_guide_id)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <User className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">어시스턴트:</span>
                    <span className="text-gray-900">{getAssistantName(tour.assistant_id)}</span>
                  </div>
                </div>

                {/* 예약 정보 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">예약 수</span>
                    <span className="text-gray-900 font-medium">{tour.reservation_ids?.length || 0}개</span>
                  </div>
                  {tour.reservation_ids && tour.reservation_ids.length > 0 && (
                    <div className="text-xs text-gray-500">
                      {tour.reservation_ids.slice(0, 2).join(', ')}
                      {tour.reservation_ids.length > 2 && ` +${tour.reservation_ids.length - 2}개 더`}
                    </div>
                  )}
                </div>

                {/* 수수료 정보 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">가이드 수수료</span>
                    <span className="text-gray-900 font-medium">₩{tour.guide_fee.toLocaleString()}</span>
                  </div>
                  {tour.assistant_fee > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">어시스턴트 수수료</span>
                      <span className="text-gray-900 font-medium">₩{tour.assistant_fee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm font-medium border-t pt-2">
                    <span className="text-gray-700">총 수수료</span>
                    <span className="text-gray-900">₩{(tour.guide_fee + tour.assistant_fee).toLocaleString()}</span>
                  </div>
                </div>

                {/* 상태 및 타입 */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
                    {getStatusLabel(tour.tour_status)}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    Boolean(tour.is_private_tour)
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {Boolean(tour.is_private_tour) ? '단독투어' : '일반투어'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 투어 추가/편집 모달 */}
      {(showAddForm || editingTour) && (
        <TourForm
          tour={editingTour}
          employees={employees}
          products={products}
          onSubmit={editingTour ? handleEditTour : handleAddTour}
          onCancel={() => {
            setShowAddForm(false)
            setEditingTour(null)
          }}
        />
      )}
    </div>
  )
}

interface TourFormProps {
  tour?: Tour | null
  employees: Employee[]
  products: Product[]
  onSubmit: (tour: Omit<Tour, 'id' | 'created_at'>) => void
  onCancel: () => void
}

function TourForm({ tour, employees, products, onSubmit, onCancel }: TourFormProps) {
  const t = useTranslations('tours')
  const tCommon = useTranslations('common')
  
  const [formData, setFormData] = useState({
    product_id: tour?.product_id || '',
    tour_date: tour?.tour_date || '',
    tour_guide_id: tour?.tour_guide_id || '',
    assistant_id: tour?.assistant_id || '',
    tour_car_id: tour?.tour_car_id || '',
    reservation_ids: tour?.reservation_ids || [],
    tour_status: tour?.tour_status || 'scheduled' as 'scheduled' | 'inProgress' | 'completed' | 'cancelled' | 'delayed',
    tour_start_datetime: tour?.tour_start_datetime || '',
    tour_end_datetime: tour?.tour_end_datetime || '',
    guide_fee: tour?.guide_fee || 0,
    assistant_fee: tour?.assistant_fee || 0
  })

  const [newReservationId, setNewReservationId] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const addReservationId = () => {
    if (newReservationId.trim() && !formData.reservation_ids.includes(newReservationId.trim())) {
      setFormData({
        ...formData,
        reservation_ids: [...formData.reservation_ids, newReservationId.trim()]
      })
      setNewReservationId('')
    }
  }

  const removeReservationId = (idToRemove: string) => {
    setFormData({
      ...formData,
      reservation_ids: formData.reservation_ids.filter((id: string) => id !== idToRemove)
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addReservationId()
    }
  }

  const guides = employees.filter(e => e.position === 'Tour Guide' && e.is_active === true)
  const assistants = employees.filter(e => e.position === 'Tour Guide' && e.is_active === true)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {tour ? t('form.editTitle') : t('form.title')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.productId')}</label>
              <select
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">상품을 선택하세요</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourDate')}</label>
              <input
                type="date"
                value={formData.tour_date}
                onChange={(e) => setFormData({ ...formData, tour_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourStartDateTime')}</label>
              <input
                type="datetime-local"
                value={formData.tour_start_datetime}
                onChange={(e) => {
                  try {
                    // datetime-local 입력값 검증
                    const dateTime = new Date(e.target.value);
                    if (isNaN(dateTime.getTime())) {
                      console.warn('Invalid datetime input:', e.target.value);
                      return;
                    }
                    setFormData({ ...formData, tour_start_datetime: e.target.value });
                  } catch (error) {
                    console.error('Error parsing datetime:', error);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourEndDateTime')}</label>
              <input
                type="datetime-local"
                value={formData.tour_end_datetime}
                onChange={(e) => {
                  try {
                    // datetime-local 입력값 검증
                    const dateTime = new Date(e.target.value);
                    if (isNaN(dateTime.getTime())) {
                      console.warn('Invalid datetime input:', e.target.value);
                      return;
                    }
                    setFormData({ ...formData, tour_end_datetime: e.target.value });
                  } catch (error) {
                    console.error('Error parsing datetime:', error);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourGuide')}</label>
              <select
                value={formData.tour_guide_id}
                onChange={(e) => setFormData({ ...formData, tour_guide_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('form.selectGuide')}</option>
                {guides.map(guide => (
                  <option key={guide.email} value={guide.email}>
                    {guide.name_ko} ({guide.languages?.join(', ') || 'ko'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.assistant')}</label>
              <select
                value={formData.assistant_id}
                onChange={(e) => setFormData({ ...formData, assistant_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('form.noAssistant')}</option>
                {assistants.map(assistant => (
                  <option key={assistant.email} value={assistant.email}>
                    {assistant.name_ko} ({assistant.languages?.join(', ') || 'ko'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourCar')}</label>
              <input
                type="text"
                value={formData.tour_car_id}
                onChange={(e) => setFormData({ ...formData, tour_car_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourStatus')}</label>
              <select
                value={formData.tour_status}
                onChange={(e) => setFormData({ ...formData, tour_status: e.target.value as 'scheduled' | 'inProgress' | 'completed' | 'cancelled' | 'delayed' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="scheduled">{t('status.scheduled')}</option>
                <option value="inProgress">{t('status.inProgress')}</option>
                <option value="completed">{t('status.completed')}</option>
                <option value="cancelled">{t('status.cancelled')}</option>
                <option value="delayed">{t('status.delayed')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.guideFee')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₩</span>
                <input
                  type="number"
                  value={formData.guide_fee}
                  onChange={(e) => setFormData({ ...formData, guide_fee: Number(e.target.value) })}
                  min="0"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.assistantFee')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₩</span>
                <input
                  type="number"
                                  value={formData.assistant_fee}
                onChange={(e) => setFormData({ ...formData, assistant_fee: Number(e.target.value) })}
                  min="0"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* 예약 ID 관리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('form.reservationIds')}</label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={newReservationId}
                onChange={(e) => setNewReservationId(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('form.addReservationIdPlaceholder')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addReservationId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('form.addReservationId')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
                             {formData.reservation_ids.map((id: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  {id}
                  <button
                    type="button"
                    onClick={() => removeReservationId(id)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {tour ? tCommon('edit') : tCommon('add')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

