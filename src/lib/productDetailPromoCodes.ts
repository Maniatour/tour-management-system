export const HOMEPAGE_BOOKING_CHANNEL_ID = 'M00001'

export type ProductDetailPromoCode = {
  id: string
  code: string
  discountType: string | null
  discountPercent: number | null
  fixedDiscount: number | null
  title: string
}

export type ProductDetailCouponRow = {
  id: string
  coupon_code: string | null
  discount_type: string | null
  percentage_value: number | null
  fixed_value: number | null
  description: string | null
  start_date: string | null
  end_date: string | null
  channel_id: string | null
  product_id: string | null
  status?: string | null
}

export function parseCouponProductIds(productId: string | null | undefined): string[] {
  if (!productId?.trim()) return []
  return productId
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

/** DB 저장용: 빈 값은 null, 다중 상품은 콤마 구분 문자열 */
export function normalizeCouponProductIdForStorage(
  productId: string | null | undefined
): string | null {
  const ids = parseCouponProductIds(productId)
  if (ids.length === 0) return null
  return ids.join(',')
}

export function formatCouponSaveError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const pgError = error as { code?: string; message?: string }
    if (pgError.code === '23503') {
      if (pgError.message?.includes('coupons_product_id_fkey')) {
        return '선택한 상품이 유효하지 않습니다. 상품을 다시 선택하거나, 다중 상품 쿠폰은 최신 DB 마이그레이션 적용 후 사용할 수 있습니다.'
      }
      return '연결된 채널 또는 상품이 유효하지 않습니다.'
    }
    if (pgError.code === '23505') {
      return '이미 사용 중인 쿠폰 코드입니다.'
    }
  }
  return '쿠폰 저장 중 오류가 발생했습니다.'
}

export function couponMatchesProduct(
  couponProductId: string | null | undefined,
  productId: string
): boolean {
  const allowedIds = parseCouponProductIds(couponProductId)
  if (allowedIds.length === 0) return true
  return allowedIds.includes(productId)
}

export function couponMatchesHomepageChannel(channelId: string | null | undefined): boolean {
  if (!channelId?.trim()) return true
  return channelId.trim() === HOMEPAGE_BOOKING_CHANNEL_ID
}

export function couponIsWithinDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: Date = new Date()
): boolean {
  const normalizedToday = new Date(today)
  normalizedToday.setHours(0, 0, 0, 0)

  if (startDate) {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    if (normalizedToday < start) return false
  }

  if (endDate) {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    if (normalizedToday > end) return false
  }

  return true
}

export function isCouponEligibleForProductDetail(
  coupon: ProductDetailCouponRow,
  productId: string
): boolean {
  if (!coupon.coupon_code?.trim()) return false
  if (!couponMatchesHomepageChannel(coupon.channel_id)) return false
  if (!couponMatchesProduct(coupon.product_id, productId)) return false
  if (!couponIsWithinDateRange(coupon.start_date, coupon.end_date)) return false
  return true
}

export function mapCouponRowToPromoCode(
  coupon: ProductDetailCouponRow,
  isEnglish: boolean
): ProductDetailPromoCode {
  const code = coupon.coupon_code?.trim() || ''
  const discountPercent =
    coupon.discount_type === 'percentage' && coupon.percentage_value != null
      ? Number(coupon.percentage_value)
      : coupon.percentage_value != null && !coupon.fixed_value
        ? Number(coupon.percentage_value)
        : null
  const fixedDiscount =
    coupon.discount_type === 'fixed' && coupon.fixed_value != null
      ? Number(coupon.fixed_value)
      : coupon.fixed_value != null && !coupon.percentage_value
        ? Number(coupon.fixed_value)
        : null

  const fallbackTitle = isEnglish ? 'Special offer' : '특별 할인'
  const title = coupon.description?.trim() || fallbackTitle

  return {
    id: coupon.id,
    code,
    discountType: coupon.discount_type,
    discountPercent,
    fixedDiscount,
    title,
  }
}

export function formatPromoDiscountLabel(
  promo: ProductDetailPromoCode,
  isEnglish = true
): string | null {
  if (promo.discountPercent != null && promo.discountPercent > 0) {
    return isEnglish ? `${promo.discountPercent}% off` : `${promo.discountPercent}% 할인`
  }
  if (promo.fixedDiscount != null && promo.fixedDiscount > 0) {
    return isEnglish ? `$${promo.fixedDiscount} off` : `$${promo.fixedDiscount} 할인`
  }
  return null
}

export function getBestPromoDiscountLabel(
  codes: ProductDetailPromoCode[],
  isEnglish = true
): string | null {
  if (codes.length === 0) return null

  const percentValues = codes
    .map((item) => item.discountPercent)
    .filter((value): value is number => value != null && value > 0)
  if (percentValues.length > 0) {
    const best = Math.max(...percentValues)
    return isEnglish ? `${best}% off` : `${best}% 할인`
  }

  const fixedValues = codes
    .map((item) => item.fixedDiscount)
    .filter((value): value is number => value != null && value > 0)
  if (fixedValues.length > 0) {
    const best = Math.max(...fixedValues)
    return isEnglish ? `Up to $${best} off` : `최대 $${best} 할인`
  }

  return null
}
