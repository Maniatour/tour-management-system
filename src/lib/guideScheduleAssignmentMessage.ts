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

export type GuideScheduleAssignmentRecipientPreview = GuideScheduleConfirmRecipientPreview & {
  confirmUrl: string
}

export type GuideScheduleAssignmentPreview = Omit<GuideScheduleConfirmPreview, 'recipients'> & {
  recipients: GuideScheduleAssignmentRecipientPreview[]
}

export function buildGuideTourAssignmentUrl(tourId: string, locale: SupportedLocale): string {
  const pathLocale = locale === 'en' ? 'en' : 'ko'
  return `${KOVEGAS_CUSTOMER_SITE_ORIGIN}/${pathLocale}/guide/tours/${tourId}?assignment=1`
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
    return {
      ...r,
      smsBody,
      confirmUrl,
      siteTitle: '',
      siteMessageBody: '',
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
