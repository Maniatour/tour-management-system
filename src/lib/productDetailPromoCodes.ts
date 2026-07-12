export type ProductDetailPromoCode = {
  id: string
  code: string
  discountPercent: number
  titleKey: string
}

/** i18n 기본값 — DB translations 오버라이드 가능 */
export const PRODUCT_DETAIL_PLATFORM_PROMO_DEFAULTS = {
  code: 'MANIATOUR10',
  discountPercent: 10,
  titleKey: 'promoWelcomeTitle',
} as const

export function buildPlatformPromoCodesFromMessages(
  messages: Record<string, string | undefined>
): ProductDetailPromoCode[] {
  const code = messages.platformPromoCode?.trim() || PRODUCT_DETAIL_PLATFORM_PROMO_DEFAULTS.code
  const discountRaw = messages.platformPromoDiscountPercent?.trim()
  const discountPercent = discountRaw
    ? Math.max(0, Math.min(100, Number.parseInt(discountRaw, 10) || 0))
    : PRODUCT_DETAIL_PLATFORM_PROMO_DEFAULTS.discountPercent

  if (!code || discountPercent <= 0) return []

  return [
    {
      id: 'platform-promo-primary',
      code,
      discountPercent,
      titleKey: PRODUCT_DETAIL_PLATFORM_PROMO_DEFAULTS.titleKey,
    },
  ]
}

export function getBestPromoDiscountLabel(codes: ProductDetailPromoCode[]): string | null {
  if (codes.length === 0) return null
  const best = Math.max(...codes.map((item) => item.discountPercent))
  return `${best}% off`
}
