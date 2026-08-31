import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { parseWaiverSnapshot } from '@/lib/waiver/snapshot'
import { ANTELOPE_CANYON_X_WAIVER_EN } from '@/lib/waiver/documents/antelopeCanyonX/en'
import { resolveRequiredWaivers, signingRequiredCodes } from '@/lib/waiver/requiredWaivers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })

  const reservationId = request.nextUrl.searchParams.get('reservationId')?.trim()
  if (!reservationId) return NextResponse.json({ error: 'reservationId required' }, { status: 400 })

  const { data: reservation } = await fromUntypedTable(supabaseAdmin, 'reservations')
    .select('id, channel_rn, tour_date, tour_time, product_id, canyon_choice, tour_id, adults, child, infant, total_people')
    .eq('id', reservationId)
    .maybeSingle()
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: product } = reservation.product_id
    ? await fromUntypedTable(supabaseAdmin, 'products')
        .select('id, name, name_en, customer_name_en, tags')
        .eq('id', reservation.product_id)
        .maybeSingle()
    : { data: null }

  const { data: mapped } = reservation.product_id
    ? await fromUntypedTable(supabaseAdmin, 'product_required_waivers')
        .select('document_code')
        .eq('product_id', reservation.product_id)
    : { data: [] }
  const required = resolveRequiredWaivers({
    productRequiredCodes: (mapped ?? []).map((r: { document_code: string }) => r.document_code),
    canyonChoice: reservation.canyon_choice,
    productTags: product?.tags ?? null,
    productName: product?.customer_name_en || product?.name_en || product?.name || null,
  })
  const signingCodes = signingRequiredCodes(required)

  const { data: participants } = await fromUntypedTable(supabaseAdmin, 'waiver_participants')
    .select('id, slot_index, full_legal_name, placeholder_label, participant_type, date_of_birth')
    .eq('reservation_id', reservationId)
    .order('slot_index')

  const { data: acceptances } = await fromUntypedTable(supabaseAdmin, 'waiver_acceptances')
    .select(
      'id, public_waiver_id, participant_id, document_code, waiver_version, selected_language, signed_at, signature_id, participant_full_legal_name, participant_type, governing_text_snapshot, displayed_translation_snapshot, status'
    )
    .eq('reservation_id', reservationId)
    .eq('status', 'signed')

  const { data: submissions } = await fromUntypedTable(supabaseAdmin, 'waiver_submissions')
    .select('id')
    .eq('reservation_id', reservationId)
  const submissionIds = (submissions ?? []).map((s: { id: string }) => s.id)

  const { data: guardians } = submissionIds.length
    ? await fromUntypedTable(supabaseAdmin, 'waiver_guardian_authorizations')
        .select('guardian_full_legal_name, relationship_to_minor, signature_id, minor_participant_ids, submission_id')
        .in('submission_id', submissionIds)
    : { data: [] }

  const sigIds = [...new Set((acceptances ?? []).map((a: { signature_id: string }) => a.signature_id))]
  const { data: signatures } = sigIds.length
    ? await fromUntypedTable(supabaseAdmin, 'waiver_signatures').select('id, storage_key').in('id', sigIds)
    : { data: [] }

  const signatureUrls: Record<string, string> = {}
  for (const sig of signatures ?? []) {
    const { data } = await supabaseAdmin.storage.from('waiver-signatures').createSignedUrl(sig.storage_key, 60 * 30)
    if (data?.signedUrl) signatureUrls[sig.id] = data.signedUrl
  }

  let canyonTime: string | null = reservation.tour_time
  const { data: tickets } = await fromUntypedTable(supabaseAdmin, 'ticket_bookings')
    .select('time, company, category, check_in_date')
    .eq('reservation_id', reservationId)
  const canyonTicket = (tickets ?? []).find((t: { company?: string | null; category?: string | null }) =>
    /antelope|taadidiin|canyon\s*x/i.test(`${t.company ?? ''} ${t.category ?? ''}`)
  )
  if (canyonTicket?.time) canyonTime = canyonTicket.time

  let guideName: string | null = null
  let guidePhone: string | null = null
  if (reservation.tour_id) {
    const { data: tour } = await fromUntypedTable(supabaseAdmin, 'tours')
      .select('tour_guide_id')
      .eq('id', reservation.tour_id)
      .maybeSingle()
    const email = String(tour?.tour_guide_id ?? '').split(/[,\s]+/)[0]?.trim()
    if (email) {
      const { data: member } = await fromUntypedTable(supabaseAdmin, 'team')
        .select('name_en, name_ko, phone, email')
        .ilike('email', email)
        .maybeSingle()
      guideName = member?.name_en || member?.name_ko || email
      guidePhone = member?.phone ?? null
    }
  }

  const { data: guideSig } = await fromUntypedTable(supabaseAdmin, 'waiver_guide_signatures')
    .select('guide_name, guide_phone, signature_id, signed_at')
    .eq('reservation_id', reservationId)
    .eq('document_code', 'ANTELOPE_CANYON_X')
    .maybeSingle()

  let guideSignatureUrl: string | null = null
  if (guideSig?.signature_id) {
    const { data: gsig } = await fromUntypedTable(supabaseAdmin, 'waiver_signatures')
      .select('storage_key')
      .eq('id', guideSig.signature_id)
      .maybeSingle()
    if (gsig?.storage_key) {
      const { data } = await supabaseAdmin.storage.from('waiver-signatures').createSignedUrl(gsig.storage_key, 60 * 30)
      guideSignatureUrl = data?.signedUrl ?? null
    }
  }

  const adultCount = (participants ?? []).filter((p: { participant_type: string | null }) => p.participant_type !== 'MINOR').length
  const minorCount = (participants ?? []).filter((p: { participant_type: string | null }) => p.participant_type === 'MINOR').length

  return NextResponse.json({
    bookingNumber: (reservation.channel_rn || '').trim() || reservation.id,
    tourDate: reservation.tour_date,
    tourName: product?.customer_name_en || product?.name_en || product?.name || 'Tour',
    canyonTime,
    companyName: 'LAS VEGAS MANIA TOUR',
    adultCount,
    minorCount,
    guideName: guideSig?.guide_name || guideName,
    guidePhone: guideSig?.guide_phone || guidePhone,
    guideSignatureUrl,
    guideSignatureRequired: !guideSignatureUrl,
    canyonXEnglish: ANTELOPE_CANYON_X_WAIVER_EN,
    required: signingCodes,
    generatedAt: new Date().toISOString(),
    participants: (participants ?? []).map((p: {
      id: string
      full_legal_name: string | null
      placeholder_label: string
      participant_type: string | null
      date_of_birth: string | null
    }) => {
      const mania = (acceptances ?? []).find(
        (a: { participant_id: string; document_code: string }) =>
          a.participant_id === p.id && a.document_code === 'LAS_VEGAS_MANIA'
      )
      const canyon = (acceptances ?? []).find(
        (a: { participant_id: string; document_code: string }) =>
          a.participant_id === p.id && a.document_code === 'ANTELOPE_CANYON_X'
      )
      const guardian = (guardians ?? []).find((g: { minor_participant_ids: string[] }) =>
        (g.minor_participant_ids ?? []).includes(p.id)
      )
      const age =
        p.date_of_birth && reservation.tour_date
          ? Math.floor(
              (new Date(`${reservation.tour_date}T00:00:00Z`).getTime() -
                new Date(`${p.date_of_birth}T00:00:00Z`).getTime()) /
                (365.25 * 24 * 3600 * 1000)
            )
          : null
      return {
        id: p.id,
        name: p.full_legal_name || p.placeholder_label,
        type: p.participant_type,
        age,
        mania: mania
          ? {
              waiverId: mania.public_waiver_id,
              version: mania.waiver_version,
              language: mania.selected_language,
              signedAt: mania.signed_at,
              signatureUrl: signatureUrls[mania.signature_id] ?? null,
              snapshot: parseWaiverSnapshot(mania.governing_text_snapshot),
              translation: parseWaiverSnapshot(mania.displayed_translation_snapshot),
            }
          : null,
        canyonX: canyon
          ? {
              waiverId: canyon.public_waiver_id,
              version: canyon.waiver_version,
              language: canyon.selected_language,
              signedAt: canyon.signed_at,
              signatureUrl: signatureUrls[canyon.signature_id] ?? null,
            }
          : null,
        guardianName: guardian?.guardian_full_legal_name ?? null,
        guardianSignatureUrl: guardian?.signature_id ? signatureUrls[guardian.signature_id] ?? null : null,
      }
    }),
  })
}
