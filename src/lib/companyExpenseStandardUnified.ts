import {
  canonicalPaidForTextFromStandardCategory,
  type ExpenseStandardCategoryPickRow,
} from '@/lib/expenseStandardCategoryPaidFor'

/** 차량 수리·정비 등 표준 리프 — 지출 폼에서 정비 작업 연동 조건에 사용 */
export const VEHICLE_REPAIR_STANDARD_LEAF_ID = 'CAT001-002' as const

/** Contract Labor · 용역비 › Guide Fees · 가이드비 (2주급·가이드 지급 등) */
export const GUIDE_FEES_STANDARD_LEAF_ID = 'CAT006' as const

/** 매출원가(COGS) 상위 표준 카테고리 — 지출 폼·정규화 목록에서 맨 위에 둠 */
export const COGS_STANDARD_ROOT_ID = 'CAT024' as const

export type UnifiedStandardLeafItem = {
  id: string
  /** 하위 항목 한 줄 표시 (영문 · 한글) — 구버전 호환용으로 menuLabel과 동일하게 둠 */
  menuLabel: string
  paidForText: string
  /** 목록·트리거 표시용 영·한 병기 */
  displayLabel: string
  /** 검색용 소문자 blob (상위+리프 이름·id·paid_for 등) */
  searchText: string
}

export type UnifiedStandardTreeRow =
  | { type: 'branch'; id: string; label: string; depth: number }
  | { type: 'leaf'; item: UnifiedStandardLeafItem; depth: number }

export type UnifiedStandardLeafGroup = {
  /** 부모 표준 카테고리 id (React key용) */
  rootId: string
  /** 하위만 있을 때 상단 그룹 제목 (예: Car and Truck Expenses) */
  groupLabel: string
  /** 선택 가능한 리프만 (검색·역매칭·하위 호환) */
  items: UnifiedStandardLeafItem[]
  /** 피커용 전체 트리(중간 분류 + 리프, depth로 들여쓰기) */
  rows: UnifiedStandardTreeRow[]
}

/** includeInactive: 카테고리 매니저·결제 내용 정규화와 동일하게 비활성 행 포함 */
export type BuildUnifiedStandardLeafGroupsOptions = {
  includeInactive?: boolean
  /** 피커·paid_for 채우기 표시 언어 (기본: locale이 en이면 en, 아니면 ko) */
  labelLanguage?: 'en' | 'ko'
}

export type ApplyStandardLeafToCompanyExpenseOptions = {
  paidForLanguage?: 'en' | 'ko'
}

/** 표준 카테고리: 영문·한글을 한 줄로 (둘 다 있고 다르면 "EN · KO") */
export function bilingualStandardLabel(
  name: string | null | undefined,
  name_ko: string | null | undefined
): string {
  const en = (name ?? '').trim()
  const ko = (name_ko ?? '').trim()
  if (en && ko && en !== ko) return `${en} · ${ko}`
  if (ko) return ko
  if (en) return en
  return ''
}

/** 피커·트리 한 줄 라벨 (en: 영문 name 우선) */
export function standardPickerLabel(
  name: string | null | undefined,
  name_ko: string | null | undefined,
  language: 'en' | 'ko'
): string {
  const en = (name ?? '').trim()
  const ko = (name_ko ?? '').trim()
  if (language === 'en') return en || ko
  if (ko && en && en !== ko) return `${en} · ${ko}`
  if (ko) return ko
  return en
}

function labelLanguageFromBuildOptions(
  locale: string,
  options?: BuildUnifiedStandardLeafGroupsOptions
): 'en' | 'ko' {
  if (options?.labelLanguage) return options.labelLanguage
  return locale.startsWith('en') ? 'en' : 'ko'
}

