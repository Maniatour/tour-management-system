'use client'

import { useCallback, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, History, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LightRichEditor from '@/components/LightRichEditor'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

function DualRichPair({
  koValue,
  enValue,
  onKoChange,
  onEnChange,
  koPlaceholder,
  enPlaceholder,
  editorProps,
}: {
  koValue: string
  enValue: string
  onKoChange: (v: string | undefined) => void
  onEnChange: (v: string | undefined) => void
  koPlaceholder: string
  enPlaceholder: string
  editorProps: typeof editorTitleProps | typeof editorBodyProps
}) {
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

type Props = {
  value: SopDocument
  onChange: (next: SopDocument) => void
  /** UI 라벨(버튼 등) 언어 — URL 로케일 */
  uiLocaleEn: boolean
  /** 체크 줄 가져오기·일부 동작에 쓰는 기준 언어 */
  editLocale: SopEditLocale
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
  disabled,
  sectionVersionMeta = {},
  savingSectionId = null,
  onSaveSectionVersion,
  onFetchSectionVersionHistory,
  onRestoreSectionFromHistory,
}: Props) {
  const isEn = uiLocaleEn
  const [historyOpen, setHistoryOpen] = useState<{
    sectionId: string
    label: string
  } | null>(null)
  const [historyRows, setHistoryRows] = useState<SectionVersionHistoryRow[]>([])
  const [historyLoadingSectionId, setHistoryLoadingSectionId] = useState<string | null>(null)
  const [historyErr, setHistoryErr] = useState<string | null>(null)
  const [expandedHistoryRevision, setExpandedHistoryRevision] = useState<number | null>(null)

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

  const addCategory = (sectionId: string) => {
    const s = value.sections.find((x) => x.id === sectionId)
    if (!s) return
    emit({
      ...value,
      sections: value.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : {
              ...sec,
              categories: [
                ...sec.categories,
                {
                  id: newSopId(),
                  title_ko: '',
                  title_en: '',
                  content_ko: '',
                  content_en: '',
                  sort_order: sec.categories.length,
                },
              ],
            }
      ),
    })
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

  return (
    <>
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
              <DualRichPair
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
                    <DualRichPair
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
                <DualRichPair
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
              onClick={() => addCategory(section.id)}
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
