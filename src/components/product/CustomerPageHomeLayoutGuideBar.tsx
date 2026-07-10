'use client'

import { useMemo } from 'react'
import { LayoutGrid, Layers, MoveVertical, Palette } from 'lucide-react'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'
import {
  postCustomerPageGlobalThemeEdit,
  postCustomerPageHomeLayoutEdit,
  postCustomerPageTemplateEdit,
} from '@/lib/customerPageEditMessaging'
import { countVisibleHomeSections } from '@/lib/customerPageHomeLayout'
import { loadCustomerPageHomeLayout } from '@/lib/customerPageLayoutPersistence'
import { useCustomerPageTemplate } from '@/hooks/useCustomerPageTemplate'

export default function CustomerPageHomeLayoutGuideBar() {
  const { revision } = useCustomerPageFieldBindings()
  const { effectiveTemplate, isCustomized } = useCustomerPageTemplate()

  const summary = useMemo(() => {
    void revision
    const layout = loadCustomerPageHomeLayout()
    const visible = countVisibleHomeSections(layout)
    return {
      visible,
      hidden: layout.sections.length - visible,
      total: layout.sections.length,
    }
  }, [revision])

  return (
    <div className="customer-page-home-layout-guide sticky top-0 z-[90]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-violet-950">홈 페이지 편집 모드</p>
            <p className="text-xs text-violet-800/90 mt-0.5 leading-relaxed">
              <MoveVertical className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              섹션을 <strong className="font-semibold">드래그</strong>해 순서를 바꾸거나, 하단{' '}
              <strong className="font-semibold">섹션 팔레트</strong>에서 끌어다 놓으세요. 각 섹션에서
              레이아웃·표시·설정도 바로 변경할 수 있습니다.
              {summary.hidden > 0 && (
                <>
                  {' '}
                  · 숨긴 섹션 {summary.hidden}개 (총 {summary.total}개 중 {summary.visible}개 표시)
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => postCustomerPageTemplateEdit()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-violet-700 transition-colors"
            >
              <Layers className="h-4 w-4" />
              {isCustomized ? '템플릿' : effectiveTemplate?.label ?? '템플릿'}
            </button>
            <button
              type="button"
              onClick={() => postCustomerPageGlobalThemeEdit()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition-colors"
            >
              <Palette className="h-4 w-4" />
              테마
            </button>
            <button
              type="button"
              onClick={() => postCustomerPageHomeLayoutEdit()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-fuchsia-700 transition-colors"
            >
              <LayoutGrid className="h-4 w-4" />
              섹션
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
