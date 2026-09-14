/**
 * OTA 이메일 파싱 규칙 카탈로그.
 * 예약 가져오기 모달·자동 예약 추가 자격 판정에 사용.
 */
import {
  GYG_PRODUCT_ID_TO_NAME,
  KKDAY_PRODUCT_NO_TO_PRODUCT_ID,
  KKDAY_PRODUCT_NO_TO_TOUR_NAME,
  KLOOK_ACTIVITY_ID_FORCE_VARIANT,
  KLOOK_ACTIVITY_ID_TO_PRODUCT_ID,
  KLOOK_ACTIVITY_ID_TO_TOUR_NAME,
  SUPPORTED_EMAIL_CHANNELS,
  isCancellationRequestEmailSubject,
} from '@/lib/emailReservationParser'
import { PLATFORM_CHANNEL_MAP } from '@/lib/platformChannelMapping'
import { parseImportMoneyString } from '@/lib/importReservationPriceResolve'
import type { ExtractedReservationData } from '@/types/reservationImport'

export type OtaParsePriceFields = {
  amount: boolean
  amount_excluded: boolean
  viator_net_rate: boolean
}

export type OtaParseMatcherType = 'activity_id' | 'product_no' | 'title_pattern'

export type OtaParseProductRule = {
  id: string
  platform_key: string
  matcher_type: OtaParseMatcherType
  matcher_value: string
  matcher_label: string
  product_id: string | null
  product_name: string
  variant_key?: string
  variant_label?: string
  price: OtaParsePriceFields
  notes?: string
}

export type OtaPlatformCatalogMeta = {
  key: string
  label: string
  hasDedicatedParser: boolean
  price: OtaParsePriceFields
  fieldCoverage: {
    product: 'strong' | 'partial' | 'none'
    people: 'strong' | 'partial' | 'none'
    date: 'strong' | 'partial' | 'none'
    customer: 'strong' | 'partial' | 'none'
    price: 'strong' | 'partial' | 'none'
  }
  notes: string
}

const PRICE_KLOOK: OtaParsePriceFields = { amount: true, amount_excluded: true, viator_net_rate: false }
const PRICE_AMOUNT: OtaParsePriceFields = { amount: true, amount_excluded: false, viator_net_rate: false }
const PRICE_VIATOR: OtaParsePriceFields = { amount: false, amount_excluded: false, viator_net_rate: true }
const PRICE_NONE: OtaParsePriceFields = { amount: false, amount_excluded: false, viator_net_rate: false }

