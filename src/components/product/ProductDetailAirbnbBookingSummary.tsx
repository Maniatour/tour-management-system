'use client'

import { useTranslations } from 'next-intl'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'
import { usesQuantitySelection } from '@/lib/choiceOptionCapacity'

type ProductDetailAirbnbBookingSummaryProps = {
  basePrice: number | null
  totalPrice: number
  displayTotalPrice: number
  promoDiscountAmount: number
  appliedPromoCode?: string | null
  groupedChoices: Record<string, ProductDetailChoiceGroup>
  selectedOptions: Record<string, string>
  selectedChoiceQuantities?: Record<string, Record<string, number>>
  isEnglish: boolean
  onBookNow: () => void
  bookDisabled?: boolean
}

export default function ProductDetailAirbnbBookingSummary({
  basePrice,
  totalPrice,
  displayTotalPrice,
  promoDiscountAmount,
  appliedPromoCode,
  groupedChoices,
  selectedOptions,
  selectedChoiceQuantities = {},
  isEnglish,
  onBookNow,
  bookDisabled = false,
}: ProductDetailAirbnbBookingSummaryProps) {
  const t = useTranslations('productDetail')
  const groups = Object.values(groupedChoices)
  const hasPromo = promoDiscountAmount > 0

  const selectedLines = groups.flatMap((group) => {
    const choiceLabel = group.choice_name_ko || group.choice_name || group.choice_name_en
    if (usesQuantitySelection(group.choice_type, group.options, choiceLabel)) {
      const quantities = selectedChoiceQuantities[group.choice_id] ?? {}
      return group.options
        .filter((option) => (quantities[option.option_id] ?? 0) > 0)
        .map((option) => {
          const qty = quantities[option.option_id] ?? 0
          const optionLabel = isEnglish
            ? option.option_name || option.option_name_ko
            : option.option_name_ko || option.option_name
          return {
            id: `${group.choice_id}-${option.option_id}`,
            label: `${optionLabel} × ${qty}`,
            price: option.option_price != null ? option.option_price * qty : null,
          }
        })
    }

    const selectedOptionId = selectedOptions[group.choice_id]
    if (!selectedOptionId) return []

    const option = group.options.find((item) => item.option_id === selectedOptionId)
    if (!option) return []

    const optionLabel = isEnglish
      ? option.option_name || option.option_name_ko
      : option.option_name_ko || option.option_name

    return [
      {
        id: group.choice_id,
        label: optionLabel,
        price: option.option_price,
      },
    ]
  })

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

        {hasPromo ? (
          <div className="airbnb-detail-booking-summary-row airbnb-detail-booking-summary-row-promo">
            <span className="airbnb-detail-booking-summary-label">
              {t('promoDiscountLabel')}
              {appliedPromoCode ? (
                <span className="airbnb-detail-booking-summary-promo-code">{appliedPromoCode}</span>
              ) : null}
            </span>
            <span className="airbnb-detail-booking-summary-value airbnb-detail-booking-summary-discount">
              -${promoDiscountAmount.toFixed(2)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="airbnb-detail-booking-summary-total">
        {hasPromo && displayTotalPrice !== totalPrice ? (
          <p className="airbnb-detail-booking-summary-original">${totalPrice}</p>
        ) : null}
        <p className="airbnb-detail-booking-summary-price">
          ${hasPromo ? displayTotalPrice.toFixed(2) : totalPrice}
          <span className="airbnb-detail-booking-summary-per">{t('perPerson')}</span>
        </p>
      </div>

      {bookDisabled ? (
        <p className="mb-2 text-center text-xs font-medium text-amber-700">
          {t('capacitySelectToMatch')}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onBookNow}
        disabled={bookDisabled}
        className="airbnb-detail-reserve-btn disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('bookNow')}
      </button>
    </div>
  )
}
