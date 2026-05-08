import { isGarbageImportedCustomerName } from '@/lib/emailReservationParser'
import { isPickupImportNotDecidedLabel } from '@/lib/reservationImportPickup'
import type { Database } from '@/lib/supabase'
import type { 
  Customer, 
  Product, 
  Channel, 
  ProductOption, 
  ProductOptionChoice, 
  Option, 
  PickupHotel, 
  Reservation 
} from '@/types/reservation'

// 픽업 호텔 ID로 호텔 정보를 찾는 헬퍼 함수 (id, hotel, pick_up_location만 있으면 동작)
export const getPickupHotelDisplay = (hotelId: string, pickupHotels: Array<{ id: string; hotel?: string; pick_up_location?: string | null }> | null) => {
  const hotel = pickupHotels?.find(h => h.id === hotelId)
  return hotel ? `${hotel.hotel ?? ''} - ${hotel.pick_up_location ?? ''}` : hotelId
}

/** 이메일 등에서 추출한 픽업 주소/호텔명 문자열을 pickup_hotels 목록과 매칭해 id 반환 (없으면 null). 짧은/일반 문자열로 첫 행만 걸리는 오매칭을 줄인다. */
export function matchPickupHotelId(
  extractedText: string | null | undefined,
  pickupHotels: Array<{ id: string; hotel?: string | null; pick_up_location?: string | null; address?: string | null }> | null
): string | null {
  if (!extractedText?.trim() || !pickupHotels?.length) return null
  let query = extractedText.trim()
  if (isPickupImportNotDecidedLabel(query)) {
    const nd = pickupHotels.find(
      (h) =>
        /not\s*decided/i.test(h.hotel ?? '') ||
        /not\s*decided/i.test(h.pick_up_location ?? '')
    )
    if (nd) return nd.id
  }
  if (/\bTrump\s+(?:International\s+)?Hotel\s+(?:Las\s+Vegas)?/i.test(query)) query = 'Trump hotel'
  const qNorm = query.replace(/\s+/g, ' ').trim().toLowerCase()
  const q = qNorm
  const hotelNamePart = q.split(',')[0].trim()
  const addressPart = q.includes(',') ? q.replace(/^[^,]+,?\s*/, '').trim() : ''
  /** "las vegas" 등 짧은 공통 구간으로 잘못된 호텔이 먼저 잡히는 것 방지 (Trump 등 짧은 별칭은 하단 분기) */
  const MIN_SUB = 10

  for (const h of pickupHotels) {
    const hotel = (h.hotel ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
    const location = (h.pick_up_location ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
    const address = (h.address ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
    if (!hotel && !location && !address) continue
    const disp = `${hotel} - ${location}`.replace(/\s*-\s*$/, '').trim()
    if (disp && disp === qNorm) return h.id
    if (hotel && hotel === qNorm) return h.id
    if (
      hotel &&
      hotelNamePart.length >= MIN_SUB &&
      (hotel.includes(hotelNamePart) || hotelNamePart.includes(hotel))
    ) {
      return h.id
    }
    if (hotel && hotel.length >= 8 && q.includes(hotel)) return h.id
    if (
      address &&
      addressPart.length >= MIN_SUB &&
      (address.includes(addressPart) || addressPart.includes(address) || q.includes(address))
    ) {
      return h.id
    }
    if (
      location &&
      hotelNamePart.length >= MIN_SUB &&
      (location.includes(hotelNamePart) || hotelNamePart.includes(location))
    ) {
      return h.id
    }
  }
  if (q.includes('trump')) {
    const byTrump = pickupHotels.find(
      (h) =>
        (h.hotel ?? '').toLowerCase().includes('trump') ||
        (h.pick_up_location ?? '').toLowerCase().includes('trump')
    )
    if (byTrump) return byTrump.id
  }
  return null
}

/** 이메일 추출/DB에 저장된 고객명에서 "customer-" 앞에서 끊어 반환. "LAST, FIRST" → "LAST FIRST" 정규화 (KKday 대표 여행자 등). */
export function normalizeCustomerNameFromImport(name: string | null | undefined): string {
  if (name == null || typeof name !== 'string') return ''
  if (isGarbageImportedCustomerName(name)) return ''
  const before = name.split(/\s*customer-/i)[0].trim()
  const base = before !== '' ? before : name.trim()
  return base
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 예약 가져오기: DB의 extracted_data.amount 가 비었을 때 원문(HTML/텍스트)에서 고객 결제 금액 후보 추출.
 * "Price" / "Total" 라벨 우선, 줄바꿈·태그로 분리된 경우 포함.
 */
export function extractPriceFromEmailBodyForImport(raw: string | null | undefined): string | undefined {
  if (raw == null || String(raw).trim().length < 4) return undefined
  const text = String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const tryPatterns: RegExp[] = [
    /\bPrice\b\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
    /\bTotal\b\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
    /\bAmount\s*(?:paid)?\b\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
    /\bprice\b\s*:?\s*[\s]{0,3}\$?\s*([\d,]+\.?\d*)/i,
  ]
  for (const re of tryPatterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const n = parseFloat(String(m[1]).replace(/,/g, ''))
      if (Number.isFinite(n) && n >= 1) return `$${String(m[1]).replace(/,/g, '')}`
    }
  }
  return undefined
}

/** Viator 원문에서 Net Rate 라인 추출 (extracted_data에 없을 때 폴백) */
export function extractViatorNetRateFromEmailBodyForImport(raw: string | null | undefined): string | undefined {
  if (raw == null || String(raw).trim().length < 8) return undefined
  const text = String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const m = text.match(/Net\s*Rate\s*:?\s*(?:USD\s*)?\$?\s*([\d,]+\.?\d*)/i)
  if (!m?.[1]) return undefined
  const n = parseFloat(String(m[1]).replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 0.01) return undefined
  return `$${String(m[1]).replace(/,/g, '')}`
}

// 고객 이름 가져오기
export const getCustomerName = (customerId: string, customers: Customer[] | null) => {
  return customers?.find(c => c.id === customerId)?.name || 'Unknown'
}

// 상품 이름 가져오기
export const getProductName = (productId: string, products: Product[] | null) => {
  return products?.find(p => p.id === productId)?.name || 'Unknown'
}

// 상품 이름 가져오기 (locale에 따라 name_ko / name_en 사용)
export const getProductNameForLocale = (
  productId: string,
  products: Array<{ id: string; name?: string | null; name_ko?: string | null; name_en?: string | null }> | null,
  locale: string
) => {
  const product = products?.find(p => p.id === productId)
  if (!product) return 'Unknown'
  if (locale === 'en' && product.name_en) return product.name_en
  if (product.name_ko) return product.name_ko
  return product.name || 'Unknown'
}

/** PostgREST 예약 행에 붙는 `channels(name)` embed 파싱 */
export function parseEmbeddedChannelNameFromReservationRow(item: Record<string, unknown>): string | undefined {
  const raw = item.channels
  if (raw == null) return undefined
  if (Array.isArray(raw)) {
    const first = raw[0] as { name?: string | null } | undefined
    const n = first?.name
    return n != null && String(n).trim() !== '' ? String(n).trim() : undefined
  }
  if (typeof raw === 'object') {
    const n = (raw as { name?: string | null }).name
    return n != null && String(n).trim() !== '' ? String(n).trim() : undefined
  }
  return undefined
}

// 채널 이름 가져오기 (id, name만 있으면 동작)
export const getChannelName = (channelId: string, channels: Array<{ id: string; name?: string | null }> | null) => {
  const id = String(channelId ?? '').trim()
  if (!id) return 'Unknown'
  const ch = channels?.find((c) => String(c.id ?? '').trim() === id)
  return ch?.name?.trim() || 'Unknown'
}

/** reservations.variant_key / 클라이언트 variantKey */
export function getReservationVariantKey(reservation: {
  variantKey?: string | null
  variant_key?: string | null
}): string {
  const v = reservation.variantKey ?? reservation.variant_key
  const s = v != null ? String(v).trim() : ''
  return s || 'default'
}

/** 표시: `채널명` 또는 `채널명 - variant` (variant 없음·기본값은 생략) */
export function formatChannelDashVariant(
  channelId: string,
  channels: Array<{ id: string; name?: string | null }> | null,
  reservation: {
    variantKey?: string | null
    variant_key?: string | null
    channelNameSnapshot?: string | null
  }
): string {
  const id = String(channelId ?? '').trim()
  const snap = reservation.channelNameSnapshot?.trim()
  const name = snap || getChannelName(id, channels)
  const v = reservation.variantKey ?? reservation.variant_key
  const vs = v != null ? String(v).trim() : ''
  const variantLabel = vs && vs !== 'default' ? vs : ''
  return variantLabel ? `${name} - ${variantLabel}` : name
}

// 채널 정보 가져오기 (이름과 파비콘)
export const getChannelInfo = (channelId: string, channels: Channel[] | null) => {
  const id = String(channelId ?? '').trim()
  const channel = channels?.find((c) => String(c.id ?? '').trim() === id)
  return {
    name: channel?.name || 'Unknown',
    favicon_url: (channel as any)?.favicon_url || null
  }
}

// 상태 라벨 가져오기
export const getStatusLabel = (status: string, t: (key: string) => string) => {
  return t(`status.${status}`)
}

// 상태 색상 가져오기
export const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-800'
    case 'Confirmed': return 'bg-green-100 text-green-800'
    case 'inquiry': return 'bg-sky-100 text-sky-900'
    case 'Inquiry': return 'bg-sky-100 text-sky-900'
    case 'pending': return 'bg-yellow-100 text-yellow-800'
    case 'Pending': return 'bg-yellow-100 text-yellow-800'
    case 'completed': return 'bg-blue-100 text-blue-800'
    case 'cancelled': return 'bg-red-100 text-red-800'
    case 'Canceled': return 'bg-red-100 text-red-800'
    case 'recruiting': return 'bg-purple-100 text-purple-800'
    case 'Recruiting': return 'bg-purple-100 text-purple-800'
    case 'Payment Requested': return 'bg-orange-100 text-orange-800'
    case 'deleted': return 'bg-gray-100 text-gray-600'
    case 'Deleted': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-800'
  }
}

// 총 가격 계산
export const calculateTotalPrice = (reservation: Reservation, products: Product[], optionChoices: ProductOptionChoice[]) => {
  const product = products.find(p => p.id === reservation.productId)
  if (!product || !product.base_price) return 0
  
  // 기본 가격을 성인/아동/유아로 나누어 계산 (간단한 계산)
  let adultPrice = product.base_price
  let childPrice = product.base_price * 0.7 // 아동은 성인의 70%
  let infantPrice = product.base_price * 0.3 // 유아는 성인의 30%
  
  // 선택된 옵션의 가격 조정 적용
  if (reservation.selectedOptions) {
    Object.entries(reservation.selectedOptions).forEach(([optionId, choiceIds]) => {
      if (Array.isArray(choiceIds)) {
        choiceIds.forEach(choiceId => {
          const choice = optionChoices.find(c => c.id === choiceId)
          if (choice) {
            if (choice.adult_price_adjustment !== null) {
              adultPrice += choice.adult_price_adjustment
            }
            if (choice.child_price_adjustment !== null) {
              childPrice += choice.child_price_adjustment
            }
            if (choice.infant_price_adjustment !== null) {
              infantPrice += choice.infant_price_adjustment
            }
          }
        })
      }
    })
  }
  
  // 사용자가 입력한 요금 정보 적용
  if (reservation.selectedOptionPrices) {
    Object.entries(reservation.selectedOptionPrices).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (key.includes('_adult')) {
          adultPrice += value
        } else if (key.includes('_child')) {
          childPrice += value
        } else if (key.includes('_infant')) {
          infantPrice += value
        }
      }
    })
  }
  
  return (
    reservation.adults * adultPrice +
    reservation.child * childPrice +
    reservation.infant * infantPrice
  )
}

