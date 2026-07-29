import { supabase, supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type {
  StaffOutreachMessageChannel,
  StaffOutreachMessageLocale,
  StaffOutreachMessageTemplateRow,
  StaffOutreachTemplateScope,
} from '@/lib/staffOutreachMessageTemplates'

export async function listStaffOutreachMessageTemplatesFromDb(
  scope: StaffOutreachTemplateScope,
  locale: StaffOutreachMessageLocale,
  channel: StaffOutreachMessageChannel,
  variant: string
): Promise<StaffOutreachMessageTemplateRow[]> {
  const db = supabaseAdmin ?? supabase
  const { data, error } = await fromUntypedTable(db, 'staff_outreach_message_templates')
    .select('id,scope,locale,channel,variant,name,subject_template,body_template,sort_order,updated_at,updated_by')
    .eq('scope', scope)
    .eq('locale', locale)
    .eq('channel', channel)
    .eq('variant', variant)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('listStaffOutreachMessageTemplatesFromDb:', error)
    return []
  }

  return (data ?? []) as StaffOutreachMessageTemplateRow[]
}

export async function fetchPrimaryStaffOutreachMessageTemplateFromDb(
  scope: StaffOutreachTemplateScope,
  locale: StaffOutreachMessageLocale,
  channel: StaffOutreachMessageChannel,
  variant: string
): Promise<{ subject_template: string | null; body_template: string } | null> {
  const rows = await listStaffOutreachMessageTemplatesFromDb(scope, locale, channel, variant)
  const first = rows[0]
  if (!first?.body_template?.trim()) return null
  return {
    subject_template: first.subject_template,
    body_template: first.body_template.trim(),
  }
}
