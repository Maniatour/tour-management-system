import type { ExtractedReservationData } from '@/types/reservationImport'

/** 채널별 파서 설정: 전처리(HTML→텍스트) + 전용 추출 함수. 채널 추가 시 여기만 등록하면 됨. */
export type ChannelParserExtract = (
  text: string,
  subject: string,
  sourceEmail: string | null,
  rawHtml?: string | null
) => Partial<ExtractedReservationData>

export type ChannelParserConfig = {
  /** HTML 본문을 플랫폼에 맞는 평문으로 변환 (없으면 공통 toPlainText 사용) */
  preprocess?: (html: string) => string
  /** 채널 전용 필드 추출 */
  extract: ChannelParserExtract
}

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

/** 이메일에서 나온 언어명/문구를 고객 언어 드롭다운 코드로 매핑 (KR, EN, ES, JA, ZH, FR, DE, IT, PT, RU) */
function normalizeLanguageToCode(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (/^(kr|ko|korean|한국어)/.test(s)) return 'KR'
  if (/^(en|english|영어)/.test(s)) return 'EN'
  if (/^(ja|japanese|日本語)/.test(s)) return 'JA'
  if (/^(zh|chinese|中文)/.test(s)) return 'ZH'
  if (/^(es|spanish|español|espanyol)/.test(s)) return 'ES'
  if (/^(fr|french|français|francais)/.test(s)) return 'FR'
  if (/^(de|german|deutsch)/.test(s)) return 'DE'
  if (/^(it|italian|italiano)/.test(s)) return 'IT'
  if (/^(pt|portuguese|português|portugues)/.test(s)) return 'PT'
  if (/^(ru|russian|русский)/.test(s)) return 'RU'
  // 이미 2자 코드면 그대로 (대문자)
  if (/^[a-z]{2}$/i.test(s)) return s.toUpperCase()
  return 'EN'
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

/** Klook 이메일용: 테이블/블록 태그를 줄바꿈으로 바꾼 뒤 텍스트 추출해 레이블-값 줄 구분이 되도록 함 */
function toPlainTextKlook(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s
    .replace(/<\/(?:tr|td|div|p|th)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
  s = s.replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return s
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

  // "March 30, 2026 12:00 AM" 형식: 날짜 + 시간 동시 추출 후 투어 시간을 24h(HH:mm)로 매핑
  const dateTimeAmPm = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\s+(\d{1,2}):([0-5][0-9])\s*(AM|PM)\b/i)
  if (dateTimeAmPm) {
    const monthNames: Record<string, string> = {
      january: '01', jan: '01', february: '02', feb: '02', march: '03', mar: '03',
      april: '04', apr: '04', may: '05', june: '06', jun: '06', july: '07', jul: '07',
      august: '08', aug: '08', september: '09', sep: '09', october: '10', oct: '10',
      november: '11', nov: '11', december: '12', dec: '12',
    }
    const monthStr = monthNames[dateTimeAmPm[1].toLowerCase()]
    const dayMatch = dateTimeAmPm[0].match(/\s+(\d{1,2}),?\s+20\d{2}/)
    const day = dayMatch?.[1]?.padStart(2, '0')
    const year = dateTimeAmPm[0].match(/20\d{2}/)?.[0]
    const hour = parseInt(dateTimeAmPm[2], 10)
    const min = dateTimeAmPm[3]
    const isPm = (dateTimeAmPm[4] || '').toUpperCase() === 'PM'
    let h24 = hour
    if (isPm && hour !== 12) h24 = hour + 12
    if (!isPm && hour === 12) h24 = 0
    if (monthStr && day && year) out.tour_date = `${year}-${monthStr}-${day}`
    out.tour_time = `${String(h24).padStart(2, '0')}:${min}`
  }

  // 날짜 (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, "March 10, 2025" 등) — 위에서 매칭 안 된 경우
  if (!out.tour_date) {
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
  }

  // 시간 (HH:MM, HH:MM AM/PM) — 위에서 tour_time 안 나왔을 때만; AM/PM이 있으면 24h로 변환
  if (out.tour_time == null) {
    const timeMatch = text.match(/\b(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)?\b/i) ||
      text.match(/\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/)
    if (timeMatch) {
      const raw = timeMatch[0].trim()
      const amPm = raw.match(/(AM|PM)/i)?.[1]
      if (amPm) {
        const hour = parseInt(timeMatch[1], 10)
        const min = timeMatch[2]
        const isPm = amPm.toUpperCase() === 'PM'
        let h24 = hour
        if (isPm && hour !== 12) h24 = hour + 12
        if (!isPm && hour === 12) h24 = 0
        out.tour_time = `${String(h24).padStart(2, '0')}:${min}`
      } else {
        out.tour_time = raw
      }
    }
  }

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

/** GetYourGuide 본문 상품명 → 우리 product_id (S382661은 vendor code이므로 제목이 아닌 본문 상품명으로 매칭). Zion Bryce(그랜드서클)를 먼저 검사해 밤도깨비로 오매칭 방지. */
const GYG_BODY_PRODUCT_MAP: Array<{ pattern: RegExp | string; product_id: string }> = [
  { pattern: /Zion\s*Bryce\s*Grand\s*Canyon|Las\s*Vegas\s*>\s*Zion\s*Bryce|Zion\s*Bryce\s*&?\s*Antelope/i, product_id: 'MNGC1N' },
  { pattern: /Grand\s*Canyon\s*Sunrise|Las\s*Vegas\s*>\s*Grand\s*Canyon\s*Sunrise/i, product_id: 'MDGCSUNRISE' },
]

/** GetYourGuide 예약 메일 전용 추출 (라벨 기반) */
function extractGetYourGuide(
  text: string,
  subject: string,
  sourceEmail: string | null
): Partial<ExtractedReservationData> {
  const out: Partial<ExtractedReservationData> = {}
  if (!text || text.length < 10) return out

  // 예약 접수 이메일: 발신 GetYourGuide + 제목 "Booking -"로 시작
  const fromGyG = (sourceEmail || '').toLowerCase().includes('getyourguide')
  const subjectBooking = (subject || '').trimStart().toLowerCase().startsWith('booking -')
  if (fromGyG && subjectBooking) out.is_booking_confirmed = true

  // 제목 "Booking - S382661 - GYGZGZ56LA5F" → GYGZGZ56LA5F = channel_rn (S382661은 vendor code, 상품은 본문 상품명으로 매칭)
  const subjectMatch = subject.match(/Booking\s*[-–]\s*[A-Z0-9]+\s*[-–]\s*([A-Z0-9]{8,20})/i)
  if (subjectMatch) out.channel_rn = subjectMatch[1].trim()

  // Reference number: 본문 "Reference number: GYGZGZ56LA5F"
  if (!out.channel_rn) {
    const refGyG = text.match(/(?:reference\s*number|reference\s*#?)\s*:?\s*([A-Z0-9]{8,20})/i)
    if (refGyG) out.channel_rn = refGyG[1].trim()
  }
  if (!out.channel_rn) {
    const subjectRef = text.match(/(?:booking|reservation)\s*[-–]\s*[A-Z0-9]+\s*[-–]\s*([A-Z0-9]{8,20})/i)
    if (subjectRef) out.channel_rn = subjectRef[1].trim()
  }

  // Main customer: HTML에서 "Main customer</p></div>...<span>Gaby Quintino</span>" → plain text로 "Main customer   Gaby Quintino"
  // 이름 뒤에 오는 레이블(Email, Phone, Language 등) 전까지 캡처 (lookahead로 구분)
  const mainCustomerName = text.match(
    /(?:main\s*customer|customer\s*name)\s*:?\s*([A-Za-z\u00C0-\u024F\s'-]+?)\s*(?=(?:customer\s*email|email\s*:|phone\s*:|\btour\s*language\b|\blanguage\s*:|\n\n|$))/im
  )
  if (mainCustomerName) out.customer_name = mainCustomerName[1].trim()
  // 위가 실패하면 "Main customer" 직후 공백+이름(연속 단어)만 추출
  if (!out.customer_name) {
    const fallback = text.match(/(?:main\s*customer|customer\s*name)\s*:?\s*([A-Za-z\u00C0-\u024F]+(?:\s+[A-Za-z\u00C0-\u024F'-]+)*)/im)
    if (fallback) out.customer_name = fallback[1].trim()
  }
  // "customer-" 앞에서 무조건 끊기 → "maria teresa alcantara hernandez customer-" → "maria teresa alcantara hernandez"
  if (out.customer_name) {
    const beforeCustomerHyphen = out.customer_name.split(/\s*customer-/i)[0].trim()
    if (beforeCustomerHyphen !== '') out.customer_name = beforeCustomerHyphen
    out.customer_name = out.customer_name
      .replace(/\s+(?:customer|custome|email|phone|language|tour)\s*$/i, '')
      .trim()
  }

  // 고객 이메일: customer-xxx@reply.getyourguide.com 등
  const customerEmailGyG = text.match(/(?:customer\s*email|email\s*:)\s*([^\s\n]+@[^\s\n]+)/i)
  if (customerEmailGyG) out.customer_email = customerEmailGyG[1].trim()
  if (!out.customer_email) {
    const replyEmail = text.match(/([a-z0-9_-]+@reply\.getyourguide\.com)/i)
    if (replyEmail) out.customer_email = replyEmail[1].trim()
  }

  // Phone: +525528999051
  const customerPhoneGyG = text.match(/(?:phone\s*:)\s*([+\d\s.-]+?)(?:\s*(?:customer\s*language|tour\s*language|language\s*:|\n|$))/im)
  if (customerPhoneGyG) out.customer_phone = customerPhoneGyG[1].trim()
  if (!out.customer_phone) {
    const phoneAlt = text.match(/Phone:\s*([+\d\s.-]{10,})/i)
    if (phoneAlt) out.customer_phone = phoneAlt[1].trim()
  }

  // Tour language: "English (Live tour guide)" / Customer language: "Language: Spanish" (보통 Phone 다음 줄)
  const tourLang = text.match(/(?:tour\s*language|tour\s*lang)\s*:?\s*([A-Za-z\s()]+?)(?:\s*(?:pickup|date|price|\n|$))/im)
  const tourLanguageRaw = tourLang ? tourLang[1].trim() : undefined
  // "Tour language:"는 제외: 단독 "Language:" 또는 "Customer language:"만 고객 언어로 매칭 (negative lookbehind)
  const customerLang = text.match(/(?:customer\s*language|(?<!tour\s)language)\s*:\s*([A-Za-z][A-Za-z\s()]*?)(?:\s*(?:tour\s*language|date|pickup)|\n\n|$)/im)
  const customerLanguageRaw = customerLang ? customerLang[1].trim() : undefined
  // 고객 언어가 있으면 고객 언어, 없으면 투어 언어로 매칭 (새 예약 추가 - 고객 언어 드롭다운용)
  const effectiveRaw = customerLanguageRaw ?? tourLanguageRaw
  if (effectiveRaw) out.language = normalizeLanguageToCode(effectiveRaw)

  // Pickup: Harrah's Las Vegas Hotel & Casino, ...
  const pickup = text.match(/(?:pickup\s*|pick-up\s*)\s*:?\s*([^\n]+?)(?:\s*open\s*in\s*google|price|date|\n\n|$)/im)
  if (pickup) out.pickup_hotel = pickup[1].trim()

  // Price: $ 698.88 또는 $698.88
  const price = text.match(/(?:price|total|amount)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i)
  if (price) out.amount = `$${price[1].replace(/,/g, '')}`

  // 상품명: "Las Vegas > Grand Canyon Sunrise + Antelope + Horseshoe Bend" → product_name 추출 후 본문 기준 product_id 매칭
  const productLine = text.match(/(?:offer\s*has\s*been\s*booked|product|tour)\s*:?\s*([A-Za-z0-9\s>+&,-]+?)(?:\s*group\s*tour|with\s*lower|\n\n)/im)
  if (productLine) out.product_name = productLine[1].trim()
  if (!out.product_name) {
    const arrowProduct = text.match(/([A-Za-z\s]+>\s*[A-Za-z\s+&,-]+?)(?:\s*group\s*tour|with\s*lower|number\s*of\s*participants|\n\n)/im)
    if (arrowProduct) out.product_name = arrowProduct[1].trim()
  }
  if (out.product_name) {
    for (const { pattern, product_id } of GYG_BODY_PRODUCT_MAP) {
      const match = typeof pattern === 'string' ? out.product_name.includes(pattern) : pattern.test(out.product_name)
      if (match) {
        out.product_id = product_id
        if (product_id === 'MNGC1N') out.product_name = '그랜드서클 1박 2일 투어'
        break
      }
    }
  }

  // 초이스: 이메일 본문 "Group Tour with Lower Antelope Canyon" → Lower Antelope Canyon / "Group tour with Antelope Canyon X" → Antelope X Canyon
  const lowerAntelope = text.match(/group\s*tour\s+with\s+(Lower\s+Antelope\s*Canyon)/i)
  const antelopeCanyonX = text.match(/group\s*tour\s+with\s+Antelope\s*Canyon\s*X/i)
  if (lowerAntelope) {
    out.product_choices = 'Group Tour with Lower Antelope Canyon'
    out.import_choice_option_names = ['Lower Antelope Canyon']
  } else if (antelopeCanyonX) {
    out.product_choices = 'Group Tour with Antelope Canyon X'
    // 상품 옵션명이 "Antelope X Canyon" 또는 "X Antelope Canyon"인 경우 모두 매칭
    out.import_choice_option_names = ['X Antelope Canyon', 'Antelope X Canyon']
  }
  // "Group Tour with X" 형태로 다른 옵션이 있으면 product_choices만 설정 (추후 확장용)
  if (!out.product_choices) {
    const groupTourWith = text.match(/group\s*tour\s+with\s+([A-Za-z][A-Za-z\s]*?)(?=\s*[<\n]|\s*number\s*of\s*participants|\n\n|$)/im)
    if (groupTourWith) {
      const raw = groupTourWith[1].trim()
      if (raw) out.product_choices = `Group Tour with ${raw}`
    }
  }
  // 미국 거주자 구분·기타 입장료는 항상 미정 기본 선택 (import_choice_undecided_groups)
  out.import_choice_undecided_groups = ['미국 거주자 구분', '기타 입장료']

  // 인원: "Number of participants   2 x Adults (Age 0 - 99)"
  const participants = text.match(/(?:number\s*of\s*participants|participants?)\s*:?\s*(\d+)\s*x?\s*adults?/i)
  if (participants) out.adults = parseInt(participants[1], 10)
  const adultsOnly = text.match(/(\d+)\s*x?\s*adults?\s*\(/i)
  if (adultsOnly && out.adults === undefined) out.adults = parseInt(adultsOnly[1], 10)
  if (out.adults !== undefined) out.total_people = out.adults + (out.children ?? 0) + (out.infants ?? 0)

  return out
}

/** Klook 이메일에서 사용 가능한 레이블 패턴 (다국어/변형 포함). ensureKlookLabelLineBreaks에서 줄바꿈 삽입용 */
const KLOOK_LABEL_PATTERNS = [
  'Booking reference ID',
  'Booking reference',
  'Order ID',
  'Order number',
  'Confirmation number',
  'Reference number',
  'Lead participant',
  'Lead traveller',
  'Guest name',
  'Customer name',
  'Traveller name',
  'Participant name',
  'Date Request',
  'Date of experience',
  'Tour date',
  'Time Request',
  'Time of experience',
  'Tour time',
  'No. of participants',
  'Number of participants',
  'Number of travellers',
  'Participant',
  'Participants',
  'Preferred language',
  'Language',
  'Special requirements',
  'Special requests',
  'Departure location',
  'Please insert your pickup',
  'Pickup location',
  'Phone number',
  'Contact number',
  'Email',
  'Email address',
  'WhatsApp',
]

/** toPlainText가 줄바꿈을 공백으로 묶어 한 줄이 된 경우, 알려진 Klook 레이블 앞에 줄바꿈을 넣어 세그먼트 분리 */
function ensureKlookLabelLineBreaks(text: string): string {
  const trimmed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (trimmed.includes('\n\n') || (trimmed.match(/\n/g)?.length ?? 0) > 5) return trimmed
  const escaped = KLOOK_LABEL_PATTERNS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const labelPattern = new RegExp(
    `(^|\\s+)(${escaped.join('|')})\\s*:`,
    'gi'
  )
  return trimmed.replace(labelPattern, '$1\n$2')
}

/** Klook HTML에서 <th>Label</th><td>Value</td> 또는 <td>Label:</td><td>Value</td> 형태로 레이블-값 쌍 추출 */
function extractKlookFromHtml(html: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!html || html.length < 20) return map
  const clean = (s: string) =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()

  // <th>Label</th>\s*<td>Value</td> (th/td 셀)
  const thTd = html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)
  for (const m of thTd) {
    const key = clean(m[1]).replace(/\s*:\s*$/, '').trim().toLowerCase()
    const value = clean(m[2]).trim()
    if (key && value && value.length < 500) map.set(key, value)
  }
  // <td>Label:</td>\s*<td>Value</td>
  const tdTd = html.matchAll(/<td[^>]*>([\s\S]*?)\s*:?\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)
  for (const m of tdTd) {
    const key = clean(m[1]).replace(/\s*:\s*$/, '').trim().toLowerCase()
    const value = clean(m[2]).trim()
    if (key && value && value.length < 500 && !map.has(key)) map.set(key, value)
  }
  // <tr>...</tr> 한 행 안에 라벨:값 (한 셀에 "Label: Value")
  const cellLabelValue = html.matchAll(/<t[dh][^>]*>([^<]*(?:Label|Reference|Participant|Date|Time|Email|Phone|Language|Pickup|Departure)[^<]*)\s*:\s*([^<]*)<\/t[dh]>/gi)
  for (const m of cellLabelValue) {
    const key = clean(m[1]).trim().toLowerCase()
    const value = clean(m[2]).trim()
    if (key.length > 2 && key.length < 80 && value && value.length < 300) {
      const normKey = key.replace(/\s+/g, ' ')
      if (!map.has(normKey)) map.set(normKey, value)
    }
  }
  return map
}

/**
 * Klook 본문에서 "Label: Value" 쌍을 추출 (한 줄 또는 HTML 변환 후 한 덩어리 모두 지원).
 * HTML에서 레이블과 값이 다른 요소에 있으면 "Booking reference ID:" / "VGP536908" 처럼 다음 줄에 올 수 있음.
 */
function parseKlookLabelValuePairs(text: string): Map<string, string> {
  const map = new Map<string, string>()
  const withBreaks = ensureKlookLabelLineBreaks(text)
  const normalized = withBreaks.trim()
  // 줄 단위로 나누거나, 한 줄이면 2개 이상 공백으로 구분된 블록으로 나눔
  const segments = normalized.includes('\n')
    ? normalized.split(/\n+/).map(s => s.trim()).filter(Boolean)
    : normalized.split(/\s{2,}/).map(s => s.trim()).filter(Boolean)
  const used = new Set<number>()
  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue
    const seg = segments[i]
    const colonIdx = seg.indexOf(':')
    if (colonIdx <= 0) continue
    const key = seg.slice(0, colonIdx).trim().toLowerCase()
    let value = seg.slice(colonIdx + 1).trim()
    // 레이블만 있고 값이 비어 있으면 다음 줄이 값인 경우 (예: "Booking reference ID:" 다음 줄 "VGP536908")
    if (!value && i + 1 < segments.length && !used.has(i + 1)) {
      const next = segments[i + 1]
      if (next && !next.includes(':') && next.length < 200) {
        value = next.trim()
        used.add(i + 1)
      }
    }
    if (!value) continue
    if (!map.has(key)) map.set(key, value)
  }
  return map
}

function getKlook(map: Map<string, string>, ...searchKeys: string[]): string | undefined {
  for (const searchKey of searchKeys) {
    const lower = searchKey.toLowerCase().replace(/\s+/g, ' ').trim()
    for (const [key, value] of map) {
      const normalizedKey = key.replace(/\s+/g, ' ').toLowerCase()
      if (normalizedKey === lower || normalizedKey.startsWith(lower) || lower.startsWith(normalizedKey)) return value
    }
  }
  return undefined
}

/**
 * Klook 예약 이메일 본문 전용 추출 (레이블: 값 형식 + HTML 테이블).
 * plainText 외에 rawHtml이 있으면 HTML에서 th/td 쌍을 먼저 추출해 활용.
 */
function extractKlook(
  text: string,
  _subject: string,
  _sourceEmail: string | null,
  rawHtml?: string | null
): Partial<ExtractedReservationData> {
  const out: Partial<ExtractedReservationData> = {}
  if (!text || text.length < 10) return out

  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // HTML 테이블에서 추출한 맵과 plain text 레이블-값 맵 병합 (HTML 우선)
  const pairMap = parseKlookLabelValuePairs(normalizedText)
  const htmlMap = rawHtml ? extractKlookFromHtml(rawHtml) : new Map<string, string>()
  const mergedMap = new Map<string, string>()
  for (const [k, v] of pairMap) {
    const key = k.replace(/\s+/g, ' ').toLowerCase().trim()
    if (key && v) mergedMap.set(key, v)
  }
  for (const [k, v] of htmlMap) {
    const key = k.replace(/\s+/g, ' ').toLowerCase().trim()
    if (key && v) mergedMap.set(key, v)
  }

  const v = (key: string) => getKlook(mergedMap, key)

  // 1차: 본문 전체에서 고객명·채널 RN 직접 검색 (레이블 파싱 실패 시에도 동작)
  const directRef = normalizedText.match(/\b([A-Z]{2,4}[0-9][A-Za-z0-9]{4,10})\b/)
  if (directRef) {
    const r = directRef[1]
    if (r.toLowerCase() !== 'id' && r.length >= 5) out.channel_rn = r
  }
  const directName = normalizedText.match(/\(\)\s*([A-Za-z][A-Za-z\s.-]{1,50}?)(?=\s{2,}|\s*(?:Booking reference|Date Request|Country|Participant|No\.|Preferred|Special|Departure|Phone|Email|WhatsApp)|\n|$)/im)
  if (directName) {
    const name = directName[1].trim()
    if (name.length >= 2 && name.length <= 80) out.customer_name = name
  }

  if (!out.channel_rn) {
    const ref =
      v('booking reference id') ??
      v('booking reference') ??
      v('order id') ??
      v('order number') ??
      v('confirmation number') ??
      v('reference number')
    const refTrimmed = ref?.trim() ?? ''
    // "ID" 단어만 있으면 레이블 일부로 잘못 파싱된 것 → 사용하지 않음. 실제 예약번호 형식(영문+숫자 5자 이상)만 허용
    if (refTrimmed && refTrimmed.toLowerCase() !== 'id' && refTrimmed.length >= 5 && /^[A-Za-z0-9_-]+$/.test(refTrimmed)) {
      out.channel_rn = refTrimmed
    }
  }
  if (!out.tour_date) {
    const dateRaw = v('date request') ?? v('date of experience') ?? v('tour date') ?? v('date')
    if (dateRaw) {
      const raw = dateRaw.trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) out.tour_date = raw
      else {
        const iso = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
        if (iso) out.tour_date = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
      }
    }
  }
  if (!out.tour_time) {
    const timeRaw = v('time request') ?? v('time of experience') ?? v('tour time') ?? v('time')
    if (timeRaw && !/^NA$/i.test(timeRaw.trim()) && /\d{1,2}:\d{2}/.test(timeRaw)) out.tour_time = timeRaw.trim()
  }
  // Lead participant / Lead traveller / Guest name 등 (다국어·변형 대응)
  if (!out.customer_name) {
    const name =
      v('lead participant') ??
      v('lead traveller') ??
      v('participant name') ??
      v('guest name') ??
      v('customer name') ??
      v('traveller name') ??
      v('lead participant name')
    if (name) {
      const trimmed = name.trim()
      // Klook 형식: "()" 또는 "() " 뒤가 고객 이름 (예: "()rica rockwell" → "rica rockwell")
      const cleaned = trimmed.replace(/^\(\)\s*/, '').replace(/^\([^)]*\)\s*/, '').trim()
      if (cleaned) out.customer_name = cleaned
    }
  }
  if (out.adults === undefined) {
    const noPart =
      v('no. of participants') ??
      v('number of participants') ??
      v('number of travellers') ??
      v('no of participants')
    if (noPart) {
      const n = parseInt(noPart.trim(), 10)
      if (!isNaN(n)) { out.adults = n; out.total_people = n }
    }
  }
  if (out.adults === undefined) {
    const part = v('participant')
    const adultMatch = part?.match(/(\d+)\s*x\s*adult/i)
    if (adultMatch) {
      const n = parseInt(adultMatch[1], 10)
      if (!isNaN(n)) { out.adults = n; out.total_people = n }
    }
  }
  if (!out.language) {
    const lang = v('preferred language') ?? v('language')
    if (lang) out.language = normalizeLanguageToCode(lang.trim())
  }
  if (!out.special_requests) {
    const special = v('special requirements') ?? v('special requests')
    if (special?.trim()) out.special_requests = special.trim()
  }
  if (!out.pickup_hotel) {
    const dep =
      v('departure location') ??
      v('please insert your pickup location') ??
      v('pickup location') ??
      v('pickup')
    if (dep?.trim()) out.pickup_hotel = dep.trim()
  }
  if (!out.customer_phone) {
    const phone = v('phone number') ?? v('contact number') ?? v('phone')
    if (phone?.trim()) out.customer_phone = phone.trim()
  }
  if (!out.customer_email) {
    const email = v('email') ?? v('email address')
    if (email && /@/.test(email)) out.customer_email = email.trim()
  }

  // 기존 정규식으로 한 번 더 채우기 (라인/한 줄 모두). 레이블 다음 줄에 값만 있는 경우도 처리
  if (!out.channel_rn) {
    const refMatch = normalizedText.match(/Booking\s*reference\s*ID\s*:\s*([A-Za-z0-9_-]+)/i) ??
      normalizedText.match(/Booking\s*reference\s*ID\s*[:\s]+([A-Za-z0-9_-]+)/i) ??
      normalizedText.match(/Booking\s*reference\s*ID\s*[:\s]*\n\s*([A-Za-z0-9_-]+)/i)
    const refVal = refMatch?.[1]?.trim() ?? ''
    if (refVal && refVal.toLowerCase() !== 'id' && refVal.length >= 5) out.channel_rn = refVal
  }
  // 본문에서 예약번호 형식(영문 2자 이상 + 숫자, 예: VGP536908)만 단독으로 검색
  if (!out.channel_rn) {
    const refInBody = normalizedText.match(/\b([A-Z]{2,}[0-9][A-Za-z0-9_-]{4,})\b/)
    if (refInBody) out.channel_rn = refInBody[1].trim()
  }

  // Date Request: 2026-03-15 (또는 다른 날짜 형식)
  if (!out.tour_date) {
    const dateMatch = normalizedText.match(/Date\s*Request\s*:\s*(\d{4}-\d{2}-\d{2})/i) ||
      normalizedText.match(/Date\s*Request\s*:\s*([^\n]+?)(?:\s*Time\s*Request|\n|$)/im)
    if (dateMatch) {
      const raw = dateMatch[1].trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) out.tour_date = raw
      else {
        const iso = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
        if (iso) out.tour_date = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
      }
    }
  }

  // Time Request: NA 또는 10:00 등
  if (!out.tour_time) {
    const timeMatch = normalizedText.match(/Time\s*Request\s*:\s*([^\n]+?)(?:\n|$)/im)
    if (timeMatch) {
      const raw = timeMatch[1].trim()
      if (raw && !/^NA$/i.test(raw) && /\d{1,2}:\d{2}/.test(raw)) out.tour_time = raw
    }
  }

  // Lead participant: ()rica rockwell — 한 줄/다음 줄 모두. 레이블만 한 줄이고 다음 줄에 "()이름" 있는 경우도 처리
  if (!out.customer_name) {
    const leadMatch = normalizedText.match(/(?:Lead\s*participant|Participant\s*name|Guest\s*name)\s*:\s*(?:\(\)|\([^)]*\))?\s*([^\n]+?)(?=\s*\n|Country\s|Participant\s|No\.\s|Preferred\s|Special\s|Departure|Phone\s|Email\s|WhatsApp\s|$)/im) ||
      normalizedText.match(/Lead\s*participant\s*:\s*\(\)\s*([^\n]+?)(?:\n|Country|Participant|$)/im) ||
      normalizedText.match(/Lead\s*participant\s*[:\s]+\(\)\s*([A-Za-z\s.-]+?)(?=\s*(?:Booking reference|Date Request|Country|Participant\s|No\.|Preferred|Special|Departure|Phone|Email|WhatsApp)|$)/im) ||
      normalizedText.match(/Lead\s*participant\s*[:\s]*\n\s*\(\)\s*([^\n]+?)(?=\n|$)/im)
    if (leadMatch) {
      const name = leadMatch[1].replace(/^\(\)\s*/, '').replace(/^\([^)]*\)\s*/, '').trim()
      if (name && name.length < 120) out.customer_name = name
    }
  }
  // Klook 본문에 "()이름"만 나오는 경우(레이블이 다른 줄/형식일 때) — 괄호 뒤 이름만 추출
  if (!out.customer_name) {
    const parenName = normalizedText.match(/\(\)\s*([A-Za-z][A-Za-z\s.-]{1,80}?)(?=\s{2,}|\s*(?:Booking reference|Date Request|Country|Participant|No\.|Preferred|Special|Departure|Phone|Email|WhatsApp)|\n\n|$)/im)
    if (parenName) {
      const name = parenName[1].trim()
      if (name.length >= 2 && name.length < 100) out.customer_name = name
    }
  }

  // No. of participants / Number of participants
  if (out.adults === undefined) {
    const noParticipantsMatch = normalizedText.match(/(?:No\.?\s*of|Number\s*of)\s*participants\s*:\s*(\d+)/i)
    if (noParticipantsMatch) {
      const n = parseInt(noParticipantsMatch[1], 10)
      out.adults = n
      out.total_people = n
    }
  }
  if (out.adults === undefined) {
    const participantMatch = normalizedText.match(/Participant\s*:\s*(\d+)\s*x\s*Adult/i)
    if (participantMatch) {
      const n = parseInt(participantMatch[1], 10)
      out.adults = n
      out.total_people = n
    }
  }

  // Preferred language
  if (!out.language) {
    const langMatch = normalizedText.match(/Preferred\s*language\s*:\s*([^\n]+?)(?:\n|Special|$)/im)
    if (langMatch) out.language = normalizeLanguageToCode(langMatch[1].trim())
  }

  // Special requirements
  if (!out.special_requests) {
    const specialMatch = normalizedText.match(/Special\s*requirements\s*:\s*([^\n]*?)(?:\n\s*\n|No\.|Departure|Please|Phone|Email|WhatsApp|$)/im)
    if (specialMatch && specialMatch[1].trim()) out.special_requests = specialMatch[1].trim()
  }

  // Departure location / Pickup location
  if (!out.pickup_hotel) {
    const departureMatch = normalizedText.match(/Departure\s*location\s*:\s*([^\n]+?)(?:\n|Please|Phone|Email|$)/im)
    if (departureMatch) out.pickup_hotel = departureMatch[1].trim()
  }
  if (!out.pickup_hotel) {
    const insertMatch = normalizedText.match(/Please\s*insert\s*your\s*pickup\s*location\s*:\s*([^\n]+?)(?:\n|Please\s*confirm|Phone|Email|$)/im)
    if (insertMatch) out.pickup_hotel = insertMatch[1].trim()
  }

  // Phone number
  if (!out.customer_phone) {
    const phoneMatch = normalizedText.match(/Phone\s*number\s*:\s*([^\n]+?)(?:\n|Email|WhatsApp|$)/im)
    if (phoneMatch) out.customer_phone = phoneMatch[1].trim()
  }

  // Email
  if (!out.customer_email) {
    const emailMatch = normalizedText.match(/Email\s*:\s*([^\s\n]+@[^\s\n]+)/im)
    if (emailMatch) out.customer_email = emailMatch[1].trim()
  }

  // Activity URL → note에 포함 (상품 매칭 참고용)
  const activityUrlMatch = normalizedText.match(/Activity\s*URL\s*:\s*([^\s\n]+)/i)
  const noteParts: string[] = []
  if (out.special_requests) noteParts.push(`요청: ${out.special_requests}`)
  if (activityUrlMatch) noteParts.push(`Klook Activity: ${activityUrlMatch[1].trim()}`)
  const whatsappMatch = normalizedText.match(/WhatsApp\s*:\s*([^\n]+?)(?:\n|$)/im)
  if (whatsappMatch && whatsappMatch[1].trim()) noteParts.push(`비상연락처(WhatsApp): ${whatsappMatch[1].trim()}`)
  if (noteParts.length) out.note = noteParts.join(' · ')

  return out
}

/** 채널별 파서 등록: 플랫폼 키 → 전처리 + 추출. 새 채널 추가 시 여기에 한 줄씩 등록. */
const CHANNEL_PARSERS: Record<string, ChannelParserConfig> = {
  getyourguide: {
    preprocess: toPlainText,
    extract: (text, subject, sourceEmail) =>
      extractGetYourGuide(text, subject, sourceEmail),
  },
  klook: {
    preprocess: toPlainTextKlook,
    extract: (text, subject, sourceEmail, rawHtml) =>
      extractKlook(text, subject, sourceEmail, rawHtml),
  },
  // viator, tripadvisor, booking, expedia, airbnb 등은 추후 동일 패턴으로 추가
  // viator: { preprocess: toPlainText, extract: extractViator },
}

/**
 * 이메일 제목 + 본문에서 예약/고객 정보 추출.
 * 채널별 파서는 CHANNEL_PARSERS에 등록된 것만 사용하며, 없으면 공통 패턴만 적용.
 */
export function extractReservationFromEmail(options: {
  subject: string
  text?: string | null
  html?: string | null
  sourceEmail?: string | null
}): { platform_key: string | null; extracted_data: ExtractedReservationData } {
  const { subject, text, html, sourceEmail } = options
  const platform_key = detectPlatform(sourceEmail || null, subject)
  const parser = platform_key ? CHANNEL_PARSERS[platform_key] : undefined

  let bodyRaw = (text && text.trim()) || ''
  const rawHtml = bodyRaw && bodyRaw.includes('<') ? bodyRaw : (html && html.trim()) || null
  if (bodyRaw && bodyRaw.includes('<')) {
    bodyRaw = parser?.preprocess ? parser.preprocess(bodyRaw) : toPlainText(bodyRaw)
  } else if (!bodyRaw && html) {
    bodyRaw = parser?.preprocess ? parser.preprocess(html) : toPlainText(html)
  }
  const plainText = bodyRaw || (html ? toPlainText(html) : '')
  const fullText = [subject, plainText].filter(Boolean).join('\n')
  const common = extractCommonPatterns(fullText)

  let merged: Partial<ExtractedReservationData> = {
    ...common,
    ...(platform_key ? { platform_key } : {}),
  }
  if (parser?.extract) {
    const channelData = parser.extract(plainText, subject, sourceEmail || null, rawHtml ?? html ?? null)
    merged = { ...merged, ...channelData }
  }
  if (platform_key === 'klook' && (subject || '').trimStart().toLowerCase().startsWith('klook order received -')) {
    merged.is_booking_confirmed = true
  }

  const extracted_data: ExtractedReservationData = merged as ExtractedReservationData
  return { platform_key, extracted_data }
}

/** 등록된 채널 파서 목록 (UI/설정용). 새 채널 추가 시 CHANNEL_PARSERS와 여기 동기화 */
export const SUPPORTED_EMAIL_CHANNELS = [
  'getyourguide',
  'klook',
  'viator',
  'tripadvisor',
  'booking',
  'expedia',
  'airbnb',
] as const
