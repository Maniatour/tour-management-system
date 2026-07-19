import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { Database } from '@/lib/database.types'
import { syncVehicleMaintenanceFromCompanyExpenses } from '@/lib/vehicleMaintenanceFromCompanyExpense'
import { migrateLegacyVehicleMaintenanceCategories } from '@/lib/vehicleMaintenanceStandardCategory'
import {
  generateVehicleMaintenanceId,
  normalizeVehicleMaintenanceVehicleId,
  parseVehicleMaintenanceBody,
} from '@/lib/vehicleMaintenancePayload'
import { syncVehicleMaintenanceSchedulesFromRecord } from '@/lib/vehicleMaintenanceScheduleSync'
import { maintenanceTypesForFilter } from '@/lib/vehicleMaintenanceType'
import {
  buildCompanyExpenseInsertFromMaintenance,
  fetchExpenseStandardCategoriesForMaintenance,
  resolveMaintenanceExpenseSubmitBy,
} from '@/lib/vehicleMaintenanceCompanyExpense'
import { applyCompanyExpenseVehicleMileage } from '@/lib/companyExpenseVehicleMileage'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { lookupVehicleOperatorId } from '@/lib/operators/lookupVehicleOperatorId'

type VehicleMaintenanceInsert = Database['public']['Tables']['vehicle_maintenance']['Insert']
type CompanyExpenseInsert = Database['public']['Tables']['company_expenses']['Insert']

export const dynamic = 'force-dynamic'

