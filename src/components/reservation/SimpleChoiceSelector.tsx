import { useState, useEffect, useCallback, useRef } from 'react';

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
  // 수동으로 가격을 수정한 초이스를 추적 (choice_id:option_id 형식)
  const [manuallyEditedPrices, setManuallyEditedPrices] = useState<Set<string>>(new Set());

  // initialSelections prop이 변경될 때 selections 상태 업데이트
  // 이 변경은 props에서 온 것이므로 onSelectionChange를 호출하지 않음 (무한 루프 방지)
  // 편집 모드에서 초이스가 로드될 때 제대로 반영되도록 개선
  useEffect(() => {
    // initialSelections가 실제로 변경되었는지 확인 (참조 비교가 아닌 내용 비교)
    const prevIds = prevInitialSelectionsRef.current.map(s => `${s.choice_id}:${s.option_id}:${s.quantity}`).sort().join(',');
    const newIds = initialSelections.map(s => `${s.choice_id}:${s.option_id}:${s.quantity}`).sort().join(',');
    
    // 현재 selections와 비교
    const currentIds = selections.map(s => `${s.choice_id}:${s.option_id}:${s.quantity}`).sort().join(',');
    
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
      prev: prevInitialSelectionsRef.current.map(s => ({ choice_id: s.choice_id, option_id: s.option_id, quantity: s.quantity })),
      new: initialSelections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id, quantity: s.quantity })),
      current: selections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id, quantity: s.quantity }))
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
      
      // 편집 모드에서 초이스가 로드될 때 제대로 반영되도록 개선
      // 조건 1: 현재 selections가 비어있고 initialSelections에 데이터가 있는 경우
      // 조건 2: initialSelections가 이전 값과 다르고, 현재 selections가 이전 initialSelections와 같은 경우 (초기 로드 후 업데이트)
      const shouldUpdate = 
        (currentIds === '' && newIds !== '') || // 빈 상태에서 데이터가 로드되는 경우
        (newIds !== '' && currentIds === prevIds); // 초이스가 로드된 후 업데이트되는 경우
      
      if (shouldUpdate) {
        console.log('SimpleChoiceSelector: initialSelections 변경됨, 상태 업데이트', { 
          prev: prevInitialSelectionsRef.current.map(s => ({ choice_id: s.choice_id, option_id: s.option_id, quantity: s.quantity })), 
          new: initialSelections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id, quantity: s.quantity })),
          prevIds,
          newIds,
          currentIds,
          reason: currentIds === '' ? '빈 상태에서 데이터 로드' : '초이스 업데이트'
        });
        
        // 새로운 값으로 업데이트
        const newSelections = initialSelections.map(s => ({
          ...s,
          option_key: s.option_key || '',
          option_name_ko: s.option_name_ko || ''
        }));
        setSelections(newSelections);
        prevInitialSelectionsRef.current = [...initialSelections]; // 복사본 저장
        prevSelectionsRef.current = [...newSelections]; // 복사본 저장
        
        console.log('SimpleChoiceSelector: selections 상태 업데이트 완료 (props에서)', {
          updatedSelections: newSelections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id, quantity: s.quantity })),
          selectionsCount: newSelections.length
        });
      } else {
        console.log('SimpleChoiceSelector: initialSelections 변경되었지만 업데이트하지 않음', {
          currentIds,
          newIds,
          prevIds,
          currentSelections: selections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id })),
          newInitialSelections: initialSelections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id })),
          reason: '사용자 선택 보호 또는 변경 없음'
        });
        // prevInitialSelectionsRef만 업데이트 (selections는 절대 변경하지 않음)
        prevInitialSelectionsRef.current = [...initialSelections];
      }
    }
  }, [initialSelections, selections]);
  
  // selections 상태 변경 추적 및 부모 컴포넌트에 알림
  useEffect(() => {
    // total_price도 포함하여 변경 감지 (가격 수정도 감지하기 위해)
    const prevIds = prevSelectionsRef.current.map(s => `${s.choice_id}:${s.option_id}:${s.quantity}:${s.total_price}`).sort().join(',');
    const currentIds = selections.map(s => `${s.choice_id}:${s.option_id}:${s.quantity}:${s.total_price}`).sort().join(',');
    
    console.log('SimpleChoiceSelector: selections 상태 변경됨', {
      selections,
      selectionsCount: selections.length,
      prevIds,
      currentIds,
      isUserAction: isUserActionRef.current
    });
    
    // 이전 값과 다르면 변경 감지 (total_price 포함)
    if (prevIds !== currentIds) {
      // 사용자 액션이면 onSelectionChange 호출
      if (isUserActionRef.current) {
        console.log('SimpleChoiceSelector: 사용자 액션으로 인한 변경, onSelectionChange 호출', {
          selectionsCount: selections.length,
          selections: selections.map(s => ({ choice_id: s.choice_id, option_id: s.option_id, total_price: s.total_price }))
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
    infants: number,
    isResidentStatusChoice: boolean = false
  ) => {
    // 거주자 구분 초이스의 경우: 수량에 따라 가격 계산 (인원당 가격)
    if (isResidentStatusChoice) {
      // 거주자 구분 초이스는 수량(quantity)에 따라 가격 계산
      // 예: 비거주자 $100, 수량 1이면 $100 * 1 = $100
      return option.adult_price * quantity;
    }
    
    // 일반 초이스: 전체 인원에 대한 가격 계산
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
      
      // "미국 거주자 구분" 관련 초이스인지 확인
      const isResidentStatusChoice = choice.choice_group_ko?.includes('거주자') || 
                                     choice.choice_group_ko?.includes('거주') ||
                                     choice.choice_group?.toLowerCase().includes('resident') ||
                                     choice.choice_group?.toLowerCase().includes('거주')
      
      if (choice.is_required && choiceSelections.length === 0) {
        newErrors.push(`${choice.choice_group_ko} 선택이 필수입니다.`);
      }
      
      if (choiceSelections.length < choice.min_selections) {
        newErrors.push(`${choice.choice_group_ko}는 최소 ${choice.min_selections}개 선택해야 합니다.`);
      }
      
      // 미국 거주자 구분 초이스의 경우, max_selections 검증을 건너뛰고 대신 수량 합계로 검증
      if (isResidentStatusChoice) {
        // 거주자 구분 초이스는 여러 옵션을 선택할 수 있고, 각 옵션의 수량 합이 총 인원 수와 일치해야 함
        const totalQuantity = choiceSelections.reduce((sum, selection) => sum + selection.quantity, 0);
        const totalPeople = adults + children + infants;
        
        // 디버깅: 총 인원 수 계산 확인
        console.log('SimpleChoiceSelector: 거주자 구분 초이스 검증', {
          choiceGroup: choice.choice_group_ko,
          totalQuantity,
          adults,
          children,
          infants,
          totalPeople,
          choiceSelections: choiceSelections.map(s => ({ option_id: s.option_id, quantity: s.quantity }))
        });
        
        // 수량이 총 인원 수와 일치하는지 확인 (선택된 경우에만)
        // totalPeople이 0이면 검증 건너뛰기 (아직 인원 수가 설정되지 않았을 수 있음)
        if (choiceSelections.length > 0 && totalPeople > 0 && totalQuantity !== totalPeople) {
          newErrors.push(`${choice.choice_group_ko} 선택 수량(${totalQuantity}명)이 총 인원 수(${totalPeople}명)와 일치하지 않습니다.`);
        }
      } else {
        // 일반 초이스는 기존 max_selections 검증 유지
        if (choiceSelections.length > choice.max_selections) {
          newErrors.push(`${choice.choice_group_ko}는 최대 ${choice.max_selections}개까지만 선택할 수 있습니다.`);
        }
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

  // 인원 수가 변경될 때 단일 선택 초이스의 total_price 업데이트
  // 단, 수동으로 수정한 가격은 자동 계산에서 제외
  useEffect(() => {
    const updatedSelections = selections.map(selection => {
      const choice = choices.find(c => c.id === selection.choice_id);
      if (!choice) return selection;
      
      const isResidentStatusChoice = choice.choice_group_ko?.includes('거주자') || 
                                     choice.choice_group_ko?.includes('거주') ||
                                     choice.choice_group?.toLowerCase().includes('resident') ||
                                     choice.choice_group?.toLowerCase().includes('거주');
      
      // 수동으로 수정한 가격인지 확인
      const priceKey = `${selection.choice_id}:${selection.option_id}`;
      const isManuallyEdited = manuallyEditedPrices.has(priceKey);
      
      // 단일 선택 초이스이고 선택된 경우에만 total_price 업데이트
      // 단, 수동으로 수정한 경우는 자동 계산하지 않음
      if (choice.choice_type === 'single' && !isResidentStatusChoice && selection.quantity > 0 && !isManuallyEdited) {
        const option = choice.options?.find(o => o.id === selection.option_id);
        if (option) {
          const newTotalPrice = (adults * option.adult_price) + 
                               (children * option.child_price) + 
                               (infants * option.infant_price);
          return { ...selection, total_price: newTotalPrice };
        }
      }
      return selection;
    });
    
    // total_price가 변경된 경우에만 onSelectionChange 호출
    const hasChanges = updatedSelections.some((updated, index) => 
      updated.total_price !== selections[index]?.total_price
    );
    
    if (hasChanges) {
      onSelectionChange(updatedSelections);
      setSelections(updatedSelections);
    }
  }, [adults, children, infants, choices, selections, onSelectionChange, manuallyEditedPrices]);

  return (
    <div className="space-y-3">
      {choices.map(choice => {
        // "미국 거주자 구분" 관련 초이스인지 확인
        const isResidentStatusChoice = choice.choice_group_ko?.includes('거주자') || 
                                       choice.choice_group_ko?.includes('거주') ||
                                       choice.choice_group?.toLowerCase().includes('resident') ||
                                       choice.choice_group?.toLowerCase().includes('거주')
        
        return (
        <div key={choice.id} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-gray-900">
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
                // 단일 선택 초이스의 경우: 선택 여부와 관계없이 인원 수에 따른 총액 계산
                let totalPrice = 0;
                if (choice.choice_type === 'single' && !isResidentStatusChoice) {
                  // 단일 선택 초이스: 성인, 아동, 유아 가격에 각각의 인원 수를 곱해서 총액 계산
                  totalPrice = (adults * option.adult_price) + 
                              (children * option.child_price) + 
                              (infants * option.infant_price);
                } else {
                  // multiple/quantity 타입 또는 거주자 구분 초이스: 기존 로직 사용
                  totalPrice = calculatePrice(option, currentQuantity, adults, children, infants, isResidentStatusChoice);
                }
                
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
                      
                      // 거주자 구분 초이스이거나 multiple/quantity 타입인 경우: 여러 옵션 동시 선택 가능
                      if (isResidentStatusChoice || choice.choice_type !== 'single') {
                        // multiple/quantity 타입: 현재 옵션 토글
                        if (currentQuantity > 0) {
                          // 선택 해제 - 수동 수정 플래그도 제거
                          const priceKey = `${choice.id}:${option.id}`;
                          setManuallyEditedPrices(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(priceKey);
                            return newSet;
                          });
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
                          // 단일 선택 초이스가 아닌 경우에만 calculatePrice 사용
                          let selectionTotalPrice = 0;
                          if (choice.choice_type === 'single' && !isResidentStatusChoice) {
                            // 단일 선택 초이스: 인원 수에 따른 총액 계산
                            selectionTotalPrice = (adults * option.adult_price) + 
                                                  (children * option.child_price) + 
                                                  (infants * option.infant_price);
                          } else {
                            // multiple/quantity 타입 또는 거주자 구분 초이스: 기존 로직 사용
                            selectionTotalPrice = calculatePrice(option, 1, adults, children, infants, isResidentStatusChoice);
                          }
                          handleSelectionChange(
                            choice.id,
                            option.id,
                            option.option_key,
                            option.option_name_ko,
                            1,
                            selectionTotalPrice
                          );
                        }
                      } else {
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
                          // 단일 선택 초이스의 경우: 인원 수에 따른 총액 계산
                          const singleChoiceTotalPrice = (adults * option.adult_price) + 
                                                         (children * option.child_price) + 
                                                         (infants * option.infant_price);
                          handleSelectionChange(
                            choice.id,
                            option.id,
                            option.option_key,
                            option.option_name_ko,
                            1,
                            singleChoiceTotalPrice
                          );
                        } else {
                          // 이미 선택된 경우 해제 - 수동 수정 플래그도 제거
                          const priceKey = `${choice.id}:${option.id}`;
                          setManuallyEditedPrices(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(priceKey);
                            return newSet;
                          });
                          handleSelectionChange(
                            choice.id,
                            option.id,
                            option.option_key,
                            option.option_name_ko,
                            0,
                            0
                          );
                        }
                      }
                    }}
                  >
                    <div className="flex flex-col h-full">
                      {/* 상단: 옵션명과 수량 조절 */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900 text-xs">
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
                        {/* 수량 조절 (choice_type이 single이 아니거나 거주자 구분 초이스인 경우 표시) - 오른쪽 위 끝 */}
                        {currentQuantity > 0 && (choice.choice_type !== 'single' || isResidentStatusChoice) && (
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const priceKey = `${choice.id}:${option.id}`;
                                if (currentQuantity > 1) {
                                  // 수량 조절 시 수동 수정 플래그 제거 (자동 계산 재시작)
                                  setManuallyEditedPrices(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(priceKey);
                                    return newSet;
                                  });
                                  handleSelectionChange(
                                    choice.id,
                                    option.id,
                                    option.option_key,
                                    option.option_name_ko,
                                    currentQuantity - 1,
                                    calculatePrice(option, currentQuantity - 1, adults, children, infants, isResidentStatusChoice)
                                  );
                                } else {
                                  // 수량이 1이면 선택 해제
                                  setManuallyEditedPrices(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(priceKey);
                                    return newSet;
                                  });
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
                                // 수량 조절 시 수동 수정 플래그 제거 (자동 계산 재시작)
                                const priceKey = `${choice.id}:${option.id}`;
                                setManuallyEditedPrices(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(priceKey);
                                  return newSet;
                                });
                                handleSelectionChange(
                                  choice.id,
                                  option.id,
                                  option.option_key,
                                  option.option_name_ko,
                                  currentQuantity + 1,
                                  calculatePrice(option, currentQuantity + 1, adults, children, infants, isResidentStatusChoice)
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
                        {/* 총액 - 오른쪽 끝 (수정 가능) */}
                        {currentQuantity > 0 ? (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500">총액:</span>
                            <div className="relative">
                              <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                              <input
                                type="number"
                                value={currentSelection?.total_price !== undefined ? currentSelection.total_price : totalPrice}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const inputValue = e.target.value;
                                  // 빈 문자열이면 0으로 처리, 그 외에는 숫자로 변환
                                  const newTotalPrice = inputValue === '' ? 0 : Number(inputValue);
                                  // NaN 체크
                                  if (isNaN(newTotalPrice)) return;
                                  // 수동으로 가격을 수정했음을 표시
                                  const priceKey = `${choice.id}:${option.id}`;
                                  setManuallyEditedPrices(prev => new Set(prev).add(priceKey));
                                  handleSelectionChange(
                                    choice.id,
                                    option.id,
                                    option.option_key,
                                    option.option_name_ko,
                                    currentQuantity,
                                    newTotalPrice
                                  );
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                className="w-20 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded text-right focus:ring-1 focus:ring-blue-500"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-gray-500">
                            ${totalPrice.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        )
      })}
      
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