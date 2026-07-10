'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { Checkbox } from '@/components/ui/checkbox'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'
import {
  canHideHomeSection,
  canRemoveHomeSection,
  countVisibleHomeSections,
  DEFAULT_HOME_PAGE_LAYOUT,
  getHomeSectionDescription,
  getHomeSectionEntryLabel,
  layoutsEqual,
  normalizeHomePageLayout,
  removeHomeSection,
  reorderHomeSectionsAtIndex,
  setHomeSectionVisible,
  updateHomeSectionEntry,
  type HomePageLayout,
} from '@/lib/customerPageHomeLayout'
import {
  createHomeSectionEntry,
  getCatalogItem,
  type HomePageSectionEntry,
  type HomeSectionKind,
} from '@/lib/customerPageHomeSectionCatalog'
import {
  loadCustomerPageHomeLayout,
  persistCustomerPageHomeLayout,
} from '@/lib/customerPageLayoutPersistence'
import { clearCustomerPageTemplateTracking } from '@/lib/customerPageTemplatePersistence'
import CustomerPageHomeSectionEditDialog from '@/components/product/CustomerPageHomeSectionEditDialog'

type CustomerPageHomeLayoutPanelProps = {
  onClose: () => void
  onSaved: () => void
  variant?: 'sidebar' | 'modal'
  initialEditInstanceId?: string | null
}

