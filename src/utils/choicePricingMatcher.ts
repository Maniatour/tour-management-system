/**
 * 초이스 가격 매칭 유틸리티
 * 초이스 변경 시에도 기존 가격을 찾을 수 있도록 유연한 매칭 로직 제공
 */

interface ChoiceCombination {
  id: string;
  combination_key?: string;
  combination_details?: Array<{
    groupId: string;
    optionId: string;
    optionKey?: string;
  }>;
}

/**
 * 동적 가격에서 초이스 가격 데이터 찾기
 * 여러 키를 시도하여 매칭되는 데이터를 찾습니다
 * 초이스 그룹 순서에 상관없이 매칭되도록 정렬된 키도 시도합니다
 */
export function findChoicePricingData(
  combination: ChoiceCombination,
  choicesPricing: Record<string, any>
): { data: any; matchedKey?: string } {
  if (!choicesPricing || Object.keys(choicesPricing).length === 0) {
    return { data: {} };
  }

  // 1. combination.id로 직접 시도
  if (choicesPricing[combination.id]) {
    return { data: choicesPricing[combination.id], matchedKey: combination.id };
  }

  // 2. combination_key로 직접 시도
  if (combination.combination_key && choicesPricing[combination.combination_key]) {
    return { data: choicesPricing[combination.combination_key], matchedKey: combination.combination_key };
  }

  // 3. 정렬된 combination_key로 시도 (그룹 순서에 상관없이 매칭)
  if (combination.combination_key) {
    const sortedKey = combination.combination_key
      .split('+')
      .sort()
      .join('+');
    
    if (sortedKey !== combination.combination_key && choicesPricing[sortedKey]) {
      return { data: choicesPricing[sortedKey], matchedKey: sortedKey };
    }

    // 모든 키를 순회하며 정렬된 키로 매칭 시도
    const availableKeys = Object.keys(choicesPricing);
    const matchingKey = availableKeys.find(key => {
      const sortedAvailableKey = key.split('+').sort().join('+');
      return sortedAvailableKey === sortedKey;
    });
    
    if (matchingKey) {
      return { data: choicesPricing[matchingKey], matchedKey: matchingKey };
    }
  }

  // 4. combination_details를 사용하여 옵션 ID 기반 매칭 시도
  if (combination.combination_details && combination.combination_details.length > 0) {
    // 옵션 ID로 조합 키 생성 시도
    const optionIds = combination.combination_details
      .map(detail => detail.optionId || detail.optionKey)
      .filter(Boolean)
      .sort()
      .join('+');
    
    if (optionIds && choicesPricing[optionIds]) {
      return { data: choicesPricing[optionIds], matchedKey: optionIds };
    }

    // 옵션 키로 조합 키 생성 시도
    const optionKeys = combination.combination_details
      .map(detail => detail.optionKey || detail.optionId)
      .filter(Boolean)
      .sort()
      .join('+');
    
    if (optionKeys && optionKeys !== optionIds && choicesPricing[optionKeys]) {
      return { data: choicesPricing[optionKeys], matchedKey: optionKeys };
    }
  }

  // 5. 부분 일치로 매칭 시도 (키가 부분적으로 일치하는 경우)
  const availableKeys = Object.keys(choicesPricing);
  const partialMatch = availableKeys.find(key => {
    // combination_key의 일부가 키에 포함되어 있거나, 키의 일부가 combination_key에 포함되어 있는 경우
    if (combination.combination_key) {
      const keyParts = combination.combination_key.split('+');
      const availableKeyParts = key.split('+');
      
      // 모든 조합 키 부분이 사용 가능한 키에 포함되어 있는지 확인
      const allPartsMatch = keyParts.every(part => 
        availableKeyParts.some(availablePart => 
          availablePart.includes(part) || part.includes(availablePart)
        )
      );
      
      if (allPartsMatch) {
        return true;
      }
    }
    
    // combination.id가 키에 포함되어 있거나, 키가 combination.id에 포함되어 있는 경우
    if (combination.id && (key.includes(combination.id) || combination.id.includes(key))) {
      return true;
    }
    
    return false;
  });
  
  if (partialMatch) {
    return { data: choicesPricing[partialMatch], matchedKey: partialMatch };
  }

  return { data: {} };
}

/**
 * 미정(미선택) 조합일 때 미국 거주자 선택의 ota_sale_price로 폴백
 * 조합 키가 choices_pricing에 없거나 ota_sale_price가 없을 때,
 * 같은 구조(같은 개수의 segment)를 가진 키들 중 ota_sale_price가 가장 큰 값을 사용.
 * 같은 구조 키가 없으면 전체 키 중 최대 ota_sale_price 사용 (예: DB 키가 choice별 2-segment, 폼은 4-segment인 경우)
 */
