import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * PATCH /api/product-details/preparation-info
 * 상품 준비 사항(추천 준비물) 영구 수정.
 * 해당 상품/언어의 모든 채널에 동일한 값으로 저장합니다.
 * Body: { productId: string, languageCode: string, preparationInfo: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, languageCode, preparationInfo } = body

    if (!productId || !languageCode) {
      return NextResponse.json(
        { error: 'productId와 languageCode가 필요합니다.' },
        { status: 400 }
      )
    }

    const value = typeof preparationInfo === 'string' ? preparationInfo : (preparationInfo == null ? '' : String(preparationInfo))

    const { data: updatedRows, error: updateError } = await supabase
      .from('product_details_multilingual')
      .update({
        preparation_info: value || null,
        updated_at: new Date().toISOString()
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
        { error: '해당 상품/언어에 대한 상세 정보가 없습니다. 상품 상세에서 먼저 한 번이라도 준비 사항을 추가해 주세요.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, preparationInfo: value, updatedCount: updatedRows.length })
  } catch (error) {
    console.error('[preparation-info] 서버 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
