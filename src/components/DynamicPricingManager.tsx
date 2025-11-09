'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar,
  List
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
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
import BulkPricingTableModal from './dynamic-pricing/BulkPricingTableModal';
import { ChannelForm } from './channels/ChannelForm';

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
  
  // 가격 일괄 추가 테이블 뷰 모달 상태
  const [isBulkPricingModalOpen, setIsBulkPricingModalOpen] = useState(false);
  
  // 배치 저장 진행률 상태
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number } | null>(null);
  
  // 채널 수정 모달 상태
  const [editingChannel, setEditingChannel] = useState<{
    id: string;
    name: string;
    type: string;
    website_url?: string;
    website?: string;
    customer_website?: string;
    admin_website?: string;
    commission_rate?: number;
    commission?: number;
    is_active: boolean;
    description?: string;
    favicon_url?: string;
    manager_name?: string;
    manager_contact?: string;
    contract_url?: string;
    commission_base_price_only?: boolean;
    has_not_included_price?: boolean;
    not_included_type?: 'none' | 'amount_only' | 'amount_and_choice';
    not_included_price?: number;
    pricing_type?: 'separate' | 'single';
    created_at: string;
  } | null>(null);

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
    handleSelectAllChannelsInType,
    loadChannels
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

  // 상품 기본 가격 상태
  const [productBasePrice, setProductBasePrice] = useState<{
    adult: number;
    child: number;
    infant: number;
  }>({
    adult: 0,
    child: 0,
    infant: 0
  });

  // 상품 기본 가격 불러오기
  useEffect(() => {
    const loadProductBasePrice = async () => {
      if (!productId) return;
      
      try {
        const { data, error } = await supabase
          .from('products')
          .select('adult_base_price, child_base_price, infant_base_price')
          .eq('id', productId)
          .single();

        if (error) throw error;

        setProductBasePrice({
          adult: data?.adult_base_price || 0,
          child: data?.child_base_price || 0,
          infant: data?.infant_base_price || 0
        });
      } catch (error) {
        console.error('상품 기본 가격 로드 오류:', error);
      }
    };

    loadProductBasePrice();
  }, [productId]);

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
      is_sale_available: updates.is_sale_available !== undefined ? (updates.is_sale_available as boolean) : (pricingConfig.is_sale_available ?? true),
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
      // 구조: { choiceId: { adult: 50, child: 30, infant: 20 } }
      const currentPricing = pricingConfig.choices_pricing || {};
      const currentChoiceData = (currentPricing as unknown as Record<string, Record<string, unknown>>)[combinationId] || {};
      
      // priceType을 새로운 구조에 맞게 변환 (adult_price -> adult)
      const newPriceKey = priceType === 'adult_price' ? 'adult' : 
                         priceType === 'child_price' ? 'child' : 
                         'infant';
      
      const updatedChoicesPricing = {
        ...currentPricing,
        [combinationId]: {
          ...currentChoiceData,
          [newPriceKey]: value,
          // 하위 호환성을 위해 기존 키도 유지
          [priceType]: value
        }
      };

      // pricingConfig 업데이트 (choices_pricing만 업데이트하여 useEffect 재실행 방지)
      updatePricingConfig({
        choices_pricing: updatedChoicesPricing
      });

      // 기존 초이스 조합도 즉시 업데이트 (호환성 유지)
      updateChoiceCombinationPrice(combinationId, priceType, value);
      
      console.log(`초이스 가격 업데이트: ${combinationId} - ${priceType}: ${value}`, {
        updatedChoicesPricing,
        newPriceKey
      });
    } catch (error) {
      console.error('초이스 가격 업데이트 실패:', error);
    }
  }, [pricingConfig.choices_pricing, updatePricingConfig, updateChoiceCombinationPrice]);

  // 새로운 가격 구조에 맞게 초이스 가격 데이터 동기화
  // 초기 로드 시에만 실행되도록 플래그 사용
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [lastLoadedPricing, setLastLoadedPricing] = useState<string>('');
  
  // 채널 변경 시 초기 로드 플래그 리셋
  useEffect(() => {
    setIsInitialLoad(true);
    setLastLoadedPricing('');
  }, [selectedChannel, selectedChannelType]);

  // 채널 수수료 자동 불러오기 (채널 선택 시)
  const lastSelectedChannelRef = useRef<string>('');
  
  useEffect(() => {
    // 채널이 선택되었을 때 해당 채널의 수수료(%) 값을 불러옴
    if (selectedChannel && channelGroups.length > 0) {
      // 채널이 변경되었을 때만 실행 (같은 채널을 다시 선택한 경우는 제외)
      const isChannelChanged = lastSelectedChannelRef.current !== selectedChannel;
      
      if (isChannelChanged) {
        lastSelectedChannelRef.current = selectedChannel;
        
        // 모든 채널 그룹에서 선택된 채널 찾기
        let foundChannel = null;
        for (const group of channelGroups) {
          foundChannel = group.channels.find(ch => ch.id === selectedChannel);
          if (foundChannel) break;
        }
        
        if (foundChannel) {
          // 채널의 commission_percent 또는 commission 값을 가져옴
          const channelCommission = (foundChannel as any).commission_percent || 
                                    (foundChannel as any).commission || 
                                    (foundChannel as any).commission_rate || 0;
          
          // 수수료(%) 값이 있으면 채널 수수료로 설정
          if (channelCommission && channelCommission > 0) {
            console.log('채널 수수료 설정 (채널 변경):', Number(channelCommission));
            handlePricingConfigUpdate({ commission_percent: Number(channelCommission) });
          }
        }
      } else {
        // 같은 채널이지만 pricingConfig가 0으로 리셋된 경우 복원
        if (pricingConfig.commission_percent === 0) {
          let foundChannel = null;
          for (const group of channelGroups) {
            foundChannel = group.channels.find(ch => ch.id === selectedChannel);
            if (foundChannel) break;
          }
          
          if (foundChannel) {
            const channelCommission = (foundChannel as any).commission_percent || 
                                      (foundChannel as any).commission || 
                                      (foundChannel as any).commission_rate || 0;
            
            if (channelCommission && channelCommission > 0) {
              console.log('채널 수수료 복원 (0에서):', Number(channelCommission));
              handlePricingConfigUpdate({ commission_percent: Number(channelCommission) });
            }
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel, selectedChannelType, channelGroups, pricingConfig.commission_percent]);
  
  useEffect(() => {
    const pricingKey = JSON.stringify(pricingConfig.choices_pricing);
    
    // 초기 로드이거나 choices_pricing이 실제로 변경된 경우에만 실행
    // (같은 데이터로 다시 실행되는 것을 방지)
    if (pricingConfig.choices_pricing && Object.keys(pricingConfig.choices_pricing).length > 0 && 
        (isInitialLoad || pricingKey !== lastLoadedPricing)) {
      console.log('새로운 choices_pricing 데이터 감지됨 (초기 로드):', pricingConfig.choices_pricing);
      
      // 새로운 구조: { choiceId: { adult: 50, child: 30, infant: 20 } }
      Object.entries(pricingConfig.choices_pricing).forEach(([choiceId, choiceData]: [string, Record<string, unknown>]) => {
        if (choiceData && typeof choiceData === 'object') {
          const adultPrice = (choiceData as Record<string, unknown>).adult as number || 
                           (choiceData as Record<string, unknown>).adult_price as number || 0;
          const childPrice = (choiceData as Record<string, unknown>).child as number || 
                           (choiceData as Record<string, unknown>).child_price as number || 0;
          const infantPrice = (choiceData as Record<string, unknown>).infant as number || 
                            (choiceData as Record<string, unknown>).infant_price as number || 0;
          
          updateChoiceCombinationPrice(choiceId, 'adult_price', adultPrice);
          updateChoiceCombinationPrice(choiceId, 'child_price', childPrice);
          updateChoiceCombinationPrice(choiceId, 'infant_price', infantPrice);
        }
      });
      
      setIsInitialLoad(false);
      setLastLoadedPricing(pricingKey);
    }
  }, [pricingConfig.choices_pricing, updateChoiceCombinationPrice, isInitialLoad, lastLoadedPricing, selectedChannel, selectedChannelType]);

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

  // 채널별 연도별 날짜 수 계산
  const [channelPricingStats, setChannelPricingStats] = useState<Record<string, Record<string, number>>>({});
  
  useEffect(() => {
    const loadChannelPricingStats = async () => {
      if (!productId) return;

      try {
        // 모든 채널의 동적 가격 데이터 가져오기
        const { data, error } = await supabase
          .from('dynamic_pricing')
          .select('channel_id, date')
          .eq('product_id', productId);

        if (error) {
          console.error('채널별 가격 통계 로드 오류:', error);
          return;
        }

        // 채널별로 그룹화하고 연도별 날짜 수 계산
        const stats: Record<string, Record<string, Set<string>>> = {};
        
        if (data) {
          data.forEach((item) => {
            const channelId = item.channel_id;
            const date = item.date;
            const year = date.split('-')[0];

            if (!stats[channelId]) {
              stats[channelId] = {};
            }
            if (!stats[channelId][year]) {
              stats[channelId][year] = new Set();
            }
            stats[channelId][year].add(date);
          });
        }

        // Set을 개수로 변환
        const formattedStats: Record<string, Record<string, number>> = {};
        Object.keys(stats).forEach(channelId => {
          formattedStats[channelId] = {};
          Object.keys(stats[channelId]).forEach(year => {
            formattedStats[channelId][year] = stats[channelId][year].size;
          });
        });

        setChannelPricingStats(formattedStats);
      } catch (error) {
        console.error('채널별 가격 통계 로드 오류:', error);
      }
    };

    loadChannelPricingStats();
  }, [productId, dynamicPricingData]);

  // 기본 가격 설정이 변경되면 calculationConfig도 업데이트
  // 상품 기본 가격 + 증차감 금액을 포함하여 초이스별 가격 계산에 사용
  useEffect(() => {
    // 선택된 채널의 pricing_type 확인
    let foundChannel = null;
    for (const group of channelGroups) {
      foundChannel = group.channels.find(ch => ch.id === selectedChannel);
      if (foundChannel) break;
    }
    const pricingType = (foundChannel as any)?.pricing_type || 'separate';
    const isSinglePrice = pricingType === 'single';
    
    // 증차감 금액 계산
    const priceAdjustmentAdult = (pricingConfig as Record<string, unknown>).price_adjustment_adult as number | undefined ?? 
      ((pricingConfig.adult_price ?? 0) - productBasePrice.adult);
    const priceAdjustmentChild = (pricingConfig as Record<string, unknown>).price_adjustment_child as number | undefined ?? 
      ((pricingConfig.child_price ?? 0) - productBasePrice.child);
    const priceAdjustmentInfant = (pricingConfig as Record<string, unknown>).price_adjustment_infant as number | undefined ?? 
      ((pricingConfig.infant_price ?? 0) - productBasePrice.infant);
    
    // 최종 가격 = 상품 기본 가격 + 증차감 금액
    // 단일 가격 모드인 경우 모든 가격을 동일하게 설정
    let finalAdultPrice, finalChildPrice, finalInfantPrice;
    if (isSinglePrice) {
      const singlePrice = productBasePrice.adult + priceAdjustmentAdult;
      finalAdultPrice = singlePrice;
      finalChildPrice = singlePrice;
      finalInfantPrice = singlePrice;
    } else {
      finalAdultPrice = productBasePrice.adult + priceAdjustmentAdult;
      finalChildPrice = productBasePrice.child + priceAdjustmentChild;
      finalInfantPrice = productBasePrice.infant + priceAdjustmentInfant;
    }
    
    updateCalculationConfig({
      adult_price: finalAdultPrice,
      child_price: finalChildPrice,
      infant_price: finalInfantPrice,
      commission_percent: pricingConfig.commission_percent ?? 0,
      markup_amount: pricingConfig.markup_amount ?? 0,
      markup_percent: ((pricingConfig as Record<string, unknown>).markup_percent as number) ?? 0,
      coupon_percent: pricingConfig.coupon_percent ?? 0,
      is_sale_available: pricingConfig.is_sale_available ?? true,
      not_included_price: ((pricingConfig as Record<string, unknown>).not_included_price as number) ?? 0
    });
  }, [pricingConfig, productBasePrice, updateCalculationConfig, selectedChannel, channelGroups]);

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
      // 판매 상태만 변경하므로 가격 정보는 전달하지 않음 (기존 값 유지)
      for (const channelId of channelIds) {
        for (const date of dates) {
          const ruleData: Partial<SimplePricingRuleDto> = {
            product_id: productId,
            channel_id: channelId,
            date: date.toISOString().split('T')[0],
            // 판매 상태만 설정, 가격 정보는 전달하지 않음 (기존 값 유지)
            is_sale_available: status === 'sale',
            // choices_pricing이 있으면 포함
            ...(Object.keys(choicesPricing).length > 0 ? { choices_pricing: choicesPricing } : {})
          };

          await savePricingRule(ruleData as SimplePricingRuleDto, false); // 개별 메시지 표시 안함
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
        // 증차감 금액 계산 (기존 adult_price에서 기본 가격 빼기)
        const priceAdjustmentAdult = (pricingConfig as Record<string, unknown>).price_adjustment_adult as number | undefined ?? 
          ((pricingConfig.adult_price ?? 0) - productBasePrice.adult);
        const priceAdjustmentChild = (pricingConfig as Record<string, unknown>).price_adjustment_child as number | undefined ?? 
          ((pricingConfig.child_price ?? 0) - productBasePrice.child);
        const priceAdjustmentInfant = (pricingConfig as Record<string, unknown>).price_adjustment_infant as number | undefined ?? 
          ((pricingConfig.infant_price ?? 0) - productBasePrice.infant);

        const ruleData: SimplePricingRuleDto = {
          product_id: productId,
          channel_id: channelId,
          date,
          adult_price: productBasePrice.adult + priceAdjustmentAdult,
          child_price: productBasePrice.child + priceAdjustmentChild,
          infant_price: productBasePrice.infant + priceAdjustmentInfant,
          commission_percent: pricingConfig.commission_percent,
          markup_amount: pricingConfig.markup_amount,
          coupon_percent: pricingConfig.coupon_percent,
          is_sale_available: pricingConfig.is_sale_available !== undefined ? pricingConfig.is_sale_available : true,
          not_included_price: ((pricingConfig as Record<string, unknown>).not_included_price as number) || 0,
          markup_percent: ((pricingConfig as Record<string, unknown>).markup_percent as number) || 0,
          price_adjustment_adult: priceAdjustmentAdult,
          price_adjustment_child: priceAdjustmentChild,
          price_adjustment_infant: priceAdjustmentInfant,
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

  // 채널 편집 핸들러
  const handleChannelEdit = useCallback(async (channelId: string) => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (error) {
        console.error('채널 조회 실패:', error);
        alert('채널 정보를 불러오는 중 오류가 발생했습니다.');
        return;
      }

      if (data) {
        // commission_percent를 commission_rate로 매핑
        const channelData = {
          ...data,
          commission_rate: data.commission_percent || data.commission || data.commission_rate || 0,
          is_active: data.status === 'active' || data.is_active === true,
          website: data.website || data.website_url || '',
          has_not_included_price: data.has_not_included_price || false,
          not_included_type: data.not_included_type || 'none',
          not_included_price: data.not_included_price || 0,
          pricing_type: data.pricing_type || 'separate'
        };
        setEditingChannel(channelData as typeof editingChannel);
      }
    } catch (error) {
      console.error('채널 조회 중 오류:', error);
      alert('채널 정보를 불러오는 중 오류가 발생했습니다.');
    }
  }, []);

  // 채널 수정 핸들러
  const handleEditChannel = useCallback(async (channel: Omit<typeof editingChannel, 'id' | 'created_at'>) => {
    if (!editingChannel) return;

    try {
      // commission_rate를 commission_percent로 매핑, is_active를 status로 매핑, website 필드 사용
      const channelAny = channel as any;
      const channelData: any = {
        name: channel.name,
        type: channel.type,
        website: channelAny.website || channel.website_url || '',
        customer_website: channel.customer_website || '',
        admin_website: channel.admin_website || '',
        commission_percent: channelAny.commission_rate || 0,
        status: channel.is_active ? 'active' : 'inactive',
        description: channel.description || '',
        favicon_url: channel.favicon_url || '',
        manager_name: channel.manager_name || '',
        manager_contact: channel.manager_contact || '',
        contract_url: channel.contract_url || '',
        commission_base_price_only: channelAny.commission_base_price_only ?? false,
        has_not_included_price: channelAny.has_not_included_price !== undefined ? channelAny.has_not_included_price : false,
        not_included_type: channelAny.not_included_type !== undefined && channelAny.not_included_type !== null && channelAny.not_included_type !== '' ? channelAny.not_included_type : 'none',
        not_included_price: channelAny.not_included_price !== undefined ? channelAny.not_included_price : 0,
        pricing_type: channelAny.pricing_type || 'separate'
      };
      
      console.log('DynamicPricingManager handleEditChannel - Saving channel data:', channelData);
      console.log('DynamicPricingManager handleEditChannel - Original channel object:', channel);

      const { error } = await supabase
        .from('channels')
        .update(channelData)
        .eq('id', editingChannel.id);

      if (error) {
        console.error('채널 수정 실패:', error);
        alert('채널 수정 중 오류가 발생했습니다.');
        return;
      }

      // 채널 목록 새로고침
      await loadChannels();
      setEditingChannel(null);
      alert('채널이 성공적으로 수정되었습니다!');
    } catch (error) {
      console.error('채널 수정 중 오류:', error);
      alert('채널 수정 중 오류가 발생했습니다.');
    }
  }, [editingChannel, loadChannels]);

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
            channelPricingStats={channelPricingStats}
            onSelectAllChannelsInType={handleSelectAllChannelsInType}
            onChannelEdit={handleChannelEdit}
          />
             </div>

        {/* 2열: 캘린더 (4/12) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">날짜 선택</h3>
            {/* 뷰 모드 토글 및 판매 상태 설정 버튼 */}
            <div className="flex items-center space-x-1.5">
          <button
                onClick={() => setIsBulkPricingModalOpen(true)}
                className="flex items-center space-x-1 px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 transition-colors"
          >
                <List className="h-3 w-3" />
                <span className="text-xs">가격 일괄 추가</span>
          </button>
          <button
                onClick={handleOpenSaleStatusModal}
                className="flex items-center space-x-1 px-2 py-1 rounded text-xs bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
          >
                <Calendar className="h-3 w-3" />
                <span className="text-xs">판매 상태</span>
          </button>
          <button
                 onClick={() => setViewMode('calendar')}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                   viewMode === 'calendar'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                 }`}
               >
                <Calendar className="h-3 w-3" />
                <span className="text-xs">캘린더</span>
               </button>
               <button
                 onClick={() => setViewMode('list')}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                   viewMode === 'list'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                 }`}
               >
                <List className="h-3 w-3" />
                <span className="text-xs">목록</span>
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
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">
                  {pricingConfig.is_sale_available ? '판매중' : '판매중지'}
                </span>
                <button
                  type="button"
                  onClick={() => handlePricingConfigUpdate({ is_sale_available: !pricingConfig.is_sale_available })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    pricingConfig.is_sale_available
                      ? 'bg-blue-600'
                      : 'bg-gray-300'
                  }`}
                  role="switch"
                  aria-checked={pricingConfig.is_sale_available}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      pricingConfig.is_sale_available ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* 상품 기본 가격 (읽기 전용) */}
              {(() => {
                // 선택된 채널의 pricing_type 확인
                let foundChannel = null;
                for (const group of channelGroups) {
                  foundChannel = group.channels.find(ch => ch.id === selectedChannel);
                  if (foundChannel) break;
                }
                const pricingType = (foundChannel as any)?.pricing_type || 'separate';
                const isSinglePrice = pricingType === 'single';
                
                return (
                  <div className="relative group">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      상품 기본 가격 (모든 채널 공통)
                    </label>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                      {isSinglePrice ? (
                        <div className="text-sm font-medium text-gray-900">
                          단일 가격: ${productBasePrice.adult.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-4">
                          <span>
                            <span className="text-xs text-gray-600">성인</span> ${productBasePrice.adult.toFixed(2)}
                          </span>
                          <span>
                            <span className="text-xs text-gray-600">아동</span> ${productBasePrice.child.toFixed(2)}
                          </span>
                          <span>
                            <span className="text-xs text-gray-600">유아</span> ${productBasePrice.infant.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* 마우스 오버 시 표시되는 안내 텍스트 */}
                    <div className="absolute left-0 top-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                      <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                        * 상품 편집 페이지에서 기본 가격을 변경할 수 있습니다
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 채널별 증차감 금액 - 자체 채널이 아닐 때만 표시 */}
              {selectedChannelType !== 'SELF' && (() => {
                // 선택된 채널의 pricing_type 확인
                let foundChannel = null;
                for (const group of channelGroups) {
                  foundChannel = group.channels.find(ch => ch.id === selectedChannel);
                  if (foundChannel) break;
                }
                const pricingType = (foundChannel as any)?.pricing_type || 'separate';
                const isSinglePrice = pricingType === 'single';
                
                return (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    채널별 증차감 금액 (양수: 증액, 음수: 할인)
                  </label>
                {isSinglePrice ? (
                  // 단일 가격 모드
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      단일 가격 증차감 ($)
                      {(() => {
                        // 쿠폰 할인을 증차감으로 대체할 때 필요한 증차감 금액 계산
                        const couponPercent = pricingConfig.coupon_percent || 0;
                        const commissionPercent = pricingConfig.commission_percent || 0;
                        const markupAmount = pricingConfig.markup_amount || 0;
                        const markupPercent = (pricingConfig as any).markup_percent || 0;
                        
                        // 선택된 채널의 commission_base_price_only 확인
                        const commissionBasePriceOnly = (foundChannel as any)?.commission_base_price_only || false;
                        
                        // 현재 기본 가격 (상품 기본 가격 + 마크업)
                        const currentBasePrice = productBasePrice.adult + markupAmount + (productBasePrice.adult * markupPercent / 100);
                        
                        // commissionBasePriceOnly가 false인 경우, 초이스 가격도 고려해야 함
                        // 초이스 가격이 있는 경우 첫 번째 초이스 가격 사용
                        let choicePrice = 0;
                        if (!commissionBasePriceOnly && choiceCombinations.length > 0) {
                          // 단일 가격 모드이므로 첫 번째 초이스의 adult_price 사용
                          const firstChoice = choiceCombinations[0];
                          // calculationConfig.choicePricing 우선 확인 (실시간 계산용)
                          const calcChoicePricing = calculationConfig.choicePricing?.[firstChoice.id];
                          if (calcChoicePricing) {
                            choicePrice = calcChoicePricing.adult_price || 0;
                          } else {
                            // pricingConfig.choices_pricing 확인 (저장된 데이터)
                            const savedChoicePricing = pricingConfig.choices_pricing?.[firstChoice.id] || 
                                                       (pricingConfig as any).choicePricing?.[firstChoice.id];
                            if (savedChoicePricing) {
                              choicePrice = savedChoicePricing.adult_price || savedChoicePricing.adult || 0;
                            }
                          }
                        }
                        
                        // 쿠폰 할인이 있을 때, 같은 OTA 판매가를 만들기 위한 증차감 계산
                        // commissionBasePriceOnly가 false인 경우:
                        // 현재 OTA 판매가 = (기본 가격 + 마크업 + 초이스 가격) × 0.8 / (1 - 쿠폰%) / (1 - 수수료%)
                        // 증차감 사용 시 OTA 판매가 = (기본 가격 + 마크업 + 초이스 가격 + 증차감) × 0.8 / (1 - 수수료%)
                        // 같은 OTA 판매가를 만들려면:
                        // (기본 가격 + 마크업 + 초이스 가격) × 0.8 / (1 - 쿠폰%) / (1 - 수수료%) = (기본 가격 + 마크업 + 초이스 가격 + 증차감) × 0.8 / (1 - 수수료%)
                        // 양변에 (1 - 수수료%) / 0.8을 곱하면:
                        // (기본 가격 + 마크업 + 초이스 가격) / (1 - 쿠폰%) = (기본 가격 + 마크업 + 초이스 가격 + 증차감)
                        // 증차감 = (기본 가격 + 마크업 + 초이스 가격) / (1 - 쿠폰%) - (기본 가격 + 마크업 + 초이스 가격)
                        // 증차감 = (기본 가격 + 마크업 + 초이스 가격) × [1 / (1 - 쿠폰%) - 1]
                        // 증차감 = (기본 가격 + 마크업 + 초이스 가격) × [쿠폰% / (1 - 쿠폰%)]
                        
                        // commissionBasePriceOnly가 true인 경우:
                        // 현재 OTA 판매가 = (기본 가격 + 마크업) / (1 - 수수료%)
                        // 증차감 사용 시 OTA 판매가 = (기본 가격 + 마크업 + 증차감) / (1 - 수수료%)
                        // 쿠폰 할인이 없으므로 증차감 계산 불필요
                        
                        if (couponPercent > 0 && commissionPercent > 0) {
                          const couponRate = couponPercent / 100;
                          const couponDenominator = 1 - couponRate;
                          if (couponDenominator > 0) {
                            // 초이스 가격을 포함한 총 가격
                            const totalPrice = currentBasePrice + choicePrice;
                            const requiredAdjustment = totalPrice * (couponRate / couponDenominator);
                            return (
                              <span className="ml-2 text-xs text-blue-600 font-medium">
                                (쿠폰 {couponPercent}% 대체: {requiredAdjustment >= 0 ? '+' : ''}${requiredAdjustment.toFixed(2)})
                              </span>
                            );
                          }
                        }
                        return null;
                      })()}
                    </label>
                    <input
                      type="number"
                      value={(() => {
                        const adjustment = pricingConfig.price_adjustment_adult !== undefined
                          ? pricingConfig.price_adjustment_adult
                          : (pricingConfig.adult_price ?? 0) - productBasePrice.adult;
                        return adjustment === 0 ? '' : adjustment;
                      })()}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === '-') {
                          handlePricingConfigUpdate({ 
                            price_adjustment_adult: 0,
                            price_adjustment_child: 0,
                            price_adjustment_infant: 0,
                            adult_price: productBasePrice.adult,
                            child_price: productBasePrice.adult,
                            infant_price: productBasePrice.adult
                          });
                          return;
                        }
                        const adjustment = parseFloat(value);
                        if (!isNaN(adjustment)) {
                          const finalPrice = productBasePrice.adult + adjustment;
                          handlePricingConfigUpdate({ 
                            price_adjustment_adult: adjustment,
                            price_adjustment_child: adjustment,
                            price_adjustment_infant: adjustment,
                            adult_price: finalPrice,
                            child_price: finalPrice,
                            infant_price: finalPrice
                          });
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === '-') {
                          handlePricingConfigUpdate({ 
                            price_adjustment_adult: 0,
                            price_adjustment_child: 0,
                            price_adjustment_infant: 0,
                            adult_price: productBasePrice.adult,
                            child_price: productBasePrice.adult,
                            infant_price: productBasePrice.adult
                          });
                        }
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                      step="0.01"
                    />
                    <div className="text-sm font-bold text-blue-600 mt-2">
                      최종: ${(productBasePrice.adult + (pricingConfig.price_adjustment_adult ?? ((pricingConfig.adult_price ?? 0) - productBasePrice.adult))).toFixed(2)}
                    </div>
                  </div>
                ) : (
                  // 분리 가격 모드
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      성인 증차감 ($)
                    </label>
                    <input
                      type="number"
                      value={(() => {
                        const adjustment = pricingConfig.price_adjustment_adult !== undefined
                          ? pricingConfig.price_adjustment_adult
                          : (pricingConfig.adult_price ?? 0) - productBasePrice.adult;
                        return adjustment === 0 ? '' : adjustment;
                      })()}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === '-') {
                          handlePricingConfigUpdate({ 
                            price_adjustment_adult: 0,
                            adult_price: productBasePrice.adult
                          });
                          return;
                        }
                        const adjustment = parseFloat(value);
                        if (!isNaN(adjustment)) {
                          handlePricingConfigUpdate({ 
                            price_adjustment_adult: adjustment,
                            adult_price: productBasePrice.adult + adjustment
                          });
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === '-') {
                          handlePricingConfigUpdate({ 
                            price_adjustment_adult: 0,
                            adult_price: productBasePrice.adult
                          });
                        }
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                      step="0.01"
                    />
                    <div className="text-sm font-bold text-blue-600 mt-2">
                      최종: ${(productBasePrice.adult + (pricingConfig.price_adjustment_adult ?? ((pricingConfig.adult_price ?? 0) - productBasePrice.adult))).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      아동 증차감 ($)
                    </label>
                    <input
                      type="number"
                      value={(() => {
                        const adjustment = pricingConfig.price_adjustment_child !== undefined
                          ? pricingConfig.price_adjustment_child
                          : (pricingConfig.child_price ?? 0) - productBasePrice.child;
                        return adjustment === 0 ? '' : adjustment;
                      })()}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === '-') {
                          handlePricingConfigUpdate({ 
                            price_adjustment_child: 0,
                            child_price: productBasePrice.child
                          });
                          return;
                        }
                        const adjustment = parseFloat(value);
                        if (!isNaN(adjustment)) {
                          handlePricingConfigUpdate({ 
                            price_adjustment_child: adjustment,
                            child_price: productBasePrice.child + adjustment
                          });
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === '-') {
                          handlePricingConfigUpdate({ 
                            price_adjustment_child: 0,
                            child_price: productBasePrice.child
                          });
                        }
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                      step="0.01"
                    />
                    <div className="text-sm font-bold text-blue-600 mt-2">
                      최종: ${(productBasePrice.child + (pricingConfig.price_adjustment_child ?? ((pricingConfig.child_price ?? 0) - productBasePrice.child))).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      유아 증차감 ($)
                    </label>
                    <input
                      type="number"
                      value={(() => {
                        const adjustment = pricingConfig.price_adjustment_infant !== undefined
                          ? pricingConfig.price_adjustment_infant
                          : (pricingConfig.infant_price ?? 0) - productBasePrice.infant;
                        return adjustment === 0 ? '' : adjustment;
                      })()}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === '-') {
                          handlePricingConfigUpdate({ 
                            price_adjustment_infant: 0,
                            infant_price: productBasePrice.infant
                          });
                          return;
                        }
                        const adjustment = parseFloat(value);
                        if (!isNaN(adjustment)) {
                          handlePricingConfigUpdate({ 
                            price_adjustment_infant: adjustment,
                            infant_price: productBasePrice.infant + adjustment
                          });
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === '-') {
                          handlePricingConfigUpdate({ 
                            price_adjustment_infant: 0,
                            infant_price: productBasePrice.infant
                          });
                        }
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                      step="0.01"
                    />
                    <div className="text-sm font-bold text-blue-600 mt-2">
                      최종: ${(productBasePrice.infant + (pricingConfig.price_adjustment_infant ?? ((pricingConfig.infant_price ?? 0) - productBasePrice.infant))).toFixed(2)}
                    </div>
                  </div>
                </div>
                )}
                </div>
                );
              })()}


              {/* 수수료 및 마크업 - 한 줄에 3개 */}
              <div className="grid grid-cols-3 gap-3">
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1">
                    수수료 (%)
                   </label>
                     <input
                       type="number"
                    value={pricingConfig.commission_percent === 0 ? '' : pricingConfig.commission_percent}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ commission_percent: 0 });
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        handlePricingConfigUpdate({ commission_percent: numValue });
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ commission_percent: 0 });
                      }
                    }}
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
                    value={pricingConfig.markup_amount === 0 ? '' : pricingConfig.markup_amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ markup_amount: 0 });
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        handlePricingConfigUpdate({ markup_amount: numValue });
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ markup_amount: 0 });
                      }
                    }}
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
                    value={(((pricingConfig as Record<string, unknown>).markup_percent as number) || 0) === 0 ? '' : ((pricingConfig as Record<string, unknown>).markup_percent as number) || 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ markup_percent: 0 });
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        handlePricingConfigUpdate({ markup_percent: numValue });
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ markup_percent: 0 });
                      }
                    }}
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
                    value={(pricingConfig.coupon_percent || 0) === 0 ? '' : (pricingConfig.coupon_percent || 0)}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ coupon_percent: 0 });
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        handlePricingConfigUpdate({ coupon_percent: numValue });
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ coupon_percent: 0 });
                      }
                    }}
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
                    value={(((pricingConfig as Record<string, unknown>).not_included_price as number) || 0) === 0 ? '' : ((pricingConfig as Record<string, unknown>).not_included_price as number) || 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ not_included_price: 0 });
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        handlePricingConfigUpdate({ not_included_price: numValue });
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ not_included_price: 0 });
                      }
                    }}
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
              <h4 className="text-md font-semibold text-gray-900 mb-4">초이스별 가격 설정</h4>
              
              <div className="space-y-3">
                {choiceCombinations.map((combination) => (
                  <div
                    key={combination.id}
                    className="p-3 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <div className="mb-3">
                      {/* 제목과 옵션 뱃지를 같은 줄에 배치 */}
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="text-sm font-semibold text-gray-900">
                          {combination.combination_name_ko || combination.combination_name}
                        </h5>
                        {/* 조합 구성 요소 표시 - 오른쪽 끝에 배치 */}
                        {combination.combination_details && combination.combination_details.length > 0 && (
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
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        {combination.combination_name}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          성인 가격 ($)
                        </label>
                        <input
                          type="number"
                          value={(combination.adult_price || 0) === 0 ? '' : (combination.adult_price || 0)}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || value === '-') {
                              handleChoicePriceUpdate(combination.id, 'adult_price', 0);
                              return;
                            }
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              handleChoicePriceUpdate(combination.id, 'adult_price', numValue);
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '' || value === '-') {
                              handleChoicePriceUpdate(combination.id, 'adult_price', 0);
                            }
                          }}
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
                          value={(combination.child_price || 0) === 0 ? '' : (combination.child_price || 0)}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || value === '-') {
                              handleChoicePriceUpdate(combination.id, 'child_price', 0);
                              return;
                            }
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              handleChoicePriceUpdate(combination.id, 'child_price', numValue);
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '' || value === '-') {
                              handleChoicePriceUpdate(combination.id, 'child_price', 0);
                            }
                          }}
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
                          value={(combination.infant_price || 0) === 0 ? '' : (combination.infant_price || 0)}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || value === '-') {
                              handleChoicePriceUpdate(combination.id, 'infant_price', 0);
                              return;
                            }
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              handleChoicePriceUpdate(combination.id, 'infant_price', numValue);
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '' || value === '-') {
                              handleChoicePriceUpdate(combination.id, 'infant_price', 0);
                            }
                          }}
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
            selectedChannel={selectedChannel ? channelGroups
              .flatMap(group => group.channels)
              .find(ch => ch.id === selectedChannel) || null : null}
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

      {/* 가격 일괄 추가 테이블 뷰 모달 */}
      <BulkPricingTableModal
        isOpen={isBulkPricingModalOpen}
        onClose={() => setIsBulkPricingModalOpen(false)}
        productId={productId}
        channels={channelGroups.flatMap(group => group.channels)}
        choiceCombinations={choiceCombinations}
        onSave={() => {
          loadDynamicPricingData();
        }}
      />

      {/* 채널 수정 모달 */}
      {editingChannel && (
        <ChannelForm
          channel={editingChannel}
          onSubmit={handleEditChannel}
          onCancel={() => setEditingChannel(null)}
        />
      )}
    </div>
  );
}
