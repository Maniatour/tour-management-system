import type { PricingBoardColumn } from './pricingBoard'

export type BoardLayoutPrefs = {
  order: string[]
  favorites: string[]
  hidden: string[]
}

export const EMPTY_BOARD_LAYOUT: BoardLayoutPrefs = {
  order: [],
  favorites: [],
  hidden: [],
}

const STORAGE_KEY = 'kovegas.marketResearch.boardLayout.v1'

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function normalizePrefs(value: unknown): BoardLayoutPrefs {
  if (!value || typeof value !== 'object') return { ...EMPTY_BOARD_LAYOUT }
  const row = value as Partial<BoardLayoutPrefs>
  return {
    order: isStringList(row.order) ? row.order : [],
    favorites: isStringList(row.favorites) ? row.favorites : [],
    hidden: isStringList(row.hidden) ? row.hidden : [],
  }
}

export function readBoardLayouts(): Record<string, BoardLayoutPrefs> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const next: Record<string, BoardLayoutPrefs> = {}
    for (const [productId, prefs] of Object.entries(parsed)) {
      next[productId] = normalizePrefs(prefs)
    }
    return next
  } catch {
    return {}
  }
}

export function writeBoardLayouts(layouts: Record<string, BoardLayoutPrefs>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
}

export function arrangeBoardColumns(
  columns: PricingBoardColumn[],
  prefs: BoardLayoutPrefs
): PricingBoardColumn[] {
  const hidden = new Set(prefs.hidden)
  const rank = new Map(prefs.order.map((id, index) => [id, index]))
  const ours = columns.filter((column) => column.kind === 'ours')
  const competitors = columns
    .filter((column) => column.kind === 'competitor' && !hidden.has(column.columnId))
    .slice()
    .sort((a, b) => {
      const rankA = rank.get(a.columnId)
      const rankB = rank.get(b.columnId)
      if (rankA == null && rankB == null) return 0
      if (rankA == null) return 1
      if (rankB == null) return -1
      return rankA - rankB
    })
  return [...ours, ...competitors]
}

export function moveListingOrder(visibleIds: string[], id: string, direction: -1 | 1): string[] {
  const index = visibleIds.indexOf(id)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= visibleIds.length) return visibleIds
  const next = visibleIds.slice()
  const [item] = next.splice(index, 1)
  if (!item) return visibleIds
  next.splice(nextIndex, 0, item)
  return next
}
