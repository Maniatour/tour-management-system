import {
  newSopId,
  orderedChecklistItems,
  sopText,
  splitRichContentToChecklistLines,
  type SopCategory,
  type SopChecklistItem,
  type SopDocument,
  type SopEditLocale,
  type SopManualStatus,
  type SopChecklistRowDisplay,
  type SopSection,
} from '@/types/sopStructure'

export type ManualIconState = 'empty' | 'draft' | 'complete'

export function getManualIconState(
  item: SopChecklistItem,
  lang: SopEditLocale
): ManualIconState {
  const body = sopText(item.manual_ko ?? '', item.manual_en ?? '', lang).trim()
  if (!body) return 'empty'
  return item.manual_status === 'complete' ? 'complete' : 'draft'
}

export function getChecklistManualStatus(item: SopChecklistItem): SopManualStatus {
  return item.manual_status === 'complete' ? 'complete' : 'draft'
}

export function applyChecklistRowDisplay(
  item: SopChecklistItem,
  display: SopChecklistRowDisplay
): SopChecklistItem {
  if (display === 'list') {
    const { row_display: _omit, ...rest } = item
    return rest
  }
  return { ...item, row_display: 'text' }
}

export function getSectionTitleValue(section: SopSection, lang: SopEditLocale): string {
  return lang === 'ko' ? section.title_ko : section.title_en
}

export function applySectionTitleValue(
  section: SopSection,
  lang: SopEditLocale,
  value: string
): SopSection {
  const v = value ?? ''
  return lang === 'ko' ? { ...section, title_ko: v } : { ...section, title_en: v }
}

export function getCategoryTitleValue(category: SopCategory, lang: SopEditLocale): string {
  return lang === 'ko' ? category.title_ko : category.title_en
}

export function applyCategoryTitleValue(
  category: SopCategory,
  lang: SopEditLocale,
  value: string
): SopCategory {
  const v = value ?? ''
  return lang === 'ko' ? { ...category, title_ko: v } : { ...category, title_en: v }
}

export function getCategoryBodyDraft(category: SopCategory, lang: SopEditLocale): string {
  const lines = orderedChecklistItems(category.checklist_items)
    .map((it) => sopText(it.title_ko, it.title_en, lang).trim())
    .filter(Boolean)
  const body = sopText(category.content_ko, category.content_en, lang).trim()
  if (lines.length && body) return `${lines.join('\n')}\n\n${body}`
  if (lines.length) return lines.join('\n')
  return body
}

export function applyCategoryBodyDraft(
  category: SopCategory,
  lang: SopEditLocale,
  raw: string
): SopCategory {
  const text = (raw ?? '').trim()
  const hadChecklist = (category.checklist_items?.length ?? 0) > 0
  const lines = splitRichContentToChecklistLines(text)

  if (hadChecklist || lines.length > 1) {
    const existing = orderedChecklistItems(category.checklist_items)
    const items = lines.map((line, idx) => {
      const prev = existing[idx]
      return {
        id: prev?.id ?? newSopId(),
        title_ko: lang === 'ko' ? line : (prev?.title_ko ?? ''),
        title_en: lang === 'en' ? line : (prev?.title_en ?? ''),
        sort_order: idx,
        parent_id: prev?.parent_id ?? null,
      }
    })
    const { checklist_items: _omit, ...base } = category
    return {
      ...base,
      ...(items.length > 0 ? { checklist_items: items } : {}),
      ...(lang === 'ko' ? { content_ko: '' } : { content_en: '' }),
    }
  }

  return {
    ...category,
    ...(lang === 'ko' ? { content_ko: text } : { content_en: text }),
  }
}

export function detectCategoryEditField(
  category: SopCategory,
  lang: SopEditLocale
): 'title' | 'body' {
  // 체크리스트 줄은 각각 개별 수정 — 영역 수정 버튼은 제목만
  if ((category.checklist_items?.length ?? 0) > 0) return 'title'
  if (sopText(category.content_ko, category.content_en, lang).trim()) return 'body'
  return 'title'
}

export function getChecklistItemValue(item: SopChecklistItem, lang: SopEditLocale): string {
  return sopText(item.title_ko, item.title_en, lang)
}