function makeUnifiedLeafItem(
  cat: ExpenseStandardCategoryPickRow,
  root: ExpenseStandardCategoryPickRow,
  labelLanguage: 'en' | 'ko'
): UnifiedStandardLeafItem {
  const display = bilingualStandardLabel(cat.name, cat.name_ko)
  return {
    id: cat.id,
    menuLabel: display,
    displayLabel: display,
    paidForText: canonicalPaidForTextFromStandardCategory(cat, { language: labelLanguage }),
    searchText: searchBlobForLeaf(root, cat),
  }
}

function buildSubtreeRows(
  cat: ExpenseStandardCategoryPickRow,
  root: ExpenseStandardCategoryPickRow,
  pool: ExpenseStandardCategoryPickRow[],
  depth: number,
  labelLanguage: 'en' | 'ko',
  sortFn: (a: ExpenseStandardCategoryPickRow, b: ExpenseStandardCategoryPickRow) => number
): { rows: UnifiedStandardTreeRow[]; items: UnifiedStandardLeafItem[] } {
  const subs = pool.filter((c) => c.parent_id === cat.id).sort(sortFn)
  if (subs.length === 0) {
    const item = makeUnifiedLeafItem(cat, root, labelLanguage)
    return { rows: [{ type: 'leaf', item, depth }], items: [item] }
  }
  const rows: UnifiedStandardTreeRow[] = [
    {
      type: 'branch',
      id: cat.id,
      label: bilingualStandardLabel(cat.name, cat.name_ko),
      depth,
    },
  ]
  const items: UnifiedStandardLeafItem[] = []
  for (const sub of subs) {
    const nested = buildSubtreeRows(sub, root, pool, depth + 1, labelLanguage, sortFn)
    rows.push(...nested.rows)
    items.push(...nested.items)
  }
  return { rows, items }
}

function searchBlobForLeaf(
  root: ExpenseStandardCategoryPickRow,
  leaf: ExpenseStandardCategoryPickRow
): string {
  const parts = [
    root.name,
    root.name_ko,
    root.id,
    leaf.name,
    leaf.name_ko,
    leaf.id,
    canonicalPaidForTextFromStandardCategory(leaf, { language: 'en' }),
    canonicalPaidForTextFromStandardCategory(leaf, { language: 'ko' }),
  ]
  return parts
    .filter((p): p is string => Boolean(p && String(p).trim()))
    .join(' ')
    .toLowerCase()
}

/** 부모 헤더 + 자식만 선택. 부모에 자식이 없으면 부모 한 줄만 선택 가능 */
export function buildUnifiedStandardLeafGroups(
  cats: ExpenseStandardCategoryPickRow[],
  locale: string,
  options?: BuildUnifiedStandardLeafGroupsOptions
): UnifiedStandardLeafGroup[] {
  const labelLanguage = labelLanguageFromBuildOptions(locale, options)
  const pool = options?.includeInactive ? cats : cats.filter((c) => c.is_active !== false)
  const poolIds = new Set(pool.map((c) => c.id))
  const sortFn = (a: ExpenseStandardCategoryPickRow, b: ExpenseStandardCategoryPickRow) =>
    (a.display_order ?? 0) - (b.display_order ?? 0)
  /** 상위가 비활성·누락이면 하위만 남는 경우에도 트리 루트로 취급 */
  const roots = pool
    .filter((c) => !c.parent_id || !poolIds.has(c.parent_id))
    .sort((a, b) => {
      const aCogs = a.id === COGS_STANDARD_ROOT_ID ? -1 : 0
      const bCogs = b.id === COGS_STANDARD_ROOT_ID ? -1 : 0
      if (aCogs !== bCogs) return aCogs - bCogs
      return sortFn(a, b)
    })
  const groups: UnifiedStandardLeafGroup[] = []

  for (const r of roots) {
    const subs = pool.filter((c) => c.parent_id === r.id).sort(sortFn)
    const gLabel = bilingualStandardLabel(r.name, r.name_ko)
    if (subs.length === 0) {
      const item = makeUnifiedLeafItem(r, r, labelLanguage)
      groups.push({
        rootId: r.id,
        groupLabel: gLabel,
        items: [item],
        rows: [{ type: 'leaf', item, depth: 0 }],
      })
    } else {
      const rows: UnifiedStandardTreeRow[] = []
      const items: UnifiedStandardLeafItem[] = []
      for (const sub of subs) {
        const nested = buildSubtreeRows(sub, r, pool, 1, labelLanguage, sortFn)
        rows.push(...nested.rows)
        items.push(...nested.items)
      }
      groups.push({
        rootId: r.id,
        groupLabel: gLabel,
        items,
        rows,
      })
    }
  }

  const seen = new Set<string>()
  for (const g of groups) {
    seen.add(g.rootId)
    for (const it of g.items) seen.add(it.id)
  }
  for (const c of [...pool].sort(sortFn)) {
    if (seen.has(c.id)) continue
    const display = bilingualStandardLabel(c.name, c.name_ko)
    const parent = c.parent_id ? pool.find((x) => x.id === c.parent_id) ?? null : null
    const rootForBlob = parent ?? c
    const item = makeUnifiedLeafItem(c, rootForBlob, labelLanguage)
    groups.push({
      rootId: c.id,
      groupLabel: display,
      items: [item],
      rows: [{ type: 'leaf', item, depth: 0 }],
    })
    seen.add(c.id)
  }

  return groups
}

