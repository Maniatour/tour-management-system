'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import TagTranslationManager from '@/components/admin/TagTranslationManager'
import ChoicesDisplayModeSelector from '@/components/product/ChoicesDisplayModeSelector'
import ChoicesTab from '@/components/product/ChoicesTabNew'
import ProductOptionsEmbed from '@/components/product/ProductOptionsEmbed'
import CustomerPageFavoriteOrderPanel from '@/components/product/CustomerPageFavoriteOrderPanel'
import CustomerPageProductBasicEmbed from '@/components/product/CustomerPageProductBasicEmbed'
import CustomerPageProductDetailsEmbed from '@/components/product/CustomerPageProductDetailsEmbed'
import CustomerPageDetailHighlightsEmbed from '@/components/product/CustomerPageDetailHighlightsEmbed'
import CustomerPageSloganEmbed from '@/components/product/CustomerPageSloganEmbed'
import CustomerPageOverviewEmbed from '@/components/product/CustomerPageOverviewEmbed'
import CustomerPageTourCoursesEmbed from '@/components/product/CustomerPageTourCoursesEmbed'
import CustomerPageScheduleEmbed from '@/components/product/CustomerPageScheduleEmbed'
import CustomerPageThingsToKnowEmbed from '@/components/product/CustomerPageThingsToKnowEmbed'
import CustomerPageFaqEmbed from '@/components/product/CustomerPageFaqEmbed'
import CustomerPageProductRecommendationsEmbed, {
  sectionKeyFromRecommendationTab,
} from '@/components/product/CustomerPageProductRecommendationsEmbed'
import CustomerPageReservationLookup from '@/components/product/CustomerPageReservationLookup'
import CustomerPageTourCoursesCatalog from '@/components/product/CustomerPageTourCoursesCatalog'
import ProductFaqTab from '@/components/product/ProductFaqTab'
import ProductMediaTab from '@/components/product/ProductMediaTab'
import ProductScheduleTab from '@/components/product/ProductScheduleTab'
import TourCoursesTab from '@/components/product/TourCoursesTab'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import { ADMIN_TAB_LABELS, type ZoneEditConfig } from '@/lib/customerPageZoneEditMap'

type CustomerPageZoneAdminEmbedProps = {
  config: ZoneEditConfig
  zone: CustomerPageZone
  adminTab: string
  productId?: string | null | undefined
  locale: string
  onSaved?: () => void
  onOpenFullAdmin?: (tabId: string) => void
}

const DETAIL_TAB_CHOICES = [
  { id: 'details', label: '개요·슬로건·설명' },
  { id: 'tour-courses', label: '일정(코스)' },
  { id: 'schedule', label: '투어 일정' },
  { id: 'faq', label: 'FAQ' },
] as const

const BOOKING_OPTION_TABS = [
  { id: 'choices', label: '초이스 관리' },
  { id: 'options', label: '옵션 관리' },
] as const

function NeedProductMessage() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      이 영역을 편집하려면 상단에서 <strong>상품을 선택</strong>하세요.
    </div>
  )
}

