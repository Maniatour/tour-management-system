import type { CustomerPageId } from '@/lib/customer-page-registry'
import { CUSTOMER_PAGE_REGISTRY } from '@/lib/customer-page-registry'

export type PreviewLocale = 'ko' | 'en'
export type PreviewViewport = 'desktop' | 'mobile'

export type CustomerPageWorkbenchUrlState = {
  pageId: CustomerPageId | null
  productId: string | null
  previewLocale: PreviewLocale | null
  previewViewport: PreviewViewport | null
}

const PAGE_IDS = new Set(CUSTOMER_PAGE_REGISTRY.map((p) => p.id))

export function parseCustomerPageWorkbenchUrl(
  searchParams: URLSearchParams
): CustomerPageWorkbenchUrlState {
  const rawPage = searchParams.get('cpPage')
  const rawLang = searchParams.get('cpLang')
  const rawView = searchParams.get('cpView')

  return {
    pageId: rawPage && PAGE_IDS.has(rawPage as CustomerPageId) ? (rawPage as CustomerPageId) : null,
    productId: searchParams.get('cpProduct')?.trim() || null,
    previewLocale: rawLang === 'ko' || rawLang === 'en' ? rawLang : null,
    previewViewport:
      rawView === 'desktop' || rawView === 'mobile' ? rawView : null,
  }
}

export function buildCustomerPageWorkbenchQuery(
  base: URLSearchParams,
  state: {
    pageId: CustomerPageId
    productId: string | null
    previewLocale: PreviewLocale
    previewViewport: PreviewViewport
  }
): URLSearchParams {
  const params = new URLSearchParams(base.toString())
  params.set('cpPage', state.pageId)
  if (state.productId) params.set('cpProduct', state.productId)
  else params.delete('cpProduct')
  params.set('cpLang', state.previewLocale)
  params.set('cpView', state.previewViewport)
  return params
}
