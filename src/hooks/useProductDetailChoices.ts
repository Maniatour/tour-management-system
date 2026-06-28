import { useEffect, useMemo, useState } from 'react'
import type { ProductChoice } from '@/components/product/productDetailTypes'
import {
  calculateSelectedChoicePrice,
  getDefaultProductChoiceOptions,
  groupProductChoices,
} from '@/lib/productChoiceGrouping'

export function useProductDetailChoices(
  productChoices: ProductChoice[],
  basePrice: number | null | undefined,
  isEnglish: boolean
) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  const groupedChoices = useMemo(
    () => groupProductChoices(productChoices, isEnglish),
    [productChoices, isEnglish]
  )

  useEffect(() => {
    if (productChoices.length === 0) return
    setSelectedOptions(getDefaultProductChoiceOptions(productChoices))
  }, [productChoices])

  const totalPrice = useMemo(
    () =>
      calculateSelectedChoicePrice(
        groupedChoices,
        selectedOptions,
        basePrice ?? 0
      ),
    [groupedChoices, selectedOptions, basePrice]
  )

  const handleOptionChange = (choiceId: string, optionId: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [choiceId]: optionId,
    }))
  }

  return {
    selectedOptions,
    groupedChoices,
    totalPrice,
    handleOptionChange,
  }
}
