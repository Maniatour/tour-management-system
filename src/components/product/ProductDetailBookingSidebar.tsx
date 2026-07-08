'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'
import ProductDetailBookingPanelContent from '@/components/product/ProductDetailBookingPanelContent'

export type ProductDetailChoiceGroup = {
  choice_id: string
  choice_name: string
  choice_name_ko: string | null
  choice_name_en?: string | null
  choice_type: string
  choice_description: string | null
  options: Array<{
    option_id: string
    option_name: string
    option_name_ko: string | null
    option_price: number | null
    is_default: boolean | null
  }>
}

type ProductDetailBookingSidebarProps = {
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
  contactEmail?: string
}

export default function ProductDetailBookingSidebar(props: ProductDetailBookingSidebarProps) {
  return (
    <CustomerPageZone zone="detail-sidebar" className="hidden lg:block">
      <div className="sticky top-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-200/50">
        <ProductDetailBookingPanelContent {...props} variant="sidebar" />
      </div>
    </CustomerPageZone>
  )
}
