import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProductChoice } from '@/components/product/productDetailTypes'
import {
  calculateSelectedChoicePrice,
  filterGroupedChoicesByPartySize,
  getDefaultProductChoiceOptions,
  groupProductChoices,
} from '@/lib/productChoiceGrouping'
import {
  getCapacityCoverage,
  getDefaultPeopleQuantities,
  getDefaultRoomQuantities,
  getMaxPeopleQuantityForOption,
  getMaxQuantityForOption,
  isCapacityCoverageExact,
  isPeopleCoverageSufficient,
  isSimpleAutoQuantityState,
  usesCapacityQuantitySelection,
  usesPeopleQuantitySelection,
  usesQuantitySelection,
} from '@/lib/choiceOptionCapacity'

function groupChoiceLabel(group: {
  choice_name?: string | null
  choice_name_ko?: string | null
  choice_name_en?: string | null
}): string {
  return group.choice_name_ko || group.choice_name || group.choice_name_en || ''
}

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
  const prevPartySizeRef = useRef<number | null>(null)

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

  // 인원 변경/초기: 수량 초이스 기본값 자동 설정
  useEffect(() => {
    if (partySize <= 0) return

    const partyChanged =
      prevPartySizeRef.current != null && prevPartySizeRef.current !== partySize
    prevPartySizeRef.current = partySize

    setSelectedChoiceQuantities((prev) => {
      let changed = false
      const next: Record<string, Record<string, number>> = { ...prev }

      for (const group of Object.values(groupedChoicesAll)) {
        const label = groupChoiceLabel(group)
        const groupId = group.choice_id
        const current = prev[groupId] ?? {}
        const hasAnyQty = Object.values(current).some((qty) => qty > 0)

        if (usesCapacityQuantitySelection(group.choice_type, group.options, label)) {
          // 객실: 비어 있거나 인원이 바뀌면 인원에 맞는 인실 1개 자동 선택
          if (hasAnyQty && !partyChanged) continue

          const roomDefaults = getDefaultRoomQuantities(group.options, partySize)
          const same =
            Object.keys(roomDefaults).length ===
              Object.keys(current).filter((k) => (current[k] ?? 0) > 0).length &&
            Object.entries(roomDefaults).every(([id, qty]) => current[id] === qty)

          if (!same) {
            next[groupId] = roomDefaults
            changed = true
          }
          continue
        }

        if (usesPeopleQuantitySelection(group.choice_type, group.options, label)) {
          const { quantities: peopleDefaults, optionId } = getDefaultPeopleQuantities(
            group.options,
            partySize
          )
          // 인원 초이스: 비어 있거나, 기본 옵션만 선택된 상태에서 인원 변경 시 동기화
          const shouldApply =
            !hasAnyQty ||
            (partyChanged && isSimpleAutoQuantityState(current, optionId))
          if (!shouldApply) continue

          const same =
            optionId != null &&
            (current[optionId] ?? 0) === (peopleDefaults[optionId] ?? 0) &&
            Object.entries(current).every(([id, qty]) => qty <= 0 || id === optionId)

          if (!same) {
            next[groupId] = peopleDefaults
            changed = true
          }
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
        const label = groupChoiceLabel(group)
        if (usesQuantitySelection(group.choice_type, group.options, label)) {
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
      const label = groupChoiceLabel(group)
      const quantities = selectedChoiceQuantities[group.choice_id] ?? {}

      if (usesCapacityQuantitySelection(group.choice_type, group.options, label)) {
        if (group.options.length === 0) return false
        if (!isCapacityCoverageExact(group.options, quantities, partySize)) return false
        continue
      }

      if (usesPeopleQuantitySelection(group.choice_type, group.options, label)) {
        if (!isPeopleCoverageSufficient(group.options, quantities, partySize)) return false
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

    const label = groupChoiceLabel(group)
    const safeQty = Math.max(0, quantity)
    const currentMap = selectedChoiceQuantities[choiceId] ?? {}
    const option = group.options.find((o) => o.option_id === optionId)

    let maxQty = safeQty
    if (usesCapacityQuantitySelection(group.choice_type, group.options, label)) {
      maxQty = getMaxQuantityForOption(
        { option_id: optionId, capacity: option?.capacity ?? null },
        group.options,
        currentMap,
        partySize
      )
    } else if (usesPeopleQuantitySelection(group.choice_type, group.options, label) && option) {
      maxQty = getMaxPeopleQuantityForOption(option, partySize)
    }

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
