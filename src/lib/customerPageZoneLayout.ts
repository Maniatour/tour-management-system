import type { CustomerPageZone } from '@/lib/customerPageZones'
import {
  getDefaultPageZoneOrder,
  getPageZoneBlockDef,
  type ZoneLayoutPageId,
} from '@/lib/customerPageZoneLayoutCatalog'

export type PageZoneLayoutEntry = {
  zoneId: CustomerPageZone
  visible: boolean
}

export type PageZoneLayout = {
  zones: PageZoneLayoutEntry[]
}

export function buildDefaultPageZoneLayout(pageId: ZoneLayoutPageId): PageZoneLayout {
  return {
    zones: getDefaultPageZoneOrder(pageId).map((zoneId) => ({
      zoneId,
      visible: true,
    })),
  }
}

export function normalizePageZoneLayout(
  raw: unknown,
  pageId: ZoneLayoutPageId
): PageZoneLayout {
  const defaults = buildDefaultPageZoneLayout(pageId)
  if (!raw || typeof raw !== 'object') return defaults

  const zonesRaw = (raw as { zones?: unknown }).zones
  if (!Array.isArray(zonesRaw)) return defaults

  const byId = new Map<CustomerPageZone, PageZoneLayoutEntry>()
  for (const item of zonesRaw) {
    if (!item || typeof item !== 'object') continue
    const zoneId = (item as { zoneId?: unknown }).zoneId
    if (typeof zoneId !== 'string') continue
    const def = getPageZoneBlockDef(pageId, zoneId as CustomerPageZone)
    if (!def) continue
    const visible = (item as { visible?: unknown }).visible
    byId.set(zoneId as CustomerPageZone, {
      zoneId: zoneId as CustomerPageZone,
      visible: visible !== false,
    })
  }

  const zones: PageZoneLayoutEntry[] = []
  for (const entry of zonesRaw) {
    if (!entry || typeof entry !== 'object') continue
    const zoneId = (entry as { zoneId?: unknown }).zoneId
    if (typeof zoneId !== 'string') continue
    const normalized = byId.get(zoneId as CustomerPageZone)
    if (normalized && !zones.some((z) => z.zoneId === normalized.zoneId)) {
      zones.push(normalized)
    }
  }

  for (const defaultEntry of defaults.zones) {
    if (!zones.some((z) => z.zoneId === defaultEntry.zoneId)) {
      zones.push(defaultEntry)
    }
  }

  return { zones }
}

export function pageZoneLayoutsEqual(a: PageZoneLayout, b: PageZoneLayout): boolean {
  if (a.zones.length !== b.zones.length) return false
  return a.zones.every(
    (entry, index) =>
      entry.zoneId === b.zones[index]?.zoneId && entry.visible === b.zones[index]?.visible
  )
}

export function countVisiblePageZones(layout: PageZoneLayout): number {
  return layout.zones.filter((entry) => entry.visible).length
}

export function canHidePageZone(layout: PageZoneLayout, zoneId: CustomerPageZone): boolean {
  const entry = layout.zones.find((z) => z.zoneId === zoneId)
  if (!entry?.visible) return true
  return countVisiblePageZones(layout) > 1
}

export function setPageZoneVisible(
  layout: PageZoneLayout,
  zoneId: CustomerPageZone,
  visible: boolean
): PageZoneLayout {
  return {
    zones: layout.zones.map((entry) =>
      entry.zoneId === zoneId ? { ...entry, visible } : entry
    ),
  }
}

export function reorderPageZonesAtIndex(
  layout: PageZoneLayout,
  fromIndex: number,
  toIndex: number
): PageZoneLayout {
  if (fromIndex === toIndex) return layout
  if (fromIndex < 0 || toIndex < 0) return layout
  if (fromIndex >= layout.zones.length || toIndex >= layout.zones.length) return layout

  const next = [...layout.zones]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return layout
  next.splice(toIndex, 0, moved)
  return { zones: next }
}

export function movePageZone(
  layout: PageZoneLayout,
  zoneId: CustomerPageZone,
  direction: 'up' | 'down'
): PageZoneLayout {
  const index = layout.zones.findIndex((entry) => entry.zoneId === zoneId)
  if (index < 0) return layout
  const target = direction === 'up' ? index - 1 : index + 1
  return reorderPageZonesAtIndex(layout, index, target)
}

export function getOrderedVisiblePageZones(layout: PageZoneLayout): PageZoneLayoutEntry[] {
  return layout.zones.filter((entry) => entry.visible)
}

export function getPageZoneLayoutViews(
  layout: PageZoneLayout,
  includeHidden: boolean
): Array<PageZoneLayoutEntry & { orderIndex: number }> {
  if (includeHidden) {
    return layout.zones.map((entry, orderIndex) => ({ ...entry, orderIndex }))
  }
  return layout.zones
    .filter((entry) => entry.visible)
    .map((entry, orderIndex) => ({ ...entry, orderIndex }))
}

export function reorderPageDraggableZonesAtIndex(
  layout: PageZoneLayout,
  pageId: ZoneLayoutPageId,
  fromDragIndex: number,
  toDragIndex: number
): PageZoneLayout {
  const draggable = layout.zones.filter(
    (entry) => !getPageZoneBlockDef(pageId, entry.zoneId)?.fixed
  )
  if (fromDragIndex === toDragIndex) return layout
  if (fromDragIndex < 0 || toDragIndex < 0) return layout
  if (fromDragIndex >= draggable.length || toDragIndex >= draggable.length) return layout

  const fromZoneId = draggable[fromDragIndex]?.zoneId
  const toZoneId = draggable[toDragIndex]?.zoneId
  if (!fromZoneId || !toZoneId) return layout

  const fromFullIndex = layout.zones.findIndex((entry) => entry.zoneId === fromZoneId)
  const toFullIndex = layout.zones.findIndex((entry) => entry.zoneId === toZoneId)
  if (fromFullIndex < 0 || toFullIndex < 0) return layout

  return reorderPageZonesAtIndex(layout, fromFullIndex, toFullIndex)
}

/** product-detail: 본문(좌측) 블록만 순서 반환 — header·sidebar 제외 */
export function getProductDetailMainBlockOrder(layout: PageZoneLayout): CustomerPageZone[] {
  const skip = new Set<CustomerPageZone>(['detail-header', 'detail-sidebar'])
  return layout.zones.filter((z) => z.visible && !skip.has(z.zoneId)).map((z) => z.zoneId)
}
