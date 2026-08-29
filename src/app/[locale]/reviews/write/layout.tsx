import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { buildCustomerPageMetadata } from '@/lib/customerSeo'
import { normalizeSiteLocale } from '@/lib/siteLocales'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const siteLocale = normalizeSiteLocale(locale)
  const t = await getTranslations({ locale: siteLocale, namespace: 'writeReview' })

  return buildCustomerPageMetadata({
    locale: siteLocale,
    path: '/reviews/write',
    title: t('metaTitle'),
    description: t('metaDescription'),
  })
}

export default function WriteReviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
