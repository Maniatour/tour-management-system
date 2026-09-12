import { NextRequest, NextResponse } from 'next/server'
import { resolveGuideApiAuth } from '@/lib/guideApiAuth'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { supabaseAdmin } from '@/lib/supabase'
import { DATE_RE, listMoveCandidatesForGuide } from '@/lib/tourReportMoveRequests'

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

  const reportId = request.nextUrl.searchParams.get('reportId')?.trim()
  const date = request.nextUrl.searchParams.get('date')?.trim()
  const locale = localeFromRequest(request)
  if (!reportId || !date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: '리포트와 날짜가 필요합니다.' }, { status: 400 })
  }

  try {
    const payload = await listMoveCandidatesForGuide(db, {
      reportId,
      date,
      actingEmail: auth.ctx.actingEmail,
      locale,
    })
    return NextResponse.json({ ok: true, ...payload })
  } catch (error) {
    console.error('[api/guide/tour-report-move-candidates]', error)
    const message = error instanceof Error ? error.message : 'candidates_failed'
    const status = /본인|own|찾을 수 없|not found|날짜/i.test(message) ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
