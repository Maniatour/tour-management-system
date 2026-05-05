import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import {
  buildUnifiedStandardLeafGroups,
  flattenUnifiedLeaves,
  type UnifiedStandardLeafGroup,
} from '@/lib/companyExpenseStandardUnified'

/** 통합 PNL 표에서 미매칭·트리 외 매핑 버킷 */
export const PNL_UNMATCHED_BUCKET_KEY = '__pnl_unmatched__'

/** 카테고리 매니저 목록과 유사: 영문 (한글) */
export function enKoParenLabel(name: string | null | undefined, name_ko: string | null | undefined): string {
  const en = (name ?? '').trim()
  const ko = (name_ko ?? '').trim()
  if (en && ko) return `${en} (${ko})`
  if (ko) return ko
  if (en) return en
  return ''
}

export type PnlTableRow =
  | { kind: 'group-header'; rowKey: string; label: string; leafIds: string[] }
  /** 상위 그룹 아래 하위 리프면 indentSubcategory true (이름 앞 기호 없이 들여쓰기만) */
  | { kind: 'leaf'; rowKey: string; label: string; indentSubcategory: boolean }
  | { kind: 'unmatched'; rowKey: string; label: string }

/** 표준 카테고리 관리 탭·리프 그룹과 동일 순서로 표용 행 생성 */
export function buildPnlStandardCategoryTableRows(
  cats: ExpenseStandardCategoryPickRow[],
  locale: string
): { rows: PnlTableRow[]; groups: UnifiedStandardLeafGroup[]; leafIdSet: Set<string> } {
  const groups = buildUnifiedStandardLeafGroups(cats, locale, { includeInactive: true })
  const byId = new Map(cats.map((c) => [c.id, c]))
  const leafIdSet = new Set(flattenUnifiedLeaves(groups).map((i) => i.id))
  const out: PnlTableRow[] = []

  for (const g of groups) {
    const root = byId.get(g.rootId)
    const sole = g.items.length === 1 && g.items[0].id === g.rootId
    if (!sole) {
      const parentLabel = root ? enKoParenLabel(root.name, root.name_ko) : g.groupLabel
      out.push({
        kind: 'group-header',
        rowKey: `hdr:${g.rootId}`,
        label: parentLabel,
        leafIds: g.items.map((i) => i.id),
      })
    }
    for (const it of g.items) {
      const leafCat = byId.get(it.id)
      const leafText = leafCat ? enKoParenLabel(leafCat.name, leafCat.name_ko) : it.displayLabel
      out.push({ kind: 'leaf', rowKey: it.id, label: leafText, indentSubcategory: !sole })
    }
  }

  out.push({
    kind: 'unmatched',
    rowKey: PNL_UNMATCHED_BUCKET_KEY,
    label: '매칭되지 않은 지출',
  })

  return { rows: out, groups, leafIdSet }
}

/** 선택한 표준 리프 → expense_category_mappings 의 main/sub 컬럼 (카테고리 매니저와 동일) */
export function splitMappingIdsFromLeafId(
  leafId: string,
  byId: Map<string, ExpenseStandardCategoryPickRow>
): { standard_category_id: string; sub_category_id: string | null } {
  const leaf = byId.get(leafId)
  if (!leaf) {
    return { standard_category_id: leafId, sub_category_id: null }
  }
  if (leaf.parent_id) {
    return { standard_category_id: leaf.parent_id, sub_category_id: leaf.id }
  }
  return { standard_category_id: leaf.id, sub_category_id: null }
}
