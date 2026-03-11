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

/**
 * Klook 예약 이메일 본문 전용 추출 (레이블: 값 형식)
 * 예: Booking reference ID: VGP536908, Date Request: 2026-03-15, Lead participant: ()rica rockwell, Participant: 2 x Adult ...
 */
function extractKlook(text: string): Partial<ExtractedReservationData> {
  const out: Partial<ExtractedReservationData> = {}
  if (!text || text.length < 10) return out

  // Booking reference ID: VGP536908 → 채널 예약번호(channel_rn)
  const refMatch = text.match(/Booking\s*reference\s*ID\s*:\s*([A-Za-z0-9_-]+)/i)
  if (refMatch) out.channel_rn = refMatch[1].trim()

  // Date Request: 2026-03-15 (또는 다른 날짜 형식)
  const dateMatch = text.match(/Date\s*Request\s*:\s*(\d{4}-\d{2}-\d{2})/i) ||
    text.match(/Date\s*Request\s*:\s*([^\n]+?)(?:\s*Time\s*Request|\n|$)/im)
  if (dateMatch) {
    const raw = dateMatch[1].trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) out.tour_date = raw
    else {
      const iso = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
      if (iso) out.tour_date = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
    }
  }

  // Time Request: NA 또는 10:00 등 — NA가 아니면 tour_time 설정
  const timeMatch = text.match(/Time\s*Request\s*:\s*([^\n]+?)(?:\n|$)/im)
  if (timeMatch) {
    const raw = timeMatch[1].trim()
    if (raw && !/^NA$/i.test(raw) && /\d{1,2}:\d{2}/.test(raw)) out.tour_time = raw
  }

  // Lead participant: ()rica rockwell — 고객 이름은 "()" 다음에 오는 문자열(rica rockwell)
  const leadMatch = text.match(/Lead\s*participant\s*:\s*\(\)\s*([^\n]+?)(?:\n|Country|Participant|$)/im)
  if (leadMatch) {
    const name = leadMatch[1].trim()
    if (name) out.customer_name = name
  }

  // No. of participants: 2 — Klook에서는 이 숫자가 성인 수(adults)이자 총 인원(total_people)
  const noParticipantsMatch = text.match(/No\.?\s*of\s*participants\s*:\s*(\d+)/i)
  if (noParticipantsMatch) {
    const n = parseInt(noParticipantsMatch[1], 10)
    out.adults = n
    out.total_people = n
  }
  // Participant: 2 x Adult (No. of participants 없을 때 대체)
  if (out.adults === undefined) {
    const participantMatch = text.match(/Participant\s*:\s*(\d+)\s*x\s*Adult/i)
    if (participantMatch) {
      const n = parseInt(participantMatch[1], 10)
      out.adults = n
      out.total_people = n
    }
  }

  // Preferred language: English
  const langMatch = text.match(/Preferred\s*language\s*:\s*([^\n]+?)(?:\n|Special|$)/im)
  if (langMatch) out.language = normalizeLanguageToCode(langMatch[1].trim())

  // Special requirements: (값)
  const specialMatch = text.match(/Special\s*requirements\s*:\s*([^\n]*?)(?:\n\s*\n|No\.|Departure|Please|Phone|Email|WhatsApp|$)/im)
  if (specialMatch && specialMatch[1].trim()) out.special_requests = specialMatch[1].trim()

  // Departure location: Bellagio Hotel & Casino → 픽업 호텔
  const departureMatch = text.match(/Departure\s*location\s*:\s*([^\n]+?)(?:\n|Please|Phone|Email|$)/im)
  if (departureMatch) out.pickup_hotel = departureMatch[1].trim()

  // Please insert your pickup location: bellagio hotel (Departure 없을 때 대체)
  if (!out.pickup_hotel) {
    const insertMatch = text.match(/Please\s*insert\s*your\s*pickup\s*location\s*:\s*([^\n]+?)(?:\n|Please\s*confirm|Phone|Email|$)/im)
    if (insertMatch) out.pickup_hotel = insertMatch[1].trim()
  }

  // Phone number: +1-9496003819 → 고객 전화번호
  const phoneMatch = text.match(/Phone\s*number\s*:\s*([^\n]+?)(?:\n|Email|WhatsApp|$)/im)
  if (phoneMatch) out.customer_phone = phoneMatch[1].trim()

  // Email: ricarockwell@yahoo.com → 고객 이메일 주소
  const emailMatch = text.match(/Email\s*:\s*([^\s\n]+@[^\s\n]+)/im)
  if (emailMatch) out.customer_email = emailMatch[1].trim()

  // Activity URL → note에 포함 (상품 매칭 참고용)
  const activityUrlMatch = text.match(/Activity\s*URL\s*:\s*([^\s\n]+)/i)
  const noteParts: string[] = []
  if (out.special_requests) noteParts.push(`요청: ${out.special_requests}`)
  if (activityUrlMatch) noteParts.push(`Klook Activity: ${activityUrlMatch[1].trim()}`)
  // WhatsApp: 9496003819 → 고객 비상연락처
  const whatsappMatch = text.match(/WhatsApp\s*:\s*([^\n]+?)(?:\n|$)/im)
  if (whatsappMatch && whatsappMatch[1].trim()) noteParts.push(`비상연락처(WhatsApp): ${whatsappMatch[1].trim()}`)
  if (noteParts.length) out.note = noteParts.join(' · ')

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
  // 붙여넣은 본문이 HTML이면 태그 제거 후 파싱 (정규식이 레이블/값을 제대로 잡도록)
  let bodyRaw = (text && text.trim()) || ''
  if (bodyRaw && bodyRaw.includes('<')) bodyRaw = toPlainText(bodyRaw)
  const plainText = bodyRaw || (html ? toPlainText(html) : '')
  const fullText = [subject, plainText].filter(Boolean).join('\n')

  const platform_key = detectPlatform(sourceEmail || null, subject)
  const common = extractCommonPatterns(fullText)

  let merged: Partial<ExtractedReservationData> = { ...common, platform_key: platform_key ?? undefined }
  if (platform_key === 'getyourguide') {
    const gyG = extractGetYourGuide(plainText, subject, sourceEmail || null)
    merged = { ...merged, ...gyG }
  }
  if (platform_key === 'klook') {
    const klook = extractKlook(plainText)
    merged = { ...merged, ...klook }
    // Klook 예약 접수: 제목이 "Klook Order Received -"로 시작 (목록 강조용)
    if ((subject || '').trimStart().toLowerCase().startsWith('klook order received -')) {
      merged.is_booking_confirmed = true
    }
  }

  const extracted_data: ExtractedReservationData = merged as ExtractedReservationData
  return { platform_key, extracted_data }
}
