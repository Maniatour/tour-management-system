import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'

/** 예약 카드 SMS 버튼에서 선택 가능한 카테고리 */
export const RESERVATION_CARD_SMS_CATEGORY_IDS = [
  'pre_tour_contact',
  'pickup_notification',
  'cancellation_follow_up',
  'cancellation_rebooking',
  'pending_alt_tour',
] as const satisfies readonly AdminSmsCategoryId[]

export type ReservationOutboundSmsCategoryId = (typeof RESERVATION_CARD_SMS_CATEGORY_IDS)[number]

export function isReservationOutboundSmsCategoryId(
  value: string
): value is ReservationOutboundSmsCategoryId {
  return (RESERVATION_CARD_SMS_CATEGORY_IDS as readonly string[]).includes(value)
}

export function availableLocalesForReservationSmsCategory(
  _categoryId: ReservationOutboundSmsCategoryId
): readonly string[] {
  return ['ko', 'en'] as const
}
