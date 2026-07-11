'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExternalLink, Languages, LayoutGrid, Layers, Loader2, Monitor, Palette, Pencil, Smartphone, X } from 'lucide-react'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import {
  isCustomerPageGlobalThemeEditMessage,
  isCustomerPageHomeLayoutEditMessage,
  isCustomerPageTemplateEditMessage,
  isCustomerPageZoneEditMessage,
  isCustomerPageZoneLayoutEditMessage,
  isCustomerPageListingCardLayoutEditMessage,
  isCustomerPagePreviewHeightMessage,
  notifyIframeCustomerPageEditMode,
  notifyIframeCustomerPageReload,
} from '@/lib/customerPageEditMessaging'
import {
  CUSTOMER_PAGE_BINDINGS_UPDATE_EVENT,
  notifyIframeCustomerPageBindingsUpdate,
} from '@/lib/customerPageBindingsSync'
import { confirmDiscardUnsavedChanges } from '@/lib/customerPageSoftReload'
import { getZoneEditConfig } from '@/lib/customerPageZoneEditMap'
import {
  buildAdminPathForEditTab,
  buildCustomerPageEditUrl,
  CUSTOMER_PAGE_REGISTRY,
  extractProductIdFromCustomerPageUrl,
  inferCustomerPageIdFromUrl,
  type CustomerPageId,
} from '@/lib/customer-page-registry'
import { pageSupportsZoneLayout, type ZoneLayoutPageId } from '@/lib/customerPageZoneLayoutCatalog'
import {
  buildCustomerPageWorkbenchQuery,
  parseCustomerPageWorkbenchUrl,
  type PreviewLocale,
  type PreviewViewport,
} from '@/lib/customerPageWorkbenchState'
import CustomerPageZoneEditPanel from '@/components/product/CustomerPageZoneEditPanel'
import CustomerPageHomeLayoutPanel from '@/components/product/CustomerPageHomeLayoutPanel'
import CustomerPageZoneLayoutPanel from '@/components/product/CustomerPageZoneLayoutPanel'
import CustomerPageListingCardLayoutPanel from '@/components/product/CustomerPageListingCardLayoutPanel'
import CustomerPageGlobalThemePanel from '@/components/product/CustomerPageGlobalThemePanel'
import CustomerPageTemplatePanel from '@/components/product/CustomerPageTemplatePanel'
import { useCustomerPageGlobalTheme } from '@/hooks/useCustomerPageGlobalTheme'
import { useCustomerPageTemplate } from '@/hooks/useCustomerPageTemplate'
import CustomerPageProductSearchSelect, {
  type CustomerPageProductOption,
} from '@/components/product/CustomerPageProductSearchSelect'
import { supabase } from '@/lib/supabase'

type ProductRow = {
  id: string
  name: string
  customer_name_ko: string | null
  customer_name_en: string | null
}

function productRowToOption(row: ProductRow, labelLocale: PreviewLocale): CustomerPageProductOption {
  const label =
    (labelLocale === 'en'
      ? row.customer_name_en || row.name
      : row.customer_name_ko || row.name) || row.name
  const sublabel =
    labelLocale === 'en'
      ? row.customer_name_ko || row.name
      : row.customer_name_en || row.name
  return {
    id: row.id,
    label,
    sublabel: sublabel !== label ? sublabel : null,
  }
}

function readProductContextFromIframe(
  iframe: HTMLIFrameElement | null
): { productId: string | null; pageId: CustomerPageId | null } {
  if (!iframe?.contentWindow) return { productId: null, pageId: null }
  try {
    const href = iframe.contentWindow.location.href
    return {
      productId: extractProductIdFromCustomerPageUrl(href),
      pageId: inferCustomerPageIdFromUrl(href),
    }
  } catch {
    return { productId: null, pageId: null }
  }
}

function workbenchQuerySignature(params: URLSearchParams): string {
  return ['cpPage', 'cpProduct', 'cpLang', 'cpView']
    .map((key) => `${key}=${params.get(key) ?? ''}`)
    .join('&')
}

