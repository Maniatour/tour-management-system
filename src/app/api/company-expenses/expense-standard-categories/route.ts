import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 카테고리 매니저와 동일한 활성 표준 카테고리 목록 (지출 폼·정규화 선택용) */
export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('expense_standard_categories')
      .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('표준 카테고리 로드 오류:', error)
      return NextResponse.json({ error: '표준 카테고리를 불러올 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    console.error('표준 카테고리 API 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
