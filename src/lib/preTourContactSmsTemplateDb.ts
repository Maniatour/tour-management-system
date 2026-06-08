import { supabase, supabaseAdmin } from '@/lib/supabase'
import type { PreTourContactSmsLocale } from '@/lib/preTourContactSmsLocale'

export async function fetchPreTourContactSmsTemplateFromDb(
  locale: PreTourContactSmsLocale
): Promise<string | null> {
  const db = supabaseAdmin ?? supabase
  const { data, error } = await (db as any)
    .from('pre_tour_contact_sms_templates')
    .select('body_template')
    .eq('locale', locale)
    .maybeSingle()

  if (error) {
    console.error('fetchPreTourContactSmsTemplateFromDb:', error)
    return null
  }
  const body = String((data as { body_template?: string } | null)?.body_template ?? '').trim()
  return body || null
}
