/**
 * 초이스 가격 청구 단위
 * - per_person: 인당 단가 × 인원 (기본)
 * - per_unit: 선택 단위(차량·대 등)당 고정가 × 수량 — 인원으로 곱하지 않음
 */
export type ChoicePricingUnit = 'per_person' | 'per_unit'

export function parseChoicePricingUnit(value: unknown): ChoicePricingUnit {
  return value === 'per_unit' ? 'per_unit' : 'per_person'
}

export function isPerUnitPricing(value: unknown): boolean {
  return parseChoicePricingUnit(value) === 'per_unit'
}

/**
 * 초이스 라인 합계
 * - per_person: (성인×성인가 + 아동×아동가 + 유아×유아가) × quantity
 * - per_unit: adult_price × quantity (차량/선택 단위 고정가; 단일가 상품은 adult=child=infant)
 */
export function calculateChoiceLineTotal(params: {
  pricingUnit: ChoicePricingUnit | string | null | undefined
  adultPrice: number
  childPrice?: number
  infantPrice?: number
  adults: number
  children: number
  infants: number
  /** 선택 수량(차량 대수 등). 기본 1 */
  quantity?: number
}): number {
  const qty = Math.max(0, Number(params.quantity) || 0)
  if (qty <= 0) return 0

  const adult = Number(params.adultPrice) || 0
  const child = Number(params.childPrice) || 0
  const infant = Number(params.infantPrice) || 0

  if (isPerUnitPricing(params.pricingUnit)) {
    return adult * qty
  }

  const adults = Math.max(0, Number(params.adults) || 0)
  const children = Math.max(0, Number(params.children) || 0)
  const infants = Math.max(0, Number(params.infants) || 0)
  const perPerson = adults * adult + children * child + infants * infant
  return perPerson * qty
}

/** BookingFlow 등 option_price(성인 단가)만 있을 때 */
export function calculateChoiceLineTotalFromUnitPrice(params: {
  pricingUnit: ChoicePricingUnit | string | null | undefined
  unitPrice: number
  totalParticipants: number
  quantity?: number
}): number {
  const qty = Math.max(0, Number(params.quantity) || 0)
  if (qty <= 0) return 0
  const unit = Number(params.unitPrice) || 0
  if (isPerUnitPricing(params.pricingUnit)) {
    return unit * qty
  }
  const people = Math.max(0, Number(params.totalParticipants) || 0)
  return unit * people * qty
}
