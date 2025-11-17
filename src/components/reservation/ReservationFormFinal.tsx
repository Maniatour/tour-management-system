'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { sanitizeTimeInput } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import CustomerForm from '@/components/CustomerForm'
import CustomerSection from '@/components/reservation/CustomerSection'
import TourInfoSection from '@/components/reservation/TourInfoSection'
import ParticipantsSection from '@/components/reservation/ParticipantsSection'
import ProductSelectionSection from '@/components/reservation/ProductSelectionSectionNew'
import ChannelSection from '@/components/reservation/ChannelSection'
import TourConnectionSection from '@/components/reservation/TourConnectionSection'
import ReservationOptionsSection from '@/components/reservation/ReservationOptionsSection'
import type { 
  Customer, 
  Product, 
  Channel, 
  ProductOption, 
  Option, 
  PickupHotel, 
  Reservation 
} from '@/types/reservation'

// 새로운 간결한 초이스 시스템 타입 정의
interface ChoiceOption {
  id: string
  option_key: string
  option_name: string
  option_name_ko: string
  adult_price: number
  child_price: number
  infant_price: number
  capacity: number
  is_default: boolean
  is_active: boolean
  sort_order: number
}

interface ProductChoice {
  id: string
  choice_group: string
  choice_group_ko: string
  choice_type: 'single' | 'multiple' | 'quantity'
  is_required: boolean
  min_selections: number
  max_selections: number
  sort_order: number
  options: ChoiceOption[]
}

interface ReservationChoice {
  choice_id: string
  option_id: string
  quantity: number
  total_price: number
}

type CouponRow = {
  id: string
  coupon_code: string
  discount_type: 'percentage' | 'fixed'
  percentage_value?: number | null
  fixed_value?: number | null
  status?: string | null
  channel_id?: string | null
  product_id?: string | null
  start_date?: string | null
  end_date?: string | null
}

interface ReservationFormProps {
  reservation?: Reservation | null
  customers: Customer[]
  products: Product[]
  channels: Channel[]
  productOptions: ProductOption[]
  options: Option[]
  pickupHotels: PickupHotel[]
  coupons: CouponRow[]
  onSubmit: (reservation: Omit<Reservation, 'id'>) => void
  onCancel: () => void
  onRefreshCustomers: () => Promise<void>
  onDelete: (id: string) => void
  layout?: 'modal' | 'page'
}

type RezLike = Partial<Reservation> & {
  customer_id?: string
  product_id?: string
  tour_date?: string
  tour_time?: string
  event_note?: string
  pickup_hotel?: string
  pickup_time?: string
  total_people?: number
  channel_id?: string
  channel_rn?: string
  added_by?: string
  created_at?: string
  tour_id?: string
  selected_options?: { [optionId: string]: string[] }
  selected_option_prices?: { [key: string]: number }
  is_private_tour?: boolean
}

