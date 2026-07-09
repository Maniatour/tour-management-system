'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'
import ProductDetailBookingPanelContent from '@/components/product/ProductDetailBookingPanelContent'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'

type ProductDetailMobileBookingCardProps = {
  basePrice: number | null
  maxParticipants: number | null
  durationLabel: string
  groupSize: string | null
  totalPrice: number
  groupedChoices: Record<string, ProductDetailChoiceGroup>
  selectedOptions: Record<string, string>
  includedHtml?: string | null
  notIncludedHtml?: string | null
  showIncluded: boolean
  showNotIncluded: boolean
  isEnglish: boolean
  onOptionChange: (choiceId: string, optionId: string) => void
  onCompareOptions: () => void
  onBookNow: () => void
}

export default function ProductDetailMobileBookingCard(props: ProductDetailMobileBookingCardProps) {
  return (
    <CustomerPageZone zone="detail-mobile-booking" className="lg:hidden">
      <div className="rounded-2xl cp-ui-panel-surface p-5 shadow-sm sm:p-6">
        <ProductDetailBookingPanelContent {...props} variant="mobile" />
      </div>
    </CustomerPageZone>
  )
}
