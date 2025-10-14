import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 테이블 존재 여부 확인 및 간단한 테스트
export async function GET() {
  try {
    // 1. products 테이블에서 Mania Tour/Service 상품 조회
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sub_category')
      .or('sub_category.ilike.%mania tour%,sub_category.ilike.%mania service%')
      .limit(5)

    if (productsError) {
      console.error('Products 조회 오류:', productsError)
      return NextResponse.json({ 
        error: 'Products 테이블 조회 오류', 
        details: productsError.message 
      }, { status: 500 })
    }

    // 2. product_guide_costs 테이블 존재 여부 확인
    const { data: guideCosts, error: guideCostsError } = await supabase
      .from('product_guide_costs')
      .select('id')
      .limit(1)

    if (guideCostsError) {
      console.error('product_guide_costs 테이블 오류:', guideCostsError)
      return NextResponse.json({ 
        error: 'product_guide_costs 테이블이 존재하지 않습니다', 
        details: guideCostsError.message,
        suggestion: 'create_guide_cost_management_tables.sql 파일을 Supabase에서 실행해주세요.'
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      products: products || [],
      guideCostsTableExists: true,
      message: '테이블이 정상적으로 존재합니다.'
    })

  } catch (error) {
    console.error('API 테스트 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류', 
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}
