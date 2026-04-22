import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteParams = Promise<{ id: string }> | { id: string }

async function resolveId(params: RouteParams): Promise<string | undefined> {
  const resolved = await Promise.resolve(params)
  return resolved?.id
}

export async function GET(
  _request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const supabase = createClient()
    const id = await resolveId(params)
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const { data: expense, error: exErr } = await supabase
      .from('company_expenses')
      .select('id, vehicle_id, paid_for_label_id')
      .eq('id', id)
      .maybeSingle()

    if (exErr || !expense) {
      return NextResponse.json({ error: '지출을 찾을 수 없습니다.' }, { status: 404 })
    }

    const vehicleId = expense.vehicle_id
    if (!vehicleId) {
      return NextResponse.json({
        expense,
        candidates: [] as unknown[],
        linkedIds: [] as string[],
      })
    }

    const { data: links, error: linkErr } = await supabase
      .from('company_expense_vehicle_maintenance_links')
      .select('vehicle_maintenance_id')
      .eq('company_expense_id', id)

    if (linkErr) {
      console.error('정비 연결 조회 오류:', linkErr)
      return NextResponse.json({ error: '연결 정보를 불러올 수 없습니다.' }, { status: 500 })
    }

    const linkedIds = (links || []).map((r) => r.vehicle_maintenance_id)

    const { data: candidates, error: cErr } = await supabase
      .from('vehicle_maintenance')
      .select(
        'id, maintenance_date, maintenance_type, category, subcategory, description, total_cost, status, vehicle_id'
      )
      .eq('vehicle_id', vehicleId)
      .order('maintenance_date', { ascending: false })
      .limit(200)

    if (cErr) {
      console.error('정비 후보 조회 오류:', cErr)
      return NextResponse.json({ error: '정비 목록을 불러올 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      expense,
      candidates: candidates ?? [],
      linkedIds,
    })
  } catch (e) {
    console.error('정비 연결 GET 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const supabase = createClient()
    const id = await resolveId(params)
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const body = await request.json()
    const maintenanceIds: string[] = Array.isArray(body.maintenanceIds)
      ? body.maintenanceIds.filter((x: unknown) => typeof x === 'string')
      : []

    const { data: expense, error: exErr } = await supabase
      .from('company_expenses')
      .select('id, vehicle_id, paid_for_label_id')
      .eq('id', id)
      .maybeSingle()

    if (exErr || !expense?.vehicle_id) {
      return NextResponse.json({ error: '차량이 지정된 지출만 정비를 연결할 수 있습니다.' }, { status: 400 })
    }

    const vehicleId = expense.vehicle_id

    if (maintenanceIds.length > 0) {
      const { data: rows, error: vErr } = await supabase
        .from('vehicle_maintenance')
        .select('id, vehicle_id')
        .in('id', maintenanceIds)

      if (vErr || !rows || rows.length !== maintenanceIds.length) {
        return NextResponse.json({ error: '일부 정비 ID가 유효하지 않습니다.' }, { status: 400 })
      }
      const wrong = rows.some((r) => r.vehicle_id !== vehicleId)
      if (wrong) {
        return NextResponse.json({ error: '선택한 정비는 이 지출의 차량과 같아야 합니다.' }, { status: 400 })
      }
    }

    await supabase.from('vehicle_maintenance').update({ company_expense_id: null }).eq('company_expense_id', id)

    await supabase.from('company_expense_vehicle_maintenance_links').delete().eq('company_expense_id', id)

    for (const mid of maintenanceIds) {
      await supabase.from('vehicle_maintenance').update({ company_expense_id: null }).eq('id', mid)
    }

    if (maintenanceIds.length > 0) {
      const inserts = maintenanceIds.map((mid) => ({
        company_expense_id: id,
        vehicle_maintenance_id: mid,
      }))
      const { error: insErr } = await supabase.from('company_expense_vehicle_maintenance_links').insert(inserts)
      if (insErr) {
        console.error('정비 연결 삽입 오류:', insErr)
        return NextResponse.json({ error: '연결 저장에 실패했습니다.' }, { status: 500 })
      }

      for (const mid of maintenanceIds) {
        await supabase.from('vehicle_maintenance').update({ company_expense_id: id }).eq('id', mid)
      }
    }

    return NextResponse.json({ ok: true, linkedCount: maintenanceIds.length })
  } catch (e) {
    console.error('정비 연결 PUT 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
