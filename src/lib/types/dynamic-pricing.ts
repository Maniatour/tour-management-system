// 동적 가격 시스템을 위한 TypeScript 타입 정의

export interface DynamicPricingRule {
  id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  product_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  channel_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  rule_name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // 관계 데이터
  product?: Product;
  channel?: Channel;
  weekday_pricing?: WeekdayPricing[];
  required_option_pricing?: RequiredOptionPricing[];
}

export interface WeekdayPricing {
  id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  pricing_rule_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  day_of_week: number; // 0=일요일, 1=월요일, ..., 6=토요일
  adult_price: number;
  child_price: number;
  infant_price: number;
  is_active: boolean;
  created_at: string;
  
  // 관계 데이터
  pricing_rule?: DynamicPricingRule;
}

export interface RequiredOptionPricing {
  id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  pricing_rule_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  option_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  adult_price: number;
  child_price: number;
  infant_price: number;
  is_active: boolean;
  created_at: string;
  
  // 관계 데이터
  pricing_rule?: DynamicPricingRule;
  option?: ProductOption;
}

export interface ReservationPricing {
  id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  reservation_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  pricing_rule_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  
  // 기본 가격
  base_adult_price: number;
  base_child_price: number;
  base_infant_price: number;
  
  // 옵션 가격
  option_adult_price: number;
  option_child_price: number;
  option_infant_price: number;
  
  // 최종 가격
  total_adult_price: number;
  total_child_price: number;
  total_infant_price: number;
  
  // 할인 정보
  discount_amount: number;
  discount_reason?: string;
  
  created_at: string;
  
  // 관계 데이터
  reservation?: Reservation;
  pricing_rule?: DynamicPricingRule;
}

export interface PricingCalculationLog {
  id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  reservation_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  pricing_rule_id?: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  calculation_type: 'base_price' | 'option_price' | 'total_price';
  input_data: Record<string, unknown>;
  calculation_result: Record<string, unknown>;
  applied_rule?: Record<string, unknown>;
  created_at: string;
}

// 가격 계산 결과
export interface PriceCalculationResult {
  adult_price: number;
  child_price: number;
  infant_price: number;
  total_price: number;
  pricing_rule_id?: string;
  
  // 추가 정보
  applied_rule?: DynamicPricingRule;
  weekday_pricing?: WeekdayPricing;
  option_pricing?: RequiredOptionPricing[];
}

// 가격 규칙 생성/수정을 위한 DTO
export interface CreatePricingRuleDto {
  product_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  channel_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  rule_name: string;
  start_date: string;
  end_date: string;
  weekday_pricing: CreateWeekdayPricingDto[];
  required_option_pricing: CreateRequiredOptionPricingDto[];
}

export interface CreateWeekdayPricingDto {
  day_of_week: number;
  adult_price: number;
  child_price: number;
  infant_price: number;
}

export interface CreateRequiredOptionPricingDto {
  option_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  adult_price: number;
  child_price: number;
  infant_price: number;
}

// 가격 계산을 위한 DTO
export interface CalculatePriceDto {
  product_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  channel_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  tour_date: string;
  adults: number;
  children: number;
  infants: number;
  option_ids: string[]; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
}

// 요일별 가격 설정을 위한 DTO
export interface WeekdayPricingDto {
  day_of_week: number;
  day_name: string;
  adult_price: number;
  child_price: number;
  infant_price: number;
  is_active: boolean;
}

// 기존 타입들 (참조용)
export interface Product {
  id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  name: string;
  category: string;
  description?: string;
  duration?: string;
  base_price: number;
  min_participants: number;
  max_participants?: number;
  difficulty?: string;
  status: string;
  tags?: string[];
  created_at: string;
}

export interface Channel {
  id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  name: string;
  type: string;
  website?: string;
  commission: number;
  base_price: number;
  markup: number;
  status: string;
  description?: string;
  created_at: string;
}

export interface ProductOption {
  id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  name: string;
  category: string;
  description?: string;
  base_price: number;
  price_type: string;
  min_quantity: number;
  max_quantity?: number;
  status: string;
  tags?: string[];
  created_at: string;
}

export interface Reservation {
  id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  customer_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  product_id: string; // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  tour_date: string;
  tour_time?: string;
  pickup_hotel?: string;
  pickup_time?: string;
  adults: number;
  child: number;
  infant: number;
  total_people: number;
  channel: string;
  channel_rn?: string;
  added_by?: string;
  status: string;
  event_note?: string;
  created_at: string;
}

// 요일 이름 매핑
export const DAY_NAMES: Record<number, string> = {
  0: '일',
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토'
};

// 요일별 색상 (UI용)
export const DAY_COLORS: Record<number, string> = {
  0: 'text-red-600', // 일요일
  1: 'text-gray-600', // 월요일
  2: 'text-gray-600', // 화요일
  3: 'text-gray-600', // 수요일
  4: 'text-gray-600', // 목요일
  5: 'text-gray-600', // 금요일
  6: 'text-blue-600'  // 토요일
};
