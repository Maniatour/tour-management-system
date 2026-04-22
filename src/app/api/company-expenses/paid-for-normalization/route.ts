import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type StatRow = { paid_for: string; count: number; paid_for_label_id: string | null }

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('company_expense_paid_for_normalization_stats')

    if (error) {
      console.error('결제 내용 정규화 통계 RPC 오류:', error)
      return NextResponse.json({ error: '통계를 불러올 수 없습니다.' }, { status: 500 })
    }

    let raw: unknown = data
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw) as unknown
      } catch {
        raw = []
      }
    }

    const parsed: StatRow[] = []
    if (Array.isArray(raw)) {
      for (const r of raw) {
        if (r && typeof r === 'object') {
          const o = r as Record<string, unknown>
          parsed.push({
            paid_for: String(o.paid_for ?? ''),
            count: Number(o.count ?? 0),
            paid_for_label_id: (o.paid_for_label_id as string | null) ?? null,
          })
        }
      }
    }

    return NextResponse.json({ data: parsed })
  } catch (e) {
    console.error('결제 내용 정규화 통계 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
