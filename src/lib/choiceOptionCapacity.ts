/** 객실 capacity / 인원·패스 quantity 초이스 유틸 */

import {
  findResidentsOptionId,
  getAutoQuantityForOption,
  getQuantityOptionNameLower,
  isPassCoverQuantityOption,
} from '@/lib/bookingFlowQuantityChoices'

export type CapacityOptionLike = {
  option_id: string
  option_key?: string | null
  capacity?: number | null
  option_name?: string | null
  option_name_ko?: string | null
  option_name_en?: string | null
}

function parseCapacityFromOptionKey(optionKey?: string | null): number | null {
  if (!optionKey) return null
  const lower = optionKey.toLowerCase()
  if (/(?:^|[_-])single(?:$|[_-])/.test(lower) || /(?:^|[_-])1p(?:$|[_-])/.test(lower)) return 1
  if (/(?:^|[_-])double(?:$|[_-])/.test(lower) || /(?:^|[_-])2p(?:$|[_-])/.test(lower)) return 2
  if (/(?:^|[_-])triple(?:$|[_-])/.test(lower) || /(?:^|[_-])3p(?:$|[_-])/.test(lower)) return 3
  if (/(?:^|[_-])quad(?:$|[_-])/.test(lower) || /(?:^|[_-])4p(?:$|[_-])/.test(lower)) return 4
  const numMatch = lower.match(/(?:room|occupancy|bed)[_-]?(\d+)/)
  if (numMatch) {
    const n = parseInt(numMatch[1], 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function parseCapacityFromOptionName(option: {
  option_key?: string | null
  option_name?: string | null
  option_name_ko?: string | null
  option_name_en?: string | null
}): number | null {
  const fromKey = parseCapacityFromOptionKey(option.option_key)
  if (fromKey != null) return fromKey

  const names = [option.option_name_ko, option.option_name, option.option_name_en].filter(
    Boolean
  ) as string[]

  for (const name of names) {
    const koMatch = name.match(
      /(\d+)\s*인\s*1\s*실|(\d+)\s*인\s*1실|(\d+)\s*인실|(\d+)\s*인\s*실/
    )
    if (koMatch) {
      const n = parseInt(koMatch[1] || koMatch[2] || koMatch[3] || koMatch[4] || '', 10)
      if (Number.isFinite(n) && n > 0) return n
    }

    if (/싱글|1인실/.test(name)) return 1
    if (/더블|트윈/.test(name)) return 2
    if (/트리플/.test(name)) return 3
    if (/쿼드/.test(name)) return 4

    const lower = name.toLowerCase()
    if (/\bsingle\b/.test(lower)) return 1
    if (/\bdouble\b/.test(lower)) return 2
    if (/\btwin\b/.test(lower)) return 2
    if (/\btriple\b/.test(lower)) return 3
    if (/\bquad\b/.test(lower)) return 4

    const inOneRoom = lower.match(
      /(\d+)\s*(?:person|people|pax).{0,40}in\s+1\s+(?:hotel\s+)?room/
    )
    if (inOneRoom) {
      const n = parseInt(inOneRoom[1], 10)
      if (Number.isFinite(n) && n > 0) return n
    }

    const enMatch = lower.match(/(\d+)\s*(?:person|people|pax)\b/)
    if (enMatch) {
      const n = parseInt(enMatch[1], 10)
      if (Number.isFinite(n) && n > 0) return n
    }
  }

  return null
}

/** 옵션에 유효한 수용 인원이 있는지 (DB capacity 또는 옵션명/키에서 추론) */
export function getOptionCapacity(option: {
  option_key?: string | null
  capacity?: number | null
  option_name?: string | null
  option_name_ko?: string | null
  option_name_en?: string | null
}): number | null {
  const parsed = parseCapacityFromOptionName(option)
  const dbCap =
    typeof option.capacity === 'number' && Number.isFinite(option.capacity) && option.capacity > 0
      ? Math.floor(option.capacity)
      : null

  // 옵션명·키에서 인실(1인1실, 2 people per room 등)이 파싱되면 항상 우선.
  // 관리자 기본값 capacity=1, 잘못 입력된 99 등으로 4인1실이 숨겨지는 것을 방지.
  if (parsed != null) return parsed
  if (dbCap != null) return dbCap
  return null
}

function getChoiceLabelLower(
  choiceName?: string | null,
  options?: Array<{
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>
): string {
  const fromOptions = (options ?? [])
    .map((option) => getQuantityOptionNameLower(option))
    .join(' ')
  return `${choiceName ?? ''} ${fromOptions}`.toLowerCase()
}

/** 객실/숙박 초이스로 보이는지 (이름 기준) */
export function looksLikeRoomChoiceGroup(
  choiceName?: string | null,
  options?: Array<{
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>
): boolean {
  const label = getChoiceLabelLower(choiceName, options)
  return (
    label.includes('객실') ||
    label.includes('숙박') ||
    label.includes('숙소') ||
    label.includes('호텔') ||
    label.includes('room') ||
    label.includes('hotel') ||
    label.includes('accommodation') ||
    label.includes('occupancy') ||
    label.includes('bedding') ||
    /\d\s*인\s*1\s*실/.test(label) ||
    label.includes('인실') ||
    label.includes('1실')
  )
}

function countOccupancyNamedOptions(
  options: Array<{
    option_key?: string | null
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>
): number {
  return options.filter((option) => parseCapacityFromOptionName(option) != null).length
}

/** 거주자/입장료/패스 인원 수량 초이스로 보이는지 */
export function looksLikePeopleFeeChoiceGroup(
  choiceName?: string | null,
  options?: Array<{
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>
): boolean {
  const label = getChoiceLabelLower(choiceName, options)
  return (
    label.includes('거주') ||
    label.includes('resident') ||
    label.includes('입장료') ||
    label.includes('fee') ||
    label.includes('패스') ||
    label.includes('pass') ||
    label.includes('national park')
  )
}

/**
 * 숙박(객실)형 capacity 패턴.
 * capacity가 2 이상이거나 옵션별 capacity가 서로 다르면 true.
 */
export function hasVariedOrMultiCapacity(
  options: Array<{
    capacity?: number | null
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>
): boolean {
  const caps = options
    .map((option) => getOptionCapacity(option))
    .filter((cap): cap is number => cap != null)
  if (caps.length === 0) return false
  return Math.max(...caps) > 1 || new Set(caps).size > 1
}

/**
 * 객실 capacity 조합 그룹 여부.
 * - 거주자/패스/입장료 그룹은 절대 객실로 보지 않음
 * - 객실 이름 힌트가 있을 때만 capacity 패턴으로 객실 처리
 */
export function isAccommodationCapacityGroup(
  options: Array<{
    option_key?: string | null
    capacity?: number | null
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>,
  choiceName?: string | null
): boolean {
  if (looksLikePeopleFeeChoiceGroup(choiceName, options)) return false
  if (!hasVariedOrMultiCapacity(options)) return false
  if (looksLikeRoomChoiceGroup(choiceName, options)) return true
  // 그룹명이 일반적이어도 옵션명이 1인1실·2인1실 패턴이면 객실로 처리
  return countOccupancyNamedOptions(options) >= 2
}

/** quantity + 객실 → capacity 필터/합산 UI */
export function usesCapacityQuantitySelection(
  choiceType: string | null | undefined,
  options: Array<{
    capacity?: number | null
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>,
  choiceName?: string | null
): boolean {
  return choiceType === 'quantity' && isAccommodationCapacityGroup(options, choiceName)
}

/** quantity + 인원/패스(객실 아님) → 옵션별 수량 UI */
export function usesPeopleQuantitySelection(
  choiceType: string | null | undefined,
  options: Array<{
    capacity?: number | null
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>,
  choiceName?: string | null
): boolean {
  return (
    choiceType === 'quantity' && !usesCapacityQuantitySelection(choiceType, options, choiceName)
  )
}

/** 모든 quantity 초이스 (객실·인원 공통) */
export function usesQuantitySelection(
  choiceType: string | null | undefined,
  options: Array<{
    capacity?: number | null
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }> = [],
  choiceName?: string | null
): boolean {
  return (
    usesCapacityQuantitySelection(choiceType, options, choiceName) ||
    usesPeopleQuantitySelection(choiceType, options, choiceName)
  )
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

/** Σ (capacity × quantity). capacity 없으면 1로 간주 — 객실용 */
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

/**
 * 인원/패스 커버 합.
 * 패스 보유·구매: 1장당 4명, 그 외(거주자/비거주자 등): 1명
 */
export function getPeopleCoverage(
  options: Array<{
    option_id: string
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>,
  quantities: Record<string, number>
): number {
  return options.reduce((sum, option) => {
    const qty = quantities[option.option_id] ?? 0
    if (qty <= 0) return sum
    if (isPassCoverQuantityOption(option)) return sum + qty * 4
    return sum + qty
  }, 0)
}

export function isPeopleCoverageSufficient(
  options: Array<{
    option_id: string
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>,
  quantities: Record<string, number>,
  partySize: number
): boolean {
  if (partySize <= 0) return false
  const hasAny = Object.values(quantities).some((qty) => qty > 0)
  if (!hasAny) return false
  return getPeopleCoverage(options, quantities) >= partySize
}

/** 해당 옵션에 추가로 넣을 수 있는 최대 수량 (객실) */
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

function getOptionPeopleContribution(
  option: {
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  },
  quantity: number
): number {
  if (quantity <= 0) return 0
  if (isPassCoverQuantityOption(option)) return quantity * 4
  return quantity
}

/** 인원/패스 옵션 최대 수량 (그룹 내 다른 옵션 선택을 반영) */
export function getMaxPeopleQuantityForOption(
  option: {
    option_id: string
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  },
  options: Array<{
    option_id: string
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>,
  quantities: Record<string, number>,
  partySize: number
): number {
  if (partySize <= 0) return 0

  const currentQty = quantities[option.option_id] ?? 0
  const coverageWithout =
    getPeopleCoverage(options, quantities) - getOptionPeopleContribution(option, currentQty)
  const remaining = partySize - coverageWithout

  if (remaining <= 0) return currentQty

  if (isPassCoverQuantityOption(option)) {
    const maxPasses = Math.max(1, Math.ceil(partySize / 4))
    const additionalPasses = Math.ceil(remaining / 4)
    return Math.min(maxPasses, currentQty + additionalPasses)
  }

  return Math.min(partySize, currentQty + remaining)
}

export function isPeopleCoverageOver(
  options: Array<{
    option_id: string
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>,
  quantities: Record<string, number>,
  partySize: number
): boolean {
  if (partySize <= 0) return false
  return getPeopleCoverage(options, quantities) > partySize
}

/** 인원 초과 시 수량을 예약 인원 이하로 줄임 */
export function clampPeopleQuantitiesForPartySize(
  options: Array<{
    option_id: string
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>,
  quantities: Record<string, number>,
  partySize: number
): Record<string, number> {
  if (partySize <= 0) return {}

  let coverage = getPeopleCoverage(options, quantities)
  if (coverage <= partySize) return quantities

  const next = { ...quantities }
  const sortedOptionIds = options
    .map((option) => option.option_id)
    .sort((a, b) => (next[b] ?? 0) - (next[a] ?? 0))

  for (const optionId of sortedOptionIds) {
    if (coverage <= partySize) break
    const option = options.find((item) => item.option_id === optionId)
    if (!option) continue

    const step = isPassCoverQuantityOption(option) ? 4 : 1
    while ((next[optionId] ?? 0) > 0 && coverage > partySize) {
      next[optionId] = (next[optionId] ?? 0) - 1
      coverage -= step
    }
  }

  const result: Record<string, number> = {}
  for (const [id, qty] of Object.entries(next)) {
    if (qty > 0) result[id] = qty
  }
  return result
}

export function isCapacityCoverageExact(
  options: CapacityOptionLike[],
  quantities: Record<string, number>,
  partySize: number
): boolean {
  if (partySize <= 0) return false
  return getCapacityCoverage(options, quantities) === partySize
}

/** 인원 변경 시 보이지 않는 옵션 수량을 제거 (객실) */
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

/** 인원에 맞는 객실 옵션 (capacity === partySize) */
export function findMatchingRoomOptionId(
  options: CapacityOptionLike[],
  partySize: number
): string | null {
  if (partySize <= 0) return null
  const visible = filterOptionsByPartySize(options, partySize)
  const exact = visible.find((option) => getOptionCapacity(option) === partySize)
  return exact?.option_id ?? null
}

/**
 * 객실 기본 수량: 인원과 같은 인실 1개.
 * 맞는 인실이 없으면 빈 맵(수동 조합).
 */
export function getDefaultRoomQuantities(
  options: CapacityOptionLike[],
  partySize: number
): Record<string, number> {
  const optionId = findMatchingRoomOptionId(options, partySize)
  if (!optionId) return {}
  return { [optionId]: 1 }
}

/**
 * 인원/패스 quantity 기본 수량: 기본(또는 거주자) 옵션에 예약 인원.
 */
export function getDefaultPeopleQuantities(
  options: Array<{
    option_id: string
    is_default?: boolean | null
    option_name?: string | null
    option_name_ko?: string | null
    option_name_en?: string | null
  }>,
  partySize: number
): { quantities: Record<string, number>; optionId: string | null } {
  if (partySize <= 0 || options.length === 0) {
    return { quantities: {}, optionId: null }
  }

  const residentsId = findResidentsOptionId(options)
  const defaultId =
    residentsId ||
    options.find((option) => option.is_default)?.option_id ||
    options[0]?.option_id ||
    null

  if (!defaultId) return { quantities: {}, optionId: null }

  const target = options.find((option) => option.option_id === defaultId)
  if (!target) return { quantities: {}, optionId: null }

  const qty = getAutoQuantityForOption(target, partySize)
  if (qty <= 0) return { quantities: {}, optionId: null }

  return { quantities: { [defaultId]: qty }, optionId: defaultId }
}

/** 현재 수량이 아직 비어 있거나, 단일 옵션만 선택된 자동 기본 상태인지 */
export function isSimpleAutoQuantityState(
  quantities: Record<string, number>,
  preferredOptionId: string | null
): boolean {
  const active = Object.entries(quantities).filter(([, qty]) => qty > 0)
  if (active.length === 0) return true
  if (active.length !== 1 || !preferredOptionId) return false
  return active[0]?.[0] === preferredOptionId
}
