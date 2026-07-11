'use client'

import { useTranslations } from 'next-intl'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'

type ProductDetailAirbnbBookingSummaryProps = {
  basePrice: number | null
  totalPrice: number
  groupedChoices: Record<string, ProductDetailChoiceGroup>
  selectedOptions: Record<string, string>
  isEnglish: boolean
  onBookNow: () => void
}

export default function ProductDetailAirbnbBookingSummary({
  basePrice,
  totalPrice,
  groupedChoices,
  selectedOptions,
  isEnglish,
  onBookNow,
}: ProductDetailAirbnbBookingSummaryProps) {
  const t = useTranslations('productDetail')
  const groups = Object.values(groupedChoices)

  const selectedLines = groups
    .map((group) => {
      const selectedOptionId = selectedOptions[group.choice_id]
      if (!selectedOptionId) return null

      const option = group.options.find((item) => item.option_id === selectedOptionId)
      if (!option) return null

      const optionLabel = isEnglish
        ? option.option_name || option.option_name_ko
        : option.option_name_ko || option.option_name

      return {
        id: group.choice_id,
        label: optionLabel,
        price: option.option_price,
      }
    })
    .filter(Boolean) as Array<{ id: string; label: string; price: number | null }>

  return (
    <div className="airbnb-detail-booking-summary">
      <div className="airbnb-detail-booking-summary-lines">
        <div className="airbnb-detail-booking-summary-row">
          <span className="airbnb-detail-booking-summary-label">{t('basePrice')}</span>
          <span className="airbnb-detail-booking-summary-value">${basePrice ?? 0}</span>
        </div>

        {selectedLines.map((line) => (
          <div key={line.id} className="airbnb-detail-booking-summary-row">
            <span className="airbnb-detail-booking-summary-label">{line.label}</span>
            <span className="airbnb-detail-booking-summary-value">
              {line.price && line.price > 0 ? `+$${line.price}` : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="airbnb-detail-booking-summary-total">
        <p className="airbnb-detail-booking-summary-price">
          ${totalPrice}
          <span className="airbnb-detail-booking-summary-per">{t('perPerson')}</span>
        </p>
      </div>

      <button type="button" onClick={onBookNow} className="airbnb-detail-reserve-btn">
        {t('bookNow')}
      </button>
    </div>
  )
}
