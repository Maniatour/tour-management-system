import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { sendTwilioSms } from '@/lib/twilioClient'
import {
  ensureInvitationForReservation,
  reissueParticipant,
  voidAcceptance,
} from '@/lib/waiver/service'
import { signingRequiredCodes } from '@/lib/waiver/requiredWaivers'
import { resolveRequiredWaivers } from '@/lib/waiver/requiredWaivers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const tourDate = request.nextUrl.searchParams.get('tourDate')?.trim() ?? ''
  const today = request.nextUrl.searchParams.get('today') === '1'
  const reservationId = request.nextUrl.searchParams.get('reservationId')?.trim() ?? ''
  const batchIds = [
    ...new Set(
      (request.nextUrl.searchParams.get('ids') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ].slice(0, 80)
  const date = today
    ? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    : tourDate

  let reservationsQuery = fromUntypedTable(supabaseAdmin, 'reservations')
    .select('id, channel_rn, tour_date, product_id, canyon_choice, total_people, adults, child, infant, tour_id, status')
    .eq('archive', false)
    .limit(80)

  if (batchIds.length) reservationsQuery = reservationsQuery.in('id', batchIds)
  else if (reservationId) reservationsQuery = reservationsQuery.eq('id', reservationId)
  else if (date) reservationsQuery = reservationsQuery.eq('tour_date', date)
  if (q && !batchIds.length) {
    reservationsQuery = reservationsQuery.or(`id.ilike.%${q}%,channel_rn.ilike.%${q}%`)
  }

  const { data: reservations, error } = await reservationsQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (reservations ?? []).map((r: { id: string }) => r.id)
  const productIds = [...new Set((reservations ?? []).map((r: { product_id: string | null }) => r.product_id).filter(Boolean))] as string[]

  type ProductRow = {
    id: string
    name: string | null
    name_en: string | null
    name_ko: string | null
    customer_name_en: string | null
    tags: string[] | null
  }

  const emptyProducts = { data: [] as ProductRow[] }
  const [
    { data: products },
    { data: mapped },
    { data: participants },
    { data: acceptances },
  ] = await Promise.all([
    productIds.length
      ? fromUntypedTable(supabaseAdmin, 'products')
          .select('id, name, name_en, name_ko, customer_name_en, tags')
          .in('id', productIds)
      : Promise.resolve(emptyProducts),
    productIds.length
      ? fromUntypedTable(supabaseAdmin, 'product_required_waivers').select('product_id, document_code').in('product_id', productIds)
      : Promise.resolve({ data: [] as Array<{ product_id: string; document_code: string }> }),
    ids.length
      ? fromUntypedTable(supabaseAdmin, 'waiver_participants')
          .select('id, reservation_id, full_legal_name, placeholder_label, participant_type')
          .in('reservation_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? fromUntypedTable(supabaseAdmin, 'waiver_acceptances')
          .select('participant_id, reservation_id, document_code, status')
          .in('reservation_id', ids)
          .eq('status', 'signed')
      : Promise.resolve({ data: [] }),
  ])

  const productMap = new Map<string, ProductRow>(
    ((products ?? []) as ProductRow[]).map((p) => [p.id, p])
  )

  const requiredByProduct = new Map<string, string[]>()
  for (const row of mapped ?? []) {
    const list = requiredByProduct.get(row.product_id) ?? []
    list.push(row.document_code)
    requiredByProduct.set(row.product_id, list)
  }

  const signed = new Map<string, Set<string>>()
  for (const row of acceptances ?? []) {
    const key = `${row.reservation_id}:${row.participant_id}`
    const set = signed.get(key) ?? new Set<string>()
    set.add(row.document_code)
    signed.set(key, set)
  }

  const peopleByRes = new Map<string, typeof participants>()
  for (const p of participants ?? []) {
    const list = peopleByRes.get(p.reservation_id) ?? []
    list.push(p)
    peopleByRes.set(p.reservation_id, list)
  }

  const rows = (reservations ?? []).map((r: {
    id: string
    channel_rn: string | null
    tour_date: string
    product_id: string | null
    canyon_choice: string | null
    total_people: number | null
  }) => {
    const product = r.product_id ? productMap.get(r.product_id) : null
    const required = resolveRequiredWaivers({
      productRequiredCodes: r.product_id ? requiredByProduct.get(r.product_id) ?? [] : [],
      canyonChoice: r.canyon_choice,
      productTags: product?.tags ?? null,
      productName: product?.customer_name_en || product?.name_en || product?.name || null,
    })
    const signing = signingRequiredCodes(required)
    const people = peopleByRes.get(r.id) ?? []
    const guestCount = people.length || Number(r.total_people ?? 0)
    const matrix = people.map((p: { id: string; full_legal_name: string | null; placeholder_label: string }) => {
      const docs = signed.get(`${r.id}:${p.id}`) ?? new Set<string>()
      const perDoc = Object.fromEntries(signing.map((code) => [code, docs.has(code)]))
      const complete = signing.every((code) => docs.has(code))
      return {
        id: p.id,
        name: p.full_legal_name || p.placeholder_label,
        perDoc,
        complete,
      }
    })
    const completeGuests = matrix.filter((m: { complete: boolean }) => m.complete).length
    const docTotals = Object.fromEntries(
      signing.map((code) => [code, matrix.filter((m: { perDoc: Record<string, boolean> }) => m.perDoc[code]).length])
    )
    return {
      reservationId: r.id,
      bookingNumber: (r.channel_rn || '').trim() || r.id,
      tourDate: r.tour_date,
      tourName: product?.customer_name_en || product?.name_en || product?.name || 'Tour',
      guestCount,
      required: signing,
      recognized: required,
      docTotals,
      completeGuests,
      overall: guestCount > 0 && completeGuests >= guestCount && signing.length > 0 ? 'COMPLETE' : 'INCOMPLETE',
      participants: matrix,
    }
  })

  return NextResponse.json({ rows })
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')

  if (action === 'invite') {
    const reservationId = String(body.reservationId ?? '').trim()
    if (!reservationId) return NextResponse.json({ error: 'reservationId required' }, { status: 400 })
    const minted = await ensureInvitationForReservation(reservationId, auth.userEmail)
    if (!minted) return NextResponse.json({ error: 'Could not create invitation' }, { status: 500 })
    if (!minted.url) {
      return NextResponse.json({
        ok: true,
        invitationId: minted.invitationId,
        message: 'Invitation exists. A new raw token is only shown when first created.',
      })
    }
    return NextResponse.json({ ok: true, url: minted.url, invitationId: minted.invitationId })
  }

  if (action === 'copy-link') {
    const reservationId = String(body.reservationId ?? '').trim()
    if (!reservationId) return NextResponse.json({ error: 'reservationId required' }, { status: 400 })
    const { fromUntypedTable: t } = await import('@/lib/supabaseUntypedTable')
    const { data: existing } = await t(supabaseAdmin!, 'waiver_invitations')
      .select('id')
      .eq('reservation_id', reservationId)
      .eq('status', 'active')
      .maybeSingle()
    const minted = await ensureInvitationForReservation(reservationId, auth.userEmail)
    if (!existing && minted?.url) return NextResponse.json({ ok: true, url: minted.url, rotated: false })
    const fresh = await ensureNewRawToken(reservationId, auth.userEmail)
    return NextResponse.json({ ok: true, url: fresh, rotated: Boolean(existing) })
  }

  if (action === 'send-email') {
    const reservationId = String(body.reservationId ?? '').trim()
    const email = String(body.email ?? '').trim()
    const providedUrl = String(body.url ?? '').trim()
    const language = String(body.language ?? '').trim()
    if (!reservationId || !email) {
      return NextResponse.json({ error: 'reservationId and email required' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    const { isWaiverShareUrl, buildWaiverShareEmail } = await import('@/lib/waiver/cardSummaryBatch')
    const { Resend } = await import('resend')
    const { customerLanguageIndicatesKorean } = await import('@/lib/reservationEmailLocale')

    const { data: reservation } = await fromUntypedTable(supabaseAdmin!, 'reservations')
      .select('id, channel_rn, tour_date, product_id, customer_id')
      .eq('id', reservationId)
      .maybeSingle()
    if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })

    const [{ data: customer }, { data: product }] = await Promise.all([
      reservation.customer_id
        ? fromUntypedTable(supabaseAdmin!, 'customers')
            .select('email, language')
            .eq('id', reservation.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      reservation.product_id
        ? fromUntypedTable(supabaseAdmin!, 'products')
            .select('name, name_en, name_ko, customer_name_en, customer_name_ko')
            .eq('id', reservation.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    let url = isWaiverShareUrl(providedUrl) ? providedUrl : ''
    if (!url) {
      const minted = await ensureInvitationForReservation(reservationId, auth.userEmail)
      url = minted?.url ?? (await ensureNewRawToken(reservationId, auth.userEmail)) ?? ''
    }
    if (!url) return NextResponse.json({ error: 'No waiver link' }, { status: 500 })

    const isKo =
      language === 'ko'
        ? true
        : language === 'en'
          ? false
          : customerLanguageIndicatesKorean(customer?.language)
    const bookingNumber = (reservation.channel_rn || '').trim() || reservation.id
    const tourName =
      product?.customer_name_en || product?.name_en || product?.name || 'Tour'
    const content = buildWaiverShareEmail({
      isKo,
      bookingNumber,
      tourDate: reservation.tour_date,
      tourName,
      url,
    })

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) return NextResponse.json({ error: 'Email is not configured' }, { status: 503 })
    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
    const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: fromEmail,
      replyTo,
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    })
    if (emailError) {
      await fromUntypedTable(supabaseAdmin!, 'email_logs').insert({
        reservation_id: reservationId,
        email,
        email_type: 'waiver',
        subject: content.subject,
        status: 'failed',
        error_message: emailError.message || 'Email sending failed',
        sent_at: new Date().toISOString(),
        sent_by: auth.userEmail,
      })
      return NextResponse.json({ error: emailError.message || 'Could not send email' }, { status: 400 })
    }

    await fromUntypedTable(supabaseAdmin!, 'email_logs').insert({
      reservation_id: reservationId,
      email,
      email_type: 'waiver',
      subject: content.subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: auth.userEmail,
      resend_email_id: emailResult?.id || null,
    })
    await fromUntypedTable(supabaseAdmin!, 'waiver_invitations')
      .update({ last_sent_at: new Date().toISOString(), last_sent_via: 'email' })
      .eq('reservation_id', reservationId)
      .eq('status', 'active')
    await fromUntypedTable(supabaseAdmin!, 'waiver_audit_events').insert({
      reservation_id: reservationId,
      event_type: 'INVITATION_SENT',
      actor_type: 'staff',
      actor_id: auth.userEmail,
      metadata: { via: 'email', email },
    })
    return NextResponse.json({ ok: true, url, emailId: emailResult?.id ?? null })
  }

  if (action === 'void') {
    const result = await voidAcceptance({
      acceptanceId: String(body.acceptanceId ?? ''),
      reason: String(body.reason ?? ''),
      staffEmail: auth.userEmail,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reissue') {
    const result = await reissueParticipant({
      participantId: String(body.participantId ?? ''),
      staffEmail: auth.userEmail,
      reason: String(body.reason ?? ''),
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'send-sms') {
    const to = String(body.phone ?? '').trim()
    const reservationId = String(body.reservationId ?? '').trim()
    if (!to || !reservationId) return NextResponse.json({ error: 'phone and reservationId required' }, { status: 400 })
    const minted = await ensureInvitationForReservation(reservationId, auth.userEmail)
    const url = minted?.url ?? (await ensureNewRawToken(reservationId, auth.userEmail))
    if (!url) return NextResponse.json({ error: 'No waiver link' }, { status: 500 })
    const sent = await sendTwilioSms(to, `Please sign your Las Vegas Mania Tour waiver: ${url}`)
    if ('error' in sent) return NextResponse.json({ error: sent.error }, { status: 400 })
    return NextResponse.json({ ok: true, sid: sent.sid, url })
  }

  if (action === 'guide-sign') {
    const reservationId = String(body.reservationId ?? '').trim()
    const guideName = String(body.guideName ?? '').trim()
    const guidePhone = String(body.guidePhone ?? '').trim()
    const signaturePngBase64 = String(body.signaturePngBase64 ?? '')
    if (!reservationId || !guideName) {
      return NextResponse.json({ error: 'reservationId and guideName required' }, { status: 400 })
    }
    const { parsePngBase64 } = await import('@/lib/waiver/validation')
    const { randomBytes } = await import('crypto')
    const png = parsePngBase64(signaturePngBase64)
    if (!png) return NextResponse.json({ error: 'Guide signature required' }, { status: 400 })
    const storageKey = `${reservationId}/guide/${randomBytes(16).toString('hex')}.png`
    const { error: upErr } = await supabaseAdmin!.storage.from('waiver-signatures').upload(storageKey, png, {
      contentType: 'image/png',
      upsert: false,
    })
    if (upErr) return NextResponse.json({ error: 'Could not store signature' }, { status: 500 })
    const { data: signatureRow, error: sigErr } = await fromUntypedTable(supabaseAdmin!, 'waiver_signatures')
      .insert({ storage_key: storageKey })
      .select('id')
      .single()
    if (sigErr || !signatureRow) return NextResponse.json({ error: 'Could not record signature' }, { status: 500 })
    const signedAt = new Date().toISOString()
    const { error: gErr } = await fromUntypedTable(supabaseAdmin!, 'waiver_guide_signatures').upsert(
      {
        reservation_id: reservationId,
        document_code: 'ANTELOPE_CANYON_X',
        guide_name: guideName,
        guide_phone: guidePhone || null,
        signature_id: signatureRow.id,
        signed_at: signedAt,
        signed_by_staff_email: auth.userEmail,
      },
      { onConflict: 'reservation_id,document_code' }
    )
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    await fromUntypedTable(supabaseAdmin!, 'waiver_audit_events').insert({
      reservation_id: reservationId,
      event_type: 'GUIDE_SIGNATURE_CAPTURED',
      actor_type: 'staff',
      actor_id: auth.userEmail,
      metadata: { documentCode: 'ANTELOPE_CANYON_X' },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

async function ensureNewRawToken(reservationId: string, staffEmail: string) {
  const { generateWaiverRawToken, hashWaiverToken } = await import('@/lib/waiver/tokens')
  const { getAppOrigin } = await import('@/lib/appOrigin')
  const raw = generateWaiverRawToken()
  await fromUntypedTable(supabaseAdmin!, 'waiver_invitations')
    .update({ status: 'revoked' })
    .eq('reservation_id', reservationId)
    .eq('status', 'active')
  const { data } = await fromUntypedTable(supabaseAdmin!, 'waiver_invitations')
    .insert({
      reservation_id: reservationId,
      token_hash: hashWaiverToken(raw),
      status: 'active',
      created_by: staffEmail,
    })
    .select('id')
    .single()
  if (!data) return null
  await fromUntypedTable(supabaseAdmin!, 'waiver_participants')
    .update({ invitation_id: data.id })
    .eq('reservation_id', reservationId)
  return `${getAppOrigin()}/waiver/${raw}`
}
