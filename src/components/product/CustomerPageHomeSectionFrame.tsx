'use client'

import { useCallback, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  LayoutGrid,
  Loader2,
} from 'lucide-react'
import {
  canHideHomeSection,
  moveHomeSection,
  setHomeSectionVisible,
} from '@/lib/customerPageHomeLayout'
import { applyCustomerPageHomeLayoutUpdate } from '@/lib/customerPageHomeLayoutActions'
import { loadCustomerPageHomeLayout } from '@/lib/customerPageLayoutPersistence'
import { postCustomerPageHomeLayoutEdit } from '@/lib/customerPageEditMessaging'

type CustomerPageHomeSectionFrameProps = {
  instanceId: string
  sectionLabel: string
  orderIndex: number
  totalSections: number
  visible: boolean
  layoutEditMode: boolean
  children: ReactNode
}

export default function CustomerPageHomeSectionFrame({
  instanceId,
  sectionLabel,
  orderIndex,
  totalSections,
  visible,
  layoutEditMode,
  children,
}: CustomerPageHomeSectionFrameProps) {
  const [busy, setBusy] = useState(false)

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
          moveHomeSection(layout, instanceId, direction)
        )
      })
    },
    [runLayoutAction, instanceId]
  )

  const handleToggleVisible = useCallback(() => {
    const layout = loadCustomerPageHomeLayout()
    const nextVisible = !visible

    if (nextVisible === false && !canHideHomeSection(layout, instanceId)) {
      window.alert('최소 1개 섹션은 표시해야 합니다.')
      return
    }

    void runLayoutAction(async () => {
      await applyCustomerPageHomeLayoutUpdate((current) =>
        setHomeSectionVisible(current, instanceId, nextVisible)
      )
    })
  }, [runLayoutAction, instanceId, visible])

  if (!layoutEditMode) {
    return <>{children}</>
  }

  const canMoveUp = orderIndex > 0
  const canMoveDown = orderIndex < totalSections - 1
  const canHide = canHideHomeSection(loadCustomerPageHomeLayout(), instanceId)

  return (
    <div
      className={`customer-page-home-section ${visible ? '' : 'customer-page-home-section--hidden'}`}
      data-home-section={instanceId}
      data-home-section-visible={visible ? '1' : '0'}
    >
      <div className="customer-page-home-section-toolbar">
        <div className="customer-page-home-section-toolbar__main">
          <span className="customer-page-home-section-order" aria-hidden>
            {orderIndex + 1}
          </span>
          <GripVertical className="h-4 w-4 text-violet-400 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="customer-page-home-section-label">{sectionLabel}</p>
            {!visible && (
              <p className="customer-page-home-section-sublabel">고객에게는 보이지 않음</p>
            )}
          </div>
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
