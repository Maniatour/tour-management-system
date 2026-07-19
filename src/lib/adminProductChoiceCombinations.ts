import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

export type AdminChoiceOption = {
  id: string
  name: string
  name_ko: string
  adult_price: number
  child_price: number
  infant_price: number
  is_default: boolean
}

export type AdminChoiceCombination = {
  id: string
  combinationName: string
  combinationNameKo: string
  totalPrice: number
  isDefault: boolean
  choices: AdminChoiceOption[]
}

export type AdminChoiceCombinationsMap = Record<string, AdminChoiceCombination[]>

function generateCombinations<T>(groups: T[][]): T[][] {
  if (groups.length === 0) return [[]]
  if (groups.length === 1) return groups[0].map((item) => [item])

  const [firstGroup, ...restGroups] = groups
  const restCombinations = generateCombinations(restGroups)
  const combinations: T[][] = []
  firstGroup.forEach((item) => {
    restCombinations.forEach((restCombo) => {
      combinations.push([item, ...restCombo])
    })
  })
  return combinations
}

/** Build choice option combinations per product for admin list net-price display. */
export async function fetchAdminChoiceCombinations(
  db: SupabaseClient<Database>,
  productIds: string[]
): Promise<AdminChoiceCombinationsMap> {
  const combinationsMap: AdminChoiceCombinationsMap = {}
  if (productIds.length === 0) return combinationsMap

  const { data, error } = await db
    .from('product_choices')
    .select(
      `
          product_id,
          choice_group,
          choice_group_ko,
          sort_order,
          options:choice_options (
            id,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            sort_order,
            is_default
          )
        `
    )
    .in('product_id', productIds)
    .order('sort_order', { ascending: true })

  if (error) throw error
  if (!data) return combinationsMap

  const productGroups: Record<
    string,
    Array<{ groupName: string; options: AdminChoiceOption[] }>
  > = {}

  for (const choice of data as Array<{
    product_id: string
    choice_group?: string | null
    choice_group_ko?: string | null
    options?: Array<{
      id: string
      option_name?: string | null
      option_name_ko?: string | null
      adult_price?: number | string | null
      child_price?: number | string | null
      infant_price?: number | string | null
      sort_order?: number | null
      is_default?: boolean | null
    }> | null
  }>) {
    const productId = choice.product_id
    if (!productGroups[productId]) productGroups[productId] = []
    if (!choice.options?.length) continue

    const sortedOptions = [...choice.options].sort((a, b) => {
      const sortA = a.sort_order || 0
      const sortB = b.sort_order || 0
      if (sortA !== sortB) return sortA - sortB
      return (a.option_name_ko || a.option_name || '').localeCompare(
        b.option_name_ko || b.option_name || '',
        'ko'
      )
    })

    productGroups[productId].push({
      groupName: choice.choice_group_ko || choice.choice_group || '',
      options: sortedOptions.map((option) => ({
        id: option.id,
        name: option.option_name || '',
        name_ko: option.option_name_ko || option.option_name || '',
        adult_price: parseFloat(String(option.adult_price ?? 0)) || 0,
        child_price: parseFloat(String(option.child_price ?? 0)) || 0,
        infant_price: parseFloat(String(option.infant_price ?? 0)) || 0,
        is_default: Boolean(option.is_default),
      })),
    })
  }

  for (const productId of Object.keys(productGroups)) {
    const groups = productGroups[productId]
    if (groups.length === 0) {
      combinationsMap[productId] = []
      continue
    }

    const optionArrays = groups.map((group) => group.options)
    const allCombinations = generateCombinations(optionArrays)
    const defaultOptions = groups.map(
      (group) => group.options.find((opt) => opt.is_default) || group.options[0]
    )

    combinationsMap[productId] = allCombinations.map((combo, index) => {
      const combinationNameKo = combo
        .map((option) => `${option.name_ko || option.name}`)
        .join(' - ')
      const combinationName = combo
        .map((option) => option.name || option.name_ko)
        .join(' - ')
      const totalPrice = combo.reduce((sum, option) => sum + option.adult_price, 0)
      const isDefault = combo.every((option, idx) => {
        const defaultOpt = defaultOptions[idx]
        return defaultOpt && option.id === defaultOpt.id
      })
      return {
        id: `combo-${productId}-${index}`,
        combinationName,
        combinationNameKo,
        totalPrice,
        isDefault,
        choices: combo,
      }
    })
  }

  return combinationsMap
}
