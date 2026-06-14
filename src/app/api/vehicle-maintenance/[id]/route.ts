import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import {
  normalizeVehicleMaintenanceVehicleId,
  parseVehicleMaintenanceBody,
} from '@/lib/vehicleMaintenancePayload'
import { syncVehicleMaintenanceSchedulesFromRecord } from '@/lib/vehicleMaintenanceScheduleSync'
import {
  buildCompanyExpenseUpdateFromMaintenance,
  fetchExpenseStandardCategoriesForMaintenance,
} from '@/lib/vehicleMaintenanceCompanyExpense'
import { applyCompanyExpenseVehicleMileage } from '@/lib/companyExpenseVehicleMileage'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const { id } = await params

    const { data, error } = await supabase
      .from('vehicle_maintenance')
      .select(
        `
        *,
        vehicles (
          id,
          vehicle_number,
          vehicle_type,
          vehicle_category
        ),
        company_expenses!vehicle_maintenance_company_expense_id_fkey (
          id,
          amount,
          status,
          payment_method
        )
      `
      )
      .eq('id', id)
      .single()

    if (error) {
      console.error('차량 정비 조회 오류:', error)
      return NextResponse.json({ error: '차량 정비 기록을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('차량 정비 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const { maintenance: updateData, payment_method } = parseVehicleMaintenanceBody(body)

    if (updateData.vehicle_id !== undefined) {
      updateData.vehicle_id =
        (await normalizeVehicleMaintenanceVehicleId(supabase, updateData.vehicle_id)) ?? null
    }

    if (
      updateData.mileage !== undefined &&
      (updateData.mileage == null || updateData.mileage <= 0)
    ) {
      return NextResponse.json({ error: '마일리지를 입력해 주세요.' }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('vehicle_maintenance')
      .select('company_expense_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('차량 정비 조회 오류:', fetchError)
      return NextResponse.json({ error: '차량 정비 기록을 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('vehicle_maintenance')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('차량 정비 수정 오류:', error)
      return NextResponse.json({ error: '차량 정비 기록을 수정할 수 없습니다.' }, { status: 500 })
    }

    if (existing.company_expense_id) {
      try {
        const standardCats = await fetchExpenseStandardCategoriesForMaintenance(supabase)
        const expenseUpdate = buildCompanyExpenseUpdateFromMaintenance(
          {
            ...(updateData.total_cost !== undefined ? { total_cost: updateData.total_cost as number } : {}),
            ...(updateData.service_provider !== undefined
              ? { service_provider: updateData.service_provider as string | null }
              : {}),
            ...(updateData.description !== undefined
              ? { description: updateData.description as string }
              : {}),
            ...(updateData.category !== undefined ? { category: updateData.category as string } : {}),
            ...(updateData.subcategory !== undefined
              ? { subcategory: updateData.subcategory as string | null }
              : {}),
            ...(updateData.maintenance_type !== undefined
              ? { maintenance_type: updateData.maintenance_type as string }
              : {}),
            ...(updateData.vehicle_id !== undefined
              ? { vehicle_id: updateData.vehicle_id as string }
              : {}),
            ...(updateData.maintenance_date !== undefined
              ? { maintenance_date: updateData.maintenance_date as string }
              : {}),
          },
          standardCats,
          {
            payment_method,
            includePaymentMethod: 'payment_method' in body,
          }
        )

        if (Object.keys(expenseUpdate).length > 0) {
          await supabase
            .from('company_expenses')
            .update(expenseUpdate as never)
            .eq('id', existing.company_expense_id)
        }

        if (updateData.mileage !== undefined || updateData.vehicle_id !== undefined) {
          await applyCompanyExpenseVehicleMileage(supabase, {
            expenseId: existing.company_expense_id,
            vehicleId: (updateData.vehicle_id as string | undefined) ?? data.vehicle_id,
            mileage: updateData.mileage ?? data.mileage,
          })
        }
      } catch (expenseError) {
        console.error('연동된 회사 지출 업데이트 오류:', expenseError)
      }
    }

    try {
      await syncVehicleMaintenanceSchedulesFromRecord(supabase, data)
    } catch (syncError) {
      console.error('정기점검 스케줄 동기화 오류:', syncError)
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('차량 정비 수정 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const { id } = await params

    const { error } = await supabase.from('vehicle_maintenance').delete().eq('id', id)

    if (error) {
      console.error('차량 정비 삭제 오류:', error)
      return NextResponse.json({ error: '차량 정비 기록을 삭제할 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ message: '차량 정비 기록이 삭제되었습니다.' })
  } catch (error) {
    console.error('차량 정비 삭제 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
