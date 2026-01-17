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

      // variant_key는 필터링하지 않음 (모든 variant 표시)
      // 필요시 variant_key로 필터링하려면 파라미터 추가 필요

      const { data, error } = await query.order('date', { ascending: true });

      if (error) {
        console.error('동적 가격 데이터 로드 실패:', error);
        // 에러가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록 함
        setDynamicPricingData([]);
        return;
      }

      // 디버깅: 로드된 데이터 확인
      const byPriceType = data?.reduce((acc, rule) => {
        const priceType = rule.price_type || 'dynamic';
        acc[priceType] = (acc[priceType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      console.log('로드된 동적 가격 데이터:', {
        totalCount: data?.length || 0,
        byPriceType,
        baseCount: byPriceType.base || 0,
        dynamicCount: byPriceType.dynamic || 0,
        sampleRules: data?.slice(0, 10).map(r => ({
          id: r.id,
          date: r.date,
          channel_id: r.channel_id,
          price_type: r.price_type,
          hasPriceType: !!r.price_type,
          choicesCount: r.choices_pricing ? Object.keys(typeof r.choices_pricing === 'string' ? JSON.parse(r.choices_pricing) : r.choices_pricing).length : 0
        })) || []
      });
      
      // base 타입이 없으면 경고
      if (byPriceType.base === 0 && data && data.length > 0) {
        console.warn('⚠️ base 타입 레코드가 없습니다. 모든 레코드:', data.map(r => ({
          id: r.id,
          date: r.date,
          price_type: r.price_type,
          channel_id: r.channel_id
        })));
      }

      // 날짜별로 그룹화 (날짜 정규화 포함)
      // 시간대 문제를 방지하기 위해 문자열 파싱을 우선 사용
      const normalizeDate = (dateStr: string): string => {
        if (!dateStr) return '';
        const str = String(dateStr).trim();
        const dateOnly = str.split('T')[0].split(' ')[0];
        
        // 이미 YYYY-MM-DD 형식인지 확인 (시간대 문제 없이 그대로 반환)
        if (dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return dateOnly;
        }
        
        // YYYY-MM-DD 형식이 아닌 경우, 문자열에서 직접 추출 시도
        const dateMatch = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (dateMatch) {
          const year = dateMatch[1];
          const month = String(parseInt(dateMatch[2], 10)).padStart(2, '0');
          const day = String(parseInt(dateMatch[3], 10)).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        // Date 객체로 변환 후 다시 문자열로 (마지막 수단)
        // 시간대 문제를 방지하기 위해 로컬 시간대에서 날짜 부분만 추출
        try {
          // YYYY-MM-DD 형식의 문자열을 직접 파싱하여 시간대 문제 방지
          if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
            // 이미 YYYY-MM-DD 형식이면 그대로 반환 (위에서 처리되어야 하지만 안전장치)
            return str.split('T')[0].split(' ')[0];
          }
          
          const date = new Date(str);
          if (isNaN(date.getTime())) return str;
          // 로컬 시간대에서 날짜 부분만 추출 (시간대 변환 없이)
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        } catch (e) {
          return str;
        }
      };

      const groupedData = data.reduce((acc, rule) => {
        // 날짜 정규화하여 그룹화
        const normalizedDate = normalizeDate(rule.date);
        if (!acc[normalizedDate]) {
          acc[normalizedDate] = [];
        }
        acc[normalizedDate].push(rule);
        return acc;
      }, {} as Record<string, SimplePricingRule[]>);

      // 디버깅: 그룹화된 데이터 확인
      Object.entries(groupedData).forEach(([date, rules]) => {
        if (rules.length > 1) {
          console.log(`날짜 ${date}의 규칙들:`, {
            count: rules.length,
            rules: rules.map(r => ({
              id: r.id,
              price_type: r.price_type,
              channel_id: r.channel_id,
              choicesCount: r.choices_pricing ? Object.keys(typeof r.choices_pricing === 'string' ? JSON.parse(r.choices_pricing) : r.choices_pricing).length : 0
            }))
          });
        }
      });

      const formattedData = Object.entries(groupedData).map(([date, rules]) => ({
        date, // 이미 정규화된 날짜
        rules
      }));
      
      // 1일 데이터 확인
      const firstDayData = data.filter(d => {
        const dateStr = String(d.date);
        return dateStr.includes('-01') || dateStr.endsWith('-01');
      });
      
      // 2025-12-01 데이터 확인
      const dec01Data = data.filter(d => {
        const dateStr = String(d.date);
        return dateStr.includes('2025-12-01') || dateStr === '2025-12-01';
      });
      
      // 정규화된 날짜로 2025-12-01 확인
      const normalizedDec01Data = formattedData.filter(d => {
        const normalized = normalizeDate(d.date);
        return normalized === '2025-12-01';
      });
      
      console.log('로드된 동적 가격 데이터:', {
        selectedChannelId,
        selectedChannelType,
        dataCount: data.length,
        formattedDataCount: formattedData.length,
        firstDayDataCount: firstDayData.length,
        firstDayDates: firstDayData.map(d => ({ date: d.date, normalized: normalizeDate(d.date), channel_id: d.channel_id })).slice(0, 10),
        dec01DataCount: dec01Data.length,
        dec01Data: dec01Data.map(d => ({ date: d.date, normalized: normalizeDate(d.date), channel_id: d.channel_id })),
        normalizedDec01DataCount: normalizedDec01Data.length,
        normalizedDec01Data: normalizedDec01Data.map(d => ({ date: d.date, normalized: normalizeDate(d.date), rulesCount: d.rules.length })),
        allDates: formattedData.map(d => ({ original: d.date, normalized: normalizeDate(d.date) })).slice(0, 30),
        has2025_12_01: formattedData.some(d => normalizeDate(d.date) === '2025-12-01'),
        sampleData: data.slice(0, 10).map(d => ({ date: d.date, normalized: normalizeDate(d.date), channel_id: d.channel_id }))
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
      // price_type 기본값 설정 (없으면 'dynamic')
      const priceType = ruleData.price_type || 'dynamic';
      
      // variant_key 기본값 설정
      const variantKey = ruleData.variant_key || 'default';
      
      // 먼저 기존 레코드가 있는지 확인 (choices_pricing 포함, price_type, variant_key 포함)
      const { data: existingData, error: selectError } = await supabase
        .from('dynamic_pricing')
        .select('id, choices_pricing')
        .eq('product_id', ruleData.product_id)
        .eq('channel_id', ruleData.channel_id)
        .eq('date', ruleData.date)
        .eq('price_type', priceType)
        .eq('variant_key', variantKey)
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
          price_type: ruleData.price_type !== undefined ? ruleData.price_type : priceType, // ruleData의 price_type 우선 사용
          variant_key: ruleData.variant_key !== undefined ? ruleData.variant_key : variantKey, // variant_key 포함
          
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
          price_adjustment_adult: ruleData.price_adjustment_adult !== undefined ? ruleData.price_adjustment_adult : (fullExistingData.price_adjustment_adult ?? 0),
          price_adjustment_child: ruleData.price_adjustment_child !== undefined ? ruleData.price_adjustment_child : (fullExistingData.price_adjustment_child ?? 0),
          price_adjustment_infant: ruleData.price_adjustment_infant !== undefined ? ruleData.price_adjustment_infant : (fullExistingData.price_adjustment_infant ?? 0),
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
          price_type: priceType,
          variant_key: variantKey,
          adult_price: ruleData.adult_price !== undefined ? ruleData.adult_price : 0,
          child_price: ruleData.child_price !== undefined ? ruleData.child_price : 0,
          infant_price: ruleData.infant_price !== undefined ? ruleData.infant_price : 0,
          commission_percent: ruleData.commission_percent !== undefined ? ruleData.commission_percent : 0,
          markup_amount: ruleData.markup_amount !== undefined ? ruleData.markup_amount : 0,
          coupon_percent: ruleData.coupon_percent !== undefined ? ruleData.coupon_percent : 0,
          is_sale_available: ruleData.is_sale_available !== undefined ? ruleData.is_sale_available : true,
          not_included_price: ruleData.not_included_price ?? 0,
          markup_percent: ruleData.markup_percent ?? 0,
          price_adjustment_adult: ruleData.price_adjustment_adult ?? 0,
          price_adjustment_child: ruleData.price_adjustment_child ?? 0,
          price_adjustment_infant: ruleData.price_adjustment_infant ?? 0,
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
            // 기존 레코드 확인 (choices_pricing 포함)
            const { data: existingData, error: selectError } = await supabase
              .from('dynamic_pricing')
              .select('id, choices_pricing, price_type')
              .eq('product_id', ruleData.product_id)
              .eq('channel_id', ruleData.channel_id)
              .eq('date', ruleData.date)
              .eq('price_type', ruleData.price_type || 'dynamic') // price_type으로도 필터링
              .maybeSingle();

            if (existingData && !selectError) {
              // 기존 레코드가 있으면 부분 업데이트 수행 (savePricingRule과 동일한 로직)
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
                price_type: ruleData.price_type !== undefined ? ruleData.price_type : (fullExistingData.price_type || 'dynamic'), // price_type 필드 추가
                
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
                price_adjustment_adult: ruleData.price_adjustment_adult !== undefined ? ruleData.price_adjustment_adult : (fullExistingData.price_adjustment_adult ?? 0),
                price_adjustment_child: ruleData.price_adjustment_child !== undefined ? ruleData.price_adjustment_child : (fullExistingData.price_adjustment_child ?? 0),
                price_adjustment_infant: ruleData.price_adjustment_infant !== undefined ? ruleData.price_adjustment_infant : (fullExistingData.price_adjustment_infant ?? 0),
              };
              
              // choices_pricing이 있으면 기존 데이터와 병합 (깊은 병합)
              if (ruleData.choices_pricing && Object.keys(ruleData.choices_pricing).length > 0) {
                const existingChoicesPricing = fullExistingData.choices_pricing || {};
                let existingParsed: Record<string, any> = {};
                
                // 기존 choices_pricing 파싱
                if (existingChoicesPricing) {
                  try {
                    existingParsed = typeof existingChoicesPricing === 'string'
                      ? JSON.parse(existingChoicesPricing)
                      : existingChoicesPricing;
                  } catch (e) {
                    console.warn('기존 choices_pricing 파싱 오류:', e);
                    existingParsed = {};
                  }
                }
                
                // 새로운 choices_pricing 파싱
                let newParsed: Record<string, any> = {};
                try {
                  newParsed = typeof ruleData.choices_pricing === 'string'
                    ? JSON.parse(ruleData.choices_pricing)
                    : ruleData.choices_pricing;
                } catch (e) {
                  console.warn('새로운 choices_pricing 파싱 오류:', e);
                  newParsed = ruleData.choices_pricing as Record<string, any>;
                }
                
                // 각 초이스별로 깊은 병합 (not_included_price, ota_sale_price 등 보존)
                const mergedChoicesPricing: Record<string, any> = { ...existingParsed };
                Object.entries(newParsed).forEach(([choiceId, newChoiceData]) => {
                  if (existingParsed[choiceId]) {
                    // 기존 초이스가 있으면 깊은 병합
                    mergedChoicesPricing[choiceId] = {
                      ...existingParsed[choiceId],
                      ...newChoiceData
                    };
                  } else {
                    // 새로운 초이스는 그대로 추가
                    mergedChoicesPricing[choiceId] = newChoiceData;
                  }
                });
                
                updateData.choices_pricing = mergedChoicesPricing;
              } else if (fullExistingData.choices_pricing) {
                // choices_pricing이 전달되지 않았으면 기존 값 유지
                updateData.choices_pricing = fullExistingData.choices_pricing;
              }
              
              // 업데이트
              const { error } = await supabase
                .from('dynamic_pricing')
                .update(updateData)
                .eq('id', existingData.id);
              
              if (error) throw error;
            } else {
              // 삽입 (필수 필드가 없으면 기본값 설정)
              const variantKey = ruleData.variant_key || 'default';
              const insertData: SimplePricingRuleDto = {
                product_id: ruleData.product_id,
                channel_id: ruleData.channel_id,
                date: ruleData.date,
                price_type: ruleData.price_type || 'dynamic', // price_type 필드 추가
                variant_key: variantKey, // variant_key 추가
                adult_price: ruleData.adult_price !== undefined ? ruleData.adult_price : 0,
                child_price: ruleData.child_price !== undefined ? ruleData.child_price : 0,
                infant_price: ruleData.infant_price !== undefined ? ruleData.infant_price : 0,
                commission_percent: ruleData.commission_percent !== undefined ? ruleData.commission_percent : 0,
                markup_amount: ruleData.markup_amount !== undefined ? ruleData.markup_amount : 0,
                coupon_percent: ruleData.coupon_percent !== undefined ? ruleData.coupon_percent : 0,
                is_sale_available: ruleData.is_sale_available !== undefined ? ruleData.is_sale_available : true,
                not_included_price: ruleData.not_included_price ?? 0,
                markup_percent: ruleData.markup_percent ?? 0,
                price_adjustment_adult: ruleData.price_adjustment_adult ?? 0,
                price_adjustment_child: ruleData.price_adjustment_child ?? 0,
                price_adjustment_infant: ruleData.price_adjustment_infant ?? 0,
                choices_pricing: ruleData.choices_pricing
              };
              
              const { error } = await supabase
                .from('dynamic_pricing')
                .insert(insertData);
              
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

  const deletePricingRulesByDates = useCallback(async (
    dates: string[],
    channelId?: string,
    channelType?: string
  ) => {
    try {
      setSaving(true);
      
      let query = supabase
        .from('dynamic_pricing')
        .delete()
        .eq('product_id', productId)
        .in('date', dates);

      // 채널 필터링
      if (channelId) {
        query = query.eq('channel_id', channelId);
      } else if (channelType === 'SELF') {
        query = query.like('channel_id', 'B%');
      } else if (channelType === 'OTA') {
        // OTA 채널은 B로 시작하지 않는 채널들
        query = query.not('channel_id', 'like', 'B%');
      }

      const { error } = await query;

      if (error) throw error;

      setSaveMessage(`${dates.length}개 날짜의 가격 규칙이 삭제되었습니다.`);
      setTimeout(() => setSaveMessage(''), 3000);

      await loadDynamicPricingData();
    } catch (error) {
      console.error('가격 규칙 삭제 실패:', error);
      setSaveMessage('가격 규칙 삭제에 실패했습니다.');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  }, [productId, loadDynamicPricingData]);

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
    deletePricingRulesByDates,
    setMessage
  };
}
