'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  BookOpen,
  Map,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import ProductDetailOverviewTab from '@/components/product/ProductDetailOverviewTab'
import ProductDetailItineraryTab from '@/components/product/ProductDetailItineraryTab'
import ProductDetailDetailsTab, {
  type ProductDetailSection,
} from '@/components/product/ProductDetailDetailsTab'
import ProductDetailMobileTabSheet from '@/components/product/ProductDetailMobileTabSheet'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { fetchTagLabelMap, type TagLabelMap } from '@/lib/productTagDisplay'
import {
  THINGS_TO_KNOW_OPERATION_FIELD_IDS,
  THINGS_TO_KNOW_SECTION_CONFIGS,
  getThingsToKnowSectionVisibility,
} from '@/lib/thingsToKnowSections'
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

const DETAIL_TAB_IDS = ['basic', 'included', ...THINGS_TO_KNOW_OPERATION_FIELD_IDS, 'policy'] as const
type DetailTabId = (typeof DETAIL_TAB_IDS)[number]

type ProductDetailTabId =
  | 'overview'
  | 'itinerary'
  | 'tour-schedule'
  | DetailTabId

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

const VALID_TABS: ProductDetailTabId[] = [
  'overview',
  'itinerary',
  'tour-schedule',
  ...DETAIL_TAB_IDS,
]

const LEGACY_TAB_MAP: Record<string, ProductDetailTabId> = {
  details: 'basic',
  faq: 'overview',
  logistics: 'pickup_drop_info',
}

function normalizeTabId(tab: string | null): ProductDetailTabId | null {
  if (!tab) return null
  if ((VALID_TABS as readonly string[]).includes(tab)) {
    return tab as ProductDetailTabId
  }
  return LEGACY_TAB_MAP[tab] ?? null
}

type TabConfig = {
  id: ProductDetailTabId
  labelKey: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  activeLabel: string
  zone:
    | 'detail-tab-overview'
    | 'detail-tab-itinerary'
    | 'detail-tab-schedule'
    | 'detail-tab-details'
}

const TOP_TAB_CONFIG: TabConfig[] = [
  {
    id: 'overview',
    labelKey: 'tabOverview',
    icon: BookOpen,
    iconBg: 'bg-booking/10',
    iconColor: 'text-booking',
    activeLabel: 'text-booking',
    zone: 'detail-tab-overview',
  },
  {
    id: 'itinerary',
    labelKey: 'tabItinerary',
    icon: Map,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    activeLabel: 'text-emerald-700',
    zone: 'detail-tab-itinerary',
  },
  {
    id: 'tour-schedule',
    labelKey: 'tabTourSchedule',
    icon: CalendarDays,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    activeLabel: 'text-orange-700',
    zone: 'detail-tab-schedule',
  },
]

const DETAIL_TAB_CONFIG: TabConfig[] = THINGS_TO_KNOW_SECTION_CONFIGS.filter((section) =>
  (DETAIL_TAB_IDS as readonly string[]).includes(section.id)
).map((section) => ({
  id: section.id as DetailTabId,
  labelKey: section.labelKey,
  icon: section.icon,
  iconBg: section.iconBgClassName,
  iconColor: section.iconClassName,
  activeLabel: section.iconClassName,
  zone: 'detail-tab-details' as const,
}))

const TAB_CONFIG: TabConfig[] = [...TOP_TAB_CONFIG, ...DETAIL_TAB_CONFIG]

