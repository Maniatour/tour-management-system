type QuantityOptionNameFields = {
  option_name?: string | null
  option_name_ko?: string | null
  option_name_en?: string | null
}

type QuantityChoiceOption = QuantityOptionNameFields & {
  option_id: string
  is_default?: boolean | null
}

export function getQuantityOptionNameLower(option: QuantityOptionNameFields): string {
  return (
    option.option_name_en ||
    option.option_name ||
    option.option_name_ko ||
    ''
  ).toLowerCase()
}

export function isPassQuantityOption(option: QuantityOptionNameFields): boolean {
  return isPassCoverQuantityOption(option)
}

/**
 * 패스 보유·구매 등 1장당 최대 4명 커버 옵션.
 * 동행자(companion)는 제외.
 */
export function isPassCoverQuantityOption(option: QuantityOptionNameFields): boolean {
  const name = getQuantityOptionNameLower(option)
  const hasPass = name.includes('pass') || name.includes('패스')
  if (!hasPass) return false
  if (name.includes('companion') || name.includes('동행')) return false
  return true
}

/** U.S. Residents 등 거주자 전용 옵션 (비거주자 제외) */
export function isResidentsOnlyOption(option: QuantityOptionNameFields): boolean {
  const name = getQuantityOptionNameLower(option)
  const hasResident = name.includes('resident') || name.includes('거주자')
  const hasNonResident =
    name.includes('non-resident') ||
    name.includes('nonresident') ||
    name.includes('비 거주자')
  return hasResident && !hasNonResident
}

export function findResidentsOptionId(options: QuantityChoiceOption[]): string | null {
  const match = options.find(isResidentsOnlyOption)
  return match?.option_id ?? null
}

/** 수량 초이스 옵션 자동 수량 (0이면 채우지 않음) */
export function getAutoQuantityForOption(
  option: QuantityChoiceOption,
  totalParticipants: number
): number {
  if (totalParticipants <= 0) return 0
  if (isPassQuantityOption(option)) {
    return Math.max(1, Math.ceil(totalParticipants / 4))
  }
  if (isResidentsOnlyOption(option) || option.is_default) {
    return totalParticipants
  }
  return 0
}

export function getTotalQuantityForGroup(
  groupId: string,
  quantities: Record<string, Record<string, number>>
): number {
  const groupQuantities = quantities[groupId]
  if (!groupQuantities) return 0
  return Object.values(groupQuantities).reduce((sum, qty) => sum + (qty > 0 ? qty : 0), 0)
}

export function getPrimaryQuantityOptionId(
  groupId: string,
  options: QuantityChoiceOption[],
  selectedOptions: Record<string, string>,
  quantities: Record<string, Record<string, number>>
): string | null {
  const groupQuantities = quantities[groupId] ?? {}
  const withQuantity = options.find((option) => (groupQuantities[option.option_id] ?? 0) > 0)
  if (withQuantity) return withQuantity.option_id

  const selectedId = selectedOptions[groupId]
  if (selectedId) return selectedId

  return findResidentsOptionId(options)
}