export function applyChecklistItemValue(
  item: SopChecklistItem,
  lang: SopEditLocale,
  value: string
): SopChecklistItem {
  const v = value ?? ''
  if (lang === 'ko') {
    return { ...item, title_ko: v }
  }
  return { ...item, title_en: v }
}

export function getChecklistManualValue(item: SopChecklistItem, lang: SopEditLocale): string {
  return sopText(item.manual_ko ?? '', item.manual_en ?? '', lang)
}

export function applyChecklistManualValue(
  item: SopChecklistItem,
  lang: SopEditLocale,
  value: string,
  status?: SopManualStatus
): SopChecklistItem {
  const v = value ?? ''
  const manual_ko = lang === 'ko' ? v : (item.manual_ko ?? '')
  const manual_en = lang === 'en' ? v : (item.manual_en ?? '')
  const hasKo = Boolean(manual_ko.trim())
  const hasEn = Boolean(manual_en.trim())

  if (!hasKo && !hasEn) {
    const { manual_ko: _ko, manual_en: _en, manual_status: _st, ...rest } = item
    return rest
  }

  const nextStatus = status ?? item.manual_status ?? 'draft'
  return {
    ...item,
    ...(hasKo ? { manual_ko } : {}),
    ...(hasEn ? { manual_en } : {}),
    manual_status: nextStatus,
  }
}

export function patchChecklistItemInDoc(
  doc: SopDocument,
  sectionId: string,
  categoryId: string,
  itemId: string,
  patch: (item: SopChecklistItem) => SopChecklistItem
): SopDocument {
  return updateDocCategory(doc, sectionId, categoryId, (category) => {
    const items = category.checklist_items?.map((item) =>
      checklistItemIdsMatch(item.id, itemId) ? patch(item) : item
    )
    return items?.length ? { ...category, checklist_items: items } : category
  })
}

function normalizeLegacyChecklistItem(item: SopChecklistItem): SopChecklistItem {
  const legacy = item as SopChecklistItem & {
    title?: string
    text?: string
    content?: string
  }
  const title_ko = item.title_ko || legacy.title || legacy.text || legacy.content || ''
  const title_en = item.title_en || ''
  if (title_ko === item.title_ko && title_en === item.title_en) return item
  return { ...item, title_ko, title_en }
}

function hydrateCategoryRowsForEditing(category: SopCategory): {
  category: SopCategory
  changed: boolean
} {
  if ((category.checklist_items?.length ?? 0) > 0) {
    const items = category.checklist_items!.map(normalizeLegacyChecklistItem)
    const changed = items.some((it, idx) => it !== category.checklist_items![idx])
    return changed ? { category: { ...category, checklist_items: items }, changed: true } : { category, changed: false }
  }

  const bodyKo = (category.content_ko || '').trim()
  const bodyEn = (category.content_en || '').trim()
  const koLines = bodyKo ? splitRichContentToChecklistLines(bodyKo) : []
  const enLines = bodyEn ? splitRichContentToChecklistLines(bodyEn) : []
  if (koLines.length <= 1 && enLines.length <= 1) {
    return { category, changed: false }
  }

  const maxLen = Math.max(koLines.length, enLines.length)
  const items: SopChecklistItem[] = Array.from({ length: maxLen }, (_, idx) => ({
    id: newSopId(),
    title_ko: koLines[idx] ?? '',
    title_en: enLines[idx] ?? '',
    sort_order: idx,
    parent_id: null,
  }))

  return {
    category: {
      ...category,
      checklist_items: items,
      content_ko: koLines.length > 1 ? '' : category.content_ko,
      content_en: enLines.length > 1 ? '' : category.content_en,
    },
    changed: true,
  }
}

/** 기존 본문·레거시 체크 데이터를 줄 단위 편집 가능한 형태로 정규화 */
export function hydrateDocumentForRowEditing(doc: SopDocument): SopDocument {
  let anyChanged = false
  const sections = doc.sections.map((section) => {
    let sectionChanged = false
    const categories = section.categories.map((category) => {
      const result = hydrateCategoryRowsForEditing(category)
      if (result.changed) sectionChanged = true
      return result.category
    })
    if (sectionChanged) {
      anyChanged = true
      return { ...section, categories }
    }
    return section
  })
  return anyChanged ? { ...doc, sections } : doc
}

export function checklistItemIdsMatch(a: string, b: string): boolean {
  return String(a) === String(b)
}

export function updateDocCategory(
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