// 상품의 필수 선택 옵션을 카테고리별로 그룹화하여 가져오기
export const getRequiredOptionsForProduct = (productId: string, productOptions: ProductOption[], options: Database['public']['Tables']['options']['Row'][]) => {
  const requiredOptions = productOptions.filter(option => 
    option.product_id === productId && option.is_required === true
  )
  
  // 카테고리별로 그룹화 (options 테이블의 category 사용)
  const groupedOptions = requiredOptions.reduce((groups, option) => {
    // linked_option_id를 통해 options 테이블의 category 가져오기
    const linkedOption = options.find(opt => opt.id === option.linked_option_id)
    const category = linkedOption?.category || '기타'
    
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(option)
    return groups
  }, {} as Record<string, ProductOption[]>)
  
  return groupedOptions
}

// 상품의 선택 옵션 (is_multiple이 true인 옵션) 가져오기
export const getOptionalOptionsForProduct = (productId: string, productOptions: ProductOption[]) => {
  return productOptions.filter(option => 
    option.product_id === productId && option.is_multiple === true
  )
}

// 옵션의 선택지 가져오기 (병합된 테이블 구조)
export const getChoicesForOption = (optionId: string, productOptions: ProductOption[]) => {
  // 실제 시스템에서는 choice ID가 옵션 ID와 동일하므로 옵션 자체를 choice로 반환
  const option = productOptions.find(opt => opt.id === optionId)
  return option ? [{
    id: option.id,
    name: option.name,
    description: option.description,
    adult_price_adjustment: 0,
    child_price_adjustment: 0,
    infant_price_adjustment: 0,
    is_default: true,
    product_option_id: option.id
  }] : []
}

