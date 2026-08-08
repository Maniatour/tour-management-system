import type { Metadata } from 'next'
import JsonLd from '@/components/seo/JsonLd'
import HomePageClient from '@/components/home/HomePageClient'
import {
  buildCustomerPageMetadata,
  buildOrganizationJsonLd,
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
    path: '/',
    title: copy.homeTitle,
    description: copy.homeDescription,
  })
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const siteLocale = normalizeSiteLocale(locale)

  return (
    <>
      <JsonLd data={buildOrganizationJsonLd(siteLocale)} />
      <HomePageClient />
    </>
  )
}
