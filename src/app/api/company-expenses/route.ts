import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/database.types'

type CompanyExpense = Database['public']['Tables']['company_expenses']['Row']
type CompanyExpenseInsert = Database['public']['Tables']['company_expenses']['Insert']
type CompanyExpenseUpdate = Database['public']['Tables']['company_expenses']['Update']

export async function GET() {
  return Response.json({
    data: [],
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1
    },
    message: 'company_expenses API는 아직 구현 중입니다.'
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const {
      id,
      paid_to,
      paid_for,
      description,
      amount,
      payment_method,
      submit_by,
      photo_url,
      category,
      subcategory,
      vehicle_id,
      maintenance_type,
      notes,
      attachments,
      expense_type,
      tax_deductible
    } = body
    
    // 필수 필드 검증
    if (!id || !paid_to || !paid_for || !amount || !submit_by) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }
    
    const expenseData: CompanyExpenseInsert = {
      id,
      paid_to,
      paid_for,
      description: description || null,
      amount: parseFloat(amount),
      payment_method: payment_method || null,
      submit_by,
      photo_url: photo_url || null,
      category: category || null,
      subcategory: subcategory || null,
      vehicle_id: vehicle_id || null,
      maintenance_type: maintenance_type || null,
      notes: notes || null,
      attachments: attachments || null,
      expense_type: expense_type || null,
      tax_deductible: tax_deductible !== undefined ? tax_deductible : true,
      status: 'pending'
    }
    
    const { data, error } = await supabase
      .from('company_expenses')
      .insert(expenseData)
      .select()
      .single()
    
    if (error) {
      console.error('회사 지출 생성 오류:', error)
      return NextResponse.json({ error: '회사 지출을 생성할 수 없습니다.' }, { status: 500 })
    }
    
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('회사 지출 생성 오류:', error)
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
    
    // 금액이 있으면 숫자로 변환
    if (updateData.amount) {
      updateData.amount = parseFloat(updateData.amount)
    }
    
    const { data, error } = await supabase
      .from('company_expenses')
      .update(updateData)
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

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }
    
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
