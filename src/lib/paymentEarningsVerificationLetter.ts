export type PaymentEarningsVerificationLetterInput = {
  employeeName: string
  employeeNameKo?: string | null
  email: string
  phone: string
  position: string
  hireDate: string | null
  isActive: boolean
  startDate: string
  endDate: string
  hourlyRate: string | null
  totalHours: number
  attendancePay: number
  guideFee: number
  tipsShare: number
  reviewBonus: number
  totalPay: number
  showHourlyRate: boolean
  logoUrl: string
}

export function escapeLetterHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatUsLongDateFromYmd(ymd: string): string {
  const [y, mo, d] = (ymd || '').split('-').map((n) => parseInt(n, 10))
  if (!y || !mo || !d) return ymd || '—'
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatUsLongDateTodayLasVegas(): string {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatHoursMinutesEn(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  const hourPart = h === 1 ? '1 hour' : `${h} hours`
  const minPart = m === 1 ? '1 minute' : `${m} minutes`
  return `${hourPart} ${minPart}`
}

export function positionToEnglish(position: string | null | undefined): string {
  const p = (position || '').toLowerCase().trim()
  if (p === '가이드' || p === 'guide' || p === 'tour guide') return 'Tour Guide'
  if (p === '드라이버' || p === 'driver') return 'Driver'
  if (p === 'office manager') return 'Office Manager'
  if (p === 'op') return 'Operations'
  return position?.trim() || 'Employee'
}

function formatUsd(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}$${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function metaRow(label: string, value: string): string {
  return `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`
}

export function buildPaymentEarningsVerificationLetterHtml(
  input: PaymentEarningsVerificationLetterInput
): string {
  const name = escapeLetterHtml(input.employeeName || '—')
  const nameKo = input.employeeNameKo?.trim()
  const nameLine =
    nameKo && nameKo !== input.employeeName
      ? `${name} (${escapeLetterHtml(nameKo)})`
      : name
  const email = escapeLetterHtml(input.email || '—')
  const phone = escapeLetterHtml(input.phone?.trim() || '—')
  const position = escapeLetterHtml(positionToEnglish(input.position))
  const hireDate = input.hireDate ? formatUsLongDateFromYmd(input.hireDate) : 'On file'
  const periodStart = formatUsLongDateFromYmd(input.startDate)
  const periodEnd = formatUsLongDateFromYmd(input.endDate)
  const issued = formatUsLongDateTodayLasVegas()
  const employmentStatus = input.isActive ? 'Currently Employed' : 'Former Employee'
  const hourlyRate =
    input.showHourlyRate && input.hourlyRate && !Number.isNaN(Number(input.hourlyRate))
      ? formatUsd(Number(input.hourlyRate))
      : null
  const tipsAndBonus = input.tipsShare + input.reviewBonus
  const logoSrc = escapeLetterHtml(input.logoUrl)

  const earningsRows = [
    input.showHourlyRate
      ? `<tr><td>Attendance / Hourly Wages</td><td class="num">${formatUsd(input.attendancePay)}</td></tr>`
      : '',
    `<tr><td>Guide Fees</td><td class="num">${formatUsd(input.guideFee)}</td></tr>`,
    `<tr><td>Tips Share / Review Bonus</td><td class="num">${formatUsd(tipsAndBonus)}</td></tr>`,
  ]
    .filter(Boolean)
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment &amp; Earnings Verification Letter</title>
  <style>
    @page { size: letter; margin: 0.5in 0.65in; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Times New Roman", Times, Georgia, serif;
      color: #111827;
      font-size: 11pt;
      line-height: 1.32;
      background: #fff;
    }
    .letter {
      max-width: 7.2in;
      margin: 0 auto;
      page-break-inside: avoid;
    }
    .letterhead {
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .letterhead img {
      height: 52px;
      width: auto;
      max-width: 140px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .letterhead .brand { min-width: 0; }
    .letterhead .company {
      font-size: 15pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      margin: 0 0 2px;
      line-height: 1.15;
    }
    .letterhead p { margin: 0; font-size: 9pt; color: #334155; line-height: 1.3; }
    .date { text-align: right; margin: 0 0 8px; font-size: 10.5pt; }
    .subject {
      text-align: center;
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin: 0 0 28px;
    }
    .salutation { margin: 0 0 8px; }
    p { margin: 0 0 8px; }
    .meta, .earnings { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
    .meta td { padding: 2px 8px 2px 0; vertical-align: top; font-size: 10.5pt; }
    .meta td.label { width: 34%; color: #334155; }
    .meta td.value { font-weight: 600; }
    .earnings th, .earnings td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      font-size: 10.5pt;
    }
    .earnings th { background: #f8fafc; text-align: left; font-weight: 700; }
    .earnings td.num, .earnings th.num { text-align: right; white-space: nowrap; }
    .earnings tr.total td { font-weight: 700; background: #f1f5f9; }
    .closing { margin-top: 12px; }
    .sign { margin-top: 22px; }
    .sign-line { border-bottom: 1px solid #111827; width: 220px; height: 22px; margin-bottom: 3px; }
    .sign p { margin: 0; font-size: 10.5pt; line-height: 1.3; }
    .footer-note { margin-top: 12px; font-size: 8.5pt; color: #64748b; }
    @media print {
      html, body { height: auto; overflow: hidden; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .letter { page-break-after: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="letter">
    <div class="letterhead">
      <img src="${logoSrc}" alt="Las Vegas Mania Tour">
      <div class="brand">
        <div class="company">LAS VEGAS MANIA TOUR</div>
        <p>3351 South Highland Drive, Las Vegas, Nevada 89109, United States</p>
        <p>info@maniatour.com &nbsp;|&nbsp; +1 702-929-8025 / +1 702-444-5531</p>
      </div>
    </div>
    <p class="date">${escapeLetterHtml(issued)}</p>
    <h1 class="subject">Payment &amp; Earnings Verification Letter</h1>
    <p class="salutation">To Whom It May Concern:</p>
    <p>
      This letter verifies the employment and earnings of the individual named below.
      Amounts are gross earnings recorded by Las Vegas Mania Tour for the pay period indicated.
    </p>
    <table class="meta">
      ${metaRow('Employee Name', nameLine)}
      ${metaRow('Position', position)}
      ${metaRow('Employment Status', employmentStatus)}
      ${metaRow('Employment Start Date', escapeLetterHtml(hireDate))}
      ${metaRow('Email', email)}
      ${metaRow('Phone', phone)}
      ${metaRow('Pay Period', `${escapeLetterHtml(periodStart)} through ${escapeLetterHtml(periodEnd)}`)}
      ${metaRow('Payment Frequency', 'Biweekly')}
      ${hourlyRate ? metaRow('Hourly Rate', hourlyRate) : ''}
      ${
        input.showHourlyRate
          ? metaRow('Hours Worked This Period', escapeLetterHtml(formatHoursMinutesEn(input.totalHours)))
          : ''
      }
    </table>
    <table class="earnings">
      <thead>
        <tr>
          <th>Earnings Category</th>
          <th class="num">Amount (USD)</th>
        </tr>
      </thead>
      <tbody>
        ${earningsRows}
        <tr class="total">
          <td>Total Gross Earnings</td>
          <td class="num">${formatUsd(input.totalPay)}</td>
        </tr>
      </tbody>
    </table>
    <p>
      This information is provided at the request of the employee. Please contact our office with any questions.
    </p>
    <div class="closing">
      <p>Sincerely,</p>
      <div class="sign">
        <div class="sign-line"></div>
        <p><strong>Authorized Representative</strong></p>
        <p>Las Vegas Mania Tour</p>
      </div>
    </div>
    <p class="footer-note">
      Issued in Las Vegas, Nevada. This letter confirms recorded earnings for the stated period and does not constitute a tax document.
    </p>
  </div>
</body>
</html>`
}
