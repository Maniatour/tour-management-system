'use client'

import { Minus, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  getCapacityCoverage,
  getMaxPeopleQuantityForOption,
  getMaxQuantityForOption,
  getOptionCapacity,
  getPeopleCoverage,
  usesCapacityQuantitySelection,
  usesPeopleQuantitySelection,
} from '@/lib/choiceOptionCapacity'
import { isPassCoverQuantityOption } from '@/lib/bookingFlowQuantityChoices'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'

type ProductDetailQuantityChoiceGroupProps = {
  group: ProductDetailChoiceGroup
  quantities: Record<string, number>
  partySize: number
  isEnglish: boolean
  onQuantityChange: (optionId: string, quantity: number) => void
  compact?: boolean
}

export default function ProductDetailQuantityChoiceGroup({
  group,
  quantities,
  partySize,
  isEnglish,
  onQuantityChange,
}: ProductDetailQuantityChoiceGroupProps) {
  const t = useTranslations('productDetail')
  const choiceLabel = group.choice_name_ko || group.choice_name || group.choice_name_en
  const isCapacityGroup = usesCapacityQuantitySelection(
    group.choice_type,
    group.options,
    choiceLabel
  )
  const isPeopleGroup = usesPeopleQuantitySelection(
    group.choice_type,
    group.options,
    choiceLabel
  )
  const coverage = isCapacityGroup
    ? getCapacityCoverage(group.options, quantities)
    : isPeopleGroup
      ? getPeopleCoverage(group.options, quantities)
      : 0
  const remaining = Math.max(0, partySize - coverage)
  const matched = isCapacityGroup ? coverage === partySize : coverage >= partySize && coverage > 0

  return (
    <div className="space-y-3">
      {(isCapacityGroup || isPeopleGroup) && partySize > 0 ? (
        <p
          className={`text-xs sm:text-sm ${
            matched ? 'font-medium text-emerald-700' : 'text-[#6b7280]'
          }`}
        >
          {isCapacityGroup
            ? t('capacityCoverageStatus', { covered: coverage, total: partySize })
            : t('peopleCoverageStatus', { covered: coverage, total: partySize })}
          {coverage < partySize
            ? ` · ${t('capacityRemaining', { count: remaining })}`
            : coverage > partySize && isCapacityGroup
              ? ` · ${t('capacityOver', { count: coverage - partySize })}`
              : matched
                ? ` · ${isCapacityGroup ? t('capacityMatched') : t('peopleCoverageMatched')}`
                : ''}
        </p>
      ) : null}

      <div className="divide-y divide-[#e5e7eb] overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
        {group.options.map((option) => {
          const currentQuantity = quantities[option.option_id] ?? 0
          const maxQty = isCapacityGroup
            ? getMaxQuantityForOption(option, group.options, quantities, partySize)
            : isPeopleGroup
              ? getMaxPeopleQuantityForOption(option, partySize)
              : 99
          const optionLabel = isEnglish
            ? option.option_name || option.option_name_ko
            : option.option_name_ko || option.option_name
          const capacity = getOptionCapacity(option)
          const isPass = isPassCoverQuantityOption(option)
          const isActive = currentQuantity > 0

          return (
            <div
              key={option.option_id}
              className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${
                isActive ? 'bg-[#f8fafc]' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1a2b49] sm:text-base">{optionLabel}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6b7280]">
                  {isCapacityGroup && capacity != null ? (
                    <span>{t('capacityPerRoom', { count: capacity })}</span>
                  ) : null}
                  {isPeopleGroup && isPass ? (
                    <span>{t('passCoversPeople', { count: 4 })}</span>
                  ) : null}
                  {option.option_price && option.option_price > 0 ? (
                    <span>+${option.option_price}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => onQuantityChange(option.option_id, Math.max(0, currentQuantity - 1))}
                  disabled={currentQuantity <= 0}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d1d5db] hover:bg-[#f3f4f6] disabled:opacity-40"
                  aria-label={`${optionLabel} decrease`}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[2rem] text-center text-sm font-semibold text-[#1a2b49]">
                  {currentQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(option.option_id, currentQuantity + 1)}
                  disabled={currentQuantity >= maxQty}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d1d5db] hover:bg-[#f3f4f6] disabled:opacity-40"
                  aria-label={`${optionLabel} increase`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
