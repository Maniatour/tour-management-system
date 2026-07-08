import {
  newSopId,
  prefillSortOrders,
  type SopCategory,
  type SopChecklistItem,
  type SopDocument,
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
    categories: [createEmptySopCategory(0)],
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
  if (doc.sections.length <= 1) return null
  return prefillSortOrders({
    ...doc,
    sections: doc.sections.filter((s) => s.id !== sectionId),
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
  if (!section || section.categories.length <= 1) return null

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