export default function ReservationFormNew({ 
  reservation, 
  customers, 
  products, 
  channels, 
  productOptions, 
  options, 
  pickupHotels, 
  coupons, 
  onSubmit, 
  onCancel, 
  onRefreshCustomers, 
  onDelete,
  layout = 'modal'
}: ReservationFormProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const t = useTranslations('reservations')
  const customerSearchRef = useRef<HTMLDivElement | null>(null)
  const rez: RezLike = (reservation as unknown as RezLike) || ({} as RezLike)

  // 새로운 간결한 초이스 시스템 상태
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([])
  const [selectedChoices, setSelectedChoices] = useState<ReservationChoice[]>([])
  const [choicesTotal, setChoicesTotal] = useState(0)

  // 기존 상태들
  const [formData, setFormData] = useState<RezLike>({
    customer_id: rez.customer_id || '',
    product_id: rez.product_id || '',
    tour_date: rez.tour_date || '',
    tour_time: rez.tour_time || '',
    event_note: rez.event_note || '',
    pickup_hotel: rez.pickup_hotel || '',
    pickup_time: rez.pickup_time || '',
    total_people: rez.total_people || 0,
    channel_id: rez.channel_id || '',
    channel_rn: rez.channel_rn || '',
    added_by: rez.added_by || '',
    tour_id: rez.tour_id || '',
    selected_options: rez.selected_options || {},
    selected_option_prices: rez.selected_option_prices || {},
    is_private_tour: rez.is_private_tour || false
  })

  // 기존 예약 데이터가 변경될 때 formData 초기화
  useEffect(() => {
    if (reservation) {
      setFormData({
        customer_id: rez.customer_id || '',
        product_id: rez.product_id || '',
        tour_date: rez.tour_date || '',
        tour_time: rez.tour_time || '',
        event_note: rez.event_note || '',
        pickup_hotel: rez.pickup_hotel || '',
        pickup_time: rez.pickup_time || '',
        total_people: rez.total_people || 0,
        channel_id: rez.channel_id || '',
        channel_rn: rez.channel_rn || '',
        added_by: rez.added_by || '',
        tour_id: rez.tour_id || '',
        selected_options: rez.selected_options || {},
        selected_option_prices: rez.selected_option_prices || {},
        is_private_tour: rez.is_private_tour || false
      })
    }
  }, [reservation?.id]) // reservation.id만 의존성으로 사용

  // 상품 선택 시 초이스 로드
  const loadProductChoices = useCallback(async (productId: string) => {
    if (!productId) {
      setProductChoices([])
      setSelectedChoices([])
      setChoicesTotal(0)
      return
    }

    try {
      const { data, error } = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_type,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
            id,
            option_key,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order
          )
        `)
        .eq('product_id', productId)
        .order('sort_order')

      if (error) throw error

      console.log('예약 폼에서 로드된 초이스:', data)
      setProductChoices(data || [])

      // 기본값으로 설정
      const defaultChoices: ReservationChoice[] = []
      data?.forEach(choice => {
        const defaultOption = choice.options?.find(opt => opt.is_default)
        if (defaultOption) {
          defaultChoices.push({
            choice_id: choice.id,
            option_id: defaultOption.id,
            quantity: 1,
            total_price: defaultOption.adult_price
          })
        }
      })
      setSelectedChoices(defaultChoices)
      calculateChoicesTotal(defaultChoices)
    } catch (error) {
      console.error('초이스 로드 오류:', error)
    }
  }, [])

  // 초이스 선택 변경
  const handleChoiceChange = useCallback((choiceId: string, optionId: string, quantity: number = 1) => {
    setSelectedChoices(prev => {
      const existingIndex = prev.findIndex(c => c.choice_id === choiceId)
      const choice = productChoices.find(c => c.id === choiceId)
      const option = choice?.options?.find(o => o.id === optionId)
      
      if (!option) return prev

      const newChoice: ReservationChoice = {
        choice_id: choiceId,
        option_id: optionId,
        quantity,
        total_price: option.adult_price * quantity
      }

      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = newChoice
        return updated
      } else {
        return [...prev, newChoice]
      }
    })
  }, [productChoices])

  // 초이스 총액 계산
  const calculateChoicesTotal = useCallback((choices: ReservationChoice[]) => {
    const total = choices.reduce((sum, choice) => sum + choice.total_price, 0)
    setChoicesTotal(total)
  }, [])

  // 초이스 변경 시 총액 업데이트
  useEffect(() => {
    calculateChoicesTotal(selectedChoices)
  }, [selectedChoices, calculateChoicesTotal])

  // 기존 예약의 초이스 데이터 로드
  const loadReservationChoices = useCallback(async (reservationId: string) => {
    try {
      const { data, error } = await supabase
        .from('reservation_choices')
        .select(`
          choice_id,
          option_id,
          quantity,
          total_price
        `)
        .eq('reservation_id', reservationId)

      if (error) throw error

      console.log('기존 예약의 초이스:', data)
      setSelectedChoices(data || [])
      calculateChoicesTotal(data || [])
    } catch (error) {
      console.error('예약 초이스 로드 오류:', error)
    }
  }, [calculateChoicesTotal])

  // 상품 변경 시 초이스 로드
  useEffect(() => {
    if (formData.product_id) {
      loadProductChoices(formData.product_id)
    }
  }, [formData.product_id, loadProductChoices])

  // 기존 예약 데이터 로드 시 초이스 복원
  useEffect(() => {
    if (reservation?.id) {
      loadReservationChoices(reservation.id)
    }
  }, [reservation?.id, loadReservationChoices])

  // 폼 제출 처리
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // 예약 데이터 준비
      const reservationData = {
        ...formData,
        choices_total: choicesTotal,
        // 기타 필요한 필드들...
      }

      // 예약 저장
      let savedReservation
      if (reservation?.id) {
        // 업데이트
        const { data, error } = await supabase
          .from('reservations')
          .update(reservationData)
          .eq('id', reservation.id)
          .select()
          .single()

        if (error) throw error
        savedReservation = data
      } else {
        // 새로 생성
        const { data, error } = await supabase
          .from('reservations')
          .insert(reservationData)
          .select()
          .single()

        if (error) throw error
        savedReservation = data
      }

      // 초이스 저장
      if (savedReservation && selectedChoices.length > 0) {
        // 기존 초이스 삭제
        await supabase
          .from('reservation_choices')
          .delete()
          .eq('reservation_id', savedReservation.id)

        // 새로운 초이스 저장
        const choicesToInsert = selectedChoices.map(choice => ({
          reservation_id: savedReservation.id,
          choice_id: choice.choice_id,
          option_id: choice.option_id,
          quantity: choice.quantity,
          total_price: choice.total_price
        }))

        const { error: choicesError } = await supabase
          .from('reservation_choices')
          .insert(choicesToInsert)

        if (choicesError) throw choicesError
      }

      onSubmit(savedReservation)
    } catch (error) {
      console.error('예약 저장 오류:', error)
    }
  }, [formData, choicesTotal, selectedChoices, reservation?.id, onSubmit])

  // 기존 폼 필드 핸들러들 (간소화)
  const handleInputChange = useCallback((field: keyof RezLike, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  // 기존 컴포넌트들 렌더링 (간소화)
  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 고객 섹션 */}
      <CustomerSection
        formData={{
          customerSearch: '',
          customerId: formData.customer_id || '',
          showCustomerDropdown: false,
          channelRN: formData.channel_rn || ''
        }}
        setFormData={(data) => {
          if (data.customerId) handleInputChange('customer_id', data.customerId)
        }}
        customers={customers}
        customerSearchRef={customerSearchRef}
        setShowCustomerForm={setShowCustomerForm}
        t={t}
      />

      {/* 상품 선택 섹션 */}
      <ProductSelectionSection
        formData={{
          productId: formData.product_id || '',
          selectedProductCategory: '',
          selectedProductSubCategory: '',
          productSearch: '',
          selectedOptions: formData.selected_options || {},
          requiredOptions: {},
          selectedOptionPrices: formData.selected_option_prices || {},
          tourDate: formData.tour_date || '',
          channelId: formData.channel_id || '',
          productChoices,
          selectedChoices,
          choicesTotal
        }}
        setFormData={(data) => {
          if (data.productId) handleInputChange('product_id', data.productId)
          if (data.selectedChoices) setSelectedChoices(data.selectedChoices)
          if (data.choicesTotal !== undefined) setChoicesTotal(data.choicesTotal)
        }}
        products={products.map(p => ({ ...p, name_ko: p.name }))}
        loadProductChoices={loadProductChoices}
        getDynamicPricingForOption={async () => null}
        t={t}
        layout={layout}
      />

      {/* 투어 정보 섹션 */}
      <TourInfoSection
        formData={{
          tourDate: formData.tour_date || '',
          tourTime: formData.tour_time || '',
          pickUpHotelSearch: '',
          showPickupHotelDropdown: false,
          pickUpHotel: formData.pickup_hotel || '',
          pickUpTime: formData.pickup_time || ''
        }}
        setFormData={(data) => {
          if (data.tourDate) handleInputChange('tour_date', data.tourDate)
          if (data.tourTime) handleInputChange('tour_time', data.tourTime)
          if (data.pickUpHotel) handleInputChange('pickup_hotel', data.pickUpHotel)
          if (data.pickUpTime) handleInputChange('pickup_time', data.pickUpTime)
        }}
        pickupHotels={pickupHotels}
        sanitizeTimeInput={sanitizeTimeInput}
        t={t}
      />

      {/* 참가자 섹션 */}
      <ParticipantsSection
        formData={{
          adults: 0,
          child: 0,
          infant: 0,
          totalPeople: formData.total_people || 0,
          eventNote: formData.event_note || '',
          isPrivateTour: formData.is_private_tour || false,
          privateTourAdditionalCost: 0
        }}
        setFormData={(data) => {
          if (data.totalPeople) handleInputChange('total_people', data.totalPeople)
          if (data.eventNote) handleInputChange('event_note', data.eventNote)
          if (data.isPrivateTour !== undefined) handleInputChange('is_private_tour', data.isPrivateTour)
        }}
        t={t}
      />

      {/* 채널 섹션 */}
      <ChannelSection
        formData={{
          selectedChannelType: 'ota',
          channelSearch: '',
          channelId: formData.channel_id || ''
        }}
        setFormData={(data) => {
          if (data.channelId) handleInputChange('channel_id', data.channelId)
        }}
        channels={channels}
        t={t}
        layout={layout}
      />

      {/* 픽업 호텔 섹션 - 간소화 */}
      <div className="bg-white p-4 rounded-lg border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">픽업 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">픽업 호텔</label>
            <input
              type="text"
              value={formData.pickup_hotel || ''}
              onChange={(e) => handleInputChange('pickup_hotel', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="픽업 호텔을 입력하세요"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">픽업 시간</label>
            <input
              type="text"
              value={formData.pickup_time || ''}
              onChange={(e) => handleInputChange('pickup_time', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="픽업 시간을 입력하세요"
            />
          </div>
        </div>
      </div>

      {/* 옵션 섹션 - 간소화 */}
      <div className="bg-white p-4 rounded-lg border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">추가 옵션</h3>
        <p className="text-gray-600">추가 옵션 기능은 추후 구현 예정입니다.</p>
      </div>

      {/* 가격 섹션 - 간소화 */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">가격 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">초이스 총액</label>
            <div className="text-lg font-semibold text-blue-600">
              ₩{choicesTotal.toLocaleString()}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">최종 총액</label>
            <div className="text-lg font-semibold text-green-600">
              ₩{choicesTotal.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 버튼들 */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
        >
          {reservation ? '수정' : '생성'}
        </button>
      </div>

      {/* 고객 폼 모달 */}
      {showCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CustomerForm
              onClose={() => setShowCustomerForm(false)}
              onSuccess={() => {
                setShowCustomerForm(false)
                onRefreshCustomers()
              }}
            />
          </div>
        </div>
      )}
    </form>
  )

  // 모달 레이아웃인 경우 모달 래퍼 추가
  if (layout === 'modal') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg p-2 sm:p-4 w-full max-w-[95vw] sm:max-w-[80vw] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
          {formContent}
        </div>
      </div>
    )
  }

  // 페이지 레이아웃인 경우 그대로 반환
  return formContent
}
