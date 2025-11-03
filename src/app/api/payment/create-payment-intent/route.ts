import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Stripe 객체 생성 (서버에서만 사용)
// STRIPE_SECRET_KEY는 서버에서만 접근 가능하므로 NEXT_PUBLIC_ 접두사 없음
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

/**
 * POST /api/payment/create-payment-intent
 * 
 * 결제 의도(Payment Intent)를 생성하는 API
 * 
 * 요청 본문:
 * {
 *   amount: number,           // 결제 금액 (센트 단위, 예: $10.00 = 1000)
 *   currency: string,         // 통화 (예: 'usd', 'krw')
 *   reservationId: string,    // 예약 ID
 *   customerInfo: {           // 고객 정보
 *     name: string,
 *     email: string
 *   }
 * }
 * 
 * 응답:
 * {
 *   clientSecret: string,     // 클라이언트에서 결제 완료에 사용할 시크릿
 *   paymentIntentId: string   // 결제 의도 ID
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 요청 본문 파싱
    const body = await request.json()
    const { amount, currency = 'usd', reservationId, customerInfo } = body

    // 2. 필수 필드 검증
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: '결제 금액이 필요합니다.' },
        { status: 400 }
      )
    }

    if (!reservationId) {
      return NextResponse.json(
        { error: '예약 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 3. Stripe Secret Key 확인
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY가 환경 변수에 설정되지 않았습니다.')
      return NextResponse.json(
        { error: '결제 서비스 설정 오류' },
        { status: 500 }
      )
    }

    // 4. 금액을 센트 단위로 변환
    // Stripe는 모든 금액을 가장 작은 통화 단위로 받습니다
    // USD: 센트 (100센트 = $1)
    // KRW: 원 (1원 = 1원)
    let amountInSmallestUnit: number
    if (currency.toLowerCase() === 'usd') {
      amountInSmallestUnit = Math.round(amount * 100) // 달러를 센트로 변환
    } else {
      amountInSmallestUnit = Math.round(amount) // 원화는 그대로
    }

    // 5. Payment Intent 생성
    // Payment Intent는 결제를 위한 "의도"를 나타냅니다
    // 실제 결제는 클라이언트에서 이 시크릿을 사용하여 완료됩니다
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSmallestUnit,
      currency: currency.toLowerCase(),
      metadata: {
        reservationId: reservationId,
        customerName: customerInfo?.name || '',
        customerEmail: customerInfo?.email || ''
      },
      // 자동 승인 설정 (필요에 따라 변경 가능)
      automatic_payment_methods: {
        enabled: true,
      },
    })

    // 6. 클라이언트 시크릿 반환
    // 이 시크릿은 클라이언트에서 결제를 완료하는 데 사용됩니다
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountInSmallestUnit,
      currency: currency.toLowerCase()
    })

  } catch (error) {
    console.error('Payment Intent 생성 오류:', error)
    
    // Stripe 에러인 경우
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe 오류: ${error.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: '결제 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

