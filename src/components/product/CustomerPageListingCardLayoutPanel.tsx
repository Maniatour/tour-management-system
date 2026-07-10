'use client'

import { useCallback, useMemo, useState } from 'react'
import { Eye, EyeOff, GripVertical, Loader2, Pencil, RotateCcw, Save, X } from 'lucide-react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { Checkbox } from '@/components/ui/checkbox'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'
import {
  buildDefaultListingCardLayout,
  canHideListingCardSlot,
  countVisibleListingCardSlots,
  listingCardLayoutsEqual,
  normalizeListingCardLayout,
  reorderListingCardSlotsAtIndex,
  setListingCardSlotVisible,
  type ListingCardLayout,
} from '@/lib/customerPageListingCardLayout'
import {
  getListingCardSlotDef,
  getListingCardSlotLabel,
  type ListingCardSlotId,
} from '@/lib/customerPageListingCardLayoutCatalog'
import {
  loadCustomerPageListingCardLayout,
  persistCustomerPageListingCardLayout,
} from '@/lib/customerPageLayoutPersistence'
import { postCustomerPageZoneEdit } from '@/lib/customerPageEditMessaging'

type CustomerPageListingCardLayoutPanelProps = {
  onClose: () => void
  onSaved: () => void
  variant?: 'sidebar' | 'modal'
  productId?: string | null
}

export default function CustomerPageListingCardLayoutPanel({
  onClose,
  onSaved,
  variant = 'modal',
  productId = null,
}: CustomerPageListingCardLayoutPanelProps) {
  const [draft, setDraft] = useState<ListingCardLayout>(() =>
    normalizeListingCardLayout(loadCustomerPageListingCardLayout())
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedLayout = normalizeListingCardLayout(loadCustomerPageListingCardLayout())
  const dirty = useMemo(() => !listingCardLayoutsEqual(draft, savedLayout), [draft, savedLayout])
  const visibleCount = useMemo(() => countVisibleListingCardSlots(draft), [draft])

  const handleToggleVisible = useCallback((slotId: ListingCardSlotId, visible: boolean) => {
    setDraft((prev) => {
      if (!visible && !canHideListingCardSlot(prev, slotId)) {
        window.alert('최소 1개 슬롯은 표시해야 합니다.')
        return prev
      }
      return setListingCardSlotVisible(prev, slotId, visible)
    })
  }, [])

  const handleReset = useCallback(() => {
    setDraft(buildDefaultListingCardLayout())
    setError(null)
  }, [])

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result
    if (!destination || source.index === destination.index) return
    setDraft((prev) => reorderListingCardSlotsAtIndex(prev, source.index, destination.index))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await persistCustomerPageListingCardLayout(draft)
      emitCustomerPageBindingsUpdate()
      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save listing card layout:', err)
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
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50 shrink-0">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">상품 카드 · 슬롯 목록</h3>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            모든 목록 카드에 공통 적용됩니다. 드래그로 순서 변경 ({visibleCount}/{draft.slots.length}개
            표시)
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
          <Droppable droppableId="listing-card-layout-panel">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {draft.slots.map((entry, index) => {
                  const slotDef = getListingCardSlotDef(entry.slotId)
                  const canHide = canHideListingCardSlot(draft, entry.slotId)

                  return (
                    <Draggable
                      key={entry.slotId}
                      draggableId={entry.slotId}
                      index={index}
                      isDragDisabled={Boolean(slotDef?.fixed)}
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
                          } ${snapshot.isDragging ? 'opacity-90 ring-2 ring-amber-300 shadow-lg' : ''}`}
                        >
                          <div
                            className={`flex items-center gap-2 shrink-0 text-slate-400 pt-0.5 ${
                              slotDef?.fixed
                                ? 'opacity-40 cursor-not-allowed'
                                : 'cursor-grab active:cursor-grabbing'
                            }`}
                            {...(slotDef?.fixed ? {} : dragProvided.dragHandleProps)}
                          >
                            <GripVertical className="h-5 w-5" aria-hidden />
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                              {index + 1}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm">{slotDef?.icon ?? '📦'}</span>
                              <span className="text-sm font-semibold text-gray-900">
                                {getListingCardSlotLabel(entry.slotId)}
                              </span>
                              {slotDef?.fixed && (
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
                            {slotDef?.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{slotDef.description}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => postCustomerPageZoneEdit(entry.slotId, productId)}
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
                                handleToggleVisible(entry.slotId, checked === true)
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
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
