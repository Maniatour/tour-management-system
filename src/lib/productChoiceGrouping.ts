import type { ProductChoice } from '@/components/product/productDetailTypes'
import type { ProductChoiceGroup } from '@/components/product/ProductDetailChoiceDescriptionModal'

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
