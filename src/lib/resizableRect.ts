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

const DEFAULT_TOP_INSET_PX = 64

function parseCssLength(raw: string): number {
  const v = raw.trim()
  if (!v) return 0
  if (v.endsWith('rem')) return parseFloat(v) * 16
  if (v.endsWith('px')) return parseFloat(v)
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/** 고정 헤더(--header-height) 높이 — 모달이 헤더 아래로 들어가지 않도록 */
export function getLayoutTopInset(): number {
  if (typeof window === 'undefined') return DEFAULT_TOP_INSET_PX
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height')
  return parseCssLength(raw) || DEFAULT_TOP_INSET_PX
}

export function clampResizableRect(
  rect: ResizableRect,
  opts?: { minW?: number; minH?: number; margin?: number; topInset?: number }
): ResizableRect {
  const minW = opts?.minW ?? 360
  const minH = opts?.minH ?? 320
  const margin = opts?.margin ?? 8
  const topInset = opts?.topInset ?? getLayoutTopInset()

  if (typeof window === 'undefined') return rect

  const minY = topInset + margin
  const maxW = window.innerWidth - margin * 2
  const maxH = window.innerHeight - minY - margin
  const w = Math.min(Math.max(minW, rect.w), maxW)
  const h = Math.min(Math.max(minH, rect.h), maxH)
  const x = Math.min(Math.max(margin, rect.x), window.innerWidth - w - margin)
  const y = Math.min(Math.max(minY, rect.y), window.innerHeight - h - margin)

  return { x, y, w, h }
}

export function defaultCenteredRect(w: number, h: number): ResizableRect {
  if (typeof window === 'undefined') {
    return { x: 48, y: 48 + DEFAULT_TOP_INSET_PX, w, h }
  }
  const margin = 8
  const topInset = getLayoutTopInset()
  const minY = topInset + margin
  const maxH = window.innerHeight - minY - margin
  const clampedH = Math.min(h, Math.max(320, maxH))
  return clampResizableRect({
    x: Math.max(margin, (window.innerWidth - w) / 2),
    y: Math.max(minY, (window.innerHeight - clampedH) / 2),
    w,
    h: clampedH,
  })
}

export function loadPersistedRect(storageKey: string, fallback: ResizableRect): ResizableRect {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return fallback
    const p = JSON.parse(raw) as Partial<ResizableRect>
    const loaded = clampResizableRect({
      x: typeof p.x === 'number' ? p.x : fallback.x,
      y: typeof p.y === 'number' ? p.y : fallback.y,
      w: typeof p.w === 'number' ? p.w : fallback.w,
      h: typeof p.h === 'number' ? p.h : fallback.h,
    })
    // 화면 하단에 붙어 저장된 위치는 다시 중앙으로
    if (loaded.y > window.innerHeight * 0.55) {
      return fallback
    }
    return loaded
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
