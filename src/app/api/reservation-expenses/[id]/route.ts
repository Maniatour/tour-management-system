import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

const db = supabaseAdmin ?? supabase

type RouteParams = Promise<{ id: string }> | { id: string }

async function resolveId(params: RouteParams): Promise<string | undefined> {
  const resolved = await Promise.resolve(params)
  return resolved?.id
}

// GET: 특정 예약 지출 조회
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const id = await resolveId(params)
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const { data, error } = await db
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
      const { data: customerData } = await db
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
  { params }: { params: RouteParams }
) {
  try {
    const id = await resolveId(params)
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID가 필요합니다.' },
        { status: 400 }
      )
    }
    const body = await request.json()

    if (body.amount !== undefined && body.amount !== null) {
      const n = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount))
      if (!Number.isFinite(n) || n === 0) {
        return NextResponse.json(
          { success: false, message: 'Invalid amount' },
          { status: 400 }
        )
      }
    }

    if (
      body.reservation_id != null &&
      body.reservation_id !== '' &&
      typeof body.reservation_id === 'string'
    ) {
      const rid = body.reservation_id.trim()
      if (rid) {
        const { data: rezRow, error: rezErr } = await db
          .from('reservations')
          .select('id')
          .eq('id', rid)
          .maybeSingle()
        if (rezErr) {
          console.error('Reservation FK check (PUT reservation-expenses):', rezErr)
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
    }

    const { data, error } = await db
      .from('reservation_expenses')
      .update(body)
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
  { params }: { params: RouteParams }
) {
  try {
    const id = await resolveId(params)
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID가 필요합니다.' },
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
    console.error('Error in DELETE /api/reservation-expenses/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
