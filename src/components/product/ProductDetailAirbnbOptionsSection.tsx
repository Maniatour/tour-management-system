'use client'

import { Check, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'

type ProductDetailAirbnbOptionsSectionProps = {
  groupedChoices: Record<string, ProductDetailChoiceGroup>
  selectedOptions: Record<string, string>
  onOptionChange: (choiceId: string, optionId: string) => void
  onCompareOptions: () => void
  onBookNow: () => void
  totalPrice: number
  selectedDate: string
  isEnglish: boolean
}

export default function ProductDetailAirbnbOptionsSection({
  groupedChoices,
  selectedOptions,
  onOptionChange,
  onCompareOptions,
  onBookNow,
  totalPrice,
  selectedDate,
  isEnglish,
}: ProductDetailAirbnbOptionsSectionProps) {
  const t = useTranslations('productDetail')
  const groups = Object.values(groupedChoices)

  if (groups.length === 0 || !selectedDate) {
    return null
  }

  return (
    <section className="airbnb-detail-section airbnb-detail-options airbnb-detail-options-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="airbnb-detail-section-title mb-0">{t('bookingOptionsTitle')}</h2>
        <button
          type="button"
          onClick={onCompareOptions}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a2b49] underline underline-offset-2"
        >
          <Info className="h-4 w-4" aria-hidden />
          {t('compareOptions')}
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.choice_id} className="mb-6 last:mb-0">
          <h3 className="mb-3 text-base font-semibold text-[#1a2b49]">
            {isEnglish
              ? group.choice_name || group.choice_name_ko
              : group.choice_name_ko || group.choice_name}
          </h3>
          <div className="space-y-3" role="radiogroup">
            {group.options.map((option) => {
              const selected = selectedOptions[group.choice_id] === option.option_id
              const optionLabel = isEnglish
                ? option.option_name || option.option_name_ko
                : option.option_name_ko || option.option_name
              return (
                <button
                  key={option.option_id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onOptionChange(group.choice_id, option.option_id)}
                  className={`airbnb-detail-option-card ${selected ? 'is-selected' : ''}`}
                >
                  <span className="airbnb-detail-option-radio" aria-hidden>
                    {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold text-[#1a2b49] sm:text-base">
                      {optionLabel}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-[#1a2b49] sm:text-base">
                    {option.option_price && option.option_price > 0 ? `+$${option.option_price}` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="airbnb-detail-options-summary">
        <div>
          <p className="text-2xl font-bold text-[#1a2b49]">
            ${totalPrice}
            <span className="text-sm font-normal text-[#6b7280]"> {t('perPerson')}</span>
          </p>
          <p className="mt-0.5 text-xs text-[#6b7280]">{t('freeCancellationNote')}</p>
        </div>
        <button type="button" onClick={onBookNow} className="airbnb-detail-reserve-btn sm:max-w-[220px]">
          {t('bookNow')}
        </button>
      </div>
    </section>
  )
}
