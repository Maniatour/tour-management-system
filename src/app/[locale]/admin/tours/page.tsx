'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Calendar, User, Car, DollarSign, Edit, Trash2, Clock, Grid, Eye, CalendarDays } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import TourCalendar from '@/components/TourCalendar'
import { sanitizeTimeInput } from '@/lib/utils'

type Tour = Database['public']['Tables']['tours']['Row']
type TourInsert = Database['public']['Tables']['tours']['Insert']
type TourUpdate = Database['public']['Tables']['tours']['Update']

type Employee = Database['public']['Tables']['employees']['Row']

export default function AdminTours() {
  const params = useParams()
  const t = useTranslations('tours')
  const tCommon = useTranslations('common')
  
  // 직원 데이터 (Supabase에서 가져옴)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar')

  // Supabase에서 데이터 가져오기
  useEffect(() => {
    fetchEmployees()
    fetchTours()
  }, [])

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
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

      setTours(data || [])
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
      const { data, error } = await supabase
        .from('tours')
        .insert([tour])
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
        const { error } = await supabase
          .from('tours')
          .update(tour)
          .eq('id', editingTour.id)

        if (error) {
          console.error('Error updating tour:', error)
          return
        }

        setTours(tours.map(t => t.id === editingTour.id ? { ...t, ...tour } : t))
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>{t('addTour')}</span>
        </button>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">{t('filter.allStatus')}</option>
          <option value="scheduled">{t('status.scheduled')}</option>
          <option value="inProgress">{t('status.inProgress')}</option>
          <option value="completed">{t('status.completed')}</option>
          <option value="cancelled">{t('status.cancelled')}</option>
          <option value="delayed">{t('status.delayed')}</option>
        </select>
      </div>

      {/* 뷰 모드 전환 버튼 */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Grid size={20} />
            <span>{t('view.table')}</span>
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
              viewMode === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <CalendarDays size={20} />
            <span>{t('view.calendar')}</span>
          </button>
        </div>
      </div>

      {/* 달력 보기 */}
      {viewMode === 'calendar' && (
        <TourCalendar tours={filteredTours} onTourClick={handleTourClick} />
      )}

      {/* 테이블 보기 */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-lg shadow-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.id')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.tourInfo')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.staff')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.reservations')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.fees')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tCommon('actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTours.map((tour) => (
                  <tr key={tour.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{tour.id}</div>
                      <div className="text-sm text-gray-500">상품: {tour.product_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-900">{tour.tour_date}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-500">
                            {formatDateTime(tour.tour_start_datetime)} - {formatDateTime(tour.tour_end_datetime)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <Car className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-500">차량: {tour.tour_car_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {tour.reservation_ids.length}개 예약
                      </div>
                      <div className="text-xs text-gray-500">
                        {tour.reservation_ids.join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm">
                          <DollarSign className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">가이드:</span>
                          <span className="text-gray-900">₩{tour.guide_fee.toLocaleString()}</span>
                        </div>
                        {tour.assistant_fee > 0 && (
                          <div className="flex items-center space-x-2 text-sm">
                            <DollarSign className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-600">어시스턴트:</span>
                            <span className="text-gray-900">₩{tour.assistant_fee.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          총: ₩{(tour.guide_fee + tour.assistant_fee).toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
                        {getStatusLabel(tour.tour_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link
                          href={`/${params.locale}/admin/tours/${tour.id}`}
                          className="text-blue-600 hover:text-blue-900"
                          title={t('viewDetails')}
                        >
                          <Eye size={16} />
                        </Link>
                        <button
                          onClick={() => setEditingTour(tour)}
                          className="text-blue-600 hover:text-blue-900"
                          title={tCommon('edit')}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteTour(tour.id)}
                          className="text-red-600 hover:text-red-900"
                          title={tCommon('delete')}
                        >
                          <Trash2 size={16} />
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

      {/* 투어 추가/편집 모달 */}
      {(showAddForm || editingTour) && (
        <TourForm
          tour={editingTour}
          employees={employees}
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
  onSubmit: (tour: Omit<Tour, 'id' | 'created_at'>) => void
  onCancel: () => void
}

function TourForm({ tour, employees, onSubmit, onCancel }: TourFormProps) {
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
      reservation_ids: formData.reservation_ids.filter(id => id !== idToRemove)
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addReservationId()
    }
  }

  const guides = employees.filter(e => e.type === 'guide')
  const assistants = employees.filter(e => e.type === 'assistant')

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
              <input
                type="text"
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
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
                required
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
                required
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
                required
              >
                <option value="">{t('form.selectGuide')}</option>
                {guides.map(guide => (
                  <option key={guide.email} value={guide.email}>
                    {guide.name_ko} ({guide.language})
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
                    {assistant.name_ko} ({assistant.language})
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
                required
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
                  required
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

