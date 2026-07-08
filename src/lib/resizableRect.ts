export type ResizableRect = {
  x: number
  y: number
  w: number
  h: number
}

export type ResizeHandle =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw'

export function clampResizableRect(
  rect: ResizableRect,
  opts?: { minW?: number; minH?: number; margin?: number }
): ResizableRect {
  const minW = opts?.minW ?? 360
  const minH = opts?.minH ?? 320
  const margin = opts?.margin ?? 8

  if (typeof window === 'undefined') return rect

  const maxW = window.innerWidth - margin * 2
  const maxH = window.innerHeight - margin * 2
  const w = Math.min(Math.max(minW, rect.w), maxW)
  const h = Math.min(Math.max(minH, rect.h), maxH)
  const x = Math.min(Math.max(margin, rect.x), window.innerWidth - w - margin)
  const y = Math.min(Math.max(margin, rect.y), window.innerHeight - h - margin)

  return { x, y, w, h }
}

export function defaultCenteredRect(w: number, h: number): ResizableRect {
  if (typeof window === 'undefined') {
    return { x: 48, y: 48, w, h }
  }
  return clampResizableRect({
    x: Math.max(16, (window.innerWidth - w) / 2),
    y: Math.max(16, (window.innerHeight - h) / 2),
    w,
    h,
  })
}

export function loadPersistedRect(storageKey: string, fallback: ResizableRect): ResizableRect {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return fallback
    const p = JSON.parse(raw) as Partial<ResizableRect>
    return clampResizableRect({
      x: typeof p.x === 'number' ? p.x : fallback.x,
      y: typeof p.y === 'number' ? p.y : fallback.y,
      w: typeof p.w === 'number' ? p.w : fallback.w,
      h: typeof p.h === 'number' ? p.h : fallback.h,
    })
  } catch {
    return fallback
  }
}

export function persistRect(storageKey: string, rect: ResizableRect) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(rect))
  } catch {
    /* ignore */
  }
}

export function applyResizeDelta(
  start: ResizableRect,
  handle: ResizeHandle,
  dx: number,
  dy: number
): ResizableRect {
  let { x, y, w, h } = start

  if (handle.includes('e')) w = start.w + dx
  if (handle.includes('w')) {
    w = start.w - dx
    x = start.x + dx
  }
  if (handle.includes('s')) h = start.h + dy
  if (handle.includes('n')) {
    h = start.h - dy
    y = start.y + dy
  }

  return clampResizableRect({ x, y, w, h })
}
