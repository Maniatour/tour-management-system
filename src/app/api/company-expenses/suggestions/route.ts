import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import {
  buildPaymentMethodFilterRows,
  type PaymentMethodFilterRow,
} from '@/lib/companyExpensePaymentMethodFilters'

type SuggestionsPayload = {
  paid_to: string[]
  paid_for: string[]
  /** standard_paid_for 가 비어 있고 paid_for 만 있는 지출의 결제 내용 */
  paid_for_standard_unset: string[]
  /** @deprecated 필터는 payment_method_filters 사용 */
  payment_method: string[]
  /** 결제 방법 필터 — id 기준 통합·건수 포함 */
  payment_method_filters: PaymentMethodFilterRow[]
  /** 표준 결제내용 필터 — 값별 건수 */
  standard_paid_for_filters: PaymentMethodFilterRow[]
  standard_paid_for: string[]
  submit_by: string[]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const [rpcResult, pmResult, pmCountResult, stdPfCountResult] = await Promise.all([
      supabase.rpc('company_expense_suggestions' as never),
      supabase.from('payment_methods').select('id, method, display_name'),
      supabase.rpc('company_expense_payment_method_counts' as never),
      supabase.rpc('company_expense_standard_paid_for_counts' as never),
    ])

    if (rpcResult.error) {
      console.error('회사 지출 제안 목록 RPC 오류:', rpcResult.error)
      return NextResponse.json({ error: '제안 목록을 불러올 수 없습니다.' }, { status: 500 })
    }

    if (pmResult.error) {
      console.error('회사 지출 제안: payment_methods 조회 오류:', pmResult.error)
    }
    if (pmCountResult.error) {
      console.error('회사 지출 제안: payment_method_counts RPC 오류:', pmCountResult.error)
    }
    if (stdPfCountResult.error) {
      console.error('회사 지출 제안: standard_paid_for_counts RPC 오류:', stdPfCountResult.error)
    }

    const raw = rpcResult.data as unknown
    let payload: SuggestionsPayload = {
      paid_to: [],
      paid_for: [],
      paid_for_standard_unset: [],
      payment_method: [],
      payment_method_filters: [],
      standard_paid_for_filters: [],
      standard_paid_for: [],
      submit_by: [],
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>
      const asStrArr = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
      payload = {
        paid_to: asStrArr(o.paid_to),
        paid_for: asStrArr(o.paid_for),
        paid_for_standard_unset: asStrArr(o.paid_for_standard_unset),
        payment_method: asStrArr(o.payment_method),
        payment_method_filters: [],
        standard_paid_for_filters: [],
        standard_paid_for: asStrArr(o.standard_paid_for),
        submit_by: asStrArr(o.submit_by),
      }
    }

    const pmRows = (pmResult.data ?? []) as { id: string; method: string | null }[]
    const rawCounts = (pmCountResult.data ?? []) as { payment_method: string; cnt: number | string }[]
    payload.payment_method_filters = buildPaymentMethodFilterRows(
      rawCounts.map((r) => ({
        payment_method: String(r.payment_method ?? ''),
        cnt: Number(r.cnt ?? 0),
      })),
      pmRows
    )
    payload.payment_method = payload.payment_method_filters.map((r) => r.value)

    const stdPfRaw = (stdPfCountResult.data ?? []) as { standard_paid_for: string; cnt: number | string }[]
    payload.standard_paid_for_filters = stdPfRaw
      .map((r) => ({
        value: String(r.standard_paid_for ?? '').trim(),
        count: Number(r.cnt ?? 0),
      }))
      .filter((r) => r.value && r.count > 0)
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'ko'))
    payload.standard_paid_for = payload.standard_paid_for_filters.map((r) => r.value)

    return NextResponse.json(payload)
  } catch (e) {
    console.error('회사 지출 제안 목록 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
