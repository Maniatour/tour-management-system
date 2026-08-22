/** 고객 발송용 결제 요청 문자·WhatsApp 본문 (이메일과 같이 기본 영문) */
export function buildQuickPaymentRequestSmsText(params: {
  recipientName: string
  description: string
  amountUsd: number
  payUrl: string
}): string {
  const name = params.recipientName.trim() || 'there'
  const description = params.description.trim() || 'Tour payment'
  return [
    `Hello ${name},`,
    `Payment request $${params.amountUsd.toFixed(2)} — ${description}`,
    `Pay here: ${params.payUrl}`,
    'Las Vegas Mania Tour / Kovegas',
  ].join('\n')
}

export function buildWhatsAppMeUrl(phoneE164: string, text: string): string | null {
  const digits = String(phoneE164 || '').replace(/[^\d]/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
