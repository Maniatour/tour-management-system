import { getOperationsCc, OPERATIONS_CC_EMAIL } from '@/lib/emailConfig'

/** 티켓 부킹 제휴업체 메일 CC · 회신 주소 */
export const TICKET_BOOKING_VENDOR_REPLY_TO = OPERATIONS_CC_EMAIL

/**
 * Resend 발신 표시 (도메인 인증 주소가 env에 있으면 함께 사용).
 * 수신자에게 보이는 From은 가능한 한 운영 Gmail로 맞춤.
 */
export const TICKET_BOOKING_VENDOR_FROM_EMAIL =
  process.env.TICKET_BOOKING_VENDOR_FROM_EMAIL?.trim() || 'vegasmaniatour@gmail.com'

export const TICKET_BOOKING_VENDOR_FROM_HEADER = `Vegas Mania Tour <${TICKET_BOOKING_VENDOR_FROM_EMAIL}>`

/** SEE CANYON 등 DB와 무관하게 고정하는 수신 주소 */
const VENDOR_EMAIL_OVERRIDES: { match: (company: string) => boolean; email: string }[] = [
  {
    match: (company) => /\bsee\s*canyon\b/i.test(company.trim()),
    email: 'seecanyon@hotmail.com',
  },
]

export function resolveTicketBookingVendorRecipient(
  company: string,
  supplierEmailFromDb: string | null
): string | null {
  const trimmed = company.trim()
  if (!trimmed) return null

  for (const { match, email } of VENDOR_EMAIL_OVERRIDES) {
    if (match(trimmed)) return email
  }

  const db = String(supplierEmailFromDb || '').trim()
  return db || null
}

export function getTicketBookingVendorCc(to: string): string[] | undefined {
  return getOperationsCc(to)
}
