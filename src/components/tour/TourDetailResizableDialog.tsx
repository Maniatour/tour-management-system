'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, GripVertical } from 'lucide-react'
import { useLocale } from 'next-intl'
import { ResizableModalFrame } from '@/components/ui/ResizableModalFrame'
import { TourDetailModalContent } from '@/components/tour/TourDetailModalContent'
import {
  TourDetailModalChromeContext,
  type TourDetailModalMeta,
} from '@/components/tour/TourDetailModalChromeContext'
import {
  TOUR_DETAIL_MODAL_DEFAULT_SIZE,
  TOUR_DETAIL_MODAL_RECT_KEY,
} from '@/lib/adminModalRectStorage'
import { DIALOG_Z_INDEX, type DialogStackLevel } from '@/lib/dialogZIndex'

function metaEquals(a: TourDetailModalMeta | null, b: TourDetailModalMeta | null) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.title === b.title &&
    a.date === b.date &&
    a.tourId === b.tourId &&
    a.statusLabel === b.statusLabel
  )
}

type TourDetailResizableDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tourId: string | null
  onNavigateToTour?: (tourId: string) => void
  refreshNonce?: number
  stackLevel?: DialogStackLevel
  accessibilityTitle?: string
  titleFallback?: string
  /** @deprecated titleFallback 사용 권장 */
  header?: ReactNode
  hideCloseButton?: boolean
  /** @deprecated Radix Dialog 호환용 — 현재 무시됨 */
  onOpenAutoFocus?: (event: Event) => void
  onPointerDownOutside?: (event: Event) => void
  onFocusOutside?: (event: Event) => void
  onInteractOutside?: (event: Event) => void
  overlayClassName?: string
  modal?: boolean
}

export function TourDetailResizableDialog({
  open,
  onOpenChange,
  tourId,
  onNavigateToTour,
  refreshNonce = 0,
  stackLevel = 'default',
  accessibilityTitle = 'Tour detail',
  titleFallback,
  header,
  overlayClassName,
  modal = true,
}: TourDetailResizableDialogProps) {
  const locale = useLocale()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange
  const [meta, setMetaState] = useState<TourDetailModalMeta | null>(null)
  const [toolbarContent, setToolbarContentState] = useState<ReactNode | null>(null)
  const zIndex = DIALOG_Z_INDEX[stackLevel]

  const handleClose = useCallback(() => {
    onOpenChangeRef.current(false)
  }, [])

  const setMeta = useCallback((next: TourDetailModalMeta | null) => {
    setMetaState((prev) => (metaEquals(prev, next) ? prev : next))
  }, [])

  const setToolbarContent = useCallback((next: ReactNode | null) => {
    setToolbarContentState((prev) => (prev === next || (prev == null && next == null) ? prev : next))
  }, [])

  const resetScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = 0
    el.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  const chromeContextValue = useMemo(
    () => ({
      scrollRef,
      setMeta,
      setToolbarContent,
      resetScroll,
      onClose: handleClose,
    }),
    [setMeta, setToolbarContent, resetScroll, handleClose]
  )

  useLayoutEffect(() => {
    if (!open) {
      setMetaState(null)
      setToolbarContentState(null)
      return
    }
    resetScroll()
    const raf = requestAnimationFrame(() => {
      resetScroll()
    })
    return () => cancelAnimationFrame(raf)
  }, [open, tourId, refreshNonce, resetScroll])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  if (!open || !tourId || typeof document === 'undefined') return null

  const displayTitle = meta?.title
    ? [meta.date, meta.title].filter(Boolean).join(' - ')
    : titleFallback || accessibilityTitle

  const resolvedOverlay =
    overlayClassName ?? (modal ? 'bg-black/50' : 'pointer-events-none bg-black/30')

  return createPortal(
    <ResizableModalFrame
      storageKey={TOUR_DETAIL_MODAL_RECT_KEY}
      defaultWidth={TOUR_DETAIL_MODAL_DEFAULT_SIZE.width}
      defaultHeight={TOUR_DETAIL_MODAL_DEFAULT_SIZE.height}
      zIndex={zIndex}
      overlayClassName={resolvedOverlay}
      className="tour-detail-modal-shell flex flex-col overflow-hidden bg-white"
    >
      <TourDetailModalChromeContext.Provider value={chromeContextValue}>
        <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
          <div
            className="shrink-0 border-b border-gray-200 bg-white"
            data-tour-detail-modal-header
          >
            <div
              data-dialog-drag-handle
              className="sm:cursor-grab sm:active:cursor-grabbing"
            >
              {header ? (
                <div className="px-3 py-2.5">{header}</div>
              ) : toolbarContent ? (
                toolbarContent
              ) : (
                <div className="flex min-h-11 items-center gap-2 px-3 py-2.5">
                  <GripVertical
                    className="hidden h-4 w-4 shrink-0 text-gray-400 sm:block"
                    aria-hidden
                  />
                  <p
                    className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 sm:text-base"
                    title={displayTitle}
                  >
                    {displayTitle}
                  </p>
                  {tourId ? (
                    <a
                      href={`/${locale}/admin/tours/${tourId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:text-primary/80 sm:text-sm"
                      data-no-drag
                    >
                      새 탭
                      <ExternalLink size={14} aria-hidden />
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div
            key={`${tourId}-${refreshNonce}`}
            ref={scrollRef}
            data-tour-detail-modal-scroll
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-gray-50/40 p-0 pr-3 [overflow-anchor:none]"
          >
            <TourDetailModalContent
              tourId={tourId}
              refreshNonce={refreshNonce}
              {...(onNavigateToTour ? { onNavigateToTour } : {})}
            />
          </div>

        </div>
      </TourDetailModalChromeContext.Provider>
    </ResizableModalFrame>,
    document.body
  )
}
