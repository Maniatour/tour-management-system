import {
  newSopId,
  prefillSortOrders,
  type SopCategory,
  type SopChecklistItem,
  type SopDocument,
  type SopEditLocale,
  type SopRowAttachment,
  type SopSection,
} from '@/types/sopStructure'

function maxSiblingSort(items: SopChecklistItem[], parentId: string | null): number {
  const p = parentId ?? null
  return items.filter((i) => (i.parent_id ?? null) === p).reduce((m, i) => Math.max(m, i.sort_order), -1)
}

function cascadeRemoveChecklistItems(items: SopChecklistItem[], removeId: string): SopChecklistItem[] {
  const toRemove = new Set<string>([removeId])
  let grew = true
  while (grew) {
    grew = false
    for (const it of items) {
      if (it.parent_id && toRemove.has(it.parent_id) && !toRemove.has(it.id)) {
        toRemove.add(it.id)
        grew = true
      }
    }
  }
  return items.filter((i) => !toRemove.has(i.id))
}

function patchCategory(
  doc: SopDocument,
  sectionId: string,
  categoryId: string,
  patch: (category: SopCategory) => SopCategory
): SopDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) =>
      section.id !== sectionId
        ? section
        : {
            ...section,
            categories: section.categories.map((category) =>
              category.id === categoryId ? patch(category) : category
            ),
          }
    ),
  }
}

function patchCategoryChecklist(
  doc: SopDocument,
  sectionId: string,
  categoryId: string,
  nextItems: SopChecklistItem[] | undefined
): SopDocument {
  return patchCategory(doc, sectionId, categoryId, (category) => {
    if (nextItems && nextItems.length > 0) {
      return { ...category, checklist_items: nextItems }
    }
    const { checklist_items: _omit, ...rest } = category
    return rest
  })
}

export function createEmptySopCategory(sortOrder: number): SopCategory {
  return {
    id: newSopId(),
    title_ko: '',
    title_en: '',
    content_ko: '',
    content_en: '',
    sort_order: sortOrder,
  }
}

export function createEmptySopSection(sortOrder: number): SopSection {
  return {
    id: newSopId(),
    title_ko: '',
    title_en: '',
    sort_order: sortOrder,
    content_ko: '',
    content_en: '',
    categories: [],
  }
}

export function addSopSection(doc: SopDocument): { doc: SopDocument; sectionId: string } {
  const section = createEmptySopSection(doc.sections.length)
  return {
    doc: prefillSortOrders({
      ...doc,
      sections: [...doc.sections, section],
    }),
    sectionId: section.id,
  }
}

export function removeSopSection(
  doc: SopDocument,
  sectionId: string
): SopDocument | null {
  const remaining = doc.sections.filter((s) => s.id !== sectionId)
  if (remaining.length === doc.sections.length) return null
  // 문서 형태상 섹션 배열은 비울 수 없음 → 마지막 하나면 빈 섹션으로 교체
  const sections = remaining.length > 0 ? remaining : [createEmptySopSection(0)]
  return prefillSortOrders({
    ...doc,
    sections,
  })
}

export function addSopCategory(
  doc: SopDocument,
  sectionId: string,
  afterCategoryId?: string
): { doc: SopDocument; categoryId: string } | null {
  const section = doc.sections.find((s) => s.id === sectionId)
  if (!section) return null

  const newCategory = createEmptySopCategory(section.categories.length)
  const ordered = [...section.categories].sort((a, b) => a.sort_order - b.sort_order)

  let categories: SopCategory[]
  if (afterCategoryId) {
    const idx = ordered.findIndex((c) => c.id === afterCategoryId)
    if (idx < 0) {
      categories = [...ordered, newCategory]
    } else {
      categories = [...ordered.slice(0, idx + 1), newCategory, ...ordered.slice(idx + 1)]
    }
  } else {
    categories = [...ordered, newCategory]
  }

  return {
    doc: prefillSortOrders({
      ...doc,
      sections: doc.sections.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              categories: categories.map((c, i) => ({ ...c, sort_order: i })),
            }
      ),
    }),
    categoryId: newCategory.id,
  }
}

