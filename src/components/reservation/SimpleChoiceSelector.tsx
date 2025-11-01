import React, { useState, useEffect, useCallback, useRef } from 'react';

// 새로운 간결한 타입 정의
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
  choice_group: string;
  choice_group_ko: string;
  choice_type: 'single' | 'multiple' | 'quantity';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  options: ChoiceOption[];
}

interface SelectedChoice {
  choice_id: string;
  option_id: string;
  option_key: string;
  option_name_ko: string;
  quantity: number;
  total_price: number;
}

interface SimpleChoiceSelectorProps {
  choices: ProductChoice[];
  adults: number;
  children: number;
  infants: number;
  onSelectionChange: (selections: SelectedChoice[]) => void;
  onPeopleChange?: (adults: number, children: number, infants: number) => void;
  initialSelections?: SelectedChoice[];
}

export default function SimpleChoiceSelector({
  choices,
  adults,
  children,
  infants,
  onSelectionChange,
  onPeopleChange,
  initialSelections = []
}: SimpleChoiceSelectorProps) {
  const [selections, setSelections] = useState<SelectedChoice[]>(initialSelections);
  const [errors, setErrors] = useState<string[]>([]);
  const prevInitialSelectionsRef = useRef<SelectedChoice[]>(initialSelections);
  const prevSelectionsRef = useRef<SelectedChoice[]>(initialSelections);

  // 선택사항 변경 핸들러
  const handleSelectionChange = useCallback((
    choiceId: string,
    optionId: string,
    optionKey: string,
    optionNameKo: string,
    quantity: number,
    totalPrice: number
  ) => {
    setSelections(prev => {
      const newSelections = prev.filter(s => !(s.choice_id === choiceId && s.option_id === optionId));
      
      if (quantity > 0) {
        newSelections.push({
          choice_id: choiceId,
          option_id: optionId,
          option_key: optionKey,
          option_name_ko: optionNameKo,
          quantity,
          total_price: totalPrice
        });
      }
      
      // 사용자 액션이므로 즉시 부모에 알림
      onSelectionChange(newSelections);
      prevSelectionsRef.current = newSelections;
      
      return newSelections;
    });
  }, [onSelectionChange]);

  // 가격 계산 함수
  const calculatePrice = useCallback((
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

  // 유효성 검사
  const validateSelections = useCallback(() => {
    const newErrors: string[] = [];
    
    choices.forEach(choice => {
      const choiceSelections = selections.filter(s => s.choice_id === choice.id);
      
      if (choice.is_required && choiceSelections.length === 0) {
        newErrors.push(`${choice.choice_group_ko} 선택이 필수입니다.`);
      }
      
      if (choiceSelections.length < choice.min_selections) {
        newErrors.push(`${choice.choice_group_ko}는 최소 ${choice.min_selections}개 선택해야 합니다.`);
      }
      
      if (choiceSelections.length > choice.max_selections) {
        newErrors.push(`${choice.choice_group_ko}는 최대 ${choice.max_selections}개까지만 선택할 수 있습니다.`);
      }
      
      // 수용 인원 검사 (quantity 타입인 경우)
      if (choice.choice_type === 'quantity') {
        const totalCapacity = choiceSelections.reduce((total, selection) => {
          const option = (choice.options || []).find(o => o.id === selection.option_id);
          return total + (option ? option.capacity * selection.quantity : 0);
        }, 0);
        
        const totalPeople = adults + children + infants;
        if (totalCapacity < totalPeople) {
          newErrors.push(`${choice.choice_group_ko} 총 수용 인원이 부족합니다. (필요: ${totalPeople}명, 선택: ${totalCapacity}명)`);
        }
      }
    });
    
    setErrors(newErrors);
    return newErrors.length === 0;
  }, [selections, choices, adults, children, infants]);

  // 초기 선택사항 설정 (실제 값이 변경된 경우에만)
  useEffect(() => {
    // 초기값이 실제로 변경되었는지 확인 (참조가 아닌 값 비교)
    const prev = prevInitialSelectionsRef.current;
    const hasChanged = 
      prev.length !== initialSelections.length ||
      prev.some((prevSel, idx) => {
        const currentSel = initialSelections[idx];
        return !currentSel ||
          prevSel.choice_id !== currentSel.choice_id ||
          prevSel.option_id !== currentSel.option_id ||
          prevSel.quantity !== currentSel.quantity;
      });
    
    if (hasChanged) {
      prevInitialSelectionsRef.current = initialSelections;
      prevSelectionsRef.current = initialSelections;
      setSelections(initialSelections);
      // props에서 업데이트된 경우에는 onSelectionChange를 호출하지 않음 (무한 루프 방지)
    }
  }, [initialSelections]);

  // selections가 props로부터 변경된 경우에만 추적 (useEffect는 제거, handleSelectionChange에서 직접 처리)

  // 유효성 검사 실행
  useEffect(() => {
    validateSelections();
  }, [validateSelections]);

  return (
    <div className="space-y-3">
      {choices.map(choice => (
        <div key={choice.id} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-medium text-gray-900">
              {choice.choice_group_ko}
              {choice.is_required && <span className="text-red-500 ml-1">*</span>}
            </h3>
            <span className="text-xs text-gray-500">
              {choice.min_selections === choice.max_selections 
                ? `${choice.min_selections}개 선택` 
                : `${choice.min_selections}-${choice.max_selections}개 선택`}
            </span>
          </div>
          
          <div className="space-y-2">
            {(choice.options || [])
              .filter(option => option.is_active)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(option => {
                const currentSelection = selections.find(s => 
                  s.choice_id === choice.id && s.option_id === option.id
                );
                const currentQuantity = currentSelection?.quantity || 0;
                const totalPrice = calculatePrice(option, currentQuantity, adults, children, infants);
                
                return (
                  <div 
                    key={option.id}
                    className={`border rounded-lg p-3 transition-all duration-200 cursor-pointer ${
                      currentQuantity > 0 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      // 카드 클릭 시 선택/해제 토글
                      const currentSelection = selections.find(s => 
                        s.choice_id === choice.id && s.option_id === option.id
                      );
                      const currentQuantity = currentSelection?.quantity || 0;
                      
                      if (choice.choice_type === 'single') {
                        // single 타입: 다른 옵션들 해제하고 현재 옵션 선택
                        const newSelections = selections.filter(s => s.choice_id !== choice.id);
                        if (currentQuantity === 0) {
                          newSelections.push({
                            choice_id: choice.id,
                            option_id: option.id,
                            option_key: option.option_key,
                            option_name_ko: option.option_name_ko,
                            quantity: 1,
                            total_price: calculatePrice(option, 1, adults, children, infants)
                          });
                        }
                        // 사용자 액션이므로 즉시 부모에 알림
                        setSelections(newSelections);
                        onSelectionChange(newSelections);
                        prevSelectionsRef.current = newSelections;
                      } else {
                        // multiple/quantity 타입: 현재 옵션 토글
                        if (currentQuantity > 0) {
                          // 선택 해제
                          handleSelectionChange(
                            choice.id,
                            option.id,
                            option.option_key,
                            option.option_name_ko,
                            0,
                            0
                          );
                        } else {
                          // 선택
                          handleSelectionChange(
                            choice.id,
                            option.id,
                            option.option_key,
                            option.option_name_ko,
                            1,
                            calculatePrice(option, 1, adults, children, infants)
                          );
                        }
                      }
                    }}
                  >
                    <div className="flex flex-col h-full">
                      {/* 상단: 옵션명과 수량 조절 */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900 text-sm">
                            {option.option_name_ko}
                          </h4>
                          {option.is_default && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                              기본
                            </span>
                          )}
                          {currentQuantity > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                              선택됨
                            </span>
                          )}
                        </div>
                        {/* 수량 조절 (choice_type이 single이 아닌 경우에만 표시) - 오른쪽 위 끝 */}
                        {currentQuantity > 0 && choice.choice_type !== 'single' && (
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (currentQuantity > 1) {
                                  handleSelectionChange(
                                    choice.id,
                                    option.id,
                                    option.option_key,
                                    option.option_name_ko,
                                    currentQuantity - 1,
                                    calculatePrice(option, currentQuantity - 1, adults, children, infants)
                                  );
                                } else {
                                  // 수량이 1이면 선택 해제
                                  handleSelectionChange(
                                    choice.id,
                                    option.id,
                                    option.option_key,
                                    option.option_name_ko,
                                    0,
                                    0
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-xs"
                            >
                              −
                            </button>
                            <span className="text-xs font-medium text-blue-600 min-w-[16px] text-center">
                              {currentQuantity}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectionChange(
                                  choice.id,
                                  option.id,
                                  option.option_key,
                                  option.option_name_ko,
                                  currentQuantity + 1,
                                  calculatePrice(option, currentQuantity + 1, adults, children, infants)
                                );
                              }}
                              className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-xs"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* 하단: 가격 정보와 총액을 한 줄에 */}
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <div className="flex items-center space-x-2">
                          <span>성인: ${option.adult_price.toLocaleString()}</span>
                          <span>아동: ${option.child_price.toLocaleString()}</span>
                          <span>유아: ${option.infant_price.toLocaleString()}</span>
                          {/* 인원 수 수정 버튼 */}
                          {onPeopleChange && (
                            <div className="flex items-center space-x-1 ml-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPeopleChange(Math.max(0, adults - 1), children, infants);
                                }}
                                className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-xs"
                                disabled={adults <= 0}
                              >
                                −
                              </button>
                              <span className="text-xs font-medium min-w-[16px] text-center">
                                성인: {adults}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPeopleChange(adults + 1, children, infants);
                                }}
                                className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-xs"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                        {/* 총액 - 오른쪽 끝 */}
                        <div className="text-sm font-medium text-gray-900">
                          ${totalPrice.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
      
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
      
    </div>
  );
}