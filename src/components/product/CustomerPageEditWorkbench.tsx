'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, X } from 'lucide-react'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import { isCustomerPageZoneEditMessage, notifyIframeCustomerPageEditMode } from '@/lib/customerPageEditMessaging'
import { getZoneEditConfig } from '@/lib/customerPageZoneEditMap'
import {
  buildAdminPathForEditTab,
  buildCustomerPageEditUrl,
  CUSTOMER_PAGE_REGISTRY,
  type CustomerPageId,
} from '@/lib/customer-page-registry'
import CustomerPageZoneEditPanel from '@/components/product/CustomerPageZoneEditPanel'
import { supabase } from '@/lib/supabase'

type ProductOption = { id: string; label: string }

type CustomerPageEditWorkbenchProps = {
  locale: string
  /** 임베드(관리 페이지) vs 전체화면 모달 */
  variant?: 'embedded' | 'modal'
  isOpen?: boolean
  onClose?: () => void
  initialPageId?: CustomerPageId
  initialProductId?: string | null
}

export default function CustomerPageEditWorkbench({
  locale,
  variant = 'embedded',
  isOpen = true,
  onClose,
  initialPageId = 'home',
  initialProductId = null,
}: CustomerPageEditWorkbenchProps) {
  const router = useRouter()
  const [pageId, setPageId] = useState<CustomerPageId>(initialPageId)
  const [productId, setProductId] = useState<string | null>(initialProductId)
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [selectedZone, setSelectedZone] = useState<CustomerPageZone | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const currentPage = CUSTOMER_PAGE_REGISTRY.find((p) => p.id === pageId)
  const needsProduct = currentPage?.requiresProduct ?? false

  const previewUrl = useMemo(
    () => buildCustomerPageEditUrl(locale, pageId, { productId }),
    [locale, pageId, productId, iframeKey]
  )

  const refreshPreview = useCallback(() => {
    setIframeKey((k) => k + 1)
    setIframeLoading(true)
  }, [])

  useEffect(() => {
    if (variant === 'modal' && !isOpen) return
    setPageId(initialPageId)
    setProductId(initialProductId)
    setSelectedZone(null)
    setIframeLoading(true)
  }, [variant, isOpen, initialPageId, initialProductId])

  useEffect(() => {
    if (variant === 'modal' && !isOpen) return

    const sendEditModeToIframe = () => {
      notifyIframeCustomerPageEditMode(iframeRef.current)
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (!isCustomerPageZoneEditMessage(event.data)) return
      setSelectedZone(event.data.zone)
    }

    window.addEventListener('message', handleMessage)
    const retryTimers = [200, 600, 1500].map((ms) =>
      window.setTimeout(sendEditModeToIframe, ms)
    )
    return () => {
      window.removeEventListener('message', handleMessage)
      retryTimers.forEach((id) => window.clearTimeout(id))
    }
  }, [variant, isOpen, iframeKey])

  useEffect(() => {
    let cancelled = false
    setProductsLoading(true)

    void (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, customer_name_ko, customer_name_en, status')
        .in('status', ['active', 'draft'])
        .order('name', { ascending: true })
        .limit(200)

      if (cancelled) return

      if (!error && data) {
        setProductOptions(
          data.map((row) => {
            const r = row as {
              id: string
              name: string
              customer_name_ko: string | null
              customer_name_en: string | null
            }
            const label =
              (locale === 'en' ? r.customer_name_en || r.name : r.customer_name_ko || r.name) ||
              r.name
            return { id: r.id, label }
          })
        )
      }
      setProductsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [locale])

  const handleNavigateToTab = (tabId: string) => {
    const path = buildAdminPathForEditTab(locale, tabId, productId)
    router.push(path)
    onClose?.()
  }

  const selectedConfig = selectedZone ? getZoneEditConfig(selectedZone) : null

  if (variant === 'modal' && !isOpen) return null

  const shellClass =
    variant === 'modal'
      ? 'fixed inset-0 z-[70] flex flex-col bg-gray-900/60'
      : 'flex flex-col h-[calc(100vh-4rem)] min-h-[520px] -m-4 sm:-m-6'

  const innerClass =
    variant === 'modal'
      ? 'relative flex flex-col w-full h-full bg-white overflow-hidden'
      : 'relative flex flex-col w-full h-full bg-white overflow-hidden rounded-lg border border-gray-200 shadow-sm'

  return (
    <div className={shellClass}>
      <div className={innerClass}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">고객 페이지 작업</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              홈부터 상품·예약 페이지까지 실제 화면을 보며 영역별로 수정하세요.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1.5 rounded-md hover:bg-white/80"
            >
              새 탭
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {variant === 'modal' && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/80 hover:text-gray-600"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
          {CUSTOMER_PAGE_REGISTRY.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPageId(id)
                setSelectedZone(null)
                setIframeLoading(true)
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                pageId === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {needsProduct && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-amber-100 bg-amber-50/80 shrink-0">
            <span className="text-xs font-medium text-amber-900">상품 선택</span>
            <select
              value={productId ?? ''}
              onChange={(e) => {
                setProductId(e.target.value || null)
                setSelectedZone(null)
                setIframeLoading(true)
              }}
              className="text-xs border border-amber-200 rounded-md px-2 py-1.5 bg-white min-w-[200px] max-w-full"
              disabled={productsLoading}
            >
              <option value="">상품을 선택하세요</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {!productId && (
              <span className="text-xs text-amber-700">상품 상세·예약 편집에 필요합니다.</span>
            )}
          </div>
        )}

        <div className="relative flex-1 min-h-0 bg-gray-100">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          )}
          <iframe
            ref={iframeRef}
            key={previewUrl}
            title="고객 페이지 편집 미리보기"
            src={previewUrl}
            className="w-full h-full border-0 bg-white"
            onLoad={() => {
              setIframeLoading(false)
              notifyIframeCustomerPageEditMode(iframeRef.current)
            }}
          />
          {!selectedZone && !iframeLoading && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="rounded-full bg-blue-600 text-white text-xs font-medium px-4 py-2 shadow-lg">
                각 영역의 파란 「수정」 버튼을 클릭하세요
              </div>
            </div>
          )}
        </div>

        {selectedZone && selectedConfig && (
          <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div
              className="absolute inset-0 bg-black/45"
              onClick={() => setSelectedZone(null)}
              aria-hidden
            />
            <div className="relative flex flex-col w-full max-w-5xl h-[min(88vh,calc(100dvh-2rem))] min-h-[min(480px,calc(100dvh-2rem))] my-auto bg-white rounded-xl shadow-2xl overflow-hidden">
              <CustomerPageZoneEditPanel
                key={`${selectedZone}-${productId ?? 'none'}`}
                zone={selectedZone}
                productId={productId}
                locale={locale}
                variant="modal"
                onSaved={() => {
                  refreshPreview()
                  setSelectedZone(null)
                }}
                onNavigateToTab={handleNavigateToTab}
                onClose={() => setSelectedZone(null)}
              />
            </div>
          </div>
        )}

        <div className="px-4 py-2 border-t border-gray-200 bg-white text-xs text-gray-500 shrink-0">
          저장 후 미리보기가 자동 갱신됩니다. 모달 안에서 바로 편집할 수 있는 영역은 이동 없이 처리됩니다.
        </div>
      </div>
    </div>
  )
}
