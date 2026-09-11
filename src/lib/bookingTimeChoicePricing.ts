import { matchesUsResidentClassificationGroup, UNDECIDED_OPTION_ID } from '@/utils/usResidentChoiceSync'

export function isHomepagePricingChannel(channelId?: string | null): boolean {
  const id = String(channelId || '').trim().toLowerCase()
  return id === 'm00001' || id === 'homepage'
}

/**
 * 모든 채널(홈페이지 포함): 예약 때 확정된 초이스만 가격 카탈로그에 넣는다.
 * 미국 거주자 구분·기타 입장료는 조합 키에 넣지 않는다.
 */
export function usesBookingTimeChoiceCatalog(_channelId?: string | null): boolean {
  return true
}

export function isDeferredAtBookingChoiceGroup(
  groupKo?: string | null,
  groupEn?: string | null
): boolean {
  return matchesUsResidentClassificationGroup(groupKo || '', groupEn || '')
}

export function filterBookingTimeChoiceGroups<
  T extends {
    choice_group?: string | null
    choice_group_ko?: string | null
    name?: string | null | undefined
    name_ko?: string | null | undefined
  },
>(groups: T[]): T[] {
  return groups.filter(
    (group) =>
      !isDeferredAtBookingChoiceGroup(
        group.choice_group_ko || group.name_ko,
        group.choice_group || group.name
      )
  )
}

export function isUndecidedOptionId(optionId?: string | null): boolean {
  const id = String(optionId || '').trim()
  return !id || id === UNDECIDED_OPTION_ID || id === 'undecided'
}

/**
 * 가격 카탈로그 조회용: 미정·거주자 구분·기타 입장료 행을 뺀다.
 */
export function bookingTimeSelectedChoices<
  T extends {
    option_id?: string | null
    option_key?: string | null
    choice_id?: string | null
    id?: string | null
  },
>(
  selected: T[] | null | undefined,
  productChoices?: Array<{
    id: string
    choice_group?: string | null
    choice_group_ko?: string | null
  }> | null
): T[] {
  if (!selected?.length) return []
  return selected.filter((choice) => {
    if (isUndecidedOptionId(choice.option_id) || isUndecidedOptionId(choice.option_key)) {
      return false
    }
    if (!productChoices?.length) return true
    const choiceId = String(choice.choice_id || choice.id || '')
    const productChoice = productChoices.find((row) => row.id === choiceId)
    if (!productChoice) return true
    return !isDeferredAtBookingChoiceGroup(
      productChoice.choice_group_ko,
      productChoice.choice_group
    )
  })
}

