import { sopPlainDisplayText } from '@/components/LightRichEditor'
import type { SopChecklistItem, SopDocument, SopEditLocale } from '@/types/sopStructure'
import { checklistRootRows, sopText } from '@/types/sopStructure'

export type SopTocLevel = 'section' | 'category' | 'row' | 'step'

export type SopTocEntry = {
  anchorId: string
  label: string
  level: SopTocLevel
  children?: SopTocEntry[]
}

export function sopSectionAnchorId(sectionId: string): string {
  return `sop-sec-${sectionId}`
}

export function sopCategoryAnchorId(categoryId: string): string {
  return `sop-cat-${categoryId}`
}

export function sopChecklistAnchorId(itemId: string): string {
  return `sop-chk-${itemId}`
}

/** 목차·앵커용 짧은 평문 라벨 */
export function sopTocPlainLabel(raw: string, fallback: string, maxLen = 72): string {
  const t = sopPlainDisplayText(raw)
  const label = t || fallback
  return label.length > maxLen ? `${label.slice(0, maxLen)}…` : label
}

function checklistTocLabel(
  titleKo: string,
  titleEn: string,
  viewLang: SopEditLocale,
  fallback: string
): string {
  return sopTocPlainLabel(sopText(titleKo, titleEn, viewLang), fallback)
}

function buildChecklistTocTree(
  items: SopChecklistItem[] | undefined,
  viewLang: SopEditLocale
): SopTocEntry[] {
  if (!items?.length) return []
  const roots = checklistRootRows(items)
  return roots.map((row, ri) => {
    const rowFallback = viewLang === 'en' ? `Row ${ri + 1}` : `줄 ${ri + 1}`
    return {
      anchorId: sopChecklistAnchorId(row.id),
      label: checklistTocLabel(row.title_ko, row.title_en, viewLang, rowFallback),
      level: 'row' as const,
    }
  })
}

export function buildSopDocumentToc(doc: SopDocument, viewLang: SopEditLocale): SopTocEntry[] {
  const sections = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order)
  const entries: SopTocEntry[] = []

  for (let si = 0; si < sections.length; si++) {
    const s = sections[si]
    const st = sopText(s.title_ko, s.title_en, viewLang).trim()
    const sectionFallback = viewLang === 'en' ? `Section ${si + 1}` : `섹션 ${si + 1}`
    const cats = [...s.categories].sort((a, b) => a.sort_order - b.sort_order)
    const children: SopTocEntry[] = []

    for (let ci = 0; ci < cats.length; ci++) {
      const c = cats[ci]
      const ct = sopText(c.title_ko, c.title_en, viewLang).trim()
      const catFallback = viewLang === 'en' ? `Category ${ci + 1}` : `카테고리 ${ci + 1}`
      const rowTree = buildChecklistTocTree(c.checklist_items, viewLang)
      children.push({
        anchorId: sopCategoryAnchorId(c.id),
        label: sopTocPlainLabel(ct, catFallback),
        level: 'category',
        ...(rowTree.length > 0 ? { children: rowTree } : {}),
      })
    }

    entries.push({
      anchorId: sopSectionAnchorId(s.id),
      label: sopTocPlainLabel(st, sectionFallback),
      level: 'section',
      ...(children.length > 0 ? { children } : {}),
    })
  }

  return entries
}

export function sopTocAnchorIds(entries: SopTocEntry[]): string[] {
  const ids: string[] = []
  const walk = (list: SopTocEntry[]) => {
    for (const e of list) {
      ids.push(e.anchorId)
      if (e.children?.length) walk(e.children)
    }
  }
  walk(entries)
  return ids
}
