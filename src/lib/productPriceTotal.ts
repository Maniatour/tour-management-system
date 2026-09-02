export function isChannelSinglePrice(channel: { pricing_type?: string | null } | null | undefined): boolean {
  return (channel?.pricing_type || 'separate') === 'single'
}

/**
 * 단일가 채널 상품가·불포함 청구 인원.
 * - 청구 성인(pricingAdults) ≠ 예약 성인(adults): 총원(또는 차량 단위)을 성인 칸에 넣은 경우 → pricingAdults만
 * - 같으면: 성인+아동+유아 (동일 단가 × 총 인원)
 */
export function getSinglePriceBillingPax(opts: {
  pricingAdults: number
  reservationAdults: number
  child: number
  infant: number
}): number {
  const pa = Math.max(0, Math.floor(Number(opts.pricingAdults) || 0))
  const ra = Math.max(0, Math.floor(Number(opts.reservationAdults) || 0))
  const ch = Math.max(0, Math.floor(Number(opts.child) || 0))
  const inf = Math.max(0, Math.floor(Number(opts.infant) || 0))
  if (pa !== ra) return pa
  return pa + ch + inf
}

/**
 * 1인당 불포함(입장권) 등 인원 곱에 쓰는 청구 인원.
 * 단일가: 상품가와 동일하게 getSinglePriceBillingPax (성인 칸에 총원을 넣으면 아동을 다시 더하지 않음)
 * 분리 요금: pricingAdults + 아동 + 유아
 */
export function getPerPersonChargePax(opts: {
  isSinglePrice: boolean
  pricingAdults: number
  reservationAdults: number
  child: number
  infant: number
}): number {
  if (opts.isSinglePrice) {
    return getSinglePriceBillingPax(opts)
  }
  const pa = Math.max(0, Math.floor(Number(opts.pricingAdults) || 0))
  const ch = Math.max(0, Math.floor(Number(opts.child) || 0))
  const inf = Math.max(0, Math.floor(Number(opts.infant) || 0))
  return pa + ch + inf
}

export function computeProductPriceTotal(opts: {
  isSinglePrice: boolean
  adultProductPrice: number
  childProductPrice: number
  infantProductPrice: number
  pricingAdults: number
  reservationAdults: number
  child: number
  infant: number
}): number {
  const {
    isSinglePrice,
    adultProductPrice,
    childProductPrice,
    infantProductPrice,
    pricingAdults,
    reservationAdults,
    child,
    infant,
  } = opts

  if (isSinglePrice) {
    const pax = getSinglePriceBillingPax({ pricingAdults, reservationAdults, child, infant })
    return (adultProductPrice || 0) * pax
  }

  return (
    (adultProductPrice || 0) * (pricingAdults || 0) +
    (childProductPrice || 0) * (child || 0) +
    (infantProductPrice || 0) * (infant || 0)
  )
}
