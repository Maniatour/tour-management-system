export type SmsLogDeliveryState = 'none' | 'pending' | 'delivered' | 'failed'

export type SmsLogRowForDelivery = {
  status?: string | null
  delivered_at?: string | null
  failed_at?: string | null
  error_message?: string | null
}

export function resolveSmsLogDeliveryState(
  log: SmsLogRowForDelivery | null | undefined
): SmsLogDeliveryState {
  if (!log) return 'none'
  const status = String(log.status ?? '').toLowerCase()
  if (log.failed_at || status === 'failed' || status === 'undelivered') return 'failed'
  if (log.delivered_at || status === 'delivered') return 'delivered'
  if (status === 'sent' || status === 'sending' || status === 'queued') return 'pending'
  if (log.error_message) return 'failed'
  return 'none'
}

export function smsDeliveryStateLabel(
  state: SmsLogDeliveryState,
  locale: 'ko' | 'en' = 'ko'
): string {
  const labels: Record<SmsLogDeliveryState, { ko: string; en: string }> = {
    none: { ko: '알 수 없음', en: 'Unknown' },
    pending: { ko: '전달 확인 중', en: 'Delivery pending' },
    delivered: { ko: '전달됨', en: 'Delivered' },
    failed: { ko: '전달 실패', en: 'Failed' },
  }
  return labels[state][locale]
}

export function smsDeliveryStateBadgeClasses(state: SmsLogDeliveryState): string {
  switch (state) {
    case 'delivered':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    case 'pending':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export function smsDeliveryStateCardClasses(state: SmsLogDeliveryState): string {
  switch (state) {
    case 'delivered':
      return 'border-green-200 bg-green-50/40'
    case 'failed':
      return 'border-red-200 bg-red-50/40'
    case 'pending':
      return 'border-amber-200 bg-amber-50/30'
    default:
      return 'border-gray-200 bg-white'
  }
}

/** 예약 카드 SMS 버튼 테두리·배경 (최신 발송 상태) */
export function smsDeliveryStateIconBorderClasses(state: SmsLogDeliveryState): string {
  switch (state) {
    case 'delivered':
      return 'border-green-400 bg-green-50'
    case 'failed':
      return 'border-red-400 bg-red-50'
    case 'pending':
      return 'border-amber-400 bg-amber-50'
    default:
      return 'border-violet-200 bg-violet-50'
  }
}
