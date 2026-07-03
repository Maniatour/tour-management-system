import type { SopDocument, SopEditLocale } from '@/types/sopStructure'
import { sopText } from '@/types/sopStructure'

export type SopTocEntry = {
  anchorId: string
  label: string
  level: 'section' | 'category'
  children?: SopTocEntry[]
}

export function sopSectionAnchorId(sectionId: string): string {
  return `sop-sec-${sectionId}`
}

export function sopCategoryAnchorId(categoryId: string): string {
  return `sop-cat-${categoryId}`
}

/** 목차·앵커용 짧은 평문 라벨 */
export function sopTocPlainLabel(raw: string, fallback: string, maxLen = 72): string {
  const t = (raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const label = t || fallback
  return label.length > maxLen ? `${label.slice(0, maxLen)}…` : label
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
      children.push({
        anchorId: sopCategoryAnchorId(c.id),
        label: sopTocPlainLabel(ct, catFallback),
        level: 'category',
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
  for (const e of entries) {
    ids.push(e.anchorId)
    for (const ch of e.children ?? []) ids.push(ch.anchorId)
  }
  return ids
}
