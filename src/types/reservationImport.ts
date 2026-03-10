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
  [key: string]: unknown
}
