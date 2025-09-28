'use client'

import { useEffect } from 'react'

interface Product {
  id: string
  name?: string | null
  name_ko: string
  name_en?: string | null
  category?: string | null
  sub_category?: string | null
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
    // Choice 관련 필드 추가
    productChoices: Array<{
      id: string
      name: string
      name_ko?: string
      description?: string
      adult_price: number
      child_price: number
      infant_price: number
      is_default?: boolean
    }>
    selectedChoices: Record<string, { selected: string; timestamp: string }>
    choiceTotal: number
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  products: Product[]
  loadProductChoices: (productId: string) => Promise<void>
  getDynamicPricingForOption: (optionId: string) => Promise<{ adult: number; child: number; infant: number } | null>
  t: (key: string) => string
}

export default function ProductSelectionSection({
  formData,
  setFormData,
  products,
  loadProductChoices,
  getDynamicPricingForOption,
  t
}: ProductSelectionSectionProps) {
  
  // 상품이 변경될 때 choice 데이터 로드
  useEffect(() => {
    if (formData.productId) {
      loadProductChoices(formData.productId)
    }
  }, [formData.productId, loadProductChoices])
  
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
                  
                  // 상품 선택 시 초이스 자동 로드
                  if (newProductId) {
                    await loadProductChoices(newProductId)
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
      
      {/* 선택된 상품의 초이스 표시 */}
      {formData.productId && formData.productChoices && formData.productChoices.length > 0 && (
        <div className="mt-4">
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 border-b pb-2">
                {t('form.requiredChoices')}
              </h4>
              <div className="space-y-3">
                {formData.productChoices.map((choice) => {
                  const isSelected = formData.selectedChoices[choice.id]?.selected === choice.id
                  
                  return (
                    <div 
                      key={choice.id} 
                      className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                      }`}
                      onClick={async () => {
                        // dynamic_pricing에서 가격을 가져오고, 없으면 기본 가격 사용
                        const dynamicPricing = await getDynamicPricingForOption(choice.id)
                        
                        const selectedChoice = {
                          selected: choice.id,
                          timestamp: new Date().toISOString()
                        }
                        
                        setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                          ...prev,
                          selectedChoices: {
                            ...prev.selectedChoices,
                            [choice.id]: selectedChoice
                          },
                          // choiceTotal 계산
                          choiceTotal: (dynamicPricing?.adult ?? choice.adult_price) * prev.adults + 
                                     (dynamicPricing?.child ?? choice.child_price) * prev.child + 
                                     (dynamicPricing?.infant ?? choice.infant_price) * prev.infant
                        }))
                      }}
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {choice.name_ko || choice.name}
                          </div>
                          {choice.description && (
                            <div className="text-xs text-gray-500 mt-1">
                              {choice.description}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-2">
                        성인: ${choice.adult_price} | 아동: ${choice.child_price} | 유아: ${choice.infant_price}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 초이스가 없는 경우 */}
      {formData.productId && (!formData.productChoices || formData.productChoices.length === 0) && (
        <div className="mt-4">
          <div className="text-center py-4 text-gray-500 text-sm">
            {t('form.noRequiredChoices')}
          </div>
        </div>
      )}
    </div>
  )
}
