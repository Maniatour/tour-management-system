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
    path: '/travel-guide',
    title: copy.travelGuideTitle,
    description: copy.travelGuideDescription,
  })
}

export default function TravelGuideLayout({ children }: { children: React.ReactNode }) {
  return children
}
