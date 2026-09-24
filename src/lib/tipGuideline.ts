/** 손님에게 보여주는 가이드 팁 비율. 결제 금액은 바꾸지 않고 안내용이다. */
export const TIP_GUIDE_PERCENTS = [15, 20, 25] as const

export type TipGuidePercent = (typeof TIP_GUIDE_PERCENTS)[number]

export type TipGuideOption = {
  percent: TipGuidePercent
  amountUsd: number
}

export function roundTipUsd(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function tipAmountsMatch(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100)
}

/**
 * 팁 비율의 기준이 되는 투어비.
 * 고객 총결제에서 이미 받은 선불 팁은 빼서, 팁에 다시 팁이 붙지 않게 한다.
 * 총결제가 없으면 상품가 합계를 쓴다.
 */
export function tourFareUsdForTipGuide(
  input?: {
    totalPrice?: number | string | null
    productPriceTotal?: number | string | null
    prepaymentTip?: number | string | null
    total_price?: number | string | null
    product_price_total?: number | string | null
    prepayment_tip?: number | string | null
  } | null
): number | null {
  if (!input) return null
  const total = Number(input.totalPrice ?? input.total_price)
  const product = Number(input.productPriceTotal ?? input.product_price_total)
  const prepaidTip = Number(input.prepaymentTip ?? input.prepayment_tip)
  const alreadyTipped = Number.isFinite(prepaidTip) && prepaidTip > 0 ? prepaidTip : 0

  let fare = 0
  if (Number.isFinite(total) && total > 0) {
    fare = Math.max(0, total - alreadyTipped)
  } else if (Number.isFinite(product) && product > 0) {
    fare = product
  }

  fare = roundTipUsd(fare)
  if (!Number.isFinite(fare) || fare < 1) return null
  return fare
}

export function tipGuideOptions(tourFareUsd: number | null | undefined): TipGuideOption[] {
  const fare = Number(tourFareUsd)
  if (!Number.isFinite(fare) || fare < 1) return []
  return TIP_GUIDE_PERCENTS.map((percent) => ({
    percent,
    amountUsd: roundTipUsd((fare * percent) / 100),
  })).filter((row) => row.amountUsd >= 0.5)
}
