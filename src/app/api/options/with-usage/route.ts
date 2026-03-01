import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/options/with-usage
 * 옵션 목록을 reservation_options 사용 횟수 순(많이 사용한 순)으로 반환.
 * 예약 옵션 추가 모달 드롭다운용.
 */
export async function GET() {
  try {
    const [usageRes, optionsRes] = await Promise.all([
      supabase.from('reservation_options').select('option_id'),
      supabase
        .from('options')
        .select('id, name, name_ko, name_en, adult_price')
        .eq('is_choice_template', false)
        .order('name', { ascending: true }),
    ])

    if (optionsRes.error) {
      console.error('Error fetching options:', optionsRes.error)
      return NextResponse.json({ error: optionsRes.error.message }, { status: 500 })
    }

    const options = optionsRes.data || []

    // option_id별 사용 횟수
    const countByOptionId: Record<string, number> = {}
    ;(usageRes.data || []).forEach((row: { option_id: string }) => {
      const id = row.option_id
      if (id) countByOptionId[id] = (countByOptionId[id] || 0) + 1
    })

    // 사용 횟수 내림차순, 동일하면 이름 오름차순
    const sorted = [...options].sort((a, b) => {
      const countA = countByOptionId[a.id] || 0
      const countB = countByOptionId[b.id] || 0
      if (countB !== countA) return countB - countA
      const nameA = (a.name_ko || a.name_en || a.name || '').toLowerCase()
      const nameB = (b.name_ko || b.name_en || b.name || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })

    return NextResponse.json({ options: sorted })
  } catch (error) {
    console.error('Error in options/with-usage API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
