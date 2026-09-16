/** Lower Antelope / Antelope X 운영자 제출용 인쇄 양식 */

export const LOWER_ANTELOPE_ROWS_PER_PAGE = 25
export const ANTELOPE_X_ROWS_PER_PAGE = 18
export const MANIA_WAIVER_ROWS_PER_PAGE = 18
export const CANYON_WAIVER_COMPANY_NAME = 'LAS VEGAS MANIA TOUR'

export type CanyonWaiverPrintGuest = {
  id: string
  reservationId: string
  printName: string
  signatureUrl: string | null
  country: string
  receiptNumber: string
  isMinor: boolean
  age: number | null
  guardianName: string | null
}

export type CanyonWaiverPrintPacket = {
  canyon: 'L' | 'X' | 'M'
  companyName: string
  date: string
  tourTime: string
  adultCount: number
  minorCount: number
  guideName: string
  guidePhone: string
  guideSignatureUrl: string | null
  guests: CanyonWaiverPrintGuest[]
}

export type CanyonWaiverPrintTourPayload = {
  tourId: string
  tourDate: string
  mania?: CanyonWaiverPrintPacket | null
  lower: CanyonWaiverPrintPacket | null
  canyonX: CanyonWaiverPrintPacket | null
  /** 예약별 L/X — 인쇄 모달 배지용 (서버에서 이미 해석) */
  canyonKeysByReservationId?: Record<string, Array<'X' | 'L'>>
}

/** 한 장 양면: 앞면 서명 폼(홀수), 뒷면 waiver(짝수) */
export function antelopeXDuplexPageNumber(formPageIndex: number, side: 'form' | 'waiver'): number {
  return Math.max(0, formPageIndex) * 2 + (side === 'form' ? 1 : 2)
}

