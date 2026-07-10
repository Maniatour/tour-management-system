import { setRequestLocale } from 'next-intl/server'
import LegalPageView from '@/components/customer/LegalPageView'
import { extractLegalPageTitle } from '@/lib/legalContent'
import { fetchLegalPageContent } from '@/lib/legalContentPersistence'
import { getLegalPageLabels } from '@/lib/legalPageLabels'
import type { LegalPageSlug } from '@/lib/customerSiteRoutes'

type LegalPageProps = {
  params: Promise<{ locale: string }>
}

export function createLegalPage(slug: LegalPageSlug) {
  async function LegalPage({ params }: LegalPageProps) {
    const { locale } = await params
    setRequestLocale(locale)

    const [content, labels] = await Promise.all([
      fetchLegalPageContent(slug, locale),
      getLegalPageLabels(locale),
    ])

    return <LegalPageView locale={locale} slug={slug} content={content} labels={labels} />
  }

  async function generateMetadata({ params }: LegalPageProps) {
    const { locale } = await params
    const content = await fetchLegalPageContent(slug, locale)
    return {
      title: extractLegalPageTitle(content, slug, locale),
    }
  }

  return { LegalPage, generateMetadata }
}
