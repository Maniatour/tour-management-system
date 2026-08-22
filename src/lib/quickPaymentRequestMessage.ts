const RECIPIENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 붙여넣기된 `Name <email>`, 쉼표/슬래시 구분 다중 주소, mailto: 를
 * 실제 수신 이메일 하나로 정규화합니다.
 */
export function parseRecipientEmail(raw: string | null | undefined): string {
  let value = String(raw || '')
    .replace(/^mailto:/i, '')
    .trim()
  if (!value) return ''

  const angle = value.match(/<([^<>@\s]+@[^<>@\s]+)>/)
  if (angle?.[1]) {
    value = angle[1]
  } else {
    const token = value
      .split(/[,;/\n]+/)
      .map((part) => part.trim())
      .find((part) => part.includes('@'))
    if (token) {
      const named = token.match(/<([^<>@\s]+@[^<>@\s]+)>/)
      value = named?.[1] || token.replace(/^.*\s+/, '')
    }
  }

  value = value.replace(/[<>]/g, '').trim().toLowerCase()
  return RECIPIENT_EMAIL_RE.test(value) ? value : ''
}

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

export function buildQuickPaymentRequestEmailText(params: {
  recipientName: string
  description: string
  amountUsd: number
  invoiceNumber: string
  payUrl: string
}): string {
  const name = params.recipientName.trim() || 'there'
  const description = params.description.trim() || 'Tour payment'
  return [
    `Hello ${name},`,
    '',
    'You have a payment request. Please pay securely by card using the link below.',
    '',
    `Invoice #: ${params.invoiceNumber}`,
    `Description: ${description}`,
    `Amount: $${params.amountUsd.toFixed(2)}`,
    '',
    `Pay now: ${params.payUrl}`,
    '',
    'This email was sent by Las Vegas Mania Tour / Kovegas.',
  ].join('\n')
}

export function buildWhatsAppMeUrl(phoneE164: string, text: string): string | null {
  const digits = String(phoneE164 || '').replace(/[^\d]/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
