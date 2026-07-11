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
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:rounded-2xl sm:p-6 sm:shadow-sm">
        <ProductDetailBookingPanelContent {...props} variant="mobile" />
      </div>
    </CustomerPageZone>
  )
}
