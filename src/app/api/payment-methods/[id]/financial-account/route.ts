import { NextRequest, NextResponse } from 'next/server'
import { assertSuper, resolveFinancialApiAuth } from '@/lib/financial-api-auth'

/**
 * 명세 대조 — 결제수단(payment_methods) ↔ 금융 계정 연결.
 * 브라우저 Supabase 직접 UPDATE는 세션/RLS로 반영이 안 되는 경우가 있어, Bearer + Super와 동일 경로로 저장합니다.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await resolveFinancialApiAuth(request)
    if (!auth.ok) return auth.response

    const gate = await assertSuper(auth.supabase, auth.userEmail)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    const resolvedParams = await Promise.resolve(params)
    const id = resolvedParams.id
    if (!id?.trim()) {
      return NextResponse.json({ error: '결제수단 ID가 없습니다.' }, { status: 400 })
    }

    const body = (await request.json()) as { financial_account_id?: string | null }
    if (!('financial_account_id' in body)) {
      return NextResponse.json(
        { error: 'financial_account_id 필드가 필요합니다. (null이면 연결 해제)' },
        { status: 400 }
      )
    }

    const raw = body.financial_account_id
    const faId = raw === null || raw === '' ? null : String(raw).trim()

    if (faId) {
      const { data: fa, error: faErr } = await auth.supabase
        .from('financial_accounts')
        .select('id')
        .eq('id', faId)
        .maybeSingle()

      if (faErr) {
        console.error('financial_accounts lookup:', faErr)
        return NextResponse.json({ error: faErr.message || '금융 계정 확인 실패' }, { status: 500 })
      }
      if (!fa) {
        return NextResponse.json({ error: '유효하지 않은 금융 계정입니다.' }, { status: 400 })
      }
    }

    const { data, error } = await auth.supabase
      .from('payment_methods')
      .update({
        financial_account_id: faId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, financial_account_id')
      .maybeSingle()

    if (error) {
      console.error('payment_methods financial_account update:', error)
      return NextResponse.json({ error: error.message || '저장에 실패했습니다.' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json(
        { error: '결제수단을 찾았지만 수정할 수 없습니다. 권한·RLS를 확인하세요.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
