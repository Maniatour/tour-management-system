import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SimplePricingRule, SimplePricingRuleDto } from '@/lib/types/dynamic-pricing';

interface UseDynamicPricingProps {
  productId: string;
  onSave?: (rule: SimplePricingRule) => void;
}

export function useDynamicPricing({ productId, onSave }: UseDynamicPricingProps) {
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [dynamicPricingData, setDynamicPricingData] = useState<Array<{
    date: string;
    rules: SimplePricingRule[];
  }>>([]);

  const loadDynamicPricingData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dynamic_pricing')
        .select('*')
        .eq('product_id', productId)
        .order('date', { ascending: true });

      if (error) {
        console.error('동적 가격 데이터 로드 실패:', error);
        // 에러가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록 함
        setDynamicPricingData([]);
        return;
      }

      // 날짜별로 그룹화
      const groupedData = data.reduce((acc, rule) => {
        const date = rule.date;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(rule);
        return acc;
      }, {} as Record<string, SimplePricingRule[]>);

      const formattedData = Object.entries(groupedData).map(([date, rules]) => ({
        date,
        rules
      }));

      setDynamicPricingData(formattedData);
    } catch (error) {
      console.error('동적 가격 데이터 로드 실패:', error);
      setDynamicPricingData([]);
    }
  }, [productId]);

  const savePricingRule = useCallback(async (ruleData: SimplePricingRuleDto, showMessage: boolean = false) => {
    setSaving(true);
    if (showMessage) {
      setSaveMessage('');
    }

    try {
      const { data, error } = await supabase
        .from('dynamic_pricing')
        .upsert(ruleData)
        .select()
        .single();

      if (error) throw error;

      if (showMessage) {
        setSaveMessage('가격 규칙이 성공적으로 저장되었습니다.');
        setTimeout(() => setSaveMessage(''), 3000);
      }
      
      await loadDynamicPricingData();
      
      if (onSave && data) {
        onSave(data);
      }
    } catch (error) {
      console.error('가격 규칙 저장 실패:', error);
      if (showMessage) {
        setSaveMessage('가격 규칙 저장에 실패했습니다.');
      }
      throw error; // 에러를 다시 던져서 상위에서 처리할 수 있도록 함
    } finally {
      setSaving(false);
    }
  }, [productId, onSave, loadDynamicPricingData]);

  const deletePricingRule = useCallback(async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('dynamic_pricing')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      await loadDynamicPricingData();
    } catch (error) {
      console.error('가격 규칙 삭제 실패:', error);
    }
  }, [loadDynamicPricingData]);

  useEffect(() => {
    if (productId) {
      loadDynamicPricingData();
    }
  }, [productId, loadDynamicPricingData]);

  const setMessage = useCallback((message: string) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(''), 3000);
  }, []);

  return {
    saving,
    saveMessage,
    dynamicPricingData,
    loadDynamicPricingData,
    savePricingRule,
    deletePricingRule,
    setMessage
  };
}
