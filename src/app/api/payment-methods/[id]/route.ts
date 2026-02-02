import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: 특정 결제 방법 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams

    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching payment method:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch payment method', error: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Payment method not found' },
        { status: 404 }
      )
    }

    // team 정보 별도 조회
    let team = null
    if (data.user_email) {
      const { data: teamData } = await supabase
        .from('team')
        .select('email, name_ko, name_en')
        .eq('email', data.user_email)
        .maybeSingle()
      
      if (teamData) {
        team = {
          email: teamData.email,
          name_ko: teamData.name_ko,
          name_en: teamData.name_en
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        team
      }
    })

  } catch (error) {
    console.error('Error in GET /api/payment-methods/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: 특정 결제 방법 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams
    const body = await request.json()

    // 업데이트할 데이터 준비 (빈 문자열을 null로 변환)
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    // 필드별로 처리
    if (body.method !== undefined) updateData.method = body.method
    if (body.method_type !== undefined) updateData.method_type = body.method_type
    if (body.user_email !== undefined) {
      updateData.user_email = body.user_email === '' || body.user_email === null ? null : body.user_email
    }
    if (body.status !== undefined) updateData.status = body.status
    
    // method나 id가 변경되면 display_name 자동 업데이트
    if (body.method !== undefined || body.id !== undefined) {
      // 기존 데이터 조회
      const { data: existingData } = await supabase
        .from('payment_methods')
        .select('id, method')
        .eq('id', id)
        .maybeSingle()
      
      const finalId = body.id || existingData?.id || id
      const finalMethod = body.method || existingData?.method || ''
      
      // display_name 자동 생성
      updateData.display_name = finalId && finalId.startsWith('PAYM')
        ? `${finalId} - ${finalMethod}`
        : finalMethod
    }
    
    // 금액 필드 처리 (빈 문자열이나 0은 null로 변환)
    if (body.limit_amount !== undefined) {
      if (body.limit_amount === '' || body.limit_amount === null) {
        updateData.limit_amount = null
      } else {
        const limitAmount = parseFloat(body.limit_amount)
        if (isNaN(limitAmount) || limitAmount < 0) {
          return NextResponse.json(
            { success: false, message: 'Invalid limit amount' },
            { status: 400 }
          )
        }
        updateData.limit_amount = limitAmount
      }
    }

    if (body.monthly_limit !== undefined) {
      if (body.monthly_limit === '' || body.monthly_limit === null) {
        updateData.monthly_limit = null
      } else {
        const monthlyLimit = parseFloat(body.monthly_limit)
        if (isNaN(monthlyLimit) || monthlyLimit < 0) {
          return NextResponse.json(
            { success: false, message: 'Invalid monthly limit' },
            { status: 400 }
          )
        }
        updateData.monthly_limit = monthlyLimit
      }
    }

    if (body.daily_limit !== undefined) {
      if (body.daily_limit === '' || body.daily_limit === null) {
        updateData.daily_limit = null
      } else {
        const dailyLimit = parseFloat(body.daily_limit)
        if (isNaN(dailyLimit) || dailyLimit < 0) {
          return NextResponse.json(
            { success: false, message: 'Invalid daily limit' },
            { status: 400 }
          )
        }
        updateData.daily_limit = dailyLimit
      }
    }

    // 카드 정보 필드 처리 (빈 문자열을 null로 변환)
    if (body.card_number_last4 !== undefined) {
      updateData.card_number_last4 = body.card_number_last4 === '' ? null : body.card_number_last4
    }
    if (body.card_type !== undefined) {
      updateData.card_type = body.card_type === '' ? null : body.card_type
    }
    if (body.card_holder_name !== undefined) {
      updateData.card_holder_name = body.card_holder_name === '' ? null : body.card_holder_name
    }
    if (body.expiry_date !== undefined) {
      updateData.expiry_date = body.expiry_date === '' || body.expiry_date === null ? null : body.expiry_date
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes === '' ? null : body.notes
    }
    if (body.updated_by !== undefined) {
      updateData.updated_by = body.updated_by === '' ? null : body.updated_by
    }
    if (body.deduct_card_fee_for_tips !== undefined) {
      updateData.deduct_card_fee_for_tips = !!body.deduct_card_fee_for_tips
    }

    // updateData에 실제로 업데이트할 필드가 있는지 확인
    if (Object.keys(updateData).length <= 1) { // updated_at만 있으면
      return NextResponse.json(
        { success: false, message: '업데이트할 데이터가 없습니다.' },
        { status: 400 }
      )
    }

    console.log('Updating payment method:', id, 'with data:', updateData)

    const { data, error } = await supabase
      .from('payment_methods')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating payment method:', error)
      console.error('Update data:', updateData)
      return NextResponse.json(
        { success: false, message: 'Failed to update payment method', error: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Payment method not found' },
        { status: 404 }
      )
    }

    console.log('Payment method updated successfully:', data)

    // team 정보 별도 조회
    let team = null
    if (data.user_email) {
      const { data: teamData } = await supabase
        .from('team')
        .select('email, name_ko, name_en')
        .eq('email', data.user_email)
        .maybeSingle()
      
      if (teamData) {
        team = {
          email: teamData.email,
          name_ko: teamData.name_ko,
          name_en: teamData.name_en
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        team
      }
    })

  } catch (error) {
    console.error('Error in PUT /api/payment-methods/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// DELETE: 특정 결제 방법 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting payment method:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to delete payment method' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method deleted successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/payment-methods/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
