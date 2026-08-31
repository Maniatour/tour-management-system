import { NextRequest, NextResponse } from 'next/server'
import { getLiveGoverningWaiverContent, getLiveWaiverContent, loadLiveWaiverMeta } from '@/lib/waiver/liveContent'
import { normalizeWaiverLocale } from '@/lib/waiver/locales'
import { clientIpFromRequest, consumeWaiverRateLimit, userAgentFromRequest } from '@/lib/waiver/rateLimit'
import {
  buildPublicSession,
  getInvitationByRawToken,
  loadParticipantForToken,
  publicParticipantSafeFields,
  submitSignedWaiver,
} from '@/lib/waiver/service'
import { isPlausibleWaiverToken } from '@/lib/waiver/tokens'
import type { WaiverDocumentCode } from '@/lib/waiver/types'

export const runtime = 'nodejs'

function invalid() {
  return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
}

async function resolveInvitation(token: string) {
  if (!isPlausibleWaiverToken(token)) return null
  return getInvitationByRawToken(token)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = clientIpFromRequest(request) ?? 'unknown'
  const limited = consumeWaiverRateLimit(`waiver-get:${ip}`, 60, 60_000)
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const invitation = await resolveInvitation(token)
  if (!invitation) return invalid()

  const session = await buildPublicSession(invitation)
  if (!session) return invalid()

  const participantId = request.nextUrl.searchParams.get('participantId')
  let self = null
  if (participantId) {
    const row = await loadParticipantForToken(invitation.id, participantId)
    if (row) self = publicParticipantSafeFields(row, true)
  }

  const localeParam = request.nextUrl.searchParams.get('lang')
  const lang = normalizeWaiverLocale(localeParam)

  try {
    const { fromUntypedTable } = await import('@/lib/supabaseUntypedTable')
    const { supabaseAdmin } = await import('@/lib/supabase')
    if (supabaseAdmin) {
      await fromUntypedTable(supabaseAdmin, 'waiver_audit_events').insert({
        reservation_id: invitation.reservation_id,
        invitation_id: invitation.id,
        event_type: 'WAIVER_OPENED',
        metadata: { lang },
        actor_type: 'customer',
      })
    }
  } catch {
    /* non-fatal */
  }

  const documents = await Promise.all(
    session.requiredWaivers.map(async (w) => {
      const meta = await loadLiveWaiverMeta(w.code)
      const content = w.requiredForSigning ? await getLiveWaiverContent(w.code, lang) : null
      const governingContent = w.requiredForSigning ? await getLiveGoverningWaiverContent(w.code) : null
      return {
        code: w.code,
        status: w.status,
        signatureMode: w.signatureMode,
        requiredForSigning: w.requiredForSigning,
        displayName: meta.displayName,
        operatorName: meta.operatorName,
        content,
        governingContent,
      }
    })
  )

  return NextResponse.json({
    session,
    self,
    documents,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = clientIpFromRequest(request) ?? 'unknown'
  const limited = consumeWaiverRateLimit(`waiver-post:${ip}:${token.slice(0, 12)}`, 12, 60_000)
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } })
  }

  const invitation = await resolveInvitation(token)
  if (!invitation) return invalid()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = typeof body === 'object' && body && 'action' in body ? String((body as { action?: string }).action) : 'submit'

  if (action === 'view') {
    const documentCode = (body as { documentCode?: string }).documentCode as WaiverDocumentCode | undefined
    const participantId = (body as { participantId?: string }).participantId
    if (documentCode) {
      const { fromUntypedTable } = await import('@/lib/supabaseUntypedTable')
      const { supabaseAdmin } = await import('@/lib/supabase')
      if (supabaseAdmin) {
        await fromUntypedTable(supabaseAdmin, 'waiver_audit_events').insert({
          reservation_id: invitation.reservation_id,
          invitation_id: invitation.id,
          participant_id: participantId ?? null,
          event_type: 'DOCUMENT_VIEWED',
          metadata: { documentCode },
          actor_type: 'customer',
        })
      }
    }
    return NextResponse.json({ ok: true })
  }

  const result = await submitSignedWaiver({
    invitationId: invitation.id,
    reservationId: invitation.reservation_id,
    body,
    ip: clientIpFromRequest(request),
    userAgent: userAgentFromRequest(request),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const session = await buildPublicSession(invitation)
  return NextResponse.json({ ok: true, result, session })
}
