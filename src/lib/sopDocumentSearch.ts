import { sopPlainDisplayText } from '@/components/LightRichEditor'
import {
  sopCategoryAnchorId,
  sopChecklistAnchorId,
  sopSectionAnchorId,
} from '@/lib/sopDocumentToc'
import {
  checklistRootRows,
  sopText,
  type SopChecklistItem,
  type SopDocument,
  type SopEditLocale,
} from '@/types/sopStructure'

export type SopSearchFieldKind =
  | 'document_title'
  | 'section_title'
  | 'category_title'
  | 'category_body'
  | 'category_manual'
  | 'row_title'
  | 'row_manual'
  | 'attachment_label'

export type SopDocumentSearchHit = {
  id: string
  anchorId: string
  /** 메뉴얼 검색 시 아코디언 펼침용 */
  rowId?: string
  fieldKind: SopSearchFieldKind
  fieldLabel: string
  plainText: string
  snippet: string
}

type SearchIndexEntry = Omit<SopDocumentSearchHit, 'snippet'>

function toPlain(raw: string): string {
  return sopPlainDisplayText(raw).trim()
}

function fieldLabels(uiLocaleEn: boolean): Record<SopSearchFieldKind, string> {
  return uiLocaleEn
    ? {
        document_title: 'Document title',
        section_title: 'Section title',
        category_title: 'Block title',
        category_body: 'Block content',
        category_manual: 'Block manual',
        row_title: 'Row title',
        row_manual: 'Manual',
        attachment_label: 'Attachment',
      }
    : {
        document_title: '문서 제목',
        section_title: '섹션 제목',
        category_title: '영역 제목',
        category_body: '영역 내용',
        category_manual: '영역 메뉴얼',
        row_title: '줄 제목',
        row_manual: '메뉴얼',
        attachment_label: '첨부',
      }
}

function makeSnippet(text: string, query: string, maxLen = 96): string {
  const lower = text.toLowerCase()
  const q = query.trim().toLowerCase()
  if (!q) return text.slice(0, maxLen)
  const idx = lower.indexOf(q)
  if (idx < 0) return text.slice(0, maxLen)
  const start = Math.max(0, idx - 24)
  const end = Math.min(text.length, idx + query.length + 48)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = `…${snippet}`
  if (end < text.length) snippet = `${snippet}…`
  return snippet
}

function checklistItemAnchorId(item: SopChecklistItem, items: SopChecklistItem[]): string {
  if (!item.parent_id) return sopChecklistAnchorId(item.id)
  const parent = items.find((i) => i.id === item.parent_id)
  if (!parent) return sopChecklistAnchorId(item.id)
  return checklistItemAnchorId(parent, items)
}

function checklistRootRowId(item: SopChecklistItem, items: SopChecklistItem[]): string {
  if (!item.parent_id) return item.id
  const parent = items.find((i) => i.id === item.parent_id)
  if (!parent) return item.id
  return checklistRootRowId(parent, items)
}

function indexChecklistItems(
  items: SopChecklistItem[],
  viewLang: SopEditLocale,
  labels: Record<SopSearchFieldKind, string>,
  push: (entry: Omit<SearchIndexEntry, 'id'>) => void
) {
  const walk = (item: SopChecklistItem) => {
    const anchorId = checklistItemAnchorId(item, items)
    const expandRowId = checklistRootRowId(item, items)
    const title = toPlain(sopText(item.title_ko, item.title_en, viewLang))
    if (title) {
      push({
        anchorId,
        rowId: expandRowId,
        fieldKind: 'row_title',
        fieldLabel: labels.row_title,
        plainText: title,
      })
    }

    const manual = toPlain(sopText(item.manual_ko ?? '', item.manual_en ?? '', viewLang))
    if (manual) {
      push({
        anchorId,
        rowId: expandRowId,
        fieldKind: 'row_manual',
        fieldLabel: labels.row_manual,
        plainText: manual,
      })
    }

    for (const att of item.attachments ?? []) {
      const attLabel = toPlain(sopText(att.label_ko, att.label_en, viewLang))
      const fallback = att.url.trim()
      const plainText = attLabel || fallback
      if (plainText) {
        push({
          anchorId,
          rowId: expandRowId,
          fieldKind: 'attachment_label',
          fieldLabel: labels.attachment_label,
          plainText,
        })
      }
    }

    const children = items
      .filter((i) => i.parent_id === item.id)
      .sort((a, b) => a.sort_order - b.sort_order)
    for (const child of children) walk(child)
  }

  for (const root of checklistRootRows(items)) walk(root)
}

export function buildSopDocumentSearchIndex(
  doc: SopDocument,
  viewLang: SopEditLocale,
  uiLocaleEn: boolean
): SearchIndexEntry[] {
  const labels = fieldLabels(uiLocaleEn)
  const hits: SearchIndexEntry[] = []
  let counter = 0

  const push = (entry: Omit<SearchIndexEntry, 'id'>) => {
    hits.push({ ...entry, id: `sop-search-${counter++}` })
  }

  const sections = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order)

  const docTitle = toPlain(sopText(doc.title_ko, doc.title_en, viewLang))
  if (docTitle) {
    push({
      anchorId: 'sop-doc-top',
      fieldKind: 'document_title',
      fieldLabel: labels.document_title,
      plainText: docTitle,
    })
  }

  for (const section of sections) {
    const sectionAnchor = sopSectionAnchorId(section.id)
    const sectionTitle = toPlain(sopText(section.title_ko, section.title_en, viewLang))
    if (sectionTitle) {
      push({
        anchorId: sectionAnchor,
        fieldKind: 'section_title',
        fieldLabel: labels.section_title,
        plainText: sectionTitle,
      })
    }

    const categories = [...section.categories].sort((a, b) => a.sort_order - b.sort_order)
    for (const category of categories) {
      const categoryAnchor = sopCategoryAnchorId(category.id)
      const catTitle = toPlain(sopText(category.title_ko, category.title_en, viewLang))
      if (catTitle) {
        push({
          anchorId: categoryAnchor,
          fieldKind: 'category_title',
          fieldLabel: labels.category_title,
          plainText: catTitle,
        })
      }

      const body = toPlain(sopText(category.content_ko, category.content_en, viewLang))
      if (body) {
        push({
          anchorId: categoryAnchor,
          fieldKind: 'category_body',
          fieldLabel: labels.category_body,
          plainText: body,
        })
      }

      const manual = toPlain(sopText(category.manual_ko ?? '', category.manual_en ?? '', viewLang))
      if (manual) {
        push({
          anchorId: categoryAnchor,
          fieldKind: 'category_manual',
          fieldLabel: labels.category_manual,
          plainText: manual,
        })
      }

      if (category.checklist_items?.length) {
        indexChecklistItems(category.checklist_items, viewLang, labels, push)
      }
    }
  }

  return hits
}

export function searchSopDocument(
  doc: SopDocument,
  query: string,
  viewLang: SopEditLocale,
  uiLocaleEn: boolean
): SopDocumentSearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  return buildSopDocumentSearchIndex(doc, viewLang, uiLocaleEn)
    .filter((entry) => entry.plainText.toLowerCase().includes(q))
    .map((entry) => ({
      ...entry,
      snippet: makeSnippet(entry.plainText, query),
    }))
}

export function sopDocumentTopAnchorId(doc: SopDocument): string {
  const sections = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order)
  return sections[0] ? sopSectionAnchorId(sections[0].id) : 'sop-doc-top'
}
