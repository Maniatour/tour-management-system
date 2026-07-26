import type { EmailLogDeliveryState, FollowUpPipelineEmailType } from '@/lib/emailLogDeliveryState'
import {
  prerequisitesMetForDeparture,
  prerequisitesMetForPickup,
  type ReservationFollowUpPipelineSnapshot,
} from '@/lib/reservationFollowUpPipeline'
import type { FollowUpPipelineStepKey } from '@/lib/reservationFollowUpPipeline'

export type PipelineStepVisual = 'done' | 'doneInferred' | 'action' | 'upcoming' | 'na'

export type PipelineStepPhase = 'loading' | 'inactive' | 'needs_action' | 'complete'

/** 시스템(Resend) / 수동(Gmail·HTML 복사 등) / 둘 다 */
export type EmailSendChannel = 'none' | 'system' | 'manual' | 'both'

export type EmailDeliveryOutcome =
  | 'not_sent'
  | 'pending'
  | 'delivered'
  | 'opened'
  | 'bounced'
  | 'failed'
  | 'na'

export type PipelineStepPresentation = {
  sendChannel: EmailSendChannel
  deliveryOutcome: EmailDeliveryOutcome
  /** 예약 접수가 투어 확정 메일로 간접 완료 */
  isInferred: boolean
  phase: PipelineStepPhase
  boxClassName: string
}

export type MailButtonPresentation = {
  sendChannel: EmailSendChannel
  deliveryOutcome: EmailDeliveryOutcome
  snapshotLoaded: boolean
  boxClassName: string
}

function stepManualFlag(
  snapshot: ReservationFollowUpPipelineSnapshot,
  step: FollowUpPipelineStepKey
): boolean {
  if (step === 'confirmation') return snapshot.manualConfirmation
  if (step === 'resident') return snapshot.manualResident
  if (step === 'departure') return snapshot.manualDeparture
  return snapshot.manualPickup
}

function hasSystemEmailLog(
  snapshot: ReservationFollowUpPipelineSnapshot,
  emailType: FollowUpPipelineEmailType | null
): boolean {
  if (!emailType) return false
  return (snapshot.emailDelivery ?? {})[emailType] != null
}

function loggedStateToOutcome(state: EmailLogDeliveryState): EmailDeliveryOutcome {
  if (state === 'bounced') return 'bounced'
  if (state === 'failed') return 'failed'
  if (state === 'pending') return 'pending'
  if (state === 'opened') return 'opened'
  if (state === 'delivered') return 'delivered'
  return 'not_sent'
}

function resolveSendChannel(hasSystem: boolean, hasManual: boolean): EmailSendChannel {
  if (hasSystem && hasManual) return 'both'
  if (hasSystem) return 'system'
  if (hasManual) return 'manual'
  return 'none'
}

/** 발송 경로 — 테두리 (파스텔 배경 위 진한 색) */
function sendChannelBorderClass(channel: EmailSendChannel, phase: PipelineStepPhase): string {
  if (phase === 'loading' || phase === 'inactive') {
    return 'border-2 border-gray-200'
  }
  switch (channel) {
    case 'system':
      return 'border-2 border-blue-800'
    case 'manual':
      return 'border-2 border-red-800'
    case 'both':
      return 'border-2 border-black'
    default:
      return 'border-2 border-amber-300'
  }
}

/** 전달·완료 상태 — 파스텔 배경 */
function deliveryFillClass(
  outcome: EmailDeliveryOutcome,
  phase: PipelineStepPhase,
  isInferred: boolean
): string {
  if (phase === 'loading') return 'bg-gray-50 text-gray-400'
  if (phase === 'inactive') {
    return 'bg-gray-50 text-gray-400'
  }
  if (isInferred) {
    return 'bg-sky-50 text-sky-800'
  }
  if (outcome === 'bounced' || outcome === 'failed') {
    return 'bg-red-50 text-red-800'
  }
  if (outcome === 'pending' || (phase === 'needs_action' && outcome === 'not_sent')) {
    return 'bg-amber-50 text-amber-800'
  }
  if (outcome === 'delivered' || outcome === 'opened') {
    return 'bg-green-50 text-green-800'
  }
  if (phase === 'complete') {
    return 'bg-green-50 text-green-800'
  }
  return 'bg-amber-50 text-amber-800'
}

