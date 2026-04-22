import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  applyStandardLeafToCompanyExpense,
  isSelectableStandardExpenseLeaf,
} from '@/lib/companyExpenseStandardUnified'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'

/**
 * 동일한 결제 내용 문자열을 카테고리 매니저의 표준 카테고리(리프)에 맞춰 일괄 반영합니다.
 * body: { paidFor: string, previousLabelId: string | null, standardLeafId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const paidFor = typeof body.paidFor === 'string' ? body.paidFor : ''
    const standardLeafId = typeof body.standardLeafId === 'string' ? body.standardLeafId : ''
    const previousLabelId =
      body.previousLabelId === null || body.previousLabelId === undefined || body.previousLabelId === ''
        ? null
        : String(body.previousLabelId)

    if (!paidFor.trim() || !standardLeafId.trim()) {
      return NextResponse.json({ error: 'paidFor 과 standardLeafId 가 필요합니다.' }, { status: 400 })
    }

    const { data: catRows, error: catErr } = await supabase
      .from('expense_standard_categories')
      .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
      .eq('is_active', true)

    if (catErr) {
      console.error('표준 카테고리 로드 오류:', catErr)
      return NextResponse.json({ error: '표준 카테고리를 불러올 수 없습니다.' }, { status: 500 })
    }

    const cats = (catRows ?? []) as ExpenseStandardCategoryPickRow[]
    if (!isSelectableStandardExpenseLeaf(standardLeafId, cats)) {
      return NextResponse.json({ error: '선택할 수 없는 표준 카테고리입니다.' }, { status: 400 })
    }

    const byId = new Map(cats.map((c) => [c.id, c]))
    const applied = applyStandardLeafToCompanyExpense(standardLeafId, byId)
    if (!applied) {
      return NextResponse.json({ error: '표준 분류를 적용할 수 없습니다.' }, { status: 400 })
    }

    let q = supabase
      .from('company_expenses')
      .update({
        paid_for: applied.paid_for,
        category: applied.category,
        expense_type: applied.expense_type,
        tax_deductible: applied.tax_deductible,
        paid_for_label_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('paid_for', paidFor)

    if (previousLabelId === null) {
      q = q.is('paid_for_label_id', null)
    } else {
      q = q.eq('paid_for_label_id', previousLabelId)
    }

    const { data: updated, error: upErr } = await q.select('id')

    if (upErr) {
      console.error('결제 내용 정규화 적용 오류:', upErr)
      return NextResponse.json({ error: '업데이트에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      updatedCount: updated?.length ?? 0,
      paid_for: applied.paid_for,
    })
  } catch (e) {
    console.error('결제 내용 정규화 적용 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
