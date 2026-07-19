import type { ProductChoice } from '@/components/product/productDetailTypes'
import type { ProductChoiceGroup } from '@/components/product/ProductDetailChoiceDescriptionModal'
import {
  filterOptionsByPartySize,
  usesCapacityQuantitySelection,
  usesQuantitySelection,
} from '@/lib/choiceOptionCapacity'
import {
  getChoiceGroupLocalizedText,
  getChoiceOptionLocalizedText,
} from '@/lib/productChoiceLocales'

/** 고객 상세 페이지 상품 초이스 표시 방식 */
export type ChoicesDisplayMode = 'list' | 'card'

export function normalizeChoicesDisplayMode(value: unknown): ChoicesDisplayMode {
  return value === 'card' ? 'card' : 'list'
}

function compareChoiceSortOrder(a: ProductChoice, b: ProductChoice): number {
  const groupDiff = (a.choice_sort_order ?? 0) - (b.choice_sort_order ?? 0)
  if (groupDiff !== 0) return groupDiff
  return (a.option_sort_order ?? 0) - (b.option_sort_order ?? 0)
}

export function groupProductChoices(
  productChoices: ProductChoice[],
  localeOrIsEnglish: string | boolean
): Record<string, ProductChoiceGroup> {
  const locale =
    typeof localeOrIsEnglish === 'boolean'
      ? localeOrIsEnglish
        ? 'en'
        : 'ko'
      : localeOrIsEnglish
  const sortedChoices = [...productChoices].sort(compareChoiceSortOrder)

  const groups = sortedChoices.reduce((acc, choice) => {
    const groupKey = choice.choice_id
    if (!acc[groupKey]) {
      const groupSource = {
        choice_name: choice.choice_name,
        choice_name_ko: choice.choice_name_ko,
        choice_name_en: choice.choice_name_en,
        choice_description: choice.choice_description,
        choice_description_ko: choice.choice_description_ko,
        choice_description_en: choice.choice_description_en,
        content_i18n: choice.choice_content_i18n ?? null,
      }
      const displayName = getChoiceGroupLocalizedText(groupSource, 'name', locale)

      acc[groupKey] = {
        choice_id: choice.choice_id,
        choice_name: displayName,
        choice_name_ko: choice.choice_name_ko,
        choice_name_en: choice.choice_name_en || null,
        choice_type: choice.choice_type,
        choice_description: getChoiceGroupLocalizedText(groupSource, 'description', locale),
        choice_description_ko: choice.choice_description_ko || null,
        choice_description_en: choice.choice_description_en || null,
        options: [],
      }
    }

    const optionSource = {
      option_name: choice.option_name,
      option_name_ko: choice.option_name_ko,
      option_description: choice.option_description,
      option_description_ko: choice.option_description_ko,
      content_i18n: choice.option_content_i18n ?? null,
    }
    const optionLabel = getChoiceOptionLocalizedText(optionSource, 'name', locale)
    acc[groupKey].options.push({
      option_id: choice.option_id,
      option_name: optionLabel || choice.option_name,
      option_name_ko: choice.option_name_ko,
      option_price: choice.option_price,
      capacity: choice.capacity ?? null,
      is_default: choice.is_default,
      option_image_url: choice.option_image_url ?? null,
      option_thumbnail_url: choice.option_thumbnail_url ?? null,
      option_description:
        getChoiceOptionLocalizedText(optionSource, 'description', locale) ||
        choice.option_description ||
        null,
      option_description_ko: choice.option_description_ko ?? null,
    })

    return acc
  }, {} as Record<string, ProductChoiceGroup>)

  // Object.values 삽입 순서가 그룹 순서가 되도록, 정렬된 순서로 재구성
  const ordered: Record<string, ProductChoiceGroup> = {}
  for (const choice of sortedChoices) {
    const group = groups[choice.choice_id]
    if (group && !ordered[choice.choice_id]) {
      ordered[choice.choice_id] = group
    }
  }
  return ordered
}

/**
 * 예약 인원에 맞게 옵션을 필터한 그룹.
 * quantity + 객실 capacity 그룹만 capacity > 인원 옵션을 숨기고,
 * 단일 선택(single) 초이스는 capacity 유무와 관계없이 전부 표시한다.
 */
export function filterGroupedChoicesByPartySize(
  groupedChoices: Record<string, ProductChoiceGroup>,
  partySize: number
): Record<string, ProductChoiceGroup> {
  const filtered: Record<string, ProductChoiceGroup> = {}
  for (const [choiceId, group] of Object.entries(groupedChoices)) {
    const shouldFilterByCapacity = usesCapacityQuantitySelection(
      group.choice_type,
      group.options,
      group.choice_name_ko || group.choice_name || group.choice_name_en
    )
    filtered[choiceId] = {
      ...group,
      options: shouldFilterByCapacity
        ? filterOptionsByPartySize(group.options, partySize)
        : group.options,
    }
  }
  return filtered
}

export function getDefaultProductChoiceOptions(
  productChoices: ProductChoice[]
): Record<string, string> {
  const defaultOptions: Record<string, string> = {}
  const sortedChoices = [...productChoices].sort(compareChoiceSortOrder)

  const tempGroups = sortedChoices.reduce(
    (groups, choice) => {
      const groupKey = choice.choice_id
      if (!groups[groupKey]) {
        groups[groupKey] = {
          choice_id: choice.choice_id,
          choice_type: choice.choice_type,
          options: [] as Array<{
            option_id: string
            is_default: boolean | null
            capacity?: number | null
          }>,
        }
      }
      groups[groupKey].options.push({
        option_id: choice.option_id,
        is_default: choice.is_default,
        capacity: choice.capacity ?? null,
      })
      return groups
    },
    {} as Record<
      string,
      {
        choice_id: string
        choice_type: string
        options: Array<{
          option_id: string
          is_default: boolean | null
          capacity?: number | null
        }>
      }
    >
  )

  Object.values(tempGroups).forEach((group) => {
    // quantity(객실·인원)는 사용자가 수량을 고를 때까지 기본 단일 선택 없음
    if (usesQuantitySelection(group.choice_type, group.options)) {
      return
    }
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
  basePrice: number,
  selectedChoiceQuantities: Record<string, Record<string, number>> = {}
): number {
  let totalPrice = basePrice

  Object.values(groupedChoices).forEach((group) => {
    const choiceLabel = group.choice_name_ko || group.choice_name || group.choice_name_en
    if (usesQuantitySelection(group.choice_type, group.options, choiceLabel)) {
      const quantities = selectedChoiceQuantities[group.choice_id] ?? {}
      group.options.forEach((option) => {
        const qty = quantities[option.option_id] ?? 0
        if (qty > 0 && option.option_price) {
          totalPrice += option.option_price * qty
        }
      })
      return
    }

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