export function trimPrintText(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function latinLetterRatio(value: string): number {
  const compact = value.replace(/\s+/g, '')
  if (!compact) return 0
  const latin = compact.replace(/[^A-Za-z\u00C0-\u024F'.-]/g, '')
  return latin.length / compact.length
}

function extractParentheticalLatin(value: string): string | null {
  const match = value.match(/\(([A-Za-z][A-Za-z\s.'-]{1,80})\)/)
  const inner = trimPrintText(match?.[1])
  return inner && latinLetterRatio(inner) >= 0.7 ? inner : null
}

/** PRINT NAME 칸: 영문 법적 이름·name_en을 우선하고, 없으면 괄호 영문/기존 이름 */
export function pickEnglishPrintName(input: {
  fullLegalName?: string | null
  nameEn?: string | null
  name?: string | null
  placeholder?: string | null
}): string {
  const legal = trimPrintText(input.fullLegalName)
  const nameEn = trimPrintText(input.nameEn)
  const name = trimPrintText(input.name)
  const placeholder = trimPrintText(input.placeholder)
  const fromParen = name ? extractParentheticalLatin(name) : null

  const ranked = [legal, nameEn, fromParen, name, placeholder].filter((s): s is string => Boolean(s))
  const latinFirst = ranked.find((s) => latinLetterRatio(s) >= 0.6 && !isPlaceholderGuestLabel(s))
  const chosen = latinFirst || ranked.find((s) => !isPlaceholderGuestLabel(s)) || ''
  return chosen.toUpperCase()
}

export function isPlaceholderGuestLabel(value: string | null | undefined): boolean {
  return /^guest\s*\d+$/i.test(trimPrintText(value))
}

/** 대표자 1행 + 동행자 수만큼 빈 칸 */
export function buildLeadCompanionRoster(input: {
  reservationId: string
  partySize: number
  leadId?: string | null
  leadName: string
  leadSignatureUrl?: string | null
  leadIsMinor?: boolean
  leadAge?: number | null
  leadGuardianName?: string | null
}): CanyonWaiverPrintGuest[] {
  const size = Math.max(1, Math.floor(Number(input.partySize) || 1))
  const leadName = isPlaceholderGuestLabel(input.leadName) ? '' : trimPrintText(input.leadName)
  const lead: CanyonWaiverPrintGuest = {
    id: input.leadId || `${input.reservationId}:lead`,
    reservationId: input.reservationId,
    printName: leadName,
    signatureUrl: leadName ? input.leadSignatureUrl ?? null : null,
    country: '',
    receiptNumber: '',
    isMinor: input.leadIsMinor ?? false,
    age: input.leadAge ?? null,
    guardianName: input.leadGuardianName ?? null,
  }
  const companions: CanyonWaiverPrintGuest[] = []
  for (let i = 1; i < size; i += 1) {
    companions.push({
      id: `${input.reservationId}:companion:${i}`,
      reservationId: input.reservationId,
      printName: '',
      signatureUrl: null,
      country: '',
      receiptNumber: '',
      isMinor: false,
      age: null,
      guardianName: null,
    })
  }
  return [lead, ...companions]
}

const LANGUAGE_COUNTRY: Array<{ test: RegExp; country: string }> = [
  { test: /^(ko|kr|korean)\b/i, country: 'Korea' },
  { test: /^(ja|jp|japanese)\b/i, country: 'Japan' },
  { test: /^(zh|cn|chinese)\b/i, country: 'China' },
  { test: /^(en|english|us)\b/i, country: 'USA' },
  { test: /^(es|spanish)\b/i, country: 'Spain' },
  { test: /^(fr|french)\b/i, country: 'France' },
  { test: /^(de|german)\b/i, country: 'Germany' },
  { test: /^(it|italian)\b/i, country: 'Italy' },
  { test: /^(pt|portuguese)\b/i, country: 'Portugal' },
  { test: /^(th|thai)\b/i, country: 'Thailand' },
  { test: /^(vi|vietnamese)\b/i, country: 'Vietnam' },
  { test: /^(id|indonesian)\b/i, country: 'Indonesia' },
  { test: /^(ms|malay)\b/i, country: 'Malaysia' },
  { test: /^(ph|filipino|tl|tagalog)\b/i, country: 'Philippines' },
  { test: /^(tw|taiwan)/i, country: 'Taiwan' },
  { test: /^(hk|hong)/i, country: 'Hong Kong' },
]

export function countryFromCustomerLanguage(language: string | null | undefined): string {
  const raw = trimPrintText(language)
  if (!raw) return ''
  const hit = LANGUAGE_COUNTRY.find((row) => row.test.test(raw))
  return hit?.country ?? ''
}

export function pickReusableWaiverSignature(input: {
  canyonSignatureUrl?: string | null
  maniaSignatureUrl?: string | null
  guardianSignatureUrl?: string | null
  isMinor?: boolean
}): string | null {
  if (input.isMinor && input.guardianSignatureUrl) return input.guardianSignatureUrl
  return input.canyonSignatureUrl || input.maniaSignatureUrl || input.guardianSignatureUrl || null
}

export function formatCanyonFormDate(raw: string | null | undefined): string {
  const value = trimPrintText(raw)
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
  return value
}

export function formatCanyonFormTime(raw: string | null | undefined): string {
  const value = trimPrintText(raw)
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return value
  let hour = Number(match[1])
  if (!Number.isFinite(hour)) return value
  const minute = match[2]
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${suffix}`
}

export function chunkPrintGuests<T>(guests: T[], size: number): T[][] {
  const rowsPerPage = Math.max(1, size)
  if (guests.length === 0) return [[]]
  const chunks: T[][] = []
  for (let i = 0; i < guests.length; i += rowsPerPage) {
    chunks.push(guests.slice(i, i + rowsPerPage))
  }
  return chunks
}

export function padPrintRows<T>(rows: T[], size: number): Array<T | null> {
  const out: Array<T | null> = [...rows]
  while (out.length < size) out.push(null)
  return out.slice(0, size)
}

export function ageOnTourDate(dateOfBirth: string | null | undefined, tourDate: string | null | undefined): number | null {
  if (!dateOfBirth || !tourDate) return null
  const tour = Date.parse(`${tourDate}T00:00:00Z`)
  const birth = Date.parse(`${dateOfBirth}T00:00:00Z`)
  if (!Number.isFinite(tour) || !Number.isFinite(birth) || tour < birth) return null
  return Math.floor((tour - birth) / (365.25 * 24 * 3600 * 1000))
}

export function antelopeXPrintName(guest: CanyonWaiverPrintGuest | null): string {
  if (!guest?.printName) return ''
  if (guest.isMinor) {
    const age = guest.age != null ? String(guest.age) : '—'
    return `${guest.printName} — AGE ${age}`
  }
  return guest.printName
}

export function getCanyonWaiverPrintStyles(): string {
  return `
    .cwf-page { box-sizing: border-box; color: #111; }
    .cwf-page *, .cwf-page *::before, .cwf-page *::after { box-sizing: border-box; }
    .cwf-page img { max-width: 100%; }
    .cwf-sig-ink { display: inline-flex; align-items: flex-end; max-width: 100%; }
    .cwf-sig {
      display: block;
      max-height: 32px;
      width: auto;
      object-fit: contain;
      object-position: left bottom;
      filter: grayscale(1) contrast(700%) brightness(0.92);
      mix-blend-mode: multiply;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cwf-page-break { margin-top: 28px; padding-top: 20px; border-top: 2px dashed #d1d5db; }

    .mania-page { box-sizing: border-box; color: #111; background: #fff; }
    .mania-doc { color: #111; font-family: "Times New Roman", Times, serif; font-size: 10.5px; line-height: 1.38; }
    .mania-doc .mania-op { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 6px; }
    .mania-doc h2 { font-size: 15px; font-weight: 800; margin: 0 0 8px; line-height: 1.25; }
    .mania-doc .mania-warn { border: 1.5px solid #111; padding: 6px 8px; font-weight: 700; margin: 0 0 10px; }
    .mania-doc p { margin: 0 0 7px; color: #111; }
    .mania-doc h3 { font-size: 11.5px; font-weight: 800; margin: 10px 0 4px; page-break-after: avoid; }
    .mania-doc ul { margin: 0 0 8px; padding-left: 16px; }
    .mania-doc li { margin: 0 0 3px; color: #111; }
    .mania-meta { font-size: 12px; margin: 0 0 12px; font-family: "Times New Roman", Times, serif; }
    .mania-sig-page { padding-top: 4px; font-family: "Times New Roman", Times, serif; }
    .mania-sig-page h2 { font-size: 16px; font-weight: 800; margin: 0 0 10px; letter-spacing: 0.04em; }
    .mania-sig-table { width: 100%; border-collapse: collapse; background: #fff; }
    .mania-sig-table th, .mania-sig-table td { border: 1px solid #111; padding: 3px 6px; height: 36px; font-size: 11px; vertical-align: middle; }
    .mania-sig-table th { font-weight: 700; text-align: center; height: 24px; }
    .mania-sig-table td.mania-num { width: 32px; text-align: center; }
    .mania-sig-table td.mania-name { font-weight: 700; letter-spacing: 0.02em; }
    .mania-sig-table td.mania-sig { width: 220px; }
    .mania-sig-table .cwf-sig { max-height: 30px; }

    .lac-page {
      width: 100%;
      min-height: 10.2in;
      padding: 10px 14px 12px;
      background: #f6e9a0;
      color: #111;
      font-family: "Times New Roman", Times, serif;
      break-inside: avoid;
      page-break-inside: avoid;
      position: relative;
    }
    .lac-preview-note {
      position: absolute;
      top: 4px;
      left: 14px;
      right: 14px;
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #7a6410;
      font-family: ui-sans-serif, system-ui, sans-serif;
      pointer-events: none;
    }
    .lac-top { display: grid; grid-template-columns: 108px 1fr 150px; align-items: start; gap: 8px; }
    .lac-logo { text-align: center; line-height: 1.05; padding-top: 0; }
    .lac-logo img { width: 96px; height: 96px; object-fit: contain; display: block; margin: 0 auto; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .lac-title { text-align: center; font-size: 34px; font-weight: 800; letter-spacing: 0.12em; margin: 6px 0 0; }
    .lac-meta { text-align: right; font-size: 13px; line-height: 1.7; padding-top: 6px; }
    .lac-company { margin: 6px 0 8px; font-size: 14px; }
    .lac-company .lac-fill { display: inline-block; min-width: 72%; border-bottom: 1px solid #111; padding: 0 6px; font-weight: 700; }
    .lac-waiver { font-size: 12.5px; font-weight: 700; margin: 0 0 10px; }
    .lac-ops { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 8px; }
    .lac-ops .lac-sign-line { border-bottom: 1px solid #111; min-height: 28px; font-family: "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive; font-size: 20px; padding: 0 8px 2px; }
    .lac-ops .lac-sign-label { font-size: 11px; text-align: center; margin-top: 2px; }
    .lac-table { width: 100%; border-collapse: collapse; background: #fff8c8; }
    .lac-table th, .lac-table td { border: 1px solid #111; font-size: 11px; padding: 0 4px; height: 27px; vertical-align: middle; }
    .lac-table th { font-weight: 700; text-align: center; height: 22px; background: #f6e9a0; }
    .lac-table td.lac-num { width: 28px; text-align: center; }
    .lac-table td.lac-rn { width: 88px; font-family: ui-monospace, Menlo, monospace; font-size: 10px; }
    .lac-table td.lac-name { font-weight: 700; letter-spacing: 0.02em; }
    .lac-table td.lac-sig { width: 150px; }
    .lac-table td.lac-country { width: 72px; text-align: center; }
    .lac-table .lac-sig-img { max-height: 26px; }
    .lac-foot { display: flex; justify-content: space-between; margin-top: 10px; font-size: 13px; }

    .acx-page {
      width: 100%;
      min-height: 10.2in;
      padding: 18px 22px 16px;
      background: #fff;
      color: #111;
      font-family: "Times New Roman", Times, serif;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .acx-title { text-align: center; font-size: 22px; font-weight: 800; letter-spacing: 0.04em; margin: 0 0 16px; }
    .acx-field { font-size: 14px; margin: 0 0 9px; line-height: 1.35; }
    .acx-field .acx-line { display: inline-block; border-bottom: 1px solid #111; min-width: 12px; padding: 0 6px 1px; font-weight: 700; }
    .acx-row { display: flex; gap: 28px; }
    .acx-row .acx-field { flex: 1; }
    .acx-note { font-size: 13px; line-height: 1.45; margin: 14px 0 16px; }
    .acx-guest { display: flex; align-items: flex-end; gap: 10px; font-size: 13px; margin: 0 0 9px; min-height: 32px; }
    .acx-guest .acx-idx { width: 22px; flex-shrink: 0; }
    .acx-guest .acx-name { flex: 1.35; display: flex; align-items: flex-end; gap: 6px; min-width: 0; }
    .acx-guest .acx-sig { flex: 1; display: flex; align-items: flex-end; gap: 6px; min-width: 0; }
    .acx-guest .acx-fill { flex: 1; border-bottom: 1px solid #111; min-height: 26px; display: flex; align-items: flex-end; padding: 0 4px 1px; font-weight: 700; letter-spacing: 0.02em; }
    .acx-page-num { text-align: right; margin-top: 18px; font-size: 13px; }
    .acx-guide-sig { max-height: 36px; }

    .acx-waiver-page {
      width: 100%;
      min-height: 10.2in;
      padding: 14px 18px 12px;
      background: #fff;
      color: #111;
      font-family: "Times New Roman", Times, serif;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .acx-waiver-doc { font-size: 10.5px; line-height: 1.34; color: #111; }
    .acx-waiver-doc .acx-waiver-op { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 6px; }
    .acx-waiver-doc h2 { font-size: 15px; font-weight: 800; margin: 0 0 6px; line-height: 1.25; }
    .acx-waiver-doc .acx-waiver-sub { font-size: 11.5px; font-weight: 700; margin: 0 0 8px; }
    .acx-waiver-doc .acx-waiver-warn { border: 1.5px solid #111; padding: 6px 8px; font-weight: 700; margin: 0 0 8px; }
    .acx-waiver-doc p { margin: 0 0 6px; color: #111; }
    .acx-waiver-doc h3 { font-size: 11.5px; font-weight: 800; margin: 8px 0 3px; page-break-after: avoid; }
    .acx-waiver-doc ul { margin: 0 0 6px; padding-left: 16px; }
    .acx-waiver-doc li { margin: 0 0 3px; color: #111; }
    .acx-waiver-doc .acx-waiver-meta { font-size: 11px; margin: 0 0 8px; }
    .acx-sheet-side {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #6b7280;
      margin: 0 0 8px;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    @media print {
      .lac-page, .acx-page, .acx-waiver-page, .mania-page { min-height: auto; }
      .lac-page { background: transparent !important; }
      .lac-preview-note { display: none !important; }
      .lac-chrome { visibility: hidden !important; }
      .lac-table, .lac-table th, .lac-table td {
        background: transparent !important;
        border-color: transparent !important;
      }
      .lac-table td.lac-ink {
        visibility: visible !important;
        color: #111 !important;
      }
      .lac-table td.lac-ink img,
      .lac-table td.lac-ink .cwf-sig {
        visibility: visible !important;
      }
      .cwf-page-break { margin-top: 0; padding-top: 0; border-top: none; break-before: page; page-break-before: always; }
      .acx-duplex-start { break-before: right; page-break-before: right; }
      .acx-sheet-side { display: none !important; }
      .cwf-sig {
        filter: grayscale(1) contrast(900%) brightness(0.85);
        mix-blend-mode: multiply;
      }
    }
  `
}
