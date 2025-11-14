/**
 * 홈페이지 가격 계산 유틸리티
 * PriceCalculator.tsx와 DynamicPricingManager.tsx에서 공통으로 사용
 */

interface HomepagePricingConfig {
  markup_amount?: number;
  markup_percent?: number;
  choices_pricing?: Record<string, any>;
}

interface Combination {
  id: string;
  combination_key?: string;
  adult_price?: number;
  child_price?: number;
  infant_price?: number;
}

interface ProductBasePrice {
  adult: number;
  child: number;
  infant: number;
}

/**
 * 홈페이지 초이스 가격 데이터 찾기
 * 여러 키를 시도하여 매칭되는 데이터를 찾습니다
 */
export function findHomepageChoiceData(
  combination: Combination,
  homepagePricingConfig: HomepagePricingConfig
): any {
  if (!homepagePricingConfig?.choices_pricing) {
    return {};
  }

  const choicesPricing = homepagePricingConfig.choices_pricing;

  // 1. choiceId로 시도
  if (choicesPricing[combination.id]) {
    return choicesPricing[combination.id];
  }

  // 2. combination_key로 시도
  if (combination.combination_key && choicesPricing[combination.combination_key]) {
    return choicesPricing[combination.combination_key];
  }

  // 3. 모든 키를 순회하며 매칭 시도 (키가 부분적으로 일치하는 경우)
  if (Object.keys(choicesPricing).length > 0) {
    const availableKeys = Object.keys(choicesPricing);
    const matchingKey = availableKeys.find(key => {
      return key === combination.id || 
             key === combination.combination_key ||
             (combination.combination_key && key.includes(combination.combination_key)) ||
             (combination.id && key.includes(combination.id));
    });
    
    if (matchingKey) {
      return choicesPricing[matchingKey];
    }
  }

  return {};
}

/**
 * 홈페이지 Net Price 계산
 * 계산 방식: 판매가 = 기본가격 + 초이스가격, Net = 판매가 * 0.8
 */
export function calculateHomepageNetPrice(
  combination: Combination,
  productBasePrice: ProductBasePrice,
  homepagePricingConfig: HomepagePricingConfig,
  priceType: 'adult' | 'child' | 'infant' = 'adult'
): number {
  // 기본: 상품 기본가격 (마크업 적용 전)
  const basePrice = productBasePrice[priceType] || 0;

  // 초이스 가격 (M00001 채널의 고정값 사용)
  const homepageChoiceData = findHomepageChoiceData(combination, homepagePricingConfig);
  const choicePrice = homepageChoiceData?.adult_price || 
                     homepageChoiceData?.adult || 
                     homepageChoiceData?.[`${priceType}_price`] ||
                     homepageChoiceData?.[priceType] ||
                     0;

  // 판매가: 상품 기본가격 + 초이스별 가격
  const salePrice = basePrice + choicePrice;

  // Net: 판매가에서 20% 할인가격 (커미션 적용 안 함)
  return salePrice * 0.8;
}

/**
 * 홈페이지 가격 정보 전체 계산 (기본, 초이스, 판매가, Net)
 */
export function calculateHomepagePriceInfo(
  combination: Combination,
  productBasePrice: ProductBasePrice,
  homepagePricingConfig: HomepagePricingConfig,
  priceType: 'adult' | 'child' | 'infant' = 'adult'
): {
  basePrice: number;
  choicePrice: number;
  salePrice: number;
  netPrice: number;
} {
  // 기본: 상품 기본가격 (마크업 적용 전)
  const basePrice = productBasePrice[priceType] || 0;

  // 초이스 가격 (M00001 채널의 고정값 사용)
  const homepageChoiceData = findHomepageChoiceData(combination, homepagePricingConfig);
  const choicePrice = homepageChoiceData?.adult_price || 
                     homepageChoiceData?.adult || 
                     homepageChoiceData?.[`${priceType}_price`] ||
                     homepageChoiceData?.[priceType] ||
                     0;

  // 판매가: 상품 기본가격 + 초이스별 가격
  const salePrice = basePrice + choicePrice;

  // Net: 판매가에서 20% 할인가격 (커미션 적용 안 함)
  const netPrice = salePrice * 0.8;

  return {
    basePrice,
    choicePrice,
    salePrice,
    netPrice
  };
}

