'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import ProductDetailBookingPanelContent from '@/components/product/ProductDetailBookingPanelContent'
import PriceDisplay from '@/components/customer/ui/PriceDisplay'
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
  const { totalPrice } = props
  const t = useTranslations('productDetail')
  const [expanded, setExpanded] = useState(false)
  const hasOptions = Object.keys(props.groupedChoices).length > 0

  return (
    <CustomerPageZone zone="detail-mobile-booking" className="lg:hidden">
      <div className="overflow-hidden rounded-card border border-border/60 bg-card shadow-card">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="mobile-booking-panel"
        >
          <div className="min-w-0 flex-1">
            <PriceDisplay
              amount={totalPrice}
              prefixLabel={t('fromPrice')}
              suffixLabel={t('perPerson')}
              size="md"
            />
            {hasOptions ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {expanded ? t('hideBookingOptions') : t('showBookingOptions')}
              </p>
            ) : null}
          </div>
          {hasOptions ? (
            expanded ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            )
          ) : null}
        </button>

        {expanded || !hasOptions ? (
          <div
            id="mobile-booking-panel"
            className="border-t border-border/60 p-4 sm:p-6"
          >
            <ProductDetailBookingPanelContent {...props} variant="mobile" />
          </div>
        ) : null}
      </div>
    </CustomerPageZone>
  )
}
