import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

// 가이드비 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('product_id')
  const teamType = searchParams.get('team_type')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  try {
    if (productId && teamType) {
      // 특정 상품의 특정 팀 타입 가이드비 조회
      const { data, error } = await supabase
        .from('product_guide_costs')
        .select('*')
        .eq('product_id', productId)
        .eq('team_type', teamType)
        .eq('is_active', true)
        .lte('effective_from', date)
        .or(`effective_to.is.null,effective_to.gte.${date}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ guideCost: null })
        }
        throw error
      }

      return NextResponse.json({ guideCost: data })
    } else if (productId) {
      // 특정 상품의 모든 가이드비 조회
      const { data, error } = await supabase
        .from('product_guide_costs')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .lte('effective_from', date)
        .or(`effective_to.is.null,effective_to.gte.${date}`)
        .order('team_type', { ascending: true })
        .order('effective_from', { ascending: false })

      if (error) throw error

      return NextResponse.json({ guideCosts: data })
    } else {
      // 모든 Mania Tour/Service 상품 목록만 조회 (product_guide_costs는 별도 쿼리로)
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, sub_category')
        .or('sub_category.ilike.%mania tour%,sub_category.ilike.%mania service%')

      if (productsError) throw productsError

      // 각 상품의 가이드비를 별도로 조회
      const productsWithCosts = await Promise.all(
        (products || []).map(async (product) => {
          const { data: costs } = await supabase
            .from('product_guide_costs')
            .select('*')
            .eq('product_id', product.id)
            .eq('is_active', true)
            .lte('effective_from', date)
            .or(`effective_to.is.null,effective_to.gte.${date}`)

          return {
            ...product,
            product_guide_costs: costs || []
          }
        })
      )

      return NextResponse.json({ products: productsWithCosts })
    }
  } catch (error) {
    console.error('가이드비 조회 오류:', error)
    return NextResponse.json({ error: '가이드비 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 가이드비 설정/수정
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, teamType, guideFee, assistantFee, driverFee, effectiveFrom, effectiveTo } = body

    // 필수 필드 검증
    if (!productId || !teamType || !guideFee || !effectiveFrom) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }

    // 기존 설정이 있으면 비활성화
    const { error: updateError } = await supabase
      .from('product_guide_costs')
      .update({
        is_active: false,
        effective_to: new Date(new Date(effectiveFrom).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('product_id', productId)
      .eq('team_type', teamType)
      .eq('is_active', true)
      .is('effective_to', null)

    if (updateError) {
      console.error('기존 가이드비 비활성화 오류:', updateError)
    }

    // 새 설정 추가
    const { data, error } = await supabase
      .from('product_guide_costs')
      .insert({
        product_id: productId,
        team_type: teamType,
        guide_fee: guideFee,
        assistant_fee: assistantFee || 0,
        driver_fee: driverFee || 0,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ guideCost: data })
  } catch (error) {
    console.error('가이드비 설정 오류:', error)
    return NextResponse.json({ error: '가이드비 설정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 가이드비 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, guideFee, assistantFee, driverFee, effectiveFrom, effectiveTo } = body

    if (!id) {
      return NextResponse.json({ error: '가이드비 ID가 필요합니다.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('product_guide_costs')
      .update({
        guide_fee: guideFee,
        assistant_fee: assistantFee || 0,
        driver_fee: driverFee || 0,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ guideCost: data })
  } catch (error) {
    console.error('가이드비 수정 오류:', error)
    return NextResponse.json({ error: '가이드비 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 가이드비 삭제 (비활성화)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '가이드비 ID가 필요합니다.' }, { status: 400 })
  }

  try {
    const { error } = await supabase
      .from('product_guide_costs')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('가이드비 삭제 오류:', error)
    return NextResponse.json({ error: '가이드비 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
