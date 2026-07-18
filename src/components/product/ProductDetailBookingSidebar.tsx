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
    capacity?: number | null
    is_default: boolean | null
    option_image_url?: string | null
    option_thumbnail_url?: string | null
    option_description?: string | null
    option_description_ko?: string | null
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
  variant?: 'default' | 'airbnb'
}

export default function ProductDetailBookingSidebar({
  variant = 'default',
  ...props
}: ProductDetailBookingSidebarProps) {
  return (
    <CustomerPageZone
      zone="detail-sidebar"
      suppressEditButton
      className={variant === 'airbnb' ? '' : 'hidden lg:block'}
    >
      <div
        className={
          variant === 'airbnb'
            ? 'airbnb-detail-booking-card sticky top-24'
            : 'sticky top-6 rounded-2xl cp-ui-panel-surface p-6 shadow-lg'
        }
      >
        <ProductDetailBookingPanelContent {...props} variant={variant === 'airbnb' ? 'airbnb' : 'sidebar'} />
      </div>
    </CustomerPageZone>
  )
}
