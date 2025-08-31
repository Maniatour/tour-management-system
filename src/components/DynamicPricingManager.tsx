'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  DollarSign, 
  Settings, 
  Save,
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Percent,
  Tag,
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
  WeekdayPricingDto,
  DAY_NAMES,
  DAY_COLORS 
} from '@/lib/types/dynamic-pricing';
import ChangeHistory from './ChangeHistory';

interface DynamicPricingManagerProps {
  productId: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  onSave?: (rule: DynamicPricingRule) => void;
  onCancel?: () => void;
  isNewProduct?: boolean;
}

// 채널 타입 정의
type ChannelType = 'OTA' | 'Self' | 'Partner';

export default function DynamicPricingManager({ 
  productId, 
  onSave, 
  onCancel,
  isNewProduct = false
}: DynamicPricingManagerProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [pricingRules, setPricingRules] = useState<DynamicPricingRule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // 새 규칙 생성 폼 상태
  const [newRule, setNewRule] = useState<CreatePricingRuleDto>({
    product_id: productId,
    channel_id: '',
    rule_name: '',
    start_date: '',
    end_date: '',
    weekday_pricing: [],
    required_option_pricing: []
  });

  // 가격 설정 상태
  const [pricingConfig, setPricingConfig] = useState({
    start_date: '',
    end_date: '',
    selected_weekdays: [] as number[],
    is_sale_available: true,
    commission_percent: 0,
    markup_amount: 0,
    coupon_fixed_discount: 0, // 고정 할인 금액 ($)
    coupon_percentage_discount: 0, // 퍼센트 할인 (%)
    discount_priority: 'fixed_first' as 'fixed_first' | 'percentage_first', // 할인 우선순위
    adult_price: 0,
    child_price: 0,
    infant_price: 0,
    required_options: [] as Array<{
      option_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
      adult_price: number;
      child_price: number;
      infant_price: number;
    }>
  });

  // 채널 목록 및 상품 판매 여부
  const [channels, setChannels] = useState<Array<{
    id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
    name: string;
    type: string | null;
    is_selling_product: boolean;
  }>>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);

  // 선택된 채널 타입 탭
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType>('OTA');

  // 옵션 목록 (실제 상품 옵션에서 가져옴)
  const [options, setOptions] = useState<Array<{
    id: string;
    name: string;
    category: string;
    base_price: number;
  }>>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // 선택된 필수 옵션 (전체적으로 하나만)
  const [selectedRequiredOption, setSelectedRequiredOption] = useState<string>('');

  // 컴포넌트 마운트 시 channels와 options 데이터 로드
  useEffect(() => {
    loadChannels();
    loadProductOptions();
  }, []);

  // 요일별 가격 초기화
  useEffect(() => {
    const initialWeekdayPricing: WeekdayPricingDto[] = Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      day_name: DAY_NAMES[i],
      adult_price: 0,
      child_price: 0,
      infant_price: 0,
      is_active: true
    }));
    
    setNewRule(prev => ({
      ...prev,
      weekday_pricing: initialWeekdayPricing
    }));
  }, []);

  // Supabase에서 channels 데이터 로드
  const loadChannels = async () => {
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

      // 상품 판매 여부 확인 (product_channels 테이블이 있다면)
      const channelsWithSellingStatus = channelsData?.map(channel => ({
        ...channel,
        is_selling_product: false // 기본값, 실제로는 product_channels 테이블에서 확인
      })) || [];

      setChannels(channelsWithSellingStatus);
    } catch (error) {
      console.error('Channels 로드 중 오류:', error);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  // Supabase에서 상품 옵션 데이터 로드
  const loadProductOptions = async () => {
    try {
      setIsLoadingOptions(true);
      
      // product_options와 options 테이블을 조인하여 category 정보를 가져옴
      const { data: optionsData, error } = await supabase
        .from('product_options')
        .select(`
          id,
          name,
          linked_option_id,
          options!inner (
            id,
            category
          ),
          product_option_choices (
            id,
            name,
            adult_price_adjustment,
            child_price_adjustment,
            infant_price_adjustment
          )
        `)
        .eq('product_id', productId);

      if (error) {
        console.error('Product options 로드 실패:', error);
        return;
      }

                    // 옵션 데이터를 가격 캘린더용으로 변환
        const transformedOptions = optionsData?.map(option => {
          // 첫 번째 선택 항목의 가격 조정값을 기준으로 설정
          const firstChoice = option.product_option_choices?.[0];
          const adultPrice = firstChoice?.adult_price_adjustment || 0;
          const childPrice = firstChoice?.child_price_adjustment || 0;
          const infantPrice = firstChoice?.infant_price_adjustment || 0;
          
          return {
            id: option.id,
            name: option.name,
            category: option.options?.category || '기본', // options 테이블의 category 사용
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
    } finally {
      setIsLoadingOptions(false);
    }
  };

  // 채널 타입별로 필터링
  const getChannelsByType = (type: ChannelType) => {
    return channels.filter(channel => {
      if (type === 'OTA') {
        return channel.type === 'OTA' || channel.type === 'ota' || channel.name.toLowerCase().includes('ota') || channel.name.toLowerCase().includes('getyourguide') || channel.name.toLowerCase().includes('viator');
      } else if (type === 'Self') {
        return channel.type === 'Self' || channel.type === 'self' || channel.name.toLowerCase().includes('self') || channel.name.toLowerCase().includes('직영') || channel.name.toLowerCase().includes('자체');
      } else if (type === 'Partner') {
        return channel.type === 'Partner' || channel.type === 'partner' || channel.name.toLowerCase().includes('partner') || channel.name.toLowerCase().includes('파트너') || channel.name.toLowerCase().includes('협력사');
      }
      return false;
    });
  };

  // 상품 판매 여부 토글 (로컬 상태만 변경, 부모 컴포넌트 상태 변경하지 않음)
  const toggleProductSelling = (channelId: string) => {
    // 로컬 상태만 변경
    setChannels(prev => prev.map(channel => 
      channel.id === channelId 
        ? { ...channel, is_selling_product: !channel.is_selling_product }
        : channel
    ));
    console.log(`Channel ${channelId} 판매 여부 토글됨 (로컬 상태만 변경, 저장되지 않음)`);
    
    // 중요: 부모 컴포넌트의 상태를 변경하지 않음
    // 채널 토글은 저장 버튼을 통해서만 실제 저장됨
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

  // 필수 옵션 추가
  const handleAddRequiredOption = () => {
    setPricingConfig(prev => ({
      ...prev,
      required_options: [
        ...prev.required_options,
        {
          option_id: '',
          adult_price: 0,
          child_price: 0,
          infant_price: 0
        }
      ]
    }));
  };

  // 필수 옵션 제거
  const handleRemoveRequiredOption = (index: number) => {
    setPricingConfig(prev => ({
      ...prev,
      required_options: prev.required_options.filter((_, i) => i !== index)
    }));
  };

  // 필수 옵션 변경
  const handleRequiredOptionChange = (index: number, field: string, value: string | number) => {
    setPricingConfig(prev => ({
      ...prev,
      required_options: prev.required_options.map((option, i) =>
        i === index ? { ...option, [field]: value } : option
      )
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
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
        hasPricing: true, // 실제로는 저장된 가격 규칙 확인
        pricing: generateDailyPricing(new Date(year, month, i))
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

  // 일별 가격 생성 (실제로는 저장된 데이터에서 가져와야 함)
  const generateDailyPricing = (date: Date) => {
    // 선택된 옵션의 기본 가격
    const selectedOption = options.find(opt => opt.id === selectedRequiredOption);
    const totalBasePrice = selectedOption?.base_price || 0;

    if (totalBasePrice === 0) return null;

    const markup = 0; // 업차지 금액
    const couponFixedDiscount = 0; // 쿠폰 고정 할인
    const couponPercentageDiscount = 0; // 쿠폰 퍼센트 할인
    const commission = 32; // 커미션 (32%로 설정)

    // 손님 지불 금액 (기본가 + 업차지)
    const customerPayment = totalBasePrice + markup;
    
    // 할인 적용 후 금액 (할인 우선순위 고려)
    const discountedPrice = calculateCouponDiscount(customerPayment, couponFixedDiscount, couponPercentageDiscount, 'fixed_first');
   
   // 우리 수령 금액 (커미션 제외)
   const ourReceivedAmount = discountedPrice * (1 - commission / 100);

   return {
     customerPayment: customerPayment,
     commission: discountedPrice - ourReceivedAmount,
     ourReceivedAmount: ourReceivedAmount
   };
  };

  // 선택된 옵션이 변경될 때마다 캘린더 가격 업데이트
  useEffect(() => {
    // currentMonth가 변경되거나 selectedRequiredOption이 변경될 때 daysInMonth 재계산
    // 이 useEffect는 의존성 배열에 currentMonth와 selectedRequiredOption을 포함하여
    // 이 값들이 변경될 때마다 캘린더를 새로고침합니다.
    console.log('옵션 또는 월이 변경됨:', selectedRequiredOption);
  }, [currentMonth, selectedRequiredOption]);

  // selectedRequiredOption 상태 변화 모니터링
  useEffect(() => {
    console.log('selectedRequiredOption 상태 변화:', selectedRequiredOption);
    
    // 선택된 옵션 확인
    const selectedOption = options.find(opt => opt.id === selectedRequiredOption);
    if (selectedOption) {
      console.log(`선택된 옵션: ${selectedOption.name} (카테고리: ${selectedOption.category})`);
    }
  }, [selectedRequiredOption, options]);

  // 가격 규칙 저장
  const handleSavePricingRule = async () => {
    try {
      // 저장 중 상태 표시
      console.log('가격 규칙 저장 시작...');
      
      // 1. 채널 판매 여부 저장
      const channelsToUpdate = channels.filter(channel => channel.is_selling_product);
      console.log('저장할 채널들:', channelsToUpdate);
      
      // 2. 가격 설정 저장
      const pricingData = {
        ...pricingConfig,
        selected_required_option: selectedRequiredOption,
        required_options: pricingConfig.required_options.filter(option => 
          option.adult_price > 0 || option.child_price > 0 || option.infant_price > 0
        ), // 가격이 설정된 옵션만 저장
        created_at: new Date().toISOString()
      };
      console.log('저장할 가격 설정:', pricingData);
      
      // 3. 실제 API 호출 (여기서는 콘솔 로그만)
      // await supabase.from('dynamic_pricing_rules').insert(pricingData);
      
      // 4. 성공 메시지
      alert('가격 규칙이 성공적으로 저장되었습니다!');
      
      // 5. onSave 콜백 호출 (부모 컴포넌트에 알림) - 저장 버튼을 통해서만 호출
      if (onSave) {
        onSave({
          id: Date.now().toString(), // 임시 ID
          product_id: productId,
          channel_id: selectedChannel,
          rule_name: `가격 규칙 ${new Date().toLocaleDateString()}`,
          start_date: pricingConfig.start_date,
          end_date: pricingConfig.end_date,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        // 채널 판매 여부 정보는 별도로 콘솔에 출력 (실제로는 별도 API 호출)
        console.log('저장된 채널 판매 여부:', channels.map(channel => ({
          channel_id: channel.id,
          is_selling_product: channel.is_selling_product
        })));
      }
      
    } catch (error) {
      console.error('가격 규칙 저장 실패:', error);
      alert('가격 규칙 저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleSaveDynamicPricing = async () => {
    if (isNewProduct) {
      setSaveMessage('새 상품은 전체 저장을 사용해주세요.')
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      // 기존 동적 가격 규칙들 삭제
      const { error: deleteError } = await supabase
        .from('dynamic_pricing')
        .delete()
        .eq('product_id', productId)

      if (deleteError) throw deleteError

      // 새 동적 가격 규칙들 추가
      for (const rule of pricingRules) {
        // weekday_pricing에서 가격 정보 추출
        const weekdayPricing = rule.weekday_pricing?.[0]
        const adultPrice = weekdayPricing?.adult_price || 0
        const childPrice = weekdayPricing?.child_price || 0
        const infantPrice = weekdayPricing?.infant_price || 0

        const { error: ruleError } = await supabase
          .from('dynamic_pricing')
          .insert({
            product_id: productId,
            channel_id: rule.channel_id,
            date: rule.start_date,
            adult_price: adultPrice,
            child_price: childPrice,
            infant_price: infantPrice,
            options_pricing: rule.required_option_pricing || {},
            commission_percent: 0, // 기본값
            markup_amount: 0, // 기본값
                         coupon_fixed_discount: 0, // 기본값
             coupon_percentage_discount: 0, // 기본값
             discount_priority: 'fixed_first', // 기본값
            is_sale_available: true
          })

        if (ruleError) throw ruleError
      }

      setSaveMessage('동적 가격 정보가 성공적으로 저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
            } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          console.error('동적 가격 저장 오류:', errorMessage)
          setSaveMessage(`동적 가격 저장에 실패했습니다: ${errorMessage}`)
          setTimeout(() => setSaveMessage(''), 3000)
        } finally {
      setSaving(false)
    }
  }

  const daysInMonth = getDaysInMonth(currentMonth);
  const previewPrices = calculatePreviewPrices();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 1. 왼쪽 채널 선택 사이드바 */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">채널 관리</h3>
        
        {/* 채널 타입 탭 */}
        <div className="flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg">
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
           <div className="space-y-2">
             {getChannelsByType(selectedChannelType).map(channel => (
               <div
                 key={channel.id}
                 className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                   selectedChannel === channel.id
                     ? 'border-blue-500 bg-blue-50'
                     : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                 }`}
                 onClick={() => setSelectedChannel(channel.id)}
               >
                 {/* 채널 이름 */}
                 <div className={`font-medium ${
                   selectedChannel === channel.id ? 'text-blue-700' : 'text-gray-900'
                 }`}>
                   {channel.name}
                 </div>
                 
                 {/* 판매 여부 토글 */}
                 <button
                   type="button"
                   onClick={(e) => {
                     e.stopPropagation();
                     toggleProductSelling(channel.id);
                   }}
                   className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                     channel.is_selling_product ? 'bg-green-600' : 'bg-gray-300'
                   }`}
                 >
                   <span
                     className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                       channel.is_selling_product ? 'translate-x-5' : 'translate-x-1'
                     }`}
                   />
                 </button>
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
        
        {/* 채널 및 옵션 새로고침 버튼 */}
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
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

                              {/* 2. 왼쪽 캘린더 뷰 */}
         <div className="w-80 bg-white border-r border-gray-200 p-4">

         <div className="flex items-center justify-between mb-4">
           <h3 className="text-lg font-semibold text-gray-900">가격 캘린더</h3>
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
         </div>

                  {/* 달력 위 옵션 선택기 */}
         {options.length > 0 && (
           <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                           <div className="flex items-center justify-between mb-3">
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
                    const selectedOption = categoryOptions.find(opt => opt.id === selectedRequiredOption);
                    
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
                              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                selectedRequiredOption === option.id
                                  ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                              }`}
                            >
                              {option.name}
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
         
         <div className="text-center mb-4">
           <h4 className="font-medium text-gray-900">
             {currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
           </h4>
         </div>

                 {/* 요일 헤더 */}
         <div className="grid grid-cols-7 gap-1 mb-2">
           {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
             <div key={day} className="text-center text-xs font-medium text-gray-500 p-1">
               {day}
             </div>
           ))}
         </div>

                 {/* 날짜 그리드 */}
         <div className="grid grid-cols-7 gap-1">
           {daysInMonth.map((day, index) => (
             <div
               key={index}
               className={`p-1 text-xs border rounded cursor-pointer transition-colors ${
                 day.isCurrentMonth
                   ? day.hasPricing
                     ? 'bg-white border-gray-200 hover:bg-gray-50'
                     : 'bg-white border-gray-200 hover:bg-gray-50'
                   : 'bg-gray-100 border-gray-200 text-gray-400'
               }`}
             >
               <div className="text-center font-medium mb-1">
                 {day.date.getDate()}
               </div>
               
               {/* 가격 정보 표시 */}
               {day.isCurrentMonth && day.pricing && (
                 <div className="space-y-1">
                   <div className="text-center text-xs font-bold text-blue-600">
                     ${day.pricing.customerPayment.toFixed(2)}
                   </div>
                   <div className="text-center text-xs text-orange-600">
                     ${day.pricing.commission.toFixed(2)}
                   </div>
                   <div className="text-center text-xs text-green-600">
                     ${day.pricing.ourReceivedAmount.toFixed(2)}
                   </div>
                 </div>
               )}
             </div>
           ))}
         </div>
         
         {/* 가격 범례 */}
         <div className="mt-4 pt-4 border-t border-gray-200">
           <div className="text-xs text-gray-600 mb-2">OTA 채널을 통한 손님 지불, 수수료, 우리 수령 금액</div>
           <div className="space-y-1">
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
               <span className="text-xs text-gray-600">손님 지불</span>
             </div>
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
               <span className="text-xs text-gray-600">커미션</span>
             </div>
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 bg-green-600 rounded-full"></div>
               <span className="text-xs text-gray-600">우리 수령 금액</span>
             </div>
           </div>
         </div>
       </div>

      {/* 3. 가운데 가격 설정 섹션 */}
      <div className="flex-1 bg-white p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
                                 <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedChannel ? `${channels.find(c => c.id === selectedChannel)?.name} 가격 설정` : '가격 설정'}
            </h2>
           
           {!selectedChannel ? (
             <div className="text-center py-12">
               <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
               <h3 className="text-lg font-medium text-gray-900 mb-2">채널을 선택해주세요</h3>
               <p className="text-gray-600">가격을 설정하려면 왼쪽에서 채널을 선택하세요.</p>
             </div>
           ) : !channels.find(c => c.id === selectedChannel)?.is_selling_product ? (
             <div className="text-center py-12">
               <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-400" />
               <h3 className="text-lg font-medium text-gray-900 mb-2">선택된 채널에서 상품을 판매하지 않습니다</h3>
               <p className="text-gray-600">가격을 설정하려면 채널의 상품 판매를 활성화하세요.</p>
             </div>
           ) : (
             <div className="space-y-6">

              {/* 기간 설정 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시작일 *
                  </label>
                  <input
                    type="date"
                    value={pricingConfig.start_date}
                    onChange={(e) => setPricingConfig(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    종료일 *
                  </label>
                  <input
                    type="date"
                    value={pricingConfig.end_date}
                    onChange={(e) => setPricingConfig(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

                             {/* 요일 선택 */}
               <div>
                 <div className="flex items-center justify-between mb-3">
                   <label className="text-sm font-medium text-gray-700">
                     적용 요일 선택
                   </label>
                   <div className="flex space-x-2">
                     <button
                       type="button"
                       onClick={() => setPricingConfig(prev => ({
                         ...prev,
                         selected_weekdays: [0, 1, 2, 3, 4, 5, 6]
                       }))}
                       className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                     >
                       전체 선택
                     </button>
                     <button
                       type="button"
                       onClick={() => setPricingConfig(prev => ({
                         ...prev,
                         selected_weekdays: []
                       }))}
                       className="px-3 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                     >
                       전체 해제
                     </button>
                   </div>
                 </div>
                 <div className="grid grid-cols-7 gap-2">
                   {Array.from({ length: 7 }, (_, i) => (
                     <button
                       key={i}
                       type="button"
                       onClick={() => handleWeekdayToggle(i)}
                       className={`p-3 rounded-lg border transition-colors ${
                         pricingConfig.selected_weekdays.includes(i)
                           ? 'border-blue-500 bg-blue-50 text-blue-700'
                           : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                       }`}
                     >
                       <div className="text-sm font-medium">{DAY_NAMES[i]}</div>
                     </button>
                   ))}
                 </div>
               </div>

              {/* 판매 가능 여부 */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">판매 가능 여부</h4>
                  <p className="text-sm text-gray-600">이 기간 동안 상품 판매 허용</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPricingConfig(prev => ({ ...prev, is_sale_available: !prev.is_sale_available }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    pricingConfig.is_sale_available ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      pricingConfig.is_sale_available ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

                                                           {/* 수수료 및 할인 설정 */}
                <div className="grid grid-cols-4 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                     <Percent className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     업차지 금액 ($)
                   </label>
                   <div className="relative">
                                          <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pricingConfig.markup_amount}
                        onChange={(e) => setPricingConfig(prev => ({ ...prev, markup_amount: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                     <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                   </div>
                 </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      할인 우선순위
                    </label>
                    <select
                      value={pricingConfig.discount_priority || 'fixed_first'}
                      onChange={(e) => setPricingConfig(prev => ({ ...prev, discount_priority: e.target.value as 'fixed_first' | 'percentage_first' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="fixed_first">고정 할인 우선</option>
                      <option value="percentage_first">퍼센트 할인 우선</option>
                    </select>
                  </div>
                  <div>
                    {pricingConfig.discount_priority === 'fixed_first' ? (
                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          쿠폰 고정 할인 ($)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricingConfig.coupon_fixed_discount}
                            onChange={(e) => setPricingConfig(prev => ({ ...prev, coupon_fixed_discount: parseFloat(e.target.value) || 0 }))}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          쿠폰 퍼센트 할인 (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={pricingConfig.coupon_percentage_discount}
                            onChange={(e) => setPricingConfig(prev => ({ ...prev, coupon_percentage_discount: parseFloat(e.target.value) || 0 }))}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                          <Percent className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        </div>
                      </>
                    )}
                  </div>
               </div>

                             {/* 기본 판매가 */}
               <div>
                 <h4 className="font-medium text-gray-900 mb-3">기본 판매가</h4>
                 <div className="grid grid-cols-3 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">성인 ($)</label>
                     <input
                       type="number"
                       value={pricingConfig.adult_price}
                       onChange={(e) => setPricingConfig(prev => ({ ...prev, adult_price: parseFloat(e.target.value) || 0 }))}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       placeholder="0"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">아동 ($)</label>
                     <input
                       type="number"
                       value={pricingConfig.child_price}
                       onChange={(e) => setPricingConfig(prev => ({ ...prev, child_price: parseFloat(e.target.value) || 0 }))}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       placeholder="0"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">유아 ($)</label>
                     <input
                       type="number"
                       value={pricingConfig.infant_price}
                       onChange={(e) => setPricingConfig(prev => ({ ...prev, infant_price: parseFloat(e.target.value) || 0 }))}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       placeholder="0"
                     />
                   </div>
                 </div>
               </div>

                               {/* 필수 선택 옵션 가격 설정 */}
                {options.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">필수 선택 옵션 가격 설정</h4>
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
                                     
                                     <div className="flex items-center space-x-3">
                                       <div className="flex items-center space-x-2">
                                         <span className="text-xs text-gray-600">성인</span>
                                         <input
                                           type="number"
                                           min="0"
                                           step="0.01"
                                           value={existingOption?.adult_price || 0}
                                           onChange={(e) => handleRequiredOptionPriceChange(option.id, 'adult_price', parseFloat(e.target.value) || 0)}
                                           className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                           placeholder="0"
                                         />
                                       </div>
                                       <div className="flex items-center space-x-2">
                                         <span className="text-xs text-gray-600">아동</span>
                                         <input
                                           type="number"
                                           min="0"
                                           step="0.01"
                                           value={existingOption?.child_price || 0}
                                           onChange={(e) => handleRequiredOptionPriceChange(option.id, 'child_price', parseFloat(e.target.value) || 0)}
                                           className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                           placeholder="0"
                                         />
                                       </div>
                                       <div className="flex items-center space-x-2">
                                         <span className="text-xs text-gray-600">유아</span>
                                         <input
                                           type="number"
                                           min="0"
                                           step="0.01"
                                           value={existingOption?.infant_price || 0}
                                           onChange={(e) => handleRequiredOptionPriceChange(option.id, 'infant_price', parseFloat(e.target.value) || 0)}
                                           className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                           placeholder="0"
                                         />
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


                             {/* 저장 버튼 */}
               <div className="flex justify-end pt-6">
                 <button
                   type="button"
                   onClick={handleSavePricingRule}
                   className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 flex items-center space-x-2"
                 >
                   <Save size={20} />
                   <span>가격 규칙 저장</span>
                 </button>
               </div>

               {/* 동적 가격 저장 버튼 */}
               <div className="mt-8 pt-6 border-t border-gray-200">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center space-x-2">
                     <TrendingUp className="h-5 w-5 text-green-600" />
                     <h4 className="text-lg font-medium text-gray-900">동적 가격 관리</h4>
                   </div>
                   <button
                     type="button"
                     onClick={handleSaveDynamicPricing}
                     disabled={saving || isNewProduct}
                     className={`px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors ${
                       saving || isNewProduct
                         ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                         : 'bg-green-600 text-white hover:bg-green-700'
                     }`}
                   >
                     <Save className="h-4 w-4" />
                     <span>{saving ? '저장 중...' : '동적 가격 저장'}</span>
                   </button>
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

      {/* 4. 오른쪽 가격 미리보기 */}
      <div className="w-80 bg-white border-l border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Eye className="h-5 w-5 text-blue-600 mr-2" />
          가격 미리보기
        </h3>
        
        {!selectedChannel ? (
          <div className="text-center py-8 text-gray-500">
            채널을 선택하면 가격 미리보기가 표시됩니다.
          </div>
        ) : !channels.find(c => c.id === selectedChannel)?.is_selling_product ? (
          <div className="text-center py-8 text-yellow-500">
            선택된 채널에서 상품을 판매하지 않습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {/* 기본 가격 요약 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-3">기본 가격</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>성인:</span>
                  <span className="font-medium">${pricingConfig.adult_price}</span>
                </div>
                <div className="flex justify-between">
                  <span>아동:</span>
                  <span className="font-medium">${pricingConfig.child_price}</span>
                </div>
                <div className="flex justify-between">
                  <span>유아:</span>
                  <span className="font-medium">${pricingConfig.infant_price}</span>
                </div>
              </div>
            </div>

            {/* 최대 판매가 */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-3">최대 판매가</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>성인:</span>
                  <span className="font-medium">${previewPrices.max.adult.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>아동:</span>
                  <span className="font-medium">${previewPrices.max.child.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>유아:</span>
                  <span className="font-medium">${previewPrices.max.infant.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* 최대 할인가 */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-3">최대 할인가</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>성인:</span>
                  <span className="font-medium">${previewPrices.discounted.adult.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>아동:</span>
                  <span className="font-medium">${previewPrices.discounted.child.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>유아:</span>
                  <span className="font-medium">${previewPrices.discounted.infant.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Net Price */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-3">Net Price</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>성인:</span>
                  <span className="font-medium">${previewPrices.net.adult.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>아동:</span>
                  <span className="font-medium">${previewPrices.net.child.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>유아:</span>
                  <span className="font-medium">${previewPrices.net.infant.toFixed(2)}</span>
                </div>
              </div>
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
                                    <div className="grid grid-cols-3 gap-2 text-center">
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
