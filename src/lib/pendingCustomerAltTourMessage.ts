import {
  CANCELLATION_FOLLOW_UP_EMAIL_OUTER_DIV_OPEN,
  htmlToPlainTextForCopy,
} from '@/lib/cancellationFollowUpMessage'

export type PendingAltTourMessageLocale = 'ko' | 'en'
export type PendingAltTourMessageChannel = 'email' | 'sms'

export type BuildPendingAltTourMessageParams = {
  customerName: string
  tourDate: string | null | undefined
  productName: string
  channelReference: string | null | undefined
  locale: PendingAltTourMessageLocale
}

export function formatTourLineForPendingAltTourMessage(
  tourDate: string | null | undefined,
  locale: PendingAltTourMessageLocale
): string {
  const raw = tourDate?.trim()
  if (!raw) return '—'
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    if (locale === 'en') return `${iso[2]}/${iso[3]}/${iso[1]}`
    return `${iso[1]}-${iso[2]}-${iso[3]}`
  }
  return raw
}

const BUILTIN_EMAIL_BODY: Record<PendingAltTourMessageLocale, string> = {
  en: `    <p style="margin:0 0 16px;">Hello {{CUSTOMER_NAME}},</p>
    <p style="margin:0 0 12px;font-size:14px;color:#475569;">Las Vegas Mania Tour</p>
    <p style="margin:0 0 16px;">Your booking is still <strong>pending confirmation</strong> and your tour date is approaching. We would like to help you secure your spot or find a suitable alternative.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>Tour:</strong> {{PRODUCT_NAME}}<br/><strong>Date:</strong> {{TOUR_DATE}}<br/><strong>Reference:</strong> {{CHANNEL_RN}}</p>
    <p style="margin:0 0 16px;">Please reply and let us know if you would like to:</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#334155;">
      <li>Confirm this date</li>
      <li>Change to another date</li>
      <li>Switch to a different tour</li>
      <li>Cancel the booking</li>
    </ul>
    <p style="margin:0 0 16px;">If we do not hear from you soon, availability for your preferred date may be limited.</p>
    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">Thank you,<br/>Maniatour Team</p>`,
  ko: `    <p style="margin:0 0 16px;">안녕하세요, {{CUSTOMER_NAME}}님 — 라스베가스 매니아 투어입니다.</p>
    <p style="margin:0 0 16px;">고객님의 예약이 아직 <strong>확정 전(pending)</strong> 상태이며, 투어일이 가까워졌습니다. 원하시는 일정으로 확정하시거나 대체 투어를 안내드리고자 연락드립니다.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>상품:</strong> {{PRODUCT_NAME}}<br/><strong>투어일:</strong> {{TOUR_DATE}}<br/><strong>예약 번호(RN):</strong> {{CHANNEL_RN}}</p>
    <p style="margin:0 0 16px;">아래 중 원하시는 내용을 회신해 주시면 빠르게 도와드리겠습니다.</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#334155;">
      <li>해당 일정으로 확정</li>
      <li>다른 날짜로 변경</li>
      <li>다른 투어로 변경</li>
      <li>예약 취소</li>
    </ul>
    <p style="margin:0 0 16px;">빠른 회신이 없으실 경우 원하시는 일정의 좌석이 제한될 수 있습니다.</p>
    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">감사합니다.<br/>마니아투어 드림</p>`,
}

const BUILTIN_SMS_BODY: Record<PendingAltTourMessageLocale, string> = {
  en: `Hi {{CUSTOMER_NAME}}, your {{PRODUCT_NAME}} on {{TOUR_DATE}} (Ref {{CHANNEL_RN}}) is still pending. Please reply: confirm, change date, switch tour, or cancel. — Maniatour`,
  ko: `{{CUSTOMER_NAME}}님, {{TOUR_DATE}} {{PRODUCT_NAME}}(RN {{CHANNEL_RN}}) 예약이 아직 확정 전입니다. 확정/날짜변경/투어변경/취소 중 회신 부탁드립니다. — 마니아투어`,
}

