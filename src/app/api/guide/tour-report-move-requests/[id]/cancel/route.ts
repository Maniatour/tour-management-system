import { NextRequest, NextResponse } from 'next/server'
import { resolveGuideApiAuth } from '@/lib/guideApiAuth'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelMoveRequest } from '@/lib/tourReportMoveRequests'

function localeFromRequest(request: NextRequest): string {
  const fromQuery = request.nextUrl.searchParams.get('locale')?.trim().toLowerCase()
  if (fromQuery === 'en' || fromQuery === 'ko') return fromQuery
  return 'ko'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveGuideApiAuth(request)
  if (!auth.ok) return auth.response

  const clientOrResponse = await getSupabaseForApiRoute(request)
  if (clientOrResponse instanceof NextResponse) return clientOrResponse
  const db = supabaseAdmin ?? clientOrResponse

  const { id } = await params
  const requestId = id?.trim()
  if (!requestId) {
    return NextResponse.json({ error: '요청 ID가 필요합니다.' }, { status: 400 })
  }

  try {
    const item = await cancelMoveRequest(db, {
      requestId,
      actingEmail: auth.ctx.actingEmail,
      locale: localeFromRequest(request),
    })
    return NextResponse.json({ ok: true, item })
  } catch (error) {
    console.error('[api/guide/tour-report-move-requests/cancel]', error)
    const message = error instanceof Error ? error.message : 'cancel_failed'
    const status = /본인|own|대기|pending|찾을 수 없|not found/i.test(message) ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
