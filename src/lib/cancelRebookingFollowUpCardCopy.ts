/** Admin cancel/rebook follow-up card copy (locale-stable; avoids partial i18n bundle gaps). */
export function cancelRebookingFollowUpCardCopy(locale: string) {
  const isKo = locale === 'ko'
  return {
    customerResponseButtonTitle: isKo ? '고객 답변 기록' : 'Record customer reply',
    reasonBlockedNoFollowUp: isKo
      ? '먼저 취소·재예약 권유 안내 Follow-up(📞)을 표시하세요.'
      : 'Mark cancel/rebook outreach follow-up done (📞) first.',
    reasonBlockedNoCustomerResponse: isKo
      ? '먼저 고객 답변(💬)을 기록하세요.'
      : 'Record the customer reply (💬) first.',
    customerResponseSaveFailed: isKo
      ? '고객 답변 저장에 실패했습니다.'
      : 'Failed to save customer reply.',
  }
}
