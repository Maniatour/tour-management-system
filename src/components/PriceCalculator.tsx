'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  DollarSign, 
  Calendar, 
  Package, 
  Settings,
  Users,
  TrendingUp,
  Info
} from 'lucide-react';
import { 
  CalculatePriceDto, 
  PriceCalculationResult,
  DynamicPricingRule,
  DAY_NAMES,
  DAY_COLORS
} from '@/lib/types/dynamic-pricing';

interface PriceCalculatorProps {
  productId: string;
  onPriceCalculated?: (result: PriceCalculationResult) => void;
}

export default function PriceCalculator({ 
  productId, 
  onPriceCalculated 
}: PriceCalculatorProps) {
  const [calculationInput, setCalculationInput] = useState<CalculatePriceDto>({
    product_id: productId,
    channel_id: '',
    tour_date: '',
    adults: 0,
    children: 0,
    infants: 0,
    option_ids: []
  });

  const [calculationResult, setCalculationResult] = useState<PriceCalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  // 채널 목록 (실제로는 API에서 가져와야 함)
  const [channels] = useState([
    { id: '1', name: '직접 방문' },
    { id: '2', name: '네이버 여행' },
    { id: '3', name: '카카오 여행' },
    { id: '4', name: '마이리얼트립' },
    { id: '5', name: '제휴 호텔' }
  ]);

  // 옵션 목록 (실제로는 API에서 가져와야 함)
  const [options] = useState([
    { id: '1', name: '호텔 픽업', category: '교통수단', base_price: 25 },
    { id: '2', name: '점심 도시락', category: '식사', base_price: 15 },
    { id: '3', name: '카시트', category: '장비', base_price: 10 }
  ]);

  // 상품 정보 (실제로는 API에서 가져와야 함)
  const [product] = useState({
    id: productId,
    name: '그랜드 캐니언 투어',
    base_price: 200,
    min_participants: 2,
    max_participants: 20
  });

  // 가격 계산 실행
  const handleCalculatePrice = async () => {
    try {
      setIsCalculating(true);

      // 유효성 검사
      if (!calculationInput.channel_id || !calculationInput.tour_date) {
        alert('채널과 날짜를 선택해주세요.');
        return;
      }

      if (calculationInput.adults + calculationInput.children + calculationInput.infants === 0) {
        alert('최소 1명 이상의 참가자를 선택해주세요.');
        return;
      }

      // 실제로는 API 호출하여 가격 계산
      // 여기서는 시뮬레이션된 계산 결과를 반환
      await simulatePriceCalculation();
      
    } catch (error) {
      console.error('가격 계산 실패:', error);
      alert('가격 계산에 실패했습니다.');
    } finally {
      setIsCalculating(false);
    }
  };

  // 가격 계산 시뮬레이션 (실제로는 API 호출)
  const simulatePriceCalculation = async () => {
    // 실제 구현에서는 calculate_reservation_price 함수를 호출
    const tourDate = new Date(calculationInput.tour_date);
    const dayOfWeek = tourDate.getDay();
    
    // 시뮬레이션된 가격 규칙
    const simulatedRule: DynamicPricingRule = {
      id: 'simulated-rule',
      product_id: productId,
      channel_id: calculationInput.channel_id,
      rule_name: '시뮬레이션 규칙',
      start_date: calculationInput.tour_date,
      end_date: calculationInput.tour_date,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 요일별 가격 (시뮬레이션)
    const weekdayMultiplier = dayOfWeek === 0 ? 1.1 : dayOfWeek === 6 ? 1.2 : 1.0; // 일요일 10% 증가, 토요일 20% 증가
    
    // 채널별 가격 조정 (시뮬레이션)
    const channelMultiplier = calculationInput.channel_id === '1' ? 1.0 : 1.15; // 직접방문 외 15% 증가
    
    const baseAdultPrice = product.base_price * weekdayMultiplier * channelMultiplier;
    const baseChildPrice = baseAdultPrice * 0.8;
    const baseInfantPrice = baseAdultPrice * 0.5;

    // 옵션 가격 계산
    let optionAdultPrice = 0;
    let optionChildPrice = 0;
    let optionInfantPrice = 0;

    selectedOptions.forEach(optionId => {
      const option = options.find(opt => opt.id === optionId);
      if (option) {
        optionAdultPrice += option.base_price;
        optionChildPrice += option.base_price * 0.8;
        optionInfantPrice += option.base_price * 0.5;
      }
    });

    // 최종 가격 계산
    const totalAdultPrice = baseAdultPrice + optionAdultPrice;
    const totalChildPrice = baseChildPrice + optionChildPrice;
    const totalInfantPrice = baseInfantPrice + optionInfantPrice;

    const totalPrice = 
      totalAdultPrice * calculationInput.adults +
      totalChildPrice * calculationInput.children +
      totalInfantPrice * calculationInput.infants;

    const result: PriceCalculationResult = {
      adult_price: totalAdultPrice,
      child_price: totalChildPrice,
      infant_price: totalInfantPrice,
      total_price: totalPrice,
      pricing_rule_id: simulatedRule.id,
      applied_rule: simulatedRule
    };

    setCalculationResult(result);
    onPriceCalculated?.(result);
  };

  // 옵션 선택/해제
  const handleOptionToggle = (optionId: string) => {
    setSelectedOptions(prev => 
      prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  // 참가자 수 변경
  const handleParticipantChange = (type: 'adults' | 'children' | 'infants', value: number) => {
    setCalculationInput(prev => ({
      ...prev,
      [type]: Math.max(0, value)
    }));
  };

  // 총 참가자 수 계산
  const totalParticipants = calculationInput.adults + calculationInput.children + calculationInput.infants;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center space-x-3">
        <Calculator className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">가격 계산기</h2>
      </div>

      {/* 계산 입력 폼 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">예약 정보 입력</h3>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* 채널 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              판매 채널 *
            </label>
            <select
              value={calculationInput.channel_id}
              onChange={(e) => setCalculationInput(prev => ({ ...prev, channel_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">채널을 선택하세요</option>
              {channels.map(channel => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </div>

          {/* 투어 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              투어 날짜 *
            </label>
            <input
              type="date"
              value={calculationInput.tour_date}
              onChange={(e) => setCalculationInput(prev => ({ ...prev, tour_date: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 참가자 수 설정 */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 text-green-600 mr-2" />
            참가자 수
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">성인</label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleParticipantChange('adults', calculationInput.adults - 1)}
                  disabled={calculationInput.adults <= 0}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                >
                  -
                </button>
                <input
                  type="number"
                  value={calculationInput.adults}
                  onChange={(e) => handleParticipantChange('adults', parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-16 text-center px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => handleParticipantChange('adults', calculationInput.adults + 1)}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">아동 (8-12세)</label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleParticipantChange('children', calculationInput.children - 1)}
                  disabled={calculationInput.children <= 0}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                >
                  -
                </button>
                <input
                  type="number"
                  value={calculationInput.children}
                  onChange={(e) => handleParticipantChange('children', parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-16 text-center px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => handleParticipantChange('children', calculationInput.children + 1)}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">유아 (0-7세)</label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleParticipantChange('infants', calculationInput.infants - 1)}
                  disabled={calculationInput.infants <= 0}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                >
                  -
                </button>
                <input
                  type="number"
                  value={calculationInput.infants}
                  onChange={(e) => handleParticipantChange('infants', parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-16 text-center px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => handleParticipantChange('infants', calculationInput.infants + 1)}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 총 참가자 수 */}
          <div className="col-span-3 mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              총 참가자: <span className="font-semibold">{totalParticipants}명</span>
              {totalParticipants < product.min_participants && (
                <span className="text-red-600 ml-2">
                  (최소 {product.min_participants}명 필요)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* 옵션 선택 */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-4 flex items-center">
            <Settings className="h-5 w-5 text-purple-600 mr-2" />
            추가 옵션 선택
          </h4>
          <div className="grid grid-cols-3 gap-4">
            {options.map(option => (
              <div key={option.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option.id)}
                  onChange={() => handleOptionToggle(option.id)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <div>
                  <p className="font-medium text-gray-900">{option.name}</p>
                  <p className="text-sm text-gray-600">{option.category}</p>
                  <p className="text-sm text-purple-600">${option.base_price}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 가격 계산 버튼 */}
        <div className="flex justify-center">
          <button
            onClick={handleCalculatePrice}
            disabled={isCalculating || !calculationInput.channel_id || !calculationInput.tour_date || totalParticipants === 0}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Calculator size={20} />
            <span>{isCalculating ? '계산 중...' : '가격 계산하기'}</span>
          </button>
        </div>
      </div>

      {/* 계산 결과 */}
      {calculationResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
            계산 결과
          </h3>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* 개별 가격 */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">1인당 가격</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>성인:</span>
                  <span className="font-medium text-green-600">${calculationResult.adult_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>아동:</span>
                  <span className="font-medium text-blue-600">${calculationResult.child_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>유아:</span>
                  <span className="font-medium text-purple-600">${calculationResult.infant_price.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* 총 가격 */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">총 가격</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>성인 ({calculationInput.adults}명):</span>
                  <span className="font-medium">${(calculationResult.adult_price * calculationInput.adults).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>아동 ({calculationInput.children}명):</span>
                  <span className="font-medium">${(calculationResult.child_price * calculationInput.children).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>유아 ({calculationInput.infants}명):</span>
                  <span className="font-medium">${(calculationResult.infant_price * calculationInput.infants).toFixed(2)}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>총 합계:</span>
                  <span className="text-green-600">${calculationResult.total_price.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 적용된 규칙 정보 */}
          {calculationResult.applied_rule && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                <Info className="h-4 w-4 mr-2" />
                적용된 가격 규칙
              </h4>
              <p className="text-sm text-blue-800">
                {channels.find(c => c.id === calculationInput.channel_id)?.name} • 
                {calculationInput.tour_date} • 
                {DAY_NAMES[new Date(calculationInput.tour_date).getDay()]}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
