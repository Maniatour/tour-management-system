import { NextRequest, NextResponse } from 'next/server'
import { requireTourReportAdminAccess } from '@/lib/tourReportAdminAccess'
import { reviewMoveRequest } from '@/lib/tourReportMoveRequests'

function localeFromRequest(request: NextRequest): string {
  const fromQuery = request.nextUrl.searchParams.get('locale')?.trim().toLowerCase()
  if (fromQuery === 'en' || fromQuery === 'ko') return fromQuery
  return 'ko'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTourReportAdminAccess(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const requestId = id?.trim()
  if (!requestId) {
    return NextResponse.json({ error: '요청 ID가 필요합니다.' }, { status: 400 })
  }

  let body: { action?: string; reviewNote?: string }
  try {
    body = (await request.json()) as { action?: string; reviewNote?: string }
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const action = body.action === 'approve' || body.action === 'reject' ? body.action : null
  if (!action) {
    return NextResponse.json({ error: '승인 또는 거부를 선택해 주세요.' }, { status: 400 })
  }

  try {
    const item = await reviewMoveRequest(auth.db, {
      requestId,
      action,
      reviewNote: body.reviewNote ?? null,
      reviewerEmail: auth.user.email || '',
      locale: localeFromRequest(request),
    })
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    console.error('[admin/tour-report-move-requests/review]', e)
    const message = errorMessage(e)
    const status = /대기|pending|찾을 수 없|not found|이미|already|취소|cancelled/i.test(message) ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : '이동 요청을 처리하지 못했습니다.'
}
