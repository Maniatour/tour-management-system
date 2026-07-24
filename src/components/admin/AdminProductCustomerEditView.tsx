'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ExternalLink, Monitor, Smartphone } from 'lucide-react'
import LocaleDropdown from '@/components/LocaleDropdown'
import AdminProductCustomerPreviewPanel from '@/components/admin/AdminProductCustomerPreviewPanel'
import { CustomerPageEditModeProvider } from '@/components/product/CustomerPageEditModeProvider'
import { CustomerPageFieldBindingsProvider } from '@/components/product/CustomerPageFieldBindingsProvider'
import CustomerPageGlobalThemeShell from '@/components/product/CustomerPageGlobalThemeShell'
import { CustomerPageZoneEditProvider } from '@/components/product/CustomerPageZoneEditProvider'
import { buildAdminPathForEditTab, buildCustomerPageEditUrl } from '@/lib/customer-page-registry'
import { normalizeSiteLocale, type SiteLocale } from '@/lib/siteLocales'

type PreviewViewport = 'desktop' | 'mobile'

type AdminProductCustomerEditViewProps = {
  locale: string
  productId: string
}

export default function AdminProductCustomerEditView({
  locale,
  productId,
}: AdminProductCustomerEditViewProps) {
  const t = useTranslations('products.customerPageEdit')
  const router = useRouter()
  const [previewLocale, setPreviewLocale] = useState<SiteLocale>(() =>
    normalizeSiteLocale(locale)
  )
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>('desktop')

  const customerPreviewUrl = useMemo(
    () => buildCustomerPageEditUrl(previewLocale, 'product-detail', { productId, previewLocale }),
    [previewLocale, productId]
  )

  const handleNavigateToTab = (tabId: string) => {
    router.push(buildAdminPathForEditTab(locale, tabId, productId))
  }

  const handlePreviewLocaleChange = (nextLocale: SiteLocale) => {
    if (nextLocale === previewLocale) return
    setPreviewLocale(nextLocale)
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col -m-4 sm:-m-6">
      <header className="shrink-0 border-b border-gray-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href={`/${locale}/admin/products`}
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-gray-600 transition-colors hover:border-primary/40 hover:text-primary"
              aria-label={t('backToProducts')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-900 sm:text-lg">{t('title')}</h1>
              <p className="mt-0.5 text-xs text-gray-600 sm:text-sm">{t('subtitle')}</p>
              <p className="mt-1 text-xs text-slate-500">{productId}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-white/80 p-0.5 md:flex">
              {([
                { id: 'desktop' as const, label: t('desktop'), icon: Monitor },
                { id: 'mobile' as const, label: t('mobile'), icon: Smartphone },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreviewViewport(id)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
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

            <LocaleDropdown
              value={previewLocale}
              onChange={handlePreviewLocaleChange}
              size="sm"
              showLabel
              ariaLabel={t('editLocaleGroup')}
            />

            <a
              href={customerPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-primary hover:bg-white/80"
            >
              {t('openCustomerPage')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <Link
              href={`/${locale}/admin/products/${productId}`}
              className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-600 hover:bg-white/80 md:inline-flex"
            >
              {t('classicAdmin')}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3 md:hidden">
          <span className="text-xs font-medium text-slate-700">{t('preview')}</span>
          {([
            { id: 'desktop' as const, label: t('desktop'), icon: Monitor },
            { id: 'mobile' as const, label: t('mobile'), icon: Smartphone },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreviewViewport(id)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
      </header>

      <CustomerPageFieldBindingsProvider>
        <CustomerPageGlobalThemeShell className="flex min-h-0 flex-1 flex-col">
          <CustomerPageEditModeProvider forced>
            <CustomerPageZoneEditProvider
              productId={productId}
              previewLocale={previewLocale}
              onPreviewLocaleChange={handlePreviewLocaleChange}
              onNavigateToTab={handleNavigateToTab}
            >
              <AdminProductCustomerPreviewPanel
                productId={productId}
                previewLocale={previewLocale}
                previewViewport={previewViewport}
              />
            </CustomerPageZoneEditProvider>
          </CustomerPageEditModeProvider>
        </CustomerPageGlobalThemeShell>
      </CustomerPageFieldBindingsProvider>
    </div>
  )
}