export function flattenUnifiedLeaves(groups: UnifiedStandardLeafGroup[]): UnifiedStandardLeafItem[] {
  return groups.flatMap((g) => g.items)
}

/**
 * 회사 지출 paid_for·category(회사 지출 테이블 문자열)로 표준 카테고리 리프 id 추정.
 * 명세 일괄 입력 저장 등에서 standard_paid_for·expense_type·tax_deductible 을 채울 때 사용.
 */
export function matchStandardLeafIdForPaidForAndCategory(
  paid_for: string,
  category: string,
  cats: ExpenseStandardCategoryPickRow[],
  locale: string
): string {
  if (cats.length === 0) return ''
  const byId = new Map(cats.map((c) => [c.id, c]))
  const leaves = flattenUnifiedLeaves(buildUnifiedStandardLeafGroups(cats, locale, { includeInactive: true }))
  const pf = paid_for.trim()
  const cat = (category || '').trim()
  const appliedFor = (id: string) => applyStandardLeafToCompanyExpense(id, byId)

  const byCat = leaves.filter((l) => appliedFor(l.id)?.category === cat)
  if (byCat.length === 0) return ''
  if (byCat.length === 1) return byCat[0].id
  const byBoth = byCat.find((l) => appliedFor(l.id)?.paid_for === pf)
  return byBoth?.id ?? byCat[0].id
}

/** 지출 폼·통합 피커 트리거에 표시: «상위 › 세부» 또는 단일 루트면 세부 한 줄만 */
export function unifiedStandardTriggerLabel(
  groups: UnifiedStandardLeafGroup[],
  leafId: string
): string {
  if (!leafId) return ''
  const g = groups.find((gr) => gr.items.some((i) => i.id === leafId))
  const it = g?.items.find((i) => i.id === leafId)
  if (!g || !it) return ''
  const soleRoot = g.items.length === 1 && g.items[0].id === g.rootId
  if (soleRoot) return it.displayLabel
  return `${g.groupLabel} › ${it.displayLabel}`
}

/** 지출 폼·결제 내용 정규화와 동일: 선택 가능한 표준 리프(id)인지 */
export function isSelectableStandardExpenseLeaf(
  leafId: string,
  cats: ExpenseStandardCategoryPickRow[],
  options?: BuildUnifiedStandardLeafGroupsOptions
): boolean {
  const leaves = flattenUnifiedLeaves(buildUnifiedStandardLeafGroups(cats, 'ko', options))
  return leaves.some((l) => l.id === leafId)
}

