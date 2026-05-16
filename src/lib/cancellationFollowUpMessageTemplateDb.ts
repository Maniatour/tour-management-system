import { supabase, supabaseAdmin } from '@/lib/supabase'
import type {
  CancellationFollowUpMessageChannel,
  CancellationFollowUpMessageKind,
  CancellationFollowUpMessageLocale,
} from '@/lib/cancellationFollowUpMessage'

export async function fetchCancellationFollowUpMessageTemplateFromDb(
  locale: CancellationFollowUpMessageLocale,
  channel: CancellationFollowUpMessageChannel,
  messageKind: CancellationFollowUpMessageKind
): Promise<{ subject_template: string | null; body_template: string } | null> {
  const db = supabaseAdmin ?? supabase
  const { data, error } = await db
    .from('cancellation_follow_up_message_templates')
    .select('subject_template,body_template')
    .eq('locale', locale)
    .eq('channel', channel)
    .eq('message_kind', messageKind)
    .maybeSingle()

  if (error) {
    console.error('fetchCancellationFollowUpMessageTemplateFromDb:', error)
    return null
  }
  if (!data) return null
  const row = data as { subject_template?: string | null; body_template?: string }
  const body = String(row.body_template ?? '').trim()
  if (!body) return null
  return {
    subject_template: row.subject_template != null ? String(row.subject_template) : null,
    body_template: body,
  }
}
