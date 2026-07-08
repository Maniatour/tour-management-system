export type StaffColor = {
  bg: string
  hover: string
  border: string
  text: string
  label: string
}

const PALETTE: Omit<StaffColor, 'label'>[] = [
  { bg: '#fcd5b5', hover: '#f4b183', border: '#e8a87c', text: '#5c3d1e' },
  { bg: '#bdd7ee', hover: '#9dc3e6', border: '#6fa8dc', text: '#1e4a6e' },
  { bg: '#c6e0b4', hover: '#a9d18e', border: '#70ad47', text: '#2d5016' },
  { bg: '#d9d9d9', hover: '#bfbfbf', border: '#a6a6a6', text: '#404040' },
  { bg: '#e2bef1', hover: '#d0a9e0', border: '#b07cc6', text: '#4a2d5c' },
  { bg: '#fff2cc', hover: '#ffe699', border: '#ffd966', text: '#7a5c00' },
  { bg: '#f8cbad', hover: '#f4a460', border: '#ed7d31', text: '#6b3a10' },
  { bg: '#c9daf8', hover: '#a4c2f4', border: '#6d9eeb', text: '#1c4587' },
]

export function staffColorForIndex(index: number, label: string): StaffColor {
  const base = PALETTE[index % PALETTE.length]
  return { ...base, label }
}

export function buildStaffColorMap(
  emails: string[],
  labelFor: (email: string) => string,
  overrides?: Record<string, { bg: string; border: string; text: string }>
): Map<string, StaffColor> {
  const map = new Map<string, StaffColor>()
  emails.forEach((email, i) => {
    const key = email.trim().toLowerCase()
    const base = staffColorForIndex(i, labelFor(email))
    const o = overrides?.[key]
    map.set(
      key,
      o
        ? { ...base, bg: o.bg, border: o.border, text: o.text }
        : base
    )
  })
  return map
}

/** 2인 이상 겹침 시 대각 분할 그라데이션 */
export function cellBackgroundForEmails(
  emails: string[],
  colorMap: Map<string, StaffColor>
): { background: string; color: string } {
  const sorted = [...new Set(emails.map((e) => e.trim().toLowerCase()))].sort()
  if (sorted.length === 0) {
    return { background: '#ffffff', color: '#9ca3af' }
  }
  const colors = sorted
    .map((e) => colorMap.get(e)?.bg)
    .filter((c): c is string => Boolean(c))
  if (colors.length === 0) {
    return { background: '#e5e7eb', color: '#374151' }
  }
  if (colors.length === 1) {
    const c = colorMap.get(sorted[0])
    return { background: colors[0], color: c?.text ?? '#1f2937' }
  }
  const step = 100 / colors.length
  const stops = colors
    .map((c, i) => `${c} ${(i * step).toFixed(1)}%, ${c} ${((i + 1) * step).toFixed(1)}%`)
    .join(', ')
  return {
    background: `linear-gradient(135deg, ${stops})`,
    color: '#1f2937',
  }
}

export function cellLabelForEmails(
  emails: string[],
  colorMap: Map<string, StaffColor>
): string {
  return [...new Set(emails)]
    .map((e) => colorMap.get(e.trim().toLowerCase())?.label ?? e.split('@')[0])
    .join(' · ')
}
