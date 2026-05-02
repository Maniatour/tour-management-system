import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'

/** 이메일 로그에서 성공으로 간주되는 상태 */
export function emailLogStatusSuccess(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  if (!s || s === 'failed') return false
  if (s === 'bounced') return false
  return true
}

export type ReservationFollowUpPipelineSnapshot = {
  confirmationSent: boolean
  residentInquirySent: boolean
  guestResidentFlowCompleted: boolean
  departureSent: boolean
  pickupSent: boolean
  needsResidentFlow: boolean
}

export function reservationExcludedFromFollowUpPipeline(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return s === 'cancelled' || s === 'canceled' || s === 'deleted'
}

export function computeNeedsResidentFlow(productCode: string | null | undefined): boolean {
  return productShowsResidentStatusSectionByCode(productCode)
}

/** 단계별 선행 조건 충족 후 출발 확정 메일이 필요한지 */
export function prerequisitesMetForDeparture(s: ReservationFollowUpPipelineSnapshot): boolean {
  if (!s.confirmationSent) return false
  if (s.needsResidentFlow) {
    return s.residentInquirySent && s.guestResidentFlowCompleted
  }
  return true
}

export function prerequisitesMetForPickup(s: ReservationFollowUpPipelineSnapshot): boolean {
  return prerequisitesMetForDeparture(s) && s.departureSent
}

/** 탭 1: 예약 확인(컨펌) 메일 미발송 */
export function reservationNeedsConfirmationMail(
  status: string | null | undefined,
  s: ReservationFollowUpPipelineSnapshot
): boolean {
  if (reservationExcludedFromFollowUpPipeline(status)) return false
  return !s.confirmationSent
}

/** 탭 2: 거주·패스·결제 안내 — 해당 상품만, 안내 미발송 또는 고객 미완료 */
export function reservationNeedsResidentPipelineAttention(
  status: string | null | undefined,
  s: ReservationFollowUpPipelineSnapshot
): boolean {
  if (reservationExcludedFromFollowUpPipeline(status)) return false
  if (!s.needsResidentFlow) return false
  return !s.residentInquirySent || !s.guestResidentFlowCompleted
}

/** 탭 3: 투어 출발 확정 메일 */
export function reservationNeedsDepartureMail(
  status: string | null | undefined,
  s: ReservationFollowUpPipelineSnapshot
): boolean {
  if (reservationExcludedFromFollowUpPipeline(status)) return false
  if (!prerequisitesMetForDeparture(s)) return false
  return !s.departureSent
}

/** 탭 4: 픽업 노티피케이션 */
export function reservationNeedsPickupNotification(
  status: string | null | undefined,
  s: ReservationFollowUpPipelineSnapshot
): boolean {
  if (reservationExcludedFromFollowUpPipeline(status)) return false
  if (!prerequisitesMetForPickup(s)) return false
  return !s.pickupSent
}

/** 네 단계 중 하나라도 처리가 필요하면 true */
export function reservationNeedsAnyFollowUpAttention(
  status: string | null | undefined,
  s: ReservationFollowUpPipelineSnapshot | null | undefined
): boolean {
  if (!s || reservationExcludedFromFollowUpPipeline(status)) return false
  return (
    reservationNeedsConfirmationMail(status, s) ||
    reservationNeedsResidentPipelineAttention(status, s) ||
    reservationNeedsDepartureMail(status, s) ||
    reservationNeedsPickupNotification(status, s)
  )
}
