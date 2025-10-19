'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { 
  DollarSign, 
  Calendar,
  List,
  Eye,
  TrendingUp
} from 'lucide-react';
import { DynamicPricingRule, CreatePricingRuleDto } from '@/lib/types/dynamic-pricing';

// 커스텀 훅들
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { useChannelManagement } from '@/hooks/useChannelManagement';
import { useChoiceManagement } from '@/hooks/useChoiceManagement';
import { usePricingData } from '@/hooks/usePricingData';

// UI 컴포넌트들
import { ChannelSelector } from './dynamic-pricing/ChannelSelector';
import { PricingCalendar } from './dynamic-pricing/PricingCalendar';
import { PricingListView } from './dynamic-pricing/PricingListView';
import { ChoicePricingPanel } from './dynamic-pricing/ChoicePricingPanel';
import { PricingControls } from './dynamic-pricing/PricingControls';

// 기존 컴포넌트들
import ChangeHistory from './ChangeHistory';
import AvailabilityModal from './AvailabilityModal';

interface DynamicPricingManagerProps {
  productId: string;
  onSave?: (rule: DynamicPricingRule) => void;
  isNewProduct?: boolean;
}

export default function DynamicPricingManager({ 
  productId, 
  onSave, 
  isNewProduct = false
}: DynamicPricingManagerProps) {
  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [listViewMonth, setListViewMonth] = useState(new Date());
  
  // 날짜 선택 상태
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // 커스텀 훅들
  const {
    saving,
    saveMessage,
    dynamicPricingData,
    savePricingRule,
    deletePricingRule
  } = useDynamicPricing({ productId, onSave });

  const {
    channels,
    isLoadingChannels,
    selectedChannel,
    isMultiChannelMode,
    selectedChannels,
    handleChannelSelect,
    handleMultiChannelToggle,
    handleChannelToggle
  } = useChannelManagement();

  const {
    choiceGroups,
    choiceCombinations,
    showCombinationPricing,
    updateChoiceCombinationPrice,
    toggleCombinationPricing
  } = useChoiceManagement(productId);

  const {
    priceHistory,
    showDetailedPrices,
    pricingConfig,
    updatePricingConfig,
    toggleDetailedPrices
  } = usePricingData(productId);

  // 날짜 선택 핸들러
  const handleDateSelect = useCallback((date: string, index: number) => {
    setSelectedDates([date]);
    setLastSelectedIndex(index);
  }, []);

  const handleDateRangeSelect = useCallback((startIndex: number, endIndex: number) => {
    // 범위 선택 로직 구현
    const startDate = new Date(currentMonth);
    const endDate = new Date(currentMonth);
    
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

  // 월 변경 핸들러
  const handleMonthChange = useCallback((month: Date) => {
    setCurrentMonth(month);
    setSelectedDates([]);
    setLastSelectedIndex(null);
  }, []);

  // 가격 규칙 저장 핸들러
  const handleSavePricingRule = useCallback(async () => {
    if (selectedDates.length === 0 || (!selectedChannel && selectedChannels.length === 0)) {
      return;
    }

    const channelIds = isMultiChannelMode ? selectedChannels : [selectedChannel];
    
    for (const channelId of channelIds) {
      for (const date of selectedDates) {
        const ruleData: CreatePricingRuleDto = {
          product_id: productId,
          channel_id: channelId,
          date,
          adult_price: pricingConfig.adult_price,
          child_price: pricingConfig.child_price,
          infant_price: pricingConfig.infant_price,
          commission_percent: pricingConfig.commission_percent,
          markup_amount: pricingConfig.markup_amount,
          coupon_percentage_discount: pricingConfig.coupon_percentage_discount,
          is_sale_available: pricingConfig.is_sale_available
        };

        await savePricingRule(ruleData);
      }
    }
  }, [selectedDates, selectedChannel, selectedChannels, isMultiChannelMode, pricingConfig, productId, savePricingRule]);

  // 규칙 편집 핸들러
  const handleEditRule = useCallback((rule: DynamicPricingRule) => {
    updatePricingConfig({
      adult_price: rule.adult_price,
      child_price: rule.child_price,
      infant_price: rule.infant_price,
      commission_percent: rule.commission_percent,
      markup_amount: rule.markup_amount,
      coupon_percentage_discount: rule.coupon_percentage_discount,
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
    return selectedDates.length > 0 && 
           (selectedChannel || selectedChannels.length > 0) &&
           (pricingConfig.adult_price > 0 || pricingConfig.child_price > 0 || pricingConfig.infant_price > 0);
  }, [selectedDates, selectedChannel, selectedChannels, pricingConfig]);

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
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <DollarSign className="h-8 w-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">동적 가격 관리</h2>
            <p className="text-sm text-gray-600">상품의 가격을 날짜와 채널별로 관리하세요</p>
          </div>
        </div>

        {/* 뷰 모드 토글 */}
        <div className="flex items-center space-x-2">
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

      {/* 채널 선택 */}
      <ChannelSelector
        channels={channels}
        isLoadingChannels={isLoadingChannels}
        selectedChannel={selectedChannel}
        isMultiChannelMode={isMultiChannelMode}
        selectedChannels={selectedChannels}
        onChannelSelect={handleChannelSelect}
        onMultiChannelToggle={handleMultiChannelToggle}
        onChannelToggle={handleChannelToggle}
      />

      {/* 메인 콘텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 캘린더 또는 목록 */}
        <div className="lg:col-span-2">
          {viewMode === 'calendar' ? (
            <PricingCalendar
              currentMonth={currentMonth}
              dynamicPricingData={currentMonthData}
              selectedDates={selectedDates}
              onMonthChange={handleMonthChange}
              onDateSelect={handleDateSelect}
              onDateRangeSelect={handleDateRangeSelect}
            />
          ) : (
            <PricingListView
              dynamicPricingData={dynamicPricingData}
              onEditRule={handleEditRule}
              onDeleteRule={handleDeleteRule}
            />
          )}
        </div>

        {/* 오른쪽: 가격 설정 패널 */}
        <div className="space-y-6">
          {/* 기본 가격 설정 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">가격 설정</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    성인 가격
                  </label>
                  <input
                    type="number"
                    value={pricingConfig.adult_price}
                    onChange={(e) => updatePricingConfig({ adult_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    아동 가격
                  </label>
                  <input
                    type="number"
                    value={pricingConfig.child_price}
                    onChange={(e) => updatePricingConfig({ child_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    유아 가격
                  </label>
                  <input
                    type="number"
                    value={pricingConfig.infant_price}
                    onChange={(e) => updatePricingConfig({ infant_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* 추가 옵션 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">세일 진행 중</label>
                  <input
                    type="checkbox"
                    checked={pricingConfig.is_sale_available}
                    onChange={(e) => updatePricingConfig({ is_sale_available: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    수수료 (%)
                  </label>
                  <input
                    type="number"
                    value={pricingConfig.commission_percent}
                    onChange={(e) => updatePricingConfig({ commission_percent: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 초이스 가격 패널 */}
          <ChoicePricingPanel
            choiceCombinations={choiceCombinations}
            showCombinationPricing={showCombinationPricing}
            onToggleCombinationPricing={toggleCombinationPricing}
            onUpdatePrice={updateChoiceCombinationPrice}
          />

          {/* 저장 컨트롤 */}
          <PricingControls
            saving={saving}
            saveMessage={saveMessage}
            onSave={handleSavePricingRule}
            canSave={canSave}
          />
        </div>
      </div>

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
  );
}
