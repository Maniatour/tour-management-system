import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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

      // dynamic_pricing 테이블에서 choices_pricing 데이터 가져오기
      let query = supabase
        .from('dynamic_pricing')
        .select('choices_pricing')
        .eq('product_id', productId)
        .not('choices_pricing', 'is', null);

      // 채널 필터링
      if (selectedChannelId) {
        query = query.eq('channel_id', selectedChannelId);
      } else if (selectedChannelType === 'SELF') {
        query = query.like('channel_id', 'B%');
      }

      const { data, error } = await query.limit(1);

      if (error) {
        console.error('초이스 가격 데이터 로드 실패:', error);
        return;
      }

      console.log('초이스 조합 로드 쿼리 결과:', {
        selectedChannelId,
        selectedChannelType,
        dataCount: data?.length || 0
      });

      if (data && data.length > 0) {
        const choicesPricing = data[0].choices_pricing;
        const choicesData = typeof choicesPricing === 'string' 
          ? JSON.parse(choicesPricing) 
          : choicesPricing;

        console.log('데이터베이스에서 로드된 choices_pricing:', choicesData);
        console.log('canyon_choice 구조:', choicesData.canyon_choice);
        console.log('canyon_choice.options:', choicesData.canyon_choice?.options);

        const combinations: ChoiceCombination[] = [];

        // canyon_choice.options에서 초이스 조합 생성
        if (choicesData.canyon_choice?.options) {
          Object.entries(choicesData.canyon_choice.options).forEach(([key, option]: [string, any]) => {
            console.log(`초이스 조합 생성: ${key} ->`, option);
            combinations.push({
              id: key,
              combination_key: key,
              combination_name: option.name,
              combination_name_ko: option.name_ko,
              adult_price: option.adult_price,
              child_price: option.child_price,
              infant_price: option.infant_price,
              is_active: true
            });
          });
        }

        console.log('데이터베이스에서 생성된 초이스 조합:', combinations);
        setChoiceCombinations(combinations);
      } else {
        console.log('선택된 채널에 대한 초이스 데이터가 없습니다.');
        setChoiceCombinations([]);
      }
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