/** 투어일·예약일 집계 키용 (ISO 등 → YYYY-MM-DD 통일, 투어 상세와 동일하게 맞춤) */
export function normalizeTourDateKey(d: string | null | undefined): string {
  if (d == null) return ''
  const s = String(d).trim()
  if (!s) return ''
  return s.split('T')[0] ?? ''
}

/** 로컬 자정 기준으로 투어일이 오늘보다 이전이면 true(당일 제외). 파싱 불가·빈 값은 false. */
export function isReservationTourDatePastLocal(d: string | null | undefined): boolean {
  const key = normalizeTourDateKey(d)
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const day = Number(m[3])
  const tour = new Date(y, mo - 1, day)
  if (Number.isNaN(tour.getTime())) return false
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return tour.getTime() < todayStart.getTime()
}

/** 예약 상태가 확정(confirmed)인지 */
export function isReservationStatusConfirmed(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  return s === 'confirmed'
}

/**
 * 투어 시작 시각(로컬) epoch ms. tourDate YYYY-MM-DD + tourTime `HH:MM`(선택).
 * 시간이 없으면 해당일 00:00 로컬.
 */
export function reservationTourStartTimestampMsLocal(input: {
  tourDate?: string | null
  tourTime?: string | null
}): number | null {
  const dk = normalizeTourDateKey(input.tourDate)
  const m = dk.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const tt = String(input.tourTime ?? '').trim()
  let hh = 0
  let mm = 0
  const tm = tt.match(/^(\d{1,2}):(\d{2})/)
  if (tm) {
    hh = Math.min(23, Math.max(0, parseInt(tm[1], 10)))
    mm = Math.min(59, Math.max(0, parseInt(tm[2], 10)))
  }
  const dt = new Date(y, mo - 1, d, hh, mm, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  return dt.getTime()
}

/** 투어 시작 전이며, 지금부터 투어 시작까지가 48시간 이내인지(로컬 시각 기준). */
export function isWithin48HoursBeforeTourStartLocal(input: {
  tourDate?: string | null
  tourTime?: string | null
}): boolean {
  const start = reservationTourStartTimestampMsLocal(input)
  if (start == null) return false
  const now = Date.now()
  const ms48h = 48 * 60 * 60 * 1000
  if (start <= now) return false
  return start - now <= ms48h
}

/** 로컬 달력 기준 오늘 날짜 YYYY-MM-DD */
export function localCalendarDateKeyToday(): string {
  const now = new Date()
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/**
 * 예약 등록 시각(예: created_at)의 로컬 날짜가 오늘보다 이전이면 true.
 * 파싱 불가·빈 값은 false(목록에서 숨기지 않음).
 */
export function isReservationAddedStrictlyBeforeTodayLocal(
  addedAt: string | null | undefined
): boolean {
  const addedKey = isoToLocalCalendarDateKey(addedAt)
  if (!addedKey) return false
  return addedKey < localCalendarDateKeyToday()
}

export function isoToLocalCalendarDateKey(iso: string | null | undefined): string | null {
  if (iso == null || String(iso).trim() === '') return null
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const LV_TZ = 'America/Los_Angeles'

/** UTC/ISO 시각을 라스베가스 달력 날짜 YYYY-MM-DD로 변환 (예약 등록일·수정일 집계용) */
export function isoToLasVegasCalendarDateKey(iso: string | null | undefined): string | null {
  if (iso == null || String(iso).trim() === '') return null
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: LV_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !d) return null
  return `${y}-${m}-${d}`
}

/** 라스베가스 달력 기준 오늘 YYYY-MM-DD */
export function lasVegasCalendarDateKeyToday(): string {
  return isoToLasVegasCalendarDateKey(new Date().toISOString()) ?? ''
}

/** 등록 시각의 LV 달력 날짜가 LV 기준 오늘보다 이전이면 true */
export function isReservationAddedStrictlyBeforeTodayLasVegas(
  addedAt: string | null | undefined
): boolean {
  const addedKey = isoToLasVegasCalendarDateKey(addedAt)
  if (!addedKey) return false
  const today = lasVegasCalendarDateKeyToday()
  if (!today) return false
  return addedKey < today
}

/** DB 투어일(YYYY-MM-DD)이 라스베가스 달력 기준 오늘보다 이전이면 true */
export function isReservationTourDatePastLasVegas(d: string | null | undefined): boolean {
  const key = normalizeTourDateKey(d)
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const today = lasVegasCalendarDateKeyToday()
  if (!today) return false
  return key < today
}

/**
 * 예약 인원 합계 (성인+아동+유아).
 * DB/API는 `child`·`infant`와 `children`·`infants`가 혼용될 수 있음.
 * 구성값이 모두 0이면 `total_people`이 있으면 그 값을 사용.
 */
export function getReservationPartySize(r: Record<string, unknown>): number {
  const adults = Number(r.adults ?? 0) || 0
  const child = Number(r.children ?? r.child ?? 0) || 0
  const infant = Number(r.infants ?? r.infant ?? 0) || 0
  const sum = adults + child + infant
  if (sum > 0) return sum
  const tp = r.total_people
  if (tp != null && Number(tp) > 0) return Number(tp)
  return 0
}
