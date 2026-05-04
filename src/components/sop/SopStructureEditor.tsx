'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  FileText,
  History,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import LightRichEditor from '@/components/LightRichEditor'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import SopDocumentReadonly from '@/components/sop/SopDocumentReadonly'
import type { SopDocument, SopSection, SopCategory, SopChecklistItem, SopEditLocale } from '@/types/sopStructure'
import {
  newSopId,
  orderedChecklistItems,
  prefillSortOrders,
  checklistItemDepth,
  splitRichContentToChecklistLines,
  parseSopSectionJson,
  sopText,
} from '@/types/sopStructure'
import { cn } from '@/lib/utils'

export type SectionVersionHistoryRow = {
  id: string
  revision: number
  created_at: string
  section_json: unknown
  created_by: string | null
}

function sortSections(doc: SopDocument): SopSection[] {
  return [...doc.sections].sort((a, b) => a.sort_order - b.sort_order)
}

function sortCategories(s: SopSection): SopCategory[] {
  return [...s.categories].sort((a, b) => a.sort_order - b.sort_order)
}

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

function collectChecklistSubtreeIds(items: SopChecklistItem[], rootId: string): Set<string> {
  const s = new Set<string>()
  const walk = (id: string) => {
    s.add(id)
    for (const it of items) {
      if (it.parent_id === id) walk(it.id)
    }
  }
  walk(rootId)
  return s
}

function checklistItemsWithoutSubtree(items: SopChecklistItem[], rootId: string): SopChecklistItem[] {
  const rm = collectChecklistSubtreeIds(items, rootId)
  return items.filter((i) => !rm.has(i.id))
}

/** root(한 줄)을 제외한 하위만 남기고, 직접 자식은 루트(parent null)로 승격한 뒤 sort_order를 정리 */
function promoteChecklistSubtreeToStandaloneRoots(items: SopChecklistItem[], rootId: string): SopChecklistItem[] {
  const ids = collectChecklistSubtreeIds(items, rootId)
  const subset = items
    .filter((i) => ids.has(i.id) && i.id !== rootId)
    .map((it) => ({
      ...it,
      parent_id: it.parent_id === rootId ? null : it.parent_id,
    }))
  const ord = orderedChecklistItems(subset)
  const orderMap = new Map(ord.map((it, idx) => [it.id, idx]))
  return subset.map((it) => ({ ...it, sort_order: orderMap.get(it.id) ?? 0 }))
}

/** 카테고리 제목 + 기존 체크 줄을 모두 루트 한 줄씩으로 펼침(들여쓰기 해제), sort_order는 start부터 연속 */
function categoryTitleAndChecklistAsRootLines(cat: SopCategory, startSort: number): SopChecklistItem[] {
  const out: SopChecklistItem[] = []
  let o = startSort
  out.push({
    id: newSopId(),
    title_ko: cat.title_ko,
    title_en: cat.title_en,
    sort_order: o++,
    parent_id: null,
  })
  for (const it of orderedChecklistItems(cat.checklist_items)) {
    out.push({ ...it, parent_id: null, sort_order: o++ })
  }
  return out
}

const editorTitleProps = {
  height: 100,
  enableImageUpload: false,
  enableResize: false,
  enableColorPicker: false,
  enableFontSize: false,
} as const

const editorBodyProps = {
  height: 240,
  enableImageUpload: false,
  enableResize: true,
  minHeight: 160,
  maxHeight: 520,
} as const

type PairLayout = 'dual' | 'focus_ko' | 'focus_en'

function DualRichPair({
  koValue,
  enValue,
  onKoChange,
  onEnChange,
  koPlaceholder,
  enPlaceholder,
  editorProps,
  pairLayout = 'dual',
  uiLocaleEn,
}: {
  koValue: string
  enValue: string
  onKoChange: (v: string | undefined) => void
  onEnChange: (v: string | undefined) => void
  koPlaceholder: string
  enPlaceholder: string
  editorProps: typeof editorTitleProps | typeof editorBodyProps
  pairLayout?: PairLayout
  /** dual 모드에서는 생략 가능 */
  uiLocaleEn?: boolean
}) {
  if (pairLayout === 'dual') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border-2 border-sky-300 bg-sky-50/90 p-2 shadow-sm">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded bg-sky-800 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              한국어
            </span>
            <span className="text-[11px] font-medium text-sky-950/90">Korean</span>
          </div>
          <LightRichEditor
            {...editorProps}
            value={koValue}
            onChange={onKoChange}
            placeholder={koPlaceholder}
            className="bg-white rounded-md border border-sky-200 overflow-hidden"
          />
        </div>
        <div className="rounded-md border-2 border-violet-300 bg-violet-50/90 p-2 shadow-sm">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded bg-violet-800 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              English
            </span>
            <span className="text-[11px] font-medium text-violet-950/90">영문</span>
          </div>
          <LightRichEditor
            {...editorProps}
            value={enValue}
            onChange={onEnChange}
            placeholder={enPlaceholder}
            className="bg-white rounded-md border border-violet-200 overflow-hidden"
          />
        </div>
      </div>
    )
  }

  const editKo = pairLayout === 'focus_ko'
  const activeLabel = editKo
    ? uiLocaleEn
      ? 'Korean (editing)'
      : '한국어 (편집)'
    : uiLocaleEn
      ? 'English (editing)'
      : 'English (편집)'
  const refLabel = editKo
    ? uiLocaleEn
      ? 'Reference: English'
      : '참고: English'
    : uiLocaleEn
      ? 'Reference: Korean'
      : '참고: 한국어'

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className={`rounded-md border-2 p-2 shadow-sm ${editKo ? 'border-sky-400 bg-sky-50/95' : 'border-violet-400 bg-violet-50/95'}`}>
        <div className="mb-1.5 text-[11px] font-semibold text-slate-800">{activeLabel}</div>
        <LightRichEditor
          {...editorProps}
          value={editKo ? koValue : enValue}
          onChange={editKo ? onKoChange : onEnChange}
          placeholder={editKo ? koPlaceholder : enPlaceholder}
          className={`bg-white rounded-md border overflow-hidden ${editKo ? 'border-sky-200' : 'border-violet-200'}`}
        />
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50/90 p-2 shadow-sm">
        <div className="mb-1.5 text-[11px] font-medium text-slate-600">{refLabel}</div>
        <LightRichEditor
          {...editorProps}
          readOnly
          value={editKo ? enValue : koValue}
          onChange={() => {}}
          placeholder={editKo ? enPlaceholder : koPlaceholder}
          className="bg-white/90 rounded-md border border-slate-200 overflow-hidden"
        />
      </div>
    </div>
  )
}

