import { supabase, supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type { AdminSmsDbTemplateKey } from '@/lib/adminSmsTemplateCatalog'

export async function fetchAdminSmsTemplateFromDb(
  templateKey: AdminSmsDbTemplateKey,
  locale: string
): Promise<string | null> {
  const db = supabaseAdmin ?? supabase
  const { data, error } = await fromUntypedTable(db, 'admin_sms_templates')
    .select('body_template')
    .eq('template_key', templateKey)
    .eq('locale', locale)
    .maybeSingle()

  if (error) {
    console.error('fetchAdminSmsTemplateFromDb:', error)
    return null
  }
  const body = String((data as { body_template?: string } | null)?.body_template ?? '').trim()
  return body || null
}

export async function fetchAdminSmsTemplatesForKey(
  templateKey: AdminSmsDbTemplateKey
): Promise<Record<string, string>> {
  const db = supabaseAdmin ?? supabase
  const { data, error } = await fromUntypedTable(db, 'admin_sms_templates')
    .select('locale, body_template')
    .eq('template_key', templateKey)

  if (error) {
    console.error('fetchAdminSmsTemplatesForKey:', error)
    return {}
  }

  const map: Record<string, string> = {}
  for (const row of (data ?? []) as Array<{ locale: string; body_template: string }>) {
    const body = row.body_template?.trim()
    if (body) map[row.locale] = body
  }
  return map
}
