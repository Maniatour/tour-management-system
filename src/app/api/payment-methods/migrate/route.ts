import { NextRequest, NextResponse } from 'next/server'
import { paymentMethodMigration } from '@/lib/paymentMethodMigration'
import { supabase } from '@/lib/supabase'

/**
 * 기존 테이블의 payment_method 값들을 payment_methods 테이블로 마이그레이션
 * POST /api/payment-methods/migrate
 */
export async function POST(request: NextRequest) {
  try {
    const result = await paymentMethodMigration.migrateExistingPaymentMethods()

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message, ...result },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Payment method migration error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: '마이그레이션 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}

/**
 * 기존 payment_method 값들 수집 (마이그레이션 전 확인용)
 * GET /api/payment-methods/migrate
 */
export async function GET(request: NextRequest) {
  try {
    const existingMethods = await paymentMethodMigration.collectExistingPaymentMethods()

    // payment_methods 테이블에 존재하는지 확인
    const { data: existingPaymentMethods } = await supabase
      .from('payment_methods')
      .select('id')

    const existingIds = new Set(existingPaymentMethods?.map(pm => pm.id) || [])
    
    const methodsToCreate = existingMethods.filter(m => !existingIds.has(m))
    const methodsAlreadyExist = existingMethods.filter(m => existingIds.has(m))

    return NextResponse.json({
      success: true,
      total: existingMethods.length,
      toCreate: methodsToCreate.length,
      alreadyExist: methodsAlreadyExist.length,
      methodsToCreate,
      methodsAlreadyExist
    })
  } catch (error) {
    console.error('Payment method collection error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'payment_method 수집 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}
