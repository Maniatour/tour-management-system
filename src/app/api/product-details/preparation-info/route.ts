import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { createServerSupabase } from '@/lib/supabase-server'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

/**
 * PATCH /api/product-details/preparation-info
 * 상품 준비 사항(추천 준비물) 영구 수정.
 * 해당 상품/언어의 모든 채널에 동일한 값으로 저장합니다.
 * Body: { productId, languageCode, preparationInfo, operatorId? }
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { productId, languageCode, preparationInfo, operatorId: bodyOperatorId } = body

    if (!productId || !languageCode) {
      return NextResponse.json(
        { error: 'productId와 languageCode가 필요합니다.' },
        { status: 400 }
      )
    }

    const operatorId = resolveOperatorId(bodyOperatorId)
    const supabase = await createServerSupabase()

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('operator_id', operatorId)
      .maybeSingle()

    if (productError) {
      console.error('[preparation-info] product lookup:', productError)
      return NextResponse.json(
        { error: '상품 확인 실패', details: productError.message },
        { status: 500 }
      )
    }

    if (!product) {
      return NextResponse.json(
        { error: '상품을 찾을 수 없거나 다른 운영사 소속입니다.' },
        { status: 404 }
      )
    }

    const value =
      typeof preparationInfo === 'string'
        ? preparationInfo
        : preparationInfo == null
          ? ''
          : String(preparationInfo)

    const { data: updatedRows, error: updateError } = await supabase
      .from('product_details_multilingual')
      .update({
        preparation_info: value || null,
        updated_at: new Date().toISOString(),
      })
      .eq('product_id', productId)
      .eq('language_code', languageCode)
      .select('id')

    if (updateError) {
      console.error('[preparation-info] 수정 오류:', updateError)
      return NextResponse.json(
        { error: '준비 사항 저장 실패', details: updateError.message },
        { status: 500 }
      )
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        {
          error:
            '해당 상품/언어에 대한 상세 정보가 없습니다. 상품 상세에서 먼저 한 번이라도 준비 사항을 추가해 주세요.',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      preparationInfo: value,
      updatedCount: updatedRows.length,
    })
  } catch (error) {
    console.error('[preparation-info] 서버 오류:', error)
    return NextResponse.json(
      {
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
