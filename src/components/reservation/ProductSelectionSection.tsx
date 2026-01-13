'use client'

import { useEffect, memo, useCallback } from 'react'
import ProductSelector from '@/components/common/ProductSelector';
import SimpleChoiceSelector from '@/components/reservation/SimpleChoiceSelector';

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
    adults: number
    child: number
    infant: number
    // Choice 관련 필드 추가
    productChoices: Array<{
      id: string
      choice_group: string
      choice_group_ko: string
      choice_type: 'single' | 'multiple' | 'quantity'
      is_required: boolean
      min_selections: number
      max_selections: number
      sort_order: number
      options: Array<{
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
      }>
    }>
    selectedChoices: Array<{
      choice_id: string
      option_id: string
      quantity: number
      total_price: number
    }>
    choicesTotal: number
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
      setFormData((prev: any) => ({
        ...prev,
        productId: product.id,
        selectedProductCategory: product.category || '',
        selectedProductSubCategory: product.sub_category || '',
        productSearch: '',
        selectedOptions: {},
        requiredOptions: {},
        selectedOptionPrices: {},
        productChoices: [],
        selectedChoices: [],
        choicesTotal: 0,
        choiceTotal: 0
      }));
    } else {
      setFormData((prev: any) => ({
        ...prev,
        productId: '',
        selectedProductCategory: '',
        selectedProductSubCategory: '',
        productSearch: '',
        selectedOptions: {},
        requiredOptions: {},
        selectedOptionPrices: {},
        productChoices: [],
        selectedChoices: [],
        choicesTotal: 0,
        choiceTotal: 0
      }));
    }
  }, [setFormData]);

  // 초이스 선택 변경 핸들러
  const handleSelectionChange = useCallback((selectedChoices: Array<{
    choice_id: string
    option_id: string
    quantity: number
    total_price: number
  }>) => {
    console.log('ProductSelectionSection: handleSelectionChange 호출됨', {
      selectedChoicesCount: selectedChoices.length,
      selectedChoices: selectedChoices.map(c => ({ choice_id: c.choice_id, option_id: c.option_id, quantity: c.quantity }))
    });
    
    const choicesTotal = selectedChoices.reduce((sum, choice) => sum + (choice.total_price || 0), 0);
    
    setFormData((prev: any) => {
      console.log('ProductSelectionSection: setFormData 실행', {
        prevSelectedChoicesCount: Array.isArray(prev.selectedChoices) ? prev.selectedChoices.length : 0,
        prevSelectedChoicesType: Array.isArray(prev.selectedChoices) ? 'array' : typeof prev.selectedChoices,
        newSelectedChoicesCount: selectedChoices.length,
        choicesTotal
      });
      
      return {
        ...prev,
        selectedChoices: selectedChoices,
        choicesTotal: choicesTotal,
        choiceTotal: choicesTotal
      };
    });
  }, [setFormData]);
  
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
      
      {/* 초이스 선택 */}
      {formData.productId && formData.productChoices && formData.productChoices.length > 0 && (
        <div className="mt-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">초이스 선택</h4>
          <SimpleChoiceSelector
            choices={formData.productChoices}
            adults={formData.adults || 0}
            children={formData.child || 0}
            infants={formData.infant || 0}
            onSelectionChange={handleSelectionChange}
            initialSelections={formData.selectedChoices || []}
          />
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