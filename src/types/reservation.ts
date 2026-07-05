import type { Database } from '@/lib/supabase'
import type { PickupAccessClass } from '@/lib/pickupAccessClass'

export type Customer = Database['public']['Tables']['customers']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Channel = Database['public']['Tables']['channels']['Row']
export type ProductOption = Database['public']['Tables']['product_options']['Row']
/** product_option_choices 테이블은 product_options로 통합됨 */
export type ProductOptionChoice = ProductOption
/** 가격 계산에 필요한 옵션 선택 최소 필드 (목록 fetch 변환형 포함) */
export type OptionChoicePriceInput = Pick<
  ProductOption,
  'id' | 'adult_price_adjustment' | 'child_price_adjustment' | 'infant_price_adjustment'
>
export type Option = Database['public']['Tables']['options']['Row']

export interface PickupHotel {
  id: string
  hotel: string
  pick_up_location: string
  description_ko: string | null
  description_en: string | null
  from_inside_hotel_ko: string | null
  from_inside_hotel_en: string | null
  from_outside_hotel_ko: string | null
  from_outside_hotel_en: string | null
  allowed_pickup_access_classes: PickupAccessClass[] | null
  address: string
  pin: string | null
  link: string | null
  youtube_link: string | null
  media: string[] | null
  is_active: boolean | null
  group_number: number | null
  created_at: string | null
  updated_at: string | null
}

export interface PricingInfo {
  adultProductPrice: number
  childProductPrice: number
  infantProductPrice: number
  productPriceTotal: number
  not_included_price?: number
  requiredOptions: { [key: string]: unknown }
  requiredOptionTotal: number
  choices: { [key: string]: unknown }
  choicesTotal: number
  quantityBasedChoices: { [key: string]: unknown }
  quantityBasedChoiceTotal: number
  subtotal: number
  couponCode: string
  couponDiscount: number
  additionalDiscount: number
  additionalCost: number
  cardFee: number
  tax: number
  prepaymentCost: number
  prepaymentTip: number
  selectedOptionalOptions: { [key: string]: unknown }
  optionTotal: number
  totalPrice: number
  depositAmount: number
  balanceAmount: number
  isPrivateTour: boolean
  privateTourAdditionalCost: number
  commission_percent: number
}

export interface Reservation {
  id: string
  customerId: string
  productId: string
  tourDate: string
  tourTime: string
  eventNote: string
  pickUpHotel: string
  pickUpTime: string
  adults: number
  child: number
  infant: number
  totalPeople: number
  channelId: string
  /** 목록 쿼리 `channels(name)` embed 등으로 채운 표시용 이름(마스터 배열과 무관) */
  channelNameSnapshot?: string | null
  /** reservations.variant_key (동적가격·채널 상품 variant) */
  variantKey?: string
  channelRN: string
  addedBy: string
  addedTime: string
  tourId: string
  status: 'inquiry' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'deleted'
  /** DB updated_at (상태 변경 순 정렬 등에 사용) */
  updated_at?: string | null
  /** reservations.amount_audited — 채널 정산·예약 처리 필요 등에서 금액 더블체크 완료 여부 */
  amount_audited?: boolean
  amount_audited_at?: string | null
  amount_audited_by?: string | null
  selectedOptions?: { [optionId: string]: string[] }
  selectedOptionPrices?: { [key: string]: number }
  isPrivateTour?: boolean
  pricingInfo?: PricingInfo
  hasExistingTour?: boolean // 투어 존재 여부
  /** reservations.customer_communication_channel — 고객 소통 채널(간단 카드) */
  customerCommunicationChannel?: string | null
  
  // 가격 관련 속성들 (formData에서 사용)
  adultProductPrice?: number
  childProductPrice?: number
  infantProductPrice?: number
  productPriceTotal?: number
  requiredOptions?: { [key: string]: unknown }
  requiredOptionTotal?: number
  choices?: { [key: string]: unknown }
  choicesTotal?: number
  quantityBasedChoices?: { [key: string]: unknown }
  quantityBasedChoiceTotal?: number
  selectedChoices?: { [key: string]: { selected: string; timestamp: string } }
  choiceTotal?: number
  subtotal?: number
  couponCode?: string
  couponDiscount?: number
  additionalDiscount?: number
  additionalCost?: number
  cardFee?: number
  tax?: number
  prepaymentCost?: number
  prepaymentTip?: number
  selectedOptionalOptions?: { [key: string]: unknown }
  optionTotal?: number
  totalPrice?: number
  depositAmount?: number
  balanceAmount?: number
  privateTourAdditionalCost?: number
  commission_percent?: number
  onlinePaymentAmount?: number
  onSiteBalanceAmount?: number
}
