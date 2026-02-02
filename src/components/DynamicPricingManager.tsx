'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Calendar,
  List,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SimplePricingRuleDto, SimplePricingRule, DateRangeSelection } from '@/lib/types/dynamic-pricing';

// 커스텀 훅들
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { useChannelManagement } from '@/hooks/useChannelManagement';
import { useChoiceManagement } from '@/hooks/useChoiceManagement';
import { usePricingData } from '@/hooks/usePricingData';
import { usePriceCalculation } from '@/hooks/usePriceCalculation';
import { findHomepageChoiceData } from '@/utils/homepagePriceCalculator';
import { getOtaSalePriceWithFallback } from '@/utils/choicePricingMatcher';

// UI 컴포넌트들
import { ChannelSelector } from './dynamic-pricing/ChannelSelector';
import { PricingCalendar } from './dynamic-pricing/PricingCalendar';
import { PricingListView } from './dynamic-pricing/PricingListView';
import { PricingControls } from './dynamic-pricing/PricingControls';
import { DateRangeSelector } from './dynamic-pricing/DateRangeSelector';
import { PriceCalculator } from './dynamic-pricing/PriceCalculator';
import { SaleStatusModal } from './dynamic-pricing/SaleStatusModal';
import BulkPricingTableModal from './dynamic-pricing/BulkPricingTableModal';
import PricingHistoryModal from './dynamic-pricing/PricingHistoryModal';
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
  const t = useTranslations('products.dynamicPricingPage');
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
  
  // 가격 히스토리 모달 상태
  const [isPricingHistoryModalOpen, setIsPricingHistoryModalOpen] = useState(false);
  const [pricingHistoryDate, setPricingHistoryDate] = useState<string>('');
  
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
    deletePricingRulesByDates,
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
    currentCalculation
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

  // Variant 관리 상태
  const [selectedVariant, setSelectedVariant] = useState<string>('default');
  const [productVariants, setProductVariants] = useState<Array<{
    variant_key: string;
    variant_name_ko?: string | null;
    variant_name_en?: string | null;
  }>>([]);

  // 채널별 포함/불포함 내역 상태
  const [channelIncludedNotIncluded, setChannelIncludedNotIncluded] = useState<{
    included_ko: string;
    included_en: string;
    not_included_ko: string;
    not_included_en: string;
  }>({
    included_ko: '',
    included_en: '',
    not_included_ko: '',
    not_included_en: ''
  });

  // 해당 채널 쿠폰 목록 (캘린더 쿠폰 선택기용)
  const [channelCoupons, setChannelCoupons] = useState<Array<{
    id: string;
    coupon_code: string;
    percentage_value?: number | null;
    fixed_value?: number | null;
    discount_type?: string | null;
  }>>([]);

  // Variant 목록 불러오기 (선택한 채널의 channel_products만 조회, 채널 전환 시 이전 요청 무시)
  useEffect(() => {
    let cancelled = false;

    const loadProductVariants = async () => {
      if (!productId || !selectedChannel) {
        if (!cancelled) {
          setProductVariants([]);
          setSelectedVariant('default');
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('channel_products')
          .select('variant_key, variant_name_ko, variant_name_en')
          .eq('product_id', productId)
          .eq('channel_id', selectedChannel)
          .eq('is_active', true)
          .order('variant_key');

        // 채널 전환으로 이 effect가 정리됐으면 이 응답 무시 (다른 채널 variant가 선택지에 섞이지 않도록)
        if (cancelled) {
          return;
        }

        if (error) {
          console.error('Variant 목록 로드 실패:', error);
          setProductVariants([]);
          return;
        }

        const variants = ((data || []) as any[]).map((item: any) => ({
          variant_key: item.variant_key || 'default',
          variant_name_ko: item.variant_name_ko,
          variant_name_en: item.variant_name_en
        }));

        setProductVariants(variants.length > 0 ? variants : [{ variant_key: 'default' }]);
        
        // 기본 variant가 없으면 'default'로 설정
        if (variants.length > 0 && !variants.find(v => v.variant_key === 'default')) {
          setSelectedVariant(variants[0].variant_key);
        } else {
          setSelectedVariant('default');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Variant 목록 로드 중 오류:', error);
          setProductVariants([{ variant_key: 'default' }]);
          setSelectedVariant('default');
        }
      }
    };

    loadProductVariants();
    return () => {
      cancelled = true;
    };
  }, [productId, selectedChannel]);

  // 해당 채널 쿠폰 목록 로드 (캘린더 상단 쿠폰 선택기)
  useEffect(() => {
    if (!selectedChannel) {
      setChannelCoupons([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('id, coupon_code, percentage_value, fixed_value, discount_type')
        .eq('status', 'active')
        .or(`channel_id.is.null,channel_id.eq.${selectedChannel}`);
      if (cancelled) return;
      if (error) {
        console.warn('채널 쿠폰 로드 실패:', error);
        setChannelCoupons([]);
        return;
      }
      setChannelCoupons((data || []).map((r: any) => ({
        id: r.id,
        coupon_code: r.coupon_code ?? '',
        percentage_value: r.percentage_value,
        fixed_value: r.fixed_value,
        discount_type: r.discount_type
      })));
    })();
    return () => { cancelled = true; };
  }, [selectedChannel]);

  // 채널별 포함/불포함 내역 불러오기
  useEffect(() => {
    const loadChannelIncludedNotIncluded = async () => {
      if (!productId || !selectedChannel) {
        setChannelIncludedNotIncluded({
          included_ko: '',
          included_en: '',
          not_included_ko: '',
          not_included_en: ''
        });
        return;
      }

      try {
        // 채널 타입 확인 (self 채널은 'SELF_GROUP'으로 조회)
        const channel = channelGroups
          .flatMap(group => group.channels)
          .find(ch => ch.id === selectedChannel);
        
        const channelId = channel?.type === 'self' || channel?.type === 'SELF' 
          ? 'SELF_GROUP' 
          : selectedChannel;

        // 한국어와 영어 데이터 가져오기
        const [koData, enData] = await Promise.all([
          supabase
            .from('product_details_multilingual')
            .select('included, not_included')
            .eq('product_id', productId)
            .eq('channel_id', channelId)
            .eq('language_code', 'ko')
            .eq('variant_key', selectedVariant)
            .maybeSingle(),
          supabase
            .from('product_details_multilingual')
            .select('included, not_included')
            .eq('product_id', productId)
            .eq('channel_id', channelId)
            .eq('language_code', 'en')
            .eq('variant_key', selectedVariant)
            .maybeSingle()
        ]);

        setChannelIncludedNotIncluded({
          included_ko: (koData.data as any)?.included || '',
          included_en: (enData.data as any)?.included || '',
          not_included_ko: (koData.data as any)?.not_included || '',
          not_included_en: (enData.data as any)?.not_included || ''
        });
      } catch (error) {
        console.error('채널별 포함/불포함 내역 로드 오류:', error);
        setChannelIncludedNotIncluded({
          included_ko: '',
          included_en: '',
          not_included_ko: '',
          not_included_en: ''
        });
      }
    };

    loadChannelIncludedNotIncluded();
  }, [productId, selectedChannel, selectedVariant, channelGroups]);

  // 채널별 포함/불포함 내역 저장
  const saveChannelIncludedNotIncluded = async () => {
    if (!productId || !selectedChannel) return;

    try {
      const channel = channelGroups
        .flatMap(group => group.channels)
        .find(ch => ch.id === selectedChannel);
      
      const channelId = channel?.type === 'self' || channel?.type === 'SELF' 
        ? 'SELF_GROUP' 
        : selectedChannel;

      // 한국어와 영어 데이터 저장
      const savePromises = [
        // 한국어
        (async () => {
          const existingKoResult = await supabase
            .from('product_details_multilingual')
            .select('id')
            .eq('product_id', productId)
            .eq('channel_id', channelId)
            .eq('language_code', 'ko')
            .eq('variant_key', selectedVariant)
            .maybeSingle() as { data: { id: string } | null; error: { code?: string } | null };

          if (existingKoResult.error && existingKoResult.error.code !== 'PGRST116') {
            throw existingKoResult.error;
          }

          const existingKo = existingKoResult.data;

          const koData = {
            included: channelIncludedNotIncluded.included_ko || null,
            not_included: channelIncludedNotIncluded.not_included_ko || null,
            updated_at: new Date().toISOString()
          };

          if (existingKo) {
            const { error: updateError } = await (supabase as any)
              .from('product_details_multilingual')
              .update(koData)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .eq('id', (existingKo as any).id);
            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await (supabase as any)
              .from('product_details_multilingual')
              .insert([{
                product_id: productId,
                channel_id: channelId,
                language_code: 'ko',
                variant_key: selectedVariant,
                ...koData
              }]);
            if (insertError) throw insertError;
          }
        })(),
        // 영어
        (async () => {
          const existingEnResult = await supabase
            .from('product_details_multilingual')
            .select('id')
            .eq('product_id', productId)
            .eq('channel_id', channelId)
            .eq('language_code', 'en')
            .eq('variant_key', selectedVariant)
            .maybeSingle() as { data: { id: string } | null; error: { code?: string } | null };

          if (existingEnResult.error && existingEnResult.error.code !== 'PGRST116') {
            throw existingEnResult.error;
          }

          const existingEn = existingEnResult.data;

          const enData = {
            included: channelIncludedNotIncluded.included_en || null,
            not_included: channelIncludedNotIncluded.not_included_en || null,
            updated_at: new Date().toISOString()
          };

          if (existingEn) {
            const { error: updateError } = await supabase
              .from('product_details_multilingual')
              .update(enData)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .eq('id', (existingEn as any).id);
            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await (supabase as any)
              .from('product_details_multilingual')
              .insert([{
                product_id: productId,
                channel_id: channelId,
                language_code: 'en',
                variant_key: selectedVariant,
                ...enData
              }]);
            if (insertError) throw insertError;
          }
        })()
      ];

      await Promise.all(savePromises);
      setMessage(t('includedExcludedSaved'));
    } catch (error) {
      console.error('포함/불포함 내역 저장 오류:', error);
      setMessage(t('includedExcludedSaveError'));
    }
  };

  // 홈페이지 가격 타입 상태
  const [homepagePricingType, setHomepagePricingType] = useState<'single' | 'separate'>('separate');

  // 상품 sub_category 상태
  const [productSubCategory, setProductSubCategory] = useState<string | null>(null);
  
  // 홈페이지 가격 정보 테이블 접기/펼치기 상태
  const [isHomepagePriceTableExpanded, setIsHomepagePriceTableExpanded] = useState(false);

  // 상품 기본 가격 및 홈페이지 가격 타입 불러오기
  useEffect(() => {
    const loadProductBasePrice = async () => {
      if (!productId) return;
      
      try {
        const { data, error } = await supabase
          .from('products')
          .select('adult_base_price, child_base_price, infant_base_price, homepage_pricing_type, sub_category')
          .eq('id', productId)
          .single();

        if (error) throw error;

        setProductBasePrice({
          adult: (data as any)?.adult_base_price || 0,
          child: (data as any)?.child_base_price || 0,
          infant: (data as any)?.infant_base_price || 0
        });
        
        // 홈페이지 가격 타입 설정
        setHomepagePricingType((data as any)?.homepage_pricing_type || 'separate');
        
        // sub_category 설정
        setProductSubCategory((data as any)?.sub_category || null);
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
        if (!data || !(data as any).choices_pricing) {
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
            const processedData = fallbackData as any;
            
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
          const dataAny = data as any;
          // choices_pricing이 문자열인 경우 파싱
          let choicesPricing = dataAny.choices_pricing;
          if (typeof choicesPricing === 'string') {
            try {
              choicesPricing = JSON.parse(choicesPricing);
            } catch (e) {
              console.error('choices_pricing 파싱 오류:', e);
              choicesPricing = {};
            }
          }
          
          console.log('✅ 홈페이지 가격 설정 로드 성공 (M00001):', {
            markup_amount: dataAny.markup_amount,
            markup_percent: dataAny.markup_percent,
            choices_pricing_keys: Object.keys(choicesPricing || {}),
            choices_pricing_sample: Object.entries(choicesPricing || {}).slice(0, 2),
            date: dataAny.date
          });
          
          setHomepagePricingConfig({
            markup_amount: dataAny.markup_amount || 0,
            markup_percent: dataAny.markup_percent || 0,
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
    
    // 요일이 선택되지 않은 경우 처리
    if (!selection.selectedDays || selection.selectedDays.length === 0) {
      console.warn('요일이 선택되지 않았습니다. 날짜를 선택할 수 없습니다.');
      setSelectedDates([]);
      return;
    }
    
    // 모든 요일이 선택된 경우 (7개) - 전체 기간 저장
    // const allDaysSelected = selection.selectedDays.length === 7 && 
    //   selection.selectedDays.every(day => [0, 1, 2, 3, 4, 5, 6].includes(day));
    
    // 날짜 문자열을 직접 파싱하여 시간대 문제 방지
    const [startYear, startMonth, startDay] = selection.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = selection.endDate.split('-').map(Number);
    
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);
    
    // 디버깅: 선택된 요일 확인
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const selectedDayNames = selection.selectedDays.map(day => dayNames[day]).join(', ');
    console.log('날짜 범위 선택:', {
      startDate: selection.startDate,
      endDate: selection.endDate,
      selectedDays: selection.selectedDays,
      selectedDayNames
    });
    
    // 날짜를 로컬 시간대로 처리하여 시간대 변환 문제 방지
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      if (selection.selectedDays.includes(dayOfWeek)) {
        // 로컬 시간대 기준으로 날짜 문자열 생성 (YYYY-MM-DD)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
      }
    }
    
    console.log('필터링된 날짜:', dates);
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
      Object.entries(pricingConfig.choices_pricing as Record<string, any>).forEach(([choiceId, choiceData]) => {
        const choiceDataTyped = choiceData as any;
        if (choiceDataTyped && typeof choiceDataTyped === 'object') {
          const adultPrice = (choiceDataTyped as Record<string, unknown>).adult as number || 
                           (choiceDataTyped as Record<string, unknown>).adult_price as number || 0;
          const childPrice = (choiceDataTyped as Record<string, unknown>).child as number || 
                           (choiceDataTyped as Record<string, unknown>).child_price as number || 0;
          const infantPrice = (choiceDataTyped as Record<string, unknown>).infant as number || 
                            (choiceDataTyped as Record<string, unknown>).infant_price as number || 0;
          
          // 초이스 조합 가격 업데이트
          updateChoiceCombinationPrice(choiceId, 'adult_price', adultPrice);
          updateChoiceCombinationPrice(choiceId, 'child_price', childPrice);
          updateChoiceCombinationPrice(choiceId, 'infant_price', infantPrice);
          
          // 실시간 가격 계산을 위한 calculationConfig.choicePricing 업데이트
          // 주의: homepagePricingConfig에서 M00001 채널의 고정 가격을 우선 사용
          const combination = choiceCombinations.find(c => c.id === choiceId);
          if (combination) {
            // homepagePricingConfig에서 여러 키로 시도하여 가격 찾기 (유연한 매칭)
            const homepageChoiceData = homepagePricingConfig 
              ? findHomepageChoiceData(combination, homepagePricingConfig)
              : {};
            
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
          // homepagePricingConfig에서 여러 키로 시도하여 가격 찾기 (유연한 매칭)
          const homepageChoiceData = findHomepageChoiceData(combination, homepagePricingConfig);
          
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
    if (!productId) {
      setChannelPricingStats({});
      return;
    }

    try {
      // dynamic_pricing 테이블에서 채널별 날짜 개수 가져오기 (채널 정보도 JOIN)
      // 모든 데이터를 가져오기 위해 limit을 크게 설정
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('dynamic_pricing')
          .select('channel_id, date, channels(id, name)')
          .eq('product_id', productId)
          .range(from, from + pageSize - 1);

        if (error) {
          console.error('채널별 가격 통계 로드 오류:', error);
          setChannelPricingStats({});
          return;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === pageSize;
          from += pageSize;
        } else {
          hasMore = false;
        }
      }

      const data = allData;

      if (!data || data.length === 0) {
        console.log('동적 가격 데이터가 없습니다.');
        setChannelPricingStats({});
        return;
      }

      // 채널별로 고유한 channel_id 추출 (디버깅용)
      const uniqueChannelIds = new Set(data.map(item => item.channel_id).filter(Boolean));
      const channelInfo = data
        .filter(item => item.channel_id && item.channels)
        .map(item => ({
          id: item.channel_id,
          name: (item.channels as any)?.name || '알 수 없음'
        }))
        .reduce((acc, curr) => {
          if (!acc[curr.id]) {
            acc[curr.id] = curr.name;
          }
          return acc;
        }, {} as Record<string, string>);
      
      console.log('dynamic_pricing에 있는 채널 ID들:', Array.from(uniqueChannelIds));
      console.log('dynamic_pricing 채널 정보:', channelInfo);

      // 채널별, 연도별로 고유한 날짜 개수 계산
      // 같은 채널, 같은 날짜에 여러 레코드가 있어도 하나로 카운트
      const stats: Record<string, Record<string, Set<string>>> = {};
      
      data.forEach((item) => {
        const channelId = item.channel_id;
        const date = item.date;
        
        // channel_id와 date가 없으면 건너뛰기
        if (!channelId || !date) {
          return;
        }

        // date에서 연도 추출
        let year: string | null = null;
        
        // 문자열로 변환
        const dateStr = String(date).trim();
        
        // YYYY-MM-DD 형식에서 연도 추출
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          year = dateStr.substring(0, 4);
        }
        // YYYY/MM/DD 형식에서 연도 추출
        else if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}/)) {
          year = dateStr.substring(0, 4);
        }
        // Date 객체인 경우
        else {
          try {
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
              year = String(dateObj.getFullYear());
            }
          } catch (e) {
            // 파싱 실패
          }
        }

        if (!year || year.length !== 4) {
          return;
        }

        // channel_id를 문자열로 정규화 (대소문자 통일)
        const normalizedChannelId = String(channelId).trim();
        // 원본 ID와 소문자 버전 모두 저장
        const lowerChannelId = normalizedChannelId.toLowerCase();

        // 통계 구조 초기화 (원본 ID로 저장)
        if (!stats[normalizedChannelId]) {
          stats[normalizedChannelId] = {};
        }
        if (!stats[normalizedChannelId][year]) {
          stats[normalizedChannelId][year] = new Set();
        }
        
        // 날짜를 Set에 추가 (중복 자동 제거)
        // 같은 날짜에 dynamic과 base가 모두 있어도 하나로 카운트됨
        stats[normalizedChannelId][year].add(dateStr);
        
        // 소문자 버전도 저장 (대소문자 구분 없이 매칭하기 위해)
        if (lowerChannelId !== normalizedChannelId) {
          if (!stats[lowerChannelId]) {
            stats[lowerChannelId] = {};
          }
          if (!stats[lowerChannelId][year]) {
            stats[lowerChannelId][year] = new Set();
          }
          stats[lowerChannelId][year].add(dateStr);
        }
      });

      // Set을 개수로 변환
      const formattedStats: Record<string, Record<string, number>> = {};
      Object.keys(stats).forEach(channelId => {
        formattedStats[channelId] = {};
        Object.keys(stats[channelId]).forEach(year => {
          formattedStats[channelId][year] = stats[channelId][year].size;
        });
      });

      // 채널 이름으로도 매칭 가능하도록 추가
      // dynamic_pricing에 있는 채널 이름을 키로 사용
      const statsByName: Record<string, Record<string, number>> = {};
      Object.keys(formattedStats).forEach(channelId => {
        const channelName = channelInfo[channelId];
        if (channelName) {
          // 채널 이름을 여러 형식으로 정규화해서 저장
          const normalizedName1 = channelName.toLowerCase().trim();
          const normalizedName2 = channelName
            .toLowerCase()
            .trim()
            .replace(/[()]/g, '') // 괄호 제거
            .replace(/\s+/g, ' '); // 여러 공백을 하나로
          
          statsByName[normalizedName1] = formattedStats[channelId];
          if (normalizedName2 !== normalizedName1) {
            statsByName[normalizedName2] = formattedStats[channelId];
          }
        }
      });

      // ID와 이름 모두 포함한 통계
      const allStats = {
        ...formattedStats,
        ...statsByName
      };

      console.log('채널별 가격 통계 계산 완료:', {
        totalRecords: data.length,
        uniqueChannelIds: Array.from(uniqueChannelIds),
        statsChannelIds: Object.keys(formattedStats),
        statsByName: Object.keys(statsByName),
        stats: formattedStats,
        allStats: allStats,
        note: `총 ${data.length}개 레코드 처리됨`
      });

      setChannelPricingStats(allStats);
    } catch (error) {
      console.error('채널별 가격 통계 로드 오류:', error);
      setChannelPricingStats({});
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
          // 로컬 시간대 기준으로 날짜 문자열 생성 (YYYY-MM-DD)
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const dateString = `${year}-${month}-${day}`;
          
          const ruleData: Partial<SimplePricingRuleDto> = {
            product_id: productId,
            channel_id: channelId,
            date: dateString,
            variant_key: selectedVariant, // variant_key 추가
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
      setMessage(t('msgSaleStatusSaved', { count: dates.length, status: status === 'sale' ? t('onSale') : t('saleStopped') }) + choiceStatusMsg);
      
      // 데이터 새로고침
      await loadDynamicPricingData();
    } catch (error) {
      console.error('판매 상태 저장 실패:', error);
      setMessage(t('saveFailed'));
    }
  }, [selectedChannelType, selectedChannel, channelGroups, productId, choiceCombinations, savePricingRule, setMessage, loadDynamicPricingData]);

  // 가격 규칙 저장 핸들러
  const handleSavePricingRule = useCallback(async () => {
    if (selectedDates.length === 0 || (!selectedChannelType && !selectedChannel)) {
      setMessage('날짜와 채널을 선택해주세요.');
      return;
    }

    // 저장 시작 메시지
    setMessage(t('savingRules'));

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

        // 초이스별 가격 데이터 수집 (나중에 기존 레코드와 병합)
        const allChoicesPricing: Record<string, { adult_price?: number; child_price?: number; infant_price?: number; ota_sale_price?: number; not_included_price?: number; }> = {};
        
        // calculationConfig.choicePricing에서 기본 가격 정보 가져오기 (나중에 병합할 때 사용)
        // 실제로는 아래에서 기존 레코드와 현재 입력값을 병합할 때 사용됨
        
        // 선택된 채널의 pricing_type 확인 (기존 레코드 로드 전에 확인)
        let foundChannel = null;
        for (const group of channelGroups) {
          foundChannel = group.channels.find(ch => ch.id === channelId);
          if (foundChannel) break;
        }
        const channelPricingType = (foundChannel as any)?.pricing_type || 'separate';
        const isChannelSinglePrice = channelPricingType === 'single';
        
        // 기존 저장된 레코드에서 초이스 가격 정보 가져오기 (같은 날짜, 같은 채널, 같은 variant)
        const existingChoices: Record<string, any> = {};
        
        try {
          const { data: existingRules } = await supabase
            .from('dynamic_pricing')
            .select('choices_pricing')
            .eq('product_id', productId)
            .eq('channel_id', channelId)
            .eq('date', date)
            .eq('variant_key', selectedVariant || 'default');
          
          if (existingRules && existingRules.length > 0) {
            existingRules.forEach((existingRule: any) => {
              let existingChoicesPricing: Record<string, any> = {};
              if (existingRule.choices_pricing) {
                try {
                  existingChoicesPricing = typeof existingRule.choices_pricing === 'string'
                    ? JSON.parse(existingRule.choices_pricing)
                    : existingRule.choices_pricing;
                } catch (e) {
                  console.warn('기존 choices_pricing 파싱 오류:', e);
                }
              }
              
              // 모든 초이스를 통합하여 저장 (price_type 구분 없음)
              // 모든 채널에서 ota_sale_price와 not_included_price만 저장 (adult_price, child_price, infant_price는 제거)
              Object.entries(existingChoicesPricing).forEach(([choiceId, choiceData]: [string, any]) => {
                const cleanedData: { ota_sale_price?: number; not_included_price?: number } = {};
                if (choiceData.ota_sale_price !== undefined && choiceData.ota_sale_price !== null) {
                  cleanedData.ota_sale_price = choiceData.ota_sale_price;
                }
                if (choiceData.not_included_price !== undefined && choiceData.not_included_price !== null) {
                  cleanedData.not_included_price = choiceData.not_included_price;
                }
                if (Object.keys(cleanedData).length > 0) {
                  existingChoices[choiceId] = cleanedData;
                }
              });
            });
          }
        } catch (e) {
          console.warn('기존 레코드 로드 오류:', e);
        }
        
        // 2. 현재 입력된 초이스 가격 정보 (pricingConfig.choices_pricing)
        const currentInputChoices: Record<string, any> = {};
        if (pricingConfig.choices_pricing && typeof pricingConfig.choices_pricing === 'object') {
          Object.assign(currentInputChoices, pricingConfig.choices_pricing);
        }
        
        // 3. 모든 초이스를 하나로 합치기 (기존 + 현재 입력)
        // 기존 초이스를 먼저 추가하고, adult_price, child_price, infant_price는 제거하고 ota_sale_price와 not_included_price만 유지
        Object.entries(existingChoices).forEach(([choiceId, choiceData]) => {
          const cleanedData: { ota_sale_price?: number; not_included_price?: number } = {};
          if (choiceData.ota_sale_price !== undefined && choiceData.ota_sale_price !== null) {
            cleanedData.ota_sale_price = choiceData.ota_sale_price;
          }
          if (choiceData.not_included_price !== undefined && choiceData.not_included_price !== null) {
            cleanedData.not_included_price = choiceData.not_included_price;
          }
          if (Object.keys(cleanedData).length > 0) {
            allChoicesPricing[choiceId] = cleanedData as any;
          }
        });
        
        // 현재 입력값으로 덮어쓰기 (현재 입력값이 우선)
        // 모든 채널에서 OTA 판매가와 불포함 금액만 저장 (adult_price, child_price, infant_price는 저장하지 않음)
        Object.entries(currentInputChoices).forEach(([choiceId, choiceData]) => {
          const cleanedChoiceData: any = {};
          
          // OTA 판매가가 있으면 포함
          if (choiceData.ota_sale_price !== undefined && choiceData.ota_sale_price !== null && choiceData.ota_sale_price > 0) {
            cleanedChoiceData.ota_sale_price = choiceData.ota_sale_price;
          }
          
          // 불포함 가격이 있으면 포함 (0이어도 명시적으로 입력한 경우 포함)
          if (choiceData.not_included_price !== undefined && choiceData.not_included_price !== null) {
            cleanedChoiceData.not_included_price = choiceData.not_included_price;
          }
          
          // 기존 데이터와 병합 (기존 데이터의 OTA 판매가와 불포함 가격만 유지)
          if (Object.keys(cleanedChoiceData).length > 0) {
            const mergedData: any = { ...cleanedChoiceData };
            // 기존 데이터에서 OTA 판매가와 불포함 가격만 가져오기
            if (allChoicesPricing[choiceId]) {
              if (allChoicesPricing[choiceId].ota_sale_price && !cleanedChoiceData.ota_sale_price) {
                mergedData.ota_sale_price = allChoicesPricing[choiceId].ota_sale_price;
              }
              if (allChoicesPricing[choiceId].not_included_price !== undefined && cleanedChoiceData.not_included_price === undefined) {
                mergedData.not_included_price = allChoicesPricing[choiceId].not_included_price;
              }
            }
            allChoicesPricing[choiceId] = mergedData;
          } else if (allChoicesPricing[choiceId]) {
            // 입력값이 없어도 기존 데이터는 유지 (OTA 판매가와 불포함 가격만)
            const existingData = allChoicesPricing[choiceId];
            const cleanedData: { ota_sale_price?: number; not_included_price?: number } = {};
            if (existingData.ota_sale_price !== undefined && existingData.ota_sale_price !== null) {
              cleanedData.ota_sale_price = existingData.ota_sale_price;
            }
            if (existingData.not_included_price !== undefined && existingData.not_included_price !== null) {
              cleanedData.not_included_price = existingData.not_included_price;
            }
            if (Object.keys(cleanedData).length > 0) {
              allChoicesPricing[choiceId] = cleanedData as any;
            } else {
              delete allChoicesPricing[choiceId];
            }
          }
        });
        
        // calculationConfig.choicePricing에서 기본 가격 정보는 추가하지 않음
        // 사용자가 명시적으로 입력한 값만 저장
        
        // 디버깅: 통합된 초이스 확인
        console.log('초이스 통합 결과:', {
          date,
          channel_id: channelId,
          choicesCount: Object.keys(allChoicesPricing).length,
          choices: Object.keys(allChoicesPricing),
          existingCount: Object.keys(existingChoices).length,
          currentInputCount: Object.keys(currentInputChoices).length
        });
        
        // 공통 필드
        const commonFields = {
          product_id: productId,
          channel_id: channelId,
          date,
          variant_key: selectedVariant, // variant_key 추가
          adult_price: productBasePrice.adult + priceAdjustmentAdult,
          child_price: productBasePrice.child + priceAdjustmentChild,
          infant_price: productBasePrice.infant + priceAdjustmentInfant,
          commission_percent: pricingConfig.commission_percent,
          markup_amount: pricingConfig.markup_amount,
          coupon_percent: pricingConfig.coupon_percent,
          is_sale_available: pricingConfig.is_sale_available !== undefined ? pricingConfig.is_sale_available : true,
          markup_percent: ((pricingConfig as Record<string, unknown>).markup_percent as number) || 0,
          price_adjustment_adult: priceAdjustmentAdult,
          price_adjustment_child: priceAdjustmentChild,
          price_adjustment_infant: priceAdjustmentInfant,
          inclusions_ko: ((pricingConfig as Record<string, unknown>).inclusions_ko as string) || null,
          exclusions_ko: ((pricingConfig as Record<string, unknown>).exclusions_ko as string) || null,
          inclusions_en: ((pricingConfig as Record<string, unknown>).inclusions_en as string) || null,
          exclusions_en: ((pricingConfig as Record<string, unknown>).exclusions_en as string) || null,
        };
        
        // 모든 초이스를 하나의 레코드에 저장 (price_type 구분 없음)
        const notIncludedPrice = ((pricingConfig as Record<string, unknown>).not_included_price as number) || 0;
        
        // no_choice 키가 있는지 확인 (초이스가 없는 상품의 OTA 판매가 및 불포함 금액)
        const noChoiceKey = 'no_choice';
        const noChoiceData = (pricingConfig.choices_pricing as any)?.[noChoiceKey];
        
        // no_choice 데이터가 있으면 allChoicesPricing에 포함 (ota_sale_price와 not_included_price만 저장)
        if (noChoiceData && Object.keys(allChoicesPricing).length === 0) {
          const noChoiceNotIncludedPrice = noChoiceData.not_included_price !== undefined && noChoiceData.not_included_price !== null
            ? noChoiceData.not_included_price
            : notIncludedPrice;
          
          const noChoiceCleanedData: { ota_sale_price?: number; not_included_price?: number } = {};
          
          // OTA 판매가가 있으면 choices_pricing에 포함
          if (noChoiceData.ota_sale_price !== undefined && noChoiceData.ota_sale_price !== null && noChoiceData.ota_sale_price > 0) {
            noChoiceCleanedData.ota_sale_price = noChoiceData.ota_sale_price;
          }
          
          // 불포함 금액이 있으면 choices_pricing에 포함
          if (noChoiceNotIncludedPrice !== undefined && noChoiceNotIncludedPrice !== null) {
            noChoiceCleanedData.not_included_price = noChoiceNotIncludedPrice;
          }
          
          if (Object.keys(noChoiceCleanedData).length > 0) {
            allChoicesPricing[noChoiceKey] = noChoiceCleanedData;
          }
        }
        
        // 하나의 레코드만 생성 (price_type은 'dynamic'으로 고정, 불포함 금액은 초이스별로 관리)
        // 단일 가격 채널의 경우 adult_price, child_price, infant_price가 없을 수 있으므로 타입 단언 사용
        const ruleData = {
          ...commonFields,
          price_type: 'dynamic' as const, // 항상 'dynamic'으로 설정
          not_included_price: notIncludedPrice,
          choices_pricing: allChoicesPricing
        } as SimplePricingRuleDto;
        rulesData.push(ruleData);
        
        console.log('저장할 레코드:', {
          date: ruleData.date,
          channel_id: ruleData.channel_id,
          variant_key: ruleData.variant_key,
          price_type: ruleData.price_type,
          choicesCount: Object.keys(allChoicesPricing).length,
          choices: Object.keys(allChoicesPricing)
        });
      }
    }

    // 디버깅: 저장할 규칙 개수 확인
    console.log('저장할 규칙 개수:', rulesData.length, {
      rules: rulesData.map(r => ({
        date: r.date,
        channel_id: r.channel_id,
        price_type: r.price_type,
        choicesCount: Object.keys(r.choices_pricing || {}).length
      }))
    });

    // 저장할 규칙이 없으면 메시지 표시
    if (rulesData.length === 0) {
      setMessage(t('noRulesToSave'));
      return;
    }

    try {
      // 규칙이 5개 이상이면 배치 저장 사용 (자체 채널이든 OTA 채널이든 상관없이)
      // 불포함 금액이나 choices_pricing이 있어도 배치 저장 사용
      if (rulesData.length >= 5) {
        console.log(`배치 저장 시작: ${rulesData.length}개 규칙`);
        
        try {
          await savePricingRulesBatch(rulesData, (completed, total) => {
            setBatchProgress({ completed, total });
          });
          
          setBatchProgress(null); // 진행률 초기화
          setMessage(`✅ ${t('allRulesSaved', { count: rulesData.length })}`);
          
          // 저장 완료 후 저장된 데이터 확인
          console.log('저장 완료 - 저장된 레코드 요약:', {
            total: rulesData.length,
            rules: rulesData.map(r => ({
              date: r.date,
              channel_id: r.channel_id,
              variant_key: r.variant_key,
              choicesCount: Object.keys(r.choices_pricing || {}).length
            }))
          });
          
          // 저장 완료 후 데이터 새로고침 (데이터베이스 반영 시간 고려)
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms 대기
          await loadDynamicPricingData();
          await loadChannelPricingStats();
          
          // 추가로 한 번 더 로드하여 확실하게 반영
          setTimeout(async () => {
            await loadDynamicPricingData();
          }, 500);
        } catch (error) {
          console.error('배치 저장 실패:', error);
          setBatchProgress(null);
          setMessage(`⚠️ ${t('batchSaveFailed')}`);
          
          // 배치 저장 실패 시 개별 저장으로 폴백
          let savedCount = 0;
          let failedCount = 0;
          for (const ruleData of rulesData) {
            try {
              await savePricingRule(ruleData, false);
              savedCount++;
            } catch (err) {
              console.error('가격 규칙 저장 실패:', err);
              failedCount++;
            }
          }
          
          if (savedCount === rulesData.length) {
            setMessage(`✅ ${t('allRulesSaved', { count: rulesData.length })}`);
            // 저장 완료 후 데이터 새로고침 (데이터베이스 반영 시간 고려)
            await new Promise(resolve => setTimeout(resolve, 300)); // 300ms 대기
            await loadDynamicPricingData();
            // 추가로 한 번 더 로드하여 확실하게 반영
            setTimeout(async () => {
              await loadDynamicPricingData();
            }, 500);
          } else {
            setMessage(`⚠️ ${t('someRulesSaved', { saved: savedCount, total: rulesData.length, failed: failedCount })}`);
            // 일부 저장 완료 후에도 데이터 새로고침
            await new Promise(resolve => setTimeout(resolve, 300));
            await loadDynamicPricingData();
          }
          await loadChannelPricingStats();
        }
      } else {
        // 규칙이 적은 경우 개별 저장
        console.log(`개별 저장 시작: ${rulesData.length}개 규칙`);
        
        let savedCount = 0;
        let failedCount = 0;
        for (const ruleData of rulesData) {
          try {
            await savePricingRule(ruleData, false);
            savedCount++;
          } catch (error) {
            console.error('가격 규칙 저장 실패:', error);
            failedCount++;
          }
        }
        
        if (savedCount === rulesData.length) {
          setMessage(`✅ ${t('allRulesSaved', { count: rulesData.length })}`);
          // 저장 완료 후 데이터 새로고침 (데이터베이스 반영 시간 고려)
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms 대기
          await loadDynamicPricingData();
          await loadChannelPricingStats();
          // 추가로 한 번 더 로드하여 확실하게 반영
          setTimeout(async () => {
            await loadDynamicPricingData();
          }, 500);
        } else if (savedCount > 0) {
          setMessage(`⚠️ ${t('someRulesSaved', { saved: savedCount, total: rulesData.length, failed: failedCount })}`);
          // 일부 저장 완료 후에도 데이터 새로고침
          await new Promise(resolve => setTimeout(resolve, 300));
          await loadDynamicPricingData();
          await loadChannelPricingStats();
        } else {
          setMessage(`❌ ${t('saveFailed')} (${failedCount})`);
        }
      }
    } catch (error) {
      console.error('가격 규칙 저장 중 오류 발생:', error);
      setMessage(`❌ ${t('saveFailed')}: ${error instanceof Error ? error.message : ''}`);
    }
  }, [selectedDates, selectedChannelType, selectedChannel, channelGroups, pricingConfig, calculationConfig, productId, savePricingRule, savePricingRulesBatch, setMessage, loadChannelPricingStats, loadDynamicPricingData]);

  // 규칙 편집 핸들러
  const handleEditRule = useCallback((rule: SimplePricingRule) => {
    console.log('편집 버튼 클릭:', rule);
    
    // choices_pricing 파싱
    let choicesPricing: Record<string, any> = {};
    if (rule.choices_pricing) {
      try {
        choicesPricing = typeof rule.choices_pricing === 'string'
          ? JSON.parse(rule.choices_pricing)
          : rule.choices_pricing;
      } catch (e) {
        console.warn('choices_pricing 파싱 오류:', e);
        choicesPricing = {};
      }
    }
    
    updatePricingConfig({
      adult_price: rule.adult_price,
      child_price: rule.child_price,
      infant_price: rule.infant_price,
      commission_percent: rule.commission_percent,
      markup_amount: rule.markup_amount,
      coupon_percent: rule.coupon_percent,
      is_sale_available: rule.is_sale_available,
      not_included_price: rule.not_included_price || 0,
      choices_pricing: choicesPricing
    } as any);
    
    setSelectedDates([rule.date]);
    handleChannelSelect(rule.channel_id);
    
    // variant_key가 있으면 선택
    if (rule.variant_key) {
      setSelectedVariant(rule.variant_key);
    }
    
    // 캘린더 뷰로 전환하여 편집 가능하도록 함
    setViewMode('calendar');
    
    // 해당 날짜가 보이도록 월 변경
    const ruleDate = new Date(rule.date);
    setCurrentMonth(new Date(ruleDate.getFullYear(), ruleDate.getMonth(), 1));
  }, [updatePricingConfig, handleChannelSelect]);

  // 규칙 삭제 핸들러
  const handleDeleteRule = useCallback((ruleId: string) => {
    if (confirm('이 가격 규칙을 삭제하시겠습니까?')) {
      deletePricingRule(ruleId);
    }
  }, [deletePricingRule]);

  // 선택한 날짜들의 가격 규칙 삭제 핸들러
  const handleDeleteSelectedDates = useCallback(async () => {
    if (selectedDates.length === 0) {
      setMessage(t('selectDatesToDelete'));
      return;
    }

    const dateList = selectedDates.map(date => {
      // 날짜 문자열을 직접 파싱하여 타임존 변환 문제 방지
      const [year, month, day] = date.split('-');
      return `${year}-${month}-${day}`;
    }).join(', ');

    if (confirm(`선택한 ${selectedDates.length}개 날짜(${dateList})의 가격 규칙을 삭제하시겠습니까?`)) {
      await deletePricingRulesByDates(selectedDates, selectedChannel, selectedChannelType);
      setSelectedDates([]); // 삭제 후 선택 해제
    }
  }, [selectedDates, selectedChannel, selectedChannelType, deletePricingRulesByDates, setMessage]);

  // 저장 가능 여부 계산
  const canSave = useMemo(() => {
    const hasSelectedDates = selectedDates.length > 0;
    const hasSelectedChannels = Boolean(selectedChannelType) || Boolean(selectedChannel);
    
    // 기본 가격 또는 초이스별 가격이 있는지 확인
    const hasValidPrices = pricingConfig.adult_price > 0 || pricingConfig.child_price > 0 || pricingConfig.infant_price > 0;
    const hasChoicePrices = choiceCombinations.some(choice => 
      choice.adult_price > 0 || choice.child_price > 0 || choice.infant_price > 0
    );
    
    // 초이스가 없을 때 OTA 판매가나 불포함 금액이 있는지 확인
    const noChoiceData = (pricingConfig.choices_pricing as any)?.['no_choice'] || {};
    const hasNoChoiceOtaPrice = noChoiceData.ota_sale_price > 0;
    const hasNoChoiceNotIncluded = noChoiceData.not_included_price !== undefined && 
                                   noChoiceData.not_included_price !== null && 
                                   noChoiceData.not_included_price > 0;
    const hasNoChoicePrice = hasNoChoiceOtaPrice || hasNoChoiceNotIncluded;
    
    // 기본 불포함 금액이 있는지 확인
    const hasNotIncludedPrice = ((pricingConfig as any)?.not_included_price || 0) > 0;
    
    const canSaveResult = hasSelectedDates && hasSelectedChannels && 
                          (hasValidPrices || hasChoicePrices || hasNoChoicePrice || hasNotIncludedPrice);
    
    // 디버깅: canSave 변경 시에만 로그 출력 (불필요한 중복 로그 제거)
    // console.log('canSave 계산:', {
    //   hasSelectedDates,
    //   hasSelectedChannels,
    //   hasValidPrices,
    //   hasChoicePrices,
    //   hasNoChoicePrice,
    //   hasNotIncludedPrice,
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
        alert(t('channelLoadError'));
        return;
      }

      if (data) {
        const dataAny = data as any;
        // commission_percent를 commission_rate로 매핑
        const channelData = {
          ...dataAny,
          commission_rate: dataAny.commission_percent || dataAny.commission || dataAny.commission_rate || 0,
          is_active: dataAny.status === 'active' || dataAny.is_active === true,
          website: dataAny.website || dataAny.website_url || '',
          pricing_type: dataAny.pricing_type || 'separate'
        };
        setEditingChannel(channelData as typeof editingChannel);
      }
    } catch (error) {
      console.error('채널 조회 중 오류:', error);
      alert(t('channelLoadError'));
    }
  }, []);

  // 채널 수정 핸들러
  const handleEditChannel = useCallback(async (channel: any) => {
    if (!editingChannel) return;

    try {
      // commission_rate를 commission_percent로 매핑, is_active를 status로 매핑, website 필드 사용
      const channelData: any = {
        name: (channel as any).name,
        type: (channel as any).type,
        website: (channel as any).website || (channel as any).website_url || '',
        customer_website: (channel as any).customer_website || '',
        admin_website: (channel as any).admin_website || '',
        commission_percent: (channel as any).commission_rate || 0,
        status: (channel as any).is_active ? 'active' : 'inactive',
        description: (channel as any).description || '',
        favicon_url: (channel as any).favicon_url || '',
        manager_name: (channel as any).manager_name || '',
        manager_contact: (channel as any).manager_contact || '',
        contract_url: (channel as any).contract_url || '',
        commission_base_price_only: (channel as any).commission_base_price_only ?? false,
        pricing_type: (channel as any).pricing_type || 'separate'
      };
      
      console.log('DynamicPricingManager handleEditChannel - Saving channel data:', channelData);
      console.log('DynamicPricingManager handleEditChannel - Original channel object:', channel);

      const { error } = await (supabase as any)
        .from('channels')
        .update(channelData as any)
        .eq('id', editingChannel.id);

      if (error) {
        console.error('채널 수정 실패:', error);
        alert('채널 수정 중 오류가 발생했습니다.');
        return;
      }

      // 채널 목록 새로고침
      await loadChannels();
      setEditingChannel(null);
      alert(t('channelUpdated'));
    } catch (error) {
      console.error('채널 수정 중 오류:', error);
      alert('채널 수정 중 오류가 발생했습니다.');
    }
  }, [editingChannel, loadChannels]);

  // 현재 월의 데이터 필터링
  const currentMonthData = useMemo(() => {
    const year = currentMonth.getUTCFullYear();
    const month = currentMonth.getUTCMonth() + 1;
    
    // 현재 월의 데이터 필터링 (항상 전체 표시)
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
          <h3 className="text-lg font-semibold text-gray-900">{t('channelSelect')}</h3>
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
          
          {/* Variant 선택 */}
          {selectedChannel && productVariants.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variant 선택
              </label>
              <select
                value={selectedVariant}
                onChange={(e) => setSelectedVariant(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {productVariants.map((variant) => (
                  <option key={variant.variant_key} value={variant.variant_key}>
                    {variant.variant_name_ko || variant.variant_name_en || variant.variant_key}
                  </option>
                ))}
              </select>
              {productVariants.find(v => v.variant_key === selectedVariant)?.variant_name_ko && (
                <p className="mt-1 text-xs text-gray-500">
                  {productVariants.find(v => v.variant_key === selectedVariant)?.variant_name_ko}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 2열: 캘린더 (10/12 ÷ 3 = 3.33/12 → 3/12) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{t('priceHistory')}</h3>
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
                <span className="text-xs">{t('saleStatus')}</span>
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
                <span className="text-xs">{t('list')}</span>
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
              productBasePrice={productBasePrice}
              selectedVariant={selectedVariant}
              productId={productId}
              channelCoupons={channelCoupons}
              onDateClick={(date) => {
                setPricingHistoryDate(date)
                setIsPricingHistoryModalOpen(true)
              }}
            />
          ) : (
            <PricingListView
              dynamicPricingData={dynamicPricingData}
              onEditRule={handleEditRule}
              onDeleteRule={handleDeleteRule}
              onRefresh={loadDynamicPricingData}
              choiceCombinations={choiceCombinations}
              channels={channelGroups.flatMap(group => group.channels)}
            />
               )}

          {/* 포함/불포함 내역 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-semibold text-gray-900">{t('includedExcluded')}</h4>
              <button
                onClick={saveChannelIncludedNotIncluded}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {t('save')}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {t('includedExcludedHint')}
            </p>
            
            <div className="space-y-4">
                {/* 포함 내역 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('includedKo')}
                  </label>
                  <textarea
                    value={channelIncludedNotIncluded.included_ko}
                    onChange={(e) => setChannelIncludedNotIncluded(prev => ({
                      ...prev,
                      included_ko: e.target.value
                    }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder={t('placeholderIncluded')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('includedEn')}
                  </label>
                  <textarea
                    value={channelIncludedNotIncluded.included_en}
                    onChange={(e) => setChannelIncludedNotIncluded(prev => ({
                      ...prev,
                      included_en: e.target.value
                    }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder={t('placeholderIncluded')}
                  />
                </div>

                {/* 불포함 내역 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('notIncludedKo')}
                  </label>
                  <textarea
                    value={channelIncludedNotIncluded.not_included_ko}
                    onChange={(e) => setChannelIncludedNotIncluded(prev => ({
                      ...prev,
                      not_included_ko: e.target.value
                    }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder={t('placeholderNotIncluded')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('notIncludedEn')}
                  </label>
                  <textarea
                    value={channelIncludedNotIncluded.not_included_en}
                    onChange={(e) => setChannelIncludedNotIncluded(prev => ({
                      ...prev,
                      not_included_en: e.target.value
                    }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder={t('placeholderNotIncluded')}
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
              <h4 className="text-md font-semibold text-gray-900">{t('dateAndDaySelect')}</h4>
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">
                  {pricingConfig.is_sale_available ? t('onSale') : t('saleStopped')}
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
            <h4 className="text-md font-semibold text-gray-900 mb-4">{t('basePriceSection')}</h4>
            
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
                      {t('productBasePriceCommon')}
                    </label>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                      {isSinglePrice ? (
                        <div className="text-sm font-medium text-gray-900">
                          {t('singlePriceWithAmount')} ${productBasePrice.adult.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-4">
                          <span>
                            <span className="text-xs text-gray-600">{t('adult')}</span> ${productBasePrice.adult.toFixed(2)}
                          </span>
                          <span>
                            <span className="text-xs text-gray-600">{t('child')}</span> ${productBasePrice.child.toFixed(2)}
                          </span>
                          <span>
                            <span className="text-xs text-gray-600">{t('infant')}</span> ${productBasePrice.infant.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* 마우스 오버 시 표시되는 안내 텍스트 */}
                    <div className="absolute left-0 top-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                      <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                        {t('basePriceEditHint')}
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

                const isSinglePrice = homepagePricingType === 'single';
                
                return (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setIsHomepagePriceTableExpanded(!isHomepagePriceTableExpanded)}
                          className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                        >
                          {isHomepagePriceTableExpanded ? (
                            <ChevronUp className="h-4 w-4 text-purple-600" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-purple-600" />
                          )}
                          <h5 className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            {t('homepagePriceInfo')}
                          </h5>
                        </button>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
                          {isSinglePrice ? t('singlePrice') : t('separatePrice')}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
                          {t('forReference')}
                        </span>
                      </div>
                    </div>
                    {isHomepagePriceTableExpanded && (
                      <div className="overflow-x-auto rounded-xl shadow-lg border border-purple-200 bg-white">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500">
                            <th className="text-center py-2 px-3 font-bold text-white text-[10px] uppercase tracking-wider border-r border-purple-400/30 w-1/3">
                              {t('choice')}
                            </th>
                            <th className="text-center py-2 px-2 font-bold text-white text-[10px] uppercase tracking-wider border-r border-purple-400/30">
                              {t('base')}
                            </th>
                            <th className="text-center py-2 px-2 font-bold text-white text-[10px] uppercase tracking-wider border-r border-purple-400/30">
                              {t('choice')}
                            </th>
                            <th className="text-center py-2 px-2 font-bold text-white text-[10px] uppercase tracking-wider border-r border-purple-400/30">
                              {t('salePrice')}
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
                          {choiceCombinations.map((combination) => {
                            const combinationName = combination.combination_name_ko || combination.combination_name || combination.id;
                            
                            // 홈페이지 가격 계산
                            const baseProductPrice = {
                              adult: productBasePrice.adult || 0,
                              child: productBasePrice.child || 0,
                              infant: productBasePrice.infant || 0
                            };
                            
                            // 초이스 가격 찾기 (M00001 채널의 고정값, 유연한 매칭 사용)
                            let homepageChoiceData = homepagePricingConfig 
                              ? findHomepageChoiceData(combination, homepagePricingConfig)
                              : {};
                            
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
                            
                            // 단일 가격인 경우 성인 가격만 사용
                            const basePrice = {
                              adult: baseProductPrice.adult,
                              child: isSinglePrice ? baseProductPrice.adult : baseProductPrice.child,
                              infant: isSinglePrice ? baseProductPrice.adult : baseProductPrice.infant
                            };
                            
                            // 초이스: 초이스별 가격 (M00001 채널의 고정값)
                            const choicePriceValue = {
                              adult: choicePrice.adult_price || 0,
                              child: isSinglePrice ? choicePrice.adult_price || 0 : (choicePrice.child_price || 0),
                              infant: isSinglePrice ? choicePrice.adult_price || 0 : (choicePrice.infant_price || 0)
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
                                  {!isSinglePrice && (
                                    <>
                                      <br />
                                      <span className="text-gray-500 text-[10px]">{t('child')}: {formatPrice(basePrice.child)}</span>
                                      <br />
                                      <span className="text-gray-500 text-[10px]">{t('infant')}: {formatPrice(basePrice.infant)}</span>
                                    </>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right text-gray-700 text-xs font-medium group-hover:text-gray-900">
                                  {formatPrice(choicePriceValue.adult)}
                                  {!isSinglePrice && (
                                    <>
                                      <br />
                                      <span className="text-gray-500 text-[10px]">아동: {formatPrice(choicePriceValue.child)}</span>
                                      <br />
                                      <span className="text-gray-500 text-[10px]">유아: {formatPrice(choicePriceValue.infant)}</span>
                                    </>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right text-blue-700 text-xs font-bold group-hover:text-blue-900">
                                  {formatPrice(salePrice.adult)}
                                  {!isSinglePrice && (
                                    <>
                                      <br />
                                      <span className="text-blue-500 text-[10px]">{t('child')}: {formatPrice(salePrice.child)}</span>
                                      <br />
                                      <span className="text-blue-500 text-[10px]">{t('infant')}: {formatPrice(salePrice.infant)}</span>
                                    </>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right text-indigo-700 text-xs font-bold group-hover:text-indigo-900">
                                  {formatPrice(grossPrice.adult)}
                                  {!isSinglePrice && (
                                    <>
                                      <br />
                                      <span className="text-indigo-500 text-[10px]">{t('child')}: {formatPrice(grossPrice.child)}</span>
                                      <br />
                                      <span className="text-indigo-500 text-[10px]">{t('infant')}: {formatPrice(grossPrice.infant)}</span>
                                    </>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right text-emerald-700 text-xs font-extrabold group-hover:text-emerald-900">
                                  {formatPrice(netPrice.adult)}
                                  {!isSinglePrice && (
                                    <>
                                      <br />
                                      <span className="text-emerald-500 text-[10px]">{t('child')}: {formatPrice(netPrice.child)}</span>
                                      <br />
                                      <span className="text-emerald-500 text-[10px]">{t('infant')}: {formatPrice(netPrice.infant)}</span>
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    )}
                  </div>
                );
              })()}



              {/* 수수료 - 한 줄에 2개 */}
              <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t('commissionPercent')}
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
                    {t('commissionAmount')}
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
                    {t('couponDiscount')}
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
                    {t('notIncludedAmount')}
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
            
            // 홈페이지 채널이고 단일 가격 타입인지 확인
            const isHomepageChannelSelected = homepageChannel && selectedChannel === homepageChannel.id;
            const isHomepageSinglePrice = isHomepageChannelSelected && homepagePricingType === 'single';
            
            return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">{t('choicePricingSection')}</h4>
              
              <div className="space-y-3">
                {choiceCombinations.map((combination) => {
                  // OTA 판매가 가져오기 (미정 조합일 때 미국 거주자 선택의 ota_sale_price로 폴백)
                  const otaSalePrice = getOtaSalePriceWithFallback(combination, (pricingConfig.choices_pricing as any) || {});
                  const commissionPercent = pricingConfig.commission_percent || 0;
                  const couponPercent = pricingConfig.coupon_percent || 0;
                  
                  // 채널 설정 확인 (foundChannel 사용)
                  // const commissionBasePriceOnly = (foundChannel as any)?.commission_base_price_only || false;
                  
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
                  
                  // 채널 설정 확인
                  const commissionBasePriceOnly = (foundChannel as any)?.commission_base_price_only || false;
                  
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
                    
                    // 초이스 가격 찾기 (M00001 채널의 고정값 우선, 유연한 매칭 사용)
                    let foundChoiceData = homepagePricingConfig 
                      ? findHomepageChoiceData(combination, homepagePricingConfig)
                      : {};
                    
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
                                  {detail.optionNameKo || detail.optionName || t('option')}: ${detail.adult_price || 0}
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
                              {t('otaSalePrice')}
                            </label>
                            <input
                              type="number"
                              value={otaSalePrice === 0 ? '' : otaSalePrice}
                              onChange={(e) => {
                                const value = e.target.value;
                                const currentPricing = pricingConfig.choices_pricing || {};
                                const currentChoiceData = (currentPricing as unknown as Record<string, Record<string, unknown>>)[combination.id] || {};
                                
                                // 기존 필드들을 모두 보존 (초이스 가격, 불포함 금액 등)
                                const preservedData = {
                                  ...currentChoiceData,
                                  // 불포함 금액 보존
                                  not_included_price: currentChoiceData.not_included_price !== undefined ? currentChoiceData.not_included_price : notIncludedPrice
                                };
                                
                                if (value === '' || value === '-') {
                                  // OTA 판매가만 0으로 설정, 나머지는 모두 유지
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...preservedData,
                                        ota_sale_price: 0
                                      }
                                    }
                                  });
                                  return;
                                }
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue)) {
                                  // OTA 판매가만 업데이트, 나머지는 모두 유지
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
                                  
                                  // OTA 판매가와 함께 모든 필드(초이스 가격, 불포함 금액 등)를 유지하여 업데이트
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...preservedData,
                                        adult_price: adultPrice,
                                        child_price: childPrice,
                                        infant_price: infantPrice,
                                        // adult, child, infant도 보존 (호환성)
                                        adult: adultPrice,
                                        child: childPrice,
                                        infant: infantPrice,
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
                                  // 기존 필드들을 모두 보존
                                  const preservedData = {
                                    ...currentChoiceData,
                                    not_included_price: currentChoiceData.not_included_price !== undefined ? currentChoiceData.not_included_price : notIncludedPrice
                                  };
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...preservedData,
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
                              {t('notIncludedAmount')}
                            </label>
                            <input
                              type="text"
                              value={(() => {
                                const currentPricing = pricingConfig.choices_pricing || {};
                                const currentChoiceData = (currentPricing as unknown as Record<string, Record<string, unknown>>)[combination.id] || {};
                                const currentNotIncludedPrice = currentChoiceData.not_included_price;
                                if (currentNotIncludedPrice === undefined || currentNotIncludedPrice === null) {
                                  return '';
                                }
                                if (currentNotIncludedPrice === 0) {
                                  return '';
                                }
                                return String(currentNotIncludedPrice);
                              })()}
                              onChange={(e) => {
                                const value = e.target.value;
                                const currentPricing = pricingConfig.choices_pricing || {};
                                // 기존 데이터를 완전히 보존하기 위해 모든 필드를 가져옴
                                const currentChoiceData = (currentPricing as unknown as Record<string, Record<string, unknown>>)[combination.id] || {};
                                
                                // 기존 필드들을 모두 보존 (OTA 판매가, 초이스 가격 등)
                                const preservedData = {
                                  ...currentChoiceData,
                                  // OTA 판매가 보존
                                  ota_sale_price: currentChoiceData.ota_sale_price !== undefined ? currentChoiceData.ota_sale_price : otaSalePrice,
                                  // 초이스 가격 보존
                                  adult_price: currentChoiceData.adult_price !== undefined ? currentChoiceData.adult_price : (currentChoiceData.adult !== undefined ? currentChoiceData.adult : (combination.adult_price || 0)),
                                  child_price: currentChoiceData.child_price !== undefined ? currentChoiceData.child_price : (currentChoiceData.child !== undefined ? currentChoiceData.child : (combination.child_price || 0)),
                                  infant_price: currentChoiceData.infant_price !== undefined ? currentChoiceData.infant_price : (currentChoiceData.infant !== undefined ? currentChoiceData.infant : (combination.infant_price || 0)),
                                  // adult, child, infant도 보존 (호환성)
                                  adult: currentChoiceData.adult !== undefined ? currentChoiceData.adult : (currentChoiceData.adult_price !== undefined ? currentChoiceData.adult_price : (combination.adult_price || 0)),
                                  child: currentChoiceData.child !== undefined ? currentChoiceData.child : (currentChoiceData.child_price !== undefined ? currentChoiceData.child_price : (combination.child_price || 0)),
                                  infant: currentChoiceData.infant !== undefined ? currentChoiceData.infant : (currentChoiceData.infant_price !== undefined ? currentChoiceData.infant_price : (combination.infant_price || 0))
                                };
                                
                                // 빈 값이거나 '-'만 입력된 경우
                                if (value === '' || value === '-') {
                                  // 불포함 금액을 0으로 설정
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...preservedData,
                                        not_included_price: 0
                                      }
                                    }
                                  });
                                  return;
                                }
                                
                                // 숫자가 아닌 문자 제거 (소수점과 음수 기호는 허용)
                                const cleanedValue = value.replace(/[^\d.-]/g, '');
                                
                                // 숫자로 변환 시도
                                const numValue = parseFloat(cleanedValue);
                                if (!isNaN(numValue) && numValue >= 0) {
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...preservedData,
                                        not_included_price: numValue
                                      }
                                    }
                                  });
                                } else if (cleanedValue !== '') {
                                  // 숫자가 아니지만 값이 있으면 (입력 중일 수 있음) 임시로 저장
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...preservedData,
                                        not_included_price: cleanedValue as any
                                      }
                                    }
                                  });
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value;
                                const currentPricing = pricingConfig.choices_pricing || {};
                                const currentChoiceData = (currentPricing as unknown as Record<string, Record<string, unknown>>)[combination.id] || {};
                                
                                const preservedData = {
                                  ...currentChoiceData,
                                  ota_sale_price: currentChoiceData.ota_sale_price !== undefined ? currentChoiceData.ota_sale_price : otaSalePrice,
                                  adult_price: currentChoiceData.adult_price !== undefined ? currentChoiceData.adult_price : (currentChoiceData.adult !== undefined ? currentChoiceData.adult : (combination.adult_price || 0)),
                                  child_price: currentChoiceData.child_price !== undefined ? currentChoiceData.child_price : (currentChoiceData.child !== undefined ? currentChoiceData.child : (combination.child_price || 0)),
                                  infant_price: currentChoiceData.infant_price !== undefined ? currentChoiceData.infant_price : (currentChoiceData.infant !== undefined ? currentChoiceData.infant : (combination.infant_price || 0)),
                                  adult: currentChoiceData.adult !== undefined ? currentChoiceData.adult : (currentChoiceData.adult_price !== undefined ? currentChoiceData.adult_price : (combination.adult_price || 0)),
                                  child: currentChoiceData.child !== undefined ? currentChoiceData.child : (currentChoiceData.child_price !== undefined ? currentChoiceData.child_price : (combination.child_price || 0)),
                                  infant: currentChoiceData.infant !== undefined ? currentChoiceData.infant : (currentChoiceData.infant_price !== undefined ? currentChoiceData.infant_price : (combination.infant_price || 0))
                                };
                                
                                // 포커스를 잃을 때 최종 값 정리
                                if (value === '' || value === '-') {
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...preservedData,
                                        not_included_price: 0
                                      }
                                    }
                                  });
                                } else {
                                  const numValue = parseFloat(value);
                                  if (!isNaN(numValue) && numValue >= 0) {
                                    updatePricingConfig({
                                      choices_pricing: {
                                        ...currentPricing,
                                        [combination.id]: {
                                          ...preservedData,
                                          not_included_price: numValue
                                        }
                                      }
                                    });
                                  } else {
                                    // 유효하지 않은 값이면 0으로 설정
                                    updatePricingConfig({
                                      choices_pricing: {
                                        ...currentPricing,
                                        [combination.id]: {
                                          ...preservedData,
                                          not_included_price: 0
                                        }
                                      }
                                    });
                                  }
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              placeholder={t('notIncludedPlaceholder')}
                              step="0.01"
                              min="0"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              값을 0으로 변경하면 불포함 금액이 0으로 설정됩니다
                            </p>
                          </div>
                        </div>
                        {otaSalePrice > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-2">
                            <div className="text-xs text-gray-600 mb-1">
                              <div>{t('commissionLabel')} {commissionPercent}%</div>
                              <div>{t('couponLabel')} {couponPercent}%</div>
                            </div>
                            {/* 불포함 금액 표시 (Net Price 위로 이동) */}
                            {notIncludedPrice > 0 && (
                              <div className="text-sm font-semibold text-orange-600 mb-1">
                                불포함 금액: 
                                <span className="ml-2">${notIncludedPrice.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="text-sm font-semibold text-blue-900 mb-1">
                              {t('netPriceLabel')} ${netPrice.toFixed(2)}
                              {homepageNetPrice > 0 && (
                                <span className={`ml-2 text-xs ${priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ({t('homepageLabel')} ${homepageNetPrice.toFixed(2)}, {t('differenceLabel')} {priceDifference >= 0 ? '+' : ''}${priceDifference.toFixed(2)})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {notIncludedPrice > 0 ? (
                                <>
                                  {t('formulaWithNotIncluded', { ota: otaSalePrice.toFixed(2), coupon: couponPercent, commission: commissionPercent, notIncluded: notIncludedPrice.toFixed(2), net: netPrice.toFixed(2) })}
                                </>
                              ) : (
                                <>
                                  {t('formulaWithoutNotIncluded', { ota: otaSalePrice.toFixed(2), coupon: couponPercent, commission: commissionPercent, net: netPrice.toFixed(2) })}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // 일반 채널 또는 홈페이지 채널: 가격 타입에 따라 표시
                      isHomepageSinglePrice ? (
                        // 홈페이지 단일 가격 모드
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {t('salePriceLabel')} <span className="text-blue-600">({t('singlePrice')})</span>
                          </label>
                          <input
                            type="number"
                            value={(() => {
                              const currentChoiceData = (pricingConfig.choices_pricing as any)?.[combination.id] || {};
                              const adultPrice = currentChoiceData.adult_price || currentChoiceData.adult || combination.adult_price || 0;
                              return adultPrice === 0 ? '' : adultPrice;
                            })()}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || value === '-') {
                                // 단일 가격인 경우 모든 가격을 0으로 설정
                                handleChoicePriceUpdate(combination.id, 'adult_price', 0);
                                handleChoicePriceUpdate(combination.id, 'child_price', 0);
                                handleChoicePriceUpdate(combination.id, 'infant_price', 0);
                                return;
                              }
                              const numValue = parseFloat(value);
                              if (!isNaN(numValue)) {
                                // 단일 가격인 경우 모든 가격을 동일하게 설정
                                handleChoicePriceUpdate(combination.id, 'adult_price', numValue);
                                handleChoicePriceUpdate(combination.id, 'child_price', numValue);
                                handleChoicePriceUpdate(combination.id, 'infant_price', numValue);
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value;
                              if (value === '' || value === '-') {
                                handleChoicePriceUpdate(combination.id, 'adult_price', 0);
                                handleChoicePriceUpdate(combination.id, 'child_price', 0);
                                handleChoicePriceUpdate(combination.id, 'infant_price', 0);
                              }
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                          <p className="text-xs text-blue-600 mt-1">{t('singlePriceNote')}</p>
                          <div className="text-xs text-gray-500 mt-1">
                            {t('originalSum')} ${combination.combination_details ? 
                              combination.combination_details.reduce((sum, detail) => sum + (detail.adult_price || 0), 0) : 
                              combination.adult_price || 0}
                          </div>
                        </div>
                      ) : (
                        // 분리 가격 모드 (일반 채널 또는 홈페이지 분리 가격)
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {t('adultSalePriceLabel')}
                            </label>
                            <input
                              type="number"
                              value={(() => {
                                const currentChoiceData = (pricingConfig.choices_pricing as any)?.[combination.id] || {};
                                const adultPrice = currentChoiceData.adult_price || currentChoiceData.adult || combination.adult_price || 0;
                                return adultPrice === 0 ? '' : adultPrice;
                              })()}
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
                              {t('originalSum')} ${combination.combination_details ? 
                                combination.combination_details.reduce((sum, detail) => sum + (detail.adult_price || 0), 0) : 
                                combination.adult_price || 0}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {t('childSalePriceLabel')}
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
                              {t('originalSum')} ${combination.combination_details ? 
                                combination.combination_details.reduce((sum, detail) => sum + (detail.child_price || 0), 0) : 
                                combination.child_price || 0}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {t('infantSalePriceLabel')}
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
                      )
                    )}
                    {/* 구매가 입력 필드 추가 (모든 채널 공통) - Mania Tour 제외 */}
                    {productSubCategory !== 'Mania Tour' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs font-medium text-gray-700 mb-2">
                          {t('actualCostPriceLabel')}
                        {isHomepageSinglePrice && (
                          <span className="ml-2 text-blue-600">({t('singlePrice')})</span>
                        )}
                      </div>
                      {isHomepageSinglePrice ? (
                        // 단일 가격 모드: 구매가 하나만 입력
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {t('costPriceLabel')}
                          </label>
                          <input
                            type="number"
                            value={(() => {
                              const currentChoiceData = (pricingConfig.choices_pricing as any)?.[combination.id] || {};
                              const adultCostPrice = currentChoiceData.adult_cost_price || 0;
                              return adultCostPrice === 0 ? '' : adultCostPrice;
                            })()}
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
                                      adult_cost_price: 0,
                                      child_cost_price: 0,
                                      infant_cost_price: 0
                                    }
                                  }
                                });
                                return;
                              }
                              const numValue = parseFloat(value);
                              if (!isNaN(numValue)) {
                                // 단일 가격인 경우 모든 구매가를 동일하게 설정
                                updatePricingConfig({
                                  choices_pricing: {
                                    ...currentPricing,
                                    [combination.id]: {
                                      ...currentChoiceData,
                                      adult_cost_price: numValue,
                                      child_cost_price: numValue,
                                      infant_cost_price: numValue
                                    }
                                  }
                                });
                              }
                            }}
                            className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-orange-50"
                            placeholder="예: 107.33"
                          />
                          <p className="text-xs text-blue-600 mt-1">성인/아동/유아 모두 동일한 구매가가 적용됩니다</p>
                        </div>
                      ) : (
                        // 분리 가격 모드: 성인/아동/유아 구매가 분리 입력
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {t('adultCostPriceLabel')}
                            </label>
                            <input
                              type="number"
                              value={(() => {
                                const currentChoiceData = (pricingConfig.choices_pricing as any)?.[combination.id] || {};
                                const adultCostPrice = currentChoiceData.adult_cost_price || 0;
                                return adultCostPrice === 0 ? '' : adultCostPrice;
                              })()}
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
                                        adult_cost_price: 0
                                      }
                                    }
                                  });
                                  return;
                                }
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue)) {
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...currentChoiceData,
                                        adult_cost_price: numValue
                                      }
                                    }
                                  });
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-orange-50"
                              placeholder="예: 107.33"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {t('childCostPriceLabel')}
                            </label>
                            <input
                              type="number"
                              value={(() => {
                                const currentChoiceData = (pricingConfig.choices_pricing as any)?.[combination.id] || {};
                                const childCostPrice = currentChoiceData.child_cost_price || 0;
                                return childCostPrice === 0 ? '' : childCostPrice;
                              })()}
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
                                        child_cost_price: 0
                                      }
                                    }
                                  });
                                  return;
                                }
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue)) {
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...currentChoiceData,
                                        child_cost_price: numValue
                                      }
                                    }
                                  });
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-orange-50"
                              placeholder="예: 87.89"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {t('infantCostPriceLabel')}
                            </label>
                            <input
                              type="number"
                              value={(() => {
                                const currentChoiceData = (pricingConfig.choices_pricing as any)?.[combination.id] || {};
                                const infantCostPrice = currentChoiceData.infant_cost_price || 0;
                                return infantCostPrice === 0 ? '' : infantCostPrice;
                              })()}
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
                                        infant_cost_price: 0
                                      }
                                    }
                                  });
                                  return;
                                }
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue)) {
                                  updatePricingConfig({
                                    choices_pricing: {
                                      ...currentPricing,
                                      [combination.id]: {
                                        ...currentChoiceData,
                                        infant_cost_price: numValue
                                      }
                                    }
                                  });
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-orange-50"
                              placeholder="예: 67.45"
                            />
                          </div>
                        </div>
                      )}
                      {/* 운영 이익 미리보기 */}
                      {(() => {
                        const currentChoiceData = (pricingConfig.choices_pricing as any)?.[combination.id] || {};
                        const adultSalePrice = currentChoiceData.adult_price || currentChoiceData.adult || combination.adult_price || 0;
                        const childSalePrice = currentChoiceData.child_price || currentChoiceData.child || combination.child_price || 0;
                        const infantSalePrice = currentChoiceData.infant_price || currentChoiceData.infant || combination.infant_price || 0;
                        const adultCostPrice = currentChoiceData.adult_cost_price || 0;
                        const childCostPrice = currentChoiceData.child_cost_price || 0;
                        const infantCostPrice = currentChoiceData.infant_cost_price || 0;
                        
                        const adultProfit = adultSalePrice - adultCostPrice;
                        const childProfit = childSalePrice - childCostPrice;
                        const infantProfit = infantSalePrice - infantCostPrice;
                        
                        if (adultCostPrice > 0 || childCostPrice > 0 || infantCostPrice > 0) {
                          return (
                            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                              <div className="font-medium text-green-900 mb-1">{t('expectedProfit')}</div>
                              {adultCostPrice > 0 && (
                                <div className="text-green-700">{t('adult')}: ${adultSalePrice.toFixed(2)} - ${adultCostPrice.toFixed(2)} = <span className="font-semibold">${adultProfit.toFixed(2)}</span></div>
                              )}
                              {!isHomepageSinglePrice && childCostPrice > 0 && (
                                <div className="text-green-700">{t('child')}: ${childSalePrice.toFixed(2)} - ${childCostPrice.toFixed(2)} = <span className="font-semibold">${childProfit.toFixed(2)}</span></div>
                              )}
                              {!isHomepageSinglePrice && infantCostPrice > 0 && (
                                <div className="text-green-700">유아: ${infantSalePrice.toFixed(2)} - ${infantCostPrice.toFixed(2)} = <span className="font-semibold">${infantProfit.toFixed(2)}</span></div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      </div>
                    )}
                  </div>
                  );
                    })}
              </div>
            </div>
            );
          })()}

          {/* 초이스가 없는 상품의 경우 판매가 및 불포함 금액 입력 */}
          {choiceCombinations.length === 0 && (() => {
            // 채널 정보 확인 (모든 채널에서 표시)
            const foundChannel = selectedChannel ? channelGroups
              .flatMap(group => group.channels)
              .find(ch => ch.id === selectedChannel) : null;
            // const isOTAChannel = foundChannel && (
            //   (foundChannel as any).type?.toLowerCase() === 'ota' || 
            //   (foundChannel as any).category === 'OTA'
            // );
            const isHomepageChannel = foundChannel && (
              (foundChannel as any).id === 'M00001' ||
              (foundChannel as any).id?.toLowerCase() === 'm00001' ||
              (foundChannel as any).name?.toLowerCase().includes('홈페이지') ||
              (foundChannel as any).name?.toLowerCase().includes('homepage')
            );

            // 초이스가 없을 때는 no_choice 키를 사용하거나 최상위 레벨에서 가져오기
            const noChoiceKey = 'no_choice';
            const currentNoChoiceData = (pricingConfig.choices_pricing as any)?.[noChoiceKey] || {};
            const otaSalePrice = currentNoChoiceData.ota_sale_price || 0;
            const notIncludedPrice = currentNoChoiceData.not_included_price !== undefined && currentNoChoiceData.not_included_price !== null
              ? currentNoChoiceData.not_included_price
              : ((pricingConfig as any)?.not_included_price || 0);
            const commissionPercent = pricingConfig.commission_percent || 0;
            const couponPercent = pricingConfig.coupon_percent || 0;

            // Net Price 계산
            let netPrice = 0;
            if (otaSalePrice > 0) {
              const baseNetPrice = otaSalePrice * (1 - couponPercent / 100) * (1 - commissionPercent / 100);
              if (notIncludedPrice > 0) {
                netPrice = baseNetPrice + notIncludedPrice;
              } else {
                netPrice = baseNetPrice;
              }
            }

            return (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h4 className="text-md font-semibold text-gray-900 mb-4">{t('noChoicePricing')}</h4>
                
                <div className="space-y-3">
                  {/* OTA 판매가와 불포함 금액을 같은 줄에 배치 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {isHomepageChannel ? t('salePriceLabelShort') : t('otaSalePrice')}
                      </label>
                      <input
                        type="number"
                        value={otaSalePrice === 0 ? '' : otaSalePrice}
                        onChange={(e) => {
                          const value = e.target.value;
                          const currentPricing = pricingConfig.choices_pricing || {};
                          const currentNoChoiceData = (currentPricing as any)?.[noChoiceKey] || {};
                          
                          const preservedData = {
                            ...currentNoChoiceData,
                            not_included_price: currentNoChoiceData.not_included_price !== undefined 
                              ? currentNoChoiceData.not_included_price 
                              : notIncludedPrice
                          };
                          
                          if (value === '' || value === '-') {
                            updatePricingConfig({
                              choices_pricing: {
                                ...currentPricing,
                                [noChoiceKey]: {
                                  ...preservedData,
                                  ota_sale_price: 0
                                }
                              }
                            });
                            return;
                          }
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue)) {
                            updatePricingConfig({
                              choices_pricing: {
                                ...currentPricing,
                                [noChoiceKey]: {
                                  ...preservedData,
                                  ota_sale_price: numValue
                                }
                              }
                            });
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === '-') {
                            const currentPricing = pricingConfig.choices_pricing || {};
                            const currentNoChoiceData = (currentPricing as any)?.[noChoiceKey] || {};
                            const preservedData = {
                              ...currentNoChoiceData,
                              not_included_price: currentNoChoiceData.not_included_price !== undefined 
                                ? currentNoChoiceData.not_included_price 
                                : notIncludedPrice
                            };
                            updatePricingConfig({
                              choices_pricing: {
                                ...currentPricing,
                                [noChoiceKey]: {
                                  ...preservedData,
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
                        {t('notIncludedAmount')}
                      </label>
                      <input
                        type="text"
                        value={(() => {
                          const currentPricing = pricingConfig.choices_pricing || {};
                          const currentNoChoiceData = (currentPricing as any)?.[noChoiceKey] || {};
                          const currentNotIncludedPrice = currentNoChoiceData.not_included_price;
                          if (currentNotIncludedPrice === undefined || currentNotIncludedPrice === null) {
                            return '';
                          }
                          if (currentNotIncludedPrice === 0) {
                            return '';
                          }
                          return String(currentNotIncludedPrice);
                        })()}
                        onChange={(e) => {
                          const value = e.target.value;
                          const currentPricing = pricingConfig.choices_pricing || {};
                          const currentNoChoiceData = (currentPricing as any)?.[noChoiceKey] || {};
                          
                          const preservedData = {
                            ...currentNoChoiceData,
                            ota_sale_price: currentNoChoiceData.ota_sale_price !== undefined 
                              ? currentNoChoiceData.ota_sale_price 
                              : otaSalePrice
                          };
                          
                          // 빈 값이거나 '-'만 입력된 경우
                          if (value === '' || value === '-') {
                            updatePricingConfig({
                              choices_pricing: {
                                ...currentPricing,
                                [noChoiceKey]: {
                                  ...preservedData,
                                  not_included_price: 0
                                }
                              }
                            });
                            // 동적 가격의 최상위 레벨 not_included_price도 업데이트
                            handlePricingConfigUpdate({ not_included_price: 0 });
                            return;
                          }
                          
                          // 숫자가 아닌 문자 제거 (소수점과 음수 기호는 허용)
                          const cleanedValue = value.replace(/[^\d.-]/g, '');
                          
                          // 숫자로 변환 시도
                          const numValue = parseFloat(cleanedValue);
                          if (!isNaN(numValue) && numValue >= 0) {
                            updatePricingConfig({
                              choices_pricing: {
                                ...currentPricing,
                                [noChoiceKey]: {
                                  ...preservedData,
                                  not_included_price: numValue
                                }
                              }
                            });
                            // 동적 가격의 최상위 레벨 not_included_price도 업데이트
                            handlePricingConfigUpdate({ not_included_price: numValue });
                          } else if (cleanedValue !== '') {
                            // 숫자가 아니지만 값이 있으면 (입력 중일 수 있음) 임시로 저장
                            updatePricingConfig({
                              choices_pricing: {
                                ...currentPricing,
                                [noChoiceKey]: {
                                  ...preservedData,
                                  not_included_price: cleanedValue as any
                                }
                              }
                            });
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          const currentPricing = pricingConfig.choices_pricing || {};
                          const currentNoChoiceData = (currentPricing as any)?.[noChoiceKey] || {};
                          
                          const preservedData = {
                            ...currentNoChoiceData,
                            ota_sale_price: currentNoChoiceData.ota_sale_price !== undefined 
                              ? currentNoChoiceData.ota_sale_price 
                              : otaSalePrice
                          };
                          
                          // 포커스를 잃을 때 최종 값 정리
                          if (value === '' || value === '-') {
                            updatePricingConfig({
                              choices_pricing: {
                                ...currentPricing,
                                [noChoiceKey]: {
                                  ...preservedData,
                                  not_included_price: 0
                                }
                              }
                            });
                            handlePricingConfigUpdate({ not_included_price: 0 });
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              updatePricingConfig({
                                choices_pricing: {
                                  ...currentPricing,
                                  [noChoiceKey]: {
                                    ...preservedData,
                                    not_included_price: numValue
                                  }
                                }
                              });
                              handlePricingConfigUpdate({ not_included_price: numValue });
                            } else {
                              // 유효하지 않은 값이면 0으로 설정
                              updatePricingConfig({
                                choices_pricing: {
                                  ...currentPricing,
                                  [noChoiceKey]: {
                                    ...preservedData,
                                    not_included_price: 0
                                  }
                                }
                              });
                              handlePricingConfigUpdate({ not_included_price: 0 });
                            }
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
                        <div>{t('commissionLabel')} {commissionPercent}%</div>
                        <div>{t('couponLabel')} {couponPercent}%</div>
                      </div>
                      {/* 불포함 금액 표시 */}
                      {notIncludedPrice > 0 && (
                        <div className="text-sm font-semibold text-orange-600 mb-1">
                          {t('notIncludedAmountShort')}
                          <span className="ml-2">${notIncludedPrice.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="text-sm font-semibold text-blue-900 mb-1">
                        {t('netPriceLabel')} ${netPrice.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {notIncludedPrice > 0 ? (
                          <>
                            {t('formulaWithNotIncluded', { ota: otaSalePrice.toFixed(2), coupon: couponPercent, commission: commissionPercent, notIncluded: notIncludedPrice.toFixed(2), net: netPrice.toFixed(2) })}
                          </>
                        ) : (
                          <>
                            {t('formulaWithoutNotIncluded', { ota: otaSalePrice.toFixed(2), coupon: couponPercent, commission: commissionPercent, net: netPrice.toFixed(2) })}
                          </>
                        )}
                      </div>
                    </div>
                  )}
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
            onDelete={handleDeleteSelectedDates}
            canDelete={selectedDates.length > 0}
          />
        </div>
      </div>

      {/* 판매 상태 설정 모달 */}
      <SaleStatusModal
        isOpen={isSaleStatusModalOpen}
        onClose={handleCloseSaleStatusModal}
        onSave={handleSaveSaleStatus}
        initialDates={selectedDates.map(date => {
          // 날짜 문자열을 직접 파싱하여 타임존 변환 문제 방지
          const [year, month, day] = date.split('-');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        })}
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

      {/* 가격 히스토리 모달 */}
      {isPricingHistoryModalOpen && selectedChannel && (
        <PricingHistoryModal
          isOpen={isPricingHistoryModalOpen}
          onClose={() => setIsPricingHistoryModalOpen(false)}
          productId={productId}
          date={pricingHistoryDate}
          channelId={selectedChannel}
          variantKey={selectedVariant}
          choiceCombinations={choiceCombinations}
          {...(channelGroups
            .flatMap(group => group.channels)
            .find(ch => ch.id === selectedChannel)?.name && {
            channelName: channelGroups
              .flatMap(group => group.channels)
              .find(ch => ch.id === selectedChannel)?.name
          })}
        />
      )}
    </div>
  );
}
