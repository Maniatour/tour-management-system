import type { ResidentInquiryEmailTourKind } from '@/lib/residentInquiryTourKind'
import { fetchPrimaryStaffOutreachMessageTemplateFromDb } from '@/lib/staffOutreachMessageTemplateDb'

export type ResidentInquiryEmailTemplateRow = {
  locale: 'ko' | 'en'
  tour_kind: ResidentInquiryEmailTourKind
  subject_template: string
  html_template: string
  updated_at: string
  updated_by: string | null
}

export async function fetchResidentInquiryEmailTemplateFromDb(
  locale: 'ko' | 'en',
  tourKind: ResidentInquiryEmailTourKind = 'day_tour'
): Promise<{ subject_template: string; html_template: string } | null> {
  const row = await fetchPrimaryStaffOutreachMessageTemplateFromDb(
    'resident_inquiry',
    locale,
    'email',
    tourKind
  )
  if (!row?.body_template) return null
  const subject = String(row.subject_template ?? '').trim()
  if (!subject) return null
  return {
    subject_template: subject,
    html_template: row.body_template,
  }
}
