import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'
import { Edit2, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TourStatusModal } from './modals/TourStatusModal'

interface TourInfoProps {
  tour: any
  product: any
  tourNote: string
  isPrivateTour: boolean
  connectionStatus: { tours: boolean }
  params: { locale: string }
  onTourNoteChange: (note: string) => void
  onPrivateTourToggle: () => void
  onTourDateChange?: (date: string) => Promise<void>
  onTourTimeChange?: (datetime: string) => Promise<void>
  onProductChange?: (productId: string) => Promise<void>
  getStatusColor: (status: string | null) => string
  getStatusText: (status: string | null, locale: string) => string
  getAssignmentStatusColor: (tour: any) => string
  getAssignmentStatusText: (tour: any, locale: string) => string
  onUpdateTourStatus?: (status: string) => Promise<void>
  onUpdateAssignmentStatus?: (status: string) => Promise<void>
  assignedReservations?: Array<{ id: string }>
}

interface Product {
  id: string
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
}

export const TourInfo: React.FC<TourInfoProps> = ({
  tour,
  product,
  tourNote,
  isPrivateTour,
  connectionStatus,
  params,
  onTourNoteChange,
  onPrivateTourToggle,
  onTourDateChange,
  onTourTimeChange,
  onProductChange,
  getStatusColor,
  getStatusText,
  getAssignmentStatusColor,
  getAssignmentStatusText,
  onUpdateTourStatus,
  onUpdateAssignmentStatus,
  assignedReservations = []
}) => {
  const t = useTranslations('tours.tourInfo')
  const tCommon = useTranslations('common')
  const productName = params.locale === 'ko' ? product?.name_ko : product?.name_en
  const dateLocale = params.locale === 'ko' ? 'ko-KR' : 'en-US'
  
  // 편집 상태 관리
  const [editingProduct, setEditingProduct] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [residentStatusSummary, setResidentStatusSummary] = useState({
    usResident: 0,
    nonResident: 0,
    nonResidentWithPass: 0,
    passCoveredCount: 0
  })

  // 거주 상태별 인원 수 합산 가져오기
  useEffect(() => {
    const fetchResidentStatusSummary = async () => {
      if (!assignedReservations || assignedReservations.length === 0) {
        setResidentStatusSummary({
          usResident: 0,
          nonResident: 0,
          nonResidentWithPass: 0,
          passCoveredCount: 0
        })
        return
      }

      try {
        const reservationIds = assignedReservations.map(r => r.id)
        const { data: reservationCustomers, error } = await supabase
          .from('reservation_customers')
          .select('resident_status, pass_covered_count')
          .in('reservation_id', reservationIds)
        
        if (!error && reservationCustomers) {
          let usResidentCount = 0
          let nonResidentCount = 0
          let nonResidentWithPassCount = 0
          let passCoveredCount = 0
          
          reservationCustomers.forEach((rc: any) => {
            if (rc.resident_status === 'us_resident') {
              usResidentCount++
            } else if (rc.resident_status === 'non_resident') {
              nonResidentCount++
            } else if (rc.resident_status === 'non_resident_with_pass') {
              nonResidentWithPassCount++
              if (rc.pass_covered_count) {
                passCoveredCount += rc.pass_covered_count
              }
            }
          })
          
          setResidentStatusSummary({
            usResident: usResidentCount,
            nonResident: nonResidentCount,
            nonResidentWithPass: nonResidentWithPassCount,
            passCoveredCount: passCoveredCount
          })
        }
      } catch (error) {
        console.error('거주 상태 합산 조회 오류:', error)
      }
    }

    fetchResidentStatusSummary()
  }, [assignedReservations])
  const [editingDate, setEditingDate] = useState(false)
  const [editingTime, setEditingTime] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState(tour.product_id || '')
  const [dateValue, setDateValue] = useState(tour.tour_date || '')
  const [timeValue, setTimeValue] = useState(() => {
    if (tour.tour_start_datetime) {
      const date = new Date(tour.tour_start_datetime)
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
    return '08:00'
  })

  // 상품 목록 로드
  useEffect(() => {
    if (editingProduct) {
      loadProducts()
    }
  }, [editingProduct])

  const loadProducts = async () => {
    try {
      setLoadingProducts(true)
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en')
        .eq('status', 'active')
        .order('name_ko', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('상품 로드 오류:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  // 상품 편집 핸들러
  const handleProductSave = async () => {
    if (onProductChange && selectedProductId && selectedProductId !== tour.product_id) {
      await onProductChange(selectedProductId)
      setEditingProduct(false)
    } else {
      setEditingProduct(false)
    }
  }

  const handleProductCancel = () => {
    setSelectedProductId(tour.product_id || '')
    setEditingProduct(false)
  }

  // 날짜 편집 핸들러
  const handleDateSave = async () => {
    if (onTourDateChange && dateValue) {
      await onTourDateChange(dateValue)
      setEditingDate(false)
    }
  }

  const handleDateCancel = () => {
    setDateValue(tour.tour_date || '')
    setEditingDate(false)
  }

  // 시간 편집 핸들러
  const handleTimeSave = async () => {
    if (onTourTimeChange && timeValue) {
      // 날짜와 시간을 결합하여 ISO 형식으로 변환
      const dateStr = tour.tour_date || new Date().toISOString().split('T')[0]
      const [hours, minutes] = timeValue.split(':')
      const datetime = new Date(`${dateStr}T${hours}:${minutes}:00`)
      await onTourTimeChange(datetime.toISOString())
      setEditingTime(false)
    }
  }

  const handleTimeCancel = () => {
    if (tour.tour_start_datetime) {
      const date = new Date(tour.tour_start_datetime)
      setTimeValue(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`)
    } else {
      setTimeValue('08:00')
    }
    setEditingTime(false)
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <h2 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
          {t('title')}
          <ConnectionStatusLabel status={connectionStatus.tours} section={t('section')} />
        </h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center gap-2">
            <span className="text-gray-600 text-sm flex-shrink-0">{t('tourName')}:</span>
            {editingProduct ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {loadingProducts ? (
                  <span className="text-sm text-gray-500">{params.locale === 'ko' ? '로딩 중...' : 'Loading...'}</span>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0 max-w-full"
                  >
                    <option value="">{params.locale === 'ko' ? '상품 선택' : 'Select Product'}</option>
                    {products.map((p) => {
                      const displayName = params.locale === 'ko' 
                        ? p.name_ko || p.name_en || p.name
                        : p.name_en || p.name_ko || p.name
                      const internalName = p.name
                      const showInternalName = internalName && internalName !== displayName
                      
                      return (
                        <option key={p.id} value={p.id}>
                          {displayName || p.id}
                          {showInternalName ? ` (${internalName})` : ''}
                        </option>
                      )
                    })}
                  </select>
                )}
                <button
                  onClick={handleProductSave}
                  disabled={!selectedProductId || selectedProductId === tour.product_id}
                  className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  title={params.locale === 'ko' ? '저장' : 'Save'}
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={handleProductCancel}
                  className="p-1 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                  title={params.locale === 'ko' ? '취소' : 'Cancel'}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-medium text-sm truncate">{productName || '-'}</span>
                {onProductChange && (
                  <button
                    onClick={() => {
                      setEditingProduct(true)
                      setSelectedProductId(tour.product_id || '')
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"
                    title={params.locale === 'ko' ? '편집' : 'Edit'}
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-gray-600 text-sm flex-shrink-0">{t('tourDate')}:</span>
            {editingDate ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleDateSave}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                  title={params.locale === 'ko' ? '저장' : 'Save'}
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={handleDateCancel}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title={params.locale === 'ko' ? '취소' : 'Cancel'}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-medium text-sm truncate">
                  {tour.tour_date || ''}
                </span>
                {onTourDateChange && (
                  <button
                    onClick={() => setEditingDate(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"
                    title={params.locale === 'ko' ? '편집' : 'Edit'}
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-gray-600 text-sm flex-shrink-0">{t('tourTime')}:</span>
            {editingTime ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleTimeSave}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                  title={params.locale === 'ko' ? '저장' : 'Save'}
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={handleTimeCancel}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title={params.locale === 'ko' ? '취소' : 'Cancel'}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-medium text-sm truncate">
                  {tour.tour_start_datetime ? new Date(tour.tour_start_datetime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) : '08:00'}
                </span>
                {onTourTimeChange && (
                  <button
                    onClick={() => setEditingTime(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"
                    title={params.locale === 'ko' ? '편집' : 'Edit'}
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-gray-600 text-sm flex-shrink-0">{t('status')}:</span>
            {onUpdateTourStatus ? (
              <button
                onClick={() => setShowStatusModal(true)}
                className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(tour.tour_status)}`}
              >
                {getStatusText(tour.tour_status, params.locale)}
              </button>
            ) : (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
                {getStatusText(tour.tour_status, params.locale)}
              </span>
            )}
          </div>
          {onUpdateAssignmentStatus && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-600 text-sm flex-shrink-0">{params.locale === 'ko' ? '배정 상태' : 'Assignment Status'}:</span>
              <button
                onClick={() => setShowStatusModal(true)}
                className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${getAssignmentStatusColor(tour)}`}
              >
                {getAssignmentStatusText(tour, params.locale)}
              </button>
            </div>
          )}
          <div className="flex justify-between items-center gap-2">
            <span className="text-gray-600 text-sm flex-shrink-0">{t('tourType')}:</span>
            <button
              onClick={onPrivateTourToggle}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isPrivateTour
                  ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
              }`}
            >
              {isPrivateTour ? t('privateTour') : t('regularTour')}
            </button>
          </div>
        </div>
        
        {/* 거주 상태별 인원 수 합산 */}
        {assignedReservations && assignedReservations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tCommon('residentStatusByCount')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-green-600"></span>
                  <span className="text-xs font-medium text-green-900">{tCommon('statusUsResident')}</span>
                </div>
                <div className="text-lg font-semibold text-green-900">
                  {residentStatusSummary.usResident}{params.locale === 'ko' ? '명' : ''}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                  <span className="text-xs font-medium text-blue-900">{tCommon('statusNonResident')}</span>
                </div>
                <div className="text-lg font-semibold text-blue-900">
                  {residentStatusSummary.nonResident}{params.locale === 'ko' ? '명' : ''}
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                  <span className="text-xs font-medium text-purple-900">{params.locale === 'ko' ? '패스 커버' : 'Pass Covered'}</span>
                </div>
                <div className="text-lg font-semibold text-purple-900">
                  {residentStatusSummary.passCoveredCount}{params.locale === 'ko' ? '명' : ''}
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                  <span className="text-xs font-medium text-purple-900">{params.locale === 'ko' ? '패스 장수' : 'Pass Count'}</span>
                </div>
                <div className="text-lg font-semibold text-purple-900">
                  {residentStatusSummary.nonResidentWithPass}{params.locale === 'ko' ? '장' : ''}
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              {tCommon('total')}: {residentStatusSummary.usResident + residentStatusSummary.nonResident + residentStatusSummary.passCoveredCount}{params.locale === 'ko' ? '명' : ` ${tCommon('people')}`}
            </div>
          </div>
        )}
        
        {/* 투어 노트 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('tourNote')}
          </label>
          <textarea
            value={tourNote}
            onChange={(e) => onTourNoteChange(e.target.value)}
            placeholder={t('tourNotePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>
      </div>

      {/* 상태 변경 모달 */}
      {onUpdateTourStatus && onUpdateAssignmentStatus && (
        <TourStatusModal
          isOpen={showStatusModal}
          tour={tour}
          currentTourStatus={tour.tour_status}
          currentAssignmentStatus={tour.assignment_status}
          locale={params.locale}
          onClose={() => setShowStatusModal(false)}
          onUpdateTourStatus={onUpdateTourStatus}
          onUpdateAssignmentStatus={onUpdateAssignmentStatus}
          getStatusColor={getStatusColor}
          getStatusText={getStatusText}
          getAssignmentStatusColor={getAssignmentStatusColor}
          getAssignmentStatusText={getAssignmentStatusText}
        />
      )}
    </div>
  )
}
