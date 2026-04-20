import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/database.types'

type CompanyExpense = Database['public']['Tables']['company_expenses']['Row']
type CompanyExpenseInsert = Database['public']['Tables']['company_expenses']['Insert']
type CompanyExpenseUpdate = Database['public']['Tables']['company_expenses']['Update']

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    // 쿼리 파라미터 추출
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const vehicleId = searchParams.get('vehicle_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '20', 10)))
    const from = (page - 1) * limit
    const to = from + limit - 1
    
    // 기본 쿼리 생성 (count 포함)
    let query = supabase
      .from('company_expenses')
      .select('*', { count: 'exact' })
      .order('submit_on', { ascending: false })
      .range(from, to)
    
    // 검색 필터: 결제처·내용·설명·결제방법 ID 부분일치 + payment_methods 표시명/방법명/ID 일치 시 해당 ID 행 포함
    if (search && search.trim()) {
      const raw = search.trim()
      const like = `%${raw}%`
      const orParts = [
        `paid_to.ilike.${like}`,
        `paid_for.ilike.${like}`,
        `description.ilike.${like}`,
        `payment_method.ilike.${like}`,
      ]
      const { data: pmRows } = await supabase
        .from('payment_methods')
        .select('id')
        .or(`method.ilike.${like},display_name.ilike.${like},id.ilike.${like}`)
      const pmIds = [...new Set((pmRows || []).map((r: { id: string }) => r.id))].slice(0, 200)
      if (pmIds.length > 0) {
        orParts.push(`payment_method.in.(${pmIds.join(',')})`)
      }
      query = query.or(orParts.join(','))
    }
    
    // 카테고리 필터
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }
    
    // 상태 필터
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    // 차량 필터
    if (vehicleId && vehicleId !== 'all') {
      query = query.eq('vehicle_id', vehicleId)
    }

    // 지출일(submit_on) 구간 — YYYY-MM-DD
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      query = query.gte('submit_on', `${dateFrom}T00:00:00.000Z`)
    }
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      query = query.lte('submit_on', `${dateTo}T23:59:59.999Z`)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      console.error('회사 지출 조회 오류:', error)
      return NextResponse.json({ error: '회사 지출을 조회할 수 없습니다.' }, { status: 500 })
    }
    
    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / limit))
    
    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    })
  } catch (error) {
    console.error('회사 지출 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
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
      submit_on,
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
    
    // 필수 필드 검증 (ID는 자동 생성되므로 제외)
    const paymentMethodTrimmed =
      typeof payment_method === 'string' ? payment_method.trim() : ''
    if (!paid_to || !paid_for || !amount || !submit_by || !paymentMethodTrimmed) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }
    
    const submitOnIso =
      typeof submit_on === 'string' && submit_on.trim() !== '' ? submit_on.trim() : undefined

    const expenseData: CompanyExpenseInsert = {
      // ID는 자동 생성되므로 제공되지 않은 경우 undefined로 설정
      ...(id && { id }),
      paid_to,
      paid_for,
      description: description || null,
      amount: parseFloat(amount),
      payment_method: paymentMethodTrimmed,
      submit_by,
      ...(submitOnIso !== undefined && { submit_on: submitOnIso }),
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
