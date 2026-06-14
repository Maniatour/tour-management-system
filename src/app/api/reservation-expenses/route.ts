import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { isAmountSearchQuery, matchesAmountSearch } from '@/lib/amountSearch'
import { lvSubmitOnBoundsFromYmdFilter } from '@/lib/lasVegasCalendar'

const db = supabaseAdmin ?? supabase

type ExpenseListRow = {
  reservation_id?: string | null
  reservations?: { id?: string; customer_id?: string | null } | null
  [key: string]: unknown
}

const ADMIN_LIST_MAX = 5000
const RESERVATION_DETAIL_MAX = 500
const AMOUNT_SEARCH_SCAN_LIMIT = 10_000

// GET: 예약 지출 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('reservation_id')
    const status = searchParams.get('status')
    const submittedBy = searchParams.get('submitted_by')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const search = searchParams.get('search')
    /** all | unmatched — 명세 대조 미연결 지출만 */
    const statementMatch = (searchParams.get('statement_match') || 'all').toLowerCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limitRaw = parseInt(
      searchParams.get('limit') || (reservationId ? String(RESERVATION_DETAIL_MAX) : String(ADMIN_LIST_MAX)),
      10
    )
    const maxLimit = reservationId ? RESERVATION_DETAIL_MAX : ADMIN_LIST_MAX
    const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : maxLimit))
    const from = (page - 1) * limit
    const to = from + limit - 1

    /** 검색어가 있으면 «미대조만» 뷰를 쓰지 않음 — 이미 명세에 연결된 지출도 찾을 수 있게 */
    const tableName =
      search?.trim() || statementMatch !== 'unmatched'
        ? 'reservation_expenses'
        : 'reservation_expenses_no_statement_match'
    const useBaseTable = tableName === 'reservation_expenses'

    const submitOnBounds = lvSubmitOnBoundsFromYmdFilter(dateFrom, dateTo)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyListFilters = (q: any): any => {
      let next = q
      if (useBaseTable) {
        next = next.is('deleted_at', null)
      }
      if (submitOnBounds.gte) {
        next = next.gte('submit_on', submitOnBounds.gte)
      }
      if (submitOnBounds.lte) {
        next = next.lte('submit_on', submitOnBounds.lte)
      }
      if (reservationId) {
        next = next.eq('reservation_id', reservationId)
      }
      if (status && status !== 'all') {
        next = next.eq('status', status)
      }
      if (submittedBy) {
        next = next.eq('submitted_by', submittedBy)
      }
      return next
    }

    let query = applyListFilters(
      fromUntypedTable(db, tableName).select(
        `
        *,
        reservations (
          id,
          customer_id,
          product_id
        )
      `,
        { count: 'exact' }
      )
    )

    if (search && search.trim()) {
      const raw = search.trim()
      const like = `%${raw}%`
      const orParts = [
        `paid_to.ilike.${like}`,
        `paid_for.ilike.${like}`,
        `note.ilike.${like}`,
        `payment_method.ilike.${like}`,
        `submitted_by.ilike.${like}`,
        `reservation_id.ilike.${like}`,
        `event_id.ilike.${like}`,
        `id.ilike.${like}`,
      ]

      const { data: pmRows } = await db
        .from('payment_methods')
        .select('id')
        .or(`method.ilike.${like},display_name.ilike.${like},id.ilike.${like}`)
      const pmIds = [...new Set((pmRows || []).map((r: { id: string }) => r.id))].slice(0, 200)
      if (pmIds.length > 0) {
        orParts.push(`payment_method.in.(${pmIds.join(',')})`)
      }

      const { data: customerRows } = await db
        .from('customers')
        .select('id')
        .or(`name.ilike.${like},email.ilike.${like}`)
        .limit(100)
      const customerIds = (customerRows || []).map((r: { id: string }) => r.id).filter(Boolean)
      if (customerIds.length > 0) {
        const { data: reservationRows } = await db
          .from('reservations')
          .select('id')
          .in('customer_id', customerIds)
          .limit(200)
        const reservationIdsFromCustomers = (reservationRows || [])
          .map((r: { id: string }) => r.id)
          .filter(Boolean)
        if (reservationIdsFromCustomers.length > 0) {
          orParts.push(`reservation_id.in.(${reservationIdsFromCustomers.join(',')})`)
        }
      }

      if (isAmountSearchQuery(raw)) {
        const scanQ = applyListFilters(fromUntypedTable(db, tableName).select('id, amount'))
        const { data: scanRows } = await scanQ.limit(AMOUNT_SEARCH_SCAN_LIMIT)
        const amountIds = (scanRows || [])
          .filter((r: { id: string; amount: unknown }) =>
            matchesAmountSearch(Number(r.amount), raw)
          )
          .map((r: { id: string }) => r.id)
          .slice(0, 200)
        if (amountIds.length > 0) {
          orParts.push(`id.in.(${amountIds.join(',')})`)
        }
      }

      query = query.or(orParts.join(','))
    }

    query = query.order('submit_on', { ascending: false }).range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching reservation expenses:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch reservation expenses' },
        { status: 500 }
      )
    }

    // 고객 정보 추가
    const expensesWithCustomers = await Promise.all(((data || []) as ExpenseListRow[]).map(async (expense) => {
      const reservations = expense.reservations
      if (reservations && reservations.customer_id) {
        const { data: customerData } = await db
          .from('customers')
          .select('id, name, email')
          .eq('id', reservations.customer_id)
          .single()

        return {
          ...expense,
          reservations: {
            ...reservations,
            customers: customerData || { name: 'Unknown', email: '' },
          },
        }
      }
      return expense
    }))

    /** 예약별 payment_records 금액 합계 (입금 내역) */
    const reservationIds = [
      ...new Set(
        (expensesWithCustomers as ExpenseListRow[])
          .map((e) => {
            const rid = e.reservation_id || e.reservations?.id
            return rid && String(rid).trim() ? String(rid).trim() : null
          })
          .filter((id): id is string => Boolean(id))
      ),
    ]

    const paymentTotalByReservation = new Map<string, number>()
    let paymentTotalsOk = true
    const chunkSize = 80
    for (let i = 0; i < reservationIds.length; i += chunkSize) {
      const chunk = reservationIds.slice(i, i + chunkSize)
      const { data: prRows, error: prError } = await db
        .from('payment_records')
        .select('reservation_id, amount, amount_krw')
        .in('reservation_id', chunk)

      if (prError) {
        console.error('Error fetching payment_records for reservation expenses:', prError)
        paymentTotalsOk = false
        break
      }
      for (const row of prRows || []) {
        const rid = row.reservation_id as string
        const raw = row.amount ?? row.amount_krw
        const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0'))
        const amt = Number.isFinite(n) ? n : 0
        paymentTotalByReservation.set(rid, (paymentTotalByReservation.get(rid) || 0) + amt)
      }
    }

    const dataWithPayments = (expensesWithCustomers as ExpenseListRow[]).map((e) => {
        const rid = e.reservation_id || e.reservations?.id
        const key = rid && String(rid).trim() ? String(rid).trim() : null
        const reservation_payments_total =
          !paymentTotalsOk ? null : key == null ? null : (paymentTotalByReservation.get(key) ?? 0)
        return { ...e, reservation_payments_total }
      })

    const total = count ?? dataWithPayments.length
    const totalPages = Math.max(1, Math.ceil(total / limit))

    return NextResponse.json({
      success: true,
      data: dataWithPayments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
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
        status,
      } as never)
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
