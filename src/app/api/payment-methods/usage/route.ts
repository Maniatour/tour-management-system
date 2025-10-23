import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST: 결제 방법 사용량 업데이트
export async function POST(request: NextRequest) {
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

    // 사용량 업데이트 함수 호출
    const { error } = await supabase.rpc('update_payment_method_usage', {
      p_method_id: method_id,
      p_amount: parseFloat(amount)
    })

    if (error) {
      console.error('Error updating payment method usage:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to update usage' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Usage updated successfully'
    })

  } catch (error) {
    console.error('Error in POST /api/payment-methods/usage:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: 결제 방법 통계 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userEmail = searchParams.get('user_email')
    const methodType = searchParams.get('method_type')

    let query = supabase
      .from('payment_methods')
      .select('*')

    // 필터 적용
    if (userEmail) {
      query = query.eq('user_email', userEmail)
    }
    if (methodType) {
      query = query.eq('method_type', methodType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching payment methods for stats:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch payment methods' },
        { status: 500 }
      )
    }

    // 통계 계산
    const stats = {
      total: data?.length || 0,
      active: data?.filter(item => item.status === 'active').length || 0,
      inactive: data?.filter(item => item.status === 'inactive').length || 0,
      suspended: data?.filter(item => item.status === 'suspended').length || 0,
      expired: data?.filter(item => item.status === 'expired').length || 0,
      totalLimit: data?.reduce((sum, item) => sum + (item.limit_amount || 0), 0) || 0,
      totalMonthlyLimit: data?.reduce((sum, item) => sum + (item.monthly_limit || 0), 0) || 0,
      totalDailyLimit: data?.reduce((sum, item) => sum + (item.daily_limit || 0), 0) || 0,
      totalCurrentMonthUsage: data?.reduce((sum, item) => sum + (item.current_month_usage || 0), 0) || 0,
      totalCurrentDayUsage: data?.reduce((sum, item) => sum + (item.current_day_usage || 0), 0) || 0,
      byType: {
        card: data?.filter(item => item.method_type === 'card').length || 0,
        cash: data?.filter(item => item.method_type === 'cash').length || 0,
        transfer: data?.filter(item => item.method_type === 'transfer').length || 0,
        mobile: data?.filter(item => item.method_type === 'mobile').length || 0,
        other: data?.filter(item => !['card', 'cash', 'transfer', 'mobile'].includes(item.method_type)).length || 0
      }
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Error in GET /api/payment-methods/usage:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: 월별/일별 사용량 리셋
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { reset_type } = body // 'monthly' or 'daily'

    if (!reset_type || !['monthly', 'daily'].includes(reset_type)) {
      return NextResponse.json(
        { success: false, message: 'reset_type must be "monthly" or "daily"' },
        { status: 400 }
      )
    }

    let functionName = ''
    if (reset_type === 'monthly') {
      functionName = 'reset_monthly_usage'
    } else {
      functionName = 'reset_daily_usage'
    }

    const { error } = await supabase.rpc(functionName)

    if (error) {
      console.error(`Error resetting ${reset_type} usage:`, error)
      return NextResponse.json(
        { success: false, message: `Failed to reset ${reset_type} usage` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${reset_type} usage reset successfully`
    })

  } catch (error) {
    console.error('Error in PUT /api/payment-methods/usage:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
