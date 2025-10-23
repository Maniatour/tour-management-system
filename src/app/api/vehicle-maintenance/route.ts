import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/database.types'

type VehicleMaintenance = Database['public']['Tables']['vehicle_maintenance']['Row']
type VehicleMaintenanceInsert = Database['public']['Tables']['vehicle_maintenance']['Insert']
type VehicleMaintenanceUpdate = Database['public']['Tables']['vehicle_maintenance']['Update']
type CompanyExpenseInsert = Database['public']['Tables']['company_expenses']['Insert']

export async function GET() {
  return Response.json({
    data: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1
    },
    message: 'vehicle_maintenance API는 아직 구현 중입니다.'
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const {
      vehicle_id,
      maintenance_date,
      mileage,
      maintenance_type,
      category,
      subcategory,
      description,
      total_cost,
      labor_cost,
      parts_cost,
      other_cost,
      service_provider,
      service_provider_contact,
      service_provider_address,
      warranty_period,
      warranty_notes,
      is_scheduled_maintenance,
      next_maintenance_date,
      next_maintenance_mileage,
      maintenance_interval,
      mileage_interval,
      parts_replaced,
      parts_cost_breakdown,
      quality_rating,
      satisfaction_rating,
      issues_found,
      recommendations,
      photos,
      receipts,
      documents,
      notes,
      technician_notes,
      status,
      payment_method
    } = body
    
    // 필수 필드 검증
    if (!vehicle_id || !maintenance_date || !maintenance_type || !category || !description || !total_cost) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }
    
    const maintenanceData: VehicleMaintenanceInsert = {
      vehicle_id,
      maintenance_date,
      mileage: mileage ? parseInt(mileage) : null,
      maintenance_type,
      category,
      subcategory: subcategory || null,
      description,
      total_cost: parseFloat(total_cost),
      labor_cost: labor_cost ? parseFloat(labor_cost) : null,
      parts_cost: parts_cost ? parseFloat(parts_cost) : null,
      other_cost: other_cost ? parseFloat(other_cost) : null,
      service_provider: service_provider || null,
      service_provider_contact: service_provider_contact || null,
      service_provider_address: service_provider_address || null,
      warranty_period: warranty_period ? parseInt(warranty_period) : null,
      warranty_notes: warranty_notes || null,
      is_scheduled_maintenance: is_scheduled_maintenance || false,
      next_maintenance_date: next_maintenance_date || null,
      next_maintenance_mileage: next_maintenance_mileage ? parseInt(next_maintenance_mileage) : null,
      maintenance_interval: maintenance_interval ? parseInt(maintenance_interval) : null,
      mileage_interval: mileage_interval ? parseInt(mileage_interval) : null,
      parts_replaced: parts_replaced || null,
      parts_cost_breakdown: parts_cost_breakdown || null,
      quality_rating: quality_rating ? parseInt(quality_rating) : null,
      satisfaction_rating: satisfaction_rating ? parseInt(satisfaction_rating) : null,
      issues_found: issues_found || null,
      recommendations: recommendations || null,
      photos: photos || null,
      receipts: receipts || null,
      documents: documents || null,
      notes: notes || null,
      technician_notes: technician_notes || null,
      status: status || 'completed',
      payment_method: payment_method || null
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
      const expenseData: CompanyExpenseInsert = {
        id: `expense_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        paid_to: service_provider || '정비업체',
        paid_for: `${maintenance_type} - ${category}`,
        description: description,
        amount: parseFloat(total_cost),
        payment_method: payment_method || '현금', // 사용자가 선택한 결제 방법 사용
        submit_by: 'system', // 시스템 자동 생성
        category: 'vehicle_maintenance',
        subcategory: category,
        vehicle_id: vehicle_id,
        maintenance_type: maintenance_type,
        notes: `차량 정비 자동 생성 - 정비 ID: ${maintenanceResult.id}`,
        expense_type: 'maintenance',
        tax_deductible: true,
        status: 'pending'
      }

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
    const supabase = createClient()
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
    const supabase = createClient()
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
