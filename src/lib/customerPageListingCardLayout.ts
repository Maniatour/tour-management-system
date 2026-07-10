import {
  getDefaultListingCardSlotOrder,
  getListingCardSlotDef,
  type ListingCardSlotId,
} from '@/lib/customerPageListingCardLayoutCatalog'

export type ListingCardLayoutEntry = {
  slotId: ListingCardSlotId
  visible: boolean
}

export type ListingCardLayout = {
  slots: ListingCardLayoutEntry[]
}

export function buildDefaultListingCardLayout(): ListingCardLayout {
  return {
    slots: getDefaultListingCardSlotOrder().map((slotId) => ({
      slotId,
      visible: true,
    })),
  }
}

export function normalizeListingCardLayout(raw: unknown): ListingCardLayout {
  const defaults = buildDefaultListingCardLayout()
  if (!raw || typeof raw !== 'object') return defaults

  const slotsRaw = (raw as { slots?: unknown }).slots ?? (raw as { zones?: unknown }).zones
  if (!Array.isArray(slotsRaw)) return defaults

  const byId = new Map<ListingCardSlotId, ListingCardLayoutEntry>()
  for (const item of slotsRaw) {
    if (!item || typeof item !== 'object') continue
    const slotId = (item as { slotId?: unknown; zoneId?: unknown }).slotId
      ?? (item as { zoneId?: unknown }).zoneId
    if (typeof slotId !== 'string') continue
    if (!getListingCardSlotDef(slotId as ListingCardSlotId)) continue
    const visible = (item as { visible?: unknown }).visible
    byId.set(slotId as ListingCardSlotId, {
      slotId: slotId as ListingCardSlotId,
      visible: visible !== false,
    })
  }

  const slots: ListingCardLayoutEntry[] = []
  for (const entry of slotsRaw) {
    if (!entry || typeof entry !== 'object') continue
    const slotId = (entry as { slotId?: unknown; zoneId?: unknown }).slotId
      ?? (entry as { zoneId?: unknown }).zoneId
    if (typeof slotId !== 'string') continue
    const normalized = byId.get(slotId as ListingCardSlotId)
    if (normalized && !slots.some((s) => s.slotId === normalized.slotId)) {
      slots.push(normalized)
    }
  }

  for (const defaultEntry of defaults.slots) {
    if (!slots.some((s) => s.slotId === defaultEntry.slotId)) {
      slots.push(defaultEntry)
    }
  }

  return { slots }
}

export function listingCardLayoutsEqual(a: ListingCardLayout, b: ListingCardLayout): boolean {
  if (a.slots.length !== b.slots.length) return false
  return a.slots.every(
    (entry, index) =>
      entry.slotId === b.slots[index]?.slotId && entry.visible === b.slots[index]?.visible
  )
}

export function countVisibleListingCardSlots(layout: ListingCardLayout): number {
  return layout.slots.filter((entry) => entry.visible).length
}

export function canHideListingCardSlot(layout: ListingCardLayout, slotId: ListingCardSlotId): boolean {
  const entry = layout.slots.find((s) => s.slotId === slotId)
  if (!entry?.visible) return true
  return countVisibleListingCardSlots(layout) > 1
}

export function setListingCardSlotVisible(
  layout: ListingCardLayout,
  slotId: ListingCardSlotId,
  visible: boolean
): ListingCardLayout {
  return {
    slots: layout.slots.map((entry) =>
      entry.slotId === slotId ? { ...entry, visible } : entry
    ),
  }
}

export function reorderListingCardSlotsAtIndex(
  layout: ListingCardLayout,
  fromIndex: number,
  toIndex: number
): ListingCardLayout {
  if (fromIndex === toIndex) return layout
  if (fromIndex < 0 || toIndex < 0) return layout
  if (fromIndex >= layout.slots.length || toIndex >= layout.slots.length) return layout

  const next = [...layout.slots]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return layout
  next.splice(toIndex, 0, moved)
  return { slots: next }
}

export function reorderListingCardDraggableSlotsAtIndex(
  layout: ListingCardLayout,
  fromDragIndex: number,
  toDragIndex: number
): ListingCardLayout {
  const draggable = layout.slots.filter((entry) => !getListingCardSlotDef(entry.slotId)?.fixed)
  if (fromDragIndex === toDragIndex) return layout
  if (fromDragIndex < 0 || toDragIndex < 0) return layout
  if (fromDragIndex >= draggable.length || toDragIndex >= draggable.length) return layout

  const fromSlotId = draggable[fromDragIndex]?.slotId
  const toSlotId = draggable[toDragIndex]?.slotId
  if (!fromSlotId || !toSlotId) return layout

  const fromFullIndex = layout.slots.findIndex((entry) => entry.slotId === fromSlotId)
  const toFullIndex = layout.slots.findIndex((entry) => entry.slotId === toSlotId)
  if (fromFullIndex < 0 || toFullIndex < 0) return layout

  return reorderListingCardSlotsAtIndex(layout, fromFullIndex, toFullIndex)
}

export function getListingCardLayoutViews(
  layout: ListingCardLayout,
  includeHidden: boolean
): Array<ListingCardLayoutEntry & { orderIndex: number }> {
  if (includeHidden) {
    return layout.slots.map((entry, orderIndex) => ({ ...entry, orderIndex }))
  }
  return layout.slots
    .filter((entry) => entry.visible)
    .map((entry, orderIndex) => ({ ...entry, orderIndex }))
}

export function getListingCardBodySlotOrder(layout: ListingCardLayout): ListingCardSlotId[] {
  const skip = new Set<ListingCardSlotId>(['listing-card-image', 'listing-card-cta'])
  return layout.slots.filter((s) => s.visible && !skip.has(s.slotId)).map((s) => s.slotId)
}
