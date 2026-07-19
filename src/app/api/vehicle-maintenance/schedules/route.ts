import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { lookupVehicleOperatorId } from '@/lib/operators/lookupVehicleOperatorId'

export const dynamic = 'force-dynamic'

const SCHEDULE_SELECT =
  'id, vehicle_id, catalog_code, is_enabled, custom_mileage_interval, custom_month_interval, last_service_date, last_service_mileage, next_due_mileage, next_due_date, notes, last_maintenance_id, operator_id'

function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

function parseOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const vehicleId = request.nextUrl.searchParams.get('vehicle_id')
    const operatorId = resolveOperatorId(request.nextUrl.searchParams.get('operatorId'))

    let query = supabase
      .from('vehicle_maintenance_schedules')
      .select(SCHEDULE_SELECT)
      .eq('operator_id', operatorId)

    if (vehicleId && vehicleId !== 'all') {
      query = query.eq('vehicle_id', vehicleId)
    }

    const { data, error } = await query.order('catalog_code', { ascending: true })

    if (error) {
      console.error('vehicle_maintenance_schedules 조회 오류:', error)
      return NextResponse.json({ error: '정기점검 스케줄을 불러올 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    console.error('vehicle_maintenance_schedules 조회 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

type ScheduleUpsertBody = {
  vehicle_id?: string
  catalog_code?: string
  is_enabled?: boolean
  custom_mileage_interval?: number | string | null
  custom_month_interval?: number | string | null
  last_service_date?: string | null
  last_service_mileage?: number | string | null
  next_due_mileage?: number | string | null
  next_due_date?: string | null
  notes?: string | null
  last_maintenance_id?: string | null
  operatorId?: string | null
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const body = (await request.json()) as ScheduleUpsertBody
    const vehicle_id = parseOptionalString(body.vehicle_id)
    const catalog_code = parseOptionalString(body.catalog_code)

    if (!vehicle_id || !catalog_code) {
      return NextResponse.json({ error: 'vehicle_id와 catalog_code는 필수입니다.' }, { status: 400 })
    }

    const last_service_mileage = parseOptionalInt(body.last_service_mileage)
    const custom_mileage_interval = parseOptionalInt(body.custom_mileage_interval)
    const custom_month_interval = parseOptionalInt(body.custom_month_interval)

    let next_due_mileage = parseOptionalInt(body.next_due_mileage)
    const intervalForCalc = custom_mileage_interval
    if (
      (next_due_mileage == null || next_due_mileage <= 0) &&
      last_service_mileage != null &&
      last_service_mileage > 0 &&
      intervalForCalc != null &&
      intervalForCalc > 0
    ) {
      next_due_mileage = last_service_mileage + intervalForCalc
    }

    const operator_id = await lookupVehicleOperatorId(
      supabase,
      vehicle_id,
      body.operatorId
    )

    const patch = {
      vehicle_id,
      catalog_code,
      operator_id,
      is_enabled: body.is_enabled !== false,
      custom_mileage_interval,
      custom_month_interval,
      last_service_date: parseOptionalString(body.last_service_date),
      last_service_mileage,
      next_due_mileage,
      next_due_date: parseOptionalString(body.next_due_date),
      notes: parseOptionalString(body.notes),
      last_maintenance_id: parseOptionalString(body.last_maintenance_id),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('vehicle_maintenance_schedules')
      .upsert(patch, { onConflict: 'vehicle_id,catalog_code' })
      .select(SCHEDULE_SELECT)
      .single()

    if (error) {
      console.error('vehicle_maintenance_schedules 저장 오류:', error)
      return NextResponse.json({ error: '정기점검 스케줄을 저장할 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('vehicle_maintenance_schedules 저장 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
