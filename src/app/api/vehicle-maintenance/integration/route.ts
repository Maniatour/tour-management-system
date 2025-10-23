import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/database.types'

type CompanyExpenseInsert = Database['public']['Tables']['company_expenses']['Insert']
type VehicleMaintenanceInsert = Database['public']['Tables']['vehicle_maintenance']['Insert']

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const {
      // 차량 정비 정보
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
      
      // 회사 지출 정보
      submit_by,
      payment_method,
      accounting_period,
      expense_type,
      tax_deductible
    } = body
    
    // 필수 필드 검증
    if (!vehicle_id || !maintenance_date || !maintenance_type || !category || !description || !total_cost || !submit_by) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }
    
    // 차량 정보 조회
    const { data: vehicleData, error: vehicleError } = await supabase
      .from('vehicles')
      .select('car_name, license_plate')
      .eq('id', vehicle_id)
      .single()
    
    if (vehicleError || !vehicleData) {
      return NextResponse.json({ error: '차량 정보를 찾을 수 없습니다.' }, { status: 404 })
    }
    
    // 회사 지출 데이터 생성
    const expenseId = `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const expenseData: CompanyExpenseInsert = {
      id: expenseId,
      paid_to: service_provider || '정비소',
      paid_for: `${vehicleData.car_name} (${vehicleData.license_plate}) - ${description}`,
      description: `차량 정비: ${category} - ${subcategory || description}`,
      amount: parseFloat(total_cost),
      payment_method: payment_method || null,
      submit_by,
      category: 'vehicle',
      subcategory: 'maintenance',
      status: 'pending',
      accounting_period: accounting_period || new Date().toISOString().slice(0, 7), // YYYY-MM
      expense_type: expense_type || 'maintenance',
      tax_deductible: tax_deductible !== undefined ? tax_deductible : true,
      vehicle_id,
      maintenance_type,
      notes: notes || null,
      attachments: receipts || null
    }
    
    // 차량 정비 데이터 생성
    const maintenanceId = `MAINT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const maintenanceData: VehicleMaintenanceInsert = {
      id: maintenanceId,
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
      company_expense_id: expenseId
    }
    
    // 트랜잭션으로 두 테이블에 동시 삽입
    const { data: expenseResult, error: expenseError } = await supabase
      .from('company_expenses')
      .insert(expenseData)
      .select()
      .single()
    
    if (expenseError) {
      console.error('회사 지출 생성 오류:', expenseError)
      return NextResponse.json({ error: '회사 지출을 생성할 수 없습니다.' }, { status: 500 })
    }
    
    const { data: maintenanceResult, error: maintenanceError } = await supabase
      .from('vehicle_maintenance')
      .insert(maintenanceData)
      .select()
      .single()
    
    if (maintenanceError) {
      console.error('차량 정비 생성 오류:', maintenanceError)
      // 롤백: 생성된 회사 지출 삭제
      await supabase.from('company_expenses').delete().eq('id', expenseId)
      return NextResponse.json({ error: '차량 정비 기록을 생성할 수 없습니다.' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      data: {
        expense: expenseResult,
        maintenance: maintenanceResult
      }
    }, { status: 201 })
  } catch (error) {
    console.error('차량 정비 및 회사 지출 연동 생성 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    const vehicleId = searchParams.get('vehicle_id')
    const maintenanceId = searchParams.get('maintenance_id')
    const expenseId = searchParams.get('expense_id')
    
    let query = supabase
      .from('vehicle_maintenance')
      .select(`
        *,
        vehicles (
          id,
          car_name,
          license_plate
        ),
        company_expenses (
          id,
          amount,
          status,
          submit_by,
          submit_on
        )
      `)
    
    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId)
    }
    
    if (maintenanceId) {
      query = query.eq('id', maintenanceId)
    }
    
    if (expenseId) {
      query = query.eq('company_expense_id', expenseId)
    }
    
    const { data, error } = await query.order('maintenance_date', { ascending: false })
    
    if (error) {
      console.error('연동 데이터 조회 오류:', error)
      return NextResponse.json({ error: '연동 데이터를 조회할 수 없습니다.' }, { status: 500 })
    }
    
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('연동 데이터 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
