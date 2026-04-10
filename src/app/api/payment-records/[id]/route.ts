import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin, createSupabaseClientWithToken } from '@/lib/supabase'
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'

// 입금 내역 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams
    const body = await request.json()
    const { 
      payment_status, 
      amount, 
      payment_method, 
      note, 
      image_file_url,
      amount_krw 
    } = body

    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 업데이트할 데이터 준비
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    if (payment_status !== undefined) updateData.payment_status = payment_status
    if (amount !== undefined) updateData.amount = parseFloat(amount)
    if (payment_method !== undefined) updateData.payment_method = payment_method
    if (note !== undefined) updateData.note = note
    if (image_file_url !== undefined) updateData.image_file_url = image_file_url
    if (amount_krw !== undefined) updateData.amount_krw = amount_krw ? parseFloat(amount_krw) : null

    // 결제 상태가 수령 상태로 변경될 때 확인 정보 추가
    const receivedStatuses = ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !']
    if (payment_status && receivedStatuses.includes(payment_status)) {
      updateData.confirmed_on = new Date().toISOString()
      updateData.confirmed_by = user.email!
    }

    // 인증된 사용자 JWT로 요청 (RLS 적용) 또는 서비스 롤
    const db = supabaseAdmin ?? createSupabaseClientWithToken(token)

    // 입금 내역 업데이트 (reservation만 조인, customers 조인은 스키마 관계 오류 방지를 위해 제외)
    const { data: updatedPaymentRecord, error } = await db
      .from('payment_records')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        reservation:reservations(
          id,
          customer_id
        )
      `)
      .maybeSingle()

    if (error) {
      console.error('입금 내역 업데이트 오류:', error?.message, error?.details, error?.hint)
      const message = error?.message ?? '입금 내역을 업데이트할 수 없습니다'
      return NextResponse.json({ error: message }, { status: 500 })
    }

    if (!updatedPaymentRecord) {
      return NextResponse.json({ error: '입금 내역을 찾을 수 없습니다' }, { status: 404 })
    }

    const rid = (updatedPaymentRecord as { reservation_id?: string }).reservation_id
    if (rid) {
      const sync = await syncReservationPricingAggregates(db, rid)
      if (!sync.ok && sync.error) {
        console.warn('[payment-records PUT] reservation_pricing 동기화 실패:', rid, sync.error)
      }
    }

    return NextResponse.json({ paymentRecord: updatedPaymentRecord })
  } catch (error) {
    console.error('입금 내역 업데이트 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 입금 내역 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams

    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const db = supabaseAdmin ?? createSupabaseClientWithToken(token)

    const { data: beforeDel } = await db.from('payment_records').select('reservation_id').eq('id', id).maybeSingle()

    // 입금 내역 삭제
    const { error } = await db
      .from('payment_records')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('입금 내역 삭제 오류:', error)
      return NextResponse.json({ error: '입금 내역을 삭제할 수 없습니다' }, { status: 500 })
    }

    const rid = beforeDel && typeof beforeDel === 'object' && 'reservation_id' in beforeDel
      ? String((beforeDel as { reservation_id: string }).reservation_id)
      : ''
    if (rid) {
      const sync = await syncReservationPricingAggregates(db, rid)
      if (!sync.ok && sync.error) {
        console.warn('[payment-records DELETE] reservation_pricing 동기화 실패:', rid, sync.error)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('입금 내역 삭제 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
