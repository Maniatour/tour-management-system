export type CustomerPaymentNotifyKind = 'web_checkout' | 'resident_check' | 'field_charge'

/** First line of `customer_payment_notifications.message` for resident-check card payments. */
export const RESIDENT_CHECK_PAYMENT_NOTIFY_MARKER = 'kind:resident_check'

/** First line of `customer_payment_notifications.message` for guide on-site (field) charges. */
export const FIELD_CHARGE_PAYMENT_NOTIFY_MARKER = 'kind:field_charge'

export function customerPaymentNotifyKindFromMessage(
  message: string | null | undefined
): CustomerPaymentNotifyKind {
  const text = message?.trimStart() || ''
  if (text.startsWith(FIELD_CHARGE_PAYMENT_NOTIFY_MARKER)) return 'field_charge'
  if (text.startsWith(RESIDENT_CHECK_PAYMENT_NOTIFY_MARKER)) return 'resident_check'
  return 'web_checkout'
}

export type CustomerPaymentBreakdown = {
  chargeUsd: number
  tipUsd: number
}

function roundBreakdownUsd(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return 0
  return Math.round(amount * 100) / 100
}

/** Machine-readable line stored on `customer_payment_notifications.message`. */
export function formatPaymentBreakdownLine(chargeUsd: number, tipUsd: number): string {
  const charge = roundBreakdownUsd(chargeUsd)
  const tip = roundBreakdownUsd(tipUsd)
  return `pay_breakdown:charge=${charge.toFixed(2)};tip=${tip.toFixed(2)}`
}

export function parsePaymentBreakdownFromMessage(
  message: string | null | undefined
): CustomerPaymentBreakdown | null {
  const match = (message || '').match(/pay_breakdown:charge=(-?\d+(?:\.\d+)?);tip=(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const chargeUsd = Number(match[1])
  const tipUsd = Number(match[2])
  if (!Number.isFinite(chargeUsd) || !Number.isFinite(tipUsd) || chargeUsd < 0 || tipUsd < 0) return null
  return { chargeUsd: roundBreakdownUsd(chargeUsd), tipUsd: roundBreakdownUsd(tipUsd) }
}
