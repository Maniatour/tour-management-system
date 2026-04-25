import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  applyStandardLeafToCompanyExpense,
  isSelectableStandardExpenseLeaf,
} from '@/lib/companyExpenseStandardUnified'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'

const MAX_IDS = 100

/**
 * 필터된 목록 등에서 고른 company_expenses 행에 동일한 표준 리프를 반영합니다.
 * 원문 paid_for 는 유지하고, 표준 문구는 standard_paid_for 에만 저장합니다.
 * body: { expenseIds: string[], standardLeafId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const dbForCategories = supabaseAdmin ?? supabase
    const body = await request.json()
    const rawIds = Array.isArray(body.expenseIds) ? body.expenseIds : []
    const expenseIds = [...new Set(rawIds.filter((x: unknown) => typeof x === 'string' && String(x).trim()))].slice(
      0,
      MAX_IDS
    )
    const standardLeafId = typeof body.standardLeafId === 'string' ? body.standardLeafId.trim() : ''

    if (expenseIds.length === 0) {
      return NextResponse.json({ error: 'expenseIds 가 필요합니다.' }, { status: 400 })
    }
    if (!standardLeafId) {
      return NextResponse.json({ error: 'standardLeafId 가 필요합니다.' }, { status: 400 })
    }

    const { data: catRows, error: catErr } = await dbForCategories
      .from('expense_standard_categories')
      .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
      .order('display_order', { ascending: true })

    if (catErr) {
      console.error('표준 카테고리 로드 오류:', catErr)
      return NextResponse.json({ error: '표준 카테고리를 불러올 수 없습니다.' }, { status: 500 })
    }

    const cats = (catRows ?? []) as ExpenseStandardCategoryPickRow[]
    if (!isSelectableStandardExpenseLeaf(standardLeafId, cats, { includeInactive: true })) {
      return NextResponse.json({ error: '선택할 수 없는 표준 카테고리입니다.' }, { status: 400 })
    }

    const byId = new Map(cats.map((c) => [c.id, c]))
    const applied = applyStandardLeafToCompanyExpense(standardLeafId, byId)
    if (!applied) {
      return NextResponse.json({ error: '표준 분류를 적용할 수 없습니다.' }, { status: 400 })
    }

    const { data: updated, error: upErr } = await supabase
      .from('company_expenses')
      .update({
        standard_paid_for: applied.paid_for,
        category: applied.category,
        expense_type: applied.expense_type,
        tax_deductible: applied.tax_deductible,
        updated_at: new Date().toISOString(),
      })
      .in('id', expenseIds)
      .select('id')

    if (upErr) {
      console.error('회사 지출 일괄 표준 적용 오류:', upErr)
      return NextResponse.json({ error: '업데이트에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      updatedCount: updated?.length ?? 0,
      requestedCount: expenseIds.length,
      standard_paid_for: applied.paid_for,
    })
  } catch (e) {
    console.error('회사 지출 일괄 표준 적용 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
