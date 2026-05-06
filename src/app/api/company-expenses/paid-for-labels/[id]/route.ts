import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'

type RouteParams = Promise<{ id: string }> | { id: string }

async function resolveId(params: RouteParams): Promise<string | undefined> {
  const resolved = await Promise.resolve(params)
  return resolved?.id
}

export async function PATCH(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const id = await resolveId(params)
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const body = await request.json()
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (typeof body.code === 'string' && body.code.trim() !== '') {
      patch.code = body.code.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 80)
    }
    if (typeof body.label_ko === 'string') {
      const v = body.label_ko.trim()
      if (!v) return NextResponse.json({ error: 'label_ko는 비울 수 없습니다.' }, { status: 400 })
      patch.label_ko = v
    }
    if (body.label_en !== undefined) {
      patch.label_en =
        typeof body.label_en === 'string' && body.label_en.trim() !== '' ? body.label_en.trim() : null
    }
    if (body.links_vehicle_maintenance !== undefined) {
      patch.links_vehicle_maintenance = Boolean(body.links_vehicle_maintenance)
    }
    if (body.sort_order !== undefined) {
      const n = typeof body.sort_order === 'number' ? body.sort_order : parseInt(String(body.sort_order), 10)
      if (!Number.isNaN(n)) patch.sort_order = Math.floor(n)
    }
    if (body.is_active !== undefined) {
      patch.is_active = Boolean(body.is_active)
    }

    const { data, error } = await supabase
      .from('company_expense_paid_for_labels')
      .update(patch)
      .eq('id', id)
      .select('id, code, label_ko, label_en, links_vehicle_maintenance, sort_order, is_active')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'code가 중복됩니다.' }, { status: 409 })
      }
      console.error('paid_for 라벨 수정 오류:', error)
      return NextResponse.json({ error: '라벨을 수정할 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('paid_for 라벨 수정 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/** 비활성화(소프트 삭제). 참조 중인 지출이 있어도 안전합니다. */
export async function DELETE(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const id = await resolveId(params)
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('company_expense_paid_for_labels')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, is_active')
      .single()

    if (error) {
      console.error('paid_for 라벨 비활성화 오류:', error)
      return NextResponse.json({ error: '비활성화에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('paid_for 라벨 비활성화 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
