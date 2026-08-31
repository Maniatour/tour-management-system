export type DocumentCategoryTreeItem = {
  id: string
  name_ko: string
  parent_id?: string | null
  sort_order?: number | null
  is_active?: boolean | null
  color?: string | null
}

export function getCategoryChildren<T extends DocumentCategoryTreeItem>(
  categories: T[],
  parentId: string | null
): T[] {
  return categories
    .filter((category) => (category.parent_id || null) === parentId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name_ko.localeCompare(b.name_ko, 'ko'))
}

export function flattenCategoryTree<T extends DocumentCategoryTreeItem>(
  categories: T[],
  parentId: string | null = null,
  depth = 0
): Array<T & { depth: number }> {
  return getCategoryChildren(categories, parentId).flatMap((category) => [
    { ...category, depth },
    ...flattenCategoryTree(categories, category.id, depth + 1),
  ])
}

export function getDescendantIds(categories: DocumentCategoryTreeItem[], id: string): string[] {
  const children = getCategoryChildren(categories, id)
  return children.flatMap((child) => [child.id, ...getDescendantIds(categories, child.id)])
}

export function collectCategoryAndDescendantIds(
  categories: DocumentCategoryTreeItem[],
  id: string
): string[] {
  return [id, ...getDescendantIds(categories, id)]
}

export function getRootCategoryId(categories: DocumentCategoryTreeItem[], id: string): string {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const seen = new Set<string>()
  let currentId = id

  while (currentId) {
    if (seen.has(currentId)) return id
    seen.add(currentId)
    const current = byId.get(currentId)
    if (!current?.parent_id) return currentId
    currentId = current.parent_id
  }

  return id
}

export function countDocumentsInTree(
  documents: Array<{ category_id?: string | null }>,
  categories: DocumentCategoryTreeItem[],
  id: string
): number {
  const ids = new Set(collectCategoryAndDescendantIds(categories, id))
  return documents.filter((doc) => doc.category_id && ids.has(doc.category_id)).length
}

export function isDescendantCategory(
  categories: DocumentCategoryTreeItem[],
  ancestorId: string,
  maybeDescendantId: string
): boolean {
  return getDescendantIds(categories, ancestorId).includes(maybeDescendantId)
}

export function categoryOptionLabel(name: string, depth: number): string {
  if (depth <= 0) return name
  return `${'\u00A0\u00A0'.repeat(depth)}└ ${name}`
}