export const OTA_PLATFORM_CATALOG: OtaPlatformCatalogMeta[] = [
  {
    key: 'klook',
    label: 'Klook',
    hasDedicatedParser: true,
    price: PRICE_KLOOK,
    fieldCoverage: { product: 'strong', people: 'strong', date: 'strong', customer: 'strong', price: 'strong' },
    notes: 'Activity URL → 상품/variant, Total amount + Amount not included',
  },
  {
    key: 'getyourguide',
    label: 'GetYourGuide',
    hasDedicatedParser: true,
    price: PRICE_AMOUNT,
    fieldCoverage: { product: 'strong', people: 'strong', date: 'strong', customer: 'strong', price: 'strong' },
    notes: '본문 상품명 패턴 + Price',
  },
  {
    key: 'viator',
    label: 'Viator',
    hasDedicatedParser: true,
    price: PRICE_VIATOR,
    fieldCoverage: { product: 'strong', people: 'strong', date: 'strong', customer: 'strong', price: 'strong' },
    notes: '상품명 패턴 + Net Rate(USD) → 채널 정산 금액',
  },
  {
    key: 'kkday',
    label: 'KKday',
    hasDedicatedParser: true,
    price: PRICE_AMOUNT,
    fieldCoverage: { product: 'strong', people: 'strong', date: 'strong', customer: 'strong', price: 'partial' },
    notes: '상품번호 매핑. 금액은 공통 Price 패턴에 의존',
  },
  {
    key: 'maniatour',
    label: 'Maniatour (홈페이지)',
    hasDedicatedParser: true,
    price: PRICE_AMOUNT,
    fieldCoverage: { product: 'partial', people: 'strong', date: 'strong', customer: 'strong', price: 'strong' },
    notes: '일출 상품 제목 매핑 + Wix Price',
  },
  {
    key: 'myrealtrip',
    label: '마이리얼트립',
    hasDedicatedParser: true,
    price: PRICE_AMOUNT,
    fieldCoverage: { product: 'partial', people: 'partial', date: 'strong', customer: 'partial', price: 'partial' },
    notes: '일출 상품명 매핑. 인원·금액은 본문에 있으면 공통 패턴',
  },
  {
    key: 'tripcom',
    label: 'Trip.com',
    hasDedicatedParser: true,
    price: PRICE_AMOUNT,
    fieldCoverage: { product: 'strong', people: 'strong', date: 'partial', customer: 'partial', price: 'partial' },
    notes: 'Resource info 상품 매핑. 이메일·전화는 마스킹되어 저장하지 않음',
  },
  {
    key: 'nol',
    label: 'NOL (트리플)',
    hasDedicatedParser: true,
    price: PRICE_NONE,
    fieldCoverage: { product: 'partial', people: 'strong', date: 'strong', customer: 'partial', price: 'none' },
    notes: '도깨비 일출 상품명 매핑. 금액 필드 없음',
  },
  {
    key: 'zoomzoom',
    label: '줌줌투어',
    hasDedicatedParser: true,
    price: PRICE_AMOUNT,
    fieldCoverage: { product: 'partial', people: 'strong', date: 'strong', customer: 'partial', price: 'partial' },
    notes: '웨스트림 상품명만 고정 매핑',
  },
  {
    key: 'tidesquare',
    label: '타이드스퀘어',
    hasDedicatedParser: true,
    price: PRICE_NONE,
    fieldCoverage: { product: 'none', people: 'none', date: 'none', customer: 'none', price: 'none' },
    notes: '제목에서 예약번호만 추출. 상품·가격 규칙 없음',
  },
  {
    key: 'tripadvisor',
    label: 'Tripadvisor',
    hasDedicatedParser: false,
    price: PRICE_NONE,
    fieldCoverage: { product: 'none', people: 'none', date: 'none', customer: 'none', price: 'none' },
    notes: '전용 파서 없음 (공통 패턴만)',
  },
  {
    key: 'booking',
    label: 'Booking',
    hasDedicatedParser: false,
    price: PRICE_NONE,
    fieldCoverage: { product: 'none', people: 'none', date: 'none', customer: 'none', price: 'none' },
    notes: '전용 파서 없음',
  },
  {
    key: 'expedia',
    label: 'Expedia',
    hasDedicatedParser: false,
    price: PRICE_NONE,
    fieldCoverage: { product: 'none', people: 'none', date: 'none', customer: 'none', price: 'none' },
    notes: '전용 파서 없음',
  },
  {
    key: 'airbnb',
    label: 'Airbnb',
    hasDedicatedParser: false,
    price: PRICE_NONE,
    fieldCoverage: { product: 'none', people: 'none', date: 'none', customer: 'none', price: 'none' },
    notes: '전용 파서 없음',
  },
]

function gygRules(): OtaParseProductRule[] {
  return (Object.keys(GYG_PRODUCT_ID_TO_NAME) as Array<keyof typeof GYG_PRODUCT_ID_TO_NAME>).map((productId) => ({
    id: `getyourguide:${productId}`,
    platform_key: 'getyourguide',
    matcher_type: 'title_pattern' as const,
    matcher_value: productId,
    matcher_label:
      productId === 'MNGC1N'
        ? 'Zion / Bryce / Grand Canyon 2-Day'
        : productId === 'MDGCSUNRISE'
          ? 'Grand Canyon Sunrise'
          : productId === 'MDGC1D'
            ? 'Grand Canyon + Antelope + Horseshoe + Lake Powell'
            : 'Night City Tour',
    product_id: productId,
    product_name: GYG_PRODUCT_ID_TO_NAME[productId],
    price: PRICE_AMOUNT,
  }))
}

