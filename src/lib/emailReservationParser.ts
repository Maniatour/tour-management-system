import type { ExtractedReservationData } from '@/types/reservationImport'

/** 발신 주소/도메인으로 플랫폼 키 추측 */
const PLATFORM_FROM_PATTERNS: { pattern: RegExp | string; key: string }[] = [
  { pattern: /viator\.com/i, key: 'viator' },
  { pattern: /getyourguide/i, key: 'getyourguide' },
  { pattern: /tripadvisor/i, key: 'tripadvisor' },
  { pattern: /klook/i, key: 'klook' },
  { pattern: /booking\.com/i, key: 'booking' },
  { pattern: /expedia/i, key: 'expedia' },
  { pattern: /airbnb/i, key: 'airbnb' },
  { pattern: /resend\.dev|resend\.com/i, key: 'resend' },
]

function detectPlatform(sourceEmail: string | null, subject: string): string | null {
  const from = (sourceEmail || '').toLowerCase()
  const subj = (subject || '').toLowerCase()
  for (const { pattern, key } of PLATFORM_FROM_PATTERNS) {
    if (typeof pattern === 'string') {
      if (from.includes(pattern) || subj.includes(pattern)) return key
    } else {
      if (pattern.test(from) || pattern.test(subj)) return key
    }
  }
  return null
}

/** HTML 태그 제거 후 공백 정규화 */
function toPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