export function getFallbackOtaSalePrice(
  combination: ChoiceCombination,
  choicesPricing: Record<string, any>
): number | undefined {
  if (!choicesPricing || Object.keys(choicesPricing).length === 0) return undefined;
  const keyToUse = combination.combination_key || combination.id;
  const partCount = keyToUse ? keyToUse.split('+').length : 0;
  let maxOtaSameStructure = 0;
  let foundSameStructure = false;
  let maxOtaAny = 0;
  let foundAny = false;
  for (const key of Object.keys(choicesPricing)) {
    const entry = choicesPricing[key];
    if (!entry || typeof entry !== 'object') continue;
    const ota = entry.ota_sale_price;
    if (ota === undefined || ota === null) continue;
    const num = Number(ota);
    if (Number.isNaN(num)) continue;
    const sameStructure = partCount > 0 && key.split('+').length === partCount;
    if (sameStructure && num > maxOtaSameStructure) {
      maxOtaSameStructure = num;
      foundSameStructure = true;
    }
    if (num > maxOtaAny) {
      maxOtaAny = num;
      foundAny = true;
    }
  }
  return foundSameStructure ? maxOtaSameStructure : (foundAny ? maxOtaAny : undefined);
}

/**
 * 초이스 조합에 대한 ota_sale_price 조회 (직접 매칭 실패 시 미국 거주자 폴백 적용)
 */
export function getOtaSalePriceWithFallback(
  combination: ChoiceCombination,
  choicesPricing: Record<string, any>
): number {
  const match = findChoicePricingData(combination, choicesPricing);
  const direct = match?.data?.ota_sale_price;
  if (direct !== undefined && direct !== null && Number(direct) >= 0) return Number(direct);
  const fallback = getFallbackOtaSalePrice(combination, choicesPricing);
  return fallback ?? 0;
}

/**
 * 초이스 변경 시 기존 가격을 새 키로 마이그레이션
 * @param oldChoicesPricing 기존 choices_pricing 데이터
 * @param newCombinations 새로운 초이스 조합 목록
 * @returns 마이그레이션된 choices_pricing 데이터
 */
export function migrateChoicePricing(
  oldChoicesPricing: Record<string, any>,
  newCombinations: ChoiceCombination[]
): Record<string, any> {
  if (!oldChoicesPricing || Object.keys(oldChoicesPricing).length === 0) {
    return {};
  }

  const migratedPricing: Record<string, any> = {};

  // 각 새로운 조합에 대해 기존 가격 찾기
  newCombinations.forEach(combination => {
    const matchResult = findChoicePricingData(combination, oldChoicesPricing);
    
    if (matchResult.data && Object.keys(matchResult.data).length > 0) {
      // 기존 가격을 새 키로 복사
      migratedPricing[combination.id] = { ...matchResult.data };
      
      // combination_key도 키로 사용 (이중 저장으로 호환성 향상)
      if (combination.combination_key && combination.combination_key !== combination.id) {
        migratedPricing[combination.combination_key] = { ...matchResult.data };
      }
      
      console.log(`초이스 가격 마이그레이션: ${matchResult.matchedKey} -> ${combination.id}`, {
        oldKey: matchResult.matchedKey,
        newKey: combination.id,
        combinationKey: combination.combination_key,
        price: matchResult.data
      });
    }
  });

  return migratedPricing;
}

/**
 * 동적 가격 데이터에서 초이스 가격을 조회하고 마이그레이션
 * @param pricingData 동적 가격 데이터 (choices_pricing 포함)
 * @param newCombinations 새로운 초이스 조합 목록
 * @returns 마이그레이션된 choices_pricing 데이터
 */
export function migrateDynamicPricingChoices(
  pricingData: Array<{ choices_pricing?: any }>,
  newCombinations: ChoiceCombination[]
): Record<string, any> {
  if (!pricingData || pricingData.length === 0) {
    return {};
  }

  // 가장 최근 업데이트된 가격 데이터 사용
  const latestPricing = pricingData
    .filter(p => p.choices_pricing)
    .sort((a, b) => {
      // updated_at이 있다면 그것으로 정렬, 없으면 첫 번째 사용
      return 0;
    })[0];

  if (!latestPricing || !latestPricing.choices_pricing) {
    return {};
  }

  // choices_pricing 파싱
  let choicesPricing: Record<string, any> = {};
  try {
    choicesPricing = typeof latestPricing.choices_pricing === 'string'
      ? JSON.parse(latestPricing.choices_pricing)
      : latestPricing.choices_pricing;
  } catch (e) {
    console.warn('choices_pricing 파싱 오류:', e);
    return {};
  }

  // 마이그레이션 수행
  return migrateChoicePricing(choicesPricing, newCombinations);
}