export function removeSopCategory(
  doc: SopDocument,
  sectionId: string,
  categoryId: string
): SopDocument | null {
  const section = doc.sections.find((s) => s.id === sectionId)
  if (!section) return null

  return prefillSortOrders({
    ...doc,
    sections: doc.sections.map((s) =>
      s.id !== sectionId
        ? s
        : {
            ...s,
            categories: s.categories
              .filter((c) => c.id !== categoryId)
              .map((c, i) => ({ ...c, sort_order: i })),
          }
    ),
  })
}

export function moveSopSection(
  doc: SopDocument,
  sectionId: string,
  direction: -1 | 1
): SopDocument | null {
  const ordered = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order)
  const index = ordered.findIndex((s) => s.id === sectionId)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return null

  const swapped = [...ordered]
  ;[swapped[index], swapped[nextIndex]] = [swapped[nextIndex], swapped[index]]

  return prefillSortOrders({
    ...doc,
    sections: swapped.map((s, i) => ({ ...s, sort_order: i })),
  })
}

export function moveSopCategory(
  doc: SopDocument,
  sectionId: string,
  categoryId: string,
  direction: -1 | 1
): SopDocument | null {
  const section = doc.sections.find((s) => s.id === sectionId)
  if (!section) return null

  const ordered = [...section.categories].sort((a, b) => a.sort_order - b.sort_order)
  const index = ordered.findIndex((c) => c.id === categoryId)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return null

  const swapped = [...ordered]
  ;[swapped[index], swapped[nextIndex]] = [swapped[nextIndex], swapped[index]]

  return prefillSortOrders({
    ...doc,
    sections: doc.sections.map((s) =>
      s.id !== sectionId
        ? s
        : {
            ...s,
            categories: swapped.map((c, i) => ({ ...c, sort_order: i })),
          }
    ),
  })
}

export function addSopChecklistItem(
  doc: SopDocument,
  sectionId: string,
  categoryId: string,
  options?: { afterItemId?: string; parentId?: string | null }
): { doc: SopDocument; itemId: string } | null {
  const section = doc.sections.find((s) => s.id === sectionId)
  const category = section?.categories.find((c) => c.id === categoryId)
  if (!section || !category) return null

  const items = [...(category.checklist_items ?? [])]
  const parentId = options?.parentId ?? null

  if (options?.afterItemId) {
    const anchor = items.find((i) => i.id === options.afterItemId)
    if (!anchor) return null
    const anchorParent = anchor.parent_id ?? null
    const siblings = items
      .filter((i) => (i.parent_id ?? null) === anchorParent)
      .sort((a, b) => a.sort_order - b.sort_order)
    const anchorIdx = siblings.findIndex((i) => i.id === anchor.id)
    const insertOrder =
      anchorIdx >= 0 && anchorIdx < siblings.length - 1
        ? siblings[anchorIdx + 1].sort_order
        : anchor.sort_order + 1

    const newItem: SopChecklistItem = {
      id: newSopId(),
      title_ko: '',
      title_en: '',
      sort_order: insertOrder,
      parent_id: anchorParent,
    }

    const shifted = items.map((it) => {
      if ((it.parent_id ?? null) !== anchorParent) return it
      if (it.sort_order >= insertOrder) return { ...it, sort_order: it.sort_order + 1 }
      return it
    })

    return {
      doc: prefillSortOrders(
        patchCategoryChecklist(doc, sectionId, categoryId, [...shifted, newItem])
      ),
      itemId: newItem.id,
    }
  }

  const newItem: SopChecklistItem = {
    id: newSopId(),
    title_ko: '',
    title_en: '',
    sort_order: maxSiblingSort(items, parentId) + 1,
    parent_id: parentId,
  }

  return {
    doc: prefillSortOrders(
      patchCategoryChecklist(doc, sectionId, categoryId, [...items, newItem])
    ),
    itemId: newItem.id,
  }
}

