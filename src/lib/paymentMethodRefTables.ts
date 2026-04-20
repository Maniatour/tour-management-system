/** payment_method 문자열로 참조하는 테이블 (FK 아님) — merge·참조 조회와 동일 목록 */
export const PAYMENT_METHOD_REF_TABLES = [
  'payment_records',
  'company_expenses',
  'reservation_expenses',
  'tour_expenses',
  'ticket_bookings',
  'tour_hotel_bookings',
] as const

export type PaymentMethodRefTable = (typeof PAYMENT_METHOD_REF_TABLES)[number]
