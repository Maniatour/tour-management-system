import { KOVEGAS_CUSTOMER_SITE_ORIGIN } from '@/lib/customerRebookingUrl'
import { fetchAdminSmsTemplatesForKey } from '@/lib/adminSmsTemplateDb'
import type { SupportedLocale } from '@/lib/guideLanguageDetection'
import {
  buildGuideScheduleConfirmPreview,
  buildGuideScheduleConfirmOfficeLine,
  buildGuideScheduleConfirmPickupLine,
  formatGuideScheduleTourDateLabel,
  type GuideScheduleConfirmRecipientPreview,
  type GuideScheduleConfirmPreview,
} from '@/lib/guideScheduleConfirmMessage'
import {
  getBuiltinGuideScheduleAssignmentSmsTemplate,
  substituteGuideScheduleAssignmentSmsTemplate,
} from '@/lib/guideScheduleAssignmentSmsTemplate'

export type GuideScheduleAssignmentSendChannels = 'sms' | 'push' | 'both'

export type GuideScheduleAssignmentRecipientPreview = GuideScheduleConfirmRecipientPreview & {
  confirmUrl: string
  pushTitle: string
  pushBody: string
}

export type GuideScheduleAssignmentPreview = Omit<GuideScheduleConfirmPreview, 'recipients'> & {
  recipients: GuideScheduleAssignmentRecipientPreview[]
}

export function parseGuideScheduleAssignmentChannels(
  value: unknown
): GuideScheduleAssignmentSendChannels {
  if (value === 'push' || value === 'both' || value === 'sms') return value
  return 'sms'
}

export function buildGuideTourAssignmentUrl(tourId: string, locale: SupportedLocale): string {
  const pathLocale = locale === 'en' ? 'en' : 'ko'
  return `${KOVEGAS_CUSTOMER_SITE_ORIGIN}/${pathLocale}/guide/tours/${tourId}?assignment=1`
}

export function buildGuideScheduleAssignmentPushContent(input: {
  locale: SupportedLocale
  tourDate: string
  productName: string
}): { pushTitle: string; pushBody: string } {
  const dateLabel = formatGuideScheduleTourDateLabel(input.tourDate, input.locale)
  if (input.locale === 'ko') {
    return {
      pushTitle: '스케줄이 배정되었습니다',
      pushBody: `${dateLabel} ${input.productName} — 앱에서 확정 또는 거절해 주세요.`,
    }
  }
  if (input.locale === 'ja') {
    return {
      pushTitle: 'スケジュールが割り当てられました',
      pushBody: `${dateLabel} ${input.productName} — アプリで確定または辞退してください。`,
    }
  }
  if (input.locale === 'zh') {
    return {
      pushTitle: '行程已分配',
      pushBody: `${dateLabel} ${input.productName} — 请在应用中确认或拒绝。`,
    }
  }
  return {
    pushTitle: 'Tour schedule assigned',
    pushBody: `${dateLabel} ${input.productName} — Please confirm or reject in the app.`,
  }
}

export function buildGuideScheduleAssignmentSiteContent(input: {
  locale: SupportedLocale
  guideName: string
  tourDate: string
  productName: string
  firstPickupTime?: string | null
  firstPickupHotelLabel?: string | null
  firstPickupTimeRaw?: string | null
  firstPickupDateIso?: string | null
}): { siteTitle: string; siteMessageBody: string } {
  const dateLabel = formatGuideScheduleTourDateLabel(input.tourDate, input.locale)
  const pickupLine = buildGuideScheduleConfirmPickupLine(
    input.locale,
    input.firstPickupTime ?? null,
    input.firstPickupHotelLabel ?? null,
    input.firstPickupDateIso ?? input.tourDate,
  )
  const officeLine = buildGuideScheduleConfirmOfficeLine(
    input.locale,
    input.tourDate,
    input.firstPickupTimeRaw ?? null,
  )

  if (input.locale === 'ko') {
    return {
      siteTitle: '스케줄 배정 안내',
      siteMessageBody: `${input.guideName}님, 안녕하세요.\n\n${dateLabel} · ${input.productName}\n${pickupLine}\n\n${officeLine}\n\n아래 버튼으로 확정 또는 거절해 주세요.`,
    }
  }
  if (input.locale === 'ja') {
    return {
      siteTitle: 'スケジュール割り当て',
      siteMessageBody: `${input.guideName}様\n\n${dateLabel} · ${input.productName}\n${pickupLine}\n\n${officeLine}\n\n下のボタンで確定または辞退してください。`,
    }
  }
  if (input.locale === 'zh') {
    return {
      siteTitle: '行程分配通知',
      siteMessageBody: `${input.guideName}，您好。\n\n${dateLabel} · ${input.productName}\n${pickupLine}\n\n${officeLine}\n\n请使用下方按钮确认或拒绝。`,
    }
  }
  return {
    siteTitle: 'Schedule assignment',
    siteMessageBody: `Hello ${input.guideName},\n\n${dateLabel} · ${input.productName}\n${pickupLine}\n\n${officeLine}\n\nPlease confirm or reject using the buttons below.`,
  }
}

