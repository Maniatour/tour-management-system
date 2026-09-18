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
