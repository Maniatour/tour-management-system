import { randomBytes } from 'crypto'
import { getAppOrigin } from '@/lib/appOrigin'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { WAIVER_DOCUMENT_CATALOG, getGoverningWaiverContent } from '@/lib/waiver/documents/catalog'
import { getLiveGoverningWaiverContent, getLiveWaiverContent, loadAllDocumentStatusMap } from '@/lib/waiver/liveContent'
import { hashWaiverContent } from '@/lib/waiver/hash'
import { serializeWaiverSnapshot } from '@/lib/waiver/snapshot'
import { generateWaiverRawToken, hashWaiverToken } from '@/lib/waiver/tokens'
import { resolveRequiredWaivers, signingRequiredCodes } from '@/lib/waiver/requiredWaivers'
import type { RequiredWaiverResolution, WaiverDocumentCode, WaiverLocale } from '@/lib/waiver/types'
import { isMinorAgeOnTourDate, parsePngBase64, submitWaiverSchema } from '@/lib/waiver/validation'

export type PublicParticipantSummary = {
  id: string
  slotIndex: number
  label: string
  type: 'ADULT' | 'MINOR' | null
  signed: boolean
  completedCount: number
  requiredCount: number
}

export type PublicWaiverSession = {
  reservationId: string
  bookingNumber: string
  tourDate: string
  tourName: string
  guestCount: number
  requiredWaivers: RequiredWaiverResolution[]
  participants: PublicParticipantSummary[]
  completedCount: number
  requiredCount: number
}

function db() {
  if (!supabaseAdmin) throw new Error('Server not configured')
  return supabaseAdmin
}

async function audit(event: {
  reservationId?: string | null
  participantId?: string | null
  invitationId?: string | null
  acceptanceId?: string | null
  eventType: string
  metadata?: Record<string, unknown>
  actorType?: string
  actorId?: string | null
}) {
  await fromUntypedTable(db(), 'waiver_audit_events').insert({
    reservation_id: event.reservationId ?? null,
    participant_id: event.participantId ?? null,
    invitation_id: event.invitationId ?? null,
    acceptance_id: event.acceptanceId ?? null,
    event_type: event.eventType,
    metadata: event.metadata ?? {},
    actor_type: event.actorType ?? 'system',
    actor_id: event.actorId ?? null,
  })
}

export async function ensureCurrentWaiverVersions(): Promise<void> {
  for (const def of Object.values(WAIVER_DOCUMENT_CATALOG)) {
    if (def.status !== 'ACTIVE' || !def.currentVersion) continue
    const governing = getGoverningWaiverContent(def.code)
    if (!governing) continue
    const { data: anyRow } = await fromUntypedTable(db(), 'waiver_document_versions')
      .select('id')
      .eq('document_code', def.code)
      .limit(1)
      .maybeSingle()
    // Do not demote staff-published versions back to the code catalog.
    if (anyRow) continue
    const translations: Record<string, unknown> = {}
    for (const locale of Object.keys(def.contents)) {
      const content = def.contents[locale as WaiverLocale]
      if (content) translations[locale] = content
    }
    await fromUntypedTable(db(), 'waiver_document_versions').insert({
      document_code: def.code,
      version: def.currentVersion,
      effective_date: '2026-08-30',
      governing_text: serializeWaiverSnapshot(governing),
      governing_text_hash: hashWaiverContent(governing),
      translations,
      is_current: true,
    })
  }
}

function guestCountFromReservation(row: {
  total_people?: number | null
  adults?: number | null
  child?: number | null
  infant?: number | null
}): number {
  const total = Number(row.total_people ?? 0)
  if (total > 0) return total
  return Math.max(1, Number(row.adults ?? 0) + Number(row.child ?? 0) + Number(row.infant ?? 0))
}

function bookingNumberOf(row: { id: string; channel_rn?: string | null }): string {
  return (row.channel_rn || '').trim() || row.id
}

