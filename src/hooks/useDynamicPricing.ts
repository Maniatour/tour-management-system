import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SimplePricingRule, SimplePricingRuleDto } from '@/lib/types/dynamic-pricing';

interface UseDynamicPricingProps {
  productId: string;
  selectedChannelId?: string;
  selectedChannelType?: string;
  onSave?: (rule: SimplePricingRule) => void;
}

export function useDynamicPricing({ productId, selectedChannelId, selectedChannelType, onSave }: UseDynamicPricingProps) {
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [dynamicPricingData, setDynamicPricingData] = useState<Array<{
    date: string;
    rules: SimplePricingRule[];
  }>>([]);

  const loadDynamicPricingData = useCallback(async () => {
    try {
      let query = supabase
        .from('dynamic_pricing')
        .select('*')
        .eq('product_id', productId);

      // 채널 필터링
      if (selectedChannelId) {
        query = query.eq('channel_id', selectedChannelId);
      } else if (selectedChannelType === 'SELF') {
        // SELF 채널 타입의 경우 B로 시작하는 채널 ID들만 필터링
        query = query.like('channel_id', 'B%');
      }

      const { data, error } = await query.order('date', { ascending: true });

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

      console.log('로드된 동적 가격 데이터:', {
        selectedChannelId,
        selectedChannelType,
        dataCount: data.length,
        formattedDataCount: formattedData.length,
        sampleData: data.slice(0, 3) // 처음 3개 데이터 샘플
      });

      setDynamicPricingData(formattedData);
    } catch (error) {
      console.error('동적 가격 데이터 로드 실패:', error);
      setDynamicPricingData([]);
    }
  }, [productId, selectedChannelId, selectedChannelType]);

  const savePricingRule = useCallback(async (ruleData: SimplePricingRuleDto, showMessage: boolean = false) => {
    setSaving(true);
    if (showMessage) {
      setSaveMessage('');
    }

    try {
      // 먼저 기존 레코드가 있는지 확인 (choices_pricing 포함)
      const { data: existingData, error: selectError } = await supabase
        .from('dynamic_pricing')
        .select('id, choices_pricing')
        .eq('product_id', ruleData.product_id)
        .eq('channel_id', ruleData.channel_id)
        .eq('date', ruleData.date)
        .maybeSingle();

      let result;
      
      // maybeSingle()은 레코드가 없으면 null을 반환하고 에러가 아님
      if (existingData && !selectError) {
        // 기존 레코드가 있으면 부분 업데이트 수행
        // 전달되지 않은 필드는 기존 값을 유지
        
        // 기존 레코드의 전체 정보 가져오기
        const { data: fullExistingData, error: fullDataError } = await supabase
          .from('dynamic_pricing')
          .select('*')
          .eq('id', existingData.id)
          .single();
        
        if (fullDataError || !fullExistingData) {
          throw new Error('기존 데이터 조회 실패');
        }
        
        // 업데이트할 데이터 준비: 전달된 필드만 업데이트, 나머지는 기존 값 유지
        const updateData: Partial<SimplePricingRuleDto> = {
          // 필수 필드는 항상 포함
          product_id: ruleData.product_id,
          channel_id: ruleData.channel_id,
          date: ruleData.date,
          
          // 전달된 필드만 업데이트, 전달되지 않은 필드는 기존 값 유지
          adult_price: ruleData.adult_price !== undefined ? ruleData.adult_price : fullExistingData.adult_price,
          child_price: ruleData.child_price !== undefined ? ruleData.child_price : fullExistingData.child_price,
          infant_price: ruleData.infant_price !== undefined ? ruleData.infant_price : fullExistingData.infant_price,
          commission_percent: ruleData.commission_percent !== undefined ? ruleData.commission_percent : (fullExistingData.commission_percent ?? 0),
          markup_amount: ruleData.markup_amount !== undefined ? ruleData.markup_amount : (fullExistingData.markup_amount ?? 0),
          coupon_percent: ruleData.coupon_percent !== undefined ? ruleData.coupon_percent : (fullExistingData.coupon_percent ?? 0),
          is_sale_available: ruleData.is_sale_available !== undefined ? ruleData.is_sale_available : (fullExistingData.is_sale_available ?? true),
          not_included_price: ruleData.not_included_price !== undefined ? ruleData.not_included_price : (fullExistingData.not_included_price ?? 0),
          markup_percent: ruleData.markup_percent !== undefined ? ruleData.markup_percent : (fullExistingData.markup_percent ?? 0),
        };
        
        // choices_pricing이 있으면 기존 데이터와 병합
        if (ruleData.choices_pricing && Object.keys(ruleData.choices_pricing).length > 0) {
          const existingChoicesPricing = fullExistingData.choices_pricing || {};
          // 기존 choices_pricing과 새로운 choices_pricing 병합
          updateData.choices_pricing = {
            ...existingChoicesPricing,
            ...ruleData.choices_pricing
          };
        } else if (fullExistingData.choices_pricing) {
          // choices_pricing이 전달되지 않았으면 기존 값 유지
          updateData.choices_pricing = fullExistingData.choices_pricing;
        }
        
        const { data, error } = await supabase
          .from('dynamic_pricing')
          .update(updateData)
          .eq('id', existingData.id)
          .select()
          .maybeSingle();
        
        if (error) throw error;
        if (!data) throw new Error('업데이트 실패: 데이터가 반환되지 않았습니다.');
        result = data;
      } else {
        // 기존 레코드가 없으면 삽입
        // 필수 필드가 없으면 기본값 설정
        const insertData: SimplePricingRuleDto = {
          product_id: ruleData.product_id,
          channel_id: ruleData.channel_id,
          date: ruleData.date,
          adult_price: ruleData.adult_price !== undefined ? ruleData.adult_price : 0,
          child_price: ruleData.child_price !== undefined ? ruleData.child_price : 0,
          infant_price: ruleData.infant_price !== undefined ? ruleData.infant_price : 0,
          commission_percent: ruleData.commission_percent !== undefined ? ruleData.commission_percent : 0,
          markup_amount: ruleData.markup_amount !== undefined ? ruleData.markup_amount : 0,
          coupon_percent: ruleData.coupon_percent !== undefined ? ruleData.coupon_percent : 0,
          is_sale_available: ruleData.is_sale_available !== undefined ? ruleData.is_sale_available : true,
          not_included_price: ruleData.not_included_price ?? 0,
          markup_percent: ruleData.markup_percent ?? 0,
          choices_pricing: ruleData.choices_pricing
        };
        
        const { data, error } = await supabase
          .from('dynamic_pricing')
          .insert(insertData)
          .select()
          .maybeSingle();
        
        if (error) throw error;
        if (!data) throw new Error('삽입 실패: 데이터가 반환되지 않았습니다.');
        result = data;
      }

      if (showMessage) {
        setSaveMessage('가격 규칙이 성공적으로 저장되었습니다.');
        setTimeout(() => setSaveMessage(''), 3000);
      }
      
      await loadDynamicPricingData();
      
      if (onSave && result) {
        onSave(result);
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

  // 배치 저장 함수 (자체 채널용)
  const savePricingRulesBatch = useCallback(async (
    rulesData: SimplePricingRuleDto[], 
    onProgress?: (completed: number, total: number) => void
  ) => {
    setSaving(true);
    setSaveMessage('');

    try {
      const totalRules = rulesData.length;
      let completedRules = 0;

      // 배치 크기 설정 (한 번에 처리할 레코드 수)
      const batchSize = 50;
      const batches = [];
      
      for (let i = 0; i < rulesData.length; i += batchSize) {
        batches.push(rulesData.slice(i, i + batchSize));
      }

      console.log(`배치 저장 시작: ${totalRules}개 규칙을 ${batches.length}개 배치로 처리`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // 배치 내에서 병렬 처리
        const batchPromises = batch.map(async (ruleData) => {
          try {
            // 기존 레코드 확인
            const { data: existingData, error: selectError } = await supabase
              .from('dynamic_pricing')
              .select('id')
              .eq('product_id', ruleData.product_id)
              .eq('channel_id', ruleData.channel_id)
              .eq('date', ruleData.date)
              .maybeSingle();

            if (existingData && !selectError) {
              // 업데이트
              const { error } = await supabase
                .from('dynamic_pricing')
                .update(ruleData)
                .eq('id', existingData.id);
              
              if (error) throw error;
            } else {
              // 삽입
              const { error } = await supabase
                .from('dynamic_pricing')
                .insert(ruleData);
              
              if (error) throw error;
            }

            completedRules++;
            if (onProgress) {
              onProgress(completedRules, totalRules);
            }

            return { success: true, ruleData };
          } catch (error) {
            console.error('배치 저장 중 오류:', error, ruleData);
            return { success: false, error, ruleData };
          }
        });

        // 배치 완료 대기
        const batchResults = await Promise.all(batchPromises);
        const failedRules = batchResults.filter(result => !result.success);
        
        if (failedRules.length > 0) {
          console.warn(`배치 ${batchIndex + 1}에서 ${failedRules.length}개 규칙 저장 실패`);
        }

        console.log(`배치 ${batchIndex + 1}/${batches.length} 완료 (${completedRules}/${totalRules})`);
      }

      setSaveMessage(`${totalRules}개 가격 규칙이 성공적으로 저장되었습니다.`);
      setTimeout(() => setSaveMessage(''), 5000);
      
      await loadDynamicPricingData();
      
      if (onSave) {
        // 배치 저장 완료 콜백
        onSave({ type: 'batch_complete', count: totalRules });
      }
    } catch (error) {
      console.error('배치 저장 실패:', error);
      setSaveMessage('배치 저장에 실패했습니다.');
      throw error;
    } finally {
      setSaving(false);
    }
  }, [loadDynamicPricingData, onSave]);

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
    savePricingRulesBatch,
    deletePricingRule,
    setMessage
  };
}
