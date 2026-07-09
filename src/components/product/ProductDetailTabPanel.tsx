'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ProductFaqDisplay from '@/components/ProductFaqDisplay'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import ProductDetailOverviewTab from '@/components/product/ProductDetailOverviewTab'
import ProductDetailItineraryTab from '@/components/product/ProductDetailItineraryTab'
import ProductDetailDetailsTab from '@/components/product/ProductDetailDetailsTab'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { fetchTagLabelMap, type TagLabelMap } from '@/lib/productTagDisplay'
import type {
  ProductDetailsFields,
  ProductDetailsTabProduct,
  ProductTourCourse,
  TourCoursePhoto,
} from '@/components/product/productDetailTypes'

type TabPanelProduct = ProductDetailsTabProduct & {
  name: string
  customer_name_ko: string
  customer_name_en: string
  description: string | null
  summary_ko?: string | null
  summary_en?: string | null
}

type TabPanelProductDetails = ProductDetailsFields & {
  slogan1?: string | null
  slogan2?: string | null
  slogan3?: string | null
  greeting?: string | null
}

type ProductDetailTabPanelProps = {
  productId: string
  locale: string
  product: TabPanelProduct
  productDetails: TabPanelProductDetails | null
  tourCourses: ProductTourCourse[]
  tourCoursePhotos: TourCoursePhoto[]
  isEnglish: boolean
  displayName: string
  categoryLabel: string
  durationLabel: string
  showDetail: (field: string) => boolean
}

const VALID_TABS = ['overview', 'itinerary', 'tour-schedule', 'details', 'faq'] as const

export default function ProductDetailTabPanel({
  productId,
  locale,
  product,
  productDetails,
  tourCourses,
  tourCoursePhotos,
  isEnglish,
  displayName,
  categoryLabel,
  durationLabel,
  showDetail,
}: ProductDetailTabPanelProps) {
  const t = useTranslations('productDetail')
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('overview')
  const [tagLabelMap, setTagLabelMap] = useState<TagLabelMap>({})

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && (VALID_TABS as readonly string[]).includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    const allTags = [...(product.tags ?? []), ...(productDetails?.tags ?? [])]
    const unique = [...new Set(allTags)]
    if (unique.length === 0) {
      setTagLabelMap({})
      return
    }
    void fetchTagLabelMap(unique).then(setTagLabelMap)
  }, [product.tags, productDetails?.tags])

  const tabs = [
    { id: 'overview', label: t('tabOverview') },
    { id: 'itinerary', label: t('tabItinerary') },
    { id: 'tour-schedule', label: t('tabTourSchedule') },
    { id: 'details', label: t('tabDetails') },
    { id: 'faq', label: t('tabFaq') },
  ]

  return (
    <CustomerPageZone zone="detail-tabs" className="rounded-2xl cp-ui-panel-surface shadow-sm">
      <div className="overflow-hidden rounded-2xl">
      <div className="border-b cp-ui-panel-surface">
        <nav className="-mb-px flex overflow-x-auto px-4 scrollbar-hide sm:px-6" aria-label="Product detail tabs">
          <div className="flex min-w-max gap-1 sm:gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-selected={activeTab === tab.id}
                role="tab"
                className={`mobile-button touch-optimized flex-shrink-0 whitespace-nowrap rounded-t-xl border-b-2 px-4 py-3.5 text-sm font-semibold transition-all sm:px-5 sm:py-4 sm:text-base ${
                  activeTab === tab.id
                    ? 'cp-ui-tab-active shadow-sm'
                    : 'cp-ui-tab-inactive border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        {activeTab === 'overview' && (
          <CustomerPageZone zone="detail-tab-overview">
            <ProductDetailOverviewTab
              product={product}
              productDetails={
                productDetails as {
                  slogan1: string | null
                  slogan2: string | null
                  slogan3: string | null
                  greeting: string | null
                  description: string | null
                  tags: string[] | null
                } | null
              }
              displayName={displayName}
              durationLabel={durationLabel}
              categoryLabel={categoryLabel}
              locale={locale}
              showDetail={showDetail}
              tagLabelMap={tagLabelMap}
            />
          </CustomerPageZone>
        )}

        {activeTab === 'itinerary' && (
          <CustomerPageZone zone="detail-tab-itinerary">
            <ProductDetailItineraryTab
              tourCourses={tourCourses}
              tourCoursePhotos={tourCoursePhotos}
              isEnglish={isEnglish}
            />
          </CustomerPageZone>
        )}

        {activeTab === 'tour-schedule' && (
          <CustomerPageZone zone="detail-tab-schedule">
            <TourScheduleSection productId={productId} teamType={null} locale={locale} />
          </CustomerPageZone>
        )}

        {activeTab === 'details' && (
          <CustomerPageZone zone="detail-tab-details">
            <ProductDetailDetailsTab
              product={product}
              productDetails={productDetails}
              categoryLabel={categoryLabel}
              durationLabel={durationLabel}
              locale={locale}
              tagLabelMap={tagLabelMap}
            />
          </CustomerPageZone>
        )}

        {activeTab === 'faq' && (
          <CustomerPageZone zone="detail-tab-faq">
            <ProductFaqDisplay productId={productId} />
          </CustomerPageZone>
        )}
      </div>
      </div>
    </CustomerPageZone>
  )
}
