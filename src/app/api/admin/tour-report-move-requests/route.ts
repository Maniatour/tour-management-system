import { NextRequest, NextResponse } from 'next/server'
import { requireTourReportAdminAccess } from '@/lib/tourReportAdminAccess'
import {
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
  const auth = await requireTourReportAdminAccess(request)
  if (!auth.ok) return auth.response

  const statusParam = request.nextUrl.searchParams.get('status')?.trim() || 'pending'
  const status: TourReportMoveStatus | 'all' =
    statusParam === 'all' || isTourReportMoveStatus(statusParam) ? statusParam : 'pending'

  try {
    const items = await listMoveRequests(auth.db, {
      locale: localeFromRequest(request),
      status,
    })
    return NextResponse.json({
      ok: true,
      items,
      pendingCount: status === 'pending' ? items.length : items.filter((row) => row.status === 'pending').length,
    })
  } catch (e) {
    console.error('[admin/tour-report-move-requests]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '이동 요청을 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}
