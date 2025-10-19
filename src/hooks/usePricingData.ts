import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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

export function usePricingData(productId: string) {
  const [priceHistory, setPriceHistory] = useState<PriceHistory['byChannel']>({});
  const [showDetailedPrices, setShowDetailedPrices] = useState(false);
  const [pricingConfig, setPricingConfig] = useState({
    adult_price: 0,
    child_price: 0,
    infant_price: 0,
    commission_percent: 0,
    markup_amount: 0,
    coupon_percent: 0,
    is_sale_available: true
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
          created_at,
          updated_at
        `)
        .eq('product_id', productId);

      if (channelId) {
        query = query.eq('channel_id', channelId);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;

      // 채널별로 그룹화
      const groupedData = data.reduce((acc, item) => {
        const channelId = item.channel_id;
        if (!acc[channelId]) {
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
              coupon_percentage_discount: item.coupon_percent,
              is_sale_available: item.is_sale_available
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
          coupon_percentage_discount: item.coupon_percent,
          is_sale_available: item.is_sale_available
        });

        return acc;
      }, {} as PriceHistory['byChannel']);

      setPriceHistory(groupedData);
    } catch (error) {
      console.error('가격 히스토리 로드 실패:', error);
    }
  }, [productId]);

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
  }, [productId, loadPriceHistory]);

  return {
    priceHistory,
    showDetailedPrices,
    pricingConfig,
    loadPriceHistory,
    updatePricingConfig,
    toggleDetailedPrices
  };
}
