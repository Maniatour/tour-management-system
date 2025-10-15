// 공급 업체 가격을 동적 가격에 반영하는 유틸리티 함수들

import { supabase } from '@/lib/supabase';

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  product_id: string | null;
  choice_id: string | null;
  choice_option_id: string | null;
  ticket_name: string;
  regular_price: number;
  supplier_price: number;
  markup_percent: number;
  markup_amount: number;
  season_price: number | null;
  is_active: boolean;
}

export interface DynamicPricingData {
  product_id: string;
  channel_id: string;
  date: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  choices_pricing?: any;
  markup_percent?: number;
  markup_amount?: number;
}

/**
 * 특정 상품과 선택 옵션에 대한 공급 업체 가격을 가져옵니다
 */
export async function getSupplierPrice(
  productId: string, 
  choiceId?: string, 
  choiceOptionId?: string
): Promise<SupplierProduct | null> {
  try {
    let query = supabase
      .from('supplier_products')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true);

    if (choiceId) {
      query = query.eq('choice_id', choiceId);
    }
    if (choiceOptionId) {
      query = query.eq('choice_option_id', choiceOptionId);
    }

    const { data, error } = await query.limit(1);

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('공급 업체 가격 조회 오류:', error);
    return null;
  }
}

/**
 * 공급 업체 가격을 기반으로 동적 가격을 계산합니다
 */
export function calculateSupplierBasedPricing(
  supplierProduct: SupplierProduct,
  basePrice: number = 0
): {
  supplierPrice: number;
  markupPrice: number;
  finalPrice: number;
} {
  const supplierPrice = supplierProduct.supplier_price;
  const markupAmount = supplierProduct.markup_amount || 0;
  const markupPercent = supplierProduct.markup_percent || 0;
  
  // 마크업 적용된 가격 계산
  const markupPrice = supplierPrice + markupAmount + (supplierPrice * markupPercent / 100);
  
  // 최종 가격 (공급가 + 마크업)
  const finalPrice = markupPrice;

  return {
    supplierPrice,
    markupPrice,
    finalPrice
  };
}

/**
 * 동적 가격 데이터에 공급 업체 가격을 반영합니다
 */
export async function applySupplierPricingToDynamicPricing(
  dynamicPricing: DynamicPricingData,
  productId: string,
  choices?: any
): Promise<DynamicPricingData> {
  try {
    const updatedPricing = { ...dynamicPricing };
    
    // 상품 자체에 대한 공급 업체 가격 확인
    const productSupplierPrice = await getSupplierPrice(productId);
    if (productSupplierPrice) {
      const pricing = calculateSupplierBasedPricing(productSupplierPrice, dynamicPricing.adult_price);
      
      // 기본 가격을 공급 업체 가격으로 업데이트
      updatedPricing.adult_price = pricing.finalPrice;
      updatedPricing.child_price = pricing.finalPrice; // 간단히 동일하게 적용
      updatedPricing.infant_price = pricing.finalPrice;
      
      // 마크업 정보를 동적 가격에 반영
      updatedPricing.markup_percent = productSupplierPrice.markup_percent;
      updatedPricing.markup_amount = productSupplierPrice.markup_amount;
    }

    // 선택 옵션별 공급 업체 가격 확인
    if (choices?.required && updatedPricing.choices_pricing) {
      for (const choice of choices.required) {
        for (const option of choice.options) {
          const choiceSupplierPrice = await getSupplierPrice(productId, choice.id, option.id);
          if (choiceSupplierPrice) {
            const pricing = calculateSupplierBasedPricing(choiceSupplierPrice, option.price);
            
            // choices_pricing 업데이트
            if (!updatedPricing.choices_pricing[choice.id]) {
              updatedPricing.choices_pricing[choice.id] = {};
            }
            
            updatedPricing.choices_pricing[choice.id][option.id] = {
              adult: pricing.finalPrice,
              child: pricing.finalPrice,
              infant: pricing.finalPrice,
              supplier_price: pricing.supplierPrice,
              markup_price: pricing.markupPrice,
              markup_percent: choiceSupplierPrice.markup_percent,
              markup_amount: choiceSupplierPrice.markup_amount
            };
          }
        }
      }
    }

    return updatedPricing;
  } catch (error) {
    console.error('공급 업체 가격 반영 오류:', error);
    return dynamicPricing;
  }
}

