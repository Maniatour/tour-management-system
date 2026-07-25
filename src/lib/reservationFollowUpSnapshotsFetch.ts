import { supabase } from '@/lib/supabase'
import { emailLogStatusSuccess } from '@/lib/reservationFollowUpPipeline'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const CHUNK = 100
const WAVE = 2

export type FollowUpManualFlags = {
  confirmation_manual: boolean
  resident_manual: boolean
  departure_manual: boolean
  pickup_manual: boolean
  cancel_follow_up_manual: boolean
  cancel_rebooking_outreach_manual: boolean
}

export type FollowUpSnapshotFetchResult = {
  confirmationSent: Set<string>
  residentInquirySent: Set<string>
  departureSent: Set<string>
  pickupSent: Set<string>
  guestDone: Set<string>
  manualByReservationId: Map<string, FollowUpManualFlags>
}

async function fetchFollowUpChunk(part: string[]): Promise<FollowUpSnapshotFetchResult> {
  const confirmationSent = new Set<string>()
  const residentInquirySent = new Set<string>()
  const departureSent = new Set<string>()
  const pickupSent = new Set<string>()
  const guestDone = new Set<string>()
  const manualByReservationId = new Map<string, FollowUpManualFlags>()

  const [logsResult, manualResult, tokensResult] = await Promise.all([
    supabase.from('email_logs').select('reservation_id,email_type,status').in('reservation_id', part),
    supabase
      .from('reservation_follow_up_pipeline_manual')
      .select(
        'reservation_id, confirmation_manual, resident_manual, departure_manual, pickup_manual, cancel_follow_up_manual, cancel_rebooking_outreach_manual'
      )
      .in('reservation_id', part),
    supabase.from('resident_check_tokens').select('id,reservation_id,completed_at').in('reservation_id', part),
  ])

  if (logsResult.error) throw logsResult.error
  if (manualResult.error) throw manualResult.error
  if (tokensResult.error) throw tokensResult.error

  for (const row of logsResult.data || []) {
    const rid = String((row as { reservation_id?: string }).reservation_id ?? '')
    if (!rid || !emailLogStatusSuccess((row as { status?: string }).status)) continue
    const t = String((row as { email_type?: string }).email_type ?? '')
    if (t === 'confirmation') confirmationSent.add(rid)
    if (t === 'resident_inquiry') residentInquirySent.add(rid)
    if (t === 'departure') departureSent.add(rid)
    if (t === 'pickup') pickupSent.add(rid)
  }

  for (const row of manualResult.data || []) {
    const rid = String((row as { reservation_id?: string }).reservation_id ?? '')
    if (!rid) continue
    manualByReservationId.set(rid, {
      confirmation_manual: !!(row as { confirmation_manual?: boolean }).confirmation_manual,
      resident_manual: !!(row as { resident_manual?: boolean }).resident_manual,
      departure_manual: !!(row as { departure_manual?: boolean }).departure_manual,
      pickup_manual: !!(row as { pickup_manual?: boolean }).pickup_manual,
      cancel_follow_up_manual: !!(row as { cancel_follow_up_manual?: boolean }).cancel_follow_up_manual,
      cancel_rebooking_outreach_manual: !!(row as { cancel_rebooking_outreach_manual?: boolean })
        .cancel_rebooking_outreach_manual,
    })
  }

  const tokenRows = (tokensResult.data || []) as Array<{
    id: string
    reservation_id: string
    completed_at: string | null
  }>
  const tokenIds = tokenRows.map((t) => t.id).filter(Boolean)
  const agreedTokenIds = new Set<string>()
  if (tokenIds.length > 0) {
    for (const tp of chunk(tokenIds, CHUNK)) {
      const { data: subs, error: subErr } = await supabase
        .from('resident_check_submissions')
        .select('token_id, agreed')
        .in('token_id', tp)
      if (subErr) throw subErr
      for (const s of subs || []) {
        const row = s as { token_id?: string; agreed?: boolean }
        if (row.agreed && row.token_id) agreedTokenIds.add(row.token_id)
      }
    }
  }
  for (const t of tokenRows) {
    const rid = t.reservation_id
    if (t.completed_at) guestDone.add(rid)
    else if (agreedTokenIds.has(t.id)) guestDone.add(rid)
  }

  return {
    confirmationSent,
    residentInquirySent,
    departureSent,
    pickupSent,
    guestDone,
    manualByReservationId,
  }
}

function mergeFetchResults(target: FollowUpSnapshotFetchResult, part: FollowUpSnapshotFetchResult) {
  for (const id of part.confirmationSent) target.confirmationSent.add(id)
  for (const id of part.residentInquirySent) target.residentInquirySent.add(id)
  for (const id of part.departureSent) target.departureSent.add(id)
  for (const id of part.pickupSent) target.pickupSent.add(id)
  for (const id of part.guestDone) target.guestDone.add(id)
  part.manualByReservationId.forEach((v, k) => target.manualByReservationId.set(k, v))
}

/** 예약 id별 Follow-up 파이프라인 원시 데이터 — 청크당 email·manual·token 병렬 조회 */
export async function fetchFollowUpSnapshotDataForReservationIds(
  ids: string[],
  shouldAbort?: () => boolean
): Promise<FollowUpSnapshotFetchResult> {
  const unique = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))]
  const merged: FollowUpSnapshotFetchResult = {
    confirmationSent: new Set(),
    residentInquirySent: new Set(),
    departureSent: new Set(),
    pickupSent: new Set(),
    guestDone: new Set(),
    manualByReservationId: new Map(),
  }
  if (unique.length === 0) return merged

  const parts = chunk(unique, CHUNK)
  for (let i = 0; i < parts.length; i += WAVE) {
    if (shouldAbort?.()) break
    const wave = parts.slice(i, i + WAVE)
    const results = await Promise.all(wave.map((part) => fetchFollowUpChunk(part)))
    for (const r of results) mergeFetchResults(merged, r)
  }
  return merged
}
