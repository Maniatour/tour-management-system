export type RentalConfirmationOcrFields = {
  confirmationNumber: string | null
  agreementNumber: string | null
  rentalCompany: string | null
  vehicleType: string | null
  pickupLocation: string | null
  pickupDate: string | null
  pickupTime: string | null
  returnLocation: string | null
  returnDate: string | null
  returnTime: string | null
  bookingPrice: number | null
  driverName: string | null
}

const EMPTY_FIELDS: RentalConfirmationOcrFields = {
  confirmationNumber: null,
  agreementNumber: null,
  rentalCompany: null,
  vehicleType: null,
  pickupLocation: null,
  pickupDate: null,
  pickupTime: null,
  returnLocation: null,
  returnDate: null,
  returnTime: null,
  bookingPrice: null,
  driverName: null,
}

const MONTHS: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
}

const WEEKDAYS = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday'
const MONTH_NAMES = Object.keys(MONTHS).join('|')

const RENTAL_COMPANIES = [
  'enterprise',
  'hertz',
  'budget',
  'alamo',
  'national',
  'avis',
  'dollar',
  'thrifty',
  'sixt',
  'fox',
] as const

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 12h/24h 시각 → HH:mm */
export function normalizeRentalTime(raw: string | null | undefined): string | null {
  const text = String(raw || '').trim()
  if (!text) return null
  const ampm = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (ampm) {
    let hour = Number(ampm[1])
    const minute = Number(ampm[2])
    const mer = ampm[3].toUpperCase()
    if (mer === 'AM') {
      if (hour === 12) hour = 0
    } else if (hour !== 12) {
      hour += 12
    }
    if (hour > 23 || minute > 59) return null
    return `${pad2(hour)}:${pad2(minute)}`
  }
  const h24 = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (h24) {
    const hour = Number(h24[1])
    const minute = Number(h24[2])
    if (hour > 23 || minute > 59) return null
    return `${pad2(hour)}:${pad2(minute)}`
  }
  return null
}

/** HH:mm 또는 HH:mm:ss → 입력용 HH:mm */
export function rentalTimeInputValue(raw: string | null | undefined): string {
  const text = String(raw || '').trim()
  if (!text) return ''
  return normalizeRentalTime(text) || text.match(/^(\d{2}:\d{2})/)?.[1] || ''
}

export function formatRentalTimeDisplay(raw: string | null | undefined): string {
  const hhmm = rentalTimeInputValue(raw)
  if (!hhmm) return ''
  const [hStr, mStr] = hhmm.split(':')
  let hour = Number(hStr)
  const minute = Number(mStr)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return hhmm
  const mer = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12
  if (hour === 0) hour = 12
  return `${hour}:${pad2(minute)} ${mer}`
}

