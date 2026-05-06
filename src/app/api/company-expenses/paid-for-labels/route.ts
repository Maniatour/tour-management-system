import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === '1'

    let q = supabase
      .from('company_expense_paid_for_labels')
      .select('id, code, label_ko, label_en, links_vehicle_maintenance, sort_order, is_active')
      .order('sort_order', { ascending: true })

    if (!includeInactive) {
      q = q.eq('is_active', true)
    }

    const { data, error } = await q

    if (error) {
      console.error('paid_for 라벨 조회 오류:', error)
      return NextResponse.json({ error: '라벨 목록을 불러올 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    console.error('paid_for 라벨 조회 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

function slugCode(input: string): string {
  const t = input.trim().toLowerCase().replace(/\s+/g, '_')
  const cleaned = t.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return cleaned.slice(0, 80) || 'label'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const body = await request.json()
    const label_ko = typeof body.label_ko === 'string' ? body.label_ko.trim() : ''
    if (!label_ko) {
      return NextResponse.json({ error: 'label_ko는 필수입니다.' }, { status: 400 })
    }

    const codeRaw = typeof body.code === 'string' ? body.code.trim() : ''
    const code = codeRaw ? slugCode(codeRaw) : slugCode(label_ko)

    const label_en = typeof body.label_en === 'string' && body.label_en.trim() !== '' ? body.label_en.trim() : null
    const links_vehicle_maintenance = Boolean(body.links_vehicle_maintenance)
    const sort_order =
      typeof body.sort_order === 'number' && !Number.isNaN(body.sort_order)
        ? Math.floor(body.sort_order)
        : typeof body.sort_order === 'string' && body.sort_order.trim() !== ''
          ? parseInt(body.sort_order, 10) || 0
          : 0

    const { data, error } = await supabase
      .from('company_expense_paid_for_labels')
      .insert({
        code,
        label_ko,
        label_en,
        links_vehicle_maintenance,
        sort_order,
        is_active: true,
      })
      .select('id, code, label_ko, label_en, links_vehicle_maintenance, sort_order, is_active')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 사용 중인 code 입니다. code를 바꿔 주세요.' }, { status: 409 })
      }
      console.error('paid_for 라벨 생성 오류:', error)
      return NextResponse.json({ error: '라벨을 생성할 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (e) {
    console.error('paid_for 라벨 생성 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
