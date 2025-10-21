import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 새로운 간결한 초이스 시스템 타입 정의
interface ChoiceOption {
  id: string;
  option_key: string;
  option_name: string;
  option_name_ko: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  capacity: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

interface ProductChoice {
  id: string;
  choice_group: string;
  choice_group_ko: string;
  choice_type: 'single' | 'multiple' | 'quantity';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  options: ChoiceOption[];
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
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([]);
  const [choiceCombinations, setChoiceCombinations] = useState<ChoiceCombination[]>([]);
  const [showCombinationPricing, setShowCombinationPricing] = useState(false);

  // 새로운 간결한 초이스 시스템에서 초이스 조합 로드
  const loadChoiceCombinationsFromPricing = useCallback(async () => {
    try {
      if (!productId) {
        setChoiceCombinations([]);
        return;
      }

      // 새로운 간결한 초이스 시스템에서 초이스 데이터 가져오기
      const { data: choicesData, error: choicesError } = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_type,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
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
        console.error('상품 초이스 데이터 로드 실패:', choicesError);
        return;
      }

      console.log('새로운 시스템에서 로드된 초이스 데이터:', choicesData);

      if (choicesData && choicesData.length > 0) {
        const combinations: ChoiceCombination[] = [];

        // 모든 그룹의 경우의 수를 생성하는 함수
        const generateAllCombinations = (choices: ProductChoice[]) => {
          if (choices.length === 0) return [];
          
          // 각 그룹의 옵션들을 배열로 변환
          const groupOptions = choices.map(choice => 
            choice.options?.map(option => ({
              groupId: choice.choice_group,
              groupName: choice.choice_group,
              groupNameKo: choice.choice_group_ko,
              optionId: option.option_key,
              optionName: option.option_name,
              optionNameKo: option.option_name_ko,
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

        const allCombinations = generateAllCombinations(choicesData);
        console.log('새로운 시스템에서 생성된 모든 초이스 조합:', allCombinations);
        setChoiceCombinations(allCombinations);
        return;
      }

      // 새로운 시스템에 데이터가 없으면 기존 dynamic_pricing 테이블에서 확인
      const { data, error } = await supabase
        .from('dynamic_pricing')
        .select('choices_pricing')
        .eq('product_id', productId)
        .not('choices_pricing', 'is', null)
        .limit(1);

      if (error) {
        console.error('초이스 가격 데이터 로드 실패:', error);
        return;
      }

      console.log('동적 가격에서 초이스 조합 로드 쿼리 결과:', {
        productId,
        dataCount: data?.length || 0,
        note: 'dynamic_pricing 테이블에서 로드'
      });

      if (data && data.length > 0) {
        const choicesPricing = data[0].choices_pricing;
        const choicesData = typeof choicesPricing === 'string' 
          ? JSON.parse(choicesPricing) 
          : choicesPricing;

        console.log('동적 가격에서 로드된 choices_pricing:', choicesData);

        const combinations: ChoiceCombination[] = [];

        // 새로운 조합 구조 처리
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
      } else {
        console.log('초이스 데이터가 없습니다.');
        setChoiceCombinations([]);
      }
    } catch (error) {
      console.error('초이스 조합 로드 실패:', error);
    }
  }, [productId]);

  // 새로운 간결한 초이스 시스템에서 초이스 그룹 로드
  const loadChoiceGroups = useCallback(async () => {
    try {
      if (!productId) {
        setProductChoices([]);
        return;
      }

      // 새로운 간결한 초이스 시스템에서 초이스 데이터 가져오기
      const { data, error } = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_type,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
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

      if (error) {
        console.error('초이스 데이터 로드 실패:', error);
        setProductChoices([]);
        return;
      }

      console.log('새로운 시스템에서 로드된 초이스 그룹:', data);
      setProductChoices(data || []);
    } catch (error) {
      console.error('초이스 그룹 로드 실패:', error);
      setProductChoices([]);
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
      loadChoiceCombinationsFromPricing();
    }
  }, [productId, loadChoiceGroups, loadChoiceCombinationsFromPricing]);

  return {
    productChoices, // 새로운 시스템의 초이스 그룹
    choiceGroups: productChoices.map(pc => ({
      id: pc.choice_group,
      name: pc.choice_group,
      name_ko: pc.choice_group_ko,
      description: '',
      options: pc.options.map(opt => ({
        id: opt.option_key,
        name: opt.option_name,
        name_ko: opt.option_name_ko,
        is_default: opt.is_default,
        adult_price: opt.adult_price,
        child_price: opt.child_price,
        infant_price: opt.infant_price
      }))
    })), // 하위 호환성을 위한 변환
    choiceCombinations,
    showCombinationPricing,
    loadChoiceGroups,
    updateChoiceCombinationPrice,
    toggleCombinationPricing
  };
}