/** 이메일 본문에서 공통 패턴 추출 (정규식 기반) */
function extractCommonPatterns(text: string): Partial<ExtractedReservationData> {
  const out: Partial<ExtractedReservationData> = {}
  if (!text || text.length < 5) return out

  // 이메일
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)
  if (emailMatch) out.customer_email = emailMatch[0]

  // 전화 (국제/한국 형식)
  const phoneMatch = text.match(/(?:\+?[0-9]{1,3}[-.\s]?)?(?:\(?[0-9]{2,4}\)?[-.\s]?)?[0-9]{3,4}[-.\s]?[0-9]{4,}/)
  if (phoneMatch) out.customer_phone = phoneMatch[0].trim()

  // 날짜 (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, "March 10, 2025" 등)
  const datePatterns = [
    /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12][0-9]|3[01])\b/,
    /\b(0?[1-9]|[12][0-9]|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\b/i,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+20\d{2}\b/i,
  ]
  for (const re of datePatterns) {
    const m = text.match(re)
    if (m) {
      let normalized = m[0]
      const monthNames: Record<string, string> = {
        january: '01', jan: '01', february: '02', feb: '02', march: '03', mar: '03',
        april: '04', apr: '04', may: '05', june: '06', jun: '06', july: '07', jul: '07',
        august: '08', aug: '08', september: '09', sep: '09', october: '10', oct: '10',
        november: '11', nov: '11', december: '12', dec: '12',
      }
      const monthMatch = normalized.match(/([A-Za-z]+)/)
      if (monthMatch && monthNames[monthMatch[1].toLowerCase()]) {
        const day = normalized.match(/(\d{1,2})/)?.[1]?.padStart(2, '0')
        const year = normalized.match(/(20\d{2})/)?.[1]
        if (day && year) normalized = `${year}-${monthNames[monthMatch[1].toLowerCase()]}-${day}`
      }
      out.tour_date = normalized.replace(/\s+/g, ' ').trim()
      break
    }
  }

  // 시간 (HH:MM, HH:MM AM/PM)
  const timeMatch = text.match(/\b(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)?\b/i) ||
    text.match(/\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/)
  if (timeMatch) out.tour_time = timeMatch[0].trim()

  // 인원 (adults, children, infants 등)
  const adultsMatch = text.match(/(?:adults?|성인)\s*:?\s*(\d+)/i)
  if (adultsMatch) out.adults = parseInt(adultsMatch[1], 10)
  const childrenMatch = text.match(/(?:children|child|아동|어린이)\s*:?\s*(\d+)/i)
  if (childrenMatch) out.children = parseInt(childrenMatch[1], 10)
  const infantsMatch = text.match(/(?:infants?|유아|영유아)\s*:?\s*(\d+)/i)
  if (infantsMatch) out.infants = parseInt(infantsMatch[1], 10)

  if (out.adults !== undefined || out.children !== undefined || out.infants !== undefined) {
    const a = out.adults ?? 0
    const c = out.children ?? 0
    const i = out.infants ?? 0
    out.total_people = a + c + i
  }

  // 예약 번호/참조
  const refMatch = text.match(/(?:booking\s*(?:ref(?:erence)?|#|no\.?|number|id)|예약\s*(?:번호|#)|confirmation\s*#?|reference\s*number)\s*:?\s*([A-Za-z0-9_-]+)/i)
  if (refMatch) out.channel_rn = refMatch[1].trim()

  // 이름 (간단 휴리스틱: "Guest name", "Customer", "Name :" 등 다음 줄/값)
  const nameMatch = text.match(/(?:guest\s*name|customer\s*name|main\s*customer|name\s*:)\s*([A-Za-z\s]+?)(?:\n|$|,|email|phone)/im)
  if (nameMatch) out.customer_name = nameMatch[1].trim()

  return out
}

/** GetYourGuide 예약 메일 전용 추출 (라벨 기반) */
function extractGetYourGuide(text: string): Partial<ExtractedReservationData> {
  const out: Partial<ExtractedReservationData> = {}
  if (!text || text.length < 10) return out

  // Reference number: 본문 "Reference number: GYGZGZ56LA5F" 또는 제목 "Booking - S382661 - GYGZGZ56LA5F" 마지막 코드
  const refGyG = text.match(/(?:reference\s*number|reference\s*#?)\s*:?\s*([A-Z0-9]{8,20})/i)
  if (refGyG) out.channel_rn = refGyG[1].trim()
  if (!out.channel_rn) {
    const subjectRef = text.match(/(?:booking|reservation)\s*[-–]\s*[A-Z0-9]+\s*[-–]\s*([A-Z0-9]{8,20})/i)
    if (subjectRef) out.channel_rn = subjectRef[1].trim()
  }

  // Main customer 블록: Customer Name: Gaby Quintino 등
  const mainCustomerName = text.match(/(?:main\s*customer|customer\s*name)\s*:?\s*([A-Za-z\u00C0-\u024F\s'-]+?)(?:\s*(?:customer\s*email|email\s*:|\n|$))/im)
  if (mainCustomerName) out.customer_name = mainCustomerName[1].trim()

  const customerEmailGyG = text.match(/(?:customer\s*email|email\s*:)\s*([^\s\n]+@[^\s\n]+)/i)
  if (customerEmailGyG) out.customer_email = customerEmailGyG[1].trim()

  const customerPhoneGyG = text.match(/(?:customer\s*phone|phone\s*:)\s*([+\d\s.-]+?)(?:\s*(?:customer\s*language|tour\s*language|language\s*:|\n|$))/im)
  if (customerPhoneGyG) out.customer_phone = customerPhoneGyG[1].trim()

  const customerLang = text.match(/(?:customer\s*language|language\s*:)\s*([A-Za-z\s()]+?)(?:\s*(?:tour\s*language|date|pickup|\n|$))/im)
  if (customerLang) out.language = customerLang[1].trim()

  const tourLang = text.match(/(?:tour\s*language|tour\s*lang)\s*:?\s*([A-Za-z\s()]+?)(?:\s*(?:pickup|date|price|\n|$))/im)
  if (tourLang && !out.language) out.language = tourLang[1].trim()

  // Pickup: Harrah's Las Vegas Hotel & Casino, ...
  const pickup = text.match(/(?:pickup\s*|pick-up\s*)\s*:?\s*([^\n]+?)(?:\s*open\s*in\s*google|price|date|\n\n|$)/im)
  if (pickup) out.pickup_hotel = pickup[1].trim()

  // Price: $ 698.88 또는 $698.88
  const price = text.match(/(?:price|total|amount)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i)
  if (price) out.amount = `$${price[1].replace(/,/g, '')}`

  // 상품명: "Las Vegas > Grand Canyon Sunrise + Antelope + Horseshoe Bend" 형태
  const productLine = text.match(/(?:offer\s*has\s*been\s*booked|product|tour)\s*:?\s*([A-Za-z0-9\s>+&,-]+?)(?:\s*group\s*tour|with\s*lower|\n\n)/im)
  if (productLine) out.product_name = productLine[1].trim()
  if (!out.product_name) {
    const arrowProduct = text.match(/([A-Za-z\s]+>\s*[A-Za-z\s+&,-]+?)(?:\s*group\s*tour|with\s*lower|number\s*of\s*participants|\n\n)/im)
    if (arrowProduct) out.product_name = arrowProduct[1].trim()
  }

  // 초이스: "Group Tour with Lower Antelope Canyon"
  const choices = text.match(/(?:group\s*tour\s+with\s+[^\n]+|with\s+lower\s+[^\n]+|option\s*:?\s*[^\n]+)/im)
  if (choices) out.product_choices = choices[0].trim()

  // 인원: "2 x Adults (Age 0-99)" 또는 "Number of participants: 2"
  const participants = text.match(/(?:number\s*of\s*participants|participants?)\s*:?\s*(\d+)\s*x?\s*adults?/i)
  if (participants) out.adults = parseInt(participants[1], 10)
  const adultsOnly = text.match(/(\d+)\s*x?\s*adults?\s*\(/i)
  if (adultsOnly && out.adults === undefined) out.adults = parseInt(adultsOnly[1], 10)

  return out
}

/**
 * 이메일 제목 + 본문에서 예약/고객 정보 추출.
 * 플랫폼별 파서는 필요 시 확장하고, 여기서는 공통 패턴 + 플랫폼 감지만 수행.
 */
export function extractReservationFromEmail(options: {
  subject: string
  text?: string | null
  html?: string | null
  sourceEmail?: string | null
}): { platform_key: string | null; extracted_data: ExtractedReservationData } {
  const { subject, text, html, sourceEmail } = options
  const plainText = (text && text.trim()) || (html ? toPlainText(html) : '')
  const fullText = [subject, plainText].filter(Boolean).join('\n')

  const platform_key = detectPlatform(sourceEmail || null, subject)
  const common = extractCommonPatterns(fullText)

  let merged: Partial<ExtractedReservationData> = { ...common, platform_key: platform_key ?? undefined }
  if (platform_key === 'getyourguide') {
    const gyG = extractGetYourGuide(fullText)
    merged = { ...merged, ...gyG }
  }

  const extracted_data: ExtractedReservationData = merged as ExtractedReservationData
  return { platform_key, extracted_data }
}
