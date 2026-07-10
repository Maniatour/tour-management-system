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
import { sopPlainDisplayText } from '@/components/LightRichEditor'

/** 체크리스트 줄 재구성 시 메뉴얼·첨부 등 부가 필드 유지 */
function copyChecklistItemRowExtras(prev: SopChecklistItem | undefined): Partial<SopChecklistItem> {
  if (!prev) return {}
  return {
    ...(prev.manual_ko ? { manual_ko: prev.manual_ko } : {}),
    ...(prev.manual_en ? { manual_en: prev.manual_en } : {}),
    ...(prev.manual_status ? { manual_status: prev.manual_status } : {}),
    ...(prev.linked_hub_article_id ? { linked_hub_article_id: prev.linked_hub_article_id } : {}),
    ...(prev.row_display === 'text' ? { row_display: 'text' as const } : {}),
    ...(prev.attachments?.length ? { attachments: prev.attachments } : {}),
  }
}

export function hasChecklistManualContent(value: string | undefined | null): boolean {
  return Boolean(sopPlainDisplayText(value ?? '').trim())
}

export function sopDisplayLabel(ko: string, en: string, lang: SopEditLocale): string {
  return sopPlainDisplayText(sopText(ko, en, lang))
}

export function getChecklistItemDisplayLabel(item: SopChecklistItem, lang: SopEditLocale): string {
  return sopDisplayLabel(item.title_ko, item.title_en, lang)
}

export type ManualIconState = 'empty' | 'draft' | 'complete'

export type ManualSavePayload = {
  value: string
  linkedHubArticleId: string | null
  status: SopManualStatus
}

export type SopManualFields = {
  manual_ko?: string
  manual_en?: string
  manual_status?: SopManualStatus
  linked_hub_article_id?: string
}

export function getManualValue(fields: SopManualFields, lang: SopEditLocale): string {
  return sopText(fields.manual_ko ?? '', fields.manual_en ?? '', lang)
}

export function hasManualLink(fields: SopManualFields): boolean {
  return Boolean(fields.linked_hub_article_id?.trim())
}

export function hasManualSource(fields: SopManualFields, lang: SopEditLocale): boolean {
  if (hasManualLink(fields)) return true
  return hasChecklistManualContent(getManualValue(fields, lang))
}

export function getManualIconStateFromFields(
  fields: SopManualFields,
  lang: SopEditLocale
): ManualIconState {
  if (!hasManualSource(fields, lang)) return 'empty'
  return fields.manual_status === 'complete' ? 'complete' : 'draft'
}

export function getManualStatusFromFields(fields: SopManualFields): SopManualStatus {
  return fields.manual_status === 'complete' ? 'complete' : 'draft'
}

export function applyManualSaveToFields(
  fields: SopManualFields,
  lang: SopEditLocale,
  payload: ManualSavePayload
): SopManualFields {
  const v = payload.value ?? ''
  const manual_ko = lang === 'ko' ? v : (fields.manual_ko ?? '')
  const manual_en = lang === 'en' ? v : (fields.manual_en ?? '')
  const hasKo = hasChecklistManualContent(manual_ko)
  const hasEn = hasChecklistManualContent(manual_en)
  const linkId = payload.linkedHubArticleId?.trim() ?? ''

  if (!hasKo && !hasEn && !linkId) {
    const {
      manual_ko: _ko,
      manual_en: _en,
      linked_hub_article_id: _link,
      manual_status: _st,
      ...rest
    } = fields
    return rest
  }

  const next: SopManualFields = { ...fields, manual_status: payload.status }
  if (hasKo) next.manual_ko = manual_ko
  else delete next.manual_ko
  if (hasEn) next.manual_en = manual_en
  else delete next.manual_en
  if (linkId) next.linked_hub_article_id = linkId
  else delete next.linked_hub_article_id
  return next
}

export function hasChecklistManualLink(item: SopChecklistItem): boolean {
  return hasManualLink(item)
}

export function hasChecklistManualSource(
  item: SopChecklistItem,
  lang: SopEditLocale
): boolean {
  if (hasChecklistManualLink(item)) return true
  return hasChecklistManualContent(getChecklistManualValue(item, lang))
}