function composeBoxClass(
  channel: EmailSendChannel,
  outcome: EmailDeliveryOutcome,
  phase: PipelineStepPhase,
  isInferred: boolean
): string {
  return `${deliveryFillClass(outcome, phase, isInferred)} ${sendChannelBorderClass(channel, phase)}`
}

export function resolvePipelineStepPhase(visual: PipelineStepVisual): PipelineStepPhase {
  if (visual === 'upcoming' || visual === 'na') return 'inactive'
  if (visual === 'action') return 'needs_action'
  return 'complete'
}

export function resolvePipelineStepPresentation(input: {
  snapshotLoaded: boolean
  visual: PipelineStepVisual
  snapshot: ReservationFollowUpPipelineSnapshot
  step: FollowUpPipelineStepKey
  emailType: FollowUpPipelineEmailType | null
}): PipelineStepPresentation {
  const { snapshotLoaded, visual, snapshot, step, emailType } = input

  if (!snapshotLoaded) {
    return {
      sendChannel: 'none',
      deliveryOutcome: 'not_sent',
      isInferred: false,
      phase: 'loading',
      boxClassName: composeBoxClass('none', 'not_sent', 'loading', false),
    }
  }

  const phase = resolvePipelineStepPhase(visual)
  const isInferred = step === 'confirmation' && snapshot.confirmationInferredFromDeparture
  const hasManual = stepManualFlag(snapshot, step)
  const hasSystem =
    hasSystemEmailLog(snapshot, emailType) ||
    (step === 'confirmation' && snapshot.confirmationInferredFromDeparture)

  const loggedState: EmailLogDeliveryState =
    emailType != null ? ((snapshot.emailDelivery ?? {})[emailType] ?? 'none') : 'none'

  let deliveryOutcome = loggedStateToOutcome(loggedState)

  if (isInferred) {
    const departureState = (snapshot.emailDelivery ?? {}).departure ?? 'none'
    deliveryOutcome = loggedStateToOutcome(departureState)
    if (deliveryOutcome === 'not_sent') {
      deliveryOutcome = 'delivered'
    }
  } else if (phase === 'inactive') {
    deliveryOutcome = 'na'
  } else if (deliveryOutcome === 'not_sent' && phase === 'complete') {
    deliveryOutcome = hasSystem ? 'pending' : 'delivered'
  } else if (deliveryOutcome === 'not_sent' && phase === 'needs_action') {
    deliveryOutcome = 'not_sent'
  }

  const sendChannel = resolveSendChannel(hasSystem, hasManual)

  return {
    sendChannel,
    deliveryOutcome,
    isInferred,
    phase,
    boxClassName: composeBoxClass(sendChannel, deliveryOutcome, phase, isInferred),
  }
}

function worstDeliveryOutcome(states: EmailDeliveryOutcome[]): EmailDeliveryOutcome {
  if (states.includes('bounced') || states.includes('failed')) return 'bounced'
  if (states.includes('pending')) return 'pending'
  if (states.includes('opened')) return 'opened'
  if (states.includes('delivered')) return 'delivered'
  return 'not_sent'
}

