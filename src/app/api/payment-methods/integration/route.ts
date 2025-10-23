import { NextRequest, NextResponse } from 'next/server'
import { paymentMethodIntegration } from '@/lib/paymentMethodIntegration'

// POST: 기존 payment_method를 새로운 시스템으로 마이그레이션
export async function POST(request: NextRequest) {
  try {
    const result = await paymentMethodIntegration.migrateExistingPaymentMethods()
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('결제 방법 마이그레이션 API 오류:', error)
    return NextResponse.json(
      { success: false, message: `마이그레이션 API 오류: ${error}` },
      { status: 500 }
    )
  }
}

// GET: 결제 방법 옵션 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userEmail = searchParams.get('user_email')
    const action = searchParams.get('action')

    switch (action) {
      case 'options':
        const options = await paymentMethodIntegration.getPaymentMethodOptions(userEmail || undefined)
        return NextResponse.json({
          success: true,
          data: options
        })

      case 'validate':
        const methodId = searchParams.get('method_id')
        const amount = parseFloat(searchParams.get('amount') || '0')
        
        if (!methodId) {
          return NextResponse.json(
            { success: false, message: 'method_id is required' },
            { status: 400 }
          )
        }

        const validation = await paymentMethodIntegration.validatePaymentMethod(methodId, amount)
        return NextResponse.json({
          success: true,
          data: validation
        })

      case 'stats':
        const statsMethodId = searchParams.get('method_id')
        
        if (!statsMethodId) {
          return NextResponse.json(
            { success: false, message: 'method_id is required' },
            { status: 400 }
          )
        }

        const stats = await paymentMethodIntegration.getPaymentMethodStats(statsMethodId)
        return NextResponse.json({
          success: true,
          data: stats
        })

      case 'resolve':
        const methodString = searchParams.get('method_string')
        const resolveUserEmail = searchParams.get('user_email')
        
        if (!methodString) {
          return NextResponse.json(
            { success: false, message: 'method_string is required' },
            { status: 400 }
          )
        }

        const resolvedId = await paymentMethodIntegration.resolvePaymentMethodId(
          methodString, 
          resolveUserEmail || undefined
        )
        
        return NextResponse.json({
          success: true,
          data: { id: resolvedId }
        })

      case 'resolve-string':
        const methodIdForString = searchParams.get('method_id')
        
        if (!methodIdForString) {
          return NextResponse.json(
            { success: false, message: 'method_id is required' },
            { status: 400 }
          )
        }

        const resolvedString = await paymentMethodIntegration.resolvePaymentMethodString(methodIdForString)
        
        return NextResponse.json({
          success: true,
          data: { method: resolvedString }
        })

      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('결제 방법 연동 API 오류:', error)
    return NextResponse.json(
      { success: false, message: `API 오류: ${error}` },
      { status: 500 }
    )
  }
}

// PUT: 결제 사용량 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { method_id, amount } = body

    if (!method_id || !amount) {
      return NextResponse.json(
        { success: false, message: 'method_id and amount are required' },
        { status: 400 }
      )
    }

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid amount' },
        { status: 400 }
      )
    }

    const success = await paymentMethodIntegration.updatePaymentUsage(method_id, parseFloat(amount))
    
    return NextResponse.json({
      success,
      message: success ? '사용량이 업데이트되었습니다.' : '사용량 업데이트에 실패했습니다.'
    })

  } catch (error) {
    console.error('결제 사용량 업데이트 API 오류:', error)
    return NextResponse.json(
      { success: false, message: `API 오류: ${error}` },
      { status: 500 }
    )
  }
}
