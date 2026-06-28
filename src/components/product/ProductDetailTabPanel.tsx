'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import ProductFaqDisplay from '@/components/ProductFaqDisplay'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import ProductDetailOverviewTab from '@/components/product/ProductDetailOverviewTab'
import ProductDetailItineraryTab from '@/components/product/ProductDetailItineraryTab'
import ProductDetailDetailsTab from '@/components/product/ProductDetailDetailsTab'
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
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: t('tabOverview') },
    { id: 'itinerary', label: t('tabItinerary') },
    { id: 'tour-schedule', label: t('tabTourSchedule') },
    { id: 'details', label: t('tabDetails') },
    { id: 'faq', label: t('tabFaq') },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex overflow-x-auto scrollbar-hide px-4 sm:px-6">
          <div className="flex space-x-2 sm:space-x-8 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 transition-colors touch-optimized mobile-button ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === 'overview' && (
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
            showDetail={showDetail}
          />
        )}

        {activeTab === 'itinerary' && (
          <ProductDetailItineraryTab
            tourCourses={tourCourses}
            tourCoursePhotos={tourCoursePhotos}
            isEnglish={isEnglish}
          />
        )}

        {activeTab === 'tour-schedule' && (
          <TourScheduleSection productId={productId} teamType={null} locale={locale} />
        )}

        {activeTab === 'details' && (
          <ProductDetailDetailsTab
            product={product}
            productDetails={productDetails}
            categoryLabel={categoryLabel}
            durationLabel={durationLabel}
          />
        )}

        {activeTab === 'faq' && <ProductFaqDisplay productId={productId} />}
      </div>
    </div>
  )
}
