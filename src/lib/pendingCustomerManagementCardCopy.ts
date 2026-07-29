export function pendingCustomerManagementCardCopy(locale: string) {
  const isKo = locale === 'ko'
  return {
    altTourNoticeTitle: isKo ? '대체 투어 안내 완료' : 'Alternative tour outreach done',
    altTourMessagePreviewTitle: isKo ? '대체 투어 안내 메시지' : 'Alternative tour message',
    customerResponseTitle: isKo ? '고객 답변 기록' : 'Record customer reply',
    customerResponseSaveFailed: isKo ? '고객 답변 저장에 실패했습니다.' : 'Failed to save customer reply.',
    resolutionBlockedNoNotice: isKo
      ? '대체 투어 안내를 먼저 완료해 주세요.'
      : 'Complete the alternative tour outreach first.',
    resolutionBlockedNoCustomerResponse: isKo
      ? '고객 답변을 먼저 기록해 주세요.'
      : 'Record the customer reply first.',
    resolutionCancelTitle: isKo ? '취소 처리' : 'Mark cancellation',
    resolutionDateChangeTitle: isKo ? '날짜 변경 처리' : 'Mark date change',
    resolutionTourChangeTitle: isKo ? '투어 변경 처리' : 'Mark tour change',
    resolutionModalTitle: (kind: 'cancel' | 'date_change' | 'tour_change') => {
      if (kind === 'cancel') return isKo ? '취소 처리 기록' : 'Record cancellation handling'
      if (kind === 'date_change') return isKo ? '날짜 변경 처리 기록' : 'Record date change'
      return isKo ? '투어 변경 처리 기록' : 'Record tour change'
    },
    resolutionNotePlaceholder: isKo
      ? '처리 내용 메모 (선택)'
      : 'Handling notes (optional)',
    resolutionSave: isKo ? '처리 완료' : 'Mark resolved',
    resolutionSaveFailed: isKo ? '처리 기록 저장에 실패했습니다.' : 'Failed to save resolution.',
    daysUntilTour: (days: number) =>
      isKo ? `투어 ${days}일 전` : days === 0 ? 'Tour today' : `${days}d to tour`,
  }
}