function klookRules(): OtaParseProductRule[] {
  return Object.keys(KLOOK_ACTIVITY_ID_TO_PRODUCT_ID).map((activityId) => {
    const variant = KLOOK_ACTIVITY_ID_FORCE_VARIANT[activityId]
    return {
      id: `klook:${activityId}`,
      platform_key: 'klook',
      matcher_type: 'activity_id' as const,
      matcher_value: activityId,
      matcher_label: `activity/${activityId}`,
      product_id: KLOOK_ACTIVITY_ID_TO_PRODUCT_ID[activityId],
      product_name: KLOOK_ACTIVITY_ID_TO_TOUR_NAME[activityId] || KLOOK_ACTIVITY_ID_TO_PRODUCT_ID[activityId],
      variant_key: variant?.key,
      variant_label: variant?.label,
      price: PRICE_KLOOK,
    }
  })
}

function kkdayRules(): OtaParseProductRule[] {
  return Object.keys(KKDAY_PRODUCT_NO_TO_TOUR_NAME).map((no) => ({
    id: `kkday:${no}`,
    platform_key: 'kkday',
    matcher_type: 'product_no' as const,
    matcher_value: no,
    matcher_label: `상품번호 ${no}`,
    product_id: KKDAY_PRODUCT_NO_TO_PRODUCT_ID[no] ?? null,
    product_name: KKDAY_PRODUCT_NO_TO_TOUR_NAME[no],
    price: PRICE_AMOUNT,
  }))
}

const TITLE_PATTERN_RULES: OtaParseProductRule[] = [
  {
    id: 'viator:MDGCSUNRISE',
    platform_key: 'viator',
    matcher_type: 'title_pattern',
    matcher_value: 'Grand Canyon + Antelope + Horseshoe + Lower/X + 00:00',
    matcher_label: 'Grand Canyon Sunrise (Lower / Antelope X)',
    product_id: 'MDGCSUNRISE',
    product_name: '밤도깨비 그랜드캐년 일출 투어',
    price: PRICE_VIATOR,
    notes: 'Net Rate 정산 연결',
  },
  {
    id: 'viator:MNGC1N',
    platform_key: 'viator',
    matcher_type: 'title_pattern',
    matcher_value: 'Grand Circle overnight / Zion Bryce',
    matcher_label: '그랜드서클 1박 2일',
    product_id: 'MNGC1N',
    product_name: '그랜드서클 1박 2일 투어',
    price: PRICE_VIATOR,
  },
  {
    id: 'viator:MDGC1D',
    platform_key: 'viator',
    matcher_type: 'title_pattern',
    matcher_value: 'Grand Canyon Antelope Horseshoe (day)',
    matcher_label: '그랜드서클 당일',
    product_id: 'MDGC1D',
    product_name: '그랜드서클 당일 투어',
    price: PRICE_VIATOR,
  },
  {
    id: 'viator:MDLVN',
    platform_key: 'viator',
    matcher_type: 'title_pattern',
    matcher_value: 'URGENT Booking Request (야경, 그랜드서클 제외)',
    matcher_label: '라스베가스 야경투어',
    product_id: 'MDLVN',
    product_name: '라스베가스 야경투어',
    price: PRICE_VIATOR,
  },
  {
    id: 'maniatour:MDGCSUNRISE',
    platform_key: 'maniatour',
    matcher_type: 'title_pattern',
    matcher_value: '그랜드캐년 일출 & 앤텔로프 & 홀슈',
    matcher_label: 'Wix 일출 상품 제목',
    product_id: 'MDGCSUNRISE',
    product_name: '밤도깨비 그랜드캐년 일출 투어',
    price: PRICE_AMOUNT,
  },
  {
    id: 'myrealtrip:MDGCSUNRISE',
    platform_key: 'myrealtrip',
    matcher_type: 'title_pattern',
    matcher_value: '그랜드캐년 일출+앤텔롭+홀슈',
    matcher_label: '마이리얼트립 일출 상품명',
    product_id: 'MDGCSUNRISE',
    product_name: '밤도깨비 그랜드캐년 일출 투어',
    price: PRICE_AMOUNT,
  },
  {
    id: 'tripcom:MDGCSUNRISE',
    platform_key: 'tripcom',
    matcher_type: 'title_pattern',
    matcher_value: 'Grand Canyon Sunrise + Lower Antelope',
    matcher_label: 'Trip.com Resource info 일출+로어',
    product_id: 'MDGCSUNRISE',
    product_name: '밤도깨비 그랜드캐년 일출 투어',
    price: PRICE_AMOUNT,
  },
  {
    id: 'nol:MDGCSUNRISE',
    platform_key: 'nol',
    matcher_type: 'title_pattern',
    matcher_value: '도깨비 + 앤텔롭 / 그랜드캐년 일출',
    matcher_label: 'NOL 도깨비 일출',
    product_id: 'MDGCSUNRISE',
    product_name: '밤도깨비 그랜드캐년 일출 투어',
    price: PRICE_NONE,
    notes: '금액 파싱 없음 → 자동 추가 불가',
  },
  {
    id: 'zoomzoom:west-rim',
    platform_key: 'zoomzoom',
    matcher_type: 'title_pattern',
    matcher_value: '그랜드캐년 웨스트림',
    matcher_label: '줌줌투어 웨스트림',
    product_id: null,
    product_name: '그랜드캐년 웨스트림 투어',
    price: PRICE_AMOUNT,
  },
]

