export type CustomerPaymentNotifyKind = 'web_checkout' | 'resident_check'

/** First line of `customer_payment_notifications.message` for resident-check card payments. */
export const RESIDENT_CHECK_PAYMENT_NOTIFY_MARKER = 'kind:resident_check'

export function customerPaymentNotifyKindFromMessage(
  message: string | null | undefined
): CustomerPaymentNotifyKind {
  return message?.trimStart().startsWith(RESIDENT_CHECK_PAYMENT_NOTIFY_MARKER)
    ? 'resident_check'
    : 'web_checkout'
}
