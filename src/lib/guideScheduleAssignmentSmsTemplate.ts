import type { SupportedLocale } from '@/lib/guideLanguageDetection'
import { fetchAdminSmsTemplateFromDb } from '@/lib/adminSmsTemplateDb'

const BUILTIN_BODY: Record<SupportedLocale, string> = {
  ko: `[Mania Tour] {{GUIDE_NAME}}님, {{TOUR_DATE}} {{PRODUCT_NAME}} 투어가 배정되었습니다.
{{PICKUP_LINE}}

{{OFFICE_LINE}}
확정 또는 거절해 주세요.
{{CONFIRM_URL}}`,
  en: `[Mania Tour] Hi {{GUIDE_NAME}}, you are assigned to {{TOUR_DATE}} {{PRODUCT_NAME}}.
{{PICKUP_LINE}}

{{OFFICE_LINE}}
Please confirm or reject.
{{CONFIRM_URL}}`,
  ja: `[Mania Tour] {{GUIDE_NAME}}様、{{TOUR_DATE}} {{PRODUCT_NAME}} のツアーが割り当てられました。
{{PICKUP_LINE}}

{{OFFICE_LINE}}
確定または辞退してください。
{{CONFIRM_URL}}`,
  zh: `[Mania Tour] {{GUIDE_NAME}}，您已被安排 {{TOUR_DATE}} {{PRODUCT_NAME}} 行程。
{{PICKUP_LINE}}

{{OFFICE_LINE}}
请确认或拒绝。
{{CONFIRM_URL}}`,
}

export const GUIDE_SCHEDULE_ASSIGNMENT_SMS_PLACEHOLDER_HINT =
  '{{GUIDE_NAME}}, {{TOUR_DATE}}, {{PRODUCT_NAME}}, {{PICKUP_LINE}}, {{OFFICE_LINE}}, {{CONFIRM_URL}}'

export function getBuiltinGuideScheduleAssignmentSmsTemplate(locale: SupportedLocale): string {
  return BUILTIN_BODY[locale]
}

export async function resolveGuideScheduleAssignmentSmsTemplate(
  locale: SupportedLocale
): Promise<string> {
  const fromDb = await fetchAdminSmsTemplateFromDb('guide_schedule_assignment', locale)
  return fromDb ?? getBuiltinGuideScheduleAssignmentSmsTemplate(locale)
}

export type SubstituteGuideScheduleAssignmentSmsParams = {
  guideName: string
  tourDate: string
  productName: string
  pickupLine: string
  officeLine: string
  confirmUrl: string
}

export function substituteGuideScheduleAssignmentSmsTemplate(
  bodyTpl: string,
  params: SubstituteGuideScheduleAssignmentSmsParams
): string {
  return bodyTpl
    .replace(/\{\{GUIDE_NAME\}\}/g, params.guideName)
    .replace(/\{\{TOUR_DATE\}\}/g, params.tourDate)
    .replace(/\{\{PRODUCT_NAME\}\}/g, params.productName)
    .replace(/\{\{PICKUP_LINE\}\}/g, params.pickupLine)
    .replace(/\{\{OFFICE_LINE\}\}/g, params.officeLine)
    .replace(/\{\{CONFIRM_URL\}\}/g, params.confirmUrl)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
