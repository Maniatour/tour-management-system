import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { resolveReservationChoicesBatch } from '@/lib/resolveReservationChoices'

const MAX_IDS = 80

/**
 * 예약 카드 목록용 초이스 배치 조회.
 * N장의 카드가 각각 GET /api/reservations/[id]/choices 를 치면
 * 터미널·브라우저 요청이 폭주하므로 목록 prefetch 가 이 엔드포인트를 사용한다.
 */
export async function POST(request: NextRequest) {
  const db = await getSupabaseForApiRoute(request)
  if (db instanceof NextResponse) return db

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null
  const rawIds = Array.isArray(body?.ids) ? body.ids : []
  const ids = [
    ...new Set(
      rawIds
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(Boolean)
    ),
  ].slice(0, MAX_IDS)

  if (ids.length === 0) {
    return NextResponse.json({ choicesByReservationId: {} })
  }

  try {
    const resolved = await resolveReservationChoicesBatch(db, ids)
    const choicesByReservationId: Record<string, unknown[]> = {}
    for (const id of ids) {
      choicesByReservationId[id] = resolved.get(id) ?? []
    }
    return NextResponse.json({ choicesByReservationId })
  } catch (error) {
    console.error('예약 초이스 배치 조회 오류:', error)
    return NextResponse.json({ error: '예약 초이스 배치 조회에 실패했습니다.' }, { status: 500 })
  }
}
