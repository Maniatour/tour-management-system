/** 카테고리 매니저(expense_standard_categories)와 회사 지출 paid_for 문자열 연동 */

export type ExpenseStandardCategoryPickRow = {
  id: string
  name: string
  name_ko: string | null
  parent_id: string | null
  tax_deductible: boolean | null
  display_order: number | null
  is_active?: boolean | null
}

/** DB·매핑과 맞추기 위해 name_ko 우선(카테고리 매니저와 동일 취지) */
export function canonicalPaidForTextFromStandardCategory(cat: {
  name: string
  name_ko: string | null
}): string {
  const ko = cat.name_ko?.trim()
  if (ko) return ko
  return (cat.name ?? '').trim()
}

export function menuLabelForStandardCategory(
  cat: ExpenseStandardCategoryPickRow,
  parent: ExpenseStandardCategoryPickRow | null,
  locale: string
): string {
  const selfKo = cat.name_ko?.trim() || cat.name
  const selfEn = cat.name?.trim() || cat.name_ko || cat.name
  const self = locale === 'ko' ? selfKo : selfEn
  if (!parent) return self
  const pKo = parent.name_ko?.trim() || parent.name
  const pEn = parent.name?.trim() || parent.name_ko || parent.name
  const p = locale === 'ko' ? pKo : pEn
  return `${p} › ${self}`
}

export type StandardPaidForOption = {
  id: string
  menuLabel: string
  paidForText: string
}

export function buildStandardPaidForSelectOptions(
  cats: ExpenseStandardCategoryPickRow[],
  locale: string
): StandardPaidForOption[] {
  const active = cats.filter((c) => c.is_active !== false)
  const byId = new Map(active.map((c) => [c.id, c]))
  const sortFn = (a: ExpenseStandardCategoryPickRow, b: ExpenseStandardCategoryPickRow) =>
    (a.display_order ?? 0) - (b.display_order ?? 0)
  const roots = active.filter((c) => !c.parent_id).sort(sortFn)
  const opts: StandardPaidForOption[] = []
  const seen = new Set<string>()
  for (const m of roots) {
    const subs = active.filter((c) => c.parent_id === m.id).sort(sortFn)
    opts.push({
      id: m.id,
      menuLabel: menuLabelForStandardCategory(m, null, locale),
      paidForText: canonicalPaidForTextFromStandardCategory(m),
    })
    seen.add(m.id)
    for (const s of subs) {
      opts.push({
        id: s.id,
        menuLabel: menuLabelForStandardCategory(s, m, locale),
        paidForText: canonicalPaidForTextFromStandardCategory(s),
      })
      seen.add(s.id)
    }
  }
  for (const c of active) {
    if (seen.has(c.id)) continue
    const parent = c.parent_id ? byId.get(c.parent_id) ?? null : null
    opts.push({
      id: c.id,
      menuLabel: menuLabelForStandardCategory(c, parent, locale),
      paidForText: canonicalPaidForTextFromStandardCategory(c),
    })
  }
  return opts
}

export function matchStandardPaidForSelectValue(
  paidFor: string,
  options: StandardPaidForOption[]
): `std:${string}` | '__manual__' {
  const t = paidFor.trim()
  const hit = options.find((o) => o.paidForText === t)
  return hit ? `std:${hit.id}` : '__manual__'
}
