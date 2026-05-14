import { supabase } from '@/lib/supabase'

async function resolveCreatedByEmail(providedEmail?: string | null): Promise<string | null> {
  if (providedEmail && providedEmail.trim()) return providedEmail.trim()
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.email ?? null
  } catch {
    return null
  }
}

export async function upsertReservationCancellationReason(
  reservationId: string,
  reason: string,
  createdByEmail?: string | null
): Promise<void> {
  const trimmed = reason.trim()
  if (!reservationId || !trimmed) return

  const createdBy = await resolveCreatedByEmail(createdByEmail)

  const { data: existingRows, error: fetchError } = await supabase
    .from('reservation_follow_ups')
    .select('id')
    .eq('reservation_id', reservationId)
    .eq('type', 'cancellation_reason')
    .order('created_at', { ascending: false })
    .limit(1)

  if (fetchError) throw fetchError

  const existingId = existingRows?.[0]?.id ?? null
  if (existingId) {
    const { error: updateError } = await supabase
      .from('reservation_follow_ups')
      .update({ content: trimmed })
      .eq('id', existingId)
    if (updateError) throw updateError
    return
  }

  const { error: insertError } = await supabase.from('reservation_follow_ups').insert({
    reservation_id: reservationId,
    type: 'cancellation_reason',
    content: trimmed,
    created_by: createdBy,
  })
  if (insertError) throw insertError
}
