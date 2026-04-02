import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SuggestionsPayload = { paid_to: string[]; paid_for: string[]; payment_method: string[] }

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('company_expense_suggestions')

    if (error) {
      console.error('회사 지출 제안 목록 RPC 오류:', error)
      return NextResponse.json({ error: '제안 목록을 불러올 수 없습니다.' }, { status: 500 })
    }

    const raw = data as unknown
    let payload: SuggestionsPayload = { paid_to: [], paid_for: [], payment_method: [] }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>
      const asStrArr = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
      payload = {
        paid_to: asStrArr(o.paid_to),
        paid_for: asStrArr(o.paid_for),
        payment_method: asStrArr(o.payment_method)
      }
    }

    return NextResponse.json(payload)
  } catch (e) {
    console.error('회사 지출 제안 목록 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
