import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  applyStandardLeafToCompanyExpense,
  buildUnifiedStandardLeafGroups,
  flattenUnifiedLeaves,
} from '@/lib/companyExpenseStandardUnified'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'

type Mode = 'mapping' | 'text'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json().catch(() => ({}))
    const mode = body.mode === 'text' ? 'text' : 'mapping'
    const dryRun = Boolean(body.dryRun)

    const { data: cats, error: catErr } = await supabase
      .from('expense_standard_categories')
      .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
      .eq('is_active', true)

    if (catErr) {
      console.error('표준 카테고리 로드 오류:', catErr)
      return NextResponse.json({ error: '표준 카테고리를 불러올 수 없습니다.' }, { status: 500 })
    }

    const catRows = (cats || []) as ExpenseStandardCategoryPickRow[]
    const byId = new Map(catRows.map((c) => [c.id, c]))
    const leaves = flattenUnifiedLeaves(buildUnifiedStandardLeafGroups(catRows, 'ko'))
    const leafIds = new Set(leaves.map((l) => l.id))

    type PreviewRow = { id: string; paid_for: string; category: string | null; expense_type: string | null }
    const previews: PreviewRow[] = []
    let updated = 0

    if (mode === 'mapping') {
      const { data: mappings, error: mapErr } = await supabase
        .from('expense_category_mappings')
        .select('original_value, standard_category_id, sub_category_id')
        .eq('source_table', 'company_expenses')

      if (mapErr) {
        console.error('매핑 로드 오류:', mapErr)
        return NextResponse.json({ error: '카테고리 매핑을 불러올 수 없습니다.' }, { status: 500 })
      }

      const paidForToTarget = new Map<string, string>()
      for (const m of mappings || []) {
        const orig = typeof m.original_value === 'string' ? m.original_value.trim() : ''
        if (!orig) continue
        const target = (m.sub_category_id as string | null) || (m.standard_category_id as string | null)
        if (!target || !byId.has(target)) continue
        if (!leafIds.has(target)) continue
        paidForToTarget.set(orig, target)
      }

      const { data: expenses, error: exErr } = await supabase
        .from('company_expenses')
        .select('id, paid_for, category, expense_type')

      if (exErr) {
        console.error('회사 지출 로드 오류:', exErr)
        return NextResponse.json({ error: '지출 목록을 불러올 수 없습니다.' }, { status: 500 })
      }

      for (const row of expenses || []) {
        const pf = typeof row.paid_for === 'string' ? row.paid_for.trim() : ''
        if (!pf) continue
        const targetId = paidForToTarget.get(pf)
        if (!targetId) continue
        const applied = applyStandardLeafToCompanyExpense(targetId, byId)
        if (!applied) continue
        if (
          row.paid_for === applied.paid_for &&
          (row.category || '') === applied.category &&
          (row.expense_type || '') === applied.expense_type
        ) {
          continue
        }
        previews.push({
          id: row.id,
          paid_for: applied.paid_for,
          category: applied.category,
          expense_type: applied.expense_type,
        })
        if (!dryRun) {
          const { error: upErr } = await supabase
            .from('company_expenses')
            .update({
              paid_for: applied.paid_for,
              category: applied.category,
              expense_type: applied.expense_type,
              tax_deductible: applied.tax_deductible,
              paid_for_label_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
          if (!upErr) updated += 1
        }
      }
    } else {
      const paidForToLeaf = new Map<string, string>()
      for (const leaf of leaves) {
        const applied = applyStandardLeafToCompanyExpense(leaf.id, byId)
        if (!applied) continue
        paidForToLeaf.set(applied.paid_for, leaf.id)
      }

      const { data: expenses, error: exErr } = await supabase
        .from('company_expenses')
        .select('id, paid_for, category, expense_type')

      if (exErr) {
        return NextResponse.json({ error: '지출 목록을 불러올 수 없습니다.' }, { status: 500 })
      }

      for (const row of expenses || []) {
        const pf = typeof row.paid_for === 'string' ? row.paid_for.trim() : ''
        if (!pf) continue
        const leafId = paidForToLeaf.get(pf)
        if (!leafId) continue
        const applied = applyStandardLeafToCompanyExpense(leafId, byId)
        if (!applied) continue
        if (
          (row.category || '') === applied.category &&
          (row.expense_type || '') === applied.expense_type &&
          row.paid_for === applied.paid_for
        ) {
          continue
        }
        previews.push({
          id: row.id,
          paid_for: applied.paid_for,
          category: applied.category,
          expense_type: applied.expense_type,
        })
        if (!dryRun) {
          const { error: upErr } = await supabase
            .from('company_expenses')
            .update({
              paid_for: applied.paid_for,
              category: applied.category,
              expense_type: applied.expense_type,
              tax_deductible: applied.tax_deductible,
              paid_for_label_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
          if (!upErr) updated += 1
        }
      }
    }

    return NextResponse.json({
      mode,
      dryRun,
      previewCount: previews.length,
      updatedCount: dryRun ? 0 : updated,
      previews: previews.slice(0, 200),
    })
  } catch (e) {
    console.error('bulk-unified-standard:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
