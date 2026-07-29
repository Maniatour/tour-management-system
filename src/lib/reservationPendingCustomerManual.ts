import type { SupabaseClient } from '@supabase/supabase-js'
import type { PendingCustomerResolutionKind } from '@/lib/pendingCustomerManagementWorkflow'

type PipelineManualRow = {
  confirmation_manual?: boolean
  resident_manual?: boolean
  departure_manual?: boolean
  pickup_manual?: boolean
  cancel_follow_up_manual?: boolean
  cancel_rebooking_outreach_manual?: boolean
  pending_alt_tour_notice_manual?: boolean
  pending_resolution_kind?: string | null
}

const PIPELINE_MANUAL_SELECT =
  'confirmation_manual, resident_manual, departure_manual, pickup_manual, cancel_follow_up_manual, cancel_rebooking_outreach_manual, pending_alt_tour_notice_manual, pending_resolution_kind'

function readPipelineBase(existing: PipelineManualRow | null | undefined) {
  return {
    confirmation_manual: !!existing?.confirmation_manual,
    resident_manual: !!existing?.resident_manual,
    departure_manual: !!existing?.departure_manual,
    pickup_manual: !!existing?.pickup_manual,
    cancel_follow_up_manual: !!existing?.cancel_follow_up_manual,
    cancel_rebooking_outreach_manual: !!existing?.cancel_rebooking_outreach_manual,
    pending_alt_tour_notice_manual: !!existing?.pending_alt_tour_notice_manual,
    pending_resolution_kind: existing?.pending_resolution_kind ?? null,
  }
}

function pipelineHasAnyFlag(base: ReturnType<typeof readPipelineBase>): boolean {
  return (
    base.confirmation_manual ||
    base.resident_manual ||
    base.departure_manual ||
    base.pickup_manual ||
    base.cancel_follow_up_manual ||
    base.cancel_rebooking_outreach_manual ||
    base.pending_alt_tour_notice_manual ||
    Boolean(String(base.pending_resolution_kind ?? '').trim())
  )
}

async function persistPipelineManual(
  supabase: SupabaseClient,
  reservationId: string,
  existing: PipelineManualRow | null | undefined,
  base: ReturnType<typeof readPipelineBase>
) {
  if (!pipelineHasAnyFlag(base)) {
    if (existing) {
      const { error } = await supabase
        .from('reservation_follow_up_pipeline_manual')
        .delete()
        .eq('reservation_id', reservationId)
      if (error) throw error
    }
    return
  }

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

export async function upsertReservationPendingAltTourNoticeManual(
  supabase: SupabaseClient,
  reservationId: string,
  action: 'mark' | 'clear'
): Promise<{ altTourNoticeManual: boolean; resolutionKind: string | null } | null> {
  const { data: existing, error: selErr } = await supabase
    .from('reservation_follow_up_pipeline_manual')
    .select(PIPELINE_MANUAL_SELECT)
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (selErr) throw selErr

  const base = readPipelineBase(existing as PipelineManualRow | null)
  base.pending_alt_tour_notice_manual = action === 'mark'

  await persistPipelineManual(supabase, reservationId, existing as PipelineManualRow | null, base)

  return {
    altTourNoticeManual: base.pending_alt_tour_notice_manual,
    resolutionKind: base.pending_resolution_kind,
  }
}

export async function upsertReservationPendingCustomerResolution(
  supabase: SupabaseClient,
  reservationId: string,
  kind: PendingCustomerResolutionKind,
  action: 'mark' | 'clear'
): Promise<{ altTourNoticeManual: boolean; resolutionKind: string | null } | null> {
  const { data: existing, error: selErr } = await supabase
    .from('reservation_follow_up_pipeline_manual')
    .select(PIPELINE_MANUAL_SELECT)
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (selErr) throw selErr

  const base = readPipelineBase(existing as PipelineManualRow | null)
  base.pending_resolution_kind = action === 'mark' ? kind : null

  await persistPipelineManual(supabase, reservationId, existing as PipelineManualRow | null, base)

  return {
    altTourNoticeManual: base.pending_alt_tour_notice_manual,
    resolutionKind: base.pending_resolution_kind,
  }
}
