import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: 결제 방법 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userEmail = searchParams.get('user_email')
    const status = searchParams.get('status')
    const methodType = searchParams.get('method_type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('payment_methods')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 필터 적용
    if (userEmail) {
      query = query.eq('user_email', userEmail)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (methodType) {
      query = query.eq('method_type', methodType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching payment methods:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch payment methods', error: error.message },
        { status: 500 }
      )
    }

    // team 정보 별도 조회
    const paymentMethods = data || []
    const userEmails = [...new Set(paymentMethods.map((pm: any) => pm.user_email).filter(Boolean))]
    
    let teamMap: Record<string, { email: string; name_ko: string | null; name_en: string | null }> = {}
    if (userEmails.length > 0) {
      const { data: teamData } = await supabase
        .from('team')
        .select('email, name_ko, name_en')
        .in('email', userEmails)
      
      if (teamData) {
        teamData.forEach(team => {
          teamMap[team.email] = {
            email: team.email,
            name_ko: team.name_ko,
            name_en: team.name_en
          }
        })
      }
    }

    // team 정보 추가
    const paymentMethodsWithTeam = paymentMethods.map((pm: any) => ({
      ...pm,
      team: teamMap[pm.user_email] || null
    }))

    return NextResponse.json({
      success: true,
      data: paymentMethodsWithTeam
    })

  } catch (error) {
    console.error('Error in GET /api/payment-methods:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: 결제 방법 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      method,
      method_type = 'card',
      user_email,
      limit_amount,
      status = 'active',
      card_number_last4,
      card_type,
      card_holder_name,
      expiry_date,
      monthly_limit,
      daily_limit,
      notes,
      created_by
    } = body

    // 필수 필드 검증
    if (!id || !method) {
      return NextResponse.json(
        { success: false, message: 'ID and method are required' },
        { status: 400 }
      )
    }

    // 기존 데이터 확인
    const { data: existing } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('id', id)
      .single()

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Payment method with this ID already exists' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        id,
        method,
        method_type,
        user_email: user_email || null,
        limit_amount: limit_amount ? parseFloat(limit_amount) : null,
        status,
        card_number_last4: card_number_last4 || null,
        card_type: card_type || null,
        card_holder_name: card_holder_name || null,
        expiry_date: expiry_date && expiry_date.trim() !== '' ? expiry_date : null,
        monthly_limit: monthly_limit ? parseFloat(monthly_limit) : null,
        daily_limit: daily_limit ? parseFloat(daily_limit) : null,
        notes: notes || null,
        created_by: created_by || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating payment method:', error)
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to create payment method',
          error: error.message,
          details: error
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Error in POST /api/payment-methods:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    )
  }
}

// PUT: 결제 방법 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID is required' },
        { status: 400 }
      )
    }

    // 금액 필드 검증
    if (updateData.limit_amount && (isNaN(updateData.limit_amount) || updateData.limit_amount < 0)) {
      return NextResponse.json(
        { success: false, message: 'Invalid limit amount' },
        { status: 400 }
      )
    }

    if (updateData.monthly_limit && (isNaN(updateData.monthly_limit) || updateData.monthly_limit < 0)) {
      return NextResponse.json(
        { success: false, message: 'Invalid monthly limit' },
        { status: 400 }
      )
    }

    if (updateData.daily_limit && (isNaN(updateData.daily_limit) || updateData.daily_limit < 0)) {
      return NextResponse.json(
        { success: false, message: 'Invalid daily limit' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating payment method:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to update payment method' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Error in PUT /api/payment-methods:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: 결제 방법 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting payment method:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to delete payment method' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method deleted successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/payment-methods:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
