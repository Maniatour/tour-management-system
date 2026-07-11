'use client'

import { MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ProductDetailDateTravelersPickers from '@/components/product/ProductDetailDateTravelersPickers'
import ProductDetailAirbnbBookingSummary from '@/components/product/ProductDetailAirbnbBookingSummary'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'
import type { TravelerAgeLimits, TravelerCounts } from '@/lib/productDetailTravelers'

type ProductDetailAirbnbBookingCardProps = {
  productId: string
  basePrice: number | null
  totalPrice: number
  groupedChoices: Record<string, ProductDetailChoiceGroup>
  selectedOptions: Record<string, string>
  isEnglish: boolean
  selectedDate: string
  travelerCounts: TravelerCounts
  onDateChange: (value: string) => void
  onTravelerCountsChange: (counts: TravelerCounts) => void
  ageLimits: TravelerAgeLimits
  onBookNow: () => void
  contactEmail?: string
}

export default function ProductDetailAirbnbBookingCard({
  productId,
  basePrice,
  totalPrice,
  groupedChoices,
  selectedOptions,
  isEnglish,
  selectedDate,
  travelerCounts,
  onDateChange,
  onTravelerCountsChange,
  ageLimits,
  onBookNow,
  contactEmail = 'info@maniatour.com',
}: ProductDetailAirbnbBookingCardProps) {
  const t = useTranslations('productDetail')
  const hasSelectedDate = Boolean(selectedDate)

  return (
    <div className="airbnb-detail-booking-card">
      {!hasSelectedDate ? (
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-[#1a2b49]">${basePrice ?? 0}</span>
          <span className="text-sm text-[#6b7280]">{t('basePrice')}</span>
        </div>
      ) : null}

      <ProductDetailDateTravelersPickers
        className={hasSelectedDate ? '' : 'mt-4'}
        productId={productId}
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        travelerCounts={travelerCounts}
        onTravelerCountsChange={onTravelerCountsChange}
        ageLimits={ageLimits}
      />

      {hasSelectedDate ? (
        <ProductDetailAirbnbBookingSummary
          basePrice={basePrice}
          totalPrice={totalPrice}
          groupedChoices={groupedChoices}
          selectedOptions={selectedOptions}
          isEnglish={isEnglish}
          onBookNow={onBookNow}
        />
      ) : (
        <button type="button" onClick={onBookNow} className="airbnb-detail-reserve-btn mt-4">
          {t('checkAvailability')}
        </button>
      )}

      <p className="mt-3 text-center text-xs text-[#6b7280]">{t('freeCancellationNote')}</p>

      <div className="mt-3 text-center">
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a2b49] underline underline-offset-2"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t('contactUs')}
        </a>
      </div>
    </div>
  )
}
