export type CancellationFollowUpMessageLocale = 'ko' | 'en'
export type CancellationFollowUpMessageChannel = 'email' | 'sms'
export type CancellationFollowUpMessageKind = 'follow_up' | 'rebooking'

export type BuildCancellationFollowUpMessageParams = {
  customerName: string
  tourDate: string | null | undefined
  productName: string
  channelReference: string | null | undefined
  locale: CancellationFollowUpMessageLocale
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null || s === '') return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatTourLineForCancellationMessage(
  tourDate: string | null | undefined,
  locale: CancellationFollowUpMessageLocale
): string {
  const raw = tourDate?.trim()
  if (!raw) return locale === 'en' ? '—' : '—'
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    if (locale === 'en') return `${iso[2]}/${iso[3]}/${iso[1]}`
    return `${iso[1]}-${iso[2]}-${iso[3]}`
  }
  return raw
}

export const CANCELLATION_FOLLOW_UP_EMAIL_OUTER_DIV_OPEN =
  '<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px 28px;">'

const CANCELLATION_FOLLOW_UP_EMAIL_SHELL_END = '\n  </div>\n</body>\n</html>'

const CANCELLATION_FOLLOW_UP_EMAIL_SHELL_START: Record<CancellationFollowUpMessageLocale, string> = {
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

const BUILTIN_EMAIL_BODY: Record<
  CancellationFollowUpMessageKind,
  Record<CancellationFollowUpMessageLocale, string>
> = {
  follow_up: {
    en: `    <p style="margin:0 0 16px;">Hello {{CUSTOMER_NAME}},</p>
    <p style="margin:0 0 12px;font-size:14px;color:#475569;">Las Vegas Mania Tour</p>
    <p style="margin:0 0 16px;">We are writing to confirm that your booking has been <strong>cancelled</strong> as requested.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>Tour:</strong> {{PRODUCT_NAME}}<br/><strong>Date:</strong> {{TOUR_DATE}}<br/><strong>Reference:</strong> {{CHANNEL_RN}}</p>
    <p style="margin:0 0 16px;">If you paid through our office or a partner channel, any applicable refund will be processed according to the cancellation policy on your voucher. Processing times may vary by payment method (typically 5–10 business days after approval).</p>
    <p style="margin:0 0 16px;">If you did not request this cancellation or have questions about fees or timing, please reply to this email or contact us as soon as possible so we can assist you.</p>
    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">Thank you,<br/>Maniatour Team</p>`,
    ko: `    <p style="margin:0 0 16px;">안녕하세요, {{CUSTOMER_NAME}}님 — 라스베가스 매니아 투어입니다.</p>
    <p style="margin:0 0 16px;">요청하신 대로 아래 예약이 <strong>취소 처리</strong>되었음을 안내드립니다.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>상품:</strong> {{PRODUCT_NAME}}<br/><strong>투어일:</strong> {{TOUR_DATE}}<br/><strong>예약 번호(RN):</strong> {{CHANNEL_RN}}</p>
    <p style="margin:0 0 16px;">당사 또는 제휴 채널을 통해 결제하신 경우, 바우처에 명시된 취소 규정에 따라 환불이 진행됩니다. 결제 수단에 따라 영업일 기준 약 5~10일이 소요될 수 있습니다.</p>
    <p style="margin:0 0 16px;">취소를 요청하지 않으셨거나 환불·수수료 관련 문의가 있으시면 본 메일로 회신해 주시거나 빠른 시일 내에 연락 주시기 바랍니다.</p>
    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">감사합니다.<br/>마니아투어 드림</p>`,
  },
  rebooking: {
    en: `    <p style="margin:0 0 16px;">Hello {{CUSTOMER_NAME}},</p>
    <p style="margin:0 0 12px;font-size:14px;color:#475569;">Las Vegas Mania Tour</p>
    <p style="margin:0 0 16px;">We are sorry your plans for <strong>{{PRODUCT_NAME}}</strong> on <strong>{{TOUR_DATE}}</strong> did not work out (Ref. {{CHANNEL_RN}}).</p>
    <p style="margin:0 0 16px;">If you would like to visit Las Vegas on another date, we would be happy to help you rebook a similar tour or suggest alternatives that fit your schedule.</p>
    <p style="margin:0 0 16px;">Reply to this email with your preferred dates and party size, or let us know if you would like a quick call — we will do our best to find a good option for you.</p>
    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">We hope to see you soon,<br/>Maniatour Team</p>`,
    ko: `    <p style="margin:0 0 16px;">안녕하세요, {{CUSTOMER_NAME}}님 — 라스베가스 매니아 투어입니다.</p>
    <p style="margin:0 0 16px;"><strong>{{PRODUCT_NAME}}</strong> ({{TOUR_DATE}}, RN {{CHANNEL_RN}}) 일정이 취소되어 아쉽게 생각합니다.</p>
    <p style="margin:0 0 16px;">다른 날짜로 라스베가스를 방문하실 계획이 있으시면, 비슷한 투어나 일정에 맞는 상품으로 <strong>재예약</strong>을 도와드리겠습니다.</p>
    <p style="margin:0 0 16px;">희망 일정·인원을 본 메일로 알려 주시거나 전화 상담을 원하시면 연락 주세요. 가능한 옵션을 안내해 드리겠습니다.</p>
    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">다시 뵙기를 바랍니다.<br/>마니아투어 드림</p>`,
  },
}

const BUILTIN_SMS_BODY: Record<
  CancellationFollowUpMessageKind,
  Record<CancellationFollowUpMessageLocale, string>
> = {
  follow_up: {
    en: `[Maniatour] Hi {{CUSTOMER_NAME}}, your {{PRODUCT_NAME}} on {{TOUR_DATE}} (Ref {{CHANNEL_RN}}) is cancelled. Refunds follow your voucher policy (5-10 biz days). Questions? Reply here.`,
    ko: `[마니아투어] {{CUSTOMER_NAME}}님, {{PRODUCT_NAME}}({{TOUR_DATE}}, RN {{CHANNEL_RN}}) 예약이 취소 처리되었습니다. 환불은 바우처 규정에 따르며 영업일 5~10일 소요될 수 있습니다. 문의는 본 문자 회신 부탁드립니다.`,
  },
  rebooking: {
    en: `[Maniatour] Hi {{CUSTOMER_NAME}}, sorry your {{TOUR_DATE}} tour was cancelled ({{CHANNEL_RN}}). Want another date? Reply with preferred dates & guests — we will help rebook.`,
    ko: `[마니아투어] {{CUSTOMER_NAME}}님, {{TOUR_DATE}} {{PRODUCT_NAME}}(RN {{CHANNEL_RN}}) 취소되어 안내드립니다. 다른 일정 재예약 원하시면 희망 날짜·인원을 회신해 주세요.`,
  },
}

const BUILTIN_EMAIL_SUBJECT: Record<
  CancellationFollowUpMessageKind,
  Record<CancellationFollowUpMessageLocale, string>
> = {
  follow_up: {
    en: `[Cancellation confirmed] {{PRODUCT_NAME}} — {{TOUR_DATE}} — Ref. {{CHANNEL_RN}}`,
    ko: `[취소 안내] {{PRODUCT_NAME}} — {{TOUR_DATE}} — 예약 RN {{CHANNEL_RN}}`,
  },
  rebooking: {
    en: `[Rebook with us] {{PRODUCT_NAME}} — Ref. {{CHANNEL_RN}}`,
    ko: `[재예약 안내] 다른 일정으로 모시겠습니다 — RN {{CHANNEL_RN}}`,
  },
}

export function mergeCancellationFollowUpEmailDocumentFromBody(
  locale: CancellationFollowUpMessageLocale,
  bodyInnerHtml: string
): string {
  return `${CANCELLATION_FOLLOW_UP_EMAIL_SHELL_START[locale]}${bodyInnerHtml}${CANCELLATION_FOLLOW_UP_EMAIL_SHELL_END}`
}

export function builtinCancellationFollowUpEmailBodyHtml(
  locale: CancellationFollowUpMessageLocale,
  messageKind: CancellationFollowUpMessageKind
): string {
  return BUILTIN_EMAIL_BODY[messageKind][locale]
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

export function extractCancellationFollowUpEmailBodyFromDocument(
  fullHtml: string,
  locale: CancellationFollowUpMessageLocale,
  messageKind: CancellationFollowUpMessageKind
): string {
  const fallback = builtinCancellationFollowUpEmailBodyHtml(locale, messageKind)
  const raw = fullHtml?.trim() ?? ''
  if (!raw) return fallback
  const bounds = findOuterCardBodyBounds(raw)
  if (bounds) return raw.slice(bounds.innerStart, bounds.innerEnd).trim()

  const expectedStart = CANCELLATION_FOLLOW_UP_EMAIL_SHELL_START[locale]
  const suffix = CANCELLATION_FOLLOW_UP_EMAIL_SHELL_END
  if (raw.startsWith(expectedStart) && raw.endsWith(suffix)) {
    return raw.slice(expectedStart.length, raw.length - suffix.length).trim()
  }
  return fallback
}

export function getBuiltinCancellationFollowUpTemplate(
  locale: CancellationFollowUpMessageLocale,
  channel: CancellationFollowUpMessageChannel,
  messageKind: CancellationFollowUpMessageKind
): { subject: string; body: string } {
  if (channel === 'sms') {
    return {
      subject: '',
      body: BUILTIN_SMS_BODY[messageKind][locale],
    }
  }
  return {
    subject: BUILTIN_EMAIL_SUBJECT[messageKind][locale],
    body: mergeCancellationFollowUpEmailDocumentFromBody(
      locale,
      builtinCancellationFollowUpEmailBodyHtml(locale, messageKind)
    ),
  }
}

export function substituteCancellationFollowUpMessageTemplate(
  subjectTpl: string,
  bodyTpl: string,
  channel: CancellationFollowUpMessageChannel,
  params: BuildCancellationFollowUpMessageParams
): { subject: string; body: string; plainText: string } {
  const locale = params.locale
  const refPlain = params.channelReference?.trim() || (locale === 'en' ? 'N/A' : '—')
  const namePlain = params.customerName?.trim() || (locale === 'en' ? 'Guest' : '고객')
  const productPlain = params.productName?.trim() || (locale === 'en' ? 'Tour' : '투어')
  const tourPlain = formatTourLineForCancellationMessage(params.tourDate, locale)

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

  const name = escapeHtml(namePlain)
  const product = escapeHtml(productPlain)
  const tour = escapeHtml(tourPlain)
  const rnHtml = escapeHtml(refPlain)
  const body = bodyTpl
    .replace(/\{\{CUSTOMER_NAME\}\}/g, name)
    .replace(/\{\{PRODUCT_NAME\}\}/g, product)
    .replace(/\{\{TOUR_DATE\}\}/g, tour)
    .replace(/\{\{CHANNEL_RN\}\}/g, rnHtml)

  return { subject, body, plainText: htmlToPlainTextForCopy(body) }
}

export function htmlToPlainTextForCopy(html: string): string {
  if (typeof document === 'undefined') {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.innerText || div.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}
