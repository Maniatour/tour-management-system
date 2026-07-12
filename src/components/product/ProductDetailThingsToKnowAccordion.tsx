'use client'

import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Settings,
  Shield,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import ProductDetailDetailsTab, {
  type ProductDetailSection,
} from '@/components/product/ProductDetailDetailsTab'
import { getProductDetailSectionVisibility } from '@/lib/productDetailSectionVisibility'
import type { ProductDetailsFields, ProductDetailsTabProduct } from '@/components/product/productDetailTypes'
import type { TagLabelMap } from '@/lib/productTagDisplay'

type ProductDetailThingsToKnowAccordionProps = {
  product: ProductDetailsTabProduct
  productDetails: ProductDetailsFields | null
  categoryLabel: string
  durationLabel: string
  locale: string
  tagLabelMap: TagLabelMap
}

type AccordionItem = {
  id: ProductDetailSection
  labelKey: 'detailTabIncluded' | 'detailTabBasic' | 'detailTabLogistics' | 'detailTabPolicy'
  icon: LucideIcon
  iconClassName: string
  iconBgClassName: string
}

const ACCORDION_ITEMS: AccordionItem[] = [
  {
    id: 'basic',
    labelKey: 'detailTabBasic',
    icon: Info,
    iconClassName: 'text-indigo-600',
    iconBgClassName: 'bg-indigo-50',
  },
  {
    id: 'included',
    labelKey: 'detailTabIncluded',
    icon: CheckCircle2,
    iconClassName: 'text-emerald-600',
    iconBgClassName: 'bg-emerald-50',
  },
  {
    id: 'logistics',
    labelKey: 'detailTabLogistics',
    icon: Settings,
    iconClassName: 'text-purple-600',
    iconBgClassName: 'bg-purple-50',
  },
  {
    id: 'policy',
    labelKey: 'detailTabPolicy',
    icon: Shield,
    iconClassName: 'text-rose-600',
    iconBgClassName: 'bg-rose-50',
  },
]

export default function ProductDetailThingsToKnowAccordion({
  product,
  productDetails,
  categoryLabel,
  durationLabel,
  locale,
  tagLabelMap,
}: ProductDetailThingsToKnowAccordionProps) {
  const t = useTranslations('productDetail')
  const [expandedId, setExpandedId] = useState<ProductDetailSection | null>(null)

  const visibility = useMemo(
    () => getProductDetailSectionVisibility(productDetails),
    [productDetails]
  )

  const visibleItems = ACCORDION_ITEMS.filter((item) => visibility[item.id])

  if (visibleItems.length === 0) return null

  const toggleItem = (id: ProductDetailSection) => {
    setExpandedId((current) => (current === id ? null : id))
  }

  return (
    <section className="airbnb-things-to-know">
      <h2 className="airbnb-detail-section-title">
        {t('thingsToKnow')}
      </h2>
      <p className="airbnb-things-to-know-subtitle">{t('thingsToKnowSubtitle')}</p>

      <div className="airbnb-things-accordion">
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
                  <ProductDetailDetailsTab
                    product={product}
                    productDetails={productDetails}
                    categoryLabel={categoryLabel}
                    durationLabel={durationLabel}
                    locale={locale}
                    tagLabelMap={tagLabelMap}
                    section={item.id}
                    variant="airbnb"
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
