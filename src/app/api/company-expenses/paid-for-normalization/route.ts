import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type StatRow = {
  paid_for: string
  count: number
  paid_for_label_id: string | null
  /** 그룹 내 standard_paid_for 가 비어 있는 지출 건수(RPC 미배포 시 생략 가능) */
  missing_standard_count?: number
  sample_standard_paid_for: string | null
  sample_category: string | null
  sample_expense_type: string | null
}

function optJsonString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  return String(v)
}

export async function GET() {
  try {
    const supabase = await createClient()
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
          let missing_standard_count: number | undefined
          if ('missing_standard_count' in o) {
            const n = Number(o.missing_standard_count)
            if (Number.isFinite(n)) missing_standard_count = n
          }
          parsed.push({
            paid_for: String(o.paid_for ?? ''),
            count: Number(o.count ?? 0),
            paid_for_label_id: (o.paid_for_label_id as string | null) ?? null,
            ...(missing_standard_count !== undefined ? { missing_standard_count } : {}),
            sample_standard_paid_for: optJsonString(o.sample_standard_paid_for),
            sample_category: optJsonString(o.sample_category),
            sample_expense_type: optJsonString(o.sample_expense_type),
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
