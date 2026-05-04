import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

const db = supabaseAdmin ?? supabase

// GET: 예약 지출 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('reservation_id')
    const status = searchParams.get('status')
    const submittedBy = searchParams.get('submitted_by')
    /** all | unmatched — 명세 대조 미연결 지출만 */
    const statementMatch = (searchParams.get('statement_match') || 'all').toLowerCase()
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const tableName =
      statementMatch === 'unmatched' ? 'reservation_expenses_no_statement_match' : 'reservation_expenses'

    let query = db
      .from(tableName)
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
        const { data: customerData } = await db
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

    // 필수 필드 검증 (amount는 음수 허용 — null/undefined/'' 만 누락으로 처리)
    if (!id || !submitted_by || !paid_to || !paid_for || amount === undefined || amount === null || amount === '') {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount))
    if (!Number.isFinite(amountNum) || amountNum === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid amount' },
        { status: 400 }
      )
    }

    const rid =
      reservation_id != null && typeof reservation_id === 'string'
        ? reservation_id.trim()
        : ''
    if (rid) {
      const { data: rezRow, error: rezErr } = await db
        .from('reservations')
        .select('id')
        .eq('id', rid)
        .maybeSingle()
      if (rezErr) {
        console.error('Reservation FK check (POST reservation-expenses):', rezErr)
        return NextResponse.json(
          { success: false, message: '예약 정보를 확인하는 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }
      if (!rezRow) {
        return NextResponse.json(
          {
            success: false,
            message:
              '예약이 아직 저장되지 않았습니다. 먼저 예약을 저장한 후 예약 지출을 등록해 주세요.',
          },
          { status: 400 }
        )
      }
    }

    const { data, error } = await db
      .from('reservation_expenses')
      .insert({
        id,
        submitted_by,
        paid_to,
        paid_for,
        amount: amountNum,
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
        { success: false, message: error.message || 'Failed to create reservation expense' },
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

    if (updateData.amount !== undefined && updateData.amount !== null) {
      const n = typeof updateData.amount === 'number' ? updateData.amount : parseFloat(String(updateData.amount))
      if (!Number.isFinite(n) || n === 0) {
        return NextResponse.json(
          { success: false, message: 'Invalid amount' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await db
      .from('reservation_expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating reservation expense:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to update reservation expense' },
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

    const { error } = await db
      .from('reservation_expenses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting reservation expense:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to delete reservation expense' },
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
