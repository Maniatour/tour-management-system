import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SimplePricingRule, SimplePricingRuleDto } from '@/lib/types/dynamic-pricing';
import { dualWriteDynamicPricingToV2 } from '@/lib/commerce/dualWritePricing';
import { toDbChoicePricingMode } from '@/lib/choicePricingMode';
import { useOperatorOptional } from '@/contexts/OperatorContext';
import { operatorIdInsert, resolveOperatorId } from '@/lib/operators/scopeQuery';

type ChoicesPricingRecord = NonNullable<SimplePricingRuleDto['choices_pricing']>

function parseChoicesPricingRecord(raw: unknown): ChoicesPricingRecord {
  if (raw == null) return {}
  let parsed: unknown = raw
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return {}
    }
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  return parsed as ChoicesPricingRecord
}

/** 초이스별 객체를 깊은 병합 (adult/child/infant, ota_sale_price 등 모든 필드 유지) */
function mergeChoicesPricingRecords(
  existingRaw: unknown,
  incomingRaw: unknown
): ChoicesPricingRecord {
  const existing = parseChoicesPricingRecord(existingRaw)
  const incoming = parseChoicesPricingRecord(incomingRaw)
  const merged: ChoicesPricingRecord = { ...existing }

  Object.entries(incoming).forEach(([choiceId, choiceData]) => {
    if (!choiceData || typeof choiceData !== 'object' || Array.isArray(choiceData)) return
    merged[choiceId] = {
      ...(merged[choiceId] || {}),
      ...choiceData,
    }
  })

  return merged
}

function formatSupabaseError(error: unknown): string {
  if (error == null) return 'unknown error'
  if (typeof error === 'string') return error
  if (error instanceof Error && error.message) return error.message
  const e = error as { message?: string; code?: string; details?: string; hint?: string }
  const parts = [e.message, e.code && `code=${e.code}`, e.details, e.hint].filter(Boolean)
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(error)
}

/** Best-effort dual-write with low concurrency (avoids flooding PostgREST during batch saves). */
async function dualWriteRulesSequentially(
  items: Array<{ rule: SimplePricingRuleDto; legacyRowId: string | null }>,
  operatorId: string,
  concurrency = 2
): Promise<void> {
  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++]
      if (!current) return
      await dualWriteDynamicPricingToV2({
        rule: current.rule,
        legacyRowId: current.legacyRowId,
        operatorId,
      })
    }
  })
  await Promise.all(workers)
}

function stripOtaSalePriceForBasePlusMode(
  choicesPricing: ChoicesPricingRecord | undefined,
  mode: 'absolute' | 'base_plus' | undefined
): ChoicesPricingRecord | undefined {
  if (!choicesPricing || mode !== 'base_plus') return choicesPricing
  const next: ChoicesPricingRecord = {}
  Object.entries(choicesPricing).forEach(([choiceId, choiceData]) => {
    if (!choiceData || typeof choiceData !== 'object' || Array.isArray(choiceData)) return
    const { ota_sale_price: _removed, ...rest } = choiceData as Record<string, unknown>
    next[choiceId] = rest as ChoicesPricingRecord[string]
  })
  return next
}

