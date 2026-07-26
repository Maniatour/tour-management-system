export type FollowUpPipelineEmailType =
  | 'confirmation'
  | 'resident_inquiry'
  | 'departure'
  | 'pickup'

export type EmailLogDeliveryState =
  | 'none'
  | 'pending'
  | 'delivered'
  | 'opened'
  | 'bounced'
  | 'failed'

export type FollowUpEmailDeliveryByType = Partial<
  Record<FollowUpPipelineEmailType, EmailLogDeliveryState>
>

export type EmailDeliveryVisualTone = 'danger' | 'warning' | 'success'

export function normalizeEmailLogTypeForPipeline(
  emailType: string | null | undefined
): FollowUpPipelineEmailType | null {
  const s = String(emailType ?? '').toLowerCase()
  if (s === 'confirmation' || s === 'receipt' || s === 'both') return 'confirmation'
  if (s === 'departure' || s === 'voucher') return 'departure'
  if (s === 'pickup') return 'pickup'
  if (s === 'resident_inquiry') return 'resident_inquiry'
  return null
}

export function resolveEmailLogDeliveryState(log: {
  status?: string | null
  delivered_at?: string | null
  bounced_at?: string | null
  opened_at?: string | null
} | null | undefined): EmailLogDeliveryState {
  if (!log) return 'none'
  const status = String(log.status ?? '').toLowerCase()
  if (log.bounced_at || status === 'bounced') return 'bounced'
  if (status === 'failed') return 'failed'
  if (log.opened_at) return 'opened'
  if (log.delivered_at || status === 'delivered') return 'delivered'
  if (status === 'sent') return 'pending'
  return 'none'
}

/** 빨강(반송) · 노랑(발송전·확인중) · 녹색(발송 완료) */
export function emailDeliveryStateTone(
  state: EmailLogDeliveryState
): EmailDeliveryVisualTone | null {
  switch (state) {
    case 'bounced':
    case 'failed':
      return 'danger'
    case 'none':
    case 'pending':
      return 'warning'
    case 'delivered':
    case 'opened':
      return 'success'
    default:
      return null
  }
}

/** Follow-up 파이프라인 아이콘용 Tailwind 클래스 */
export function emailDeliveryStateIconClasses(state: EmailLogDeliveryState): string | null {
  switch (emailDeliveryStateTone(state)) {
    case 'danger':
      return 'text-red-800 bg-red-50 border-red-300 ring-1 ring-red-200'
    case 'warning':
      return 'text-amber-800 bg-amber-50 border-amber-300 ring-1 ring-amber-200'
    case 'success':
      return 'text-green-800 bg-green-50 border-green-300 ring-1 ring-green-200'
    default:
      return null
  }
}

/** 예약 카드 메일 버튼용 — 여러 유형 중 가장 주의가 필요한 상태를 선택 */
export function aggregateEmailDeliveryState(
  delivery: FollowUpEmailDeliveryByType | null | undefined
): EmailLogDeliveryState {
  const states = Object.values(delivery ?? {})
  if (states.includes('bounced')) return 'bounced'
  if (states.includes('failed')) return 'failed'
  if (states.includes('pending')) return 'pending'
  if (states.includes('opened')) return 'opened'
  if (states.includes('delivered')) return 'delivered'
  return 'none'
}

/** 예약 카드 메일 드롭다운 버튼용 Tailwind 클래스 */
export function emailDeliveryStateMailButtonClasses(state: EmailLogDeliveryState): string {
  switch (emailDeliveryStateTone(state)) {
    case 'danger':
      return 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
    case 'warning':
      return 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
    case 'success':
      return 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
    default:
      return 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
  }
}

/** 이메일 발송 내역 카드 배경 */
export function emailDeliveryStateCardClasses(state: EmailLogDeliveryState): string {
  switch (emailDeliveryStateTone(state)) {
    case 'danger':
      return 'bg-red-50 border-red-200'
    case 'warning':
      return 'bg-amber-50 border-amber-200'
    case 'success':
      return 'bg-green-50 border-green-200'
    default:
      return 'bg-gray-50 border-gray-200'
  }
}

/** 이메일 발송 내역 상태 뱃지 */
export function emailDeliveryStateBadgeClasses(state: EmailLogDeliveryState): string {
  switch (emailDeliveryStateTone(state)) {
    case 'danger':
      return 'bg-red-100 text-red-800'
    case 'warning':
      return 'bg-amber-100 text-amber-900'
    case 'success':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
