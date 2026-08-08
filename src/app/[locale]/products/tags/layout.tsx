import type { Metadata } from 'next'
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
    path: '/products/tags',
    title: copy.productsTagsTitle,
    description: copy.productsTagsDescription,
  })
}

export default function ProductsTagsLayout({ children }: { children: React.ReactNode }) {
  return children
}