function buildAssignmentSmsBody(input: {
  locale: SupportedLocale
  guideName: string
  tourDate: string
  productName: string
  tourId: string
  firstPickupTime?: string | null
  firstPickupHotelLabel?: string | null
  firstPickupTimeRaw?: string | null
  firstPickupDateIso?: string | null
  smsTemplateByLocale?: Partial<Record<SupportedLocale, string>>
}): { smsBody: string; confirmUrl: string } {
  const dateLabel = formatGuideScheduleTourDateLabel(input.tourDate, input.locale)
  const confirmUrl = buildGuideTourAssignmentUrl(input.tourId, input.locale)
  const pickupLine = buildGuideScheduleConfirmPickupLine(
    input.locale,
    input.firstPickupTime ?? null,
    input.firstPickupHotelLabel ?? null,
    input.firstPickupDateIso ?? input.tourDate,
  )
  const officeLine = buildGuideScheduleConfirmOfficeLine(
    input.locale,
    input.tourDate,
    input.firstPickupTimeRaw ?? null,
  )
  const smsTpl =
    input.smsTemplateByLocale?.[input.locale]?.trim() ||
    getBuiltinGuideScheduleAssignmentSmsTemplate(input.locale)
  const smsBody = substituteGuideScheduleAssignmentSmsTemplate(smsTpl, {
    guideName: input.guideName,
    tourDate: dateLabel,
    productName: input.productName,
    pickupLine,
    officeLine,
    confirmUrl,
  })
  return { smsBody, confirmUrl }
}

export function composeGuideScheduleAssignmentPreview(
  base: GuideScheduleConfirmPreview,
  smsTemplateByLocale?: Partial<Record<SupportedLocale, string>>
): GuideScheduleAssignmentPreview {
  const recipients: GuideScheduleAssignmentRecipientPreview[] = base.recipients.map((r) => {
    const { smsBody, confirmUrl } = buildAssignmentSmsBody({
      locale: r.locale,
      guideName: r.displayName,
      tourDate: base.tourDate,
      productName: base.productName,
      tourId: base.tourId,
      firstPickupTime: base.firstPickupTime,
      firstPickupHotelLabel: base.firstPickupHotelLabel,
      firstPickupTimeRaw: base.firstPickupTimeRaw,
      firstPickupDateIso: base.firstPickupDateIso,
      ...(smsTemplateByLocale ? { smsTemplateByLocale } : {}),
    })
    const { pushTitle, pushBody } = buildGuideScheduleAssignmentPushContent({
      locale: r.locale,
      tourDate: base.tourDate,
      productName: base.productName,
    })
    const { siteTitle, siteMessageBody } = buildGuideScheduleAssignmentSiteContent({
      locale: r.locale,
      guideName: r.displayName,
      tourDate: base.tourDate,
      productName: base.productName,
      firstPickupTime: base.firstPickupTime,
      firstPickupHotelLabel: base.firstPickupHotelLabel,
      firstPickupTimeRaw: base.firstPickupTimeRaw,
      firstPickupDateIso: base.firstPickupDateIso,
    })
    return {
      ...r,
      smsBody,
      confirmUrl,
      pushTitle,
      pushBody,
      siteTitle,
      siteMessageBody,
    }
  })

  return {
    ...base,
    recipients,
  }
}

export async function buildGuideScheduleAssignmentPreview(
  tourId: string,
  adminLocale = 'ko'
): Promise<{ ok: true; data: GuideScheduleAssignmentPreview } | { ok: false; error: string; status: number }> {
  const baseResult = await buildGuideScheduleConfirmPreview(tourId, adminLocale)
  if (!baseResult.ok) {
    return baseResult
  }

  const smsTemplateByLocale = await fetchAdminSmsTemplatesForKey('guide_schedule_assignment')

  return {
    ok: true,
    data: composeGuideScheduleAssignmentPreview(
      baseResult.data,
      smsTemplateByLocale as Partial<Record<SupportedLocale, string>>
    ),
  }
}
