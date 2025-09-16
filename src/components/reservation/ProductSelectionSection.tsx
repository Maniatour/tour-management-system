'use client'

interface Product {
  id: string
  name?: string | null
  name_ko: string
  name_en?: string | null
  category?: string | null
  sub_category?: string | null
}

interface ProductOption {
  id: string
  name: string
  linked_option_id?: string
  choice_name?: string
  choice_description?: string
  adult_price_adjustment?: number
  child_price_adjustment?: number
  infant_price_adjustment?: number
  is_default?: boolean
}

interface ProductSelectionSectionProps {
  formData: {
    productId: string
    selectedProductCategory: string
    selectedProductSubCategory: string
    productSearch: string
    selectedOptions: Record<string, string[]>
    requiredOptions: Record<string, { choiceId: string; adult: number; child: number; infant: number }>
    selectedOptionPrices: Record<string, number>
    tourDate: string
    channelId: string
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  products: Product[]
  getRequiredOptionsForProduct: (productId: string) => Record<string, ProductOption[]>
  loadRequiredOptionsForProduct: (productId: string) => Promise<void>
  getDynamicPricingForOption: (optionId: string) => Promise<{ adult: number; child: number; infant: number } | null>
  t: (key: string) => string
}

export default function ProductSelectionSection({
  formData,
  setFormData,
  products,
  getRequiredOptionsForProduct,
  loadRequiredOptionsForProduct,
  getDynamicPricingForOption,
  t
}: ProductSelectionSectionProps) {
  
  // 디버깅을 위한 로그
  console.log('ProductSelectionSection - formData.selectedOptions:', formData.selectedOptions)
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.product')}</label>
      
      {/* 상품명 검색 */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="상품명 검색..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          onChange={(e) => setFormData((prev: any) => ({ ...prev, productSearch: e.target.value }))} // eslint-disable-line @typescript-eslint/no-explicit-any
        />
      </div>
      
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        {/* 상품 카테고리별 탭 */}
        <div className="flex bg-gray-50">
          {Array.from(new Set(products.map(p => p.category))).filter(Boolean).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                ...prev, 
                selectedProductCategory: category || '',
                selectedProductSubCategory: '' // 카테고리 변경 시 서브카테고리 초기화
              }))}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                (formData.selectedProductCategory || '') === category
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* 서브카테고리 선택 (카테고리가 선택된 경우에만 표시) */}
        {formData.selectedProductCategory && (
          <div className="flex bg-gray-100 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setFormData((prev: any) => ({ ...prev, selectedProductSubCategory: '' }))} // eslint-disable-line @typescript-eslint/no-explicit-any
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                !formData.selectedProductSubCategory
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {t('form.allCategories')}
            </button>
            {Array.from(new Set(
              products
                .filter(p => p.category === formData.selectedProductCategory && p.sub_category)
                .map(p => p.sub_category)
            )).filter(Boolean).map((subCategory) => (
              <button
                key={subCategory}
                type="button"
                onClick={() => setFormData((prev: any) => ({ ...prev, selectedProductSubCategory: subCategory || '' }))} // eslint-disable-line @typescript-eslint/no-explicit-any
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  formData.selectedProductSubCategory === subCategory
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {subCategory}
              </button>
            ))}
          </div>
        )}
        
        {/* 상품 선택 리스트 */}
        <div className={`overflow-y-auto ${formData.productId ? 'h-[320px]' : 'h-[770px]'}`}>
          {products
            .filter(product => {
              const matchesCategory = !formData.selectedProductCategory || product.category === formData.selectedProductCategory
              const matchesSubCategory = !formData.selectedProductSubCategory || product.sub_category === formData.selectedProductSubCategory
              const displayName = (product.name || product.name_ko || product.name_en || '')?.toLowerCase()
              const matchesSearch = !formData.productSearch || 
                displayName.includes(formData.productSearch.toLowerCase()) ||
                (product.sub_category || '').toLowerCase().includes(formData.productSearch.toLowerCase())
              return matchesCategory && matchesSubCategory && matchesSearch
            })
            .map(product => (
              <div
                key={product.id}
                onClick={async () => {
                  const newProductId = formData.productId === product.id ? '' : product.id
                  setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                    ...prev, 
                    productId: newProductId,
                    selectedOptions: {} // 상품 변경 시 선택된 옵션 초기화
                  }))
                  
                  // 상품 선택 시 필수 옵션 자동 로드
                  if (newProductId) {
                    await loadRequiredOptionsForProduct(newProductId)
                  } else {
                    setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                      ...prev, 
                      requiredOptions: {},
                      selectedOptions: {} // 상품 변경 시 선택된 옵션도 초기화
                    }))
                  }
                }}
                className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                  formData.productId === product.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="text-sm text-gray-900">{product.name || product.name_ko || product.name_en}</div>
              </div>
            ))}
        </div>
      </div>
      
      {/* 선택된 상품 정보 표시 */}
      {formData.productId && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">{t('form.selectedProduct')}</h4>
          {(() => {
            const selectedProduct = products.find(p => p.id === formData.productId)
            return selectedProduct ? (
              <div className="space-y-2">
                <div className="font-medium text-gray-900">{selectedProduct.name || selectedProduct.name_ko || selectedProduct.name_en}</div>

              </div>
            ) : null
          })()}
        </div>
      )}
      
      {/* 선택된 상품의 필수 옵션 표시 */}
      {formData.productId && (
        <div className="mt-4">
          <div className="space-y-4">
            {Object.entries(getRequiredOptionsForProduct(formData.productId)).map(([category, options]) => (
              <div key={category} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 border-b pb-2">
                  {category} 카테고리 (택일)
                </h4>
                <div className="space-y-3">
                  {options.map((option) => {
                    // 병합된 테이블에서는 각 옵션이 이미 하나의 선택지를 나타냄
                    const choice = {
                      id: option.id,
                      name: option.choice_name || option.name,
                      adult_price_adjustment: option.adult_price_adjustment,
                      child_price_adjustment: option.child_price_adjustment,
                      infant_price_adjustment: option.infant_price_adjustment
                    }
                    return (
                      <div 
                        key={choice.id} 
                        className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                          formData.selectedOptions[option.id]?.includes(choice.id)
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                        }`}
                        onClick={async () => {
                          // 같은 카테고리의 다른 옵션들은 선택 해제
                          const updatedSelectedOptions = { ...formData.selectedOptions }
                          options.forEach(opt => {
                            if (opt.id !== option.id) {
                              updatedSelectedOptions[opt.id] = []
                            }
                          })

                          // 가격 정보의 필수 옵션도 함께 업데이트
                          const updatedRequiredOptions = { ...formData.requiredOptions }
                          options.forEach(opt => {
                            if (opt.id !== option.id) {
                              delete updatedRequiredOptions[opt.id]
                            }
                          })

                          // 선택된 choice의 가격 정보를 가격 정보 섹션에 반영
                          // dynamic_pricing에서 가격을 가져오고, 없으면 기본 가격 사용
                          const dynamicPricing = await getDynamicPricingForOption(option.linked_option_id || option.id)
                          updatedRequiredOptions[option.id] = {
                            choiceId: choice.id,
                            adult: dynamicPricing?.adult ?? choice.adult_price_adjustment ?? 0,
                            child: dynamicPricing?.child ?? choice.child_price_adjustment ?? 0,
                            infant: dynamicPricing?.infant ?? choice.infant_price_adjustment ?? 0
                          }
                          
                          setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                            ...prev,
                            selectedOptions: {
                              ...updatedSelectedOptions,
                              [option.id]: [choice.id]
                            },
                            requiredOptions: updatedRequiredOptions
                          }))
                        }}
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            formData.selectedOptions[option.id]?.includes(choice.id)
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {formData.selectedOptions[option.id]?.includes(choice.id) && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {choice.name}
                            </div>
                          </div>
                        </div>
                        
                                                 {/* 가격 정보는 가격 정보 섹션에서 관리 */}
                         <div className="text-xs text-gray-500 mt-2">
                           가격은 가격 정보 섹션에서 설정됩니다
                         </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            
            {Object.keys(getRequiredOptionsForProduct(formData.productId)).length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4 border border-gray-200 rounded-lg">
                {t('form.noRequiredOptions')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
