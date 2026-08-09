'use client'

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export const SCHEDULE_TOOLTIP_PANEL_CLASS =
  'pointer-events-none px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg text-left leading-snug'

const TOOLTIP_Z_INDEX = 1100
const TOOLTIP_GAP = 6
const VIEWPORT_PADDING = 8

type ScheduleHoverTooltipProps = {
  content: ReactNode
  children: ReactElement
  disabled?: boolean
  placement?: 'auto' | 'above' | 'below'
  align?: 'center' | 'start' | 'end'
  maxWidth?: number
  className?: string
  contentClassName?: string
}

function isEmptyTooltipContent(content: ReactNode): boolean {
  if (content == null || content === false) return true
  if (typeof content === 'string') return content.trim().length === 0
  return false
}

/** Keep measure styles on before first paint so width isn't treated as full-bleed (left clamp flash). */
function getHiddenMeasureStyle(maxWidth: number, vw?: number): CSSProperties {
  const viewportWidth = vw ?? (typeof window !== 'undefined' ? window.innerWidth : maxWidth + VIEWPORT_PADDING * 2)
  return {
    position: 'fixed',
    top: 0,
    left: 0,
    width: 'max-content',
    maxWidth: Math.min(maxWidth, Math.max(0, viewportWidth - VIEWPORT_PADDING * 2)),
    zIndex: TOOLTIP_Z_INDEX,
    visibility: 'hidden',
    pointerEvents: 'none',
  }
}

export default function ScheduleHoverTooltip({
  content,
  children,
  disabled = false,
  placement = 'auto',
  align = 'center',
  maxWidth = 420,
  className,
  contentClassName,
}: ScheduleHoverTooltipProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const anchorRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [style, setStyle] = useState<CSSProperties>(() => getHiddenMeasureStyle(maxWidth))

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    const tooltip = tooltipRef.current
    if (!anchor || !tooltip) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    const cappedMaxWidth = Math.min(maxWidth, vw - VIEWPORT_PADDING * 2)

    // Ensure intrinsic width is used for measurement (block + no max-content ≈ full viewport).
    tooltip.style.position = 'fixed'
    tooltip.style.width = 'max-content'
    tooltip.style.maxWidth = `${cappedMaxWidth}px`
    tooltip.style.visibility = 'hidden'
    tooltip.style.left = '0px'
    tooltip.style.top = '0px'

    const rect = anchor.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()

    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    const showAbove =
      placement === 'above'
        ? true
        : placement === 'below'
          ? false
          : spaceBelow < tooltipRect.height + TOOLTIP_GAP && spaceAbove > spaceBelow

    let top = showAbove
      ? rect.top - tooltipRect.height - TOOLTIP_GAP
      : rect.bottom + TOOLTIP_GAP

    let left: number
    if (align === 'start') {
      left = rect.left
    } else if (align === 'end') {
      left = rect.right - tooltipRect.width
    } else {
      left = rect.left + rect.width / 2 - tooltipRect.width / 2
    }

    left = Math.max(VIEWPORT_PADDING, Math.min(left, vw - tooltipRect.width - VIEWPORT_PADDING))
    top = Math.max(VIEWPORT_PADDING, Math.min(top, vh - tooltipRect.height - VIEWPORT_PADDING))

    setStyle({
      position: 'fixed',
      top,
      left,
      width: 'max-content',
      maxWidth: cappedMaxWidth,
      zIndex: TOOLTIP_Z_INDEX,
      visibility: 'visible',
      pointerEvents: 'none',
    })
  }, [align, maxWidth, placement])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const onUpdate = () => updatePosition()
    window.addEventListener('scroll', onUpdate, true)
    window.addEventListener('resize', onUpdate)
    return () => {
      window.removeEventListener('scroll', onUpdate, true)
      window.removeEventListener('resize', onUpdate)
    }
  }, [open, content, updatePosition])

  const show = useCallback(
    (el: HTMLElement) => {
      if (disabled || isEmptyTooltipContent(content)) return
      anchorRef.current = el
      setStyle(getHiddenMeasureStyle(maxWidth))
      setOpen(true)
    },
    [content, disabled, maxWidth],
  )

  const hide = useCallback(() => {
    setOpen(false)
    setStyle(getHiddenMeasureStyle(maxWidth))
  }, [maxWidth])

  if (!isValidElement(children)) return children

  const childProps = children.props as Record<string, unknown>
  const mergedProps = {
    ...childProps,
    className: [childProps.className, className].filter(Boolean).join(' ') || undefined,
    title: undefined,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      ;(childProps.onMouseEnter as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(e)
      show(e.currentTarget)
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      ;(childProps.onMouseLeave as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(e)
      hide()
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      ;(childProps.onFocus as ((event: React.FocusEvent<HTMLElement>) => void) | undefined)?.(e)
      show(e.currentTarget)
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      ;(childProps.onBlur as ((event: React.FocusEvent<HTMLElement>) => void) | undefined)?.(e)
      hide()
    },
  }

  const tooltipNode =
    open && mounted && !isEmptyTooltipContent(content)
      ? createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className={[
              SCHEDULE_TOOLTIP_PANEL_CLASS,
              typeof content === 'string' ? 'whitespace-pre-line break-words' : '',
              contentClassName,
            ]
              .filter(Boolean)
              .join(' ')}
            style={style}
          >
            {content}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      {cloneElement(children, mergedProps)}
      {tooltipNode}
    </>
  )
}
