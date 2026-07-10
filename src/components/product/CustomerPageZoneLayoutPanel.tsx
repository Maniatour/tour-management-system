'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, GripVertical, Loader2, Pencil, RotateCcw, Save, X } from 'lucide-react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { Checkbox } from '@/components/ui/checkbox'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'
import {
  buildDefaultPageZoneLayout,
  canHidePageZone,
  countVisiblePageZones,
  pageZoneLayoutsEqual,
  normalizePageZoneLayout,
  reorderPageZonesAtIndex,
  setPageZoneVisible,
  type PageZoneLayout,
} from '@/lib/customerPageZoneLayout'
import {
  getPageZoneBlockDef,
  getPageZoneBlockLabel,
  type ZoneLayoutPageId,
} from '@/lib/customerPageZoneLayoutCatalog'
import {
  loadCustomerPageZoneLayout,
  persistCustomerPageZoneLayout,
} from '@/lib/customerPageLayoutPersistence'
import { CUSTOMER_PAGE_REGISTRY } from '@/lib/customer-page-registry'
import { postCustomerPageZoneEdit } from '@/lib/customerPageEditMessaging'
import type { CustomerPageZone } from '@/lib/customerPageZones'

type CustomerPageZoneLayoutPanelProps = {
  pageId: ZoneLayoutPageId
  onClose: () => void
  onSaved: () => void
  variant?: 'sidebar' | 'modal'
  initialFocusZoneId?: CustomerPageZone | null
  productId?: string | null
}

export default function CustomerPageZoneLayoutPanel({
  pageId,
  onClose,
  onSaved,
  variant = 'modal',
  initialFocusZoneId = null,
  productId = null,
}: CustomerPageZoneLayoutPanelProps) {
  const [draft, setDraft] = useState<PageZoneLayout>(() =>
    normalizePageZoneLayout(loadCustomerPageZoneLayout(pageId), pageId)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightZoneId, setHighlightZoneId] = useState<CustomerPageZone | null>(
    initialFocusZoneId
  )

  useEffect(() => {
    setHighlightZoneId(initialFocusZoneId)
  }, [initialFocusZoneId])

  const savedLayout = normalizePageZoneLayout(loadCustomerPageZoneLayout(pageId), pageId)
  const dirty = useMemo(() => !pageZoneLayoutsEqual(draft, savedLayout), [draft, savedLayout])
  const visibleCount = useMemo(() => countVisiblePageZones(draft), [draft])
  const pageLabel =
    CUSTOMER_PAGE_REGISTRY.find((page) => page.id === pageId)?.label ?? pageId

  const handleToggleVisible = useCallback(
    (zoneId: CustomerPageZone, visible: boolean) => {
      setDraft((prev) => {
        if (!visible && !canHidePageZone(prev, zoneId)) {
          window.alert('최소 1개 블록은 표시해야 합니다.')
          return prev
        }
        return setPageZoneVisible(prev, zoneId, visible)
      })
    },
    []
  )

  const handleReset = useCallback(() => {
    setDraft(buildDefaultPageZoneLayout(pageId))
    setError(null)
  }, [pageId])

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result
    if (!destination || source.index === destination.index) return
    setDraft((prev) => reorderPageZonesAtIndex(prev, source.index, destination.index))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await persistCustomerPageZoneLayout(pageId, draft)
      emitCustomerPageBindingsUpdate()
      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save page zone layout:', err)
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }, [draft, onClose, onSaved, pageId])

  const shellClass =
    variant === 'modal'
      ? 'flex flex-col h-full min-h-0 bg-white'
      : 'flex flex-col h-full min-h-0 border-l border-gray-200 bg-white'

  return (
    <div className={shellClass}>
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50 shrink-0">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">{pageLabel} · 블록 목록</h3>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            블록 순서·표시 여부를 변경합니다. 드래그로 순서 변경 ({visibleCount}/
            {draft.zones.length}개 표시)
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

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`zone-layout-panel-${pageId}`}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {draft.zones.map((entry, index) => {
                  const blockDef = getPageZoneBlockDef(pageId, entry.zoneId)
                  const canHide = canHidePageZone(draft, entry.zoneId)
                  const isHighlighted = highlightZoneId === entry.zoneId

                  return (
                    <Draggable
                      key={entry.zoneId}
                      draggableId={entry.zoneId}
                      index={index}
                      isDragDisabled={Boolean(blockDef?.fixed)}
                    >
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          style={dragProvided.draggableProps.style as React.CSSProperties | undefined}
                          className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                            entry.visible
                              ? 'border-slate-200 bg-white shadow-sm'
                              : 'border-dashed border-slate-300 bg-slate-50/90'
                          } ${snapshot.isDragging ? 'opacity-90 ring-2 ring-teal-300 shadow-lg' : ''} ${
                            isHighlighted ? 'ring-2 ring-teal-400' : ''
                          }`}
                        >
                          <div
                            className={`flex items-center gap-2 shrink-0 text-slate-400 pt-0.5 ${
                              blockDef?.fixed
                                ? 'opacity-40 cursor-not-allowed'
                                : 'cursor-grab active:cursor-grabbing'
                            }`}
                            {...(blockDef?.fixed ? {} : dragProvided.dragHandleProps)}
                          >
                            <GripVertical className="h-5 w-5" aria-hidden />
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                              {index + 1}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm">{blockDef?.icon ?? '📦'}</span>
                              <span className="text-sm font-semibold text-gray-900">
                                {getPageZoneBlockLabel(pageId, entry.zoneId)}
                              </span>
                              {blockDef?.fixed && (
                                <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                  고정
                                </span>
                              )}
                              {!entry.visible && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded-full">
                                  <EyeOff className="h-3 w-3" />
                                  숨김
                                </span>
                              )}
                            </div>
                            {blockDef?.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{blockDef.description}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => postCustomerPageZoneEdit(entry.zoneId, productId)}
                              className="inline-flex items-center gap-1 mt-2 px-2 py-1 text-[10px] font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                            >
                              <Pencil className="h-3 w-3" />
                              콘텐츠 수정
                            </button>
                          </div>

                          <label
                            className={`flex items-center gap-2 shrink-0 cursor-pointer select-none rounded-lg px-2 py-1.5 ${
                              !canHide && entry.visible ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
                            }`}
                          >
                            <Checkbox
                              checked={entry.visible}
                              disabled={!canHide && entry.visible}
                              onCheckedChange={(checked) =>
                                handleToggleVisible(entry.zoneId, checked === true)
                              }
                            />
                            <span className="text-xs text-gray-600 inline-flex items-center gap-1">
                              {entry.visible ? (
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
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-100"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
