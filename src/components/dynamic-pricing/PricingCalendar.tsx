import React, { memo, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, DollarSign, ChevronDown } from 'lucide-react';
import { SimplePricingRule } from '@/lib/types/dynamic-pricing';

interface PricingCalendarProps {
  currentMonth: Date;
  dynamicPricingData: Array<{
    date: string;
    rules: SimplePricingRule[];
  }>;
  selectedDates: string[];
  onMonthChange: (month: Date) => void;
  onDateSelect: (date: string) => void;
  onDateRangeSelect: (startIndex: number, endIndex: number) => void;
  choiceCombinations?: Array<{
    id: string;
    combination_name: string;
    combination_name_ko?: string;
    adult_price: number;
    child_price: number;
    infant_price: number;
  }>;
  selectedChannelId?: string;
  selectedChannelType?: 'OTA' | 'SELF' | '';
}

export const PricingCalendar = memo(function PricingCalendar({
  currentMonth,
  dynamicPricingData,
  selectedDates,
  onMonthChange,
  onDateSelect,
  onDateRangeSelect,
  choiceCombinations = [],
  selectedChannelId,
  selectedChannelType
}: PricingCalendarProps) {
  const [selectedChoice, setSelectedChoice] = useState<string>('');

  // 초이스별 가격 계산 함수
  const calculateChoicePrice = (basePrice: number, markupAmount: number, markupPercent: number, couponPercent: number, commissionPercent: number) => {
    // 최대 판매가 (기본 가격 + 마크업)
    const markupPrice = basePrice + markupAmount + (basePrice * markupPercent / 100);
    
    // 할인 가격 (최대 판매가 × 쿠폰 할인)
    const discountPrice = markupPrice * (1 - couponPercent / 100);
    
    // Net Price (할인 가격 - 수수료)
    const netPrice = discountPrice - (discountPrice * commissionPercent / 100);
    
    return {
      markupPrice: Math.round(markupPrice * 100) / 100,
      discountPrice: Math.round(discountPrice * 100) / 100,
      netPrice: Math.round(netPrice * 100) / 100
    };
  };

  // 선택된 초이스의 가격 정보 가져오기
  const getChoicePriceForDate = (date: string) => {
    if (!selectedChoice) return null;
    
    console.log(`=== Processing date ${date} ===`);
    console.log(`Selected choice: ${selectedChoice}`);
    console.log(`Selected channel ID: ${selectedChannelId}`);
    console.log(`Selected channel type: ${selectedChannelType}`);
    
    const dayData = dynamicPricingData.find(d => d.date === date);
    if (!dayData || dayData.rules.length === 0) {
      console.log(`No data found for date ${date}`);
      return null;
    }
    
    console.log(`Found day data for ${date}:`, dayData);
    
    // 선택된 채널의 규칙 찾기
    let rule: SimplePricingRule | undefined;
    
    if (selectedChannelId) {
      // 특정 채널이 선택된 경우
      rule = dayData.rules.find(r => r.channel_id === selectedChannelId);
      console.log(`Looking for channel ${selectedChannelId} on ${date}:`, rule);
    } else if (selectedChannelType === 'SELF') {
      // 자체 채널 타입이 선택된 경우, 첫 번째 자체 채널 규칙 사용
      rule = dayData.rules.find(r => {
        // 자체 채널인지 확인 (type이 'self' 또는 'partner'인 경우)
        const channelType = r.channel_id?.startsWith('B') ? 'SELF' : 'OTA';
        return channelType === 'SELF';
      });
      console.log(`Looking for SELF channel on ${date}:`, rule);
    }
    
    if (!rule) {
      console.log(`No rule found for date ${date}`);
      return null;
    }
    
    // choices_pricing에서 선택된 초이스의 가격 정보 가져오기
    let choicePricing: any = null;
    
    if (rule.choices_pricing) {
      // 중첩된 구조에서 선택된 초이스 찾기
      const choicesData = typeof rule.choices_pricing === 'string' 
        ? JSON.parse(rule.choices_pricing) 
        : rule.choices_pricing;
      
      console.log(`Choices data for ${date}:`, choicesData);
      console.log(`Looking for choice: ${selectedChoice}`);
      
      // canyon_choice.options에서 선택된 초이스 찾기
      if (choicesData.canyon_choice?.options) {
        choicePricing = choicesData.canyon_choice.options[selectedChoice];
        console.log(`Found in canyon_choice.options:`, choicePricing);
      }
      
      // 직접적인 구조도 확인
      if (!choicePricing && choicesData[selectedChoice]) {
        choicePricing = choicesData[selectedChoice];
        console.log(`Found in direct structure:`, choicePricing);
      }
    }
    
    if (!choicePricing) {
      console.log(`No choice pricing found for ${selectedChoice} on ${date}`);
      return null;
    }
    
    const calculatedPrice = calculateChoicePrice(
      choicePricing.adult_price,
      rule.markup_amount || 0,
      rule.markup_percent || 0,
      rule.coupon_percent || 0,
      rule.commission_percent || 0
    );
    
    console.log(`Calculated price for ${selectedChoice} on ${date}:`, calculatedPrice);
    return calculatedPrice;
  };
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);

  const getDateString = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  const getPricingForDate = (dateString: string) => {
    const dayData = dynamicPricingData.find(d => d.date === dateString);
    return dayData?.rules || [];
  };

  const isDateSelected = (dateString: string) => {
    return selectedDates.includes(dateString);
  };

  const handleDateClick = (day: number) => {
    const dateString = getDateString(day);
    onDateSelect(dateString);
  };

  const handleDateMouseDown = (day: number, index: number) => {
    const dateString = getDateString(day);
    // 범위 선택 로직은 부모 컴포넌트에서 처리
  };

  const renderDayCell = (day: number) => {
    const dateString = getDateString(day);
    const pricingRules = getPricingForDate(dateString);
    const isSelected = isDateSelected(dateString);
    const isToday = new Date().toDateString() === new Date(dateString).toDateString();
    const choicePrice = getChoicePriceForDate(dateString);

    return (
      <button
        key={day}
        onClick={() => handleDateClick(day)}
        onMouseDown={() => handleDateMouseDown(day, 0)}
        className={`relative p-2 h-20 border border-gray-200 hover:bg-gray-50 transition-colors ${
          isSelected ? 'bg-blue-100 border-blue-300' : ''
        } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
      >
        <div className="text-sm font-medium text-gray-900">{day}</div>
        
        {/* 초이스별 가격 표시 */}
        {selectedChoice && choicePrice && (
          <div className="absolute bottom-1 left-1 text-xs">
            <div className="text-green-600 font-semibold">${choicePrice.markupPrice}</div>
            <div className="text-blue-600">${choicePrice.discountPrice}</div>
            <div className="text-purple-600">${choicePrice.netPrice}</div>
          </div>
        )}
        
        {/* 기존 가격 표시 아이콘 */}
        {pricingRules.length > 0 && !selectedChoice && (
          <div className="absolute bottom-1 right-1">
            <DollarSign className="h-3 w-3 text-green-600" />
          </div>
        )}
        {pricingRules.length > 1 && !selectedChoice && (
          <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {pricingRules.length}
          </div>
        )}
      </button>
    );
  };

  const renderEmptyCells = () => {
    return Array.from({ length: startingDayOfWeek }, (_, index) => (
      <div key={`empty-${index}`} className="p-2 h-20 border border-gray-200 bg-gray-50"></div>
    ));
  };

  const renderDays = () => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return renderDayCell(day);
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 초이스 선택 드롭다운 */}
      {choiceCombinations.length > 0 && (selectedChannelId || selectedChannelType) && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">초이스 선택:</label>
            <div className="relative">
              <select
                value={selectedChoice}
                onChange={(e) => setSelectedChoice(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">초이스를 선택하세요</option>
                {choiceCombinations.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.combination_name_ko || choice.combination_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          
          {/* 가격 범례 */}
          {selectedChoice && (
            <div className="mt-3 flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-600 rounded"></div>
                <span className="text-gray-600">최대 판매가</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-600 rounded"></div>
                <span className="text-gray-600">할인 가격</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-purple-600 rounded"></div>
                <span className="text-gray-600">Net Price</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
          </h3>
        </div>
        
        <button
          onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7">
        {renderEmptyCells()}
        {renderDays()}
      </div>

      {/* 범례 */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <DollarSign className="h-3 w-3 text-green-600" />
            <span>가격 설정됨</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
              2
            </div>
            <span>다중 규칙</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>선택된 날짜</span>
          </div>
        </div>
      </div>
    </div>
  );
});
