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
  
  // 배치 저장 진행률 상태
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number } | null>(null);

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
    savePricingRulesBatch,
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
  const handlePricingConfigUpdate = useCallback((updates: Record<string, unknown>) => {
    // 기존 가격 설정 업데이트
    updatePricingConfig(updates);
    
    // 실시간 계산을 위한 가격 설정 업데이트
    updateCalculationConfig({
      adult_price: (updates.adult_price as number) ?? pricingConfig.adult_price ?? 0,
      child_price: (updates.child_price as number) ?? pricingConfig.child_price ?? 0,
      infant_price: (updates.infant_price as number) ?? pricingConfig.infant_price ?? 0,
      commission_percent: (updates.commission_percent as number) ?? pricingConfig.commission_percent ?? 0,
      markup_amount: (updates.markup_amount as number) ?? pricingConfig.markup_amount ?? 0,
      markup_percent: (updates.markup_percent as number) ?? ((pricingConfig as Record<string, unknown>).markup_percent as number) ?? 0,
      coupon_percent: (updates.coupon_percent as number) ?? pricingConfig.coupon_percent ?? 0,
      is_sale_available: (updates.is_sale_available as boolean) ?? pricingConfig.is_sale_available ?? true,
      not_included_price: (updates.not_included_price as number) ?? ((pricingConfig as Record<string, unknown>).not_included_price as number) ?? 0,
      inclusions_ko: (updates.inclusions_ko as string) ?? ((pricingConfig as Record<string, unknown>).inclusions_ko as string) ?? '',
      exclusions_ko: (updates.exclusions_ko as string) ?? ((pricingConfig as Record<string, unknown>).exclusions_ko as string) ?? '',
      inclusions_en: (updates.inclusions_en as string) ?? ((pricingConfig as Record<string, unknown>).inclusions_en as string) ?? '',
      exclusions_en: (updates.exclusions_en as string) ?? ((pricingConfig as Record<string, unknown>).exclusions_en as string) ?? ''
    });
  }, [pricingConfig, updatePricingConfig, updateCalculationConfig]);

  // 초이스별 가격 업데이트 핸들러 (새로운 시스템)
  const handleChoicePriceUpdate = useCallback(async (
    combinationId: string, 
    priceType: 'adult_price' | 'child_price' | 'infant_price', 
    value: number
  ) => {
    try {
      // 새로운 가격 구조에 맞게 choices_pricing 업데이트
      const currentPricing = pricingConfig.choices_pricing || {};
      const updatedChoicesPricing = {
        ...currentPricing,
        [combinationId]: {
          ...(currentPricing as unknown as Record<string, Record<string, unknown>>)[combinationId],
          [priceType]: value
        }
      };

      // pricingConfig 업데이트
      updatePricingConfig({
        ...pricingConfig,
        choices_pricing: updatedChoicesPricing
      });

      // 기존 초이스 조합도 업데이트 (호환성 유지)
      updateChoiceCombinationPrice(combinationId, priceType, value);
      
      console.log(`초이스 가격 업데이트: ${combinationId} - ${priceType}: ${value}`);
    } catch (error) {
      console.error('초이스 가격 업데이트 실패:', error);
    }
  }, [pricingConfig, updatePricingConfig, updateChoiceCombinationPrice]);

  // 새로운 가격 구조에 맞게 초이스 가격 데이터 동기화
  useEffect(() => {
    if (pricingConfig.choices_pricing && Object.keys(pricingConfig.choices_pricing).length > 0) {
      console.log('새로운 choices_pricing 데이터 감지됨:', pricingConfig.choices_pricing);
      
      // 새로운 구조: { choiceId: { adult: 50, child: 30, infant: 20 } }
      Object.entries(pricingConfig.choices_pricing).forEach(([choiceId, choiceData]: [string, Record<string, unknown>]) => {
        if (choiceData && typeof choiceData === 'object') {
          updateChoiceCombinationPrice(choiceId, 'adult_price', (choiceData as Record<string, unknown>).adult as number || 0);
          updateChoiceCombinationPrice(choiceId, 'child_price', (choiceData as Record<string, unknown>).child as number || 0);
          updateChoiceCombinationPrice(choiceId, 'infant_price', (choiceData as Record<string, unknown>).infant as number || 0);
        }
      });
    }
  }, [pricingConfig.choices_pricing, updateChoiceCombinationPrice]);

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
      adult_price: pricingConfig.adult_price ?? 0,
      child_price: pricingConfig.child_price ?? 0,
      infant_price: pricingConfig.infant_price ?? 0,
      commission_percent: pricingConfig.commission_percent ?? 0,
      markup_amount: pricingConfig.markup_amount ?? 0,
      markup_percent: ((pricingConfig as Record<string, unknown>).markup_percent as number) ?? 0,
      coupon_percent: pricingConfig.coupon_percent ?? 0,
      is_sale_available: pricingConfig.is_sale_available ?? true,
      not_included_price: ((pricingConfig as Record<string, unknown>).not_included_price as number) ?? 0
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

  const handleSaveSaleStatus = useCallback(async (
    dates: Date[], 
    status: 'sale' | 'closed',
    choiceStatusMap?: Record<string, boolean>
  ) => {
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
      // 초이스별 판매 상태가 설정된 경우 choices_pricing 구조 생성
      let choicesPricing: Record<string, { adult_price: number; child_price: number; infant_price: number; is_sale_available: boolean }> = {};
      
      if (choiceStatusMap && Object.keys(choiceStatusMap).length > 0) {
        // 각 초이스 조합에 대해 판매 상태 설정
        // choiceStatusMap의 키는 choiceId이고, 값은 boolean (true=판매, false=마감)
        Object.entries(choiceStatusMap).forEach(([choiceId, isSaleAvailable]) => {
          const choice = choiceCombinations.find(c => c.id === choiceId);
          if (choice) {
            choicesPricing[choiceId] = {
              adult_price: choice.adult_price || 0,
              child_price: choice.child_price || 0,
              infant_price: choice.infant_price || 0,
              is_sale_available: isSaleAvailable
            };
          }
        });
        
        // choiceStatusMap에 없는 다른 초이스들은 기본값으로 설정 (선택사항)
        // 주석 처리: 모든 초이스를 항상 포함하지 않고, 설정된 것만 포함
        // choiceCombinations.forEach(choice => {
        //   if (!choicesPricing[choice.id]) {
        //     choicesPricing[choice.id] = {
        //       adult_price: choice.adult_price || 0,
        //       child_price: choice.child_price || 0,
        //       infant_price: choice.infant_price || 0,
        //       is_sale_available: true // 기본값은 판매 가능
        //     };
        //   }
        // });
      }

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
            choices_pricing: Object.keys(choicesPricing).length > 0 ? choicesPricing : {}
          };

          await savePricingRule(ruleData, false); // 개별 메시지 표시 안함
        }
      }

      // 성공 메시지 표시
      const choiceStatusMsg = choiceStatusMap && Object.keys(choiceStatusMap).length > 0 
        ? ` (초이스별 설정 포함)`
        : '';
      setMessage(`${dates.length}개 날짜의 판매 상태가 ${status === 'sale' ? '판매중' : '마감'}으로 저장되었습니다.${choiceStatusMsg}`);
      
      // 데이터 새로고침
      await loadDynamicPricingData();
    } catch (error) {
      console.error('판매 상태 저장 실패:', error);
      setMessage('판매 상태 저장에 실패했습니다.');
    }
  }, [selectedChannelType, selectedChannel, channelGroups, productId, choiceCombinations, savePricingRule, setMessage, loadDynamicPricingData]);

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

    // 배치 저장을 위한 규칙 데이터 생성
    const rulesData: SimplePricingRuleDto[] = [];
    
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
          not_included_price: ((pricingConfig as Record<string, unknown>).not_included_price as number) || 0,
          markup_percent: ((pricingConfig as Record<string, unknown>).markup_percent as number) || 0,
          inclusions_ko: ((pricingConfig as Record<string, unknown>).inclusions_ko as string) || null,
          exclusions_ko: ((pricingConfig as Record<string, unknown>).exclusions_ko as string) || null,
          inclusions_en: ((pricingConfig as Record<string, unknown>).inclusions_en as string) || null,
          exclusions_en: ((pricingConfig as Record<string, unknown>).exclusions_en as string) || null,
          choices_pricing: Object.keys(calculationConfig.choicePricing).length > 0 
            ? (() => {
                // 조합별 가격 저장 구조
                const choicesPricing: Record<string, { adult_price: number; child_price: number; infant_price: number; }> = {};
                
                Object.entries(calculationConfig.choicePricing).forEach(([choiceId, choice]) => {
                  // choiceId는 조합 ID (예: "combination_0", "combination_1")
                  choicesPricing[choiceId] = {
                    adult_price: choice.adult_price,
                    child_price: choice.child_price,
                    infant_price: choice.infant_price
                  };
                });
                
                return choicesPricing;
              })()
            : {} as Record<string, { adult_price: number; child_price: number; infant_price: number; }>
        };
        
        rulesData.push(ruleData);
      }
    }

    // 자체 채널인 경우 배치 저장 사용, 그 외에는 개별 저장
    if (selectedChannelType === 'SELF' && rulesData.length > 10) {
      console.log(`자체 채널 배치 저장 시작: ${rulesData.length}개 규칙`);
      
      try {
        await savePricingRulesBatch(rulesData, (completed, total) => {
          setBatchProgress({ completed, total });
        });
        
        setBatchProgress(null); // 진행률 초기화
      } catch (error) {
        console.error('배치 저장 실패:', error);
        setBatchProgress(null);
        throw error;
      }
    } else {
      // 개별 저장 (OTA 채널이거나 규칙이 적은 경우)
      console.log(`개별 저장 시작: ${rulesData.length}개 규칙`);
      
      let savedCount = 0;
      for (const ruleData of rulesData) {
        try {
          await savePricingRule(ruleData, false);
          savedCount++;
        } catch (error) {
          console.error('가격 규칙 저장 실패:', error);
        }
      }
      
      if (savedCount === rulesData.length) {
        setMessage(`전체 ${rulesData.length}개 가격 규칙이 성공적으로 저장되었습니다.`);
      } else {
        setMessage(`${savedCount}/${rulesData.length}개 가격 규칙이 저장되었습니다.`);
      }
    }
  }, [selectedDates, selectedChannelType, selectedChannel, channelGroups, pricingConfig, calculationConfig, productId, savePricingRule, savePricingRulesBatch, setMessage]);

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

          {/* 포함/불포함 내역 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h4 className="text-md font-semibold text-gray-900 mb-4">포함/불포함 내역</h4>
            
            <div className="space-y-4">
                {/* 포함 내역 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    포함 내역 (한국어)
                  </label>
                  <textarea
                    value={(pricingConfig as Record<string, unknown>).inclusions_ko as string || ''}
                    onChange={(e) => handlePricingConfigUpdate({ inclusions_ko: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="포함된 내용을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    포함 내역 (영어)
                  </label>
                  <textarea
                    value={(pricingConfig as Record<string, unknown>).inclusions_en as string || ''}
                    onChange={(e) => handlePricingConfigUpdate({ inclusions_en: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Enter included items"
                  />
                </div>

                {/* 불포함 내역 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    불포함 내역 (한국어)
                  </label>
                  <textarea
                    value={((pricingConfig as Record<string, unknown>).exclusions_ko as string) || ''}
                    onChange={(e) => handlePricingConfigUpdate({ exclusions_ko: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="불포함된 내용을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    불포함 내역 (영어)
                  </label>
                  <textarea
                    value={(pricingConfig as Record<string, unknown>).exclusions_en as string || ''}
                    onChange={(e) => handlePricingConfigUpdate({ exclusions_en: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Enter excluded items"
                  />
                </div>
              </div>
          </div>
             </div>

        {/* 3열: 가격 설정 (3/12) */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">가격 설정</h3>
          
          {/* 날짜 및 요일 선택기 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <DateRangeSelector
              onDateRangeSelect={handleDateRangeSelection}
              initialSelection={dateRangeSelection || { startDate: '', endDate: '', selectedDays: [0, 1, 2, 3, 4, 5, 6] }}
            />
             </div>

          {/* 기본 가격 설정 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-semibold text-gray-900">기본 가격</h4>
              <button
                onClick={() => handlePricingConfigUpdate({ is_sale_available: !pricingConfig.is_sale_available })}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pricingConfig.is_sale_available
                    ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span>{pricingConfig.is_sale_available ? '✓ 판매중' : '판매중지'}</span>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* 기본 가격 - 항상 표시 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    성인 가격 ($)
                  </label>
                  <input
                    type="number"
                    value={pricingConfig.adult_price || 0}
                    onChange={(e) => handlePricingConfigUpdate({ adult_price: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    아동 가격 ($)
                  </label>
                  <input
                    type="number"
                    value={pricingConfig.child_price || 0}
                    onChange={(e) => handlePricingConfigUpdate({ child_price: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    유아 가격 ($)
                  </label>
                  <input
                    type="number"
                    value={pricingConfig.infant_price || 0}
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
                    value={((pricingConfig as Record<string, unknown>).markup_percent as number) || 0}
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
                    value={((pricingConfig as Record<string, unknown>).not_included_price as number) || 0}
                    onChange={(e) => handlePricingConfigUpdate({ not_included_price: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                         placeholder="0"
                       />
                     </div>
                   </div>
                              </div>
                            </div>

          {/* 초이스별 가격 설정 */}
          {choiceCombinations.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-2">초이스별 가격 설정</h4>
              <p className="text-xs text-gray-600 mb-4">※ 각 초이스 조합의 가격은 포함된 옵션들의 가격 합산입니다</p>
              
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
                      
                      {/* 조합 구성 요소 표시 */}
                      {combination.combination_details && combination.combination_details.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">구성 요소:</p>
                          <div className="flex flex-wrap gap-1">
                            {combination.combination_details.map((detail, index) => {
                              console.log(`조합 ${combination.id}의 detail ${index}:`, detail);
                              return (
                                <span
                                  key={index}
                                  className={`inline-block px-2 py-1 text-xs rounded ${
                                    index % 4 === 0 ? 'bg-blue-100 text-blue-800' :
                                    index % 4 === 1 ? 'bg-green-100 text-green-800' :
                                    index % 4 === 2 ? 'bg-purple-100 text-purple-800' :
                                    'bg-orange-100 text-orange-800'
                                  }`}
                                >
                                  {detail.optionNameKo || detail.optionName || '옵션'}: ${detail.adult_price || 0}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          성인 가격 ($)
                        </label>
                        <input
                          type="number"
                          value={combination.adult_price || 0}
                          onChange={(e) => handleChoicePriceUpdate(combination.id, 'adult_price', Number(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          원래 합산: ${combination.combination_details ? 
                            combination.combination_details.reduce((sum, detail) => sum + (detail.adult_price || 0), 0) : 
                            combination.adult_price || 0}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          아동 가격 ($)
                        </label>
                        <input
                          type="number"
                          value={combination.child_price || 0}
                          onChange={(e) => handleChoicePriceUpdate(combination.id, 'child_price', Number(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          원래 합산: ${combination.combination_details ? 
                            combination.combination_details.reduce((sum, detail) => sum + (detail.child_price || 0), 0) : 
                            combination.child_price || 0}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          유아 가격 ($)
                        </label>
                        <input
                          type="number"
                          value={combination.infant_price || 0}
                          onChange={(e) => handleChoicePriceUpdate(combination.id, 'infant_price', Number(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          원래 합산: ${combination.combination_details ? 
                            combination.combination_details.reduce((sum, detail) => sum + (detail.infant_price || 0), 0) : 
                            combination.infant_price || 0}
                        </div>
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
            batchProgress={batchProgress}
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
        choiceCombinations={choiceCombinations.map(choice => ({
          id: choice.id,
          combination_key: choice.combination_key,
          combination_name: choice.combination_name,
          ...(choice.combination_name_ko && { combination_name_ko: choice.combination_name_ko })
        }))}
        productId={productId}
        {...(selectedChannel && { channelId: selectedChannel })}
        {...(selectedChannelType && { channelType: selectedChannelType })}
      />
    </div>
  );
}
