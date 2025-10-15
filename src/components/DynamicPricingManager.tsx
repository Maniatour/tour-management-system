'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// 초이스 조합 타입 정의
interface ChoiceCombination {
  id: string;
  combination_key: string;
  combination_name: string;
  combination_name_ko?: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  is_active: boolean;
}

// 초이스 그룹 타입 정의
interface ChoiceGroup {
  id: string;
  name: string;
  name_ko?: string;
  description?: string;
  choices: Array<{
    id: string;
    name: string;
    name_ko?: string;
    description?: string;
  }>;
}

export default function DynamicPricingManager({ 
  productId, 
  onSave, 
  isNewProduct = false
}: DynamicPricingManagerProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // 그룹 조합 관련 상태
  const [choiceGroups, setChoiceGroups] = useState<ChoiceGroup[]>([]);
  const [choiceCombinations, setChoiceCombinations] = useState<ChoiceCombination[]>([]);
  const [showCombinationPricing, setShowCombinationPricing] = useState(false);
  
  // 다중 채널 선택 모드
  const [isMultiChannelMode, setIsMultiChannelMode] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [showDetailedPrices, setShowDetailedPrices] = useState(false);
  const [priceHistory, setPriceHistory] = useState<{
    byChannel: Record<string, {
      channelId: string;
      channelName: string;
      channelType: string;
      latestPricing: {
        adult_price: number;
        child_price: number;
        infant_price: number;
        commission_percent: number;
        markup_amount: number;
        coupon_percentage_discount: number;
        is_sale_available: boolean;
        options_pricing?: Record<string, { adult: number; child: number; infant: number }>;
        choices_pricing?: Record<string, {
          name: string;
          options: Record<string, {
            name: string;
            adult_price: number;
            child_price: number;
            infant_price: number;
          }>;
        }>;
      };
      allPricing: Array<{
        adult_price: number;
        child_price: number;
        infant_price: number;
        commission_percent: number;
        markup_amount: number;
        coupon_percentage_discount: number;
        is_sale_available: boolean;
        options_pricing?: Record<string, { adult: number; child: number; infant: number }>;
        choices_pricing?: Record<string, {
          name: string;
          options: Record<string, {
            name: string;
            adult_price: number;
            child_price: number;
            infant_price: number;
          }>;
        }>;
      }>;
      fallbackFrom?: string;
    }>;
    byType: Record<string, {
      channelType: string;
      latestPricing: {
        adult_price: number;
        child_price: number;
        infant_price: number;
        commission_percent: number;
        markup_amount: number;
        coupon_percentage_discount: number;
        is_sale_available: boolean;
        options_pricing?: Record<string, { adult: number; child: number; infant: number }>;
        choices_pricing?: Record<string, {
          name: string;
          options: Record<string, {
            name: string;
            adult_price: number;
            child_price: number;
            infant_price: number;
          }>;
        }>;
      };
      allPricing: Array<{
        adult_price: number;
        child_price: number;
        infant_price: number;
        commission_percent: number;
        markup_amount: number;
        coupon_percentage_discount: number;
        is_sale_available: boolean;
        options_pricing?: Record<string, { adult: number; child: number; infant: number }>;
        choices_pricing?: Record<string, {
          name: string;
          options: Record<string, {
            name: string;
            adult_price: number;
            child_price: number;
            infant_price: number;
          }>;
        }>;
      }>;
    }>;
  } | null>(null);
  

  // 가격 설정 상태
  const [pricingConfig, setPricingConfig] = useState({
    start_date: new Date().toISOString().split('T')[0], // 오늘 날짜
    end_date: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0], // 올해 말일 (12월 31일)
    selected_weekdays: [0, 1, 2, 3, 4, 5, 6] as number[], // 모든 요일 기본 선택
    is_sale_available: true,
    commission_percent: 0, // 기본 커미션 0% (저장된 값으로 덮어씌워짐)
    markup_amount: 0,
    markup_percent: 0, // 업차지 퍼센트 (%)
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
    choices_pricing?: Record<string, {
      name: string;
      options: Record<string, {
        name: string;
        adult_price: number;
        child_price: number;
        infant_price: number;
      }>;
    }>;
    commission_percent: number;
    markup_amount: number;
    coupon_percentage_discount: number;
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
    adult_price: number;
    child_price: number;
    infant_price: number;
  }>>([]);
  
  const [allOptions, setAllOptions] = useState<Array<{ id: string; name: string }>>([]);

  // 초이스 목록 (상품의 choices에서 가져옴)
  const [choices, setChoices] = useState<Array<{
    id: string;
    name: string;
    name_ko?: string;
    description?: string;
    adult_price: number;
    child_price: number;
    infant_price: number;
    is_default?: boolean;
  }>>([]);

  // 선택된 필수 옵션 (전체적으로 하나만)
  const [selectedRequiredOption, setSelectedRequiredOption] = useState<string>('');
  
  // 선택된 초이스 (초이스가 있는 경우) - 현재 사용하지 않음
  // const [selectedChoice, setSelectedChoice] = useState<string>('');

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

  // 가격 히스토리 불러오기
  const loadPriceHistory = useCallback(async (channelId?: string) => {
    try {
      const params = new URLSearchParams({
        productId: productId
      });
      
      if (channelId) {
        params.append('channelId', channelId);
      }

      const response = await fetch(`/api/pricing/history?${params}`);
      const result = await response.json();

      if (result.success) {
        setPriceHistory(result.data);
        return result.data;
      } else {
        console.error('Failed to load price history:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error loading price history:', error);
      return null;
    }
  }, [productId]);

  // 채널 선택 시 최근 가격 불러오기
  const handleChannelSelect = useCallback(async (channelId: string) => {
    setSelectedChannel(channelId);
    
    // 가격 히스토리 불러오기
    const history = await loadPriceHistory(channelId);
    
    if (history?.byChannel?.[channelId]?.latestPricing) {
      const latestPricing = history.byChannel[channelId].latestPricing;
      
      // 최근 가격으로 설정 업데이트
      setPricingConfig(prev => ({
        ...prev,
        adult_price: latestPricing.adult_price || 0,
        child_price: latestPricing.child_price || 0,
        infant_price: latestPricing.infant_price || 0,
        commission_percent: latestPricing.commission_percent || 25,
        markup_amount: latestPricing.markup_amount || 0,
        markup_percent: (latestPricing as any).markup_percent || 0,
        coupon_percentage_discount: latestPricing.coupon_percentage_discount || 0,
        is_sale_available: latestPricing.is_sale_available ?? true,
        selected_weekdays: [0, 1, 2, 3, 4, 5, 6] // 모든 요일 기본 선택
      }));

    }
  }, [loadPriceHistory]);

  // 옵션 가격 적용 함수
  const applyOptionsPricing = useCallback((optionsList: Array<{
    id: string;
    name: string;
    category: string;
    base_price: number;
    adult_price: number;
    child_price: number;
    infant_price: number;
  }>, optionsPricing: Record<string, { adult: number; child: number; infant: number }>) => {
    if (!optionsPricing || optionsList.length === 0) return;
    
    setPricingConfig(prev => {
      const updatedRequiredOptions = prev.required_options.map((option: {
        option_id: string;
        adult_price: number;
        child_price: number;
        infant_price: number;
      }) => {
        const optionKey = `option_${option.option_id}`;
        if (optionsPricing[optionKey]) {
          return {
            ...option,
            adult_price: optionsPricing[optionKey].adult || option.adult_price,
            child_price: optionsPricing[optionKey].child || option.child_price,
            infant_price: optionsPricing[optionKey].infant || option.infant_price
          };
        }
        return option;
      });
      
      return {
        ...prev,
        required_options: updatedRequiredOptions
      };
    });
  }, []);

  // Supabase에서 상품 옵션 데이터 로드
  const loadProductOptions = useCallback(async () => {
    try {
      
      // 병합된 product_options 테이블에서 모든 옵션 가져옴 (필수 옵션 필터링은 나중에)
      const { data: optionsData, error } = await supabase
        .from('product_options')
        .select(`
          id,
          name,
          linked_option_id,
          choice_name,
          adult_price_adjustment,
          child_price_adjustment,
          infant_price_adjustment,
          is_required
        `)
        .eq('product_id', productId);

      // options 테이블에서도 옵션 정보 가져오기 (ID 매핑용)
      const { data: optionsTableData, error: optionsTableError } = await supabase
        .from('options')
        .select('id, name');

      if (error) {
        console.error('Product options 로드 실패:', error);
        return;
      }

      if (optionsTableError) {
        console.error('Options 테이블 로드 실패:', optionsTableError);
      } else {
        // options 테이블 데이터를 allOptions에 저장
        setAllOptions((optionsTableData as Array<{ id: string; name: string }>) || []);
      }

      console.log('Product options 쿼리 결과:', {
        productId,
        optionsData,
        optionsTableData,
        error,
        optionsDataLength: optionsData?.length,
        firstOption: optionsData?.[0]
      });

      // 옵션 데이터를 가격 캘린더용으로 변환 (병합된 테이블 구조)
      console.log('로드된 옵션 데이터:', optionsData);
      
      // 필수 옵션만 필터링
      const requiredOptions = (optionsData as Array<{
        id: string;
        name: string;
        choice_name?: string;
        adult_price_adjustment?: number;
        child_price_adjustment?: number;
        infant_price_adjustment?: number;
        is_required?: boolean;
      }>)?.filter(option => option.is_required === true) || [];
      
      console.log('필수 옵션 필터링 결과:', requiredOptions);
      
      const transformedOptions = requiredOptions.map((option) => {
        // 병합된 테이블에서는 각 행이 이미 하나의 선택지를 나타냄
        const adultPrice = option.adult_price_adjustment || 0;
        const childPrice = option.child_price_adjustment || 0;
        const infantPrice = option.infant_price_adjustment || 0;
        
        console.log(`옵션 변환: ${option.name}`, {
          id: option.id,
          choice_name: option.choice_name,
          adult_price_adjustment: option.adult_price_adjustment,
          child_price_adjustment: option.child_price_adjustment,
          infant_price_adjustment: option.infant_price_adjustment,
          adult_price_adjustment_type: typeof option.adult_price_adjustment,
          child_price_adjustment_type: typeof option.child_price_adjustment,
          infant_price_adjustment_type: typeof option.infant_price_adjustment,
          변환된_가격: { adultPrice, childPrice, infantPrice }
        });
        
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
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0
          }))
        }));
        
        
        console.log('옵션 가격 설정 완료:', transformedOptions.map(opt => ({
          id: opt.id,
          name: opt.name,
          adult_price: opt.adult_price,
          child_price: opt.child_price,
          infant_price: opt.infant_price
        })));
      } else {
        // 옵션이 없으면 선택 상태 초기화
        setSelectedRequiredOption('');
        setPricingConfig(prev => ({
          ...prev,
          required_options: []
        }));
      }
    } catch (error) {
      console.error('Product options 로드 중 오류:', error);
    }
  }, [productId]);

  // Supabase에서 상품 choices 데이터 로드
  const loadProductChoices = useCallback(async () => {
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('choices')
        .eq('id', productId)
        .single()

      if (error) {
        console.error('상품 choices 조회 오류:', error)
        return
      }

      const productData = product as { choices?: { required?: Array<{ options?: Array<{ id: string; name: string; name_ko?: string; adult_price?: number; child_price?: number; infant_price?: number; is_default?: boolean }>; description?: string }> } };
      if (productData?.choices?.required) {
        // choices.required 안의 각 choice의 options를 추출하여 평면화
        const flattenedChoices: Array<{
          id: string;
          name: string;
          name_ko?: string;
          description?: string;
          adult_price: number;
          child_price: number;
          infant_price: number;
          is_default?: boolean;
        }> = []

        productData.choices.required.forEach((choice) => {
          if (choice.options && Array.isArray(choice.options)) {
            choice.options.forEach((option) => {
              flattenedChoices.push({
                id: option.id,
                name: option.name,
                name_ko: option.name_ko,
                description: choice.description,
                adult_price: option.adult_price || 0,
                child_price: option.child_price || 0,
                infant_price: option.infant_price || 0,
                is_default: option.is_default || false
              })
            })
          }
        })

        console.log('로드된 choices:', flattenedChoices)
        setChoices(flattenedChoices)
        
        // 기본 초이스 선택 (is_default이 true인 것) - 현재 사용하지 않음
        // const defaultChoice = flattenedChoices.find(choice => choice.is_default);
        // if (defaultChoice) {
        //   setSelectedChoice(defaultChoice.id);
        // } else if (flattenedChoices.length > 0) {
        //   setSelectedChoice(flattenedChoices[0].id);
        // }
      } else {
        setChoices([])
      }
    } catch (error) {
      console.error('상품 choices 로드 중 오류:', error)
    }
  }, [productId]);

  // 초이스 그룹 로드 함수
  const loadChoiceGroups = useCallback(async () => {
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('choices')
        .eq('id', productId)
        .single()

      if (error) {
        console.error('상품 choices 조회 오류:', error)
        return
      }

      const productData = product as { 
        choices?: { 
          required?: Array<{
            id: string;
            name: string;
            name_ko?: string;
            description?: string;
            options?: Array<{
              id: string;
              name: string;
              name_ko?: string;
              description?: string;
            }>;
          }>;
        };
      };

      if (productData?.choices?.required) {
        const groups: ChoiceGroup[] = productData.choices.required.map((group: {
          id: string;
          name: string;
          name_ko?: string;
          description?: string;
          options?: Array<{
            id: string;
            name: string;
            name_ko?: string;
            description?: string;
          }>;
        }) => ({
          id: group.id,
          name: group.name,
          name_ko: group.name_ko,
          description: group.description,
          choices: group.options?.map((option: {
            id: string;
            name: string;
            name_ko?: string;
            description?: string;
          }) => ({
            id: option.id,
            name: option.name,
            name_ko: option.name_ko,
            description: option.description
          })) || []
        }))

        console.log('로드된 choice groups:', groups)
        setChoiceGroups(groups)
      } else {
        setChoiceGroups([])
      }
    } catch (error) {
      console.error('초이스 그룹 로드 오류:', error)
    }
  }, [productId]);

  // 초이스 조합 로드 함수 (현재 사용하지 않음 - 향후 확장을 위해 보존)
  // const loadChoiceCombinations = useCallback(async (pricingRuleId: string) => {
  //   try {
  //     const { data, error } = await supabase
  //       .from('choice_combinations')
  //       .select('*')
  //       .eq('product_id', productId)
  //       .eq('pricing_rule_id', pricingRuleId)
  //       .order('combination_name')

  //     if (error) {
  //       console.error('초이스 조합 조회 오류:', error)
  //       return
  //     }

  //     console.log('로드된 choice combinations:', data)
  //     setChoiceCombinations(data || [])
  //   } catch (error) {
  //     console.error('초이스 조합 로드 오류:', error)
  //   }
  // }, [productId]);

  // 초이스 조합 생성 함수
  const generateChoiceCombinations = useCallback(() => {
    if (choiceGroups.length < 2) {
      console.log('그룹이 2개 이상 있어야 조합을 생성할 수 있습니다.')
      return
    }

    const combinations: ChoiceCombination[] = []
    
    // 모든 그룹의 선택지를 조합하여 생성
    const generateCombinations = (groups: ChoiceGroup[], currentCombination: string[] = [], currentNames: string[] = [], currentNamesKo: string[] = []) => {
      if (currentCombination.length === groups.length) {
        const combinationKey = currentCombination.join('+')
        const combinationName = currentNames.join(' + ')
        const combinationNameKo = currentNamesKo.join(' + ')
        
        combinations.push({
          id: `temp_${Date.now()}_${Math.random()}`,
          combination_key: combinationKey,
          combination_name: combinationName,
          combination_name_ko: combinationNameKo,
          adult_price: 0,
          child_price: 0,
          infant_price: 0,
          is_active: true
        })
        return
      }

      const currentGroup = groups[currentCombination.length]
      currentGroup.choices.forEach(choice => {
        generateCombinations(
          groups,
          [...currentCombination, choice.id],
          [...currentNames, choice.name],
          [...currentNamesKo, choice.name_ko || choice.name]
        )
      })
    }

    generateCombinations(choiceGroups)
    setChoiceCombinations(combinations)
  }, [choiceGroups]);

  // 초이스 조합 가격 업데이트 함수
  const updateChoiceCombinationPrice = useCallback((combinationId: string, priceType: 'adult_price' | 'child_price' | 'infant_price', value: number) => {
    setChoiceCombinations(prev => 
      prev.map(combination => 
        combination.id === combinationId 
          ? { ...combination, [priceType]: value }
          : combination
      )
    )
  }, []);

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

      // options_pricing과 choices_pricing JSON 문자열을 파싱
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processedData = (pricingData || []).map((item: any) => {
        const processedItem = { ...item };
        
        // options_pricing 파싱
        if (item.options_pricing && typeof item.options_pricing === 'string') {
          try {
            processedItem.options_pricing = JSON.parse(item.options_pricing);
          } catch (error) {
            console.error('options_pricing 파싱 실패:', error, item.options_pricing);
          }
        }
        
        // choices_pricing 파싱
        if (item.choices_pricing && typeof item.choices_pricing === 'string') {
          try {
            processedItem.choices_pricing = JSON.parse(item.choices_pricing);
          } catch (error) {
            console.error('choices_pricing 파싱 실패:', error, item.choices_pricing);
          }
        }
        
        return processedItem;
      });

      setDynamicPricingData(processedData);
    } catch (error) {
      console.error('Dynamic pricing 데이터 로드 중 오류:', error);
    }
  }, [productId]);

  // 컴포넌트 마운트 시 channels와 options 데이터 로드
  useEffect(() => {
    loadChannels();
    loadProductOptions();
    loadProductChoices();
    loadChoiceGroups(); // 초이스 그룹 로드 추가
    loadDynamicPricingData();
    loadPriceHistory(); // 가격 히스토리도 함께 로드
  }, [loadChannels, loadProductOptions, loadProductChoices, loadChoiceGroups, loadDynamicPricingData, loadPriceHistory]);

  // 옵션 가격 적용 (채널 선택 시)
  useEffect(() => {
    if (selectedChannel && priceHistory?.byChannel?.[selectedChannel]?.latestPricing?.options_pricing && options.length > 0) {
      applyOptionsPricing(options, priceHistory.byChannel[selectedChannel].latestPricing.options_pricing);
    }
  }, [selectedChannel, priceHistory, options, applyOptionsPricing]);

  // dynamic_pricing 데이터가 로드된 후 옵션 가격 업데이트 (한 번만 실행)
  const hasUpdatedOptionsFromDynamicPricing = useRef(false);
  // const hasUpdatedChoicesFromDynamicPricing = useRef(false);
  const hasLoadedChoicesForChannel = useRef<string | null>(null);
  const hasLoadedPricingConfigForChannel = useRef<string | null>(null);
  
  useEffect(() => {
    console.log('dynamic_pricing useEffect 실행:', {
      dynamicPricingDataLength: dynamicPricingData.length,
      optionsLength: options.length,
      hasUpdated: hasUpdatedOptionsFromDynamicPricing.current,
      allOptionsLength: allOptions.length
    });
    
    if (dynamicPricingData.length > 0 && options.length > 0 && allOptions.length > 0 && !hasUpdatedOptionsFromDynamicPricing.current) {
      const latestPricing = dynamicPricingData[0];
      if (latestPricing.options_pricing && Array.isArray(latestPricing.options_pricing)) {
        console.log('dynamic_pricing에서 옵션 가격 업데이트:', latestPricing.options_pricing);
        console.log('현재 options:', options);
        console.log('allOptions:', allOptions);
        
        // options 배열을 직접 업데이트
        const updatedOptions = options.map(option => {
          // 저장된 데이터에서 해당 옵션 찾기 (이름으로 매칭)
          const savedOption = (latestPricing.options_pricing as Array<{ option_id: string; adult_price?: number; child_price?: number; infant_price?: number }>).find((saved) => {
            // allOptions에서 저장된 옵션의 이름 찾기
            const savedOptionName = allOptions.find(opt => opt.id === saved.option_id)?.name;
            const currentOptionName = option.name;
            console.log(`매칭 시도: ${savedOptionName} === ${currentOptionName} (${saved.option_id} vs ${option.id})`);
            return savedOptionName === currentOptionName;
          });
          
          if (savedOption) {
            console.log(`저장된 가격으로 업데이트: ${option.name} -> ${savedOption.adult_price}`);
            return {
              ...option,
              adult_price: savedOption.adult_price || option.adult_price,
              child_price: savedOption.child_price || option.child_price,
              infant_price: savedOption.infant_price || option.infant_price
            };
          }
          
          return option;
        });
        
        console.log('업데이트된 options:', updatedOptions);
        setOptions(updatedOptions);
        
        // pricingConfig도 업데이트
        setPricingConfig(prev => ({
          ...prev,
          required_options: updatedOptions.map(option => ({
            option_id: option.id,
            adult_price: option.adult_price,
            child_price: option.child_price,
            infant_price: option.infant_price
          }))
        }));
        
        hasUpdatedOptionsFromDynamicPricing.current = true;
      }
    }
  }, [dynamicPricingData, options, allOptions]);

  // 채널별 choices 가격 로드 함수
  const loadChoicesPricingForChannel = useCallback((channelId: string) => {
    if (!dynamicPricingData.length || !choices.length) return;

    // 1. 선택된 채널의 최근 choices_pricing 찾기
    let channelPricing = dynamicPricingData.find(pricing => 
      pricing.channel_id === channelId && 
      pricing.choices_pricing && 
      pricing.choices_pricing.canyon_choice
    );

    // 2. 선택된 채널에 데이터가 없으면 같은 타입의 채널에서 찾기
    if (!channelPricing) {
      const selectedChannelData = channels.find(ch => ch.id === channelId);
      if (selectedChannelData?.type) {
        const sameTypeChannels = channels.filter(ch => ch.type === selectedChannelData.type);
        
        for (const sameTypeChannel of sameTypeChannels) {
          channelPricing = dynamicPricingData.find(pricing => 
            pricing.channel_id === sameTypeChannel.id && 
            pricing.choices_pricing && 
            pricing.choices_pricing.canyon_choice
          );
          if (channelPricing) break;
        }
      }
    }

    if (channelPricing && channelPricing.choices_pricing?.canyon_choice) {
      console.log(`채널 ${channelId}의 choices 가격 로드:`, channelPricing.choices_pricing);
      
      const updatedChoices = choices.map(choice => {
        const savedChoice = channelPricing.choices_pricing?.canyon_choice.options[choice.id];
        if (savedChoice) {
          console.log(`저장된 choices 가격으로 업데이트: ${choice.name} -> ${savedChoice.adult_price}`);
          return {
            ...choice,
            adult_price: savedChoice.adult_price || choice.adult_price,
            child_price: savedChoice.child_price || choice.child_price,
            infant_price: savedChoice.infant_price || choice.infant_price
          };
        }
        return choice;
      });
      
      setChoices(updatedChoices);
    }
  }, [dynamicPricingData, channels, choices]);

  // 채널 선택 시 choices 가격 로드 (한 번만 실행)
  useEffect(() => {
    if (selectedChannel && choices.length > 0 && dynamicPricingData.length > 0 && 
        hasLoadedChoicesForChannel.current !== selectedChannel) {
      loadChoicesPricingForChannel(selectedChannel);
      hasLoadedChoicesForChannel.current = selectedChannel;
    }
  }, [selectedChannel, loadChoicesPricingForChannel, choices, dynamicPricingData.length]);

  // 채널 선택 시 가격 설정 로드 (한 번만 실행)
  useEffect(() => {
    if (selectedChannel && dynamicPricingData.length > 0 && 
        hasLoadedPricingConfigForChannel.current !== selectedChannel) {
      // 선택된 채널의 최근 가격 설정 찾기
      const channelPricing = dynamicPricingData.find(pricing => 
        pricing.channel_id === selectedChannel
      );

      if (channelPricing) {
        console.log(`채널 ${selectedChannel}의 가격 설정 로드:`, channelPricing);
        
        setPricingConfig(prev => ({
          ...prev,
          commission_percent: channelPricing.commission_percent || 25,
          markup_amount: channelPricing.markup_amount || 0,
          markup_percent: (channelPricing as any).markup_percent || 0,
          coupon_percentage_discount: channelPricing.coupon_percentage_discount || 0,
          is_sale_available: channelPricing.is_sale_available !== false,
          not_included_price: channelPricing.not_included_price || 0
        }));
        
        hasLoadedPricingConfigForChannel.current = selectedChannel;
      }
    }
  }, [selectedChannel, dynamicPricingData]);

  // choices_pricing 데이터가 로드된 후 choices 가격 업데이트 (기존 로직 제거)
  // useEffect(() => {
  //   if (dynamicPricingData.length > 0 && choices.length > 0 && !hasUpdatedChoicesFromDynamicPricing.current) {
  //     const latestPricing = dynamicPricingData[0];
  //     if (latestPricing.choices_pricing && latestPricing.choices_pricing.canyon_choice) {
  //       console.log('dynamic_pricing에서 choices 가격 업데이트:', latestPricing.choices_pricing);
        
  //       const updatedChoices = choices.map(choice => {
  //         const savedChoice = latestPricing.choices_pricing.canyon_choice.options[choice.id];
  //         if (savedChoice) {
  //           console.log(`저장된 choices 가격으로 업데이트: ${choice.name} -> ${savedChoice.adult_price}`);
  //           return {
  //             ...choice,
  //             adult_price: savedChoice.adult_price || choice.adult_price,
  //             child_price: savedChoice.child_price || choice.child_price,
  //             infant_price: savedChoice.infant_price || choice.infant_price
  //           };
  //         }
  //         return choice;
  //       });
        
  //       setChoices(updatedChoices);
  //       hasUpdatedChoicesFromDynamicPricing.current = true;
  //     }
  //   }
  // }, [dynamicPricingData, choices]);

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
    
    // 다중 선택 모드에서 첫 번째 선택된 채널의 가격 설정 로드
    if (isMultiChannelMode && selectedChannels.length > 0 && dynamicPricingData.length > 0) {
      const firstChannelId = selectedChannels[0];
      const channelPricing = dynamicPricingData.find(data => 
        data.channel_id === firstChannelId
      );
      
      if (channelPricing) {
        console.log(`다중 선택 모드에서 첫 번째 채널 ${firstChannelId}의 가격 설정 로드:`, channelPricing);
        setPricingConfig(prev => ({
          ...prev,
          adult_price: channelPricing.adult_price || 0,
          child_price: channelPricing.child_price || 0,
          infant_price: channelPricing.infant_price || 0,
          commission_percent: channelPricing.commission_percent || 0,
          markup_amount: channelPricing.markup_amount || 0,
          markup_percent: (channelPricing as any).markup_percent || 0,
          coupon_percentage_discount: channelPricing.coupon_percentage_discount || 0,
          is_sale_available: channelPricing.is_sale_available || false,
          not_included_price: channelPricing.not_included_price || 0,
          required_options: []
        }));
      }
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



  // 초이스 가격 변경 함수
  const handleChoicePriceChange = (choiceId: string, field: 'adult_price' | 'child_price' | 'infant_price', value: number) => {
    setChoices(prev => prev.map(choice => 
      choice.id === choiceId ? { ...choice, [field]: value } : choice
    ));
  };

  // 초이스별 가격 계산 함수 (업차지 포함)
  const calculateChoicePricing = useCallback((choiceId: string) => {
    const choice = choices.find(c => c.id === choiceId);
    if (!choice) return null;

    const baseAdultPrice = choice.adult_price || 0;
    const baseChildPrice = choice.child_price || 0;
    const baseInfantPrice = choice.infant_price || 0;

    // 업차지 계산 (달러 + 퍼센트)
    const markupAmount = pricingConfig.markup_amount || 0;
    const markupPercent = pricingConfig.markup_percent || 0;
    
    // 최대 판매가 = 초이스 가격 + 달러 업차지 + 퍼센트 업차지
    const maxAdultPrice = baseAdultPrice + markupAmount + (baseAdultPrice * markupPercent / 100);
    const maxChildPrice = baseChildPrice + markupAmount + (baseChildPrice * markupPercent / 100);
    const maxInfantPrice = baseInfantPrice + markupAmount + (baseInfantPrice * markupPercent / 100);

    // 쿠폰 할인 계산
    const couponPercent = pricingConfig.coupon_percentage_discount || 0;
    const discountedAdultPrice = maxAdultPrice * (1 - couponPercent / 100);
    const discountedChildPrice = maxChildPrice * (1 - couponPercent / 100);
    const discountedInfantPrice = maxInfantPrice * (1 - couponPercent / 100);

    // 커미션 계산
    const commissionPercent = pricingConfig.commission_percent || 0;
    const netAdultPrice = discountedAdultPrice * (1 - commissionPercent / 100);
    const netChildPrice = discountedChildPrice * (1 - commissionPercent / 100);
    const netInfantPrice = discountedInfantPrice * (1 - commissionPercent / 100);

    return {
      base: {
        adult: baseAdultPrice,
        child: baseChildPrice,
        infant: baseInfantPrice
      },
      max: {
        adult: maxAdultPrice,
        child: maxChildPrice,
        infant: maxInfantPrice
      },
      discounted: {
        adult: discountedAdultPrice,
        child: discountedChildPrice,
        infant: discountedInfantPrice
      },
      net: {
        adult: netAdultPrice,
        child: netChildPrice,
        infant: netInfantPrice
      }
    };
  }, [choices, pricingConfig]);


  // 쿠폰 할인 계산 함수 (현재 사용하지 않음 - 향후 확장을 위해 보존)
  // const calculateCouponDiscount = (basePrice: number, fixedDiscount: number, percentageDiscount: number, priority: 'fixed_first' | 'percentage_first' = 'fixed_first') => {
  //   let result = basePrice;
  //   
  //   if (priority === 'fixed_first') {
  //     // 고정 할인을 먼저 적용한 후 퍼센트 할인
  //     result = result - fixedDiscount;
  //     if (result < 0) result = 0; // 음수 방지
  //     result = result * (1 - percentageDiscount / 100);
  //   } else {
  //     // 퍼센트 할인을 먼저 적용한 후 고정 할인
  //     result = result * (1 - percentageDiscount / 100);
  //     result = result - fixedDiscount;
  //     if (result < 0) result = 0; // 음수 방지
  //   }
  //   
  //   return Math.max(0, result); // 최종적으로 음수 방지
  // };


  // 특정 날짜의 가격 계산 (캘린더용)
  const calculateDatePrices = (date: string, channelId: string, allOptionsData: Array<{ id: string; name: string }> = allOptions) => {
    // 해당 날짜와 채널의 동적 가격 데이터 찾기
    const pricingData = dynamicPricingData.find(
      data => data.date === date && data.channel_id === channelId
    );

    if (!pricingData) {
      return null;
    }

    // 기본 가격 (adult_price)
    const baseAdultPrice = pricingData.adult_price;

    // 선택된 옵션의 가격 추가
    let optionAdultPrice = 0;
    if (selectedRequiredOption) {
      // 1. 먼저 저장된 데이터에서 options_pricing 확인 (이미 파싱된 상태)
      if (pricingData.options_pricing && Array.isArray(pricingData.options_pricing)) {
        // 저장된 데이터에서 선택된 옵션 찾기 (ID로 먼저 시도)
        let savedOption = pricingData.options_pricing.find(
          (option: { option_id: string; adult_price?: number }) => option.option_id === selectedRequiredOption
        );
        
        // ID로 찾지 못했으면 옵션 이름으로 찾기
        if (!savedOption) {
          const selectedOptionFromConfig = pricingConfig.required_options.find(
            option => option.option_id === selectedRequiredOption
          );
          
          if (selectedOptionFromConfig) {
            // 현재 선택된 옵션의 이름 가져오기
            const currentOptionName = options.find(opt => opt.id === selectedRequiredOption)?.name;
            console.log(`현재 선택된 옵션 이름: ${currentOptionName}, ID: ${selectedRequiredOption}`);
            console.log(`저장된 options_pricing:`, pricingData.options_pricing);
            console.log(`현재 options 배열:`, options);
            console.log(`allOptions 배열:`, allOptions);
            
            // 먼저 ID로 매칭 시도
            savedOption = pricingData.options_pricing.find(
              (option: { option_id: string; adult_price?: number; option_name?: string }) => option.option_id === selectedRequiredOption
            );
            
            // ID로 찾지 못했으면 인덱스로 매칭 시도
            if (!savedOption && pricingData.options_pricing.length === options.length) {
              const currentOptionIndex = options.findIndex(opt => opt.id === selectedRequiredOption);
              if (currentOptionIndex >= 0 && currentOptionIndex < pricingData.options_pricing.length) {
                savedOption = pricingData.options_pricing[currentOptionIndex];
                console.log(`인덱스로 매칭: ${currentOptionIndex}번째 옵션 -> ${savedOption.adult_price}`);
              }
            }
            
            // 여전히 찾지 못했으면 이름으로 매칭 시도
            if (!savedOption) {
              savedOption = pricingData.options_pricing.find(
                (option: { option_id: string; adult_price?: number; option_name?: string }) => {
                  // 저장된 옵션의 이름을 가져와서 비교
                  const savedOptionName = options.find(opt => opt.id === option.option_id)?.name;
                  console.log(`저장된 옵션 이름: ${savedOptionName}, ID: ${option.option_id}`);
                  
                  // options 테이블에서 직접 찾기
                  if (!savedOptionName && allOptionsData.length > 0) {
                    const optionFromTable = allOptionsData.find(opt => opt.id === option.option_id);
                    if (optionFromTable) {
                      console.log(`options 테이블에서 찾은 이름: ${optionFromTable.name}`);
                      const nameMatch = optionFromTable.name === currentOptionName;
                      console.log(`테이블 매칭 결과: ${nameMatch} (${optionFromTable.name} === ${currentOptionName})`);
                      return nameMatch;
                    }
                  }
                  
                  // 이름이 정확히 일치하는지 확인
                  const nameMatch = savedOptionName === currentOptionName;
                  console.log(`이름 매칭 결과: ${nameMatch} (${savedOptionName} === ${currentOptionName})`);
                  
                  return nameMatch;
                }
              );
            }
            
            if (savedOption) {
              console.log(`이름으로 매칭된 옵션:`, savedOption);
            }
          }
        }
        
        if (savedOption) {
          optionAdultPrice = savedOption.adult_price || 0;
          console.log(`저장된 데이터에서 옵션 가격 사용 - 날짜: ${date}, 선택된 옵션: ${selectedRequiredOption}, 가격: ${optionAdultPrice}`);
        } else {
          // 2. 저장된 데이터에 없으면 현재 설정된 가격 사용
          const selectedOption = pricingConfig.required_options.find(
            option => option.option_id === selectedRequiredOption
          );
          
          if (selectedOption) {
            optionAdultPrice = selectedOption.adult_price || 0;
            console.log(`현재 설정된 옵션 가격 사용 - 날짜: ${date}, 선택된 옵션: ${selectedRequiredOption}, 가격: ${optionAdultPrice}`);
          } else {
            console.log(`선택된 옵션을 찾을 수 없음: ${selectedRequiredOption}`);
          }
        }
      } else {
        // options_pricing이 없으면 현재 설정된 가격 사용
        const selectedOption = pricingConfig.required_options.find(
          option => option.option_id === selectedRequiredOption
        );
        
        if (selectedOption) {
          optionAdultPrice = selectedOption.adult_price || 0;
          console.log(`현재 설정된 옵션 가격 사용 (저장된 데이터 없음) - 날짜: ${date}, 선택된 옵션: ${selectedRequiredOption}, 가격: ${optionAdultPrice}`);
        }
      }
    }

    // 파란색: 최대 가격 = adult_price + 선택된 옵션의 adult_price
    const maxAdultPrice = baseAdultPrice + optionAdultPrice;

    // 주황색: 할인 가격 = 최대 가격에서 coupon_percentage_discount 적용
    const couponDiscountAmount = maxAdultPrice * (pricingData.coupon_percentage_discount / 100);
    const discountedAdultPrice = maxAdultPrice - couponDiscountAmount;

    // 초록색: Net 가격 = 할인 가격에서 commission_percent 적용
    const commissionAmount = discountedAdultPrice * (pricingData.commission_percent / 100);
    const netAdultPrice = discountedAdultPrice - commissionAmount;

    console.log(`날짜 ${date} 가격 계산:`, {
      baseAdultPrice,
      optionAdultPrice,
      selectedOption: selectedRequiredOption,
      maxAdultPrice,
      couponPercent: pricingData.coupon_percentage_discount,
      discountedAdultPrice,
      commissionPercent: pricingData.commission_percent,
      netAdultPrice,
      optionsPricing: pricingData.options_pricing
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
    const prices = calculateDatePrices(dateString, selectedChannel, allOptions);
    
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
  }, [currentMonth, selectedRequiredOption, dynamicPricingData, selectedChannel, pricingConfig.required_options]);

  // selectedRequiredOption 상태 변화 모니터링
  useEffect(() => {
    console.log('selectedRequiredOption 상태 변화:', selectedRequiredOption);
    
    // 선택된 옵션 확인
    const selectedOption = options.find(opt => opt.id === selectedRequiredOption);
    if (selectedOption) {
      console.log(`선택된 옵션: ${selectedOption.name} (카테고리: ${selectedOption.category})`);
    }
  }, [selectedRequiredOption, options]);

    // 통합 저장 함수 - 선택된 채널(들)에 가격 관련 데이터 저장
  const handleUnifiedSave = async () => {
    if (isNewProduct) {
      setSaveMessage('새 상품은 전체 저장을 사용해주세요.')
      return
    }

    // 다중 선택 모드일 때는 선택된 채널들, 단일 모드일 때는 선택된 채널
    const channelsToSave = isMultiChannelMode ? selectedChannels : (selectedChannel ? [selectedChannel] : []);
    
    if (channelsToSave.length === 0) {
      setSaveMessage('채널을 선택해주세요.')
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      // 1. 선택된 채널(들)에 대해 가격 규칙 생성
      console.log('저장할 채널들:', channelsToSave);
      
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
      
      // 선택된 채널들에 대해 가격 규칙 생성
      const activeChannels = channelsToSave.map(channelId => {
        const channelData = channels.find(c => c.id === channelId);
        if (!channelData) {
          throw new Error(`채널 ID ${channelId}를 찾을 수 없습니다.`);
        }
        return channelData;
      });
      
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

      // 4. 기존 동적 가격 규칙들 삭제 (선택된 채널들)
      const { error: deleteError } = await supabase
        .from('dynamic_pricing')
        .delete()
        .eq('product_id', productId)
        .in('channel_id', channelsToSave)

      if (deleteError) throw deleteError

      // 5. 새 동적 가격 규칙들 추가
      for (const rule of generatedPricingRules) {
        const weekdayPricing = rule.weekday_pricing?.[0]
        const adultPrice = weekdayPricing?.adult_price || 0
        const childPrice = weekdayPricing?.child_price || 0
        const infantPrice = weekdayPricing?.infant_price || 0

        // choices_pricing 데이터 생성
        let choicesPricing: Record<string, {
          name: string;
          name_ko?: string;
          options: Record<string, {
            name: string;
            name_ko?: string;
            adult_price: number;
            child_price: number;
            infant_price: number;
          }>;
        }> | null = null;
        if (choices.length > 0) {
          choicesPricing = {
            canyon_choice: {
              name: "Canyon Choice",
              name_ko: "캐년 선택",
              options: {}
            }
          };
          
          choices.forEach(choice => {
            // 가격이 실제로 설정된 경우에만 저장 (0이 아닌 경우)
            if (choice.adult_price > 0 || choice.child_price > 0 || choice.infant_price > 0) {
              choicesPricing!.canyon_choice.options[choice.id] = {
                name: choice.name,
                name_ko: choice.name_ko,
                adult_price: choice.adult_price,
                child_price: choice.child_price,
                infant_price: choice.infant_price
              };
            }
          });
          
          // options가 비어있으면 choices_pricing을 null로 설정
          if (Object.keys(choicesPricing!.canyon_choice.options).length === 0) {
            choicesPricing = null;
          }
        }

        const insertData = {
            product_id: productId,
            channel_id: rule.channel_id,
            date: rule.start_date,
            adult_price: adultPrice,
          child_price: childPrice || adultPrice, // 아동은 성인과 같은 가격
          infant_price: infantPrice || adultPrice, // 유아는 성인과 같은 가격
          options_pricing: rule.required_option_pricing || [],
          choices_pricing: choicesPricing,
            commission_percent: pricingConfig.commission_percent,
            markup_amount: pricingConfig.markup_amount,
            markup_percent: pricingConfig.markup_percent,
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
        console.log('저장되는 choices_pricing:', insertData.choices_pricing)

        const { error: ruleError } = await supabase
          .from('dynamic_pricing')
          .insert(insertData as never)

        if (ruleError) {
          console.error('동적 가격 저장 오류:', ruleError)
          throw ruleError
        }
        
        console.log('동적 가격 저장 성공:', rule.channel_id, rule.start_date)
      }

      // 6. 초이스 조합 저장 (그룹 조합 가격 모드인 경우)
      if (showCombinationPricing && choiceCombinations.length > 0) {
        console.log('초이스 조합 저장 시작:', choiceCombinations)
        
        // 기존 초이스 조합 삭제
        const { error: deleteCombinationsError } = await supabase
          .from('choice_combinations')
          .delete()
          .eq('product_id', productId)

        if (deleteCombinationsError) {
          console.error('기존 초이스 조합 삭제 오류:', deleteCombinationsError)
        }

        // 새 초이스 조합 저장
        const combinationData = choiceCombinations.map(combination => ({
          product_id: productId,
          pricing_rule_id: '', // 임시로 빈 문자열 사용
          combination_key: combination.combination_key,
          combination_name: combination.combination_name,
          combination_name_ko: combination.combination_name_ko,
          adult_price: combination.adult_price,
          child_price: combination.child_price,
          infant_price: combination.infant_price,
          is_active: combination.is_active
        }))

        if (combinationData.length > 0) {
          const { error: combinationsError } = await supabase
            .from('choice_combinations')
            .insert(combinationData as never)

          if (combinationsError) {
            console.error('초이스 조합 저장 오류:', combinationsError)
            throw combinationsError
          }
          
          console.log('초이스 조합 저장 성공:', combinationData.length, '개')
        }
      }

      // 7. 성공 메시지
      const channelNames = activeChannels.map(c => c.name).join(', ');
      setSaveMessage(`${channelNames} 채널의 가격 정보가 성공적으로 저장되었습니다!`)
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

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50">
      {/* 1. 왼쪽 채널 선택 사이드바 - 모바일에서는 접을 수 있는 드롭다운 */}
      <div className="w-full lg:w-[15%] bg-white border-r border-gray-200 p-4 lg:block">
        {/* 모바일용 채널 선택 드롭다운 */}
        <div className="lg:hidden mb-4">
          <select
            value={selectedChannel}
            onChange={(e) => handleChannelSelect(e.target.value)}
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
        <div className="hidden lg:block mb-4">
          <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">채널 관리</h3>
          <div className="flex space-x-2">
            {isMultiChannelMode && (
              <button
                type="button"
                onClick={() => {
                  const currentTypeChannels = getChannelsByType(selectedChannelType);
                  const allSelected = currentTypeChannels.every(channel => 
                    selectedChannels.includes(channel.id)
                  );
                  
                  if (allSelected) {
                    // 전체 선택 해제
                    const newSelectedChannels = selectedChannels.filter(id => 
                      !currentTypeChannels.some(c => c.id === id)
                    );
                    setSelectedChannels(newSelectedChannels);
                    
                    // 선택된 채널이 있으면 첫 번째 채널의 가격 설정 로드
                    if (newSelectedChannels.length > 0 && dynamicPricingData.length > 0) {
                      const firstChannelId = newSelectedChannels[0];
                      const channelPricing = dynamicPricingData.find(data => 
                        data.channel_id === firstChannelId
                      );
                      
                      if (channelPricing) {
                        setPricingConfig(prev => ({
                          ...prev,
                          adult_price: channelPricing.adult_price || 0,
                          child_price: channelPricing.child_price || 0,
                          infant_price: channelPricing.infant_price || 0,
                          commission_percent: channelPricing.commission_percent || 0,
          markup_amount: channelPricing.markup_amount || 0,
          markup_percent: (channelPricing as any).markup_percent || 0,
          coupon_percentage_discount: channelPricing.coupon_percentage_discount || 0,
                          is_sale_available: channelPricing.is_sale_available || false,
                          not_included_price: channelPricing.not_included_price || 0,
                          required_options: []
                        }));
                      }
                    }
                  } else {
                    // 전체 선택
                    const newSelected = [...selectedChannels];
                    currentTypeChannels.forEach(channel => {
                      if (!newSelected.includes(channel.id)) {
                        newSelected.push(channel.id);
                      }
                    });
                    setSelectedChannels(newSelected);
                    
                    // 첫 번째 채널의 가격 설정 로드
                    if (newSelected.length > 0 && dynamicPricingData.length > 0) {
                      const firstChannelId = newSelected[0];
                      const channelPricing = dynamicPricingData.find(data => 
                        data.channel_id === firstChannelId
                      );
                      
                      if (channelPricing) {
                        setPricingConfig(prev => ({
                          ...prev,
                          adult_price: channelPricing.adult_price || 0,
                          child_price: channelPricing.child_price || 0,
                          infant_price: channelPricing.infant_price || 0,
                          commission_percent: channelPricing.commission_percent || 0,
          markup_amount: channelPricing.markup_amount || 0,
          markup_percent: (channelPricing as any).markup_percent || 0,
          coupon_percentage_discount: channelPricing.coupon_percentage_discount || 0,
                          is_sale_available: channelPricing.is_sale_available || false,
                          not_included_price: channelPricing.not_included_price || 0,
                          required_options: []
                        }));
                      }
                    }
                  }
                }}
                className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {getChannelsByType(selectedChannelType).every(channel => 
                  selectedChannels.includes(channel.id)
                ) ? '전체 해제' : '전체 선택'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsMultiChannelMode(!isMultiChannelMode);
                if (isMultiChannelMode) {
                  setSelectedChannels([]);
                }
              }}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                isMultiChannelMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isMultiChannelMode ? '단일 선택' : '다중 선택'}
            </button>
          </div>
          </div>
        </div>
        
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
             <span className="ml-2 text-gray-600">Loading channels...</span>
           </div>
         ) : (
           <div className="space-y-1 hidden lg:block">
             {getChannelsByType(selectedChannelType).map(channel => (
               <div
                 key={channel.id}
                 className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                   isMultiChannelMode 
                     ? selectedChannels.includes(channel.id)
                       ? 'border-blue-500 bg-blue-50'
                       : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                     : selectedChannel === channel.id
                       ? 'border-blue-500 bg-blue-50'
                       : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                 }`}
                 onClick={() => {
                   if (isMultiChannelMode) {
                     const newSelectedChannels = selectedChannels.includes(channel.id) 
                       ? selectedChannels.filter(id => id !== channel.id)
                       : [...selectedChannels, channel.id];
                     
                     setSelectedChannels(newSelectedChannels);
                     
                     // 다중 선택 모드에서 첫 번째 선택된 채널의 가격 설정 로드
                     if (newSelectedChannels.length > 0 && dynamicPricingData.length > 0) {
                       const firstChannelId = newSelectedChannels[0];
                       const channelPricing = dynamicPricingData.find(data => 
                         data.channel_id === firstChannelId
                       );
                       
                       if (channelPricing) {
                         console.log(`다중 선택 모드에서 첫 번째 채널 ${firstChannelId}의 가격 설정 로드:`, channelPricing);
                         setPricingConfig(prev => ({
                           ...prev,
                           adult_price: channelPricing.adult_price || 0,
                           child_price: channelPricing.child_price || 0,
                           infant_price: channelPricing.infant_price || 0,
                           commission_percent: channelPricing.commission_percent || 0,
                           markup_amount: channelPricing.markup_amount || 0,
                           coupon_percentage_discount: channelPricing.coupon_percentage_discount || 0,
                           is_sale_available: channelPricing.is_sale_available || false,
                           not_included_price: channelPricing.not_included_price || 0,
                           required_options: []
                         }));
                       }
                     }
                   } else {
                     handleChannelSelect(channel.id);
                   }
                 }}
               >
                 {/* 체크박스 (다중 선택 모드일 때만) */}
                 {isMultiChannelMode && (
                   <input
                     type="checkbox"
                     checked={selectedChannels.includes(channel.id)}
                     onChange={() => {}} // onClick에서 처리
                     className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                   />
                 )}
                 
                 {/* 채널 이름 */}
                 <div className={`text-sm font-medium ${
                   isMultiChannelMode
                     ? selectedChannels.includes(channel.id) ? 'text-blue-700' : 'text-gray-900'
                     : selectedChannel === channel.id ? 'text-blue-700' : 'text-gray-900'
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
        
        {/* 다중 선택된 채널 정보 */}
        {isMultiChannelMode && selectedChannels.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">선택된 채널</h4>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {selectedChannels.length}개
              </span>
            </div>
            <div className="space-y-1">
              {selectedChannels.map(channelId => {
                const channel = channels.find(c => c.id === channelId);
                return channel ? (
                  <div key={channelId} className="text-xs text-gray-600 flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    {channel.name}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
        
        {/* 가격 히스토리 정보 */}
        {selectedChannel && priceHistory?.byChannel?.[selectedChannel] && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">최근 가격 정보</h4>
              {priceHistory.byChannel[selectedChannel].fallbackFrom && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  참조값
                </span>
              )}
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>성인:</span>
                <span className="font-medium">${priceHistory.byChannel[selectedChannel].latestPricing.adult_price}</span>
              </div>
              <div className="flex justify-between">
                <span>아동:</span>
                <span className="font-medium">${priceHistory.byChannel[selectedChannel].latestPricing.child_price}</span>
              </div>
              <div className="flex justify-between">
                <span>유아:</span>
                <span className="font-medium">${priceHistory.byChannel[selectedChannel].latestPricing.infant_price}</span>
              </div>
              {priceHistory.byChannel[selectedChannel].fallbackFrom && (
                <div className="text-blue-600 text-xs mt-2 p-2 bg-blue-50 rounded">
                  <div className="font-medium">같은 타입 채널에서 가져온 기본값</div>
                  <div className="text-gray-500">
                    {priceHistory.byChannel[priceHistory.byChannel[selectedChannel].fallbackFrom]?.channelName || 'Unknown'}에서 참조
                  </div>
                </div>
              )}
            </div>
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
                 const prices = selectedChannel ? calculateDatePrices(dateString, selectedChannel, allOptions) : null;
                 
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
                   const prices = calculateDatePrices(data.date, data.channel_id, allOptions);
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
           
           {!selectedChannel && !isMultiChannelMode ? (
             <div className="text-center py-12">
               <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
               <h3 className="text-lg font-medium text-gray-900 mb-2">채널을 선택해주세요</h3>
               <p className="text-gray-600">가격을 설정하려면 왼쪽에서 채널을 선택하세요.</p>
             </div>
           ) : (
             <div className="space-y-4">
               {/* 다중 선택 모드일 때 안내 메시지 */}
               {isMultiChannelMode && selectedChannels.length > 0 && (
                 <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                   <div className="flex items-center">
                     <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                     <div>
                       <p className="text-sm font-medium text-blue-800">
                         {selectedChannels.length}개 채널 선택됨
                       </p>
                       <p className="text-xs text-blue-600">
                         설정한 가격이 모든 선택된 채널에 적용됩니다.
                       </p>
                     </div>
                   </div>
                 </div>
               )}

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
                     업차지 (%)
                   </label>
                   <div className="relative">
                     <input
                       type="number"
                       min="0"
                       max="100"
                       step="0.01"
                       value={pricingConfig.markup_percent}
                       onChange={(e) => setPricingConfig(prev => ({ ...prev, markup_percent: parseFloat(e.target.value) || 0 }))}
                       className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       placeholder="0"
                     />
                     <span className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400 text-xs">%</span>
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

                             {/* 기본 판매가 (초이스가 없는 경우에만) */}
               {choices.length === 0 && (
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
               )}

                               {/* 초이스 가격 설정 */}
                {choices.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-gray-900">초이스 가격 설정</h4>
                      {choiceGroups.length >= 2 && (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setShowCombinationPricing(!showCombinationPricing)}
                            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                              showCombinationPricing
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {showCombinationPricing ? '개별 가격으로' : '그룹 조합 가격으로'}
                          </button>
                          {showCombinationPricing && (
                            <button
                              type="button"
                              onClick={generateChoiceCombinations}
                              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                            >
                              조합 생성
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {!showCombinationPricing ? (
                      // 기존 개별 초이스 가격 설정
                      <div className="space-y-3">
                        {choices.map(choice => (
                          <div key={choice.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="mb-3">
                              <h5 className="text-sm font-medium text-gray-900">
                                {choice.name}
                                {choice.name_ko && (
                                  <span className="text-gray-500 ml-2">({choice.name_ko})</span>
                                )}
                              </h5>
                              {choice.description && (
                                <p className="text-xs text-gray-600 mt-1">{choice.description}</p>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="flex flex-col space-y-1">
                                <span className="text-xs text-gray-600">성인 가격</span>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={choice.adult_price}
                                    onChange={(e) => handleChoicePriceChange(choice.id, 'adult_price', parseFloat(e.target.value) || 0)}
                                    className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="0"
                                  />
                                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                </div>
                              </div>
                              <div className="flex flex-col space-y-1">
                                <span className="text-xs text-gray-600">아동 가격</span>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={choice.child_price}
                                    onChange={(e) => handleChoicePriceChange(choice.id, 'child_price', parseFloat(e.target.value) || 0)}
                                    className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="0"
                                  />
                                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                </div>
                              </div>
                              <div className="flex flex-col space-y-1">
                                <span className="text-xs text-gray-600">유아 가격</span>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={choice.infant_price}
                                    onChange={(e) => handleChoicePriceChange(choice.id, 'infant_price', parseFloat(e.target.value) || 0)}
                                    className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="0"
                                  />
                                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // 그룹 조합 가격 설정
                      <div className="space-y-4">
                        {choiceGroups.length < 2 ? (
                          <div className="text-center py-8 text-gray-500">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">그룹이 2개 이상 있어야 조합 가격을 설정할 수 있습니다.</p>
                            <p className="text-xs mt-1">초이스 관리 탭에서 그룹을 추가해주세요.</p>
                          </div>
                        ) : (
                          <>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <h5 className="text-sm font-medium text-blue-900 mb-2">그룹 조합 가격 설정</h5>
                              <p className="text-xs text-blue-700 mb-3">
                                각 그룹의 초이스 조합에 따른 가격을 설정할 수 있습니다.
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {choiceGroups.map(group => (
                                  <div key={group.id} className="bg-white rounded p-2">
                                    <span className="font-medium text-gray-900">{group.name}</span>
                                    {group.name_ko && (
                                      <span className="text-gray-500 ml-1">({group.name_ko})</span>
                                    )}
                                    <div className="text-gray-600 mt-1">
                                      {group.choices.map(choice => choice.name).join(', ')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {choiceCombinations.length > 0 && (
                              <div className="space-y-3">
                                {choiceCombinations.map(combination => (
                                  <div key={combination.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="mb-3">
                                      <h5 className="text-sm font-medium text-gray-900">
                                        {combination.combination_name}
                                      </h5>
                                      {combination.combination_name_ko && (
                                        <p className="text-xs text-gray-600 mt-1">
                                          {combination.combination_name_ko}
                                        </p>
                                      )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div className="flex flex-col space-y-1">
                                        <span className="text-xs text-gray-600">성인 가격</span>
                                        <div className="relative">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={combination.adult_price}
                                            onChange={(e) => updateChoiceCombinationPrice(combination.id, 'adult_price', parseFloat(e.target.value) || 0)}
                                            className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="0"
                                          />
                                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                        </div>
                                      </div>
                                      <div className="flex flex-col space-y-1">
                                        <span className="text-xs text-gray-600">아동 가격</span>
                                        <div className="relative">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={combination.child_price}
                                            onChange={(e) => updateChoiceCombinationPrice(combination.id, 'child_price', parseFloat(e.target.value) || 0)}
                                            className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="0"
                                          />
                                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                        </div>
                                      </div>
                                      <div className="flex flex-col space-y-1">
                                        <span className="text-xs text-gray-600">유아 가격</span>
                                        <div className="relative">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={combination.infant_price}
                                            onChange={(e) => updateChoiceCombinationPrice(combination.id, 'infant_price', parseFloat(e.target.value) || 0)}
                                            className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="0"
                                          />
                                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
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
                    <span>
                      {saving 
                        ? '저장 중...' 
                        : isMultiChannelMode 
                          ? `가격 정보 저장 (${selectedChannels.length}개 채널)`
                          : '가격 정보 저장'
                      }
                    </span>
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
            {/* 초이스별 가격 미리보기 */}
            {choices.length > 0 && (
              <div className="space-y-4">
                {/* 최대 판매가 */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-3">최대 판매가 (초이스 가격 + 업차지)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">초이스</th>
                          <th className="text-center py-2">성인</th>
                          <th className="text-center py-2">아동</th>
                          <th className="text-center py-2">유아</th>
                        </tr>
                      </thead>
                      <tbody>
                        {choices.map(choice => {
                          const pricing = calculateChoicePricing(choice.id);
                          if (!pricing) return null;
                          
                          return (
                            <tr key={choice.id} className="border-b">
                              <td className="py-2 font-medium">
                                {choice.name}
                                {choice.name_ko && (
                                  <span className="text-gray-500 ml-1">({choice.name_ko})</span>
                                )}
                              </td>
                              <td className="text-center py-2">${pricing.max.adult.toFixed(2)}</td>
                              <td className="text-center py-2">${pricing.max.child.toFixed(2)}</td>
                              <td className="text-center py-2">${pricing.max.infant.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 할인 가격 */}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-3">할인 가격 (최대 판매가 × 쿠폰%)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">초이스</th>
                          <th className="text-center py-2">성인</th>
                          <th className="text-center py-2">아동</th>
                          <th className="text-center py-2">유아</th>
                        </tr>
                      </thead>
                      <tbody>
                        {choices.map(choice => {
                          const pricing = calculateChoicePricing(choice.id);
                          if (!pricing) return null;
                          
                          return (
                            <tr key={choice.id} className="border-b">
                              <td className="py-2 font-medium">
                                {choice.name}
                                {choice.name_ko && (
                                  <span className="text-gray-500 ml-1">({choice.name_ko})</span>
                                )}
                              </td>
                              <td className="text-center py-2">${pricing.discounted.adult.toFixed(2)}</td>
                              <td className="text-center py-2">${pricing.discounted.child.toFixed(2)}</td>
                              <td className="text-center py-2">${pricing.discounted.infant.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Net Price */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">Net Price (할인가격 × 커미션)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">초이스</th>
                          <th className="text-center py-2">성인</th>
                          <th className="text-center py-2">아동</th>
                          <th className="text-center py-2">유아</th>
                        </tr>
                      </thead>
                      <tbody>
                        {choices.map(choice => {
                          const pricing = calculateChoicePricing(choice.id);
                          if (!pricing) return null;
                          
                          return (
                            <tr key={choice.id} className="border-b">
                              <td className="py-2 font-medium">
                                {choice.name}
                                {choice.name_ko && (
                                  <span className="text-gray-500 ml-1">({choice.name_ko})</span>
                                )}
                              </td>
                              <td className="text-center py-2">${pricing.net.adult.toFixed(2)}</td>
                              <td className="text-center py-2">${pricing.net.child.toFixed(2)}</td>
                              <td className="text-center py-2">${pricing.net.infant.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 기본 가격 요약 (초이스가 없는 경우에만) */}
            {choices.length === 0 && (
              <div className="space-y-4">
                {/* 기본 판매가 */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-3">기본 판매가</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">구분</th>
                          <th className="text-center py-2">성인</th>
                          <th className="text-center py-2">아동</th>
                          <th className="text-center py-2">유아</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2 font-medium">기본 가격</td>
                          <td className="text-center py-2">${pricingConfig.adult_price.toFixed(2)}</td>
                          <td className="text-center py-2">${pricingConfig.child_price.toFixed(2)}</td>
                          <td className="text-center py-2">${pricingConfig.infant_price.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 할인 가격 */}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-3">할인 가격 (기본 판매가 × 쿠폰%)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">구분</th>
                          <th className="text-center py-2">성인</th>
                          <th className="text-center py-2">아동</th>
                          <th className="text-center py-2">유아</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2 font-medium">할인 가격</td>
                          <td className="text-center py-2">${(pricingConfig.adult_price * (1 - pricingConfig.coupon_percentage_discount / 100)).toFixed(2)}</td>
                          <td className="text-center py-2">${(pricingConfig.child_price * (1 - pricingConfig.coupon_percentage_discount / 100)).toFixed(2)}</td>
                          <td className="text-center py-2">${(pricingConfig.infant_price * (1 - pricingConfig.coupon_percentage_discount / 100)).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Net Price */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">Net Price (할인가격 × 커미션)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">구분</th>
                          <th className="text-center py-2">성인</th>
                          <th className="text-center py-2">아동</th>
                          <th className="text-center py-2">유아</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2 font-medium">Net Price</td>
                          <td className="text-center py-2">${(pricingConfig.adult_price * (1 - pricingConfig.coupon_percentage_discount / 100) * (1 - pricingConfig.commission_percent / 100)).toFixed(2)}</td>
                          <td className="text-center py-2">${(pricingConfig.child_price * (1 - pricingConfig.coupon_percentage_discount / 100) * (1 - pricingConfig.commission_percent / 100)).toFixed(2)}</td>
                          <td className="text-center py-2">${(pricingConfig.infant_price * (1 - pricingConfig.coupon_percentage_discount / 100) * (1 - pricingConfig.commission_percent / 100)).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 옵션별 기본 가격 */}
                {(() => {
                  const optionsWithPrices = options.filter(option => {
                    const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                    return existingOption && (existingOption.adult_price > 0 || existingOption.child_price > 0 || existingOption.infant_price > 0);
                  });

                  if (optionsWithPrices.length === 0) return null;

                  return (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">옵션별 가격 (기본 판매가 + 옵션 선택가)</h4>
                      <div className="space-y-3">
                        {optionsWithPrices.map(option => {
                          const existingOption = pricingConfig.required_options.find(opt => opt.option_id === option.id);
                          if (!existingOption) return null;

                          const adultTotalPrice = pricingConfig.adult_price + existingOption.adult_price;
                          const childTotalPrice = pricingConfig.child_price + existingOption.child_price;
                          const infantTotalPrice = pricingConfig.infant_price + existingOption.infant_price;

                          return (
                            <div key={option.id} className="bg-white p-3 rounded border border-gray-200">
                              <h6 className="font-medium text-sm text-gray-800 mb-2 flex justify-between">
                                <span>{option.name}</span>
                                <span className="text-gray-600">성인: ${adultTotalPrice}</span>
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
            )}

          </div>
        )}
             </div>

    

     </div>
   );
 }
