import type { SupportedLocale } from '@/lib/guideLanguageDetection'
import { fetchAdminSmsTemplateFromDb } from '@/lib/adminSmsTemplateDb'

const BUILTIN_BODY: Record<SupportedLocale, string> = {
  ko: `[Mania Tour] {{GUIDE_NAME}}님, {{TOUR_DATE}} {{PRODUCT_NAME}} 투어 안내입니다.
{{PICKUP_LINE}}

{{OFFICE_LINE}}`,
  en: `[Mania Tour] Hi {{GUIDE_NAME}}, schedule for {{TOUR_DATE}} {{PRODUCT_NAME}}.
{{PICKUP_LINE}}

{{OFFICE_LINE}}`,
  ja: `[Mania Tour] {{GUIDE_NAME}}様、{{TOUR_DATE}} {{PRODUCT_NAME}} ツアーのご案内です。
{{PICKUP_LINE}}

{{OFFICE_LINE}}`,
  zh: `[Mania Tour] {{GUIDE_NAME}}，{{TOUR_DATE}} {{PRODUCT_NAME}} 行程通知。
{{PICKUP_LINE}}

{{OFFICE_LINE}}`,
}

export const GUIDE_SCHEDULE_CONFIRM_SMS_PLACEHOLDER_HINT =
  '{{GUIDE_NAME}}, {{TOUR_DATE}}, {{PRODUCT_NAME}}, {{PICKUP_LINE}}, {{OFFICE_LINE}}'

export function getBuiltinGuideScheduleConfirmSmsTemplate(locale: SupportedLocale): string {
  return BUILTIN_BODY[locale]
}

export async function resolveGuideScheduleConfirmSmsTemplate(
  locale: SupportedLocale
): Promise<string> {
  const fromDb = await fetchAdminSmsTemplateFromDb('guide_schedule_confirm', locale)
  return fromDb ?? getBuiltinGuideScheduleConfirmSmsTemplate(locale)
}

export type SubstituteGuideScheduleConfirmSmsParams = {
  guideName: string
  tourDate: string
  productName: string
  pickupLine: string
  officeLine: string
}

export function substituteGuideScheduleConfirmSmsTemplate(
  bodyTpl: string,
  params: SubstituteGuideScheduleConfirmSmsParams
): string {
  return bodyTpl
    .replace(/\{\{GUIDE_NAME\}\}/g, params.guideName)
    .replace(/\{\{TOUR_DATE\}\}/g, params.tourDate)
    .replace(/\{\{PRODUCT_NAME\}\}/g, params.productName)
    .replace(/\{\{PICKUP_LINE\}\}/g, params.pickupLine)
    .replace(/\{\{OFFICE_LINE\}\}/g, params.officeLine)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
