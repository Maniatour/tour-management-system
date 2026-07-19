/**
 * 초이스 가격 계산 방식
 * - absolute: 초이스별 최종 판매가를 직접 입력
 * - base_plus: 기본가 + 초이스별 추가금/할인
 */
export type ChoicePricingMode = 'absolute' | 'base_plus';

export function parseChoicePricingMode(value: unknown): ChoicePricingMode {
  // Legacy DB labels (pre-2026-07): additive/override/percentage → absolute
  if (value === 'base_plus') return 'base_plus'
  return 'absolute'
}

/** Value safe to persist under dynamic_pricing_price_calculation_method_check */
export function toDbChoicePricingMode(value: unknown): ChoicePricingMode {
  return parseChoicePricingMode(value)
}

export function isChoicePricingMode(value: unknown): value is ChoicePricingMode {
  return value === 'absolute' || value === 'base_plus';
}

type ChoicePriceFields = {
  adult_price?: number;
  child_price?: number;
  infant_price?: number;
  adult?: number;
  child?: number;
  infant?: number;
  ota_sale_price?: number;
};

/**
 * 모드에 따른 초이스 최종 판매가 계산
 */
export function resolveChoiceFinalPrices(params: {
  mode: ChoicePricingMode;
  base: { adult: number; child: number; infant: number };
  choiceData?: ChoicePriceFields | null;
  isSinglePrice?: boolean;
}): { adult: number; child: number; infant: number; adjustmentAdult: number; adjustmentChild: number; adjustmentInfant: number } {
  const { mode, base, choiceData, isSinglePrice } = params;
  const adjAdult = Number(choiceData?.adult_price ?? choiceData?.adult ?? 0);
  const adjChild = Number(choiceData?.child_price ?? choiceData?.child ?? 0);
  const adjInfant = Number(choiceData?.infant_price ?? choiceData?.infant ?? 0);
  const ota = Number(choiceData?.ota_sale_price ?? 0);

  if (mode === 'base_plus') {
    return {
      adjustmentAdult: adjAdult,
      adjustmentChild: adjChild,
      adjustmentInfant: adjInfant,
      adult: base.adult + adjAdult,
      child: base.child + adjChild,
      infant: base.infant + adjInfant,
    };
  }

  // absolute
  if (isSinglePrice && ota > 0) {
    return {
      adjustmentAdult: ota - base.adult,
      adjustmentChild: ota - base.child,
      adjustmentInfant: ota - base.infant,
      adult: ota,
      child: ota,
      infant: ota,
    };
  }

  if (ota > 0 && adjAdult === 0 && adjChild === 0 && adjInfant === 0) {
    return {
      adjustmentAdult: ota - base.adult,
      adjustmentChild: ota - base.child,
      adjustmentInfant: ota - base.infant,
      adult: ota,
      child: ota,
      infant: ota,
    };
  }

  return {
    adjustmentAdult: adjAdult - base.adult,
    adjustmentChild: adjChild - base.child,
    adjustmentInfant: adjInfant - base.infant,
    adult: adjAdult,
    child: adjChild,
    infant: adjInfant,
  };
}

/**
 * 옵션 단가(options_pricing)를 조합별 choices_pricing으로 합산 전개
 */
export function expandOptionsPricingToChoicesPricing(
  optionsPricing: Record<
    string,
    { adult_price?: number; child_price?: number; infant_price?: number }
  >,
  combinations: Array<{
    id: string;
    combination_details?: Array<{ optionId?: string; optionKey?: string }>;
  }>
): Record<
  string,
  {
    adult_price: number;
    child_price: number;
    infant_price: number;
    adult: number;
    child: number;
    infant: number;
  }
> {
  const result: Record<
    string,
    {
      adult_price: number;
      child_price: number;
      infant_price: number;
      adult: number;
      child: number;
      infant: number;
    }
  > = {};

  for (const combo of combinations) {
    let adult = 0;
    let child = 0;
    let infant = 0;
    for (const detail of combo.combination_details || []) {
      const key = detail.optionId || detail.optionKey || '';
      const opt =
        optionsPricing[key] ||
        (detail.optionKey ? optionsPricing[detail.optionKey] : undefined) ||
        {};
      adult += Number(opt.adult_price ?? 0);
      child += Number(opt.child_price ?? 0);
      infant += Number(opt.infant_price ?? 0);
    }
    result[combo.id] = {
      adult_price: adult,
      child_price: child,
      infant_price: infant,
      adult,
      child,
      infant,
    };
  }

  return result;
}

/**
 * 저장 전 choices_pricing을 모드에 맞게 정규화
 */
export function normalizeChoicesPricingForMode(
  choicesPricing: Record<string, Record<string, unknown>>,
  mode: ChoicePricingMode,
  base: { adult: number; child: number; infant: number },
  isSinglePrice: boolean
): Record<string, Record<string, unknown>> {
  const next: Record<string, Record<string, unknown>> = {};

  for (const [choiceId, raw] of Object.entries(choicesPricing)) {
    if (!raw || typeof raw !== 'object') continue;
    const data = { ...raw };

    if (mode === 'base_plus') {
      // 추가금/할인만 유지. 최종가용 ota_sale_price는 제거해 캘린더가 base+choice로 계산하게 함
      delete data.ota_sale_price;
      const adult = Number(data.adult_price ?? data.adult ?? 0);
      const child = Number(data.child_price ?? data.child ?? 0);
      const infant = Number(data.infant_price ?? data.infant ?? 0);
      data.adult_price = adult;
      data.child_price = child;
      data.infant_price = infant;
      data.adult = adult;
      data.child = child;
      data.infant = infant;
    } else if (isSinglePrice) {
      // absolute + 단일가: ota_sale_price가 최종 판매가
      const ota = Number(data.ota_sale_price ?? data.adult_price ?? data.adult ?? 0);
      if (ota > 0) data.ota_sale_price = ota;
    } else {
      // absolute + 분리가: adult/child/infant가 최종 판매가
      const adult = Number(data.adult_price ?? data.adult ?? 0);
      const child = Number(data.child_price ?? data.child ?? 0);
      const infant = Number(data.infant_price ?? data.infant ?? 0);
      data.adult_price = adult;
      data.child_price = child;
      data.infant_price = infant;
      data.adult = adult;
      data.child = child;
      data.infant = infant;
      // 분리 모드에서는 ota_sale_price가 있으면 성인 기준으로만 보조 유지
      if (data.ota_sale_price == null && adult > 0) {
        data.ota_sale_price = adult;
      }
    }

    // base는 참고용으로만 쓰이며 저장 payload에는 넣지 않음
    void base;
    next[choiceId] = data;
  }

  return next;
}
