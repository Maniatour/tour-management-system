/** 같은 고객·상품·날짜·인원·채널의 새 사이트 결제 재시도를 한 예약으로 묶는 키. */
export function webCheckoutDedupeKey(parts: {
  customerId: string
  productId: string
  tourDate: string
  adults: number
  child: number
  infant: number
  channelId: string
}): string {
  return [
    parts.customerId.trim(),
    parts.productId.trim(),
    parts.tourDate.trim(),
    String(parts.adults || 0),
    String(parts.child || 0),
    String(parts.infant || 0),
    parts.channelId.trim(),
  ].join('|')
}

export function duplicateWebBookingMessage(reservationId: string): string {
  return `이미 같은 날짜·인원의 예약이 있습니다. 예약번호 ${reservationId}`
}
