export type ResidentCheckResidency = 'us_resident' | 'non_resident' | 'mixed'

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