/** 지출 추가 모달 Select: 상위 그룹(rootId)마다 다른 배경색(테두리·둥근 카드 스타일 없음) */
const UNIFIED_SELECT_GROUP_CHROME: Record<string, string> = {
  CAT001: 'bg-sky-100 text-sky-950',
  CAT002: 'bg-amber-100 text-amber-950',
  CAT003: 'bg-violet-100 text-violet-950',
  CAT004: 'bg-fuchsia-100 text-fuchsia-950',
  CAT005: 'bg-teal-100 text-teal-950',
  CAT006: 'bg-rose-100 text-rose-950',
  CAT007: 'bg-orange-100 text-orange-950',
  CAT008: 'bg-slate-200 text-slate-900',
  CAT009: 'bg-cyan-100 text-cyan-950',
  CAT010: 'bg-lime-100 text-lime-950',
  CAT011: 'bg-pink-100 text-pink-950',
  CAT012: 'bg-indigo-100 text-indigo-950',
  CAT013: 'bg-stone-200 text-stone-900',
  CAT014: 'bg-yellow-100 text-yellow-950',
  CAT015: 'bg-purple-100 text-purple-950',
  CAT016: 'bg-red-100 text-red-950',
  CAT017: 'bg-primary/10 text-blue-950',
  CAT018: 'bg-neutral-200 text-neutral-900',
  CAT019: 'bg-zinc-200 text-zinc-900',
  CAT020: 'bg-emerald-100 text-emerald-950',
  CAT021: 'bg-green-100 text-green-950',
  CAT022: 'bg-amber-50 text-amber-950',
  CAT023: 'bg-sky-50 text-sky-950',
  CAT024: 'bg-emerald-200 text-emerald-950',
}

const UNIFIED_SELECT_FALLBACK_CYCLE = ['bg-gray-100 text-gray-900', 'bg-slate-100 text-slate-900'] as const

function selectChromeToneForRootId(rootId: string): string {
  const mapped = UNIFIED_SELECT_GROUP_CHROME[rootId]
  if (mapped) return mapped
  let h = 0
  for (let i = 0; i < rootId.length; i++) h = (h * 31 + rootId.charCodeAt(i)) >>> 0
  return UNIFIED_SELECT_FALLBACK_CYCLE[h % UNIFIED_SELECT_FALLBACK_CYCLE.length]
}

export function unifiedStandardGroupSelectChrome(rootId: string): {
  labelClassName: string
  singleItemClassName: string
} {
  const tone = selectChromeToneForRootId(rootId)
  return {
    labelClassName: `mx-1 mt-1 block w-[calc(100%-0.5rem)] py-2 pl-3 pr-3 text-left text-xs font-semibold first:mt-0 border-0 rounded-none ${tone}`,
    singleItemClassName: `mx-1 mt-1 py-2 pl-3 pr-3 font-medium first:mt-0 border-0 rounded-none focus:bg-black/5 hover:bg-black/5 ${tone}`,
  }
}

function getRoot(
  leaf: ExpenseStandardCategoryPickRow,
  byId: Map<string, ExpenseStandardCategoryPickRow>
): ExpenseStandardCategoryPickRow {
  let c: ExpenseStandardCategoryPickRow | undefined = leaf
  while (c?.parent_id) {
    const p = byId.get(c.parent_id)
    if (!p) break
    c = p
  }
  return c ?? leaf
}

function paidForTextsForLeaf(
  leaf: ExpenseStandardCategoryPickRow
): { en: string; ko: string } {
  return {
    en: canonicalPaidForTextFromStandardCategory(leaf, { language: 'en' }),
    ko: canonicalPaidForTextFromStandardCategory(leaf, { language: 'ko' }),
  }
}