export function getOtaParseProductRules(): OtaParseProductRule[] {
  return [...klookRules(), ...gygRules(), ...kkdayRules(), ...TITLE_PATTERN_RULES]
}

export function getPlatformCatalogMeta(platformKey: string | null | undefined): OtaPlatformCatalogMeta | null {
  if (!platformKey) return null
  return OTA_PLATFORM_CATALOG.find((p) => p.key === platformKey.toLowerCase()) ?? null
}

export function defaultChannelIdForPlatform(platformKey: string | null | undefined): string | null {
  if (!platformKey) return null
  return PLATFORM_CHANNEL_MAP[platformKey.toLowerCase()] ?? null
}

export const EMAIL_PARSER_PLATFORM_KEYS = SUPPORTED_EMAIL_CHANNELS

export type ImportAutoConfirmGap =
  | 'not_booking'
  | 'cancellation'
  | 'missing_product'
  | 'missing_date'
  | 'missing_people'
  | 'missing_customer'
  | 'missing_price'
  | 'price_rule_unmapped'

export type ImportAutoConfirmReadiness = {
  ready: boolean
  missing: ImportAutoConfirmGap[]
  productId: string | null
  amount: number | null
  netRate: number | null
  priceConnected: boolean
}

export function evaluateImportAutoConfirmReadiness(args: {
  platformKey: string | null | undefined
  subject?: string | null
  extracted: ExtractedReservationData | null | undefined
}): ImportAutoConfirmReadiness {
  const ext = args.extracted || {}
  const missing: ImportAutoConfirmGap[] = []
  const meta = getPlatformCatalogMeta(args.platformKey)
  const productId = String(ext.product_id || '').trim() || null
  const productName = String(ext.product_name || '').trim()
  const amount = parseImportMoneyString(ext.amount)
  const netRate = parseImportMoneyString(ext.viator_net_rate_usd)
  const hasPrice = amount != null || netRate != null
  const priceRuleOk = Boolean(meta?.price.amount || meta?.price.viator_net_rate || meta?.price.amount_excluded)
  const priceConnected = Boolean(hasPrice && priceRuleOk && (productId || productName))

  if (isCancellationRequestEmailSubject(args.subject)) missing.push('cancellation')
  if (ext.is_booking_confirmed !== true) missing.push('not_booking')
  if (!productId && !productName) missing.push('missing_product')
  if (!String(ext.tour_date || '').trim()) missing.push('missing_date')
  const adults = Number(ext.adults)
  const total = Number(ext.total_people)
  if (!(adults > 0) && !(total > 0)) missing.push('missing_people')
  if (!String(ext.customer_name || '').trim()) missing.push('missing_customer')
  if (!priceRuleOk) missing.push('price_rule_unmapped')
  if (!hasPrice) missing.push('missing_price')

  return {
    ready: missing.length === 0,
    missing,
    productId,
    amount,
    netRate,
    priceConnected,
  }
}

export const AUTO_CONFIRM_ADDED_BY = 'system:email-auto-import'
