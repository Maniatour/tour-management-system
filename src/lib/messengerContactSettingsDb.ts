import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  DEFAULT_MESSENGER_CONTACT_SETTINGS,
  type MessengerContactSettings,
} from '@/lib/preTourContactSms'

export async function fetchMessengerContactSettingsFromDb(): Promise<MessengerContactSettings> {
  const db = supabaseAdmin ?? supabase
  const { data, error } = await (db as any)
    .from('customer_messenger_contact_settings')
    .select('line_id, whatsapp, kakao, contact_email')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('fetchMessengerContactSettingsFromDb:', error)
    return { ...DEFAULT_MESSENGER_CONTACT_SETTINGS }
  }

  const row = data as {
    line_id?: string
    whatsapp?: string
    kakao?: string
    contact_email?: string
  }

  return {
    line_id: String(row.line_id ?? DEFAULT_MESSENGER_CONTACT_SETTINGS.line_id).trim(),
    whatsapp: String(row.whatsapp ?? DEFAULT_MESSENGER_CONTACT_SETTINGS.whatsapp).trim(),
    kakao: String(row.kakao ?? DEFAULT_MESSENGER_CONTACT_SETTINGS.kakao).trim(),
    contact_email: String(row.contact_email ?? DEFAULT_MESSENGER_CONTACT_SETTINGS.contact_email).trim(),
  }
}

export async function upsertMessengerContactSettings(
  settings: MessengerContactSettings,
  updatedBy: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin ?? supabase
  const { error } = await (db as any).from('customer_messenger_contact_settings').upsert(
    {
      id: 1,
      line_id: settings.line_id.trim(),
      whatsapp: settings.whatsapp.trim(),
      kakao: settings.kakao.trim(),
      contact_email: settings.contact_email.trim(),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: 'id' }
  )

  if (error) {
    console.error('upsertMessengerContactSettings:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
