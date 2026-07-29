import type { SupabaseClient } from '@supabase/supabase-js'
import type { CancelFollowUpManualKind } from '@/components/reservation/ReservationFollowUpQueueModal'

export async function upsertReservationCancelFollowUpManual(
  supabase: SupabaseClient,
  reservationId: string,
  kind: CancelFollowUpManualKind,
  action: 'mark' | 'clear'
): Promise<{ cancelFollowUpManual: boolean; cancelRebookingOutreachManual: boolean } | null> {
  const col =
    kind === 'cancel_follow_up' ? 'cancel_follow_up_manual' : 'cancel_rebooking_outreach_manual'

  const { data: existing, error: selErr } = await supabase
    .from('reservation_follow_up_pipeline_manual')
    .select(
      'confirmation_manual, resident_manual, departure_manual, pickup_manual, cancel_follow_up_manual, cancel_rebooking_outreach_manual, pending_alt_tour_notice_manual, pending_resolution_kind'
    )
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (selErr) throw selErr

  const base = {
    confirmation_manual: !!(existing as { confirmation_manual?: boolean } | null)?.confirmation_manual,
    resident_manual: !!(existing as { resident_manual?: boolean } | null)?.resident_manual,
    departure_manual: !!(existing as { departure_manual?: boolean } | null)?.departure_manual,
    pickup_manual: !!(existing as { pickup_manual?: boolean } | null)?.pickup_manual,
    cancel_follow_up_manual: !!(existing as { cancel_follow_up_manual?: boolean } | null)
      ?.cancel_follow_up_manual,
    cancel_rebooking_outreach_manual: !!(existing as {
      cancel_rebooking_outreach_manual?: boolean
    } | null)?.cancel_rebooking_outreach_manual,
    pending_alt_tour_notice_manual: !!(existing as {
      pending_alt_tour_notice_manual?: boolean
    } | null)?.pending_alt_tour_notice_manual,
    pending_resolution_kind:
      (existing as { pending_resolution_kind?: string | null } | null)?.pending_resolution_kind ??
      null,
  }
  base[col as 'cancel_follow_up_manual' | 'cancel_rebooking_outreach_manual'] = action === 'mark'

  const anyTrue =
    Object.entries(base).some(([key, value]) => {
      if (key === 'pending_resolution_kind') return Boolean(String(value ?? '').trim())
      return Boolean(value)
    })

  if (!anyTrue) {
    if (existing) {
      const { error } = await supabase
        .from('reservation_follow_up_pipeline_manual')
        .delete()
        .eq('reservation_id', reservationId)
      if (error) throw error
    }
  } else {
    const { error } = await supabase.from('reservation_follow_up_pipeline_manual').upsert(
      {
        reservation_id: reservationId,
        ...base,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'reservation_id' }
    )
    if (error) throw error
  }

  return {
    cancelFollowUpManual: base.cancel_follow_up_manual,
    cancelRebookingOutreachManual: base.cancel_rebooking_outreach_manual,
  }
}
