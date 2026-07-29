export type StaffOutreachMessageLocale = 'ko' | 'en'
export type StaffOutreachMessageChannel = 'email' | 'sms'

export type StaffOutreachTemplateScope =
  | 'cancellation_follow_up'
  | 'pending_alt_tour'
  | 'resident_inquiry'

export type StaffOutreachMessageTemplateRow = {
  id: string
  scope: StaffOutreachTemplateScope
  locale: StaffOutreachMessageLocale
  channel: StaffOutreachMessageChannel
  variant: string
  name: string
  subject_template: string | null
  body_template: string
  sort_order: number
  updated_at: string
  updated_by: string | null
}

export const STAFF_OUTREACH_BUILTIN_TEMPLATE_ID = '__builtin__'

export function defaultStaffOutreachTemplateName(locale: StaffOutreachMessageLocale): string {
  return locale === 'ko' ? '기본' : 'Default'
}

export function nextStaffOutreachTemplateName(
  locale: StaffOutreachMessageLocale,
  existingNames: string[]
): string {
  const base = locale === 'ko' ? '템플릿' : 'Template'
  const used = new Set(existingNames.map((n) => n.trim().toLowerCase()))
  if (!used.has(defaultStaffOutreachTemplateName(locale).toLowerCase())) {
    return defaultStaffOutreachTemplateName(locale)
  }
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base} ${i}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return `${base} ${Date.now()}`
}
