export type ResidentInquiryEmailLocale = 'ko' | 'en'

export type BuildResidentInquiryEmailParams = {
  customerName: string
  tourDate: string | null | undefined
  productName: string
  channelReference: string | null | undefined
  /** Full URL to customer pass / proof upload page; if empty, copy omits anchor */
  passUploadAbsoluteUrl: string
  locale: ResidentInquiryEmailLocale
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null || s === '') return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatTourLine(
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
 * Grand Canyon 등 거주·연간 패스·결제 수단 안내용 고객 회신 요청 이메일 HTML.
 */
export function buildResidentInquiryEmail(
  params: BuildResidentInquiryEmailParams
): { subject: string; html: string } {
  const {
    customerName,
    tourDate,
    productName,
    channelReference,
    passUploadAbsoluteUrl,
    locale,
  } = params

  const name = escapeHtml(customerName || (locale === 'en' ? 'Guest' : '고객'))
  const product = escapeHtml(productName || (locale === 'en' ? 'Tour' : '투어'))
  const tour = escapeHtml(formatTourLine(tourDate, locale))
  const refPlain = channelReference?.trim() || (locale === 'en' ? 'N/A' : '—')
  const rn = escapeHtml(refPlain)

  const uploadUrl = passUploadAbsoluteUrl.trim()
  const uploadLink =
    uploadUrl.length > 0
      ? `<a href="${escapeHtml(uploadUrl)}" style="color:#1d4ed8;">${escapeHtml(uploadUrl)}</a>`
      : locale === 'en'
        ? '<em>(Please log in to your customer dashboard and use the Pass / proof upload page.)</em>'
        : '<em>(고객 대시보드 로그인 후 패스·증빙 업로드 메뉴를 이용해 주세요.)</em>'

  if (locale === 'en') {
    const subject = `[Action required] US residency / Annual Pass & payment — Ref. ${refPlain}`
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px 28px;">
    <p style="margin:0 0 16px;">Hello ${name},</p>
    <p style="margin:0 0 16px;">To complete your reservation and park entry arrangements, please <strong>reply to this email</strong> and indicate your situation using the checklist below (you may type e.g. “X” next to the line that applies, or describe in your own words).</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>Booking:</strong> ${product}<br/><strong>Tour date:</strong> ${tour}<br/><strong>Reference:</strong> ${rn}</p>

    <h2 style="font-size:16px;margin:24px 0 10px;">1) Residency</h2>
    <ul style="margin:0;padding-left:0;list-style:none;">
      <li style="margin:8px 0;">☐ <strong>US Resident</strong> — If this applies, please attach a clear photo or scan of proof (e.g. state ID or other residency documentation).</li>
      <li style="margin:8px 0;">☐ <strong>Non-US Resident</strong></li>
    </ul>

    <h2 style="font-size:16px;margin:24px 0 10px;">2) If you are a <strong>Non-US Resident</strong></h2>
    <ul style="margin:0;padding-left:0;list-style:none;">
      <li style="margin:8px 0;">☐ <strong>I already have</strong> an America the Beautiful / National Parks <strong>Annual Pass</strong> — please upload a <strong>clear photo</strong> of the pass.<br/><span style="font-size:14px;color:#334155;">Upload page: ${uploadLink}</span></li>
      <li style="margin:8px 0;">☐ <strong>I do not</strong> have an Annual Pass yet.</li>
      <li style="margin:8px 0;">☐ I would like <strong>purchase assistance</strong> for a <strong>Non-Resident Annual Pass</strong> (our team purchases the pass on your behalf). We will follow up with the amount and timing.</li>
    </ul>

    <h2 style="font-size:16px;margin:24px 0 10px;">3) Payment methods <span style="font-weight:600;color:#b45309;">(if Non-US Resident, or if you requested pass purchase assistance)</span></h2>
    <p style="margin:0 0 10px;font-size:14px;color:#475569;">Please choose one and mention it in your reply:</p>
    <ul style="margin:0;padding-left:0;list-style:none;">
      <li style="margin:8px 0;">☐ <strong>1. Cash</strong></li>
      <li style="margin:8px 0;">☐ <strong>2. Card payment</strong> — a <strong>5% card processing fee</strong> applies in addition to the tour amount.</li>
    </ul>

    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">Thank you,<br/>Maniatour Team</p>
  </div>
</body>
</html>`
    return { subject, html }
  }

  const subject = `[회신 요청] 미국 거주 여부·연간 패스·결제 안내 (예약 RN ${refPlain})`
  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:'Malgun Gothic',system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px 28px;">
    <p style="margin:0 0 16px;">안녕하세요, ${name}님</p>
    <p style="margin:0 0 16px;">예약 확정 및 국립공원 입장 준비를 위해, 아래 항목을 확인하시고 <strong>본 이메일에 회신</strong>해 주시기 바랍니다. (☐ 옆에 해당 사항을 표시하시거나, 짧게 문장으로 적어 주셔도 됩니다.)</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>상품:</strong> ${product}<br/><strong>투어일:</strong> ${tour}<br/><strong>예약 번호(RN):</strong> ${rn}</p>

    <h2 style="font-size:16px;margin:24px 0 10px;">1) 거주 여부</h2>
    <ul style="margin:0;padding-left:0;list-style:none;">
      <li style="margin:8px 0;">☐ <strong>미국 거주자 (US Resident)</strong> — 해당 시 신분증 등 <strong>거주·신분 증빙 사진</strong>을 첨부해 주세요.</li>
      <li style="margin:8px 0;">☐ <strong>비거주자 (Non-US Resident)</strong></li>
    </ul>

    <h2 style="font-size:16px;margin:24px 0 10px;">2) <strong>비거주자</strong>이신 경우</h2>
    <ul style="margin:0;padding-left:0;list-style:none;">
      <li style="margin:8px 0;">☐ <strong>연간 패스(Annual Pass) 보유</strong> — 패스 <strong>사진 업로드</strong>를 부탁드립니다.<br/><span style="font-size:14px;color:#334155;">업로드 페이지: ${uploadLink}</span></li>
      <li style="margin:8px 0;">☐ <strong>연간 패스 없음 (Annual Pass 없음)</strong></li>
      <li style="margin:8px 0;">☐ <strong>비거주자 연간 패스 구매 대행</strong> 요청 (당사에서 구매까지 진행) — 금액·진행 일정은 별도 안내드립니다.</li>
    </ul>

    <h2 style="font-size:16px;margin:24px 0 10px;">3) 결제 방법 <span style="font-weight:600;color:#b45309;">(비거주자이시거나, 패스 구매 대행을 선택하신 경우)</span></h2>
    <p style="margin:0 0 10px;font-size:14px;color:#475569;">아래 중 하나를 회신에 적어 주세요.</p>
    <ul style="margin:0;padding-left:0;list-style:none;">
      <li style="margin:8px 0;">☐ <strong>1. 현금</strong></li>
      <li style="margin:8px 0;">☐ <strong>2. 카드결제</strong> — 투어 금액 외에 <strong>카드 수수료 5%</strong>가 별도 부과됩니다.</li>
    </ul>

    <p style="margin:28px 0 0;font-size:14px;color:#64748b;">감사합니다.<br/>마니아투어 드림</p>
  </div>
</body>
</html>`
  return { subject, html }
}

export function siteUrlForEmail(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (u) return u.replace(/\/$/, '')
  const v = process.env.VERCEL_URL?.trim()
  if (v) return v.startsWith('http') ? v.replace(/\/$/, '') : `https://${v.replace(/\/$/, '')}`
  return ''
}
