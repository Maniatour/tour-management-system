import { HOMEPAGE_BOOKING_CHANNEL_ID } from '@/lib/productDetailPromoCodes'
import { channelIsOtaForPricingSection } from '@/utils/channelSettlement'

export type CouponChannelRow = {
  id: string
  name?: string | null
  type?: string | null
  category?: string | null
}

/**
 * 홈페이지 직예약 채널 여부 — `PricingSection` 쿠폰·채널 로직과 동일 기준.
 * (id `M00001` 또는 채널명에 homepage / 홈페이지)
 */
export function isHomepageBookingChannel(
  channelId: string | null | undefined,
  channels: Array<{ id: string; name?: string | null }> | null | undefined
): boolean {
  if (!channelId) return false
  return resolveHomepageChannelId(channels) === channelId
}

export function isKakaoTalkLikeChannelName(name: string | null | undefined): boolean {
  const n = String(name ?? '').toLowerCase()
  return n.includes('kakao') || n.includes('카카오')
}

/** 홈페이지 채널 id. 목록에 없어도 Kovegas Direct Web(`M00001`)으로 폴백 */
export function resolveHomepageChannelId(
  channels: Array<{ id: string; name?: string | null }> | null | undefined
): string {
  if (!channels?.length) return HOMEPAGE_BOOKING_CHANNEL_ID
  const homepageChannel = channels.find(
    (ch) =>
      ch.id === HOMEPAGE_BOOKING_CHANNEL_ID ||
      (ch.name &&
        (String(ch.name).toLowerCase().includes('homepage') || String(ch.name).includes('홈페이지')))
  )
  return homepageChannel?.id ?? HOMEPAGE_BOOKING_CHANNEL_ID
}

function isGetYourGuideFamilyName(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('getyourguide') || n.includes('get your guide')
}

/**
 * 홈페이지 쿠폰을 함께 쓸 수 있는 직판 채널.
 * 카카오톡(Kakaotalk, Open Kakaotalk 등)은 OTA가 아니며 홈페이지와 동일 쿠폰을 써야 한다.
 */
export function channelSharesHomepageCoupons(
  ch:
    | { id?: string | null; type?: string | null; category?: string | null; name?: string | null }
    | undefined
): boolean {
  if (!ch) return true
  if (isKakaoTalkLikeChannelName(ch.name)) return true
  if (String(ch.id ?? '').trim() === HOMEPAGE_BOOKING_CHANNEL_ID) return true
  return !channelIsOtaForPricingSection(ch)
}

/**
 * 예약 채널에서 선택 가능한 쿠폰인지.
 * - 쿠폰에 채널이 없으면 공통
 * - 같은 채널
 * - 직판(카카오톡 포함)·홈페이지는 홈페이지 쿠폰 공유
 * - GetYourGuide 계열은 서로 공유
 */
export function couponMatchesReservationChannel(
  coupon: { channel_id?: string | null },
  reservationChannelId: string | null | undefined,
  channels: CouponChannelRow[] | null | undefined
): boolean {
  if (!reservationChannelId) return false
  if (coupon.channel_id == null || String(coupon.channel_id).trim() === '') return true
  if (coupon.channel_id === reservationChannelId) return true

  const channelName = (id: string | null | undefined) => {
    if (!id || !channels?.length) return ''
    const row = channels.find((c) => c.id === id)
    return String(row?.name || '')
  }

  if (
    isGetYourGuideFamilyName(channelName(reservationChannelId)) &&
    isGetYourGuideFamilyName(channelName(coupon.channel_id))
  ) {
    return true
  }

  const homepageId = resolveHomepageChannelId(channels)
  if (coupon.channel_id !== homepageId) return false

  const reservationChannel =
    channels?.find((c) => c.id === reservationChannelId) ?? { id: reservationChannelId }
  return channelSharesHomepageCoupons(reservationChannel)
}
