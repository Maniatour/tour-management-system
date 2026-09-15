/**
 * 이메일 예약 가져오기: 판매가와 이메일 금액 차이로 쿠폰을 역산.
 * ReservationForm.applyCouponToMatchEmailAmount 와 동일 기준.
 */
import { couponMatchesReservationChannel, type CouponChannelRow } from '@/utils/homepageBookingChannel'
import { getPerPersonChargePax, isChannelSinglePrice } from '@/lib/productPriceTotal'
import { channelIsOtaForPricingSection } from '@/utils/channelSettlement'

export type ImportCouponRow = {
  coupon_code?: string | null
  discount_type?: string | null
  percentage_value?: number | null
  fixed_value?: number | null
  channel_id?: string | null
  product_id?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string | null
}

export type MatchedImportCoupon = {
  couponCode: string
  couponDiscount: number
}

export function isNinePercentCouponForViator(coupon: {
  discount_type?: string | null
  percentage_value?: unknown
}): boolean {
  const dt = String(coupon.discount_type ?? '').toLowerCase()
  if (dt !== 'percentage') return false
  const pv = Number(coupon.percentage_value)
  if (!Number.isFinite(pv)) return false
  return Math.abs(pv - 9) < 0.05
}

export function calculateImportCouponDiscount(coupon: ImportCouponRow, subtotal: number): number {
  if (!coupon) return 0
  if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
    return (subtotal * (Number(coupon.percentage_value) || 0)) / 100
  }
  if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
    return Number(coupon.fixed_value) || 0
  }
  return 0
}

export function importCouponDiscountSubtotal(args: {
  productPriceTotal: number
  notIncludedPerPerson: number
  pricingAdults: number
  reservationAdults: number
  child: number
  infant: number
  channel?: { type?: string | null; category?: string | null; pricing_type?: string | null } | null
}): number {
  const pax = getPerPersonChargePax({
    isSinglePrice: isChannelSinglePrice(args.channel),
    pricingAdults: args.pricingAdults,
    reservationAdults: args.reservationAdults,
    child: args.child,
    infant: args.infant,
  })
  const notIncludedTotal = (Number(args.notIncludedPerPerson) || 0) * pax
  const productTotal = Number(args.productPriceTotal) || 0
  const isOta = channelIsOtaForPricingSection(args.channel)
  if (isOta) return Math.max(0, productTotal - notIncludedTotal)
  return Math.max(0, productTotal - notIncludedTotal)
}

export function filterMatchingImportCoupons(args: {
  coupons: ImportCouponRow[]
  channelId: string
  productId: string
  tourDate: string
  channels: CouponChannelRow[]
}): ImportCouponRow[] {
  const tourDate = new Date(args.tourDate)
  return args.coupons.filter((coupon) => {
    if (coupon.status !== 'active') return false
    if (!couponMatchesReservationChannel(coupon, args.channelId, args.channels)) return false
    if (coupon.product_id && coupon.product_id !== args.productId) return false
    if (coupon.start_date) {
      const startDate = new Date(coupon.start_date)
      if (tourDate < startDate) return false
    }
    if (coupon.end_date) {
      const endDate = new Date(coupon.end_date)
      if (tourDate > endDate) return false
    }
    return true
  })
}

/** 이메일 금액 ≈ 판매가 − 쿠폰할인 이 되도록 가장 가까운 쿠폰. 판매가와 이미 같으면 쿠폰 없음. */
export function findCouponToMatchEmailAmount(args: {
  emailTarget: number
  couponBase: number
  coupons: ImportCouponRow[]
  channelId: string
  productId: string
  tourDate: string
  channels: CouponChannelRow[]
}): MatchedImportCoupon | null {
  const base = Number(args.couponBase) || 0
  const emailTarget = Number(args.emailTarget) || 0
  if (base <= 0 || emailTarget <= 0) return null
  if (Math.abs(base - emailTarget) < 0.02) return null

  const matching = filterMatchingImportCoupons(args)
  const errWithoutCoupon = Math.abs(base - emailTarget)
  let best: { coupon: ImportCouponRow | null; err: number } = { coupon: null, err: errWithoutCoupon }

  for (const coupon of matching) {
    const disc = calculateImportCouponDiscount(coupon, base)
    const err = Math.abs(base - disc - emailTarget)
    if (err < best.err - 0.0001) best = { coupon, err }
  }

  if (!best.coupon?.coupon_code) return null
  return {
    couponCode: best.coupon.coupon_code,
    couponDiscount: calculateImportCouponDiscount(best.coupon, base),
  }
}

/** Viator: 채널 정산이 Net과 다를 때 9% 쿠폰. */
export function findViatorNinePercentCoupon(args: {
  couponBase: number
  coupons: ImportCouponRow[]
  channelId: string
  productId: string
  tourDate: string
  channels: CouponChannelRow[]
}): MatchedImportCoupon | null {
  const matching = filterMatchingImportCoupons(args)
  let nine = matching.find((c) => isNinePercentCouponForViator(c))
  if (!nine) {
    const tourDate = new Date(args.tourDate)
    nine = args.coupons.find((c) => {
      if (c.status !== 'active') return false
      if (!couponMatchesReservationChannel(c, args.channelId, args.channels)) return false
      if (c.start_date) {
        const startDate = new Date(c.start_date)
        if (tourDate < startDate) return false
      }
      if (c.end_date) {
        const endDate = new Date(c.end_date)
        if (tourDate > endDate) return false
      }
      return isNinePercentCouponForViator(c)
    })
  }
  if (!nine?.coupon_code) return null
  return {
    couponCode: nine.coupon_code,
    couponDiscount: calculateImportCouponDiscount(nine, args.couponBase),
  }
}
