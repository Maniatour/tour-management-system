import { useEffect, useMemo, useState } from 'react'
import type { ProductChoice } from '@/components/product/productDetailTypes'
import {
  calculateSelectedChoicePrice,
  filterGroupedChoicesByPartySize,
  getDefaultProductChoiceOptions,
  groupProductChoices,
} from '@/lib/productChoiceGrouping'
import {
  getCapacityCoverage,
  getMaxQuantityForOption,
  isCapacityCoverageExact,
  pruneQuantitiesForPartySize,
  usesCapacityQuantitySelection,
} from '@/lib/choiceOptionCapacity'

export function useProductDetailChoices(
  productChoices: ProductChoice[],
  basePrice: number | null | undefined,
  isEnglish: boolean,
  partySize = 0
) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [selectedChoiceQuantities, setSelectedChoiceQuantities] = useState<
    Record<string, Record<string, number>>
  >({})

  const groupedChoicesAll = useMemo(
    () => groupProductChoices(productChoices, isEnglish),
    [productChoices, isEnglish]
  )

  const groupedChoices = useMemo(
    () => filterGroupedChoicesByPartySize(groupedChoicesAll, partySize),
    [groupedChoicesAll, partySize]
  )

  useEffect(() => {
    if (productChoices.length === 0) return
    setSelectedOptions(getDefaultProductChoiceOptions(productChoices))
  }, [productChoices])

  // 인원 변경 시 capacity 초과 옵션 수량 정리 + selectedOptions 동기화
  useEffect(() => {
    if (partySize <= 0) return

    setSelectedChoiceQuantities((prev) => {
      let changed = false
      const next: Record<string, Record<string, number>> = { ...prev }

      for (const group of Object.values(groupedChoicesAll)) {
        if (!usesCapacityQuantitySelection(group.choice_type, group.options)) continue
        const pruned = pruneQuantitiesForPartySize(
          group.options,
          prev[group.choice_id] ?? {},
          partySize
        )
        const prevMap = prev[group.choice_id] ?? {}
        const prevKeys = Object.keys(prevMap).filter((k) => (prevMap[k] ?? 0) > 0)
        const nextKeys = Object.keys(pruned)
        const same =
          prevKeys.length === nextKeys.length &&
          nextKeys.every((k) => prevMap[k] === pruned[k])
        if (!same) {
          next[group.choice_id] = pruned
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [partySize, groupedChoicesAll])

  useEffect(() => {
    setSelectedOptions((prev) => {
      let changed = false
      const next = { ...prev }

      for (const group of Object.values(groupedChoices)) {
        if (usesCapacityQuantitySelection(group.choice_type, group.options)) {
          const quantities = selectedChoiceQuantities[group.choice_id] ?? {}
          const primary = group.options.find((opt) => (quantities[opt.option_id] ?? 0) > 0)
          if (primary) {
            if (next[group.choice_id] !== primary.option_id) {
              next[group.choice_id] = primary.option_id
              changed = true
            }
          } else if (next[group.choice_id]) {
            delete next[group.choice_id]
            changed = true
          }
          continue
        }

        const selectedId = next[group.choice_id]
        if (selectedId && !group.options.some((opt) => opt.option_id === selectedId)) {
          next[group.choice_id] = group.options[0]?.option_id ?? ''
          if (!next[group.choice_id]) delete next[group.choice_id]
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [groupedChoices, selectedChoiceQuantities])

  const totalPrice = useMemo(
    () =>
      calculateSelectedChoicePrice(
        groupedChoices,
        selectedOptions,
        basePrice ?? 0,
        selectedChoiceQuantities
      ),
    [groupedChoices, selectedOptions, basePrice, selectedChoiceQuantities]
  )

  const capacitySelectionComplete = useMemo(() => {
    for (const group of Object.values(groupedChoices)) {
      if (!usesCapacityQuantitySelection(group.choice_type, group.options)) continue
      if (group.options.length === 0) return false
      if (
        !isCapacityCoverageExact(
          group.options,
          selectedChoiceQuantities[group.choice_id] ?? {},
          partySize
        )
      ) {
        return false
      }
    }
    return true
  }, [groupedChoices, selectedChoiceQuantities, partySize])

  const handleOptionChange = (choiceId: string, optionId: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [choiceId]: optionId,
    }))
  }

  const handleQuantityChange = (choiceId: string, optionId: string, quantity: number) => {
    const group = groupedChoicesAll[choiceId]
    if (!group) return

    const safeQty = Math.max(0, quantity)
    const currentMap = selectedChoiceQuantities[choiceId] ?? {}
    const option = group.options.find((o) => o.option_id === optionId)
    const maxQty = usesCapacityQuantitySelection(group.choice_type, group.options)
      ? getMaxQuantityForOption(
          { option_id: optionId, capacity: option?.capacity ?? null },
          group.options,
          currentMap,
          partySize
        )
      : safeQty

    const nextQty = Math.min(safeQty, maxQty)

    setSelectedChoiceQuantities((prev) => ({
      ...prev,
      [choiceId]: {
        ...(prev[choiceId] || {}),
        [optionId]: nextQty,
      },
    }))

    if (nextQty > 0) {
      setSelectedOptions((prev) => ({ ...prev, [choiceId]: optionId }))
    } else {
      setSelectedOptions((prev) => {
        const next = { ...prev }
        if (next[choiceId] === optionId) {
          const remaining = { ...(selectedChoiceQuantities[choiceId] || {}), [optionId]: 0 }
          const other = group.options.find(
            (opt) => opt.option_id !== optionId && (remaining[opt.option_id] ?? 0) > 0
          )
          if (other) next[choiceId] = other.option_id
          else delete next[choiceId]
        }
        return next
      })
    }
  }

  const getGroupCapacityCoverage = (choiceId: string) => {
    const group = groupedChoices[choiceId]
    if (!group) return 0
    return getCapacityCoverage(group.options, selectedChoiceQuantities[choiceId] ?? {})
  }

  return {
    selectedOptions,
    selectedChoiceQuantities,
    groupedChoices,
    totalPrice,
    capacitySelectionComplete,
    handleOptionChange,
    handleQuantityChange,
    getGroupCapacityCoverage,
  }
}
