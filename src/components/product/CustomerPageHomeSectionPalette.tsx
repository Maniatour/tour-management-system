'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Move, Plus } from 'lucide-react'
import { Draggable, Droppable } from '@hello-pangea/dnd'
import {
  HOME_SECTION_KIND_FILTER_OPTIONS,
  HOME_SECTION_PRESETS,
  getHomeSectionPresetsByKind,
  applyHomeSectionPreset,
  type HomeSectionPreset,
} from '@/lib/customerPageHomeSectionPresets'
import type { HomeSectionKind } from '@/lib/customerPageHomeSectionCatalog'
import { getCatalogItem } from '@/lib/customerPageHomeSectionCatalog'
import { insertHomeSectionFromPresetAtIndex } from '@/lib/customerPageHomeLayout'
import { applyCustomerPageHomeLayoutUpdate } from '@/lib/customerPageHomeLayoutActions'

const PALETTE_STORAGE_KEY = 'customer-page-home-palette-layout'
const DEFAULT_WIDTH = 420
const DEFAULT_HEIGHT = 300
const MIN_WIDTH = 280
const MIN_HEIGHT = 180
const MAX_WIDTH = 720
const MAX_HEIGHT = 640

type PaletteLayout = {
  x: number
  y: number
  width: number
  height: number
}

