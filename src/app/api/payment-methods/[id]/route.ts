import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { assertSuper, resolveFinancialApiAuth } from '@/lib/financial-api-auth'
import { buildPaymentMethodStoredDisplayName } from '@/lib/paymentMethodDisplay'

function normalizedId(params: Promise<{ id: string }> | { id: string }): Promise<string> {
  return Promise.resolve(params).then((resolved) => String(resolved.id ?? '').trim())
}

// GET: 특정 결제 방법 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const id = await normalizedId(params)
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 })
    }

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
        .select('email, name_ko, name_en, nick_name')
        .eq('email', data.user_email)
        .maybeSingle()
      
      if (teamData) {
        team = {
          email: teamData.email,
          name_ko: teamData.name_ko,
          name_en: teamData.name_en,
          nick_name: teamData.nick_name,
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
    const id = await normalizedId(params)
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 })
    }
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
    
    if (
      body.method !== undefined ||
      body.id !== undefined ||
      body.card_holder_name !== undefined
    ) {
      const { data: existingData } = await supabase
        .from('payment_methods')
        .select('method, card_holder_name')
        .eq('id', id)
        .maybeSingle()

      const finalMethod = body.method ?? existingData?.method ?? ''
      let finalHolder: string | null = existingData?.card_holder_name ?? null
      if (body.card_holder_name !== undefined) {
        finalHolder =
          body.card_holder_name === '' || body.card_holder_name === null
            ? null
            : String(body.card_holder_name)
      }

      updateData.display_name = buildPaymentMethodStoredDisplayName({
        method: finalMethod || '',
        card_holder_name: finalHolder,
      })
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
    if (body.financial_account_id !== undefined) {
      const v = body.financial_account_id
      updateData.financial_account_id =
        v === '' || v === null ? null : String(v)
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
        .select('email, name_ko, name_en, nick_name')
        .eq('email', data.user_email)
        .maybeSingle()
      
      if (teamData) {
        team = {
          email: teamData.email,
          name_ko: teamData.name_ko,
          name_en: teamData.name_en,
          nick_name: teamData.nick_name,
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

/**
 * Bearer + Super — 명세 대조 연결 모달 등에서 카드명·가이드(팀)·메모·금융계정 한 번에 갱신
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await resolveFinancialApiAuth(request)
    if (!auth.ok) return auth.response

    const gate = await assertSuper(auth.supabase, auth.userEmail)
    if (!gate.ok) {
      return NextResponse.json({ success: false, error: gate.message }, { status: gate.status })
    }

    const id = await normalizedId(params)
    if (!id) {
      return NextResponse.json({ success: false, error: '결제수단 ID가 필요합니다.' }, { status: 400 })
    }

    const body = (await request.json()) as {
      method?: unknown
      user_email?: unknown
      notes?: unknown
      financial_account_id?: unknown
    }

    const hasAny =
      'method' in body ||
      'user_email' in body ||
      'notes' in body ||
      'financial_account_id' in body
    if (!hasAny) {
      return NextResponse.json({ success: false, error: '수정할 필드가 없습니다.' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if ('method' in body) {
      const method = typeof body.method === 'string' ? body.method.trim() : ''
      if (!method) {
        return NextResponse.json({ success: false, error: '카드·방법(이름)을 입력하세요.' }, { status: 400 })
      }
      updateData.method = method
      const { data: holderRow } = await auth.supabase
        .from('payment_methods')
        .select('card_holder_name')
        .eq('id', id)
        .maybeSingle()
      updateData.display_name = buildPaymentMethodStoredDisplayName({
        method,
        card_holder_name: holderRow?.card_holder_name ?? null,
      })
    }

    if ('user_email' in body) {
      const raw = body.user_email
      const emailNorm =
        raw === null || raw === undefined || raw === ''
          ? null
          : String(raw).trim().toLowerCase()
      if (emailNorm) {
        const rawStr = typeof raw === 'string' ? raw.trim() : ''
        let { data: teamRow } = await auth.supabase
          .from('team')
          .select('email')
          .eq('email', emailNorm)
          .maybeSingle()
        if (!teamRow && rawStr) {
          teamRow = (
            await auth.supabase.from('team').select('email').eq('email', rawStr).maybeSingle()
          ).data
        }
        if (!teamRow) {
          const { data: ilikeRows } = await auth.supabase
            .from('team')
            .select('email')
            .ilike('email', emailNorm)
            .limit(2)
          if (ilikeRows?.length === 1) teamRow = { email: ilikeRows[0].email }
        }
        if (!teamRow) {
          return NextResponse.json(
            { success: false, error: '가이드(팀)에 등록된 이메일이 아닙니다.' },
            { status: 400 }
          )
        }
        updateData.user_email = teamRow.email
      } else {
        updateData.user_email = null
      }
    }

    if ('notes' in body) {
      const raw = body.notes
      updateData.notes =
        raw === null || raw === undefined || raw === ''
          ? null
          : String(raw)
    }

    if ('financial_account_id' in body) {
      const raw = body.financial_account_id
      const faId =
        raw === null || raw === undefined || raw === '' ? null : String(raw).trim()

      if (faId) {
        const { data: fa, error: faErr } = await auth.supabase
          .from('financial_accounts')
          .select('id')
          .eq('id', faId)
          .maybeSingle()

        if (faErr) {
          console.error('financial_accounts lookup:', faErr)
          return NextResponse.json(
            { success: false, error: faErr.message || '금융 계정 확인 실패' },
            { status: 500 }
          )
        }
        if (!fa) {
          return NextResponse.json({ success: false, error: '유효하지 않은 금융 계정입니다.' }, { status: 400 })
        }
      }
      updateData.financial_account_id = faId
    }

    const { data, error } = await auth.supabase
      .from('payment_methods')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('payment_methods PATCH:', error)
      return NextResponse.json(
        { success: false, error: error.message || '저장에 실패했습니다.' },
        { status: 500 }
      )
    }
    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: '결제수단을 찾았지만 수정할 수 없습니다. 권한·RLS를 확인하세요.',
        },
        { status: 404 }
      )
    }

    let team = null as {
      email: string
      name_ko: string | null | undefined
      name_en: string | null | undefined
      nick_name: string | null | undefined
    } | null
    if (data.user_email) {
      const { data: teamData } = await auth.supabase
        .from('team')
        .select('email, name_ko, name_en, nick_name')
        .eq('email', data.user_email)
        .maybeSingle()

      if (teamData) {
        team = {
          email: teamData.email,
          name_ko: teamData.name_ko,
          name_en: teamData.name_en,
          nick_name: teamData.nick_name,
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        team,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 })
  }
}

// DELETE: 특정 결제 방법 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const id = await normalizedId(params)
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 })
    }

    const client = supabaseAdmin ?? supabase
    const { data: deletedRows, error } = await client
      .from('payment_methods')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      console.error('Error deleting payment method:', error)
      return NextResponse.json(
        { success: false, message: `Failed to delete payment method: ${error.message}` },
        { status: 500 }
      )
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            '삭제할 결제 방법이 없거나 권한/정책(RLS)으로 삭제되지 않았습니다. 참조 데이터가 남아있는지 확인해 주세요.',
        },
        { status: 409 }
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