export default function CustomerPageHomeLayoutPanel({
  onClose,
  onSaved,
  variant = 'modal',
  initialEditInstanceId = null,
}: CustomerPageHomeLayoutPanelProps) {
  const [draft, setDraft] = useState<HomePageLayout>(() =>
    normalizeHomePageLayout(loadCustomerPageHomeLayout())
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<'add' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<HomePageSectionEntry | null>(null)

  useEffect(() => {
    if (!initialEditInstanceId) return
    const target = normalizeHomePageLayout(loadCustomerPageHomeLayout()).sections.find(
      (s) => s.instanceId === initialEditInstanceId
    )
    if (target) {
      setEditTarget(target)
      setEditMode('edit')
    }
  }, [initialEditInstanceId])

  const savedLayout = normalizeHomePageLayout(loadCustomerPageHomeLayout())
  const dirty = useMemo(() => !layoutsEqual(draft, savedLayout), [draft, savedLayout])
  const visibleCount = useMemo(() => countVisibleHomeSections(draft), [draft])

  const handleToggleVisible = useCallback((instanceId: string, visible: boolean) => {
    setDraft((prev) => {
      if (!visible && !canHideHomeSection(prev, instanceId)) {
        window.alert('최소 1개 섹션은 표시해야 합니다.')
        return prev
      }
      return setHomeSectionVisible(prev, instanceId, visible)
    })
  }, [])

  const handleReset = useCallback(() => {
    setDraft({
      sections: DEFAULT_HOME_PAGE_LAYOUT.sections.map((section) => ({
        ...section,
        config: { ...section.config },
      })),
    })
    setError(null)
  }, [])

  const handleRemove = useCallback((instanceId: string) => {
    if (!canRemoveHomeSection(draft)) {
      window.alert('최소 1개 섹션은 유지해야 합니다.')
      return
    }
    if (!window.confirm('이 섹션을 목록에서 삭제할까요?')) return
    setDraft((prev) => removeHomeSection(prev, instanceId))
  }, [draft])

  const handleAddSave = useCallback(
    ({ kind, config }: { kind: HomeSectionKind; config: HomePageSectionEntry['config'] }) => {
      setDraft((prev) => {
        const entry = createHomeSectionEntry(kind, prev.sections)
        entry.config = config
        return { sections: [...prev.sections, entry] }
      })
      setEditMode(null)
    },
    []
  )

  const handleEditSave = useCallback(
    ({ config }: { kind: HomeSectionKind; config: HomePageSectionEntry['config'] }) => {
      if (!editTarget) return
      setDraft((prev) => updateHomeSectionEntry(prev, editTarget.instanceId, { config }))
      setEditMode(null)
      setEditTarget(null)
    },
    [editTarget]
  )

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result
    if (!destination || source.index === destination.index) return
    setDraft((prev) => reorderHomeSectionsAtIndex(prev, source.index, destination.index))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await persistCustomerPageHomeLayout(draft)
      await clearCustomerPageTemplateTracking()
      emitCustomerPageBindingsUpdate()
      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save home page layout:', err)
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }, [draft, onClose, onSaved])

  const shellClass =
    variant === 'modal'
      ? 'flex flex-col h-full min-h-0 bg-white'
      : 'flex flex-col h-full min-h-0 border-l border-gray-200 bg-white'

  return (
    <div className={shellClass}>
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-indigo-50 shrink-0">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">섹션 목록 편집</h3>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            섹션 추가·삭제·데이터 연결·테마 설정. 드래그로 순서 변경 ({visibleCount}/
            {draft.sections.length}개 표시)
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-gray-400 hover:bg-white/80 hover:text-gray-600 shrink-0"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 py-2 border-b border-slate-100 shrink-0">
        <button
          type="button"
          onClick={() => setEditMode('add')}
          className="inline-flex items-center gap-1.5 w-full justify-center px-3 py-2 text-xs font-semibold rounded-xl border-2 border-dashed border-violet-300 text-violet-700 hover:bg-violet-50"
        >
          <Plus className="h-4 w-4" />
          새 섹션 템플릿 추가
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="home-layout-panel-sections">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {draft.sections.map((section, index) => {
                  const canHide = canHideHomeSection(draft, section.instanceId)
                  const catalog = getCatalogItem(section.kind)

                  return (
                    <Draggable key={section.instanceId} draggableId={section.instanceId} index={index}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          style={dragProvided.draggableProps.style as React.CSSProperties | undefined}
                          className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                            section.visible
                              ? 'border-slate-200 bg-white shadow-sm'
                              : 'border-dashed border-slate-300 bg-slate-50/90'
                          } ${snapshot.isDragging ? 'opacity-90 ring-2 ring-violet-300 shadow-lg' : ''}`}
                        >
                          <div
                            className="flex items-center gap-2 shrink-0 text-slate-400 pt-0.5 cursor-grab active:cursor-grabbing"
                            {...dragProvided.dragHandleProps}
                          >
                            <GripVertical className="h-5 w-5" aria-hidden />
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                              {index + 1}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm">{catalog.icon}</span>
                              <span className="text-sm font-semibold text-gray-900">
                                {getHomeSectionEntryLabel(section)}
                              </span>
                              {!section.visible && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded-full">
                                  <EyeOff className="h-3 w-3" />
                                  숨김
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {getHomeSectionDescription(section)}
                            </p>
                            {section.kind === 'card-list' && (
                              <p className="text-[10px] text-violet-600 mt-1">
                                카드 {section.config.cardCount ?? 3}개 ·{' '}
                                {section.config.productQuery ?? 'favorites'}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditTarget(section)
                                  setEditMode('edit')
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                              >
                                <Pencil className="h-3 w-3" />
                                설정
                              </button>
                              {canRemoveHomeSection(draft) && (
                                <button
                                  type="button"
                                  onClick={() => handleRemove(section.instanceId)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-red-50 hover:bg-red-100 text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>

                          <label
                            className={`flex items-center gap-2 shrink-0 cursor-pointer select-none rounded-lg px-2 py-1.5 ${
                              !canHide && section.visible ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
                            }`}
                          >
                            <Checkbox
                              checked={section.visible}
                              disabled={!canHide && section.visible}
                              onCheckedChange={(checked) =>
                                handleToggleVisible(section.instanceId, checked === true)
                              }
                            />
                            <span className="text-xs text-gray-600 inline-flex items-center gap-1">
                              {section.visible ? (
                                <Eye className="h-3.5 w-3.5" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5" />
                              )}
                              표시
                            </span>
                          </label>
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {error && <div className="px-4 pb-2 text-xs text-red-600 shrink-0">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          처음 순서로
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="px-3 py-2 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-100">
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            저장
          </button>
        </div>
      </div>

      {editMode === 'add' && (
        <CustomerPageHomeSectionEditDialog
          mode="add"
          onClose={() => setEditMode(null)}
          onSave={handleAddSave}
        />
      )}
      {editMode === 'edit' && editTarget && (
        <CustomerPageHomeSectionEditDialog
          mode="edit"
          initialSection={editTarget}
          onClose={() => {
            setEditMode(null)
            setEditTarget(null)
          }}
          onSave={handleEditSave}
        />
      )}
    </div>
  )
}
