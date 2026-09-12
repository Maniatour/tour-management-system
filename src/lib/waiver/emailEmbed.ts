import { getAppOrigin } from '@/lib/appOrigin'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { isSampleReservationId, type WaiverEmailCta, type WaiverEmailCtaMode } from '@/lib/waiver/emailCtaHtml'
import { resolveRequiredWaivers, signingRequiredCodes } from '@/lib/waiver/requiredWaivers'
import { ensureInvitationForReservation } from '@/lib/waiver/service'

function previewWaiverUrl(): string {
  return `${getAppOrigin()}/waiver/preview`
}

export async function isReservationWaiverComplete(reservationId: string): Promise<boolean> {
  if (!supabaseAdmin || isSampleReservationId(reservationId)) return false

  const { data: reservation } = await fromUntypedTable(supabaseAdmin, 'reservations')
    .select('id, product_id, canyon_choice, total_people')
    .eq('id', reservationId)
    .maybeSingle()
  if (!reservation) return false

  let tags: string[] | null = null
  let name: string | null = null
  let productRequired: string[] = []
  if (reservation.product_id) {
    const [{ data: mapped }, { data: product }] = await Promise.all([
      fromUntypedTable(supabaseAdmin, 'product_required_waivers')
        .select('document_code')
        .eq('product_id', reservation.product_id),
      fromUntypedTable(supabaseAdmin, 'products')
        .select('name, name_en, name_ko, customer_name_en, tags')
        .eq('id', reservation.product_id)
        .maybeSingle(),
    ])
    productRequired = (mapped ?? []).map((r: { document_code: string }) => r.document_code)
    tags = product?.tags ?? null
    name = product?.customer_name_en || product?.name_en || product?.name || product?.name_ko || null
  }

  const signing = signingRequiredCodes(
    resolveRequiredWaivers({
      productRequiredCodes: productRequired,
      canyonChoice: reservation.canyon_choice,
      productTags: tags,
      productName: name,
    })
  )
  if (signing.length === 0) return true

  const [{ data: participants }, { data: acceptances }] = await Promise.all([
    fromUntypedTable(supabaseAdmin, 'waiver_participants')
      .select('id')
      .eq('reservation_id', reservationId),
    fromUntypedTable(supabaseAdmin, 'waiver_acceptances')
      .select('participant_id, document_code, status')
      .eq('reservation_id', reservationId)
      .eq('status', 'signed'),
  ])

  const signed = new Map<string, Set<string>>()
  for (const row of acceptances ?? []) {
    const set = signed.get(row.participant_id) ?? new Set<string>()
    set.add(row.document_code)
    signed.set(row.participant_id, set)
  }

  const people = participants ?? []
  const guestCount = people.length || Number(reservation.total_people ?? 0)
  if (guestCount <= 0) return false
  if (people.length === 0) return false

  const completeGuests = people.filter((p: { id: string }) => {
    const docs = signed.get(p.id) ?? new Set<string>()
    return signing.every((code) => docs.has(code))
  }).length

  return completeGuests >= guestCount
}

export async function resolveWaiverEmailCta(input: {
  reservationId: string
  mode: WaiverEmailCtaMode
  createdBy?: string | null
  previewPlaceholder?: boolean
}): Promise<WaiverEmailCta | null> {
  if (input.previewPlaceholder || isSampleReservationId(input.reservationId)) {
    return { url: previewWaiverUrl(), mode: input.mode }
  }

  try {
    const complete = await isReservationWaiverComplete(input.reservationId)
    if (complete) return null

    const minted = await ensureInvitationForReservation(input.reservationId, input.createdBy ?? null)
    if (!minted?.url) return null
    return { url: minted.url, mode: input.mode }
  } catch (error) {
    console.warn('[waiver email embed] skipped:', error)
    return null
  }
}

export async function markWaiverInvitationSent(input: {
  reservationId: string
  via: 'departure_email' | 'pickup_email'
  actorId?: string | null
}): Promise<void> {
  if (!supabaseAdmin || isSampleReservationId(input.reservationId)) return
  const sentAt = new Date().toISOString()
  await fromUntypedTable(supabaseAdmin, 'waiver_invitations')
    .update({ last_sent_at: sentAt, last_sent_via: input.via })
    .eq('reservation_id', input.reservationId)
    .eq('status', 'active')
  await fromUntypedTable(supabaseAdmin, 'waiver_audit_events').insert({
    reservation_id: input.reservationId,
    event_type: 'INVITATION_SENT',
    actor_type: input.actorId ? 'staff' : 'system',
    actor_id: input.actorId ?? null,
    metadata: { via: input.via },
  })
}
