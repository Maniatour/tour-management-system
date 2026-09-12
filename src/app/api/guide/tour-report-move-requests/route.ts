import { NextRequest, NextResponse } from 'next/server'
import { resolveGuideApiAuth } from '@/lib/guideApiAuth'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { supabaseAdmin } from '@/lib/supabase'
import {
  createMoveRequest,
  isTourReportMoveStatus,
  listMoveRequests,
  type TourReportMoveStatus,
} from '@/lib/tourReportMoveRequests'

function localeFromRequest(request: NextRequest): string {
  const fromQuery = request.nextUrl.searchParams.get('locale')?.trim().toLowerCase()
  if (fromQuery === 'en' || fromQuery === 'ko') return fromQuery
  return 'ko'
}

export async function GET(request: NextRequest) {
  const auth = await resolveGuideApiAuth(request)
  if (!auth.ok) return auth.response

  const clientOrResponse = await getSupabaseForApiRoute(request)
  if (clientOrResponse instanceof NextResponse) return clientOrResponse
  const db = supabaseAdmin ?? clientOrResponse

  const locale = localeFromRequest(request)
  const statusParam = request.nextUrl.searchParams.get('status')?.trim() || 'pending'
  const status: TourReportMoveStatus | 'all' =
    statusParam === 'all' || isTourReportMoveStatus(statusParam) ? statusParam : 'pending'
  const reportIds = request.nextUrl.searchParams.get('reportIds')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  try {
    const items = await listMoveRequests(db, {
      locale,
      status,
      requestedBy: auth.ctx.actingEmail,
      ...(reportIds && reportIds.length > 0 ? { reportIds } : {}),
    })
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error('[api/guide/tour-report-move-requests] GET', error)
    const message = error instanceof Error ? error.message : 'move_requests_failed'
    return NextResponse.json({ ok: false, error: message, items: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await resolveGuideApiAuth(request)
  if (!auth.ok) return auth.response

  const clientOrResponse = await getSupabaseForApiRoute(request)
  if (clientOrResponse instanceof NextResponse) return clientOrResponse
  const db = supabaseAdmin ?? clientOrResponse

  const locale = localeFromRequest(request)
  let body: { reportId?: string; toTourId?: string; reason?: string }
  try {
    body = (await request.json()) as { reportId?: string; toTourId?: string; reason?: string }
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const reportId = body.reportId?.trim()
  const toTourId = body.toTourId?.trim()
  if (!reportId || !toTourId) {
    return NextResponse.json({ error: '리포트와 옮길 투어를 선택해 주세요.' }, { status: 400 })
  }

  try {
    const item = await createMoveRequest(db, {
      reportId,
      toTourId,
      reason: body.reason ?? null,
      actingEmail: auth.ctx.actingEmail,
      locale,
    })
    return NextResponse.json({ ok: true, item })
  } catch (error) {
    console.error('[api/guide/tour-report-move-requests] POST', error)
    const message = error instanceof Error ? error.message : 'move_request_failed'
    const status = /이미|already|본인|own|찾을 수 없|not found|취소|cancelled/i.test(message) ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
