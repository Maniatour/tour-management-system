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

interface SelectedChoice {
  choice_id: string;
  option_id: string;
  option_key: string;
  option_name_ko: string;
  quantity: number;
  total_price: number;
}

interface ReservationData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  adults: number;
  children: number;
  infants: number;
  productId: string;
  tourDate: string;
  channelId: string;
  notes: string;
  selectedChoices: SelectedChoice[];
  totalPeople: number;
  choicesTotal: number;
}

interface PricingInfo {
  basePrice: number;
  choicesTotal: number;
  optionsTotal: number;
  discountTotal: number;
  finalTotal: number;
  channelMultiplier?: number;
  dateMultiplier?: number;
  dynamicPricing?: {
    adult_price: number;
    child_price: number;
    infant_price: number;
  };
}

// 새로운 간결한 초이스 시스템을 사용한 가격 계산 서비스
export class SimplePricingService {
  // 상품의 초이스 정보 가져오기
  static async getProductChoices(productId: string): Promise<ProductChoice[]> {
    try {
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
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Choices 로드 오류:', error);
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('상품 초이스 로드 오류:', error);
      return [];
    }
  }

  // 동적 가격 정보 가져오기
  static async getDynamicPricing(
    productId: string, 
    channelId: string, 
    tourDate: string
  ): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('dynamic_pricing')
        .select('*')
        .eq('product_id', productId)
        .eq('channel_id', channelId)
        .eq('date', tourDate)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116은 "no rows" 오류
      return data;
    } catch (error) {
      console.error('동적 가격 로드 오류:', error);
      return null;
    }
  }

  // 상품 기본 가격 가져오기
  static async getProductBasePrice(productId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('base_price')
        .eq('id', productId)
        .single();

      if (error) throw error;
      return data?.base_price || 0;
    } catch (error) {
      console.error('상품 기본 가격 로드 오류:', error);
      return 0;
    }
  }

  // 선택된 초이스의 가격 계산
  static calculateChoicesPrice(
    selectedChoices: SelectedChoice[],
    adults: number,
    children: number,
    infants: number
  ): number {
    return selectedChoices.reduce((total, choice) => {
      // 각 초이스의 가격을 참가자 수에 따라 계산
      const adultPrice = choice.total_price * adults;
      const childPrice = (choice.total_price * 0.7) * children; // 아동 70% 할인
      const infantPrice = (choice.total_price * 0.3) * infants; // 유아 30% 할인
      
      return total + adultPrice + childPrice + infantPrice;
    }, 0);
  }

  // 최종 가격 계산
  static async calculateFinalPrice(
    productId: string,
    channelId: string,
    tourDate: string,
    selectedChoices: SelectedChoice[],
    adults: number,
    children: number,
    infants: number,
    optionsTotal: number = 0,
    discountTotal: number = 0
  ): Promise<PricingInfo> {
    try {
      // 기본 가격
      const basePrice = await this.getProductBasePrice(productId);
      
      // 동적 가격 정보
      const dynamicPricing = await this.getDynamicPricing(productId, channelId, tourDate);
      
      // 초이스 가격 계산
      const choicesTotal = this.calculateChoicesPrice(selectedChoices, adults, children, infants);
      
      // 동적 가격 적용
      let finalChoicesTotal = choicesTotal;
      let channelMultiplier = 1;
      let dateMultiplier = 1;
      
      if (dynamicPricing) {
        // 채널별 가격 배수
        if (dynamicPricing.channel_multiplier) {
          channelMultiplier = dynamicPricing.channel_multiplier;
          finalChoicesTotal *= channelMultiplier;
        }
        
        // 날짜별 가격 배수
        if (dynamicPricing.date_multiplier) {
          dateMultiplier = dynamicPricing.date_multiplier;
          finalChoicesTotal *= dateMultiplier;
        }
        
        // 직접 가격 설정이 있는 경우
        if (dynamicPricing.adult_price !== undefined) {
          finalChoicesTotal = (dynamicPricing.adult_price * adults) + 
                            (dynamicPricing.child_price * children) + 
                            (dynamicPricing.infant_price * infants);
        }
      }
      
      // 최종 총액 계산
      const finalTotal = basePrice + finalChoicesTotal + optionsTotal - discountTotal;
      
      return {
        basePrice,
        choicesTotal: finalChoicesTotal,
        optionsTotal,
        discountTotal,
        finalTotal,
        channelMultiplier,
        dateMultiplier,
        dynamicPricing: dynamicPricing ? {
          adult_price: dynamicPricing.adult_price,
          child_price: dynamicPricing.child_price,
          infant_price: dynamicPricing.infant_price
        } : undefined
      };
    } catch (error) {
      console.error('가격 계산 오류:', error);
      return {
        basePrice: 0,
        choicesTotal: 0,
        optionsTotal: 0,
        discountTotal: 0,
        finalTotal: 0
      };
    }
  }

  // 예약의 초이스 정보 가져오기
  static async getReservationChoices(reservationId: string): Promise<SelectedChoice[]> {
    try {
      const { data, error } = await supabase
        .from('reservation_choices')
        .select(`
          choice_id,
          option_id,
          quantity,
          total_price,
          choice_options!inner (
            option_key,
            option_name_ko
          )
        `)
        .eq('reservation_id', reservationId);

      if (error) throw error;

      return (data || []).map(choice => ({
        choice_id: choice.choice_id,
        option_id: choice.option_id,
        option_key: choice.choice_options.option_key,
        option_name_ko: choice.choice_options.option_name_ko,
        quantity: choice.quantity,
        total_price: choice.total_price
      }));
    } catch (error) {
      console.error('예약 초이스 로드 오류:', error);
      return [];
    }
  }

  // 예약과 함께 초이스 정보 가져오기
  static async getReservationWithChoices(reservationId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          reservation_choices (
            choice_id,
            option_id,
            quantity,
            total_price,
            choice_options!inner (
              option_key,
              option_name_ko
            )
          )
        `)
        .eq('id', reservationId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('예약 및 초이스 로드 오류:', error);
      return null;
    }
  }
}

// 예약 저장 함수 (새로운 시스템 사용)
export async function saveReservation(data: ReservationData, reservationId?: string) {
  try {
    // 1. 예약 기본 정보 저장/업데이트
    const reservationData = {
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      adults: data.adults,
      children: data.children,
      infants: data.infants,
      product_id: data.productId,
      tour_date: data.tourDate,
      channel_id: data.channelId,
      notes: data.notes,
      status: 'pending',
      total_people: data.totalPeople,
      choices_total: data.choicesTotal,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let reservationResult;
    if (reservationId) {
      // 기존 예약 업데이트
      const { data: updatedReservation, error: updateError } = await supabase
        .from('reservations')
        .update(reservationData)
        .eq('id', reservationId)
        .select()
        .single();

      if (updateError) throw updateError;
      reservationResult = updatedReservation;
    } else {
      // 새 예약 생성
      const { data: newReservation, error: createError } = await supabase
        .from('reservations')
        .insert(reservationData)
        .select()
        .single();

      if (createError) throw createError;
      reservationResult = newReservation;
    }

    // 2. 초이스 정보 저장
    if (reservationResult && data.selectedChoices.length > 0) {
      // 기존 초이스 삭제 (업데이트인 경우)
      if (reservationId) {
        await supabase
          .from('reservation_choices')
          .delete()
          .eq('reservation_id', reservationId);
      }

      // 새로운 초이스 저장
      const choicesToInsert = data.selectedChoices.map(choice => ({
        reservation_id: reservationResult.id,
        choice_id: choice.choice_id,
        option_id: choice.option_id,
        quantity: choice.quantity,
        total_price: choice.total_price
      }));

      const { error: choicesError } = await supabase
        .from('reservation_choices')
        .insert(choicesToInsert);

      if (choicesError) throw choicesError;
    }

    return reservationResult;
  } catch (error) {
    console.error('예약 저장 오류:', error);
    throw error;
  }
}

// 예약 조회 함수 (새로운 시스템 사용)
export async function getReservationWithChoices(reservationId: string) {
  return await SimplePricingService.getReservationWithChoices(reservationId);
}

// 가격 계산 함수 (새로운 시스템 사용)
export async function calculateReservationPrice(
  productId: string,
  channelId: string,
  tourDate: string,
  selectedChoices: SelectedChoice[],
  adults: number,
  children: number,
  infants: number,
  optionsTotal: number = 0,
  discountTotal: number = 0
) {
  return await SimplePricingService.calculateFinalPrice(
    productId,
    channelId,
    tourDate,
    selectedChoices,
    adults,
    children,
    infants,
    optionsTotal,
    discountTotal
  );
}