export function substitutePendingAltTourMessageTemplate(
  template: string,
  params: BuildPendingAltTourMessageParams
): string {
  const tourDate = formatTourLineForPendingAltTourMessage(params.tourDate, params.locale)
  return template
    .replace(/\{\{CUSTOMER_NAME\}\}/g, params.customerName || '—')
    .replace(/\{\{PRODUCT_NAME\}\}/g, params.productName || '—')
    .replace(/\{\{TOUR_DATE\}\}/g, tourDate)
    .replace(/\{\{CHANNEL_RN\}\}/g, params.channelReference?.trim() || '—')
}

const PENDING_ALT_TOUR_EMAIL_SHELL_END = '\n  </div>\n</body>\n</html>'

const PENDING_ALT_TOUR_EMAIL_SHELL_START: Record<PendingAltTourMessageLocale, string> = {
  en:
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;">
  ` + CANCELLATION_FOLLOW_UP_EMAIL_OUTER_DIV_OPEN,
  ko:
    `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:'Malgun Gothic',system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">
  ` + CANCELLATION_FOLLOW_UP_EMAIL_OUTER_DIV_OPEN,
}

const BUILTIN_EMAIL_SUBJECT: Record<PendingAltTourMessageLocale, string> = {
  en: 'Your pending tour booking — please confirm or choose an option',
  ko: '확정 전 예약 안내 — 일정 확인 또는 변경 요청',
}

export function mergePendingAltTourEmailDocumentFromBody(
  locale: PendingAltTourMessageLocale,
  bodyInnerHtml: string
): string {
  return `${PENDING_ALT_TOUR_EMAIL_SHELL_START[locale]}${bodyInnerHtml}${PENDING_ALT_TOUR_EMAIL_SHELL_END}`
}

export function builtinPendingAltTourEmailBodyHtml(locale: PendingAltTourMessageLocale): string {
  return BUILTIN_EMAIL_BODY[locale]
}

function findOuterCardBodyBounds(html: string): { innerStart: number; innerEnd: number } | null {
  const open = CANCELLATION_FOLLOW_UP_EMAIL_OUTER_DIV_OPEN
  const i = html.indexOf(open)
  if (i < 0) return null
  const innerStart = i + open.length
  let pos = innerStart
  let depth = 1
  while (pos < html.length && depth > 0) {
    const slice = html.slice(pos)
    const openMatch = /<\s*div\b/i.exec(slice)
    const closeMatch = /<\/\s*div\s*>/i.exec(slice)
    const relOpen = openMatch ? openMatch.index : -1
    const relClose = closeMatch ? closeMatch.index : -1
    if (relClose < 0) return null
    if (relOpen >= 0 && relOpen < relClose) {
      if (!openMatch) return null
      depth += 1
      pos += relOpen + openMatch[0].length
    } else {
      if (!closeMatch) return null
      depth -= 1
      if (depth === 0) {
        return { innerStart, innerEnd: pos + relClose }
      }
      pos += relClose + closeMatch[0].length
    }
  }
  return null
}

export function extractPendingAltTourEmailBodyFromDocument(
  fullHtml: string,
  locale: PendingAltTourMessageLocale
): string {
  const fallback = builtinPendingAltTourEmailBodyHtml(locale)
  const raw = fullHtml?.trim() ?? ''
  if (!raw) return fallback
  const bounds = findOuterCardBodyBounds(raw)
  if (bounds) return raw.slice(bounds.innerStart, bounds.innerEnd).trim()

  const expectedStart = PENDING_ALT_TOUR_EMAIL_SHELL_START[locale]
  const suffix = PENDING_ALT_TOUR_EMAIL_SHELL_END
  if (raw.startsWith(expectedStart) && raw.endsWith(suffix)) {
    return raw.slice(expectedStart.length, raw.length - suffix.length).trim()
  }
  return fallback
}

export function getBuiltinPendingAltTourTemplate(
  locale: PendingAltTourMessageLocale,
  channel: PendingAltTourMessageChannel
): { name: string; subject: string; body: string } {
  if (channel === 'sms') {
    return {
      name: locale === 'ko' ? '기본' : 'Default',
      subject: '',
      body: BUILTIN_SMS_BODY[locale],
    }
  }
  return {
    name: locale === 'ko' ? '기본' : 'Default',
    subject: BUILTIN_EMAIL_SUBJECT[locale],
    body: mergePendingAltTourEmailDocumentFromBody(locale, builtinPendingAltTourEmailBodyHtml(locale)),
  }
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null || s === '') return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function substitutePendingAltTourFullMessage(
  subjectTpl: string,
  bodyTpl: string,
  channel: PendingAltTourMessageChannel,
  params: BuildPendingAltTourMessageParams
): { subject: string; body: string; plainText: string } {
  const locale = params.locale
  const refPlain = params.channelReference?.trim() || (locale === 'en' ? 'N/A' : '—')
  const namePlain = params.customerName?.trim() || (locale === 'en' ? 'Guest' : '고객')
  const productPlain = params.productName?.trim() || (locale === 'en' ? 'Tour' : '투어')
  const tourPlain = formatTourLineForPendingAltTourMessage(params.tourDate, locale)

  const replacePlain = (tpl: string) =>
    tpl
      .replace(/\{\{CUSTOMER_NAME\}\}/g, namePlain)
      .replace(/\{\{PRODUCT_NAME\}\}/g, productPlain)
      .replace(/\{\{TOUR_DATE\}\}/g, tourPlain)
      .replace(/\{\{CHANNEL_RN\}\}/g, refPlain)

  const subject = replacePlain(subjectTpl)
  if (channel === 'sms') {
    const body = replacePlain(bodyTpl)
    return { subject, body, plainText: body }
  }

  const body = bodyTpl
    .replace(/\{\{CUSTOMER_NAME\}\}/g, escapeHtml(namePlain))
    .replace(/\{\{PRODUCT_NAME\}\}/g, escapeHtml(productPlain))
    .replace(/\{\{TOUR_DATE\}\}/g, escapeHtml(tourPlain))
    .replace(/\{\{CHANNEL_RN\}\}/g, escapeHtml(refPlain))

  return { subject, body, plainText: htmlToPlainTextForCopy(body) }
}

export function buildPendingAltTourEmailHtml(params: BuildPendingAltTourMessageParams): string {
  const builtin = getBuiltinPendingAltTourTemplate(params.locale, 'email')
  return substitutePendingAltTourFullMessage(builtin.subject, builtin.body, 'email', params).body
}

export function buildPendingAltTourSmsText(params: BuildPendingAltTourMessageParams): string {
  return substitutePendingAltTourMessageTemplate(BUILTIN_SMS_BODY[params.locale], params)
}

export function buildPendingAltTourPlainEmail(params: BuildPendingAltTourMessageParams): string {
  const html = buildPendingAltTourEmailHtml(params)
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function pendingAltTourEmailSubject(locale: PendingAltTourMessageLocale): string {
  return BUILTIN_EMAIL_SUBJECT[locale]
}

export function pendingAltTourMessagePreviewParams(input: {
  customerName: string
  tourDate: string | null | undefined
  productName: string
  channelRN: string | null | undefined
  customerLanguage: string | null | undefined
}): BuildPendingAltTourMessageParams {
  const lang = String(input.customerLanguage ?? '').toLowerCase()
  const locale: PendingAltTourMessageLocale =
    lang.startsWith('en') || lang === 'english' ? 'en' : 'ko'
  return {
    customerName: input.customerName,
    tourDate: input.tourDate,
    productName: input.productName,
    channelReference: input.channelRN,
    locale,
  }
}
