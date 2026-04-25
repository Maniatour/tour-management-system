import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'

/** 카테고리 매니저 «표준 카테고리»와 동일: 비활성 포함 전체. RLS는 authenticated 전용이라 API만 쓸 때는 service role로 조회 */
export async function GET() {
  try {
    const db = supabaseAdmin ?? (await createClient())
    const { data, error } = await db
      .from('expense_standard_categories')
      .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
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
