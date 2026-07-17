import type { ProductChoice } from '@/components/product/productDetailTypes'
import type { ProductChoiceGroup } from '@/components/product/ProductDetailChoiceDescriptionModal'

/** 고객 상세 페이지 상품 초이스 표시 방식 */
export type ChoicesDisplayMode = 'list' | 'card'

export function normalizeChoicesDisplayMode(value: unknown): ChoicesDisplayMode {
  return value === 'card' ? 'card' : 'list'
}

export function groupProductChoices(
  productChoices: ProductChoice[],
  isEnglish: boolean
): Record<string, ProductChoiceGroup> {
  return productChoices.reduce((groups, choice) => {
    const groupKey = choice.choice_id
    if (!groups[groupKey]) {
      const displayName = isEnglish
        ? (choice.choice_name_en || choice.choice_name_ko || choice.choice_name)
        : (choice.choice_name_ko || choice.choice_name_en || choice.choice_name)

      groups[groupKey] = {
        choice_id: choice.choice_id,
        choice_name: displayName,
        choice_name_ko: choice.choice_name_ko,
        choice_name_en: choice.choice_name_en || null,
        choice_type: choice.choice_type,
        choice_description: choice.choice_description,
        choice_description_ko: choice.choice_description_ko || null,
        choice_description_en: choice.choice_description_en || null,
        options: [],
      }
    }

    groups[groupKey].options.push({
      option_id: choice.option_id,
      option_name: choice.option_name,
      option_name_ko: choice.option_name_ko,
      option_price: choice.option_price,
      is_default: choice.is_default,
      option_image_url: choice.option_image_url ?? null,
      option_thumbnail_url: choice.option_thumbnail_url ?? null,
      option_description: choice.option_description ?? null,
      option_description_ko: choice.option_description_ko ?? null,
    })

    return groups
  }, {} as Record<string, ProductChoiceGroup>)
}

export function getDefaultProductChoiceOptions(
  productChoices: ProductChoice[]
): Record<string, string> {
  const defaultOptions: Record<string, string> = {}

  const tempGroups = productChoices.reduce(
    (groups, choice) => {
      const groupKey = choice.choice_id
      if (!groups[groupKey]) {
        groups[groupKey] = { choice_id: choice.choice_id, options: [] }
      }
      groups[groupKey].options.push({
        option_id: choice.option_id,
        is_default: choice.is_default,
      })
      return groups
    },
    {} as Record<string, { choice_id: string; options: Array<{ option_id: string; is_default: boolean | null }> }>
  )

  Object.values(tempGroups).forEach((group) => {
    const defaultOption = group.options.find((option) => option.is_default)
    if (defaultOption) {
      defaultOptions[group.choice_id] = defaultOption.option_id
    } else if (group.options.length > 0) {
      defaultOptions[group.choice_id] = group.options[0].option_id
    }
  })

  return defaultOptions
}

export function calculateSelectedChoicePrice(
  groupedChoices: Record<string, ProductChoiceGroup>,
  selectedOptions: Record<string, string>,
  basePrice: number
): number {
  let totalPrice = basePrice

  Object.values(groupedChoices).forEach((group) => {
    const selectedOptionId = selectedOptions[group.choice_id]
    if (selectedOptionId) {
      const option = group.options.find((opt) => opt.option_id === selectedOptionId)
      if (option?.option_price) {
        totalPrice += option.option_price
      }
    }
  })

  return totalPrice
}

/**
 * 초이스 그룹별 최저 옵션가를 합산한 시작가.
 * 그룹이 하나면 해당 그룹의 최저 옵션가(예: $80)와 동일하다.
 */
export function getLowestChoiceAddonTotal(
  productChoices: Array<{ choice_id: string; option_price: number | null | undefined }>
): number | null {
  if (productChoices.length === 0) return null

  const minByGroup = new Map<string, number>()

  for (const choice of productChoices) {
    const price = choice.option_price
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) continue
    const current = minByGroup.get(choice.choice_id)
    if (current == null || price < current) {
      minByGroup.set(choice.choice_id, price)
    }
  }

  if (minByGroup.size === 0) return null

  let total = 0
  for (const minPrice of minByGroup.values()) {
    total += minPrice
  }
  return total
}
