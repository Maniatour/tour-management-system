import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  isProductDetailEmailEditableField,
  parseSectionTitlesMap,
  resolveProductDetailsChannelId,
  type ProductDetailEmailEditableField,
} from '@/lib/fetchProductDetailsForEmail'

/**
 * PATCH /api/product-details/field
 * product_details_multilingual 단일 행 수정 (본문 필드 + 선택적으로 section_titles 병합).
 */
export async function PATCH(request: NextRequest) {
  try {
    /** 서버 라우트에는 브라우저 세션이 없어 anon 클라이언트만 쓰면 RLS에 막힐 수 있음 */
    const db = supabaseAdmin ?? supabase

    const body = await request.json()
    const {
      productId,
      languageCode,
      channelId,
      variantKey,
      field,
      value,
      sectionTitle,
      customerPageVisible,
    } = body as {
      productId?: string
      languageCode?: string
      channelId?: string | null
      variantKey?: string
      field?: string
      value?: string | null
      /** 섹션 커스텀 제목: 빈 문자열이면 해당 필드 키를 section_titles 에서 제거 */
      sectionTitle?: string | null
      /** 고객 상품 페이지에 이 섹션 표시 여부 (생략 시 기존 값 유지) */
      customerPageVisible?: boolean
    }

    if (!productId || !languageCode) {
      return NextResponse.json(
        { error: 'productId와 languageCode가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!field || !isProductDetailEmailEditableField(field)) {
      return NextResponse.json(
        { error: '허용되지 않은 필드입니다.' },
        { status: 400 }
      )
    }

    const vk =
      typeof variantKey === 'string' && variantKey.trim() !== ''
        ? variantKey.trim()
        : 'default'

    const resolvedChannelId = await resolveProductDetailsChannelId(db, channelId)

    const strValue =
      typeof value === 'string' ? value : value == null ? '' : String(value)

    const buildBaseQuery = (columns: string) => {
      let q = db
        .from('product_details_multilingual')
        .select(columns)
        .eq('product_id', productId)
        .eq('language_code', languageCode)
        .eq('variant_key', vk)
      if (resolvedChannelId != null && resolvedChannelId !== '') {
        q = q.eq('channel_id', resolvedChannelId)
      } else {
        q = q.is('channel_id', null)
      }
      return q
    }

    type PatchRow = {
      id: string
      section_titles?: unknown
      customer_page_visibility?: unknown
    }

    let row: PatchRow | null = null
    let hasCustomerPageVisibilityColumn = true

    const firstRes = await buildBaseQuery(
      'id, section_titles, customer_page_visibility'
    ).maybeSingle()

    const errMsg = firstRes.error?.message ?? ''
    const errCode = (firstRes.error as { code?: string }).code
    const missingVis =
      !!firstRes.error &&
      (errMsg.includes('customer_page_visibility') ||
        errMsg.includes('schema cache') ||
        errCode === '42703' ||
        errCode === 'PGRST204')

    if (missingVis) {
      hasCustomerPageVisibilityColumn = false
      const fallback = await buildBaseQuery('id, section_titles').maybeSingle()
      if (fallback.error && (fallback.error as { code?: string }).code !== 'PGRST116') {
        console.error('[product-details/field] 조회 오류:', fallback.error)
        return NextResponse.json(
          { error: '조회 실패', details: fallback.error.message },
          { status: 500 }
        )
      }
      row = (fallback.data as PatchRow | null) ?? null
    } else {
      if (firstRes.error && (firstRes.error as { code?: string }).code !== 'PGRST116') {
        console.error('[product-details/field] 조회 오류:', firstRes.error)
        return NextResponse.json(
          { error: '조회 실패', details: firstRes.error.message },
          { status: 500 }
        )
      }
      row = (firstRes.data as PatchRow | null) ?? null
    }

    if (!row?.id) {
      return NextResponse.json(
        {
          error:
            '해당 상품·채널·언어·variant의 상세 행을 찾을 수 없습니다. 관리자 상품 상세에서 먼저 저장해 주세요.',
        },
        { status: 404 }
      )
    }

    const patch: Record<string, unknown> = {
      [field]: strValue || null,
      updated_at: new Date().toISOString(),
    }

    if ('sectionTitle' in body) {
      const prev: Record<string, string> = { ...parseSectionTitlesMap(row.section_titles) }
      if (sectionTitle === null) {
        delete prev[field]
      } else if (typeof sectionTitle === 'string') {
        const t = sectionTitle.trim()
        if (!t) delete prev[field]
        else prev[field] = t
      }
      patch.section_titles = prev
    }

    if (
      hasCustomerPageVisibilityColumn &&
      'customerPageVisible' in body &&
      typeof customerPageVisible === 'boolean'
    ) {
      const rawV = row.customer_page_visibility
      const prevV: Record<string, boolean> =
        rawV && typeof rawV === 'object' && !Array.isArray(rawV)
          ? { ...(rawV as Record<string, boolean>) }
          : {}
      if (customerPageVisible) delete prevV[field]
      else prevV[field] = false
      patch.customer_page_visibility = prevV
    }

    const { error: updateError } = await db
      .from('product_details_multilingual')
      .update(patch as never)
      .eq('id', row.id)

    if (updateError) {
      console.error('[product-details/field] 수정 오류:', updateError)
      return NextResponse.json(
        { error: '저장 실패', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      field: field as ProductDetailEmailEditableField,
      value: strValue,
      sectionTitles: (patch.section_titles as Record<string, string>) ?? undefined,
      customerPageVisibility:
        (patch.customer_page_visibility as Record<string, boolean>) ?? undefined,
    })
  } catch (error) {
    console.error('[product-details/field] 서버 오류:', error)
    return NextResponse.json(
      {
        error: '서버 오류',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
