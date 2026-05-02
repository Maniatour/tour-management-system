import { supabase } from '@/lib/supabase'

export type ResidentInquiryEmailTemplateRow = {
  locale: 'ko' | 'en'
  subject_template: string
  html_template: string
  updated_at: string
  updated_by: string | null
}

export async function fetchResidentInquiryEmailTemplateFromDb(
  locale: 'ko' | 'en'
): Promise<{ subject_template: string; html_template: string } | null> {
  const { data, error } = await supabase
    .from('resident_inquiry_email_templates')
    .select('subject_template,html_template')
    .eq('locale', locale)
    .maybeSingle()

  if (error) {
    console.error('fetchResidentInquiryEmailTemplateFromDb:', error)
    return null
  }
  if (!data) return null
  const row = data as { subject_template?: string; html_template?: string }
  const st = String(row.subject_template ?? '').trim()
  const ht = String(row.html_template ?? '').trim()
  if (!st || !ht) return null
  return { subject_template: st, html_template: ht }
}
