'use client'

import { useCallback, useState, type ReactNode } from 'react'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Pencil,
} from 'lucide-react'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import {
  canHidePageZone,
  movePageZone,
  setPageZoneVisible,
} from '@/lib/customerPageZoneLayout'
import { applyCustomerPageZoneLayoutUpdate } from '@/lib/customerPageZoneLayoutActions'
import { loadCustomerPageZoneLayout } from '@/lib/customerPageLayoutPersistence'
import {
  getPageZoneBlockDef,
  getPageZoneBlockLabel,
  type ZoneLayoutPageId,
} from '@/lib/customerPageZoneLayoutCatalog'
import {
  postCustomerPageZoneEdit,
  postCustomerPageZoneLayoutEdit,
} from '@/lib/customerPageEditMessaging'

type CustomerPageZoneLayoutFrameProps = {
  pageId: ZoneLayoutPageId
  zoneId: CustomerPageZone
  orderIndex: number
  totalBlocks: number
  visible: boolean
  layoutEditMode: boolean
  productId?: string | null
  children: ReactNode
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  isDragging?: boolean
}

export default function CustomerPageZoneLayoutFrame({
  pageId,
  zoneId,
  orderIndex,
  totalBlocks,
  visible,
  layoutEditMode,
  productId = null,
  children,
  dragHandleProps = null,
  isDragging = false,
}: CustomerPageZoneLayoutFrameProps) {
  const [busy, setBusy] = useState(false)
  const blockDef = getPageZoneBlockDef(pageId, zoneId)
  const label = getPageZoneBlockLabel(pageId, zoneId)
  const isFixed = Boolean(blockDef?.fixed)

  const runLayoutAction = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return
      setBusy(true)
      try {
        await action()
      } catch (err) {
        console.error('Zone layout action failed:', err)
      } finally {
        setBusy(false)
      }
    },
    [busy]
  )

  const handleMove = useCallback(
    (direction: 'up' | 'down') => {
      if (isFixed) return
      void runLayoutAction(async () => {
        await applyCustomerPageZoneLayoutUpdate(pageId, (layout) =>
          movePageZone(layout, zoneId, direction)
        )
      })
    },
    [isFixed, pageId, runLayoutAction, zoneId]
  )

  const handleToggleVisible = useCallback(() => {
    const layout = loadCustomerPageZoneLayout(pageId)
    const nextVisible = !visible

    if (nextVisible === false && !canHidePageZone(layout, zoneId)) {
      window.alert('최소 1개 블록은 표시해야 합니다.')
      return
    }

    void runLayoutAction(async () => {
      await applyCustomerPageZoneLayoutUpdate(pageId, (current) =>
        setPageZoneVisible(current, zoneId, nextVisible)
      )
    })
  }, [pageId, runLayoutAction, visible, zoneId])

  if (!layoutEditMode) {
    if (!visible) return null
    return <>{children}</>
  }

  return (
    <div
      className={`customer-page-zone-block ${!visible ? 'customer-page-zone-block--hidden' : ''} ${
        isDragging ? 'customer-page-zone-block--dragging' : ''
      }`}
    >
      <div className="customer-page-zone-block-toolbar">
        <div className="customer-page-zone-block-toolbar__main">
          {!isFixed && dragHandleProps ? (
            <button
              type="button"
              className="customer-page-zone-block-grip"
              aria-label="드래그하여 순서 변경"
              {...dragHandleProps}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : (
            <span className="customer-page-zone-block-grip customer-page-zone-block-grip--fixed">
              <GripVertical className="h-4 w-4 opacity-30" />
            </span>
          )}
          <span className="customer-page-zone-block-order">{orderIndex + 1}</span>
          <span className="text-sm">{blockDef?.icon ?? '📦'}</span>
          <div className="min-w-0">
            <p className="customer-page-zone-block-label">{label}</p>
            {blockDef?.description && (
              <p className="customer-page-zone-block-sublabel">{blockDef.description}</p>
            )}
            {isFixed && (
              <p className="customer-page-zone-block-sublabel text-amber-700">고정 위치</p>
            )}
          </div>
        </div>
        <div className="customer-page-zone-block-toolbar__actions">
          {!isFixed && (
            <>
              <button
                type="button"
                disabled={busy || orderIndex <= 0}
                onClick={() => handleMove('up')}
                className="customer-page-zone-block-btn"
                title="위로"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={busy || orderIndex >= totalBlocks - 1}
                onClick={() => handleMove('down')}
                className="customer-page-zone-block-btn"
                title="아래로"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleToggleVisible}
            className={`customer-page-zone-block-btn ${visible ? 'customer-page-zone-block-btn--active' : ''}`}
            title={visible ? '숨기기' : '표시'}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : visible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => postCustomerPageZoneEdit(zoneId, productId)}
            className="customer-page-zone-block-btn customer-page-zone-block-btn--outline"
            title="콘텐츠 수정"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => postCustomerPageZoneLayoutEdit(pageId, zoneId)}
            className="customer-page-zone-block-btn customer-page-zone-block-btn--outline"
            title="블록 목록"
          >
            목록
          </button>
        </div>
      </div>
      <div className="customer-page-zone-block-body">
        {children}
        {!visible && (
          <div className="customer-page-zone-block-hidden-overlay" aria-hidden>
            숨김
          </div>
        )}
      </div>
    </div>
  )
}
