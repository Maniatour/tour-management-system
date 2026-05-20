import {
  applyStandardLeafToCompanyExpense,
  isSelectableStandardExpenseLeaf,
} from '@/lib/companyExpenseStandardUnified'
import {
  canonicalPaidForTextFromStandardCategory,
  type ExpenseStandardCategoryPickRow,
} from '@/lib/expenseStandardCategoryPaidFor'

export type CompanyExpenseCategoryMappingRow = {
  original_value: string
  source_table: string
  standard_category_id: string | null
  sub_category_id: string | null
}

function eqQuoted(val: string): string {
  return `"${String(val).replace(/"/g, '""')}"`
}

/**
 * 회사 지출 목록: 표준 리프(카테고리 매니저 매핑·standard_paid_for·폼 역매칭)와 일치하는 행만 조회할 PostgREST or() 절.
 * resolveCompanyExpensePnlLeafId 와 동일한 판별 기준.
 */
export function buildCompanyExpenseStandardLeafOrClause(
  leafId: string,
  cats: ExpenseStandardCategoryPickRow[],
  mappings: CompanyExpenseCategoryMappingRow[]
): string | null {
  if (!isSelectableStandardExpenseLeaf(leafId, cats, { includeInactive: true })) {
    return null
  }

  const parts = new Set<string>()
  const byId = new Map(cats.map((c) => [c.id, c]))

  const mappedOriginals: string[] = []
  for (const m of mappings) {
    if (m.source_table !== 'company_expenses') continue
    const eff = m.sub_category_id || m.standard_category_id
    if (eff !== leafId) continue
    const ov = m.original_value.trim()
    if (ov) mappedOriginals.push(ov)
  }

  if (mappedOriginals.length > 0) {
    const unique = [...new Set(mappedOriginals)]
    if (unique.length === 1) {
      const q = eqQuoted(unique[0])
      parts.add(`paid_for.eq.${q}`)
      parts.add(`category.eq.${q}`)
    } else {
      const quoted = unique.map(eqQuoted).join(',')
      parts.add(`paid_for.in.(${quoted})`)
      parts.add(`category.in.(${quoted})`)
    }
  }

  const leaf = byId.get(leafId)
  const applied = applyStandardLeafToCompanyExpense(leafId, byId)
  if (leaf && applied) {
    const en = canonicalPaidForTextFromStandardCategory(leaf, { language: 'en' })
    const ko = canonicalPaidForTextFromStandardCategory(leaf, { language: 'ko' })
    const texts = [...new Set([en, ko].filter(Boolean))]
    const qcat = eqQuoted(applied.category)
    const qet = eqQuoted(applied.expense_type)

    for (const pf of texts) {
      const qpf = eqQuoted(pf)
      parts.add(`and(standard_paid_for.eq.${qpf},category.eq.${qcat},expense_type.eq.${qet})`)
      parts.add(`and(standard_paid_for.eq.${qpf},category.eq.${qcat})`)
      parts.add(`standard_paid_for.eq.${qpf}`)
      parts.add(`and(paid_for.eq.${qpf},category.eq.${qcat},expense_type.eq.${qet})`)
      parts.add(`and(paid_for.eq.${qpf},category.eq.${qcat})`)
      parts.add(`paid_for.eq.${qpf}`)
    }
  }

  if (parts.size === 0) return null
  return [...parts].join(',')
}
