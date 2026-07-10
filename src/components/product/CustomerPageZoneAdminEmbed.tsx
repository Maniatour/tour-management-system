'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import TagTranslationManager from '@/components/admin/TagTranslationManager'
import ChoicesTab from '@/components/product/ChoicesTab'
import CustomerPageFavoriteOrderPanel from '@/components/product/CustomerPageFavoriteOrderPanel'
import CustomerPageProductBasicEmbed from '@/components/product/CustomerPageProductBasicEmbed'
import CustomerPageProductDetailsEmbed from '@/components/product/CustomerPageProductDetailsEmbed'
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
  const activeTab = zone === 'detail-tabs' ? subTab : adminTab
  const tabLabel = ADMIN_TAB_LABELS[activeTab] ?? activeTab
  const needsProduct = ['basic', 'media', 'details', 'schedule', 'tour-courses', 'faq', 'choices', 'options', 'dynamic-pricing'].includes(
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
        return <ChoicesTab productId={productId!} isNewProduct={false} />

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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
