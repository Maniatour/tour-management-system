'use client'

interface ProductOption {
  id: string
  name: string
  product_option_choices?: Array<{
    id: string
    name: string
    adult_price_adjustment?: number
    child_price_adjustment?: number
    infant_price_adjustment?: number
  }>
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
    productRequiredOptions: ProductOption[]
    requiredOptions: Record<string, { choiceId: string; adult: number; child: number; infant: number }>
    requiredOptionTotal: number
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
    totalPrice: number
    depositAmount: number
    balanceAmount: number
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  savePricingInfo: (reservationId: string) => Promise<void>
  calculateProductPriceTotal: () => number
  calculateRequiredOptionTotal: () => number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calculateCouponDiscount: (coupon: any, subtotal: number) => number
  coupons: Array<{
    id: string
    coupon_code: string
    discount_type: string
    percentage_value?: number
    fixed_value?: number
  }>
  getOptionalOptionsForProduct: (productId: string) => ProductOption[]
  getDynamicPricingForOption: (optionId: string) => { adult: number; child: number; infant: number } | null
  t: (key: string) => string
}

export default function PricingSection({
  formData,
  setFormData,
  savePricingInfo,
  calculateProductPriceTotal,
  calculateRequiredOptionTotal,
  calculateCouponDiscount,
  coupons,
  getOptionalOptionsForProduct,
  getDynamicPricingForOption
}: PricingSectionProps) {
  return (
    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
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
                requiredOptions: {},
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
                productRequiredOptions: []
              }))
            }}
            className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* 1열: 상품 가격 + 필수 옵션 */}
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

          {/* 필수 옵션 */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">필수옵션</h4>
              {formData.productRequiredOptions.length > 0 && Object.values(formData.requiredOptions).some(option => option.adult > 0 || option.child > 0 || option.infant > 0) && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  자동입력됨
                </span>
              )}
            </div>
            <div className="space-y-2">
              {formData.productRequiredOptions.map((productOption) => {
                const currentOption = formData.requiredOptions[productOption.id]
                if (!currentOption) return null
                
                return (
                  <div key={productOption.id} className="border border-gray-200 rounded p-2">
                    <div className="text-xs font-medium text-gray-700 mb-1">
                      {productOption.name}
                    </div>
                    
                    {/* 옵션 선택지 */}
                    {productOption.product_option_choices && productOption.product_option_choices.length > 1 && (
                      <div className="mb-2">
                        <select
                          value={currentOption.choiceId}
                          onChange={(e) => {
                            const selectedChoice = productOption.product_option_choices?.find(
                              (choice) => choice.id === e.target.value
                            )
                            if (selectedChoice) {
                              // dynamic_pricing에서 가격을 가져오고, 없으면 기본 가격 사용
                              const dynamicPricing = getDynamicPricingForOption(productOption.id)
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setFormData((prev: any) => ({
                                ...prev,
                                requiredOptions: {
                                  ...prev.requiredOptions,
                                  [productOption.id]: {
                                    choiceId: selectedChoice.id,
                                    adult: dynamicPricing?.adult ?? selectedChoice.adult_price_adjustment ?? 0,
                                    child: dynamicPricing?.child ?? selectedChoice.child_price_adjustment ?? 0,
                                    infant: dynamicPricing?.infant ?? selectedChoice.infant_price_adjustment ?? 0
                                  }
                                }
                              }))
                            }
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                        >
                          {productOption.product_option_choices.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {choice.name} (${choice.adult_price_adjustment})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* 가격 입력 */}
                    <div className="text-xs space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-gray-600 mb-1">성인</label>
                          <div className="relative">
                            <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                            <input
                              type="number"
                              value={currentOption.adult}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0
                                setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                                  ...prev,
                                  requiredOptions: {
                                    ...prev.requiredOptions,
                                    [productOption.id]: {
                                      ...prev.requiredOptions[productOption.id],
                                      adult: value
                                    }
                                  }
                                }))
                              }}
                              className="w-full pl-4 pr-1 py-1 text-right border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            총: ${(currentOption.adult * formData.adults).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-1">아동</label>
                          <div className="relative">
                            <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                            <input
                              type="number"
                              value={currentOption.child}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0
                                setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                                  ...prev,
                                  requiredOptions: {
                                    ...prev.requiredOptions,
                                    [productOption.id]: {
                                      ...prev.requiredOptions[productOption.id],
                                      child: value
                                    }
                                  }
                                }))
                              }}
                              className="w-full pl-4 pr-1 py-1 text-right border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            총: ${(currentOption.child * formData.child).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-1">유아</label>
                          <div className="relative">
                            <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                            <input
                              type="number"
                              value={currentOption.infant}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0
                                setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                                  ...prev,
                                  requiredOptions: {
                                    ...prev.requiredOptions,
                                    [productOption.id]: {
                                      ...prev.requiredOptions[productOption.id],
                                      infant: value
                                    }
                                  }
                                }))
                              }}
                              className="w-full pl-4 pr-1 py-1 text-right border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            총: ${(currentOption.infant * formData.infant).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {formData.productRequiredOptions.length === 0 && (
                <div className="text-center py-2 text-gray-500 text-xs">
                  상품 선택 시 표시
                </div>
              )}
              
              <div className="border-t pt-1 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">총합</span>
                <span className="text-sm font-bold text-green-600">+${formData.requiredOptionTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2열: 할인/추가 비용 + 선택 옵션 */}
        <div className="space-y-3">
          {/* 할인 및 추가 비용 입력 */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">할인/추가비용</h4>
            <div className="space-y-2">
              {/* 쿠폰 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-600">쿠폰</label>
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
                    
                    const subtotal = calculateProductPriceTotal() + calculateRequiredOptionTotal()
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
                  <input
                    type="number"
                    value={formData.additionalDiscount}
                    onChange={(e) => setFormData({ ...formData, additionalDiscount: Number(e.target.value) || 0 })}
                    className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">추가비용</label>
                  <input
                    type="number"
                    value={formData.additionalCost}
                    onChange={(e) => setFormData({ ...formData, additionalCost: Number(e.target.value) || 0 })}
                    className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">세금</label>
                  <input
                    type="number"
                    value={formData.tax}
                    onChange={(e) => setFormData({ ...formData, tax: Number(e.target.value) || 0 })}
                    className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">카드수수료</label>
                  <input
                    type="number"
                    value={formData.cardFee}
                    onChange={(e) => setFormData({ ...formData, cardFee: Number(e.target.value) || 0 })}
                    className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                  />
                </div>
              </div>

                             {/* 선결제 비용 */}
               <div className="border-t pt-2 mt-2">
                 <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">선결제 지출</label>
                    <input
                      type="number"
                      value={formData.prepaymentCost}
                      onChange={(e) => setFormData({ ...formData, prepaymentCost: Number(e.target.value) || 0 })}
                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">선결제 팁</label>
                    <input
                      type="number"
                      value={formData.prepaymentTip}
                      onChange={(e) => setFormData({ ...formData, prepaymentTip: Number(e.target.value) || 0 })}
                      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 선택 옵션 */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">선택옵션</h4>
            <div className="space-y-2">
              {Object.entries(formData.selectedOptionalOptions).map(([optionId, option]) => {
                const optionalOptions = getOptionalOptionsForProduct(formData.productId)
                return (
                  <div key={optionId} className="border border-gray-200 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">선택 옵션</span>
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
                          const selectedChoiceId = e.target.value
                          const selectedOption = optionalOptions.find((opt) => 
                            opt.product_option_choices?.some((choice) => choice.id === selectedChoiceId)
                          )
                          const selectedChoice = selectedOption?.product_option_choices?.find(
                            (choice) => choice.id === selectedChoiceId
                          )
                          
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setFormData((prev: any) => ({
                            ...prev,
                            selectedOptionalOptions: {
                              ...prev.selectedOptionalOptions,
                              [optionId]: { 
                                ...option, 
                                choiceId: selectedChoiceId,
                                price: selectedChoice?.adult_price_adjustment || 0
                              }
                            }
                          }))
                        }}
                        className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">옵션 선택</option>
                        {optionalOptions.map((productOption) => 
                          productOption.product_option_choices?.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {productOption.name} - {choice.name} (${choice.adult_price_adjustment})
                            </option>
                          ))
                        )}
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
                    alert('이 상품에는 선택 옵션이 없습니다.')
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
                + 선택 옵션 추가
              </button>
            </div>
          </div>
        </div>

        {/* 3열: 가격 계산 (2줄 높이) */}
        <div className="row-span-2">
          <div className="bg-white p-4 rounded border border-gray-200 h-full">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">가격 계산</h4>
            
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
            
            {/* 총 가격 */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-base font-bold text-gray-900">총 가격</span>
              <span className="text-lg font-bold text-blue-600">${formData.totalPrice.toFixed(2)}</span>
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
    </div>
  )
}
