import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'
import { Edit2, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TourStatusModal } from './modals/TourStatusModal'
import { useTourDetailSectionChrome } from './TourDetailModalChromeContext'
import { resolveAntelopeCheckInDate } from '@/lib/scheduleVehicleOilMaintenance'

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
  onAntelopeCheckInDateChange?: (date: string) => Promise<void>
  onTourTimeChange?: (datetime: string) => Promise<void>
  onProductChange?: (productId: string) => Promise<void>
  /** 투어 최대 수용 인원 수동 저장 (미지정 시 기본 정보에 필드 숨김) */
  onMaxParticipantsChange?: (value: number) => Promise<void>
  /** 모달에서는 상태·유형·수용 인원을 헤더로 이동 */
  compactForModal?: boolean
  getStatusColor?: (status: string | null) => string
  getStatusText?: (status: string | null, locale: string) => string
  getAssignmentStatusColor?: (tour: any) => string
  getAssignmentStatusText?: (tour: any, locale: string) => string
  onUpdateTourStatus?: (status: string) => Promise<void>
  onUpdateAssignmentStatus?: (status: string) => Promise<void>
}

interface Product {
  id: string
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  product_code?: string | null
  tour_departure_times?: string[] | unknown
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
  onAntelopeCheckInDateChange,
  onTourTimeChange,
  onProductChange,
  onMaxParticipantsChange,
  compactForModal = false,
  getStatusColor,
  getStatusText,
  getAssignmentStatusColor,
  getAssignmentStatusText,
  onUpdateTourStatus,
  onUpdateAssignmentStatus,
}) => {
  const chrome = useTourDetailSectionChrome()
  const t = useTranslations('tours.tourInfo')
  const tCommon = useTranslations('common')
  const productName = params.locale === 'ko' ? product?.name_ko : product?.name_en

  // 투어 시간 미입력 시 product.tour_departure_times 첫 번째 값 사용 (HH:mm 또는 HH:mm:ss → HH:mm)
  const getDefaultTimeString = (): string => {
    if (tour.tour_start_datetime) {
      const date = new Date(tour.tour_start_datetime)
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
    const times = product?.tour_departure_times
    if (Array.isArray(times) && times.length > 0 && typeof times[0] === 'string') {
      const first = times[0].trim()
      const match = first.match(/^(\d{1,2}):(\d{2})/)
      if (match) return `${match[1].padStart(2, '0')}:${match[2]}`
    }
    return '08:00'
  }
  const defaultTimeStr = getDefaultTimeString()

  // 편집 상태 관리
  const [editingProduct, setEditingProduct] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [editingAntelopeCheckIn, setEditingAntelopeCheckIn] = useState(false)
  const [editingTime, setEditingTime] = useState(false)
  const [editingMaxParticipants, setEditingMaxParticipants] = useState(false)
  const [maxParticipantsInput, setMaxParticipantsInput] = useState('12')
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState(tour.product_id || '')
  const [dateValue, setDateValue] = useState(tour.tour_date || '')
  const resolvedAntelopeCheckIn = resolveAntelopeCheckInDate(tour)
  const [antelopeCheckInValue, setAntelopeCheckInValue] = useState(resolvedAntelopeCheckIn)
  const [timeValue, setTimeValue] = useState(defaultTimeStr)

  useEffect(() => {
    if (!editingTime) setTimeValue(defaultTimeStr)
  }, [defaultTimeStr, editingTime])

  useEffect(() => {
    if (!editingDate) setDateValue(tour.tour_date || '')
  }, [tour.tour_date, editingDate])

  useEffect(() => {
    if (!editingAntelopeCheckIn) setAntelopeCheckInValue(resolvedAntelopeCheckIn)
  }, [resolvedAntelopeCheckIn, editingAntelopeCheckIn])

  const defaultMaxParticipants = 12
  const resolvedMaxParticipants =
    typeof tour?.max_participants === 'number' && Number.isFinite(tour.max_participants)
      ? tour.max_participants
      : defaultMaxParticipants

  useEffect(() => {
    if (!editingMaxParticipants) {
      setMaxParticipantsInput(String(resolvedMaxParticipants))
    }
  }, [tour?.id, tour?.max_participants, resolvedMaxParticipants, editingMaxParticipants])

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

  const handleAntelopeCheckInSave = async () => {
    if (onAntelopeCheckInDateChange && antelopeCheckInValue) {
      await onAntelopeCheckInDateChange(antelopeCheckInValue)
      setEditingAntelopeCheckIn(false)
    }
  }

  const handleAntelopeCheckInCancel = () => {
    setAntelopeCheckInValue(resolvedAntelopeCheckIn)
    setEditingAntelopeCheckIn(false)
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
    setTimeValue(defaultTimeStr)
    setEditingTime(false)
  }

  const handleMaxParticipantsSave = async () => {
    if (!onMaxParticipantsChange) return
    const parsed = parseInt(String(maxParticipantsInput).trim(), 10)
    const n = Number.isFinite(parsed)
      ? Math.max(1, Math.min(500, parsed))
      : defaultMaxParticipants
    await onMaxParticipantsChange(n)
    setEditingMaxParticipants(false)
  }

  const handleMaxParticipantsCancel = () => {
    setMaxParticipantsInput(String(resolvedMaxParticipants))
    setEditingMaxParticipants(false)
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className={chrome.shellPadding}>
        <h2 className={`${chrome.sectionTitle} ${chrome.headerMargin} flex items-center`}>
          {t('title')}
          <ConnectionStatusLabel status={connectionStatus.tours} section={t('section')} />
        </h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center gap-2">
            <span className={`${chrome.bodyCaption} flex-shrink-0`}>{t('tourName')}:</span>
            {editingProduct ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {loadingProducts ? (
                  <span className={`${chrome.bodyMuted}`}>{params.locale === 'ko' ? '로딩 중...' : 'Loading...'}</span>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className={`${chrome.bodyField} focus:outline-none focus:ring-2 focus:ring-ring flex-1 min-w-0 max-w-full`}
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
                <span className={`font-medium ${chrome.bodyText} truncate`}>{productName || '-'}</span>
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
            <span className={`${chrome.bodyCaption} flex-shrink-0`}>{t('tourDate')}:</span>
            {editingDate ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className={`${chrome.bodyField} focus:outline-none focus:ring-2 focus:ring-ring`}
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
                <span className={`font-medium ${chrome.bodyText} truncate`}>
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
            <span className={`${chrome.bodyCaption} flex-shrink-0`}>{t('antelopeCheckInDate')}:</span>
            {editingAntelopeCheckIn ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={antelopeCheckInValue}
                  onChange={(e) => setAntelopeCheckInValue(e.target.value)}
                  className={`${chrome.bodyField} focus:outline-none focus:ring-2 focus:ring-ring`}
                />
                <button
                  onClick={handleAntelopeCheckInSave}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                  title={params.locale === 'ko' ? '저장' : 'Save'}
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={handleAntelopeCheckInCancel}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title={params.locale === 'ko' ? '취소' : 'Cancel'}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`font-medium ${chrome.bodyText} truncate`}>
                  {resolvedAntelopeCheckIn || '-'}
                </span>
                {onAntelopeCheckInDateChange && (
                  <button
                    onClick={() => {
                      setAntelopeCheckInValue(resolvedAntelopeCheckIn)
                      setEditingAntelopeCheckIn(true)
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
            <span className={`${chrome.bodyCaption} flex-shrink-0`}>{t('tourTime')}:</span>
            {editingTime ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  className={`${chrome.bodyField} focus:outline-none focus:ring-2 focus:ring-ring`}
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
                <span className={`font-medium ${chrome.bodyText} truncate`}>
                  {defaultTimeStr}
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
          {!compactForModal && (
            <>
          {getStatusColor && getStatusText ? (
          <div className="flex justify-between items-center gap-2">
            <span className={`${chrome.bodyCaption} flex-shrink-0`}>{t('status')}:</span>
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
          ) : null}
          {onUpdateAssignmentStatus && getAssignmentStatusColor && getAssignmentStatusText ? (
            <div className="flex justify-between items-center gap-2">
              <span className={`${chrome.bodyCaption} flex-shrink-0`}>{params.locale === 'ko' ? '배정 상태' : 'Assignment Status'}:</span>
              <button
                onClick={() => setShowStatusModal(true)}
                className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${getAssignmentStatusColor(tour)}`}
              >
                {getAssignmentStatusText(tour, params.locale)}
              </button>
            </div>
          ) : null}
          <div className="flex justify-between items-center gap-2">
            <span className={`${chrome.bodyCaption} flex-shrink-0`}>{t('tourType')}:</span>
            <button
              onClick={onPrivateTourToggle}
              className={`${chrome.segmentButton} font-medium transition-colors duration-200 ${
                isPrivateTour
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-2 focus:ring-ring focus:ring-offset-2'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
              }`}
            >
              {isPrivateTour ? t('privateTour') : t('regularTour')}
            </button>
          </div>
          {onMaxParticipantsChange && (
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center sm:gap-2">
              <span className={`${chrome.bodyCaption} flex-shrink-0`}>{t('maxParticipants')}:</span>
              {editingMaxParticipants ? (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={maxParticipantsInput}
                    onChange={(e) => setMaxParticipantsInput(e.target.value)}
                    className={`w-20 ${chrome.bodyField} focus:outline-none focus:ring-2 focus:ring-ring`}
                  />
                  <span className={chrome.bodyMuted}>{params.locale === 'ko' ? '명' : tCommon('people')}</span>
                  <button
                    type="button"
                    onClick={handleMaxParticipantsSave}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                    title={params.locale === 'ko' ? '저장' : 'Save'}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleMaxParticipantsCancel}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title={params.locale === 'ko' ? '취소' : 'Cancel'}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className={`font-medium ${chrome.bodyText}`}>
                    {resolvedMaxParticipants}
                    {params.locale === 'ko' ? '명' : ` ${tCommon('people')}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMaxParticipantsInput(String(resolvedMaxParticipants))
                      setEditingMaxParticipants(true)
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"
                    title={params.locale === 'ko' ? '편집' : 'Edit'}
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
          {onMaxParticipantsChange && (
            <p className={`${chrome.bodyMuted} -mt-1 sm:pl-0`}>{t('maxParticipantsHint')}</p>
          )}
            </>
          )}
        </div>
        
        {/* 투어 노트 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className={`block ${chrome.bodyLabel} mb-1.5`}>
            {t('tourNote')}
          </label>
          <textarea
            value={tourNote}
            onChange={(e) => onTourNoteChange(e.target.value)}
            placeholder={t('tourNotePlaceholder')}
            className={`w-full ${chrome.bodyField} px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none`}
            rows={3}
          />
        </div>
      </div>

      {/* 상태 변경 모달 */}
      {!compactForModal &&
        onUpdateTourStatus &&
        onUpdateAssignmentStatus &&
        getStatusColor &&
        getStatusText &&
        getAssignmentStatusColor &&
        getAssignmentStatusText && (
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