export default function ProductDetailTabPanel({
  productId,
  locale,
  product,
  productDetails,
  tourCourses,
  tourCoursePhotos,
  isEnglish: _isEnglish,
  displayName,
  categoryLabel,
  durationLabel,
  showDetail,
}: ProductDetailTabPanelProps) {
  const t = useTranslations('productDetail')
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<ProductDetailTabId>('overview')
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [tagLabelMap, setTagLabelMap] = useState<TagLabelMap>({})

  useEffect(() => {
    const normalized = normalizeTabId(searchParams.get('tab'))
    if (normalized) {
      setActiveTab(normalized)
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
        setMobileSheetOpen(true)
      }
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

  const sectionVisibility = useMemo(
    () => getThingsToKnowSectionVisibility(productDetails),
    [productDetails]
  )

  const tabs = useMemo(
    () =>
      TAB_CONFIG.filter((tab) => {
        if (tab.id === 'overview' || tab.id === 'itinerary' || tab.id === 'tour-schedule') {
          return true
        }
        return sectionVisibility[tab.id as keyof typeof sectionVisibility]
      }).map((tab) => ({
        ...tab,
        label: t(tab.labelKey),
      })),
    [sectionVisibility, t]
  )

  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  const openMobileTab = (tabId: ProductDetailTabId) => {
    setActiveTab(tabId)
    setMobileSheetOpen(true)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
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
        )

      case 'itinerary':
        return (
          <CustomerPageZone zone="detail-tab-itinerary">
            <ProductDetailItineraryTab
              tourCourses={tourCourses}
              tourCoursePhotos={tourCoursePhotos}
              locale={locale}
            />
          </CustomerPageZone>
        )

      case 'tour-schedule':
        return (
          <CustomerPageZone zone="detail-tab-schedule">
            <TourScheduleSection productId={productId} teamType={null} locale={locale} />
          </CustomerPageZone>
        )

      default:
        if ((DETAIL_TAB_IDS as readonly string[]).includes(activeTab)) {
          return (
            <CustomerPageZone zone="detail-tab-details">
              <ProductDetailDetailsTab
                productId={productId}
                product={product}
                productDetails={productDetails}
                categoryLabel={categoryLabel}
                durationLabel={durationLabel}
                locale={locale}
                tagLabelMap={tagLabelMap}
                section={activeTab as ProductDetailSection}
              />
            </CustomerPageZone>
          )
        }
        return null
    }
  }

  return (
    <CustomerPageZone
      zone="detail-tabs"
      suppressEditButton
      className="overflow-hidden rounded-xl cp-ui-panel-surface sm:rounded-2xl sm:shadow-sm"
    >
      {/* Mobile: app icon grid */}
      <nav
        className="grid grid-cols-4 gap-x-1 gap-y-2.5 px-1.5 py-3 sm:hidden"
        aria-label="Product detail tabs"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => openMobileTab(tab.id)}
              aria-selected={isActive}
              aria-haspopup="dialog"
              aria-expanded={isActive && mobileSheetOpen}
              role="tab"
              className="touch-optimized mobile-button flex flex-col items-center gap-1 px-0.5 py-0.5 transition-transform active:scale-95"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-transform duration-200 ${tab.iconBg} ${
                  isActive ? 'scale-105' : ''
                }`}
              >
                <Icon className={`h-5 w-5 ${tab.iconColor}`} aria-hidden />
              </span>
              <span
                className={`line-clamp-2 text-center text-[10px] leading-tight ${
                  isActive ? `font-bold ${tab.activeLabel}` : 'font-medium text-gray-600'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Desktop: horizontal icon tabs */}
      <div className="hidden border-b border-gray-100 sm:block">
        <nav
          className="-mb-px flex overflow-x-auto px-4 scrollbar-hide sm:px-6"
          aria-label="Product detail tabs"
        >
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={isActive}
                  role="tab"
                  className={`mobile-button touch-optimized flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-t-xl border-b-2 px-4 py-3.5 text-sm font-semibold transition-all sm:px-5 sm:py-4 ${
                    isActive ? 'cp-ui-tab-active shadow-sm' : 'cp-ui-tab-inactive border-transparent'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tab.iconBg}`}>
                    <Icon className={`h-4 w-4 ${tab.iconColor}`} aria-hidden />
                  </span>
                  {tab.label}
                </button>
              )
            })}
          </div>
        </nav>
      </div>

      <ProductDetailMobileTabSheet
        open={mobileSheetOpen}
        onOpenChange={setMobileSheetOpen}
        title={activeTabConfig.label}
        icon={activeTabConfig.icon}
        iconBg={activeTabConfig.iconBg}
        iconColor={activeTabConfig.iconColor}
      >
        {renderTabContent()}
      </ProductDetailMobileTabSheet>

      {/* Desktop: inline tab content */}
      <div className="hidden p-3 sm:block sm:p-6 lg:p-8">{renderTabContent()}</div>
    </CustomerPageZone>
  )
}
