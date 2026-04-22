import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX = 5_000

/**
 * 리포트용: 차량(vehicle_id)에 연결된 회사 지출 전체(제출일·내용·금액).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  try {
    const { vehicleId } = await params
    if (!vehicleId) {
      return NextResponse.json({ error: 'vehicleId가 없습니다.' }, { status: 400 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('company_expenses')
      .select(
        'id, submit_on, amount, paid_to, paid_for, description, notes, status, category, subcategory, payment_method, submit_by, photo_url, attachments, expense_type, tax_deductible, vehicle_id, maintenance_type'
      )
      .eq('vehicle_id', vehicleId)
      .order('submit_on', { ascending: true, nullsFirst: false })
      .limit(MAX)

    if (error) {
      console.error('vehicle expense detail:', error)
      return NextResponse.json({ error: '지출을 불러오지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (e) {
    console.error('vehicle expense detail:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