function parseEnglishDate(raw: string): string | null {
  const text = cleanText(raw)
  const named = text.match(
    new RegExp(
      `(?:(?:${WEEKDAYS}),\\s*)?(${MONTH_NAMES})\\s+(\\d{1,2}),\\s*(\\d{4})`,
      'i',
    ),
  )
  if (named) {
    const month = MONTHS[named[1].toLowerCase()]
    const day = Number(named[2])
    const year = Number(named[3])
    if (!month || day < 1 || day > 31 || year < 2000) return null
    return `${year}-${month}-${pad2(day)}`
  }
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/)
  if (us) {
    const month = Number(us[1])
    const day = Number(us[2])
    const year = Number(us[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year}-${pad2(month)}-${pad2(day)}`
  }
  return null
}

/** 요일 포함 날짜만 — 인사말 "seeing you on August 9, 2026" 제외 */
function extractWeekdayDates(text: string): string[] {
  const found: string[] = []
  const re = new RegExp(
    `(${WEEKDAYS}),\\s*(${MONTH_NAMES})\\s+(\\d{1,2}),\\s*(20\\d{2})`,
    'gi',
  )
  for (const match of text.matchAll(re)) {
    const ymd = parseEnglishDate(match[0])
    if (ymd) found.push(ymd)
  }
  return found
}

function extractTimesInOrder(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(/\b(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)\b/gi)) {
    const normalized = normalizeRentalTime(`${match[1]} ${match[2]}`)
    if (normalized) found.push(normalized)
  }
  if (found.length > 0) return found
  for (const match of text.matchAll(/\b(\d{1,2}:\d{2})(?::\d{2})?\b/g)) {
    const normalized = normalizeRentalTime(match[1])
    if (normalized) found.push(normalized)
  }
  return found
}

function extractConfirmationNumber(text: string): string | null {
  const labeled = text.match(
    /(?:confirmation\s*(?:number|#|no\.?)|conf(?:irmation)?(?:\s*#|\s*no\.?)|예약\s*번호)\s*[:#]?\s*([A-Z0-9-]{5,20})/i,
  )
  if (labeled) return labeled[1].toUpperCase()
  return null
}

function extractAgreementNumber(text: string): string | null {
  const labeled = text.match(
    /rental\s+agreement\s*(?:number|#|no\.?)?\s*[:#]?\s*([A-Z0-9-]{5,20})/i,
  )
  if (labeled) return labeled[1].toUpperCase()
  return null
}

function extractDriverName(text: string): string | null {
  const match = text.match(/driver\s*name\s*[:\s]*([^\n]+)/i)
  const raw = cleanText(match?.[1] || '')
  if (!raw || /email|phone|account|renter|vehicle/i.test(raw)) return null
  if (!/[A-Za-z가-힣]/.test(raw)) return null
  return raw.replace(/\s+/g, ' ')
}

function brandSearchText(text: string): string {
  return text.toLowerCase().replace(/international/g, ' ')
}

function hasStandaloneBrand(text: string, name: string): boolean {
  return new RegExp(`(?<![a-z])${name}(?![a-z])`, 'i').test(brandSearchText(text))
}

function looksLikeEnterpriseHoldingsConfirmation(text: string): boolean {
  const lower = text.toLowerCase()
  const hasPickupReturn = /\bpick[\s-]?up\b/.test(lower) && /\breturn\b/.test(lower)
  const hasConf =
    /confirmation\s*(?:number|#|no\.?)/i.test(text) ||
    /rental\s+agreement\s*(?:number|#)?/i.test(text) ||
    /reservation confirmed/i.test(text) ||
    /rental details/i.test(text)
  const hasEnterpriseChrome =
    /estimated\s+total/i.test(text) ||
    /modify reservation/i.test(text) ||
    /modify return/i.test(text) ||
    /we look forward to seeing you on/i.test(text) ||
    /trip mania/i.test(text)
  return hasPickupReturn && hasConf && hasEnterpriseChrome
}

function extractRentalCompany(text: string): string | null {
  if (hasStandaloneBrand(text, 'enterprise') || /enterprise\.com/i.test(text)) {
    return 'Enterprise'
  }
  for (const name of RENTAL_COMPANIES) {
    if (name === 'enterprise' || name === 'national') continue
    if (hasStandaloneBrand(text, name)) {
      return name.charAt(0).toUpperCase() + name.slice(1)
    }
  }
  if (hasStandaloneBrand(text, 'national')) return 'National'
  if (looksLikeEnterpriseHoldingsConfirmation(text)) return 'Enterprise'
  return null
}

function extractVehicleType(text: string): string | null {
  const transit = text.match(/ford\s+transit[^\n,]{0,40}/i)
  if (transit) return cleanText(transit[0].replace(/\s+or similar.*/i, ''))
  const vehicleClass = text.match(/vehicle\s+class[:\s]+([^\n]+)/i)
  if (vehicleClass) return cleanText(vehicleClass[1])
  const passengerVan = text.match(/\b(\d{1,2}\s*passenger\s+van)\b/i)
  if (passengerVan) return cleanText(passengerVan[1])
  return null
}

function parseMoneyAmount(raw: string): number | null {
  const amount = Number(String(raw).replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100) / 100
}

function extractAllNamedDates(text: string): string[] {
  const found: string[] = []
  const re = new RegExp(`(${MONTH_NAMES})\\s+(\\d{1,2}),\\s*(20\\d{2})`, 'gi')
  for (const match of text.matchAll(re)) {
    const ymd = parseEnglishDate(match[0])
    if (ymd) found.push(ymd)
  }
  return found
}

function firstDateAndTime(section: string): { date: string | null; time: string | null } {
  const weekday = extractWeekdayDates(section)
  const named = extractAllNamedDates(section)
  return {
    date: weekday[0] || named[0] || null,
    time: extractTimesInOrder(section)[0] || null,
  }
}

/** 확인서 본문의 PICK-UP / RETURN 블록. 2열 헤더(PICK-UP RETURN)는 건너뛴다. */
function extractLabeledPickupReturn(text: string): {
  pickupDate: string | null
  pickupTime: string | null
  returnDate: string | null
  returnTime: string | null
} {
  const empty = {
    pickupDate: null,
    pickupTime: null,
    returnDate: null,
    returnTime: null,
  }
  const pickupMatch =
    text.match(/\bPICK[\s-]?UP\b[:\s]*([\s\S]*?)(?=\n\s*RETURN\b)/i) ||
    text.match(/\bPICK[\s-]?UP\b[:\s]*([\s\S]*?)(?=\bRETURN\b)/i)
  const returnMatch = text.match(
    /\bRETURN\b[:\s]*([\s\S]*?)(?=\bModify Return\b|\bModify Reservation\b|\bRenter Details\b|\bVehicle Class\b|\bAccount\b|\bExtras\b|$)/i,
  )
  const pickupSec = cleanText(pickupMatch?.[1] || '')
  const returnSec = cleanText(returnMatch?.[1] || '')
  if (pickupSec.length < 12 || returnSec.length < 12) return empty
  const pickup = firstDateAndTime(pickupSec)
  const dropoff = firstDateAndTime(returnSec)
  if (!pickup.date && !dropoff.date) return empty
  return {
    pickupDate: pickup.date,
    pickupTime: pickup.time,
    returnDate: dropoff.date,
    returnTime: dropoff.time,
  }
}

function normalizePriceText(text: string): string {
  return text
    .replace(/(\d)\s+\.\s*(\d{2})\b/g, '$1.$2')
    .replace(/(\d)\.\s+(\d{2})\b/g, '$1.$2')
}

function isDailyRateContext(text: string, index: number, matchLength: number): boolean {
  const window = text.slice(Math.max(0, index - 48), index + matchLength + 24)
  if (/estimated\s+tot|due\s+at\s+the\s+counter/i.test(window)) return false
  return /\/\s*(day|week|gallon)|day\(s\)\s*@|week\(s\)\s*@/i.test(window)
}

function extractBookingPrice(text: string): number | null {
  const source = normalizePriceText(text)
  const patterns = [
    /estimated\s+tot(?:al)?(?:\s+due(?:\s+at\s+the\s+counter)?)?[\s\S]{0,200}?[\$S]\s*([0-9,]+\.\d{2})\s*\*/i,
    /estimated\s+tot(?:al)?(?:\s+due(?:\s+at\s+the\s+counter)?)?[\s\S]{0,200}?[\$S]\s*([0-9,]+\.\d{2})/i,
    /due\s+at\s+the\s+counter[\s\S]{0,120}?[\$S]?\s*([0-9,]+\.\d{2})\s*\*/i,
    /due\s+at\s+the\s+counter[\s\S]{0,120}?[\$S]?\s*([0-9,]+\.\d{2})/i,
    /estimated\s+tot(?:al)?[\s\S]{0,120}?([0-9,]+\.\d{2})\s*\*/i,
    /estimated\s+tot(?:al)?[\s\S]{0,120}?([0-9,]+\.\d{2})/i,
  ]
  for (const re of patterns) {
    const match = source.match(re)
    if (!match) continue
    const amount = parseMoneyAmount(match[1])
    if (amount) return amount
  }

  const parts = source.split(/estimated\s+tot(?:al)?/i)
  if (parts.length > 1) {
    const tail = parts[parts.length - 1].slice(0, 500)
    const amounts = [...tail.matchAll(/[\$S]?\s*([0-9,]+\.\d{2})\s*\*?/g)]
      .map((match) => parseMoneyAmount(match[1]))
      .filter((amount): amount is number => amount != null && amount >= 20)
    if (amounts.length > 0) return Math.max(...amounts)
  }

  const amounts: number[] = []
  for (const match of source.matchAll(/[\$S]\s*([0-9,]+\.\d{2})\s*\*?/g)) {
    if (match.index == null) continue
    if (isDailyRateContext(source, match.index, match[0].length)) continue
    const amount = parseMoneyAmount(match[1])
    if (amount && amount >= 50) amounts.push(amount)
  }
  if (amounts.length > 0) return Math.max(...amounts)
  return null
}

function sanitizeExtractedCompany(
  company: string | null | undefined,
  pickupLocation?: string | null,
): string | null {
  const text = String(company || '').trim()
  if (!text) return null
  if (/international/i.test(text)) return null
  if (
    text.toLowerCase() === 'national' &&
    /international/i.test(String(pickupLocation || ''))
  ) {
    return 'Enterprise'
  }
  return text
}

/** International 공항명에서 National로 오인된 경우 Enterprise를 유지한다. */
export function chooseRentalCompany(
  extracted: string | null | undefined,
  existing: string | null | undefined,
): string {
  const next = sanitizeExtractedCompany(extracted)
  const prev = String(existing || '').trim()
  if (!next) return prev || 'Enterprise'
  if (next.toLowerCase() === 'national') {
    return prev && prev.toLowerCase() !== 'national' ? prev : 'Enterprise'
  }
  return next
}

function normalizeLocation(raw: string | null | undefined): string | null {
  const text = cleanText(String(raw || ''))
  if (!text) return null
  const harry = text.match(/harry\s+reid\s+international\s+airport/i)
  if (harry) return 'Harry Reid International Airport'
  const mccarran = text.match(/mccarran\s+international\s+airport/i)
  if (mccarran) return 'Harry Reid International Airport'
  const airport = text.match(/([A-Za-z][A-Za-z0-9 .'-]{3,60}Airport)/)
  if (airport) return cleanText(airport[1])
  const words = text.split(/\s+/)
  if (words.length >= 8) {
    const half = Math.ceil(words.length / 2)
    const left = words.slice(0, half).join(' ')
    const right = words.slice(half).join(' ')
    if (
      right.toLowerCase().startsWith(left.toLowerCase().slice(0, 18)) ||
      left.toLowerCase().startsWith(right.toLowerCase().slice(0, 18))
    ) {
      return left
    }
  }
  return text.length > 80 ? text.slice(0, 80).trim() : text
}

export function parseBookingPriceValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100) / 100
  }
  if (typeof value === 'string') {
    const match = value.replace(/,/g, '').replace(/\*/g, '').match(/([0-9]+(?:\.[0-9]+)?)/)
    if (!match) return null
    const amount = Number(match[1])
    if (Number.isFinite(amount) && amount > 0) return Math.round(amount * 100) / 100
  }
  return null
}

function pickBookingPrice(
  primary: number | null | undefined,
  secondary: number | null | undefined,
): number | null {
  const amounts = [primary, secondary].filter((value): value is number => value != null && value > 0)
  if (amounts.length === 0) return null
  return Math.max(...amounts)
}

function looksLikeLocationLine(line: string): boolean {
  const t = cleanText(line)
  if (t.length < 4 || t.length > 90) return false
  if (/confirmation|thanks|modify|cancel|reservation confirmed|look forward|estimated total/i.test(t)) {
    return false
  }
  if (parseEnglishDate(t) && !/airport|harry reid/i.test(t)) return false
  return /airport|harry reid|mccarran|rent a car|blvd|boulevard|street|ave|las vegas|terminal|counter/i.test(
    t,
  )
}

export function parseRentalConfirmationOcr(rawText: string): RentalConfirmationOcrFields {
  const text = String(rawText || '').replace(/\r/g, '')
  if (!text.trim()) return { ...EMPTY_FIELDS }

  const afterPickup = /\bPICK[\s-]?UP\b/i.test(text)
    ? text.replace(/[\s\S]*?\bPICK[\s-]?UP\b/i, 'PICK-UP')
    : text
  const labeled = extractLabeledPickupReturn(text)
  const uniqueWeekdayDates = [...new Set(extractWeekdayDates(afterPickup))]
  const uniqueNamedDates = [...new Set(extractAllNamedDates(afterPickup))]
  const regionTimes = extractTimesInOrder(afterPickup)
  const allTimes = extractTimesInOrder(text)
  const pairTimes = regionTimes.length >= 1 ? regionTimes : allTimes

  let pickupDate = labeled.pickupDate
  let returnDate = labeled.returnDate
  if (!pickupDate || !returnDate) {
    const datePair =
      uniqueWeekdayDates.length >= 2
        ? uniqueWeekdayDates
        : uniqueNamedDates.length >= 2
          ? uniqueNamedDates
          : []
    if (datePair.length >= 2) {
      pickupDate = pickupDate || datePair[0]
      returnDate = returnDate || datePair[datePair.length - 1]
    } else {
      pickupDate = pickupDate || uniqueWeekdayDates[0] || uniqueNamedDates[0] || null
      returnDate = returnDate || null
    }
  }

  const pickupTime = labeled.pickupTime || pairTimes[0] || null
  const returnTime = labeled.returnTime || pairTimes[1] || pairTimes[0] || null

  const locationLine =
    text.split(/\n+/).map(cleanText).find(looksLikeLocationLine) ||
    (text.match(/harry\s+reid\s+international\s+airport/i)?.[0] ?? null)
  const location = normalizeLocation(locationLine)

  return {
    confirmationNumber: extractConfirmationNumber(text),
    agreementNumber: extractAgreementNumber(text),
    rentalCompany: sanitizeExtractedCompany(extractRentalCompany(text), location),
    vehicleType: extractVehicleType(text),
    pickupLocation: location,
    pickupDate,
    pickupTime,
    returnLocation: location,
    returnDate,
    returnTime,
    bookingPrice: extractBookingPrice(text),
    driverName: extractDriverName(text),
  }
}

export function rentalConfirmationOcrIsUsable(fields: RentalConfirmationOcrFields): boolean {
  return Boolean(
    fields.confirmationNumber ||
      fields.agreementNumber ||
      fields.pickupDate ||
      fields.returnDate ||
      (fields.bookingPrice != null && fields.bookingPrice > 0),
  )
}

export function coerceRentalConfirmationFields(
  row: Partial<RentalConfirmationOcrFields> | null | undefined,
): RentalConfirmationOcrFields {
  if (!row) return { ...EMPTY_FIELDS }
  return {
    confirmationNumber: row.confirmationNumber?.trim() || null,
    agreementNumber: row.agreementNumber?.trim() || null,
    rentalCompany: sanitizeExtractedCompany(row.rentalCompany, row.pickupLocation),
    vehicleType: row.vehicleType?.trim() || null,
    pickupLocation: normalizeLocation(row.pickupLocation),
    pickupDate: parseEnglishDate(String(row.pickupDate || '')) || row.pickupDate?.trim() || null,
    pickupTime: normalizeRentalTime(row.pickupTime) || rentalTimeInputValue(row.pickupTime) || null,
    returnLocation: normalizeLocation(row.returnLocation),
    returnDate: parseEnglishDate(String(row.returnDate || '')) || row.returnDate?.trim() || null,
    returnTime: normalizeRentalTime(row.returnTime) || rentalTimeInputValue(row.returnTime) || null,
    bookingPrice: parseBookingPriceValue(row.bookingPrice),
    driverName: row.driverName?.trim() || null,
  }
}

export function mergeRentalConfirmationOcr(
  primary: RentalConfirmationOcrFields,
  secondary: Partial<RentalConfirmationOcrFields> | null | undefined,
): RentalConfirmationOcrFields {
  if (!secondary) return primary
  let pickupDate = primary.pickupDate || secondary.pickupDate || null
  let returnDate = primary.returnDate || secondary.returnDate || null
  const secondaryDistinct =
    Boolean(secondary.pickupDate && secondary.returnDate && secondary.pickupDate !== secondary.returnDate)
  if (pickupDate && returnDate === pickupDate && secondaryDistinct) {
    pickupDate = secondary.pickupDate || pickupDate
    returnDate = secondary.returnDate || returnDate
  }
  return {
    confirmationNumber: primary.confirmationNumber || secondary.confirmationNumber || null,
    agreementNumber: primary.agreementNumber || secondary.agreementNumber || null,
    rentalCompany: chooseRentalCompany(primary.rentalCompany, secondary.rentalCompany) ||
      primary.rentalCompany ||
      secondary.rentalCompany ||
      null,
    vehicleType: primary.vehicleType || secondary.vehicleType || null,
    pickupLocation: primary.pickupLocation || secondary.pickupLocation || null,
    pickupDate,
    pickupTime: primary.pickupTime || secondary.pickupTime || null,
    returnLocation: primary.returnLocation || secondary.returnLocation || null,
    returnDate,
    returnTime: primary.returnTime || secondary.returnTime || null,
    bookingPrice: pickBookingPrice(primary.bookingPrice, secondary.bookingPrice),
    driverName: primary.driverName || secondary.driverName || null,
  }
}
