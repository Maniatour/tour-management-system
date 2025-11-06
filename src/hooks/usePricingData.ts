import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ChoicePricing {
  combinations: Record<string, {
    combination_key: string;
    combination_name: string;
    combination_name_ko: string;
    adult_price: number;
    child_price: number;
    infant_price: number;
  }>;
}

interface PriceHistory {
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
      coupon_percent: number;
      is_sale_available: boolean;
      choices_pricing?: ChoicePricing;
      options_pricing?: Record<string, { adult: number; child: number; infant: number }>;
    };
    priceHistory: Array<{
      date: string;
      adult_price: number;
      child_price: number;
      infant_price: number;
      commission_percent: number;
      markup_amount: number;
      coupon_percent: number;
      is_sale_available: boolean;
    }>;
  }>;
}

export function usePricingData(productId: string, selectedChannelId?: string, selectedChannelType?: string) {
  const [priceHistory, setPriceHistory] = useState<PriceHistory['byChannel']>({});
  const [showDetailedPrices, setShowDetailedPrices] = useState(false);
  const [pricingConfig, setPricingConfig] = useState({
    adult_price: 0,
    child_price: 0,
    infant_price: 0,
    commission_percent: 0,
    markup_amount: 0,
    coupon_percent: 0,
    is_sale_available: true, // 기본값: 판매중
    choices_pricing: {} as ChoicePricing
  });

  const loadPriceHistory = useCallback(async (channelId?: string) => {
    try {
      // dynamic_pricing 테이블에서 가격 히스토리 로드
      let query = supabase
        .from('dynamic_pricing')
        .select(`
          id,
          channel_id,
          date,
          adult_price,
          child_price,
          infant_price,
          commission_percent,
          markup_amount,
          coupon_percent,
          is_sale_available,
          choices_pricing,
          created_at,
          updated_at
        `)
        .eq('product_id', productId);

      // 채널 필터링
      if (channelId) {
        query = query.eq('channel_id', channelId);
      } else if (selectedChannelId) {
        query = query.eq('channel_id', selectedChannelId);
      } else if (selectedChannelType === 'SELF') {
        query = query.like('channel_id', 'B%');
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;

      // 채널별로 그룹화
      const groupedData = data.reduce((acc, item) => {
        const channelId = item.channel_id;
        if (!acc[channelId]) {
        // choices_pricing 파싱
        let choicesPricing: ChoicePricing = { combinations: {} };
        if (item.choices_pricing) {
          try {
            choicesPricing = typeof item.choices_pricing === 'string' 
              ? JSON.parse(item.choices_pricing) 
              : item.choices_pricing;
          } catch (error) {
            console.warn('choices_pricing 파싱 오류:', error);
            choicesPricing = { combinations: {} };
          }
        }

        acc[channelId] = {
          channelId,
          channelName: `채널 ${channelId}`, // 채널 이름은 별도로 조회 필요
          channelType: 'Unknown',
          latestPricing: {
            adult_price: item.adult_price,
            child_price: item.child_price,
            infant_price: item.infant_price,
            commission_percent: item.commission_percent,
            markup_amount: item.markup_amount,
            coupon_percent: item.coupon_percent,
            is_sale_available: item.is_sale_available,
            choices_pricing: choicesPricing
          },
          priceHistory: []
        };
        }
        
        acc[channelId].priceHistory.push({
          date: item.updated_at,
          adult_price: item.adult_price,
          child_price: item.child_price,
          infant_price: item.infant_price,
          commission_percent: item.commission_percent,
          markup_amount: item.markup_amount,
          coupon_percent: item.coupon_percent,
          is_sale_available: item.is_sale_available
        });

        return acc;
      }, {} as PriceHistory['byChannel']);

      setPriceHistory(groupedData);
      
      // 최신 가격 데이터를 pricingConfig에 설정
      if (data.length > 0) {
        const latestData = data[0]; // updated_at으로 정렬했으므로 첫 번째가 최신
        
        // choices_pricing 파싱
        let choicesPricing: ChoicePricing = { combinations: {} };
        if (latestData.choices_pricing) {
          try {
            const rawChoicesPricing = typeof latestData.choices_pricing === 'string' 
              ? JSON.parse(latestData.choices_pricing) 
              : latestData.choices_pricing;
            
            // 새로운 구조인지 확인: { choiceId: { adult: 50, child: 30, infant: 20 } }
            if (rawChoicesPricing && typeof rawChoicesPricing === 'object' && !rawChoicesPricing.combinations) {
              // 새로운 구조를 기존 구조로 변환
              choicesPricing = { combinations: {} };
              Object.entries(rawChoicesPricing).forEach(([choiceId, choiceData]: [string, any]) => {
                if (choiceData && typeof choiceData === 'object') {
                  choicesPricing.combinations[choiceId] = {
                    combination_key: choiceId,
                    combination_name: choiceId.replace(/_/g, ' '),
                    combination_name_ko: choiceId.replace(/_/g, ' '),
                    adult_price: choiceData.adult || choiceData.adult_price || 0,
                    child_price: choiceData.child || choiceData.child_price || 0,
                    infant_price: choiceData.infant || choiceData.infant_price || 0
                  };
                }
              });
            } else {
              // 기존 구조 그대로 사용
              choicesPricing = rawChoicesPricing;
            }
          } catch (error) {
            console.warn('최신 choices_pricing 파싱 오류:', error);
            choicesPricing = { combinations: {} };
          }
        }
        
        // is_sale_available 처리: 페이지 로드 시 항상 true(판매중)로 시작
        // 데이터베이스에 저장된 값과 관계없이 초기 로드 시에는 항상 판매중으로 설정
        const isSaleAvailable = true;
        
        setPricingConfig({
          adult_price: latestData.adult_price || 0,
          child_price: latestData.child_price || 0,
          infant_price: latestData.infant_price || 0,
          commission_percent: latestData.commission_percent || 0,
          markup_amount: latestData.markup_amount || 0,
          coupon_percent: latestData.coupon_percent || 0,
          is_sale_available: isSaleAvailable,
          choices_pricing: choicesPricing
        });
        
        console.log('최신 가격 데이터 로드됨:', {
          selectedChannelId,
          selectedChannelType,
          latestData: latestData,
          isSaleAvailable: isSaleAvailable,
          choicesPricing: choicesPricing,
          combinationsCount: Object.keys(choicesPricing.combinations || {}).length
        });
      } else {
        // 데이터가 없으면 기본값 유지 (이미 초기값이 true로 설정되어 있음)
        // 하지만 다른 필드들은 초기화
        setPricingConfig(prev => ({
          ...prev,
          adult_price: 0,
          child_price: 0,
          infant_price: 0,
          commission_percent: 0,
          markup_amount: 0,
          coupon_percent: 0,
          is_sale_available: true, // 데이터가 없으면 기본값: 판매중
          choices_pricing: { combinations: {} }
        }));
      }
    } catch (error) {
      console.error('가격 히스토리 로드 실패:', error);
    }
  }, [productId, selectedChannelId, selectedChannelType]);

  const updatePricingConfig = useCallback((updates: Partial<typeof pricingConfig>) => {
    setPricingConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleDetailedPrices = useCallback(() => {
    setShowDetailedPrices(!showDetailedPrices);
  }, [showDetailedPrices]);

  useEffect(() => {
    if (productId) {
      loadPriceHistory();
    }
  }, [productId, selectedChannelId, selectedChannelType, loadPriceHistory]);

  return {
    priceHistory,
    showDetailedPrices,
    pricingConfig,
    loadPriceHistory,
    updatePricingConfig,
    toggleDetailedPrices
  };
}
