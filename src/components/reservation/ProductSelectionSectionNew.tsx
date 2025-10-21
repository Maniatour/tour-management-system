'use client'

import { useEffect, memo, useCallback, useState, useRef } from 'react'
import ProductSelector from '@/components/common/ProductSelector';
import SimpleChoiceSelector from '@/components/reservation/SimpleChoiceSelector';
import { supabase } from '@/lib/supabase';

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
    // 새로운 간결한 초이스 시스템 필드
    productChoices: ProductChoice[]
    selectedChoices: ReservationChoice[]
    choicesTotal: number
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
  
  // 이전 상품 ID를 추적하여 무한 루프 방지
  const prevProductIdRef = useRef<string | null>(null);
  
  // 로딩 상태 추가
  const [isLoadingChoices, setIsLoadingChoices] = useState(false);
  
  // 새로운 간결한 초이스 시스템에서 초이스 로드
  const loadProductChoicesNew = useCallback(async (productId: string) => {
    if (!productId) {
      setFormData(prev => ({
        ...prev,
        productChoices: [],
        selectedChoices: [],
        choicesTotal: 0
      }));
      return;
    }

    setIsLoadingChoices(true);
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
        .order('sort_order');

      if (error) throw error;

      console.log('ProductSelectionSection에서 로드된 초이스:', data);
      
      // 편집 모드가 아닌 경우에만 기본값으로 설정
      const defaultChoices: ReservationChoice[] = [];
      
      // 기존 선택이 없는 경우에만 기본값 설정
      setFormData(prev => {
        const hasExistingChoices = prev.selectedChoices && prev.selectedChoices.length > 0;
        
        if (!hasExistingChoices) {
          data?.forEach(choice => {
            const defaultOption = choice.options?.find(opt => opt.is_default);
            if (defaultOption) {
              defaultChoices.push({
                choice_id: choice.id,
                option_id: defaultOption.id,
                quantity: 1,
                total_price: defaultOption.adult_price
              });
            }
          });
        }

        return {
          ...prev,
          productChoices: data || [],
          selectedChoices: hasExistingChoices ? prev.selectedChoices : defaultChoices,
          choicesTotal: hasExistingChoices ? prev.choicesTotal : defaultChoices.reduce((sum, choice) => sum + choice.total_price, 0)
        };
      });
    } catch (error) {
      console.error('초이스 로드 오류:', error);
      setFormData(prev => ({
        ...prev,
        productChoices: [],
        selectedChoices: [],
        choicesTotal: 0
      }));
    } finally {
      setIsLoadingChoices(false);
    }
  }, []);
  
  // 상품 선택 핸들러 (폼 제출 방지)
  const handleProductSelect = useCallback((product: any, event?: Event) => {
    // 폼 제출 방지
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (product) {
      setFormData(prev => ({
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
        choicesTotal: 0
      }));
    } else {
      setFormData(prev => ({
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
        choicesTotal: 0
      }));
    }
  }, []);

  // 초이스 선택 변경 핸들러
  const handleChoiceChange = useCallback((choiceId: string, optionId: string, quantity: number = 1) => {
    setFormData(prev => {
      const existingIndex = prev.selectedChoices.findIndex(c => c.choice_id === choiceId);
      const choice = prev.productChoices.find(c => c.id === choiceId);
      const option = choice?.options?.find(o => o.id === optionId);
      
      if (!option) return prev;

      const newChoice: ReservationChoice = {
        choice_id: choiceId,
        option_id: optionId,
        quantity,
        total_price: option.adult_price * quantity
      };

      let updatedChoices;
      if (existingIndex >= 0) {
        updatedChoices = [...prev.selectedChoices];
        updatedChoices[existingIndex] = newChoice;
      } else {
        updatedChoices = [...prev.selectedChoices, newChoice];
      }

      const choicesTotal = updatedChoices.reduce((sum, choice) => sum + choice.total_price, 0);

      return {
        ...prev,
        selectedChoices: updatedChoices,
        choicesTotal
      };
    });
  }, []);

  // 초이스 선택 변경 핸들러 - useCallback으로 최적화
  const handleSelectionChange = useCallback((selections: any[]) => {
    const choicesTotal = selections.reduce((sum, selection) => sum + selection.total_price, 0);
    setFormData(prev => ({
      ...prev,
      selectedChoices: selections,
      choicesTotal
    }));
  }, []);
  
  // 상품이 변경될 때 choice 데이터 로드 (편집 모드에서는 기존 데이터 보존)
  useEffect(() => {
    console.log('ProductSelectionSection: 상품 변경 useEffect 실행:', {
      productId: formData.productId,
      prevProductId: prevProductIdRef.current,
      hasSelectedChoices: formData.selectedChoices?.length > 0,
      isEditMode: formData.selectedChoices?.length > 0
    });
    
    // 상품 ID가 실제로 변경된 경우에만 실행
    if (formData.productId && formData.productId !== prevProductIdRef.current) {
      prevProductIdRef.current = formData.productId;
      
      // 상품이 변경되면 항상 초이스 로드 (편집 모드에서도 모든 옵션을 보여주기 위해)
      loadProductChoicesNew(formData.productId);
    }
  }, [formData.productId, loadProductChoicesNew]);
  
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
      
      {/* 새로운 간결한 초이스 선택기 */}
      {formData.productId && (
        <div className="mt-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">초이스 선택</h4>
          {isLoadingChoices ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">초이스 데이터를 불러오는 중...</p>
            </div>
          ) : formData.productChoices.length > 0 ? (
            <>
              <SimpleChoiceSelector
                choices={formData.productChoices}
                adults={0}
                children={0}
                infants={0}
                totalPeople={0}
                onSelectionChange={handleSelectionChange}
                initialSelections={formData.selectedChoices}
              />
              <div className="mt-4 text-right">
                <span className="text-lg font-semibold text-gray-900">
                  초이스 총액: ₩{formData.choicesTotal.toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">이 상품에는 선택 가능한 초이스가 없습니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ProductSelectionSection;
