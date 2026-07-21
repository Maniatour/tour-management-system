/** 상품 편집 내용이 포함되는 고객 이메일·알림 유형 */

export type ProductEmailDestinationKey =
  | 'reservation_confirmation'
  | 'tour_departure_confirmed'
  | 'payment_receipt'
  | 'pickup_notification'
  | 'customer_reservation_detail'
  | 'tour_chat'

export type ProductEmailDestination = {
  key: ProductEmailDestinationKey
  /** 짧은 라벨 (힌트 배지용) */
  label: string
  /** 설명 (툴팁·보조 문구) */
  description: string
}

export const PRODUCT_EMAIL_DESTINATIONS: Record<
  ProductEmailDestinationKey,
  ProductEmailDestination
> = {
  reservation_confirmation: {
    key: 'reservation_confirmation',
    label: '예약 접수 이메일',
    description: '예약 접수 시 발송. 상품명·상세 정보·일정 등 포함. 투어 확정·픽업 안내는 별도 발송',
  },
  tour_departure_confirmed: {
    key: 'tour_departure_confirmed',
    label: '투어 확정 이메일',
    description: '투어 출발 확정(voucher) 시 발송. 예약 접수 이메일과 동일 본문 + 출발 확정 안내',
  },
  payment_receipt: {
    key: 'payment_receipt',
    label: '결제 영수증 이메일',
    description: '결제 영수증 발송 시. 예약 정보·가격·상품 상세 정보·일정 포함',
  },
  pickup_notification: {
    key: 'pickup_notification',
    label: '픽업 스케줄 알림',
    description: '픽업 시간 확정 후 발송. 상품명·픽업 정보·준비물·가이드/차량 정보 포함',
  },
  customer_reservation_detail: {
    key: 'customer_reservation_detail',
    label: '고객 예약 상세',
    description: '고객 대시보드 예약 상세 화면',
  },
  tour_chat: {
    key: 'tour_chat',
    label: '투어 채팅방',
    description: '투어 당일 고객 채팅방 공지',
  },
}

/** 세부정보 필드 — 예약·출발확정·영수증 이메일 「상품 상세 정보」 공통 */
export const DETAIL_FIELD_CONFIRMATION_EMAILS: ProductEmailDestinationKey[] = [
  'reservation_confirmation',
  'tour_departure_confirmed',
  'payment_receipt',
]

export const DETAIL_FIELD_EMAIL_NOTE =
  '내용이 있으면 이메일 「상품 상세 정보」 섹션에 표시됩니다.'

/** products.customer_name — 모든 예약 관련 이메일 헤더 */
export const PRODUCT_NAME_EMAILS: ProductEmailDestinationKey[] = [
  'reservation_confirmation',
  'tour_departure_confirmed',
  'payment_receipt',
  'pickup_notification',
]

export const PRODUCT_NAME_EMAIL_NOTE = '이메일 상단 「투어/상품명」에 표시됩니다.'

/** base_price — 가격 섹션 */
export const PRODUCT_PRICE_EMAILS: ProductEmailDestinationKey[] = [
  'reservation_confirmation',
  'tour_departure_confirmed',
  'payment_receipt',
]

export const PRODUCT_PRICE_EMAIL_NOTE =
  '예약 확인·영수증 이메일 「가격 정보」 섹션의 기준가에 반영됩니다.'

/** product_schedules — 투어 일정 섹션 */
export const PRODUCT_SCHEDULE_EMAILS: ProductEmailDestinationKey[] = [
  ...DETAIL_FIELD_CONFIRMATION_EMAILS,
]

export const PRODUCT_SCHEDULE_EMAIL_NOTE =
  '「고객 노출」 일정이 예약·영수증 이메일 「투어 스케줄」 섹션에 포함됩니다.'

/** 동적 가격 included/not_included — product_details와 동일 */
export const INCLUDED_IN_EMAILS = DETAIL_FIELD_CONFIRMATION_EMAILS

export function getEmailDestinationLabel(key: ProductEmailDestinationKey): string {
  return PRODUCT_EMAIL_DESTINATIONS[key]?.label ?? key
}

export function resolveEmailDestinations(
  keys: ProductEmailDestinationKey[] | undefined
): ProductEmailDestination[] {
  if (!keys?.length) return []
  return keys.map((k) => PRODUCT_EMAIL_DESTINATIONS[k]).filter(Boolean)
}

/** 상품 편집 모달에서 HTML 미리보기 가능한 이메일 */
export const PREVIEWABLE_PRODUCT_EMAILS: ProductEmailDestinationKey[] = [
  'reservation_confirmation',
  'tour_departure_confirmed',
  'payment_receipt',
  'pickup_notification',
]

export function isPreviewableProductEmail(
  key: ProductEmailDestinationKey
): boolean {
  return PREVIEWABLE_PRODUCT_EMAILS.includes(key)
}

export function filterPreviewableEmails(
  keys: ProductEmailDestinationKey[]
): ProductEmailDestinationKey[] {
  return keys.filter(isPreviewableProductEmail)
}

/** API preview-product-email / generateEmailContent type 매핑 */
export function mapEmailKeyToPreviewType(
  key: ProductEmailDestinationKey
): 'both' | 'voucher' | 'receipt' | null {
  switch (key) {
    case 'reservation_confirmation':
      return 'both'
    case 'tour_departure_confirmed':
      return 'voucher'
    case 'payment_receipt':
      return 'receipt'
    default:
      return null
  }
}
