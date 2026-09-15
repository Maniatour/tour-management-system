export type ResidentCheckResidency = 'us_resident' | 'non_resident' | 'mixed'

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

function usdFromCents(cents: unknown): number {
  return roundUsd2(Math.max(0, Math.round(Number(cents) || 0)) / 100)
}

export function computeResidentCheckUsdCents(input: {
  residency: ResidentCheckResidency
  non_resident_16_plus_count: number
  has_annual_pass: boolean | null | undefined
  payment_method: 'card' | 'cash' | null | undefined
}): {
  nps_fee_usd_cents: number
  card_processing_fee_usd_cents: number
  total_charge_usd_cents: number
} {
  let nps = 0
  const count = Math.max(0, Math.floor(Number(input.non_resident_16_plus_count) || 0))

  if (input.residency === 'us_resident') {
    nps = 0
  } else if (input.residency === 'non_resident' && input.has_annual_pass === true) {
    nps = 0
  } else {
    nps = count * 10_000
  }

  const method = input.payment_method
  const cardFee =
    method === 'card' && nps > 0 ? Math.round(nps * 0.05) : 0
  const total = nps + cardFee

  return {
    nps_fee_usd_cents: nps,
    card_processing_fee_usd_cents: cardFee,
    total_charge_usd_cents: total,
  }
}

/**
 * 비거주자 카드 결제에서 가격 정보(card_fee)에 넣을 수수료.
 * 제출값(card_processing_fee_usd_cents)을 우선하고, 없으면 총액(NPS+5%)에서 역산한다.
 * 예: 1인 $105 결제 → $5
 */
export function residentCheckCardFeeUsdFromPayment(input: {
  cardProcessingFeeUsdCents?: number | null | undefined
  amountUsdCents?: number | null | undefined
}): number {
  const fromSubmission = usdFromCents(input.cardProcessingFeeUsdCents)
  if (fromSubmission > 0) return fromSubmission
  const total = usdFromCents(input.amountUsdCents)
  if (total <= 0) return 0
  const nps = roundUsd2(total / 1.05)
  return roundUsd2(Math.max(0, total - nps))
}

export function mergeResidentCheckCardFeeUsd(
  existingCardFee: unknown,
  additionalUsd: number
): number {
  const extra = roundUsd2(Math.max(0, Number(additionalUsd) || 0))
  return roundUsd2((Number(existingCardFee) || 0) + extra)
}

/** 입금 내역의 비거주자 카드 결제에서 가격 정보에 들어가야 할 카드 수수료 합계 */
export function impliedResidentCheckCardFeeUsdFromRecords(
  records: Array<{ note?: unknown; amount?: unknown }>
): number {
  let sum = 0
  for (const row of records) {
    if (!String(row.note || '').includes('resident_check_nps')) continue
    const amountUsd = Number(row.amount) || 0
    if (amountUsd <= 0) continue
    sum += residentCheckCardFeeUsdFromPayment({
      amountUsdCents: Math.round(amountUsd * 100),
    })
  }
  return roundUsd2(sum)
}
