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

export function useChoiceManagement(productId: string) {
  const [choiceGroups, setChoiceGroups] = useState<ChoiceGroup[]>([]);
  const [choiceCombinations, setChoiceCombinations] = useState<ChoiceCombination[]>([]);
  const [showCombinationPricing, setShowCombinationPricing] = useState(false);

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

  const generateChoiceCombinations = useCallback(() => {
    if (choiceGroups.length === 0) {
      setChoiceCombinations([]);
      return;
    }

    const combinations: ChoiceCombination[] = [];
    
    // 각 초이스 그룹의 옵션들을 개별 조합으로 생성
    choiceGroups.forEach(group => {
      group.options.forEach(option => {
        const combinationKey = `${group.id}_${option.id}`;
        const combinationName = `${group.name} - ${option.name}`;
        const combinationNameKo = `${group.name_ko || group.name} - ${option.name_ko || option.name}`;
        
        combinations.push({
          id: combinationKey,
          combination_key: combinationKey,
          combination_name: combinationName,
          combination_name_ko: combinationNameKo,
          adult_price: option.adult_price,
          child_price: option.child_price,
          infant_price: option.infant_price,
          is_active: true
        });
      });
    });

    console.log('생성된 초이스 조합:', combinations);
    setChoiceCombinations(combinations);
  }, [choiceGroups]);

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
    }
  }, [productId, loadChoiceGroups]);

  useEffect(() => {
    if (choiceGroups.length > 0) {
      generateChoiceCombinations();
    }
  }, [choiceGroups, generateChoiceCombinations]);

  return {
    choiceGroups,
    choiceCombinations,
    showCombinationPricing,
    loadChoiceGroups,
    generateChoiceCombinations,
    updateChoiceCombinationPrice,
    toggleCombinationPricing
  };
}
