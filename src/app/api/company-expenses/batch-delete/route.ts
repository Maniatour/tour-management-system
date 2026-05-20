import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { softDeleteExpenseRecord } from '@/lib/expense-soft-delete'

const MAX_IDS = 100

/**
 * 선택한 company_expenses 행을 삭제 보관함(soft delete)으로 옮깁니다.
 * body: { expenseIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const deletedBy = user?.email ?? null

    const body = await request.json()
    const rawIds = Array.isArray(body.expenseIds) ? body.expenseIds : []
    const expenseIds = [...new Set(rawIds.filter((x: unknown) => typeof x === 'string' && String(x).trim()))].slice(
      0,
      MAX_IDS
    )

    if (expenseIds.length === 0) {
      return NextResponse.json({ error: 'expenseIds 가 필요합니다.' }, { status: 400 })
    }

    const results = await Promise.allSettled(
      expenseIds.map((id) => softDeleteExpenseRecord(supabase, 'company_expenses', id, deletedBy))
    )
    const deletedCount = results.filter((r) => r.status === 'fulfilled').length
    const failedCount = results.length - deletedCount

    if (deletedCount === 0) {
      return NextResponse.json(
        { error: '선택한 지출을 삭제할 수 없습니다.', deletedCount: 0, failedCount, requestedCount: expenseIds.length },
        { status: 500 }
      )
    }

    return NextResponse.json({
      deletedCount,
      failedCount,
      requestedCount: expenseIds.length,
    })
  } catch (e) {
    console.error('회사 지출 일괄 삭제 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
