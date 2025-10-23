import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: 특정 예약 지출 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data, error } = await supabase
      .from('reservation_expenses')
      .select(`
        *,
        reservations (
          id,
          customer_id,
          product_id
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching reservation expense:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch reservation expense' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Reservation expense not found' },
        { status: 404 }
      )
    }

    // 고객 정보 추가
    let expenseWithCustomer = data
    if (data.reservations && data.reservations.customer_id) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, name, email')
        .eq('id', data.reservations.customer_id)
        .single()

      expenseWithCustomer = {
        ...data,
        reservations: {
          ...data.reservations,
          customers: customerData || { name: 'Unknown', email: '' }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: expenseWithCustomer
    })

  } catch (error) {
    console.error('Error in GET /api/reservation-expenses/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: 특정 예약 지출 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // 금액이 있으면 검증
    if (body.amount && (isNaN(body.amount) || body.amount <= 0)) {
      return NextResponse.json(
        { success: false, message: 'Invalid amount' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('reservation_expenses')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating reservation expense:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to update reservation expense' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Reservation expense not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Error in PUT /api/reservation-expenses/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: 특정 예약 지출 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { error } = await supabase
      .from('reservation_expenses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting reservation expense:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to delete reservation expense' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Reservation expense deleted successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/reservation-expenses/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
