'use client'

import { useEffect, memo, useCallback, useState, useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
  onAccordionToggle?: (isExpanded: boolean) => void
  isEditMode?: boolean // 편집 모드 여부
}

const ProductSelectionSection = memo(function ProductSelectionSection({
  formData,
  setFormData,
  products,
  loadProductChoices,
  t,
  layout = 'modal',
  onAccordionToggle,
  isEditMode = false
}: ProductSelectionSectionProps) {
  
  // 이전 상품 ID를 추적하여 무한 루프 방지
  const prevProductIdRef = useRef<string | null>(null);
  
  // 로딩 상태 추가
  const [isLoadingChoices, setIsLoadingChoices] = useState(false);
  
  // 어코디언 상태 추가
  const [isExpanded, setIsExpanded] = useState(layout === 'modal');
  
  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (onAccordionToggle) {
      onAccordionToggle(newExpanded);
    }
  };
  
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
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('product_choices 로드 오류:', error)
        throw error
      }

      console.log('ProductSelectionSection에서 로드된 초이스:', data, '편집모드:', isEditMode);
      
      // 편집 모드일 때는 기존 선택을 유지하고, productChoices만 업데이트
      setFormData(prev => {
        const hasExistingChoices = prev.selectedChoices && prev.selectedChoices.length > 0;
        
        // 편집 모드이거나 기존 선택이 있으면 선택값 유지
        if (isEditMode || hasExistingChoices) {
          console.log('ProductSelectionSection: 기존 선택 유지:', prev.selectedChoices);
          return {
            ...prev,
            productChoices: data || []
            // selectedChoices와 choicesTotal은 유지
          };
        }
        
        // 새 예약 모드: 기본값 설정
        const defaultChoices: ReservationChoice[] = [];
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

        return {
          ...prev,
          productChoices: data || [],
          selectedChoices: defaultChoices,
          choicesTotal: defaultChoices.reduce((sum, choice) => sum + choice.total_price, 0)
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
    console.log('ProductSelectionSectionNew: handleSelectionChange 호출됨', {
      selectionsCount: selections.length,
      selections: selections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id, quantity: s.quantity })),
    });
    
    const choicesTotal = selections.reduce((sum, selection) => sum + (selection.total_price || 0), 0);
    
    setFormData(prev => {
      console.log('ProductSelectionSectionNew: setFormData 실행', {
        prevSelectedChoicesCount: Array.isArray(prev.selectedChoices) ? prev.selectedChoices.length : 0,
        prevSelectedChoicesType: Array.isArray(prev.selectedChoices) ? 'array' : typeof prev.selectedChoices,
        newSelectionsCount: selections.length,
        choicesTotal,
        newSelections: selections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id }))
      });
      
      return {
        ...prev,
        selectedChoices: selections,
        choicesTotal
      };
    });
  }, [setFormData]);
  
  // 상품이 변경될 때 choice 데이터 로드 (편집 모드에서는 기존 데이터 보존)
  useEffect(() => {
    console.log('ProductSelectionSection: 상품 변경 useEffect 실행:', {
      productId: formData.productId,
      prevProductId: prevProductIdRef.current,
      hasSelectedChoices: formData.selectedChoices?.length > 0,
      isEditMode,
      productChoicesCount: formData.productChoices?.length
    });
    
    // 편집 모드이고 이미 productChoices가 로드되어 있으면 로드하지 않음
    if (isEditMode && formData.productChoices && formData.productChoices.length > 0) {
      console.log('ProductSelectionSection: 편집 모드이고 이미 초이스가 로드됨, 스킵');
      return;
    }
    
    // 상품 ID가 실제로 변경된 경우에만 실행
    if (formData.productId && formData.productId !== prevProductIdRef.current) {
      prevProductIdRef.current = formData.productId;
      
      // 편집 모드가 아닐 때만 초이스 로드
      if (!isEditMode) {
        console.log('ProductSelectionSection: 새 예약 모드, 초이스 로드');
        loadProductChoicesNew(formData.productId);
      } else {
        console.log('ProductSelectionSection: 편집 모드, ReservationForm에서 로드한 초이스 사용');
      }
    }
  }, [formData.productId, formData.productChoices, formData.selectedChoices, isEditMode]);
  
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-900">
          {t('form.productSelection')}
        </h3>
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center text-gray-500 hover:text-gray-700"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>
      
      {/* 선택된 상품 정보 표시 - 검색창 위에 배치 */}
      {formData.productId && (
        <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 font-medium">선택된 상품:</span>
              <span className="text-sm text-blue-900 font-medium">
                {products.find(p => p.id === formData.productId)?.name_ko || '알 수 없는 상품'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
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
              }}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-100 rounded"
            >
              해제
            </button>
          </div>
        </div>
      )}
      
      {isExpanded && (
        <div className="mb-4">
          {/* 새로운 ProductSelector 사용 */}
          <ProductSelector
            selectedProductId={formData.productId}
            onProductSelect={handleProductSelect}
            showChoices={false}
            showSelectedProduct={false}
            className="mb-4"
          />
        </div>
      )}
      
      {/* 새로운 간결한 초이스 선택기 */}
      {formData.productId && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-gray-900 mb-2">초이스 선택</h4>
          {isLoadingChoices ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">초이스 데이터를 불러오는 중...</p>
            </div>
          ) : formData.productChoices.length > 0 ? (
            <>
              {console.log('ProductSelectionSectionNew: SimpleChoiceSelector 렌더링', {
                productChoicesCount: formData.productChoices.length,
                selectedChoicesCount: formData.selectedChoices?.length || 0,
                selectedChoices: formData.selectedChoices,
                isEditMode
              })}
              <SimpleChoiceSelector
                choices={formData.productChoices}
                adults={0}
                children={0}
                infants={0}
                onSelectionChange={handleSelectionChange}
                initialSelections={formData.selectedChoices || []}
              />
              <div className="mt-4 text-right">
                <span className="text-sm font-medium text-gray-900">
                  초이스 총액: ${formData.choicesTotal.toLocaleString()}
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
