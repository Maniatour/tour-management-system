import type { Database } from '@/lib/database.types'

export type ReservationImportRow = Database['public']['Tables']['reservation_imports']['Row']
export type ReservationImportInsert = Database['public']['Tables']['reservation_imports']['Insert']
export type ReservationImportUpdate = Database['public']['Tables']['reservation_imports']['Update']

export type ReservationImportStatus = 'pending' | 'confirmed' | 'rejected' | 'duplicate'

/** 이메일 파서/AI가 채우는 추출 결과 (extracted_data JSON) */
export interface ExtractedReservationData {
  /** 고객 */
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  /** 비상연락처 (Klook WhatsApp 등) */
  emergency_contact?: string
  language?: string
  /** OTA 투어 신청 언어 (GyG Tour language 등). 고객 언어와 별개 */
  tour_language?: string
  /** 예약 */
  product_name?: string
  product_choices?: string
  product_id?: string
  tour_date?: string
  tour_time?: string
  adults?: number
  children?: number
  infants?: number
  total_people?: number
  channel_rn?: string
  pickup_hotel?: string
  amount?: string
  /** Viator: Net Rate (USD) 문자열. 채널 정산 금액과 비교해 불일치 시 쿠폰 자동 선택에 사용 */
  viator_net_rate_usd?: string
  /** Klook 등: 불포함 금액 (Not included / Amount not included). 예약 폼의 인원당 불포함 가격 매칭용 */
  amount_excluded?: string
  note?: string
  special_requests?: string
  /** 플랫폼 식별용 (채널 매핑에 사용) */
  platform_key?: string
  /** Klook: channel_products.variant_key에 대응 (불포함 금액 유무 등으로 추정) */
  channel_variant_key?: string
  /** Klook: 목록·상세 표시 (예: All Inclusive, With Exclusions) */
  channel_variant_label?: string
  /** 예약 접수 이메일 여부 (GetYourGuide: "Booking -", Klook: Order Received / Order Confirmed|Confimed — 파서 참고) */
  is_booking_confirmed?: boolean
  /** OTA 예약 변경 알림 (GetYourGuide: booking has changed, Viator: Amendment Request) — 신규 예약 생성 대상 아님 */
  is_booking_change?: boolean
  /** 변경 메일에서 New 뱃지가 붙은 필드 (tour_date, pickup_hotel 등) */
  booking_change_fields?: string[]
  /** Viator Amendment Request 등: 요청된 투어일 (YYYY-MM-DD). 확정이 아니므로 자동 반영하지 않음 */
  requested_tour_date?: string
  /** 변경 요청 메일의 기존(현재) 투어일 */
  original_tour_date?: string
  /** true면 공급사 수락 전 변경 요청. 픽업·날짜 자동 반영하지 않음 */
  is_booking_change_request?: boolean
  /** 픽업 호텔을 기존 예약에 반영했는지 */
  pickup_change_applied?: boolean
  pickup_change_applied_at?: string
  pickup_change_applied_hotel_id?: string
  /** 이메일에서 파싱한 초이스 옵션명 (상품 초이스 매칭용, 예: "Lower Antelope Canyon") */
  import_choice_option_names?: string[]
  /** "미정"으로 저장할 초이스 그룹명 (예: "미국 거주자 구분", "기타 입장료") */
  import_choice_undecided_groups?: string[]
  [key: string]: unknown
}
