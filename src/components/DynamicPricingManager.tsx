'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Calendar,
  List
} from 'lucide-react';
import { SimplePricingRuleDto, SimplePricingRule, DateRangeSelection } from '@/lib/types/dynamic-pricing';

// 커스텀 훅들
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { useChannelManagement } from '@/hooks/useChannelManagement';
import { useChoiceManagement } from '@/hooks/useChoiceManagement';
import { usePricingData } from '@/hooks/usePricingData';
import { usePriceCalculation } from '@/hooks/usePriceCalculation';

// UI 컴포넌트들
import { ChannelSelector } from './dynamic-pricing/ChannelSelector';
import { PricingCalendar } from './dynamic-pricing/PricingCalendar';
import { PricingListView } from './dynamic-pricing/PricingListView';
import { PricingControls } from './dynamic-pricing/PricingControls';
import { DateRangeSelector } from './dynamic-pricing/DateRangeSelector';
import { PriceCalculator } from './dynamic-pricing/PriceCalculator';
import { SaleStatusModal } from './dynamic-pricing/SaleStatusModal';

// 기존 컴포넌트들 (필요시 사용)
// import ChangeHistory from './ChangeHistory';
// import AvailabilityModal from './AvailabilityModal';

interface DynamicPricingManagerProps {
  productId: string;
  onSave?: (rule: SimplePricingRule) => void;
  isNewProduct?: boolean;
}

