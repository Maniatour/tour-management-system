import { useState, useCallback, useMemo } from 'react';
import { PricingConfig, RealTimePriceCalculation, ChoicePricing } from '@/lib/types/dynamic-pricing';

export function usePriceCalculation() {
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    adult_price: 0,
    child_price: 0,
    infant_price: 0,
    commission_percent: 0,
    markup_amount: 0,
    markup_percent: 0,
    coupon_percent: 0,
    is_sale_available: true,
    not_included_price: 0,
    choicePricing: {}
  });

  // 실시간 가격 계산
  const calculatePrice = useCallback((
    basePrice: { adult: number; child: number; infant: number },
    config: PricingConfig
  ): RealTimePriceCalculation => {
    // 1. 기본 가격 (불포함 금액은 가격 계산에서 제외, 별도로 밸런스로 처리)
    // 불포함 금액은 최대판매가, 할인가격, net price 계산에 포함되지 않음
    const adjustedBasePrice = {
      adult: basePrice.adult,
      child: basePrice.child,
      infant: basePrice.infant
    };

    // 2. 마크업 적용 (금액 + 퍼센트)
    const markupPrice = {
      adult: adjustedBasePrice.adult + config.markup_amount + (adjustedBasePrice.adult * config.markup_percent / 100),
      child: adjustedBasePrice.child + config.markup_amount + (adjustedBasePrice.child * config.markup_percent / 100),
      infant: adjustedBasePrice.infant + config.markup_amount + (adjustedBasePrice.infant * config.markup_percent / 100)
    };

    // 3. 할인 적용 (쿠폰 퍼센트)
    const discountPrice = {
      adult: markupPrice.adult * (1 - config.coupon_percent / 100),
      child: markupPrice.child * (1 - config.coupon_percent / 100),
      infant: markupPrice.infant * (1 - config.coupon_percent / 100)
    };

    // 4. 최종 판매가
    const finalPrice = {
      adult: Math.round(discountPrice.adult * 100) / 100,
      child: Math.round(discountPrice.child * 100) / 100,
      infant: Math.round(discountPrice.infant * 100) / 100
    };

    // 5. 수수료 계산
    const commission = {
      adult: finalPrice.adult * config.commission_percent / 100,
      child: finalPrice.child * config.commission_percent / 100,
      infant: finalPrice.infant * config.commission_percent / 100
    };

    // 6. 순수익 계산
    const netPrice = {
      adult: finalPrice.adult - commission.adult,
      child: finalPrice.child - commission.child,
      infant: finalPrice.infant - commission.infant
    };

    return {
      basePrice: adjustedBasePrice,
      markupPrice,
      discountPrice,
      finalPrice,
      commission,
      netPrice
    };
  }, []);

  // 초이스별 가격 계산
  const calculateChoicePrice = useCallback((
    choiceId: string,
    config: PricingConfig
  ): RealTimePriceCalculation | null => {
    const choicePricing = config.choicePricing[choiceId];
    if (!choicePricing) return null;

    // 상품 기본 가격 + 초이스 가격
    const basePrice = {
      adult: (config.adult_price || 0) + choicePricing.adult_price,
      child: (config.child_price || 0) + choicePricing.child_price,
      infant: (config.infant_price || 0) + choicePricing.infant_price
    };

    return calculatePrice(basePrice, config);
  }, [calculatePrice]);

  // 가격 설정 업데이트
  const updatePricingConfig = useCallback((updates: Partial<PricingConfig>) => {
    setPricingConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // 초이스 가격 업데이트
  const updateChoicePricing = useCallback((choiceId: string, pricing: ChoicePricing) => {
    setPricingConfig(prev => ({
      ...prev,
      choicePricing: {
        ...prev.choicePricing,
        [choiceId]: pricing
      }
    }));
  }, []);

  // 현재 설정으로 기본 가격 계산
  const currentCalculation = useMemo(() => {
    const basePrice = {
      adult: pricingConfig.adult_price,
      child: pricingConfig.child_price,
      infant: pricingConfig.infant_price
    };
    return calculatePrice(basePrice, pricingConfig);
  }, [pricingConfig, calculatePrice]);

  // 모든 초이스별 가격 계산
  const choiceCalculations = useMemo(() => {
    const calculations: Record<string, RealTimePriceCalculation> = {};
    
    Object.keys(pricingConfig.choicePricing).forEach(choiceId => {
      const calculation = calculateChoicePrice(choiceId, pricingConfig);
      if (calculation) {
        calculations[choiceId] = calculation;
      }
    });
    
    return calculations;
  }, [pricingConfig, calculateChoicePrice]);

  return {
    pricingConfig,
    updatePricingConfig,
    updateChoicePricing,
    calculatePrice,
    calculateChoicePrice,
    currentCalculation,
    choiceCalculations
  };
}
