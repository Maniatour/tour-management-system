import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import {
  CATALOG_SELECT_FIELDS,
  isValidCategoryGroup,
  isValidIntervalKind,
  parseOptionalInt,
  parseOptionalString,
} from '@/lib/vehicleMaintenanceCatalogApi'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ code: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const { code } = await params
    const catalogCode = decodeURIComponent(code).trim()
    if (!catalogCode) {
      return NextResponse.json({ error: 'code가 필요합니다.' }, { status: 400 })
    }

    const body = await request.json()
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    const label_ko = parseOptionalString(body.label_ko)
    if (label_ko !== undefined) {
      if (!label_ko) {
        return NextResponse.json({ error: 'label_ko는 비울 수 없습니다.' }, { status: 400 })
      }
      patch.label_ko = label_ko
    }

    if (body.label_en !== undefined) {
      patch.label_en = parseOptionalString(body.label_en)
    }

    const category_group = parseOptionalString(body.category_group)
    if (category_group !== undefined) {
      if (!category_group || !isValidCategoryGroup(category_group)) {
        return NextResponse.json({ error: '유효한 분류(category_group)가 필요합니다.' }, { status: 400 })
      }
      patch.category_group = category_group
    }

    if (body.default_mileage_interval !== undefined) {
      patch.default_mileage_interval = parseOptionalInt(body.default_mileage_interval)
    }
    if (body.default_month_interval !== undefined) {
      patch.default_month_interval = parseOptionalInt(body.default_month_interval)
    }

    if (body.interval_kind !== undefined) {
      const kind = parseOptionalString(body.interval_kind)
      if (!kind || !isValidIntervalKind(kind)) {
        return NextResponse.json({ error: '유효한 interval_kind가 필요합니다.' }, { status: 400 })
      }
      patch.interval_kind = kind
    }

    if (body.legacy_subcategory !== undefined) {
      patch.legacy_subcategory = parseOptionalString(body.legacy_subcategory)
    }
    if (body.notes_ko !== undefined) {
      patch.notes_ko = parseOptionalString(body.notes_ko)
    }
    if (body.notes_en !== undefined) {
      patch.notes_en = parseOptionalString(body.notes_en)
    }

    if (body.sort_order !== undefined) {
      const n = parseOptionalInt(body.sort_order)
      if (n != null) patch.sort_order = n
    }

    if (body.is_active !== undefined) {
      patch.is_active = Boolean(body.is_active)
    }

    const { data, error } = await supabase
      .from('vehicle_maintenance_catalog')
      .update(patch as never)
      .eq('code', catalogCode)
      .select(CATALOG_SELECT_FIELDS)
      .single()

    if (error) {
      console.error('vehicle_maintenance_catalog 수정 오류:', error)
      return NextResponse.json({ error: '항목을 수정할 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('vehicle_maintenance_catalog 수정 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/** 비활성화(소프트 삭제) */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const { code } = await params
    const catalogCode = decodeURIComponent(code).trim()
    if (!catalogCode) {
      return NextResponse.json({ error: 'code가 필요합니다.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('vehicle_maintenance_catalog')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('code', catalogCode)
      .select('code, is_active')
      .single()

    if (error) {
      console.error('vehicle_maintenance_catalog 비활성화 오류:', error)
      return NextResponse.json({ error: '비활성화에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('vehicle_maintenance_catalog 비활성화 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
