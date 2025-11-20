import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { findChoicePricingData, migrateChoicePricing } from '@/utils/choicePricingMatcher';

interface ChoiceOption {
  id: string;
  name: string;
  name_ko?: string;
  is_default: boolean;
  adult_price: number;
  child_price: number;
  infant_price: number;
}

interface ChoiceGroup {
  id: string;
  name: string;
  name_ko?: string;
  description?: string;
  options: ChoiceOption[];
}

interface ProductChoices {
  required: ChoiceGroup[];
}

interface ChoiceCombination {
  id: string;
  combination_key: string;
  combination_name: string;
  combination_name_ko?: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  is_active: boolean;
  combination_details?: Array<{
    groupId: string;
    groupName: string;
    groupNameKo?: string;
    optionId: string;
    optionName: string;
    optionNameKo?: string;
    adult_price: number;
    child_price: number;
    infant_price: number;
  }>;
}

export function useChoiceManagement(productId: string, selectedChannelId?: string, selectedChannelType?: string) {
  const [choiceGroups, setChoiceGroups] = useState<ChoiceGroup[]>([]);
  const [choiceCombinations, setChoiceCombinations] = useState<ChoiceCombination[]>([]);
  const [showCombinationPricing, setShowCombinationPricing] = useState(false);

  const loadChoiceCombinationsFromPricing = useCallback(async () => {
    try {
      if (!productId) {
        setChoiceCombinations([]);
        return;
      }

      // 먼저 products 테이블에서 choices 데이터 가져오기
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('choices')
        .eq('id', productId)
        .single();

      if (productError) {
        console.error('상품 초이스 데이터 로드 실패:', productError);
        return;
      }

      console.log('상품에서 로드된 choices 데이터:', productData?.choices);

      // product_choices와 choice_options 테이블에서 실제 초이스 데이터 가져오기
      const { data: choicesData, error: choicesError } = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_type,
          is_required,
          choice_options (
            id,
            option_key,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order
          )
        `)
        .eq('product_id', productId)
        .order('sort_order');

      if (choicesError) {
        console.error('초이스 옵션 데이터 로드 실패:', choicesError);
      } else {
        console.log('choice_options에서 로드된 데이터:', choicesData);
      }

      // 먼저 dynamic_pricing 테이블에서 choices_pricing 데이터 확인
      // dynamic_pricing 테이블에서 choices_pricing 데이터 가져오기
      let query = supabase
        .from('dynamic_pricing')
        .select('choices_pricing, channel_id, updated_at')
        .eq('product_id', productId)
        .not('choices_pricing', 'is', null);

      // 채널 필터링
      if (selectedChannelId) {
        query = query.eq('channel_id', selectedChannelId);
      } else if (selectedChannelType === 'SELF') {
        query = query.like('channel_id', 'B%');
      }

      const { data: pricingData, error: pricingError } = await query
        .order('updated_at', { ascending: false })
        .limit(1);

      if (pricingError) {
        console.error('초이스 가격 데이터 로드 실패:', pricingError);
      }

      console.log('동적 가격에서 초이스 조합 로드 쿼리 결과:', {
        productId,
        selectedChannelId,
        selectedChannelType,
        dataCount: pricingData?.length || 0,
        note: 'dynamic_pricing 테이블에서 로드'
      });

      // choice_options 테이블에서 데이터가 있으면 우선 사용
      if (choicesData && choicesData.length > 0) {
        console.log('choice_options에서 로드된 데이터로 조합 생성');
        
        const combinations: ChoiceCombination[] = [];
        
        // 각 choice_group의 모든 옵션 조합 생성
        const generateCombinations = (groups: any[], currentCombination: any[] = [], groupIndex: number = 0) => {
          if (groupIndex >= groups.length) {
            // 조합 완성
            if (currentCombination.length > 0) {
              const combinationKey = currentCombination.map(item => item.option_key).join('+');
              const combinationName = currentCombination.map(item => item.option_name).join(' + ');
              const combinationNameKo = currentCombination.map(item => item.option_name_ko).join(' + ');
              
              // 조합의 총 가격 계산
              const totalAdultPrice = currentCombination.reduce((sum, item) => sum + (item.adult_price || 0), 0);
              const totalChildPrice = currentCombination.reduce((sum, item) => sum + (item.child_price || 0), 0);
              const totalInfantPrice = currentCombination.reduce((sum, item) => sum + (item.infant_price || 0), 0);
              
              combinations.push({
                id: combinationKey,
                combination_key: combinationKey,
                combination_name: combinationName,
                combination_name_ko: combinationNameKo,
                adult_price: totalAdultPrice,
                child_price: totalChildPrice,
                infant_price: totalInfantPrice,
                is_active: true,
                combination_details: currentCombination.map(item => ({
                  groupId: item.group_id || '',
                  optionId: item.id || '',
                  optionKey: item.option_key || ''
                }))
              });
            }
            return;
          }
          
          const currentGroup = groups[groupIndex];
          if (currentGroup.choice_options && currentGroup.choice_options.length > 0) {
            // 현재 그룹의 각 옵션에 대해 재귀 호출
            currentGroup.choice_options.forEach((option: any) => {
              generateCombinations(groups, [...currentCombination, { ...option, group_id: currentGroup.id }], groupIndex + 1);
            });
          } else {
            // 옵션이 없는 그룹은 건너뛰기
            generateCombinations(groups, currentCombination, groupIndex + 1);
          }
        };
        
        generateCombinations(choicesData);
        
        // 동적 가격에서 기존 가격 찾아서 적용 (초이스 변경 시에도 기존 가격 유지)
        if (pricingData && pricingData.length > 0) {
          const choicesPricing = pricingData[0].choices_pricing;
          let existingChoicesPricing: Record<string, any> = {};
          
          try {
            existingChoicesPricing = typeof choicesPricing === 'string'
              ? JSON.parse(choicesPricing)
              : choicesPricing || {};
          } catch (e) {
            console.warn('기존 choices_pricing 파싱 오류:', e);
          }
          
          // 각 조합에 대해 기존 가격 찾기
          combinations.forEach(combination => {
            const matchResult = findChoicePricingData(combination, existingChoicesPricing);
            
            if (matchResult.data && Object.keys(matchResult.data).length > 0) {
              // 기존 가격이 있으면 적용 (기본 가격보다 우선)
              const adultPrice = matchResult.data.adult || matchResult.data.adult_price;
              const childPrice = matchResult.data.child || matchResult.data.child_price;
              const infantPrice = matchResult.data.infant || matchResult.data.infant_price;
              
              if (adultPrice !== undefined) combination.adult_price = adultPrice;
              if (childPrice !== undefined) combination.child_price = childPrice;
              if (infantPrice !== undefined) combination.infant_price = infantPrice;
              
              console.log(`기존 가격 적용: ${combination.id} <- ${matchResult.matchedKey}`, {
                adult: combination.adult_price,
                child: combination.child_price,
                infant: combination.infant_price
              });
            }
          });
        }
        
        console.log('choice_options에서 생성된 조합들 (기존 가격 적용 후):', combinations);
        setChoiceCombinations(combinations);
        return;
      }

      // dynamic_pricing에서 choices_pricing 데이터가 있으면 사용
      if (pricingData && pricingData.length > 0) {
        const choicesPricing = pricingData[0].choices_pricing;
        const choicesData = typeof choicesPricing === 'string' 
          ? JSON.parse(choicesPricing) 
          : choicesPricing;

        console.log('동적 가격에서 로드된 choices_pricing:', choicesData);
        console.log('choices_pricing 타입:', typeof choicesData);
        console.log('choices_pricing 키들:', Object.keys(choicesData || {}));

        const combinations: ChoiceCombination[] = [];

        // 새로운 조합 구조 처리 (choices_pricing이 직접 조합 데이터인 경우)
        if (choicesData.combinations) {
          Object.entries(choicesData.combinations).forEach(([combinationId, combinationData]: [string, any]) => {
            console.log(`조합 처리: ${combinationId} ->`, combinationData);
            combinations.push({
              id: combinationId,
              combination_key: combinationData.combination_key,
              combination_name: combinationData.combination_name,
              combination_name_ko: combinationData.combination_name_ko,
              adult_price: combinationData.adult_price,
              child_price: combinationData.child_price,
              infant_price: combinationData.infant_price,
              is_active: true
            });
          });
        } else if (typeof choicesData === 'object' && choicesData !== null) {
          // 새로운 구조: { choiceId: { adult: 50, child: 30, infant: 20 } }
          Object.entries(choicesData).forEach(([choiceId, choiceData]: [string, any]) => {
            if (choiceData && typeof choiceData === 'object') {
              console.log(`새로운 구조 조합 처리: ${choiceId} ->`, choiceData);
              combinations.push({
                id: choiceId,
                combination_key: choiceId,
                combination_name: choiceId.replace(/_/g, ' '),
                combination_name_ko: choiceId.replace(/_/g, ' '),
                adult_price: choiceData.adult || choiceData.adult_price || 0,
                child_price: choiceData.child || choiceData.child_price || 0,
                infant_price: choiceData.infant || choiceData.infant_price || 0,
                is_active: true
              });
            }
          });
        } else {
          // 기존 그룹별 구조 처리 (하위 호환성)
          Object.entries(choicesData).forEach(([groupKey, groupData]: [string, any]) => {
            console.log(`초이스 그룹 처리: ${groupKey} ->`, groupData);
            
            if (groupData?.options) {
              Object.entries(groupData.options).forEach(([optionKey, option]: [string, any]) => {
                console.log(`초이스 조합 생성: ${groupKey}_${optionKey} ->`, option);
                combinations.push({
                  id: `${groupKey}_${optionKey}`,
                  combination_key: `${groupKey}_${optionKey}`,
                  combination_name: option.name,
                  combination_name_ko: option.name_ko,
                  adult_price: option.adult_price,
                  child_price: option.child_price,
                  infant_price: option.infant_price,
                  is_active: true
                });
              });
            }
          });
        }

        console.log('동적 가격에서 생성된 초이스 조합:', combinations);
        setChoiceCombinations(combinations);
        return;
      }

      // dynamic_pricing에 데이터가 없으면 products 테이블의 choices 데이터 사용
      if (productData?.choices?.required) {
        const combinations: ChoiceCombination[] = [];

        // 모든 그룹의 경우의 수를 생성하는 함수
        const generateAllCombinations = (groups: any[]) => {
          if (groups.length === 0) return [];
          
          // 각 그룹의 옵션들을 배열로 변환
          const groupOptions = groups.map(group => 
            group.options?.map((option: any) => ({
              groupId: group.id,
              groupName: group.name,
              groupNameKo: group.name_ko,
              optionId: option.id,
              optionName: option.name,
              optionNameKo: option.name_ko,
              adult_price: option.adult_price || 0,
              child_price: option.child_price || 0,
              infant_price: option.infant_price || 0
            })) || []
          );

          // 모든 조합 생성 (카르테시안 곱)
          const generateCartesianProduct = (arrays: any[][]): any[][] => {
            if (arrays.length === 0) return [[]];
            if (arrays.length === 1) return arrays[0].map(item => [item]);
            
            const result: any[][] = [];
            const firstArray = arrays[0];
            const restArrays = arrays.slice(1);
            const restCombinations = generateCartesianProduct(restArrays);
            
            firstArray.forEach(firstItem => {
              restCombinations.forEach(restCombination => {
                result.push([firstItem, ...restCombination]);
              });
            });
            
            return result;
          };

          const allCombinations = generateCartesianProduct(groupOptions);
          
          return allCombinations.map((combination, index) => {
            const combinationKey = combination.map(item => `${item.groupId}_${item.optionId}`).join('+');
            const combinationName = combination.map(item => item.optionName).join(' + ');
            const combinationNameKo = combination.map(item => item.optionNameKo).join(' + ');
            
            // 조합의 총 가격 계산 (각 옵션의 가격을 합산)
            const totalAdultPrice = combination.reduce((sum, item) => sum + item.adult_price, 0);
            const totalChildPrice = combination.reduce((sum, item) => sum + item.child_price, 0);
            const totalInfantPrice = combination.reduce((sum, item) => sum + item.infant_price, 0);
            
            return {
              id: `combination_${index}`,
              combination_key: combinationKey,
              combination_name: combinationName,
              combination_name_ko: combinationNameKo,
              adult_price: totalAdultPrice,
              child_price: totalChildPrice,
              infant_price: totalInfantPrice,
              is_active: true,
              // 조합 구성 요소 정보 저장
              combination_details: combination
            };
          });
        };

        const allCombinations = generateAllCombinations(productData.choices.required);
        console.log('상품에서 생성된 모든 초이스 조합:', allCombinations);
        setChoiceCombinations(allCombinations);
        return;
      }

      // 두 곳 모두에서 데이터가 없으면 빈 배열 설정
      console.log('초이스 데이터가 없습니다.');
      setChoiceCombinations([]);
    } catch (error) {
      console.error('초이스 조합 로드 실패:', error);
    }
  }, [productId, selectedChannelId, selectedChannelType]);

  const loadChoiceGroups = useCallback(async () => {
    try {
      if (!productId) {
        setChoiceGroups([]);
        return;
      }

      // products 테이블에서 choices 컬럼 데이터 가져오기
      const { data, error } = await supabase
        .from('products')
        .select('choices')
        .eq('id', productId)
        .single();

      if (error) {
        console.error('초이스 데이터 로드 실패:', error);
        setChoiceGroups([]);
        return;
      }

      if (!data?.choices) {
        setChoiceGroups([]);
        return;
      }

      const productChoices: ProductChoices = data.choices;
      
      // required 초이스 그룹들을 변환
      const choiceGroups: ChoiceGroup[] = productChoices.required || [];
      
      console.log('로드된 초이스 그룹:', choiceGroups);
      setChoiceGroups(choiceGroups);
    } catch (error) {
      console.error('초이스 그룹 로드 실패:', error);
      setChoiceGroups([]);
    }
  }, [productId]);


  const updateChoiceCombinationPrice = useCallback((
    combinationId: string, 
    priceType: 'adult_price' | 'child_price' | 'infant_price', 
    value: number
  ) => {
    setChoiceCombinations(prev => 
      prev.map(combo => 
        combo.id === combinationId 
          ? { ...combo, [priceType]: value }
          : combo
      )
    );
  }, []);

  const toggleCombinationPricing = useCallback(() => {
    setShowCombinationPricing(!showCombinationPricing);
  }, [showCombinationPricing]);

  useEffect(() => {
    if (productId) {
      loadChoiceGroups();
      loadChoiceCombinationsFromPricing(); // 데이터베이스에서 초이스 조합 로드
    }
  }, [productId, loadChoiceGroups, loadChoiceCombinationsFromPricing]);

  // generateChoiceCombinations는 제거 - 데이터베이스에서 로드한 초이스 조합만 사용

  return {
    choiceGroups,
    choiceCombinations,
    showCombinationPricing,
    loadChoiceGroups,
    updateChoiceCombinationPrice,
    toggleCombinationPricing
  };
}
