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
  language?: string
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
  note?: string
  special_requests?: string
  /** 플랫폼 식별용 (채널 매핑에 사용) */
  platform_key?: string
  /** 예약 접수 이메일 여부 (GetYourGuide: "Booking -", Klook: "Klook Order Received -"로 제목 시작 시 목록 강조) */
  is_booking_confirmed?: boolean
  /** 이메일에서 파싱한 초이스 옵션명 (상품 초이스 매칭용, 예: "Lower Antelope Canyon") */
  import_choice_option_names?: string[]
  /** "미정"으로 저장할 초이스 그룹명 (예: "미국 거주자 구분", "기타 입장료") */
  import_choice_undecided_groups?: string[]
  [key: string]: unknown
}