export function resolveMailButtonPresentation(
  snapshot: ReservationFollowUpPipelineSnapshot | undefined,
  snapshotLoaded: boolean
): MailButtonPresentation {
  if (!snapshotLoaded || !snapshot) {
    return {
      sendChannel: 'none',
      deliveryOutcome: 'not_sent',
      snapshotLoaded: false,
      boxClassName: 'border-2 border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100',
    }
  }

  const emailDelivery = snapshot.emailDelivery ?? {}
  const loggedOutcomes = Object.values(emailDelivery).map(loggedStateToOutcome)
  let deliveryOutcome = worstDeliveryOutcome(loggedOutcomes)

  const hasManual =
    snapshot.manualConfirmation ||
    snapshot.manualResident ||
    snapshot.manualDeparture ||
    snapshot.manualPickup

  const hasSystem =
    loggedOutcomes.length > 0 || snapshot.confirmationInferredFromDeparture === true

  const sendChannel = resolveSendChannel(hasSystem, hasManual)

  if (deliveryOutcome === 'not_sent') {
    if (
      snapshot.confirmationSent ||
      snapshot.departureSent ||
      snapshot.pickupSent ||
      snapshot.residentInquirySent ||
      hasManual
    ) {
      deliveryOutcome = hasSystem ? 'pending' : 'delivered'
    } else if (snapshotNeedsAnyAction(snapshot)) {
      deliveryOutcome = 'not_sent'
    }
  }

  const fill =
    deliveryOutcome === 'bounced' || deliveryOutcome === 'failed'
      ? 'bg-red-50 text-red-700 hover:bg-red-100'
      : deliveryOutcome === 'pending' || deliveryOutcome === 'not_sent'
        ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
        : 'bg-green-50 text-green-700 hover:bg-green-100'

  const border =
    sendChannel === 'system'
      ? 'border-2 border-blue-800'
      : sendChannel === 'manual'
        ? 'border-2 border-red-800'
        : sendChannel === 'both'
          ? 'border-2 border-black'
          : 'border-2 border-gray-300'

  return {
    sendChannel,
    deliveryOutcome,
    snapshotLoaded: true,
    boxClassName: `${fill} ${border}`,
  }
}

function snapshotNeedsAnyAction(snapshot: ReservationFollowUpPipelineSnapshot): boolean {
  if (!snapshot.confirmationSent) return true
  if (
    snapshot.needsResidentFlow &&
    !(snapshot.residentInquirySent && snapshot.guestResidentFlowCompleted) &&
    !snapshot.manualResident
  ) {
    return true
  }
  if (prerequisitesMetForDeparture(snapshot) && !snapshot.departureSent && !snapshot.manualDeparture) {
    return true
  }
  if (prerequisitesMetForPickup(snapshot) && !snapshot.pickupSent && !snapshot.manualPickup) {
    return true
  }
  return false
}

export function resolvePipelineSteps(
  snapshot: ReservationFollowUpPipelineSnapshot
): {
  confirm: PipelineStepVisual
  resident: PipelineStepVisual
  departure: PipelineStepVisual
  pickup: PipelineStepVisual
  showResidentStep: boolean
} {
  const confirm: PipelineStepVisual = snapshot.confirmationSentDirect
    ? 'done'
    : snapshot.confirmationInferredFromDeparture
      ? 'doneInferred'
      : snapshot.confirmationSent
        ? 'done'
        : 'action'

  const showResidentStep = snapshot.needsResidentFlow

  let resident: PipelineStepVisual = 'na'
  if (showResidentStep) {
    if (snapshot.guestResidentFlowCompleted && snapshot.residentInquirySent) resident = 'done'
    else if (!snapshot.residentInquirySent || !snapshot.guestResidentFlowCompleted) resident = 'action'
  }

  let departure: PipelineStepVisual = 'upcoming'
  if (!prerequisitesMetForDeparture(snapshot)) departure = 'upcoming'
  else if (snapshot.departureSent) departure = 'done'
  else departure = 'action'

  let pickup: PipelineStepVisual = 'upcoming'
  if (!prerequisitesMetForPickup(snapshot)) pickup = 'upcoming'
  else if (snapshot.pickupSent) pickup = 'done'
  else pickup = 'action'

  return { confirm, resident, departure, pickup, showResidentStep }
}
