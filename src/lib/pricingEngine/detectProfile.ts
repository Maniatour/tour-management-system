import {
  isCancelledReservationStatus,
  isNoShowReservationStatus,
} from '@/lib/reservationStatus'
import type { PricingEngineContext, PricingProfileId } from '@/lib/pricingEngine/types'

const PROFILE_LABELS: Record<
  PricingProfileId,
  { ko: string; en: string }
> = {
  SELF_ACTIVE: { ko: '직판 · 진행', en: 'Direct · Active' },
  SELF_CANCELLED: { ko: '직판 · 취소', en: 'Direct · Cancelled' },
  SELF_NO_SHOW: { ko: '직판 · 노쇼', en: 'Direct · No-show' },
  OTA_ACTIVE: { ko: 'OTA · 진행', en: 'OTA · Active' },
  OTA_CANCELLED: { ko: 'OTA · 취소', en: 'OTA · Cancelled' },
  OTA_NO_SHOW: { ko: 'OTA · 노쇼', en: 'OTA · No-show' },
  PARTNER_ACTIVE: { ko: '파트너 · 진행', en: 'Partner · Active' },
  OTHER: { ko: '기타', en: 'Other' },
}

export function detectPricingProfile(ctx: PricingEngineContext): {
  profile: PricingProfileId
  labelKo: string
  labelEn: string
} {
  const st = ctx.reservationStatus
  const cancelled = isCancelledReservationStatus(st)
  const noShow = isNoShowReservationStatus(st)

  let profile: PricingProfileId = 'OTHER'

  if (ctx.isOtaChannel) {
    if (cancelled) profile = 'OTA_CANCELLED'
    else if (noShow) profile = 'OTA_NO_SHOW'
    else profile = 'OTA_ACTIVE'
  } else if (!ctx.isHomepageBooking && !ctx.isOtaChannel) {
    // partner / other direct channels fall through to SELF for now
    if (cancelled) profile = 'SELF_CANCELLED'
    else if (noShow) profile = 'SELF_NO_SHOW'
    else profile = 'SELF_ACTIVE'
  } else {
    if (cancelled) profile = 'SELF_CANCELLED'
    else if (noShow) profile = 'SELF_NO_SHOW'
    else profile = 'SELF_ACTIVE'
  }

  const labels = PROFILE_LABELS[profile]
  return { profile, labelKo: labels.ko, labelEn: labels.en }
}
