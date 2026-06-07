import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import {
  CATALOG_INTERVAL_KINDS,
  CATALOG_SELECT_FIELDS,
  isValidCategoryGroup,
  isValidIntervalKind,
  parseOptionalInt,
  parseOptionalString,
  slugCatalogCode,
} from '@/lib/vehicleMaintenanceCatalogApi'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === '1'
    const group = request.nextUrl.searchParams.get('group')

    let query = supabase.from('vehicle_maintenance_catalog').select(CATALOG_SELECT_FIELDS)

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }
    if (group && group !== 'all') {
      query = query.eq('category_group', group)
    }

    const { data, error } = await query
      .order('category_group', { ascending: true })
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('vehicle_maintenance_catalog 조회 오류:', error)
      return NextResponse.json({ error: '정비 항목 카탈로그를 불러올 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    console.error('vehicle_maintenance_catalog 조회 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const body = await request.json()
    const label_ko = parseOptionalString(body.label_ko)
    if (!label_ko) {
      return NextResponse.json({ error: 'label_ko는 필수입니다.' }, { status: 400 })
    }

    const codeRaw = parseOptionalString(body.code)
    const code = codeRaw ? slugCatalogCode(codeRaw) : slugCatalogCode(label_ko)

    const category_group = parseOptionalString(body.category_group)
    if (!category_group || !isValidCategoryGroup(category_group)) {
      return NextResponse.json({ error: '유효한 분류(category_group)가 필요합니다.' }, { status: 400 })
    }

    const interval_kind = parseOptionalString(body.interval_kind) ?? 'mileage'
    if (!isValidIntervalKind(interval_kind)) {
      return NextResponse.json(
        { error: `interval_kind는 ${CATALOG_INTERVAL_KINDS.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      )
    }

    const sort_order = parseOptionalInt(body.sort_order) ?? 0

    const row = {
      code,
      label_ko,
      label_en: parseOptionalString(body.label_en),
      category_group,
      default_mileage_interval: parseOptionalInt(body.default_mileage_interval) ?? null,
      default_month_interval: parseOptionalInt(body.default_month_interval) ?? null,
      interval_kind,
      legacy_subcategory: parseOptionalString(body.legacy_subcategory),
      sort_order,
      is_active: body.is_active !== false,
      notes_ko: parseOptionalString(body.notes_ko),
      notes_en: parseOptionalString(body.notes_en),
    }

    const { data, error } = await supabase
      .from('vehicle_maintenance_catalog')
      .insert(row)
      .select(CATALOG_SELECT_FIELDS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 사용 중인 code입니다.' }, { status: 409 })
      }
      console.error('vehicle_maintenance_catalog 생성 오류:', error)
      return NextResponse.json({ error: '항목을 생성할 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (e) {
    console.error('vehicle_maintenance_catalog 생성 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
