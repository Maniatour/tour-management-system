/** 객실 등 capacity 기반 초이스 옵션 유틸 */

export type CapacityOptionLike = {
  option_id: string
  capacity?: number | null
}

/** 옵션에 유효한 수용 인원이 있는지 */
export function getOptionCapacity(option: { capacity?: number | null }): number | null {
  const cap = option.capacity
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0) return null
  return Math.floor(cap)
}

/**
 * 숙박(객실)형 quantity 그룹 여부.
 * capacity가 2 이상이거나, 옵션별 capacity가 서로 다르면 객실 조합으로 본다.
 * (전부 capacity 1인 거주자 구분 등은 false)
 */
export function isAccommodationCapacityGroup(
  options: Array<{ capacity?: number | null }>
): boolean {
  const caps = options
    .map((option) => getOptionCapacity(option))
    .filter((cap): cap is number => cap != null)
  if (caps.length === 0) return false
  return Math.max(...caps) > 1 || new Set(caps).size > 1
}

/**
 * 객실 capacity 조합 UI 사용 여부.
 * capacity 패턴이 객실형이면 choice_type(single/quantity)과 무관하게 수량 조합 UI를 쓴다.
 */
export function usesCapacityQuantitySelection(
  _choiceType: string | null | undefined,
  options: Array<{ capacity?: number | null }>
): boolean {
  return isAccommodationCapacityGroup(options)
}

/** 예약 인원보다 큰 객실은 숨김. capacity 없는 옵션은 항상 표시 */
export function isOptionVisibleForPartySize(
  option: { capacity?: number | null },
  partySize: number
): boolean {
  if (partySize <= 0) return true
  const cap = getOptionCapacity(option)
  if (cap == null) return true
  return cap <= partySize
}

export function filterOptionsByPartySize<T extends { capacity?: number | null }>(
  options: T[],
  partySize: number
): T[] {
  return options.filter((option) => isOptionVisibleForPartySize(option, partySize))
}

/** Σ (capacity × quantity). capacity 없으면 1로 간주 */
export function getCapacityCoverage(
  options: CapacityOptionLike[],
  quantities: Record<string, number>
): number {
  return options.reduce((sum, option) => {
    const qty = quantities[option.option_id] ?? 0
    if (qty <= 0) return sum
    const cap = getOptionCapacity(option) ?? 1
    return sum + cap * qty
  }, 0)
}

/** 해당 옵션에 추가로 넣을 수 있는 최대 수량 */
export function getMaxQuantityForOption(
  option: { option_id: string; capacity?: number | null },
  options: CapacityOptionLike[],
  quantities: Record<string, number>,
  partySize: number
): number {
  if (partySize <= 0) return 0
  const cap = getOptionCapacity(option) ?? 1
  const currentQty = quantities[option.option_id] ?? 0
  const coverageWithout =
    getCapacityCoverage(options, quantities) - currentQty * cap
  const remaining = partySize - coverageWithout
  if (remaining <= 0) return 0
  return Math.floor(remaining / cap)
}

export function isCapacityCoverageExact(
  options: CapacityOptionLike[],
  quantities: Record<string, number>,
  partySize: number
): boolean {
  if (partySize <= 0) return false
  return getCapacityCoverage(options, quantities) === partySize
}

/** 인원 변경 시 보이지 않는 옵션 수량을 제거 */
export function pruneQuantitiesForPartySize(
  options: CapacityOptionLike[],
  quantities: Record<string, number>,
  partySize: number
): Record<string, number> {
  const next: Record<string, number> = {}
  for (const option of options) {
    const qty = quantities[option.option_id] ?? 0
    if (qty <= 0) continue
    if (!isOptionVisibleForPartySize(option, partySize)) continue
    next[option.option_id] = qty
  }
  return next
}