function mapDbPricingRowToSimpleRule(row: Record<string, unknown>, fallbackProductId: string): SimplePricingRule {
  const priceType = row.price_type === 'base' ? 'base' : 'dynamic'
  const calculationMethod =
    row.price_calculation_method === 'base_plus' ? 'base_plus' : 'absolute'
  return {
    id: String(row.id ?? ''),
    product_id: String(row.product_id ?? fallbackProductId),
    channel_id: String(row.channel_id ?? ''),
    date: String(row.date ?? ''),
    adult_price: Number(row.adult_price ?? 0),
    child_price: Number(row.child_price ?? 0),
    infant_price: Number(row.infant_price ?? 0),
    commission_percent: Number(row.commission_percent ?? 0),
    markup_amount: Number(row.markup_amount ?? 0),
    coupon_percent: Number(row.coupon_percent ?? 0),
    is_sale_available: row.is_sale_available !== false,
    ...(row.not_included_price != null ? { not_included_price: Number(row.not_included_price) } : {}),
    ...(row.markup_percent != null ? { markup_percent: Number(row.markup_percent) } : {}),
    price_type: priceType,
    price_calculation_method: calculationMethod,
    ...(row.variant_key != null ? { variant_key: String(row.variant_key) } : {}),
    ...(row.options_pricing != null && typeof row.options_pricing === 'object' && !Array.isArray(row.options_pricing)
      ? {
          options_pricing: row.options_pricing as Record<
            string,
            { adult_price: number; child_price: number; infant_price: number }
          >,
        }
      : {}),
    choices_pricing: parseChoicesPricingRecord(row.choices_pricing),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

interface UseDynamicPricingProps {
  productId: string;
  selectedChannelId?: string;
  selectedChannelType?: string;
  onSave?: (rule: SimplePricingRule | { type: 'batch_complete'; count: number }) => void;
}

export function useDynamicPricing({ productId, selectedChannelId, selectedChannelType, onSave }: UseDynamicPricingProps) {
  const { operatorId: activeOperatorId } = useOperatorOptional();
  const operatorId = resolveOperatorId(activeOperatorId);
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
        acc[normalizedDate].push(mapDbPricingRowToSimpleRule(rule as Record<string, unknown>, productId));
        return acc;
      }, {} as Record<string, SimplePricingRule[]>);

      const formattedData = Object.entries(groupedData).map(([date, rules]) => ({
        date, // 이미 정규화된 날짜
        rules
      }));
      
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
      
      // 먼저 기존 레코드가 있는지 확인 (variant_key만으로 확인, price_type 구분 없음)
      const { data: existingData, error: selectError } = await supabase
        .from('dynamic_pricing')
        .select('id, choices_pricing')
        .eq('product_id', ruleData.product_id)
        .eq('channel_id', ruleData.channel_id)
        .eq('date', ruleData.date)
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
          price_calculation_method: toDbChoicePricingMode(
            ruleData.price_calculation_method !== undefined
              ? ruleData.price_calculation_method
              : fullExistingData.price_calculation_method
          ),
          ...(ruleData.options_pricing !== undefined
            ? { options_pricing: ruleData.options_pricing }
            : fullExistingData.options_pricing != null
              ? { options_pricing: fullExistingData.options_pricing as SimplePricingRuleDto['options_pricing'] }
              : {}),
        };
        
        // choices_pricing이 있으면 기존 데이터와 초이스 단위로 깊은 병합
        if (ruleData.choices_pricing && Object.keys(ruleData.choices_pricing).length > 0) {
          updateData.choices_pricing = stripOtaSalePriceForBasePlusMode(
            mergeChoicesPricingRecords(
              fullExistingData.choices_pricing,
              ruleData.choices_pricing
            ),
            updateData.price_calculation_method
          )
        } else if (fullExistingData.choices_pricing) {
          updateData.choices_pricing = stripOtaSalePriceForBasePlusMode(
            parseChoicesPricingRecord(fullExistingData.choices_pricing),
            updateData.price_calculation_method
          )
        }
        
        const { data, error } = await supabase
          .from('dynamic_pricing')
          .update(updateData as never)
          .eq('id', existingData.id)
          .eq('operator_id', operatorId)
          .select()
          .maybeSingle();
        
        if (error) throw error;
        if (!data) throw new Error('업데이트 실패: 데이터가 반환되지 않았습니다.');
        result = data;
      } else {
        // 기존 레코드가 없으면 삽입
        // 필수 필드가 없으면 기본값 설정
        const insertData = {
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
          price_calculation_method: toDbChoicePricingMode(ruleData.price_calculation_method),
          ...(ruleData.options_pricing ? { options_pricing: ruleData.options_pricing } : {}),
          ...(ruleData.choices_pricing ? { choices_pricing: ruleData.choices_pricing } : {}),
        };
        
        const { data, error } = await supabase
          .from('dynamic_pricing')
          .insert({ ...insertData, ...operatorIdInsert(operatorId) } as never)
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

      // Phase 2: mirror into Commerce Core v2 (best-effort, never blocks legacy)
      const dualWriteChoices =
        (result?.choices_pricing as SimplePricingRuleDto['choices_pricing'])
          ?? ruleData.choices_pricing;
      const dualWriteOptions =
        (result?.options_pricing as SimplePricingRuleDto['options_pricing'])
          ?? ruleData.options_pricing;
      void dualWriteDynamicPricingToV2({
        rule: {
          ...ruleData,
          price_type: (result?.price_type as 'dynamic' | 'base' | undefined) || priceType,
          variant_key: (result?.variant_key as string | undefined) || variantKey,
          adult_price: Number(result?.adult_price ?? ruleData.adult_price ?? 0),
          child_price: Number(result?.child_price ?? ruleData.child_price ?? 0),
          infant_price: Number(result?.infant_price ?? ruleData.infant_price ?? 0),
          is_sale_available: result?.is_sale_available !== false,
          ...(dualWriteChoices != null ? { choices_pricing: dualWriteChoices } : {}),
          ...(dualWriteOptions != null ? { options_pricing: dualWriteOptions } : {}),
          price_calculation_method:
            (result?.price_calculation_method as 'absolute' | 'base_plus' | undefined)
            ?? ruleData.price_calculation_method
            ?? 'absolute',
        },
        legacyRowId: result?.id != null ? String(result.id) : null,
        operatorId,
      })
      
      await loadDynamicPricingData();
      
      if (onSave && result) {
        onSave(mapDbPricingRowToSimpleRule(result as Record<string, unknown>, ruleData.product_id));
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
  }, [productId, onSave, loadDynamicPricingData, operatorId]);

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
      const dualWriteQueue: Array<{ rule: SimplePricingRuleDto; legacyRowId: string | null }> = [];
      let totalFailed = 0;

      // choices_pricing 큰 페이로드 + dual-write 폭주 방지: 병렬도·배치 크기 완화
      const hasHeavyChoices = rulesData.some(
        (r) => r.choices_pricing && Object.keys(r.choices_pricing).length > 10
      );
      const batchSize = hasHeavyChoices ? 10 : 25;
      const batches = [];
      
      for (let i = 0; i < rulesData.length; i += batchSize) {
        batches.push(rulesData.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // 배치 내에서 병렬 처리 (레거시 SSOT만 — dual-write는 배치 후 저동시성)
        const batchPromises = batch.map(async (ruleData) => {
          try {
            // 기존 레코드 확인 (choices_pricing 포함)
            const variantKey = ruleData.variant_key || 'default';
            const { data: existingData, error: selectError } = await supabase
              .from('dynamic_pricing')
              .select('id, choices_pricing, price_type')
              .eq('product_id', ruleData.product_id)
              .eq('channel_id', ruleData.channel_id)
              .eq('date', ruleData.date)
              .eq('price_type', ruleData.price_type || 'dynamic') // price_type으로도 필터링
              .eq('variant_key', variantKey) // variant_key로도 필터링
              .maybeSingle();

            // select 실패 시 insert로 떨어지면 unique 충돌(23505)이 난다
            if (selectError) throw selectError;

            if (existingData) {
              // 기존 레코드가 있으면 부분 업데이트 수행 (savePricingRule과 동일한 로직)
              // 기존 레코드의 전체 정보 가져오기
              const { data: fullExistingData, error: fullDataError } = await supabase
                .from('dynamic_pricing')
                .select('*')
                .eq('id', existingData.id)
                .single();
              
              if (fullDataError || !fullExistingData) {
                throw fullDataError || new Error('기존 데이터 조회 실패');
              }
              
              // 업데이트할 데이터 준비: 전달된 필드만 업데이트, 나머지는 기존 값 유지
              const updateData: Partial<SimplePricingRuleDto> = {
                // 필수 필드는 항상 포함
                product_id: ruleData.product_id,
                channel_id: ruleData.channel_id,
                date: ruleData.date,
                price_type: (ruleData.price_type !== undefined ? ruleData.price_type : (fullExistingData.price_type || 'dynamic')) as 'base' | 'dynamic',
                variant_key: ruleData.variant_key !== undefined ? ruleData.variant_key : (fullExistingData.variant_key || 'default'), // variant_key 필드 추가
                
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
                price_calculation_method: toDbChoicePricingMode(
                  ruleData.price_calculation_method !== undefined
                    ? ruleData.price_calculation_method
                    : fullExistingData.price_calculation_method
                ),
                ...(ruleData.options_pricing !== undefined
                  ? { options_pricing: ruleData.options_pricing }
                  : fullExistingData.options_pricing != null
                    ? { options_pricing: fullExistingData.options_pricing as SimplePricingRuleDto['options_pricing'] }
                    : {}),
              };
              
              // choices_pricing이 있으면 기존 데이터와 초이스 단위로 깊은 병합
              // (adult/child/infant, ota_sale_price, not_included_* 등 모든 필드 유지)
              if (ruleData.choices_pricing && Object.keys(ruleData.choices_pricing).length > 0) {
                updateData.choices_pricing = stripOtaSalePriceForBasePlusMode(
                  mergeChoicesPricingRecords(
                    fullExistingData.choices_pricing,
                    ruleData.choices_pricing
                  ),
                  updateData.price_calculation_method
                )
              } else if (fullExistingData.choices_pricing) {
                updateData.choices_pricing = stripOtaSalePriceForBasePlusMode(
                  parseChoicesPricingRecord(fullExistingData.choices_pricing),
                  updateData.price_calculation_method
                )
              }
              
              // 업데이트
              const { error } = await supabase
                .from('dynamic_pricing')
                .update(updateData as never)
                .eq('id', existingData.id)
                .eq('operator_id', operatorId);
              
              if (error) throw error;

              return {
                success: true as const,
                ruleData,
                dualWrite: {
                  rule: { ...ruleData, ...updateData } as SimplePricingRuleDto,
                  legacyRowId: String(existingData.id),
                },
              };
            }

            // 삽입 (필수 필드가 없으면 기본값 설정)
            const insertData = {
              product_id: ruleData.product_id,
              channel_id: ruleData.channel_id,
              date: ruleData.date,
              price_type: ruleData.price_type === 'base' ? 'base' as const : 'dynamic' as const,
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
              price_calculation_method: toDbChoicePricingMode(ruleData.price_calculation_method),
              ...(ruleData.options_pricing ? { options_pricing: ruleData.options_pricing } : {}),
              ...(ruleData.choices_pricing ? { choices_pricing: ruleData.choices_pricing } : {}),
            };
            
            const { data: inserted, error } = await supabase
              .from('dynamic_pricing')
              .insert({ ...insertData, ...operatorIdInsert(operatorId) } as never)
              .select('id')
              .maybeSingle();
            
            if (error) throw error;

            return {
              success: true as const,
              ruleData,
              dualWrite: {
                rule: insertData as SimplePricingRuleDto,
                legacyRowId: inserted?.id != null ? String(inserted.id) : null,
              },
            };
          } catch (error) {
            console.error(
              '배치 저장 중 오류:',
              formatSupabaseError(error),
              {
                date: ruleData.date,
                channel_id: ruleData.channel_id,
                product_id: ruleData.product_id,
                variant_key: ruleData.variant_key,
              }
            );
            return { success: false as const, error, ruleData };
          }
        });

        // 배치 완료 대기
        const batchResults = await Promise.all(batchPromises);
        const failedRules = batchResults.filter((result) => !result.success);
        totalFailed += failedRules.length;

        for (const result of batchResults) {
          if (!result.success) continue;
          completedRules++;
          if (result.dualWrite) dualWriteQueue.push(result.dualWrite);
          if (onProgress) onProgress(completedRules, totalRules);
        }
        
        if (failedRules.length > 0) {
          const sample = failedRules[0] && 'error' in failedRules[0]
            ? formatSupabaseError(failedRules[0].error)
            : '';
          console.warn(
            `배치 ${batchIndex + 1}에서 ${failedRules.length}개 규칙 저장 실패`,
            sample
          );
        }

      }

      // 레거시 저장 성공분만 v2로 미러 (저동시성 — 배치 중 PostgREST 폭주 방지)
      if (dualWriteQueue.length > 0) {
        void dualWriteRulesSequentially(dualWriteQueue, operatorId, 2);
      }

      if (totalFailed > 0) {
        const partialMsg = `${completedRules}개 저장, ${totalFailed}개 실패. 실패한 날짜를 다시 저장해 주세요.`;
        setSaveMessage(partialMsg);
        setTimeout(() => setSaveMessage(''), 8000);
        await loadDynamicPricingData();
        throw new Error(
          `배치 저장 부분 실패: ${totalFailed}/${totalRules} (성공 ${completedRules})`
        );
      }

      setSaveMessage(`${totalRules}개 가격 규칙이 성공적으로 저장되었습니다.`);
      setTimeout(() => setSaveMessage(''), 5000);
      
      await loadDynamicPricingData();
      
      if (onSave) {
        // 배치 저장 완료 콜백
        onSave({ type: 'batch_complete', count: totalRules });
      }
    } catch (error) {
      console.error('배치 저장 실패:', formatSupabaseError(error));
      if (!String((error as Error)?.message || '').includes('배치 저장 부분 실패')) {
        setSaveMessage('배치 저장에 실패했습니다.');
      }
      throw error;
    } finally {
      setSaving(false);
    }
  }, [loadDynamicPricingData, onSave, operatorId]);

  const deletePricingRule = useCallback(async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('dynamic_pricing')
        .delete()
        .eq('id', ruleId)
        .eq('operator_id', operatorId);

      if (error) throw error;

      await loadDynamicPricingData();
    } catch (error) {
      console.error('가격 규칙 삭제 실패:', error);
    }
  }, [loadDynamicPricingData, operatorId]);

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
