import { isRebookingCancellationReason } from '@/lib/reservationCancellationReason'
import {
  isReservationCancelledOnly,
  type ReservationFollowUpPipelineSnapshot,
} from '@/lib/reservationFollowUpPipeline'

export type CancelRebookingWorkflowStepId =
  | 'cancel_rebook_notice'
  | 'customer_response'
  | 'cancellation_reason'

export type CancelRebookingWorkflowStep = {
  id: CancelRebookingWorkflowStepId
  done: boolean
  current: boolean
}

export type CancelRebookingWorkflowState = {
  cancelFollowUpManual: boolean
  hasCustomerResponse: boolean
  hasCancellationReason: boolean
  cancelRebookingOutreachManual: boolean
}

export function buildCancelRebookingWorkflowState(input: {
  snapshot?: ReservationFollowUpPipelineSnapshot | null | undefined
  cancellationReason?: string | null | undefined
  hasCustomerResponse?: boolean
}): CancelRebookingWorkflowState {
  return {
    cancelFollowUpManual: input.snapshot?.cancelFollowUpManual ?? false,
    hasCustomerResponse: input.hasCustomerResponse ?? false,
    hasCancellationReason: Boolean(String(input.cancellationReason ?? '').trim()),
    cancelRebookingOutreachManual: input.snapshot?.cancelRebookingOutreachManual ?? false,
  }
}

export function isCancelRebookNoticeComplete(state: CancelRebookingWorkflowState): boolean {
  return state.cancelFollowUpManual && state.cancelRebookingOutreachManual
}

export type CancelRebookingWorkflowBadge = {
  id: string
  label: string
  tone: 'needed' | 'done' | 'waiting'
}

export function buildCancelRebookingWorkflowBadges(
  state: CancelRebookingWorkflowState,
  locale: string
): CancelRebookingWorkflowBadge[] {
  const isKo = locale === 'ko'

  if (isCancelRebookingWorkflowComplete(state)) {
    return [
      {
        id: 'follow_up_complete',
        label: isKo ? '✅ 취소 및 follow up 완료' : '✅ Cancel follow-up complete',
        tone: 'done',
      },
    ]
  }

  if (!isCancelRebookNoticeComplete(state)) {
    return [
      {
        id: 'notice_needed',
        label: isKo ? '취소 및 재예약 권유 안내 필요' : 'Cancel & rebook outreach needed',
        tone: 'needed',
      },
    ]
  }

  return [
    {
      id: 'notice_done',
      label: isKo ? '✅ 취소 및 재예약 권유 안내 완료' : '✅ Cancel & rebook outreach done',
      tone: 'done',
    },
    {
      id: 'customer_waiting',
      label: isKo ? '고객 답변 대기중' : 'Awaiting customer reply',
      tone: 'waiting',
    },
  ]
}

export function buildCancelRebookingWorkflowSteps(
  state: CancelRebookingWorkflowState
): CancelRebookingWorkflowStep[] {
  const base = [
    { id: 'cancel_rebook_notice' as const, done: isCancelRebookNoticeComplete(state) },
    { id: 'customer_response' as const, done: state.hasCustomerResponse },
    { id: 'cancellation_reason' as const, done: state.hasCancellationReason },
  ]
  const firstIncomplete = base.findIndex((step) => !step.done)
  return base.map((step, index) => ({
    ...step,
    current: firstIncomplete === -1 ? false : index === firstIncomplete,
  }))
}

export function isCancelRebookingWorkflowComplete(state: CancelRebookingWorkflowState): boolean {
  return (
    isCancelRebookNoticeComplete(state) &&
    state.hasCustomerResponse &&
    state.hasCancellationReason
  )
}

export function isCancellationReasonRecordedOutOfOrder(state: CancelRebookingWorkflowState): boolean {
  return (
    state.hasCancellationReason &&
    (!isCancelRebookNoticeComplete(state) || !state.hasCustomerResponse)
  )
}

export function cancelRebookingOutOfOrderTooltip(locale: string): string {
  const isKo = locale === 'ko'
  return isKo
    ? '취소 사유가 먼저 기록되었습니다. 취소·재예약 권유 안내와 고객 답변을 확인한 뒤 사유를 수정하세요.'
    : 'Cancel reason was recorded early. Complete the cancel/rebook notice and capture the customer reply first.'
}

export function reservationNeedsCancelRebookingFollowUpAttention(input: {
  status: string | null | undefined
  cancellationReason?: string | null
  workflow: CancelRebookingWorkflowState
}): boolean {
  if (!isReservationCancelledOnly(input.status)) return false
  if (isRebookingCancellationReason(input.cancellationReason)) return false
  return !isCancelRebookingWorkflowComplete(input.workflow)
}

export function cancelRebookingWorkflowStepLabel(
  stepId: CancelRebookingWorkflowStepId,
  locale: string
): string {
  const isKo = locale === 'ko'
  switch (stepId) {
    case 'cancel_rebook_notice':
      return isKo ? '취소 및 재예약 권유 안내' : 'Cancel & rebook outreach notice'
    case 'customer_response':
      return isKo ? '고객 답변' : 'Customer reply'
    case 'cancellation_reason':
      return isKo ? '취소 사유' : 'Cancel reason'
    default:
      return stepId
  }
}