/** 여러 줄 제목을 각각 목록 ROW로 삽입 (첫 줄은 기존 ROW, 나머지는 바로 아래에 추가) */
export function splitChecklistTitlesIntoListRows(
  doc: SopDocument,
  sectionId: string,
  categoryId: string,
  itemId: string,
  titles: string[],
  lang: SopEditLocale
): SopDocument | null {
  const cleaned = titles.map((t) => t.trim()).filter(Boolean)
  if (!cleaned.length) return null

  const section = doc.sections.find((s) => s.id === sectionId)
  const category = section?.categories.find((c) => c.id === categoryId)
  if (!category?.checklist_items?.length) return null

  const items = [...category.checklist_items]
  const anchor = items.find((i) => i.id === itemId)
  if (!anchor) return null

  const parentId = anchor.parent_id ?? null
  const anchorOrder = anchor.sort_order
  const extraCount = Math.max(0, cleaned.length - 1)

  const asListRowWithTitle = (item: SopChecklistItem, title: string): SopChecklistItem => {
    const withTitle =
      lang === 'ko' ? { ...item, title_ko: title } : { ...item, title_en: title }
    const { row_display: _omit, ...listRow } = withTitle
    return listRow
  }

  const nextItems = items.map((it) => {
    if (it.id === itemId) return asListRowWithTitle(anchor, cleaned[0])
    if ((it.parent_id ?? null) === parentId && it.sort_order > anchorOrder && extraCount > 0) {
      return { ...it, sort_order: it.sort_order + extraCount }
    }
    return it
  })

  cleaned.slice(1).forEach((title, idx) => {
    nextItems.push({
      id: newSopId(),
      title_ko: lang === 'ko' ? title : '',
      title_en: lang === 'en' ? title : '',
      sort_order: anchorOrder + idx + 1,
      parent_id: parentId,
    })
  })

  return prefillSortOrders(patchCategoryChecklist(doc, sectionId, categoryId, nextItems))
}

export function removeSopChecklistItem(
  doc: SopDocument,
  sectionId: string,
  categoryId: string,
  itemId: string
): SopDocument | null {
  const section = doc.sections.find((s) => s.id === sectionId)
  const category = section?.categories.find((c) => c.id === categoryId)
  if (!category?.checklist_items?.length) return null

  const next = cascadeRemoveChecklistItems(category.checklist_items, itemId)
  return prefillSortOrders(patchCategoryChecklist(doc, sectionId, categoryId, next))
}

export function moveSopChecklistItem(
  doc: SopDocument,
  sectionId: string,
  categoryId: string,
  itemId: string,
  direction: -1 | 1
): SopDocument | null {
  const section = doc.sections.find((s) => s.id === sectionId)
  const category = section?.categories.find((c) => c.id === categoryId)
  if (!category?.checklist_items?.length) return null

  const items = [...category.checklist_items]
  const self = items.find((i) => i.id === itemId)
  if (!self) return null

  const siblings = items
    .filter((i) => (i.parent_id ?? null) === (self.parent_id ?? null))
    .sort((a, b) => a.sort_order - b.sort_order)
  const si = siblings.findIndex((i) => i.id === itemId)
  const j = si + direction
  if (si < 0 || j < 0 || j >= siblings.length) return null

  const a = siblings[si]
  const b = siblings[j]
  const swapped = items.map((it) => {
    if (it.id === a.id) return { ...it, sort_order: b.sort_order }
    if (it.id === b.id) return { ...it, sort_order: a.sort_order }
    return it
  })

  return prefillSortOrders(patchCategoryChecklist(doc, sectionId, categoryId, swapped))
}

