'use client'

import { useState } from 'react'

interface ProductOption {
  id: string
  name: string
  linked_option_id?: string
  product_option_choices?: Array<{
    id: string
    name: string
    adult_price_adjustment?: number
    child_price_adjustment?: number
    infant_price_adjustment?: number
  }>
}

interface Option {
  id: string
  name: string
  category: string
  adult_price: number
  child_price: number
  infant_price: number
}

interface PricingSectionProps {
  formData: {
    productId: string
    tourDate: string
    channelId: string
    isPrivateTour: boolean
    privateTourAdditionalCost: number
    adultProductPrice: number
    childProductPrice: number
    infantProductPrice: number
    adults: number
    child: number
    infant: number
    productPriceTotal: number
    productChoices: Array<{
      id: string
      name: string
      options?: Array<{
        id: string
        name: string
        adult_price?: number
        child_price?: number
        infant_price?: number
      }>
    }>
    selectedChoices: Record<string, { selected: string; timestamp: string }>
    choiceTotal: number
    choicesTotal?: number
    subtotal: number
    couponCode: string
    couponDiscount: number
    additionalDiscount: number
    additionalCost: number
    tax: number
    cardFee: number
    prepaymentCost: number
    prepaymentTip: number
    selectedOptionalOptions: Record<string, { choiceId: string; quantity: number; price: number }>
    selectedOptions: { [optionId: string]: string[] }
    totalPrice: number
    depositAmount: number
    balanceAmount: number
    commission_percent: number
    onlinePaymentAmount?: number
    onSiteBalanceAmount?: number
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  savePricingInfo: (reservationId: string) => Promise<void>
  calculateProductPriceTotal: () => number
  calculateChoiceTotal: () => number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calculateCouponDiscount: (coupon: any, subtotal: number) => number
  coupons: Array<{
    id: string
    coupon_code: string
    discount_type: 'percentage' | 'fixed'
    percentage_value?: number | null
    fixed_value?: number | null
  }>
  getOptionalOptionsForProduct: (productId: string) => ProductOption[]
  options: Option[]
  t: (key: string) => string
  autoSelectCoupon: () => void
}

export default function PricingSection({
  formData,
  setFormData,
  savePricingInfo,
  calculateProductPriceTotal,
  calculateChoiceTotal,
  calculateCouponDiscount,
  coupons,
  getOptionalOptionsForProduct,
  options,
  autoSelectCoupon
}: PricingSectionProps) {
  const [showHelp, setShowHelp] = useState(false)
  return (
    <div>
      {/* 구분선 */}
      <div className="border-t border-gray-300 mb-4"></div>
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <h3 className="text-base font-semibold text-gray-900">가격 정보</h3>
          {/* 매핑 필드 상태 버튼들 */}
          <div className="flex items-center space-x-1">
            {!formData.productId && (
              <div className="px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                상품
              </div>
            )}
            {!formData.channelId && (
              <div className="px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                채널
              </div>
            )}
            {!formData.tourDate && (
              <div className="px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                날짜
              </div>
            )}
            {formData.productId && formData.channelId && formData.tourDate && (
              <div className="px-2 py-1 bg-green-100 border border-green-300 rounded text-xs text-green-700">
                ✓ 완료
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isPrivateTour}
              onChange={(e) => setFormData({ ...formData, isPrivateTour: e.target.checked })}
              className="mr-1 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-xs text-gray-700">단독투어</span>
          </label>
          {formData.isPrivateTour && (
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-600">+$</span>
              <input
                type="number"
                value={formData.privateTourAdditionalCost}
                onChange={(e) => setFormData({ ...formData, privateTourAdditionalCost: Number(e.target.value) || 0 })}
                className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                step="0.01"
                placeholder="0"
              />
            </div>
          )}
          {/* 상품가에 초이스 포함 처리: 초이스 가격 입력칸을 0으로 입력하면 이중계산 없이 반영됩니다 */}
          <button
            type="button"
            onClick={async () => {
              try {
                const tempReservationId = `temp_${Date.now()}`
                await savePricingInfo(tempReservationId)
                alert('가격 정보가 저장되었습니다!')
              } catch {
                alert('가격 정보 저장 중 오류가 발생했습니다.')
              }
            }}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => {
              // 가격 정보 초기화
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setFormData((prev: any) => ({
                ...prev,
                adultProductPrice: 0,
                childProductPrice: 0,
                infantProductPrice: 0,
                selectedChoices: {},
                couponCode: '',
                couponDiscount: 0,
                additionalDiscount: 0,
                additionalCost: 0,
                cardFee: 0,
                tax: 0,
                prepaymentCost: 0,
                prepaymentTip: 0,
                selectedOptionalOptions: {},
                depositAmount: 0,
                isPrivateTour: false,
                privateTourAdditionalCost: 0,
                commission_percent: 0,
                productChoices: []
              }))
            }}
            className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* 1열: 상품 가격 + 초이스 */}
        <div className="space-y-3">
          {/* 상품 가격 */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">상품가격</h4>
              {(formData.adultProductPrice > 0 || formData.childProductPrice > 0 || formData.infantProductPrice > 0) && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  자동입력됨
                </span>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">성인</span>
                <div className="flex items-center space-x-1">
                  <span className="font-medium">$</span>
                  <input
                    type="number"
                    value={formData.adultProductPrice || ''}
                    onChange={(e) => setFormData({ ...formData, adultProductPrice: Number(e.target.value) || 0 })}
                    className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                    placeholder="0"
                  />
                  <span className="text-gray-500">x{formData.adults}</span>
                  <span className="font-medium">${(formData.adultProductPrice * formData.adults).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">아동</span>
                <div className="flex items-center space-x-1">
                  <span className="font-medium">$</span>
                  <input
                    type="number"
                    value={formData.childProductPrice || ''}
                    onChange={(e) => setFormData({ ...formData, childProductPrice: Number(e.target.value) || 0 })}
                    className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                    placeholder="0"
                  />
                  <span className="text-gray-500">x{formData.child}</span>
                  <span className="font-medium">${(formData.childProductPrice * formData.child).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">유아</span>
                <div className="flex items-center space-x-1">
                  <span className="font-medium">$</span>
                  <input
                    type="number"
                    value={formData.infantProductPrice || ''}
                    onChange={(e) => setFormData({ ...formData, infantProductPrice: Number(e.target.value) || 0 })}
                    className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                    placeholder="0"
                  />
                  <span className="text-gray-500">x{formData.infant}</span>
                  <span className="font-medium">${(formData.infantProductPrice * formData.infant).toFixed(2)}</span>
                </div>
              </div>
              <div className="border-t pt-1 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">합계</span>
                <span className="text-sm font-bold text-blue-600">${formData.productPriceTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 초이스 */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">초이스</h4>
              {formData.productChoices?.length > 0 && Object.keys(formData.selectedChoices || {}).length > 0 && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  자동입력됨
                </span>
              )}
            </div>
            <div className="space-y-2">
              {formData.productChoices?.map((choice) => {
                const selectedChoiceId = formData.selectedChoices[choice.id]?.selected
                if (!selectedChoiceId) return null
                
                const selectedOption = choice.options?.find((opt: any) => opt.id === selectedChoiceId)
                if (!selectedOption) return null
                
                return (
                  <div key={choice.id} className="border border-gray-200 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{choice.name}</span>
                      <span className="text-xs text-gray-500">{selectedOption.name}</span>
                    </div>
                    
                    {/* 가격 표시 */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="block text-gray-600 mb-1">성인</label>
                        <input
                          type="number"
                          value={selectedOption.adult_price || 0}
                          readOnly
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50"
                          step="0.01"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          총: ${((selectedOption.adult_price || 0) * formData.adults).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-1">아동</label>
                        <input
                          type="number"
                          value={selectedOption.child_price || 0}
                          readOnly
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50"
                          step="0.01"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          총: ${((selectedOption.child_price || 0) * formData.child).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-1">유아</label>
                        <input
                          type="number"
                          value={selectedOption.infant_price || 0}
                          readOnly
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50"
                          step="0.01"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          총: ${((selectedOption.infant_price || 0) * formData.infant).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {(!formData.productChoices || formData.productChoices.length === 0) && (
                <div className="text-center py-2 text-gray-500 text-xs">
                  상품 선택 시 표시
                </div>
              )}
              
              <div className="border-t pt-1 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">총합</span>
                <span className="text-sm font-bold text-green-600">+${(formData.choiceTotal || formData.choicesTotal || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2열: 할인/추가 비용 + 옵션 */}
        <div className="space-y-3">
          {/* 할인 및 추가 비용 입력 */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">할인/추가비용</h4>
            <div className="space-y-2">
              {/* 쿠폰 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">쿠폰</label>
                    <button
                      type="button"
                      onClick={autoSelectCoupon}
                      className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                      title="상품, 채널, 날짜에 맞는 쿠폰 자동 선택"
                    >
                      자동 선택
                    </button>
                  </div>
                  {formData.couponCode && (
                    <div className="text-xs text-red-600 font-medium">
                      -${formData.couponDiscount.toFixed(2)}
                    </div>
                  )}
                </div>
                <select
                  value={formData.couponCode}
                  onChange={(e) => {
                    const selectedCouponCode = e.target.value
                    const selectedCoupon = coupons.find(coupon => coupon.coupon_code === selectedCouponCode)
                    
                    const subtotal = calculateProductPriceTotal() + calculateChoiceTotal()
                    const couponDiscount = calculateCouponDiscount(selectedCoupon, subtotal)
                    
                    setFormData({ 
                      ...formData, 
                      couponCode: selectedCouponCode,
                      couponDiscount: couponDiscount
                    })
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">쿠폰 선택</option>
                  {coupons.map((coupon) => {
                    let discountText = '할인 정보 없음'
                    if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
                      discountText = `${coupon.percentage_value}%`
                    } else if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
                      discountText = `$${coupon.fixed_value}`
                    }
                    
                    return (
                      <option key={coupon.id} value={coupon.coupon_code}>
                        {coupon.coupon_code} ({discountText})
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* 추가 할인 및 비용 */}
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">추가할인</label>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.additionalDiscount}
                      onChange={(e) => setFormData({ ...formData, additionalDiscount: Number(e.target.value) || 0 })}
                      className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">추가비용</label>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.additionalCost}
                      onChange={(e) => setFormData({ ...formData, additionalCost: Number(e.target.value) || 0 })}
                      className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">세금</label>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.tax}
                      onChange={(e) => setFormData({ ...formData, tax: Number(e.target.value) || 0 })}
                      className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">카드수수료</label>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.cardFee}
                      onChange={(e) => setFormData({ ...formData, cardFee: Number(e.target.value) || 0 })}
                      className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

                             {/* 선결제 비용 */}
               <div className="border-t pt-2 mt-2">
                 <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">선결제 지출</label>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={formData.prepaymentCost}
                        onChange={(e) => setFormData({ ...formData, prepaymentCost: Number(e.target.value) || 0 })}
                        className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">선결제 팁</label>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={formData.prepaymentTip}
                        onChange={(e) => setFormData({ ...formData, prepaymentTip: Number(e.target.value) || 0 })}
                        className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 옵션 */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">옵션</h4>
            <div className="space-y-2">
              {Object.entries(formData.selectedOptionalOptions).map(([optionId, option]) => {
                return (
                  <div key={optionId} className="border border-gray-200 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">옵션</span>
                      <button
                        type="button"
                        onClick={() => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          setFormData((prev: any) => {
                            const newOptions = { ...prev.selectedOptionalOptions }
                            delete newOptions[optionId]
                            return { ...prev, selectedOptionalOptions: newOptions }
                          })
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        삭제
                      </button>
                    </div>
                    <div className="space-y-1">
                      <select
                        value={option.choiceId}
                        onChange={(e) => {
                          const selectedOptionId = e.target.value
                          const selectedOption = options.find((opt) => opt.id === selectedOptionId)
                          
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          setFormData((prev: any) => ({
                            ...prev,
                            selectedOptionalOptions: {
                              ...prev.selectedOptionalOptions,
                              [optionId]: { 
                                ...option, 
                                choiceId: selectedOptionId,
                                price: selectedOption?.adult_price || 0
                              }
                            }
                          }))
                        }}
                        className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">옵션 선택</option>
                        {options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name} (${option.adult_price})
                          </option>
                        ))}
                      </select>
                      
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="0"
                          value={option.quantity}
                          onChange={(e) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        setFormData((prev: any) => ({
                            ...prev,
                            selectedOptionalOptions: {
                              ...prev.selectedOptionalOptions,
                              [optionId]: {
                                ...prev.selectedOptionalOptions[optionId],
                                quantity: Number(e.target.value) || 0
                              }
                            }
                          }))}
                          className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="수량"
                        />
                        <span className="text-xs text-gray-600">x ${option.price}</span>
                        <span className="text-xs font-medium">= ${(option.quantity * option.price).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              <button
                type="button"
                onClick={() => {
                  if (!formData.productId) {
                    alert('먼저 상품을 선택해주세요.')
                    return
                  }
                  
                  const optionalOptions = getOptionalOptionsForProduct(formData.productId)
                  if (optionalOptions.length === 0) {
                    alert('이 상품에는 옵션이 없습니다.')
                    return
                  }
                  
                  const newOptionId = `selected_${Date.now()}`
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  setFormData((prev: any) => ({
                    ...prev,
                    selectedOptionalOptions: {
                      ...prev.selectedOptionalOptions,
                      [newOptionId]: { choiceId: '', quantity: 0, price: 0 }
                    }
                  }))
                }}
                className="w-full px-2 py-1 border border-dashed border-gray-300 rounded text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600"
              >
                + 옵션 추가
              </button>
            </div>
          </div>
        </div>

        {/* 3열: 가격 계산 (2줄 높이) */}
        <div className="row-span-2">
          <div className="bg-white p-4 rounded border border-gray-200 h-full">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">가격 계산</h4>
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                계산 안내
              </button>
            </div>
            
            {/* 소계 */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-700">소계</span>
              <span className="text-sm font-medium text-gray-900">${formData.subtotal.toFixed(2)}</span>
            </div>
            
            {/* 할인 항목들 */}
            {(formData.couponDiscount > 0 || formData.additionalDiscount > 0) && (
              <div className="space-y-1 mb-2">
                {formData.couponDiscount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-red-600">쿠폰 할인</span>
                    <span className="text-xs text-red-600">-${formData.couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                {formData.additionalDiscount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-red-600">추가 할인</span>
                    <span className="text-xs text-red-600">-${formData.additionalDiscount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* 추가 비용 항목들 */}
            {(formData.additionalCost > 0 || formData.tax > 0 || formData.cardFee > 0 || formData.isPrivateTour || formData.prepaymentCost > 0 || formData.prepaymentTip > 0) && (
              <div className="space-y-1 mb-2">
                {formData.additionalCost > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">추가 비용</span>
                    <span className="text-xs text-green-600">+${formData.additionalCost.toFixed(2)}</span>
                  </div>
                )}
                {formData.tax > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">세금</span>
                    <span className="text-xs text-green-600">+${formData.tax.toFixed(2)}</span>
                  </div>
                )}
                {formData.cardFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">카드수수료</span>
                    <span className="text-xs text-green-600">+${formData.cardFee.toFixed(2)}</span>
                  </div>
                )}
                {formData.prepaymentCost > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">선결제 지출</span>
                    <span className="text-xs text-green-600">+${formData.prepaymentCost.toFixed(2)}</span>
                  </div>
                )}
                {formData.prepaymentTip > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">선결제 팁</span>
                    <span className="text-xs text-green-600">+${formData.prepaymentTip.toFixed(2)}</span>
                  </div>
                )}
                {formData.isPrivateTour && formData.privateTourAdditionalCost > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-600">단독투어 추가비용</span>
                    <span className="text-xs text-green-600">+${formData.privateTourAdditionalCost.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* 구분선 */}
            <div className="border-t border-gray-300 my-2"></div>
            
            {/* 총 가격, 커미션, NET 가격 */}
            <div className="space-y-1 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-gray-900">총 가격</span>
                <span className="text-lg font-bold text-blue-600">${formData.totalPrice.toFixed(2)}</span>
              </div>
              
              {/* OTA/현장 분리 입력 - 같은 줄 배치 (라벨과 입력칸을 한 줄에) */}
              <div className="flex flex-col gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600">OTA 판매가</span>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.onlinePaymentAmount || 0}
                      onChange={(e) => setFormData({ ...formData, onlinePaymentAmount: Number(e.target.value) || 0 })}
                      className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                      step="0.01"
                      placeholder="220.00"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600">balance</span>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.onSiteBalanceAmount || 0}
                      onChange={(e) => setFormData({ ...formData, onSiteBalanceAmount: Number(e.target.value) || 0, balanceAmount: Number(e.target.value) || 0 })}
                      className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                      step="0.01"
                      placeholder="90.00"
                    />
                  </div>
                </div>
              </div>

              {/* 커미션 퍼센트 입력 */}
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">커미션</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    value={formData.commission_percent}
                    onChange={(e) => setFormData({ ...formData, commission_percent: Number(e.target.value) || 0 })}
                    className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0"
                  />
                  <span className="text-xs text-gray-500">%</span>
                  <span className="text-sm font-medium text-red-600">
                    -${(((formData.onlinePaymentAmount ?? formData.totalPrice) * (formData.commission_percent / 100)).toFixed(2))}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-green-800">Net 가격</span>
                <span className="text-lg font-bold text-green-600">
                  ${(((formData.onlinePaymentAmount ?? formData.totalPrice) * (1 - formData.commission_percent / 100)).toFixed(2))}
                </span>
              </div>
            </div>
            
            {/* 보증금 및 잔액 */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">보증금</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    value={formData.depositAmount}
                    onChange={(e) => setFormData({ ...formData, depositAmount: Number(e.target.value) || 0 })}
                    className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">잔액</span>
                <span className="text-sm font-medium text-gray-900">${formData.balanceAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowHelp(false)}></div>
          <div className="relative bg-white w-full max-w-2xl max-h-[80vh] rounded-lg shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">가격 계산 안내</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowHelp(false)}>✕</button>
            </div>
            <div className="p-4 overflow-y-auto text-sm text-gray-800 space-y-3">
              <div>
                <div className="font-semibold text-gray-900 mb-1">1) 판매가 구성</div>
                <p>상품가(성인/아동/유아 단가×인원) + 초이스 합계 = 소계(Subtotal)</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">2) 할인 적용</div>
                <p>소계에서 쿠폰 할인 + 추가 할인 차감</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">3) 추가 비용</div>
                <p>추가비용, 세금, 카드수수료, 단독투어 추가비, 선결제 비용/팁, 옵션 합계 가산</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">4) 총 판매가</div>
                <p>2단계 결과 + 3단계 결과</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">5) 분할 결제(해당 채널일 때)</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>OTA 판매가: 고객이 OTA에서 결제한 금액</li>
                  <li>커미션 금액 = OTA 판매가 × 커미션%</li>
                  <li>Net = OTA 판매가 − 커미션 금액</li>
                  <li>balance: 현장 수금 잔액</li>
                  <li>고객 총지불액 = OTA 판매가 + balance</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">6) 용어 간단 설명</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>소계: 상품가와 초이스만 더한 중간합</li>
                  <li>총 판매가: 모든 할인과 추가비용을 반영한 고객 기준 최종금액</li>
                  <li>커미션: OTA 수수료(퍼센트 기준)</li>
                  <li>Net: 커미션 차감 후 우리 측에 귀속되는 금액</li>
                  <li>보증금/잔액: 선결제·현장 수금 분배</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">7) 저장 매핑</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>commission_percent, commission_amount 저장</li>
                  <li>deposit_amount = OTA 판매가, balance_amount = balance</li>
                  <li>total_price = 고객 총지불액</li>
                </ul>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 text-right">
              <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => setShowHelp(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