export default function DynamicPricingManager({ 
  productId, 
  onSave
}: DynamicPricingManagerProps) {
  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // 날짜 선택 상태
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [dateRangeSelection, setDateRangeSelection] = useState<DateRangeSelection | null>(null);
  
  // 판매 상태 모달 상태
  const [isSaleStatusModalOpen, setIsSaleStatusModalOpen] = useState(false);

  // 커스텀 훅들
  const {
    channelGroups,
    isLoadingChannels,
    selectedChannelType,
    selectedChannel,
    isMultiChannelMode,
    selectedChannels,
    handleChannelTypeSelect,
    handleChannelSelect,
    handleMultiChannelToggle,
    handleChannelToggle,
    handleSelectAllChannelsInType
  } = useChannelManagement();

  console.log('DynamicPricingManager: selectedChannel', selectedChannel);
  console.log('DynamicPricingManager: selectedChannelType', selectedChannelType);

  const {
    saving,
    saveMessage,
    dynamicPricingData,
    loadDynamicPricingData,
    savePricingRule,
    deletePricingRule,
    setMessage
  } = useDynamicPricing({ 
    productId, 
    selectedChannelId: selectedChannel,
    selectedChannelType: selectedChannelType,
    onSave: onSave || (() => {}) 
  });

  const {
    choiceCombinations,
    updateChoiceCombinationPrice
  } = useChoiceManagement(productId, selectedChannel, selectedChannelType);

  const {
    pricingConfig,
    updatePricingConfig
  } = usePricingData(productId, selectedChannel, selectedChannelType);

  const {
    pricingConfig: calculationConfig,
    updatePricingConfig: updateCalculationConfig,
    updateChoicePricing,
    calculateChoicePrice,
    currentCalculation,
    choiceCalculations
  } = usePriceCalculation();

  // 날짜 범위 선택 핸들러
  const handleDateRangeSelection = useCallback((selection: DateRangeSelection) => {
    setDateRangeSelection(selection);
    
    // 선택된 날짜 범위와 요일을 기반으로 실제 날짜들 생성
    const dates: string[] = [];
    const startDate = new Date(selection.startDate);
    const endDate = new Date(selection.endDate);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      if (selection.selectedDays.includes(dayOfWeek)) {
        dates.push(date.toISOString().split('T')[0]);
      }
    }
    
    setSelectedDates(dates);
  }, []);

  // 단일 날짜 선택 핸들러
  const handleDateSelect = useCallback((date: string) => {
    setSelectedDates([date]);
  }, []);

  // 날짜 범위 선택 핸들러 (기존 캘린더용)
  const handleDateRangeSelect = useCallback((startIndex: number, endIndex: number) => {
    const dates: string[] = [];
    for (let i = Math.min(startIndex, endIndex); i <= Math.max(startIndex, endIndex); i++) {
      const day = i - 6 + 1; // 요일 오프셋 계산
      if (day > 0 && day <= new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()) {
        const dateString = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        dates.push(dateString);
      }
    }
    setSelectedDates(dates);
  }, [currentMonth]);


  // 기본 가격 설정 업데이트 핸들러
  const handlePricingConfigUpdate = useCallback((updates: any) => {
    // 기존 가격 설정 업데이트
    updatePricingConfig(updates);
    
    // 실시간 계산을 위한 가격 설정 업데이트
    updateCalculationConfig({
      adult_price: updates.adult_price ?? pricingConfig.adult_price,
      child_price: updates.child_price ?? pricingConfig.child_price,
      infant_price: updates.infant_price ?? pricingConfig.infant_price,
      commission_percent: updates.commission_percent ?? pricingConfig.commission_percent,
      markup_amount: updates.markup_amount ?? pricingConfig.markup_amount,
      markup_percent: updates.markup_percent ?? (pricingConfig as any).markup_percent,
      coupon_percent: updates.coupon_percent ?? pricingConfig.coupon_percent,
      is_sale_available: updates.is_sale_available ?? pricingConfig.is_sale_available,
      not_included_price: updates.not_included_price ?? (pricingConfig as any).not_included_price
    });
  }, [pricingConfig, updatePricingConfig, updateCalculationConfig]);

  // 초이스별 가격 업데이트 핸들러
  const handleChoicePriceUpdate = useCallback((
    combinationId: string, 
    priceType: 'adult_price' | 'child_price' | 'infant_price', 
    value: number
  ) => {
    // 기존 초이스 조합 업데이트
    updateChoiceCombinationPrice(combinationId, priceType, value);
    
    // 실시간 계산을 위한 가격 설정 업데이트
    const combination = choiceCombinations.find(c => c.id === combinationId);
    if (combination) {
      const updatedPricing = {
        ...combination,
        [priceType]: value
      };
      
      updateChoicePricing(combinationId, {
        choiceId: combinationId,
        choiceName: combination.combination_name,
        adult_price: updatedPricing.adult_price || 0,
        child_price: updatedPricing.child_price || 0,
        infant_price: updatedPricing.infant_price || 0
      });
    }
  }, [choiceCombinations, updateChoiceCombinationPrice, updateChoicePricing]);

  // 초이스 조합이 로드되면 초기 가격 설정
  useEffect(() => {
    if (choiceCombinations.length > 0) {
      choiceCombinations.forEach(combination => {
        updateChoicePricing(combination.id, {
          choiceId: combination.id,
          choiceName: combination.combination_name,
          adult_price: combination.adult_price || 0,
          child_price: combination.child_price || 0,
          infant_price: combination.infant_price || 0
        });
      });
    }
  }, [choiceCombinations, updateChoicePricing]);

  // 기본 가격 설정이 변경되면 calculationConfig도 업데이트
  useEffect(() => {
    updateCalculationConfig({
      adult_price: pricingConfig.adult_price,
      child_price: pricingConfig.child_price,
      infant_price: pricingConfig.infant_price,
      commission_percent: pricingConfig.commission_percent,
      markup_amount: pricingConfig.markup_amount,
      markup_percent: (pricingConfig as any).markup_percent || 0,
      coupon_percent: pricingConfig.coupon_percent,
      is_sale_available: pricingConfig.is_sale_available,
      not_included_price: (pricingConfig as any).not_included_price || 0
    });
  }, [pricingConfig, updateCalculationConfig]);

  // 월 변경 핸들러
  const handleMonthChange = useCallback((month: Date) => {
    setCurrentMonth(month);
    setSelectedDates([]);
  }, []);

  // 판매 상태 모달 핸들러
  const handleOpenSaleStatusModal = useCallback(() => {
    setIsSaleStatusModalOpen(true);
  }, []);

  const handleCloseSaleStatusModal = useCallback(() => {
    setIsSaleStatusModalOpen(false);
  }, []);

  const handleSaveSaleStatus = useCallback(async (dates: Date[], status: 'sale' | 'closed') => {
    if (dates.length === 0) {
      return;
    }

    let channelIds: string[] = [];
    
    if (status === 'closed') {
      // 마감 처리 시: 모든 채널 처리
      channelIds = channelGroups.flatMap(group => group.channels.map(channel => channel.id));
    } else {
      // 판매중 처리 시: 선택된 채널만 처리
      if (selectedChannelType === 'SELF') {
        // 자체 채널 타입 선택: 해당 타입의 모든 채널 사용
        const currentGroup = channelGroups.find(group => group.type === 'SELF');
        if (currentGroup) {
          channelIds = currentGroup.channels.map(channel => channel.id);
        }
      } else if (selectedChannel) {
        // 개별 OTA 채널 선택: 해당 채널만 사용
        channelIds = [selectedChannel];
      }
    }
    
    if (channelIds.length === 0) {
      return;
    }

    try {
      // 각 날짜와 채널에 대해 판매 상태 저장
      for (const channelId of channelIds) {
        for (const date of dates) {
          const ruleData: SimplePricingRuleDto = {
            product_id: productId,
            channel_id: channelId,
            date: date.toISOString().split('T')[0],
            adult_price: 0,
            child_price: 0,
            infant_price: 0,
            commission_percent: 0,
            markup_amount: 0,
            coupon_percent: 0,
            is_sale_available: status === 'sale',
            not_included_price: 0,
            markup_percent: 0,
            choices_pricing: {}
          };

          await savePricingRule(ruleData, false); // 개별 메시지 표시 안함
        }
      }

      // 성공 메시지 표시
      setMessage(`${dates.length}개 날짜의 판매 상태가 ${status === 'sale' ? '판매중' : '마감'}으로 저장되었습니다.`);
      
      // 데이터 새로고침
      await loadDynamicPricingData();
    } catch (error) {
      console.error('판매 상태 저장 실패:', error);
      setMessage('판매 상태 저장에 실패했습니다.');
    }
  }, [selectedChannelType, selectedChannel, channelGroups, productId, savePricingRule, setMessage, loadDynamicPricingData]);

  // 가격 규칙 저장 핸들러
  const handleSavePricingRule = useCallback(async () => {
    if (selectedDates.length === 0 || (!selectedChannelType && !selectedChannel)) {
      return;
    }

    let channelIds: string[] = [];
    
    if (selectedChannelType === 'SELF') {
      // 자체 채널 타입 선택: 해당 타입의 모든 채널 사용
      const currentGroup = channelGroups.find(group => group.type === 'SELF');
      if (currentGroup) {
        channelIds = currentGroup.channels.map(channel => channel.id);
      }
    } else if (selectedChannel) {
      // 개별 OTA 채널 선택: 해당 채널만 사용
      channelIds = [selectedChannel];
    }
    
    if (channelIds.length === 0) {
      return;
    }

    // 전체 저장 시작
    const totalRules = channelIds.length * selectedDates.length;
    let savedCount = 0;

    for (const channelId of channelIds) {
      for (const date of selectedDates) {
        const ruleData: SimplePricingRuleDto = {
          product_id: productId,
          channel_id: channelId,
          date,
          adult_price: pricingConfig.adult_price,
          child_price: pricingConfig.child_price,
          infant_price: pricingConfig.infant_price,
          commission_percent: pricingConfig.commission_percent,
          markup_amount: pricingConfig.markup_amount,
          coupon_percent: pricingConfig.coupon_percent,
          is_sale_available: pricingConfig.is_sale_available,
          not_included_price: (pricingConfig as any).not_included_price || 0,
          markup_percent: (pricingConfig as any).markup_percent || 0,
          choices_pricing: Object.keys(calculationConfig.choicePricing).length > 0 
            ? {
                canyon_choice: {
                  name: "Canyon Choice",
                  name_ko: "캐년 선택",
                  options: Object.fromEntries(
                    Object.entries(calculationConfig.choicePricing).map(([choiceId, choice]) => [
                      choiceId.replace('canyon_choice_', ''), // canyon_choice_ 접두사 제거
                      {
                        name: choiceId.includes('antelope_x') ? "Antelope X Canyon" : "Lower Antelope Canyon",
                        name_ko: choiceId.includes('antelope_x') ? "앤텔로프 X 캐년" : "로어 앤텔로프 캐년",
                        adult_price: choice.adult_price,
                        child_price: choice.child_price,
                        infant_price: choice.infant_price
                      }
                    ])
                  )
                }
              }
            : {} as Record<string, { adult_price: number; child_price: number; infant_price: number; }>
        };

        try {
          await savePricingRule(ruleData, false); // 개별 메시지 표시 안함
          savedCount++;
        } catch (error) {
          console.error('가격 규칙 저장 실패:', error);
          // 개별 저장 실패 시 전체 중단하지 않고 계속 진행
        }
      }
    }

    // 전체 저장 완료 후 메시지 표시
    if (savedCount === totalRules) {
      setMessage(`전체 ${totalRules}개 가격 규칙이 성공적으로 저장되었습니다.`);
    } else {
      setMessage(`${savedCount}/${totalRules}개 가격 규칙이 저장되었습니다.`);
    }
  }, [selectedDates, selectedChannelType, selectedChannel, channelGroups, pricingConfig, calculationConfig, productId, savePricingRule, setMessage]);

  // 규칙 편집 핸들러
  const handleEditRule = useCallback((rule: SimplePricingRule) => {
    updatePricingConfig({
      adult_price: rule.adult_price,
      child_price: rule.child_price,
      infant_price: rule.infant_price,
      commission_percent: rule.commission_percent,
      markup_amount: rule.markup_amount,
      coupon_percent: rule.coupon_percent,
      is_sale_available: rule.is_sale_available
    });
    
    setSelectedDates([rule.date]);
    handleChannelSelect(rule.channel_id);
  }, [updatePricingConfig, handleChannelSelect]);

  // 규칙 삭제 핸들러
  const handleDeleteRule = useCallback((ruleId: string) => {
    if (confirm('이 가격 규칙을 삭제하시겠습니까?')) {
      deletePricingRule(ruleId);
    }
  }, [deletePricingRule]);

  // 저장 가능 여부 계산
  const canSave = useMemo(() => {
    const hasSelectedDates = selectedDates.length > 0;
    const hasSelectedChannels = Boolean(selectedChannelType) || Boolean(selectedChannel);
    
    // 기본 가격 또는 초이스별 가격이 있는지 확인
    const hasValidPrices = pricingConfig.adult_price > 0 || pricingConfig.child_price > 0 || pricingConfig.infant_price > 0;
    const hasChoicePrices = choiceCombinations.some(choice => 
      choice.adult_price > 0 || choice.child_price > 0 || choice.infant_price > 0
    );
    
    const canSaveResult = hasSelectedDates && hasSelectedChannels && (hasValidPrices || hasChoicePrices);
    
    console.log('canSave 계산:', {
      hasSelectedDates,
      hasSelectedChannels,
      hasValidPrices,
      hasChoicePrices,
      selectedDates: selectedDates.length,
      selectedChannelType,
      selectedChannel,
      pricingConfig: {
        adult_price: pricingConfig.adult_price,
        child_price: pricingConfig.child_price,
        infant_price: pricingConfig.infant_price
      },
      choiceCombinations: choiceCombinations.length,
      canSaveResult
    });
    
    return canSaveResult;
  }, [selectedDates, selectedChannelType, selectedChannel, pricingConfig, choiceCombinations]);

  // 현재 월의 데이터 필터링
  const currentMonthData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    
    return dynamicPricingData.filter(({ date }) => {
      const dateObj = new Date(date);
      return dateObj.getFullYear() === year && dateObj.getMonth() + 1 === month;
    });
  }, [dynamicPricingData, currentMonth]);

  return (
    <div className="space-y-6">
      {/* 4열 그리드 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1열: 채널 선택 (2/12) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">채널 선택</h3>
          <ChannelSelector
            channelGroups={channelGroups}
            isLoadingChannels={isLoadingChannels}
            selectedChannelType={selectedChannelType}
            selectedChannel={selectedChannel}
            isMultiChannelMode={isMultiChannelMode}
            selectedChannels={selectedChannels}
            onChannelTypeSelect={handleChannelTypeSelect}
            onChannelSelect={handleChannelSelect}
            onMultiChannelToggle={handleMultiChannelToggle}
            onChannelToggle={handleChannelToggle}
            onSelectAllChannelsInType={handleSelectAllChannelsInType}
          />
             </div>

        {/* 2열: 캘린더 (4/12) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">날짜 선택</h3>
            {/* 뷰 모드 토글 및 판매 상태 설정 버튼 */}
            <div className="flex items-center space-x-2">
          <button
                onClick={handleOpenSaleStatusModal}
                className="flex items-center space-x-2 px-3 py-2 rounded-md bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
          >
                <Calendar className="h-4 w-4" />
                <span>판매 상태 설정</span>
          </button>
          <button
                 onClick={() => setViewMode('calendar')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                   viewMode === 'calendar'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                 }`}
               >
                <Calendar className="h-4 w-4" />
                <span>캘린더</span>
               </button>
               <button
                 onClick={() => setViewMode('list')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                   viewMode === 'list'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                 }`}
               >
                <List className="h-4 w-4" />
                <span>목록</span>
               </button>
           </div>
         </div>

          {/* 기존 캘린더/목록 뷰 */}
          {viewMode === 'calendar' ? (
            <PricingCalendar
              currentMonth={currentMonth}
              dynamicPricingData={currentMonthData}
              selectedDates={selectedDates}
              onMonthChange={handleMonthChange}
              onDateSelect={handleDateSelect}
              onDateRangeSelect={handleDateRangeSelect}
              choiceCombinations={choiceCombinations}
              selectedChannelId={selectedChannel}
              selectedChannelType={selectedChannelType}
            />
          ) : (
            <PricingListView
              dynamicPricingData={dynamicPricingData}
              onEditRule={handleEditRule}
              onDeleteRule={handleDeleteRule}
            />
               )}
             </div>

        {/* 3열: 가격 설정 (3/12) */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">가격 설정</h3>
          
          {/* 날짜 및 요일 선택기 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h4 className="text-md font-semibold text-gray-900 mb-4">날짜 및 요일 선택</h4>
            <DateRangeSelector
              onDateRangeSelect={handleDateRangeSelection}
              initialSelection={dateRangeSelection || { startDate: '', endDate: '', selectedDays: [0, 1, 2, 3, 4, 5, 6] }}
            />
             </div>

          {/* 기본 가격 설정 - 컴팩트 레이아웃 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h4 className="text-md font-semibold text-gray-900 mb-4">기본 가격</h4>
            
             <div className="space-y-4">
              {/* 기본 가격 - 한 줄에 3개 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    성인 가격
                  </label>
                  <input
                    type="number"
                    value={pricingConfig.adult_price}
                    onChange={(e) => handlePricingConfigUpdate({ adult_price: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    아동 가격
                  </label>
                                          <input
                        type="number"
                    value={pricingConfig.child_price}
                    onChange={(e) => handlePricingConfigUpdate({ child_price: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1">
                    유아 가격
                   </label>
                                          <input
                        type="number"
                    value={pricingConfig.infant_price}
                    onChange={(e) => handlePricingConfigUpdate({ infant_price: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                   </div>
                 </div>

              {/* 수수료 및 마크업 - 한 줄에 3개 */}
              <div className="grid grid-cols-3 gap-3">
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1">
                    수수료 (%)
                   </label>
                     <input
                       type="number"
                    value={pricingConfig.commission_percent}
                    onChange={(e) => handlePricingConfigUpdate({ commission_percent: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                       placeholder="0"
                     />
                 </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                    마크업 ($)
                    </label>
                          <input
                            type="number"
                    value={pricingConfig.markup_amount}
                    onChange={(e) => handlePricingConfigUpdate({ markup_amount: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                        </div>
                <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                    마크업 (%)
                        </label>
                          <input
                            type="number"
                    value={(pricingConfig as any).markup_percent || 0}
                    onChange={(e) => handlePricingConfigUpdate({ markup_percent: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                  </div>
               </div>

              {/* 할인 및 불포함 금액 - 한 줄에 2개 */}
              <div className="grid grid-cols-2 gap-3">
                 <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    쿠폰 할인 (%)
                  </label>
                       <input
                         type="number"
                    value={pricingConfig.coupon_percent || 0}
                    onChange={(e) => handlePricingConfigUpdate({ coupon_percent: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                         placeholder="0"
                       />
                   </div>
                   <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    불포함 금액 ($)
                  </label>
                       <input
                         type="number"
                    value={(pricingConfig as any).not_included_price || 0}
                    onChange={(e) => handlePricingConfigUpdate({ not_included_price: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                         placeholder="0"
                       />
                     </div>
                   </div>

              {/* 판매중 체크박스 */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <label className="text-sm font-medium text-gray-700">판매중</label>
                                  <input
                  type="checkbox"
                  checked={pricingConfig.is_sale_available}
                  onChange={(e) => handlePricingConfigUpdate({ is_sale_available: Boolean(e.target.checked) })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                                </div>
                              </div>
                            </div>

          {/* 초이스 가격 패널 - 항상 표시 */}
                            {choiceCombinations.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">초이스별 가격 설정</h4>
              
                              <div className="space-y-3">
                {choiceCombinations.map((combination) => (
                  <div
                    key={combination.id}
                    className="p-3 border border-gray-200 rounded-lg bg-gray-50"
                  >
                                    <div className="mb-3">
                      <h5 className="text-sm font-semibold text-gray-900 mb-1">
                        {combination.combination_name_ko || combination.combination_name}
                                      </h5>
                      <p className="text-xs text-gray-600">
                        {combination.combination_name}
                                        </p>
                                    </div>
                                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          성인 가격
                        </label>
                                          <input
                                            type="number"
                                            value={combination.adult_price}
                          onChange={(e) => handleChoicePriceUpdate(combination.id, 'adult_price', Number(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="0"
                                          />
                        {/* 실시간 계산 결과 표시 */}
                        {choiceCalculations[combination.id] && (
                          <div className="text-xs text-gray-500 mt-1">
                            최종: ${choiceCalculations[combination.id].finalPrice.adult}
                                        </div>
                        )}
                                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          아동 가격
                        </label>
                                          <input
                                            type="number"
                                            value={combination.child_price}
                          onChange={(e) => handleChoicePriceUpdate(combination.id, 'child_price', Number(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="0"
                                          />
                        {/* 실시간 계산 결과 표시 */}
                        {choiceCalculations[combination.id] && (
                          <div className="text-xs text-gray-500 mt-1">
                            최종: ${choiceCalculations[combination.id].finalPrice.child}
                                        </div>
                        )}
                                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          유아 가격
                        </label>
                                          <input
                                            type="number"
                                            value={combination.infant_price}
                          onChange={(e) => handleChoicePriceUpdate(combination.id, 'infant_price', Number(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="0"
                                          />
                        {/* 실시간 계산 결과 표시 */}
                        {choiceCalculations[combination.id] && (
                          <div className="text-xs text-gray-500 mt-1">
                            최종: ${choiceCalculations[combination.id].finalPrice.infant}
                                        </div>
                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                  </div>
                )}

          {/* 저장 컨트롤 */}
          <PricingControls
            saving={saving}
            saveMessage={saveMessage}
            onSave={handleSavePricingRule}
            canSave={canSave}
          />
              </div>

        {/* 4열: 가격 계산기 (3/12) */}
        <div className="lg:col-span-3 space-y-4">
          <PriceCalculator
            calculation={currentCalculation}
            pricingConfig={calculationConfig}
            choiceCalculations={choiceCalculations}
            choiceCombinations={choiceCombinations}
          />

          {/* 선택된 날짜 정보 */}
          {selectedDates.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-900">
                    선택된 날짜 ({selectedDates.length}개)
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    {selectedDates.map(date => new Date(date).toLocaleDateString('ko-KR')).join(', ')}
                  </p>
                </div>
            <button
                  onClick={() => setSelectedDates([])}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  선택 해제
            </button>
          </div>
        </div>
          )}
                  </div>
                </div>

      {/* 판매 상태 설정 모달 */}
      <SaleStatusModal
        isOpen={isSaleStatusModalOpen}
        onClose={handleCloseSaleStatusModal}
        onSave={handleSaveSaleStatus}
        initialDates={selectedDates.map(date => new Date(date))}
        initialStatus="sale"
      />
    </div>
  );
}
