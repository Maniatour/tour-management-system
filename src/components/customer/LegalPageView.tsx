import CustomerPageShell from '@/components/customer/CustomerPageShell'
import LegalPageContent from '@/components/customer/LegalPageContent'
import type { LegalPageContent as LegalPageContentType } from '@/lib/legalContent'
import type { LegalPageSlug } from '@/lib/customerSiteRoutes'
import type { LegalPageLabels } from '@/lib/legalPageLabels'

type LegalPageViewProps = {
  locale: string
  slug: LegalPageSlug
  content: LegalPageContentType
  labels: LegalPageLabels
}

export default function LegalPageView({
  locale,
  slug,
  content,
  labels,
}: LegalPageViewProps) {
  return (
    <CustomerPageShell locale={locale}>
      <LegalPageContent locale={locale} slug={slug} content={content} labels={labels} />
    </CustomerPageShell>
  )
}
