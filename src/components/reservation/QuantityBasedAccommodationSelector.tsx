import React, { useState, useEffect, useCallback } from 'react';

interface AccommodationOption {
  id: string;
  name: string;
  name_ko: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  capacity_per_room: number;
  max_quantity: number;
  description?: string;
}

interface AccommodationChoice {
  id: string;
  name: string;
  name_ko: string;
  type: string;
  description: string;
  validation: {
    min_selections: number;
    max_selections: number;
    require_capacity_match: boolean;
  };
  options: AccommodationOption[];
}

interface QuantityBasedAccommodationSelectorProps {
  choice: AccommodationChoice;
  adults: number;
  children: number;
  infants: number;
  totalPeople: number;
  onSelectionChange: (selections: AccommodationSelection[]) => void;
  initialSelections?: AccommodationSelection[];
}

interface AccommodationSelection {
  option_id: string;
  option: AccommodationOption;
  quantity: number;
  total_capacity: number;
  total_price: number;
}

export default function QuantityBasedAccommodationSelector({
  choice,
  adults,
  children,
  infants,
  totalPeople,
  onSelectionChange,
  initialSelections = []
}: QuantityBasedAccommodationSelectorProps) {
  const [selections, setSelections] = useState<AccommodationSelection[]>(initialSelections);
  const [errors, setErrors] = useState<string[]>([]);

  // 가격 계산 함수
  const calculateOptionPrice = useCallback((option: AccommodationOption, quantity: number) => {
    return quantity * (
      option.adult_price * adults + 
      option.child_price * children + 
      option.infant_price * infants
    );
  }, [adults, children, infants]);

  // 총 수용 인원 계산
  const calculateTotalCapacity = useCallback((selections: AccommodationSelection[]) => {
    return selections.reduce((total, selection) => total + selection.total_capacity, 0);
  }, []);

  // 총 가격 계산
  const calculateTotalPrice = useCallback((selections: AccommodationSelection[]) => {
    return selections.reduce((total, selection) => total + selection.total_price, 0);
  }, []);

  // 검증 함수
  const validateSelections = useCallback((selections: AccommodationSelection[]) => {
    const errors: string[] = [];
    
    // 최소 선택 수량 확인
    if (selections.length < choice.validation.min_selections) {
      errors.push(`최소 ${choice.validation.min_selections}개의 숙박 타입을 선택해야 합니다.`);
    }
    
    // 최대 선택 수량 확인
    if (selections.length > choice.validation.max_selections) {
      errors.push(`최대 ${choice.validation.max_selections}개의 숙박 타입만 선택할 수 있습니다.`);
    }
    
    // 수용 인원 검증
    if (choice.validation.require_capacity_match) {
      const totalCapacity = calculateTotalCapacity(selections);
      if (totalCapacity < totalPeople) {
        errors.push(`선택한 숙박의 총 수용 인원(${totalCapacity}명)이 예약 인원(${totalPeople}명)보다 적습니다.`);
      }
    }
    
    return errors;
  }, [choice.validation, calculateTotalCapacity, totalPeople]);

  // 옵션 선택/해제 핸들러
  const handleOptionToggle = useCallback((option: AccommodationOption) => {
    setSelections(prev => {
      const existingIndex = prev.findIndex(s => s.option_id === option.id);
      
      if (existingIndex >= 0) {
        // 이미 선택된 경우 제거
        const newSelections = prev.filter(s => s.option_id !== option.id);
        return newSelections;
      } else {
        // 새로 선택하는 경우 추가 (기본 수량 1)
        const newSelection: AccommodationSelection = {
          option_id: option.id,
          option,
          quantity: 1,
          total_capacity: option.capacity_per_room,
          total_price: calculateOptionPrice(option, 1)
        };
        return [...prev, newSelection];
      }
    });
  }, [calculateOptionPrice]);

  // 수량 변경 핸들러
  const handleQuantityChange = useCallback((optionId: string, quantity: number) => {
    if (quantity < 1) return;
    
    setSelections(prev => {
      const option = choice.options.find(opt => opt.id === optionId);
      if (!option) return prev;
      
      return prev.map(selection => {
        if (selection.option_id === optionId) {
          const maxQuantity = Math.min(quantity, option.max_quantity);
          return {
            ...selection,
            quantity: maxQuantity,
            total_capacity: option.capacity_per_room * maxQuantity,
            total_price: calculateOptionPrice(option, maxQuantity)
          };
        }
        return selection;
      });
    });
  }, [choice.options, calculateOptionPrice]);

  // 선택사항 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    const validationErrors = validateSelections(selections);
    setErrors(validationErrors);
    onSelectionChange(selections);
  }, [selections, validateSelections, onSelectionChange]);

  // 자동 조합 제안 함수
  const suggestOptimalCombination = useCallback(() => {
    const suggestions: AccommodationSelection[] = [];
    let remainingPeople = totalPeople;
    
    // 효율성 순으로 정렬 (인원당 가격이 낮은 순)
    const sortedOptions = [...choice.options].sort((a, b) => {
      const aPricePerPerson = (a.adult_price * adults + a.child_price * children + a.infant_price * infants) / a.capacity_per_room;
      const bPricePerPerson = (b.adult_price * adults + b.child_price * children + b.infant_price * infants) / b.capacity_per_room;
      return aPricePerPerson - bPricePerPerson;
    });
    
    // 가장 효율적인 조합 찾기
    for (const option of sortedOptions) {
      if (remainingPeople <= 0) break;
      
      const neededRooms = Math.ceil(remainingPeople / option.capacity_per_room);
      const actualRooms = Math.min(neededRooms, option.max_quantity);
      
      if (actualRooms > 0) {
        suggestions.push({
          option_id: option.id,
          option,
          quantity: actualRooms,
          total_capacity: option.capacity_per_room * actualRooms,
          total_price: calculateOptionPrice(option, actualRooms)
        });
        
        remainingPeople -= option.capacity_per_room * actualRooms;
      }
    }
    
    setSelections(suggestions);
  }, [choice.options, totalPeople, adults, children, infants, calculateOptionPrice]);

  const totalCapacity = calculateTotalCapacity(selections);
  const totalPrice = calculateTotalPrice(selections);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900">{choice.name_ko}</h3>
        <p className="mt-1 text-sm text-gray-600">{choice.description}</p>
        
        {/* 예약 인원 정보 */}
        <div className="mt-3 bg-blue-50 p-3 rounded-lg">
          <p className="text-sm font-medium text-blue-900">
            예약 인원: 성인 {adults}명, 아동 {children}명, 유아 {infants}명 (총 {totalPeople}명)
          </p>
        </div>
      </div>

      {/* 자동 조합 제안 버튼 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={suggestOptimalCombination}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          최적 조합 자동 선택
        </button>
      </div>

      {/* 숙박 옵션 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {choice.options.map((option) => {
          const isSelected = selections.some(s => s.option_id === option.id);
          const selection = selections.find(s => s.option_id === option.id);
          
          return (
            <div
              key={option.id}
              className={`border rounded-lg p-4 transition-all ${
                isSelected 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* 옵션 헤더 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleOptionToggle(option)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-900">
                      {option.name_ko}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {option.capacity_per_room}인용 객실
                    </p>
                  </div>
                </div>
                
                {/* 가격 정보 */}
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    성인 {option.adult_price.toLocaleString()}원
                  </p>
                  <p className="text-xs text-gray-500">
                    아동 {option.child_price.toLocaleString()}원
                  </p>
                </div>
              </div>

              {/* 수량 선택 (선택된 경우에만 표시) */}
              {isSelected && selection && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      수량
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(option.id, selection.quantity - 1)}
                        disabled={selection.quantity <= 1}
                        className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-50"
                      >
                        <span className="text-lg font-bold">−</span>
                      </button>
                      
                      <input
                        type="number"
                        min="1"
                        max={option.max_quantity}
                        value={selection.quantity}
                        onChange={(e) => handleQuantityChange(option.id, parseInt(e.target.value) || 1)}
                        className="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(option.id, selection.quantity + 1)}
                        disabled={selection.quantity >= option.max_quantity}
                        className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-50"
                      >
                        <span className="text-lg font-bold">+</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* 선택된 옵션 요약 */}
                  <div className="mt-2 text-sm text-gray-600">
                    <p>총 수용 인원: {selection.total_capacity}명</p>
                    <p>총 가격: {selection.total_price.toLocaleString()}원</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 선택 요약 */}
      {selections.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">선택 요약</h4>
          <div className="space-y-1">
            {selections.map((selection) => (
              <div key={selection.option_id} className="flex justify-between text-sm">
                <span>{selection.option.name_ko} × {selection.quantity}</span>
                <span>{selection.total_price.toLocaleString()}원</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="flex justify-between text-sm font-medium">
              <span>총 수용 인원: {totalCapacity}명</span>
              <span>총 가격: {totalPrice.toLocaleString()}원</span>
            </div>
          </div>
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
    </div>
  );
}
