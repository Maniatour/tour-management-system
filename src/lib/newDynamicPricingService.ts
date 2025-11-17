// 새로운 동적 가격 계산 서비스
import { supabase } from '@/lib/supabase';

export interface PricingCalculationResult {
  basePrice: number;
  choicesPrice: number;
  additionalOptionsPrice: number;
  totalPrice: number;
  calculationMethod: string;
}

export interface ChoicePricingData {
  [choiceId: string]: {
    adult: number;
    child: number;
    infant: number;
  };
}

export interface AdditionalOptionsPricingData {
  [optionId: string]: {
    adult: number;
    child: number;
    infant: number;
  };
}

export class NewDynamicPricingService {
  /**
   * 새로운 가격 계산 함수 사용
   */
  static async calculateDynamicPrice(
    productId: string,
    channelId: string,
    date: string,
    adults: number = 1,
    children: number = 0,
    infants: number = 0,
    selectedChoices: string[] = [],
    selectedAdditionalOptions: string[] = []
  ): Promise<PricingCalculationResult> {
    try {
      const { data, error } = await supabase.rpc('calculate_dynamic_price', {
        p_product_id: productId,
        p_channel_id: channelId,
        p_date: date,
        p_adults: adults,
        p_children: children,
        p_infants: infants,
        p_selected_choices: selectedChoices,
        p_selected_additional_options: selectedAdditionalOptions
      });

      if (error) {
        console.error('가격 계산 함수 호출 실패:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const result = data[0];
        return {
          basePrice: parseFloat(result.base_price) || 0,
          choicesPrice: parseFloat(result.choices_price) || 0,
          additionalOptionsPrice: parseFloat(result.additional_options_price) || 0,
          totalPrice: parseFloat(result.total_price) || 0,
          calculationMethod: result.calculation_method || 'additive'
        };
      }

      return {
        basePrice: 0,
        choicesPrice: 0,
        additionalOptionsPrice: 0,
        totalPrice: 0,
        calculationMethod: 'not_found'
      };
    } catch (error) {
      console.error('동적 가격 계산 실패:', error);
      throw error;
    }
  }

  /**
   * 초이스 가격 업데이트
   */
  static async updateChoicePricing(
    productId: string,
    channelId: string,
    date: string,
    choiceOptionId: string,
    adultPrice: number,
    childPrice: number,
    infantPrice: number
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('update_choice_pricing', {
        p_product_id: productId,
        p_channel_id: channelId,
        p_date: date,
        p_choice_option_id: choiceOptionId,
        p_adult_price: adultPrice,
        p_child_price: childPrice,
        p_infant_price: infantPrice
      });

      if (error) {
        console.error('초이스 가격 업데이트 실패:', error);
        throw error;
      }

      return data === true;
    } catch (error) {
      console.error('초이스 가격 업데이트 실패:', error);
      return false;
    }
  }

  /**
   * 동적 가격 정보 조회
   */
  static async getDynamicPricing(
    productId: string,
    channelId: string,
    date: string
  ): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('dynamic_pricing')
        .select('*')
        .eq('product_id', productId)
        .eq('channel_id', channelId)
        .eq('date', date)
        .single();

      if (error) {
        console.error('동적 가격 정보 조회 실패:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('동적 가격 정보 조회 실패:', error);
      return null;
    }
  }

  /**
   * 동적 가격 정보 저장/업데이트
   */
  static async saveDynamicPricing(pricingData: {
    product_id: string;
    channel_id: string;
    date: string;
    adult_price: number;
    child_price: number;
    infant_price: number;
    price_type?: 'dynamic' | 'base';
    choices_pricing?: ChoicePricingData;
    additional_options_pricing?: AdditionalOptionsPricingData;
    price_calculation_method?: string;
    commission_percent?: number;
    markup_amount?: number;
    coupon_percent?: number;
    is_sale_available?: boolean;
  }): Promise<boolean> {
    try {
      // price_type 기본값 설정
      const priceType = pricingData.price_type || 'dynamic';
      const upsertData = {
        ...pricingData,
        price_type: priceType
      };
      
      const { data, error } = await supabase
        .from('dynamic_pricing')
        .upsert(upsertData, {
          onConflict: 'product_id,channel_id,date,price_type'
        })
        .select()
        .single();

      if (error) {
        console.error('동적 가격 저장 실패:', error);
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('동적 가격 저장 실패:', error);
      return false;
    }
  }

  /**
   * 초이스별 가격 정보를 새로운 형식으로 변환
   */
  static convertChoicesPricingToNewFormat(oldFormat: any): ChoicePricingData {
    if (!oldFormat) return {};

    // 기존 형식: { combinations: { choiceId: { adult_price: 50, child_price: 30, infant_price: 20 } } }
    if (oldFormat.combinations) {
      const newFormat: ChoicePricingData = {};
      Object.entries(oldFormat.combinations).forEach(([choiceId, choiceData]: [string, any]) => {
        newFormat[choiceId] = {
          adult: choiceData.adult_price || choiceData.adult || 0,
          child: choiceData.child_price || choiceData.child || 0,
          infant: choiceData.infant_price || choiceData.infant || 0
        };
      });
      return newFormat;
    }

    // 이미 새로운 형식인 경우
    return oldFormat;
  }

  /**
   * 새로운 형식을 기존 형식으로 변환 (호환성 유지)
   */
  static convertChoicesPricingToOldFormat(newFormat: ChoicePricingData): any {
    if (!newFormat || Object.keys(newFormat).length === 0) {
      return { combinations: {} };
    }

    const oldFormat = { combinations: {} };
    Object.entries(newFormat).forEach(([choiceId, choiceData]) => {
      oldFormat.combinations[choiceId] = {
        adult_price: choiceData.adult,
        child_price: choiceData.child,
        infant_price: choiceData.infant
      };
    });

    return oldFormat;
  }
}