type CustomerPageEditWorkbenchProps = {
  locale: string
  variant?: 'embedded' | 'modal'
  isOpen?: boolean
  onClose?: () => void
  initialPageId?: CustomerPageId
  initialProductId?: string | null
}

function CustomerPageEditWorkbenchInner({
  locale,
  variant = 'embedded',
  isOpen = true,
  onClose,
  initialPageId = 'home',
  initialProductId = null,
}: CustomerPageEditWorkbenchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlBootstrapped = useRef(false)

  const [pageId, setPageId] = useState<CustomerPageId>(initialPageId)
  const [productId, setProductId] = useState<string | null>(initialProductId)
  const [productOptions, setProductOptions] = useState<CustomerPageProductOption[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsSearching, setProductsSearching] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [iframeContentHeight, setIframeContentHeight] = useState(960)
  const [selectedZone, setSelectedZone] = useState<CustomerPageZone | null>(null)
  const [editProductId, setEditProductId] = useState<string | null>(null)
  const [editDirty, setEditDirty] = useState(false)
  const [showHomeLayoutPanel, setShowHomeLayoutPanel] = useState(false)
  const [homeLayoutEditTargetId, setHomeLayoutEditTargetId] = useState<string | null>(null)
  const [showZoneLayoutPanel, setShowZoneLayoutPanel] = useState(false)
  const [zoneLayoutPageId, setZoneLayoutPageId] = useState<ZoneLayoutPageId>('products-tags')
  const [zoneLayoutFocusZoneId, setZoneLayoutFocusZoneId] = useState<CustomerPageZone | null>(null)
  const [showListingCardLayoutPanel, setShowListingCardLayoutPanel] = useState(false)
  const [showGlobalThemePanel, setShowGlobalThemePanel] = useState(false)
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)
  const [previewLocale, setPreviewLocale] = useState<PreviewLocale>(locale === 'en' ? 'en' : 'ko')
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>('desktop')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const iframeHeightRef = useRef(960)

  const syncUrlState = variant === 'embedded'

  const currentPage = CUSTOMER_PAGE_REGISTRY.find((p) => p.id === pageId)
  const activeGlobalTheme = useCustomerPageGlobalTheme()
  const { effectiveTemplate, isCustomized: isTemplateCustomized } = useCustomerPageTemplate()
  const needsProduct = currentPage?.requiresProduct ?? false

  const previewUrl = useMemo(() => {
    const base = buildCustomerPageEditUrl(locale, pageId, { productId, previewLocale })
    if (iframeKey === 0) return base
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}_cpEditRev=${iframeKey}`
  }, [locale, pageId, productId, previewLocale, iframeKey])

  const refreshPreview = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      notifyIframeCustomerPageReload(iframeRef.current)
      notifyIframeCustomerPageEditMode(iframeRef.current)
      notifyIframeCustomerPageBindingsUpdate(iframeRef.current)
      return
    }
    setIframeLoading(true)
    setIframeKey((k) => k + 1)
  }, [])

  const applyIframeHeight = useCallback(
    (height: number) => {
      const minHeight = previewViewport === 'mobile' ? 680 : 720
      const next = Math.max(Math.ceil(height), minHeight)
      if (Math.abs(next - iframeHeightRef.current) < 16) return

      const scrollEl = previewScrollRef.current
      const prevScrollTop = scrollEl?.scrollTop ?? 0

      iframeHeightRef.current = next
      setIframeContentHeight(next)

      requestAnimationFrame(() => {
        if (scrollEl) scrollEl.scrollTop = prevScrollTop
      })
    },
    [previewViewport]
  )

  const syncIframeHeight = useCallback(() => {
    try {
      const iframe = iframeRef.current
      const doc = iframe?.contentDocument
      if (!doc) return

      applyIframeHeight(
        Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0)
      )
    } catch {
      /* cross-origin 등 — postMessage fallback 사용 */
    }
  }, [applyIframeHeight])

  const scheduleIframeHeightSync = useCallback(() => {
    syncIframeHeight()
    window.setTimeout(syncIframeHeight, 500)
  }, [syncIframeHeight])

  const closeEditModal = useCallback(() => {
    setSelectedZone(null)
    setEditProductId(null)
    setEditDirty(false)
  }, [])

  const requestCloseEditModal = useCallback(() => {
    if (editDirty && !confirmDiscardUnsavedChanges()) return
    closeEditModal()
  }, [editDirty, closeEditModal])

  const openHomeLayoutPanel = useCallback((instanceId?: string) => {
    if (editDirty && selectedZone && !confirmDiscardUnsavedChanges()) return
    closeEditModal()
    setShowGlobalThemePanel(false)
    setShowTemplatePanel(false)
    setShowZoneLayoutPanel(false)
    setShowListingCardLayoutPanel(false)
    setHomeLayoutEditTargetId(instanceId ?? null)
    setShowHomeLayoutPanel(true)
  }, [closeEditModal, editDirty, selectedZone])

  const openZoneLayoutPanel = useCallback(
    (targetPageId: ZoneLayoutPageId, zoneId?: CustomerPageZone) => {
      if (editDirty && selectedZone && !confirmDiscardUnsavedChanges()) return
      closeEditModal()
      setShowGlobalThemePanel(false)
      setShowTemplatePanel(false)
      setShowHomeLayoutPanel(false)
      setShowListingCardLayoutPanel(false)
      setZoneLayoutPageId(targetPageId)
      setZoneLayoutFocusZoneId(zoneId ?? null)
      setShowZoneLayoutPanel(true)
    },
    [closeEditModal, editDirty, selectedZone]
  )

  const requestCloseListingCardLayoutPanel = useCallback(() => {
    setShowListingCardLayoutPanel(false)
  }, [])

  const openListingCardLayoutPanel = useCallback(() => {
    if (editDirty && selectedZone && !confirmDiscardUnsavedChanges()) return
    closeEditModal()
    setShowGlobalThemePanel(false)
    setShowTemplatePanel(false)
    setShowHomeLayoutPanel(false)
    setShowZoneLayoutPanel(false)
    setShowListingCardLayoutPanel(true)
  }, [closeEditModal, editDirty, selectedZone])

  const requestCloseZoneLayoutPanel = useCallback(() => {
    setShowZoneLayoutPanel(false)
    setZoneLayoutFocusZoneId(null)
  }, [])

  const requestCloseHomeLayoutPanel = useCallback(() => {
    setShowHomeLayoutPanel(false)
    setHomeLayoutEditTargetId(null)
  }, [])

  const openGlobalThemePanel = useCallback(() => {
    if (editDirty && selectedZone && !confirmDiscardUnsavedChanges()) return
    closeEditModal()
    setShowHomeLayoutPanel(false)
    setShowZoneLayoutPanel(false)
    setShowListingCardLayoutPanel(false)
    setShowTemplatePanel(false)
    setShowGlobalThemePanel(true)
  }, [closeEditModal, editDirty, selectedZone])

  const requestCloseGlobalThemePanel = useCallback(() => {
    setShowGlobalThemePanel(false)
  }, [])

  const openTemplatePanel = useCallback(() => {
    if (editDirty && selectedZone && !confirmDiscardUnsavedChanges()) return
    closeEditModal()
    setShowHomeLayoutPanel(false)
    setShowZoneLayoutPanel(false)
    setShowListingCardLayoutPanel(false)
    setShowGlobalThemePanel(false)
    setShowTemplatePanel(true)
  }, [closeEditModal, editDirty, selectedZone])

  const requestCloseTemplatePanel = useCallback(() => {
    setShowTemplatePanel(false)
  }, [])

  const openZoneEdit = useCallback(
    (zone: CustomerPageZone, resolvedProductId: string | null) => {
      if (editDirty && selectedZone && !confirmDiscardUnsavedChanges()) return

      if (resolvedProductId) {
        setProductId(resolvedProductId)
      }
      setEditProductId(resolvedProductId)
      setEditDirty(false)
      setSelectedZone(zone)
    },
    [editDirty, selectedZone]
  )

  const syncContextFromIframe = useCallback(
    (options?: { preferMessageProductId?: string | null }) => {
      const fromIframe = readProductContextFromIframe(iframeRef.current)
      const resolvedProductId =
        options?.preferMessageProductId?.trim() ||
        fromIframe.productId ||
        null

      if (fromIframe.pageId) {
        setPageId((prev) => {
          if (prev === fromIframe.pageId) return prev
          if (fromIframe.pageId === 'product-detail' || fromIframe.pageId === 'product-booking') {
            return fromIframe.pageId
          }
          return prev
        })
      }

      return resolvedProductId
    },
    []
  )

  const loadProducts = useCallback(
    async (searchTerm = '') => {
      const trimmed = searchTerm.trim()
      if (trimmed) setProductsSearching(true)
      else setProductsLoading(true)

      try {
        let query = supabase
          .from('products')
          .select('id, name, customer_name_ko, customer_name_en, status')
          .in('status', ['active', 'draft'])
          .order('name', { ascending: true })
          .limit(trimmed ? 60 : 300)

        if (trimmed) {
          const escaped = trimmed.replace(/[%_,]/g, '')
          const pattern = `%${escaped}%`
          query = query.or(
            `name.ilike.${pattern},customer_name_ko.ilike.${pattern},customer_name_en.ilike.${pattern}`
          )
        }

        const { data, error } = await query
        if (error) throw error

        const mapped = (data ?? []).map((row) =>
          productRowToOption(row as ProductRow, previewLocale)
        )

        setProductOptions((prev) => {
          if (!productId) return mapped
          const selected = prev.find((p) => p.id === productId)
          if (!selected || mapped.some((p) => p.id === productId)) return mapped
          return [selected, ...mapped]
        })
      } catch (err) {
        console.error('Failed to load products for workbench:', err)
      } finally {
        setProductsLoading(false)
        setProductsSearching(false)
      }
    },
    [previewLocale, productId]
  )

  useEffect(() => {
    if (syncUrlState && !urlBootstrapped.current) {
      urlBootstrapped.current = true
      const parsed = parseCustomerPageWorkbenchUrl(searchParams)
      if (parsed.pageId) setPageId(parsed.pageId)
      if (parsed.productId) setProductId(parsed.productId)
      if (parsed.previewLocale) setPreviewLocale(parsed.previewLocale)
      if (parsed.previewViewport) setPreviewViewport(parsed.previewViewport)
    }
  }, [syncUrlState, searchParams])

  useEffect(() => {
    if (variant === 'modal' && !isOpen) return
    if (syncUrlState && urlBootstrapped.current) return

    setPageId(initialPageId)
    setProductId(initialProductId)
    setSelectedZone(null)
    setEditProductId(null)
    setEditDirty(false)
    setPreviewLocale(locale === 'en' ? 'en' : 'ko')
    setPreviewViewport('desktop')
    setIframeLoading(true)
  }, [variant, isOpen, initialPageId, initialProductId, locale, syncUrlState])

  useEffect(() => {
    if (!syncUrlState) return

    const nextParams = buildCustomerPageWorkbenchQuery(searchParams, {
      pageId,
      productId,
      previewLocale,
      previewViewport,
    })

    if (workbenchQuerySignature(searchParams) === workbenchQuerySignature(nextParams)) return

    router.replace(`/${locale}/admin/customer-pages?${nextParams.toString()}`, { scroll: false })
  }, [
    syncUrlState,
    pageId,
    productId,
    previewLocale,
    previewViewport,
    locale,
    router,
    searchParams,
  ])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  useEffect(() => {
    if (variant === 'modal' && !isOpen) return

    const forwardBindingsToIframe = () => {
      notifyIframeCustomerPageBindingsUpdate(iframeRef.current)
    }

    window.addEventListener(CUSTOMER_PAGE_BINDINGS_UPDATE_EVENT, forwardBindingsToIframe)
    return () => {
      window.removeEventListener(CUSTOMER_PAGE_BINDINGS_UPDATE_EVENT, forwardBindingsToIframe)
    }
  }, [variant, isOpen])

  useEffect(() => {
    if (variant === 'modal' && !isOpen) return

    const sendEditModeToIframe = () => {
      notifyIframeCustomerPageEditMode(iframeRef.current)
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      if (isCustomerPagePreviewHeightMessage(event.data)) {
        applyIframeHeight(event.data.height)
        return
      }

      if (isCustomerPageHomeLayoutEditMessage(event.data)) {
        openHomeLayoutPanel(event.data.instanceId)
        return
      }

      if (isCustomerPageZoneLayoutEditMessage(event.data)) {
        openZoneLayoutPanel(event.data.pageId, event.data.zoneId)
        return
      }

      if (isCustomerPageListingCardLayoutEditMessage(event.data)) {
        openListingCardLayoutPanel()
        return
      }

      if (isCustomerPageGlobalThemeEditMessage(event.data)) {
        openGlobalThemePanel()
        return
      }

      if (isCustomerPageTemplateEditMessage(event.data)) {
        openTemplatePanel()
        return
      }

      if (!isCustomerPageZoneEditMessage(event.data)) return

      const resolvedProductId =
        syncContextFromIframe({
          preferMessageProductId: event.data.productId ?? null,
        }) ?? productId

      openZoneEdit(event.data.zone, resolvedProductId)
    }

    window.addEventListener('message', handleMessage)
    const retryTimers = [200, 600, 1500].map((ms) =>
      window.setTimeout(sendEditModeToIframe, ms)
    )
    return () => {
      window.removeEventListener('message', handleMessage)
      retryTimers.forEach((id) => window.clearTimeout(id))
    }
  }, [variant, isOpen, iframeKey, previewViewport, applyIframeHeight, syncContextFromIframe, productId, openZoneEdit, openHomeLayoutPanel, openZoneLayoutPanel, openListingCardLayoutPanel, openGlobalThemePanel, openTemplatePanel])

  useEffect(() => {
    const initial = previewViewport === 'mobile' ? 680 : 960
    iframeHeightRef.current = initial
    setIframeContentHeight(initial)
  }, [previewUrl, iframeKey, previewViewport])

  useEffect(() => {
    if (!iframeLoading) return
    const timeoutId = window.setTimeout(() => {
      setIframeLoading(false)
    }, 20000)
    return () => window.clearTimeout(timeoutId)
  }, [iframeLoading])

  const handleNavigateToTab = (tabId: string) => {
    const path = buildAdminPathForEditTab(locale, tabId, productId)
    router.push(path)
    onClose?.()
  }

  const selectedConfig = selectedZone ? getZoneEditConfig(selectedZone) : null
  const activeEditProductId = editProductId ?? productId
  const editingProductLabel = useMemo(() => {
    if (!activeEditProductId) return null
    return productOptions.find((p) => p.id === activeEditProductId)?.label ?? null
  }, [activeEditProductId, productOptions])

  const guardUnsaved = () => {
    if (!editDirty) return true
    return confirmDiscardUnsavedChanges()
  }

  const handlePageTabChange = (id: CustomerPageId) => {
    if (!guardUnsaved()) return
    closeEditModal()
    setShowHomeLayoutPanel(false)
    setShowZoneLayoutPanel(false)
    setShowListingCardLayoutPanel(false)
    setShowGlobalThemePanel(false)
    setShowTemplatePanel(false)
    setPageId(id)
    setIframeLoading(true)
  }

  const handleProductChange = (nextProductId: string | null) => {
    if (!guardUnsaved()) return
    closeEditModal()
    setProductId(nextProductId)
    setIframeLoading(true)
  }

  const handlePreviewLocaleChange = (nextLocale: PreviewLocale) => {
    if (nextLocale === previewLocale) return
    if (!guardUnsaved()) return
    closeEditModal()
    setPreviewLocale(nextLocale)
    setIframeLoading(true)
  }

  const handlePreviewViewportChange = (nextViewport: PreviewViewport) => {
    if (nextViewport === previewViewport) return
    if (!guardUnsaved()) return
    closeEditModal()
    setPreviewViewport(nextViewport)
  }

  const handleProductSearch = useCallback(
    (term: string) => {
      void loadProducts(term)
    },
    [loadProducts]
  )

  if (variant === 'modal' && !isOpen) return null

  const shellClass =
    variant === 'modal'
      ? 'fixed inset-0 z-[70] flex flex-col bg-gray-900/60'
      : 'flex flex-col h-[calc(100vh-4rem)] min-h-[520px] -m-4 sm:-m-6'

  const innerClass =
    variant === 'modal'
      ? 'relative flex flex-col w-full h-full bg-white overflow-hidden'
      : 'relative flex flex-col w-full h-full bg-white overflow-hidden rounded-lg border border-gray-200 shadow-sm'

  const iframeShellClass =
    previewViewport === 'mobile'
      ? 'relative mx-auto w-full max-w-[390px] overflow-hidden rounded-[2rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl'
      : 'relative w-full'

  const iframeClass =
    previewViewport === 'mobile'
      ? 'block w-full border-0 bg-white'
      : 'block w-full border-0 bg-white'

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
            <div className="hidden md:flex items-center gap-1 rounded-lg border border-slate-200 bg-white/80 p-0.5">
              {([
                { id: 'desktop' as const, label: '데스크톱', icon: Monitor },
                { id: 'mobile' as const, label: '모바일', icon: Smartphone },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handlePreviewViewportChange(id)}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    previewViewport === id
                      ? 'bg-slate-800 text-white'
                      : 'text-gray-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-indigo-200 bg-white/80 p-0.5">
              <Languages className="h-3.5 w-3.5 text-indigo-600 ml-1" />
              {(['ko', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handlePreviewLocaleChange(code)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    previewLocale === code
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-indigo-50'
                  }`}
                >
                  {code === 'ko' ? '한국어' : 'English'}
                </button>
              ))}
            </div>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 px-2 py-1.5 rounded-md hover:bg-white/80"
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

        {selectedZone && selectedConfig && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border/60 bg-primary/5 shrink-0">
            <Pencil className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-foreground">
              현재 편집
              {editingProductLabel ? (
                <>
                  : <strong>{editingProductLabel}</strong>
                  {' · '}
                </>
              ) : (
                ': '
              )}
              <strong>{selectedConfig.label}</strong>
              {' · '}
              {previewLocale === 'en' ? 'English' : '한국어'}
            </span>
            {editDirty && (
              <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                미저장 변경
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
          {CUSTOMER_PAGE_REGISTRY.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handlePageTabChange(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                pageId === id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-border'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={openTemplatePanel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors bg-violet-600 text-white hover:bg-violet-700 ml-auto sm:ml-0"
            title={
              isTemplateCustomized
                ? '맞춤 설정 중 · 템플릿 다시 선택'
                : effectiveTemplate
                  ? `현재 템플릿: ${effectiveTemplate.label}`
                  : '페이지 템플릿'
            }
          >
            <Layers className="h-3.5 w-3.5" />
            {isTemplateCustomized ? '템플릿' : effectiveTemplate?.label ?? '템플릿'}
          </button>
          <button
            type="button"
            onClick={openGlobalThemePanel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors bg-indigo-600 text-white hover:bg-indigo-700"
            title={`현재 테마: ${activeGlobalTheme.label}`}
          >
            <Palette className="h-3.5 w-3.5" />
            테마
          </button>
          {pageId === 'home' && (
            <button
              type="button"
              onClick={() => openHomeLayoutPanel()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors bg-violet-600 text-white hover:bg-violet-700"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              섹션 목록
            </button>
          )}
          {pageId === 'products-listing' && (
            <button
              type="button"
              onClick={openListingCardLayoutPanel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors bg-amber-600 text-white hover:bg-amber-700"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              카드 슬롯
            </button>
          )}
          {pageSupportsZoneLayout(pageId) && (
            <button
              type="button"
              onClick={() => openZoneLayoutPanel(pageId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors bg-teal-600 text-white hover:bg-teal-700"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              블록 목록
            </button>
          )}
        </div>

        {needsProduct && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-amber-100 bg-amber-50/80 shrink-0">
            <span className="text-xs font-medium text-amber-900 shrink-0">상품 선택</span>
            <CustomerPageProductSearchSelect
              value={productId}
              options={productOptions}
              loading={productsLoading}
              searching={productsSearching}
              onChange={handleProductChange}
              onSearch={handleProductSearch}
            />
            {!productId && (
              <span className="text-xs text-amber-700">상품 상세·예약 편집에 필요합니다.</span>
            )}
          </div>
        )}

        <div className="flex md:hidden flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50 shrink-0">
          <span className="text-xs font-medium text-slate-700">미리보기</span>
          {([
            { id: 'desktop' as const, label: '데스크톱', icon: Monitor },
            { id: 'mobile' as const, label: '모바일', icon: Smartphone },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handlePreviewViewportChange(id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                previewViewport === id
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-gray-600 border border-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex sm:hidden items-center gap-2 px-4 py-2 border-b border-indigo-100 bg-indigo-50/60 shrink-0">
          <Languages className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          <span className="text-xs text-indigo-900 font-medium">미리보기 언어</span>
          {(['ko', 'en'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handlePreviewLocaleChange(code)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                previewLocale === code
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border border-indigo-200'
              }`}
            >
              {code === 'ko' ? '한국어' : 'English'}
            </button>
          ))}
        </div>

        {!selectedZone && !iframeLoading && (
          <div className="shrink-0 border-b border-border/60 bg-primary/5 px-4 py-2.5 text-center text-xs font-medium leading-relaxed text-foreground">
            {pageId === 'home'
              ? '「템플릿」으로 한 번에 꾸미거나, 상단의 테마·섹션·미리보기 「수정」으로 세부 조정하세요'
              : '상단 「템플릿」·「테마」 또는 미리보기 영역의 「수정」 버튼을 사용하세요'}
          </div>
        )}

        <div
          ref={previewScrollRef}
          className={`relative flex-1 min-h-0 overflow-auto ${
            previewViewport === 'mobile' ? 'bg-slate-200 p-4 sm:p-6' : 'bg-gray-100'
          }`}
        >
          {iframeLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100/80">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          )}
          <div className={iframeShellClass}>
            {previewViewport === 'mobile' && (
              <div className="absolute left-1/2 top-2 z-10 h-1 w-16 -translate-x-1/2 rounded-full bg-gray-700" />
            )}
            <iframe
              ref={iframeRef}
              key={`${previewUrl}-${iframeKey}-${previewViewport}`}
              title="고객 페이지 편집 미리보기"
              src={previewUrl}
              className={iframeClass}
              style={{ height: iframeContentHeight }}
              onLoad={() => {
                setIframeLoading(false)
                notifyIframeCustomerPageEditMode(iframeRef.current)
                notifyIframeCustomerPageBindingsUpdate(iframeRef.current)
                scheduleIframeHeightSync()
                const resolved = syncContextFromIframe()
                if (resolved) setProductId(resolved)
              }}
              onError={() => setIframeLoading(false)}
            />
          </div>
        </div>

        {showTemplatePanel && (
          <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div
              className="absolute inset-0 bg-black/45"
              onClick={requestCloseTemplatePanel}
              aria-hidden
            />
            <div className="relative flex flex-col w-full max-w-3xl h-[min(88vh,calc(100dvh-2rem))] min-h-[min(520px,calc(100dvh-2rem))] my-auto bg-white rounded-xl shadow-2xl overflow-hidden">
              <CustomerPageTemplatePanel
                variant="modal"
                onSaved={() => {
                  refreshPreview()
                }}
                onClose={requestCloseTemplatePanel}
              />
            </div>
          </div>
        )}

        {showGlobalThemePanel && (
          <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div
              className="absolute inset-0 bg-black/45"
              onClick={requestCloseGlobalThemePanel}
              aria-hidden
            />
            <div className="relative flex flex-col w-full max-w-2xl h-[min(88vh,calc(100dvh-2rem))] min-h-[min(480px,calc(100dvh-2rem))] my-auto bg-white rounded-xl shadow-2xl overflow-hidden">
              <CustomerPageGlobalThemePanel
                variant="modal"
                onSaved={() => {
                  refreshPreview()
                }}
                onClose={requestCloseGlobalThemePanel}
              />
            </div>
          </div>
        )}

        {showListingCardLayoutPanel && (
          <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div
              className="absolute inset-0 bg-black/45"
              onClick={requestCloseListingCardLayoutPanel}
              aria-hidden
            />
            <div className="relative flex flex-col w-full max-w-lg h-[min(88vh,calc(100dvh-2rem))] min-h-[min(420px,calc(100dvh-2rem))] my-auto bg-white rounded-xl shadow-2xl overflow-hidden">
              <CustomerPageListingCardLayoutPanel
                variant="modal"
                productId={productId}
                onSaved={() => {
                  refreshPreview()
                }}
                onClose={requestCloseListingCardLayoutPanel}
              />
            </div>
          </div>
        )}

        {showZoneLayoutPanel && (
          <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div
              className="absolute inset-0 bg-black/45"
              onClick={requestCloseZoneLayoutPanel}
              aria-hidden
            />
            <div className="relative flex flex-col w-full max-w-lg h-[min(88vh,calc(100dvh-2rem))] min-h-[min(420px,calc(100dvh-2rem))] my-auto bg-white rounded-xl shadow-2xl overflow-hidden">
              <CustomerPageZoneLayoutPanel
                variant="modal"
                pageId={zoneLayoutPageId}
                initialFocusZoneId={zoneLayoutFocusZoneId}
                productId={productId}
                onSaved={() => {
                  refreshPreview()
                }}
                onClose={requestCloseZoneLayoutPanel}
              />
            </div>
          </div>
        )}

        {showHomeLayoutPanel && (
          <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div
              className="absolute inset-0 bg-black/45"
              onClick={requestCloseHomeLayoutPanel}
              aria-hidden
            />
            <div className="relative flex flex-col w-full max-w-lg h-[min(88vh,calc(100dvh-2rem))] min-h-[min(420px,calc(100dvh-2rem))] my-auto bg-white rounded-xl shadow-2xl overflow-hidden">
              <CustomerPageHomeLayoutPanel
                variant="modal"
                initialEditInstanceId={homeLayoutEditTargetId}
                onSaved={() => {
                  refreshPreview()
                }}
                onClose={requestCloseHomeLayoutPanel}
              />
            </div>
          </div>
        )}

        {selectedZone && selectedConfig && (
          <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div
              className="absolute inset-0 bg-black/45"
              onClick={requestCloseEditModal}
              aria-hidden
            />
            <div className="relative flex flex-col w-full max-w-5xl h-[min(88vh,calc(100dvh-2rem))] min-h-[min(480px,calc(100dvh-2rem))] my-auto bg-white rounded-xl shadow-2xl overflow-hidden">
              <CustomerPageZoneEditPanel
                key={`${selectedZone}-${activeEditProductId ?? 'none'}`}
                zone={selectedZone}
                productId={activeEditProductId}
                locale={previewLocale}
                variant="modal"
                onDirtyChange={setEditDirty}
                onSaved={() => {
                  refreshPreview()
                }}
                onNavigateToTab={handleNavigateToTab}
                onClose={requestCloseEditModal}
              />
            </div>
          </div>
        )}

        <div className="px-4 py-2 border-t border-gray-200 bg-white text-xs text-gray-500 shrink-0">
          {syncUrlState
            ? 'URL에 작업 상태가 저장됩니다. 저장 후 미리보기가 부분 갱신되며 모달을 닫지 않고 연속 편집할 수 있습니다.'
            : '저장 후 미리보기가 부분 갱신됩니다. 모달을 닫지 않고 연속 편집할 수 있습니다.'}
        </div>
      </div>
    </div>
  )
}

export default function CustomerPageEditWorkbench(props: CustomerPageEditWorkbenchProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] min-h-[520px] items-center justify-center rounded-lg border border-gray-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CustomerPageEditWorkbenchInner {...props} />
    </Suspense>
  )
}
