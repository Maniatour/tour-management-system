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

  // initialSelections prop이 변경될 때 selections 상태 업데이트
  // 이 변경은 props에서 온 것이므로 onSelectionChange를 호출하지 않음 (무한 루프 방지)
  // 매우 보수적으로 처리: 현재 selections가 비어있을 때만 업데이트
  useEffect(() => {
    // initialSelections가 실제로 변경되었는지 확인 (참조 비교가 아닌 내용 비교)
    const prevIds = prevInitialSelectionsRef.current.map(s => `${s.choice_id}:${s.option_id}`).sort().join(',');
    const newIds = initialSelections.map(s => `${s.choice_id}:${s.option_id}`).sort().join(',');
    
    // 현재 selections와 비교
    const currentIds = selections.map(s => `${s.choice_id}:${s.option_id}`).sort().join(',');
    
    console.log('SimpleChoiceSelector: initialSelections 체크', {
      prevLength: prevInitialSelectionsRef.current.length,
      newLength: initialSelections.length,
      currentLength: selections.length,
      prevIds,
      newIds,
      currentIds,
      isDifferent: prevIds !== newIds,
      isUserAction: isUserActionRef.current,
      timeSinceLastUserAction: Date.now() - lastUserActionTimeRef.current,
      prev: prevInitialSelectionsRef.current.map(s => ({ choice_id: s.choice_id, option_id: s.option_id })),
      new: initialSelections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id })),
      current: selections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id }))
    });
    
    // 이전 값과 새로운 값이 다르면 업데이트 고려
    if (prevIds !== newIds) {
      const now = Date.now();
      const timeSinceLastUserAction = now - lastUserActionTimeRef.current;
      
      // 사용자 액션 직후 1000ms 이내이면 initialSelections 변경 완전히 무시
      if (isUserActionRef.current || timeSinceLastUserAction < 1000) {
        console.log('SimpleChoiceSelector: 사용자 액션 직후이므로 initialSelections 변경 완전히 무시', {
          isUserAction: isUserActionRef.current,
          timeSinceLastUserAction,
          currentSelections: selections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id })),
          newInitialSelections: initialSelections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id }))
        });
        // prevInitialSelectionsRef만 업데이트 (selections는 절대 변경하지 않음)
        prevInitialSelectionsRef.current = [...initialSelections];
        return;
      }
      
      // 현재 selections가 비어있고 initialSelections에 데이터가 있을 때만 업데이트
      // 이것이 가장 보수적인 접근: 사용자가 선택한 것이 있으면 절대 덮어쓰지 않음
      if (currentIds === '' && newIds !== '') {
        console.log('SimpleChoiceSelector: initialSelections 변경됨, 상태 업데이트 (현재 selections가 비어있고 새로운 데이터가 있음)', { 
          prev: prevInitialSelectionsRef.current.map(s => ({ choice_id: s.choice_id, option_id: s.option_id })), 
          new: initialSelections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id })),
          prevIds,
          newIds,
          currentIds
        });
        
        // 새로운 값으로 업데이트
        const newSelections = [...initialSelections]; // 복사본으로 설정
        setSelections(newSelections);
        prevInitialSelectionsRef.current = [...initialSelections]; // 복사본 저장
        prevSelectionsRef.current = [...initialSelections]; // 복사본 저장
        
        console.log('SimpleChoiceSelector: selections 상태 업데이트 완료 (props에서)', {
          updatedSelections: newSelections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id })),
          selectionsCount: newSelections.length
        });
      } else {
        console.log('SimpleChoiceSelector: initialSelections 변경되었지만 현재 selections가 비어있지 않아서 덮어쓰지 않음 (사용자 선택 보호)', {
          currentIds,
          newIds,
          currentSelections: selections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id })),
          newInitialSelections: initialSelections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id }))
        });
        // prevInitialSelectionsRef만 업데이트 (selections는 절대 변경하지 않음)
        prevInitialSelectionsRef.current = [...initialSelections];
      }
    }
  }, [initialSelections, selections]);
  
  // selections 상태 변경 추적 및 부모 컴포넌트에 알림
  useEffect(() => {
    const prevIds = prevSelectionsRef.current.map(s => `${s.choice_id}:${s.option_id}:${s.quantity}`).sort().join(',');
    const currentIds = selections.map(s => `${s.choice_id}:${s.option_id}:${s.quantity}`).sort().join(',');
    
    console.log('SimpleChoiceSelector: selections 상태 변경됨', {
      selections,
      selectionsCount: selections.length,
      prevIds,
      currentIds,
      isUserAction: isUserActionRef.current
    });
    
    // 이전 값과 다르면 변경 감지
    if (prevIds !== currentIds) {
      // 사용자 액션이면 onSelectionChange 호출
      if (isUserActionRef.current) {
        console.log('SimpleChoiceSelector: 사용자 액션으로 인한 변경, onSelectionChange 호출', {
          selectionsCount: selections.length,
          selections: selections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id }))
        });
        onSelectionChange(selections);
        // prevSelectionsRef 업데이트
        prevSelectionsRef.current = selections;
        // 플래그는 유지 (lastUserActionTimeRef로 관리)
      } else {
        console.log('SimpleChoiceSelector: props에서 온 변경이므로 onSelectionChange 호출 안 함');
        // prevSelectionsRef 업데이트
        prevSelectionsRef.current = selections;
      }
    } else {
      console.log('SimpleChoiceSelector: 변경 없음, onSelectionChange 호출 안 함');
    }
  }, [selections, onSelectionChange]);

  // 사용자 액션인지 추적하는 ref
  const isUserActionRef = useRef(false);
  // 사용자 액션 타임스탬프 (일정 시간 동안 initialSelections 변경 무시)
  const lastUserActionTimeRef = useRef<number>(0);
  
  // 선택사항 변경 핸들러
  const handleSelectionChange = useCallback((
    choiceId: string,
    optionId: string,
    optionKey: string,
    optionNameKo: string,
    quantity: number,
    totalPrice: number
  ) => {
    isUserActionRef.current = true; // 사용자 액션임을 표시
    lastUserActionTimeRef.current = Date.now(); // 사용자 액션 타임스탬프 저장
    
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
      
      console.log('SimpleChoiceSelector: handleSelectionChange - 새로운 selections 계산됨 (사용자 액션)', {
        newSelectionsCount: newSelections.length,
        newSelections: newSelections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id, quantity: s.quantity })),
        prevCount: prev.length
      });
      
      return newSelections;
    });
  }, []);

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
                
                // 디버깅: 첫 번째 옵션만 로그 출력
                if (option === (choice.options || []).filter(o => o.is_active).sort((a, b) => a.sort_order - b.sort_order)[0]) {
                  console.log(`SimpleChoiceSelector: 옵션 렌더링 체크 (${choice.choice_group_ko})`, {
                    choiceId: choice.id,
                    optionId: option.id,
                    optionName: option.option_name_ko,
                    selectionsCount: selections.length,
                    selections: selections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id })),
                    currentSelection,
                    currentQuantity,
                    isSelected: currentQuantity > 0
                  });
                }
                
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
                        if (currentQuantity === 0) {
                          // 다른 선택 해제
                          selections.filter(s => s.choice_id === choice.id).forEach(s => {
                            handleSelectionChange(
                              s.choice_id,
                              s.option_id,
                              s.option_key,
                              s.option_name_ko,
                              0,
                              0
                            );
                          });
                          // 현재 옵션 선택
                          handleSelectionChange(
                            choice.id,
                            option.id,
                            option.option_key,
                            option.option_name_ko,
                            1,
                            calculatePrice(option, 1, adults, children, infants)
                          );
                        } else {
                          // 이미 선택된 경우 해제
                          handleSelectionChange(
                            choice.id,
                            option.id,
                            option.option_key,
                            option.option_name_ko,
                            0,
                            0
                          );
                        }
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