export function getManualIconState(
  item: SopChecklistItem,
  lang: SopEditLocale
): ManualIconState {
  if (!hasChecklistManualSource(item, lang)) return 'empty'
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

export function getSectionBodyValue(section: SopSection, lang: SopEditLocale): string {
  return lang === 'ko' ? (section.content_ko ?? '') : (section.content_en ?? '')
}

export function applySectionBodyValue(
  section: SopSection,
  lang: SopEditLocale,
  value: string
): SopSection {
  const v = value ?? ''
  return lang === 'ko' ? { ...section, content_ko: v } : { ...section, content_en: v }
}

function joinSectionText(a: string, b: string): string {
  const parts = [(a || '').trim(), (b || '').trim()].filter(Boolean)
  return parts.join('\n\n')
}

function hasCategoryTitle(category: SopCategory): boolean {
  return Boolean(category.title_ko?.trim() || category.title_en?.trim())
}

function isLegacySectionBodySlot(category: SopCategory): boolean {
  if (hasCategoryTitle(category)) return false
  if ((category.checklist_items?.length ?? 0) > 0) return false
  if (category.manual_ko?.trim() || category.manual_en?.trim()) return false
  if (category.linked_hub_article_id?.trim()) return false
  return true
}

/** 예전 제목 없는 영역(섹션 본문 대용) → section.content 로 이전, 잘못 들어간 줄은 바로 아래 카테고리로 */
export function migrateLegacySectionBodySlots(section: SopSection): SopSection {
  const ordered = [...section.categories].sort((a, b) => a.sort_order - b.sort_order)
  if (ordered.length === 0) return section

  let content_ko = (section.content_ko ?? '').trim()
  let content_en = (section.content_en ?? '').trim()
  let categories = ordered
  let changed = false

  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i]
    if (isLegacySectionBodySlot(c)) {
      content_ko = joinSectionText(content_ko, c.content_ko ?? '')
      content_en = joinSectionText(content_en, c.content_en ?? '')
      categories = categories.filter((x) => x.id !== c.id)
      changed = true
      continue
    }

    if (!hasCategoryTitle(c) && (c.checklist_items?.length ?? 0) > 0) {
      const nextTitled = ordered.slice(i + 1).find((x) => hasCategoryTitle(x))
      if (nextTitled) {
        categories = categories.map((cat) =>
          cat.id === nextTitled.id
            ? {
                ...cat,
                checklist_items: [...(cat.checklist_items ?? []), ...(c.checklist_items ?? [])],
              }
            : cat
        )
        content_ko = joinSectionText(content_ko, c.content_ko ?? '')
        content_en = joinSectionText(content_en, c.content_en ?? '')
        categories = categories.filter((x) => x.id !== c.id)
        changed = true
      }
    }
  }

  if (!changed) return section
  return {
    ...section,
    content_ko,
    content_en,
    categories: categories.map((cat, idx) => ({ ...cat, sort_order: idx })),
  }
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
        ...copyChecklistItemRowExtras(prev),
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

/** 영역(카테고리) 제목 없이 섹션 본문만 쓰는 경우 — 레거시 호환 */
export function isTitlelessCategory(category: SopCategory, lang: SopEditLocale): boolean {
  return !sopText(category.title_ko, category.title_en, lang).trim()
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
  return getManualValue(item, lang)
}

export function getCategoryManualValue(category: SopCategory, lang: SopEditLocale): string {
  return getManualValue(category, lang)
}

export function getCategoryManualStatus(category: SopCategory): SopManualStatus {
  return getManualStatusFromFields(category)
}

export function getCategoryManualIconState(
  category: SopCategory,
  lang: SopEditLocale
): ManualIconState {
  return getManualIconStateFromFields(category, lang)
}

export function hasCategoryManualSource(category: SopCategory, lang: SopEditLocale): boolean {
  return hasManualSource(category, lang)
}

function mergeManualFieldsInto<T extends SopManualFields>(base: T, saved: SopManualFields): T {
  const {
    manual_ko: _mk,
    manual_en: _me,
    manual_status: _ms,
    linked_hub_article_id: _lid,
    ...rest
  } = base
  return {
    ...rest,
    ...(saved.manual_ko ? { manual_ko: saved.manual_ko } : {}),
    ...(saved.manual_en ? { manual_en: saved.manual_en } : {}),
    ...(saved.manual_status ? { manual_status: saved.manual_status } : {}),
    ...(saved.linked_hub_article_id ? { linked_hub_article_id: saved.linked_hub_article_id } : {}),
  } as T
}

export function applyCategoryManualSave(
  category: SopCategory,
  lang: SopEditLocale,
  payload: ManualSavePayload
): SopCategory {
  return mergeManualFieldsInto(category, applyManualSaveToFields(category, lang, payload))
}

export function applyChecklistManualSave(
  item: SopChecklistItem,
  lang: SopEditLocale,
  payload: ManualSavePayload
): SopChecklistItem {
  return mergeManualFieldsInto(item, applyManualSaveToFields(item, lang, payload))
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
  // 제목 없는 레거시 슬롯·섹션 본문은 줄 목록으로 쪼개지 않음
  if (!hasCategoryTitle(category)) {
    return { category, changed: false }
  }
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
    const migrated = migrateLegacySectionBodySlots(section)
    const sectionBase = migrated !== section ? migrated : section
    if (migrated !== section) anyChanged = true

    let sectionChanged = migrated !== section
    const categories = sectionBase.categories.map((category) => {
      const result = hydrateCategoryRowsForEditing(category)
      if (result.changed) sectionChanged = true
      return result.category
    })
    if (sectionChanged) {
      anyChanged = true
      return { ...sectionBase, categories }
    }
    return sectionBase
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