export function setChecklistItemAttachments(
  doc: SopDocument,
  sectionId: string,
  categoryId: string,
  itemId: string,
  attachments: SopRowAttachment[] | undefined
): SopDocument {
  return prefillSortOrders(
    patchCategory(doc, sectionId, categoryId, (category) => {
      const items = category.checklist_items?.map((item) => {
        if (item.id !== itemId) return item
        if (attachments?.length) return { ...item, attachments }
        const { attachments: _omit, ...rest } = item
        return rest
      })
      return items?.length ? { ...category, checklist_items: items } : category
    })
  )
}

function collectDescendantIds(items: SopChecklistItem[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const item of items) {
      if (item.parent_id && ids.has(item.parent_id) && !ids.has(item.id)) {
        ids.add(item.id)
        grew = true
      }
    }
  }
  return ids
}

function maxRootChecklistSort(items: SopChecklistItem[]): number {
  return items
    .filter((i) => !i.parent_id)
    .reduce((max, i) => Math.max(max, i.sort_order), -1)
}

function hasRichContent(ko: string, en: string): boolean {
  return Boolean((ko || '').trim() || (en || '').trim())
}

function joinRichParts(a: string, b: string): string {
  const parts = [(a || '').trim(), (b || '').trim()].filter(Boolean)
  return parts.join('\n\n')
}

/** 영역(카테고리) → 인접 영역 안의 ROW로 변환. 섹션에 영역이 2개 이상일 때만 가능 */
export function convertSopCategoryToRow(
  doc: SopDocument,
  sectionId: string,
  categoryId: string
): { doc: SopDocument; rowId: string; hostCategoryId: string } | null {
  const section = doc.sections.find((s) => s.id === sectionId)
  if (!section || section.categories.length <= 1) return null

  const ordered = [...section.categories].sort((a, b) => a.sort_order - b.sort_order)
  const sourceIdx = ordered.findIndex((c) => c.id === categoryId)
  if (sourceIdx < 0) return null

  const source = ordered[sourceIdx]
  const hostIdx = sourceIdx > 0 ? sourceIdx - 1 : 1
  const host = ordered[hostIdx]
  if (!host || host.id === categoryId) return null

  const newRowId = newSopId()
  const hostItems = [...(host.checklist_items ?? [])]
  const sourceItems = source.checklist_items ?? []

  const manualKo = joinRichParts(source.content_ko, source.manual_ko ?? '')
  const manualEn = joinRichParts(source.content_en, source.manual_en ?? '')

  const newRow: SopChecklistItem = {
    id: newRowId,
    title_ko: source.title_ko,
    title_en: source.title_en,
    sort_order: maxRootChecklistSort(hostItems) + 1,
    parent_id: null,
    ...(hasRichContent(manualKo, manualEn)
      ? {
          manual_ko: manualKo,
          manual_en: manualEn,
          manual_status: source.manual_status ?? ('draft' as const),
        }
      : {}),
    ...(source.linked_hub_article_ids?.length
      ? { linked_hub_article_ids: source.linked_hub_article_ids }
      : source.linked_hub_article_id
        ? { linked_hub_article_id: source.linked_hub_article_id }
        : {}),
  }

  const remappedSourceItems = sourceItems.map((item) => ({
    ...item,
    parent_id: (item.parent_id ?? null) === null ? newRowId : item.parent_id,
  }))

  const nextHostItems = [...hostItems, newRow, ...remappedSourceItems]

  const nextCategories = ordered
    .filter((c) => c.id !== categoryId)
    .map((category) => {
      if (category.id === host.id) {
        return { ...category, checklist_items: nextHostItems }
      }
      return category
    })
    .map((c, i) => ({ ...c, sort_order: i }))

  return {
    doc: prefillSortOrders({
      ...doc,
      sections: doc.sections.map((s) =>
        s.id !== sectionId ? s : { ...s, categories: nextCategories }
      ),
    }),
    rowId: newRowId,
    hostCategoryId: host.id,
  }
}

