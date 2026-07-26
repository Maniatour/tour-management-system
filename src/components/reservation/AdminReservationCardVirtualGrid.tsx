'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import type { Reservation } from '@/types/reservation'

export const ADMIN_RESERVATION_CARD_VIRTUALIZE_MIN = 16
const CARD_WIDTH_PX = 340
const GRID_GAP_PX = 12
const ROW_ESTIMATE_PX = 272

type AdminReservationCardVirtualGridProps = {
  reservations: Reservation[]
  gridClassName: string
  renderCard: (reservation: Reservation) => React.ReactNode
  /** 가상화 행에 실제 마운트된 예약 id (Follow-up 우선 로드용) */
  onRenderedReservationIds?: (ids: string[]) => void
}

function chunkRow<T>(items: T[], columnCount: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += columnCount) {
    rows.push(items.slice(i, i + columnCount))
  }
  return rows
}

export function AdminReservationCardVirtualGrid({
  reservations,
  gridClassName,
  renderCard,
  onRenderedReservationIds,
}: AdminReservationCardVirtualGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardWidth = CARD_WIDTH_PX
  const rowEstimate = ROW_ESTIMATE_PX
  const [columnCount, setColumnCount] = useState(1)
  const [scrollMargin, setScrollMargin] = useState(0)

  const active = reservations.length >= ADMIN_RESERVATION_CARD_VIRTUALIZE_MIN

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateColumns = () => {
      const w = el.clientWidth
      const cols = Math.max(1, Math.floor((w + GRID_GAP_PX) / (cardWidth + GRID_GAP_PX)))
      setColumnCount(cols)
    }
    updateColumns()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateColumns) : null
    ro?.observe(el)
    window.addEventListener('resize', updateColumns)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', updateColumns)
    }
  }, [cardWidth])

  const rows = useMemo(
    () => (active ? chunkRow(reservations, columnCount) : []),
    [active, reservations, columnCount]
  )

  const updateScrollMargin = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
  }, [])

  useLayoutEffect(() => {
    if (!active) return
    updateScrollMargin()
    window.addEventListener('resize', updateScrollMargin)
    window.addEventListener('scroll', updateScrollMargin, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollMargin) : null
    if (ro && containerRef.current) ro.observe(containerRef.current)
    return () => {
      window.removeEventListener('resize', updateScrollMargin)
      window.removeEventListener('scroll', updateScrollMargin)
      ro?.disconnect()
    }
  }, [active, updateScrollMargin, reservations.length])

  const virtualizer = useWindowVirtualizer({
    count: active ? rows.length : 0,
    estimateSize: () => rowEstimate + GRID_GAP_PX,
    overscan: 2,
    scrollMargin,
  })

  const virtualItems = active ? virtualizer.getVirtualItems() : []

  useEffect(() => {
    if (!onRenderedReservationIds) return
    if (!active) {
      onRenderedReservationIds(reservations.map((r) => r.id))
      return
    }
    const ids: string[] = []
    const seen = new Set<string>()
    for (const vi of virtualItems) {
      const row = rows[vi.index]
      if (!row) continue
      for (const r of row) {
        if (!seen.has(r.id)) {
          seen.add(r.id)
          ids.push(r.id)
        }
      }
    }
    onRenderedReservationIds(ids)
  }, [active, onRenderedReservationIds, reservations, rows, virtualItems])

  if (!active) {
    return (
      <div ref={containerRef} className={gridClassName}>
        {reservations.map((reservation) => (
          <React.Fragment key={reservation.id}>{renderCard(reservation)}</React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((vi) => {
          const row = rows[vi.index]
          if (!row) return null
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className={`${gridClassName} admin-reservations-card-grid--virtual-row`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start - scrollMargin}px)`,
              }}
            >
              {row.map((reservation) => (
                <React.Fragment key={reservation.id}>{renderCard(reservation)}</React.Fragment>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
