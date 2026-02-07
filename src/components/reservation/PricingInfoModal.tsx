'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
  choices?: Record<string, unknown>
  choices_total?: number
  not_included_price?: number
  commission_amount?: number
  commission_percent?: number
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
  const [channelPricingType, setChannelPricingType] = useState<'separate' | 'single'>('separate')

  useEffect(() => {
    if (isOpen && reservation) {
      loadPricingData()
    }
  }, [isOpen, reservation])

  // pricingData가 로드된 후 쿠폰 로드 (채널 변경 시에도 다시 로드)
  useEffect(() => {
    if (pricingData && reservation) {
      loadCoupons()
    }
  }, [pricingData, reservation?.channelId])

  const loadPricingData = async () => {
    if (!reservation) return

    setLoading(true)
    setError(null)

    try {
      // 채널 정보 가져오기
      if (reservation.channelId) {
        const { data: channelData } = await supabase
          .from('channels')
          .select('pricing_type, has_not_included_price, not_included_type, not_included_price')
          .eq('id', reservation.channelId)
          .single()
        
        if (channelData?.pricing_type) {
          setChannelPricingType(channelData.pricing_type as 'separate' | 'single')
        }
      }
      const { data, error } = await supabase
        .from('reservation_pricing')
        .select('*')
        .eq('reservation_id', reservation.id)
        .maybeSingle()

      if (error) {
        console.error('❌ Reservation pricing error:', error)
        throw error
      }

      // 데이터가 없으면 reservation 객체의 pricingInfo를 사용하거나 상품 정보로 기본 가격 계산
      if (!data) {
        console.log('📋 No reservation pricing data found for reservation:', reservation.id)
        
        // reservation 객체의 pricingInfo가 있으면 사용
        const pricingInfo = reservation.pricingInfo
        
        // pricingInfo도 없으면 상품 정보를 가져와서 기본 가격 계산
        let adultPrice = pricingInfo?.adultProductPrice || 0
        let childPrice = pricingInfo?.childProductPrice || 0
        let infantPrice = pricingInfo?.infantProductPrice || 0
        
        if (!adultPrice && !childPrice && !infantPrice && reservation.productId) {
          try {
            const { data: productData } = await supabase
              .from('products')
              .select('base_price')
              .eq('id', reservation.productId)
              .single()
            
            if (productData?.base_price) {
              const basePrice = productData.base_price
              adultPrice = basePrice
              childPrice = basePrice * 0.7 // 아동은 성인의 70%
              infantPrice = basePrice * 0.3 // 유아는 성인의 30%
            }
          } catch (err) {
            console.error('상품 정보 조회 오류:', err)
          }
        }
        
        // 총 상품 가격 계산
        const productPriceTotal = (adultPrice * (reservation.adults || 0)) + 
                                 (childPrice * (reservation.child || 0)) + 
                                 (infantPrice * (reservation.infant || 0))
        
        // 총 가격이 없으면 계산된 상품 가격 사용
        const totalPrice = pricingInfo?.totalPrice || reservation.totalPrice || productPriceTotal
        
        const defaultData: PricingData = {
          reservation_id: reservation.id,
          adult_product_price: adultPrice,
          child_product_price: childPrice,
          infant_product_price: infantPrice,
          product_price_total: productPriceTotal,
          required_options: pricingInfo?.requiredOptions || {},
          required_option_total: pricingInfo?.requiredOptionTotal || 0,
          subtotal: pricingInfo?.subtotal || productPriceTotal,
          coupon_code: pricingInfo?.couponCode || null,
          coupon_discount: pricingInfo?.couponDiscount || 0,
          additional_discount: pricingInfo?.additionalDiscount || 0,
          additional_cost: pricingInfo?.additionalCost || 0,
          card_fee: pricingInfo?.cardFee || 0,
          tax: pricingInfo?.tax || 0,
          prepayment_cost: pricingInfo?.prepaymentCost || 0,
          prepayment_tip: pricingInfo?.prepaymentTip || 0,
          selected_options: pricingInfo?.selectedOptionalOptions || {},
          option_total: pricingInfo?.optionTotal || 0,
          total_price: totalPrice,
          deposit_amount: pricingInfo?.depositAmount || 0,
          balance_amount: pricingInfo?.balanceAmount || reservation.balanceAmount || totalPrice,
          is_private_tour: reservation.isPrivateTour || false,
          private_tour_additional_cost: pricingInfo?.privateTourAdditionalCost || 0,
          choices: pricingInfo?.choices || {},
          choices_total: pricingInfo?.choicesTotal || 0,
          not_included_price: pricingInfo?.not_included_price || 0,
          commission_amount: 0,
          commission_percent: pricingInfo?.commission_percent || 0
        }
        setPricingData(defaultData)
        setEditData(defaultData)
        return
      }

      // 쿠폰 할인이 양수로 저장되어 있다면 마이너스로 변환
      if (data.coupon_discount > 0) {
        data.coupon_discount = -data.coupon_discount
      }
      
      // choices_total과 not_included_price가 없으면 0으로 설정
      const pricingDataWithDefaults: PricingData = {
        ...data,
        choices_total: data.choices_total ?? 0,
        not_included_price: data.not_included_price ?? 0,
        commission_amount: data.commission_amount ?? 0,
        commission_percent: data.commission_percent ?? 0
      }
      
      setPricingData(pricingDataWithDefaults)
      setEditData(pricingDataWithDefaults)
    } catch (err) {
      console.error('가격 정보 로드 오류:', err)
      setError('가격 정보를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadCoupons = async () => {
    try {
      if (!reservation?.channelId) {
        // 채널이 선택되지 않은 경우 빈 배열 설정
        setCoupons([])
        return
      }

      // 채널별 쿠폰 필터링: 해당 채널의 쿠폰 또는 채널이 지정되지 않은 쿠폰
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('status', 'active')
        .or(`channel_id.eq.${reservation.channelId},channel_id.is.null`)
        .order('coupon_code')

      if (error) throw error
      setCoupons(data || [])
      
      // 기존 가격 데이터에 쿠폰이 있으면 해당 쿠폰을 선택
      // reservation_pricing.coupon_code는 coupons.coupon_code와 조인됨 (대소문자 구분 없이)
      if (pricingData?.coupon_code && data) {
        const matchingCoupon = data.find(c => 
          c.coupon_code && 
          c.coupon_code.trim().toLowerCase() === pricingData.coupon_code.trim().toLowerCase()
        )
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
    
    // 기존 데이터를 완전히 보존하면서 필드만 업데이트
    const updatedData: PricingData = { 
      ...editData, 
      [field]: value
    }
    
    // 자동 계산 로직: 상품 단가 변경 시 상품 가격 합계 = 단가 × 인원
    if (field === 'adult_product_price' || field === 'child_product_price' || field === 'infant_product_price') {
      const adults = reservation?.adults || 0
      const child = reservation?.child || 0
      const infant = reservation?.infant || 0
      const productTotal =
        (updatedData.adult_product_price || 0) * adults +
        (updatedData.child_product_price || 0) * child +
        (updatedData.infant_product_price || 0) * infant
      updatedData.product_price_total = productTotal
    }
    
    // 소계 계산 (상품 가격 + 옵션 가격)
    const subtotal = (updatedData.product_price_total || 0) + 
                    (updatedData.required_option_total || 0) + 
                    (updatedData.option_total || 0)
    updatedData.subtotal = subtotal
    
    // 할인 계산 (할인은 빼야 함)
    const totalDiscount = Math.abs(updatedData.coupon_discount || 0) + 
                         (updatedData.additional_discount || 0)
    
    // 추가 비용 계산 (추가 비용은 더해야 함) - additional_cost 포함 확인
    const additionalCost = updatedData.additional_cost || 0
    const cardFee = updatedData.card_fee || 0
    const tax = updatedData.tax || 0
    const prepaymentCost = updatedData.prepayment_cost || 0
    const prepaymentTip = updatedData.prepayment_tip || 0
    const privateTourCost = updatedData.private_tour_additional_cost || 0
    
    const totalAdditional = additionalCost + cardFee + tax + prepaymentCost + prepaymentTip + privateTourCost
    
    // 총 가격 계산 (소계 - 할인 + 추가 비용) - additional_cost가 포함되어야 함
    const totalPrice = Math.max(0, subtotal - totalDiscount + totalAdditional)
    updatedData.total_price = totalPrice
    
    // 디버깅: 필드 변경 시 로그 출력
    if (field === 'additional_cost' || field === 'additional_discount' || field === 'card_fee' || field === 'tax' || field === 'prepayment_cost') {
      console.log(`${field} 변경:`, {
        field,
        value,
        updatedData: {
          additional_cost: updatedData.additional_cost,
          additional_discount: updatedData.additional_discount,
          card_fee: updatedData.card_fee,
          tax: updatedData.tax,
          prepayment_cost: updatedData.prepayment_cost
        }
      })
    }
    
    setEditData(updatedData)
  }

  const handleCouponChange = (couponId: string) => {
    setSelectedCoupon(couponId)
    
    if (!editData) return
    
    // couponId는 여전히 coupons.id이지만, 저장할 때는 coupon_code를 사용
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
      
      const totalDiscount = Math.abs(updatedData.coupon_discount || 0) + 
                           (updatedData.additional_discount || 0)
      const totalAdditional = (updatedData.additional_cost || 0) + 
                             (updatedData.card_fee || 0) + 
                             (updatedData.tax || 0) + 
                             (updatedData.prepayment_cost || 0) + 
                             (updatedData.prepayment_tip || 0) + 
                             (updatedData.private_tour_additional_cost || 0)
      
      updatedData.total_price = Math.max(0, subtotal - totalDiscount + totalAdditional)
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
      coupon_code: coupon.coupon_code, // coupons.coupon_code를 저장 (대소문자 구분 없이 사용)
      coupon_discount: discountAmount 
    }
    
    // 총 가격 재계산
    const totalDiscount = Math.abs(discountAmount) + 
                         (updatedData.additional_discount || 0)
    const totalAdditional = (updatedData.additional_cost || 0) + 
                           (updatedData.card_fee || 0) + 
                           (updatedData.tax || 0) + 
                           (updatedData.prepayment_cost || 0) + 
                           (updatedData.prepayment_tip || 0) + 
                           (updatedData.private_tour_additional_cost || 0)
    
    updatedData.total_price = Math.max(0, subtotal - totalDiscount + totalAdditional)
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
    
    const totalDiscount = Math.abs(updatedData.coupon_discount || 0) + 
                         (updatedData.additional_discount || 0)
    const totalAdditional = (updatedData.additional_cost || 0) + 
                           (updatedData.card_fee || 0) + 
                           (updatedData.tax || 0) + 
                           (updatedData.prepayment_cost || 0) + 
                           (updatedData.prepayment_tip || 0) + 
                           (updatedData.private_tour_additional_cost || 0)
    
    updatedData.total_price = Math.max(0, subtotal - totalDiscount + totalAdditional)
    setEditData(updatedData)
  }

  if (!isOpen || !reservation) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-2 sm:p-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 왼쪽: 상품가격 + 할인/추가비용 (세로 배치) */}
              <div className="space-y-3">
                {/* 1. 상품가격 */}
                <div className="bg-white p-3 rounded border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">상품가격</h4>
                  <div className="space-y-2">
                    {channelPricingType === 'single' ? (
                      <>
                        <div className="text-xs text-gray-600 mb-1">단일 가격</div>
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-xs">$</span>
                          <input
                            type="number"
                            value={editData?.adult_product_price ?? ''}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0
                              handleInputChange('adult_product_price', v)
                              handleInputChange('child_product_price', v)
                              handleInputChange('infant_product_price', v)
                            }}
                            className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded"
                            step="0.01"
                            placeholder="0"
                          />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">x{((reservation?.adults || 0) + (reservation?.child || 0) + (reservation?.infant || 0))}명</span>
                          <span className="font-medium">= ${(editData?.product_price_total || 0).toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">성인 $</span>
                          <input
                            type="number"
                            value={editData?.adult_product_price ?? ''}
                            onChange={(e) => handleInputChange('adult_product_price', Number(e.target.value) || 0)}
                            className="w-14 px-1 py-0.5 text-xs border border-gray-300 rounded text-right"
                            step="0.01"
                          />
                          <span className="text-gray-500">x{reservation?.adults || 0}</span>
                          <span className="font-medium">${((editData?.adult_product_price || 0) * (reservation?.adults || 0)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">아동 $</span>
                          <input
                            type="number"
                            value={editData?.child_product_price ?? ''}
                            onChange={(e) => handleInputChange('child_product_price', Number(e.target.value) || 0)}
                            className="w-14 px-1 py-0.5 text-xs border border-gray-300 rounded text-right"
                            step="0.01"
                          />
                          <span className="text-gray-500">x{reservation?.child || 0}</span>
                          <span className="font-medium">${((editData?.child_product_price || 0) * (reservation?.child || 0)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">유아 $</span>
                          <input
                            type="number"
                            value={editData?.infant_product_price ?? ''}
                            onChange={(e) => handleInputChange('infant_product_price', Number(e.target.value) || 0)}
                            className="w-14 px-1 py-0.5 text-xs border border-gray-300 rounded text-right"
                            step="0.01"
                          />
                          <span className="text-gray-500">x{reservation?.infant || 0}</span>
                          <span className="font-medium">${((editData?.infant_product_price || 0) * (reservation?.infant || 0)).toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="border-t pt-1 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900">상품 가격 합계</span>
                      <span className="text-sm font-bold text-blue-600">${(editData?.product_price_total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. 할인/추가비용 (상품가격 아래) */}
                <div className="bg-white p-3 rounded border border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-2">할인/추가비용</h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">쿠폰</label>
                    <select
                      value={selectedCoupon}
                      onChange={(e) => handleCouponChange(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">쿠폰 선택</option>
                      {coupons.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.coupon_code} ({c.discount_type === 'percentage' ? (c.percentage_value ?? 0) + '%' : '$' + (c.fixed_value ?? 0)})
                        </option>
                      ))}
                    </select>
                    {editData?.coupon_code && (
                      <div className="mt-1 text-xs text-blue-600">
                        할인: ${Math.abs(editData?.coupon_discount || 0).toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">추가할인</label>
                      <div className="relative">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input
                          type="number"
                          value={editData?.additional_discount ?? ''}
                          onChange={(e) => handleInputChange('additional_discount', Number(e.target.value) || 0)}
                          className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">추가비용</label>
                      <div className="relative">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input
                          type="number"
                          value={editData?.additional_cost ?? ''}
                          onChange={(e) => handleInputChange('additional_cost', Number(e.target.value) || 0)}
                          className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">세금</label>
                      <div className="relative">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input
                          type="number"
                          value={editData?.tax ?? ''}
                          onChange={(e) => handleInputChange('tax', Number(e.target.value) || 0)}
                          className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">카드수수료</label>
                      <div className="relative">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input
                          type="number"
                          value={editData?.card_fee ?? ''}
                          onChange={(e) => handleInputChange('card_fee', Number(e.target.value) || 0)}
                          className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 border-t pt-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">선결제 지출</label>
                      <div className="relative">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input
                          type="number"
                          value={editData?.prepayment_cost ?? ''}
                          onChange={(e) => handleInputChange('prepayment_cost', Number(e.target.value) || 0)}
                          className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">선결제 팁</label>
                      <div className="relative">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input
                          type="number"
                          value={editData?.prepayment_tip ?? ''}
                          onChange={(e) => handleInputChange('prepayment_tip', Number(e.target.value) || 0)}
                          className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={editData?.is_private_tour || false}
                        onChange={(e) => handlePrivateTourChange(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      />
                      프라이빗 투어
                    </label>
                    {editData?.is_private_tour && (
                      <div className="relative mt-1">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <input
                          type="number"
                          value={editData?.private_tour_additional_cost ?? ''}
                          onChange={(e) => handleInputChange('private_tour_additional_cost', Number(e.target.value) || 0)}
                          className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded"
                          step="0.01"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>

              {/* 3. 가격계산 (1~4번 블록) */}
              <div className="bg-white p-3 rounded border border-gray-200 overflow-y-auto max-h-[70vh]">
                <h4 className="text-xs font-semibold text-gray-900 mb-2">가격 계산</h4>
                <div className="space-y-3 text-xs">
                  {/* 1️⃣ 고객 기준 결제 흐름 */}
                  <div className="pb-2 border-b border-gray-200">
                    <div className="flex items-center mb-1.5">
                      <span className="text-base mr-1">1️⃣</span>
                      <span className="font-semibold text-gray-800">고객 기준 결제 흐름</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-700">OTA 판매가</span>
                        <span className="font-medium">${(editData?.product_price_total || 0).toFixed(2)}</span>
                      </div>
                      {(editData?.coupon_discount || 0) !== 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>- 쿠폰 할인</span>
                          <span>-${Math.abs(editData?.coupon_discount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-100 my-1" />
                      <div className="flex justify-between">
                        <span className="text-gray-700">할인 후 상품가</span>
                        <span className="font-medium">
                          ${((editData?.product_price_total || 0) - Math.abs(editData?.coupon_discount || 0) - (editData?.additional_discount || 0)).toFixed(2)}
                        </span>
                      </div>
                      {(editData?.additional_discount || 0) > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>- 추가 할인</span>
                          <span>-${(editData?.additional_discount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {(editData?.additional_cost || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">+ 추가 비용</span>
                          <span>+${(editData?.additional_cost || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {(editData?.tax || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">+ 세금</span>
                          <span>+${(editData?.tax || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {(editData?.card_fee || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">+ 카드 수수료</span>
                          <span>+${(editData?.card_fee || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {(editData?.prepayment_cost || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">+ 선결제 지출</span>
                          <span>+${(editData?.prepayment_cost || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {(editData?.prepayment_tip || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">+ 선결제 팁</span>
                          <span>+${(editData?.prepayment_tip || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {(editData?.is_private_tour && (editData?.private_tour_additional_cost || 0) > 0) && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">+ 단독투어 추가비</span>
                          <span>+${(editData?.private_tour_additional_cost || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-100 my-1" />
                      <div className="flex justify-between">
                        <span className="font-bold text-blue-800">고객 총 결제 금액</span>
                        <span className="font-bold text-blue-600">${(editData?.total_price || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 2️⃣ 고객 실제 지불 내역 */}
                  <div className="pb-2 border-b border-gray-200">
                    <div className="flex items-center mb-1.5">
                      <span className="text-base mr-1">2️⃣</span>
                      <span className="font-semibold text-gray-800">고객 실제 지불 내역</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">고객 실제 지불액 (보증금)</span>
                        <div className="relative">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">$</span>
                          <input
                            type="number"
                            value={editData?.deposit_amount ?? ''}
                            onChange={(e) => handleInputChange('deposit_amount', Number(e.target.value) || 0)}
                            className="w-20 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded text-right"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">잔액 (투어 당일 지불)</span>
                        <div className="relative">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">$</span>
                          <input
                            type="number"
                            value={editData?.balance_amount ?? ''}
                            onChange={(e) => handleInputChange('balance_amount', Number(e.target.value) || 0)}
                            className="w-20 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded text-right"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="border-t border-gray-100 my-1" />
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-900">총 결제 예정 금액</span>
                        <span className="font-bold text-blue-600">
                          ${((editData?.deposit_amount || 0) + (editData?.balance_amount || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3️⃣ 채널 정산 기준 */}
                  <div className="pb-2 border-b border-gray-200">
                    <div className="flex items-center mb-1.5">
                      <span className="text-base mr-1">3️⃣</span>
                      <span className="font-semibold text-gray-800">채널 정산 기준</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">채널 결제 금액</span>
                        <span className="font-medium">${(editData?.deposit_amount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">채널 수수료 %</span>
                        <div className="relative">
                          <input
                            type="number"
                            value={editData?.commission_percent ?? ''}
                            onChange={(e) => handleInputChange('commission_percent', Number(e.target.value) || 0)}
                            className="w-14 pl-1 pr-6 py-0.5 text-xs border border-gray-300 rounded text-right"
                            step="0.01"
                            min="0"
                            max="100"
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">채널 수수료 $</span>
                        <div className="relative">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">$</span>
                          <input
                            type="number"
                            value={editData?.commission_amount ?? ''}
                            onChange={(e) => handleInputChange('commission_amount', Number(e.target.value) || 0)}
                            className="w-20 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded text-right"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="border-t border-gray-100 my-1" />
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-700">채널 정산 금액</span>
                        <span className="font-bold text-blue-600">
                          ${Math.max(0, (editData?.deposit_amount || 0) - (editData?.commission_amount || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4️⃣ 최종 매출 & 운영 이익 */}
                  <div className="pb-1">
                    <div className="flex items-center mb-1.5">
                      <span className="text-base mr-1">4️⃣</span>
                      <span className="font-semibold text-gray-800">최종 매출 & 운영 이익</span>
                    </div>
                    {(() => {
                      const channelSettlement = Math.max(0, (editData?.deposit_amount || 0) - (editData?.commission_amount || 0))
                      const choicesTotal = editData?.choices_total ?? 0
                      const people = (reservation?.adults || 0) + (reservation?.child || 0) + (reservation?.infant || 0)
                      const notIncludedTotal = (editData?.not_included_price || 0) * people
                      let totalRevenue = channelSettlement
                      if (choicesTotal > 0) totalRevenue += choicesTotal
                      if (notIncludedTotal > 0) totalRevenue += notIncludedTotal
                      if ((editData?.additional_discount || 0) > 0) totalRevenue -= editData.additional_discount
                      if ((editData?.additional_cost || 0) > 0) totalRevenue += editData.additional_cost
                      if ((editData?.tax || 0) > 0) totalRevenue += editData.tax
                      if ((editData?.card_fee || 0) > 0) totalRevenue += editData.card_fee
                      if ((editData?.prepayment_cost || 0) > 0) totalRevenue += editData.prepayment_cost
                      const operatingProfit = totalRevenue - (editData?.prepayment_tip || 0)
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-700">채널 정산금액</span>
                            <span className="font-medium">${channelSettlement.toFixed(2)}</span>
                          </div>
                          {choicesTotal > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">+ 초이스 총액</span>
                              <span>+${choicesTotal.toFixed(2)}</span>
                            </div>
                          )}
                          {notIncludedTotal > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">+ 불포함 가격</span>
                              <span>+${notIncludedTotal.toFixed(2)}</span>
                            </div>
                          )}
                          {(editData?.additional_discount || 0) > 0 && (
                            <div className="flex justify-between text-red-600">
                              <span className="text-gray-600">- 추가할인</span>
                              <span>-${(editData?.additional_discount || 0).toFixed(2)}</span>
                            </div>
                          )}
                          {(editData?.additional_cost || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">+ 추가비용</span>
                              <span>+${(editData?.additional_cost || 0).toFixed(2)}</span>
                            </div>
                          )}
                          {(editData?.tax || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">+ 세금</span>
                              <span>+${(editData?.tax || 0).toFixed(2)}</span>
                            </div>
                          )}
                          {(editData?.card_fee || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">+ 결제 수수료</span>
                              <span>+${(editData?.card_fee || 0).toFixed(2)}</span>
                            </div>
                          )}
                          {(editData?.prepayment_cost || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">+ 선결제 지출</span>
                              <span>+${(editData?.prepayment_cost || 0).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="border-t border-gray-100 my-1" />
                          <div className="flex justify-between">
                            <span className="font-bold text-green-800">총 매출</span>
                            <span className="font-bold text-green-600">${totalRevenue.toFixed(2)}</span>
                          </div>
                          {(editData?.prepayment_tip || 0) > 0 && (
                            <>
                              <div className="flex justify-between text-red-600">
                                <span className="text-gray-600">- 선결제 팁 (수익 아님)</span>
                                <span>-${(editData?.prepayment_tip || 0).toFixed(2)}</span>
                              </div>
                              <div className="border-t border-gray-100 my-1" />
                            </>
                          )}
                          <div className="flex justify-between">
                            <span className="font-bold text-purple-800">운영 이익</span>
                            <span className="font-bold text-purple-600">${Math.max(0, operatingProfit).toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="border-t border-gray-200 pt-2 mt-1">
                    <div className="flex justify-between pt-1">
                      <span className="font-semibold text-gray-900">총 가격</span>
                      <span className="font-bold text-gray-900">${(editData?.total_price || 0).toFixed(2)}</span>
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
