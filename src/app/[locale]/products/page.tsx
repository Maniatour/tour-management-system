import type { Metadata } from 'next'
import ProductsPageClient from '@/components/products/ProductsPageClient'
import {
  buildCustomerPageMetadata,
  getCustomerSeoCopy,
} from '@/lib/customerSeo'
import { normalizeSiteLocale } from '@/lib/siteLocales'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const siteLocale = normalizeSiteLocale(locale)
  const copy = getCustomerSeoCopy(siteLocale)

  return buildCustomerPageMetadata({
    locale: siteLocale,
    path: '/products',
    title: copy.productsTitle,
    description: copy.productsDescription,
  })
}

export default function ProductsPage() {
  return <ProductsPageClient />
}
