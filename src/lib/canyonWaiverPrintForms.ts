/** Lower Antelope / Antelope X 운영자 제출용 인쇄 양식 */

export const LOWER_ANTELOPE_ROWS_PER_PAGE = 25
export const ANTELOPE_X_ROWS_PER_PAGE = 18
export const MANIA_WAIVER_ROWS_PER_PAGE = 13
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

/** 한 장 양면: 앞면 waiver(홀수), 뒷면 사인 폼(짝수) */
export function antelopeXDuplexPageNumber(formPageIndex: number, side: 'form' | 'waiver'): number {
  return Math.max(0, formPageIndex) * 2 + (side === 'waiver' ? 1 : 2)
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
  fullLegalName?: string | null | undefined
  nameEn?: string | null | undefined
  name?: string | null | undefined
  placeholder?: string | null | undefined
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

export function samePrintGuestName(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = trimPrintText(a).toUpperCase()
  const right = trimPrintText(b).toUpperCase()
  return Boolean(left) && left === right
}

/** 대표자는 예약 이름으로 채우고, 동행자는 본인 서명이 있을 때만 이름을 넣는다. */
export function printNameForPartySlot(input: {
  isLead: boolean
  hasSignature: boolean
  leadPrintName?: string | null
  fullLegalName?: string | null
  nameEn?: string | null
  name?: string | null
  placeholder?: string | null
}): string {
  const ownName = pickEnglishPrintName({
    fullLegalName: input.fullLegalName,
    nameEn: input.nameEn,
    name: input.name,
    placeholder: input.placeholder,
  })
  if (input.isLead) return ownName
  if (!input.hasSignature || !ownName) return ''
  if (samePrintGuestName(ownName, input.leadPrintName)) return ''
  return ownName
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
    .cwf-sig-ink { display: inline-flex; align-items: flex-end; max-width: 100%; background: transparent; }
    .cwf-sig {
      display: block;
      max-height: 32px;
      width: auto;
      object-fit: contain;
      object-position: left bottom;
      background: transparent;
      filter: none;
      mix-blend-mode: multiply;
      image-rendering: auto;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cwf-page-break { margin-top: 28px; padding-top: 20px; border-top: 2px dashed #d1d5db; }

    .mania-page { box-sizing: border-box; color: #111; background: #fff; }
    .mania-waiver-page { min-height: 10.2in; }
    .mania-page-num { text-align: right; margin-top: 12px; font-size: 12px; }
    .mania-doc { color: #111; font-family: "Times New Roman", Times, serif; font-size: 10px; line-height: 1.32; }
    .mania-doc .mania-op { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 6px; }
    .mania-doc h2 { font-size: 15px; font-weight: 800; margin: 0 0 8px; line-height: 1.25; }
    .mania-doc .mania-warn { border: 1.5px solid #111; padding: 6px 8px; font-weight: 700; margin: 0 0 10px; }
    .mania-doc p { margin: 0 0 7px; color: #111; }
    .mania-doc h3 { font-size: 11px; font-weight: 800; margin: 8px 0 3px; page-break-after: avoid; }
    .mania-doc ul { margin: 0 0 8px; padding-left: 16px; }
    .mania-doc li { margin: 0 0 3px; color: #111; }
    .mania-meta { font-size: 12px; margin: 0 0 12px; font-family: "Times New Roman", Times, serif; }
    .mania-sig-page {
      padding: 0.12in 0.08in 0.2in;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Times New Roman", Times, sans-serif;
      color: #111;
    }
    .mania-sig-head { margin: 0 0 0.28in; font-size: 13px; line-height: 1.7; }
    .mania-sig-head-row {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      margin: 0 0 7px;
      min-height: 1.35em;
    }
    .mania-sig-head-label { flex-shrink: 0; white-space: nowrap; }
    .mania-sig-head-value {
      flex: 1;
      border-bottom: 1px solid #111;
      min-height: 1.2em;
      font-weight: 700;
      letter-spacing: 0.01em;
      padding: 0 4px 1px;
      line-height: 1.2;
    }
    .mania-sig-head-value.mania-sig-blank { font-weight: 400; }
    .mania-sig-mileage {
      color: #d00000;
      font-weight: 700;
      flex: 0 0 auto;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      min-width: 2.8in;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .mania-sig-mileage .mania-sig-head-value {
      min-width: 1.5in;
      border-bottom-color: #d00000;
    }
    .mania-sig-balance-amount {
      color: #d00000;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.02em;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .mania-sig-staff { align-items: flex-end; }
    .mania-sig-staff .mania-sig-head-value { flex: 1.15; }
    .mania-sig-sign-only {
      flex: 1;
      border-bottom: 1px solid #111;
      min-height: 1.2em;
    }
    .mania-sign-list { margin: 0.08in 0 0; }
    .mania-sign-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.45in;
      align-items: flex-end;
      margin: 0 0 9px;
    }
    .mania-sign-field {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      min-width: 0;
    }
    .mania-sign-label { flex-shrink: 0; font-size: 13px; }
    .mania-sign-line {
      flex: 1;
      border-bottom: 1px solid #111;
      min-height: 28px;
      display: flex;
      align-items: flex-end;
      padding: 0 4px 1px;
      font-weight: 700;
      letter-spacing: 0.02em;
      font-size: 13px;
    }
    .mania-sign-line .cwf-sig { max-height: 26px; }

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
      --lac-row-h: 0.79cm;
      --lac-ink-shift-x: 4ch;
      --lac-ink-shift-y: calc(-2 * var(--lac-row-h) + 2mm);
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
    .lac-table { width: 100%; border-collapse: collapse; background: #fff8c8; overflow: visible; table-layout: fixed; }
    .lac-table col.lac-col-num { width: 4%; }
    .lac-table col.lac-col-rn { width: 12%; }
    .lac-table col.lac-col-name { width: 39%; }
    .lac-table col.lac-col-sig { width: 32%; }
    .lac-table col.lac-col-country { width: 13%; }
    .lac-table tbody tr { height: var(--lac-row-h); }
    .lac-table th, .lac-table td { border: 1px solid #111; font-size: 13px; padding: 0 5px; vertical-align: middle; overflow: visible; }
    .lac-table th { font-weight: 700; text-align: center; height: 0.65cm; background: #f6e9a0; }
    .lac-table td { height: var(--lac-row-h); }
    .lac-table td.lac-num { text-align: center; }
    .lac-table td.lac-rn { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
    .lac-table td.lac-name {
      font-weight: 700;
      letter-spacing: 0.05em;
      font-size: 16px;
      padding-left: calc(4px + var(--lac-ink-shift-x));
    }
    .lac-table td.lac-sig {
      background: transparent !important;
      padding-left: 6px;
    }
    .lac-ink-name,
    .lac-ink-sig {
      display: inline-block;
      position: relative;
      left: 0;
      top: var(--lac-ink-shift-y);
      vertical-align: middle;
    }
    .lac-ink-name {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.05em;
      line-height: var(--lac-row-h);
      white-space: nowrap;
      overflow: visible;
    }
    .lac-ink-sig {
      max-width: 100%;
    }
    .lac-table td.lac-country { text-align: center; }
    .lac-table .cwf-sig-ink,
    .lac-table .lac-sig-img {
      background: transparent !important;
      box-shadow: none !important;
    }
    .lac-table .lac-sig-img {
      max-height: 0.3in;
      height: 0.3in;
      max-width: 100%;
      width: auto;
      mix-blend-mode: multiply;
      filter: none;
    }
    .lac-foot { display: flex; justify-content: space-between; margin-top: 10px; font-size: 13px; }

    .acx-page {
      width: 100%;
      min-height: 10.2in;
      padding: 12px 18px 10px;
      background: #fff;
      color: #111;
      font-family: "Times New Roman", Times, serif;
    }
    .acx-title { text-align: center; font-size: 20px; font-weight: 800; letter-spacing: 0.04em; margin: 0 0 10px; }
    .acx-field { font-size: 13px; margin: 0 0 6px; line-height: 1.3; }
    .acx-field .acx-line { display: inline-block; border-bottom: 1px solid #111; min-width: 12px; padding: 0 6px 1px; font-weight: 700; }
    .acx-row { display: flex; gap: 28px; }
    .acx-row .acx-field { flex: 1; }
    .acx-note { font-size: 12px; line-height: 1.35; margin: 8px 0 8px; }
    .acx-guest-list { list-style: none; margin: 10px 0 0; padding: 0; }
    .acx-guest { display: flex; align-items: flex-end; gap: 8px; font-size: 13px; margin: 0 0 6px; min-height: 30px; }
    .acx-guest .acx-idx { width: 22px; flex-shrink: 0; }
    .acx-guest .acx-name { flex: 1.35; display: flex; align-items: flex-end; gap: 6px; min-width: 0; }
    .acx-guest .acx-sig { flex: 1; display: flex; align-items: flex-end; gap: 6px; min-width: 0; }
    .acx-guest .acx-fill { flex: 1; border-bottom: 1px solid #111; min-height: 26px; display: flex; align-items: flex-end; padding: 0 4px 1px; font-weight: 700; letter-spacing: 0.02em; }
    .acx-guest .cwf-sig { max-height: 26px; }
    .acx-page-num { text-align: right; margin-top: 14px; font-size: 12px; }
    .acx-guide-sig { max-height: 32px; }
    .acx-overlay-page {
      position: relative;
      background: #e8eefc;
      --acx-ink-shift-x: 0px;
      --acx-ink-shift-y: 0px;
      --acx-overlay-pad-top: 0.40in;
      --acx-overlay-field-h: 0.24in;
      --acx-overlay-note-h: 1.12in;
      --acx-overlay-date-x: 0.42in;
      --acx-overlay-time-x: 0.55in;
      --acx-overlay-name-x: 0.12in;
      --acx-guest-row: 8mm;
      padding: var(--acx-overlay-pad-top) 0.5in 0.32in;
    }
    .acx-overlay-page .acx-preview-note {
      position: absolute;
      top: 4px;
      left: 18px;
      right: 18px;
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #3b5bdb;
      font-family: ui-sans-serif, system-ui, sans-serif;
      pointer-events: none;
    }
    .acx-overlay-page .acx-title {
      margin: 0 0 0.14in;
      min-height: 0.22in;
      font-size: 16px;
    }
    .acx-overlay-page .acx-field {
      margin: 0;
      min-height: var(--acx-overlay-field-h);
      line-height: var(--acx-overlay-field-h);
      font-size: 14px;
    }
    .acx-overlay-page .acx-row { gap: 0.28in; }
    .acx-overlay-page .acx-note {
      min-height: var(--acx-overlay-note-h);
      margin: 0.08in 0 0.1in;
      font-size: 12px;
      line-height: 1.3;
    }
    .acx-overlay-page .acx-guest-list {
      margin-top: 0.04in;
      position: relative;
      top: -16mm;
    }
    .acx-overlay-page .acx-guest {
      align-items: flex-end;
      min-height: var(--acx-guest-row);
      height: var(--acx-guest-row);
      margin: 0;
      font-size: 13px;
      gap: 6px;
    }
    .acx-overlay-page .acx-guest .acx-fill { min-height: 0.2in; }
    .acx-overlay-page .acx-guest .cwf-sig { max-height: 0.3in; }
    .acx-overlay-page .acx-ink {
      position: relative;
      left: var(--acx-ink-shift-x);
      top: var(--acx-ink-shift-y);
    }
    .acx-overlay-page .acx-overlay-company .acx-ink {
      top: calc(var(--acx-ink-shift-y) - var(--acx-overlay-field-h) + 2mm);
      left: calc(var(--acx-ink-shift-x) + 4ch);
    }
    .acx-overlay-page .acx-overlay-datetime-top .acx-overlay-date .acx-ink {
      top: calc(var(--acx-ink-shift-y) - 2mm);
      left: calc(var(--acx-ink-shift-x) + var(--acx-overlay-date-x));
    }
    .acx-overlay-page .acx-overlay-datetime-top .acx-overlay-time .acx-ink {
      left: calc(var(--acx-ink-shift-x) + var(--acx-overlay-time-x));
    }
    .acx-overlay-page .acx-overlay-adults .acx-ink,
    .acx-overlay-page .acx-overlay-minors .acx-ink {
      top: calc(var(--acx-ink-shift-y) - 6mm);
      left: calc(var(--acx-ink-shift-x) + 10ch + 50mm);
    }
    .acx-overlay-page .acx-overlay-guide-name .acx-ink {
      left: calc(var(--acx-ink-shift-x) + 10ch);
      top: calc(var(--acx-ink-shift-y) + 1mm - 6mm);
    }
    .acx-overlay-page .acx-overlay-guide-phone .acx-ink {
      left: calc(var(--acx-ink-shift-x) + 10ch);
      top: calc(var(--acx-ink-shift-y) + 4mm - 6mm);
    }
    .acx-overlay-page .acx-overlay-datetime-bottom .acx-overlay-date .acx-ink {
      top: calc(var(--acx-ink-shift-y) - 14mm);
      left: calc(var(--acx-ink-shift-x) + var(--acx-overlay-date-x));
    }
    .acx-overlay-page .acx-overlay-datetime-bottom .acx-overlay-time .acx-ink {
      top: calc(var(--acx-ink-shift-y) - 14mm);
      left: calc(var(--acx-ink-shift-x) + var(--acx-overlay-time-x) - 1.5cm - 15mm);
    }
    .acx-overlay-page .acx-guest .acx-name .acx-ink,
    .acx-overlay-page .acx-guest .acx-sig .acx-ink {
      left: calc(var(--acx-ink-shift-x) + var(--acx-overlay-name-x));
      top: calc(var(--acx-ink-shift-y) + 0.04in);
    }

    .acx-waiver-page {
      width: 100%;
      min-height: 10.2in;
      padding: 8px 10px 8px;
      background: #fff;
      color: #111;
      font-family: "Times New Roman", Times, serif;
      position: relative;
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
    .acx-waiver-official {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.42;
      text-align: justify;
    }
    .acx-waiver-official h2 {
      text-align: center;
      text-decoration: underline;
      font-size: 13pt;
      font-weight: 700;
      letter-spacing: 0.03em;
      margin: 0 0 10pt;
      line-height: 1.25;
    }
    .acx-waiver-official .acx-waiver-sub {
      text-align: center;
      font-size: 12pt;
      font-weight: 700;
      margin: 0 0 12pt;
      line-height: 1.32;
      letter-spacing: 0.01em;
    }
    .acx-waiver-official p { margin: 0 0 10pt; }
    .acx-waiver-official ol.acx-waiver-clauses,
    .acx-waiver-official ol {
      list-style: none;
      margin: 4pt 0 12pt;
      padding: 0;
    }
    .acx-waiver-official li {
      display: grid;
      grid-template-columns: 18pt 1fr;
      column-gap: 8pt;
      align-items: start;
      margin: 0 0 9pt;
      text-align: justify;
    }
    .acx-waiver-official .acx-waiver-num {
      font-weight: 700;
      line-height: 1.42;
      text-align: right;
    }
    .acx-waiver-official .acx-waiver-clause { min-width: 0; }
    .acx-waiver-official .acx-waiver-closing {
      font-weight: 700;
      font-size: 12pt;
      line-height: 1.42;
      margin: 8pt 0 0;
      break-after: avoid;
      page-break-after: avoid;
    }
    .acx-waiver-page .acx-page-num {
      position: absolute;
      right: 10px;
      bottom: 4px;
      margin: 0;
      text-align: right;
      font-size: 11pt;
      font-family: "Times New Roman", Times, serif;
      break-before: avoid;
      page-break-before: avoid;
    }
    .acx-sheet-side {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #6b7280;
      margin: 0 0 8px;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .acx-sheet-back, .acx-duplex-start {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 2px dashed #d1d5db;
    }

    @media screen {
      .lac-page {
        display: grid;
        grid-template-columns: 66px 1fr 150px;
        grid-template-areas:
          "logo title date"
          "logo company page"
          "waiver waiver waiver"
          "ops ops ops"
          "table table table"
          "foot foot foot";
        column-gap: 8px;
        row-gap: 2px;
        align-items: center;
        padding-top: 28px;
      }
      .lac-top { display: contents; }
      .lac-logo { grid-area: logo; align-self: center; }
      .lac-logo img {
        width: 62px;
        height: 62px;
        background: transparent;
      }
      .lac-title {
        grid-area: title;
        margin: 0;
        font-size: 28px;
        letter-spacing: 0.1em;
      }
      .lac-meta { display: contents; }
      .lac-meta > div:first-child {
        grid-area: date;
        text-align: right;
        font-size: 13px;
        line-height: 1.4;
      }
      .lac-meta > div:last-child {
        grid-area: page;
        text-align: right;
        font-size: 13px;
        line-height: 1.4;
      }
      .lac-company { grid-area: company; margin: 0; }
      .lac-waiver { grid-area: waiver; margin: 8px 0 6px; }
      .lac-ops { grid-area: ops; margin-bottom: 6px; }
      .lac-table { grid-area: table; }
      .lac-foot { grid-area: foot; }
      .acx-overlay-page { padding-top: calc(var(--acx-overlay-pad-top) + 22px); }
    }

    @media print {
      .lac-page, .acx-page, .acx-waiver-page, .mania-page { min-height: auto; }
      .mania-sig-balance-amount {
        color: #d00000 !important;
        font-size: 22px !important;
        font-weight: 800 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .acx-waiver-page { position: relative; }
      .acx-waiver-page .acx-page-num {
        position: absolute;
        right: 8px;
        bottom: 0;
        margin: 0 !important;
      }
      .lac-page { background: transparent !important; }
      .lac-preview-note { display: none !important; }
      .lac-chrome { visibility: hidden !important; }
      .lac-table, .lac-table th, .lac-table td {
        background: transparent !important;
        border-color: transparent !important;
      }
      .lac-table tbody tr,
      .lac-table tbody td {
        height: var(--lac-row-h) !important;
        min-height: var(--lac-row-h) !important;
      }
      .lac-table,
      .lac-table tbody,
      .lac-table tr,
      .lac-table td {
        overflow: visible !important;
      }
      .lac-table td.lac-ink {
        visibility: visible !important;
        color: #000 !important;
        background: transparent !important;
      }
      .lac-table td.lac-ink img,
      .lac-table td.lac-ink .cwf-sig,
      .lac-table td.lac-ink .cwf-sig-ink,
      .lac-table td.lac-ink .lac-sig-img {
        visibility: visible !important;
        background: transparent !important;
        mix-blend-mode: multiply;
        filter: none !important;
        max-height: 0.3in !important;
        height: 0.3in !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .cwf-page-break { margin-top: 0; padding-top: 0; border-top: none; break-before: page; page-break-before: always; }
      .acx-duplex-start { break-before: page; page-break-before: always; }
      .mania-duplex-start { break-before: right; page-break-before: right; }
      .acx-sheet-front {
        margin-top: 0;
        padding-top: 0;
        border-top: none;
        break-after: page;
        page-break-after: always;
        break-inside: avoid;
        page-break-inside: avoid;
        overflow: hidden;
      }
      .acx-sheet-back, .acx-duplex-start {
        margin-top: 0;
        padding-top: 0;
        border-top: none;
      }
      .acx-sheet-back {
        break-before: auto;
        page-break-before: auto;
        break-inside: avoid;
        page-break-inside: avoid;
        overflow: hidden;
      }
      .acx-page, .acx-waiver-page {
        overflow: hidden;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .acx-waiver-official { font-size: 11pt; line-height: 1.34; }
      .acx-waiver-official h2 { font-size: 12pt; margin: 0 0 6pt; }
      .acx-waiver-official .acx-waiver-sub { font-size: 11pt; margin: 0 0 8pt; }
      .acx-waiver-official p { margin: 0 0 7pt; }
      .acx-waiver-official li { margin: 0 0 6pt; }
      .acx-waiver-official .acx-waiver-closing { margin: 4pt 0 0; font-size: 11pt; }
      .acx-sheet-side { display: none !important; }
      .acx-overlay-page { background: transparent !important; }
      .acx-overlay-page .acx-preview-note { display: none !important; }
      .acx-overlay-page .acx-chrome,
      .acx-overlay-page .acx-chrome-rule {
        visibility: hidden !important;
      }
      .acx-overlay-page .acx-line,
      .acx-overlay-page .acx-fill {
        border-color: transparent !important;
        box-shadow: none !important;
      }
      .acx-overlay-page .acx-ink,
      .acx-overlay-page .acx-ink .cwf-sig,
      .acx-overlay-page .acx-ink .cwf-sig-ink {
        visibility: visible !important;
        color: #000 !important;
        background: transparent !important;
        mix-blend-mode: multiply;
        filter: none !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .cwf-sig {
        filter: none !important;
        mix-blend-mode: multiply;
        background: transparent !important;
      }
      .acx-guest .cwf-sig { max-height: 26px !important; }
      .acx-overlay-page .acx-guest .cwf-sig { max-height: 0.3in !important; }
    }
  `
}