/**
 * 동적 가격 테이블에 공급 업체 가격을 반영하여 업데이트합니다
 */
export async function updateDynamicPricingWithSupplierPrices(
  productId: string,
  channelId: string,
  date: string
): Promise<boolean> {
  try {
    // 기존 동적 가격 데이터 조회
    const { data: existingPricing, error: fetchError } = await supabase
      .from('dynamic_pricing')
      .select('*')
      .eq('product_id', productId)
      .eq('channel_id', channelId)
      .eq('date', date)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // 상품 정보 조회
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('choices')
      .eq('id', productId)
      .single();

    if (productError) throw productError;

    let updatedPricing: DynamicPricingData;

    if (existingPricing) {
      // 기존 데이터가 있으면 공급 업체 가격 반영
      updatedPricing = await applySupplierPricingToDynamicPricing(
        existingPricing,
        productId,
        product.choices
      );
      
      // 업데이트
      const { error: updateError } = await supabase
        .from('dynamic_pricing')
        .update(updatedPricing)
        .eq('id', existingPricing.id);

      if (updateError) throw updateError;
    } else {
      // 새로운 동적 가격 데이터 생성
      const productSupplierPrice = await getSupplierPrice(productId);
      if (productSupplierPrice) {
        const pricing = calculateSupplierBasedPricing(productSupplierPrice);
        
        updatedPricing = {
          product_id: productId,
          channel_id: channelId,
          date,
          adult_price: pricing.finalPrice,
          child_price: pricing.finalPrice,
          infant_price: pricing.finalPrice,
          markup_percent: productSupplierPrice.markup_percent,
          markup_amount: productSupplierPrice.markup_amount,
          choices_pricing: {}
        };

        // 선택 옵션별 가격 설정
        if (product.choices?.required) {
          updatedPricing.choices_pricing = {};
          for (const choice of product.choices.required) {
            updatedPricing.choices_pricing[choice.id] = {};
            for (const option of choice.options) {
              const choiceSupplierPrice = await getSupplierPrice(productId, choice.id, option.id);
              if (choiceSupplierPrice) {
                const optionPricing = calculateSupplierBasedPricing(choiceSupplierPrice, option.price);
                updatedPricing.choices_pricing[choice.id][option.id] = {
                  adult: optionPricing.finalPrice,
                  child: optionPricing.finalPrice,
                  infant: optionPricing.finalPrice,
                  supplier_price: optionPricing.supplierPrice,
                  markup_price: optionPricing.markupPrice,
                  markup_percent: choiceSupplierPrice.markup_percent,
                  markup_amount: choiceSupplierPrice.markup_amount
                };
              }
            }
          }
        }

        // 새 데이터 삽입
        const { error: insertError } = await supabase
          .from('dynamic_pricing')
          .insert([updatedPricing]);

        if (insertError) throw insertError;
      }
    }

    return true;
  } catch (error) {
    console.error('동적 가격 업데이트 오류:', error);
    return false;
  }
}

/**
 * 모든 공급 업체 상품의 가격을 동적 가격에 반영합니다
 */
export async function syncAllSupplierPricesToDynamicPricing(): Promise<boolean> {
  try {
    // 모든 활성 공급 업체 상품 조회
    const { data: supplierProducts, error } = await supabase
      .from('supplier_products')
      .select('*')
      .eq('is_active', true)
      .not('product_id', 'is', null);

    if (error) throw error;

    // 각 공급 업체 상품에 대해 동적 가격 업데이트
    for (const supplierProduct of supplierProducts) {
      // 모든 채널과 날짜에 대해 업데이트 (실제로는 필요한 채널과 날짜만 선택해야 함)
      // 여기서는 예시로 현재 날짜부터 30일간 업데이트
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        // 모든 채널에 대해 업데이트 (실제로는 필요한 채널만 선택해야 함)
        const { data: channels } = await supabase
          .from('channels')
          .select('id');

        if (channels) {
          for (const channel of channels) {
            await updateDynamicPricingWithSupplierPrices(
              supplierProduct.product_id!,
              channel.id,
              dateString
            );
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error('전체 공급 업체 가격 동기화 오류:', error);
    return false;
  }
}
