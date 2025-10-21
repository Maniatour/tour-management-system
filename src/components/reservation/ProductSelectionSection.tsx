'use client'

import { useEffect, memo, useCallback } from 'react'
import ProductSelector from '@/components/common/ProductSelector';

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
  layout?: 'modal' | 'page'
}

const ProductSelectionSection = memo(function ProductSelectionSection({
  formData,
  setFormData,
  products,
  loadProductChoices,
  t
}: ProductSelectionSectionProps) {
  
  // 상품 선택 핸들러
  const handleProductSelect = useCallback((product: any) => {
    if (product) {
      setFormData({
        ...formData,
        productId: product.id,
        selectedProductCategory: product.category || '',
        selectedProductSubCategory: product.sub_category || '',
        productSearch: '',
        selectedOptions: {},
        requiredOptions: {},
        selectedOptionPrices: {},
        productChoices: [],
        selectedChoices: {},
        choiceTotal: 0
      });
    } else {
      setFormData({
        ...formData,
        productId: '',
        selectedProductCategory: '',
        selectedProductSubCategory: '',
        productSearch: '',
        selectedOptions: {},
        requiredOptions: {},
        selectedOptionPrices: {},
        productChoices: [],
        selectedChoices: {},
        choiceTotal: 0
      });
    }
  }, [formData, setFormData]);

  // Choice 선택 핸들러
  const handleChoiceSelect = useCallback((choice: any, choiceGroupId?: string) => {
    if (choice && choiceGroupId) {
      const newSelectedChoices = {
        ...formData.selectedChoices,
        [choiceGroupId]: {
          selected: choice.id,
          timestamp: new Date().toISOString()
        }
      };
      
      setFormData({
        ...formData,
        selectedChoices: newSelectedChoices,
        choiceTotal: choice.adult_price + choice.child_price + choice.infant_price
      });
    }
  }, [formData, setFormData]);
  
  // 상품이 변경될 때 choice 데이터 로드
  useEffect(() => {
    if (formData.productId) {
      loadProductChoices(formData.productId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.productId])
  
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('form.productSelection')}
        </h3>
        
        {/* 새로운 ProductSelector 사용 */}
        <ProductSelector
          selectedProductId={formData.productId}
          onProductSelect={handleProductSelect}
          showChoices={false}
          className="mb-4"
        />
      </div>
      
      {/* 선택된 상품 정보 표시 - ProductSelector에서 이미 표시하므로 제거 */}
      
      {/* 선택된 상품의 초이스 표시 */}
      {formData.productId && formData.productChoices && formData.productChoices.length > 0 && (
        <div className="mt-4">
          <div className="space-y-4">
            <div className="space-y-3">
              {formData.productChoices.map((choice) => {
                // choiceGroupId를 동적으로 찾기 (reservation.choices.required에서)
                const choiceGroupId = Object.keys(formData.selectedChoices || {}).find(key => 
                  formData.selectedChoices[key]?.selected === choice.id
                );
                
                const isSelected = choiceGroupId ? formData.selectedChoices[choiceGroupId]?.selected === choice.id : false;
                
                return (
                  <div
                    key={choice.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      if (choiceGroupId) {
                        handleChoiceSelect(choice, choiceGroupId);
                      }
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
})

export default ProductSelectionSection