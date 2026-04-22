import {
  canonicalPaidForTextFromStandardCategory,
  type ExpenseStandardCategoryPickRow,
} from '@/lib/expenseStandardCategoryPaidFor'

/** 차량 수리·정비 등 표준 리프 — 지출 폼에서 정비 작업 연동 조건에 사용 */
export const VEHICLE_REPAIR_STANDARD_LEAF_ID = 'CAT001-002' as const

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

export type UnifiedStandardLeafGroup = {
  /** 부모 표준 카테고리 id (React key용) */
  rootId: string
  /** 하위만 있을 때 상단 그룹 제목 (예: Car and Truck Expenses) */
  groupLabel: string
  items: UnifiedStandardLeafItem[]
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
    canonicalPaidForTextFromStandardCategory(leaf),
  ]
  return parts
    .filter((p): p is string => Boolean(p && String(p).trim()))
    .join(' ')
    .toLowerCase()
}

function searchBlobForRootOnly(root: ExpenseStandardCategoryPickRow): string {
  const parts = [root.name, root.name_ko, root.id, canonicalPaidForTextFromStandardCategory(root)]
  return parts
    .filter((p): p is string => Boolean(p && String(p).trim()))
    .join(' ')
    .toLowerCase()
}

/** 부모 헤더 + 자식만 선택. 부모에 자식이 없으면 부모 한 줄만 선택 가능 */
export function buildUnifiedStandardLeafGroups(
  cats: ExpenseStandardCategoryPickRow[],
  _locale: string
): UnifiedStandardLeafGroup[] {
  const active = cats.filter((c) => c.is_active !== false)
  const sortFn = (a: ExpenseStandardCategoryPickRow, b: ExpenseStandardCategoryPickRow) =>
    (a.display_order ?? 0) - (b.display_order ?? 0)
  const roots = active.filter((c) => !c.parent_id).sort(sortFn)
  const groups: UnifiedStandardLeafGroup[] = []

  for (const r of roots) {
    const subs = active.filter((c) => c.parent_id === r.id).sort(sortFn)
    const gLabel = bilingualStandardLabel(r.name, r.name_ko)
    if (subs.length === 0) {
      const display = bilingualStandardLabel(r.name, r.name_ko)
      groups.push({
        rootId: r.id,
        groupLabel: gLabel,
        items: [
          {
            id: r.id,
            menuLabel: display,
            displayLabel: display,
            paidForText: canonicalPaidForTextFromStandardCategory(r),
            searchText: searchBlobForRootOnly(r),
          },
        ],
      })
    } else {
      groups.push({
        rootId: r.id,
        groupLabel: gLabel,
        items: subs.map((s) => {
          const display = bilingualStandardLabel(s.name, s.name_ko)
          return {
            id: s.id,
            menuLabel: display,
            displayLabel: display,
            paidForText: canonicalPaidForTextFromStandardCategory(s),
            searchText: searchBlobForLeaf(r, s),
          }
        }),
      })
    }
  }

  return groups
}

export function flattenUnifiedLeaves(groups: UnifiedStandardLeafGroup[]): UnifiedStandardLeafItem[] {
  return groups.flatMap((g) => g.items)
}

/** 지출 폼·결제 내용 정규화와 동일: 선택 가능한 표준 리프(id)인지 */
export function isSelectableStandardExpenseLeaf(
  leafId: string,
  cats: ExpenseStandardCategoryPickRow[]
): boolean {
  const active = cats.filter((c) => c.is_active !== false)
  const byId = new Map(active.map((c) => [c.id, c]))
  const cat = byId.get(leafId)
  if (!cat) return false
  if (!cat.parent_id) {
    const subs = active.filter((c) => c.parent_id === cat.id)
    return subs.length === 0
  }
  return true
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
  CAT017: 'bg-blue-100 text-blue-950',
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

/** 표준 카테고리(리프) → 회사 지출 paid_for / category / expense_type */
export function applyStandardLeafToCompanyExpense(
  leafId: string,
  catsById: Map<string, ExpenseStandardCategoryPickRow>
): { paid_for: string; category: string; expense_type: string; tax_deductible: boolean } | null {
  const leaf = catsById.get(leafId)
  if (!leaf) return null
  const root = getRoot(leaf, catsById)
  const paid_for = canonicalPaidForTextFromStandardCategory(leaf)
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
  const groups = buildUnifiedStandardLeafGroups(cats, locale)
  const leaves = flattenUnifiedLeaves(groups)
  const pf = paid_for.trim()
  const cat = (category || '').trim()
  const et = (expense_type || '').trim()

  for (const leaf of leaves) {
    const applied = applyStandardLeafToCompanyExpense(leaf.id, byId)
    if (!applied) continue
    if (
      applied.paid_for === pf &&
      applied.category === cat &&
      applied.expense_type === et
    ) {
      return leaf.id
    }
  }
  for (const leaf of leaves) {
    const applied = applyStandardLeafToCompanyExpense(leaf.id, byId)
    if (!applied) continue
    if (applied.paid_for === pf) return leaf.id
  }
  return '__custom__'
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
