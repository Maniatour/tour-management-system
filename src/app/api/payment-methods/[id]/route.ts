import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: 특정 결제 방법 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data, error } = await supabase
      .from('payment_methods')
      .select(`
        *,
        team:user_email (
          email,
          name_ko,
          name_en
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching payment method:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch payment method' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Payment method not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Error in GET /api/payment-methods/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: 특정 결제 방법 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // 금액 필드 검증
    if (body.limit_amount && (isNaN(body.limit_amount) || body.limit_amount < 0)) {
      return NextResponse.json(
        { success: false, message: 'Invalid limit amount' },
        { status: 400 }
      )
    }

    if (body.monthly_limit && (isNaN(body.monthly_limit) || body.monthly_limit < 0)) {
      return NextResponse.json(
        { success: false, message: 'Invalid monthly limit' },
        { status: 400 }
      )
    }

    if (body.daily_limit && (isNaN(body.daily_limit) || body.daily_limit < 0)) {
      return NextResponse.json(
        { success: false, message: 'Invalid daily limit' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .update(body)
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

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Payment method not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Error in PUT /api/payment-methods/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: 특정 결제 방법 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

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
    console.error('Error in DELETE /api/payment-methods/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
