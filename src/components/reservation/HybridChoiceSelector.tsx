import React, { useState, useEffect, useCallback } from 'react';

// 하이브리드 시스템 타입 정의
interface ChoiceOption {
  id: string;
  option_key: string;
  option_name: string;
  option_name_ko: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  capacity: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

interface ProductChoice {
  id: string;
  choice_name: string;
  choice_name_ko: string;
  choice_type: 'single' | 'multiple' | 'quantity';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  options: ChoiceOption[];
}

interface ProductOption {
  id: string;
  name: string;
  description: string;
  is_required: boolean;
  is_multiple: boolean;
  choice_name: string;
  choice_description: string;
  adult_price_adjustment: number;
  child_price_adjustment: number;
  infant_price_adjustment: number;
  is_default: boolean;
}

interface SelectedChoice {
  choice_id: string;
  choice_option_id: string;
  option_key: string;
  option_name_ko: string;
  quantity: number;
  total_price: number;
}

interface SelectedOption {
  option_id: string;
  option_name: string;
  quantity: number;
  total_price: number;
}

interface HybridChoiceSelectorProps {
  choices: ProductChoice[];
  options: ProductOption[];
  adults: number;
  children: number;
  infants: number;
  totalPeople: number;
  onSelectionChange: (choices: SelectedChoice[], options: SelectedOption[]) => void;
  initialChoices?: SelectedChoice[];
  initialOptions?: SelectedOption[];
}

export default function HybridChoiceSelector({
  choices,
  options,
  adults,
  children,
  infants,
  totalPeople,
  onSelectionChange,
  initialChoices = [],
  initialOptions = []
}: HybridChoiceSelectorProps) {
  const [selectedChoices, setSelectedChoices] = useState<SelectedChoice[]>(initialChoices);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>(initialOptions);
  const [errors, setErrors] = useState<string[]>([]);

  // Choice 선택 변경 핸들러
  const handleChoiceChange = useCallback((
    choiceId: string,
    choiceOptionId: string,
    optionKey: string,
    optionNameKo: string,
    quantity: number,
    totalPrice: number
  ) => {
    setSelectedChoices(prev => {
      const newChoices = prev.filter(c => !(c.choice_id === choiceId && c.choice_option_id === choiceOptionId));
      
      if (quantity > 0) {
        newChoices.push({
          choice_id: choiceId,
          choice_option_id: choiceOptionId,
          option_key: optionKey,
          option_name_ko: optionNameKo,
          quantity,
          total_price: totalPrice
        });
      }
      
      return newChoices;
    });
  }, []);

  // Option 선택 변경 핸들러
  const handleOptionChange = useCallback((
    optionId: string,
    optionName: string,
    quantity: number,
    totalPrice: number
  ) => {
    setSelectedOptions(prev => {
      const newOptions = prev.filter(o => o.option_id !== optionId);
      
      if (quantity > 0) {
        newOptions.push({
          option_id: optionId,
          option_name: optionName,
          quantity,
          total_price: totalPrice
        });
      }
      
      return newOptions;
    });
  }, []);

  // 가격 계산 함수 (Choice용)
  const calculateChoicePrice = useCallback((
    option: ChoiceOption,
    quantity: number,
    adults: number,
    children: number,
    infants: number
  ) => {
    const pricePerPerson = (adults * option.adult_price) + 
                          (children * option.child_price) + 
                          (infants * option.infant_price);
    
    return pricePerPerson * quantity;
  }, []);

  // 가격 계산 함수 (Option용)
  const calculateOptionPrice = useCallback((
    option: ProductOption,
    quantity: number,
    adults: number,
    children: number,
    infants: number
  ) => {
    const priceAdjustment = (adults * option.adult_price_adjustment) + 
                           (children * option.child_price_adjustment) + 
                           (infants * option.infant_price_adjustment);
    
    return priceAdjustment * quantity;
  }, []);

  // 유효성 검사
  const validateSelections = useCallback(() => {
    const newErrors: string[] = [];
    
    choices.forEach(choice => {
      const choiceSelections = selectedChoices.filter(c => c.choice_id === choice.id);
      
      if (choice.is_required && choiceSelections.length === 0) {
        newErrors.push(`${choice.choice_name_ko} 선택이 필수입니다.`);
      }
      
      if (choiceSelections.length < choice.min_selections) {
        newErrors.push(`${choice.choice_name_ko}는 최소 ${choice.min_selections}개 선택해야 합니다.`);
      }
      
      if (choiceSelections.length > choice.max_selections) {
        newErrors.push(`${choice.choice_name_ko}는 최대 ${choice.max_selections}개까지만 선택할 수 있습니다.`);
      }
      
      // 수용 인원 검사 (quantity 타입인 경우)
      if (choice.choice_type === 'quantity') {
        const totalCapacity = choiceSelections.reduce((total, selection) => {
          const option = choice.options.find(o => o.id === selection.choice_option_id);
          return total + (option ? option.capacity * selection.quantity : 0);
        }, 0);
        
        if (totalCapacity < totalPeople) {
          newErrors.push(`${choice.choice_name_ko} 총 수용 인원이 부족합니다. (필요: ${totalPeople}명, 선택: ${totalCapacity}명)`);
        }
      }
    });
    
    setErrors(newErrors);
    return newErrors.length === 0;
  }, [selectedChoices, choices, totalPeople]);

  // 선택사항 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onSelectionChange(selectedChoices, selectedOptions);
  }, [selectedChoices, selectedOptions, onSelectionChange]);

  // 유효성 검사 실행
  useEffect(() => {
    validateSelections();
  }, [validateSelections]);

  // 초기 선택사항 설정
  useEffect(() => {
    setSelectedChoices(initialChoices);
    setSelectedOptions(initialOptions);
  }, [initialChoices, initialOptions]);

  return (
    <div className="space-y-8">
      {/* 필수 선택 (Choices) */}
      {choices.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">필수 선택</h2>
          {choices.map(choice => (
            <div key={choice.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {choice.choice_name_ko}
                  {choice.is_required && <span className="text-red-500 ml-1">*</span>}
                </h3>
                <span className="text-sm text-gray-500">
                  {choice.min_selections === choice.max_selections 
                    ? `${choice.min_selections}개 선택` 
                    : `${choice.min_selections}-${choice.max_selections}개 선택`}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {choice.options
                  .filter(option => option.is_active)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map(option => {
                    const currentSelection = selectedChoices.find(c => 
                      c.choice_id === choice.id && c.choice_option_id === option.id
                    );
                    const currentQuantity = currentSelection?.quantity || 0;
                    const totalPrice = calculateChoicePrice(option, currentQuantity, adults, children, infants);
                    
                    return (
                      <div 
                        key={option.id}
                        className={`border rounded-lg p-4 transition-colors ${
                          currentQuantity > 0 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            {option.option_name_ko}
                          </h4>
                          <span className="text-sm text-gray-500">
                            {option.capacity}명
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-3">
                          <div>성인: ₩{option.adult_price.toLocaleString()}</div>
                          <div>아동: ₩{option.child_price.toLocaleString()}</div>
                          <div>유아: ₩{option.infant_price.toLocaleString()}</div>
                        </div>
                        
                        {choice.choice_type === 'quantity' ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleChoiceChange(
                                  choice.id,
                                  option.id,
                                  option.option_key,
                                  option.option_name_ko,
                                  Math.max(0, currentQuantity - 1),
                                  calculateChoicePrice(option, Math.max(0, currentQuantity - 1), adults, children, infants)
                                )}
                                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                                disabled={currentQuantity === 0}
                              >
                                −
                              </button>
                              <span className="w-8 text-center font-medium">
                                {currentQuantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleChoiceChange(
                                  choice.id,
                                  option.id,
                                  option.option_key,
                                  option.option_name_ko,
                                  currentQuantity + 1,
                                  calculateChoicePrice(option, currentQuantity + 1, adults, children, infants)
                                )}
                                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              >
                                +
                              </button>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                ₩{totalPrice.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const newQuantity = currentQuantity > 0 ? 0 : 1;
                              handleChoiceChange(
                                choice.id,
                                option.id,
                                option.option_key,
                                option.option_name_ko,
                                newQuantity,
                                calculateChoicePrice(option, newQuantity, adults, children, infants)
                              );
                            }}
                            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                              currentQuantity > 0
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {currentQuantity > 0 ? '선택됨' : '선택'}
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 선택적 추가 상품 (Options) */}
      {options.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">추가 상품</h2>
          {options.map(option => {
            const currentSelection = selectedOptions.find(o => o.option_id === option.id);
            const currentQuantity = currentSelection?.quantity || 0;
            const totalPrice = calculateOptionPrice(option, currentQuantity, adults, children, infants);
            
            return (
              <div 
                key={option.id}
                className={`border rounded-lg p-4 transition-colors ${
                  currentQuantity > 0 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {option.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {option.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      ₩{totalPrice.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {option.is_multiple ? '다중 선택 가능' : '단일 선택'}
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  <div>성인 추가: ₩{option.adult_price_adjustment.toLocaleString()}</div>
                  <div>아동 추가: ₩{option.child_price_adjustment.toLocaleString()}</div>
                  <div>유아 추가: ₩{option.infant_price_adjustment.toLocaleString()}</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleOptionChange(
                        option.id,
                        option.name,
                        Math.max(0, currentQuantity - 1),
                        calculateOptionPrice(option, Math.max(0, currentQuantity - 1), adults, children, infants)
                      )}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      disabled={currentQuantity === 0}
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-medium">
                      {currentQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOptionChange(
                        option.id,
                        option.name,
                        currentQuantity + 1,
                        calculateOptionPrice(option, currentQuantity + 1, adults, children, infants)
                      )}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-sm text-gray-500">
                    {option.is_required ? '필수' : '선택'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* 에러 메시지 */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <span className="text-red-400 text-lg font-bold mr-3">⚠</span>
            <div>
              <h3 className="text-sm font-medium text-red-800">
                선택 오류
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 선택 요약 */}
      {(selectedChoices.length > 0 || selectedOptions.length > 0) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">선택 요약</h3>
          
          {selectedChoices.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-gray-700 mb-1">필수 선택</h4>
              <div className="space-y-1">
                {selectedChoices.map((choice, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{choice.option_name_ko} × {choice.quantity}</span>
                    <span>₩{choice.total_price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {selectedOptions.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-gray-700 mb-1">추가 상품</h4>
              <div className="space-y-1">
                {selectedOptions.map((option, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{option.option_name} × {option.quantity}</span>
                    <span>₩{option.total_price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-medium">
            <span>총 가격</span>
            <span>₩{[
              ...selectedChoices.map(c => c.total_price),
              ...selectedOptions.map(o => o.total_price)
            ].reduce((total, price) => total + price, 0).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
