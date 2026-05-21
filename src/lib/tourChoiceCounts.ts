/** 투어·스케줄·입장권 목록 — 예약 초이스를 X / L / U 로 합산 (거주자·패스 등 제외) */

export type TourChoiceCountKey = 'X' | 'L' | 'U' | '_other'

export type TourChoiceCounts = Partial<Record<TourChoiceCountKey, number>>

const CANYON_KEYS: TourChoiceCountKey[] = ['X', 'L', 'U']
const CHOICE_DISPLAY_ORDER: TourChoiceCountKey[] = ['X', 'L', 'U']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isCanyonTourChoiceKey(key: TourChoiceCountKey): key is 'X' | 'L' | 'U' {
  return key === 'X' || key === 'L' || key === 'U'
}

export function choiceLabelToTourCountKey(
  nameKo: string | null | undefined,
  nameEn: string | null | undefined,
  optionKey: string | null | undefined
): TourChoiceCountKey {
  const rawKey = (optionKey || '').trim()
  if (rawKey && !UUID_RE.test(rawKey)) {
    const k = rawKey.toLowerCase()
    if (k === 'antelope_x' || k === 'x' || k === 'antelope x') return 'X'
    if (k === 'lower_antelope' || k === 'l' || k === 'lower antelope') return 'L'
    if (k === 'upper_antelope' || k === 'u' || k === 'upper antelope') return 'U'
  }

  const label = (nameKo || nameEn || (rawKey && !UUID_RE.test(rawKey) ? rawKey : '') || '')
    .toString()
    .trim()
  const labelLower = label.toLowerCase()
  const labelKo = label
  if (labelLower.includes('antelope x canyon') || /엑스\s*앤텔롭|엑스\s*앤틸롭|엑스\s*엔텔롭/.test(labelKo)) {
    return 'X'
  }
  if (labelLower.includes('lower antelope canyon') || /로어\s*앤텔롭|로어\s*앤틸롭|로어\s*엔텔롭/.test(labelKo)) {
    return 'L'
  }
  if (labelLower.includes('upper antelope canyon') || /어퍼\s*앤텔롭|어퍼\s*앤틸롭|어퍼\s*엔텔롭/.test(labelKo)) {
    return 'U'
  }
  if (labelLower.includes('antelope x') || labelLower.includes(' x ') || /\bx\s*canyon/i.test(labelLower)) {
    return 'X'
  }
  if (labelLower.includes('lower antelope') || labelLower.includes('lower_antelope')) return 'L'
  if (labelLower.includes('upper antelope') || labelLower.includes('upper_antelope')) return 'U'
  if (labelLower.includes('lower')) return 'L'
  if (labelLower.includes('upper')) return 'U'
  return '_other'
}

export type ReservationChoiceRow = { choiceKey: TourChoiceCountKey; quantity: number }

/**
 * 투어 상세 예약 카드와 동일: 캐년(X/L/U)만 합산.
 * 거주자·패스 등 다른 초이스 행이 있어도 예약 인원은 캐년 1종에 전부 반영.
 */
export function aggregateTourChoiceCounts(
  reservations: Array<{ id: string; total_people?: number | null }>,
  choiceRowsByResId: Map<string, ReservationChoiceRow[]>
): TourChoiceCounts {
  const counts: TourChoiceCounts = {}
  for (const res of reservations) {
    const allRows = choiceRowsByResId.get(res.id) || []
    const canyonRows = allRows.filter((r) => isCanyonTourChoiceKey(r.choiceKey))
    if (canyonRows.length === 0) continue

    const people = Number(res.total_people) || 0
    if (canyonRows.length === 1) {
      const key = canyonRows[0]!.choiceKey
      if (isCanyonTourChoiceKey(key)) {
        counts[key] = (counts[key] || 0) + people
      }
    } else {
      for (const r of canyonRows) {
        if (isCanyonTourChoiceKey(r.choiceKey)) {
          counts[r.choiceKey] = (counts[r.choiceKey] || 0) + r.quantity
        }
      }
    }
  }
  return counts
}

export function tourChoiceCountsHasDisplayable(counts: TourChoiceCounts | undefined): boolean {
  if (!counts) return false
  return CANYON_KEYS.some((k) => (counts[k] || 0) > 0)
}

export function tourChoiceCountsDisplayKeys(counts: TourChoiceCounts): Array<'X' | 'L' | 'U'> {
  return CHOICE_DISPLAY_ORDER.filter((k) => (counts[k] || 0) > 0) as Array<'X' | 'L' | 'U'>
}
