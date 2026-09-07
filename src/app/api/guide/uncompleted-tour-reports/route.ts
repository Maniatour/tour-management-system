import { NextRequest, NextResponse } from 'next/server'
import { resolveGuideApiAuth } from '@/lib/guideApiAuth'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { supabaseAdmin } from '@/lib/supabase'
import { listUncompletedTourReportsForGuide } from '@/lib/guideUncompletedTourReports'

function localeFromRequest(request: NextRequest): string {
  const fromQuery = request.nextUrl.searchParams.get('locale')?.trim().toLowerCase()
  if (fromQuery === 'en' || fromQuery === 'ko') return fromQuery
  return 'ko'
}

/**
 * GET /api/guide/uncompleted-tour-reports
 * 가이드(또는 시뮬레이션 대상)의 미작성 투어 리포트.
 * 브라우저에서 tour_reports를 직접 읽으면 is_staff() 42501이 날 수 있어 서버에서 조회한다.
 */
export async function GET(request: NextRequest) {
  const auth = await resolveGuideApiAuth(request)
  if (!auth.ok) return auth.response

  const clientOrResponse = await getSupabaseForApiRoute(request)
  if (clientOrResponse instanceof NextResponse) return clientOrResponse

  const db = supabaseAdmin ?? clientOrResponse
  const locale = localeFromRequest(request)

  try {
    const items = await listUncompletedTourReportsForGuide(db, auth.ctx.actingEmail, locale)
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error('[api/guide/uncompleted-tour-reports]', error)
    const message = error instanceof Error ? error.message : 'uncompleted_tour_reports_failed'
    return NextResponse.json({ ok: false, error: message, items: [] }, { status: 500 })
  }
}
