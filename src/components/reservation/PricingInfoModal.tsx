'use client'

import React, { useState, useEffect } from 'react'
import { X, DollarSign, Users, Calendar, MapPin, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Reservation } from '@/types/reservation'

interface PricingInfoModalProps {
  reservation: Reservation | null
  isOpen: boolean
  onClose: () => void
}

interface PricingData {
  adult_product_price: number
  child_product_price: number
  infant_product_price: number
  product_price_total: number
  required_options: Record<string, unknown>
  required_option_total: number
  subtotal: number
  coupon_code: string | null
  coupon_discount: number
  additional_discount: number
  additional_cost: number
  card_fee: number
  tax: number
  prepayment_cost: number
  prepayment_tip: number
  selected_options: Record<string, unknown>
  option_total: number
  total_price: number
  deposit_amount: number
  balance_amount: number
  is_private_tour: boolean
  private_tour_additional_cost: number
}

interface Coupon {
  id: string
  coupon_code: string
  discount_type: string
  percentage_value: number | null
  fixed_value: number | null
  status: string
  description: string | null
  start_date: string | null
  end_date: string | null
  channel_id: string | null
  product_id: string | null
}

export default function PricingInfoModal({ reservation, isOpen, onClose }: PricingInfoModalProps) {
  const [pricingData, setPricingData] = useState<PricingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState<PricingData | null>(null)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [selectedCoupon, setSelectedCoupon] = useState<string>('')

  useEffect(() => {
    if (isOpen && reservation) {
      loadPricingData()
    }
  }, [isOpen, reservation])

  // pricingData가 로드된 후 쿠폰 로드
  useEffect(() => {
    if (pricingData) {
      loadCoupons()
    }
  }, [pricingData])

  const loadPricingData = async () => {
    if (!reservation) return

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('reservation_pricing')
        .select('*')
        .eq('reservation_id', reservation.id)
        .maybeSingle()

      if (error) {
        console.error('❌ Reservation pricing error:', error)
        throw error
      }

      // 데이터가 없으면 기본값 설정
      if (!data) {
        console.log('📋 No reservation pricing data found for reservation:', reservation.id)
        const defaultData = {
          reservation_id: reservation.id,
          adult_product_price: 0,
          child_product_price: 0,
          infant_product_price: 0,
          product_price_total: 0,
          required_options: {},
          required_option_total: 0,
          subtotal: 0,
          coupon_code: null,
          coupon_discount: 0,
          additional_discount: 0,
          additional_cost: 0,
          card_fee: 0,
          tax: 0,
          prepayment_cost: 0,
          prepayment_tip: 0,
          selected_options: {},
          option_total: 0,
          total_price: 0,
          deposit_amount: 0,
          balance_amount: 0,
          private_tour_additional_cost: 0
        }
        setPricingData(defaultData)
        setEditData(defaultData)
        return
      }

      // 쿠폰 할인이 양수로 저장되어 있다면 마이너스로 변환
      if (data.coupon_discount > 0) {
        data.coupon_discount = -data.coupon_discount
      }
      
      setPricingData(data)
      setEditData(data)
    } catch (err) {
      console.error('가격 정보 로드 오류:', err)
      setError('가격 정보를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('status', 'active')
        .order('coupon_code')

      if (error) throw error
      setCoupons(data || [])
      
      // 기존 가격 데이터에 쿠폰이 있으면 해당 쿠폰을 선택
      if (pricingData?.coupon_code && data) {
        const matchingCoupon = data.find(c => c.coupon_code === pricingData.coupon_code)
        if (matchingCoupon) {
          setSelectedCoupon(matchingCoupon.id)
        }
      }
    } catch (err) {
      console.error('쿠폰 로드 오류:', err)
    }
  }

  const handleSave = async () => {
    if (!editData || !reservation) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('reservation_pricing')
        .update(editData)
        .eq('reservation_id', reservation.id)

      if (error) throw error

      setPricingData(editData)
    } catch (err) {
      console.error('가격 정보 저장 오류:', err)
      setError('가격 정보 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof PricingData, value: number) => {
    if (!editData) return
    
    const updatedData = { ...editData, [field]: value }
    
    // 자동 계산 로직
    if (field === 'adult_product_price' || field === 'child_product_price' || field === 'infant_product_price') {
      // 상품 가격 합계 계산
      const productTotal = (updatedData.adult_product_price || 0) + 
                          (updatedData.child_product_price || 0) + 
                          (updatedData.infant_product_price || 0)
      updatedData.product_price_total = productTotal
    }
    
    if (field === 'required_option_total' || field === 'option_total') {
      // 옵션 가격은 이미 개별적으로 관리됨
    }
    
    // 소계 계산 (상품 가격 + 옵션 가격)
    const subtotal = (updatedData.product_price_total || 0) + 
                    (updatedData.required_option_total || 0) + 
                    (updatedData.option_total || 0)
    updatedData.subtotal = subtotal
    
    // 할인 및 추가 비용 계산
    const discountAndCosts = (updatedData.coupon_discount || 0) + 
                            (updatedData.additional_discount || 0) + 
                            (updatedData.additional_cost || 0) + 
                            (updatedData.card_fee || 0) + 
                            (updatedData.tax || 0) + 
                            (updatedData.prepayment_cost || 0) + 
                            (updatedData.prepayment_tip || 0) + 
                            (updatedData.private_tour_additional_cost || 0)
    
    // 총 가격 계산 (소계 + 할인 및 추가 비용)
    const totalPrice = subtotal + discountAndCosts
    updatedData.total_price = totalPrice
    
    setEditData(updatedData)
  }

  const handleCouponChange = (couponId: string) => {
    setSelectedCoupon(couponId)
    
    if (!editData) return
    
    const coupon = coupons.find(c => c.id === couponId)
    if (!coupon) {
      // 쿠폰이 선택되지 않은 경우
      const updatedData = { 
        ...editData, 
        coupon_code: null, 
        coupon_discount: 0 
      }
      
      // 총 가격 재계산
      const subtotal = (updatedData.product_price_total || 0) + 
                      (updatedData.required_option_total || 0) + 
                      (updatedData.option_total || 0)
      updatedData.subtotal = subtotal
      
      const discountAndCosts = (updatedData.coupon_discount || 0) + 
                              (updatedData.additional_discount || 0) + 
                              (updatedData.additional_cost || 0) + 
                              (updatedData.card_fee || 0) + 
                              (updatedData.tax || 0) + 
                              (updatedData.prepayment_cost || 0) + 
                              (updatedData.prepayment_tip || 0) + 
                              (updatedData.private_tour_additional_cost || 0)
      
      updatedData.total_price = subtotal + discountAndCosts
      setEditData(updatedData)
      return
    }
    
    // 쿠폰 할인 계산 (마이너스 값으로 저장)
    let discountAmount = 0
    const subtotal = (editData.product_price_total || 0) + 
                    (editData.required_option_total || 0) + 
                    (editData.option_total || 0)
    
    if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
      discountAmount = -(subtotal * (coupon.percentage_value / 100)) // 마이너스로 저장
    } else if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
      discountAmount = -coupon.fixed_value // 마이너스로 저장
    }
    
    const updatedData = { 
      ...editData, 
      coupon_code: coupon.coupon_code, 
      coupon_discount: discountAmount 
    }
    
    // 총 가격 재계산
    const discountAndCosts = discountAmount + 
                            (updatedData.additional_discount || 0) + 
                            (updatedData.additional_cost || 0) + 
                            (updatedData.card_fee || 0) + 
                            (updatedData.tax || 0) + 
                            (updatedData.prepayment_cost || 0) + 
                            (updatedData.prepayment_tip || 0) + 
                            (updatedData.private_tour_additional_cost || 0)
    
    updatedData.total_price = subtotal + discountAndCosts
    setEditData(updatedData)
  }

  const handlePrivateTourChange = (isPrivate: boolean) => {
    if (!editData) return
    
    const updatedData = { 
      ...editData, 
      is_private_tour: isPrivate,
      private_tour_additional_cost: isPrivate ? (editData.private_tour_additional_cost || 0) : 0
    }
    
    // 총 가격 재계산
    const subtotal = (updatedData.product_price_total || 0) + 
                    (updatedData.required_option_total || 0) + 
                    (updatedData.option_total || 0)
    updatedData.subtotal = subtotal
    
    const discountAndCosts = (updatedData.coupon_discount || 0) + 
                            (updatedData.additional_discount || 0) + 
                            (updatedData.additional_cost || 0) + 
                            (updatedData.card_fee || 0) + 
                            (updatedData.tax || 0) + 
                            (updatedData.prepayment_cost || 0) + 
                            (updatedData.prepayment_tip || 0) + 
                            (updatedData.private_tour_additional_cost || 0)
    
    updatedData.total_price = subtotal + discountAndCosts
    setEditData(updatedData)
  }

  if (!isOpen || !reservation) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">가격 정보</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 예약 기본 정보 */}
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs text-gray-600">
            <div className="flex items-center space-x-1">
              <Users className="w-3 h-3 flex-shrink-0" />
              <span>성인 {reservation.adults}명, 아동 {reservation.child}명, 유아 {reservation.infant}명</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span>{reservation.tourDate}</span>
            </div>
            <div className="flex items-center space-x-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{reservation.pickUpHotel}</span>
            </div>
          </div>
        </div>

        {/* 가격 정보 */}
        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">가격 정보를 불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="text-center py-6">
              <div className="text-red-600 mb-2">⚠️</div>
              <p className="text-sm text-gray-600">{error}</p>
              <button
                onClick={loadPricingData}
                className="mt-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : !pricingData ? (
            <div className="text-center py-6">
              <div className="text-gray-400 mb-2">📊</div>
              <p className="text-sm text-gray-600">가격 정보가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 상품 가격 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <DollarSign className="w-4 h-4 mr-1 text-blue-600" />
                  상품 가격
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">성인</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.adult_product_price || 0}
                        onChange={(e) => handleInputChange('adult_product_price', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">아동</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.child_product_price || 0}
                        onChange={(e) => handleInputChange('child_product_price', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">유아</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.infant_product_price || 0}
                        onChange={(e) => handleInputChange('infant_product_price', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded px-2 py-1">
                    <span className="font-semibold text-gray-900">합계</span>
                    <span className="font-bold">${(editData?.product_price_total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* 옵션 가격 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">옵션 가격</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">필수 옵션</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.required_option_total || 0}
                        onChange={(e) => handleInputChange('required_option_total', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">선택 옵션</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.option_total || 0}
                        onChange={(e) => handleInputChange('option_total', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded px-2 py-1 col-span-2">
                    <span className="font-semibold text-gray-900">옵션 합계</span>
                    <span className="font-bold">${((editData?.required_option_total || 0) + (editData?.option_total || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* 소계 (상품 가격 + 옵션 가격) */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">소계</h3>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">상품 가격 + 옵션 가격</span>
                  <span className="font-bold text-blue-600">${(editData?.subtotal || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* 할인 및 추가 비용 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">할인 및 추가 비용</h3>
                
                {/* 쿠폰 선택 */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-600 mb-1">쿠폰 선택</label>
                  <select
                    value={selectedCoupon}
                    onChange={(e) => handleCouponChange(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  >
                    <option value="">쿠폰 없음</option>
                    {coupons.map((coupon) => (
                      <option key={coupon.id} value={coupon.id}>
                        {coupon.coupon_code} - {coupon.description || `${coupon.discount_type === 'percentage' ? coupon.percentage_value + '%' : '$' + coupon.fixed_value} 할인`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">쿠폰 할인</span>
                    <span className="font-semibold text-green-600">
                      {editData?.coupon_discount && editData.coupon_discount < 0 
                        ? `-$${Math.abs(editData.coupon_discount).toFixed(2)}` 
                        : editData?.coupon_discount && editData.coupon_discount > 0
                        ? `-$${editData.coupon_discount.toFixed(2)}`
                        : `$${(editData?.coupon_discount || 0).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">추가 할인</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.additional_discount || 0}
                        onChange={(e) => handleInputChange('additional_discount', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">추가 비용</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.additional_cost || 0}
                        onChange={(e) => handleInputChange('additional_cost', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">카드 수수료</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.card_fee || 0}
                        onChange={(e) => handleInputChange('card_fee', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">세금</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.tax || 0}
                        onChange={(e) => handleInputChange('tax', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">선불 비용</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.prepayment_cost || 0}
                        onChange={(e) => handleInputChange('prepayment_cost', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">선불 팁</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.prepayment_tip || 0}
                        onChange={(e) => handleInputChange('prepayment_tip', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 프라이빗 투어 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">프라이빗 투어</h3>
                
                {/* 프라이빗 투어 선택 체크박스 */}
                <div className="mb-3">
                  <label className="flex items-center space-x-2 text-xs">
                    <input
                      type="checkbox"
                      checked={editData?.is_private_tour || false}
                      onChange={(e) => handlePrivateTourChange(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-gray-700">프라이빗 투어 선택</span>
                  </label>
                </div>
                
                {editData?.is_private_tour && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">추가 비용</span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={editData?.private_tour_additional_cost || 0}
                        onChange={(e) => handleInputChange('private_tour_additional_cost', parseFloat(e.target.value) || 0)}
                        className="w-20 pl-4 pr-1 py-0.5 text-right border border-gray-300 rounded text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 할인 및 추가 비용 & 프라이빗 투어 소계 */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">할인 및 추가 비용 & 프라이빗 투어 소계</h3>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">할인/추가비용 + 프라이빗투어</span>
                  <span className="font-bold text-orange-600">
                    {(() => {
                      const couponDiscount = editData?.coupon_discount || 0;
                      const additionalDiscount = editData?.additional_discount || 0;
                      const additionalCost = editData?.additional_cost || 0;
                      const cardFee = editData?.card_fee || 0;
                      const tax = editData?.tax || 0;
                      const prepaymentCost = editData?.prepayment_cost || 0;
                      const prepaymentTip = editData?.prepayment_tip || 0;
                      const privateTourCost = editData?.private_tour_additional_cost || 0;
                      
                      const total = couponDiscount + additionalDiscount + additionalCost + cardFee + tax + prepaymentCost + prepaymentTip + privateTourCost;
                      
                      // 디버깅용 콘솔 로그
                      console.log('소계 계산 디버깅:', {
                        couponDiscount,
                        additionalDiscount,
                        additionalCost,
                        cardFee,
                        tax,
                        prepaymentCost,
                        prepaymentTip,
                        privateTourCost,
                        total
                      });
                      
                      return total < 0 ? `-$${Math.abs(total).toFixed(2)}` : `$${total.toFixed(2)}`;
                    })()}
                  </span>
                </div>
              </div>

              {/* 최종 가격 */}
              <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-3 text-center">최종 가격 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-2 border-t border-gray-300">
                    <span className="text-lg font-bold text-gray-900">총 가격</span>
                    <span className="text-xl font-bold text-blue-600">${(editData?.total_price || 0).toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-600">예약금</div>
                      <div className="relative">
                        <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input
                          type="number"
                          value={editData?.deposit_amount || 0}
                          onChange={(e) => handleInputChange('deposit_amount', parseFloat(e.target.value) || 0)}
                          className="w-full pl-4 pr-1 py-0.5 text-center border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-600">잔금</div>
                      <div className="relative">
                        <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input
                          type="number"
                          value={editData?.balance_amount || 0}
                          onChange={(e) => handleInputChange('balance_amount', parseFloat(e.target.value) || 0)}
                          className="w-full pl-4 pr-1 py-0.5 text-center border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            닫기
          </button>
          {pricingData && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? '저장중...' : '저장'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
