import { NextRequest, NextResponse } from 'next/server'
import { assertSuper, resolveFinancialApiAuth } from '@/lib/financial-api-auth'

/**
 * 금융 계정에 묶인 모든 명세 줄의 direction 만 반전합니다.
 * statement_csv_direction_mode(CSV 규칙)는 변경하지 않습니다.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await resolveFinancialApiAuth(_request)
    if (!auth.ok) return auth.response

    const gate = await assertSuper(auth.supabase, auth.userEmail)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    const { id } = await Promise.resolve(context.params)
    const accountId = (id ?? '').trim()
    if (!accountId) {
      return NextResponse.json({ error: '계정 ID가 없습니다.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcData, error: rpcError } = await (auth.supabase as any).rpc(
      'flip_statement_lines_and_set_csv_invert',
      { p_financial_account_id: accountId }
    )

    if (rpcError) {
      console.error('flip_statement_lines_and_set_csv_invert:', rpcError)
      const msg = rpcError.message || '명세 반전에 실패했습니다.'
      if (msg.includes('financial_account_not_found')) {
        return NextResponse.json({ error: '해당 금융 계정을 찾을 수 없습니다.' }, { status: 404 })
      }
      if (msg.includes('invalid_financial_account_id')) {
        return NextResponse.json({ error: '유효하지 않은 계정입니다.' }, { status: 400 })
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const flippedCount = typeof rpcData === 'number' ? rpcData : Number(rpcData ?? 0)

    return NextResponse.json({
      success: true,
      flippedCount: Number.isFinite(flippedCount) ? flippedCount : 0,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
