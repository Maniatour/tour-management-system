import type {
  EmailDeliveryOutcome,
  EmailSendChannel,
  PipelineStepPresentation,
} from '@/lib/pipelineStepPresentation'

type FollowUpPipelineTranslator = {
  (key: string): string
  has?: (key: string) => boolean
}

function tSafe(t: FollowUpPipelineTranslator, key: string, fallback: string): string {
  try {
    if (typeof t.has === 'function' && !t.has(key)) return fallback
    return t(key)
  } catch {
    return fallback
  }
}

function sendChannelLabel(
  channel: EmailSendChannel,
  t: FollowUpPipelineTranslator,
  locale: string
): string | null {
  const ko = locale.startsWith('ko')
  switch (channel) {
    case 'system':
      return tSafe(t, 'sendChannelSystem', ko ? '시스템 발송' : 'System send')
    case 'manual':
      return tSafe(t, 'sendChannelManual', ko ? '수동 발송' : 'Manual send')
    case 'both':
      return tSafe(t, 'sendChannelBoth', ko ? '시스템+수동 발송' : 'System + manual')
    default:
      return null
  }
}

function deliveryOutcomeLabel(
  outcome: EmailDeliveryOutcome,
  t: FollowUpPipelineTranslator,
  locale: string
): string | null {
  const ko = locale.startsWith('ko')
  switch (outcome) {
    case 'not_sent':
      return tSafe(t, 'deliveryNotSent', ko ? '발송 전' : 'Not sent yet')
    case 'pending':
      return tSafe(
        t,
        'deliveryPending',
        ko ? '전달 확인 중' : 'Awaiting delivery confirmation'
      )
    case 'delivered':
      return tSafe(t, 'deliveryDelivered', ko ? '전달 완료' : 'Delivered')
    case 'opened':
      return tSafe(t, 'deliveryOpened', ko ? '읽음' : 'Opened')
    case 'bounced':
      return tSafe(t, 'deliveryBounced', ko ? '반송됨' : 'Bounced')
    case 'failed':
      return tSafe(t, 'deliveryFailed', ko ? '발송 실패' : 'Send failed')
    default:
      return null
  }
}

/** 파이프라인 단계 아이콘 툴팁 본문 (단계 제목 뒤에 붙임) */
export function buildPipelineStepStatusSuffix(
  presentation: PipelineStepPresentation,
  t: FollowUpPipelineTranslator,
  locale: string
): string {
  const parts: string[] = []

  if (presentation.isInferred) {
    parts.push(
      tSafe(
        t,
        'confirmationInferredShort',
        locale.startsWith('ko')
          ? '투어 확정 메일로 완료'
          : 'Completed via tour departure email'
      )
    )
  }

  const channel = sendChannelLabel(presentation.sendChannel, t, locale)
  if (channel) parts.push(channel)

  const delivery = deliveryOutcomeLabel(presentation.deliveryOutcome, t, locale)
  if (delivery) {
    if (presentation.sendChannel === 'manual' && presentation.deliveryOutcome === 'delivered') {
      parts.push(
        tSafe(
          t,
          'manualSendNoTracking',
          locale.startsWith('ko')
            ? '수신 확인 불가'
            : 'Delivery not tracked'
        )
      )
    } else {
      parts.push(delivery)
    }
  }

  return parts.length > 0 ? ` — ${parts.join(' · ')}` : ''
}

export function buildMailButtonStatusSuffix(
  sendChannel: EmailSendChannel,
  deliveryOutcome: EmailDeliveryOutcome,
  t: FollowUpPipelineTranslator,
  locale: string
): string {
  const parts: string[] = []
  const channel = sendChannelLabel(sendChannel, t, locale)
  if (channel) parts.push(channel)
  const delivery = deliveryOutcomeLabel(deliveryOutcome, t, locale)
  if (delivery) parts.push(delivery)
  return parts.length > 0 ? ` — ${parts.join(' · ')}` : ''
}
