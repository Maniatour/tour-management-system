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
import { calculateHomepageNetPrice } from '@/utils/homepagePriceCalculator';

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

const DATE_PARTS_REGEX = /(\d{4})[-\/.](\d{1,2})/;

const extractYearMonth = (value: string | Date | null | undefined) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
    };
  }

  const str = String(value).trim();
  if (!str) return null;

  const dateOnly = str.includes('T') ? str.split('T')[0] : str.split(' ')[0];
  const match = dateOnly.match(DATE_PARTS_REGEX);

  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
    };
  }

  const timestamp = Date.parse(str);
  if (!Number.isNaN(timestamp)) {
    const date = new Date(timestamp);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
    };
  }

  return null;
};

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

  // 디버깅: 채널 변경 시에만 로그 출력
  useEffect(() => {
    if (selectedChannel) {
      console.log('📌 채널 변경:', { selectedChannel, selectedChannelType });
    }
  }, [selectedChannel, selectedChannelType]);

  // 페이지 로드 시 Homepage(M00001) 채널 자동 선택
  useEffect(() => {
    // 채널이 로드되었고, 선택된 채널이 없을 때만 실행
    if (!isLoadingChannels && !selectedChannel && channelGroups.length > 0) {
      // SELF 채널 그룹에서 M00001 채널 찾기
      const selfChannelGroup = channelGroups.find(group => group.type === 'SELF');
      const homepageChannel = selfChannelGroup?.channels.find(ch => ch.id === 'M00001');
      
      if (homepageChannel) {
        console.log('🏠 Homepage 채널 자동 선택:', homepageChannel.id);
        handleChannelSelect(homepageChannel.id);
      }
    }
  }, [isLoadingChannels, selectedChannel, channelGroups, handleChannelSelect]);

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

  // 홈페이지(M00001) 채널의 가격 설정 상태 (고정값)
  const [homepagePricingConfig, setHomepagePricingConfig] = useState<{
    markup_amount: number;
    markup_percent: number;
    choices_pricing: Record<string, any>;
  }>({
    markup_amount: 0,
    markup_percent: 0,
    choices_pricing: {}
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

  // 홈페이지(M00001) 채널의 가격 설정 불러오기 (고정값)
  useEffect(() => {
    const loadHomepagePricingConfig = async () => {
      if (!productId) return;
      
      try {
        // M00001 채널의 최신 가격 설정 가져오기 (choices_pricing이 null이 아닌 레코드 우선)
        const { data, error } = await supabase
          .from('dynamic_pricing')
          .select('markup_amount, markup_percent, choices_pricing, date')
          .eq('product_id', productId)
          .eq('channel_id', 'M00001')
          .not('choices_pricing', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        // choices_pricing이 null이 아닌 레코드가 없으면, null 포함하여 다시 시도
        if (!data || !data.choices_pricing) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('dynamic_pricing')
            .select('markup_amount, markup_percent, choices_pricing, date')
            .eq('product_id', productId)
            .eq('channel_id', 'M00001')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (fallbackError && fallbackError.code !== 'PGRST116') {
            console.error('홈페이지 가격 설정 로드 오류:', fallbackError);
            return;
          }
          
          if (fallbackData) {
            const processedData = fallbackData;
            const processedError = null;
            
            // choices_pricing 처리
            let choicesPricing = processedData.choices_pricing;
            if (typeof choicesPricing === 'string') {
              try {
                choicesPricing = JSON.parse(choicesPricing);
              } catch (e) {
                console.error('choices_pricing 파싱 오류:', e);
                choicesPricing = {};
              }
            }
            
            console.log('✅ 홈페이지 가격 설정 로드 성공 (M00001, fallback):', {
              markup_amount: processedData.markup_amount,
              markup_percent: processedData.markup_percent,
              choices_pricing_keys: Object.keys(choicesPricing || {}),
              choices_pricing_sample: Object.entries(choicesPricing || {}).slice(0, 2),
              date: processedData.date
            });
            
            setHomepagePricingConfig({
              markup_amount: processedData.markup_amount || 0,
              markup_percent: processedData.markup_percent || 0,
              choices_pricing: (choicesPricing as Record<string, any>) || {}
            });
            return;
          }
        }

        if (error && error.code !== 'PGRST116') { // PGRST116은 데이터 없음 에러
          console.error('홈페이지 가격 설정 로드 오류:', error);
          return;
        }

        if (data) {
          // choices_pricing이 문자열인 경우 파싱
          let choicesPricing = data.choices_pricing;
          if (typeof choicesPricing === 'string') {
            try {
              choicesPricing = JSON.parse(choicesPricing);
            } catch (e) {
              console.error('choices_pricing 파싱 오류:', e);
              choicesPricing = {};
            }
          }
          
          console.log('✅ 홈페이지 가격 설정 로드 성공 (M00001):', {
            markup_amount: data.markup_amount,
            markup_percent: data.markup_percent,
            choices_pricing_keys: Object.keys(choicesPricing || {}),
            choices_pricing_sample: Object.entries(choicesPricing || {}).slice(0, 2),
            date: data.date
          });
          
          setHomepagePricingConfig({
            markup_amount: data.markup_amount || 0,
            markup_percent: data.markup_percent || 0,
            choices_pricing: (choicesPricing as Record<string, any>) || {}
          });
        } else {
          console.warn('⚠️ 홈페이지 가격 설정 데이터 없음 (M00001 채널)');
          // 데이터가 없으면 기본값 유지
          setHomepagePricingConfig({
            markup_amount: 0,
            markup_percent: 0,
            choices_pricing: {}
          });
        }
      } catch (error) {
        console.error('홈페이지 가격 설정 로드 오류:', error);
      }
    };

    loadHomepagePricingConfig();
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
      // 디버깅: choices_pricing 변경 시에만 로그 출력
      console.log('📦 choices_pricing 업데이트:', {
        keys: Object.keys(pricingConfig.choices_pricing),
        sample: Object.entries(pricingConfig.choices_pricing).slice(0, 2)
      });
      
      // 새로운 구조: { choiceId: { adult: 50, child: 30, infant: 20 } }
      Object.entries(pricingConfig.choices_pricing).forEach(([choiceId, choiceData]: [string, Record<string, unknown>]) => {
        if (choiceData && typeof choiceData === 'object') {
          const adultPrice = (choiceData as Record<string, unknown>).adult as number || 
                           (choiceData as Record<string, unknown>).adult_price as number || 0;
          const childPrice = (choiceData as Record<string, unknown>).child as number || 
                           (choiceData as Record<string, unknown>).child_price as number || 0;
          const infantPrice = (choiceData as Record<string, unknown>).infant as number || 
                            (choiceData as Record<string, unknown>).infant_price as number || 0;
          
          // 초이스 조합 가격 업데이트
          updateChoiceCombinationPrice(choiceId, 'adult_price', adultPrice);
          updateChoiceCombinationPrice(choiceId, 'child_price', childPrice);
          updateChoiceCombinationPrice(choiceId, 'infant_price', infantPrice);
          
          // 실시간 가격 계산을 위한 calculationConfig.choicePricing 업데이트
          // 주의: homepagePricingConfig에서 M00001 채널의 고정 가격을 우선 사용
          const combination = choiceCombinations.find(c => c.id === choiceId);
          if (combination) {
            // homepagePricingConfig에서 여러 키로 시도하여 가격 찾기
            let homepageChoiceData: any = {};
            if (homepagePricingConfig?.choices_pricing) {
              // 1. choiceId로 시도
              homepageChoiceData = homepagePricingConfig.choices_pricing[choiceId] || {};
              
              // 2. combination_key로 시도
              if ((!homepageChoiceData || Object.keys(homepageChoiceData).length === 0) && combination.combination_key) {
                homepageChoiceData = homepagePricingConfig.choices_pricing[combination.combination_key] || {};
              }
              
              // 3. 정렬된 combination_key로 시도 (그룹 순서에 상관없이 매칭)
              if ((!homepageChoiceData || Object.keys(homepageChoiceData).length === 0) && combination.combination_key) {
                const sortedKey = combination.combination_key.split('+').sort().join('+');
                if (sortedKey !== combination.combination_key) {
                  homepageChoiceData = homepagePricingConfig.choices_pricing[sortedKey] || {};
                }
              }
              
              // 4. 모든 키를 순회하며 정렬된 키로 매칭 시도
              if ((!homepageChoiceData || Object.keys(homepageChoiceData).length === 0) && combination.combination_key) {
                const sortedKey = combination.combination_key.split('+').sort().join('+');
                const availableKeys = Object.keys(homepagePricingConfig.choices_pricing);
                const matchingKey = availableKeys.find(key => {
                  const sortedAvailableKey = key.split('+').sort().join('+');
                  return sortedAvailableKey === sortedKey;
                });
                if (matchingKey) {
                  homepageChoiceData = homepagePricingConfig.choices_pricing[matchingKey];
                }
              }
            }
            
            // pricingConfig.choices_pricing의 값이 있으면 사용, 없으면 homepagePricingConfig 사용
            const finalAdultPrice = adultPrice || 
                                  (homepageChoiceData.adult_price as number) ||
                                  (homepageChoiceData.adult as number) ||
                                  combination.adult_price || 0;
            const finalChildPrice = childPrice || 
                                   (homepageChoiceData.child_price as number) ||
                                   (homepageChoiceData.child as number) ||
                                   combination.child_price || 0;
            const finalInfantPrice = infantPrice || 
                                    (homepageChoiceData.infant_price as number) ||
                                    (homepageChoiceData.infant as number) ||
                                    combination.infant_price || 0;
            
            updateChoicePricing(choiceId, {
              choiceId: choiceId,
              choiceName: combination.combination_name,
              adult_price: finalAdultPrice,
              child_price: finalChildPrice,
              infant_price: finalInfantPrice
            });
          }
        }
      });
      
      setIsInitialLoad(false);
      setLastLoadedPricing(pricingKey);
    }
  }, [pricingConfig.choices_pricing, updateChoiceCombinationPrice, updateChoicePricing, choiceCombinations, isInitialLoad, lastLoadedPricing, selectedChannel, selectedChannelType]);

  // 초이스 조합이 로드되면 초기 가격 설정
  // 주의: homepagePricingConfig에서 M00001 채널의 고정 가격을 우선 사용
  // homepagePricingConfig가 비어있으면 choiceCombinations의 가격 사용 (상품 기본 가격)
  useEffect(() => {
    if (choiceCombinations.length > 0) {
      const hasHomepageConfig = homepagePricingConfig && 
                                Object.keys(homepagePricingConfig.choices_pricing || {}).length > 0;
      
      choiceCombinations.forEach(combination => {
        let adultPrice = 0;
        let childPrice = 0;
        let infantPrice = 0;
        
        if (hasHomepageConfig) {
          // homepagePricingConfig에서 여러 키로 시도하여 가격 찾기
          let homepageChoiceData: any = {};
          if (homepagePricingConfig?.choices_pricing) {
            // 1. combination.id로 시도
            homepageChoiceData = homepagePricingConfig.choices_pricing[combination.id] || {};
            
            // 2. combination_key로 시도
            if ((!homepageChoiceData || Object.keys(homepageChoiceData).length === 0) && combination.combination_key) {
              homepageChoiceData = homepagePricingConfig.choices_pricing[combination.combination_key] || {};
            }
            
            // 3. 정렬된 combination_key로 시도 (그룹 순서에 상관없이 매칭)
            if ((!homepageChoiceData || Object.keys(homepageChoiceData).length === 0) && combination.combination_key) {
              const sortedKey = combination.combination_key.split('+').sort().join('+');
              if (sortedKey !== combination.combination_key) {
                homepageChoiceData = homepagePricingConfig.choices_pricing[sortedKey] || {};
              }
            }
            
            // 4. 모든 키를 순회하며 정렬된 키로 매칭 시도
            if ((!homepageChoiceData || Object.keys(homepageChoiceData).length === 0) && combination.combination_key) {
              const sortedKey = combination.combination_key.split('+').sort().join('+');
              const availableKeys = Object.keys(homepagePricingConfig.choices_pricing);
              const matchingKey = availableKeys.find(key => {
                const sortedAvailableKey = key.split('+').sort().join('+');
                return sortedAvailableKey === sortedKey;
              });
              if (matchingKey) {
                homepageChoiceData = homepagePricingConfig.choices_pricing[matchingKey];
              }
            }
          }
          
          adultPrice = (homepageChoiceData.adult_price as number) ||
                      (homepageChoiceData.adult as number) ||
                      combination.adult_price || 0;
          childPrice = (homepageChoiceData.child_price as number) ||
                      (homepageChoiceData.child as number) ||
                      combination.child_price || 0;
          infantPrice = (homepageChoiceData.infant_price as number) ||
                       (homepageChoiceData.infant as number) ||
                       combination.infant_price || 0;
        } else {
          // homepagePricingConfig가 비어있으면 choiceCombinations의 가격 사용
          // 이것은 상품의 기본 초이스 가격일 수 있음
          adultPrice = combination.adult_price || 0;
          childPrice = combination.child_price || 0;
          infantPrice = combination.infant_price || 0;
        }
        
        updateChoicePricing(combination.id, {
          choiceId: combination.id,
          choiceName: combination.combination_name,
          adult_price: adultPrice,
          child_price: childPrice,
          infant_price: infantPrice
        });
      });
    }
  }, [choiceCombinations, updateChoicePricing, homepagePricingConfig]);

  // 채널별 연도별 날짜 수 계산
  const [channelPricingStats, setChannelPricingStats] = useState<Record<string, Record<string, number>>>({});
  
  // 채널별 가격 통계 로드 함수 (저장 후에도 호출 가능하도록 분리)
  const loadChannelPricingStats = useCallback(async () => {
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

      // 날짜 정규화 함수 (YYYY-MM-DD 형식으로 변환)
      const normalizeDate = (dateStr: string | null | undefined): string | null => {
        if (!dateStr) return null;
        
        const str = String(dateStr).trim();
        // 이미 YYYY-MM-DD 형식인지 확인
        if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return str;
        }
        
        // 날짜 문자열에서 YYYY-MM-DD 추출
        const dateMatch = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (dateMatch) {
          const year = dateMatch[1];
          const month = String(parseInt(dateMatch[2], 10)).padStart(2, '0');
          const day = String(parseInt(dateMatch[3], 10)).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        // Date 객체로 파싱 시도
        try {
          const date = new Date(str);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        } catch (e) {
          // 파싱 실패
        }
        
        return null;
      };

      // 채널별로 그룹화하고 연도별 날짜 수 계산
      const stats: Record<string, Record<string, Set<string>>> = {};
      
      if (data) {
        data.forEach((item) => {
          const channelId = item.channel_id;
          const normalizedDate = normalizeDate(item.date);
          
          if (!normalizedDate) {
            // 날짜가 유효하지 않으면 건너뛰기
            return;
          }
          
          const year = normalizedDate.split('-')[0];

          if (!stats[channelId]) {
            stats[channelId] = {};
          }
          if (!stats[channelId][year]) {
            stats[channelId][year] = new Set();
          }
          // 정규화된 날짜를 사용하여 중복 제거
          stats[channelId][year].add(normalizedDate);
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
  }, [productId]);

  // 초기 로드 및 dynamicPricingData 변경 시 통계 업데이트
  useEffect(() => {
    loadChannelPricingStats();
  }, [loadChannelPricingStats, dynamicPricingData]);

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

        // price_type 결정: not_included_price가 있으면 'dynamic', 없으면 'base'
        const notIncludedPrice = ((pricingConfig as Record<string, unknown>).not_included_price as number) || 0;
        const priceType = notIncludedPrice > 0 ? 'dynamic' : 'base';
        
        const ruleData: SimplePricingRuleDto = {
          product_id: productId,
          channel_id: channelId,
          date,
          price_type: priceType,
          adult_price: productBasePrice.adult + priceAdjustmentAdult,
          child_price: productBasePrice.child + priceAdjustmentChild,
          infant_price: productBasePrice.infant + priceAdjustmentInfant,
          commission_percent: pricingConfig.commission_percent,
          markup_amount: pricingConfig.markup_amount,
          coupon_percent: pricingConfig.coupon_percent,
          is_sale_available: pricingConfig.is_sale_available !== undefined ? pricingConfig.is_sale_available : true,
          not_included_price: notIncludedPrice,
          markup_percent: ((pricingConfig as Record<string, unknown>).markup_percent as number) || 0,
          price_adjustment_adult: priceAdjustmentAdult,
          price_adjustment_child: priceAdjustmentChild,
          price_adjustment_infant: priceAdjustmentInfant,
          inclusions_ko: ((pricingConfig as Record<string, unknown>).inclusions_ko as string) || null,
          exclusions_ko: ((pricingConfig as Record<string, unknown>).exclusions_ko as string) || null,
          inclusions_en: ((pricingConfig as Record<string, unknown>).inclusions_en as string) || null,
          exclusions_en: ((pricingConfig as Record<string, unknown>).exclusions_en as string) || null,
          choices_pricing: Object.keys(calculationConfig.choicePricing).length > 0 || (pricingConfig.choices_pricing && Object.keys(pricingConfig.choices_pricing).length > 0)
            ? (() => {
                // 조합별 가격 저장 구조
                const choicesPricing: Record<string, { adult_price: number; child_price: number; infant_price: number; ota_sale_price?: number; }> = {};
                
                // calculationConfig.choicePricing 우선 사용
                Object.entries(calculationConfig.choicePricing).forEach(([choiceId, choice]) => {
                  // choiceId는 조합 ID (예: "combination_0", "combination_1")
                  const otaSalePrice = (pricingConfig.choices_pricing as any)?.[choiceId]?.ota_sale_price;
                  choicesPricing[choiceId] = {
                    adult_price: choice.adult_price,
                    child_price: choice.child_price,
                    infant_price: choice.infant_price,
                    ...(otaSalePrice !== undefined && otaSalePrice > 0 ? { ota_sale_price: otaSalePrice } : {})
                  };
                });
                
                // pricingConfig.choices_pricing에서 ota_sale_price가 있지만 calculationConfig에 없는 경우 추가
                if (pricingConfig.choices_pricing) {
                  Object.entries(pricingConfig.choices_pricing as Record<string, any>).forEach(([choiceId, choiceData]) => {
                    if (!choicesPricing[choiceId] && choiceData.ota_sale_price !== undefined && choiceData.ota_sale_price > 0) {
                      choicesPricing[choiceId] = {
                        adult_price: choiceData.adult_price || choiceData.adult || 0,
                        child_price: choiceData.child_price || choiceData.child || 0,
                        infant_price: choiceData.infant_price || choiceData.infant || 0,
                        ota_sale_price: choiceData.ota_sale_price
                      };
                    } else if (choicesPricing[choiceId] && choiceData.ota_sale_price !== undefined && choiceData.ota_sale_price > 0) {
                      // 이미 있는 경우 ota_sale_price만 업데이트
                      choicesPricing[choiceId].ota_sale_price = choiceData.ota_sale_price;
                    }
                  });
                }
                
                return choicesPricing;
              })()
            : {} as Record<string, { adult_price: number; child_price: number; infant_price: number; ota_sale_price?: number; }>
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
        // 저장 완료 후 통계 다시 로드
        await loadChannelPricingStats();
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
        // 저장 완료 후 통계 다시 로드
        await loadChannelPricingStats();
      } else {
        setMessage(`${savedCount}/${rulesData.length}개 가격 규칙이 저장되었습니다.`);
        // 일부 저장 완료 후에도 통계 다시 로드
        await loadChannelPricingStats();
      }
    }
  }, [selectedDates, selectedChannelType, selectedChannel, channelGroups, pricingConfig, calculationConfig, productId, savePricingRule, savePricingRulesBatch, setMessage, loadChannelPricingStats]);

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
    
    // 디버깅: canSave 변경 시에만 로그 출력 (불필요한 중복 로그 제거)
    // console.log('canSave 계산:', {
    //   hasSelectedDates,
    //   hasSelectedChannels,
    //   hasValidPrices,
    //   hasChoicePrices,
    //   selectedDates: selectedDates.length,
    //   selectedChannelType,
    //   selectedChannel,
    //   pricingConfig: {
    //     adult_price: pricingConfig.adult_price,
    //     child_price: pricingConfig.child_price,
    //     infant_price: pricingConfig.infant_price
    //   },
    //   choiceCombinations: choiceCombinations.length,
    //   canSave: canSaveResult
    // });
    
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
    const year = currentMonth.getUTCFullYear();
    const month = currentMonth.getUTCMonth() + 1;
    
    return dynamicPricingData.filter(({ date }) => {
      const parts = extractYearMonth(date);
      if (!parts) return false;
      return parts.year === year && parts.month === month;
    });
  }, [dynamicPricingData, currentMonth]);

  return (
    <div className="space-y-6">
      {/* 4열 그리드 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1열: 채널 선택 (1.5/12 → 2/12) */}
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

        {/* 2열: 캘린더 (10/12 ÷ 3 = 3.33/12 → 3/12) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">가격 기록</h3>
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
              channelInfo={selectedChannel ? channelGroups
                .flatMap(group => group.channels)
                .find(ch => ch.id === selectedChannel) || null : null}
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

        {/* 3열: 날짜 및 요일 선택 + 현재 설정 (10/12 ÷ 3 = 3.33/12 → 3/12) */}
        <div className="lg:col-span-3 space-y-4">
          {/* 날짜 및 요일 선택기 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-semibold text-gray-900">날짜 및 요일 선택</h4>
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
            <DateRangeSelector
              onDateRangeSelect={handleDateRangeSelection}
              initialSelection={dateRangeSelection || { startDate: '', endDate: '', selectedDays: [0, 1, 2, 3, 4, 5, 6] }}
            />
          </div>

          {/* 현재 설정 (실시간 가격 계산 - 기본 가격만) */}
          <PriceCalculator
            calculation={currentCalculation}
            pricingConfig={calculationConfig}
            choiceCalculations={{}}
            choiceCombinations={[]}
            selectedChannel={selectedChannel ? channelGroups
              .flatMap(group => group.channels)
              .find(ch => ch.id === selectedChannel) || null : null}
            channels={channelGroups.flatMap(group => group.channels)}
            productBasePrice={productBasePrice}
            homepagePricingConfig={homepagePricingConfig}
          />
        </div>

        {/* 4열: 기본 가격 + 초이스별 가격 설정 (10/12 ÷ 3 = 3.33/12 → 4/12) */}
        <div className="lg:col-span-4 space-y-4">
          {/* 기본 가격 설정 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h4 className="text-md font-semibold text-gray-900 mb-4">기본 가격</h4>
            
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

              {/* 홈페이지 가격 정보 (20%할인) - 초이스가 있을 때만 표시 */}
              {choiceCombinations.length > 0 && (() => {
                // 홈페이지 채널 찾기
                const homepageChannel = channelGroups
                  .flatMap(group => group.channels)
                  .find(ch => {
                    const id = ch.id?.toLowerCase() || '';
                    const name = ch.name?.toLowerCase() || '';
                    return id === 'm00001' || 
                           id === 'homepage' ||
                           name.includes('홈페이지') ||
                           name.includes('homepage') ||
                           name.includes('website') ||
                           name.includes('웹사이트');
                  });

                if (!homepageChannel) return null;

                const formatPrice = (price: number) => {
                  return `$${price.toFixed(2)}`;
                };

                return (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <h5 className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          홈페이지 가격 정보 (20%할인)
                        </h5>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
                          참고용
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl shadow-lg border border-purple-200 bg-white">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500">
                            <th className="text-center py-2 px-3 font-bold text-white text-[10px] uppercase tracking-wider border-r border-purple-400/30 w-1/3">
                              초이스
                            </th>
                            <th className="text-center py-2 px-2 font-bold text-white text-[10px] uppercase tracking-wider border-r border-purple-400/30">
                              기본
                            </th>
                            <th className="text-center py-2 px-2 font-bold text-white text-[10px] uppercase tracking-wider border-r border-purple-400/30">
                              초이스
                            </th>
                            <th className="text-center py-2 px-2 font-bold text-white text-[10px] uppercase tracking-wider border-r border-purple-400/30">
                              판매가
                            </th>
                            <th className="text-center py-2 px-2 font-bold text-white text-[10px] uppercase tracking-wider border-r border-purple-400/30">
                              Gross
                            </th>
                            <th className="text-center py-2 px-2 font-bold text-white text-[10px] uppercase tracking-wider">
                              Net
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {choiceCombinations.map((combination, index) => {
                            const combinationName = combination.combination_name_ko || combination.combination_name || combination.id;
                            
                            // 홈페이지 가격 계산
                            const baseProductPrice = {
                              adult: productBasePrice.adult || 0,
                              child: productBasePrice.child || 0,
                              infant: productBasePrice.infant || 0
                            };
                            
                            // 초이스 가격 찾기 (M00001 채널의 고정값)
                            let homepageChoiceData: any = {};
                            
                            // 1. homepagePricingConfig에서 찾기
                            if (homepagePricingConfig?.choices_pricing) {
                              homepageChoiceData = homepagePricingConfig.choices_pricing[combination.id] || 
                                                  homepagePricingConfig.choices_pricing[combination.combination_key || ''] || {};
                              
                              // 여러 키 시도
                              if ((!homepageChoiceData || Object.keys(homepageChoiceData).length === 0)) {
                                const availableKeys = Object.keys(homepagePricingConfig.choices_pricing);
                                const matchingKey = availableKeys.find(key => {
                                  return key === combination.id || 
                                         key === combination.combination_key ||
                                         (combination.combination_key && key.includes(combination.combination_key)) ||
                                         (combination.id && key.includes(combination.id));
                                });
                                if (matchingKey) {
                                  homepageChoiceData = homepagePricingConfig.choices_pricing[matchingKey];
                                }
                              }
                            }
                            
                            // 2. homepagePricingConfig에서 찾지 못한 경우, combination의 기본값 사용
                            if ((!homepageChoiceData || Object.keys(homepageChoiceData).length === 0 || 
                                 (homepageChoiceData.adult_price === 0 && homepageChoiceData.adult === 0)) && 
                                combination) {
                              homepageChoiceData = {
                                adult_price: combination.adult_price || 0,
                                child_price: combination.child_price || 0,
                                infant_price: combination.infant_price || 0
                              };
                            }
                            
                            const choicePrice = {
                              adult_price: homepageChoiceData?.adult_price || homepageChoiceData?.adult || 0,
                              child_price: homepageChoiceData?.child_price || homepageChoiceData?.child || 0,
                              infant_price: homepageChoiceData?.infant_price || homepageChoiceData?.infant || 0
                            };
                            
                            // 기본: 상품 기본가격 (마크업 적용 전)
                            const basePrice = {
                              adult: baseProductPrice.adult,
                              child: baseProductPrice.child,
                              infant: baseProductPrice.infant
                            };
                            
                            // 초이스: 초이스별 가격 (M00001 채널의 고정값)
                            const choicePriceValue = {
                              adult: choicePrice.adult_price || 0,
                              child: choicePrice.child_price || 0,
                              infant: choicePrice.infant_price || 0
                            };
                            
                            // 판매가: 상품 기본가격 + 초이스별 가격
                            const salePrice = {
                              adult: basePrice.adult + choicePriceValue.adult,
                              child: basePrice.child + choicePriceValue.child,
                              infant: basePrice.infant + choicePriceValue.infant
                            };
                            
                            // Gross: 판매가에서 20% 할인가격
                            const grossPrice = {
                              adult: salePrice.adult * 0.8,
                              child: salePrice.child * 0.8,
                              infant: salePrice.infant * 0.8
                            };
                            
                            // Net: Gross - 초이스 가격
                            const netPrice = {
                              adult: grossPrice.adult - choicePriceValue.adult,
                              child: grossPrice.child - choicePriceValue.child,
                              infant: grossPrice.infant - choicePriceValue.infant
                            };
                            
                            // 로어 앤텔롭 캐년과 엑스 앤텔롭 캐년 구분
                            const isLowerAntelope = combinationName.includes('로어') || combinationName.includes('Lower');
                            const rowBgClass = isLowerAntelope 
                              ? 'bg-gradient-to-r from-purple-50 via-purple-50/50 to-white hover:from-purple-100 hover:via-purple-100/50' 
                              : 'bg-gradient-to-r from-pink-50 via-pink-50/50 to-white hover:from-pink-100 hover:via-pink-100/50';
                            const textClass = isLowerAntelope 
                              ? 'text-purple-900 font-bold' 
                              : 'text-pink-900 font-bold';
                            const accentClass = isLowerAntelope 
                              ? 'border-l-4 border-purple-500' 
                              : 'border-l-4 border-pink-500';
                            
                            return (
                              <tr 
                                key={combination.id} 
                                className={`${rowBgClass} ${accentClass} transition-all duration-200 hover:shadow-md group`}
                              >
                                <td className={`py-2 px-3 ${textClass} text-xs font-semibold`}>
                                  <span className="leading-tight">{combinationName}</span>
                                </td>
                                <td className="py-2 px-2 text-right text-gray-700 text-xs font-medium group-hover:text-gray-900">
                                  {formatPrice(basePrice.adult)}
                                </td>
                                <td className="py-2 px-2 text-right text-gray-700 text-xs font-medium group-hover:text-gray-900">
                                  {formatPrice(choicePriceValue.adult)}
                                </td>
                                <td className="py-2 px-2 text-right text-blue-700 text-xs font-bold group-hover:text-blue-900">
                                  {formatPrice(salePrice.adult)}
                                </td>
                                <td className="py-2 px-2 text-right text-indigo-700 text-xs font-bold group-hover:text-indigo-900">
                                  {formatPrice(grossPrice.adult)}
                                </td>
                                <td className="py-2 px-2 text-right text-emerald-700 text-xs font-extrabold group-hover:text-emerald-900">
                                  {formatPrice(netPrice.adult)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}



              {/* 수수료 - 한 줄에 2개 */}
              <div className="grid grid-cols-2 gap-3">
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
                    수수료 ($)
                   </label>
                     <input
                       type="number"
                    value={(((pricingConfig as Record<string, unknown>).commission_amount as number) || 0) === 0 ? '' : ((pricingConfig as Record<string, unknown>).commission_amount as number) || 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ commission_amount: 0 });
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        handlePricingConfigUpdate({ commission_amount: numValue });
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        handlePricingConfigUpdate({ commission_amount: 0 });
                      }
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                       placeholder="0"
                     />
                 </div>
               </div>

              {/* 쿠폰 할인 및 불포함 금액 - 한 줄에 2개 */}
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
          {choiceCombinations.length > 0 && (() => {
            // OTA 채널인지 확인
            const foundChannel = selectedChannel ? channelGroups
              .flatMap(group => group.channels)
              .find(ch => ch.id === selectedChannel) : null;
            const isOTAChannel = foundChannel && (
              (foundChannel as any).type?.toLowerCase() === 'ota' || 
              (foundChannel as any).category === 'OTA'
            );
            
            // 홈페이지 채널 찾기
            const homepageChannel = channelGroups
              .flatMap(group => group.channels)
              .find(ch => {
                const id = ch.id?.toLowerCase() || '';
                const name = ch.name?.toLowerCase() || '';
                return id === 'm00001' || 
                       id === 'homepage' ||
                       name.includes('홈페이지') ||
                       name.includes('homepage') ||
                       name.includes('website') ||
                       name.includes('웹사이트');
              });
            
            return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">초이스별 가격 설정</h4>
              
              <div className="space-y-3">
                {choiceCombinations.map((combination) => {
                  // OTA 판매가 가져오기
                  const otaSalePrice = (pricingConfig.choices_pricing as any)?.[combination.id]?.ota_sale_price || 0;
                  const commissionPercent = pricingConfig.commission_percent || 0;
                  const couponPercent = pricingConfig.coupon_percent || 0;
                  
                  // 채널 설정 확인 (foundChannel 사용)
                  const commissionBasePriceOnly = (foundChannel as any)?.commission_base_price_only || false;
                  
                  // 초이스 가격 가져오기
                  const currentChoiceData = (pricingConfig.choices_pricing as any)?.[combination.id] || {};
                  
                  // 초이스별 불포함 금액 사용 (없으면 동적 가격의 기본 not_included_price 사용)
                  const choiceNotIncludedPrice = currentChoiceData.not_included_price;
                  const notIncludedPrice = choiceNotIncludedPrice !== undefined && choiceNotIncludedPrice !== null 
                    ? choiceNotIncludedPrice 
                    : ((pricingConfig as any)?.not_included_price || 0);
                  
                  // 여러 소스에서 초이스 가격 가져오기
                  let choicePrice = currentChoiceData.adult_price || 
                                   currentChoiceData.adult || 
                                   combination.adult_price || 
                                   0;
                  
                  // combination_details가 있으면 합계 계산
                  if (combination.combination_details && combination.combination_details.length > 0) {
                    const detailsTotal = combination.combination_details.reduce((sum: number, detail: any) => {
                      return sum + (detail.adult_price || 0);
                    }, 0);
                    // combination_details의 합계가 있으면 사용 (더 정확함)
                    if (detailsTotal > 0) {
                      choicePrice = detailsTotal;
                    }
                  }
                  
                  // 디버깅: 초이스 가격 확인
                  console.log('초이스 가격 계산:', {
                    combinationId: combination.id,
                    currentChoiceData,
                    combinationAdultPrice: combination.adult_price,
                    combinationDetails: combination.combination_details,
                    choicePrice,
                    commissionBasePriceOnly,
                    notIncludedPrice
                  });
                  
                  // Net Price 계산
                  let netPrice = 0;
                  if (otaSalePrice > 0) {
                    // 기본 계산: OTA 판매가 × (1 - 쿠폰 할인%) × (1 - 수수료%)
                    const baseNetPrice = otaSalePrice * (1 - couponPercent / 100) * (1 - commissionPercent / 100);
                    
                    // 불포함 금액이 있으면 항상 Net Price에 추가
                    if (notIncludedPrice > 0) {
                      netPrice = baseNetPrice + notIncludedPrice;
                    } else {
                      netPrice = baseNetPrice;
                    }
                    
                    console.log('Net Price 계산:', {
                      otaSalePrice,
                      couponPercent,
                      commissionPercent,
                      baseNetPrice,
                      notIncludedPrice,
                      netPrice
                    });
                  }
                  
                  // 홈페이지 Net Price 계산 (고정값 사용)
                  // 공통 함수 사용: 판매가 = 기본가격 + 초이스가격, Net = 판매가 * 0.8
                  let homepageNetPrice = 0;
                  let priceDifference = 0;
                  if (homepageChannel && otaSalePrice > 0) {
                    // 홈페이지 가격 정보는 M00001 채널의 고정값을 사용
                    // 직접 계산하여 디버깅 가능하도록
                    const basePrice = productBasePrice.adult || 0;
                    
                    // 초이스 가격 찾기 (M00001 채널의 고정값 우선, 없으면 combination 기본값 사용)
                    let foundChoiceData: any = {};
                    
                    // 1. homepagePricingConfig에서 찾기
                    if (homepagePricingConfig?.choices_pricing) {
                      // 직접 키로 찾기
                      foundChoiceData = homepagePricingConfig.choices_pricing[combination.id] || 
                                       homepagePricingConfig.choices_pricing[combination.combination_key || ''] || {};
                      
                      // 여러 키 시도
                      if ((!foundChoiceData || Object.keys(foundChoiceData).length === 0)) {
                        const availableKeys = Object.keys(homepagePricingConfig.choices_pricing);
                        const matchingKey = availableKeys.find(key => {
                          return key === combination.id || 
                                 key === combination.combination_key ||
                                 (combination.combination_key && key.includes(combination.combination_key)) ||
                                 (combination.id && key.includes(combination.id));
                        });
                        if (matchingKey) {
                          foundChoiceData = homepagePricingConfig.choices_pricing[matchingKey];
                        }
                      }
                    }
                    
                    // 2. homepagePricingConfig에서 찾지 못한 경우, combination의 기본값 사용
                    if ((!foundChoiceData || Object.keys(foundChoiceData).length === 0 || 
                         (foundChoiceData.adult_price === 0 && foundChoiceData.adult === 0)) && 
                        combination) {
                      foundChoiceData = {
                        adult_price: combination.adult_price || 0,
                        child_price: combination.child_price || 0,
                        infant_price: combination.infant_price || 0
                      };
                    }
                    
                    const choicePrice = foundChoiceData?.adult_price || 
                                       foundChoiceData?.adult || 
                                       0;
                    
                    // 판매가: 상품 기본가격 + 초이스별 가격
                    const salePrice = basePrice + choicePrice;
                    
                    // Net: 판매가에서 20% 할인가격 (커미션 적용 안 함)
                    homepageNetPrice = salePrice * 0.8;
                    
                    // 디버깅: 계산 값 확인
                    console.log('홈페이지 Net Price 계산:', {
                      combinationId: combination.id,
                      combinationKey: combination.combination_key,
                      basePrice,
                      choicePrice,
                      salePrice,
                      homepageNetPrice,
                      foundChoiceData,
                      homepagePricingConfigKeys: Object.keys(homepagePricingConfig?.choices_pricing || {}),
                      homepagePricingConfigSample: Object.entries(homepagePricingConfig?.choices_pricing || {}).slice(0, 3)
                    });
                    
                    // 차액 계산
                    priceDifference = netPrice - homepageNetPrice;
                  }
                  
                  return (
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
                              // 디버깅: 불필요한 로그 제거
                              // console.log(`조합 ${combination.id}의 detail ${index}:`, detail);
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
                    
                    {isOTAChannel ? (
                      // OTA 채널: OTA 판매가 입력 및 Net Price 표시
                      <div className="space-y-3">
                        {/* OTA 판매가와 불포함 금액을 같은 줄에 배치 */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              OTA 판매가 ($)
                            </label>
                            <input
                              type="number"
                              value={otaSalePrice === 0 ? '' : otaSalePrice}
                              onChange={(e) => {
                                const value = e.target.value;
                                const currentPricing = pricingConfig.choices_pricing || {};
                                const currentChoiceData = (currentPricing as unknown as Record<string, Record<string, unknown>>)[combination.id] || {};
                                
                                if (value === '' || value === '-') {
                                  // OTA 판매가만 0으로 설정, 초이스 가격은 유지
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...currentChoiceData,
                                        ota_sale_price: 0
                                      }
                                    }
                                  });
                                  return;
                                }
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue)) {
                                  // OTA 판매가만 업데이트, 초이스 가격은 유지
                                  // 주의: homepagePricingConfig는 M00001 채널의 고정값이므로 업데이트하지 않음
                                  
                                  // 초이스 가격 가져오기 (유지하기 위해)
                                  // homepagePricingConfig에서 M00001 채널의 고정 가격을 우선 사용
                                  const homepageChoiceData = homepagePricingConfig?.choices_pricing?.[combination.id] || 
                                                            homepagePricingConfig?.choices_pricing?.[combination.combination_key || ''] || {};
                                  
                                  // 현재 pricingConfig의 가격이 있으면 사용, 없으면 homepagePricingConfig 사용
                                  // homepagePricingConfig는 M00001 채널의 고정값이므로 우선순위를 높임
                                  const adultPrice = (currentChoiceData.adult_price as number) || 
                                                   (currentChoiceData.adult as number) || 
                                                   (homepageChoiceData.adult_price as number) ||
                                                   (homepageChoiceData.adult as number) ||
                                                   combination.adult_price || 0;
                                  const childPrice = (currentChoiceData.child_price as number) || 
                                                   (currentChoiceData.child as number) || 
                                                   (homepageChoiceData.child_price as number) ||
                                                   (homepageChoiceData.child as number) ||
                                                   combination.child_price || 0;
                                  const infantPrice = (currentChoiceData.infant_price as number) || 
                                                    (currentChoiceData.infant as number) || 
                                                    (homepageChoiceData.infant_price as number) ||
                                                    (homepageChoiceData.infant as number) ||
                                                    combination.infant_price || 0;
                                  
                                  // OTA 판매가와 함께 초이스 가격도 유지하여 업데이트
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...currentChoiceData,
                                        adult_price: adultPrice,
                                        child_price: childPrice,
                                        infant_price: infantPrice,
                                        ota_sale_price: numValue
                                      }
                                    }
                                  });
                                  
                                  // 실시간 가격 계산을 위한 calculationConfig.choicePricing도 업데이트
                                  updateChoicePricing(combination.id, {
                                    choiceId: combination.id,
                                    choiceName: combination.combination_name,
                                    adult_price: adultPrice,
                                    child_price: childPrice,
                                    infant_price: infantPrice
                                  });
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value;
                                if (value === '' || value === '-') {
                                  const currentPricing = pricingConfig.choices_pricing || {};
                                  const currentChoiceData = (currentPricing as unknown as Record<string, Record<string, unknown>>)[combination.id] || {};
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...currentChoiceData,
                                        ota_sale_price: 0
                                      }
                                    }
                                  });
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="예: 384"
                            />
                          </div>
                          {/* 불포함 금액 입력 필드 */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              불포함 금액 ($)
                            </label>
                            <input
                              type="number"
                              value={notIncludedPrice === 0 ? '' : notIncludedPrice}
                              onChange={(e) => {
                                const value = e.target.value;
                                const currentPricing = pricingConfig.choices_pricing || {};
                                const currentChoiceData = (currentPricing as unknown as Record<string, Record<string, unknown>>)[combination.id] || {};
                                
                                if (value === '' || value === '-') {
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...currentChoiceData,
                                        not_included_price: 0
                                      }
                                    }
                                  });
                                  return;
                                }
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue) && numValue >= 0) {
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...currentChoiceData,
                                        not_included_price: numValue
                                      }
                                    }
                                  });
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </div>
                        {otaSalePrice > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-2">
                            <div className="text-xs text-gray-600 mb-1">
                              <div>수수료: {commissionPercent}%</div>
                              <div>쿠폰 할인: {couponPercent}%</div>
                            </div>
                            {/* 불포함 금액 표시 (Net Price 위로 이동) */}
                            {notIncludedPrice > 0 && (
                              <div className="text-sm font-semibold text-orange-600 mb-1">
                                불포함 금액: 
                                <span className="ml-2">${notIncludedPrice.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="text-sm font-semibold text-blue-900 mb-1">
                              Net Price: ${netPrice.toFixed(2)}
                              {homepageNetPrice > 0 && (
                                <span className={`ml-2 text-xs ${priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  (홈페이지: ${homepageNetPrice.toFixed(2)}, 차액: {priceDifference >= 0 ? '+' : ''}${priceDifference.toFixed(2)})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {notIncludedPrice > 0 ? (
                                <>
                                  계산식: ${otaSalePrice.toFixed(2)} × (1 - {couponPercent}%) × (1 - {commissionPercent}%) + ${notIncludedPrice.toFixed(2)} (불포함) = ${netPrice.toFixed(2)}
                                </>
                              ) : (
                                <>
                                  계산식: ${otaSalePrice.toFixed(2)} × (1 - {couponPercent}%) × (1 - {commissionPercent}%) = ${netPrice.toFixed(2)}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // 일반 채널: 기존 가격 입력 필드
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
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
            );
          })()}

          {/* 저장 컨트롤 */}
          <PricingControls
            saving={saving}
            saveMessage={saveMessage}
            onSave={handleSavePricingRule}
            canSave={canSave}
            batchProgress={batchProgress}
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
        onSave={async () => {
          await loadDynamicPricingData();
          await loadChannelPricingStats();
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
