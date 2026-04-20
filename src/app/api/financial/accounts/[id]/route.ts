import { NextRequest, NextResponse } from 'next/server'
import { assertSuper, resolveFinancialApiAuth } from '@/lib/financial-api-auth'
import type { StatementCsvDirectionMode } from '@/lib/statement-csv'

const MODES: StatementCsvDirectionMode[] = ['auto', 'invert', 'no_invert']

/**
 * 금융 계정 수정 (명세 CSV 지출/수입 방향 등)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await resolveFinancialApiAuth(request)
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

    const body = (await request.json()) as {
      statement_csv_direction_mode?: string
    }

    if (body.statement_csv_direction_mode === undefined) {
      return NextResponse.json({ error: '변경할 필드를 보내 주세요.' }, { status: 400 })
    }

    const mode = body.statement_csv_direction_mode as StatementCsvDirectionMode
    if (!MODES.includes(mode)) {
      return NextResponse.json(
        { error: 'statement_csv_direction_mode 는 auto, invert, no_invert 중 하나여야 합니다.' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (auth.supabase as any)
      .from('financial_accounts')
      .update({ statement_csv_direction_mode: mode })
      .eq('id', accountId)
      .select('id, name, account_type, currency, is_active, statement_csv_direction_mode')
      .maybeSingle()

    if (error) {
      console.error('financial_accounts patch:', error)
      return NextResponse.json(
        { error: error.message || '금융 계정을 수정하지 못했습니다.' },
        { status: 500 }
      )
    }
    if (!data) {
      return NextResponse.json({ error: '해당 금융 계정을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
