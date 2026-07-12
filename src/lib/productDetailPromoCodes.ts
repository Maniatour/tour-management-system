export type ProductDetailPromoCode = {
  id: string
  code: string
  discountPercent: number
  titleKey: string
}

export const PRODUCT_DETAIL_PLATFORM_PROMO_CODES: ProductDetailPromoCode[] = [
  {
    id: 'kovegas-welcome-10',
    code: 'KOVEGAS10',
    discountPercent: 10,
    titleKey: 'promoWelcomeTitle',
  },
]

export function getBestPromoDiscountLabel(codes: ProductDetailPromoCode[]): string | null {
  if (codes.length === 0) return null
  const best = Math.max(...codes.map((item) => item.discountPercent))
  return `${best}% off`
}