export async function ensureInvitationForReservation(reservationId: string, createdBy?: string | null) {
  await ensureCurrentWaiverVersions()
  const { data: reservation, error } = await fromUntypedTable(db(), 'reservations')
    .select('id, channel_rn, tour_date, product_id, canyon_choice, total_people, adults, child, infant, operator_id, customer_id')
    .eq('id', reservationId)
    .maybeSingle()
  if (error || !reservation) return null

  const { data: existing } = await fromUntypedTable(db(), 'waiver_invitations')
    .select('id, token_hash, status')
    .eq('reservation_id', reservationId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let invitationId = existing?.id as string | undefined
  let rawToken: string | null = null
  if (!invitationId) {
    rawToken = generateWaiverRawToken()
    const { data: inserted, error: insErr } = await fromUntypedTable(db(), 'waiver_invitations')
      .insert({
        reservation_id: reservationId,
        operator_id: reservation.operator_id ?? null,
        token_hash: hashWaiverToken(rawToken),
        status: 'active',
        created_by: createdBy ?? null,
      })
      .select('id')
      .single()
    if (insErr || !inserted) return null
    invitationId = inserted.id
    await audit({
      reservationId,
      invitationId: invitationId ?? null,
      eventType: 'INVITATION_CREATED',
      actorType: createdBy ? 'staff' : 'system',
      actorId: createdBy ?? null,
    })
  }

  await ensureParticipants(reservationId, invitationId!, guestCountFromReservation(reservation), reservation.customer_id)
  const url = rawToken ? `${getAppOrigin()}/waiver/${rawToken}` : null
  return { invitationId: invitationId!, rawToken, url }
}

async function ensureParticipants(
  reservationId: string,
  invitationId: string,
  guestCount: number,
  customerId: string | null
) {
  const { data: existing } = await fromUntypedTable(db(), 'waiver_participants')
    .select('id, slot_index')
    .eq('reservation_id', reservationId)
  const have = new Set((existing ?? []).map((r: { slot_index: number }) => r.slot_index))

  let primaryName: string | null = null
  if (customerId) {
    const { data: customer } = await fromUntypedTable(db(), 'customers')
      .select('name')
      .eq('id', customerId)
      .maybeSingle()
    primaryName = (customer?.name || '').trim() || null
  }

  const inserts = []
  for (let i = 0; i < guestCount; i += 1) {
    if (have.has(i)) continue
    inserts.push({
      reservation_id: reservationId,
      invitation_id: invitationId,
      slot_index: i,
      placeholder_label: i === 0 && primaryName ? primaryName : `Guest ${i + 1}`,
    })
  }
  if (inserts.length) {
    await fromUntypedTable(db(), 'waiver_participants').insert(inserts)
    await audit({ reservationId, invitationId, eventType: 'WAIVER_CREATED', metadata: { slots: inserts.length } })
  }
}

export async function getInvitationByRawToken(rawToken: string) {
  const tokenHash = hashWaiverToken(rawToken)
  const { data: invitation } = await fromUntypedTable(db(), 'waiver_invitations')
    .select('id, reservation_id, status, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (!invitation || invitation.status !== 'active') return null
  if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) return null
  return invitation as { id: string; reservation_id: string; status: string; expires_at: string | null }
}

async function loadRequiredForReservation(reservation: {
  product_id: string | null
  canyon_choice: string | null
}): Promise<RequiredWaiverResolution[]> {
  let productRequired: string[] = []
  let tags: string[] | null = null
  let name: string | null = null
  if (reservation.product_id) {
    const { data: mapped } = await fromUntypedTable(db(), 'product_required_waivers')
      .select('document_code')
      .eq('product_id', reservation.product_id)
    productRequired = (mapped ?? []).map((r: { document_code: string }) => r.document_code)
    const { data: product } = await fromUntypedTable(db(), 'products')
      .select('name, name_en, name_ko, customer_name_en, tags')
      .eq('id', reservation.product_id)
      .maybeSingle()
    tags = product?.tags ?? null
    name = product?.customer_name_en || product?.name_en || product?.name || product?.name_ko || null
  }
  const resolved = resolveRequiredWaivers({
    productRequiredCodes: productRequired,
    canyonChoice: reservation.canyon_choice,
    productTags: tags,
    productName: name,
  })
  const statusMap = await loadAllDocumentStatusMap()
  return resolved.map((row) => {
    const live = statusMap.get(row.code)
    if (!live) return row
    return {
      ...row,
      status: live.status,
      signatureMode: live.signatureMode,
      requiredForSigning: live.status === 'ACTIVE',
    }
  })
}

export async function buildPublicSession(invitation: {
  id: string
  reservation_id: string
}): Promise<PublicWaiverSession | null> {
  const { data: reservation } = await fromUntypedTable(db(), 'reservations')
    .select('id, channel_rn, tour_date, product_id, canyon_choice, total_people, adults, child, infant, customer_id')
    .eq('id', invitation.reservation_id)
    .maybeSingle()
  if (!reservation) return null

  const required = await loadRequiredForReservation(reservation)
  const signingCodes = signingRequiredCodes(required)
  await ensureParticipants(
    reservation.id,
    invitation.id,
    guestCountFromReservation(reservation),
    reservation.customer_id
  )

  const { data: participants } = await fromUntypedTable(db(), 'waiver_participants')
    .select('id, slot_index, placeholder_label, participant_type, full_legal_name, identity_locked')
    .eq('reservation_id', reservation.id)
    .order('slot_index')

  const { data: acceptances } = await fromUntypedTable(db(), 'waiver_acceptances')
    .select('participant_id, document_code, status')
    .eq('reservation_id', reservation.id)
    .eq('status', 'signed')

  const signedMap = new Map<string, Set<string>>()
  for (const row of acceptances ?? []) {
    const set = signedMap.get(row.participant_id) ?? new Set<string>()
    set.add(row.document_code)
    signedMap.set(row.participant_id, set)
  }

  const summaries: PublicParticipantSummary[] = (participants ?? []).map(
    (p: {
      id: string
      slot_index: number
      placeholder_label: string
      participant_type: 'ADULT' | 'MINOR' | null
      full_legal_name: string | null
    }) => {
      const signedDocs = signedMap.get(p.id) ?? new Set<string>()
      const completedCount = signingCodes.filter((code) => signedDocs.has(code)).length
      return {
        id: p.id,
        slotIndex: p.slot_index,
        label: p.full_legal_name?.trim() || p.placeholder_label,
        type: p.participant_type,
        signed: completedCount >= signingCodes.length && signingCodes.length > 0,
        completedCount,
        requiredCount: signingCodes.length,
      }
    }
  )

  let tourName = 'Tour'
  if (reservation.product_id) {
    const { data: product } = await fromUntypedTable(db(), 'products')
      .select('customer_name_en, name_en, name, name_ko')
      .eq('id', reservation.product_id)
      .maybeSingle()
    tourName = product?.customer_name_en || product?.name_en || product?.name || product?.name_ko || 'Tour'
  }

  const completedCount = summaries.filter((p) => p.signed).length
  return {
    reservationId: reservation.id,
    bookingNumber: bookingNumberOf(reservation),
    tourDate: reservation.tour_date,
    tourName,
    guestCount: summaries.length,
    requiredWaivers: required,
    participants: summaries,
    completedCount,
    requiredCount: summaries.length,
  }
}

export async function loadParticipantForToken(invitationId: string, participantId: string) {
  const { data } = await fromUntypedTable(db(), 'waiver_participants')
    .select(
      'id, reservation_id, invitation_id, slot_index, placeholder_label, participant_type, full_legal_name, date_of_birth, email, phone, emergency_contact_name, emergency_contact_phone, identity_locked'
    )
    .eq('id', participantId)
    .eq('invitation_id', invitationId)
    .maybeSingle()
  return data
}

export function publicParticipantSafeFields(row: {
  id: string
  slot_index: number
  placeholder_label: string
  participant_type: string | null
  full_legal_name: string | null
  identity_locked: boolean
  date_of_birth?: string | null
  email?: string | null
  phone?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
}, self: boolean) {
  const base = {
    id: row.id,
    slotIndex: row.slot_index,
    label: row.full_legal_name?.trim() || row.placeholder_label,
    type: row.participant_type,
    identityLocked: row.identity_locked,
  }
  if (!self) return base
  return {
    ...base,
    fullLegalName: row.identity_locked ? row.full_legal_name : '',
    dateOfBirth: row.identity_locked ? row.date_of_birth : '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    emergencyContactName: row.emergency_contact_name ?? '',
    emergencyContactPhone: row.emergency_contact_phone ?? '',
  }
}

export async function submitSignedWaiver(input: {
  invitationId: string
  reservationId: string
  body: unknown
  ip: string | null
  userAgent: string | null
}) {
  const parsed = submitWaiverSchema.safeParse(input.body)
  if (!parsed.success) {
    return { ok: false as const, status: 400, error: 'Invalid submission' }
  }
  const payload = parsed.data
  const png = parsePngBase64(payload.signaturePngBase64)
  if (!png) return { ok: false as const, status: 400, error: 'Signature required' }

  const participant = await loadParticipantForToken(input.invitationId, payload.participantId)
  if (!participant || participant.reservation_id !== input.reservationId) {
    return { ok: false as const, status: 404, error: 'Participant not found' }
  }

  const { data: reservation } = await fromUntypedTable(db(), 'reservations')
    .select('id, tour_date, product_id, canyon_choice, channel_rn')
    .eq('id', input.reservationId)
    .maybeSingle()
  if (!reservation) return { ok: false as const, status: 404, error: 'Not found' }

  const required = await loadRequiredForReservation(reservation)
  const signingCodes = signingRequiredCodes(required)
  if (!signingCodes.length) return { ok: false as const, status: 409, error: 'No active waivers required' }

  for (const code of signingCodes) {
    if (!payload.documentAcceptances[code]) {
      return { ok: false as const, status: 400, error: 'Each required document must be accepted' }
    }
  }

  const inferredMinor = isMinorAgeOnTourDate(payload.identity.dateOfBirth, reservation.tour_date)
  const participantType = inferredMinor ? 'MINOR' : payload.identity.participantType
  if (participantType === 'MINOR') {
    if (!payload.acknowledgments.guardianAuthority) {
      return { ok: false as const, status: 400, error: 'Guardian acknowledgment required' }
    }
    if (!payload.guardian?.guardianFullLegalName) {
      return { ok: false as const, status: 400, error: 'Guardian information required' }
    }
  }

  if (participant.identity_locked) {
    const existingName = String(participant.full_legal_name ?? '').trim().toLowerCase()
    const nextName = payload.identity.fullLegalName.trim().toLowerCase()
    if (existingName && existingName !== nextName) {
      return { ok: false as const, status: 409, error: 'Signed identity cannot be changed' }
    }
  }

  const { data: existingSigned } = await fromUntypedTable(db(), 'waiver_acceptances')
    .select('id, document_code')
    .eq('participant_id', participant.id)
    .eq('status', 'signed')
  const already = new Set((existingSigned ?? []).map((r: { document_code: string }) => r.document_code))
  const remaining = signingCodes.filter((code) => !already.has(code))
  if (!remaining.length) {
    return { ok: false as const, status: 409, error: 'Already signed' }
  }

  const storageKey = `${input.reservationId}/${participant.id}/${randomBytes(16).toString('hex')}.png`
  const { error: upErr } = await db().storage.from('waiver-signatures').upload(storageKey, png, {
    contentType: 'image/png',
    upsert: false,
  })
  if (upErr) return { ok: false as const, status: 500, error: 'Could not store signature' }

  const { data: signatureRow, error: sigErr } = await fromUntypedTable(db(), 'waiver_signatures')
    .insert({ storage_key: storageKey })
    .select('id')
    .single()
  if (sigErr || !signatureRow) return { ok: false as const, status: 500, error: 'Could not record signature' }

  const signedAt = new Date().toISOString()
  const { data: submission, error: subErr } = await fromUntypedTable(db(), 'waiver_submissions')
    .insert({
      reservation_id: input.reservationId,
      participant_id: participant.id,
      invitation_id: input.invitationId,
      selected_language: payload.language,
      signature_id: signatureRow.id,
      signed_at: signedAt,
      ip_address: input.ip,
      user_agent: input.userAgent,
      status: 'completed',
    })
    .select('id')
    .single()
  if (subErr || !submission) return { ok: false as const, status: 500, error: 'Could not record submission' }

  await fromUntypedTable(db(), 'waiver_participants')
    .update({
      participant_type: participantType,
      full_legal_name: payload.identity.fullLegalName.trim(),
      date_of_birth: payload.identity.dateOfBirth,
      email: payload.identity.email || null,
      phone: payload.identity.phone || null,
      emergency_contact_name: payload.identity.emergencyContactName.trim(),
      emergency_contact_phone: payload.identity.emergencyContactPhone.trim(),
      identity_locked: true,
      updated_at: signedAt,
    })
    .eq('id', participant.id)

  if (participantType === 'MINOR' && payload.guardian) {
    await fromUntypedTable(db(), 'waiver_guardian_authorizations').insert({
      submission_id: submission.id,
      guardian_full_legal_name: payload.guardian.guardianFullLegalName.trim(),
      relationship_to_minor: payload.guardian.relationshipToMinor.trim(),
      signature_id: signatureRow.id,
      minor_participant_ids: payload.guardian.minorParticipantIds?.length
        ? payload.guardian.minorParticipantIds
        : [participant.id],
      acknowledgment_text:
        'I represent that I am the parent or legal guardian of the minor identified above and have authority to execute this Agreement on the minor\'s behalf to the extent permitted by applicable law.',
    })
  }

  const acceptanceIds: string[] = []
  for (const code of remaining) {
    const governing = await getLiveGoverningWaiverContent(code as WaiverDocumentCode)
    const displayed = await getLiveWaiverContent(code as WaiverDocumentCode, payload.language)
    if (!governing) continue
    const publicWaiverId = `WV-${randomBytes(6).toString('hex').toUpperCase()}`
    const { data: acceptance, error: accErr } = await fromUntypedTable(db(), 'waiver_acceptances')
      .insert({
        public_waiver_id: publicWaiverId,
        submission_id: submission.id,
        reservation_id: input.reservationId,
        participant_id: participant.id,
        participant_full_legal_name: payload.identity.fullLegalName.trim(),
        participant_type: participantType,
        document_code: code,
        operator_name:
          governing.operatorName || WAIVER_DOCUMENT_CATALOG[code as WaiverDocumentCode].operatorName,
        waiver_version: governing.version,
        waiver_text_hash: hashWaiverContent(governing),
        governing_text_snapshot: serializeWaiverSnapshot(governing),
        displayed_translation_snapshot:
          payload.language === 'en' || !displayed ? null : serializeWaiverSnapshot(displayed),
        selected_language: payload.language,
        signature_id: signatureRow.id,
        acknowledgments: payload.acknowledgments,
        accepted_at: signedAt,
        signed_at: signedAt,
        ip_address: input.ip,
        user_agent: input.userAgent,
        status: 'signed',
      })
      .select('id')
      .single()
    if (accErr) {
      if (String(accErr.message || '').includes('waiver_acceptances_one_active')) {
        return { ok: false as const, status: 409, error: 'Already signed' }
      }
      return { ok: false as const, status: 500, error: 'Could not record acceptance' }
    }
    if (acceptance) {
      acceptanceIds.push(acceptance.id)
      await audit({
        reservationId: input.reservationId,
        participantId: participant.id,
        invitationId: input.invitationId,
        acceptanceId: acceptance.id,
        eventType: 'DOCUMENT_ACCEPTED',
        actorType: 'customer',
        metadata: { documentCode: code, version: governing.version, language: payload.language },
      })
    }
  }

  await audit({
    reservationId: input.reservationId,
    participantId: participant.id,
    invitationId: input.invitationId,
    eventType: 'WAIVER_SIGNED',
    actorType: 'customer',
    metadata: { language: payload.language, documents: remaining },
  })

  return {
    ok: true as const,
    signedAt,
    participantName: payload.identity.fullLegalName.trim(),
    documents: remaining,
    acceptanceIds,
  }
}

export async function voidAcceptance(input: {
  acceptanceId: string
  reason: string
  staffEmail: string
}) {
  const reason = input.reason.trim()
  if (reason.length < 3) return { ok: false as const, error: 'Reason required' }
  const { data: row } = await fromUntypedTable(db(), 'waiver_acceptances')
    .select('id, reservation_id, participant_id, status')
    .eq('id', input.acceptanceId)
    .maybeSingle()
  if (!row || row.status !== 'signed') return { ok: false as const, error: 'Not found' }
  const { error } = await fromUntypedTable(db(), 'waiver_acceptances')
    .update({
      status: 'voided',
      void_reason: reason,
      voided_at: new Date().toISOString(),
      voided_by: input.staffEmail,
    })
    .eq('id', input.acceptanceId)
  if (error) return { ok: false as const, error: error.message }
  await audit({
    reservationId: row.reservation_id,
    participantId: row.participant_id,
    acceptanceId: row.id,
    eventType: 'WAIVER_VOIDED',
    actorType: 'staff',
    actorId: input.staffEmail,
    metadata: { reason },
  })
  return { ok: true as const }
}

export async function reissueParticipant(input: {
  participantId: string
  staffEmail: string
  reason?: string
}) {
  const { data: participant } = await fromUntypedTable(db(), 'waiver_participants')
    .select('id, reservation_id')
    .eq('id', input.participantId)
    .maybeSingle()
  if (!participant) return { ok: false as const, error: 'Not found' }
  const { data: signed } = await fromUntypedTable(db(), 'waiver_acceptances')
    .select('id')
    .eq('participant_id', input.participantId)
    .eq('status', 'signed')
  for (const row of signed ?? []) {
    await voidAcceptance({
      acceptanceId: row.id,
      reason: input.reason?.trim() || 'Reissued by staff',
      staffEmail: input.staffEmail,
    })
  }
  await fromUntypedTable(db(), 'waiver_participants')
    .update({ identity_locked: false, updated_at: new Date().toISOString() })
    .eq('id', input.participantId)
  await audit({
    reservationId: participant.reservation_id,
    participantId: participant.id,
    eventType: 'WAIVER_REISSUED',
    actorType: 'staff',
    actorId: input.staffEmail,
  })
  return { ok: true as const }
}