export function splitChoicePricingKey(key: string): string[] {
  return String(key || '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
}

function tokenSet(parts: string[]): Set<string> {
  return new Set(parts)
}

function setEq(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

function isSubset(inner: Set<string>, outer: Set<string>): boolean {
  if (inner.size === 0) return false
  for (const value of inner) {
    if (!outer.has(value)) return false
  }
  return true
}

function dropUndecidedTokens(parts: string[]): string[] {
  return parts.filter((part) => !isUndecidedOptionId(part))
}

type PricingEntry = Record<string, unknown>

function entryOta(entry: PricingEntry): number {
  const value = Number(entry.ota_sale_price ?? entry.adult_price ?? entry.adult ?? 0)
  return Number.isFinite(value) ? value : 0
}

function entryNotIncluded(entry: PricingEntry): number | undefined {
  const raw = entry.not_included_price
  if (raw === undefined || raw === null) return undefined
  const value = Number(raw)
  if (!Number.isFinite(value)) return undefined
  return value
}

export type BookingTimeMatch = {
  data: PricingEntry
  matchedKey: string
}

/**
 * 예약 시점 초이스만으로 choices_pricing을 찾는다.
 * 짧은 신키(로어)와 거주자가 섞인 구키를 모두 허용한다.
 */
export function findBookingTimeChoicePricing(
  requestedKey: string,
  choicesPricing: Record<string, unknown> | null | undefined,
  extraRequestedParts?: string[]
): BookingTimeMatch | null {
  if (!choicesPricing || typeof choicesPricing !== 'object') return null

  const requested = dropUndecidedTokens([
    ...splitChoicePricingKey(requestedKey),
    ...(extraRequestedParts || []),
  ])
  if (requested.length === 0) return null
  const requestedTokens = tokenSet(requested)

  type Candidate = { key: string; parts: string[]; entry: PricingEntry; ota: number }
  const candidates: Candidate[] = []

  for (const [key, raw] of Object.entries(choicesPricing)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    if (key === 'no_choice' || key === 'no-choice') continue
    const parts = dropUndecidedTokens(splitChoicePricingKey(key))
    if (parts.length === 0) continue
    const stored = tokenSet(parts)
    const equal = setEq(requestedTokens, stored)
    const storedInRequested = isSubset(stored, requestedTokens)
    const requestedInStored = isSubset(requestedTokens, stored)
    if (!equal && !storedInRequested && !requestedInStored) continue
    const entry = raw as PricingEntry
    candidates.push({ key, parts, entry, ota: entryOta(entry) })
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    const aExact = setEq(tokenSet(a.parts), requestedTokens) ? 0 : 1
    const bExact = setEq(tokenSet(b.parts), requestedTokens) ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    if (a.parts.length !== b.parts.length) return a.parts.length - b.parts.length
    const aOta = a.ota > 0 ? a.ota : Number.POSITIVE_INFINITY
    const bOta = b.ota > 0 ? b.ota : Number.POSITIVE_INFINITY
    if (aOta !== bOta) return aOta - bOta
    const aNi = entryNotIncluded(a.entry) ?? 0
    const bNi = entryNotIncluded(b.entry) ?? 0
    return aNi - bNi
  })

  const best = candidates[0]
  return { data: best.entry, matchedKey: best.key }
}

export function toOtaAndNotIncluded(
  match: BookingTimeMatch | null
): { ota_sale_price: number; not_included_price?: number } | undefined {
  if (!match) return undefined
  const ota = entryOta(match.data)
  if (!(ota > 0)) return undefined
  const notIncluded = entryNotIncluded(match.data)
  return {
    ota_sale_price: ota,
    ...(notIncluded !== undefined && notIncluded > 0
      ? { not_included_price: notIncluded }
      : {}),
  }
}

export function combinationKeyFromSelectedChoices(
  selected: Array<{
    choice_id?: string | null
    option_id?: string | null
    option_key?: string | null
    id?: string | null
  }>
): string {
  return selected
    .map((choice) => {
      const choiceId = String(choice.choice_id || choice.id || '').trim()
      const optionId = String(choice.option_id || choice.option_key || '').trim()
      if (choiceId && optionId) return `${choiceId}+${optionId}`
      return optionId || choiceId
    })
    .filter(Boolean)
    .sort()
    .join('+')
}

type CatalogCombination = {
  id?: string
  combination_key?: string
  combination_details?: Array<{
    optionId?: string
    optionKey?: string
    groupId?: string
  }>
}

/**
 * 저장용: 거주자·입장료가 섞인 구키를 버리고, 현재 카탈로그 조합(로어/엑스 등) 키만 남긴다.
 */
export function restrictChoicesPricingToCatalogCombinations(
  choicesPricing: Record<string, Record<string, unknown>>,
  combinations: CatalogCombination[]
): Record<string, Record<string, unknown>> {
  if (!choicesPricing || typeof choicesPricing !== 'object') return {}

  const noChoice =
    choicesPricing.no_choice || choicesPricing['no-choice']
  if (!combinations.length) {
    return { ...choicesPricing }
  }

  const next: Record<string, Record<string, unknown>> = {}
  if (noChoice && typeof noChoice === 'object') {
    next.no_choice = { ...noChoice }
  }

  for (const combo of combinations) {
    const comboId = String(combo.id || combo.combination_key || '').trim()
    if (!comboId) continue
    const direct = choicesPricing[comboId]
    const byKey =
      combo.combination_key && combo.combination_key !== comboId
        ? choicesPricing[combo.combination_key]
        : undefined
    const matched = findBookingTimeChoicePricingFromCombination(combo, choicesPricing)
    const data =
      (direct && typeof direct === 'object' ? direct : undefined) ||
      (byKey && typeof byKey === 'object' ? byKey : undefined) ||
      (matched?.data as Record<string, unknown> | undefined)
    if (data && Object.keys(data).length > 0) {
      next[comboId] = { ...data }
    }
  }

  return next
}

export function findBookingTimeChoicePricingFromCombination(
  combination: {
    id?: string
    combination_key?: string
    combination_details?: Array<{
      optionId?: string
      optionKey?: string
      groupId?: string
    }>
  },
  choicesPricing: Record<string, unknown> | null | undefined
): BookingTimeMatch | null {
  const details = combination.combination_details || []
  const optionKeys = details.map((detail) => detail.optionKey).filter(Boolean).join('+')
  const optionIds = details.map((detail) => detail.optionId).filter(Boolean).join('+')
  const keys = [combination.id, combination.combination_key, optionKeys, optionIds].filter(
    (key): key is string => Boolean(key)
  )

  let best: BookingTimeMatch | null = null
  for (const key of keys) {
    const match = findBookingTimeChoicePricing(key, choicesPricing)
    if (!match) continue
    if (!best) {
      best = match
      continue
    }
    if (splitChoicePricingKey(match.matchedKey).length < splitChoicePricingKey(best.matchedKey).length) {
      best = match
    }
  }
  return best
}
