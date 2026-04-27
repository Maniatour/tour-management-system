'use client'

import { useCallback } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LightRichEditor from '@/components/LightRichEditor'
import { Input } from '@/components/ui/input'
import type { SopDocument, SopSection, SopCategory, SopChecklistItem, SopEditLocale } from '@/types/sopStructure'
import {
  newSopId,
  orderedChecklistItems,
  prefillSortOrders,
  checklistItemDepth,
  splitRichContentToChecklistLines,
} from '@/types/sopStructure'
import { cn } from '@/lib/utils'

type Props = {
  value: SopDocument
  onChange: (next: SopDocument) => void
  /** UI 라벨(버튼 등) 언어 — URL 로케일 */
  uiLocaleEn: boolean
  /** 편집 중인 입력 언어(한/영 필드 전환) */
  editLocale: SopEditLocale
  disabled?: boolean
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

export default function SopStructureEditor({
  value,
  onChange,
  uiLocaleEn,
  editLocale,
  disabled,
}: Props) {
  const isEn = uiLocaleEn
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
                  checklist_items: undefined,
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
                  checklist_items: undefined,
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

  const secTitleVal = (s: SopSection) => (editLocale === 'ko' ? s.title_ko : s.title_en)
  const secTitlePatch = (v: string | undefined): Partial<SopSection> =>
    editLocale === 'ko' ? { title_ko: v ?? '' } : { title_en: v ?? '' }

  const catTitleVal = (c: SopCategory) => (editLocale === 'ko' ? c.title_ko : c.title_en)
  const catTitlePatch = (v: string | undefined): Partial<SopCategory> =>
    editLocale === 'ko' ? { title_ko: v ?? '' } : { title_en: v ?? '' }

  const catContentVal = (c: SopCategory) => (editLocale === 'ko' ? c.content_ko : c.content_en)
  const catContentPatch = (v: string | undefined): Partial<SopCategory> =>
    editLocale === 'ko' ? { content_ko: v ?? '' } : { content_en: v ?? '' }

  const patchChecklistItems = (sectionId: string, categoryId: string, nextItems: SopChecklistItem[] | undefined) => {
    updateCategory(sectionId, categoryId, {
      checklist_items: nextItems && nextItems.length > 0 ? nextItems : undefined,
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
    <div className={cn('space-y-4', disabled && 'pointer-events-none opacity-60')}>
      <p className="text-sm text-gray-600">
        {isEn
          ? `Editing ${editLocale === 'ko' ? 'Korean' : 'English'} fields. Optional checklist lines keep stable IDs for future per-tour checks. Rich notes use markdown.`
          : `${editLocale === 'ko' ? '한국어' : 'English'} 필드를 편집 중입니다. 체크 줄은 고정 id로 두어 추후 투어별 체크에 쓸 수 있습니다. 추가 설명은 마크다운입니다.`}
      </p>

      {sections.map((section, si) => (
        <div
          key={section.id}
          className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 sm:p-4 space-y-3 shadow-sm"
        >
          <div className="flex flex-wrap items-start gap-2 justify-between">
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">
                {isEn ? 'Section' : '섹션'} {si + 1}
                {editLocale === 'ko' ? ' (KO)' : ' (EN)'}
              </label>
              <LightRichEditor
                key={`sec-title-${section.id}-${editLocale}`}
                {...editorTitleProps}
                value={secTitleVal(section)}
                onChange={(v) => updateSection(section.id, secTitlePatch(v))}
                placeholder={
                  isEn
                    ? editLocale === 'ko'
                      ? '예: 섹션 1: 일반 정보'
                      : 'e.g. Section 1: General information'
                    : editLocale === 'ko'
                      ? '예: 섹션 1: 일반 정보'
                      : 'e.g. Section 1: General information'
                }
                className="bg-white rounded-md border border-gray-200 overflow-hidden"
              />
            </div>
            <div className="flex flex-wrap gap-1 shrink-0">
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

          <div className="pl-0 sm:pl-2 space-y-3 border-t border-indigo-100 pt-3">
            <p className="text-xs font-medium text-gray-700">{isEn ? 'Categories' : '카테고리'}</p>
            {sortCategories(section).map((cat, ci) => (
              <div key={cat.id} className="rounded-md border border-white bg-white p-3 space-y-2 shadow-sm">
                <div className="flex flex-wrap gap-2 justify-between items-start">
                  <div className="flex-1 min-w-[160px] space-y-1">
                    <span className="text-xs text-gray-500">
                      {isEn ? 'Category title' : '카테고리 제목'} ({editLocale === 'ko' ? 'KO' : 'EN'})
                    </span>
                    <LightRichEditor
                      key={`cat-title-${cat.id}-${editLocale}`}
                      {...editorTitleProps}
                      value={catTitleVal(cat)}
                      onChange={(v) => updateCategory(section.id, cat.id, catTitlePatch(v))}
                      placeholder={isEn ? '● line' : '● 줄'}
                      className="bg-white rounded-md border border-gray-200 overflow-hidden"
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
                        const val = editLocale === 'ko' ? it.title_ko : it.title_en
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
                            <Input
                              className="h-8 text-sm flex-1 min-w-[140px]"
                              value={val}
                              disabled={disabled}
                              onChange={(e) => {
                                const v = e.target.value
                                updateChecklistItem(
                                  section.id,
                                  cat.id,
                                  it.id,
                                  editLocale === 'ko' ? { title_ko: v } : { title_en: v }
                                )
                              }}
                              placeholder={isEn ? 'One line (plain)' : '한 줄 (일반 텍스트)'}
                            />
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
                  <label className="text-xs text-gray-500">
                    {isEn ? 'Extra notes (rich)' : '추가 설명(리치)'} ({editLocale === 'ko' ? 'KO' : 'EN'})
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      disabled || splitRichContentToChecklistLines(catContentVal(cat)).length === 0
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
                <LightRichEditor
                  key={`cat-body-${cat.id}-${editLocale}`}
                  {...editorBodyProps}
                  value={catContentVal(cat)}
                  onChange={(v) => updateCategory(section.id, cat.id, catContentPatch(v))}
                  placeholder={
                    isEn
                      ? 'Optional: paste multiple sentences here, then use the button above to turn them into checklist lines.'
                      : '여러 문장을 붙여 넣은 뒤 위 버튼으로 체크 항목으로 나눌 수 있습니다.'
                  }
                  className="bg-white rounded-md border border-gray-200 overflow-hidden"
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
  )
}
