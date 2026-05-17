import { buildTicketBookingVendorEmailHtmlDocument } from '@/lib/ticketBookingVendorEmail'

export async function sendTicketBookingVendorEmail(params: {
  to: string
  subject: string
  bodyHtml: string
}): Promise<{ emailId?: string }> {
  const to = params.to.trim()
  if (!to) {
    throw new Error('수신 이메일이 없습니다.')
  }

  const html = buildTicketBookingVendorEmailHtmlDocument(params.bodyHtml)

  const response = await fetch('/api/ticket-booking-vendor-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      subject: params.subject,
      html,
    }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg =
      typeof result?.error === 'string' ? result.error : '이메일 발송에 실패했습니다.'
    const details = typeof result?.details === 'string' ? ` (${result.details})` : ''
    throw new Error(`${msg}${details}`)
  }

  return { emailId: result?.emailId }
}
