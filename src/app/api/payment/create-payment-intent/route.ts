import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Stripe 객체를 지연 초기화 (환경 변수가 있을 때만 생성)
let stripeInstance: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY가 환경 변수에 설정되지 않았습니다.')
    }
    // API 버전을 명시하지 않으면 최신 버전 사용
    stripeInstance = new Stripe(secretKey, {
      // 타임아웃 및 재시도 설정
      timeout: 30000,
      maxNetworkRetries: 3,
    })
  }
  return stripeInstance
}

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

    // 3. Stripe Secret Key 확인 및 초기화
    let stripe: Stripe
    try {
      stripe = getStripe()
    } catch (error) {
      console.error('Stripe 초기화 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      return NextResponse.json(
        { 
          error: errorMessage.includes('STRIPE_SECRET_KEY') 
            ? 'Stripe 환경변수가 설정되지 않았습니다. STRIPE_SECRET_KEY를 확인해주세요.' 
            : `결제 서비스 설정 오류: ${errorMessage}`
        },
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

    // 최소 금액 검증 (Stripe는 최소 $0.50 또는 동등한 금액이 필요)
    if (amountInSmallestUnit < 50 && currency.toLowerCase() === 'usd') {
      return NextResponse.json(
        { error: '최소 결제 금액은 $0.50입니다.' },
        { status: 400 }
      )
    }

    if (amountInSmallestUnit < 1) {
      return NextResponse.json(
        { error: '결제 금액이 너무 작습니다.' },
        { status: 400 }
      )
    }

    console.log('Payment Intent 생성 시도:', {
      amount: amountInSmallestUnit,
      currency: currency.toLowerCase(),
      reservationId
    })

    // 5. Payment Intent 생성
    // Payment Intent는 결제를 위한 "의도"를 나타냅니다
    // 실제 결제는 클라이언트에서 이 시크릿을 사용하여 완료됩니다
    try {
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

      console.log('Payment Intent 생성 성공:', paymentIntent.id)

      // 6. 클라이언트 시크릿 반환
      // 이 시크릿은 클라이언트에서 결제를 완료하는 데 사용됩니다
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amountInSmallestUnit,
        currency: currency.toLowerCase()
      })
    } catch (stripeError) {
      console.error('Stripe Payment Intent 생성 오류:', stripeError)
      
      // Stripe 에러 타입별 처리
      if (stripeError instanceof Stripe.errors.StripeError) {
        let errorMessage = stripeError.message
        
        // 더 친절한 에러 메시지 제공
        if (stripeError.type === 'StripeConnectionError') {
          errorMessage = 'Stripe 서버에 연결할 수 없습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.'
        } else if (stripeError.type === 'StripeAPIError') {
          errorMessage = 'Stripe API 오류가 발생했습니다. API 키를 확인해주세요.'
        } else if (stripeError.type === 'StripeAuthenticationError') {
          errorMessage = 'Stripe 인증에 실패했습니다. API 키가 올바른지 확인해주세요.'
        } else if (stripeError.type === 'StripeInvalidRequestError') {
          errorMessage = `잘못된 요청입니다: ${stripeError.message}`
        }
        
        return NextResponse.json(
          { error: `Stripe 오류: ${errorMessage}` },
          { status: 400 }
        )
      }
      
      throw stripeError
    }
  } catch (error) {
    console.error('Payment Intent 생성 오류 (최상위):', error)
    
    // Stripe 에러인 경우
    if (error instanceof Stripe.errors.StripeError) {
      let errorMessage = error.message
      
      // 에러 타입별 처리
      if (error.type === 'StripeConnectionError') {
        errorMessage = 'Stripe 서버에 연결할 수 없습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.'
      } else if (error.type === 'StripeAPIError') {
        errorMessage = 'Stripe API 오류가 발생했습니다. API 키와 계정 상태를 확인해주세요.'
      } else if (error.type === 'StripeAuthenticationError') {
        errorMessage = 'Stripe 인증에 실패했습니다. STRIPE_SECRET_KEY가 올바른지 확인해주세요.'
      }
      
      return NextResponse.json(
        { error: `Stripe 오류: ${errorMessage}` },
        { status: 400 }
      )
    }

    // 일반 에러
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    return NextResponse.json(
      { error: `결제 처리 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}

