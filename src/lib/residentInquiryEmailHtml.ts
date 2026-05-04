import type { ResidentInquiryEmailTourKind } from '@/lib/residentInquiryTourKind'

export type ResidentInquiryEmailLocale = 'ko' | 'en'

export type BuildResidentInquiryEmailParams = {
  customerName: string
  tourDate: string | null | undefined
  productName: string
  channelReference: string | null | undefined
  /**
   * Tokenized guest URL (설문·업로드·결제). 미리보기에서는 빈 문자열이면 안내 문구만 표시.
   */
  residentCheckAbsoluteUrl: string
  locale: ResidentInquiryEmailLocale
  /** 기본값 day_tour */
  emailTourKind?: ResidentInquiryEmailTourKind
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null || s === '') return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatTourLineForResidentEmail(
  tourDate: string | null | undefined,
  locale: ResidentInquiryEmailLocale
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

/**
 * 발송·미리보기 시 삽입되는 링크 블록(HTML). 템플릿의 {{FLOW_LINK_BLOCK}} 자리에 들어갑니다.
 */
export function buildFlowLinkBlockHtml(
  residentCheckAbsoluteUrl: string,
  locale: ResidentInquiryEmailLocale
): string {
  const flowUrl = residentCheckAbsoluteUrl.trim()
  if (flowUrl.length > 0) {
    return `<a href="${escapeHtml(flowUrl)}" style="display:inline-block;margin:12px 0;padding:12px 20px;background:#0f766e;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">${locale === 'en' ? 'Open secure guest page' : '고객 안내 페이지 열기'}</a><div style="font-size:13px;color:#64748b;margin-top:8px;word-break:break-all;">${escapeHtml(flowUrl)}</div>`
  }
  return locale === 'en'
    ? '<p style="margin:12px 0;font-size:14px;color:#64748b;"><em>Your personal link is added automatically when this email is sent.</em></p>'
    : '<p style="margin:12px 0;font-size:14px;color:#64748b;"><em>실제 발송 시 본인 전용 링크가 자동으로 들어갑니다.</em></p>'
}

/**
 * 흰 카드 영역을 여는 div. 리치 에디터는 이 태그 *안쪽* HTML만 편집합니다.
 */
export const RESIDENT_INQUIRY_EMAIL_OUTER_DIV_OPEN =
  '<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px 28px;">'

const RESIDENT_INQUIRY_EMAIL_SHELL_END = '\n  </div>\n</body>\n</html>'

const RESIDENT_INQUIRY_EMAIL_SHELL_START: Record<ResidentInquiryEmailLocale, string> = {
  en:
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;">
  ` + RESIDENT_INQUIRY_EMAIL_OUTER_DIV_OPEN,
  ko:
    `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:'Malgun Gothic',system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">
  ` + RESIDENT_INQUIRY_EMAIL_OUTER_DIV_OPEN,
}

/** 내장 기본 본문(플레이스홀더 포함). 레이아웃·DOCTYPE 등은 셸에 고정 */
export const BUILTIN_RESIDENT_INQUIRY_EMAIL_BODY_HTML: Record<ResidentInquiryEmailLocale, string> = {
  en: `    <p style="margin:0 0 16px;">Hello {{CUSTOMER_NAME}},</p>
    <p style="margin:0 0 12px;font-size:14px;color:#475569;">Las Vegas Mania Tour</p>
    <p style="margin:0 0 16px;">According to the U.S. National Park Service (NPS) policy, starting <strong>January 1, 2026</strong>, when visiting certain popular national parks (11 parks total), <strong>non-U.S. residents</strong> are required to pay an <strong>additional $100 per person (ages 16 and over)</strong> on top of the standard entrance fee.</p>
    <p style="margin:0 0 16px;"><strong>U.S. residents:</strong> the standard entrance fee remains the same. Valid government-issued proof of U.S. residency is required on the tour day.</p>
    <p style="margin:0 0 16px;"><strong>Mixed groups:</strong> if any member is a non-U.S. resident, please enter the exact number of non-U.S. residents (16+) in the online form.</p>
    <p style="margin:0 0 16px;"><strong>Card payments:</strong> a <strong>5% card processing fee</strong> applies to the additional NPS amount paid by card today.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>Booking:</strong> {{PRODUCT_NAME}}<br/><strong>Tour date:</strong> {{TOUR_DATE}}<br/><strong>Reference:</strong> {{CHANNEL_RN}}</p>

    <h2 style="font-size:16px;margin:24px 0 10px;">Complete online (required)</h2>
    <p style="margin:0 0 12px;">Please use the secure page below to confirm residency, upload an Annual Pass photo if applicable, upload ID/proof, agree to the terms, and pay any balance by card if you choose card payment.</p>
    {{FLOW_LINK_BLOCK}}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">This link is valid for <strong>14 days</strong>. After you finish, the page becomes read-only. If you need a new link, please contact us.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#475569;">You may still reply to this email if you have questions.</p>
    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">Thank you,<br/>Maniatour Team</p>`,
  ko: `    <p style="margin:0 0 16px;">안녕하세요, {{CUSTOMER_NAME}}님 — 라스베가스 매니아 투어입니다.</p>
    <p style="margin:0 0 16px;">미국 국립공원관리국(NPS) 정책에 따라 <strong>2026년 1월 1일</strong>부터 일부 인기 국립공원(총 11곳) 방문 시 <strong>비거주자(만 16세 이상)</strong>에게 표준 입장료 외 <strong>인당 $100의 추가 입장료</strong>가 부과될 수 있습니다.</p>
    <p style="margin:0 0 16px;"><strong>미국 거주자</strong>는 기본 입장료만 적용됩니다. 투어 당일 유효한 거주·신분 증빙이 필요합니다.</p>
    <p style="margin:0 0 16px;"><strong>혼합 그룹</strong>인 경우 비거주 인원(만 16세 이상) 수를 온라인 양식에 정확히 입력해 주세요.</p>
    <p style="margin:0 0 16px;"><strong>카드 결제</strong> 시 오늘 결제하는 NPS 추가 금액에 대해 <strong>카드 수수료 5%</strong>가 별도 부과됩니다.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>상품:</strong> {{PRODUCT_NAME}}<br/><strong>투어일:</strong> {{TOUR_DATE}}<br/><strong>예약 번호(RN):</strong> {{CHANNEL_RN}}</p>

    <h2 style="font-size:16px;margin:24px 0 10px;">온라인으로 완료 (필수)</h2>
    <p style="margin:0 0 12px;">아래 보안 페이지에서 거주 여부 확인, 해당 시 연간 패스 사진·신분/증빙 업로드, 동의, 카드 결제 선택 시 잔액 결제를 진행해 주세요.</p>
    {{FLOW_LINK_BLOCK}}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">링크 유효기간은 발송일 기준 <strong>14일</strong>입니다. 완료 후에는 읽기 전용으로 표시됩니다. 링크가 필요하시면 연락 주세요.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#475569;">문의 사항은 본 메일 회신도 가능합니다.</p>
    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">감사합니다.<br/>마니아투어 드림</p>`,
}

/** 멀티데이·숙박 투어용 기본 본문(플레이스홀더 포함) */
export const BUILTIN_RESIDENT_INQUIRY_EMAIL_BODY_HTML_MULTI_DAY: Record<ResidentInquiryEmailLocale, string> = {
  en: `    <p style="margin:0 0 16px;">Hello {{CUSTOMER_NAME}},</p>
    <p style="margin:0 0 12px;font-size:14px;color:#475569;">Las Vegas Mania Tour</p>
    <p style="margin:0 0 16px;">(U.S. Resident or Not — Please let us know)</p>
    <p style="margin:0 0 16px;">According to the U.S. National Park Service (NPS) policy, starting <strong>January 1, 2026</strong>, when visiting certain popular national parks (11 parks total), <strong>non-U.S. residents</strong> are required to pay an <strong>additional $100 per person (ages 16 and over)</strong> on top of the standard entrance fee.</p>

    <h2 style="font-size:15px;margin:20px 0 8px;">▶ U.S. Residents</h2>
    <p style="margin:0 0 8px;">The standard entrance fee remains the same.</p>
    <p style="margin:0 0 8px;">Valid government-issued proof of U.S. residency is required on the tour day.</p>
    <p style="margin:0 0 8px;">Please inform us in advance if you are a U.S. resident.</p>
    <p style="margin:0 0 16px;font-size:14px;color:#64748b;">※ If valid ID is not presented on the tour day, the guest may be treated as a non-U.S. resident and charged the additional $100.</p>

    <h2 style="font-size:15px;margin:20px 0 8px;">▶ Mixed Groups (U.S. residents &amp; non-U.S. residents)</h2>
    <p style="margin:0 0 8px;">If any member of your group is a non-U.S. resident, please inform us of the exact number of non-U.S. residents, including friends, family members, or companions.</p>

    <h2 style="font-size:15px;margin:20px 0 8px;">▶ Non-resident Annual Pass</h2>
    <p style="margin:0 0 16px;">If you purchase the <strong>$250 non-resident annual pass</strong>, the non-resident fees are waived. Please take a clear photo and send it to us in advance before the tour starts.</p>

    <h2 style="font-size:15px;margin:20px 0 8px;">▶ Confirmation Required</h2>
    <p style="margin:0 0 16px;">If you agree to the above, please reply “I agree” and let us know.</p>

    <p style="margin:0 0 12px;"><strong>Card payments:</strong> a <strong>5% card processing fee</strong> applies to any additional NPS amount paid by card.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>Booking:</strong> {{PRODUCT_NAME}}<br/><strong>Tour date:</strong> {{TOUR_DATE}}<br/><strong>Reference:</strong> {{CHANNEL_RN}}</p>

    <h2 style="font-size:16px;margin:24px 0 10px;">Complete online (required)</h2>
    <p style="margin:0 0 12px;">Please use the secure page below to confirm residency, upload an Annual Pass photo if applicable, upload ID/proof, agree to the terms, and pay any balance by card if you choose card payment.</p>
    {{FLOW_LINK_BLOCK}}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">This link is valid for <strong>14 days</strong>. After you finish, the page becomes read-only. If you need a new link, please contact us.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#475569;">You may still reply to this email if you have questions.</p>
    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">Thank you,<br/>Maniatour Team</p>`,
  ko: `    <p style="margin:0 0 16px;">안녕하세요, {{CUSTOMER_NAME}}님 — 라스베가스 매니아 투어입니다.</p>
    <p style="margin:0 0 16px;">(미국 거주 여부 — 미리 알려 주세요)</p>
    <p style="margin:0 0 16px;">미국 국립공원관리국(NPS) 정책에 따라 <strong>2026년 1월 1일</strong>부터 일부 인기 국립공원(총 11곳) 방문 시 <strong>비거주자(만 16세 이상)</strong>에게 표준 입장료 외 <strong>인당 $100의 추가 입장료</strong>가 부과됩니다.</p>

    <h2 style="font-size:15px;margin:20px 0 8px;">▶ 미국 거주자</h2>
    <p style="margin:0 0 8px;">표준 입장료만 적용됩니다.</p>
    <p style="margin:0 0 8px;">투어 당일 유효한 미국 거주·신분 증빙이 필요합니다.</p>
    <p style="margin:0 0 8px;">미국 거주자이시면 사전에 알려 주세요.</p>
    <p style="margin:0 0 16px;font-size:14px;color:#64748b;">※ 투어 당일 유효한 증빙이 없으면 비거주자로 간주되어 추가 $100이 부과될 수 있습니다.</p>

    <h2 style="font-size:15px;margin:20px 0 8px;">▶ 혼합 그룹(거주자 + 비거주자)</h2>
    <p style="margin:0 0 8px;">동행 중 비거주자가 한 명이라도 있으면, 친구·가족·동반자를 포함해 <strong>비거주자 정확한 인원 수</strong>를 알려 주세요.</p>

    <h2 style="font-size:15px;margin:20px 0 8px;">▶ 비거주 연간 패스(Non-resident Annual Pass)</h2>
    <p style="margin:0 0 16px;"><strong>$250 비거주 연간 패스</strong>를 구매하시면 비거주 추가 요금이 면제됩니다. 투어 시작 전 선명한 사진을 찍어 미리 보내 주세요.</p>

    <h2 style="font-size:15px;margin:20px 0 8px;">▶ 확인 요청</h2>
    <p style="margin:0 0 16px;">위 내용에 동의하시면 회신으로 <strong>「동의합니다」</strong>라고 알려 주세요.</p>

    <p style="margin:0 0 12px;"><strong>카드 결제</strong> 시 NPS 추가 금액에 대해 <strong>카드 수수료 5%</strong>가 별도 부과됩니다.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>상품:</strong> {{PRODUCT_NAME}}<br/><strong>투어일:</strong> {{TOUR_DATE}}<br/><strong>예약 번호(RN):</strong> {{CHANNEL_RN}}</p>

    <h2 style="font-size:16px;margin:24px 0 10px;">온라인으로 완료 (필수)</h2>
    <p style="margin:0 0 12px;">아래 보안 페이지에서 거주 여부 확인, 해당 시 연간 패스 사진·신분/증빙 업로드, 동의, 카드 결제 선택 시 잔액 결제를 진행해 주세요.</p>
    {{FLOW_LINK_BLOCK}}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">링크 유효기간은 발송일 기준 <strong>14일</strong>입니다. 완료 후에는 읽기 전용으로 표시됩니다. 링크가 필요하시면 연락 주세요.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#475569;">문의 사항은 본 메일 회신도 가능합니다.</p>
    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">감사합니다.<br/>마니아투어 드림</p>`,
}

export function builtinResidentInquiryBodyHtml(
  locale: ResidentInquiryEmailLocale,
  tourKind: ResidentInquiryEmailTourKind
): string {
  return tourKind === 'multi_day'
    ? BUILTIN_RESIDENT_INQUIRY_EMAIL_BODY_HTML_MULTI_DAY[locale]
    : BUILTIN_RESIDENT_INQUIRY_EMAIL_BODY_HTML[locale]
}

export function mergeResidentInquiryEmailDocumentFromBody(
  locale: ResidentInquiryEmailLocale,
  bodyInnerHtml: string
): string {
  return `${RESIDENT_INQUIRY_EMAIL_SHELL_START[locale]}${bodyInnerHtml}${RESIDENT_INQUIRY_EMAIL_SHELL_END}`
}

function findOuterCardBodyBounds(html: string): { innerStart: number; innerEnd: number } | null {
  const open = RESIDENT_INQUIRY_EMAIL_OUTER_DIV_OPEN
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

/**
 * 저장된 전체 HTML에서 카드 안쪽 본문만 추출. 구조를 알 수 없으면 해당 로케일 내장 본문을 돌려줍니다.
 */
export function extractResidentInquiryEmailBodyFromDocument(
  fullHtml: string,
  locale: ResidentInquiryEmailLocale,
  tourKind: ResidentInquiryEmailTourKind = 'day_tour'
): string {
  const fallback = builtinResidentInquiryBodyHtml(locale, tourKind)
  const raw = fullHtml?.trim() ?? ''
  if (!raw) return fallback
  const bounds = findOuterCardBodyBounds(raw)
  if (bounds) return raw.slice(bounds.innerStart, bounds.innerEnd).trim()

  const expectedStart = RESIDENT_INQUIRY_EMAIL_SHELL_START[locale]
  const suffix = RESIDENT_INQUIRY_EMAIL_SHELL_END
  if (raw.startsWith(expectedStart) && raw.endsWith(suffix)) {
    return raw.slice(expectedStart.length, raw.length - suffix.length).trim()
  }
  return fallback
}

/** 내장 템플릿(플레이스홀더). DB에 저장 없을 때 · 초기화 시 사용 */
export const BUILTIN_RESIDENT_INQUIRY_EMAIL_TEMPLATES: Record<
  ResidentInquiryEmailLocale,
  { subject: string; html: string }
> = {
  en: {
    subject: `[Action required] US residency / Annual Pass & NPS fee — Ref. {{CHANNEL_RN}}`,
    html: mergeResidentInquiryEmailDocumentFromBody('en', BUILTIN_RESIDENT_INQUIRY_EMAIL_BODY_HTML.en),
  },
  ko: {
    subject: `[회신 요청] 미국 거주·연간 패스·NPS 추가 요금·결제 안내 (예약 RN {{CHANNEL_RN}})`,
    html: mergeResidentInquiryEmailDocumentFromBody('ko', BUILTIN_RESIDENT_INQUIRY_EMAIL_BODY_HTML.ko),
  },
}

export function getBuiltinResidentInquiryEmailTemplate(
  locale: ResidentInquiryEmailLocale,
  tourKind: ResidentInquiryEmailTourKind
): { subject: string; html: string } {
  const bodyInner = builtinResidentInquiryBodyHtml(locale, tourKind)
  const subject =
    tourKind === 'multi_day'
      ? locale === 'en'
        ? `[Action required] US residency / Non-resident pass & NPS fee (multi-day tour) — Ref. {{CHANNEL_RN}}`
        : `[회신 요청] 거주·비거주 연간 패스·NPS 요금·결제 안내 (숙박·멀티데이 투어) (예약 RN {{CHANNEL_RN}})`
      : BUILTIN_RESIDENT_INQUIRY_EMAIL_TEMPLATES[locale].subject
  return {
    subject,
    html: mergeResidentInquiryEmailDocumentFromBody(locale, bodyInner),
  }
}

/**
 * 플레이스홀더 치환:
 * {{CUSTOMER_NAME}}, {{PRODUCT_NAME}}, {{TOUR_DATE}}, {{CHANNEL_RN}} (HTML 이스케이프),
 * 제목의 {{CHANNEL_RN}}은 일반 텍스트,
 * {{FLOW_LINK_BLOCK}} 은 HTML 그대로 삽입(발송 시 실제 링크 포함).
 */
export function substituteResidentInquiryEmailTemplate(
  subjectTpl: string,
  htmlTpl: string,
  params: BuildResidentInquiryEmailParams
): { subject: string; html: string } {
  const locale = params.locale
  const refPlain = params.channelReference?.trim() || (locale === 'en' ? 'N/A' : '—')
  const name = escapeHtml(params.customerName || (locale === 'en' ? 'Guest' : '고객'))
  const product = escapeHtml(params.productName || (locale === 'en' ? 'Tour' : '투어'))
  const tour = escapeHtml(formatTourLineForResidentEmail(params.tourDate, locale))
  const rnHtml = escapeHtml(refPlain)
  const flowBlock = buildFlowLinkBlockHtml(params.residentCheckAbsoluteUrl, locale)

  const subject = subjectTpl.replace(/\{\{CHANNEL_RN\}\}/g, refPlain)
  const html = htmlTpl
    .replace(/\{\{FLOW_LINK_BLOCK\}\}/g, flowBlock)
    .replace(/\{\{CUSTOMER_NAME\}\}/g, name)
    .replace(/\{\{PRODUCT_NAME\}\}/g, product)
    .replace(/\{\{TOUR_DATE\}\}/g, tour)
    .replace(/\{\{CHANNEL_RN\}\}/g, rnHtml)

  return { subject, html }
}

/**
 * 국립공원(NPS) 거주·연간 패스·추가 입장료·결제 안내 — 내장 템플릿 기준.
 */
export function buildResidentInquiryEmail(
  params: BuildResidentInquiryEmailParams
): { subject: string; html: string } {
  const builtin = getBuiltinResidentInquiryEmailTemplate(params.locale, params.emailTourKind ?? 'day_tour')
  return substituteResidentInquiryEmailTemplate(builtin.subject, builtin.html, params)
}

export function siteUrlForEmail(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (u) return u.replace(/\/$/, '')
  const v = process.env.VERCEL_URL?.trim()
  if (v) return v.startsWith('http') ? v.replace(/\/$/, '') : `https://${v.replace(/\/$/, '')}`
  return ''
}
