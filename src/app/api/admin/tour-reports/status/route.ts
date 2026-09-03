import { NextRequest, NextResponse } from 'next/server'
import { requireTourReportAdminAccess } from '@/lib/tourReportAdminAccess'
import {
  defaultTourReportStatusRange,
  loadTourReportStatus,
} from '@/lib/tourReportMissing'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  const auth = await requireTourReportAdminAccess(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const fallback = defaultTourReportStatusRange()
    const from = searchParams.get('from')?.trim() || fallback.from
    const to = searchParams.get('to')?.trim() || fallback.to
    const operatorId = searchParams.get('operatorId')
    const locale = searchParams.get('locale') === 'en' ? 'en' : 'ko'

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 })
    }
    if (to < from) {
      return NextResponse.json({ error: '종료일이 시작일보다 빠를 수 없습니다.' }, { status: 400 })
    }

    const data = await loadTourReportStatus(auth.db, { from, to, operatorId, locale })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[admin/tour-reports/status]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '투어 리포트 현황을 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}