/** 표준 카테고리(리프) → 회사 지출 paid_for / category / expense_type */
export function applyStandardLeafToCompanyExpense(
  leafId: string,
  catsById: Map<string, ExpenseStandardCategoryPickRow>,
  options?: ApplyStandardLeafToCompanyExpenseOptions
): { paid_for: string; category: string; expense_type: string; tax_deductible: boolean } | null {
  const leaf = catsById.get(leafId)
  if (!leaf) return null
  const root = getRoot(leaf, catsById)
  const lang = options?.paidForLanguage ?? 'ko'
  const paid_for = canonicalPaidForTextFromStandardCategory(leaf, { language: lang })
  const tax_deductible = leaf.tax_deductible !== false

  const OVERRIDES: Record<string, { category: string; expense_type: string }> = {
    [VEHICLE_REPAIR_STANDARD_LEAF_ID]: { category: 'vehicle', expense_type: 'maintenance' },
    CAT007: { category: 'marketing', expense_type: 'marketing' },
    CAT006: { category: '인건비', expense_type: 'operating' },
    CAT010: { category: 'other', expense_type: 'operating' },
    CAT014: { category: 'other', expense_type: 'capital' },
    /** COGS (CAT024) 하위 — 회사 지출 카테고리·유형 (원가/투어 직접비) */
    'CAT024-001': { category: 'meals', expense_type: 'operating' },
    'CAT024-002': { category: 'travel', expense_type: 'travel' },
    'CAT024-003': { category: 'travel', expense_type: 'travel' },
    'CAT024-004': { category: 'travel', expense_type: 'travel' },
    'CAT024-005': { category: 'travel', expense_type: 'travel' },
    'CAT024-006': { category: 'travel', expense_type: 'travel' },
    'CAT024-007': { category: 'vehicle', expense_type: 'operating' },
    'CAT024-008': { category: 'vehicle', expense_type: 'operating' },
    'CAT024-009': { category: '인건비', expense_type: 'operating' },
  }

  if (OVERRIDES[leafId]) {
    return { paid_for, tax_deductible, ...OVERRIDES[leafId] }
  }

  const ROOT: Record<string, { category: string; expense_type: string }> = {
    CAT001: { category: 'vehicle', expense_type: 'operating' },
    CAT002: { category: 'meals', expense_type: 'operating' },
    CAT003: { category: 'travel', expense_type: 'travel' },
    CAT012: { category: 'other', expense_type: 'operating' },
    CAT013: { category: 'other', expense_type: 'operating' },
    CAT015: { category: 'other', expense_type: 'operating' },
    CAT016: { category: 'other', expense_type: 'operating' },
    CAT017: { category: 'other', expense_type: 'operating' },
    CAT018: { category: 'office', expense_type: 'operating' },
    CAT019: { category: 'other', expense_type: 'operating' },
    CAT020: { category: 'maintenance', expense_type: 'maintenance' },
    CAT021: { category: 'equipment', expense_type: 'operating' },
    CAT022: { category: 'other', expense_type: 'operating' },
    CAT023: { category: 'utilities', expense_type: 'operating' },
    CAT024: { category: 'meals', expense_type: 'operating' },
  }

  const fromRoot = ROOT[root.id]
  if (fromRoot) {
    return { paid_for, tax_deductible, ...fromRoot }
  }

  return { paid_for, tax_deductible, category: 'other', expense_type: 'operating' }
}