const LIST_LIMIT = 2_000

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const { searchParams } = new URL(request.url)

    const search = (searchParams.get('search') || '').trim()
    const vehicleId = searchParams.get('vehicle_id')
    const maintenanceType = searchParams.get('maintenance_type')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const skipSync = searchParams.get('skip_sync') === '1'
    const operatorId = resolveOperatorId(searchParams.get('operatorId'))

    let syncResult = { imported: 0, skipped: 0, categoriesMigrated: 0 }
    if (!skipSync) {
      syncResult = {
        ...(await syncVehicleMaintenanceFromCompanyExpenses(supabase, { operatorId })),
        categoriesMigrated: await migrateLegacyVehicleMaintenanceCategories(supabase),
      }
    }

    let query = supabase
      .from('vehicle_maintenance')
      .select(
        `
        *,
        vehicles (
          id,
          vehicle_number,
          vehicle_type,
          vehicle_category,
          nick
        ),
        company_expenses!vehicle_maintenance_company_expense_id_fkey (
          payment_method
        )
      `
      )
      .eq('operator_id', operatorId)
      .order('maintenance_date', { ascending: false })
      .limit(LIST_LIMIT)

    if (vehicleId && vehicleId !== 'all') {
      query = query.eq('vehicle_id', vehicleId)
    }
    if (maintenanceType && maintenanceType !== 'all') {
      const types = maintenanceTypesForFilter(maintenanceType)
      if (types?.length === 1) {
        query = query.eq('maintenance_type', types[0])
      } else if (types && types.length > 1) {
        query = query.in('maintenance_type', types)
      }
    }
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (search) {
      const like = `%${search}%`
      query = query.or(
        `description.ilike.${like},service_provider.ilike.${like},notes.ilike.${like},subcategory.ilike.${like}`
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('차량 정비 목록 조회 오류:', error)
      return NextResponse.json({ error: '정비 기록을 불러올 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      data: data ?? [],
      sync: syncResult,
      pagination: {
        page: 1,
        limit: LIST_LIMIT,
        total: data?.length ?? 0,
        totalPages: 1,
      },
    })
  } catch (error) {
    console.error('차량 정비 목록 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase

    const body = (await request.json()) as Record<string, unknown>
    const { maintenance: parsed, payment_method } = parseVehicleMaintenanceBody(body)
    const requestOperatorId = resolveOperatorId(
      typeof body.operatorId === 'string' ? body.operatorId : null
    )

    const vehicle_id = await normalizeVehicleMaintenanceVehicleId(
      supabase,
      parsed.vehicle_id as string | null | undefined
    )
    if (!vehicle_id) {
      return NextResponse.json({ error: '유효한 차량을 선택해 주세요.' }, { status: 400 })
    }

    const {
      maintenance_date,
      maintenance_type,
      category,
      description,
      total_cost,
      mileage,
    } = parsed

    if (
      !maintenance_date ||
      !maintenance_type ||
      !category ||
      !description ||
      total_cost == null ||
      mileage == null ||
      mileage <= 0
    ) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }

    const operator_id = await lookupVehicleOperatorId(supabase, vehicle_id, requestOperatorId)

    const maintenanceData: VehicleMaintenanceInsert = {
      id: generateVehicleMaintenanceId(),
      ...parsed,
      vehicle_id,
      operator_id,
      maintenance_date,
      maintenance_type,
      category,
      description,
      total_cost,
      status: parsed.status || 'completed',
    }
    
    const { data: maintenanceResult, error: maintenanceError } = await supabase
      .from('vehicle_maintenance')
      .insert(maintenanceData)
      .select()
      .single()
    
    if (maintenanceError) {
      console.error('차량 정비 생성 오류:', maintenanceError)
      return NextResponse.json({ error: '차량 정비 기록을 생성할 수 없습니다.' }, { status: 500 })
    }

    // 회사 지출 자동 생성
    let companyExpenseId = null
    try {
      const [standardCats, submitBy] = await Promise.all([
        fetchExpenseStandardCategoriesForMaintenance(supabase),
        resolveMaintenanceExpenseSubmitBy(supabase),
      ])

      const expenseId = `expense_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const expenseData: CompanyExpenseInsert = buildCompanyExpenseInsertFromMaintenance(
        {
          maintenance_date: maintenance_date as string,
          category: category as string,
          subcategory: (parsed.subcategory as string | null | undefined) ?? null,
          description: description as string,
          total_cost: total_cost as number,
          service_provider: (parsed.service_provider as string | null | undefined) ?? null,
          maintenance_type: maintenance_type as string,
          vehicle_id,
          mileage: parsed.mileage ?? null,
        },
        standardCats,
        {
          id: expenseId,
          payment_method,
          submit_by: submitBy,
          autoNotes: `차량 정비 자동 생성 - 정비 ID: ${maintenanceResult.id}`,
          operator_id,
        }
      )

      const { data: expenseResult, error: expenseError } = await supabase
        .from('company_expenses')
        .insert(expenseData)
        .select()
        .single()

      if (expenseError) {
        console.error('회사 지출 자동 생성 오류:', expenseError)
        // 정비는 생성되었지만 지출 생성 실패 - 경고만 로그
      } else {
        companyExpenseId = expenseResult.id

        await applyCompanyExpenseVehicleMileage(supabase, {
          expenseId: companyExpenseId,
          vehicleId: vehicle_id,
          mileage: parsed.mileage,
        })

        // 정비 기록에 회사 지출 ID 업데이트
        await supabase
          .from('vehicle_maintenance')
          .update({ company_expense_id: companyExpenseId })
          .eq('id', maintenanceResult.id)
      }
    } catch (expenseError) {
      console.error('회사 지출 생성 중 예외:', expenseError)
      // 정비는 성공했으므로 계속 진행
    }

    try {
      await syncVehicleMaintenanceSchedulesFromRecord(supabase, maintenanceResult)
    } catch (syncError) {
      console.error('정기점검 스케줄 동기화 오류:', syncError)
    }
    
    return NextResponse.json({ 
      data: maintenanceResult,
      companyExpenseId: companyExpenseId,
      message: companyExpenseId ? '정비 기록과 회사 지출이 자동으로 생성되었습니다.' : '정비 기록이 생성되었습니다. (회사 지출 생성 실패)'
    }, { status: 201 })
  } catch (error) {
    console.error('차량 정비 생성 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id, ...updateData } = body
    
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }
    
    // 숫자 필드 변환
    if (updateData.total_cost) {
      updateData.total_cost = parseFloat(updateData.total_cost)
    }
    if (updateData.labor_cost) {
      updateData.labor_cost = parseFloat(updateData.labor_cost)
    }
    if (updateData.parts_cost) {
      updateData.parts_cost = parseFloat(updateData.parts_cost)
    }
    if (updateData.other_cost) {
      updateData.other_cost = parseFloat(updateData.other_cost)
    }
    if (updateData.mileage) {
      updateData.mileage = parseInt(updateData.mileage)
    }
    if (updateData.warranty_period) {
      updateData.warranty_period = parseInt(updateData.warranty_period)
    }
    if (updateData.next_maintenance_mileage) {
      updateData.next_maintenance_mileage = parseInt(updateData.next_maintenance_mileage)
    }
    if (updateData.maintenance_interval) {
      updateData.maintenance_interval = parseInt(updateData.maintenance_interval)
    }
    if (updateData.mileage_interval) {
      updateData.mileage_interval = parseInt(updateData.mileage_interval)
    }
    if (updateData.quality_rating) {
      updateData.quality_rating = parseInt(updateData.quality_rating)
    }
    if (updateData.satisfaction_rating) {
      updateData.satisfaction_rating = parseInt(updateData.satisfaction_rating)
    }
    
    const { data: maintenanceResult, error: maintenanceError } = await supabase
      .from('vehicle_maintenance')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (maintenanceError) {
      console.error('차량 정비 수정 오류:', maintenanceError)
      return NextResponse.json({ error: '차량 정비 기록을 수정할 수 없습니다.' }, { status: 500 })
    }

    // 연동된 회사 지출이 있으면 업데이트
    if (maintenanceResult.company_expense_id) {
      try {
        const expenseUpdateData: any = {}
        
        if (updateData.total_cost) expenseUpdateData.amount = updateData.total_cost
        if (updateData.service_provider) expenseUpdateData.paid_to = updateData.service_provider
        if (updateData.maintenance_type && updateData.category) {
          expenseUpdateData.paid_for = `${updateData.maintenance_type} - ${updateData.category}`
        }
        if (updateData.description) expenseUpdateData.description = updateData.description
        if (updateData.maintenance_type) expenseUpdateData.maintenance_type = updateData.maintenance_type
        if (updateData.category) expenseUpdateData.subcategory = updateData.category
        if (updateData.notes) expenseUpdateData.notes = updateData.notes

        if (Object.keys(expenseUpdateData).length > 0) {
          await supabase
            .from('company_expenses')
            .update(expenseUpdateData)
            .eq('id', maintenanceResult.company_expense_id)
        }
      } catch (expenseError) {
        console.error('연동된 회사 지출 업데이트 오류:', expenseError)
        // 정비 수정은 성공했으므로 계속 진행
      }
    }
    
    return NextResponse.json({ data: maintenanceResult })
  } catch (error) {
    console.error('차량 정비 수정 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    // 먼저 정비 기록을 조회하여 연동된 회사 지출 ID 확인
    const { data: maintenance, error: fetchError } = await supabase
      .from('vehicle_maintenance')
      .select('company_expense_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('정비 기록 조회 오류:', fetchError)
      return NextResponse.json({ error: '정비 기록을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 연동된 회사 지출이 있으면 삭제
    if (maintenance.company_expense_id) {
      try {
        const { error: expenseError } = await supabase
          .from('company_expenses')
          .delete()
          .eq('id', maintenance.company_expense_id)

        if (expenseError) {
          console.error('연동된 회사 지출 삭제 오류:', expenseError)
          // 정비 삭제는 계속 진행
        }
      } catch (expenseError) {
        console.error('회사 지출 삭제 중 예외:', expenseError)
        // 정비 삭제는 계속 진행
      }
    }
    
    // 정비 기록 삭제
    const { error } = await supabase
      .from('vehicle_maintenance')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('차량 정비 삭제 오류:', error)
      return NextResponse.json({ error: '차량 정비 기록을 삭제할 수 없습니다.' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      message: maintenance.company_expense_id 
        ? '차량 정비 기록과 연동된 회사 지출이 삭제되었습니다.' 
        : '차량 정비 기록이 삭제되었습니다.' 
    })
  } catch (error) {
    console.error('차량 정비 삭제 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
