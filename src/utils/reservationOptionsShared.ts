/**
 * 예약 옵션 타입·가격 집계 유틸 — API 라우트·sync 등 서버 코드에서도 사용 가능 (React 훅 없음).
 */

export interface ReservationOption {
  id: string
  reservation_id: string
  option_id: string
  option_name?: string
  ea: number
  price: number
  total_price: number
  status: 'active' | 'cancelled' | 'refunded' | null
  note?: string
  created_at: string
  updated_at: string
}

export interface CreateReservationOptionData {
  option_id: string
  ea?: number
  price?: number
  total_price?: number
  status?: 'active' | 'cancelled' | 'refunded'
  note?: string
}

export interface UpdateReservationOptionData extends CreateReservationOptionData {
  id: string
}

/** product_options.id 등 UUID 컬럼 조회용 — option_id가 옵션명·코드 문자열인 경우 제외 */
export function isOptionIdUuidLike(id: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id ?? '').trim())
}

/**
 * 예약 옵션 금액 합계(가격 계산·잔액 표시 등)에 포함할 행인지.
 * 취소·환불 행은 제외 — `aggregateReservationOptionSumsByReservationId` 와 동일 규칙.
 */
export function reservationOptionCountsTowardPricingTotal(
  status: ReservationOption['status']
): boolean {
  const s = String(status || 'active').toLowerCase()
  return s !== 'cancelled' && s !== 'refunded'
}

/** 취소·환불 처리된 예약 옵션 줄의 total_price 합 (가격 계산 ④ 환불 입력 합산 표시용) */
export function sumReservationOptionCancelledRefundTotals(
  options: Array<{ status?: string | null; total_price?: number | null }>
): number {
  let sum = 0
  for (const option of options) {
    const s = String(option.status || 'active').toLowerCase()
    if (s === 'cancelled' || s === 'refunded') {
      sum += Number(option.total_price) || 0
    }
  }
  return Math.round(sum * 100) / 100
}
