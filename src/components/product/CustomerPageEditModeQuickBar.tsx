'use client'

import { useEffect, useMemo, useState } from 'react'
import { Layers, LayoutGrid, Palette } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import {
  postCustomerPageGlobalThemeEdit,
  postCustomerPageHomeLayoutEdit,
  postCustomerPageListingCardLayoutEdit,
  postCustomerPageTemplateEdit,
  postCustomerPageZoneLayoutEdit,
} from '@/lib/customerPageEditMessaging'
import { inferCustomerPageIdFromPathname } from '@/lib/customer-page-registry'
import { pageSupportsZoneLayout } from '@/lib/customerPageZoneLayoutCatalog'
import { useCustomerPageTemplate } from '@/hooks/useCustomerPageTemplate'

/** iframe 편집 모드 — 미리보기 하단 빠른 작업 */
export default function CustomerPageEditModeQuickBar() {
  const { isPreview, isEditMode } = useCustomerPageEditMode()
  const { effectiveTemplate, isCustomized } = useCustomerPageTemplate()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [embeddedInWorkbench, setEmbeddedInWorkbench] = useState(false)

  useEffect(() => {
    setEmbeddedInWorkbench(window.parent !== window)
  }, [])

  const currentPageId = useMemo(() => {
    const fromPath = inferCustomerPageIdFromPathname(pathname)
    if (fromPath === 'product-detail' && searchParams.get('openBooking') === '1') {
      return 'product-booking'
    }
    return fromPath
  }, [pathname, searchParams])
  const onHomePage = currentPageId === 'home'
  const onListingPage = currentPageId === 'products-listing'
  const supportsZoneLayout = currentPageId ? pageSupportsZoneLayout(currentPageId) : false

  if (!isPreview || !isEditMode || embeddedInWorkbench) return null

  const templateLabel = isCustomized
    ? '템플릿'
    : effectiveTemplate?.label ?? '템플릿'

  return (
    <div className="fixed bottom-4 left-1/2 z-[95] -translate-x-1/2 w-[min(100%,36rem)] px-3">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
        <button
          type="button"
          onClick={() => postCustomerPageTemplateEdit()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
        >
          <Layers className="h-3.5 w-3.5" />
          {templateLabel}
        </button>
        <button
          type="button"
          onClick={() => postCustomerPageGlobalThemeEdit()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          <Palette className="h-3.5 w-3.5" />
          테마
        </button>
        {onHomePage && (
          <button
            type="button"
            onClick={() => postCustomerPageHomeLayoutEdit()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-fuchsia-600 px-3 py-2 text-xs font-semibold text-white hover:bg-fuchsia-700 transition-colors"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            섹션
          </button>
        )}
        {onListingPage && (
          <button
            type="button"
            onClick={() => postCustomerPageListingCardLayoutEdit()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            카드 슬롯
          </button>
        )}
        {supportsZoneLayout && currentPageId && pageSupportsZoneLayout(currentPageId) && (
          <button
            type="button"
            onClick={() => postCustomerPageZoneLayoutEdit(currentPageId)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            블록
          </button>
        )}
      </div>
    </div>
  )
}
