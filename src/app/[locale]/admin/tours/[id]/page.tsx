'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Trash2, Calendar, User, Car, DollarSign, Users, Clock, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Tour {
  id: string
  productId: string
  tourDate: string
  tourGuideId: string
  assistantId: string
  tourCarId: string
  reservationIds: string[]
  tourStatus: 'scheduled' | 'inProgress' | 'completed' | 'cancelled' | 'delayed'
  tourStartDateTime: string
  tourEndDateTime: string
  guideFee: number
  assistantFee: number
  created_at: string
}

export default function TourDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('tours')
  const tCommon = useTranslations('common')
  
  const [tour, setTour] = useState<Tour | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingTour, setEditingTour] = useState<Tour | null>(null)

  // 샘플 투어 데이터 (실제로는 API에서 가져와야 함)
  const sampleTours: Tour[] = [
    {
      id: '1',
      productId: 'PROD-001',
      tourDate: '2024-01-20',
      tourGuideId: 'guide1@company.com',
      assistantId: 'assistant1@company.com',
      tourCarId: 'CAR-001',
      reservationIds: ['RES-001', 'RES-002'],
      tourStatus: 'scheduled',
      tourStartDateTime: '2024-01-20T09:00:00',
      tourEndDateTime: '2024-01-20T17:00:00',
      guideFee: 150.00,
      assistantFee: 100.00,
      created_at: '2024-01-15'
    },
    {
      id: '2',
      productId: 'PROD-002',
      tourDate: '2024-01-21',
      tourGuideId: 'guide2@company.com',
      assistantId: 'assistant2@company.com',
      tourCarId: 'CAR-002',
      reservationIds: ['RES-003'],
      tourStatus: 'inProgress',
      tourStartDateTime: '2024-01-21T10:00:00',
      tourEndDateTime: '2024-01-21T18:00:00',
      guideFee: 180.00,
      assistantFee: 120.00,
      created_at: '2024-01-16'
    }
  ]

  useEffect(() => {
    const tourId = params.id as string
    const foundTour = sampleTours.find(t => t.id === tourId)
    if (foundTour) {
      setTour(foundTour)
    }
  }, [params.id])

  const handleEditTour = (tourData: Omit<Tour, 'id' | 'created_at'>) => {
    if (tour) {
      const updatedTour: Tour = {
        ...tourData,
        id: tour.id,
        created_at: tour.created_at
      }
      setTour(updatedTour)
      setShowEditForm(false)
      setEditingTour(null)
    }
  }

  const handleDeleteTour = () => {
    if (confirm(t('deleteConfirm'))) {
      router.push(`/${params.locale}/admin/tours`)
    }
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

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!tour) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">투어를 찾을 수 없습니다.</div>
      </div>
    )
  }

  if (showEditForm) {
    return (
      <TourForm
        tour={editingTour || tour}
        onSubmit={handleEditTour}
        onCancel={() => {
          setShowEditForm(false)
          setEditingTour(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push(`/${params.locale}/admin/tours`)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{t('detail.title')}</h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowEditForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Edit size={16} />
            <span>{t('detail.editTour')}</span>
          </button>
          <button
            onClick={handleDeleteTour}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2"
          >
            <Trash2 size={16} />
            <span>{t('detail.deleteTour')}</span>
          </button>
        </div>
      </div>

      {/* 투어 정보 카드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 기본 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="h-5 w-5 text-blue-600 mr-2" />
            {t('detail.tourInfo')}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">투어 ID:</span>
              <span className="font-medium">{tour.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">상품 ID:</span>
              <span className="font-medium">{tour.productId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">상태:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tour.tourStatus)}`}>
                {t(`status.${tour.tourStatus}`)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">등록일:</span>
              <span className="font-medium">{tour.created_at}</span>
            </div>
          </div>
        </div>

        {/* 참가자 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 text-green-600 mr-2" />
            {t('detail.participants')}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">가이드:</span>
              <span className="font-medium">{tour.tourGuideId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">어시스턴트:</span>
              <span className="font-medium">{tour.assistantId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">예약 ID:</span>
              <span className="font-medium text-sm">{tour.reservationIds.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* 일정 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="h-5 w-5 text-purple-600 mr-2" />
            {t('detail.schedule')}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">투어 날짜:</span>
              <span className="font-medium">{tour.tourDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">시작 시간:</span>
              <span className="font-medium">{formatDateTime(tour.tourStartDateTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">종료 시간:</span>
              <span className="font-medium">{formatDateTime(tour.tourEndDateTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">차량 ID:</span>
              <span className="font-medium">{tour.tourCarId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 재무 정보 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="h-5 w-5 text-yellow-600 mr-2" />
          {t('detail.financial')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-blue-800 font-medium">가이드 수수료</span>
              <span className="text-2xl font-bold text-blue-900">${tour.guideFee.toLocaleString()}</span>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-green-800 font-medium">어시스턴트 수수료</span>
              <span className="text-2xl font-bold text-green-900">${tour.assistantFee.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TourFormProps {
  tour: Tour
  onSubmit: (tour: Omit<Tour, 'id' | 'created_at'>) => void
  onCancel: () => void
}

function TourForm({ tour, onSubmit, onCancel }: TourFormProps) {
  const t = useTranslations('tours')
  const tCommon = useTranslations('common')
  
  const [formData, setFormData] = useState({
    productId: tour.productId,
    tourDate: tour.tourDate,
    tourGuideId: tour.tourGuideId,
    assistantId: tour.assistantId,
    tourCarId: tour.tourCarId,
    reservationIds: tour.reservationIds.join(', '),
    tourStatus: tour.tourStatus,
    tourStartDateTime: tour.tourStartDateTime.slice(0, 16),
    tourEndDateTime: tour.tourEndDateTime.slice(0, 16),
    guideFee: tour.guideFee,
    assistantFee: tour.assistantFee
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const tourData = {
      ...formData,
      reservationIds: formData.reservationIds.split(',').map(id => id.trim()).filter(id => id)
    }
    onSubmit(tourData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {t('form.editTitle')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.productId')}</label>
              <input
                type="text"
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourDate')}</label>
              <input
                type="date"
                value={formData.tourDate}
                onChange={(e) => setFormData({ ...formData, tourDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourGuideId')}</label>
              <input
                type="email"
                value={formData.tourGuideId}
                onChange={(e) => setFormData({ ...formData, tourGuideId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.assistantId')}</label>
              <input
                type="email"
                value={formData.assistantId}
                onChange={(e) => setFormData({ ...formData, assistantId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourCarId')}</label>
              <input
                type="text"
                value={formData.tourCarId}
                onChange={(e) => setFormData({ ...formData, tourCarId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.reservationIds')}</label>
              <input
                type="text"
                value={formData.reservationIds}
                onChange={(e) => setFormData({ ...formData, reservationIds: e.target.value })}
                placeholder="예약 ID를 쉼표로 구분하여 입력"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourStatus')}</label>
              <select
                value={formData.tourStatus}
                onChange={(e) => setFormData({ ...formData, tourStatus: e.target.value as Tour['tourStatus'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="scheduled">{t('status.scheduled')}</option>
                <option value="inProgress">{t('status.inProgress')}</option>
                <option value="completed">{t('status.completed')}</option>
                <option value="cancelled">{t('status.cancelled')}</option>
                <option value="delayed">{t('status.delayed')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourStartDateTime')}</label>
              <input
                type="datetime-local"
                value={formData.tourStartDateTime}
                onChange={(e) => setFormData({ ...formData, tourStartDateTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourEndDateTime')}</label>
              <input
                type="datetime-local"
                value={formData.tourEndDateTime}
                onChange={(e) => setFormData({ ...formData, tourEndDateTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.guideFee')}</label>
              <input
                type="number"
                step="0.01"
                value={formData.guideFee}
                onChange={(e) => setFormData({ ...formData, guideFee: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.assistantFee')}</label>
              <input
                type="number"
                step="0.01"
                value={formData.assistantFee}
                onChange={(e) => setFormData({ ...formData, assistantFee: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {tCommon('save')}
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
