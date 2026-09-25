'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { StickyNote } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function readReservationEventNote(source: object | null | undefined): string {
  if (!source) return ''
  const row = source as Record<string, unknown>
  const raw = row.event_note ?? row.eventNote
  return typeof raw === 'string' ? raw.trim() : ''
}

type ReservationEventNoteIconProps = {
  note: string | null | undefined
  compact?: boolean
}

const PANEL_WIDTH = 280
const PANEL_Z_INDEX = 20000

type PanelBox = { top: number; left: number }

function panelBox(anchor: DOMRect, height = 96): PanelBox {
  const width = Math.min(PANEL_WIDTH, window.innerWidth - 16)
  let left = anchor.left
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
  if (left < 8) left = 8

  let top = anchor.bottom + 8
  if (top + height > window.innerHeight - 8 && anchor.top > height + 8) {
    top = anchor.top - height - 8
  }
  return { top, left }
}

export function ReservationEventNoteIcon({ note, compact = false }: ReservationEventNoteIconProps) {
  const t = useTranslations('reservations')
  const label = t('form.eventNote')
  const text = (note ?? '').trim()
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [box, setBox] = useState<PanelBox | null>(null)

  pinnedRef.current = pinned
  const shown = Boolean(text) && (open || pinned) && box != null

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const placeFromButton = () => {
    const anchor = buttonRef.current?.getBoundingClientRect()
    if (!anchor) return
    setBox(panelBox(anchor))
  }

  const showFromHover = () => {
    clearCloseTimer()
    placeFromButton()
    setOpen(true)
  }

  const hideFromHover = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      if (!pinnedRef.current) setOpen(false)
    }, 180)
  }

  useEffect(() => () => clearCloseTimer(), [])

  useLayoutEffect(() => {
    if (!shown || !buttonRef.current || !panelRef.current) return
    const next = panelBox(buttonRef.current.getBoundingClientRect(), panelRef.current.offsetHeight)
    setBox((prev) => {
      if (prev && Math.abs(prev.top - next.top) < 1 && Math.abs(prev.left - next.left) < 1) return prev
      return next
    })
  }, [shown, text])

  useEffect(() => {
    if (!shown) return
    const onScroll = () => placeFromButton()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [shown])

  useEffect(() => {
    if (!pinned) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setPinned(false)
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setPinned(false)
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pinned])

  if (!text) return null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`relative z-20 inline-flex shrink-0 items-center justify-center rounded-md text-amber-700 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          pinned || open ? 'bg-amber-100 ring-1 ring-amber-300' : ''
        } ${compact ? 'h-5 w-5' : 'h-6 w-6'}`}
        aria-label={label}
        aria-expanded={shown}
        aria-describedby={shown ? panelId : undefined}
        onMouseEnter={showFromHover}
        onMouseLeave={hideFromHover}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          clearCloseTimer()
          placeFromButton()
          const next = !pinnedRef.current
          pinnedRef.current = next
          setPinned(next)
          setOpen(next)
        }}
      >
        <StickyNote size={compact ? 12 : 14} aria-hidden />
      </button>
      {shown
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="tooltip"
              className="fixed w-[min(280px,calc(100vw-16px))] rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-left shadow-xl"
              style={{ top: box.top, left: box.left, zIndex: PANEL_Z_INDEX }}
              onMouseEnter={showFromHover}
              onMouseLeave={hideFromHover}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <p className="mb-1 text-[11px] font-semibold text-amber-800">{label}</p>
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-800">
                {text}
              </p>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