/** ROW → 바로 아래 새 영역(카테고리)으로 변환 (루트 ROW만) */
export function convertSopRowToCategory(
  doc: SopDocument,
  sectionId: string,
  categoryId: string,
  itemId: string
): { doc: SopDocument; newCategoryId: string } | null {
  const section = doc.sections.find((s) => s.id === sectionId)
  const category = section?.categories.find((c) => c.id === categoryId)
  if (!section || !category?.checklist_items?.length) return null

  const row = category.checklist_items.find((i) => i.id === itemId)
  if (!row || row.parent_id) return null

  const subtreeIds = collectDescendantIds(category.checklist_items, itemId)
  const descendants = category.checklist_items.filter(
    (i) => subtreeIds.has(i.id) && i.id !== itemId
  )

  let newChecklistItems = descendants.map((item) => ({
    ...item,
    parent_id: item.parent_id === itemId ? null : item.parent_id,
  }))

  const rowExtras: Partial<SopChecklistItem> = {}
  if (row.attachments?.length) rowExtras.attachments = row.attachments
  if (row.linked_hub_article_ids?.length) rowExtras.linked_hub_article_ids = row.linked_hub_article_ids
  else if (row.linked_hub_article_id) rowExtras.linked_hub_article_id = row.linked_hub_article_id
  if (row.manual_status) rowExtras.manual_status = row.manual_status

  const hasExtras = Object.keys(rowExtras).length > 0
  if (hasExtras && newChecklistItems.length === 0) {
    newChecklistItems = [
      {
        id: newSopId(),
        title_ko: '',
        title_en: '',
        sort_order: 0,
        parent_id: null,
        ...rowExtras,
      },
    ]
  } else if (hasExtras && newChecklistItems.length > 0) {
    const firstRootIdx = newChecklistItems.findIndex((i) => !i.parent_id)
    const idx = firstRootIdx >= 0 ? firstRootIdx : 0
    newChecklistItems = newChecklistItems.map((item, i) =>
      i === idx ? { ...item, ...rowExtras } : item
    )
  }

  const newCategoryId = newSopId()
  const newCategory: SopCategory = {
    id: newCategoryId,
    title_ko: row.title_ko,
    title_en: row.title_en,
    content_ko: row.manual_ko ?? '',
    content_en: row.manual_en ?? '',
    sort_order: 0,
    ...(row.linked_hub_article_ids?.length
      ? { linked_hub_article_ids: row.linked_hub_article_ids }
      : row.linked_hub_article_id
        ? { linked_hub_article_id: row.linked_hub_article_id }
        : {}),
    ...(row.manual_status && hasRichContent(row.manual_ko ?? '', row.manual_en ?? '')
      ? { manual_status: row.manual_status }
      : {}),
    ...(newChecklistItems.length > 0 ? { checklist_items: newChecklistItems } : {}),
  }

  const remainingItems = cascadeRemoveChecklistItems(category.checklist_items, itemId)

  const finalSource: SopCategory = remainingItems.length
    ? { ...category, checklist_items: remainingItems }
    : (() => {
        const { checklist_items: _omit, ...rest } = category
        return rest
      })()

  const ordered = [...section.categories].sort((a, b) => a.sort_order - b.sort_order)
  const catIdx = ordered.findIndex((c) => c.id === categoryId)

  const nextCategories = [
    ...ordered.slice(0, catIdx + 1).map((c) => (c.id === categoryId ? finalSource : c)),
    newCategory,
    ...ordered.slice(catIdx + 1),
  ].map((c, i) => ({ ...c, sort_order: i }))

  return {
    doc: prefillSortOrders({
      ...doc,
      sections: doc.sections.map((s) =>
        s.id !== sectionId ? s : { ...s, categories: nextCategories }
      ),
    }),
    newCategoryId,
  }
}
