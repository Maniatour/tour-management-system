import { NextRequest, NextResponse } from 'next/server'
import { resolveGuideApiAuth } from '@/lib/guideApiAuth'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveTodayPhotoTourForGuide } from '@/lib/guideTodayPhotoTour'

function localeFromRequest(request: NextRequest): string {
  const fromQuery = request.nextUrl.searchParams.get('locale')?.trim().toLowerCase()
  if (fromQuery === 'en' || fromQuery === 'ko') return fromQuery
  return 'ko'
}

/**
 * GET /api/guide/today-photo-tour
 * 로그인한 가이드(또는 시뮬레이션 대상)의 오늘(라스베가스) 투어를 서버에서 결정한다.
 */
export async function GET(request: NextRequest) {
  const auth = await resolveGuideApiAuth(request)
  if (!auth.ok) return auth.response

  const clientOrResponse = await getSupabaseForApiRoute(request)
  if (clientOrResponse instanceof NextResponse) return clientOrResponse

  const db = supabaseAdmin ?? clientOrResponse
  const locale = localeFromRequest(request)

  try {
    const payload = await resolveTodayPhotoTourForGuide(db, auth.ctx.actingEmail, locale)
    return NextResponse.json({ ok: true, ...payload })
  } catch (error) {
    console.error('[api/guide/today-photo-tour]', error)
    const message = error instanceof Error ? error.message : 'today_photo_tour_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
