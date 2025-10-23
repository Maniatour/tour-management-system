import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/database.types'

type CompanyExpense = Database['public']['Tables']['company_expenses']['Row']
type CompanyExpenseUpdate = Database['public']['Tables']['company_expenses']['Update']

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { id } = params
    
    const { data, error } = await supabase
      .from('company_expenses')
      .select(`
        *,
        vehicles (
          id,
          vehicle_number,
          vehicle_type,
          vehicle_category
        )
      `)
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('회사 지출 조회 오류:', error)
      return NextResponse.json({ error: '회사 지출을 찾을 수 없습니다.' }, { status: 404 })
    }
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error('회사 지출 조회 오류:', error)
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
    
    // 금액이 있으면 숫자로 변환
    if (body.amount) {
      body.amount = parseFloat(body.amount)
    }
    
    const { data, error } = await supabase
      .from('company_expenses')
      .update(body)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('회사 지출 수정 오류:', error)
      return NextResponse.json({ error: '회사 지출을 수정할 수 없습니다.' }, { status: 500 })
    }
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error('회사 지출 수정 오류:', error)
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
      .from('company_expenses')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('회사 지출 삭제 오류:', error)
      return NextResponse.json({ error: '회사 지출을 삭제할 수 없습니다.' }, { status: 500 })
    }
    
    return NextResponse.json({ message: '회사 지출이 삭제되었습니다.' })
  } catch (error) {
    console.error('회사 지출 삭제 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
