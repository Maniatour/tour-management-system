'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  Save,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Percent,
  Eye,
  Loader2,
  TrendingUp,
  Globe,
  Users,
  Building
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  DynamicPricingRule, 
  CreatePricingRuleDto, 
  DAY_NAMES
} from '@/lib/types/dynamic-pricing';
import ChangeHistory from './ChangeHistory';

interface DynamicPricingManagerProps {
  productId: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  onSave?: (rule: DynamicPricingRule) => void;
  isNewProduct?: boolean;
}

// 채널 타입 정의
type ChannelType = 'OTA' | 'Self' | 'Partner';

export default function DynamicPricingManager({ 
  productId, 
  onSave, 
  isNewProduct = false
}: DynamicPricingManagerProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showDetailedPrices, setShowDetailedPrices] = useState(false);
  

  // 가격 설정 상태
  const [pricingConfig, setPricingConfig] = useState({
    start_date: new Date().toISOString().split('T')[0], // 오늘 날짜
    end_date: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0], // 올해 말일 (12월 31일)
    selected_weekdays: [] as number[],
    is_sale_available: true,
    commission_percent: 25, // 기본 커미션 25%
    markup_amount: 0,
    coupon_fixed_discount: 0, // 고정 할인 금액 ($)
    coupon_percentage_discount: 0, // 퍼센트 할인 (%)
    discount_priority: 'percentage_first' as 'fixed_first' | 'percentage_first', // 할인 우선순위 (퍼센트 우선)
    adult_price: 0,
    child_price: 0,
    infant_price: 0,
    not_included_price: 0,
    required_options: [] as Array<{
      option_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
      adult_price: number;
      child_price: number;
      infant_price: number;
    }>
  });

  // 채널 목록
  const [channels, setChannels] = useState<Array<{
    id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
    name: string;
    type: string | null;
  }>>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);

  // 동적 가격 데이터
  const [dynamicPricingData, setDynamicPricingData] = useState<Array<{
    id: string;
    product_id: string;
    channel_id: string;
    date: string;
    adult_price: number;
    child_price: number;
    infant_price: number;
    not_included_price?: number | null;
    options_pricing: Array<{
      option_id: string;
      adult_price: number;
      child_price: number;
      infant_price: number;
    }> | Record<string, {
      adult?: number;
      adult_price?: number;
      child?: number;
      child_price?: number;
      infant?: number;
      infant_price?: number;
    }>;
    commission_percent: number;
    markup_amount: number;
    coupon_percent: number;
    is_sale_available: boolean;
  }>>([]);

  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [listViewMonth, setListViewMonth] = useState(new Date());
  
  // 다중 선택 상태
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // 선택된 채널 타입 탭
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType>('OTA');

  // 옵션 목록 (실제 상품 옵션에서 가져옴)
  const [options, setOptions] = useState<Array<{
    id: string;
    name: string;
    category: string;
    base_price: number;
  }>>([]);

  // 선택된 필수 옵션 (전체적으로 하나만)
  const [selectedRequiredOption, setSelectedRequiredOption] = useState<string>('');

  // Supabase에서 channels 데이터 로드
  const loadChannels = useCallback(async () => {
    try {
      setIsLoadingChannels(true);
      
      // channels 테이블에서 데이터 로드 (status 필드가 없을 수 있으므로 제거)
      const { data: channelsData, error } = await supabase
        .from('channels')
        .select('id, name, type')
        .order('name');

      if (error) {
        console.error('Channels 로드 실패:', error);
        return;
      }

      // 채널 데이터 설정
      const channelsList = (channelsData as Array<{
        id: string;
        name: string;
        type: string | null;
      }>) || [];

      setChannels(channelsList);
    } catch (error) {
      console.error('Channels 로드 중 오류:', error);
    } finally {
      setIsLoadingChannels(false);
    }
  }, []);

  // Supabase에서 상품 옵션 데이터 로드
  const loadProductOptions = useCallback(async () => {
    try {
      
      // 병합된 product_options 테이블에서 필수 옵션만 가져옴
      const { data: optionsData, error } = await supabase
        .from('product_options')
        .select(`
          id,
          name,
          linked_option_id,
          choice_name,
          adult_price_adjustment,
          child_price_adjustment,
          infant_price_adjustment
        `)
        .eq('product_id', productId)
        .eq('is_required', true);

      if (error) {
        console.error('Product options 로드 실패:', error);
        return;
      }

      // 옵션 데이터를 가격 캘린더용으로 변환 (병합된 테이블 구조)
      const transformedOptions = (optionsData as Array<{
        id: string;
        name: string;
        choice_name?: string;
        adult_price_adjustment?: number;
        child_price_adjustment?: number;
        infant_price_adjustment?: number;
      }>)?.map((option) => {
        // 병합된 테이블에서는 각 행이 이미 하나의 선택지를 나타냄
        const adultPrice = option.adult_price_adjustment || 0;
        const childPrice = option.child_price_adjustment || 0;
        const infantPrice = option.infant_price_adjustment || 0;
        
        return {
          id: option.id,
          name: option.choice_name || option.name,
          category: '기본', // 기본 카테고리로 설정
          base_price: adultPrice,
          adult_price: adultPrice,
          child_price: childPrice,
          infant_price: infantPrice
        };
      }) || [];

      setOptions(transformedOptions);
      
      // 첫 번째 옵션을 기본 선택
      if (transformedOptions.length > 0) {
        const firstOption = transformedOptions[0];
        console.log(`초기 선택 설정: ${firstOption.name} (ID: ${firstOption.id})`);
        setSelectedRequiredOption(firstOption.id);
        
        // 기존 가격 정보를 pricingConfig에 설정
        setPricingConfig(prev => ({
          ...prev,
          required_options: transformedOptions.map(option => ({
            option_id: option.id,
            adult_price: option.adult_price,
            child_price: option.child_price,
            infant_price: option.infant_price
          }))
        }));
      } else {
        // 옵션이 없으면 선택 상태 초기화
        setSelectedRequiredOption('');
      }
    } catch (error) {
      console.error('Product options 로드 중 오류:', error);
    }
  }, [productId]);

  // Supabase에서 동적 가격 데이터 로드
  const loadDynamicPricingData = useCallback(async () => {
    try {
      
      const { data: pricingData, error } = await supabase
        .from('dynamic_pricing')
        .select('*')
        .eq('product_id', productId)
        .order('date');

      if (error) {
        console.error('Dynamic pricing 데이터 로드 실패:', error);
        return;
      }

      setDynamicPricingData(pricingData || []);
    } catch (error) {
      console.error('Dynamic pricing 데이터 로드 중 오류:', error);
    }
  }, [productId]);

  // 컴포넌트 마운트 시 channels와 options 데이터 로드
  useEffect(() => {
    loadChannels();
    loadProductOptions();
    loadDynamicPricingData();
  }, [loadChannels, loadProductOptions, loadDynamicPricingData]);

  // 리스트뷰용 월별 데이터 가져오기
  const getListViewData = () => {
    if (!selectedChannel) return [];
    
    const year = listViewMonth.getFullYear();
    const month = listViewMonth.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    return dynamicPricingData
      .filter(data => {
        const dataDate = new Date(data.date);
        return data.channel_id === selectedChannel && 
               dataDate >= startDate && 
               dataDate <= endDate;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // 리스트뷰 네비게이션
  const goToPreviousMonthList = () => {
    setListViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonthList = () => {
    setListViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };


  // 다중 선택 처리
  const handleMultiSelect = (date: string, index: number, event: React.MouseEvent) => {
    const listData = getListViewData();
    let newSelectedDates: string[] = [];
    
    console.log('다중 선택 처리:', {
      clickedDate: date,
      clickedIndex: index,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      lastSelectedIndex: lastSelectedIndex,
      listDataDates: listData.map(item => item.date)
    });
    
    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift 클릭: 범위 선택
      const startIndex = Math.min(lastSelectedIndex, index);
      const endIndex = Math.max(lastSelectedIndex, index);
      const rangeDates = listData.slice(startIndex, endIndex + 1).map(item => item.date);
      
      setSelectedDates(prev => {
        newSelectedDates = [...prev];
        rangeDates.forEach(rangeDate => {
          if (!newSelectedDates.includes(rangeDate)) {
            newSelectedDates.push(rangeDate);
          }
        });
        return newSelectedDates;
      });
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd 클릭: 개별 토글
      setSelectedDates(prev => {
        if (prev.includes(date)) {
          newSelectedDates = prev.filter(d => d !== date);
        } else {
          newSelectedDates = [...prev, date];
        }
        return newSelectedDates;
      });
      setLastSelectedIndex(index);
    } else {
      // 일반 클릭: 단일 선택
      newSelectedDates = [date];
      setSelectedDates(newSelectedDates);
      setLastSelectedIndex(index);
    }
    
    console.log('새로운 선택된 날짜들:', newSelectedDates);
    
    // 선택된 날짜들로 즉시 가격 설정 업데이트
    if (newSelectedDates.length > 0) {
      const sortedDates = newSelectedDates.sort();
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];
      
      setPricingConfig(prev => ({
        ...prev,
        start_date: startDate,
        end_date: endDate
      }));
    }
  };


  // 선택 초기화
  const clearSelection = () => {
    setSelectedDates([]);
    setLastSelectedIndex(null);
  };

  // 채널 타입별로 필터링
  const getChannelsByType = (type: ChannelType) => {
    return channels.filter(channel => {
      if (type === 'OTA') {
        // OTA: type 컬럼이 'OTA'인 항목만 (대소문자 구별 없이)
        return channel.type && channel.type.toLowerCase() === 'ota';
      } else if (type === 'Self') {
        // Self: OTA가 아닌 모든 항목
        return !channel.type || channel.type.toLowerCase() !== 'ota';
      } else if (type === 'Partner') {
        // Partner: Partner 타입인 항목 (현재는 사용하지 않지만 유지)
        return channel.type && channel.type.toLowerCase() === 'partner';
      }
      return false;
    });
  };


  // 채널 선택 시 가격 설정 초기화 (저장하지 않고 UI만 업데이트)
  useEffect(() => {
    if (selectedChannel) {
      // 선택된 채널 정보만 표시용으로 업데이트
      setPricingConfig(prev => ({
        ...prev,
        channel_id: selectedChannel
      }));
    }
  }, [selectedChannel]);

  // 채널 타입이 변경될 때 선택된 채널 초기화
  useEffect(() => {
    setSelectedChannel('');
  }, [selectedChannelType]);

  // 요일 선택/해제
  const handleWeekdayToggle = (dayOfWeek: number) => {
    setPricingConfig(prev => ({
      ...prev,
      selected_weekdays: prev.selected_weekdays.includes(dayOfWeek)
        ? prev.selected_weekdays.filter(d => d !== dayOfWeek)
        : [...prev.selected_weekdays, dayOfWeek]
    }));
  };


  // 필수 옵션 가격 변경 (새로운 함수)
  const handleRequiredOptionPriceChange = (optionId: string, field: 'adult_price' | 'child_price' | 'infant_price', value: number) => {
    setPricingConfig(prev => {
      const existingOptionIndex = prev.required_options.findIndex(opt => opt.option_id === optionId);
      
      if (existingOptionIndex >= 0) {
        // 기존 옵션이 있으면 업데이트
        return {
          ...prev,
          required_options: prev.required_options.map((option, i) =>
            i === existingOptionIndex ? { ...option, [field]: value } : option
          )
        };
      } else {
        // 새 옵션 추가
        const newOption = {
          option_id: optionId,
          adult_price: field === 'adult_price' ? value : 0,
          child_price: field === 'child_price' ? value : 0,
          infant_price: field === 'infant_price' ? value : 0
        };
        
        return {
          ...prev,
          required_options: [...prev.required_options, newOption]
        };
      }
    });
  };

  // 쿠폰 할인 계산 함수
  const calculateCouponDiscount = (basePrice: number, fixedDiscount: number, percentageDiscount: number, priority: 'fixed_first' | 'percentage_first' = 'fixed_first') => {
    let result = basePrice;
    
    if (priority === 'fixed_first') {
      // 고정 할인을 먼저 적용한 후 퍼센트 할인
      result = result - fixedDiscount;
      if (result < 0) result = 0; // 음수 방지
      result = result * (1 - percentageDiscount / 100);
    } else {
      // 퍼센트 할인을 먼저 적용한 후 고정 할인
      result = result * (1 - percentageDiscount / 100);
      result = result - fixedDiscount;
      if (result < 0) result = 0; // 음수 방지
    }
    
    return Math.max(0, result); // 최종적으로 음수 방지
  };

  // 가격 계산 (미리보기용)
  const calculatePreviewPrices = () => {
    const { adult_price, child_price, infant_price, markup_amount, coupon_fixed_discount, coupon_percentage_discount, discount_priority, commission_percent } = pricingConfig;
    
    // 최대 판매가 계산
    const maxAdultPrice = adult_price + markup_amount;
    const maxChildPrice = child_price + markup_amount;
    const maxInfantPrice = infant_price + markup_amount;

    // 쿠폰 할인 적용 (할인 우선순위 고려)
    const discountedAdultPrice = calculateCouponDiscount(maxAdultPrice, coupon_fixed_discount, coupon_percentage_discount, discount_priority);
    const discountedChildPrice = calculateCouponDiscount(maxChildPrice, coupon_fixed_discount, coupon_percentage_discount, discount_priority);
    const discountedInfantPrice = calculateCouponDiscount(maxInfantPrice, coupon_fixed_discount, coupon_percentage_discount, discount_priority);

    // 커미션 적용 (Net Price)
    const commissionMultiplier = (100 - commission_percent) / 100;
    const netAdultPrice = discountedAdultPrice * commissionMultiplier;
    const netChildPrice = discountedChildPrice * commissionMultiplier;
    const netInfantPrice = discountedInfantPrice * commissionMultiplier;

    return {
      max: { adult: maxAdultPrice, child: maxChildPrice, infant: maxInfantPrice },
      discounted: { adult: discountedAdultPrice, child: discountedChildPrice, infant: discountedInfantPrice },
      net: { adult: netAdultPrice, child: netChildPrice, infant: netInfantPrice }
    };
  };

  // 특정 날짜의 가격 계산 (캘린더용)
  const calculateDatePrices = (date: string, channelId: string) => {
    // 해당 날짜와 채널의 동적 가격 데이터 찾기
    const pricingData = dynamicPricingData.find(
      data => data.date === date && data.channel_id === channelId
    );

    if (!pricingData) {
      return null;
    }

    // 기본 가격 (adult_price)
    const baseAdultPrice = pricingData.adult_price;

    // 선택된 옵션의 가격 추가 (options_pricing 배열에서 선택된 옵션 ID로 검색)
    let optionAdultPrice = 0;
    if (selectedRequiredOption && pricingData.options_pricing) {
      console.log(`옵션 가격 데이터 확인 - 날짜: ${date}, 선택된 옵션: ${selectedRequiredOption}`, {
        options_pricing: pricingData.options_pricing,
        options_pricing_type: Array.isArray(pricingData.options_pricing) ? 'array' : 'object'
      });
      
      // options_pricing이 배열인 경우
      if (Array.isArray(pricingData.options_pricing)) {
        const optionPricing = pricingData.options_pricing.find(
          (option: { option_id: string; adult_price?: number }) => option.option_id === selectedRequiredOption
        );
        if (optionPricing) {
          optionAdultPrice = optionPricing.adult_price || 0;
          console.log(`배열에서 찾은 옵션 가격:`, optionPricing);
        }
      } else {
        // options_pricing이 객체인 경우 (기존 방식)
        const optionPricing = pricingData.options_pricing[selectedRequiredOption];
        if (optionPricing) {
          optionAdultPrice = optionPricing.adult || optionPricing.adult_price || 0;
          console.log(`객체에서 찾은 옵션 가격:`, optionPricing);
        }
      }
    }

    // 파란색: 최대 가격 = adult_price + options_pricing[선택된옵션ID].adult
    const maxAdultPrice = baseAdultPrice + optionAdultPrice;

    // 주황색: 할인 가격 = 최대 가격에서 coupon_percent 적용
    const couponDiscountAmount = maxAdultPrice * (pricingData.coupon_percent / 100);
    const discountedAdultPrice = maxAdultPrice - couponDiscountAmount;

    // 초록색: Net 가격 = 할인 가격에서 commission_percent 적용
    const commissionAmount = discountedAdultPrice * (pricingData.commission_percent / 100);
    const netAdultPrice = discountedAdultPrice - commissionAmount;

    console.log(`날짜 ${date} 가격 계산:`, {
      baseAdultPrice,
      optionAdultPrice,
      selectedOption: selectedRequiredOption,
      maxAdultPrice,
      couponPercent: pricingData.coupon_percent,
      discountedAdultPrice,
      commissionPercent: pricingData.commission_percent,
      netAdultPrice
    });

    return {
      max: { adult: maxAdultPrice, child: 0, infant: 0 },
      discounted: { adult: discountedAdultPrice, child: 0, infant: 0 },
      net: { adult: netAdultPrice, child: 0, infant: 0 }
    };
  };

  // 캘린더 네비게이션
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // 현재 월의 날짜들 생성
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // 이전 달의 마지막 날짜들
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
        hasPricing: false,
        pricing: null
      });
    }
    
    // 현재 달의 날짜들
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(year, month, i);
      const dateString = currentDate.toISOString().split('T')[0];
      
      // 해당 날짜에 가격 데이터가 있는지 확인
      const hasPricing = dynamicPricingData.some(data => data.date === dateString);
      
      days.push({
        date: currentDate,
        isCurrentMonth: true,
        hasPricing: hasPricing,
        pricing: generateDailyPricing(currentDate)
      });
    }
    
    // 다음 달의 첫 날짜들
    const remainingDays = 42 - days.length; // 6주 x 7일 = 42
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        hasPricing: false,
        pricing: null
      });
    }
    
    return days;
  };

  // 일별 가격 생성 (dynamic_pricing 데이터 사용)
  const generateDailyPricing = (date: Date) => {
    if (!selectedChannel) return null;
    
    const dateString = date.toISOString().split('T')[0];
    const prices = calculateDatePrices(dateString, selectedChannel);
    
    if (!prices) return null;

    // 기존 호환성을 위해 customerPayment, commission, ourReceivedAmount 형태로 반환
   return {
      customerPayment: prices.max.adult,      // 최대 가격
      commission: prices.max.adult - prices.net.adult,  // 커미션 금액
      ourReceivedAmount: prices.net.adult     // Net 가격
   };
  };

  // 선택된 옵션이 변경될 때마다 캘린더 가격 업데이트
  useEffect(() => {
    // currentMonth가 변경되거나 selectedRequiredOption이 변경될 때 daysInMonth 재계산
    // 이 useEffect는 의존성 배열에 currentMonth와 selectedRequiredOption을 포함하여
    // 이 값들이 변경될 때마다 캘린더를 새로고침합니다.
    console.log('옵션 또는 월이 변경됨:', selectedRequiredOption);
  }, [currentMonth, selectedRequiredOption, dynamicPricingData, selectedChannel]);

  // selectedRequiredOption 상태 변화 모니터링
  useEffect(() => {
    console.log('selectedRequiredOption 상태 변화:', selectedRequiredOption);
    
    // 선택된 옵션 확인
    const selectedOption = options.find(opt => opt.id === selectedRequiredOption);
    if (selectedOption) {
      console.log(`선택된 옵션: ${selectedOption.name} (카테고리: ${selectedOption.category})`);
    }
  }, [selectedRequiredOption, options]);

    // 통합 저장 함수 - 모든 가격 관련 데이터를 한 번에 저장
  const handleUnifiedSave = async () => {
    if (isNewProduct) {
      setSaveMessage('새 상품은 전체 저장을 사용해주세요.')
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      // 1. 모든 채널에 대해 가격 규칙 생성
      console.log('저장할 채널들:', channels);
      
      // 2. 가격 설정 저장
      const pricingData = {
        ...pricingConfig,
        selected_required_option: selectedRequiredOption,
        required_options: pricingConfig.required_options.filter(option => 
          option.adult_price > 0 || option.child_price > 0 || option.infant_price > 0
        ),
        created_at: new Date().toISOString()
      };
      console.log('저장할 가격 설정:', pricingData);
      console.log('pricingConfig 값들:', {
        adult_price: pricingConfig.adult_price,
        child_price: pricingConfig.child_price,
        infant_price: pricingConfig.infant_price
      });

      // 3. pricingConfig를 기반으로 pricingRules 생성
      const generatedPricingRules: CreatePricingRuleDto[] = []
      
      // 모든 채널에 대해 가격 규칙 생성
      const activeChannels = channels
      
      for (const channel of activeChannels) {
        // 선택된 요일들에 대해 각각 가격 규칙 생성
        for (const dayOfWeek of pricingConfig.selected_weekdays) {
          // 시작일부터 종료일까지의 모든 날짜에 대해 가격 규칙 생성
          const startDate = new Date(pricingConfig.start_date)
          const endDate = new Date(pricingConfig.end_date)
          
          for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            // 해당 날짜가 선택된 요일인지 확인
            if (date.getDay() === dayOfWeek) {
              const rule: CreatePricingRuleDto = {
                product_id: productId,
                channel_id: channel.id,
                rule_name: `${channel.name} ${DAY_NAMES[dayOfWeek]} 가격`,
                start_date: date.toISOString().split('T')[0],
                end_date: date.toISOString().split('T')[0],
                weekday_pricing: [{
                  day_of_week: dayOfWeek,
                  adult_price: pricingConfig.adult_price,
                  child_price: pricingConfig.child_price || pricingConfig.adult_price, // 아동은 성인과 같은 가격
                  infant_price: pricingConfig.infant_price || pricingConfig.adult_price  // 유아는 성인과 같은 가격
                }],
                required_option_pricing: pricingConfig.required_options.map(option => ({
                  option_id: option.option_id,
                  adult_price: option.adult_price,
                  child_price: option.child_price,
                  infant_price: option.infant_price
                }))
              }
              generatedPricingRules.push(rule)
            }
          }
        }
      }
      
      console.log('생성된 가격 규칙들:', generatedPricingRules)

      // 4. 기존 동적 가격 규칙들 삭제
      const { error: deleteError } = await supabase
        .from('dynamic_pricing')
        .delete()
        .eq('product_id', productId)

      if (deleteError) throw deleteError

      // 5. 새 동적 가격 규칙들 추가
      for (const rule of generatedPricingRules) {
        const weekdayPricing = rule.weekday_pricing?.[0]
        const adultPrice = weekdayPricing?.adult_price || 0
        const childPrice = weekdayPricing?.child_price || 0
        const infantPrice = weekdayPricing?.infant_price || 0

        const insertData = {
            product_id: productId,
            channel_id: rule.channel_id,
            date: rule.start_date,
            adult_price: adultPrice,
          child_price: childPrice || adultPrice, // 아동은 성인과 같은 가격
          infant_price: infantPrice || adultPrice, // 유아는 성인과 같은 가격
          options_pricing: rule.required_option_pricing || [],
            commission_percent: pricingConfig.commission_percent,
            markup_amount: pricingConfig.markup_amount,
          coupon_percent: pricingConfig.coupon_percentage_discount || 0,
            is_sale_available: pricingConfig.is_sale_available,
            not_included_price: pricingConfig.not_included_price || 0
        }

        console.log('동적 가격 저장 데이터:', insertData)
        console.log('저장되는 가격 값들:', {
          adult_price: adultPrice,
          child_price: childPrice,
          infant_price: infantPrice
        })
        console.log('저장되는 options_pricing:', insertData.options_pricing)

        const { error: ruleError } = await supabase
          .from('dynamic_pricing')
          .insert(insertData as never)

        if (ruleError) {
          console.error('동적 가격 저장 오류:', ruleError)
          throw ruleError
        }
        
        console.log('동적 가격 저장 성공:', rule.channel_id, rule.start_date)
      }

      // 5. 성공 메시지
      setSaveMessage('모든 가격 정보가 성공적으로 저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)

      // 6. onSave 콜백 호출 (부모 컴포넌트에 알림)
      if (onSave) {
        onSave({
          id: Date.now().toString(),
          product_id: productId,
          channel_id: selectedChannel,
          rule_name: `통합 가격 규칙 ${new Date().toLocaleDateString()}`,
          start_date: pricingConfig.start_date,
          end_date: pricingConfig.end_date,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      console.error('통합 저장 오류:', errorMessage)
      setSaveMessage(`저장에 실패했습니다: ${errorMessage}`)
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setSaving(false)
    }
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const previewPrices = calculatePreviewPrices();

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50">
      {/* 1. 왼쪽 채널 선택 사이드바 - 모바일에서는 접을 수 있는 드롭다운 */}
      <div className="w-full lg:w-[15%] bg-white border-r border-gray-200 p-4 lg:block">
        {/* 모바일용 채널 선택 드롭다운 */}
        <div className="lg:hidden mb-4">
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4 hidden lg:block">채널 관리</h3>
        
        {/* 채널 타입 탭 - 모바일에서는 숨김 */}
        <div className="hidden lg:flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setSelectedChannelType('OTA')}
            className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedChannelType === 'OTA'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Globe className="h-4 w-4 mr-1" />
            OTA
            <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
              {getChannelsByType('OTA').length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedChannelType('Self')}
            className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedChannelType === 'Self'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Users className="h-4 w-4 mr-1" />
            Self
            <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
              {getChannelsByType('Self').length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedChannelType('Partner')}
            className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedChannelType === 'Partner'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Building className="h-4 w-4 mr-1" />
            Partner
            <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
              {getChannelsByType('Partner').length}
            </span>
          </button>
        </div>
        
        {isLoadingChannels ? (
           <div className="flex items-center justify-center py-8">
             <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
             <span className="ml-2 text-gray-600">채널 로딩 중...</span>
           </div>
         ) : (
           <div className="space-y-1 hidden lg:block">
             {getChannelsByType(selectedChannelType).map(channel => (
               <div
                 key={channel.id}
                 className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                   selectedChannel === channel.id
                     ? 'border-blue-500 bg-blue-50'
                     : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                 }`}
                 onClick={() => setSelectedChannel(channel.id)}
               >
                 {/* 채널 이름 */}
                 <div className={`text-sm font-medium ${
                   selectedChannel === channel.id ? 'text-blue-700' : 'text-gray-900'
                 }`}>
                   {channel.name}
                 </div>
                 
               </div>
             ))}
             
             {/* 해당 타입에 채널이 없을 때 */}
             {getChannelsByType(selectedChannelType).length === 0 && (
               <div className="text-center py-8 text-gray-500">
                 <div className="text-4xl mb-2">
                   {selectedChannelType === 'OTA' && <Globe className="h-8 w-8 mx-auto text-gray-300" />}
                   {selectedChannelType === 'Self' && <Users className="h-8 w-8 mx-auto text-gray-300" />}
                   {selectedChannelType === 'Partner' && <Building className="h-8 w-8 mx-auto text-gray-300" />}
                 </div>
                 <p className="text-sm">해당 타입의 채널이 없습니다</p>
               </div>
             )}
           </div>
         )}
        
        {/* 채널 및 옵션 새로고침 버튼 - 모바일에서는 숨김 */}
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 hidden lg:block">
          <button
            type="button"
            onClick={loadChannels}
            className="w-full p-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
          >
            채널 새로고침
          </button>
          <button
            type="button"
            onClick={loadProductOptions}
            className="w-full p-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
          >
            옵션 새로고침
          </button>
        </div>
      </div>

      {/* 2. 가격 캘린더 - 모바일에서는 전체 너비 */}
      <div className="w-full lg:w-[30%] bg-white border-r border-gray-200 p-4 h-[40vh] lg:h-auto overflow-y-auto">

         <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
           <h3 className="text-lg font-semibold text-gray-900">가격 캘린더</h3>
           <div className="flex items-center space-x-2">
             {/* 뷰 모드 전환 버튼 */}
             <div className="flex bg-gray-100 rounded-lg p-1">
               <button
                 type="button"
                 onClick={() => setViewMode('calendar')}
                 className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                   viewMode === 'calendar'
                     ? 'bg-white text-blue-600 shadow-sm'
                     : 'text-gray-600 hover:text-gray-800'
                 }`}
               >
                 달력
               </button>
               <button
                 type="button"
                 onClick={() => setViewMode('list')}
                 className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                   viewMode === 'list'
                     ? 'bg-white text-blue-600 shadow-sm'
                     : 'text-gray-600 hover:text-gray-800'
                 }`}
               >
                 리스트
               </button>
             </div>
             
             {/* 달력뷰 네비게이션 */}
             {viewMode === 'calendar' && (
           <div className="flex space-x-1">
             <button
               type="button"
               onClick={goToPreviousMonth}
               className="p-1 hover:bg-gray-100 rounded"
             >
               <ChevronLeft size={16} />
             </button>
             <button
               type="button"
               onClick={goToNextMonth}
               className="p-1 hover:bg-gray-100 rounded"
             >
               <ChevronRight size={16} />
             </button>
               </div>
             )}
           </div>
         </div>

         {/* 옵션 선택기 */}
         {options.length > 0 && (
           <div className="mb-4 p-3 bg-gray-50 rounded-lg">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 space-y-1 sm:space-y-0">
                <h4 className="text-sm font-medium text-gray-700">필수 옵션 선택:</h4>
                <div className="text-xs text-gray-500">
                  하나만 선택
                </div>
              </div>
             <div className="space-y-3">
               {(() => {
                 const groupedOptions = options.reduce((acc, option) => {
                   const category = option.category || '기타';
                   if (!acc[category]) {
                     acc[category] = [];
                   }
                   acc[category].push(option);
                   return acc;
                 }, {} as Record<string, typeof options>);

                                   return Object.entries(groupedOptions).map(([category, categoryOptions]) => {
                                         return (
                       <div key={category}>
                         <div className="flex flex-wrap gap-2">
                          {categoryOptions.map(option => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                console.log(`옵션 선택: ${option.name} (ID: ${option.id})`);
                                setSelectedRequiredOption(option.id);
                              }}
                              className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                                selectedRequiredOption === option.id
                                  ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                              }`}
                            >
                              <span className="truncate max-w-[120px]">{option.name}</span>
                              {selectedRequiredOption === option.id && (
                                <span className="ml-1">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  });
               })()}
             </div>
           </div>
         )}
         
         {/* 달력뷰 */}
         {viewMode === 'calendar' && (
           <>
         <div className="text-center mb-4">
           <h4 className="font-medium text-gray-900">
             {currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
           </h4>
         </div>

                 {/* 요일 헤더 */}
         <div className="grid grid-cols-7 gap-1 mb-2">
           {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
             <div key={day} className="text-center text-xs font-medium text-gray-500 p-1">
               <span className="hidden sm:inline">{day}</span>
               <span className="sm:hidden">{day.charAt(0)}</span>
             </div>
           ))}
         </div>

                 {/* 날짜 그리드 */}
         <div className="grid grid-cols-7 gap-1">
               {daysInMonth.map((day, index) => {
                 const dateString = day.date.toISOString().split('T')[0];
                 const prices = selectedChannel ? calculateDatePrices(dateString, selectedChannel) : null;
                 
                 return (
             <div
               key={index}
               className={`p-1 text-xs border rounded cursor-pointer transition-colors ${
                 day.isCurrentMonth
                         ? prices
                     ? 'bg-white border-gray-200 hover:bg-gray-50'
                     : 'bg-white border-gray-200 hover:bg-gray-50'
                   : 'bg-gray-100 border-gray-200 text-gray-400'
               }`}
             >
               <div className="text-center font-medium mb-1">
                 {day.date.getDate()}
               </div>
               
               {/* 가격 정보 표시 */}
                     {day.isCurrentMonth && prices && (
                 <div className="space-y-1">
                   <div className="text-center text-xs font-bold text-blue-600">
                     <span className="hidden sm:inline">${prices.max.adult.toFixed(2)}</span>
                     <span className="sm:hidden">${prices.max.adult.toFixed(0)}</span>
                   </div>
                   <div className="text-center text-xs text-orange-600">
                     <span className="hidden sm:inline">${prices.discounted.adult.toFixed(2)}</span>
                     <span className="sm:hidden">${prices.discounted.adult.toFixed(0)}</span>
                   </div>
                   <div className="text-center text-xs text-green-600">
                     <span className="hidden sm:inline">${prices.net.adult.toFixed(2)}</span>
                     <span className="sm:hidden">${prices.net.adult.toFixed(0)}</span>
                   </div>
                 </div>
               )}
             </div>
                 );
               })}
         </div>
           </>
         )}

         {/* 리스트뷰 */}
         {viewMode === 'list' && (
           <>
             {/* 리스트뷰 헤더 */}
             <div className="flex items-center justify-between mb-4">
               <h4 className="font-medium text-gray-900">
                 {listViewMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
               </h4>
               <div className="flex space-x-1">
                 <button
                   type="button"
                   onClick={goToPreviousMonthList}
                   className="p-1 hover:bg-gray-100 rounded"
                 >
                   <ChevronLeft size={16} />
                 </button>
                 <button
                   type="button"
                   onClick={goToNextMonthList}
                   className="p-1 hover:bg-gray-100 rounded"
                 >
                   <ChevronRight size={16} />
                 </button>
               </div>
             </div>

             {/* 다중 선택 컨트롤 */}
             {selectedDates.length > 0 && (
               <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                 <div className="flex items-center justify-between">
                   <div className="text-sm text-blue-800">
                     {selectedDates.length}개 날짜 선택됨 (자동으로 가격 설정에 반영됨)
                   </div>
                   <button
                     type="button"
                     onClick={clearSelection}
                     className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                   >
                     선택 해제
                   </button>
                 </div>
               </div>
             )}

             {/* 리스트 데이터 */}
             <div className="space-y-2 h-[400px] lg:h-[800px] overflow-y-auto">
               {getListViewData().length > 0 ? (
                 getListViewData().map((data, index) => {
                   const prices = calculateDatePrices(data.date, data.channel_id);
                   const displayDate = new Date(data.date).toLocaleDateString('ko-KR', { 
                     month: 'short', 
                     day: 'numeric',
                     weekday: 'short'
                   });
                   
                   // 클릭 시 사용하는 날짜 형식과 동일하게 변환
                   const clickedDate = new Date(data.date);
                   const year = clickedDate.getFullYear();
                   const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
                   const day = String(clickedDate.getDate()).padStart(2, '0');
                   const formattedDate = `${year}-${month}-${day}`;
                   
                   const isSelected = selectedDates.includes(formattedDate);
                   
                   console.log('카드 렌더링:', {
                     dataDate: data.date,
                     formattedDate: formattedDate,
                     isSelected: isSelected,
                     selectedDates: selectedDates
                   });
                   
                   return (
                     <div 
                       key={data.id} 
                       className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                         isSelected 
                           ? 'border-blue-500 bg-blue-50' 
                           : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300'
                       }`}
                       onClick={(event) => {
                         // 표시된 날짜를 기준으로 클릭 이벤트 처리
                         const clickedDate = new Date(data.date);
                         const year = clickedDate.getFullYear();
                         const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
                         const day = String(clickedDate.getDate()).padStart(2, '0');
                         const formattedDate = `${year}-${month}-${day}`;
                         
                         // 다중 선택 처리 (가격 설정도 자동 업데이트됨)
                         handleMultiSelect(formattedDate, index, event);
                         
                         // 가격 설정 탭으로 스크롤
                         const pricingSection = document.getElementById('pricing-section');
                         if (pricingSection) {
                           pricingSection.scrollIntoView({ behavior: 'smooth' });
                         }
                       }}
                       title={`클릭하여 가격 수정 (표시: ${displayDate}, 실제: ${data.date})`}
                     >
                       <div className="flex items-center justify-between mb-2">
                         <div className="font-medium text-sm">
                           {new Date(data.date).toLocaleDateString('ko-KR', { 
                             month: 'short', 
                             day: 'numeric',
                             weekday: 'short'
                           })}
                         </div>
                         <div className="text-xs text-gray-500">
                           {channels.find(c => c.id === data.channel_id)?.name}
                         </div>
                       </div>
                       
                       {prices && (
                         <div className="text-xs space-y-1">
                           <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0">
                             <span className="text-blue-600 font-bold">최대: ${prices.max.adult.toFixed(2)}</span>
                             <span className="hidden sm:inline mx-2 text-gray-400">|</span>
                             <span className="text-orange-600 font-bold">할인: ${prices.discounted.adult.toFixed(2)}</span>
                             <span className="hidden sm:inline mx-2 text-gray-400">|</span>
                             <span className="text-green-600 font-bold">Net: ${prices.net.adult.toFixed(2)}</span>
                           </div>
                           <div className="text-gray-500 text-xs hidden sm:block">
                             기본가 ${data.adult_price.toFixed(2)} + 옵션 ${(prices.max.adult - data.adult_price).toFixed(2)} 
                             → 쿠폰 -${(prices.max.adult - prices.discounted.adult).toFixed(2)} 
                             → 커미션 -${(prices.discounted.adult - prices.net.adult).toFixed(2)}
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 })
               ) : (
                 <div className="text-center py-8 text-gray-500">
                   <div className="text-sm">이 달에 가격 데이터가 없습니다</div>
                 </div>
               )}
             </div>

             {/* 선택 안내 */}
             <div className="mt-4 pt-3 border-t border-gray-200">
               <div className="text-xs text-gray-500">
                 <div className="font-medium mb-1">선택 방법:</div>
                 <div>• 일반 클릭: 단일 선택</div>
                 <div>• Ctrl/Cmd + 클릭: 개별 추가/제거</div>
                 <div>• Shift + 클릭: 범위 선택</div>
               </div>
             </div>
           </>
         )}
         
         {/* 가격 범례 */}
         <div className="mt-4 pt-4 border-t border-gray-200">
           <div className="text-xs text-gray-600 mb-2">필수 옵션에 따른 가격 (성인 기준)</div>
           <div className="space-y-1">
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
               <span className="text-xs text-gray-600">최대 가격</span>
             </div>
             <div className="text-xs text-gray-500 ml-4">기본가 + 선택옵션가</div>
             
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
               <span className="text-xs text-gray-600">할인 가격</span>
             </div>
             <div className="text-xs text-gray-500 ml-4">최대가 - 쿠폰할인</div>
             
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 bg-green-600 rounded-full"></div>
               <span className="text-xs text-gray-600">Net 가격</span>
             </div>
             <div className="text-xs text-gray-500 ml-4">할인가 - 커미션</div>
           </div>
         </div>
       </div>

      {/* 3. 가운데 가격 설정 섹션 */}
      <div id="pricing-section" className="w-full lg:w-[30%] bg-white p-4 lg:p-6 overflow-y-auto h-[60vh] lg:h-auto">
        <div className="max-w-none mx-auto">
                                 <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedChannel ? `${channels.find(c => c.id === selectedChannel)?.name} 가격 설정` : '가격 설정'}
            </h2>
           
           {!selectedChannel ? (
             <div className="text-center py-12">
               <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
               <h3 className="text-lg font-medium text-gray-900 mb-2">채널을 선택해주세요</h3>
               <p className="text-gray-600">가격을 설정하려면 왼쪽에서 채널을 선택하세요.</p>
             </div>
           ) : (
             <div className="space-y-4">

              {/* 기간 설정 */}
              <div className="grid grid-cols-2 gap-2 lg:gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    시작일 *
                  </label>
                  <input
                    type="date"
                    value={pricingConfig.start_date}
                    onChange={(e) => setPricingConfig(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    종료일 *
                  </label>
                  <input
                    type="date"
                    value={pricingConfig.end_date}
                    onChange={(e) => setPricingConfig(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

                             {/* 요일 선택 */}
               <div>
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 space-y-2 sm:space-y-0">
                   <label className="text-xs font-medium text-gray-700">
                     적용 요일 선택
                   </label>
                   <div className="flex space-x-1">
                     <button
                       type="button"
                       onClick={() => setPricingConfig(prev => ({
                         ...prev,
                         selected_weekdays: [0, 1, 2, 3, 4, 5, 6]
                       }))}
                       className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                     >
                       전체
                     </button>
                     <button
                       type="button"
                       onClick={() => setPricingConfig(prev => ({
                         ...prev,
                         selected_weekdays: []
                       }))}
                       className="px-2 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                     >
                       해제
                     </button>
                   </div>
                 </div>
                 <div className="grid grid-cols-7 gap-1">
                   {Array.from({ length: 7 }, (_, i) => (
                     <button
                       key={i}
                       type="button"
                       onClick={() => handleWeekdayToggle(i)}
                       className={`p-1.5 rounded-lg border transition-colors ${
                         pricingConfig.selected_weekdays.includes(i)
                           ? 'border-blue-500 bg-blue-50 text-blue-700'
                           : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                       }`}
                     >
                       <div className="text-xs font-medium">{DAY_NAMES[i]}</div>
                     </button>
                   ))}
                 </div>
               </div>

              {/* 판매 가능 여부 */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">판매 가능 여부</h4>
                  <p className="text-xs text-gray-600">이 기간 동안 상품 판매 허용</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPricingConfig(prev => ({ ...prev, is_sale_available: !prev.is_sale_available }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    pricingConfig.is_sale_available ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      pricingConfig.is_sale_available ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

                                                           {/* 수수료 및 할인 설정 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1">
                     커미션 (%)
                   </label>
                   <div className="relative">
                                          <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={pricingConfig.commission_percent}
                        onChange={(e) => setPricingConfig(prev => ({ ...prev, commission_percent: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                     <Percent className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                   </div>
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1">
                     업차지 ($)
                   </label>
                   <div className="relative">
                                          <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pricingConfig.markup_amount}
                        onChange={(e) => setPricingConfig(prev => ({ ...prev, markup_amount: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                     <DollarSign className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                   </div>
                 </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      할인 우선
                    </label>
                    <select
                      value={pricingConfig.discount_priority || 'fixed_first'}
                      onChange={(e) => setPricingConfig(prev => ({ ...prev, discount_priority: e.target.value as 'fixed_first' | 'percentage_first' }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="fixed_first">고정값</option>
                      <option value="percentage_first">퍼센트</option>
                    </select>
                  </div>
                  <div>
                    {pricingConfig.discount_priority === 'fixed_first' ? (
                      <>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          쿠폰값 ($)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricingConfig.coupon_fixed_discount}
                            onChange={(e) => setPricingConfig(prev => ({ ...prev, coupon_fixed_discount: parseFloat(e.target.value) || 0 }))}
                            className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                          <DollarSign className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          쿠폰 (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={pricingConfig.coupon_percentage_discount}
                            onChange={(e) => setPricingConfig(prev => ({ ...prev, coupon_percentage_discount: parseFloat(e.target.value) || 0 }))}
                            className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                          <Percent className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                        </div>
                      </>
                    )}
                  </div>
               </div>

                             {/* 기본 판매가 */}
               <div>
                 <h4 className="text-sm font-medium text-gray-900 mb-2">기본 판매가</h4>
                 <div className="grid grid-cols-3 gap-2">
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">성인 ($)</label>
                     <div className="relative">
                       <input
                         type="number"
                         value={pricingConfig.adult_price}
                         onChange={(e) => setPricingConfig(prev => ({ ...prev, adult_price: parseFloat(e.target.value) || 0 }))}
                         className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         placeholder="0"
                       />
                       <DollarSign className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                     </div>
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">아동 ($)</label>
                     <div className="relative">
                       <input
                         type="number"
                         value={pricingConfig.child_price}
                         onChange={(e) => {
                           const value = parseFloat(e.target.value) || 0;
                           console.log('아동 가격 변경:', value);
                           setPricingConfig(prev => ({ ...prev, child_price: value }));
                         }}
                         className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         placeholder="0"
                       />
                       <DollarSign className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                     </div>
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">유아 ($)</label>
                     <div className="relative">
                       <input
                         type="number"
                         value={pricingConfig.infant_price}
                         onChange={(e) => {
                           const value = parseFloat(e.target.value) || 0;
                           console.log('유아 가격 변경:', value);
                           setPricingConfig(prev => ({ ...prev, infant_price: value }));
                         }}
                         className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         placeholder="0"
                       />
                       <DollarSign className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                     </div>
                   </div>
                 </div>
               </div>

                               {/* 필수 선택 옵션 가격 설정 */}
                {options.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">필수 선택 옵션 가격 설정</h4>
                    <div className="space-y-3">
                      {(() => {
                        const groupedOptions = options.reduce((acc, option) => {
                          const category = option.category || '기타';
                          if (!acc[category]) {
                            acc[category] = [];
                          }
                          acc[category].push(option);
                          return acc;
                        }, {} as Record<string, typeof options>);

                        return Object.entries(groupedOptions).map(([category, categoryOptions]) => (
                          <div key={category} className="border border-gray-200 rounded-lg p-3">
                            <div className="mb-2">
                              <h5 className="text-sm font-medium text-gray-700">
                                ○ {category}
                              </h5>
                            </div>
                            <div className="space-y-2">
                              {categoryOptions.map(option => {
                                const existingOption = pricingConfig.required_options.find(
                                  opt => opt.option_id === option.id
                                );
                                
                                                                 return (
                                   <div key={option.id} className="pl-4">
                                     <div className="mb-2">
                                       <span className="text-sm text-gray-900">
                                         - {option.name}
                                       </span>
                                     </div>
                                     
                                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                       <div className="flex flex-col space-y-1">
                                         <span className="text-xs text-gray-600">성인</span>
                                         <div className="relative">
                                           <input
                                             type="number"
                                             min="0"
                                             step="0.01"
                                             value={existingOption?.adult_price || 0}
                                             onChange={(e) => handleRequiredOptionPriceChange(option.id, 'adult_price', parseFloat(e.target.value) || 0)}
                                             className="w-full pl-6 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                             placeholder="0"
                                           />
                                           <DollarSign className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                                         </div>
                                       </div>
                                       <div className="flex flex-col space-y-1">
                                         <span className="text-xs text-gray-600">아동</span>
                                         <div className="relative">
                                           <input
                                             type="number"
                                             min="0"
                                             step="0.01"
                                             value={existingOption?.child_price || 0}
                                             onChange={(e) => handleRequiredOptionPriceChange(option.id, 'child_price', parseFloat(e.target.value) || 0)}
                                             className="w-full pl-6 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                             placeholder="0"
                                           />
                                           <DollarSign className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                                         </div>
                                       </div>
                                       <div className="flex flex-col space-y-1">
                                         <span className="text-xs text-gray-600">유아</span>
                                         <div className="relative">
                                           <input
                                             type="number"
                                             min="0"
                                             step="0.01"
                                             value={existingOption?.infant_price || 0}
                                             onChange={(e) => handleRequiredOptionPriceChange(option.id, 'infant_price', parseFloat(e.target.value) || 0)}
                                             className="w-full pl-6 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                             placeholder="0"
                                           />
                                           <DollarSign className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                                         </div>
                                       </div>
                                     </div>
                                   </div>
                                 );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

              {/* 필수 선택 옵션 가격 */}


                                           {/* 통합 저장 버튼 */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <h4 className="text-lg font-medium text-gray-900">동적 가격 관리</h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnifiedSave}
                    disabled={saving || isNewProduct}
                    className={`w-full sm:w-auto px-6 py-3 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
                      saving || isNewProduct
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? '저장 중...' : '가격 정보 저장'}</span>
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    not_included_price ($)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricingConfig.not_included_price}
                      onChange={(e) => setPricingConfig(prev => ({ ...prev, not_included_price: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                    <DollarSign className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">OTA 성인가: 성인가격 − not_included</p>
                </div>
                {saveMessage && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${
                    saveMessage.includes('성공') 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-red-100 text-red-800 border border-green-200'
                  }`}>
                    {saveMessage}
                  </div>
                )}
                {isNewProduct && (
                  <p className="mt-2 text-sm text-gray-500">
                    새 상품은 전체 저장을 사용해주세요.
                  </p>
                )}
              </div>

               {/* 변경 내역 */}
               <div className="mt-8 pt-6 border-t border-gray-200">
                 <h4 className="text-lg font-medium text-gray-900 mb-4">가격 규칙 변경 내역</h4>
                 <ChangeHistory 
                   tableName="dynamic_pricing_rules" 
                   title="가격 규칙 변경 내역"
                   maxItems={5}
                 />
               </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. 오른쪽 가격 미리보기 - 모바일에서는 접을 수 있는 아코디언 */}
      <div className="w-full lg:w-[25%] bg-white border-l border-gray-200 p-4 h-[50vh] lg:h-auto overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Eye className="h-5 w-5 text-blue-600 mr-2" />
            가격 미리보기
          </h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">세부 가격</span>
            <button
              type="button"
              onClick={() => setShowDetailedPrices(!showDetailedPrices)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                showDetailedPrices ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showDetailedPrices ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
        
        {!selectedChannel ? (
          <div className="text-center py-8 text-gray-500">
            채널을 선택하면 가격 미리보기가 표시됩니다.
          </div>
        ) : (
          <div className="space-y-4">
            {/* 기본 가격 요약 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-3">기본 가격 (기본 판매가 + 옵션 선택가)</h4>
              
              {/* 옵션별 기본 가격 */}
              {(() => {
                const optionsWithPrices = options.filter(option => {
                  const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                  return existingOption && (existingOption.adult_price > 0 || existingOption.child_price > 0 || existingOption.infant_price > 0);
                });

                if (optionsWithPrices.length === 0) return null;

                return (
                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <div className="space-y-3">
                      {optionsWithPrices.map(option => {
                        const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                        if (!existingOption) return null;

                        const adultTotalPrice = pricingConfig.adult_price + existingOption.adult_price;
                        const childTotalPrice = pricingConfig.child_price + existingOption.child_price;
                        const infantTotalPrice = pricingConfig.infant_price + existingOption.infant_price;

                        return (
                          <div key={option.id} className="bg-white p-3 rounded border border-blue-200">
                            <h6 className="font-medium text-sm text-blue-800 mb-2 flex justify-between">
                              <span>{option.name}</span>
                              <span className="text-blue-600">${adultTotalPrice}</span>
                            </h6>
                            {showDetailedPrices && (
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span>성인:</span>
                                  <span>${pricingConfig.adult_price} + ${existingOption.adult_price} = <span className="font-medium">${adultTotalPrice}</span></span>
                                </div>
                                <div className="flex justify-between">
                                  <span>아동:</span>
                                  <span>${pricingConfig.child_price} + ${existingOption.child_price} = <span className="font-medium">${childTotalPrice}</span></span>
                                </div>
                                <div className="flex justify-between">
                                  <span>유아:</span>
                                  <span>${pricingConfig.infant_price} + ${existingOption.infant_price} = <span className="font-medium">${infantTotalPrice}</span></span>
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
            </div>

            {/* 최대 판매가 */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-3">최대 판매가 (기본 가격 + 업차지)</h4>
              
              {/* 옵션별 최대 판매가 */}
              {(() => {
                const optionsWithPrices = options.filter(option => {
                  const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                  return existingOption && (existingOption.adult_price > 0 || existingOption.child_price > 0 || existingOption.infant_price > 0);
                });

                if (optionsWithPrices.length === 0) return null;

                return (
                  <div className="mt-4 pt-3 border-t border-green-200">
                    <div className="space-y-3">
                      {optionsWithPrices.map(option => {
                        const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                        if (!existingOption) return null;

                        const adultBasePrice = pricingConfig.adult_price + existingOption.adult_price;
                        const childBasePrice = pricingConfig.child_price + existingOption.child_price;
                        const infantBasePrice = pricingConfig.infant_price + existingOption.infant_price;

                        const adultMaxPrice = adultBasePrice + pricingConfig.markup_amount;
                        const childMaxPrice = childBasePrice + pricingConfig.markup_amount;
                        const infantMaxPrice = infantBasePrice + pricingConfig.markup_amount;

                        return (
                          <div key={option.id} className="bg-white p-3 rounded border border-green-200">
                            <h6 className="font-medium text-sm text-green-800 mb-2 flex justify-between">
                              <span>{option.name}</span>
                              <span className="text-green-600">${adultMaxPrice.toFixed(2)}</span>
                            </h6>
                            {showDetailedPrices && (
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span>성인:</span>
                                  <span>${adultBasePrice} + ${pricingConfig.markup_amount} = <span className="font-medium">${adultMaxPrice.toFixed(2)}</span></span>
                                </div>
                                <div className="flex justify-between">
                                  <span>아동:</span>
                                  <span>${childBasePrice} + ${pricingConfig.markup_amount} = <span className="font-medium">${childMaxPrice.toFixed(2)}</span></span>
                                </div>
                                <div className="flex justify-between">
                                  <span>유아:</span>
                                  <span>${infantBasePrice} + ${pricingConfig.markup_amount} = <span className="font-medium">${infantMaxPrice.toFixed(2)}</span></span>
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
            </div>

            {/* 최대 할인가 */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-3">할인 가격 (기본 가격 * 쿠폰할인)</h4>
              
              {/* 옵션별 할인 가격 */}
              {(() => {
                const optionsWithPrices = options.filter(option => {
                  const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                  return existingOption && (existingOption.adult_price > 0 || existingOption.child_price > 0 || existingOption.infant_price > 0);
                });

                if (optionsWithPrices.length === 0) return null;

                return (
                  <div className="mt-4 pt-3 border-t border-yellow-200">
                    <div className="space-y-3">
                      {optionsWithPrices.map(option => {
                        const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                        if (!existingOption) return null;

                        const adultBasePrice = pricingConfig.adult_price + existingOption.adult_price;
                        const childBasePrice = pricingConfig.child_price + existingOption.child_price;
                        const infantBasePrice = pricingConfig.infant_price + existingOption.infant_price;

                        const adultMaxPrice = adultBasePrice + pricingConfig.markup_amount;
                        const childMaxPrice = childBasePrice + pricingConfig.markup_amount;
                        const infantMaxPrice = infantBasePrice + pricingConfig.markup_amount;

                        const adultDiscountedPrice = calculateCouponDiscount(adultMaxPrice, pricingConfig.coupon_fixed_discount, pricingConfig.coupon_percentage_discount, pricingConfig.discount_priority);
                        const childDiscountedPrice = calculateCouponDiscount(childMaxPrice, pricingConfig.coupon_fixed_discount, pricingConfig.coupon_percentage_discount, pricingConfig.discount_priority);
                        const infantDiscountedPrice = calculateCouponDiscount(infantMaxPrice, pricingConfig.coupon_fixed_discount, pricingConfig.coupon_percentage_discount, pricingConfig.discount_priority);

                        const discountPercent = pricingConfig.coupon_percentage_discount;
                        const discountText = discountPercent > 0 ? `${discountPercent}%` : `$${pricingConfig.coupon_fixed_discount}`;

                        return (
                          <div key={option.id} className="bg-white p-3 rounded border border-yellow-200">
                            <h6 className="font-medium text-sm text-yellow-800 mb-2 flex justify-between">
                              <span>{option.name}</span>
                              <span className="text-yellow-600">${adultDiscountedPrice.toFixed(2)}</span>
                            </h6>
                            {showDetailedPrices && (
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span>성인:</span>
                                  <span>${adultMaxPrice.toFixed(2)} * {discountText} = <span className="font-medium">${adultDiscountedPrice.toFixed(2)}</span></span>
                                </div>
                                <div className="flex justify-between">
                                  <span>아동:</span>
                                  <span>${childMaxPrice.toFixed(2)} * {discountText} = <span className="font-medium">${childDiscountedPrice.toFixed(2)}</span></span>
                                </div>
                                <div className="flex justify-between">
                                  <span>유아:</span>
                                  <span>${infantMaxPrice.toFixed(2)} * {discountText} = <span className="font-medium">${infantDiscountedPrice.toFixed(2)}</span></span>
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
            </div>

            {/* Net Price */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-3">Net Price (할인 가격 * 커미션)</h4>
              
              {/* 옵션별 Net Price */}
              {(() => {
                const optionsWithPrices = options.filter(option => {
                  const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                  return existingOption && (existingOption.adult_price > 0 || existingOption.child_price > 0 || existingOption.infant_price > 0);
                });

                if (optionsWithPrices.length === 0) return null;

                return (
                  <div className="mt-4 pt-3 border-t border-purple-200">
                    <div className="space-y-3">
                      {optionsWithPrices.map(option => {
                        const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                        if (!existingOption) return null;

                        const adultBasePrice = pricingConfig.adult_price + existingOption.adult_price;
                        const childBasePrice = pricingConfig.child_price + existingOption.child_price;
                        const infantBasePrice = pricingConfig.infant_price + existingOption.infant_price;

                        const adultMaxPrice = adultBasePrice + pricingConfig.markup_amount;
                        const childMaxPrice = childBasePrice + pricingConfig.markup_amount;
                        const infantMaxPrice = infantBasePrice + pricingConfig.markup_amount;

                        const adultDiscountedPrice = calculateCouponDiscount(adultMaxPrice, pricingConfig.coupon_fixed_discount, pricingConfig.coupon_percentage_discount, pricingConfig.discount_priority);
                        const childDiscountedPrice = calculateCouponDiscount(childMaxPrice, pricingConfig.coupon_fixed_discount, pricingConfig.coupon_percentage_discount, pricingConfig.discount_priority);
                        const infantDiscountedPrice = calculateCouponDiscount(infantMaxPrice, pricingConfig.coupon_fixed_discount, pricingConfig.coupon_percentage_discount, pricingConfig.discount_priority);

                        const adultNetPrice = adultDiscountedPrice * ((100 - pricingConfig.commission_percent) / 100);
                        const childNetPrice = childDiscountedPrice * ((100 - pricingConfig.commission_percent) / 100);
                        const infantNetPrice = infantDiscountedPrice * ((100 - pricingConfig.commission_percent) / 100);

                        return (
                          <div key={option.id} className="bg-white p-3 rounded border border-purple-200">
                            <h6 className="font-medium text-sm text-purple-800 mb-2 flex justify-between">
                              <span>{option.name}</span>
                              <span className="text-purple-600">${adultNetPrice.toFixed(2)}</span>
                            </h6>
                            {showDetailedPrices && (
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span>성인:</span>
                                  <span>${adultDiscountedPrice.toFixed(2)} * {pricingConfig.commission_percent}% = <span className="font-medium">${adultNetPrice.toFixed(2)}</span></span>
                                </div>
                                <div className="flex justify-between">
                                  <span>아동:</span>
                                  <span>${childDiscountedPrice.toFixed(2)} * {pricingConfig.commission_percent}% = <span className="font-medium">${childNetPrice.toFixed(2)}</span></span>
                                </div>
                                <div className="flex justify-between">
                                  <span>유아:</span>
                                  <span>${infantDiscountedPrice.toFixed(2)} * {pricingConfig.commission_percent}% = <span className="font-medium">${infantNetPrice.toFixed(2)}</span></span>
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
            </div>

                                      {/* 옵션별 가격 미리보기 */}
              {(() => {
                const optionsWithPrices = options.filter(option => {
                  const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                  return existingOption && (existingOption.adult_price > 0 || existingOption.child_price > 0 || existingOption.infant_price > 0);
                });

                if (optionsWithPrices.length === 0) return null;

                // 카테고리별로 그룹화
                const groupedOptions = optionsWithPrices.reduce((acc, option) => {
                  const category = option.category || '기타';
                  if (!acc[category]) {
                    acc[category] = [];
                  }
                  acc[category].push(option);
                  return acc;
                }, {} as Record<string, typeof optionsWithPrices>);

                return (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3">옵션별 가격 미리보기</h4>
                    <div className="space-y-4">
                      {Object.entries(groupedOptions).map(([category, categoryOptions]) => (
                        <div key={category} className="border border-gray-200 rounded-lg p-3">
                          <h5 className="font-medium text-sm text-gray-700 mb-3 text-center bg-gray-100 px-3 py-1 rounded-full">
                            ○ {category}
                          </h5>
                          <div className="space-y-3">
                            {categoryOptions.map(option => {
                              const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                              if (!existingOption) return null;

                              // 기본 가격 + 옵션 가격
                              const adultBasePrice = pricingConfig.adult_price;
                              const childBasePrice = pricingConfig.child_price;
                              const infantBasePrice = pricingConfig.infant_price;

                              const adultTotalPrice = adultBasePrice + existingOption.adult_price;
                              const childTotalPrice = childBasePrice + existingOption.child_price;
                              const infantTotalPrice = infantBasePrice + existingOption.infant_price;

                              // 업차지 적용
                              const adultMaxPrice = adultTotalPrice + pricingConfig.markup_amount;
                              const childMaxPrice = childTotalPrice + pricingConfig.markup_amount;
                              const infantMaxPrice = infantTotalPrice + pricingConfig.markup_amount;

                              // 할인 적용
                              const adultDiscountedPrice = calculateCouponDiscount(adultMaxPrice, pricingConfig.coupon_fixed_discount, pricingConfig.coupon_percentage_discount, pricingConfig.discount_priority);
                              const childDiscountedPrice = calculateCouponDiscount(childMaxPrice, pricingConfig.coupon_fixed_discount, pricingConfig.coupon_percentage_discount, pricingConfig.discount_priority);
                              const infantDiscountedPrice = calculateCouponDiscount(infantMaxPrice, pricingConfig.coupon_fixed_discount, pricingConfig.coupon_percentage_discount, pricingConfig.discount_priority);

                              // 커미션 적용 (Net Price)
                              const adultNetPrice = adultDiscountedPrice * ((100 - pricingConfig.commission_percent) / 100);
                              const childNetPrice = childDiscountedPrice * ((100 - pricingConfig.commission_percent) / 100);
                              const infantNetPrice = infantDiscountedPrice * ((100 - pricingConfig.commission_percent) / 100);

                              return (
                                <div key={option.id} className="border-l-4 border-blue-400 pl-3">
                                  <h6 className="font-medium text-sm text-gray-900 mb-2">- {option.name}</h6>
                                  <div className="text-xs space-y-2 text-gray-600">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                                      <div>
                                        <div className="font-medium text-gray-700">성인</div>
                                        <div className="text-xs text-gray-500">기본: ${adultBasePrice}</div>
                                        <div className="text-xs text-gray-500">옵션: ${existingOption.adult_price}</div>
                                        <div className="text-xs text-gray-500">총합: ${adultTotalPrice}</div>
                                        <div className="font-medium text-blue-600">최대: ${adultMaxPrice.toFixed(2)}</div>
                                        <div className="font-medium text-yellow-600">할인: ${adultDiscountedPrice.toFixed(2)}</div>
                                        <div className="font-medium text-green-600">Net: ${adultNetPrice.toFixed(2)}</div>
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-700">아동</div>
                                        <div className="text-xs text-gray-500">기본: ${childBasePrice}</div>
                                        <div className="text-xs text-gray-500">옵션: ${existingOption.child_price}</div>
                                        <div className="text-xs text-gray-500">총합: ${childTotalPrice}</div>
                                        <div className="font-medium text-blue-600">최대: ${childMaxPrice.toFixed(2)}</div>
                                        <div className="font-medium text-yellow-600">할인: ${childDiscountedPrice.toFixed(2)}</div>
                                        <div className="font-medium text-green-600">Net: ${childNetPrice.toFixed(2)}</div>
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-700">유아</div>
                                        <div className="text-xs text-gray-500">기본: ${infantBasePrice}</div>
                                        <div className="text-xs text-gray-500">옵션: ${existingOption.infant_price}</div>
                                        <div className="text-xs text-gray-500">총합: ${infantTotalPrice}</div>
                                        <div className="font-medium text-blue-600">최대: ${infantMaxPrice.toFixed(2)}</div>
                                        <div className="font-medium text-yellow-600">할인: ${infantDiscountedPrice.toFixed(2)}</div>
                                        <div className="font-medium text-green-600">Net: ${infantNetPrice.toFixed(2)}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
          </div>
        )}
             </div>

    

     </div>
   );
 }
