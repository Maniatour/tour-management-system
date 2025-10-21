import type { Database } from '@/lib/supabase'

export type Customer = Database['public']['Tables']['customers']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Channel = Database['public']['Tables']['channels']['Row']
export type ProductOption = Database['public']['Tables']['product_options']['Row']
export type ProductOptionChoice = Database['public']['Tables']['product_option_choices']['Row']
export type Option = Database['public']['Tables']['options']['Row']

export interface PickupHotel {
  id: string
  hotel: string
  pick_up_location: string
  description_ko: string | null
  description_en: string | null
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
  channelRN: string
  addedBy: string
  addedTime: string
  tourId: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  selectedOptions?: { [optionId: string]: string[] }
  selectedOptionPrices?: { [key: string]: number }
  isPrivateTour?: boolean
  pricingInfo?: PricingInfo
  hasExistingTour?: boolean // 투어 존재 여부
  
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
