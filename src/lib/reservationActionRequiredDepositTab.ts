import type { Reservation } from '@/types/reservation'

export type DepositTabProductRef = {
  id: string
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  sub_category?: string | null
  product_code?: string | null
}

export function isManiaTourOrServiceSubCategory(subCategory: string | null | undefined): boolean {
  const sub = String(subCategory ?? '').trim()
  return sub === 'Mania Tour' || sub === 'Mania Service'
}

/**
 * 입금 탭에서 「확정·입금 없음」으로 잡지 않는 상품.
 * 공항 픽업 8주년 이벤트 등 무료 진행 투어.
 */
export function productExemptFromDepositRequirement(
  product: DepositTabProductRef | null | undefined
): boolean {
  if (!product) return false
  const labels = [product.name, product.name_ko, product.name_en, product.product_code]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
  for (const label of labels) {
    if (label.includes('8주년') && label.includes('공항 픽업')) return true
    const low = label.toLowerCase()
    if (low.includes('8th') && low.includes('anniversary') && low.includes('pickup')) return true
  }
  return false
}

export function reservationExemptFromDepositRequirement(
  reservation: Pick<Reservation, 'productId'>,
  products: DepositTabProductRef[]
): boolean {
  const product = products.find((p) => p.id === reservation.productId)
  return productExemptFromDepositRequirement(product)
}

export function isManiaTourOrServiceReservation(
  reservation: Pick<Reservation, 'productId'>,
  products: DepositTabProductRef[]
): boolean {
  const product = products.find((p) => p.id === reservation.productId)
  return isManiaTourOrServiceSubCategory(product?.sub_category)
}
