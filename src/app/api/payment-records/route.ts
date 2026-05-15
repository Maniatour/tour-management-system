import { NextRequest, NextResponse } from 'next/server'
import {
  createSupabaseClientWithToken,
  supabaseAdmin,
} from '@/lib/supabase'
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'

// 입금 내역 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('reservation_id')

    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]

    // 요청별 JWT 클라이언트로 인증·조회 (전역 supabase 싱글톤 + getUser(token) 동시 요청 시 경합 방지)
    const db = createSupabaseClientWithToken(token)
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 입금 내역 조회 — 브라우저 세션과 동일한 RLS가 적용되도록 사용자 JWT 클라이언트 사용
    try {
      let query = db
        .from('payment_records')
        .select('*')
        .order('created_at', { ascending: false })

      if (reservationId) {
        query = query.eq('reservation_id', reservationId)
      }

      const { data: paymentRecords, error } = await query

      if (error) {
        console.error('입금 내역 조회 오류:', error)
        return NextResponse.json({ paymentRecords: [] })
      }

      return NextResponse.json({ paymentRecords: paymentRecords || [] })
    } catch (error) {
      console.error('입금 내역 조회 예외:', error)
      return NextResponse.json({ paymentRecords: [] })
    }
  } catch (error) {
    console.error('입금 내역 조회 오류:', error)
    // HTML 500(비JSON)으로 클라이언트가 깨지지 않도록 항상 JSON. 개발 서버 .next 손상 시에도 UI는 동작.
    return NextResponse.json({ paymentRecords: [], degraded: true })
  }
}

// 입금 내역 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      reservation_id, 
      payment_status = 'pending',
      amount, 
      payment_method, 
      note, 
      image_file_url,
      amount_krw 
    } = body

    const parsedAmount =
      amount !== null && amount !== undefined && amount !== ''
        ? parseFloat(String(amount))
        : Number.NaN
    // Required fields; amount must be finite and > 0
    if (
      !reservation_id ||
      payment_method == null ||
      String(payment_method).trim() === '' ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]

    const userDb = createSupabaseClientWithToken(token)
    const {
      data: { user },
      error: authError,
    } = await userDb.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // RLS: anon 은 payment_records 접근 불가 — PUT/[id] 와 동일하게 서비스 롤 또는 사용자 JWT
    const db = supabaseAdmin ?? userDb

    const { data: newPaymentRecord, error } = await db
      .from('payment_records')
      .insert({
        id: `payment_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        reservation_id,
        payment_status,
        amount: parsedAmount,
        payment_method,
        note: note || null,
        image_file_url: image_file_url || null,
        submit_by: user.email!,
        amount_krw: amount_krw ? parseFloat(amount_krw) : null
      })
      .select('*')
      .single()

    if (error) {
      console.error('입금 내역 생성 오류:', error)
      return NextResponse.json({ error: '입금 내역을 생성할 수 없습니다' }, { status: 500 })
    }

    const sync = await syncReservationPricingAggregates(db, reservation_id)
    if (!sync.ok && sync.error) {
      console.warn('[payment-records POST] reservation_pricing 동기화 실패:', reservation_id, sync.error)
    }

    return NextResponse.json({ paymentRecord: newPaymentRecord })
  } catch (error) {
    console.error('입금 내역 생성 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