export default function CustomerPageZoneAdminEmbed({
  config,
  zone,
  adminTab,
  productId,
  locale,
  onSaved,
  onOpenFullAdmin,
}: CustomerPageZoneAdminEmbedProps) {
  const initialSubTab = useMemo(() => {
    if (zone === 'detail-tab-overview' || zone === 'detail-tab-details') return 'details'
    if (zone === 'detail-tab-itinerary') return 'tour-courses'
    if (zone === 'detail-tab-schedule') return 'schedule'
    if (zone === 'detail-tab-faq') return 'faq'
    return adminTab
  }, [zone, adminTab])

  const [subTab, setSubTab] = useState<string>(initialSubTab)
  const isBookingOptionsZone =
    zone === 'detail-sidebar-options' || zone === 'booking-options'
  const activeTab = zone === 'detail-tabs' || isBookingOptionsZone ? subTab : adminTab
  const tabLabel = ADMIN_TAB_LABELS[activeTab] ?? activeTab
  const needsProduct = ['basic', 'media', 'details', 'schedule', 'tour-courses', 'faq', 'choices', 'options', 'dynamic-pricing', 'detail-highlights', 'detail-slogan', 'detail-overview', 'detail-tour-courses', 'detail-schedule', 'detail-things-to-know', 'detail-faq', 'detail-recommendations-viewed', 'detail-recommendations-for-you', 'detail-recommendations-bought-together'].includes(
    activeTab
  )

  const renderEmbed = () => {
    if (needsProduct && !productId) return <NeedProductMessage />

    switch (activeTab) {
      case 'basic':
        return (
          <CustomerPageProductBasicEmbed
            productId={productId!}
            {...(onSaved ? { onSaved } : {})}
          />
        )

      case 'media':
        return (
          <ProductMediaTab
            productId={productId!}
            isNewProduct={false}
            formData={{}}
            setFormData={() => {}}
          />
        )

      case 'details':
        return (
          <CustomerPageProductDetailsEmbed
            productId={productId!}
            {...(onSaved ? { onSaved } : {})}
          />
        )

      case 'schedule':
        return (
          <ProductScheduleTab
            productId={productId!}
            isNewProduct={false}
            formData={{}}
            setFormData={() => {}}
          />
        )

      case 'tour-courses':
        if (zone === 'custom-tour-builder') {
          return (
            <CustomerPageTourCoursesCatalog
              locale={locale}
              {...(onSaved ? { onSaved } : {})}
            />
          )
        }
        return <TourCoursesTab productId={productId!} isNewProduct={false} />

      case 'faq':
        return (
          <ProductFaqTab
            productId={productId!}
            isNewProduct={false}
            formData={{}}
            setFormData={() => {}}
          />
        )

      case 'choices':
        return <ChoicesTab productId={productId!} isNewProduct={false} embedded />

      case 'options':
        return (
          <ProductOptionsEmbed
            productId={productId!}
            {...(onOpenFullAdmin ? { onOpenFullAdmin } : {})}
          />
        )

      case 'detail-highlights':
        return (
          <CustomerPageDetailHighlightsEmbed
            productId={productId!}
            {...(onSaved ? { onSaved } : {})}
          />
        )

      case 'detail-slogan':
        return (
          <CustomerPageSloganEmbed
            productId={productId!}
            locale={locale}
            {...(onSaved ? { onSaved } : {})}
          />
        )

      case 'detail-overview':
        return (
          <CustomerPageOverviewEmbed
            productId={productId!}
            locale={locale}
            {...(onSaved ? { onSaved } : {})}
          />
        )

      case 'detail-tour-courses':
        return (
          <CustomerPageTourCoursesEmbed
            productId={productId!}
            locale={locale}
            {...(onSaved ? { onSaved } : {})}
            {...(onOpenFullAdmin ? { onOpenFullAdmin } : {})}
          />
        )

      case 'detail-schedule':
        return (
          <CustomerPageScheduleEmbed
            productId={productId!}
            locale={locale}
            {...(onSaved ? { onSaved } : {})}
            {...(onOpenFullAdmin ? { onOpenFullAdmin } : {})}
          />
        )

      case 'detail-things-to-know':
        return (
          <CustomerPageThingsToKnowEmbed
            productId={productId!}
            locale={locale}
            {...(onSaved ? { onSaved } : {})}
          />
        )

      case 'detail-faq':
        return (
          <CustomerPageFaqEmbed
            productId={productId!}
            locale={locale}
            {...(onSaved ? { onSaved } : {})}
            {...(onOpenFullAdmin ? { onOpenFullAdmin } : {})}
          />
        )

      case 'detail-recommendations-viewed':
      case 'detail-recommendations-for-you':
      case 'detail-recommendations-bought-together':
        return (
          <CustomerPageProductRecommendationsEmbed
            productId={productId!}
            sectionKey={sectionKeyFromRecommendationTab(activeTab)}
            locale={locale}
            {...(onSaved ? { onSaved } : {})}
          />
        )

      case 'tag-translations':
        return <TagTranslationManager locale={locale} />

      case 'products':
        return (
          <CustomerPageFavoriteOrderPanel
            locale={locale}
            {...(onSaved ? { onSaved } : {})}
          />
        )

      case 'reservations':
        return <CustomerPageReservationLookup locale={locale} />

      default:
        return (
          <p className="text-sm text-gray-600">
            이 영역({tabLabel})은 아직 모달 편집을 지원하지 않습니다.
          </p>
        )
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          모달에서 바로 편집합니다. 저장 후 미리보기를 새로고침하세요.
        </p>
        <div className="flex items-center gap-2">
          {onSaved && (
            <button
              type="button"
              onClick={onSaved}
              className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              미리보기 새로고침
            </button>
          )}
          {onOpenFullAdmin && (needsProduct ? productId : true) && (
            <button
              type="button"
              onClick={() => onOpenFullAdmin(activeTab)}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-md hover:bg-indigo-50"
            >
              전체 화면
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {zone === 'detail-tabs' && (
        <div className="flex flex-wrap gap-1.5">
          {DETAIL_TAB_CHOICES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                subTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {isBookingOptionsZone && productId && (
        <ChoicesDisplayModeSelector
          productId={productId}
          {...(onSaved ? { onSaved } : {})}
        />
      )}

      {isBookingOptionsZone && (
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-1">
          {BOOKING_OPTION_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                subTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-white hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {config.note && zone !== 'detail-tabs' && (
        <p className="text-xs text-gray-500">{config.note}</p>
      )}

      {renderEmbed()}
    </div>
  )
}
