import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/database.types'

type VehicleMaintenance = Database['public']['Tables']['vehicle_maintenance']['Row']
type VehicleMaintenanceUpdate = Database['public']['Tables']['vehicle_maintenance']['Update']

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { id } = params
    
    const { data, error } = await supabase
      .from('vehicle_maintenance')
      .select(`
        *,
        vehicles (
          id,
          vehicle_number,
          vehicle_type,
          vehicle_category
        ),
        company_expenses (
          id,
          amount,
          status
        )
      `)
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { id } = params
    const body = await request.json()
    
    // 숫자 필드 변환
    if (body.total_cost) {
      body.total_cost = parseFloat(body.total_cost)
    }
    if (body.labor_cost) {
      body.labor_cost = parseFloat(body.labor_cost)
    }
    if (body.parts_cost) {
      body.parts_cost = parseFloat(body.parts_cost)
    }
    if (body.other_cost) {
      body.other_cost = parseFloat(body.other_cost)
    }
    if (body.mileage) {
      body.mileage = parseInt(body.mileage)
    }
    if (body.warranty_period) {
      body.warranty_period = parseInt(body.warranty_period)
    }
    if (body.next_maintenance_mileage) {
      body.next_maintenance_mileage = parseInt(body.next_maintenance_mileage)
    }
    if (body.maintenance_interval) {
      body.maintenance_interval = parseInt(body.maintenance_interval)
    }
    if (body.mileage_interval) {
      body.mileage_interval = parseInt(body.mileage_interval)
    }
    if (body.quality_rating) {
      body.quality_rating = parseInt(body.quality_rating)
    }
    if (body.satisfaction_rating) {
      body.satisfaction_rating = parseInt(body.satisfaction_rating)
    }
    
    const { data, error } = await supabase
      .from('vehicle_maintenance')
      .update(body)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('차량 정비 수정 오류:', error)
      return NextResponse.json({ error: '차량 정비 기록을 수정할 수 없습니다.' }, { status: 500 })
    }
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error('차량 정비 수정 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { id } = params
    
    const { error } = await supabase
      .from('vehicle_maintenance')
      .delete()
      .eq('id', id)
    
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
