import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SuggestionsPayload = { paid_to: string[]; paid_for: string[]; payment_method: string[] }

function mergeDistinctSorted(base: string[], extra: string[]): string[] {
  const s = new Set<string>()
  for (const x of base) {
    const t = x.trim()
    if (t) s.add(t)
  }
  for (const x of extra) {
    const t = x.trim()
    if (t) s.add(t)
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
}

export async function GET() {
  try {
    const supabase = await createClient()

    const [rpcResult, pmResult] = await Promise.all([
      supabase.rpc('company_expense_suggestions'),
      supabase.from('payment_methods').select('method, display_name'),
    ])

    if (rpcResult.error) {
      console.error('회사 지출 제안 목록 RPC 오류:', rpcResult.error)
      return NextResponse.json({ error: '제안 목록을 불러올 수 없습니다.' }, { status: 500 })
    }

    if (pmResult.error) {
      console.error('회사 지출 제안: payment_methods 조회 오류:', pmResult.error)
    }

    const raw = rpcResult.data as unknown
    let payload: SuggestionsPayload = { paid_to: [], paid_for: [], payment_method: [] }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>
      const asStrArr = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
      payload = {
        paid_to: asStrArr(o.paid_to),
        paid_for: asStrArr(o.paid_for),
        payment_method: asStrArr(o.payment_method),
      }
    }

    const fromRegistered: string[] = []
    if (pmResult.data) {
      for (const row of pmResult.data as { method: string | null; display_name: string | null }[]) {
        if (row.display_name && typeof row.display_name === 'string') {
          const t = row.display_name.trim()
          if (t) fromRegistered.push(t)
        }
        if (row.method && typeof row.method === 'string') {
          const t = row.method.trim()
          if (t) fromRegistered.push(t)
        }
      }
    }

    payload.payment_method = mergeDistinctSorted(payload.payment_method, fromRegistered)

    return NextResponse.json(payload)
  } catch (e) {
    console.error('회사 지출 제안 목록 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
