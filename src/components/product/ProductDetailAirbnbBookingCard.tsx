'use client'

import { MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ProductDetailDateTravelersPickers from '@/components/product/ProductDetailDateTravelersPickers'
import ProductDetailAirbnbBookingSummary from '@/components/product/ProductDetailAirbnbBookingSummary'
import ProductDetailPromoCodesBox from '@/components/product/ProductDetailPromoCodesBox'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'
import type { ProductDetailAppliedPromoState } from '@/hooks/useProductDetailAppliedPromo'
import type { TravelerAgeLimits, TravelerCounts } from '@/lib/productDetailTravelers'

type ProductDetailAirbnbBookingCardProps = {
  productId: string
  product?: {
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
  }
  customerTourName?: string
  basePrice: number | null
  /** 날짜 미선택 시 상단 표시가 — 기본가 0이면 초이스 최저가 */
  displayBasePrice?: number
  totalPrice: number
  groupedChoices: Record<string, ProductDetailChoiceGroup>
  selectedOptions: Record<string, string>
  selectedChoiceQuantities?: Record<string, Record<string, number>>
  isEnglish: boolean
  selectedDate: string
  travelerCounts: TravelerCounts
  onDateChange: (value: string) => void
  onTravelerCountsChange: (counts: TravelerCounts) => void
  ageLimits: TravelerAgeLimits
  onBookNow: () => void
  promo: ProductDetailAppliedPromoState
  contactEmail?: string
  /** 관리자 편집 미리보기 — 날짜 없이도 프로모 영역 표시 */
  forceShowPromo?: boolean
  bookDisabled?: boolean
}

export default function ProductDetailAirbnbBookingCard({
  productId,
  product = {},
  customerTourName = '',
  basePrice,
  displayBasePrice,
  totalPrice,
  groupedChoices,
  selectedOptions,
  selectedChoiceQuantities,
  isEnglish,
  selectedDate,
  travelerCounts,
  onDateChange,
  onTravelerCountsChange,
  ageLimits,
  onBookNow,
  promo,
  contactEmail = 'info@maniatour.com',
  forceShowPromo = false,
  bookDisabled = false,
}: ProductDetailAirbnbBookingCardProps) {
  const t = useTranslations('productDetail')
  const hasSelectedDate = Boolean(selectedDate)
  const showPromoSection = hasSelectedDate || forceShowPromo
  const headlinePrice = displayBasePrice ?? basePrice ?? 0

  return (
    <div className="airbnb-detail-booking-card">
      {!hasSelectedDate ? (
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-[#1a2b49]">${headlinePrice}</span>
          <span className="text-sm text-[#6b7280]">{t('basePrice')}</span>
        </div>
      ) : null}

      <ProductDetailDateTravelersPickers
        className={hasSelectedDate ? '' : 'mt-4'}
        productId={productId}
        product={product}
        customerTourName={customerTourName}
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        travelerCounts={travelerCounts}
        onTravelerCountsChange={onTravelerCountsChange}
        ageLimits={ageLimits}
      />

      {hasSelectedDate ? (
        <>
          <ProductDetailAirbnbBookingSummary
            basePrice={basePrice}
            totalPrice={totalPrice}
            displayTotalPrice={promo.displayTotalPrice}
            promoDiscountAmount={promo.discountAmount}
            appliedPromoCode={promo.appliedCoupon?.code ?? null}
            groupedChoices={groupedChoices}
            selectedOptions={selectedOptions}
            {...(selectedChoiceQuantities
              ? { selectedChoiceQuantities }
              : {})}
            isEnglish={isEnglish}
            onBookNow={onBookNow}
            bookDisabled={bookDisabled}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={onBookNow}
          disabled={bookDisabled}
          className="airbnb-detail-reserve-btn mt-4 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('checkAvailability')}
        </button>
      )}

      {showPromoSection ? (
        <CustomerPageZone zone="detail-promo-codes" productId={productId} className="mt-4">
          <ProductDetailPromoCodesBox productId={productId} promo={promo} />
        </CustomerPageZone>
      ) : null}

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
