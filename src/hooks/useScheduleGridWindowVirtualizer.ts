import { useLayoutEffect, useRef, useState } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'

export const SCHEDULE_GRID_VIRTUAL_ROW_ESTIMATE_PX = 28
export const SCHEDULE_GRID_VIRTUALIZE_MIN_ROWS = 20

type UseScheduleGridWindowVirtualizerOptions = {
  enabled: boolean
  count: number
  estimateSize?: number
  overscan?: number
}

/** 스케줄 그리드 tbody — window 세로 스크롤 기준 행 가상화 */
export function useScheduleGridWindowVirtualizer(options: UseScheduleGridWindowVirtualizerOptions) {
  const anchorRef = useRef<HTMLTableSectionElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const active =
    options.enabled && options.count >= SCHEDULE_GRID_VIRTUALIZE_MIN_ROWS

  useLayoutEffect(() => {
    if (!active) return

    const updateScrollMargin = () => {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setScrollMargin(rect.top + window.scrollY)
    }

    updateScrollMargin()
    window.addEventListener('resize', updateScrollMargin)
    window.addEventListener('scroll', updateScrollMargin, { passive: true })

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateScrollMargin)
        : null
    if (observer && anchorRef.current) {
      observer.observe(anchorRef.current)
    }

    return () => {
      window.removeEventListener('resize', updateScrollMargin)
      window.removeEventListener('scroll', updateScrollMargin)
      observer?.disconnect()
    }
  }, [active, options.count])

  const virtualizer = useWindowVirtualizer({
    count: active ? options.count : 0,
    estimateSize: () => options.estimateSize ?? SCHEDULE_GRID_VIRTUAL_ROW_ESTIMATE_PX,
    overscan: options.overscan ?? 6,
    scrollMargin,
  })

  return {
    anchorRef,
    active,
    virtualizer,
    virtualItems: active ? virtualizer.getVirtualItems() : null,
    totalSize: active ? virtualizer.getTotalSize() : 0,
  }
}
