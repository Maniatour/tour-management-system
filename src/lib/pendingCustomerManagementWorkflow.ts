export type PendingCustomerResolutionKind = 'cancel' | 'date_change' | 'tour_change'

export type PendingCustomerWorkflowState = {
  altTourNoticeManual: boolean
  hasCustomerResponse: boolean
  resolutionKind: PendingCustomerResolutionKind | null
}

export function normalizePendingCustomerResolutionKind(
  value: string | null | undefined
): PendingCustomerResolutionKind | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'cancel') return 'cancel'
  if (raw === 'date_change') return 'date_change'
  if (raw === 'tour_change') return 'tour_change'
  return null
}

export function buildPendingCustomerWorkflowState(input: {
  altTourNoticeManual?: boolean
  hasCustomerResponse?: boolean
  resolutionKind?: string | null
}): PendingCustomerWorkflowState {
  return {
    altTourNoticeManual: input.altTourNoticeManual ?? false,
    hasCustomerResponse: input.hasCustomerResponse ?? false,
    resolutionKind: normalizePendingCustomerResolutionKind(input.resolutionKind),
  }
}

export function isPendingCustomerWorkflowComplete(state: PendingCustomerWorkflowState): boolean {
  return (
    state.altTourNoticeManual &&
    state.hasCustomerResponse &&
    state.resolutionKind != null
  )
}

export type PendingCustomerWorkflowBadge = {
  id: string
  label: string
  tone: 'needed' | 'done' | 'waiting'
}

export function buildPendingCustomerWorkflowBadges(
  state: PendingCustomerWorkflowState,
  locale: string
): PendingCustomerWorkflowBadge[] {
  const isKo = locale === 'ko'

  if (isPendingCustomerWorkflowComplete(state)) {
    const resolutionLabel = pendingCustomerResolutionLabel(state.resolutionKind!, locale)
    return [
      {
        id: 'workflow_complete',
        label: isKo ? `✅ 처리 완료 · ${resolutionLabel}` : `✅ Resolved · ${resolutionLabel}`,
        tone: 'done',
      },
    ]
  }

  if (!state.altTourNoticeManual) {
    return [
      {
        id: 'alt_tour_needed',
        label: isKo ? '대체 투어 안내 필요' : 'Alternative tour outreach needed',
        tone: 'needed',
      },
    ]
  }

  if (!state.hasCustomerResponse) {
    return [
      {
        id: 'alt_tour_done',
        label: isKo ? '✅ 대체 투어 안내 완료' : '✅ Alternative tour outreach done',
        tone: 'done',
      },
      {
        id: 'customer_waiting',
        label: isKo ? '고객 답변 대기중' : 'Awaiting customer reply',
        tone: 'waiting',
      },
    ]
  }

  return [
    {
      id: 'resolution_needed',
      label: isKo ? '취소·날짜·투어 변경 처리 필요' : 'Cancel / date / tour change needed',
      tone: 'needed',
    },
  ]
}

export function pendingCustomerResolutionLabel(
  kind: PendingCustomerResolutionKind,
  locale: string
): string {
  const isKo = locale === 'ko'
  switch (kind) {
    case 'cancel':
      return isKo ? '취소 처리' : 'Cancellation'
    case 'date_change':
      return isKo ? '날짜 변경' : 'Date change'
    case 'tour_change':
      return isKo ? '투어 변경' : 'Tour change'
    default:
      return kind
  }
}

export function reservationNeedsPendingCustomerAttention(input: {
  status: string | null | undefined
  tourDate: string | null | undefined
  workflow: PendingCustomerWorkflowState
  dateRange: { start: string; end: string }
}): boolean {
  const status = String(input.status ?? '').trim().toLowerCase()
  if (status !== 'pending') return false

  const tourDate = String(input.tourDate ?? '').trim().slice(0, 10)
  if (!tourDate) return false
  if (tourDate < input.dateRange.start || tourDate > input.dateRange.end) return false

  return !isPendingCustomerWorkflowComplete(input.workflow)
}
