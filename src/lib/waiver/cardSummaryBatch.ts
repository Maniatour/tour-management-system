export type WaiverCardSummary = {
  reservationId: string
  bookingNumber: string
  tourDate: string
  tourName: string
  guestCount: number
  completeGuests: number
  overall: 'COMPLETE' | 'INCOMPLETE'
  required: string[]
  participants: Array<{
    id: string
    name: string
    complete: boolean
    perDoc: Record<string, boolean>
  }>
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildWaiverShareMessage(input: {
  isKo: boolean
  bookingNumber: string
  tourDate: string
  tourName: string
  url: string
}): string {
  if (input.isKo) {
    return [
      '[LAS VEGAS MANIA TOUR]',
      '투어 전날 라스베이거스 시간 오후 5시까지 면책 동의서에 서명해 주세요.',
      '성명은 영문으로만 작성해 주세요. 예: Kim Minjun',
      '온라인 서명을 못 하신 경우, 가이드가 인쇄한 면책 동의서를 가져가니 투어 당일 인쇄물에 서명하시면 됩니다.',
      '',
      `예약번호: ${input.bookingNumber}`,
      `투어일: ${input.tourDate}`,
      `상품: ${input.tourName}`,
      '',
      `서명 링크: ${input.url}`,
    ].join('\n')
  }
  return [
    '[LAS VEGAS MANIA TOUR]',
    'Please sign the required tour waiver by 5:00 PM Las Vegas time the day before your tour.',
    'Write each guest name in English letters only (example: Kim Minjun).',
    'If you cannot sign online, our guide will bring a printed form for you to sign on the tour day.',
    '',
    `Booking: ${input.bookingNumber}`,
    `Tour date: ${input.tourDate}`,
    `Tour: ${input.tourName}`,
    '',
    `Waiver link: ${input.url}`,
  ].join('\n')
}

export function buildWaiverShareEmail(input: {
  isKo: boolean
  bookingNumber: string
  tourDate: string
  tourName: string
  url: string
}): { subject: string; html: string; text: string } {
  const text = buildWaiverShareMessage(input)
  const subject = input.isKo
    ? `[LAS VEGAS MANIA TOUR] 면책 동의서 서명 안내 (${input.bookingNumber})`
    : `[LAS VEGAS MANIA TOUR] Please sign your tour waiver (${input.bookingNumber})`
  const heading = input.isKo
    ? '투어 전날 라스베이거스 시간 오후 5시까지 면책 동의서에 서명해 주세요.'
    : 'Please sign the required tour waiver by 5:00 PM Las Vegas time the day before your tour.'
  const detail = input.isKo
    ? '성명은 영문으로만 작성해 주세요. 예: Kim Minjun. 온라인 서명을 못 하신 경우 가이드가 인쇄한 면책 동의서를 가져가니 투어 당일 인쇄물에 서명하시면 됩니다.'
    : 'Write each guest name in English letters only (example: Kim Minjun). If you cannot sign online, our guide will bring a printed form for you to sign on the tour day.'
  const cta = input.isKo ? '면책 동의서 작성하기' : 'Sign the waiver'
  const bookingLabel = input.isKo ? '예약번호' : 'Booking'
  const dateLabel = input.isKo ? '투어일' : 'Tour date'
  const tourLabel = input.isKo ? '상품' : 'Tour'
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px 24px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;color:#6b7280;">LAS VEGAS MANIA TOUR</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">${escapeHtml(detail)}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">${escapeHtml(bookingLabel)}: ${escapeHtml(input.bookingNumber)}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">${escapeHtml(dateLabel)}: ${escapeHtml(input.tourDate)}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#4b5563;">${escapeHtml(tourLabel)}: ${escapeHtml(input.tourName)}</p>
      <p style="margin:0 0 28px;">
        <a href="${escapeHtml(input.url)}" style="display:inline-block;background:#0B5FFF;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">${escapeHtml(cta)}</a>
      </p>
      <p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all;">${escapeHtml(input.url)}</p>
    </div>
  </div>
</body>
</html>`
  return { subject, html, text }
}

export function isWaiverShareUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? /^\/waiver\/[A-Za-z0-9_-]+$/.test(parsed.pathname)
      : false
  } catch {
    return false
  }
}
