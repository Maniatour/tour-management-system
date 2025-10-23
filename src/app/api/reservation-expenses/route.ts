import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: 예약 지출 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('reservation_id')
    const status = searchParams.get('status')
    const submittedBy = searchParams.get('submitted_by')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('reservation_expenses')
      .select(`
        *,
        reservations (
          id,
          customer_id,
          product_id
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 필터 적용
    if (reservationId) {
      query = query.eq('reservation_id', reservationId)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (submittedBy) {
      query = query.eq('submitted_by', submittedBy)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching reservation expenses:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch reservation expenses' },
        { status: 500 }
      )
    }

    // 고객 정보 추가
    const expensesWithCustomers = await Promise.all((data || []).map(async (expense) => {
      if (expense.reservations && expense.reservations.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('id, name, email')
          .eq('id', expense.reservations.customer_id)
          .single()

        return {
          ...expense,
          reservations: {
            ...expense.reservations,
            customers: customerData || { name: 'Unknown', email: '' }
          }
        }
      }
      return expense
    }))

    return NextResponse.json({
      success: true,
      data: expensesWithCustomers
    })

  } catch (error) {
    console.error('Error in GET /api/reservation-expenses:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: 예약 지출 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      submitted_by,
      paid_to,
      paid_for,
      amount,
      payment_method,
      note,
      image_url,
      file_path,
      reservation_id,
      event_id,
      status = 'pending'
    } = body

    // 필수 필드 검증
    if (!id || !submitted_by || !paid_to || !paid_for || !amount) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 금액 검증
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid amount' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('reservation_expenses')
      .insert({
        id,
        submitted_by,
        paid_to,
        paid_for,
        amount: parseFloat(amount),
        payment_method,
        note,
        image_url,
        file_path,
        reservation_id,
        event_id,
        status
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating reservation expense:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to create reservation expense' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Error in POST /api/reservation-expenses:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: 예약 지출 수정
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

    // 금액이 있으면 검증
    if (updateData.amount && (isNaN(updateData.amount) || updateData.amount <= 0)) {
      return NextResponse.json(
        { success: false, message: 'Invalid amount' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('reservation_expenses')
      .update(updateData)
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

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Error in PUT /api/reservation-expenses:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: 예약 지출 삭제
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
    console.error('Error in DELETE /api/reservation-expenses:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
