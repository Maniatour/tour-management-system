import { pricingFieldToNumber } from '@/utils/reservationPricingBalance'

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * `reservation_pricing.pricing_adults`가 비어 있을 때, 저장된 상품 합·단가·예약 인원으로
 * 청구 성인 수를 추정한다. (차량 단가 등: 예약 8명이어도 `product_price_total`이 단가와 같으면 1)
 */
export function inferPricingAdultsWhenUnset(opts: {
  pricingAdultsRaw: unknown
  reservationAdults: number
  child: number
  infant: number
  adultProductPrice: number
  childProductPrice: number
  infantProductPrice: number
  productPriceTotal: number
}): number {
  const { pricingAdultsRaw, reservationAdults, child, infant } = opts
  if (pricingAdultsRaw != null && pricingAdultsRaw !== '') {
    const n = Math.floor(Number(pricingAdultsRaw))
    if (Number.isFinite(n)) return Math.max(0, n)
  }

  const ra = Math.max(0, Math.floor(Number(reservationAdults) || 0))
  const ch = Math.max(0, Math.floor(Number(child) || 0))
  const inf = Math.max(0, Math.floor(Number(infant) || 0))

  const ap = pricingFieldToNumber(opts.adultProductPrice)
  const cp = pricingFieldToNumber(opts.childProductPrice)
  const ip = pricingFieldToNumber(opts.infantProductPrice)
  const ppt = pricingFieldToNumber(opts.productPriceTotal)

  const lineForAdultN = (adultN: number) => roundUsd2(ap * adultN + cp * ch + ip * inf)

  if (ap > 0 && ra > 0 && Math.abs(lineForAdultN(ra) - ppt) < 0.02) {
    return ra
  }

  const remainder = roundUsd2(ppt - cp * ch - ip * inf)
  if (ap > 0.005 && remainder >= -0.02) {
    const implied = Math.max(0, Math.round(remainder / ap))
    if (implied > 0) return implied
  }

  if (ra > 0) return ra
  return 1
}
