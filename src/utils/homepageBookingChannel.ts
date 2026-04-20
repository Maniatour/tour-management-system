/**
 * 홈페이지 직예약 채널 여부 — `PricingSection` 쿠폰·채널 로직과 동일 기준.
 * (id `M00001` 또는 채널명에 homepage / 홈페이지)
 */
export function isHomepageBookingChannel(
  channelId: string | null | undefined,
  channels: Array<{ id: string; name?: string | null }> | null | undefined
): boolean {
  if (!channelId || !channels?.length) return false
  const homepageChannel = channels.find(
    (ch) =>
      ch.id === 'M00001' ||
      (ch.name &&
        (String(ch.name).toLowerCase().includes('homepage') || String(ch.name).includes('홈페이지')))
  )
  return !!homepageChannel && homepageChannel.id === channelId
}