/** 트리 라벨용: 리치 텍스트를 짧은 한 줄로 */
function plainPreview(html: string, max = 80): string {
  const t = (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return '—'
  return t.length > max ? `${t.slice(0, max)}…` : t
}

type Props = {
  value: SopDocument
  onChange: (next: SopDocument) => void
  /** UI 라벨(버튼 등) 언어 — URL 로케일 */
  uiLocaleEn: boolean
  /** 체크 줄 가져오기·일부 동작에 쓰는 기준 언어 */
  editLocale: SopEditLocale
  /** 한·영 동시 2열 vs 한쪽 편집+참고 열 */
  bilingualFieldMode?: 'dual' | 'focus'
  /** bilingualFieldMode 가 focus 일 때 편집 중인 본문 언어 */
  focusContentLocale?: SopEditLocale
  disabled?: boolean
  /** 섹션 id → 서버에 저장된 최신 섹션 버전 메타 */
  sectionVersionMeta?: Record<string, { revision: number; savedAt: string }>
  savingSectionId?: string | null
  onSaveSectionVersion?: (section: SopSection) => void | Promise<void>
  onFetchSectionVersionHistory?: (sectionId: string) => Promise<SectionVersionHistoryRow[]>
  onRestoreSectionFromHistory?: (sectionId: string, sectionJson: unknown) => void | Promise<void>
}

export default function SopStructureEditor({
  value,
  onChange,
  uiLocaleEn,
  editLocale,
  bilingualFieldMode = 'dual',
  focusContentLocale = 'ko',
  disabled,
  sectionVersionMeta = {},
  savingSectionId = null,
  onSaveSectionVersion,
  onFetchSectionVersionHistory,
  onRestoreSectionFromHistory,
}: Props) {
  const isEn = uiLocaleEn
  const pairLayout: PairLayout =
    bilingualFieldMode === 'focus' ? (focusContentLocale === 'ko' ? 'focus_ko' : 'focus_en') : 'dual'
  const [historyOpen, setHistoryOpen] = useState<{
    sectionId: string
    label: string
  } | null>(null)
  const [historyRows, setHistoryRows] = useState<SectionVersionHistoryRow[]>([])
  const [historyLoadingSectionId, setHistoryLoadingSectionId] = useState<string | null>(null)
  const [historyErr, setHistoryErr] = useState<string | null>(null)
  const [expandedHistoryRevision, setExpandedHistoryRevision] = useState<number | null>(null)

  const [editorLayout, setEditorLayout] = useState<'tree' | 'classic'>('tree')
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(() => new Set())
  const [nodeModal, setNodeModal] = useState<
    null | { type: 'section'; sectionId: string } | { type: 'category'; sectionId: string; categoryId: string }
  >(null)
  const [categoryDraft, setCategoryDraft] = useState<SopCategory | null>(null)

  useEffect(() => {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev)
      for (const s of value.sections) next.add(s.id)
      return next
    })
  }, [value.sections])

  const toggleSectionExpanded = (id: string) => {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openSectionHistory = async (section: SopSection) => {
    if (!onFetchSectionVersionHistory) return
    const label =
      sopText(section.title_ko, section.title_en, editLocale).trim() ||
      (isEn ? `Section ${section.id.slice(0, 8)}…` : `섹션 ${section.id.slice(0, 8)}…`)
    setHistoryOpen({ sectionId: section.id, label })
    setHistoryLoadingSectionId(section.id)
    setHistoryErr(null)
    setHistoryRows([])
    setExpandedHistoryRevision(null)
    try {
      const rows = await onFetchSectionVersionHistory(section.id)
      setHistoryRows(rows)
    } catch (e) {
      setHistoryErr(e instanceof Error ? e.message : String(e))
    } finally {
      setHistoryLoadingSectionId(null)
    }
  }

  const closeSectionHistory = () => {
    setHistoryOpen(null)
    setHistoryRows([])
    setHistoryErr(null)
    setExpandedHistoryRevision(null)
  }

  const emit = useCallback(
    (next: SopDocument) => {
      onChange(prefillSortOrders(next))
    },
    [onChange]
  )

  const updateSection = (sectionId: string, patch: Partial<SopSection>) => {
    emit({
      ...value,
      sections: value.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    })
  }

  const updateCategory = (sectionId: string, categoryId: string, patch: Partial<SopCategory>) => {
    emit({
      ...value,
      sections: value.sections.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              categories: s.categories.map((c) => (c.id === categoryId ? { ...c, ...patch } : c)),
            }
      ),
    })
  }

  const addSection = () => {
    emit({
      ...value,
      sections: [
        ...value.sections,
        {
          id: newSopId(),
          title_ko: '',
          title_en: '',
          sort_order: value.sections.length,
          categories: [
                {
                  id: newSopId(),
                  title_ko: '',
                  title_en: '',
                  content_ko: '',
                  content_en: '',
                  sort_order: 0,
                },
          ],
        },
      ],
    })
  }

  const removeSection = (sectionId: string) => {
    if (value.sections.length <= 1) return
    emit({ ...value, sections: value.sections.filter((s) => s.id !== sectionId) })
  }

  const moveSection = (sectionId: string, dir: -1 | 1) => {
    const ordered = sortSections(value)
    const i = ordered.findIndex((s) => s.id === sectionId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ordered.length) return
    const swapped = [...ordered]
    ;[swapped[i], swapped[j]] = [swapped[j], swapped[i]]
    emit({
      ...value,
      sections: swapped.map((s, idx) => ({ ...s, sort_order: idx })),
    })
  }

  const addCategoryAndOpenModal = (sectionId: string) => {
    const s = value.sections.find((x) => x.id === sectionId)
    if (!s) return
    const newId = newSopId()
    const newCat: SopCategory = {
      id: newId,
      title_ko: '',
      title_en: '',
      content_ko: '',
      content_en: '',
      sort_order: s.categories.length,
    }
    emit({
      ...value,
      sections: value.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : {
              ...sec,
              categories: [...sec.categories, newCat],
            }
      ),
    })
    setCategoryDraft(JSON.parse(JSON.stringify(newCat)) as SopCategory)
    setNodeModal({ type: 'category', sectionId, categoryId: newId })
    setExpandedSectionIds((prev) => {
      const next = new Set(prev)
      next.add(sectionId)
      return next
    })
  }

  /** 트리: 현재 카테고리 행 바로 아래에 새 행 삽입 후 모달 */
  const addCategoryAfterAndOpenModal = (sectionId: string, afterCategoryId: string) => {
    const s = value.sections.find((x) => x.id === sectionId)
    if (!s) return
    const ordered = sortCategories(s)
    const idx = ordered.findIndex((c) => c.id === afterCategoryId)
    if (idx < 0) return
    const newId = newSopId()
    const newCat: SopCategory = {
      id: newId,
      title_ko: '',
      title_en: '',
      content_ko: '',
      content_en: '',
      sort_order: idx + 1,
    }
    const merged = [...ordered.slice(0, idx + 1), newCat, ...ordered.slice(idx + 1)]
    emit({
      ...value,
      sections: value.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : { ...sec, categories: merged.map((c, i) => ({ ...c, sort_order: i })) }
      ),
    })
    setCategoryDraft(JSON.parse(JSON.stringify(newCat)) as SopCategory)
    setNodeModal({ type: 'category', sectionId, categoryId: newId })
    setExpandedSectionIds((prev) => {
      const next = new Set(prev)
      next.add(sectionId)
      return next
    })
  }

  const switchCategoryInModal = (targetCategoryId: string) => {
    if (nodeModal?.type !== 'category') return
    if (targetCategoryId === nodeModal.categoryId) return
    const sec = value.sections.find((x) => x.id === nodeModal.sectionId)
    const cat = sec?.categories.find((c) => c.id === targetCategoryId)
    if (!cat) return
    setCategoryDraft(JSON.parse(JSON.stringify(cat)) as SopCategory)
    setNodeModal({ type: 'category', sectionId: nodeModal.sectionId, categoryId: targetCategoryId })
  }

  const removeCategory = (sectionId: string, categoryId: string) => {
    const s = value.sections.find((x) => x.id === sectionId)
    if (!s || s.categories.length <= 1) return
    emit({
      ...value,
      sections: value.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : { ...sec, categories: sec.categories.filter((c) => c.id !== categoryId) }
      ),
    })
  }

  const moveCategory = (sectionId: string, categoryId: string, dir: -1 | 1) => {
    const sec = value.sections.find((s) => s.id === sectionId)
    if (!sec) return
    const ordered = sortCategories(sec)
    const i = ordered.findIndex((c) => c.id === categoryId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ordered.length) return
    const swapped = [...ordered]
    ;[swapped[i], swapped[j]] = [swapped[j], swapped[i]]
    emit({
      ...value,
      sections: value.sections.map((s) =>
        s.id !== sectionId ? s : { ...s, categories: swapped.map((c, idx) => ({ ...c, sort_order: idx })) }
      ),
    })
  }

  const promoteCategoryToSection = (sectionId: string, categoryId: string) => {
    const sortedSecs = sortSections(value)
    const si = sortedSecs.findIndex((s) => s.id === sectionId)
    if (si < 0) return
    const sec = sortedSecs[si]
    const cats = sortCategories(sec)
    const cat = cats.find((c) => c.id === categoryId)
    if (!cat) return

    const remainingCategories = cats.filter((c) => c.id !== categoryId)
    const fixedRemaining: SopCategory[] =
      remainingCategories.length > 0
        ? remainingCategories.map((c, i) => ({ ...c, sort_order: i }))
        : [
            {
              id: newSopId(),
              title_ko: '',
              title_en: '',
              content_ko: '',
              content_en: '',
              sort_order: 0,
            },
          ]

    const newSection: SopSection = {
      id: newSopId(),
      title_ko: cat.title_ko,
      title_en: cat.title_en,
      sort_order: si + 1,
      categories: [
        {
          id: newSopId(),
          title_ko: '',
          title_en: '',
          content_ko: cat.content_ko,
          content_en: cat.content_en,
          sort_order: 0,
          checklist_items:
            cat.checklist_items && cat.checklist_items.length > 0 ? cat.checklist_items : undefined,
        },
      ],
    }

    const updatedOldSection: SopSection = { ...sec, categories: fixedRemaining }
    const reordered = [...sortedSecs.slice(0, si + 1), newSection, ...sortedSecs.slice(si + 1)]
    emit({
      ...value,
      sections: reordered.map((s, i) => ({ ...s, sort_order: i })),
    })
  }

  const demoteCategoryToChecklistLine = (sectionId: string, categoryId: string) => {
    const sec = value.sections.find((s) => s.id === sectionId)
    if (!sec) return
    const cats = sortCategories(sec)
    if (cats.length < 2) return
    const ci = cats.findIndex((c) => c.id === categoryId)
    if (ci < 0) return
    const demoted = cats[ci]
    const targetIdx = ci > 0 ? ci - 1 : 1
    const target = cats[targetIdx]
    if (!target) return

    const targetItems = [...(target.checklist_items || [])]
    const baseOrder = maxSiblingSort(targetItems, null) + 1
    const appended = categoryTitleAndChecklistAsRootLines(demoted, baseOrder)
    const newTarget: SopCategory = { ...target, checklist_items: [...targetItems, ...appended] }

    const nextCats = cats
      .filter((c) => c.id !== categoryId)
      .map((c) => (c.id === target.id ? newTarget : c))
      .map((c, i) => ({ ...c, sort_order: i }))

    emit({
      ...value,
      sections: value.sections.map((s) => (s.id !== sectionId ? s : { ...s, categories: nextCats })),
    })
  }

  const promoteChecklistItemToCategory = (sectionId: string, catId: string, itemId: string) => {
    const sec = value.sections.find((s) => s.id === sectionId)
    if (!sec) return
    const cats = sortCategories(sec)
    const cat = cats.find((c) => c.id === catId)
    if (!cat?.checklist_items?.length) return
    const self = cat.checklist_items.find((i) => i.id === itemId)
    if (!self) return
    const ci = cats.findIndex((c) => c.id === catId)

    const remainingInCat = checklistItemsWithoutSubtree(cat.checklist_items, itemId)
    const movedChecklist = promoteChecklistSubtreeToStandaloneRoots(cat.checklist_items, itemId)

    const newCat: SopCategory = {
      id: newSopId(),
      title_ko: self.title_ko,
      title_en: self.title_en,
      content_ko: '',
      content_en: '',
      sort_order: ci + 1,
      checklist_items: movedChecklist.length > 0 ? movedChecklist : undefined,
    }

    const updatedCurrentCat: SopCategory = {
      ...cat,
      checklist_items: remainingInCat.length > 0 ? remainingInCat : undefined,
    }
    const catsWithUpdated = cats.map((c) => (c.id === catId ? updatedCurrentCat : c))
    const mergedCats = [...catsWithUpdated.slice(0, ci + 1), newCat, ...catsWithUpdated.slice(ci + 1)]

    emit({
      ...value,
      sections: value.sections.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              categories: mergedCats.map((c, i) => ({ ...c, sort_order: i })),
            }
      ),
    })
  }

  const promoteChecklistItemToSection = (sectionId: string, catId: string, itemId: string) => {
    const sortedSecs = sortSections(value)
    const si = sortedSecs.findIndex((s) => s.id === sectionId)
    if (si < 0) return
    const sec = sortedSecs[si]
    const cats = sortCategories(sec)
    const cat = cats.find((c) => c.id === catId)
    if (!cat?.checklist_items?.length) return
    const self = cat.checklist_items.find((i) => i.id === itemId)
    if (!self) return

    const remainingInCat = checklistItemsWithoutSubtree(cat.checklist_items, itemId)
    const movedChecklist = promoteChecklistSubtreeToStandaloneRoots(cat.checklist_items, itemId)

    const innerCategory: SopCategory = {
      id: newSopId(),
      title_ko: '',
      title_en: '',
      content_ko: '',
      content_en: '',
      sort_order: 0,
      checklist_items: movedChecklist.length > 0 ? movedChecklist : undefined,
    }

    const newSection: SopSection = {
      id: newSopId(),
      title_ko: self.title_ko,
      title_en: self.title_en,
      sort_order: si + 1,
      categories: [innerCategory],
    }

    const updatedCats = cats.map((c) =>
      c.id === catId
        ? { ...c, checklist_items: remainingInCat.length > 0 ? remainingInCat : undefined }
        : c
    )
    const updatedOld: SopSection = { ...sec, categories: updatedCats }
    const reordered = [...sortedSecs.slice(0, si + 1), newSection, ...sortedSecs.slice(si + 1)]
    emit({
      ...value,
      sections: reordered.map((s, i) => ({ ...s, sort_order: i })),
    })
  }

  const sections = sortSections(value)

  const patchChecklistItems = (sectionId: string, categoryId: string, nextItems: SopChecklistItem[] | undefined) => {
    if (nextItems && nextItems.length > 0) {
      updateCategory(sectionId, categoryId, { checklist_items: nextItems })
      return
    }
    emit({
      ...value,
      sections: value.sections.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              categories: s.categories.map((c) => {
                if (c.id !== categoryId) return c
                const { checklist_items: _drop, ...rest } = c
                return rest
              }),
            }
      ),
    })
  }

  const startChecklistForCategory = (sectionId: string, catId: string) => {
    patchChecklistItems(sectionId, catId, [
      { id: newSopId(), title_ko: '', title_en: '', sort_order: 0, parent_id: null },
    ])
  }

  const addChecklistSibling = (sectionId: string, catId: string, parentId: string | null) => {
    const sec = value.sections.find((x) => x.id === sectionId)
    const cat = sec?.categories.find((x) => x.id === catId)
    if (!cat) return
    const items = [...(cat.checklist_items || [])]
    const n = maxSiblingSort(items, parentId) + 1
    items.push({ id: newSopId(), title_ko: '', title_en: '', sort_order: n, parent_id: parentId })
    patchChecklistItems(sectionId, catId, items)
  }

  const updateChecklistItem = (
    sectionId: string,
    catId: string,
    itemId: string,
    patch: Partial<SopChecklistItem>
  ) => {
    const sec = value.sections.find((x) => x.id === sectionId)
    const cat = sec?.categories.find((x) => x.id === catId)
    if (!cat?.checklist_items) return
    const items = cat.checklist_items.map((it) => (it.id === itemId ? { ...it, ...patch } : it))
    patchChecklistItems(sectionId, catId, items)
  }

  const removeChecklistItemRow = (sectionId: string, catId: string, itemId: string) => {
    const sec = value.sections.find((x) => x.id === sectionId)
    const cat = sec?.categories.find((x) => x.id === catId)
    if (!cat?.checklist_items) return
    const next = cascadeRemoveChecklistItems(cat.checklist_items, itemId)
    patchChecklistItems(sectionId, catId, next)
  }

  const moveChecklistItemRow = (sectionId: string, catId: string, itemId: string, dir: -1 | 1) => {
    const sec = value.sections.find((x) => x.id === sectionId)
    const cat = sec?.categories.find((x) => x.id === catId)
    if (!cat?.checklist_items?.length) return
    let items = [...cat.checklist_items]
    const self = items.find((i) => i.id === itemId)
    if (!self) return
    const siblings = items
      .filter((i) => (i.parent_id ?? null) === (self.parent_id ?? null))
      .sort((a, b) => a.sort_order - b.sort_order)
    const si = siblings.findIndex((i) => i.id === itemId)
    const j = si + dir
    if (j < 0 || j >= siblings.length) return
    const a = siblings[si]
    const b = siblings[j]
    items = items.map((it) => {
      if (it.id === a.id) return { ...it, sort_order: b.sort_order }
      if (it.id === b.id) return { ...it, sort_order: a.sort_order }
      return it
    })
    patchChecklistItems(sectionId, catId, items)
  }

  const indentChecklistItemRow = (sectionId: string, catId: string, itemId: string) => {
    const sec = value.sections.find((x) => x.id === sectionId)
    const cat = sec?.categories.find((x) => x.id === catId)
    if (!cat?.checklist_items?.length) return
    const ordered = orderedChecklistItems(cat.checklist_items)
    const idx = ordered.findIndex((i) => i.id === itemId)
    if (idx <= 0) return
    const prev = ordered[idx - 1]
    let items = [...cat.checklist_items]
    const nextOrder = maxSiblingSort(items, prev.id) + 1
    items = items.map((it) =>
      it.id === itemId ? { ...it, parent_id: prev.id, sort_order: nextOrder } : it
    )
    patchChecklistItems(sectionId, catId, items)
  }

  const importChecklistFromRichNotes = (sectionId: string, catId: string) => {
    const sec = value.sections.find((x) => x.id === sectionId)
    const cat = sec?.categories.find((x) => x.id === catId)
    if (!cat) return
    const raw = editLocale === 'ko' ? cat.content_ko : cat.content_en
    const lines = splitRichContentToChecklistLines(raw)
    if (lines.length === 0) return
    const items: SopChecklistItem[] = lines.map((title, idx) => ({
      id: newSopId(),
      title_ko: editLocale === 'ko' ? title : '',
      title_en: editLocale === 'en' ? title : '',
      sort_order: idx,
      parent_id: null,
    }))
    emit({
      ...value,
      sections: value.sections.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              categories: s.categories.map((c) =>
                c.id !== catId
                  ? c
                  : {
                      ...c,
                      checklist_items: items,
                      ...(editLocale === 'ko' ? { content_ko: '' } : { content_en: '' }),
                    }
              ),
            }
      ),
    })
  }

  const outdentChecklistItemRow = (sectionId: string, catId: string, itemId: string) => {
    const sec = value.sections.find((x) => x.id === sectionId)
    const cat = sec?.categories.find((x) => x.id === catId)
    if (!cat?.checklist_items?.length) return
    const self = cat.checklist_items.find((i) => i.id === itemId)
    if (!self?.parent_id) return
    const byId = new Map(cat.checklist_items.map((i) => [i.id, i]))
    const p = byId.get(self.parent_id)
    const newParent = p?.parent_id ?? null
    let items = [...cat.checklist_items]
    const nextOrder = maxSiblingSort(items, newParent) + 1
    items = items.map((it) =>
      it.id === itemId ? { ...it, parent_id: newParent, sort_order: nextOrder } : it
    )
    patchChecklistItems(sectionId, catId, items)
  }

  const replaceCategory = (sectionId: string, categoryId: string, nextCat: SopCategory) => {
    emit({
      ...value,
      sections: value.sections.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              categories: s.categories.map((c) =>
                c.id === categoryId
                  ? { ...nextCat, id: categoryId, sort_order: c.sort_order }
                  : c
              ),
            }
      ),
    })
  }

  const openCategoryModal = (sectionId: string, categoryId: string) => {
    const sec = value.sections.find((s) => s.id === sectionId)
    const cat = sec?.categories.find((c) => c.id === categoryId)
    if (!cat) return
    setCategoryDraft(JSON.parse(JSON.stringify(cat)) as SopCategory)
    setNodeModal({ type: 'category', sectionId, categoryId })
  }

  const closeCategoryModal = () => {
    setNodeModal(null)
    setCategoryDraft(null)
  }

  const saveCategoryModal = () => {
    if (nodeModal?.type !== 'category' || !categoryDraft) return
    const { sectionId, categoryId } = nodeModal
    const sec = value.sections.find((s) => s.id === sectionId)
    const prevCat = sec?.categories.find((c) => c.id === categoryId)
    if (!prevCat) {
      closeCategoryModal()
      return
    }
    replaceCategory(sectionId, categoryId, {
      ...categoryDraft,
      id: categoryId,
      sort_order: prevCat.sort_order,
    })
    closeCategoryModal()
  }

  const patchDraftChecklistItems = (nextItems: SopChecklistItem[] | undefined) => {
    setCategoryDraft((cat) => {
      if (!cat) return null
      if (nextItems && nextItems.length > 0) return { ...cat, checklist_items: nextItems }
      const { checklist_items: _drop, ...rest } = cat
      return { ...rest }
    })
  }

  const draftStartChecklist = () => {
    patchDraftChecklistItems([
      { id: newSopId(), title_ko: '', title_en: '', sort_order: 0, parent_id: null },
    ])
  }

  const draftAddChecklistSibling = (parentId: string | null) => {
    setCategoryDraft((cat) => {
      if (!cat) return null
      const items = [...(cat.checklist_items || [])]
      const n = maxSiblingSort(items, parentId) + 1
      items.push({ id: newSopId(), title_ko: '', title_en: '', sort_order: n, parent_id: parentId })
      return { ...cat, checklist_items: items }
    })
  }

  const draftUpdateChecklistItem = (itemId: string, patch: Partial<SopChecklistItem>) => {
    setCategoryDraft((cat) => {
      if (!cat?.checklist_items) return cat
      const items = cat.checklist_items.map((it) => (it.id === itemId ? { ...it, ...patch } : it))
      return { ...cat, checklist_items: items }
    })
  }

  const draftRemoveChecklistItemRow = (itemId: string) => {
    setCategoryDraft((cat) => {
      if (!cat?.checklist_items) return cat
      const next = cascadeRemoveChecklistItems(cat.checklist_items, itemId)
      if (next.length === 0) {
        const { checklist_items: _d, ...rest } = cat
        return { ...rest }
      }
      return { ...cat, checklist_items: next }
    })
  }

  const draftMoveChecklistItemRow = (itemId: string, dir: -1 | 1) => {
    setCategoryDraft((cat) => {
      if (!cat?.checklist_items?.length) return cat
      let items = [...cat.checklist_items]
      const self = items.find((i) => i.id === itemId)
      if (!self) return cat
      const siblings = items
        .filter((i) => (i.parent_id ?? null) === (self.parent_id ?? null))
        .sort((a, b) => a.sort_order - b.sort_order)
      const si = siblings.findIndex((i) => i.id === itemId)
      const j = si + dir
      if (si < 0 || j < 0 || j >= siblings.length) return cat
      const a = siblings[si]
      const b = siblings[j]
      items = items.map((it) => {
        if (it.id === a.id) return { ...it, sort_order: b.sort_order }
        if (it.id === b.id) return { ...it, sort_order: a.sort_order }
        return it
      })
      return { ...cat, checklist_items: items }
    })
  }

  const draftIndentChecklistItemRow = (itemId: string) => {
    setCategoryDraft((cat) => {
      if (!cat?.checklist_items?.length) return cat
      const ordered = orderedChecklistItems(cat.checklist_items)
      const idx = ordered.findIndex((i) => i.id === itemId)
      if (idx <= 0) return cat
      const prev = ordered[idx - 1]
      let items = [...cat.checklist_items]
      const nextOrder = maxSiblingSort(items, prev.id) + 1
      items = items.map((it) =>
        it.id === itemId ? { ...it, parent_id: prev.id, sort_order: nextOrder } : it
      )
      return { ...cat, checklist_items: items }
    })
  }

  const draftOutdentChecklistItemRow = (itemId: string) => {
    setCategoryDraft((cat) => {
      if (!cat?.checklist_items?.length) return cat
      const self = cat.checklist_items.find((i) => i.id === itemId)
      if (!self?.parent_id) return cat
      const byId = new Map(cat.checklist_items.map((i) => [i.id, i]))
      const p = byId.get(self.parent_id)
      const newParent = p?.parent_id ?? null
      let items = [...cat.checklist_items]
      const nextOrder = maxSiblingSort(items, newParent) + 1
      items = items.map((it) =>
        it.id === itemId ? { ...it, parent_id: newParent, sort_order: nextOrder } : it
      )
      return { ...cat, checklist_items: items }
    })
  }

  const draftImportChecklistFromRichNotes = () => {
    setCategoryDraft((cat) => {
      if (!cat) return null
      const raw = editLocale === 'ko' ? cat.content_ko : cat.content_en
      const lines = splitRichContentToChecklistLines(raw)
      if (lines.length === 0) return cat
      const items: SopChecklistItem[] = lines.map((title, idx) => ({
        id: newSopId(),
        title_ko: editLocale === 'ko' ? title : '',
        title_en: editLocale === 'en' ? title : '',
        sort_order: idx,
        parent_id: null,
      }))
      return {
        ...cat,
        checklist_items: items,
        ...(editLocale === 'ko' ? { content_ko: '' } : { content_en: '' }),
      }
    })
  }

  const sectionModalSection = nodeModal?.type === 'section' ? value.sections.find((s) => s.id === nodeModal.sectionId) : null
  const categoryModalSection =
    nodeModal?.type === 'category' ? value.sections.find((s) => s.id === nodeModal.sectionId) ?? null : null

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2">
        <span className="text-xs font-medium text-gray-600">
          {isEn ? 'Layout' : '편집 화면'}
        </span>
        <Button
          type="button"
          variant={editorLayout === 'tree' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditorLayout('tree')}
        >
          {isEn ? 'Outline (tree)' : '작업 트리'}
        </Button>
        <Button
          type="button"
          variant={editorLayout === 'classic' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditorLayout('classic')}
        >
          {isEn ? 'Full form' : '전체 펼침'}
        </Button>
      </div>

      {editorLayout === 'tree' ? (
        <div
          className={cn(
            'space-y-3 rounded-lg border border-slate-200 bg-slate-50/90 p-3 shadow-sm',
            disabled && 'pointer-events-none opacity-60'
          )}
        >
          <p className="text-sm text-gray-700">
            {isEn
              ? 'Expand a section: each category shows checklist lines here (same as full form). Pencil opens the modal for rich notes and bilingual edits.'
              : '섹션을 펼치면 카테고리별로 체크 줄을 여기서 바로 보고 고칠 수 있습니다(전체 펼침과 동일 데이터). 연필은 추가 설명·리치 편집용 모달입니다.'}
          </p>
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {sections.map((section, si) => {
              const expanded = expandedSectionIds.has(section.id)
              const secLabel = plainPreview(sopText(section.title_ko, section.title_en, editLocale))
              const cats = sortCategories(section)
              return (
                <div key={section.id} className="border-b border-slate-100 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-1 px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={disabled}
                      onClick={() => toggleSectionExpanded(section.id)}
                      aria-expanded={expanded}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-600" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                      )}
                    </Button>
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm"
                      disabled={disabled}
                      onClick={() => toggleSectionExpanded(section.id)}
                    >
                      <span className="font-semibold text-slate-600">
                        {isEn ? `Section ${si + 1}` : `섹션 ${si + 1}`}
                      </span>
                      <span className="text-slate-900"> · {secLabel}</span>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title={isEn ? 'Edit section title' : '섹션 제목 편집'}
                        disabled={disabled}
                        onClick={() => setNodeModal({ type: 'section', sectionId: section.id })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {onSaveSectionVersion ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs"
                          disabled={disabled || savingSectionId === section.id}
                          onClick={() => void onSaveSectionVersion(section)}
                        >
                          <Save className="h-3 w-3 shrink-0" aria-hidden />
                          {savingSectionId === section.id
                            ? isEn
                              ? '…'
                              : '…'
                            : isEn
                              ? 'Save'
                              : '저장'}
                        </Button>
                      ) : null}
                      {onFetchSectionVersionHistory ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs"
                          disabled={disabled || historyLoadingSectionId === section.id}
                          onClick={() => {
                            setNodeModal(null)
                            void openSectionHistory(section)
                          }}
                        >
                          <History className="h-3 w-3 shrink-0" aria-hidden />
                          {isEn ? 'Hist.' : '이력'}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title={isEn ? 'Move section up' : '섹션 위로'}
                        disabled={disabled || si === 0}
                        onClick={() => moveSection(section.id, -1)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title={isEn ? 'Move section down' : '섹션 아래로'}
                        disabled={disabled || si >= sections.length - 1}
                        onClick={() => moveSection(section.id, 1)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-red-700"
                        title={isEn ? 'Remove section' : '섹션 삭제'}
                        disabled={disabled || value.sections.length <= 1}
                        onClick={() => removeSection(section.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {expanded ? (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-2 py-2 pl-4 space-y-1">
                      {cats.map((cat, ci) => (
                        <div key={cat.id} className="rounded-md border border-slate-100 bg-white/90 px-1 py-1">
                          <div className="flex flex-wrap items-center gap-1 px-0.5 py-0.5 hover:bg-slate-50/80">
                            {cat.checklist_items?.length ? (
                              <ListChecks className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                            ) : (
                              <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                            )}
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                              {plainPreview(sopText(cat.title_ko, cat.title_en, editLocale))}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              title={isEn ? 'Edit category' : '카테고리 편집'}
                              disabled={disabled}
                              onClick={() => openCategoryModal(section.id, cat.id)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              title={isEn ? 'Add category below this row' : '이 행 아래에 카테고리 추가'}
                              disabled={disabled}
                              onClick={() => addCategoryAfterAndOpenModal(section.id, cat.id)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={disabled || ci === 0}
                              onClick={() => moveCategory(section.id, cat.id, -1)}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={disabled || ci >= cats.length - 1}
                              onClick={() => moveCategory(section.id, cat.id, 1)}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 px-1.5 text-[10px]"
                              title={isEn ? 'Promote this category to its own section' : '이 카테고리를 새 섹션으로 승격'}
                              disabled={disabled}
                              onClick={() => promoteCategoryToSection(section.id, cat.id)}
                            >
                              {isEn ? '→Sec' : '→섹션'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 px-1.5 text-[10px]"
                              title={
                                isEn
                                  ? 'Turn this category into checklist lines in the adjacent category'
                                  : '이 카테고리를 옆 카테고리의 체크 줄로 강등'
                              }
                              disabled={disabled || cats.length < 2}
                              onClick={() => demoteCategoryToChecklistLine(section.id, cat.id)}
                            >
                              {isEn ? '→Line' : '→줄'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600"
                              disabled={disabled || section.categories.length <= 1}
                              onClick={() => removeCategory(section.id, cat.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {cat.checklist_items?.length ? (
                            <div className="mt-1 space-y-0.5 border-t border-slate-100 pt-1 pl-1">
                              {orderedChecklistItems(cat.checklist_items).map((it) => {
                                const items = cat.checklist_items!
                                const byId = new Map(items.map((x) => [x.id, x]))
                                const depth = checklistItemDepth(it, byId)
                                const siblings = items
                                  .filter((x) => (x.parent_id ?? null) === (it.parent_id ?? null))
                                  .sort((a, b) => a.sort_order - b.sort_order)
                                const sidx = siblings.findIndex((x) => x.id === it.id)
                                const lineVal = editLocale === 'ko' ? it.title_ko : it.title_en
                                return (
                                  <div
                                    key={it.id}
                                    className="flex flex-wrap items-center gap-0.5 rounded border border-slate-100 bg-slate-50/80 px-1 py-0.5"
                                    style={{ marginLeft: depth * 10 }}
                                  >
                                    <ListChecks className="h-3 w-3 shrink-0 text-emerald-600 opacity-70" aria-hidden />
                                    <Input
                                      className="h-7 min-w-0 flex-1 border-slate-200 bg-white text-xs"
                                      value={lineVal}
                                      disabled={disabled}
                                      onChange={(e) =>
                                        updateChecklistItem(section.id, cat.id, it.id, {
                                          ...(editLocale === 'ko'
                                            ? { title_ko: e.target.value }
                                            : { title_en: e.target.value }),
                                        })
                                      }
                                      placeholder={isEn ? 'Checklist line' : '체크 한 줄'}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0"
                                      title={isEn ? 'Up' : '위로'}
                                      disabled={disabled || sidx <= 0}
                                      onClick={() => moveChecklistItemRow(section.id, cat.id, it.id, -1)}
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0"
                                      title={isEn ? 'Down' : '아래로'}
                                      disabled={disabled || sidx < 0 || sidx >= siblings.length - 1}
                                      onClick={() => moveChecklistItemRow(section.id, cat.id, it.id, 1)}
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 shrink-0 px-1 text-[10px]"
                                      title={isEn ? 'Sub-line under this' : '이 줄 아래 하위'}
                                      disabled={disabled}
                                      onClick={() => addChecklistSibling(section.id, cat.id, it.id)}
                                    >
                                      {isEn ? 'Sub' : '하위'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 shrink-0 px-1 text-[10px]"
                                      title={isEn ? 'Indent under previous line' : '위 줄 아래로 들여쓰기'}
                                      disabled={disabled}
                                      onClick={() => indentChecklistItemRow(section.id, cat.id, it.id)}
                                    >
                                      {isEn ? 'In' : '들여'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 shrink-0 px-1 text-[10px]"
                                      title={isEn ? 'Outdent' : '내어쓰기'}
                                      disabled={disabled || !it.parent_id}
                                      onClick={() => outdentChecklistItemRow(section.id, cat.id, it.id)}
                                    >
                                      {isEn ? 'Out' : '내어'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 shrink-0 px-1 text-[10px]"
                                      title={
                                        isEn
                                          ? 'Promote this line to a new category below (children follow)'
                                          : '이 줄을 아래 새 카테고리로 승격(하위는 함께 이동)'
                                      }
                                      disabled={disabled}
                                      onClick={() => promoteChecklistItemToCategory(section.id, cat.id, it.id)}
                                    >
                                      {isEn ? '→Cat' : '→카'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 shrink-0 px-1 text-[10px]"
                                      title={
                                        isEn
                                          ? 'Promote this line to a new section below (children follow)'
                                          : '이 줄을 아래 새 섹션으로 승격(하위는 함께 이동)'
                                      }
                                      disabled={disabled}
                                      onClick={() => promoteChecklistItemToSection(section.id, cat.id, it.id)}
                                    >
                                      {isEn ? '→Sec' : '→섹션'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0 text-red-600"
                                      title={isEn ? 'Remove line' : '줄 삭제'}
                                      disabled={disabled}
                                      onClick={() => removeChecklistItemRow(section.id, cat.id, it.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )
                              })}
                              <div className="flex flex-wrap gap-1 pt-0.5 pl-6">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={disabled}
                                  onClick={() => addChecklistSibling(section.id, cat.id, null)}
                                >
                                  {isEn ? '+ line' : '+ 줄'}
                                </Button>
                              </div>
                            </div>
                          ) : sopText(cat.content_ko, cat.content_en, editLocale).trim() ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-amber-100 bg-amber-50/40 px-2 py-1 text-xs text-amber-950">
                              <span className="min-w-0 flex-1 truncate">
                                {plainPreview(sopText(cat.content_ko, cat.content_en, editLocale), 120)}
                              </span>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 shrink-0 text-xs"
                                disabled={disabled}
                                onClick={() => importChecklistFromRichNotes(section.id, cat.id)}
                              >
                                {isEn ? '→ checklist' : '→ 체크 줄'}
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-1 flex flex-wrap gap-1 border-t border-slate-50 pt-1 pl-6">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={disabled}
                                onClick={() => startChecklistForCategory(section.id, cat.id)}
                              >
                                {isEn ? '+ checklist' : '+ 체크 줄'}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <Button type="button" variant="outline" className="gap-1" disabled={disabled} onClick={addSection}>
            <Plus className="h-4 w-4" />
            {isEn ? 'Add section' : '섹션 추가'}
          </Button>
        </div>
      ) : (
        <div className={cn('space-y-4', disabled && 'pointer-events-none opacity-60')}>
          <p className="text-sm text-gray-600">
            {isEn
              ? 'Korean and English are shown in two columns (sky = 한국어, violet = English). Checklist lines keep stable IDs. “Split notes into checklist” uses the preview language selected above.'
              : '한국어·English는 두 열로 동시에 보입니다(하늘색=한국어, 보라색=English). 체크 줄은 고정 id입니다. 「추가 설명 → 체크」는 위에서 고른 미리보기 언어 열을 사용합니다.'}
          </p>

          {sections.map((section, si) => (
        <div
          key={section.id}
          className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 sm:p-4 space-y-3 shadow-sm"
        >
          <div className="flex flex-wrap items-start gap-2 justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <label className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">
                  {isEn ? 'Section' : '섹션'} {si + 1}
                </label>
                {sectionVersionMeta[section.id] ? (
                  <span className="text-[11px] text-gray-600">
                    {isEn
                      ? `Saved v${sectionVersionMeta[section.id].revision} · ${new Date(sectionVersionMeta[section.id].savedAt).toLocaleString('en-US')}`
                      : `저장 제${sectionVersionMeta[section.id].revision}차 · ${new Date(sectionVersionMeta[section.id].savedAt).toLocaleString('ko-KR')}`}
                  </span>
                ) : null}
              </div>
              <DualRichPair pairLayout={pairLayout} uiLocaleEn={isEn}
                koValue={section.title_ko}
                enValue={section.title_en}
                onKoChange={(v) => updateSection(section.id, { title_ko: v ?? '' })}
                onEnChange={(v) => updateSection(section.id, { title_en: v ?? '' })}
                koPlaceholder={isEn ? '예: 섹션 1: 일반 정보' : '예: 섹션 1: 일반 정보'}
                enPlaceholder="e.g. Section 1: General information"
                editorProps={editorTitleProps}
              />
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <div className="flex flex-wrap gap-1 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title={isEn ? 'Move section up' : '섹션 위로'}
                  disabled={disabled || si === 0}
                  onClick={() => moveSection(section.id, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title={isEn ? 'Move section down' : '섹션 아래로'}
                  disabled={disabled || si >= sections.length - 1}
                  onClick={() => moveSection(section.id, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-red-700"
                  title={isEn ? 'Remove section' : '섹션 삭제'}
                  disabled={disabled || value.sections.length <= 1}
                  onClick={() => removeSection(section.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                {onSaveSectionVersion ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1 whitespace-nowrap"
                    disabled={disabled || savingSectionId === section.id}
                    onClick={() => void onSaveSectionVersion(section)}
                  >
                    <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {savingSectionId === section.id
                      ? isEn
                        ? 'Saving…'
                        : '저장 중…'
                      : isEn
                        ? 'Save section version'
                        : '이 섹션 버전 저장'}
                  </Button>
                ) : null}
                {onFetchSectionVersionHistory ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 whitespace-nowrap"
                    disabled={disabled || historyLoadingSectionId === section.id}
                    onClick={() => void openSectionHistory(section)}
                  >
                    <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {isEn ? 'Version history' : '이전 버전'}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="pl-0 sm:pl-2 space-y-3 border-t border-indigo-100 pt-3">
            <p className="text-xs font-medium text-gray-700">{isEn ? 'Categories' : '카테고리'}</p>
            {sortCategories(section).map((cat, ci) => (
              <div key={cat.id} className="rounded-md border border-white bg-white p-3 space-y-2 shadow-sm">
                <div className="flex flex-wrap gap-2 justify-between items-start">
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="text-xs font-medium text-gray-700">
                      {isEn ? 'Category title (KO | EN)' : '카테고리 제목 (한국어 | English)'}
                    </span>
                    <DualRichPair pairLayout={pairLayout} uiLocaleEn={isEn}
                      koValue={cat.title_ko}
                      enValue={cat.title_en}
                      onKoChange={(v) => updateCategory(section.id, cat.id, { title_ko: v ?? '' })}
                      onEnChange={(v) => updateCategory(section.id, cat.id, { title_en: v ?? '' })}
                      koPlaceholder={isEn ? '● 줄 (한국어)' : '● 줄 (한국어)'}
                      enPlaceholder="● line (English)"
                      editorProps={editorTitleProps}
                    />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={disabled || ci === 0}
                      onClick={() => moveCategory(section.id, cat.id, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={disabled || ci >= sortCategories(section).length - 1}
                      onClick={() => moveCategory(section.id, cat.id, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 px-2 text-xs"
                      title={isEn ? 'Promote this category to its own section' : '이 카테고리를 새 섹션으로 승격'}
                      disabled={disabled}
                      onClick={() => promoteCategoryToSection(section.id, cat.id)}
                    >
                      {isEn ? '→ section' : '→ 섹션'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 px-2 text-xs"
                      title={
                        isEn
                          ? 'Turn this category into checklist lines in the adjacent category'
                          : '이 카테고리를 옆 카테고리의 체크 줄로 강등'
                      }
                      disabled={disabled || sortCategories(section).length < 2}
                      onClick={() => demoteCategoryToChecklistLine(section.id, cat.id)}
                    >
                      {isEn ? '→ line' : '→ 줄'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600"
                      disabled={disabled || section.categories.length <= 1}
                      onClick={() => removeCategory(section.id, cat.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-dashed border-gray-200 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-700">
                      {isEn
                        ? 'Checklist lines (stable IDs, reusable for per-tour checks)'
                        : '체크 줄 (고정 id, 추후 투어별 체크·서명에 재사용)'}
                    </span>
                    {!cat.checklist_items?.length ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => startChecklistForCategory(section.id, cat.id)}
                      >
                        {isEn ? 'Add checklist' : '체크 리스트 추가'}
                      </Button>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={disabled}
                          onClick={() => addChecklistSibling(section.id, cat.id, null)}
                        >
                          {isEn ? '+ line' : '+ 줄'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-700"
                          disabled={disabled}
                          onClick={() => patchChecklistItems(section.id, cat.id, undefined)}
                        >
                          {isEn ? 'Remove all lines' : '체크 줄 전부 제거'}
                        </Button>
                      </div>
                    )}
                  </div>
                  {cat.checklist_items?.length ? (
                    <div className="space-y-1.5">
                      {orderedChecklistItems(cat.checklist_items).map((it) => {
                        const items = cat.checklist_items!
                        const byId = new Map(items.map((x) => [x.id, x]))
                        const depth = checklistItemDepth(it, byId)
                        const valKo = it.title_ko
                        const valEn = it.title_en
                        const siblings = items
                          .filter((x) => (x.parent_id ?? null) === (it.parent_id ?? null))
                          .sort((a, b) => a.sort_order - b.sort_order)
                        const sidx = siblings.findIndex((x) => x.id === it.id)
                        return (
                          <div
                            key={it.id}
                            className="flex flex-wrap items-center gap-1 rounded border border-gray-100 bg-gray-50/90 px-2 py-1"
                            style={{ marginLeft: depth * 14 }}
                          >
                            <span className="text-[10px] text-gray-400 font-mono shrink-0 max-w-[72px] truncate" title={it.id}>
                              {it.id.slice(0, 8)}…
                            </span>
                            <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 sm:grid-cols-2">
                              <div className="min-w-0">
                                <span className="mb-0.5 block text-[9px] font-bold text-sky-800">한국어</span>
                                <Input
                                  className="h-8 border-sky-200 bg-sky-50/80 text-sm"
                                  value={valKo}
                                  disabled={disabled}
                                  onChange={(e) => {
                                    updateChecklistItem(section.id, cat.id, it.id, { title_ko: e.target.value })
                                  }}
                                  placeholder={isEn ? 'Korean line' : '한국어 한 줄'}
                                />
                              </div>
                              <div className="min-w-0">
                                <span className="mb-0.5 block text-[9px] font-bold text-violet-800">English</span>
                                <Input
                                  className="h-8 border-violet-200 bg-violet-50/80 text-sm"
                                  value={valEn}
                                  disabled={disabled}
                                  onChange={(e) => {
                                    updateChecklistItem(section.id, cat.id, it.id, { title_en: e.target.value })
                                  }}
                                  placeholder="English line"
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              title={isEn ? 'Move up' : '위로'}
                              disabled={disabled || sidx <= 0}
                              onClick={() => moveChecklistItemRow(section.id, cat.id, it.id, -1)}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              title={isEn ? 'Move down' : '아래로'}
                              disabled={disabled || sidx < 0 || sidx >= siblings.length - 1}
                              onClick={() => moveChecklistItemRow(section.id, cat.id, it.id, 1)}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5 text-xs shrink-0"
                              title={isEn ? 'Sub-line under this' : '이 줄 아래 하위'}
                              disabled={disabled}
                              onClick={() => addChecklistSibling(section.id, cat.id, it.id)}
                            >
                              {isEn ? 'Sub' : '하위'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5 text-xs shrink-0"
                              title={isEn ? 'Indent under previous line' : '위 줄 아래로 들여쓰기'}
                              disabled={disabled}
                              onClick={() => indentChecklistItemRow(section.id, cat.id, it.id)}
                            >
                              {isEn ? 'In' : '들여'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5 text-xs shrink-0"
                              title={isEn ? 'Outdent' : '내어쓰기'}
                              disabled={disabled || !it.parent_id}
                              onClick={() => outdentChecklistItemRow(section.id, cat.id, it.id)}
                            >
                              {isEn ? 'Out' : '내어'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-1.5 text-[11px] shrink-0"
                              title={
                                isEn
                                  ? 'Promote this line to a new category below (children follow)'
                                  : '이 줄을 아래 새 카테고리로 승격(하위는 함께 이동)'
                              }
                              disabled={disabled}
                              onClick={() => promoteChecklistItemToCategory(section.id, cat.id, it.id)}
                            >
                              {isEn ? '→ cat' : '→ 카'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-1.5 text-[11px] shrink-0"
                              title={
                                isEn
                                  ? 'Promote this line to a new section below (children follow)'
                                  : '이 줄을 아래 새 섹션으로 승격(하위는 함께 이동)'
                              }
                              disabled={disabled}
                              onClick={() => promoteChecklistItemToSection(section.id, cat.id, it.id)}
                            >
                              {isEn ? '→ sec' : '→ 섹션'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600 shrink-0"
                              title={isEn ? 'Remove line' : '줄 삭제'}
                              disabled={disabled}
                              onClick={() => removeChecklistItemRow(section.id, cat.id, it.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-medium text-gray-700">
                    {isEn ? 'Extra notes (rich, KO | EN)' : '추가 설명(리치, 한국어 | English)'}
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      disabled ||
                      splitRichContentToChecklistLines(
                        editLocale === 'ko' ? cat.content_ko : cat.content_en
                      ).length === 0
                    }
                    onClick={() => importChecklistFromRichNotes(section.id, cat.id)}
                  >
                    {isEn
                      ? 'Split notes into checklist'
                      : '추가 설명 → 체크 항목'}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500 -mt-1 mb-1">
                  {isEn
                    ? 'Uses line breaks, full-width 。, or a period followed by a space to split sentences. Replaces current checklist lines for this category.'
                    : '줄바꿈, 전각 마침표(。), 또는 뒤에 공백이 오는 반각 마침표(.) 기준으로 문장을 나눕니다. 이 카테고리의 기존 체크 줄은 덮어씁니다.'}
                </p>
                <DualRichPair pairLayout={pairLayout} uiLocaleEn={isEn}
                  koValue={cat.content_ko}
                  enValue={cat.content_en}
                  onKoChange={(v) => updateCategory(section.id, cat.id, { content_ko: v ?? '' })}
                  onEnChange={(v) => updateCategory(section.id, cat.id, { content_en: v ?? '' })}
                  koPlaceholder={
                    isEn
                      ? 'Paste Korean sentences; split uses the preview language column above.'
                      : '한국어 문장을 붙여 넣을 수 있습니다. 위에서 고른 미리보기 언어 열로 나눕니다.'
                  }
                  enPlaceholder="Paste English sentences; split uses the preview language column above."
                  editorProps={editorBodyProps}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              disabled={disabled}
              onClick={() => addCategoryAndOpenModal(section.id)}
            >
              <Plus className="h-4 w-4" />
              {isEn ? 'Add category' : '카테고리 추가'}
            </Button>
          </div>
        </div>
      ))}

          <Button type="button" variant="outline" className="gap-1" disabled={disabled} onClick={addSection}>
            <Plus className="h-4 w-4" />
            {isEn ? 'Add section' : '섹션 추가'}
          </Button>
        </div>
      )}

    <Dialog
      open={nodeModal?.type === 'section'}
      onOpenChange={(open) => {
        if (!open) setNodeModal(null)
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEn ? 'Edit section title' : '섹션 제목 편집'}</DialogTitle>
          <DialogDescription>
            {isEn
              ? 'Korean (sky) and English (violet). Changes apply immediately to the document.'
              : '한국어(하늘색)·영문(보라색) 제목입니다. 저장 시 문서에 바로 반영됩니다.'}
          </DialogDescription>
        </DialogHeader>
        {sectionModalSection ? (
          <DualRichPair pairLayout={pairLayout} uiLocaleEn={isEn}
            koValue={sectionModalSection.title_ko}
            enValue={sectionModalSection.title_en}
            onKoChange={(v) => updateSection(sectionModalSection.id, { title_ko: v ?? '' })}
            onEnChange={(v) => updateSection(sectionModalSection.id, { title_en: v ?? '' })}
            koPlaceholder={isEn ? '예: 섹션 1: 일반 정보' : '예: 섹션 1: 일반 정보'}
            enPlaceholder="e.g. Section 1: General information"
            editorProps={editorTitleProps}
          />
        ) : null}
      </DialogContent>
    </Dialog>

    <Dialog
      open={nodeModal?.type === 'category' && !!categoryDraft}
      onOpenChange={(open) => {
        if (!open) closeCategoryModal()
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-4">
          <DialogTitle>{isEn ? 'Edit category' : '카테고리 편집'}</DialogTitle>
          <DialogDescription className="text-left">
            {isEn
              ? 'Pick a category row below to edit its title and body. Add rows with + in the tree; unsaved edits are lost if you switch category.'
              : '아래에서 편집할 카테고리 행을 고르면 제목·내용을 바꿀 수 있습니다. 트리의 +로 행을 추가한 뒤 여기서 선택·저장하세요. 다른 행으로 바꾸면 저장 전 수정은 버려집니다.'}
          </DialogDescription>
        </DialogHeader>
        {categoryModalSection && nodeModal?.type === 'category' ? (
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/90 px-4 py-3">
            <label htmlFor="sop-category-modal-picker" className="mb-1.5 block text-xs font-medium text-slate-800">
              {isEn ? 'Category row' : '카테고리 행'}
            </label>
            <select
              id="sop-category-modal-picker"
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm shadow-sm"
              value={nodeModal.categoryId}
              disabled={disabled}
              onChange={(e) => switchCategoryInModal(e.target.value)}
            >
              {sortCategories(categoryModalSection).map((c, idx) => {
                const label = plainPreview(sopText(c.title_ko, c.title_en, editLocale))
                return (
                  <option key={c.id} value={c.id}>
                    {isEn ? `Category ${idx + 1}` : `카테고리 ${idx + 1}`}: {label}
                  </option>
                )
              })}
            </select>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {categoryDraft ? (
            <>
              <div className="space-y-1">
                <span className="text-xs font-medium text-gray-700">
                  {isEn ? 'Category title (KO | EN)' : '카테고리 제목 (한국어 | English)'}
                </span>
                <DualRichPair pairLayout={pairLayout} uiLocaleEn={isEn}
                  koValue={categoryDraft.title_ko}
                  enValue={categoryDraft.title_en}
                  onKoChange={(v) => setCategoryDraft((c) => (c ? { ...c, title_ko: v ?? '' } : null))}
                  onEnChange={(v) => setCategoryDraft((c) => (c ? { ...c, title_en: v ?? '' } : null))}
                  koPlaceholder={isEn ? '● 줄 (한국어)' : '● 줄 (한국어)'}
                  enPlaceholder="● line (English)"
                  editorProps={editorTitleProps}
                />
              </div>

              <div className="space-y-2 border-t border-dashed border-gray-200 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-700">
                    {isEn
                      ? 'Checklist lines (stable IDs, reusable for per-tour checks)'
                      : '체크 줄 (고정 id, 추후 투어별 체크·서명에 재사용)'}
                  </span>
                  {!categoryDraft.checklist_items?.length ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => draftStartChecklist()}
                    >
                      {isEn ? 'Add checklist' : '체크 리스트 추가'}
                    </Button>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => draftAddChecklistSibling(null)}
                      >
                        {isEn ? '+ line' : '+ 줄'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-700"
                        disabled={disabled}
                        onClick={() => patchDraftChecklistItems(undefined)}
                      >
                        {isEn ? 'Remove all lines' : '체크 줄 전부 제거'}
                      </Button>
                    </div>
                  )}
                </div>
                {categoryDraft.checklist_items?.length ? (
                  <div className="space-y-1.5">
                    {orderedChecklistItems(categoryDraft.checklist_items).map((it) => {
                      const items = categoryDraft.checklist_items!
                      const byId = new Map(items.map((x) => [x.id, x]))
                      const depth = checklistItemDepth(it, byId)
                      const valKo = it.title_ko
                      const valEn = it.title_en
                      const siblings = items
                        .filter((x) => (x.parent_id ?? null) === (it.parent_id ?? null))
                        .sort((a, b) => a.sort_order - b.sort_order)
                      const sidx = siblings.findIndex((x) => x.id === it.id)
                      return (
                        <div
                          key={it.id}
                          className="flex flex-wrap items-center gap-1 rounded border border-gray-100 bg-gray-50/90 px-2 py-1"
                          style={{ marginLeft: depth * 14 }}
                        >
                          <span
                            className="text-[10px] text-gray-400 font-mono shrink-0 max-w-[72px] truncate"
                            title={it.id}
                          >
                            {it.id.slice(0, 8)}…
                          </span>
                          <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 sm:grid-cols-2">
                            <div className="min-w-0">
                              <span className="mb-0.5 block text-[9px] font-bold text-sky-800">한국어</span>
                              <Input
                                className="h-8 border-sky-200 bg-sky-50/80 text-sm"
                                value={valKo}
                                disabled={disabled}
                                onChange={(e) => {
                                  draftUpdateChecklistItem(it.id, { title_ko: e.target.value })
                                }}
                                placeholder={isEn ? 'Korean line' : '한국어 한 줄'}
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="mb-0.5 block text-[9px] font-bold text-violet-800">English</span>
                              <Input
                                className="h-8 border-violet-200 bg-violet-50/80 text-sm"
                                value={valEn}
                                disabled={disabled}
                                onChange={(e) => {
                                  draftUpdateChecklistItem(it.id, { title_en: e.target.value })
                                }}
                                placeholder="English line"
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title={isEn ? 'Move up' : '위로'}
                            disabled={disabled || sidx <= 0}
                            onClick={() => draftMoveChecklistItemRow(it.id, -1)}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title={isEn ? 'Move down' : '아래로'}
                            disabled={disabled || sidx < 0 || sidx >= siblings.length - 1}
                            onClick={() => draftMoveChecklistItemRow(it.id, 1)}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-1.5 text-xs shrink-0"
                            title={isEn ? 'Sub-line under this' : '이 줄 아래 하위'}
                            disabled={disabled}
                            onClick={() => draftAddChecklistSibling(it.id)}
                          >
                            {isEn ? 'Sub' : '하위'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-1.5 text-xs shrink-0"
                            title={isEn ? 'Indent under previous line' : '위 줄 아래로 들여쓰기'}
                            disabled={disabled}
                            onClick={() => draftIndentChecklistItemRow(it.id)}
                          >
                            {isEn ? 'In' : '들여'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-1.5 text-xs shrink-0"
                            title={isEn ? 'Outdent' : '내어쓰기'}
                            disabled={disabled || !it.parent_id}
                            onClick={() => draftOutdentChecklistItemRow(it.id)}
                          >
                            {isEn ? 'Out' : '내어'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 shrink-0"
                            title={isEn ? 'Remove line' : '줄 삭제'}
                            disabled={disabled}
                            onClick={() => draftRemoveChecklistItemRow(it.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2 border-t border-dashed border-gray-200 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-medium text-gray-700">
                    {isEn ? 'Extra notes (rich, KO | EN)' : '추가 설명(리치, 한국어 | English)'}
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      disabled ||
                      splitRichContentToChecklistLines(
                        editLocale === 'ko' ? categoryDraft.content_ko : categoryDraft.content_en
                      ).length === 0
                    }
                    onClick={() => draftImportChecklistFromRichNotes()}
                  >
                    {isEn ? 'Split notes into checklist' : '추가 설명 → 체크 항목'}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500 -mt-1 mb-1">
                  {isEn
                    ? 'Uses line breaks, full-width 。, or a period followed by a space to split sentences. Replaces current checklist lines for this category.'
                    : '줄바꿈, 전각 마침표(。), 또는 뒤에 공백이 오는 반각 마침표(.) 기준으로 문장을 나눕니다. 이 카테고리의 기존 체크 줄은 덮어씁니다.'}
                </p>
                <DualRichPair pairLayout={pairLayout} uiLocaleEn={isEn}
                  koValue={categoryDraft.content_ko}
                  enValue={categoryDraft.content_en}
                  onKoChange={(v) => setCategoryDraft((c) => (c ? { ...c, content_ko: v ?? '' } : null))}
                  onEnChange={(v) => setCategoryDraft((c) => (c ? { ...c, content_en: v ?? '' } : null))}
                  koPlaceholder={
                    isEn
                      ? 'Paste Korean sentences; split uses the preview language column above.'
                      : '한국어 문장을 붙여 넣을 수 있습니다. 위에서 고른 미리보기 언어 열로 나눕니다.'
                  }
                  enPlaceholder="Paste English sentences; split uses the preview language column above."
                  editorProps={editorBodyProps}
                />
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter className="shrink-0 border-t border-slate-200 px-4 py-3">
          <Button type="button" variant="outline" disabled={disabled} onClick={() => closeCategoryModal()}>
            {isEn ? 'Cancel' : '취소'}
          </Button>
          <Button type="button" variant="default" disabled={disabled || !categoryDraft} onClick={() => saveCategoryModal()}>
            {isEn ? 'Save' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={!!historyOpen}
      onOpenChange={(next) => {
        if (!next) closeSectionHistory()
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-4">
          <DialogTitle className="pr-8 text-left text-base">
            {isEn ? 'Section version history' : '섹션 버전 기록'}
            {historyOpen ? (
              <span className="mt-1 block truncate text-sm font-normal text-slate-600">
                {historyOpen.label}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-left">
            {isEn
              ? 'Open a snapshot to preview. Restore replaces this section in the editor (unsaved until you save draft or publish).'
              : '저장된 버전을 미리보기한 뒤, 복원하면 편집기의 이 섹션만 바뀝니다. 이후 「초안 저장」 또는 「게시」로 확정하세요.'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {historyLoadingSectionId && historyRows.length === 0 && !historyErr ? (
            <p className="text-sm text-slate-600">
              {isEn ? 'Loading…' : '불러오는 중…'}
            </p>
          ) : null}
          {historyErr ? (
            <p className="text-sm text-red-600">{historyErr}</p>
          ) : null}
          {!historyLoadingSectionId && !historyErr && historyRows.length === 0 && historyOpen ? (
            <p className="text-sm text-slate-600">
              {isEn ? 'No saved versions for this section yet.' : '이 섹션에 저장된 버전이 아직 없습니다.'}
            </p>
          ) : null}
          {historyRows.length > 0 ? (
            <ul className="space-y-3">
              {historyRows.map((row) => {
                const expanded = expandedHistoryRevision === row.revision
                const previewSec = expanded ? parseSopSectionJson(row.section_json) : null
                return (
                  <li
                    key={row.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900">
                          {isEn ? `Revision ${row.revision}` : `제${row.revision}차`}
                        </span>
                        <span className="ml-2 text-xs text-slate-600">
                          {new Date(row.created_at).toLocaleString(isEn ? 'en-US' : 'ko-KR')}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() =>
                            setExpandedHistoryRevision(expanded ? null : row.revision)
                          }
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          {expanded
                            ? isEn
                              ? 'Hide preview'
                              : '미리보기 닫기'
                            : isEn
                              ? 'Preview'
                              : '미리보기'}
                        </Button>
                        {onRestoreSectionFromHistory && historyOpen ? (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="gap-1"
                            onClick={() =>
                              void (async () => {
                                await onRestoreSectionFromHistory(
                                  historyOpen.sectionId,
                                  row.section_json
                                )
                                closeSectionHistory()
                              })()
                            }
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            {isEn ? 'Restore to editor' : '편집기로 복원'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {expanded && previewSec ? (
                      <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                        <SopDocumentReadonly
                          doc={prefillSortOrders({
                            title_ko: isEn ? '(Preview)' : '(미리보기)',
                            title_en: '(Preview)',
                            sections: [{ ...previewSec, id: previewSec.id }],
                          })}
                          viewLang={editLocale}
                          layout="flat"
                        />
                      </div>
                    ) : expanded ? (
                      <p className="mt-2 text-xs text-red-600">
                        {isEn ? 'Could not render this snapshot.' : '이 저장본을 표시할 수 없습니다.'}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
