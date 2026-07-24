'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import ProductDetailDetailsTab, {
  type ProductDetailSection,
} from '@/components/product/ProductDetailDetailsTab'
import ProductDetailMobileTabSheet from '@/components/product/ProductDetailMobileTabSheet'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { thingsToKnowSectionZoneId } from '@/lib/customerPageZoneEditMap'
import {
  getThingsToKnowSectionVisibility,
  isThingsToKnowSectionEnabledOnCustomerPage,
  THINGS_TO_KNOW_SECTION_CONFIGS,
} from '@/lib/thingsToKnowSections'
import { fetchProductAttachedTourAudienceItems } from '@/lib/tourAudienceLibrary'
import { supabase } from '@/lib/supabase'
import type { ProductDetailsFields, ProductDetailsTabProduct } from '@/components/product/productDetailTypes'
import type { TagLabelMap } from '@/lib/productTagDisplay'

type ProductDetailThingsToKnowAccordionProps = {
  productId: string
  product: ProductDetailsTabProduct
  productDetails: ProductDetailsFields | null
  categoryLabel: string
  durationLabel: string
  locale: string
  tagLabelMap: TagLabelMap
}

export default function ProductDetailThingsToKnowAccordion({
  productId,
  product,
  productDetails,
  categoryLabel,
  durationLabel,
  locale,
  tagLabelMap,
}: ProductDetailThingsToKnowAccordionProps) {
  const t = useTranslations('productDetail')
  const { isEditMode } = useCustomerPageEditMode()
  const [expandedId, setExpandedId] = useState<ProductDetailSection | null>(() =>
    isEditMode ? 'basic' : null
  )
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [mobileSection, setMobileSection] = useState<ProductDetailSection | null>(null)
  const [hasAudienceItems, setHasAudienceItems] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchProductAttachedTourAudienceItems(supabase as never, productId).then((items) => {
      if (!cancelled) setHasAudienceItems(items.length > 0)
    })
    return () => {
      cancelled = true
    }
  }, [productId])

  const visibility = useMemo(() => {
    const base = getThingsToKnowSectionVisibility(productDetails, {
      includeEmptyInEditMode: isEditMode,
    })
    const audienceEnabled = isThingsToKnowSectionEnabledOnCustomerPage(productDetails, 'audience')
    return {
      ...base,
      audience:
        base.audience || (audienceEnabled && hasAudienceItems),
    }
  }, [hasAudienceItems, isEditMode, productDetails])

  const visibleItems = useMemo(
    () => THINGS_TO_KNOW_SECTION_CONFIGS.filter((item) => visibility[item.id]),
    [visibility]
  )

  if (visibleItems.length === 0) return null

  const toggleItem = (id: ProductDetailSection) => {
    setExpandedId((current) => (current === id ? null : id))
  }

  const openMobileSection = (id: ProductDetailSection) => {
    setMobileSection(id)
    setMobileSheetOpen(true)
  }

  const activeMobileConfig = visibleItems.find((item) => item.id === mobileSection)

  const renderSectionContent = (sectionId: ProductDetailSection) => {
    const content = (
      <ProductDetailDetailsTab
        productId={productId}
        product={product}
        productDetails={productDetails}
        categoryLabel={categoryLabel}
        durationLabel={durationLabel}
        locale={locale}
        tagLabelMap={tagLabelMap}
        section={sectionId}
        variant="airbnb"
      />
    )

    if (sectionId === 'audience') {
      return content
    }

    return (
      <CustomerPageZone zone={thingsToKnowSectionZoneId(sectionId)} productId={productId}>
        {content}
      </CustomerPageZone>
    )
  }

  return (
    <section className="airbnb-things-to-know">
      <h2 className="airbnb-detail-section-title">{t('thingsToKnow')}</h2>

      <nav
        className="airbnb-things-to-know-icons sm:hidden"
        aria-label={t('thingsToKnow')}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = mobileSection === item.id && mobileSheetOpen
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => openMobileSection(item.id)}
              aria-selected={isActive}
              aria-haspopup="dialog"
              aria-expanded={isActive}
              className="airbnb-things-to-know-icon-button"
            >
              <span
                className={`airbnb-things-to-know-icon-wrap ${item.iconBgClassName} ${
                  isActive ? 'is-active' : ''
                }`}
              >
                <Icon className={`h-5 w-5 ${item.iconClassName}`} aria-hidden />
              </span>
              <span
                className={`airbnb-things-to-know-icon-label ${
                  isActive ? 'is-active' : ''
                }`}
              >
                {t(item.labelKey)}
              </span>
            </button>
          )
        })}
      </nav>

      {activeMobileConfig ? (
        <ProductDetailMobileTabSheet
          open={mobileSheetOpen}
          onOpenChange={setMobileSheetOpen}
          title={t(activeMobileConfig.labelKey)}
          icon={activeMobileConfig.icon}
          iconBg={activeMobileConfig.iconBgClassName}
          iconColor={activeMobileConfig.iconClassName}
        >
          {mobileSection ? renderSectionContent(mobileSection) : null}
        </ProductDetailMobileTabSheet>
      ) : null}

      <div className="airbnb-things-accordion hidden sm:block">
        {visibleItems.map((item, index) => {
          const isExpanded = expandedId === item.id
          const isLast = index === visibleItems.length - 1
          const ItemIcon = item.icon

          return (
            <div
              key={item.id}
              className={`airbnb-things-accordion-item ${isLast ? 'is-last' : ''}`}
            >
              <button
                type="button"
                className="airbnb-things-accordion-trigger"
                onClick={() => toggleItem(item.id)}
                aria-expanded={isExpanded}
              >
                <span className="airbnb-things-accordion-trigger-content">
                  <span
                    className={`airbnb-things-accordion-icon ${item.iconBgClassName}`}
                    aria-hidden
                  >
                    <ItemIcon className={`h-[1.125rem] w-[1.125rem] ${item.iconClassName}`} />
                  </span>
                  <span className="airbnb-things-accordion-label">{t(item.labelKey)}</span>
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-[#6b7280]" aria-hidden />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#6b7280]" aria-hidden />
                )}
              </button>

              {isExpanded ? (
                <div className="airbnb-things-accordion-panel">
                  {renderSectionContent(item.id)}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
