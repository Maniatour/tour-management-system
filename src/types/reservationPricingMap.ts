/** useReservationData `reservationPricingMap` 값 (reservation_pricing 행 요약) */
export interface ReservationPricingMapValue {
  id?: string
  total_price: number
  balance_amount: number
  adult_product_price?: number
  child_product_price?: number
  infant_product_price?: number
  product_price_total?: number
  required_option_total?: number
  subtotal?: number
  coupon_code?: string | null
  coupon_discount?: number
  additional_discount?: number
  additional_cost?: number
  card_fee?: number
  tax?: number
  prepayment_cost?: number
  prepayment_tip?: number
  option_total?: number
  choices_total?: number
  not_included_price?: number
  private_tour_additional_cost?: number
  commission_percent?: number
  commission_amount?: number
  commission_base_price?: number
  channel_settlement_amount?: number
  deposit_amount?: number
  currency?: string
}