/** 현재 폼 값이 어떤 표준 리프와 일치하는지(결제내용+카테고리+유형까지 우선) */
export function matchUnifiedLeafIdFromForm(
  paid_for: string,
  category: string,
  expense_type: string,
  cats: ExpenseStandardCategoryPickRow[],
  locale: string
): string | '__custom__' {
  const byId = new Map(cats.map((c) => [c.id, c]))
  /** DB에 저장된 표준값·정규화 API와 동일하게 비활성 리프도 후보에 넣음(역매칭 누락 방지) */
  const groups = buildUnifiedStandardLeafGroups(cats, locale, { includeInactive: true })
  const leaves = flattenUnifiedLeaves(groups)
  const pf = paid_for.trim()
  const cat = (category || '').trim()
  const et = (expense_type || '').trim()

  const paidForMatchesLeaf = (leafId: string, paidFor: string): boolean => {
    const row = byId.get(leafId)
    if (!row) return false
    const { en, ko } = paidForTextsForLeaf(row)
    return paidFor === en || paidFor === ko
  }

  for (const leaf of leaves) {
    const applied = applyStandardLeafToCompanyExpense(leaf.id, byId)
    if (!applied) continue
    if (
      paidForMatchesLeaf(leaf.id, pf) &&
      applied.category === cat &&
      applied.expense_type === et
    ) {
      return leaf.id
    }
  }
  for (const leaf of leaves) {
    if (paidForMatchesLeaf(leaf.id, pf)) return leaf.id
  }
  return '__custom__'
}

function resolveCompanyExpenseMappedLeafId(
  mapToLeaf: Map<string, string>,
  leafIdSet: Set<string>,
  candidates: string[]
): { leafId: string; mappingOriginal: string } | null {
  const seen = new Set<string>()
  for (const raw of candidates) {
    const candidate = raw.trim()
    if (!candidate || seen.has(candidate)) continue
    seen.add(candidate)
    const mapped = mapToLeaf.get(`${candidate}::company_expenses`)
    if (mapped && leafIdSet.has(mapped)) {
      return { leafId: mapped, mappingOriginal: candidate }
    }
  }
  return null
}

/** 통합 PNL·리포트: 회사 지출 → 표준 리프 id (명시적 매핑 → standard_paid_for·폼 필드·매핑 fallback) */
export function resolveCompanyExpensePnlLeafId(
  expense: {
    paid_for?: string | null
    category?: string | null
    standard_paid_for?: string | null
    expense_type?: string | null
  },
  cats: ExpenseStandardCategoryPickRow[],
  leafIdSet: Set<string>,
  mapToLeaf: Map<string, string>,
  locale: string
): { leafId: string | null; mappingOriginal: string } {
  const tryMatch = (paidFor: string, category: string, expenseType: string): string | null => {
    const pf = paidFor.trim()
    if (!pf) return null
    const m = matchUnifiedLeafIdFromForm(pf, category.trim(), expenseType.trim(), cats, locale)
    if (m !== '__custom__' && leafIdSet.has(m)) return m
    return null
  }

  const stdPf = (expense.standard_paid_for ?? '').trim()
  const pf = (expense.paid_for ?? '').trim()
  const cat = (expense.category ?? '').trim()
  const et = (expense.expense_type ?? '').trim()
  const origFallback = (pf || cat || '').trim() || '기타'

  const fromMapping = resolveCompanyExpenseMappedLeafId(mapToLeaf, leafIdSet, [
    stdPf,
    pf,
    origFallback,
    cat,
  ])
  if (fromMapping) return fromMapping

  if (stdPf) {
    const fromStd =
      tryMatch(stdPf, cat, et) ?? tryMatch(stdPf, cat, '') ?? tryMatch(stdPf, '', '')
    if (fromStd) return { leafId: fromStd, mappingOriginal: stdPf }
  }

  const fromForm = tryMatch(pf, cat, et) ?? tryMatch(pf, cat, '') ?? tryMatch(pf, '', '')
  if (fromForm) return { leafId: fromForm, mappingOriginal: pf || stdPf || '기타' }

  return { leafId: mapToLeaf.get(`${origFallback}::company_expenses`) ?? null, mappingOriginal: origFallback }
}

export function unifiedSelectValueFromLeafId(leafId: string | '__custom__'): string {
  if (leafId === '__custom__') return '__custom__'
  return `std:${leafId}`
}

export function parseUnifiedSelectValue(v: string): string | '__custom__' {
  if (v === '__custom__') return '__custom__'
  if (v.startsWith('std:')) return v.slice(4)
  return '__custom__'
}
