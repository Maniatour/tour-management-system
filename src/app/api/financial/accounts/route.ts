import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { assertSuper, resolveFinancialApiAuth } from '@/lib/financial-api-auth'

/**
 * 금융 계정 목록 — 명세 대조 화면용 (클라이언트 직접 SELECT 대신 사용, abort/권한 이슈 완화)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveFinancialApiAuth(request)
    if (!auth.ok) return auth.response

    const gate = await assertSuper(auth.supabase, auth.userEmail)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (auth.supabase as any)
      .from('financial_accounts')
      .select('id, name, account_type, currency, is_active, statement_csv_direction_mode')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('financial_accounts select:', error)
      return NextResponse.json(
        { error: error.message || '금융 계정을 불러오지 못했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

/**
 * 금융 계정(은행·카드 레지스터) 추가 — 명세 대조 전용.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveFinancialApiAuth(request)
    if (!auth.ok) return auth.response

    const gate = await assertSuper(auth.supabase, auth.userEmail)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    const body = (await request.json()) as {
      name?: string
      account_type?: string
      currency?: string
    }

    const name = (body.name ?? '').trim()
    const accountType = body.account_type ?? ''
    const currency = (body.currency ?? 'USD').trim() || 'USD'

    if (!name) {
      return NextResponse.json({ error: '계정 이름을 입력하세요.' }, { status: 400 })
    }

    if (!['bank', 'credit_card', 'clearing', 'other'].includes(accountType)) {
      return NextResponse.json({ error: '유효하지 않은 계정 유형입니다.' }, { status: 400 })
    }

    const norm = (s: string) => s.trim().toLowerCase()
    const nameNorm = norm(name)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingRows, error: existErr } = await (auth.supabase as any)
      .from('financial_accounts')
      .select('id, name')
      .eq('account_type', accountType)
      .eq('is_active', true)

    if (existErr) {
      console.error('financial_accounts duplicate check:', existErr)
      return NextResponse.json({ error: existErr.message || '중복 확인에 실패했습니다.' }, { status: 500 })
    }

    const dup = (existingRows as { id: string; name: string }[] | null)?.some(
      (r) => norm(r.name) === nameNorm
    )
    if (dup) {
      return NextResponse.json(
        {
          error:
            '같은 유형(은행/카드 등)에 동일한 이름의 금융 계정이 이미 있습니다. 목록을 확인하거나 이름을 조금 바꿔 주세요.',
          code: 'DUPLICATE',
        },
        { status: 409 }
      )
    }

    const id = randomUUID()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (auth.supabase as any)
      .from('financial_accounts')
      .insert({
        id,
        name,
        account_type: accountType,
        currency,
        is_active: true,
      })
      .select('id, name, account_type, currency, is_active, statement_csv_direction_mode')
      .single()

    if (error) {
      console.error('financial_accounts insert:', error)
      return NextResponse.json(
        { error: error.message || '금융 계정을 추가하지 못했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
