import type { SopDocument } from '@/types/sopStructure'
import {
  allSopChecklistItemsForReuse,
  checklistItemDepth,
  orderedChecklistItems,
  sopText,
  type SopEditLocale,
} from '@/types/sopStructure'

export type SopProductChecklistAssignmentRow = {
  id: string
  product_id: string
  sop_version_id: string
  section_id: string
  category_id: string
  item_id: string
  sort_order: number
  is_required: boolean
}

export type SopTourChecklistCompletionRow = {
  id: string
  tour_id: string
  item_id: string
  completed_at: string
  completed_by: string | null
  completed_by_email: string
}

export type ResolvedTourChecklistItem = {
  item_id: string
  section_id: string
  category_id: string
  title_ko: string
  title_en: string
  parent_id: string | null
  depth: number
  sort_order: number
  is_required: boolean
  section_title_ko: string
  section_title_en: string
  category_title_ko: string
  category_title_en: string
}

export type ResolvedTourChecklistGroup = {
  section_id: string
  section_title_ko: string
  section_title_en: string
  categories: Array<{
    category_id: string
    category_title_ko: string
    category_title_en: string
    items: ResolvedTourChecklistItem[]
  }>
}

export type TourChecklistProgress = {
  total: number
  required: number
  done: number
  requiredDone: number
  isComplete: boolean
  missingRequired: number
}

export function computeTourChecklistProgress(
  assignments: SopProductChecklistAssignmentRow[],
  completedItemIds: Set<string>
): TourChecklistProgress {
  const total = assignments.length
  const requiredRows = assignments.filter((a) => a.is_required)
  const required = requiredRows.length
  let done = 0
  let requiredDone = 0
  for (const a of assignments) {
    if (completedItemIds.has(a.item_id)) {
      done += 1
      if (a.is_required) requiredDone += 1
    }
  }
  const missingRequired = Math.max(0, required - requiredDone)
  return {
    total,
    required,
    done,
    requiredDone,
    missingRequired,
    isComplete: total > 0 && requiredDone >= required && done >= total,
  }
}

export function assignmentsForProduct(
  all: SopProductChecklistAssignmentRow[],
  productId: string
): SopProductChecklistAssignmentRow[] {
  return all.filter((a) => a.product_id === productId)
}

export function resolveProductChecklistItems(
  assignments: SopProductChecklistAssignmentRow[],
  doc: SopDocument | null
): ResolvedTourChecklistItem[] {
  if (assignments.length === 0) return []

  const sopRows = doc ? allSopChecklistItemsForReuse(doc) : []
  const sopByItemId = new Map(sopRows.map((r) => [r.item_id, r]))

  const sectionTitle = new Map<string, { ko: string; en: string }>()
  const categoryTitle = new Map<string, { ko: string; en: string }>()
  if (doc) {
    for (const s of doc.sections) {
      sectionTitle.set(s.id, { ko: s.title_ko, en: s.title_en })
      for (const c of s.categories) {
        categoryTitle.set(c.id, { ko: c.title_ko, en: c.title_en })
      }
    }
  }

  const sorted = [...assignments].sort((a, b) => a.sort_order - b.sort_order)
  const out: ResolvedTourChecklistItem[] = []

  for (const row of sorted) {
    const sop = sopByItemId.get(row.item_id)
    const sec = sectionTitle.get(row.section_id)
    const cat = categoryTitle.get(row.category_id)
    const catItems = sopRows
      .filter((x) => x.category_id === row.category_id)
      .map((x) => ({
        id: x.item_id,
        title_ko: x.title_ko,
        title_en: x.title_en,
        sort_order: x.sort_order,
        parent_id: x.parent_id,
      }))
    const byId = new Map(catItems.map((i) => [i.id, i]))
    const depth =
      sop && byId.has(row.item_id)
        ? checklistItemDepth(
            {
              id: row.item_id,
              title_ko: sop.title_ko,
              title_en: sop.title_en,
              sort_order: sop.sort_order,
              parent_id: sop.parent_id,
            },
            byId
          )
        : 0

    out.push({
      item_id: row.item_id,
      section_id: row.section_id,
      category_id: row.category_id,
      title_ko: sop?.title_ko ?? `(removed ${row.item_id.slice(0, 8)}…)`,
      title_en: sop?.title_en ?? `(removed ${row.item_id.slice(0, 8)}…)`,
      parent_id: sop?.parent_id ?? null,
      depth,
      sort_order: row.sort_order,
      is_required: row.is_required,
      section_title_ko: sec?.ko ?? '',
      section_title_en: sec?.en ?? '',
      category_title_ko: cat?.ko ?? '',
      category_title_en: cat?.en ?? '',
    })
  }

  return out
}

export function groupResolvedChecklistItems(items: ResolvedTourChecklistItem[]): ResolvedTourChecklistGroup[] {
  const groups: ResolvedTourChecklistGroup[] = []
  const sectionMap = new Map<string, ResolvedTourChecklistGroup>()

  for (const item of items) {
    let sec = sectionMap.get(item.section_id)
    if (!sec) {
      sec = {
        section_id: item.section_id,
        section_title_ko: item.section_title_ko,
        section_title_en: item.section_title_en,
        categories: [],
      }
      sectionMap.set(item.section_id, sec)
      groups.push(sec)
    }
    let cat = sec.categories.find((c) => c.category_id === item.category_id)
    if (!cat) {
      cat = {
        category_id: item.category_id,
        category_title_ko: item.category_title_ko,
        category_title_en: item.category_title_en,
        items: [],
      }
      sec.categories.push(cat)
    }
    cat.items.push(item)
  }

  return groups
}

export function sopChecklistAvailableRows(doc: SopDocument) {
  const rows = allSopChecklistItemsForReuse(doc)
  const sectionTitle = new Map(doc.sections.map((s) => [s.id, { ko: s.title_ko, en: s.title_en }]))
  const categoryTitle = new Map(
    doc.sections.flatMap((s) => s.categories.map((c) => [c.id, { ko: c.title_ko, en: c.title_en }] as const))
  )

  return rows.map((r) => ({
    ...r,
    section_title_ko: sectionTitle.get(r.section_id)?.ko ?? '',
    section_title_en: sectionTitle.get(r.section_id)?.en ?? '',
    category_title_ko: categoryTitle.get(r.category_id)?.ko ?? '',
    category_title_en: categoryTitle.get(r.category_id)?.en ?? '',
  }))
}

export function labelForChecklistItem(
  item: { title_ko: string; title_en: string; item_id?: string },
  lang: SopEditLocale
): string {
  return sopText(item.title_ko, item.title_en, lang).trim() || item.item_id?.slice(0, 8) || '—'
}

/** SOP 문서에서 카테고리별 정렬된 체크 줄 (admin 미리보기용) */
export function orderedCategoryChecklistFromDoc(
  doc: SopDocument,
  sectionId: string,
  categoryId: string
) {
  const sec = doc.sections.find((s) => s.id === sectionId)
  const cat = sec?.categories.find((c) => c.id === categoryId)
  return orderedChecklistItems(cat?.checklist_items)
}