type CustomerPageHomeSectionPaletteProps = {
  droppableId: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getDefaultLayout(): PaletteLayout {
  if (typeof window === 'undefined') {
    return { x: 16, y: 16, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
  }

  const width = DEFAULT_WIDTH
  const height = DEFAULT_HEIGHT
  return {
    x: Math.max(16, window.innerWidth - width - 16),
    y: Math.max(16, window.innerHeight - height - 88),
    width,
    height,
  }
}

function readStoredLayout(): PaletteLayout | null {
  try {
    const raw = localStorage.getItem(PALETTE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PaletteLayout>
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number' ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number'
    ) {
      return null
    }
    return {
      x: parsed.x,
      y: parsed.y,
      width: clamp(parsed.width, MIN_WIDTH, MAX_WIDTH),
      height: clamp(parsed.height, MIN_HEIGHT, MAX_HEIGHT),
    }
  } catch {
    return null
  }
}

function keepLayoutInViewport(layout: PaletteLayout): PaletteLayout {
  if (typeof window === 'undefined') return layout

  const maxX = Math.max(8, window.innerWidth - layout.width - 8)
  const maxY = Math.max(8, window.innerHeight - layout.height - 8)

  return {
    ...layout,
    x: clamp(layout.x, 8, maxX),
    y: clamp(layout.y, 8, maxY),
  }
}

export default function CustomerPageHomeSectionPalette({
  droppableId,
}: CustomerPageHomeSectionPaletteProps) {
  const [expanded, setExpanded] = useState(true)
  const [kindFilter, setKindFilter] = useState<'all' | HomeSectionKind>('all')
  const [layout, setLayout] = useState<PaletteLayout>(() => getDefaultLayout())
  const [hydrated, setHydrated] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const panelDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const panelResizeRef = useRef<{
    startX: number
    startY: number
    originW: number
    originH: number
  } | null>(null)

  const presets = useMemo(
    () => getHomeSectionPresetsByKind(kindFilter).slice(0, 12),
    [kindFilter]
  )

  useEffect(() => {
    const stored = readStoredLayout()
    setLayout(keepLayoutInViewport(stored ?? getDefaultLayout()))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(layout))
  }, [layout, hydrated])

  useEffect(() => {
    if (!hydrated) return

    const handleResize = () => {
      setLayout((current) => keepLayoutInViewport(current))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [hydrated])

  const handleQuickAdd = (preset: HomeSectionPreset) => {
    const applied = applyHomeSectionPreset(preset)
    void applyCustomerPageHomeLayoutUpdate((currentLayout) => {
      const index = currentLayout.sections.length
      return insertHomeSectionFromPresetAtIndex(currentLayout, applied, index)
    })
  }

  const finishPanelInteraction = useCallback((target: HTMLElement, pointerId: number) => {
    panelDragRef.current = null
    panelResizeRef.current = null
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId)
    }
  }, [])

  const handlePanelDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    panelDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: layout.x,
      originY: layout.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePanelDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!panelDragRef.current) return

    const dx = event.clientX - panelDragRef.current.startX
    const dy = event.clientY - panelDragRef.current.startY

    setLayout((current) =>
      keepLayoutInViewport({
        ...current,
        x: panelDragRef.current!.originX + dx,
        y: panelDragRef.current!.originY + dy,
      })
    )
  }

  const handlePanelDragEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishPanelInteraction(event.currentTarget, event.pointerId)
  }

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    panelResizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originW: layout.width,
      originH: layout.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panelResizeRef.current) return

    const dx = event.clientX - panelResizeRef.current.startX
    const dy = event.clientY - panelResizeRef.current.startY

    setLayout((current) =>
      keepLayoutInViewport({
        ...current,
        width: clamp(panelResizeRef.current!.originW + dx, MIN_WIDTH, MAX_WIDTH),
        height: clamp(panelResizeRef.current!.originH + dy, MIN_HEIGHT, MAX_HEIGHT),
      })
    )
  }

  const handleResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    finishPanelInteraction(event.currentTarget, event.pointerId)
  }

  const panelStyle: CSSProperties = {
    left: layout.x,
    top: layout.y,
    width: layout.width,
    height: expanded ? layout.height : 'auto',
  }

  return (
    <div
      ref={panelRef}
      className="customer-page-home-palette customer-page-home-palette--floating"
      style={panelStyle}
    >
      <div className="customer-page-home-palette__header">
        <button
          type="button"
          className="customer-page-home-palette__move-handle"
          aria-label="섹션 팔레트 위치 이동"
          title="드래그해서 위치 이동"
          onPointerDown={handlePanelDragStart}
          onPointerMove={handlePanelDragMove}
          onPointerUp={handlePanelDragEnd}
          onPointerCancel={handlePanelDragEnd}
        >
          <Move className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-violet-950">섹션 팔레트</p>
          <p className="text-[11px] text-violet-800/80 mt-0.5">
            드래그해서 원하는 위치에 놓거나 + 로 맨 아래에 추가
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="customer-page-home-section-btn shrink-0"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="customer-page-home-palette__body">
          <div className="customer-page-home-palette__filters">
            {HOME_SECTION_KIND_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setKindFilter(opt.id)}
                className={`customer-page-home-palette__filter ${
                  kindFilter === opt.id ? 'customer-page-home-palette__filter--active' : ''
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Droppable droppableId={droppableId} direction="horizontal" isDropDisabled>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="customer-page-home-palette__scroll customer-page-home-palette__scroll--wrap"
              >
                {presets.map((preset, index) => {
                  const catalog = getCatalogItem(preset.kind)
                  return (
                    <Draggable
                      key={preset.id}
                      draggableId={`preset:${preset.id}`}
                      index={index}
                    >
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`customer-page-home-palette__chip ${
                            snapshot.isDragging ? 'customer-page-home-palette__chip--dragging' : ''
                          }`}
                          style={{
                            ...(dragProvided.draggableProps.style as CSSProperties | undefined),
                            background: `linear-gradient(135deg, ${preset.previewFrom}, ${preset.previewTo})`,
                          }}
                        >
                          <button
                            type="button"
                            {...dragProvided.dragHandleProps}
                            className="customer-page-home-palette__grip"
                            aria-label={`${preset.label} 드래그`}
                          >
                            <GripVertical className="h-3.5 w-3.5 text-white/90" />
                          </button>
                          <div className="min-w-0 flex-1 text-white">
                            <p className="text-[10px] opacity-90">
                              {catalog.icon} {catalog.label}
                            </p>
                            <p className="text-xs font-semibold truncate">{preset.label}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickAdd(preset)}
                            className="customer-page-home-palette__add"
                            title="맨 아래 추가"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          <p className="customer-page-home-palette__meta">
            {HOME_SECTION_PRESETS.length}종 프리셋 · 필터 {presets.length}개 표시
          </p>
        </div>
      )}

      {expanded && (
        <div
          className="customer-page-home-palette__resize-handle"
          aria-hidden
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
        />
      )}
    </div>
  )
}
