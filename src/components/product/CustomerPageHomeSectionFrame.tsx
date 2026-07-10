'use client'

import { useCallback, useState, type ReactNode } from 'react'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  LayoutGrid,
  Loader2,
  Settings2,
} from 'lucide-react'
import {
  canHideHomeSection,
  moveHomeSection,
  setHomeSectionVisible,
  updateHomeSectionStructureVariant,
} from '@/lib/customerPageHomeLayout'
import { applyCustomerPageHomeLayoutUpdate } from '@/lib/customerPageHomeLayoutActions'
import { loadCustomerPageHomeLayout } from '@/lib/customerPageLayoutPersistence'
import {
  getCatalogItem,
  type HomePageSectionEntry,
} from '@/lib/customerPageHomeSectionCatalog'
import {
  postCustomerPageHomeLayoutEdit,
  postCustomerPageHomeSectionSettingsEdit,
} from '@/lib/customerPageEditMessaging'

type CustomerPageHomeSectionFrameProps = {
  section: HomePageSectionEntry
  sectionLabel: string
  orderIndex: number
  totalSections: number
  visible: boolean
  layoutEditMode: boolean
  children: ReactNode
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  isDragging?: boolean
}

export default function CustomerPageHomeSectionFrame({
  section,
  sectionLabel,
  orderIndex,
  totalSections,
  visible,
  layoutEditMode,
  children,
  dragHandleProps = null,
  isDragging = false,
}: CustomerPageHomeSectionFrameProps) {
  const [busy, setBusy] = useState(false)
  const catalog = getCatalogItem(section.kind)
  const structureVariant =
    section.config.structureVariant ?? catalog.defaultConfig.structureVariant ?? ''

  const runLayoutAction = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return
      setBusy(true)
      try {
        await action()
      } catch (err) {
        console.error('Home layout action failed:', err)
      } finally {
        setBusy(false)
      }
    },
    [busy]
  )

  const handleMove = useCallback(
    (direction: 'up' | 'down') => {
      void runLayoutAction(async () => {
        await applyCustomerPageHomeLayoutUpdate((layout) =>
          moveHomeSection(layout, section.instanceId, direction)
        )
      })
    },
    [runLayoutAction, section.instanceId]
  )

  const handleToggleVisible = useCallback(() => {
    const layout = loadCustomerPageHomeLayout()
    const nextVisible = !visible

    if (nextVisible === false && !canHideHomeSection(layout, section.instanceId)) {
      window.alert('최소 1개 섹션은 표시해야 합니다.')
      return
    }

    void runLayoutAction(async () => {
      await applyCustomerPageHomeLayoutUpdate((current) =>
        setHomeSectionVisible(current, section.instanceId, nextVisible)
      )
    })
  }, [runLayoutAction, section.instanceId, visible])

  const handleStructureChange = useCallback(
    (nextVariant: string) => {
      void runLayoutAction(async () => {
        await applyCustomerPageHomeLayoutUpdate((layout) =>
          updateHomeSectionStructureVariant(layout, section.instanceId, nextVariant)
        )
      })
    },
    [runLayoutAction, section.instanceId]
  )

  if (!layoutEditMode) {
    return <>{children}</>
  }

  const canMoveUp = orderIndex > 0
  const canMoveDown = orderIndex < totalSections - 1
  const canHide = canHideHomeSection(loadCustomerPageHomeLayout(), section.instanceId)

  return (
    <div
      className={`customer-page-home-section ${visible ? '' : 'customer-page-home-section--hidden'} ${
        isDragging ? 'customer-page-home-section--dragging' : ''
      }`}
      data-home-section={section.instanceId}
      data-home-section-visible={visible ? '1' : '0'}
    >
      <div className="customer-page-home-section-toolbar">
        <div className="customer-page-home-section-toolbar__main">
          <span className="customer-page-home-section-order" aria-hidden>
            {orderIndex + 1}
          </span>
          <button
            type="button"
            className="customer-page-home-section-grip"
            {...(dragHandleProps ?? {})}
            aria-label={`${sectionLabel} 드래그하여 순서 변경`}
          >
            <GripVertical className="h-4 w-4 text-violet-500 shrink-0" />
          </button>
          <div className="min-w-0">
            <p className="customer-page-home-section-label">{sectionLabel}</p>
            {!visible && (
              <p className="customer-page-home-section-sublabel">고객에게는 보이지 않음</p>
            )}
          </div>
        </div>

        <div className="customer-page-home-section-toolbar__meta">
          <label className="customer-page-home-section-layout-select">
            <span className="sr-only">레이아웃</span>
            <select
              value={structureVariant}
              disabled={busy}
              onChange={(e) => handleStructureChange(e.target.value)}
              className="text-[10px] font-medium rounded-lg border border-violet-200 bg-white px-2 py-1 text-violet-900 max-w-[8.5rem] truncate"
            >
              {catalog.structureVariants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="customer-page-home-section-toolbar__actions">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" aria-hidden />}
          <button
            type="button"
            onClick={() => handleMove('up')}
            disabled={!canMoveUp || busy}
            className="customer-page-home-section-btn"
            title="위로 이동"
            aria-label={`${sectionLabel} 위로 이동`}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleMove('down')}
            disabled={!canMoveDown || busy}
            className="customer-page-home-section-btn"
            title="아래로 이동"
            aria-label={`${sectionLabel} 아래로 이동`}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => postCustomerPageHomeSectionSettingsEdit(section.instanceId)}
            className="customer-page-home-section-btn"
            title="섹션 설정"
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">설정</span>
          </button>
          <button
            type="button"
            onClick={handleToggleVisible}
            disabled={(!visible && busy) || (!visible ? false : !canHide) || busy}
            className={`customer-page-home-section-btn ${
              visible ? '' : 'customer-page-home-section-btn--active'
            }`}
            title={visible ? '섹션 숨기기' : '섹션 표시하기'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">{visible ? '숨기기' : '표시'}</span>
          </button>
          <button
            type="button"
            onClick={() => postCustomerPageHomeLayoutEdit()}
            className="customer-page-home-section-btn customer-page-home-section-btn--outline hidden md:inline-flex"
            title="전체 섹션 목록에서 편집"
          >
            <LayoutGrid className="h-4 w-4" />
            목록
          </button>
        </div>
      </div>

      <div className="customer-page-home-section-body">
        {children}
        {!visible && (
          <div className="customer-page-home-section-hidden-overlay" aria-hidden>
            <EyeOff className="h-5 w-5" />
            <span>고객 페이지에서는 이 섹션이 숨겨집니다</span>
          </div>
        )}
      </div>
    </div>
  )
}
