import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'
import {
  isReservationStatusConfirmed,
  isReservationTourDatePastLocal,
  isWithin48HoursBeforeTourStartLocal,
} from '@/utils/reservationUtils'

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
  /** 이메일/거주 양식 없이 직원이 수동으로 완료로 표시한 단계 */
  manualConfirmation: boolean
  manualResident: boolean
  manualDeparture: boolean
  manualPickup: boolean
  /** 취소 후 고객 안내(Follow-up) 처리 완료 — 수동 */
  cancelFollowUpManual: boolean
  /** 홈페이지 재예약 권유 별도 연락 완료 — 수동 */
  cancelRebookingOutreachManual: boolean
}

export type FollowUpPipelineStepKey = 'confirmation' | 'resident' | 'departure' | 'pickup'

export function reservationExcludedFromFollowUpPipeline(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return s === 'cancelled' || s === 'canceled' || s === 'deleted'
}

export function isReservationCancelledOnly(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return s === 'cancelled' || s === 'canceled'
}

/**
 * Follow-up 모달「취소」탭 대상: 취소됐고 투어일이 아직 지나지 않음(오늘 포함 이후).
 * 예약 처리 필요 모달의 옛 Follow up (Cancel) 탭과 동일 조건.
 */
export function reservationEligibleForCancelFollowUpQueue(
  status: string | null | undefined,
  tourDate: string | null | undefined
): boolean {
  if (!isReservationCancelledOnly(status)) return false
  return !isReservationTourDatePastLocal(tourDate)
}

/** 배지·카운트: 취소 큐 중 아직 표시할 작업이 남은 경우 */
export function reservationNeedsCancelFollowUpQueueAttention(
  status: string | null | undefined,
  tourDate: string | null | undefined,
  s: ReservationFollowUpPipelineSnapshot | undefined
): boolean {
  if (!reservationEligibleForCancelFollowUpQueue(status, tourDate)) return false
  if (!s) return true
  return !s.cancelFollowUpManual || !s.cancelRebookingOutreachManual
}

/** 그룹 헤더용: 취소 처리 시점 근사(updated_at 우선, 없으면 addedTime)의 YYYY-MM-DD */
export function reservationCancellationGroupingDateKey(r: {
  updated_at?: string | null
  addedTime?: string
}): string {
  const raw = (r.updated_at && String(r.updated_at).trim()) || String(r.addedTime ?? '').trim()
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  if (raw.length >= 10) return raw.slice(0, 10)
  return 'unknown'
}

export function computeNeedsResidentFlow(productCode: string | null | undefined): boolean {
  return productShowsResidentStatusSectionByCode(productCode)
}

/**
 * 출발 확정 메일 단계는 컨펌·거주 완료와 무관하게 항상 처리 가능(바로 발송 허용).
 * 스냅샷의 confirmationSent는 출발 확정 로그가 있으면 true로 올라가므로, 여기서는 게이트 없음.
 */
export function prerequisitesMetForDeparture(_s: ReservationFollowUpPipelineSnapshot): boolean {
  return true
}

/** 픽업 노티는 출발 확정(로그·수동) 이후에만 의미 있음 */
export function prerequisitesMetForPickup(s: ReservationFollowUpPipelineSnapshot): boolean {
  return s.departureSent
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

/** Follow-up 모달「출발 확정」탭: 예약 확정 + 출발 확정 메일 미발송 */
export function followUpModalMatchesDepartureTab(
  status: string | null | undefined,
  s: ReservationFollowUpPipelineSnapshot
): boolean {
  if (reservationExcludedFromFollowUpPipeline(status)) return false
  if (!isReservationStatusConfirmed(status)) return false
  return !s.departureSent
}

/** Follow-up 모달「픽업」탭: 투어 시작 48시간 이내 + 픽업 노티 미발송 */
export function followUpModalMatchesPickupTab(
  tourDate: string | null | undefined,
  tourTime: string | null | undefined,
  status: string | null | undefined,
  s: ReservationFollowUpPipelineSnapshot
): boolean {
  if (reservationExcludedFromFollowUpPipeline(status)) return false
  if (!isWithin48HoursBeforeTourStartLocal({ tourDate, tourTime })) return false
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

/** 수동 완료 표시 가능: 해당 단계가 아직 시스템상 완료가 아니고, 선행 조건 충족 */
export function followUpPipelineStepCanMarkManual(
  s: ReservationFollowUpPipelineSnapshot,
  step: FollowUpPipelineStepKey
): boolean {
  if (step === 'confirmation') {
    return !s.confirmationSent
  }
  if (step === 'resident') {
    if (!s.needsResidentFlow) return false
    const done = s.residentInquirySent && s.guestResidentFlowCompleted
    return !done
  }
  if (step === 'departure') {
    return !s.departureSent
  }
  return prerequisitesMetForPickup(s) && !s.pickupSent
}

export function followUpPipelineStepCanClearManual(
  s: ReservationFollowUpPipelineSnapshot,
  step: FollowUpPipelineStepKey
): boolean {
  if (step === 'confirmation') return s.manualConfirmation
  if (step === 'resident') return s.manualResident
  if (step === 'departure') return s.manualDeparture
  return s.manualPickup
}
